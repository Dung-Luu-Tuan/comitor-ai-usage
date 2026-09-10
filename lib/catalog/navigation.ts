import { type LucideIcon, Settings, Sparkles } from "lucide-react";
import type { AppPermissionId } from "@/lib/contracts/settings";
import type messages from "@/messages/vi.json";

/**
 * Cấu trúc menu của thanh bên — nguồn sự thật DUY NHẤT cho điều hướng trong module.
 *
 * Thanh bên, menu off-canvas trên màn hình hẹp và bảng lệnh ⌘K đều đọc từ đây; đừng khai lại danh
 * sách link ở bất kỳ trang nào. Bảng lệnh lấy `nav` qua `useShell()` — không có danh sách thứ hai.
 *
 * ⚠ **KHÔNG CÓ NHÃN Ở ĐÂY, chỉ có `id`.** Nhãn nằm ở `messages/*.json` mục `nav.*`, và
 * `app/(shell)/layout.tsx` ghép hai thứ lại thành `NavGroup[]` mà `AppShell` cần. Để nhãn ở đây là
 * để một chuỗi tiếng Việt cứng nằm ngoài tầm của `pnpm i18n:check`.
 *
 * ⚠ `href` CHỈ LÀ CHUỖI — `tsc` và Biome không bắt được link chết. Thêm route thì thêm mục; bỏ
 * route thì bỏ mục. Phép kiểm rẻ nhất: đối chiếu bảng route mà `pnpm build` in ra với BẢN ĐỒ ROUTE
 * trong README.
 *
 * ⚠ **KHÔNG CÓ MỤC "THÀNH VIÊN"**, và đó là ranh giới chứ không phải chỗ còn thiếu: thành viên,
 * lời mời, vai trò thô và cài đặt không gian làm việc thuộc **Comitor.Account**
 * (`lib/account/links.ts`). Đường vào chúng nằm ở menu không gian làm việc trên header và ở bảng
 * lệnh ⌘K — cả hai dẫn sang Account chứ không dẫn tới một route của module này. Phần module THẬT
 * SỰ sở hữu về con người là "ai làm được gì trong ứng dụng", và nó là `/settings/permissions`.
 */

/**
 * Khoá hợp lệ của một mục điều hướng — SUY RA từ `messages/vi.json` mục `nav.*`.
 *
 * ── VÌ SAO KHÔNG ĐỂ `id: string` ─────────────────────────────────────────────────────────
 * Vì `id` là khoá i18n, và `string` làm mất chính phép kiểm mà `tsc` vốn cho không. Với `string`,
 * thêm một mục `{ id: "reports", … }` mà quên khoá `nav.reports` thì mọi cổng đều xanh và người
 * dùng thấy `⟦nav.reports⟧` trong thanh bên — ở CẢ hai ngôn ngữ, vì lỗi nằm ở chỗ gọi chứ không ở
 * bản dịch, nên `pnpm i18n:check` cũng không thấy.
 *
 * Với kiểu này thì đó là **lỗi biên dịch**, ngay dòng bạn vừa gõ. Và nó cũng gỡ được lệnh ép kiểu
 * `spec.id as Parameters<typeof tNav>[0]` ở `app/(shell)/shell-frame.tsx` — một lệnh ép kiểu tồn
 * tại chỉ vì kiểu ở đây quá rộng.
 *
 * ⚠ Import CHỈ LÀ KIỂU (`import type`), nên không có gì đi vào bundle. `lib/catalog/` vẫn không
 * mang nhãn — nó chỉ mượn TẬP KHOÁ để tự ràng buộc mình.
 */
export type NavItemId = keyof (typeof messages)["nav"];

export interface NavItemSpec {
  /** Khoá trong `messages/*.json` mục `nav.*`, và cũng là `id` mà `AppShell` dùng. */
  id: NavItemId;
  href: string;
  icon?: LucideIcon;
  /**
   * Quyền cần có để mục này HIỆN RA. Không khai = ai cũng thấy.
   *
   * ⚠ Đây là phần "giấu", không phải phần "chặn" — và hai thứ đó phải đi CÙNG NHAU. Giấu mà không
   * chặn thì gõ tay đường dẫn là vào được; chặn mà không giấu thì người dùng thấy một mục trong
   * thanh bên, bấm vào, và nhận một trang 404 — họ sẽ báo đó là lỗi. Chốt tương ứng là
   * `requireReadPermission()` ở `page.tsx` của chính route đó.
   *
   * Bảng lệnh ⌘K tự đúng theo, vì nó đọc `nav` qua `useShell()` chứ không giữ danh sách thứ hai.
   */
  permission?: AppPermissionId;
  /** `true` = mục này hiện badge số việc đang mở. Chỉ đúng MỘT mục có nó. */
  showOpenTaskBadge?: boolean;
  children?: NavItemSpec[];
}

/**
 * MỘT nhóm duy nhất, không nhãn.
 *
 * Vì sao không có nhóm "Quản trị": nó từng gom "Thành viên" với "Cài đặt", mà thành viên nay thuộc
 * Comitor.Account. Một nhóm CÓ NHÃN mà chỉ chứa đúng một mục thì cái nhãn không phân loại gì cả —
 * nó chỉ thêm một hàng chữ và một nút gập vào thanh bên.
 *
 * Mục "Cài đặt" là một NHÁNH: có `children` nên bấm vào nó chỉ mở/đóng nhánh, không điều hướng.
 * Layout đặt `isActive: false` cho nó — nếu để shell tự suy, mục cha sẽ sáng CÙNG LÚC với mục con
 * "Chung" (hai mục cùng `href` `/settings`) và người dùng thấy hai hàng active chồng nhau.
 *
 * Mọi `href` ở đây là ROUTE THẬT, không có `?tab=` — đó là lý do shell tô đúng mục đang mở: nó so
 * bằng `usePathname()`, mà `pathname` của Next KHÔNG BAO GIỜ chứa `?query`. Nếu sau này có ai định
 * gộp mấy trang thành lát cắt query của một trang, biết trước cái giá: mọi lát cắt sẽ cùng sáng,
 * và cách chữa duy nhất — truyền `searchParams` cho `<AppShell>` — làm `next build` ĐỎ vì
 * `useSearchParams()` trong layout, kéo mọi trang dưới layout rơi khỏi prerender. Đã thử và đo.
 */
export const NAV_ITEMS: readonly NavItemSpec[] = [
  { id: "aiUsage", href: "/ai-usage", icon: Sparkles, permission: "app.settings" },
  {
    id: "settings",
    href: "/settings",
    icon: Settings,
    children: [
      { id: "settingsGeneral", href: "/settings" },
      { id: "settingsNotifications", href: "/settings/notifications" },
      { id: "settingsPermissions", href: "/settings/permissions" },
      { id: "settingsAdvanced", href: "/settings/advanced" }
    ]
  }
];
