import { requireApiSession } from "@/lib/account/session";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { ApiError } from "@/lib/core/api-error";
import { createTaskSchema } from "@/lib/core/task-input";
import { requirePermission } from "@/lib/permissions";
import { createTask } from "@/lib/tasks";

/**
 * `POST /api/tasks` — tạo một công việc.
 *
 * ── RÌA B LÀM ĐÚNG BỐN VIỆC, VÀ CHỈ BỐN ───────────────────────────────────────────────────
 *   1. **phiên** — `requireApiSession()`, không phải `requireSession()`. Xem ⚠ bên dưới.
 *   2. **quyền** — `requirePermission()`. `pnpm api:check` canh bước này.
 *   3. **hình dạng dữ liệu** — `createTaskSchema` (tầng 1). Dữ liệu ngoài dừng ở đây.
 *   4. **gọi tầng D** — `createTask()` giữ toàn bộ luật nghiệp vụ và tác dụng phụ.
 *
 * Đây chính là bốn bước mà `docs/kien-truc-ung-dung.md` §3 vẽ cho rìa B. Trước đây file này dài
 * 310 dòng và chứa trọn nghiệp vụ, còn `lib/tasks.ts` tự khai là "phép ĐỌC" — tức tài liệu mô tả
 * một cấu trúc không tồn tại. Nghiệp vụ nằm trong `route.ts` còn có một cái giá cụ thể hơn: nó
 * **không gọi lại được** từ `pnpm seed`, từ một Server Action, hay từ một job nền.
 *
 * ⚠ **ẨN MỘT NÚT KHÔNG PHẢI LÀ PHÂN QUYỀN.** `/tasks/new` đã ẩn nút với người không có quyền, và
 * điều đó không thay được `requirePermission` dưới đây: một `curl` không đọc giao diện.
 *
 * ⚠ **`requireApiSession()`, KHÔNG phải `requireSession()`.** Bản kia kết thúc bằng `redirect()`
 * khi chưa có phiên, mà `redirect()` của Next hoạt động bằng cách NÉM một lỗi điều khiển luồng —
 * `withApiErrors` sẽ bắt nó và trả **500** cho một chuyện hoàn toàn bình thường (access token sống
 * 15 phút). Bản này ném `ApiError.unauthorized()` để chỗ gọi nhận 401 và biết phải đăng nhập lại.
 * Xem `lib/account/session.ts`.
 */
export const POST = withApiErrors(async (request: Request) => {
  const session = await requireApiSession();
  await requirePermission(session.workspace.id, session.role, "task.create");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw ApiError.validation("Request body is not valid JSON.");
  }

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    /*
     * Đưa DANH SÁCH TRƯỜNG sai vào `metadata`, không đưa thông điệp của zod. Thông điệp zod là chuỗi
     * tiếng Anh của một thư viện — giao diện không in nó (nó tra `errors.*` theo `code`), còn người
     * gỡ lỗi thì cần biết TRƯỜNG nào hỏng chứ không cần một câu văn.
     */
    const fields = parsed.error.issues.map((issue) => issue.path.join("."));
    throw ApiError.validation("Task payload failed validation.", { fields });
  }

  return apiOk(await createTask(session, parsed.data), { status: 201 });
});
