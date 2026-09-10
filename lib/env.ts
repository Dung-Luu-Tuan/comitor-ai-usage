import "server-only";
import { PRODUCT_NAME_ASCII } from "@/lib/core/app-identity";
import { LOOPBACK_HOSTS, normalizeHost } from "@/lib/core/url";

/**
 * Đọc biến môi trường ở MỘT chỗ, và nổ sớm khi thiếu.
 *
 * ── VÌ SAO KHÔNG ĐỌC `process.env` RẢI RÁC ──────────────────────────────────────────────────
 * Thiếu `COMITOR_S3_BUCKET` thì app vẫn khởi động bình thường — nó chỉ hỏng lúc người dùng đầu
 * tiên bấm "Đính kèm ảnh", tức sau khi deploy và giữa một luồng đang dở. Gom về đây biến một lỗi
 * lúc chạy thành một lỗi lúc khởi động, và đổi một sự cố im lặng lấy một dòng log đọc được.
 *
 * ⚠ `import "server-only"` ở dòng đầu là CHỐT, không phải trang trí: file này mang giá trị bí mật
 * (khoá S3, mật khẩu SMTP). Một Client Component lỡ import nó sẽ hỏng lúc BIÊN DỊCH thay vì âm
 * thầm đóng gói khoá vào bundle trình duyệt.
 */

/**
 * Dấu hiệu của một giá trị CHƯA ĐIỀN — tức giá trị chép nguyên từ `.env.example`.
 *
 * ⚠ Đây không phải phòng xa. `.env.example` cố ý ghi placeholder dạng hướng dẫn
 * (`"<sinh bằng: …>"`, `"doi-gia-tri-nay-truoc-khi-deploy"`), mà mọi placeholder như vậy là một
 * chuỗi KHÁC RỖNG — nên phép kiểm `!value` cho chúng đi qua trót lọt. Ai chép `.env.example` thành
 * `.env` rồi deploy sẽ có một hệ thống khởi động BÌNH THƯỜNG với những giá trị ai đọc repo cũng biết.
 */
const PLACEHOLDER_PATTERNS = [/^</, /^doi-gia-tri/i, /^thay-/i, /^changeme/i, /^your-/i, /^xxx/i];

function looksLikePlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}. Chép .env.example thành .env rồi điền giá trị (xem README).`);
  }
  if (looksLikePlaceholder(value)) {
    throw new Error(`${name} vẫn đang là giá trị mẫu của .env.example ("${value.slice(0, 24)}…"). Điền giá trị THẬT.`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

/**
 * Bắt buộc CÓ ĐIỀU KIỆN — biến chỉ cần khi một biến khác bật một chế độ nhất định.
 *
 * `COMITOR_SMTP_HOST` vô nghĩa khi `COMITOR_MAIL_TRANSPORT=console`, nên `required()` trần sẽ chặn
 * mọi máy phát triển. Nhưng khi đã chọn `smtp` thì thiếu host là **không gửi được thư nào** — và
 * đó đúng là loại lỗi mà file này tồn tại để biến thành lỗi khởi động.
 */
function requiredWhen(active: boolean, name: string, hint: string): string {
  const value = process.env[name];
  if (active && !value) {
    throw new Error(`Thiếu biến môi trường ${name} (${hint}). Xem .env.example.`);
  }
  return value ?? "";
}

const mailTransport = optional("COMITOR_MAIL_TRANSPORT", "console");
const smtpActive = mailTransport === "smtp";
const sesActive = mailTransport === "ses";

/**
 * Lấy credential AWS bằng KHOÁ TĨNH hay bằng VAI TRÒ CỦA MÁY.
 *
 * Một công tắc cho CẢ S3 lẫn SES, vì trong mọi tôpô thật của Comitor hai dịch vụ này luôn đi cùng
 * một đường: MinIO + khoá ở máy phát triển · khoá ở môi trường preview · **instance role** trên
 * máy production. Hai công tắc riêng chỉ thêm một cách để cấu hình lệch nhau.
 *
 * ── VÌ SAO PHẢI TƯỜNG MINH, KHÔNG SUY TỪ "CÓ KHOÁ HAY KHÔNG" ───────────────────────────
 * Suy ngầm ("không có khoá ⇒ chắc là dùng role") phá vỡ nguyên tắc fail-closed của
 * `storageEnabled`: một máy phát triển quên điền khoá sẽ được coi là "đang dùng role", chức năng
 * đính kèm ảnh bật lên, rồi hỏng GIỮA LUỒNG sau khi người dùng đã chọn xong tệp. Khai thẳng thì
 * thiếu cấu hình vẫn là thiếu cấu hình, và giao diện nói rõ ngay từ đầu.
 */
const awsAuth = optional("COMITOR_AWS_AUTH", "keys");
if (awsAuth !== "keys" && awsAuth !== "instance-role") {
  throw new Error(`COMITOR_AWS_AUTH không hợp lệ: "${awsAuth}". Nhận "keys" hoặc "instance-role".`);
}
const usesInstanceRole = awsAuth === "instance-role";

/**
 * URL gốc của chính module — phân tích được, KHÔNG có dấu `/` cuối, và ngoài loopback thì BẮT BUỘC
 * `https`.
 *
 * ── VÌ SAO LUẬT THEO HOST, KHÔNG THEO `NODE_ENV` ────────────────────────────────────────
 * Cách hiển nhiên là `if (NODE_ENV === "production" && !https) throw`. ĐỪNG. `next build` chạy với
 * `NODE_ENV=production`, nên luật đó làm `pnpm build` hỏng trên MỌI máy lập trình viên — và một
 * phép kiểm cản trở công việc hằng ngày là một phép kiểm sẽ bị gỡ.
 *
 * Luật theo host bắt đúng thứ cần bắt mà không đụng gì tới máy phát triển:
 *   · `http://localhost:3000`    → cho qua (loopback)
 *   · `https://tasks.comitor.ai` → cho qua
 *   · `http://tasks.comitor.ai`  → NỔ  ← đây mới là ca nguy hiểm
 *
 * ── VÌ SAO CA `http://` TỚI HOST THẬT PHẢI NỔ ───────────────────────────────────────────
 * Vì nó hỏng ÂM THẦM. Quên đặt biến thì mọi thứ đỏ ngay ở lần thử khói đầu tiên. Còn đặt `http://`
 * khi TLS kết thúc ở proxy — sai lầm rất phổ biến — thì app CHẠY BÌNH THƯỜNG, trong khi mọi cookie
 * mất cờ `Secure` và mọi liên kết tuyệt đối trong email đi ra dạng `http://`. Không có gì báo.
 *
 * ── VÌ SAO CẮT DẤU `/` CUỐI ────────────────────────────────────────────────────────────
 * Giá trị này được GHÉP với đường dẫn (`${appUrl}/tasks/${id}`) khi dựng liên kết trong email. Một
 * dấu gạch chéo thừa cho `https://host//tasks/…` — không hỏng, nhưng xấu và lọt vào mọi lá thư đã
 * gửi. Và nếu có ngày phép so `Origin` được thêm vào, chuỗi có dấu `/` cuối sẽ không bao giờ khớp.
 */
