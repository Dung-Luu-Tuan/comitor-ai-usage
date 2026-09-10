import { requireApiSession } from "@/lib/account/session";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { ApiError } from "@/lib/core/api-error";
import { createProjectSchema } from "@/lib/core/project-input";
import { requirePermission } from "@/lib/permissions";
import { createProject } from "@/lib/projects";

/**
 * `POST /api/projects` — tạo một dự án.
 *
 * Cùng bốn bước của rìa B với `app/api/tasks/route.ts`, và cố ý giống hệt: hai route ghi trông
 * khác nhau ở một bản mẫu là hai khuôn cho người sau chọn, và họ sẽ chọn nhầm.
 *
 * ⚠ `project.create` là một trong năm quyền từng khai trong ma trận mà KHÔNG AI ĐỌC. Route này là
 * người đọc đầu tiên của nó.
 */
export const POST = withApiErrors(async (request: Request) => {
  const session = await requireApiSession();
  await requirePermission(session.workspace.id, session.role, "project.create");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw ApiError.validation("Request body is not valid JSON.");
  }

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join("."));
    throw ApiError.validation("Project payload failed validation.", { fields });
  }

  return apiOk(await createProject(session, parsed.data), { status: 201 });
});
