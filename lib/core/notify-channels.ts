/**
 * Kênh báo của MỘT công việc → quyết định thực sự gửi gì.
 *
 * ── VÌ SAO FILE NÀY TỒN TẠI ───────────────────────────────────────────────────────────────
 * Vì bốn ô "Kênh thông báo" ở biểu mẫu tạo việc từng được thu thập, kiểm dạng, LƯU vào cột
 * `tasks.notify_channels` — rồi không ai đọc. Chốt gửi thư chỉ nhìn `settings.notifications`
 * (cài đặt cấp KHÔNG GIAN LÀM VIỆC), nên **bỏ tích ô "Email" thì thư vẫn gửi**.
 *
 * Đo được ngày 04/09/2026 trên đường thật: tạo một việc, thư tới hộp thư thật của người được
 * giao. Ô "Email" mô tả *"Gửi tới địa chỉ đã xác minh trong hồ sơ Comitor.Account"*, nên người
 * dùng có mọi lý do tin nó quyết định điều gì đó. Nó không.
 *
 * Đây là lớp lỗi mà AGENTS.md có luật riêng — *"một cài đặt không làm gì tệ hơn một cài đặt còn
 * thiếu"* — cùng họ với bốn ô ở `/settings` đã phải đánh dấu `<NotYetActive />`.
 *
 * ── VÌ SAO LÀ HÀM THUẦN Ở TẦNG 1, KHÔNG PHẢI HAI DÒNG `if` Ở CHỖ GỌI ──────────────────────
 * Vì có HAI chỗ gọi, và chúng ở hai tầng khác nhau: `lib/tasks.ts` (lúc tạo việc, chạy trong
 * request) và `lib/reminders.ts` (job nền, chạy ngoài request). Viết luật hai lần là để chúng
 * lệch — và cái lệch sẽ nằm ở nhánh ít chạy hơn, tức job nền, tức chỗ không ai nhìn.
 */

/**
 * Kênh mà module NÀY giao được hôm nay.
 *
 * ⚠ `NOTIFY_CHANNELS` ở `lib/core/task-input.ts` có BỐN giá trị (`in-app`, `email`, `chat`,
 * `sms`); danh sách đây chỉ có hai. Chênh lệch đó là CÓ THẬT và cố ý giữ lại: `chat` cần app
 * Comitor.Chat (chưa có), `sms` cần một nhà cung cấp và một dòng ngân sách. Giá trị người dùng
 * chọn vẫn được LƯU để ngày nối xong không mất dữ liệu — nhưng biểu mẫu phải NÓI RA rằng hai
 * kênh ấy chưa giao được, nếu không ta vừa chữa một lời nói dối vừa dựng lời nói dối tiếp theo.
 */
export const DELIVERABLE_NOTIFY_CHANNELS: readonly string[] = ["in-app", "email"];

/** Kết quả: từng đường giao có chạy hay không. Không có "kênh nào đó" chung chung. */
export interface NotifyDelivery {
  /** Ghi một dòng vào bảng `notifications` — chuông trên header. */
  readonly inApp: boolean;
  /** Gửi một lá thư thật. */
  readonly email: boolean;
}

const NOTHING: NotifyDelivery = { inApp: false, email: false };

/**
 * Hai tầng công tắc, và THỨ TỰ giữa chúng là phần quan trọng.
 *
 * 1. `workspaceAllows` — công tắc cấp KHÔNG GIAN LÀM VIỆC (`/settings` → Thông báo). Tắt là tắt
 *    hết, bất kể từng việc chọn gì. Đây là thứ mà chính lá thư trỏ người dùng tới khi họ muốn
 *    thôi nhận ("Tắt ở phần Cài đặt → Thông báo trong ứng dụng"), nên nó phải đứng TRƯỚC.
 * 2. `channels` — lựa chọn của TỪNG việc. Chỉ được thu hẹp, không được mở rộng.
 *
 * ⚠ Danh sách RỖNG nghĩa là KHÔNG gửi gì — đọc theo đúng nghĩa đen, không "rỗng thì coi như tất
 * cả". Chọn fail-open ở đây là làm lại đúng cái sai vừa chữa: người dùng bỏ tích hết mà vẫn nhận
 * thư. Biểu mẫu đã chặn ca rỗng (`errorChannelsRequired`), và lược đồ zod nay cũng chặn — nên
 * đường duy nhất tới đây với mảng rỗng là dữ liệu cũ hoặc một lời gọi máy-tới-máy, và cả hai thì
 * im lặng là đúng hơn là gửi thứ không ai xin.
 */
export function resolveNotifyDelivery(input: {
  channels: readonly string[];
  workspaceAllows: boolean;
}): NotifyDelivery {
  if (!input.workspaceAllows) return NOTHING;

  return {
    inApp: input.channels.includes("in-app"),
    email: input.channels.includes("email")
  };
}
