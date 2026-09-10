import type { TaskDraftData } from "@/lib/core/task-draft";
import { callApi } from "./http";

/**
 * CỔNG API của BẢN NHÁP biểu mẫu tạo việc.
 *
 * Tách khỏi `./tasks.ts` để soi đúng cặp file phía máy chủ (`lib/task-drafts.ts` ·
 * `app/api/task-drafts/route.ts`): nháp là một tài nguyên khác công việc — nó thuộc về NGƯỜI đang
 * đăng nhập chứ không thuộc về một công việc nào, nó không có id, và nó biến mất ngay khi công việc
 * được tạo.
 *
 * ⚠ Đường dẫn là `/api/task-drafts`, KHÔNG phải `/api/tasks/draft`. Nhánh sau nằm cùng không gian
 * tên với `/api/tasks/[id]`, nên nó vừa đọc như "công việc có mã draft" vừa là một chỗ để hai route
 * tranh nhau một URL ở lần đầu ai đó thêm route động.
 */

/**
 * Lưu đè bản nháp của chính người đang đăng nhập.
 *
 * Gửi TRỌN state của biểu mẫu, không gửi từng phần — xem `saveTaskDraft` ở `lib/task-drafts.ts` về
 * lý do. Trả về mốc lưu mà máy chủ ghi, để giao diện hiện "lưu 5 giây trước" bằng con số THẬT thay
 * vì bằng đồng hồ của trình duyệt (hai đồng hồ luôn lệch nhau vài giây, và lệch nhiều hơn thế khi
 * máy người dùng sai giờ).
 */
export async function saveTaskDraft(draft: TaskDraftData): Promise<{ savedAt: string }> {
  return callApi<{ savedAt: string }>("/api/task-drafts", { method: "PUT", json: draft });
}
