import type { DataTableLabels, DatePickerLabels, SearchFilterBarLabels, TablePaginationLabels } from "@comitor/ui";
import type { ShellLabels } from "@comitor/ui/shell";
import type { Locale as DateFnsLocale } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import type { Locale } from "@/lib/i18n/config";

/**
 * ⚠ **FILE NÀY CHỈ PHỦ PROP DẠNG OBJECT `labels`. Gói còn có prop nhãn RỜI, và chúng mặc định
 * TIẾNG VIỆT.**
 *
 * Đó là một lớp lỗi riêng, không cái nào trong các cổng của repo bắt được: `pnpm i18n:check` chỉ
 * so hai file JSON, `core:check` chỉ quét `lib/core/`, và `tsc` thì hài lòng vì prop là optional.
 * Triệu chứng: một từ tiếng Việt đứng giữa giao diện tiếng Anh — và nó chỉ lộ ra khi có người đi
 * đúng vòng thử `en` VÀ chạm đúng control đó.
 *
 * Bảng tra — mỗi dòng là một prop phải truyền nếu dùng control đó:
 *
 * | Component | Prop | Mặc định của gói |
 * |---|---|---|
 * | `ConfirmDialog` | `cancelLabel` | "Hủy" |
 * | `ConfirmDialog` | `confirmLabel`, `pendingLabel` | tiếng Việt |
 * | `Combobox`, `MultiCombobox` | `clearLabel` (khi có `clearable`) | "Xóa lựa chọn" |
 * | `Combobox`, `MultiCombobox` | `placeholder`, `searchPlaceholder`, `emptyText`, `loadingText` | tiếng Việt |
 * | `MultiCombobox` | `selectedCountLabel` | `(s, m) => \`Đã chọn ${s}/${m}\`` |
 * | `NotificationsButton` | `label` | "Thông báo" |
 *
 * ⚠ **`NotificationsButton` là ca đáng nhớ nhất trong bảng**, vì nó phá đúng giả định mà file này
 * tạo ra: nó KHÔNG đọc `labels` mà root layout truyền cho `ShellProvider` — nó đọc thẳng
 * `DEFAULT_SHELL_LABELS.notifications`. Tức khai `SHELL_LABELS` đầy đủ ở đây vẫn không đủ. Và vì
 * nút chỉ có icon nên chuỗi hỏng KHÔNG NHÌN THẤY ĐƯỢC: nó chỉ hiện ra trong cây trợ năng, dưới
 * dạng tên "Thông báo (3)" giữa một giao diện tiếng Anh. Đi thử bằng mắt không bắt được ca này;
 * `read_page` ở locale `en` thì bắt được.
 *
 * Cách soát: dùng một control của gói xong thì mở `.d.ts` của nó và đọc HẾT danh sách prop kết
 * thúc bằng `Label` / `Text` / `Placeholder`. Nhanh hơn là đi một vòng `en` và nhìn.
 */

/**
 * Cầu nối giữa `messages/*.json` của module và cơ chế `labels` của `@comitor/ui`.
 *
 * ── VÌ SAO CÁC CHUỖI NÀY KHÔNG NẰM TRONG `messages/*.json` ─────────────────────────────────
 * Hai lý do, cả hai đều cứng:
 *
 *   1. **Một số nhãn là HÀM, không phải chuỗi** — `range(start, end, total, unitLabel)`,
 *      `resultSummary(...)` (trả `ReactNode`), `members(count)`. JSON không diễn đạt được, và ICU
 *      cũng không: gói cần một hàm để tự bọc con số vào thẻ riêng (`tabular-nums`). Nối
 *      `${count} ${nhãn}` ở phía gói thì trật tự từ của tiếng Việt bị khoá cứng vào mọi bản dịch.
 *   2. **Đây là chuỗi của GÓI, không phải nội dung của module.** Chúng đi kèm phiên bản
 *      `@comitor/ui`: gói thêm một khoá thì `Partial<>` ở đây vẫn biên dịch được, nhưng khoá mới sẽ
 *      hiện ra tiếng Việt giữa giao diện tiếng Anh — một lỗi CHỈ bắt được bằng mắt. Giữ chúng cạnh
 *      `import type` của chính gói làm cái lệch đó lộ ra ngay khi đọc file.
 *
 * ── VÌ SAO `vi` TRẢ `undefined` ───────────────────────────────────────────────────────────
 * Mặc định của gói ĐÃ là tiếng Việt. Chép lại nguyên bộ chuỗi tiếng Việt vào đây là dựng một bản
 * sao thứ hai sẽ lệch ngay lần gói sửa chữ — và lệch ÂM THẦM, vì cả hai bản đều "đúng tiếng Việt".
 * Không truyền `labels` là để gói tự nói tiếng của nó.
 *
 * ── THÊM NGÔN NGỮ THỨ BA ──────────────────────────────────────────────────────────────────
 * `Record<Locale, …>` làm TypeScript báo đỏ ngay khi `LOCALES` dài thêm. Đó là CHỦ Ý: đây là chỗ
 * dễ quên nhất khi thêm ngôn ngữ, vì thiếu nó giao diện vẫn CHẠY, chỉ là nửa Việt nửa Anh.
 */

