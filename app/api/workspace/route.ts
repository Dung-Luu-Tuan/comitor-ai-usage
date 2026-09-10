// @api-guard: đổi không gian làm việc là thao tác trên CHÍNH PHIÊN của người gọi. Chốt là danh
// sách workspace của chính họ (đọc từ Account), không phải một quyền của module — module không
// biết ai thuộc workspace nào, đó là câu của Comitor.Account.

import { z } from "zod";
import { getSession } from "@/lib/account/session";
import { readSessionCookie } from "@/lib/account/session-cookie";
import { readSession, updateSession } from "@/lib/account/session-store";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { ApiError, ERROR_CODES } from "@/lib/core/api-error";

/**
 * `PUT /api/workspace` — đổi không gian làm việc đang mở.
 *
 * ── VÌ SAO ĐÂY LÀ ROUTE HANDLER, KHÔNG PHẢI SERVER ACTION ───────────────────────────────
 * Vì nó GHI COOKIE PHIÊN — và Next chỉ cho ghi cookie ở Server Action, Route Handler và `proxy.ts`
 * (xem `lib/account/session-store.ts`). Server Action cũng ghi được, nhưng luật của repo giữ đường
 * ghi ở route handler; xem AGENTS.md §"Đường GHI".
 *
 * ── CHỐT LÀ DANH SÁCH CỦA CHÍNH NGƯỜI ĐÓ ────────────────────────────────────────────────
 * ⚠ `slug` đến TỪ THÂN REQUEST. Ghi thẳng nó vào phiên là để bất kỳ ai đoán được một slug cũng mở
 * được workspace của khách hàng khác — cả `requireWorkspaceAccess()` lẫn `pnpm tenant:check` đều
 * KHÔNG cứu được, vì tới lúc đó phiên đã nói rằng người này thuộc về workspace kia.
 *
 * Phép kiểm là: slug phải nằm trong danh sách mà Comitor.Account trả về CHO CHÍNH NGƯỜI NÀY.
 */
const switchSchema = z.object({ slug: z.string().min(1).max(120) });

export const PUT = withApiErrors(async (request: Request) => {
  const session = await getSession();
  if (!session) throw ApiError.unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw ApiError.validation("Request body is not valid JSON.");
  }

  const parsed = switchSchema.safeParse(body);
  if (!parsed.success) throw ApiError.validation("Missing workspace slug.", { fields: ["slug"] });

  const target = session.workspaces.find((workspace) => workspace.slug === parsed.data.slug);
  /*
   * 404, KHÔNG 403 — cùng luật với bản ghi của workspace khác: 403 xác nhận rằng slug đó tồn tại,
   * và với slug đoán được thì đó là một đường dò danh sách khách hàng.
   */
  if (!target) throw ApiError.notFound(ERROR_CODES.NOT_FOUND, "Workspace not found for this account.");

  const secret = await readSessionCookie();
  if (!secret) throw ApiError.unauthorized();
  const stored = await readSession(secret);
  if (!stored) throw ApiError.unauthorized();

  await updateSession(secret, { ...stored, workspaceSlug: target.slug });

  /*
   * Trả về slug đã đổi thay vì 204: chỗ gọi dựng lại trang bằng `router.refresh()`, và nó cần biết
   * máy chủ đã chấp nhận cái nào — người dùng có thể bấm hai lần rất nhanh.
   */
  return apiOk({ slug: target.slug });
});
