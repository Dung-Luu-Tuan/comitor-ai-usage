import type { WorkspaceRoleId } from "@/lib/contracts/account";
import type { AppPermissionGroupId, AppPermissionId } from "@/lib/contracts/settings";
import type { PermissionRule } from "@/lib/core/permissions";

/**
 * BẢNG QUYỀN THEO CHỨC NĂNG CỦA MODULE — nửa còn lại của ranh giới Account / app.
 *
 * Comitor.Account phát VAI TRÒ THÔ (`owner`/`admin`/`member`/`guest`) ở phạm vi không gian làm
 * việc; module ánh xạ vai trò đó sang quyền theo chức năng của CHÍNH NÓ. Không có chiều ngược lại:
 * module không tạo vai trò, và Account không biết module này có chức năng gì.
 *
 * ── VÌ SAO KHÔNG ĐỂ ACCOUNT GIỮ LUÔN BẢNG QUYỀN CHI TIẾT CHO MỌI APP ───────────────────────
 * Comitor là SaaS nhiều sản phẩm, mỗi app ở một repo và ra bản theo nhịp riêng. Quyền chi tiết nằm
 * tập trung thì mỗi lần một app thêm tính năng, Account lại phải đổi lược đồ và phát hành theo —
 * Account thành nút cổ chai của cả hệ. Vì vậy quyền chi tiết ở lại đúng nơi hiểu ngữ nghĩa của nó.
 *
 * ⚠ **ẨN MỘT NÚT KHÔNG PHẢI LÀ PHÂN QUYỀN.** Bảng này quyết định giao diện hiện gì; chốt THẬT nằm
 * ở máy chủ và đọc CÙNG bảng đó — `requirePermission()` ở `lib/permissions.ts`. Giao diện chỉ giúp
 * người dùng không bấm
 * vào chỗ họ sẽ bị từ chối.
 *
 * ── THAY BẢNG NÀY LÀ VIỆC ĐẦU TIÊN MỘT MODULE MỚI PHẢI LÀM ────────────────────────────────
 * Mã quyền, nhóm và ngữ nghĩa đều là chuyện riêng của từng sản phẩm. Phần còn lại —
 * `lib/core/permissions.ts`, trang `/settings/permissions`, và bảng `role_permissions` — không
 * phải sửa dòng nào.
 */

/** Thứ tự trong mảng là thứ tự các NHÓM DÒNG của bảng phân quyền. */
export const PERMISSION_GROUPS: readonly AppPermissionGroupId[] = ["tasks", "projects", "reports", "app"];

/**
 * Thứ tự trong mảng là thứ tự DÒNG trong từng nhóm.
 *
 * `write` quyết định một hằng đúng của module: **khách không bao giờ được cấp thao tác GHI** (xem
 * `permissionLock`). Vì vậy đặt cờ này sai không chỉ làm lệch một dòng — nó mở hoặc khoá nhầm cả
 * một cột.
 *
 * ⚠ **Xuất dữ liệu KHÔNG phải thao tác ghi.** Nó chỉ đọc, và có không gian làm việc thật sự muốn
 * cho khách xuất báo cáo được chia sẻ. Vì vậy `report.export` vẫn là một ô bật/tắt bình thường ở
 * cột Khách. Đây là chỗ dễ đánh dấu sai nhất trong cả bảng.
 */
export const PERMISSION_RULES: readonly (PermissionRule & { groupId: AppPermissionGroupId })[] = [
  { id: "task.view", groupId: "tasks", write: false, defaultRoles: ["owner", "admin", "member", "guest"] },
  { id: "task.create", groupId: "tasks", write: true, defaultRoles: ["owner", "admin", "member"] },
  { id: "task.edit", groupId: "tasks", write: true, defaultRoles: ["owner", "admin", "member"] },
  { id: "task.assign", groupId: "tasks", write: true, defaultRoles: ["owner", "admin"] },
  { id: "task.delete", groupId: "tasks", write: true, defaultRoles: ["owner", "admin"] },

  { id: "project.view", groupId: "projects", write: false, defaultRoles: ["owner", "admin", "member", "guest"] },
  { id: "project.create", groupId: "projects", write: true, defaultRoles: ["owner", "admin"] },

  { id: "report.view", groupId: "reports", write: false, defaultRoles: ["owner", "admin", "member"] },
  /**
   * ⚠ Quyền này chỉ ẨN NÚT, không giấu được dữ liệu — và đó là sự thật cần biết trước khi ai đó
   * dựa vào nó. `/tasks` xuất CSV **ngay trong trình duyệt**, từ mảng đã nằm trong prop của bảng,
   * nên tắt nó đi thì dữ liệu vẫn ở đó: người dùng chỉ mất một cái nút.
   *
   * Muốn nó thành một chốt thật thì phải đổi cách xuất — `GET /api/tasks/export` trả CSV, có
   * `requirePermission()`. Ngày làm việc đó, xoá chú thích này.
   */
  { id: "report.export", groupId: "reports", write: false, defaultRoles: ["owner", "admin"] },

  { id: "app.settings", groupId: "app", write: true, defaultRoles: ["owner", "admin"] },
  { id: "app.permissions", groupId: "app", write: true, defaultRoles: ["owner"] }
];

/** Thứ tự CỘT của bảng phân quyền: rộng quyền nhất đứng trước. */
export const WORKSPACE_ROLES: readonly WorkspaceRoleId[] = ["owner", "admin", "member", "guest"];

/**
 * Mã quyền → khoá trong `messages/*.json`.
 *
 * ⚠ **DẤU CHẤM LÀM KHOÁ KHÔNG TRA TỚI ĐƯỢC.** `next-intl` dùng dấu chấm làm dấu phân cấp
 * namespace, nên `"task.view"` viết thẳng vào `messages/` sinh ra một khoá chết: phép tra đi xuống
 * `task → view` và không thấy gì. Đây là lỗi đã xảy ra thật ở Comitor.Account, với cùng một nguyên
 * nhân (tên scope OIDC dùng thẳng làm khoá).
 *
 * ⚠ Và nó hỏng **IM LẶNG**: `next-intl` không ném gì cả (đã đo trên `use-intl` 4.14.1, cả bundle
 * dev lẫn production) — `t()` chỉ trả về chính tên khoá. Bản trước của khối này viết rằng "MỌI
 * trang hỏng"; điều đó khiến người đọc tin rằng lỗi sẽ tự lộ ra, nên không ai dựng cổng cho nó.
 *
 * Vì vậy `messages/*.json` giữ tên đã thay dấu chấm bằng gạch dưới (`task_view`), và phép đổi nằm
 * ở đây — một chỗ. `pnpm i18n:check` có phép kiểm chặn khoá chứa dấu chấm, nên nếu ai đó lỡ thêm
 * lại thì cổng đó đỏ trước khi app hỏng.
 */
export function toPermissionMessageKey(id: AppPermissionId): string {
  return id.replace(/\./g, "_");
}

/** Mọi mã quyền, SUY từ `PERMISSION_RULES` — hai danh sách rời nhau thì sớm muộn lệch. */
export const APP_PERMISSION_IDS: readonly AppPermissionId[] = PERMISSION_RULES.map((rule) => rule.id);
