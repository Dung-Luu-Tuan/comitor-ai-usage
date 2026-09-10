import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/account/session";
import { can } from "@/lib/core/permissions";
import { getPermissionMatrix } from "@/lib/permissions";
import { getAppSettings } from "@/lib/settings";
import { GeneralSettingsForm } from "./general-settings-form";

/**
 * Tab "Chung" của Cài đặt — `/settings`.
 *
 * Là INDEX của nhóm route, không phải một tab riêng có đường dẫn `/settings/general`: `/settings`
 * phải mở được và phải mở ra một thứ gì đó, nên tab mặc định nằm luôn ở đó. Nhờ vậy cũng không cần
 * redirect, và `RouteTabs` có đúng một mục canonical để tô sáng.
 *
 * Là CỬA DỮ LIỆU của route: cài đặt đọc từ database ở đây rồi truyền xuống. Biểu mẫu bên cạnh
 * (`"use client"`) không `import` một bản ghi nào và không biết dữ liệu đến từ đâu.
 *
 * Header và dải tab nằm ở `layout.tsx` — xem giải thích ở đó.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  // Chỉ TÊN TRANG: `metadata.title.template` ở root layout đã nối tên sản phẩm vào rồi.
  return { title: t("settings") };
}

export default async function SettingsGeneralPage() {
  const session = await requireSession();
  const settings = await getAppSettings(session.workspace.id);
  const matrix = await getPermissionMatrix(session.workspace.id);

  return <GeneralSettingsForm canEdit={can(matrix, session.role, "app.settings")} savedSettings={settings} />;
}
