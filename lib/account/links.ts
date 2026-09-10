/**
 * Đường dẫn sang **Comitor.Account** — sản phẩm giữ danh tính và không gian làm việc của cả hệ
 * sinh thái. Hàm thuần, không bản ghi, DÙNG ĐƯỢC CẢ Ở TRÌNH DUYỆT.
 *
 * ── VÌ SAO FILE NÀY TỒN TẠI: RANH GIỚI ACCOUNT / APP ──────────────────────────────────────
 * Account trả lời đúng **ba câu**, và chỉ ba câu đó:
 *
 *   1. *bạn là ai* — hồ sơ cá nhân, mật khẩu, xác thực hai bước, phiên đăng nhập;
 *   2. *bạn thuộc không gian làm việc nào, với VAI TRÒ THÔ gì* — `owner`/`admin`/`member`/`guest`,
 *      kèm thành viên, lời mời và nhóm;
 *   3. *không gian làm việc đó được dùng app nào* — gói, chỗ ngồi, app đã mở khoá.
 *
 * **Mọi câu khác là của module**, và dữ liệu nằm ở database của chính nó: "ai được xoá công việc",
 * "ai xem được báo cáo", "ai duyệt đơn". Đó là lý do repo này KHÔNG có trang quản lý thành viên mà
 * có `/settings/permissions` — module không phát vai trò, module chỉ quyết định mỗi vai trò LÀM
 * ĐƯỢC GÌ BÊN TRONG NÓ.
 *
 * Đừng nhượng bộ theo hướng ngược lại. Áp lực "cho cái quyền này sang Account cho tiện" sẽ xuất
 * hiện liên tục; mỗi lần nhượng bộ là một bước biến Account thành kho quyền của mọi app, và từ đó
 * mọi app phải chờ Account ra bản mới mỗi lần chúng thêm một tính năng.
 *
 * Đường dẫn gom vào MỘT chỗ vì chúng xuất hiện ở nhiều nơi (menu không gian làm việc trên header,
 * bảng lệnh ⌘K, trang Phân quyền); rải chuỗi ra từng chỗ thì đổi tên miền là sót một chỗ.
 */

/**
 * Gốc của Comitor.Account. Mỗi sản phẩm Comitor là một app riêng ở một TÊN MIỀN riêng — Account
 * cũng vậy, nó không phải một route trong app này.
 *
 * ⚠ ĐỌC BIẾN `NEXT_PUBLIC_*` VÀ VIẾT NGUYÊN VĂN TÊN BIẾN. Next thay biến này bằng một hằng chuỗi
 * lúc build theo phép thay thế VĂN BẢN; gán tên biến vào một hằng rồi tra động (`process.env[name]`)
 * thì KHÔNG được thay, và ở trình duyệt giá trị sẽ là `undefined` — mọi liên kết sang Account trỏ
 * vào `undefined/w/...`. Không có lỗi nào ở đâu; chỉ có những đường link chết.
 *
 * ⚠ `NEXT_PUBLIC_` là cố ý: giá trị này KHÔNG phải bí mật (nó là một tên miền công khai), và nó
 * được dùng trong `app/(shell)/layout.tsx` — một file `"use client"`. Đọc nó qua `lib/env.ts` là
 * không được: file đó mang `import "server-only"`.
 *
 * `lib/env.ts` vẫn KIỂM biến này lúc khởi động (URL tuyệt đối, https ngoài loopback, không dấu `/`
 * cuối). Hai chỗ đọc cùng một biến, cố ý: một chỗ để dùng ở client, một chỗ để nổ sớm khi sai.
 *
 *   · phát triển / staging → `https://account.dev.comitor.ai`
 *   · production           → `https://account.comitor.ai`
 */
export const ACCOUNT_ORIGIN = (process.env.NEXT_PUBLIC_COMITOR_ACCOUNT_URL ?? "https://account.comitor.ai").replace(
  /\/+$/,
  ""
);

/** Khu quản trị của một không gian làm việc bên Account. */
export type AccountWorkspaceSection = "members" | "teams" | "settings" | "apps";

/**
 * Đường dẫn tới một không gian làm việc trong Account — `slug` là địa chỉ rút gọn, cùng chuỗi mà
 * `Workspace.slug` mang.
 */
export function accountWorkspaceUrl(slug: string, section?: AccountWorkspaceSection): string {
  const base = `${ACCOUNT_ORIGIN}/w/${encodeURIComponent(slug)}`;
  return section ? `${base}/${section}` : base;
}

/** Danh sách không gian làm việc của người đang đăng nhập — cũng là nơi tạo cái mới. */
export const accountWorkspacesUrl = `${ACCOUNT_ORIGIN}/workspaces`;

/**
 * Cùng trang trên, nhưng **mở sẵn hộp thoại tạo không gian làm việc**.
 *
 * ⚠ `?new=1` là HỢP ĐỒNG URL với Account, không phải một tham số trang trí. Hộp thoại ấy là state
 * React trong `shell-frame.tsx` bên Account, nên module không có cách nào khác chạm tới nó: module
 * không ghi được gì của Account, và dựng lại hộp thoại ở đây là dựng **cửa thứ hai vào cùng một dữ
 * liệu** — đúng thứ ranh giới ở đầu file này cấm.
 *
 * Không có tham số thì mục menu chỉ thả người dùng xuống trang danh sách, và họ phải tìm đúng cái
 * nút mà họ vừa bấm một lần rồi. Chỗ dựng ở phía Account: `app/(shell)/workspaces/page.tsx` +
 * `create-workspace-action.tsx`.
 */
export const accountCreateWorkspaceUrl = `${accountWorkspacesUrl}?new=1`;

/** Hồ sơ cá nhân. Module KHÔNG dựng lại màn hình này — nó chỉ dẫn đường sang. */
export const accountProfileUrl = `${ACCOUNT_ORIGIN}/profile`;

/**
 * Trang bảo mật của Account: mật khẩu, 2FA, và **danh sách phiên đang mở**.
 *
 * ⚠ Đây là đích của `/signed-out` cho người muốn thoát khỏi MỌI sản phẩm, và lý do nó là một
 * LIÊN KẾT chứ không phải một nút gọi API: tới lúc trang đó render thì phiên của module đã bị xoá,
 * nên module không còn `id_token` để làm RP-initiated logout. Nút "thoát khỏi mọi sản phẩm" mà
 * module TỰ làm được nằm ở menu người dùng trong app — nơi phiên còn sống. Xem
 * `app/api/auth/sign-out/route.ts`.
 */
export const accountSecurityUrl = `${ACCOUNT_ORIGIN}/security`;
