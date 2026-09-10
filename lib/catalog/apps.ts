import {
  Blocks,
  Boxes,
  Building2,
  Factory,
  FileText,
  Folder,
  type LucideIcon,
  MessageSquare,
  Package,
  Receipt,
  ShoppingCart,
  SquareCheckBig,
  Users,
  UsersRound
} from "lucide-react";
import { APP_ID } from "@/lib/core/app-identity";

/**
 * Hai BẢNG TRA của bệ phóng ứng dụng — và chỉ có thế.
 *
 * ── ⚠ FILE NÀY TỪNG LÀ MỘT BẢN MOCK, ĐỌC TRƯỚC KHI THÊM GÌ VÀO ĐÂY ───────────────────────
 * Bản trước khai TAY cả dải sản phẩm: danh sách app (`starter`, `chat`, `docs`, `crm`, `hr`), URL
 * của từng cái (đoán theo khuôn `https://{key}.comitor.ai`), và cờ mở khoá
 * (`DEV_LOCKED_APP_IDS = ["crm", "hr"]`). Cả ba là **câu trả lời của Comitor.Account** — câu số 3
 * trong ba câu nó trả lời — chứ không phải hằng của module, và cái giá đã hiện ra:
 *
 *   · hệ thêm một sản phẩm thì NĂM module phải sửa tay, mỗi module trôi một kiểu;
 *   · "đã mở khoá" là một hằng, nên bệ phóng nói dối về gói mà workspace thật sự đang có;
 *   · đoán URL nghĩa là bản dev và bản staging ném người dùng sang **production** của app anh em,
 *     mang theo phiên của họ, và không có gì báo.
 *
 * Nay dữ liệu đến từ `listAppTiles()` (`lib/account/session.ts`) — ghép danh mục toàn hệ
 * (`listAppCatalogue` của SDK) với quyền dùng của workspace. Còn lại ở đây đúng hai bảng, vì hai
 * thứ này KHÔNG đi qua HTTP được:
 *
 *   1. **tên icon → component** — Account gửi một chuỗi (`"MessageSquare"`), không gửi được một
 *      component React;
 *   2. **token màu → biến CSS** — Account gửi tên token (`"navy"`), và app thì KHÔNG SỞ HỮU MÀU
 *      (quy tắc số 1 của repo): mã màu nằm ở `@comitor/ui`.
 *
 * ⚠ Cả hai bảng là tập ĐÓNG, và với bảng màu thì đó là chuyện BẢO MẬT chứ không phải gọn gàng:
 * giá trị đi vào thuộc tính `style`, nên `var(--color-${tuỳ ý})` với một chuỗi từ API là một đường
 * tiêm CSS. Không tra ra thì trả `undefined` và để theme tự lo — đừng dựng chuỗi từ dữ liệu.
 */

/** App mà repo này ĐANG là. Truyền tường minh cho shell thay vì để nó suy từ pathname. */
export const CURRENT_APP_ID = APP_ID;

/**
 * Tên icon `lucide-react` (PascalCase, đúng như cột `apps.icon` bên Account) → component.
 *
 * Cố ý KHÔNG nhập cả `lucide-react` rồi tra động: làm vậy là kéo hơn một nghìn icon vào bundle của
 * trình duyệt để dùng vài cái. Danh mục Comitor có cỡ chục sản phẩm, nên một bảng viết tay vừa
 * nhẹ hơn vừa là chỗ để người sau thấy ngay phải thêm gì khi hệ có app mới.
 *
 * Thiếu một tên thì ô ứng dụng vẫn vẽ, chỉ mang icon mặc định — hỏng nhẹ, nhưng KHÔNG tự lộ ra:
 * nó trông y hệt một app cố tình không có icon riêng. Đã xảy ra ngay ở bản đầu của bảng này —
 * `mes` (Sản xuất) khai `Factory` bên Account, bảng thiếu tên đó, và ô ấy lặng lẽ hiện `Boxes`.
 * Cách bắt: mở bệ phóng rồi đọc `class` của từng `<svg>`, đừng nhìn.
 */
const APP_ICONS: Readonly<Record<string, LucideIcon>> = {
  Blocks,
  Boxes,
  Building2,
  Factory,
  FileText,
  Folder,
  MessageSquare,
  Package,
  Receipt,
  ShoppingCart,
  SquareCheckBig,
  Users,
  UsersRound
};

/** Icon khi Account không gửi tên, hoặc gửi một tên bảng trên không có. */
const FALLBACK_APP_ICON: LucideIcon = Boxes;

export function appIconFor(name: string | null): LucideIcon {
  if (!name) return FALLBACK_APP_ICON;
  return APP_ICONS[name] ?? FALLBACK_APP_ICON;
}

/**
 * ⚠ `AppAccent`, `APP_ACCENTS` và `appAccentFor()` ĐÃ BỊ GỠ (`@comitor/ui` 1.10.0).
 *
 * Chúng dựng ba biến CSS cho `AppDescriptor`, mà `AppLauncher` nay không đọc ba prop ấy nữa — nó
 * vẽ ô icon bằng `IconAvatar`, lấy màu từ bảng 8 tone theo `id` của app. Màu app vì thế TỰ CÓ,
 * không cần bảng nào ở đây; muốn chọn tay thì truyền `tone` (một tên trong `AVATAR_TONE_NAMES`).
 *
 * Giữ lại một bảng không còn ai đọc là để dành sẵn chỗ cho người sau gọi nhầm — và tệ hơn, nó là
 * đúng cái bảng ghi cứng mà lần đổi này sinh ra để bỏ.
 */
