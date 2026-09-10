import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { accountWorkspaceUrl } from "@/lib/account/links";
import { requireSession } from "@/lib/account/session";
import { can } from "@/lib/core/permissions";
import { getPermissionMatrix, permissionMatrixVersion } from "@/lib/permissions";
import { PermissionMatrixForm } from "./permission-matrix-form";

/**
 * Tab "Phân quyền" — `/settings/permissions`.
 *
 * ĐÂY LÀ NỬA CỦA MODULE trong ranh giới với Comitor.Account: Account phát vai trò THÔ ở phạm vi
 * không gian làm việc (`owner`/`admin`/`member`/`guest`), module quyết định mỗi vai trò làm được gì
 * BÊN TRONG nó. Xem `lib/catalog/permissions.ts`.
 *
 * ⚠ VỊ TỪ "CÓ ĐƯỢC SỬA KHÔNG" TÍNH Ở ĐÂY, KHÔNG Ở BIỂU MẪU. Nó cần ma trận ĐANG CÓ HIỆU LỰC (đã
 * qua `applyPermissionLocks`), tức dữ liệu chỉ máy chủ có; tính lại ở client là một bản sao thứ hai
 * của luật phân quyền, và bản lỏng hơn mới là bản có hiệu lực trên màn hình.
 *
 * Và nó chỉ quyết định GIAO DIỆN. Chốt thật nằm ở `PUT /api/permissions` và đọc CÙNG ma trận này.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("settingsPermissions") };
}

export default async function SettingsPermissionsPage() {
  const session = await requireSession();
  const [matrix, version] = await Promise.all([
    getPermissionMatrix(session.workspace.id),
    permissionMatrixVersion(session.workspace.id)
  ]);

  return (
    <PermissionMatrixForm
      savedMatrix={matrix}
      savedVersion={version}
      canEdit={can(matrix, session.role, "app.permissions")}
      currentRoleId={session.role}
      workspaceName={session.workspace.name}
      membersUrl={accountWorkspaceUrl(session.workspace.slug, "members")}
    />
  );
}
