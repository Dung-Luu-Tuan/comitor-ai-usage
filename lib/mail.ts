import "server-only";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";
import { PRODUCT_NAME_ASCII } from "@/lib/core/app-identity";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";

/**
 * Gửi email.
 *
 * BA transport, cho BA HOÀN CẢNH khác nhau — không phải ba cách làm cùng một việc:
 *
 *   · `console` — in ra terminal. Mặc định khi phát triển: thử được luồng "giao việc → có thư" mà
 *     không cần dịch vụ nào, và không có nguy cơ gửi nhầm ra email thật lúc chạy seed.
 *     ⚠ Nó KHÔNG chạy một dòng nào của hai nhánh kia, nên nó **không chứng minh được gì** về đường
 *     gửi thật. Dùng Mailpit (đã có trong `docker-compose.yml`) khi cần đi đường thật ở local.
 *   · `smtp`   — giao thức chung, chạy với Mailpit ở local và với bất kỳ nhà cung cấp nào.
 *   · `ses`    — Amazon SES qua API HTTP. Đường của **PRODUCTION**: nó lấy credential từ IAM
 *     instance role (không có mật khẩu SMTP dài hạn nào phải cất giữ, xoay, hay lo rò), và nó đi
 *     qua HTTPS 443 thay vì cổng ra 25/465/587.
 */

export interface MailMessage {
  to: string;
  subject: string;
  /** Nội dung chữ thuần — BẮT BUỘC. Client email nào cũng đọc được, và log đọc được bằng mắt. */
  text: string;
  html?: string;
}

type Transport = (message: MailMessage) => Promise<void>;

const consoleTransport: Transport = async (message) => {
  const line = "─".repeat(72);
  console.info(`\n${line}\n[email → ${message.to}]\n${message.subject}\n${line}\n${message.text}\n${line}\n`);
};

/**
 * Transporter dùng lại giữa các lần gửi.
 *
 * `createTransport` mở một POOL kết nối; tạo mới ở mỗi lần gửi là bắt tay TLS lại từ đầu cho mỗi
 * email, và với nhà cung cấp có giới hạn kết nối thì đó là đường nhanh nhất tới lỗi "too many
 * connections".
 *
 * Dựng LƯỜI (ở lần gửi đầu tiên) chứ không ở scope module: file này bị import bởi những đường mà
 * mọi route đều kéo vào, nên mở socket lúc import nghĩa là mỗi tiến trình build cũng đi mở một
 * kết nối SMTP.
 */
let pooledTransporter: nodemailer.Transporter | null = null;

function smtpTransporter(): nodemailer.Transporter {
  if (pooledTransporter) return pooledTransporter;
  pooledTransporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    /*
     * `secure` SUY TỪ CỔNG, không phải một biến riêng. 465 là TLS ngầm (bọc TLS ngay khi mở
     * socket); 587 và 25 mở dạng thô rồi nâng cấp bằng STARTTLS. Đây là quy ước của chính giao
     * thức, nên một biến `COMITOR_SMTP_SECURE` chỉ tạo thêm một cách để cấu hình sai: đặt
     * `secure=true` với cổng 587 làm kết nối TREO tới khi hết giờ, không báo gì.
     */
    secure: env.smtp.port === 465,
    /*
     * `requireTLS` cho mọi cổng KHÔNG phải 465.
     *
     * Ở 465 thì `secure: true` đã bọc TLS ngay từ lúc mở socket. Ở 587/25 thì kết nối mở dạng THÔ
     * rồi mới nâng cấp bằng STARTTLS — và nếu máy chủ không quảng cáo STARTTLS (hoặc có kẻ đứng
     * giữa gỡ nó đi), nodemailer mặc định vẫn gửi tiếp **qua kênh không mã hoá**, tức mật khẩu SMTP
     * đi ra dạng thô. `requireTLS` biến ca đó thành một lỗi ồn ào thay vì một lỗ hổng im lặng.
     *
     * Không ảnh hưởng Mailpit: nó không đòi xác thực nên không có mật khẩu nào để mất, và cờ này
     * chỉ bật khi có `user`.
     */
    ...(env.smtp.user && env.smtp.port !== 465 ? { requireTLS: true } : {}),
    /*
     * Không có user thì KHÔNG gửi khối `auth`. Truyền `{ user: "", pass: "" }` làm nodemailer vẫn
     * thử AUTH và máy chủ không đòi xác thực (Mailpit) sẽ từ chối — hỏng đúng ở môi trường phát
     * triển, nơi ta cần nó chạy nhất.
     */
    ...(env.smtp.user ? { auth: { user: env.smtp.user, pass: env.smtp.password } } : {}),
    pool: true
  });
  return pooledTransporter;
}

