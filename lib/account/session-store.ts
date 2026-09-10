import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { type AccountTokens, isExpired, revokeToken } from "@comitor/account-sdk";
import { ensureFreshTokens } from "@comitor/account-sdk/next";
import { accountConfig } from "@/lib/account/config";
import { isSessionShape, parseEnvelope } from "@/lib/core/session-envelope";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * Kho phiên của module — bộ token OIDC nằm ở **database**, cookie chỉ mang một định danh mờ.
 *
 * ── VÌ SAO KHÔNG CẤT TOKEN THẲNG VÀO COOKIE (BẢN TRƯỚC ĐÃ LÀM VẬY VÀ ĐÃ HỎNG) ─────────────
 * **Next CẤM ghi cookie trong lúc render trang.** `getSession()` được gọi từ `page.tsx`, tức từ
 * đúng chỗ bị cấm; nên khi token hết hạn, app xoay được token nhưng KHÔNG lưu được bộ mới.
 *
 * Với rotation thì đó là một kết cục tồi tệ hơn hẳn "không xoay": Account xoay xong là refresh
 * token cũ **chết ngay**, còn cookie thì vẫn giữ đúng cái token đã chết. Đo được 2026-09-01:
 *
 *   17:58:22  ×5  [auth] KHÔNG XOAY ĐƯỢC TOKEN  Cookies can only be modified in a Server Action…
 *   18:00:33      [auth] KHÔNG XOAY ĐƯỢC TOKEN  invalid refresh token
 *                 GET /tasks 307 → sign-in → callback → GET /   ← mất luôn đích đến
 *
 * và ở phía Account, cả họ token bị xoá vì phát hiện tái sử dụng. Chu kỳ ~15 phút một lần, tự che
 * bởi SSO nên không ai báo.
 *
 * Ghi vào database thì **không đụng tới cookie**, nên hợp lệ ở mọi nơi — kể cả giữa lúc render.
 * Cookie đặt MỘT LẦN lúc đăng nhập và không bao giờ phải đổi nữa.
 *
 * ── HAI LỚP BÍ MẬT, CỐ Ý ─────────────────────────────────────────────────────────────────
 *   · cookie mang một bí mật ngẫu nhiên 32 byte; database chỉ lưu **SHA-256** của nó, nên một bản
 *     kết xuất database KHÔNG chứa vé vào cửa nào dùng được;
 *   · `payload` trong database vẫn được **niêm bằng AES-256-GCM** như bản cũ, nên quyền đọc bảng
 *     cũng chưa đủ lấy refresh token — còn cần `COMITOR_SESSION_SECRET`.
 *
 * Hai lớp đó chặn hai kẻ tấn công KHÁC NHAU: một người đọc được database, và một người đọc được
 * cookie của trình duyệt. Bỏ lớp nào cũng là mở đúng một trong hai đường.
 */

/** 30 ngày — bằng vòng đời của refresh token, không dài hơn. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Khoá 32 byte suy từ `COMITOR_SESSION_SECRET`.
 *
 * `scrypt` chứ không phải cắt thẳng chuỗi bí mật: bí mật do người vận hành đặt có thể ngắn hoặc có
 * entropy thấp, và một hàm dẫn xuất chậm làm việc dò khoá đắt lên đáng kể. Muối cố định là chấp
 * nhận được ở đây vì đầu vào đã là một bí mật, không phải mật khẩu người dùng.
 *
 * Tính MỘT LẦN ở scope module: `scrypt` cố ý chậm (~100ms), và chạy nó ở mỗi request là thêm ngần
 * ấy vào mọi trang.
 *
 * ⚠ Muối giữ nguyên chuỗi `"comitor-session-v1"` của bản cookie. Đổi nó là làm mọi phiên đang mở
 * không giải mã được — tức đăng xuất toàn bộ người dùng, trong im lặng.
 */
const KEY = scryptSync(env.sessionSecret, "comitor-session-v1", 32);

export interface StoredSession {
  tokens: AccountTokens;
  /** Slug workspace đang mở. Xem ghi chú ở `lib/account/session.ts`. */
  workspaceSlug?: string;
  /**
   * id người dùng do Account cấp.
   *
   * ⚠ Cũng được ghi vào CỘT `user_id` chứ không chỉ nằm trong `payload` đã niêm — và đó là toàn bộ
   * lý do cột ấy tồn tại: `payload` mã hoá được nên không truy vấn theo nó được, mà thu hồi phiên
   * của một người vừa bị gỡ khỏi workspace thì phải truy vấn theo đúng thứ đó.
   */
  userId?: string;
  /**
   * `sid` của Account — định danh PHIÊN tại IdP.
   *
   * ⚠ Cũng ghi ra CỘT `sid` chứ không chỉ nằm trong `payload` đã niêm, đúng lý do như `userId`:
   * `payload` mã hoá nên không lọc theo nó được, mà back-channel logout thì phải lọc theo đúng nó.
   */
  sid?: string;
}