function absoluteUrl(name: string, fallback: string): string {
  const raw = process.env[name] || fallback;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} phải là URL tuyệt đối (có "https://"), nhận được: "${raw}".`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name} phải dùng http hoặc https, nhận được giao thức "${url.protocol}".`);
  }

  if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(normalizeHost(url.hostname))) {
    throw new Error(
      `${name} trỏ tới host thật "${url.hostname}" bằng http. Phải là https — http làm cookie mất cờ ` +
        "Secure và làm mọi liên kết trong email đi ra dạng http, mà không có gì báo. Nếu TLS kết thúc " +
        "ở reverse proxy thì vẫn khai https ở đây: giá trị này là địa chỉ NGƯỜI DÙNG nhìn thấy, không " +
        "phải địa chỉ nội bộ mà proxy gọi tới."
    );
  }

  // Cắt dấu `/` cuối. `new URL("https://a.com").toString()` tự thêm một dấu, nên phải cắt cả ca đó.
  return url.toString().replace(/\/+$/, "");
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  appUrl: absoluteUrl("COMITOR_APP_URL", "http://localhost:3000"),

  /**
   * Gốc của Comitor.Account (`https://account.dev.comitor.ai` khi phát triển,
   * `https://account.comitor.ai` ở production).
   *
   * ⚠ ĐỌC Ở ĐÂY CHỈ ĐỂ KIỂM. Giá trị thật sự được dùng nằm ở `lib/account/links.ts`, và nó phải
   * đọc `process.env.NEXT_PUBLIC_COMITOR_ACCOUNT_URL` NGUYÊN VĂN vì nó được import từ những file
   * `"use client"` (`app/(shell)/shell-frame.tsx`, `components/access-denied.tsx`…) — mà file này
   * thì mang `import "server-only"` nên không dùng được ở đó.
   *
   * ⚠ Bản trước của khối này gọi `app/(shell)/layout.tsx` là một file `"use client"`. Nó KHÔNG
   * phải — nó là Server Component, và `shell-frame.tsx` tách ra chính vì lý do đó. Một câu sai về
   * đúng cái ranh giới mà cả repo dựng quanh nó thì dạy sai nhiều hơn là không viết gì.
   *
   * Hai chỗ đọc cùng một biến, cố ý: một chỗ để dùng, một chỗ để NỔ SỚM khi nó là URL méo, thiếu
   * `https`, hay có dấu `/` cuối. Không có phép kiểm này thì một cấu hình sai chỉ lộ ra dưới dạng
   * vài đường link chết trong menu — thứ không ai bấm trong lúc thử khói.
   */
  accountUrl: absoluteUrl("NEXT_PUBLIC_COMITOR_ACCOUNT_URL", "https://account.comitor.ai"),

  /**
   * Bí mật ký + mã hoá cookie phiên của module (`lib/account/session-cookie.ts`).
   *
   * ⚠ XOAY NÓ LÀ ĐĂNG XUẤT MỌI NGƯỜI — cookie cũ không giải mã được nữa. Đó là hành vi ĐÚNG (và là
   * nút "thu hồi mọi phiên" duy nhất module có), nhưng phải biết trước khi bấm.
   *
   * ⚠ Nhiều instance thì mọi instance PHẢI dùng cùng một giá trị: cookie do máy này phát mà máy kia
   * không mở được thì người dùng bị đăng xuất ngẫu nhiên theo load balancer — một triệu chứng gần
   * như không thể lần ra.
   */
  sessionSecret: required("COMITOR_SESSION_SECRET"),

  /**
   * Tích hợp Comitor.Account.
   *
   * KHÔNG bắt buộc ở tầng này: thiếu thì `accountConfigured` là `false` và app nói thẳng "chưa cấu
   * hình xác thực" thay vì nổ lúc khởi động. Lý do khác với những biến khác trong file — một máy
   * phát triển đang làm phần giao diện nên chạy được `pnpm build` mà chưa cần Account.
   *
   * ⚠ Nhưng nó KHÔNG rơi về một phiên giả: xem `accountConfigured` ở `lib/account/config.ts`.
   * Thiếu cấu hình thì không ai vào được, chứ không phải ai cũng vào được.
   *
   * `m2m*` là client RIÊNG cho đường máy-tới-máy (đọc danh bạ). Tách khỏi client của người dùng vì
   * scope hẹp chỉ thực sự hẹp khi mỗi đường có client và resource của riêng nó.
   */
  account: {
    clientId: process.env.COMITOR_CLIENT_ID ?? "",
    clientSecret: process.env.COMITOR_CLIENT_SECRET ?? "",
    m2mClientId: process.env.COMITOR_M2M_CLIENT_ID ?? "",
    m2mClientSecret: process.env.COMITOR_M2M_CLIENT_SECRET ?? "",

    /**
     * Bí mật ký webhook mà Comitor.Account gửi sang (`app/api/comitor/webhook/route.ts`).
     *
     * KHÔNG bắt buộc ở tầng này — cùng lý do với `account.*`: một máy phát triển làm phần giao diện
     * nên chạy được mà chưa cần Account. Nhưng route webhook thì **fail-closed**: thiếu bí mật là
     * nó trả 503 và log một dòng viết HOA, chứ không im lặng trả 200 cho mọi thứ gửi tới.
     */
    webhookSecret: process.env.COMITOR_WEBHOOK_SECRET ?? ""
  },

  mailTransport,
  mailFrom: optional("COMITOR_MAIL_FROM", `${PRODUCT_NAME_ASCII} <no-reply@comitor.ai>`),

  /**
   * Máy chủ SMTP. CHỈ đọc khi `COMITOR_MAIL_TRANSPORT=smtp`; ở `console` thì cả khối này bị bỏ qua.
   *
   * SMTP là giao thức chung: cùng bốn biến này chạy được với Amazon SES, Resend, Postmark, một máy
   * chủ tự dựng, và Mailpit ở máy phát triển. Đó là lý do nhánh này tồn tại song song với `ses` —
   * nó là đường THỬ ở local và là lối thoát khi đổi nhà cung cấp.
   */
  smtp: {
    host: requiredWhen(smtpActive, "COMITOR_SMTP_HOST", "máy chủ SMTP"),
    /** 587 = STARTTLS (phổ biến nhất), 465 = TLS ngầm, 1026 = Mailpit của repo này. */
    port: Number.parseInt(optional("COMITOR_SMTP_PORT", "587"), 10),
    /**
     * Rỗng là HỢP LỆ và có nghĩa: máy chủ không đòi xác thực (Mailpit, một relay nội bộ). Ép buộc
     * ở đây sẽ chặn đúng cấu hình phát triển mà ta cần để thử luồng thật.
     */
    user: process.env.COMITOR_SMTP_USER ?? "",
    password: process.env.COMITOR_SMTP_PASSWORD ?? ""
  },

  /**
   * Amazon SES qua API HTTP. CHỈ đọc khi `COMITOR_MAIL_TRANSPORT=ses`.
   *
   * ── VÌ SAO KHOÁ RIÊNG, KHÔNG DÙNG LẠI KHOÁ S3 ──────────────────────────────────────────
   * Dùng chung một cặp khoá cho cả S3 lẫn SES là gộp hai quyền rất khác nhau vào một bí mật: rò nó
   * ra thì kẻ tấn công vừa ghi được vào kho ảnh, vừa **gửi được thư từ tên miền đã xác minh của
   * Comitor**. Cái thứ hai nguy hiểm hơn hẳn — đó là phishing mang dấu DKIM hợp lệ của chính bạn.
   *
   * Lý do thứ hai, thực dụng hơn: danh tính SES được xác minh THEO TỪNG VÙNG, và vùng đó không
   * nhất thiết trùng vùng của bucket S3.
   */
  ses: {
    region: requiredWhen(sesActive, "COMITOR_SES_REGION", "vùng AWS đã xác minh danh tính SES"),
    /* Khoá chỉ bắt buộc ở chế độ `keys`. Với `instance-role` thì để trống và SDK lấy vai trò của máy. */
    accessKeyId: requiredWhen(
      sesActive && !usesInstanceRole,
      "COMITOR_SES_ACCESS_KEY",
      "khoá IAM có quyền ses:SendEmail"
    ),
    secretAccessKey: requiredWhen(sesActive && !usesInstanceRole, "COMITOR_SES_SECRET_KEY", "bí mật của khoá IAM đó"),
    /**
     * Tên cấu hình (configuration set) của SES — KHÔNG bắt buộc.
     *
     * Có nó thì SES bắn sự kiện gửi/mở/bounce/complaint sang CloudWatch hoặc SNS. Đáng bật ở
     * production: **tỉ lệ bounce và complaint cao sẽ làm AWS đình chỉ quyền gửi của cả tài khoản**,
     * và không có configuration set thì bạn chỉ biết điều đó khi đã bị đình chỉ.
     */
    configurationSet: process.env.COMITOR_SES_CONFIGURATION_SET ?? ""
  },

  /**
   * Kho đối tượng cho tệp đính kèm — MinIO ở máy phát triển, S3 thật khi triển khai.
   *
   * ── VÌ SAO MỘT BỘ BIẾN CHO CẢ HAI ─────────────────────────────────────────────────────
   * MinIO nói đúng giao thức S3, nên cùng một `@aws-sdk/client-s3` chạy được cả hai. Khác biệt duy
   * nhất là `endpoint`: có giá trị → trỏ vào MinIO; để TRỐNG → SDK tự dựng endpoint AWS từ
   * `region`. Nhờ vậy không có nhánh `if (isProduction)` nào trong mã, và đường chạy ở máy phát
   * triển giống hệt đường chạy thật — thứ khác nhau chỉ là `.env`.
   *
   * ⚠ KHÔNG có biến "URL công khai": bucket này RIÊNG TƯ. Tệp đi ra giao diện dưới dạng URL ĐÃ KÝ,
   * sinh lại ở mỗi lần đọc — xem `lib/storage.ts`.
   */
  storage: {
    endpoint: process.env.COMITOR_S3_ENDPOINT ?? "",
    region: optional("COMITOR_S3_REGION", "us-east-1"),
    bucket: process.env.COMITOR_S3_BUCKET ?? "",
    /*
     * ⚠ Ở chế độ `instance-role`, khoá bị ÉP về rỗng dù môi trường có đặt gì đi nữa.
     *
     * `lib/storage.ts` và `lib/mail.ts` phân nhánh theo "có khoá hay không" — cách viết gọn nhất ở
     * chỗ gọi. Nhưng nếu không ép ở đây thì một `COMITOR_S3_ACCESS_KEY` còn sót trong `.env` của
     * máy sẽ ÂM THẦM thắng instance role: app vẫn chạy, chỉ là nó đang dùng một khoá dài hạn mà
     * không ai biết — đúng thứ mà cả tôpô instance-role sinh ra để tránh.
     */
    accessKeyId: usesInstanceRole ? "" : (process.env.COMITOR_S3_ACCESS_KEY ?? ""),
    secretAccessKey: usesInstanceRole ? "" : (process.env.COMITOR_S3_SECRET_KEY ?? "")
  }
} as const;

