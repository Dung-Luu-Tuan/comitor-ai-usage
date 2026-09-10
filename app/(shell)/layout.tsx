import { AccountError } from "@comitor/account-sdk";
import type { ReactNode } from "react";
import { AccessDenied, type AccessDeniedCode } from "@/components/access-denied";
import { requireSession } from "@/lib/account/session";
import { listNotifications } from "@/lib/activities";
import { grantedPermissions } from "@/lib/permissions";
import { countOpenTasks, listCommandTasks } from "@/lib/tasks";
import { ShellFrame } from "./shell-frame";

/**
 * Khung dùng chung của MỌI trang trong module — và là **CỬA DỮ LIỆU CỦA KHUNG APP**.
 *
 * `(shell)` là route group: dấu ngoặc khiến tên thư mục KHÔNG đi vào URL, nên trang
 * `app/(shell)/page.tsx` vẫn nằm ở `/`. Nhờ vậy các trang không cần khung (một trang lỗi toàn màn
 * hình, sau này là màn hình "bạn chưa có chỗ ngồi") đặt ở nhóm khác mà không phải sửa gì ở đây.
 *
 * ── VÌ SAO TÁCH LÀM HAI FILE ─────────────────────────────────────────────────────────────
 * File này là **Server Component**: nó đọc phiên, đếm việc, lấy thông báo — những thứ chỉ máy chủ
 * làm được. `shell-frame.tsx` bên cạnh là **Client Component**: nó phải vậy, vì `AppShell` nhận
 * hàng loạt callback (`onWorkspaceChange`, `onAppSelect`…) mà hàm thì không tuần tự hoá được, và
 * vì `NAV_ITEMS`/`APPS` mang ICON — tức component React, cũng không tuần tự hoá được.
 *
 * Ranh giới đó cho một thứ đáng giá: **mọi bản ghi đi vào khung app qua ĐÚNG file này**.
 * `shell-frame.tsx` không `import` một bản ghi nào, nên nó không biết dữ liệu đến từ đâu — và khi
 * nối `@comitor/account-sdk`, chỉ file này đổi.
 *
 * ── VÌ SAO BA LỜI GỌI CHẠY SONG SONG ─────────────────────────────────────────────────────
 * `Promise.all` chứ không ba lần `await` nối tiếp: ba truy vấn độc lập nhau, và xếp hàng chúng là
 * cộng dồn ba lần chờ vào thời gian hiện ra của MỌI trang trong app — layout chạy trước mọi
 * `page.tsx`.
 */
/**
 * Bốn mã guard mà `requireWorkspaceAccess()` của SDK ném ra — và chỉ bốn mã đó dẫn tới một màn
 * hình giải thích. Mọi lỗi khác vẫn đi tiếp lên `app/error.tsx`.
 *
 * ⚠ Danh sách viết TƯỜNG MINH, không phải `error instanceof AccountError` chung chung: SDK còn ném
 * `MISSING_APP_KEY` (lỗi CẤU HÌNH của lập trình viên) và các mã HTTP khác. Hiện màn "xin quản trị
 * viên cấp chỗ ngồi" cho một cấu hình thiếu `appKey` là gửi người dùng đi làm phiền người khác vì
 * một lỗi trong mã của chúng ta.
 */
const GUARD_CODES: readonly AccessDeniedCode[] = ["NOT_A_MEMBER", "APP_NOT_ENABLED", "NO_SEAT", "APP_SUSPENDED"];

function guardCodeOf(error: unknown): AccessDeniedCode | null {
  if (!(error instanceof AccountError)) return null;
  const code = GUARD_CODES.find((candidate) => candidate === error.code);
  return code ?? null;
}

export default async function ShellLayout({ children }: { children: ReactNode }) {
  /*
   * ⚠ `try` CHỈ bọc `requireSession()`, không bọc cả thân hàm.
   *
   * `requireSession()` gọi `redirect()` của Next khi chưa đăng nhập, và `redirect()` hoạt động
   * bằng cách NÉM một lỗi đặc biệt. Một `try` ôm rộng hơn sẽ nuốt luôn lệnh chuyển hướng — trang
   * render tiếp với một phiên không tồn tại. Ở đây `catch` chỉ giữ lại đúng bốn mã guard và NÉM
   * LẠI mọi thứ khác, nên lỗi của Next đi qua nguyên vẹn.
   */
  let session: Awaited<ReturnType<typeof requireSession>>;
  try {
    session = await requireSession();
  } catch (error) {
    const code = guardCodeOf(error);
    if (!code) throw error;
    const named = error as { workspaceName?: string; workspaceSlug?: string };
    return <AccessDenied code={code} workspaceName={named.workspaceName} workspaceSlug={named.workspaceSlug} />;
  }

  const workspaceId = session.workspace.id;

  const [notifications, openTaskCount, commandTasks, permissions] = await Promise.all([
    listNotifications(workspaceId, session.user.id),
    countOpenTasks(workspaceId),
    listCommandTasks(workspaceId, session.user.timezone),
    /*
     * Gộp vào `Promise.all` đã có, không thêm một vòng chờ nữa: `getPermissionMatrix` là một truy
     * vấn, và nó chạy song song với ba cái kia thay vì nối tiếp sau chúng.
     */
    grantedPermissions(workspaceId, session.role)
  ]);

  return (
    <ShellFrame
      user={session.user}
      role={session.role}
      workspace={session.workspace}
      notifications={notifications}
      openTaskCount={openTaskCount}
      /*
       * Tập quyền dạng THUẦN (mảng chuỗi), không phải ma trận — xem `grantedPermissions`. Nó
       * quyết định mục nào HIỆN trong thanh bên và trong ⌘K; chốt thật là `requireReadPermission()`
       * ở `page.tsx` của từng route.
       */
      permissions={permissions}
      allWorkspaces={session.workspaces}
      /*
       * Việc cho bảng lệnh ⌘K — cắt gọn tại ĐÂY, không đẩy cả bảng xuống trình duyệt.
       *
       * ⚠ Đây là chỗ sẽ phải đổi sớm nhất khi dữ liệu thật lớn lên: hôm nay bảng lệnh tìm kiếm
       * trên một mảng nằm sẵn trong bộ nhớ, nên nó tức thì và không tốn vòng mạng nào. Với vài
       * nghìn việc thì mảng đó thành vài trăm KB tải về ở MỌI trang. Đường đi tiếp là một endpoint
       * tìm kiếm mà bảng lệnh gọi khi người dùng gõ — và `commandTasks` là chỗ duy nhất phải sửa.
       */
      commandTasks={commandTasks}
      appTiles={session.apps}
    >
      {children}
    </ShellFrame>
  );
}