function seal(value: StoredSession): string {
  /* IV 12 byte là kích thước chuẩn của GCM — dài hơn không an toàn hơn, chỉ tốn chỗ. */
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

function open(raw: string): StoredSession | null {
  try {
    /*
     * Kiểm định dạng TRƯỚC khi chạm mật mã — phần thuần, có test, ở `lib/core/session-envelope.ts`.
     * Hai thứ nó chặn mà bản trước không chặn, cả hai đã đo trên Node 24:
     *   · phong bì BỐN mảnh — `const [a = "", b = "", c = ""] = raw.split(".")` bỏ qua mảnh thừa
     *     trong im lặng;
     *   · thẻ xác thực NGẮN — `setAuthTag()` nhận cả thẻ 4 byte và vẫn giải mã THÀNH CÔNG, tức lớp
     *     xác thực tụt từ 2^127 xuống 2^31 lần thử. Node chỉ in một `DeprecationWarning`, và cảnh
     *     báo đó không tới được production.
     */
    const envelope = parseEnvelope(raw);
    if (!envelope) return null;

    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(envelope.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(envelope.body, "base64url")), decipher.final()]);

    /*
     * `as StoredSession` là một lời KHẲNG ĐỊNH, không phải phép kiểm — `"chuỗi"`, `[]`, `{}` đều đi
     * qua nó và trở thành một "phiên" mà `stored.tokens` là `undefined`, rồi nổ ở một chỗ cách
     * nguyên nhân rất xa.
     */
    const parsed: unknown = JSON.parse(plain.toString("utf8"));
    if (!isSessionShape(parsed)) return null;
    return parsed as StoredSession;
  } catch {
    /*
     * Mọi lỗi ở đây — chữ ký sai, JSON hỏng, khoá đã đổi vì ai đó xoay `COMITOR_SESSION_SECRET` —
     * đều có cùng một câu trả lời đúng: **coi như chưa đăng nhập**. Ném lỗi ra ngoài thì một hàng
     * cũ sót lại sẽ làm trang trắng thay vì đưa người dùng về màn đăng nhập.
     */
    return null;
  }
}

/**
 * Khoá tra của hàng trong database: SHA-256 của bí mật trong cookie.
 *
 * SHA-256 trần là ĐỦ ở đây, và cố ý khác với cách băm mật khẩu: đầu vào là 32 byte ngẫu nhiên do
 * máy chủ sinh, không phải chuỗi người tự nghĩ. Không có từ điển nào dò được nó, nên một hàm băm
 * chậm chỉ thêm độ trễ vào MỌI request mà không mua thêm gì.
 */
