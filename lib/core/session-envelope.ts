/**
 * Kiểm ĐỊNH DẠNG của phong bì phiên — phần THUẦN của `seal`/`open` ở `lib/account/session-store.ts`.
 *
 * ── VÌ SAO TÁCH RA ĐÂY, TRONG KHI PHẦN MẬT MÃ Ở LẠI TẦNG D ──────────────────────────────
 * Vì `open()` nuốt MỌI lỗi thành `null` — hành vi đúng (một hàng cũ sót lại phải đưa người dùng về
 * đăng nhập, không phải làm trắng trang) nhưng nó cũng nuốt luôn mọi sai sót ĐỊNH DẠNG, và một sai
 * sót định dạng biểu hiện thành **"đăng xuất ngẫu nhiên"** — triệu chứng không gợi gì tới nguyên
 * nhân, và tự che vì SSO đưa người dùng quay lại trong dưới một giây.
 *
 * Phần kiểm được bằng test là phần THUẦN: đếm mảnh, đo độ dài, soát hình dạng object. Nó xuống
 * tầng 1 và có véc-tơ test. Phần mật mã (`createCipheriv`, khoá scrypt) Ở LẠI tầng D — `node:crypto`
 * không chạy được ở edge runtime, và `lib/core/request-id.ts` đã cố ý tránh cả `Buffer` vì lý do
 * đó. Đưa mật mã xuống đây là mở đường cho một `proxy.ts` tương lai import nó rồi hỏng lúc chạy.
 *
 * ── VÌ SAO ĐO ĐỘ DÀI CHUỖI ĐÃ MÃ, KHÔNG GIẢI MÃ RỒI ĐO BYTE ─────────────────────────────
 * Vì giải mã cần `Buffer` hoặc `atob`, và ở đây không cần: base64url không đệm của n byte dài đúng
 * `ceil(n * 4 / 3)` ký tự. IV 12 byte → 16 ký tự; thẻ GCM 16 byte → 22 ký tự. Một phép so số nguyên
 * thay cho một lần cấp phát.
 */

/** IV của AES-GCM: 12 byte — kích thước chuẩn, xem `seal()`. */
const IV_LENGTH = 16;

/**
 * Thẻ xác thực GCM: 16 byte.
 *
 * ⚠ ĐÂY LÀ PHÉP KIỂM ĐÁNG GIÁ NHẤT TRONG FILE. `decipher.setAuthTag()` của Node NHẬN cả thẻ ngắn
 * hơn — 12 byte, thậm chí 4 byte — và một thẻ 4 byte nghĩa là kẻ tấn công chỉ cần trung bình 2^31
 * lần thử để dựng một phong bì được coi là hợp lệ, thay vì 2^127. Không có gì báo: `open()` vẫn
 * chạy, vẫn trả về object, chỉ là lớp xác thực đã mỏng đi hàng tỉ lần.
 */
const TAG_LENGTH = 22;

/** Ký tự hợp lệ của base64url — KHÔNG có `+`, `/`, `=`. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export interface SessionEnvelope {
  iv: string;
  tag: string;
  body: string;
}

/**
 * Tách `iv.tag.body` và từ chối mọi hình dạng khác.
 *
 * ⚠ ĐÚNG BA MẢNH. Bản trước dùng `const [a = "", b = "", c = ""] = raw.split(".")` — cú pháp đó bỏ
 * QUA mọi mảnh thứ tư trở đi trong im lặng, nên `iv.tag.body.rác` được nhận. Không khai thác được
 * ngay, nhưng nó là một cửa: bất cứ ai sau này thêm một trường vào phong bì sẽ thấy mã cũ "vẫn
 * chạy" với dữ liệu mới, và hai định dạng cùng tồn tại mà không ai biết.
 */
export function parseEnvelope(raw: string): SessionEnvelope | null {
  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  const [iv, tag, body] = parts as [string, string, string];
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH || body.length === 0) return null;
  if (!BASE64URL.test(iv) || !BASE64URL.test(tag) || !BASE64URL.test(body)) return null;

  return { iv, tag, body };
}

/**
 * Soát hình dạng của thứ vừa giải mã ra.
 *
 * ⚠ Bản trước viết `JSON.parse(...) as StoredSession` — một lời KHẲNG ĐỊNH, không phải một phép
 * kiểm. `"chuỗi"`, `[]`, `null`, `{}` đều đi qua nó và trở thành một "phiên" mà `stored.tokens` là
 * `undefined`; lỗi nổ ở một chỗ cách nguyên nhân rất xa, dưới dạng `Cannot read properties of
 * undefined`.
 *
 * Kiểm TỐI THIỂU, cố ý: đúng những gì làm một phiên DÙNG ĐƯỢC. Chép nguyên hợp đồng `AccountTokens`
 * của SDK xuống đây là dựng bản sao thứ hai của một hợp đồng thuộc về repo khác — nó sẽ lệch, và
 * lệch âm thầm. Trường lạ đi qua nguyên vẹn; đó là chủ ý.
 */
export function isSessionShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const tokens = (value as { tokens?: unknown }).tokens;
  if (typeof tokens !== "object" || tokens === null || Array.isArray(tokens)) return false;

  const accessToken = (tokens as { accessToken?: unknown }).accessToken;
  return typeof accessToken === "string" && accessToken.length > 0;
}
