import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/account/session";
import { can } from "@/lib/core/permissions";
import { getPermissionMatrix } from "@/lib/permissions";
import { getAppSettings } from "@/lib/settings";
import { tasksByProject } from "@/lib/tasks";
import { AdvancedSettingsForm } from "./advanced-settings-form";

/** Tab "Nâng cao" — `/settings/advanced`. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("settingsAdvanced") };
}

export default async function SettingsAdvancedPage() {
  const session = await requireSession();
  const workspaceId = session.workspace.id;

  const [settings, breakdown] = await Promise.all([getAppSettings(workspaceId), tasksByProject(workspaceId)]);

  const matrix = await getPermissionMatrix(session.workspace.id);

  /*
   * ĐẾM TỪ DATABASE, và đếm ĐÚNG THỨ SẮP MẤT: câu cảnh báo trong Vùng nguy hiểm nói ra số bản ghi
   * hành động xoá sẽ xoá. Vì vậy không dùng `countOpenTasks()` — xoá dữ liệu module lấy đi CẢ việc
   * đã hoàn thành, và một hộp thoại nói dối về hậu quả thì tệ hơn một hộp thoại không nói gì.
   *
   * `tasksByProject()` cho cả hai con số trong MỘT truy vấn (nó đọc dự án kèm trạng thái việc), nên
   * ở đây không cần `listTasks()` — hàm đó còn ký URL cho từng tệp đính kèm, một việc đắt và hoàn
   * toàn vô ích khi thứ ta cần chỉ là một con số.
   */
  const taskCount = breakdown.reduce((total, row) => total + row.open + row.done, 0);

  return (
    <AdvancedSettingsForm
      canEdit={can(matrix, session.role, "app.settings")}
      savedSettings={settings}
      taskCount={taskCount}
      projectCount={breakdown.length}
      workspaceName={session.workspace.name}
      workspaceSlug={session.workspace.slug}
    />
  );
}
