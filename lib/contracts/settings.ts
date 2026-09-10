/**
 * Hợp đồng của CÀI ĐẶT và PHÂN QUYỀN — TẦNG 0: chỉ KIỂU.
 *
 * ⚠ Không khoản nào ở đây là dữ liệu của Comitor.Account. Nếu một trường mới không trả lời được
 * câu *"nó đổi cách ỨNG DỤNG NÀY làm việc à?"* thì chỗ của nó là Account, không phải đây. Tên
 * không gian làm việc, múi giờ, thành viên, chỗ ngồi, xác thực hai bước — không cái nào thuộc về
 * file này.
 */

import type { WorkspaceRoleId } from "@/lib/contracts/account";
import type { TaskPriority } from "@/lib/contracts/task";

export type DigestFrequency = "daily" | "weekly" | "friday";
export type ArchiveAfter = "30d" | "90d" | "180d" | "never";

/**
 * ⚠ **MỘT Ô CÀI ĐẶT KHÔNG AI ĐỌC THÌ KHÔNG ĐƯỢC TỒN TẠI Ở ĐÂY.**
 *
 * Ba khoản đã bị gỡ ngày 05.09.2026 — `mentioned`, `project-update` (thông báo) và
 * `attachment-download` (dữ liệu) — vì grep toàn repo cho ra đúng một tập hợp chỗ dùng: chính cái
 * công tắc của nó, và ba dòng đổi hình trong `lib/settings.ts`. Không một đường ghi, một job hay
 * một phép kiểm nào đọc chúng.
 *
 * Vì sao XOÁ chứ không đánh dấu `<NotYetActive />`: cái dấu ấy nói *"giá trị được lưu, chưa có gì
 * đọc"* — đúng cho `archiveAfter` và `digestFrequency`, nơi TÍNH NĂNG đã có hình dạng và chỉ thiếu
 * một job. Với ba khoản kia thì tính năng KHÔNG TỒN TẠI: không có bảng bình luận nào để nhắc tên,
 * không có cơ chế theo dõi dự án (`TaskWatcher` chỉ theo từng việc), và "chỉ xem, không tải xuống"
 * thì **không cài đặt được như đã hứa** — `lib/storage.ts` phát URL đã ký, mà một URL để xem CHÍNH
 * LÀ một URL để tải.
 *
 * Và một ô cài đặt không ai đọc **không mang bằng chứng nào** về việc nó thuộc bên nào của ranh
 * giới Account/app — nên chuyển nó sang Account là đóng băng một hợp đồng năm-repo để phục vụ một
 * control không làm gì. Chúng quay lại CÙNG LÚC với tính năng, không sớm hơn.
 */
export type NotificationPrefId = "assigned" | "due-soon" | "email-digest";
export type AppDataPrefId = "public-link" | "activity-log";

/**
 * Toàn bộ giá trị mà trang cài đặt sửa được — một object PHẲNG theo nhóm, để trang giữ đúng HAI
 * bản: bản đã lưu và bản nháp. So hai bản là ra trạng thái "chưa lưu".
 */
export interface AppSettingsView {
  /** Mức ưu tiên gợi ý sẵn khi mở biểu mẫu tạo việc. */
  defaultPriority: TaskPriority;
  /** Số dòng mỗi trang của bảng Công việc. */
  defaultPageSize: number;
  /**
   * Đặt sẵn NGƯỜI TẠO làm người phụ trách khi mở biểu mẫu tạo việc.
   *
   * ⚠ Đây là cài đặt của CẢ KHÔNG GIAN LÀM VIỆC, không phải của từng người — `app_settings` lấy
   * `workspaceId` làm khoá chính nên **không có chỗ nào trong lược đồ này cho một tuỳ chọn theo
   * từng người**. Nhãn cũ viết ở ngôi thứ nhất ("tự nhận việc mình tạo") nên nó nói dối theo hai
   * chiều cùng lúc: thành viên đọc một lời hứa cá nhân mà họ không đặt được, còn quản trị viên đặt
   * nó thì đặt cho tất cả mọi người.
   *
   * Ngày cần một lớp theo từng người, chỗ của nó là một BẢNG MỚI của module khoá theo
   * `(workspace_id, user_id)` — không bao giờ là một cột bên Account.
   */
  autoAssignToMe: boolean;
  notifications: Record<NotificationPrefId, boolean>;
  digestFrequency: DigestFrequency;
  data: Record<AppDataPrefId, boolean>;
  archiveAfter: ArchiveAfter;
}

/**
 * Mã quyền — chuỗi MÁY, dạng `<đối tượng>.<hành động>`, tiếng Anh.
 *
 * ⚠ Dấu CHẤM trong mã quyền là một cái bẫy cho `next-intl`: nó dùng dấu chấm làm dấu phân cấp
 * namespace, nên `task.view` viết thẳng vào `messages/` tạo ra một khoá **không bao giờ tra tới
 * được** — phép tra đi xuống `task → view` và không thấy gì. `messages/*.json` vì thế giữ tên đã
 * thay dấu chấm bằng gạch dưới, và `toPermissionMessageKey()` (`lib/catalog/permissions.ts`) làm
 * phép đổi.
 */
export type AppPermissionId =
  | "task.view"
  | "task.create"
  | "task.edit"
  | "task.assign"
  | "task.delete"
  | "project.view"
  | "project.create"
  | "report.view"
  | "report.export"
  | "app.settings"
  | "app.permissions";

export type AppPermissionGroupId = "tasks" | "projects" | "reports" | "app";

/** Ma trận vai trò × quyền: `matrix[roleId][permissionId]` là `true` khi vai trò đó có quyền đó. */
export type PermissionMatrix = Record<WorkspaceRoleId, Record<AppPermissionId, boolean>>;
