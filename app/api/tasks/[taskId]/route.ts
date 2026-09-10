import { requireApiSession } from "@/lib/account/session";
import { apiNoContent, apiOk, withApiErrors } from "@/lib/api/response";
import { ApiError } from "@/lib/core/api-error";
import { updateTaskSchema } from "@/lib/core/task-input";
import { requirePermission } from "@/lib/permissions";
import { deleteTask, updateTask } from "@/lib/tasks";

/**
 * `PATCH` / `DELETE /api/tasks/{taskId}` — sửa và xoá một công việc.
 *
 * ── ĐÂY LÀ HÌNH DẠNG ROUTE THỨ BA CỦA MODULE, VÀ LÀ HÌNH DẠNG NGUY HIỂM NHẤT ──────────────
 * Hai hình dạng đã có đều KHÔNG nhận định danh nào từ ngoài: `POST /api/tasks` tạo mới, còn
 * `PUT /api/settings` ghi đè một bản ghi duy nhất của không gian làm việc. Cả hai lấy `workspaceId`
 * từ phiên, nên không có gì để đoán.
 *
 * Route theo id thì khác: **`taskId` đến TỪ URL**, tức từ phía không đáng tin. Đây chính là hình
 * dạng sinh ra IDOR, và nó là hình dạng mà một module thật sẽ có hàng chục cái.
 *
 * Ba luật, và cả ba đều nằm ở `lib/tasks.ts` chứ không ở đây (rìa B chỉ làm bốn việc của nó):
 *   1. truy vấn LUÔN `findFirst({ where: { workspaceId, id } })` — `pnpm tenant:check` canh;
 *   2. bản ghi của workspace khác trả **404, không phải 403** — 403 xác nhận nó tồn tại;
 *   3. mọi luật nghiệp vụ của đường tạo được áp lại — chúng thuộc về TÀI NGUYÊN, không thuộc lệnh.
 *
 * ── BỐN CẠM BẪY NEXT 16 MÀ FILE NÀY LÀ VÍ DỤ DUY NHẤT TRONG REPO ─────────────────────────
 * Trước file này, cả repo không có một đoạn route động nào (`find app -type d | grep '\\['` ra
 * RỖNG) — nên bốn cạm bẫy mà AGENTS.md cảnh báo không có một dòng mã nào minh hoạ:
 *
 *   · `params` là một **Promise**, phải `await`;
 *   · giá trị của một khoá có thể là **mảng**, phải chuẩn hoá;
 *   · `notFound()` ném lỗi điều khiển luồng — nó thuộc về rìa A, KHÔNG dùng ở đây (rìa B trả mã);
 *   · `generateMetadata` phụ thuộc bản ghi thì phải chịu được bản ghi không tồn tại.
 */

/** Đoạn động của Next 16: `params` là Promise, và một khoá lặp lại trong URL cho ra mảng. */
type RouteContext = { params: Promise<{ taskId: string | string[] }> };

/**
 * Lấy `taskId` ở dạng dùng được, hoặc từ chối.
 *
 * ⚠ Chuẩn hoá mảng KHÔNG phải phòng xa: `/api/tasks/a` và `/api/tasks/b` không sinh ra mảng, nhưng
 * một `params` dạng mảng vẫn tới được qua rewrite và qua catch-all. Ném thẳng `taskId.trim()` vào
 * truy vấn khi nó là mảng thì Prisma nhận `["a","b"]` cho một cột `String` và lỗi nói về kiểu của
 * Prisma, không nói về URL.
 */
function readTaskId(raw: string | string[]): string {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!value) throw ApiError.validation("Task id is missing from the URL.", { fields: ["taskId"] });
  return value;
}

export const PATCH = withApiErrors(async (request: Request, context: RouteContext) => {
  const session = await requireApiSession();
  await requirePermission(session.workspace.id, session.role, "task.edit");

  const taskId = readTaskId((await context.params).taskId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw ApiError.validation("Request body is not valid JSON.");
  }

  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join("."));
    throw ApiError.validation("Task payload failed validation.", { fields });
  }

  return apiOk(await updateTask(session, taskId, parsed.data));
});

export const DELETE = withApiErrors(async (_request: Request, context: RouteContext) => {
  const session = await requireApiSession();
  await requirePermission(session.workspace.id, session.role, "task.delete");

  await deleteTask(session, readTaskId((await context.params).taskId));

  /*
   * 204 chứ không phải 200 với một thân rỗng: chỗ gọi không có gì để đọc, và trả `{}` là mời người
   * viết client tiếp theo đi tìm xem trong đó có gì.
   */
  return apiNoContent();
});
