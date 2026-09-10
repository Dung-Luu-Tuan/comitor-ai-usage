import { requireApiSession } from "@/lib/account/session";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { ApiError } from "@/lib/core/api-error";
import { requirePermission } from "@/lib/permissions";
import { saveTaskDraft } from "@/lib/task-drafts";

/**
 * `PUT /api/task-drafts` — lưu đè BẢN NHÁP biểu mẫu tạo việc của chính người đang đăng nhập.
 *
 * ── VÌ SAO KHÔNG CÓ `id` TRONG ĐƯỜNG DẪN ──────────────────────────────────────────────────
 * Vì tài nguyên này là một SINGLETON theo người: khoá chính của bảng là `(workspaceId, userId)`, và
 * cả hai giá trị đó đến từ PHIÊN, không từ URL. Nhận id ở đường dẫn là mở một tham số mà chỗ duy
 * nhất đúng để đọc nó lại là chỗ đã có sẵn câu trả lời — và là chỗ ai đó sẽ quên đối chiếu.
 *
 * ── VÌ SAO `PUT` CHỨ KHÔNG `POST` ─────────────────────────────────────────────────────────
 * Thao tác này BẤT BIẾN theo số lần gọi: gửi cùng một bản nháp mười lần cho ra đúng một trạng thái.
 * Biểu mẫu gọi nó mỗi lần người dùng bấm "Lưu nháp", và một mạng chập chờn sẽ gửi lại — `PUT` nói
 * đúng điều đó với mọi tầng trung gian.
 *
 * ── VÌ SAO KHÔNG CÓ `GET` ─────────────────────────────────────────────────────────────────
 * Nháp được đọc ở `page.tsx` qua `getTaskDraft()` (Prisma), không qua HTTP. Server Component tự
 * fetch API của chính máy chủ mình là thêm một vòng mạng, thêm một lần xác thực lại cookie, và thêm
 * một chỗ để hai đường trả về hai hình dạng khác nhau — xem ghi chú đầu `lib/tasks.ts`.
 */
export const PUT = withApiErrors(async (request: Request) => {
  const session = await requireApiSession();
  const workspaceId = session.workspace.id;

  /*
   * Gác bằng `task.create`, không phải một quyền riêng cho nháp.
   *
   * Nháp là bước ĐẦU của đúng một hành động: tạo công việc. Người không được tạo việc thì không có
   * lý do gì để tích trữ nháp trên máy chủ, và thêm một mã quyền `task.draft` vào
   * `PERMISSION_RULES` là thêm một dòng vào bảng phân quyền mà quản trị viên phải hiểu — cho một
   * thứ không bao giờ được bật độc lập với `task.create`.
   */
  await requirePermission(workspaceId, session.role, "task.create");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw ApiError.validation("Request body is not valid JSON.");
  }

  /*
   * `saveTaskDraft` tự kiểm bằng `taskDraftSchema` và trả `null` khi không đọc được — nên ở đây
   * KHÔNG kiểm lại một lần nữa. Hai phép kiểm cho cùng một hợp đồng là hai chỗ để nới lỏng khác
   * nhau, và chỗ bị nới sẽ là chỗ không ai đọc lại.
   */
  const savedAt = await saveTaskDraft(workspaceId, session.user.id, body);
  if (savedAt === null) throw ApiError.validation("Task draft failed validation.");

  return apiOk({ savedAt });
});