const EN_DATA_TABLE: DataTableLabels = {
  selectAllRows: "Select all rows",
  deselectAllRows: "Deselect all rows",
  selectRow: "Select row",
  deselectRow: "Deselect row",
  emptyTitle: "Nothing here yet",
  emptyDescription: "There is no data to show.",
  columnToggle: "Columns"
};

const EN_TABLE_PAGINATION: TablePaginationLabels = {
  region: "Pagination",
  unitLabel: "tasks",
  pageSizePrefix: "Rows",
  pageSizeSelect: (unitLabel) => `Number of ${unitLabel} per page`,
  range: (start, end, total, unitLabel) => `${start}–${end} of ${total} ${unitLabel}`,
  pageStatus: (page, pageCount) => `Page ${page} / ${pageCount}`,
  firstPage: "First page",
  previousPage: "Previous page",
  nextPage: "Next page",
  lastPage: "Last page"
};

const EN_SEARCH_FILTER_BAR: SearchFilterBarLabels = {
  searchPlaceholder: "Search…",
  unitLabel: "tasks",
  clearSearch: "Clear search",
  filterCount: (count) => (count === 1 ? "1 filter" : `${count} filters`),
  clearFilters: "Clear filters",
  resultSummary: (resultCount, total, unitLabel) => (
    <>
      <span className="tabular-nums text-foreground">{resultCount}</span>
      {total === undefined ? ` ${unitLabel}` : ` / ${total} ${unitLabel}`}
    </>
  )
};

const EN_SHELL: ShellLabels = {
  collapseSidebar: "Collapse sidebar",
  // WCAG 2.5.3: chuỗi ngắn PHẢI là một phần của chuỗi dài — "Collapse" ⊂ "Collapse sidebar".
  collapseSidebarShort: "Collapse",
  expandSidebar: "Expand sidebar",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  search: "Search",
  searchPlaceholder: "Search…",
  notifications: "Notifications",
  navigationLabel: "Main navigation",
  workspace: "Workspace",
  workspaceSwitcherLabel: "Switch workspace",
  workspaceSearchPlaceholder: "Find a workspace…",
  workspaceEmpty: "No workspace found",
  createWorkspace: "Create workspace",
  workspaceSettings: "Workspace settings",
  inviteMembers: "Invite members",
  members: (count) => `${count} members`,
  apps: "Applications",
  appLauncherLabel: "Open an application",
  myApps: "My applications",
  discoverApps: "Discover more",
  locked: "Locked",
  lockedHint: "This workspace has not enabled this application.",
  account: "Account",
  profile: "Profile",
  settings: "Settings",
  appearance: "Appearance",
  help: "Help",
  logout: "Sign out",
  themeLight: "Light",
  themeDark: "Dark",
  themeSystem: "System",
  toggleTheme: "Switch theme"
};

const EN_DATE_PICKER: DatePickerLabels = {
  clear: "Clear date",
  clearRange: "Clear date range",
  openCalendar: "Open calendar"
};

/** `undefined` = dùng nguyên mặc định của gói. Xem lý do ở đầu file. */
export const DATA_TABLE_LABELS: Record<Locale, DataTableLabels | undefined> = {
  vi: undefined,
  en: EN_DATA_TABLE
};

export const TABLE_PAGINATION_LABELS: Record<Locale, TablePaginationLabels | undefined> = {
  vi: undefined,
  en: EN_TABLE_PAGINATION
};

export const SEARCH_FILTER_BAR_LABELS: Record<Locale, SearchFilterBarLabels | undefined> = {
  vi: undefined,
  en: EN_SEARCH_FILTER_BAR
};

export const SHELL_LABELS: Record<Locale, ShellLabels | undefined> = {
  vi: undefined,
  en: EN_SHELL
};

export const DATE_PICKER_LABELS: Record<Locale, DatePickerLabels | undefined> = {
  vi: undefined,
  en: EN_DATE_PICKER
};

/**
 * Locale của **date-fns** theo ngôn ngữ app — thứ quyết định "3 phút trước" ⇄ "3 minutes ago", tên
 * thứ/tháng trong lịch, và thứ tự ngày/tháng của ô chọn ngày (`dd/MM/yyyy` ⇄ `MM/dd/yyyy`).
 *
 * ⚠ Đây là bảng DUY NHẤT ở đây KHÔNG trả `undefined` cho `vi`, và nó cố ý khác: `locale` không
 * phải là chuỗi hiển thị mà là một tham số HÀNH VI. Bỏ trống thì component rơi về mặc định của gói
 * — hôm nay mặc định đó tình cờ là `vi`, nhưng nó là quyết định của GÓI, không phải của module.
 * Nói rõ ra thì ngày gói đổi mặc định, giao diện tiếng Việt ở đây không đổi theo.
 *
 * ⚠ Và nó KHÔNG thay được `DATE_PICKER_LABELS`: locale của date-fns chỉ mang cách viết ngày tháng,
 * không mang chuỗi giao diện. `DatePicker` cần CẢ hai.
 */
export const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = {
  vi,
  en: enUS
};
