import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { listMembers } from "@/lib/account/directory";
import { requireSession } from "@/lib/account/session";
import { can } from "@/lib/core/permissions";
import { getProjectStatusConfigs } from "@/lib/i18n/catalog-server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getPermissionMatrix, requireReadPermission } from "@/lib/permissions";
import { listProjects } from "@/lib/projects";
import { ProjectList } from "./project-list";

/**
 * `/projects` — danh sách dự án, và chỗ tạo dự án đầu tiên của một không gian làm việc.
 *
 * ⚠ Trang này KHÔNG có ở bản trước, và chỗ thiếu không vô hại: nguồn dự án duy nhất là `pnpm seed`,
 * nên một workspace vừa bật app có **không dự án nào** → `/tasks/new` mở ra combobox rỗng → không
 * tạo nổi công việc đầu tiên. Xem `createProject` ở `lib/projects.ts`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("projects") };
}

export default async function ProjectsPage() {
  const session = await requireSession();
  const workspaceId = session.workspace.id;

  await requireReadPermission(workspaceId, session.role, "project.view");

  const [projects, members, matrix, statusConfigs, rawLocale] = await Promise.all([
    listProjects(workspaceId),
    listMembers(workspaceId),
    getPermissionMatrix(workspaceId),
    getProjectStatusConfigs(),
    getLocale()
  ]);

  return (
    /*
     * ⚠ KHUNG TRANG (`PageHeader` + `PageContainer`) NẰM TRONG `ProjectList`, KHÔNG Ở ĐÂY — nút
     * "Dự án mới" mở hộp thoại nên nó cần `setOpen`, một state của đảo client. Lý do đầy đủ ghi ở
     * chỗ `return` của `project-list.tsx`; luật ở AGENTS.md §"Thêm một trang mới" bước 2.
     */
    <ProjectList
      projects={projects}
      statusConfigs={statusConfigs}
      /* Vị từ quyền tính ở SERVER, truyền BOOLEAN xuống — xem `../tasks/page.tsx`. */
      canCreate={can(matrix, session.role, "project.create")}
      memberOptions={members.map((member) => ({ value: member.id, label: member.name }))}
      currentUserId={session.user.id}
      locale={isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE}
    />
  );
}
