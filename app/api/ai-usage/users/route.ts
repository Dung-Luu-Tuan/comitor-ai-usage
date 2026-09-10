import { requireApiSession } from "@/lib/account/session";
import { createAiUsageUser } from "@/lib/ai-usage";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { createAiUsageUserSchema } from "@/lib/core/ai-usage-input";
import { ApiError } from "@/lib/core/api-error";
import { requirePermission } from "@/lib/permissions";

/**
 * `POST /api/ai-usage/users` — cấp một mã nội bộ. Key đầy đủ chỉ có trong phản hồi này.
 */

export const POST = withApiErrors(async (request: Request) => {
  const session = await requireApiSession();
  await requirePermission(session.workspace.id, session.role, "app.settings");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw ApiError.validation("Request body is not valid JSON.");
  }

  const parsed = createAiUsageUserSchema.safeParse(body);
  if (!parsed.success) {
    throw ApiError.validation("User payload failed validation.");
  }

  return apiOk(createAiUsageUser(parsed.data), { status: 201 });
});
