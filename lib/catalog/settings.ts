import { DEFAULT_PAGE_SIZE_OPTIONS } from "@comitor/ui";
import { NAV_ITEMS, type NavItemSpec } from "@/lib/catalog/navigation";
import type { AppDataPrefId, ArchiveAfter, DigestFrequency, NotificationPrefId } from "@/lib/contracts/settings";

/**
 * BẢNG KHAI của trang Cài đặt — chỉ id và thứ tự. Nhãn ở `messages/*.json`, mục `settings.*`.
 *
 * ⚠ Không khoản nào ở đây là dữ liệu của Comitor.Account. Nếu một mục mới không trả lời được câu
 * *"nó đổi cách ỨNG DỤNG NÀY làm việc à?"* thì chỗ của nó là Account.
 *
 * Ranh giới đi qua đúng chỗ này: **SỰ KIỆN NÀO của module đáng gửi đi** là chuyện của module Công
 * việc; **gửi tới địa chỉ email nào, số điện thoại nào** là hồ sơ cá nhân, tức của Account.
 *
 * ⚠ Bản trước của câu trên viết *"báo cho tôi khi có người giao việc"*, và cách diễn đạt ngôi thứ
 * nhất ấy đã đi thẳng vào nhãn của cả tab. Nó sai: `app_settings` khoá theo `workspaceId`, nên mọi
 * công tắc ở đây là của CẢ KHÔNG GIAN LÀM VIỆC. `lib/tasks.ts` gọi đúng giá trị ấy là
 * `workspaceAllows` — mã đã luôn đúng, chỉ có chữ trên màn hình là sai.
 */

/**
 * Dải tab của trang Cài đặt — **SUY RA** từ `children` của mục `settings` trong `NAV_ITEMS`.
 *
 * Mỗi tab là một ROUTE THẬT, không phải `?tab=` — lý do đầy đủ ở `lib/catalog/navigation.ts`.
 *
 * ── ⚠ VÌ SAO SUY, CHỨ KHÔNG KHAI LẠI ────────────────────────────────────────────────────────
 * Bản trước khai lại đúng bốn `href` ấy ở đây, và đó là một danh sách điều hướng THỨ HAI — thứ mà
 * AGENTS.md cấm bằng câu *"`lib/catalog/navigation.ts` là nguồn sự thật DUY NHẤT của điều hướng"*.
 * Cái giá không phải trùng lặp mà là **hỏng lệch nhau**: đổi một đường dẫn cài đặt rồi quên chỗ kia
 * thì thanh bên (đọc `NAV_ITEMS`) vẫn đi đúng còn dải tab trỏ vào 404 — và **không cổng nào trong
 * `pnpm check` bắt được**, vì `href` chỉ là chuỗi. Nó chỉ lộ ra khi có người bấm.
 *
 * Suy còn trả về hai thứ mà bản khai tay đã đánh mất:
 *   · `id` ở đây nay là `NavItemId` (`settingsGeneral`…) chứ không phải `string`, nên khoá i18n
 *     được `tsc` kiểm — bản trước dựng khoá lúc CHẠY bằng một hàm `navKeyFor()` ghép chuỗi, và
 *     chính hàm đó ghi rằng `tsc` không bắt được chỗ nó làm;
 *   · gỡ lệnh ép kiểu cuối cùng của họ `as Parameters<typeof tNav>[0]` — xem `NavItemId` ở
 *     `navigation.ts`, nơi đã gỡ cái đầu tiên vì đúng lý do này.
 *
 * ⚠ Phép kiểm dưới đây NÉM lúc nạp module, cố ý: nó biến một bất biến vốn không cổng nào canh
 * thành một cổng THẬT. `settings-tabs-nav.tsx` nằm trong nhánh render của `/settings`, nên
 * `pnpm build` nạp file này — mục `settings` mất `children` là build ĐỎ, không phải một dải tab
 * rỗng lặng lẽ. Đừng "chữa" bằng `?? []`: đó chính là cách hỏng im lặng mà cả mục này tồn tại để
 * đóng lại.
 */
const settingsChildren = NAV_ITEMS.find((item) => item.id === "settings")?.children;
if (!settingsChildren || settingsChildren.length === 0) {
  throw new Error(
    'lib/catalog/navigation.ts: mục điều hướng "settings" phải có `children` — dải tab của trang Cài đặt suy ra từ đó.'
  );
}

export const SETTINGS_TABS: readonly NavItemSpec[] = settingsChildren;

/**
 * ⚠ Thứ tự ở đây quyết định thứ tự công tắc trên màn hình, và `email-digest` phải đứng CUỐI: nó là
 * cái GÁC ô chọn tần suất ngay bên dưới nó, nên đặt nó ở giữa là để một control gác một control
 * cách nó hai dòng.
 *
 * Gỡ một khoản khỏi danh sách này thì `pnpm i18n:check` báo khoá `settings.notifications.pref.*`
 * còn sót lại — cổng đó được nới ra để canh chính danh sách này (xem `scripts/check-messages.ts`).
 */
export const NOTIFICATION_PREFS: readonly NotificationPrefId[] = ["assigned", "due-soon", "email-digest"];

export const APP_DATA_PREFS: readonly AppDataPrefId[] = ["public-link", "activity-log"];

export const DIGEST_FREQUENCIES: readonly DigestFrequency[] = ["daily", "weekly", "friday"];

export const ARCHIVE_OPTIONS: readonly ArchiveAfter[] = ["30d", "90d", "180d", "never"];

/**
 * Số dòng mỗi trang của bảng Công việc — LẤY THẲNG danh sách của gói, không chép lại.
 *
 * `<TablePagination>` tự dựng ô chọn cỡ trang từ CÙNG hằng này. Gõ lại `[20, 50, 100]` ở đây thì
 * người dùng chọn được ở trang Cài đặt một cỡ trang mà chính cái bảng không có trong danh sách của
 * nó — và cỡ trang chỉ hiện sai sau khi họ rời trang cài đặt, tức không ai nối được hai chuyện với
 * nhau.
 */
export const PAGE_SIZE_OPTIONS: readonly number[] = DEFAULT_PAGE_SIZE_OPTIONS;

/**
 * Phím tắt hiện ở trang Cài đặt.
 *
 * `keys` dùng cú pháp của `<KeyboardHint>`: `mod` cho phím lệnh chính — component tự hiện `⌘` trên
 * macOS và `Ctrl` ở nơi khác. Viết cứng "Ctrl" là sai với một nửa người dùng.
 *
 * Ba tổ hợp đầu do `AppShell` đăng ký sẵn; `mod+s` do chính trang cài đặt đăng ký.
 */
export const SHORTCUT_HINTS: readonly { id: string; keys: string }[] = [
  { id: "command-palette", keys: "mod+k" },
  { id: "app-launcher", keys: "mod+shift+k" },
  { id: "toggle-sidebar", keys: "mod+b" },
  { id: "save-settings", keys: "mod+s" }
];