const smtpTransport: Transport = async (message) => {
  await smtpTransporter().sendMail({
    from: env.mailFrom,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {})
  });
};

/** Dựng lười và giữ lại, cùng lý do với transport SMTP: client của AWS SDK giữ một agent HTTP keep-alive. */
let sesClientInstance: SESv2Client | null = null;

function sesClient(): SESv2Client {
  if (sesClientInstance) return sesClientInstance;
  sesClientInstance = new SESv2Client({
    region: env.ses.region,
    /*
     * Có khoá thì khai TƯỜNG MINH, không để SDK tự dò. Chuỗi provider mặc định lần lượt thử biến
     * `AWS_*`, hồ sơ `~/.aws`, rồi metadata của máy — nên để nó tự dò ở môi trường có khoá nghĩa
     * là một `AWS_ACCESS_KEY_ID` lạc vào (do một tích hợp khác đặt) sẽ ÂM THẦM được dùng để gửi
     * thư từ tên miền đã xác minh của Comitor.
     *
     * Không có khoá (`COMITOR_AWS_AUTH=instance-role`) thì CỐ Ý để trống, và lúc đó chuỗi provider
     * chính là thứ ta muốn: nó lấy IAM instance role.
     */
    ...(env.ses.accessKeyId
      ? { credentials: { accessKeyId: env.ses.accessKeyId, secretAccessKey: env.ses.secretAccessKey } }
      : {})
  });
  return sesClientInstance;
}

const sesTransport: Transport = async (message) => {
  await sesClient().send(
    new SendEmailCommand({
      FromEmailAddress: env.mailFrom,
      Destination: { ToAddresses: [message.to] },
      ...(env.ses.configurationSet ? { ConfigurationSetName: env.ses.configurationSet } : {}),
      Content: {
        Simple: {
          /*
           * ⚠ `Charset: "UTF-8"` là BẮT BUỘC ở cả tiêu đề lẫn thân, không phải trang trí.
           *
           * Thiếu nó thì SES mã hoá theo mặc định 7-bit và mọi dấu tiếng Việt trở thành rác — "Bạn
           * được giao một công việc" thành "Bn c giao mt cng vic". Hỏng ÂM THẦM: API vẫn trả 200,
           * thư vẫn tới nơi, chỉ có người nhận đọc không ra. Và nó chỉ lộ với người dùng tiếng
           * Việt, tức gần như mọi người dùng của Comitor.
           */
          Subject: { Data: message.subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: message.text, Charset: "UTF-8" },
            ...(message.html ? { Html: { Data: message.html, Charset: "UTF-8" } } : {})
          }
        }
      }
    })
  );
};

function resolveTransport(): Transport {
  switch (env.mailTransport) {
    case "console":
      return consoleTransport;
    case "smtp":
      return smtpTransport;
    case "ses":
      return sesTransport;
    default:
      throw new Error(
        `COMITOR_MAIL_TRANSPORT không hợp lệ: "${env.mailTransport}". Nhận "console", "smtp" hoặc "ses".`
      );
  }
}

