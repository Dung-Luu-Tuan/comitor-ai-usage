import { requireApiSession } from "@/lib/account/session";
import { setAiUsageUserBudget } from "@/lib/ai-usage";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { setAiUsageBudgetSchema } from "@/lib/core/ai-usage-input";
import { ApiError } from "@/lib/core/api-error";
import { requirePermission } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string | string[] }> };

function routeId(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = raw?.trim() ?? "";
  if (!id) {
    throw ApiError.validation("Missing user id.");
  }
  return id;
}

export const PATCH = withApiErrors(async (request: Request, context: RouteContext) => {
  const session = await requireApiSession();
  await requirePermission(session.workspace.id, session.role, "app.settings");

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw ApiError.validation("Request body is not valid JSON.");
  }

  const parsed = setAiUsageBudgetSchema.safeParse(body);
  if (!parsed.success) {
    throw ApiError.validation("Budget payload failed validation.");
  }

  return apiOk(await setAiUsageUserBudget(session.workspace.id, routeId(id), parsed.data.maxBudget));
});
