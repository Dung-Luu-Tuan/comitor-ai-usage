import type { RequestType, TaskPriority, TaskStatus, TaskView } from "@/lib/contracts/task";
import { callApi } from "./http";

/**
 * CỔNG API của công việc — **một phương thức cho một endpoint**, kiểu trả về VIẾT TAY.
 *
 * ── VÌ SAO KHÔNG PHẢI MỘT `request<T>(path)` TỔNG QUÁT ────────────────────────────────────
 * Vì một hàm generic công khai nghĩa là MỖI chỗ gọi tự khai `T`, và từ đó `tsc` không còn kiểm
 * được hình dạng nữa — nó chỉ tin những gì chỗ gọi khai. Khai tay ở đây thì hợp đồng nằm ĐÚNG MỘT
 * chỗ, cạnh đường dẫn mà nó mô tả, và một route handler đổi hình dạng trả về sẽ làm mọi chỗ gọi
 * báo đỏ thay vì âm thầm đọc `undefined`.
 *
 * ── VÌ SAO KHÔNG `import` `zod` Ở ĐÂY ─────────────────────────────────────────────────────
 * Lược đồ kiểm dữ liệu sống ở phía MÁY CHỦ (`app/api/tasks/route.ts`) vì đó là phía không tin
 * client. Kéo nó xuống đây chỉ để "kiểm sớm" là đóng gói thêm một bản lược đồ vào bundle trình
 * duyệt cho một phép kiểm mà máy chủ dù sao cũng phải làm lại. Cái ta cần ở đây là KIỂU, và
 * `CreateTaskInput` là kiểu đó.
 *
 * ⚠ `CreateTaskInput` và lược đồ zod ở route handler là HAI khai báo của cùng một hợp đồng. Chúng
 * lệch nhau thì máy chủ trả `VALIDATION_ERROR` — ồn ào, đúng chỗ, và bắt được ngay ở lần gọi đầu.
 * Đó là đánh đổi cố ý: một kiểu sinh ra từ zod sẽ kéo cả zod (và cả mã máy chủ) sang phía client.
 */

/** Thân của `POST /api/tasks`. Mốc thời gian là CHUỖI ISO — JSON không có kiểu `Date`. */
export interface CreateTaskInput {
  title: string;
  summary: string;
  projectId: string;
  /** `null` = chưa giao. Biểu mẫu tạo việc ĐÒI người phụ trách, nhưng API thì không — xem route. */
  assigneeUserId: string | null;
  watcherUserIds: string[];
  priority: TaskPriority;
  /** ISO chỉ-có-ngày (`YYYY-MM-DD`). */
  dueDate: string;
  /** PHÚT, số nguyên — cùng đơn vị với cột `estimate_minutes`. Xem `prisma/schema.prisma`. */
  estimateMinutes: number;
  requestType: RequestType;
  needsApproval: boolean;
  approvalFlowId: string | null;
  notifyChannels: string[];
  remindBeforeDue: boolean;
  syncWithCalendar: boolean;
}

/**
 * Tạo một công việc. Trả về bản ghi ĐÃ TẠO, đúng hình dạng giao diện đang dùng.
 *
 * Trả `TaskView` chứ không trả `{ id }`: mã công việc do MÁY CHỦ cấp (`nextCodeFor`), nên trước lời
 * gọi này giao diện chỉ đoán được mã — và mã nó đoán sẽ SAI mỗi khi có người khác tạo việc xen vào
 * giữa lúc mở trang và lúc bấm Gửi. Toast báo "đã tạo CV-026" phải nói đúng con số máy chủ đã ghi.
 *
 * Ném `ApiError` (mang `code`) cho cả lỗi HTTP lẫn lỗi mạng — xem `./http`. Giao diện tra câu chữ
 * bằng `useErrorMessage()`, không in `error.message`.
 */
export async function createTask(input: CreateTaskInput): Promise<TaskView> {
  return callApi<TaskView>("/api/tasks", { method: "POST", json: input });
}

/**
 * Thân của `PATCH /api/tasks/{taskId}` — mọi trường TUỲ CHỌN, và tập trường KHÁC lệnh tạo.
 *
 * `code` không có mặt (nó đã đi vào email và vào câu người ta nói với nhau), `status` thì chỉ có ở
 * đây. Xem `updateTaskSchema` ở `lib/core/task-input.ts` cho lý do đầy đủ — nửa máy chủ của cùng
 * hợp đồng này.
 *
 * ⚠ `assigneeUserId: null` nghĩa là **bỏ giao**; `assigneeUserId` KHÔNG có mặt nghĩa là **đừng
 * đụng tới**. Hai thứ đó khác nhau, và `undefined` trong JSON là "không có khoá" nên hợp đồng này
 * diễn đạt được cả hai — miễn là chỗ gọi đừng gán `undefined` một cách tường minh.
 */
export interface UpdateTaskInput {
  title?: string;
  summary?: string;
  projectId?: string;
  assigneeUserId?: string | null;
  /** `overdue` KHÔNG nhận được: nó được suy ra lúc đọc, không bao giờ lưu. */
  status?: Exclude<TaskStatus, "overdue">;
  priority?: TaskPriority;
  dueDate?: string;
  estimateMinutes?: number;
}

/** Sửa một công việc. Trả về bản ghi SAU khi sửa, cùng hình dạng mà `/tasks` đang đọc. */
export async function updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskView> {
  return callApi<TaskView>(`/api/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", json: input });
}

/**
 * Xoá một công việc. Không trả về gì — máy chủ trả 204.
 *
 * ⚠ `encodeURIComponent` không phải thủ tục: `taskId` là cuid nên hôm nay nó an toàn, nhưng hàm
 * này là KHUÔN mà mọi route theo id của module sau sẽ chép, và id ở đó có thể là slug do người
 * dùng đặt. Bỏ nó đi một lần là đủ để một dấu `/` trong id trỏ lời gọi sang một endpoint khác.
 */
export async function deleteTask(taskId: string): Promise<void> {
  await callApi<void>(`/api/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
}

/**
 * Gỡ tệp đính kèm. Trả về bản ghi SAU khi gỡ.
 *
 * ⚠ Chiều NGƯỢC LẠI (tải lên) **không đi qua cổng này**, và đó là ngoại lệ duy nhất của tầng 2 —
 * xem chú thích đầu `app/(shell)/tasks/[taskId]/task-attachment-field.tsx`. Tóm tắt: tải lên đi
 * qua Uppy (headless) để có hàng đợi, tiến độ theo byte, thử lại và huỷ; hợp đồng của nó là
 * *đường dẫn endpoint + tên trường*, không phải một hàm TypeScript.
 */
export async function clearTaskAttachment(taskId: string): Promise<TaskView> {
  return callApi<TaskView>(`/api/tasks/${encodeURIComponent(taskId)}/attachment`, { method: "DELETE" });
}