/**
 * Gửi, và NUỐT lỗi GỬI — nhưng KHÔNG nuốt lỗi CẤU HÌNH.
 *
 * ── VÌ SAO NUỐT LỖI GỬI ─────────────────────────────────────────────────────────────────────
 * Thư báo "bạn được giao việc" nằm thẳng trên đường của thao tác "tạo công việc". Ném lỗi ở đó thì
 * cả request hỏng — người dùng thấy "tạo việc thất bại" trong khi công việc ĐÃ được tạo. Đó là
 * trạng thái tệ nhất: hỏng nửa vời, và người dùng thử lại thì có hai bản ghi.
 *
 * Đánh đổi: thư mất thì người dùng không biết. Bù bằng thông báo trong ứng dụng — nó đi đường
 * khác (bảng `notifications`) và không phụ thuộc SMTP.
 *
 * ── ⚠ VÌ SAO `resolveTransport()` NẰM NGOÀI `try` ───────────────────────────────────────────
 * Đây là một lỗi CÓ THẬT đã gặp ở Comitor.Account. Bản trước gọi `resolveTransport()` BÊN TRONG
 * khối `try`, nên một `COMITOR_MAIL_TRANSPORT` gõ sai — thứ nhánh `default` ném để báo động — cũng
 * bị nuốt y như một lần gửi hỏng. Hậu quả: **không cấu hình sai nào của biến này làm request đỏ**,
 * và cả hệ thống chạy êm ru trong khi không một lá thư nào đi ra.
 *
 * Ranh giới đúng, và nó đúng bằng MỘT DÒNG MÃ: cấu hình sai là lỗi của NGƯỜI VẬN HÀNH và phải ồn
 * ào; một lần gửi hỏng là sự cố mạng và phải êm. Giữ đúng hai loại đó ở hai phía của `try`.
 *
 * (Lỗi cấu hình SMTP thiếu biến thì còn nổ sớm hơn nữa — `lib/env.ts` chặn ngay lúc khởi động.)
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const transport = resolveTransport();
  try {
    await transport(message);
  } catch (error) {
    /*
     * `[mail] KHÔNG GỬI ĐƯỢC` viết hoa và cố định để còn grep/alert được: đây là dòng log DUY NHẤT
     * cho biết một người dùng vừa mất một lá thư.
     *
     * Địa chỉ bị CHE. Log của một app nghiệp vụ thường đi vào một hệ gom log mà nhiều người đọc
     * được, và một danh sách email đầy đủ trong đó là dữ liệu cá nhân bị mang đi xa hơn mức cần.
     */
    console.error("[mail] KHÔNG GỬI ĐƯỢC", {
      to: maskEmail(message.to),
      subject: message.subject,
      transport: env.mailTransport,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/** `minhanh@comitor.vn` → `m•••••h@comitor.vn`. Đủ để đối chiếu, không đủ để thu thập. */
function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  const name = email.slice(0, at);
  const domain = email.slice(at);
  if (name.length <= 2) return `${name.slice(0, 1)}•${domain}`;
  return `${name.slice(0, 1)}${"•".repeat(Math.min(name.length - 2, 5))}${name.slice(-1)}${domain}`;
}

/* ─────────────────────────────────────────────────────────────────────────────────────────────
 * NỘI DUNG EMAIL — theo ngôn ngữ của NGƯỜI NHẬN
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 *
 * ── VÌ SAO CHUỖI EMAIL KHÔNG NẰM TRONG `messages/*.json` ────────────────────────────────────
 * Ba lý do, xếp theo sức nặng:
 *
 *   1. **`Record<Locale, …>` mạnh hơn `pnpm i18n:check`.** Bộ chuỗi giao diện phải kiểm bằng
 *      script vì `next-intl` tra khoá lúc CHẠY; ở đây TypeScript bắt thiếu ngôn ngữ ngay lúc BIÊN
 *      DỊCH. Đổi một công cụ kiểm lúc-chạy lấy một công cụ kiểm lúc-build là đi đúng hướng.
 *   2. **Ngôn ngữ ở đây là của NGƯỜI NHẬN, không phải của request.** `getTranslations()` mặc định
 *      đọc ngôn ngữ của người đang bấm nút — nhưng người bấm "Giao việc" và người nhận thư là hai
 *      người khác nhau. Một API dễ dùng sai theo mặc định là một API sẽ bị dùng sai.
 *   3. **Email gửi được từ NGOÀI vòng đời request** (một cron nhắc hạn, một hàng đợi).
 *      `getTranslations` là API `react-server`; buộc nội dung thư phụ thuộc vào nó là tự khoá cửa.
 *
 * ── VÌ SAO KHÔNG CÓ BẢN HTML ────────────────────────────────────────────────────────────────
 * Chỉ `text`. Thư của module này có đúng MỘT việc: đưa một đường link tới tay người dùng. Chữ
 * thuần đọc được ở mọi client, không bị lọc ảnh, không rơi vào spam vì một thẻ `<table>` hỏng, và
 * đọc được thẳng trong terminal lúc phát triển (`COMITOR_MAIL_TRANSPORT=console`).
 */

/** Nhận `locale` từ bất kỳ đâu (hồ sơ Account, cột DB) và ép về một `Locale` hợp lệ. */
export function toMailLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Tên sản phẩm mà NGƯỜI NHẬN đọc — theo ngôn ngữ của họ, không phải của người bấm nút.
 *
 * ⚠ **Một trong ba dòng mà module mới PHẢI đổi** (hai dòng kia là `APP_ID` ở
 * `lib/core/app-identity.ts` và nhãn app ở `messages/*.json`). Quên nó thì mọi lá thư của Comitor
 * CRM ký tên "Comitor Công việc" — và người nhận thấy điều đó trước đội phát triển.
 *
 * Vì sao không đọc từ `messages/*.json`: thư được dựng ở những chỗ KHÔNG có request nào (một job
 * nhắc hạn, một hàng đợi), nơi `next-intl` không có ngữ cảnh. Đây là một trong bốn chỗ chứa chuỗi
 * được liệt kê ở `docs/kien-truc-ung-dung.md` §5.
 */
const PRODUCT_NAME: Record<Locale, string> = {
  vi: "Comitor AI Usage",
  en: PRODUCT_NAME_ASCII
};

/** Khối chữ ký ở cuối mọi email — khai một chỗ để mọi thư nói cùng một giọng. */
const SIGNATURE: Record<Locale, string> = {
  vi: `\n\n—\n${PRODUCT_NAME.vi}\nĐây là email tự động, vui lòng không trả lời.`,
  en: `\n\n—\n${PRODUCT_NAME.en}\nThis is an automated message; please do not reply.`
};

type MailBody = Omit<MailMessage, "to">;

export interface TaskMailContext {
  /** Tên người gây ra sự kiện. */
  actorName: string;
  taskCode: string;
  taskTitle: string;
  /** Hạn chót đã ĐỊNH DẠNG SẴN theo ngôn ngữ người nhận — xem ghi chú dưới. */
  dueDate: string;
  /** Link tuyệt đối tới công việc. Dựng từ `env.appUrl`, không ghép tay ở chỗ gọi. */
  url: string;
}

/**
 * ⚠ `dueDate` vào đây là chuỗi ĐÃ ĐỊNH DẠNG, không phải ISO — và đó là ngoại lệ có lý do của luật
 * "tầng dữ liệu giữ giá trị, không giữ chuỗi".
 *
 * Định dạng ngày phụ thuộc `Intl` và LOCALE của người nhận (`28/08/2026` ⇄ `08/28/2026`). Làm phép
 * đổi đó ở chỗ gọi — nơi đã biết `locale` — thì file này không phải kéo `Intl` vào và không phải
 * lặp lại phép chọn khuôn ngày ở hai chỗ. Chỗ gọi dùng `formatIsoDateFor(locale, iso)` của
 * `lib/format.ts`.
 */
export const mailTemplates = {
  taskAssigned(locale: Locale, context: TaskMailContext): MailBody {
    const body: Record<Locale, MailBody> = {
      vi: {
        subject: `${context.taskCode} · Bạn được giao một công việc`,
        text:
          `${context.actorName} vừa giao cho bạn công việc "${context.taskTitle}" (${context.taskCode}).\n\n` +
          `Hạn chót: ${context.dueDate}\n\n` +
          `Mở công việc:\n${context.url}\n\n` +
          "Không muốn nhận thư này nữa? Tắt ở phần Cài đặt → Thông báo trong ứng dụng." +
          SIGNATURE.vi
      },
      en: {
        subject: `${context.taskCode} · A task was assigned to you`,
        text:
          `${context.actorName} assigned you the task "${context.taskTitle}" (${context.taskCode}).\n\n` +
          `Due: ${context.dueDate}\n\n` +
          `Open the task:\n${context.url}\n\n` +
          "Don't want these emails? Turn them off in Settings → Notifications." +
          SIGNATURE.en
      }
    };
    return body[locale];
  },

  taskDueSoon(locale: Locale, context: TaskMailContext): MailBody {
    const body: Record<Locale, MailBody> = {
      vi: {
        subject: `${context.taskCode} · Sắp tới hạn`,
        text:
          `Công việc "${context.taskTitle}" (${context.taskCode}) sẽ tới hạn vào ${context.dueDate}.\n\n` +
          `Mở công việc:\n${context.url}\n\n` +
          "Không muốn nhận thư này nữa? Tắt ở phần Cài đặt → Thông báo trong ứng dụng." +
          SIGNATURE.vi
      },
      en: {
        subject: `${context.taskCode} · Due soon`,
        text:
          `The task "${context.taskTitle}" (${context.taskCode}) is due on ${context.dueDate}.\n\n` +
          `Open the task:\n${context.url}\n\n` +
          "Don't want these emails? Turn them off in Settings → Notifications." +
          SIGNATURE.en
      }
    };
    return body[locale];
  }
} as const;
