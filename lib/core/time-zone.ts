/**
 * Múi giờ IANA có hợp lệ không — hàm THUẦN, tầng 1.
 *
 * ── VÌ SAO CẦN MỘT PHÉP KIỂM RIÊNG, CHỨ KHÔNG TIN GIÁ TRỊ ĐI VÀO ─────────────────────────
 * Múi giờ hiển thị đến từ hồ sơ Comitor.Account và được GIEO VÀO COOKIE (xem
 * `app/api/auth/callback/route.ts`). Cookie thì client sửa được, và giá trị ấy đi thẳng vào hai
 * chỗ không tha thứ:
 *
 *   · `i18n/request.ts` → `timeZone` của `next-intl`, tức vào thẳng `Intl.DateTimeFormat`. Một
 *     chuỗi lạ làm nó **NÉM `RangeError`** — từ chính file cấu hình request, tức mọi trang chết,
 *     kể cả bốn màn hình chặn vốn có nhiệm vụ vẫn hoạt động khi mọi thứ khác hỏng;
 *   · `lib/today.ts` → `todayIso()`, nơi cùng một `RangeError` làm hỏng mọi phép so "quá hạn".
 *
 * Nên phép kiểm này gác **cả hai đầu**: callback từ chối gieo giá trị không qua được, và chỗ đọc
 * rơi về mặc định thay vì ném.
 *
 * ── VÌ SAO `try/catch` CHỨ KHÔNG `Intl.supportedValuesOf("timeZone")` ────────────────────
 * Vì danh sách đó chỉ chứa tên CHÍNH TẮC, không chứa bí danh — và `Asia/Ho_Chi_Minh`, đúng cái múi
 * giờ mặc định của repo này, **là một bí danh** (tên chính tắc là `Asia/Saigon`). Lọc theo danh
 * sách ấy là loại bỏ chính giá trị mà `DEFAULT_TIME_ZONE` đang mang, và hỏng đúng ở nơi không ai
 * nghĩ tới. `Intl.DateTimeFormat` thì chấp nhận cả bí danh — nó là cùng một phép phân giải mà mọi
 * chỗ dùng thật sẽ chạy qua, nên hỏi chính nó là câu trả lời đúng nhất.
 */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;

  /*
   * Chặn TRƯỚC bằng hình dạng, vì `Intl` rộng lượng hơn ta muốn: nó nhận cả `"UTC"`, cả offset kiểu
   * `"+07:00"`, và ở một số runtime là cả chuỗi rỗng-sau-trim. Ta chỉ muốn tên vùng IANA, và một
   * ràng buộc ký tự tường minh cũng là thứ chặn ký tự xuống dòng — giá trị này đi vào log, mà một
   * `\n` cài trong đó bẻ một dòng log thành hai dòng giả (cùng lý do với `toRequestId()`).
   */
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
