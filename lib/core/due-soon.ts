import { daysBetween, isIsoDate } from "./iso-date";

/**
 * Chọn những công việc CẦN NHẮC hôm nay — quy tắc THUẦN, không chạm database.
 *
 * ── VÌ SAO PHẦN NÀY PHẢI Ở TẦNG 1 ────────────────────────────────────────────────────────
 * Vì "hôm nay có phải ngày nhắc không" là câu hỏi có RẤT nhiều ca biên, và không ca nào trong số
 * đó đi qua được bằng cách chạy thật: hạn hôm nay, hạn hôm qua (đã quá hạn — nhắc nữa là phiền),
 * việc đã xong, việc không bật cờ nhắc, và ngày tháng ở biên năm. Một job nền chạy MỖI NGÀY MỘT
 * LẦN thì mỗi lần thử tay là một ngày chờ — tức nó không được thử.
 *
 * ⚠ Hàm này KHÔNG quyết định "gửi cho ai" hay "gửi bằng gì". Nó trả về danh sách; ai nhận và nhận
 * qua kênh nào là việc của `lib/reminders.ts`, nơi có danh bạ và có cài đặt.
 */

export interface DueSoonCandidate {
  id: string;
  status: string;
  dueDate: string;
  remindBeforeDue: boolean;
  assigneeUserId: string | null;
}

/**
 * Số ngày trước hạn thì nhắc. MỘT — cố ý, và đây là con số cần cân nhắc chứ không phải mặc định.
 *
 * Nhắc sớm hơn (3–7 ngày) nghe chu đáo và nó làm hỏng đúng thứ nó phục vụ: một lời nhắc tới lúc
 * người ta chưa làm được gì là một lời nhắc bị bỏ qua, và bỏ qua vài lần thì lần nhắc ĐÚNG LÚC
 * cũng bị bỏ qua theo. Module cần khác thì đưa nó thành cài đặt của không gian làm việc — chỗ sửa
 * là tham số `leadDays`, không phải hàm này.
 */
export const DEFAULT_REMINDER_LEAD_DAYS = 1;

/** Trạng thái coi như đã xong — không nhắc nữa. */
const CLOSED_STATUSES = new Set(["done"]);

/**
 * @param today ISO `YYYY-MM-DD`, đã tính sẵn theo múi giờ của NGƯỜI NHẬN (xem `lib/reminders.ts`).
 * @returns những việc tới hạn đúng sau `leadDays` ngày nữa.
 */
export function selectDueSoon<T extends DueSoonCandidate>(
  tasks: readonly T[],
  today: string,
  leadDays: number = DEFAULT_REMINDER_LEAD_DAYS
): T[] {
  if (!isIsoDate(today) || !Number.isInteger(leadDays) || leadDays < 0) return [];

  return tasks.filter((task) => {
    if (!task.remindBeforeDue) return false;
    if (CLOSED_STATUSES.has(task.status)) return false;
    /* Không giao cho ai thì không có ai để nhắc. Đây là trạng thái HỢP LỆ, không phải dữ liệu thiếu. */
    if (task.assigneeUserId === null) return false;
    if (!isIsoDate(task.dueDate)) return false;

    /*
     * ĐÚNG BẰNG `leadDays`, không phải "còn ≤ leadDays ngày".
     *
     * `<=` nghe an toàn hơn và nó gửi TRÙNG: job chạy mỗi ngày, nên một việc hạn thứ Sáu sẽ bị
     * nhắc thứ Năm, rồi thứ Sáu, rồi (nếu không đóng `>= 0`) mãi mãi. Một điều kiện bằng đúng thì
     * mỗi việc được nhắc đúng MỘT lần, và job không cần nhớ nó đã gửi gì.
     */
    return daysBetween(today, task.dueDate) === leadDays;
  });
}
