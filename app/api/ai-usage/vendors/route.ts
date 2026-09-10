import { requireApiSession } from "@/lib/account/session";
import { setAiUsageVendors } from "@/lib/ai-usage";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { setAiUsageVendorsSchema } from "@/lib/core/ai-usage-input";
import { ApiError } from "@/lib/core/api-error";
import { requirePermission } from "@/lib/permissions";

/**
 * `PUT /api/ai-usage/vendors` — lưu key hãng vào file JSON của cổng LLM.
 *
 * Ô trống = giữ key cũ. Không có thẻ phiên bản: mất một key nhìn thấy được trên trang và dán lại
 * được; khác ma trận phân quyền.
 */

export const PUT = withApiErrors(async (request: Request) => {
  const session = await requireApiSession();
  await requirePermission(session.workspace.id, session.role, "app.settings");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw ApiError.validation("Request body is not valid JSON.");
  }

  const parsed = setAiUsageVendorsSchema.safeParse(body);
  if (!parsed.success) {
    throw ApiError.validation("Vendor payload failed validation.");
  }

  return apiOk(setAiUsageVendors(parsed.data));
});
