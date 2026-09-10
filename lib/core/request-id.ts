/**
 * `x-request-id` — **tên header lần vết của cả hệ sinh thái Comitor**.
 *
 * ── GIÁ TRỊ CỦA NÓ NẰM HOÀN TOÀN Ở CHỖ NĂM MODULE DÙNG CÙNG MỘT TÊN ─────────────────────
 * Ghép log của module với log của Comitor.Account chỉ làm được nếu hai bên gọi nó giống nhau. Và
 * đổi tên sau khi đã có năm module là sửa năm repo CÙNG LÚC — nếu không cùng lúc thì việc sửa vô
 * nghĩa, vì một nửa hệ vẫn nói tên cũ.
 *
 * Vì vậy hằng này nằm ở tầng 1: nó là HỢP ĐỒNG, không phải cấu hình. Đừng đọc nó từ biến môi
 * trường — một tên header khác nhau giữa hai môi trường thì đúng bằng không có tên nào.
 */
export const REQUEST_ID_HEADER = "x-request-id";

/** Dài vừa đủ để không đụng nhau trong log, ngắn vừa đủ để đọc và gõ lại được. */
const REQUEST_ID_BYTES = 12;

/**
 * Nhận id từ phía gọi, hoặc sinh một cái mới.
 *
 * ── VÌ SAO PHẢI KIỂM GIÁ TRỊ ĐẾN TỪ NGOÀI ────────────────────────────────────────────────
 * Header này đến từ client, tức từ phía không đáng tin. Ghi thẳng nó vào log là mở hai cửa cùng
 * lúc: **log injection** (một ký tự xuống dòng cài trong giá trị bẻ một dòng log thành hai dòng
 * giả — đủ để dựng một sự kiện chưa từng xảy ra), và một trường log dài vô hạn.
 *
 * Chấp nhận giá trị đến từ ngoài vẫn là điều ĐÚNG: nó là cách một request đi qua nhiều dịch vụ giữ
 * được cùng một sợi chỉ. Chỉ cần nó phải qua cửa trước.
 */
export function toRequestId(incoming: string | null | undefined): string {
  if (incoming) {
    const trimmed = incoming.trim();
    if (/^[A-Za-z0-9_-]{8,64}$/.test(trimmed)) return trimmed;
  }

  const bytes = crypto.getRandomValues(new Uint8Array(REQUEST_ID_BYTES));
  /* base64url bằng tay: `btoa` có ở mọi runtime của Next, `Buffer` thì không (edge runtime). */
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
