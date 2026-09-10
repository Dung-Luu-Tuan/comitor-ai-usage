import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/account/session";
import { can } from "@/lib/core/permissions";
import { getPermissionMatrix } from "@/lib/permissions";
import { getAppSettings } from "@/lib/settings";
import { NotificationSettingsForm } from "./notification-settings-form";

/**
 * Tab "Thông báo" — `/settings/notifications`.
 *
 * Đọc CÙNG một bản ghi cài đặt với tab Chung (`app_settings` là một dòng cho cả module), và ghi qua
 * CÙNG một endpoint. Bốn tab chia nhau một object là quyết định của tầng dữ liệu, không phải của
 * giao diện — xem `lib/settings.ts`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("settingsNotifications") };
}

export default async function SettingsNotificationsPage() {
  const session = await requireSession();
  const settings = await getAppSettings(session.workspace.id);
  const matrix = await getPermissionMatrix(session.workspace.id);

  return <NotificationSettingsForm canEdit={can(matrix, session.role, "app.settings")} savedSettings={settings} />;
}