function rowId(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Mở một phiên mới, trả về **bí mật để đặt vào cookie**.
 *
 * Dọn hàng hết hạn ngay tại đây, không cần cron: đăng nhập là thao tác hiếm và đã đắt sẵn (một
 * vòng OIDC), nên thêm một `DELETE` vào đó không ai thấy. Treo việc dọn vào một tiến trình nền
 * riêng là thêm một thứ phải cài, phải theo dõi, và phải nhớ khi sao chép khuôn này sang module
 * khác — ba cơ hội để nó không tồn tại ở nơi cần nó nhất.
 */
export async function createSession(value: StoredSession): Promise<string> {
  const secret = randomBytes(32).toString("base64url");

  await prisma.accountSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.accountSession.create({
    data: {
      id: rowId(secret),
      payload: seal(value),
      /*
       * ⚠ `userId` nằm ở HAI chỗ, cố ý: trong `payload` (đã niêm, để đọc lại cùng token) và ở cột
       * riêng (để TRUY VẤN được). Đây không phải bản sao thừa — `payload` mã hoá bằng AES-GCM nên
       * không có cách nào lọc theo nó, mà "xoá mọi phiên của người này" thì bắt buộc phải lọc.
       */
      userId: value.userId ?? null,
      sid: value.sid ?? null,
      expiresAt: new Date(Date.now() + MAX_AGE_SECONDS * 1000)
    }
  });

  return secret;
}

/** Phiên đang mở, hoặc `null` khi hàng không còn / đã hết hạn / không giải mã được. */
export async function readSession(secret: string): Promise<StoredSession | null> {
  const row = await prisma.accountSession.findUnique({ where: { id: rowId(secret) } });
  if (!row) return null;

  /*
   * Kiểm hạn ở TẦNG ĐỌC, không chỉ dựa vào phép dọn định kỳ: một hàng quá hạn còn nằm đó cho tới
   * lần đăng nhập kế tiếp, và trong khoảng đó nó vẫn tra được.
   */
  if (row.expiresAt.getTime() <= Date.now()) return null;

  return open(row.payload);
}

/**
 * Ghi đè nội dung phiên — đường ghi cho `workspaceSlug`.
 *
 * ⚠ HÔM NAY CHƯA CÓ AI GỌI, và đó là sự thật chứ không phải chỗ còn thiếu: chưa màn hình nào cho
 * đổi workspace, nên `getSession()` luôn tự chọn workspace đầu tiên đã bật app này. Hàm tồn tại vì
 * `workspaceSlug` đã nằm trong hợp đồng và ĐƯỢC ĐỌC — một trường đọc được mà không có đường ghi là
 * một cái bẫy cho người viết màn hình đó. Xem ghi chú dài ở đầu `lib/account/session.ts`.
 */
export async function updateSession(secret: string, value: StoredSession): Promise<void> {
  await prisma.accountSession.update({
    where: { id: rowId(secret) },
    data: { payload: seal(value) }
  });
}

/** Xoá hàng. Không tìm thấy cũng là thành công — đích đến là "không còn phiên". */
async function deleteSession(secret: string): Promise<void> {
  await prisma.accountSession.deleteMany({ where: { id: rowId(secret) } });
}

/**
 * Đóng một phiên: **thu hồi refresh token ở Account rồi mới xoá hàng**. Trả về phiên vừa đóng để
 * người gọi còn dùng `idToken` (đăng xuất toàn hệ cần `id_token_hint`).
 *
 * ── VÌ SAO ĐÂY LÀ ĐƯỜNG DUY NHẤT ĐỂ KẾT THÚC MỘT PHIÊN ───────────────────────────────────
 * `deleteSession` cố ý KHÔNG xuất ra ngoài. Xoá hàng mà quên thu hồi token là để lại một refresh
 * token còn sống mà **không ai với tới được nữa** — đổi được access token cho tới khi hết hạn,
 * hàng tuần, trong khi mọi người đều tin phiên đó đã chết. Gộp hai việc vào một hàm thì không có
 * đường nào làm một nửa.
 *
 * Đo được 2026-09-01: 14 refresh token còn sống cho client này, phần lớn là rác của những lần
 * đăng nhập lại trên cùng một trình duyệt — mỗi lần đè cookie là bỏ lại một phiên không với tới
 * được. Bản cookie trước cũng để lại đúng loại rác đó ở phía Account, chỉ là không có bảng nào để
 * nhìn thấy nó.
 *
 * Thu hồi là BEST-EFFORT: Account không với tới được thì vẫn phải xoá hàng và cho người dùng
 * thoát. Ném lỗi ở đây là để họ mắc kẹt trong một phiên họ vừa nói là muốn kết thúc.
 */
export async function closeSession(secret: string): Promise<StoredSession | null> {
  const stored = await readSession(secret);

  if (stored?.tokens.refreshToken) {
    try {
      await revokeToken(accountConfig, stored.tokens.refreshToken);
    } catch (error) {
      console.warn("[auth] không thu hồi được refresh token:", error);
    }
  }

  await deleteSession(secret);
  return stored;
}

/**
 * Bộ token còn hạn — tự xoay khi cần, và **chỉ một người xoay tại một thời điểm**.
 *
 * ── VÌ SAO PHẢI KHOÁ HÀNG, KHÔNG CHỈ GỘP TRONG TIẾN TRÌNH ────────────────────────────────
 * `ensureFreshTokens` của SDK gộp các lời gọi đồng thời **trong một tiến trình**. Khi app chạy
 * nhiều instance sau một bộ cân bằng tải thì hai instance vẫn có thể cùng xoay MỘT refresh token,
 * và với Account thì đó không phải chuyện nhỏ: token đã xoay mà bị trình lại là dấu hiệu **tái sử
 * dụng**, và phản ứng đúng chuẩn của nó là thu hồi CẢ HỌ token — người dùng bị đăng xuất thật.
 *
 * `SELECT … FOR UPDATE` biến hàng phiên thành điểm hẹn: ai vào trước thì xoay, người đến sau **chờ
 * ở chính câu lệnh đó**, và khi khoá nhả ra thì đọc lại được bộ token mới. Không cần vòng lặp hỏi
 * đi hỏi lại, không cần cột "đang xoay", không cần Redis.
 *
 * Người đến sau không gọi Account lần nữa: `ensureFreshTokens` kiểm hạn trên bộ token VỪA ĐỌC LẠI
 * trong transaction, thấy còn hạn thì trả về ngay và không chạy `onRotate`.
 *
 * ⚠ Cái giá, nói thẳng: transaction này **giữ một kết nối database trong lúc gọi mạng sang
 * Account** (~100–300ms). Ở quy mô của một module thì chấp nhận được, và `lock_timeout` chặn kịch
 * bản xấu nhất. Khi số kết nối trở thành thứ phải đếm, chỗ cần đổi là ở đây — một khoá ngoài
 * database (Redis) hoặc một cột "đang xoay" — chứ không phải bỏ khoá đi.
 */
export async function freshTokens(secret: string, current: AccountTokens): Promise<AccountTokens> {
  if (!isExpired(current)) return current;

  const id = rowId(secret);

  return prisma.$transaction(
    async (tx) => {
      /*
       * Không có `lock_timeout` thì một transaction treo ở phía bên kia giữ khoá vô hạn, và mọi
       * request của người dùng này xếp hàng sau nó — một trang treo thay vì một lỗi.
       */
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");

      const rows = await tx.$queryRaw<{ payload: string }[]>`
        SELECT payload FROM account_sessions WHERE id = ${id} FOR UPDATE
      `;
      const payload = rows[0]?.payload;
      if (!payload) throw new Error("Phiên không còn tồn tại.");

      const stored = open(payload);
      if (!stored) throw new Error("Phiên không giải mã được.");

      return ensureFreshTokens(accountConfig, stored.tokens, async (rotated) => {
        await tx.accountSession.update({
          where: { id },
          data: { payload: seal({ ...stored, tokens: rotated }) }
        });
      });
    },
    /*
     * `timeout` phải rộng hơn `lock_timeout` cộng thời gian gọi Account, nếu không Prisma huỷ
     * transaction đúng vào lúc nó sắp thành công — và triệu chứng sẽ là "thỉnh thoảng đăng xuất",
     * đúng loại lỗi mà cả file này sinh ra để diệt.
     */
    { timeout: 20_000, maxWait: 15_000 }
  );
}

/**
 * Thu hồi MỌI phiên của một người trong module này.
 *
 * ── VÌ SAO ĐƯỜNG NÀY PHẢI CÓ ─────────────────────────────────────────────────────────────
 * Phiên ở đây sống 30 ngày, và trước hàm này đường đóng DUY NHẤT là `/api/auth/sign-out` — tức
 * chính người dùng phải tự bấm. Nghĩa là: quản trị viên gỡ một người khỏi không gian làm việc ở
 * Account, và module vẫn cho họ vào cho tới khi token hết hạn.
 *
 * `contextCacheSeconds: 30` chỉ thu hẹp cửa sổ đó xuống 30 giây cho phép kiểm QUYỀN — nhưng phiên
 * thì vẫn còn, và với `NO_SEAT`/`NOT_A_MEMBER` người dùng chỉ thấy màn chặn chứ chưa bị đăng xuất.
 *
 * @returns số phiên đã xoá — dùng cho log, và để phân biệt "không có gì để thu hồi" với "đã thu".
 */
/**
 * Đóng MỌI phiên gắn với một `sid` của Account — đường của back-channel logout.
 *
 * ⚠⚠ THAM SỐ LÀ CHUỖI BẮT BUỘC, VÀ PHÉP ASSERT DƯỚI ĐÂY KHÔNG THỪA DÙ KIỂU ĐÃ NÓI VẬY.
 * Prisma coi `undefined` trong `where` là **bỏ điều kiện đó đi**, nên `deleteMany({ where: { sid:
 * undefined } })` biên dịch thành `where: {}` — tức **XOÁ TOÀN BỘ `account_sessions`**, đăng xuất
 * mọi người dùng của module. TypeScript KHÔNG bắt được: `string | undefined` gán được vào kiểu
 * filter của Prisma. Và ca đó với tới được ngay từ hợp đồng của chính tính năng — §2.6 #4 cho phép
 * một `logout_token` chỉ mang `sub` mà không có `sid`.
 * Triệu chứng nếu để lọt: mọi người bị đăng xuất cùng lúc, nhìn y hệt một lần deploy.
 *
 * `sid` rỗng cũng bị chặn: chuỗi rỗng khớp mọi hàng có `sid = ''`.
 *
 * @returns số phiên đã đóng. `0` là kết quả BÌNH THƯỜNG — token phát lại, phiên đã đóng trước đó,
 * hoặc người dùng đăng nhập Account ở một trình duyệt chưa từng mở module này.
 */
export async function closeSessionsBySid(sid: string): Promise<number> {
  if (typeof sid !== "string" || sid.length === 0) {
    throw new TypeError("closeSessionsBySid: `sid` phải là chuỗi khác rỗng.");
  }
  const { count } = await prisma.accountSession.deleteMany({ where: { sid } });
  return count;
}

export async function revokeSessionsForUser(userId: string): Promise<number> {
  const { count } = await prisma.accountSession.deleteMany({ where: { userId } });
  return count;
}