/**
 * Kho ảnh chỉ được coi là BẬT khi có đủ thứ để ghi và ký.
 *
 * Thiếu một là tắt hẳn, không chạy nửa vời: một nút "Đính kèm" gọi vào một client S3 thiếu khoá sẽ
 * hỏng ở giữa luồng, sau khi người dùng đã chọn xong tệp. Tắt từ đầu thì giao diện nói thẳng "chưa
 * nối kho ảnh" — một câu người vận hành sửa được, thay vì một lỗi mạng người dùng không hiểu.
 */
export const storageEnabled = usesInstanceRole
  ? Boolean(env.storage.bucket)
  : Boolean(env.storage.bucket && env.storage.accessKeyId && env.storage.secretAccessKey);

/**
 * ── HAI LỖI CẤU HÌNH PRODUCTION HỎNG **CÂM**, CHẶN Ở ĐÂY ─────────────────────────────────
 *
 * Cả hai đều là ca "chép `.env` của máy phát triển lên máy thật rồi sửa thiếu một dòng", và cả hai
 * đều KHÔNG hỏng lúc khởi động — chúng hỏng ở giữa luồng, hàng giờ sau, với một triệu chứng không
 * gợi gì tới nguyên nhân.
 *
 * ⚠ **`COMITOR_S3_ENDPOINT` trỏ loopback trong khi `COMITOR_APP_URL` thì không.** Không có phép
 * kiểm này: app khởi động sạch, `storageEnabled` là `true`, giao diện hiện ô đính kèm bình thường
 * — rồi mọi lần tải lên đổ vào `localhost:9110` của chính container, tức không tới đâu cả. Không có
 * cấu hình production hợp lệ nào trông như vậy, nên nó là LỖI, không phải cảnh báo.
 *
 * ⚠ **`COMITOR_MAIL_TRANSPORT=console` ở production** thì chỉ CẢNH BÁO, không ném: một môi trường
 * staging cố ý không gửi thư thật là ca hoàn toàn hợp lệ. Nhưng nó phải nói ra — im lặng thì "sao
 * khách hàng không nhận được email nào" là một câu hỏi mất vài ngày mới lần tới đây.
 */
const appIsLoopback = LOOPBACK_HOSTS.has(normalizeHost(new URL(env.appUrl).hostname));

if (!appIsLoopback) {
  const endpoint = env.storage.endpoint;
  if (endpoint) {
    const endpointHost = normalizeHost(new URL(endpoint).hostname);
    if (LOOPBACK_HOSTS.has(endpointHost)) {
      throw new Error(
        `COMITOR_S3_ENDPOINT trỏ tới ${endpointHost} trong khi COMITOR_APP_URL là ${env.appUrl}. ` +
          "Kho tệp sẽ nhận mọi lần tải lên rồi không đi tới đâu. Điền endpoint THẬT của S3/MinIO."
      );
    }
  }

  if (mailTransport === "console") {
    console.warn(
      "[env] MAIL_TRANSPORT=console Ở MÔI TRƯỜNG KHÔNG PHẢI LOOPBACK — không lá thư nào được gửi đi thật. " +
        "Cố ý thì bỏ qua dòng này; không thì đặt COMITOR_MAIL_TRANSPORT=smtp hoặc =ses."
    );
  }
}

/** `true` khi credential AWS đến từ vai trò của máy thay vì khoá tĩnh. */
export const awsUsesInstanceRole = usesInstanceRole;
