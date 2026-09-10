import type { BadgeProps, StatusConfig } from "@comitor/ui";
import { STATUS_TONES } from "@comitor/ui";
import type {
  ActivityKind,
  NotificationKind,
  ProjectStatus,
  RequestType,
  TaskPriority,
  TaskStatus
} from "@/lib/contracts/task";

/**
 * BẢNG KHAI TĨNH của module — thứ tự, tone màu, biến thể badge.
 *
 * ── VÌ SAO CÓ MỘT TẦNG `lib/catalog/` RIÊNG, KHÔNG PHẢI `lib/core/` ────────────────────────
 * Vì đây KHÔNG phải quy tắc nghiệp vụ mà là HẰNG GIAO DIỆN: nó biết tới `@comitor/ui`, nó mang
 * icon (component React), và nó được `import` thẳng từ file `"use client"`. Tầng 1 (`lib/core/`)
 * bị cấm cả ba thứ đó.
 *
 * Và vì sao chúng không nằm chung với dữ liệu mẫu như bản chỉ-giao-diện trước đây (bản đó gom cả
 * hai vào một file `lib/sample-data.ts`, nay đã xoá): bảng khai tĩnh KHÔNG phải dữ liệu mẫu. Dữ
 * liệu mẫu bị xoá khi nối backend — và đã bị xoá thật; bảng này thì ở lại vĩnh viễn.
 *
 * ── ⚠ KHÔNG CÓ NHÃN NÀO Ở ĐÂY ──────────────────────────────────────────────────────────────
 * Bản trước của bảng này mang `label: "Đang làm"` ngay trong dữ liệu. Đó là một chuỗi hiển thị
 * nằm ngoài `messages/*.json`, nên `pnpm i18n:check` không thấy nó, và giao diện tiếng Anh sẽ hiện
 * "Đang làm" giữa màn hình. Nay bảng chỉ giữ GIÁ TRỊ + THỨ TỰ + TONE; nhãn tra từ `messages/`, và
 * `hooks/use-catalog.ts` là chỗ ghép hai thứ lại thành `StatusConfig` mà gói cần.
 *
 * ── TONE LÀ CỦA GÓI, Ý NGHĨA LÀ CỦA MODULE ─────────────────────────────────────────────────
 * `@comitor/ui` cấp bộ tone ĐÃ ĐO TƯƠNG PHẢN (`STATUS_TONES`); "trạng thái nào mang tone nào" là
 * quy ước nghiệp vụ của module. Nhờ vậy đổi nhãn hay đổi ý nghĩa không phải đụng vào gói, mà màu
 * vẫn đạt WCAG ở cả bốn bảng màu.
 */

/** Phần của `StatusConfig` mà bảng khai giữ được — tất cả TRỪ nhãn. */
type StatusMeta<T extends string> = Omit<StatusConfig<T>, "label" | "shortLabel">;

/**
 * THỨ TỰ TRONG MẢNG là thứ tự hiển thị trong bộ lọc và trong ô chọn.
 *
 * `priority` thì khác: nó là thứ tự dùng để SẮP XẾP bảng theo cột trạng thái. Hai thứ cố ý tách
 * nhau — người dùng muốn thấy danh sách theo dòng đời công việc (Chờ làm → Đang làm → …), nhưng
 * khi sắp xếp thì việc QUÁ HẠN phải nổi lên đầu.
 */
export const TASK_STATUSES: readonly StatusMeta<TaskStatus>[] = [
  { value: "todo", priority: 1, ...STATUS_TONES.neutral },
  { value: "in-progress", priority: 2, ...STATUS_TONES.info },
  { value: "in-review", priority: 3, ...STATUS_TONES.warning },
  { value: "done", priority: 4, ...STATUS_TONES.success },
  {
    value: "overdue",
    priority: 0,
    ...STATUS_TONES.destructive,
    /**
     * Tint cả dòng bảng — chỉ dùng cho trạng thái thật sự cần gây chú ý.
     *
     * ⚠ Lớp này có ALPHA. Đánh dấu dòng đang mở thì phải dùng `outline`, KHÔNG dùng thêm một lớp
     * nền nữa: qua `cn()` cùng `bg-card`, tailwind-merge BỎ `bg-card`, và ô cột ghim
     * (`bg-inherit`) trở nên gần như trong suốt, để lộ nội dung đang cuộn bên dưới.
     */
    rowClassName: "bg-destructive/5"
  }
];

/** Thứ tự sắp xếp theo trạng thái — SUY từ `priority`, không chép tay. */
export const TASK_STATUS_ORDER: readonly TaskStatus[] = [...TASK_STATUSES]
  .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  .map((entry) => entry.value);

export const TASK_PRIORITIES: readonly StatusMeta<TaskPriority>[] = [
  { value: "low", priority: 4, ...STATUS_TONES.neutral },
  { value: "medium", priority: 3, ...STATUS_TONES.info },
  { value: "high", priority: 2, ...STATUS_TONES.warning },
  { value: "urgent", priority: 1, ...STATUS_TONES.destructive }
];

/** Khẩn nhất đứng đầu. */
export const TASK_PRIORITY_ORDER: readonly TaskPriority[] = [...TASK_PRIORITIES]
  .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  .map((entry) => entry.value);

export const PROJECT_STATUSES: readonly StatusMeta<ProjectStatus>[] = [
  { value: "active", priority: 1, ...STATUS_TONES.success },
  { value: "on-hold", priority: 2, ...STATUS_TONES.warning },
  { value: "completed", priority: 3, ...STATUS_TONES.neutral }
];

/**
 * Loại yêu cầu ở biểu mẫu tạo việc.
 *
 * `disabled` KHÔNG nằm ở đây: "không gian làm việc này có được chuyển việc ra ngoài không" là một
 * CÀI ĐẶT (`allowPublicLink` và họ hàng của nó), tức dữ liệu — không phải hằng giao diện. Trang
 * biểu mẫu nhận cờ đó qua prop từ `page.tsx`.
 *
 * ⚠ Và mọi mục bị vô hiệu PHẢI kèm lý do. Một mục xám không lời giải thích khiến người dùng nghĩ
 * giao diện hỏng; giao diện có nghĩa vụ nói VÌ SAO, không chỉ nói "không được".
 */
export const REQUEST_TYPES: readonly RequestType[] = ["task", "incident", "improvement", "external"];

/**
 * Loại sự kiện nhật ký → biến thể `Badge`.
 *
 * Vì sao `Badge` chứ không `StatusPill`: đây là LOẠI SỰ KIỆN đã xảy ra (bất biến, đứng một mình),
 * không phải trạng thái hiện thời của một bản ghi. Trạng thái công việc vẫn đi đường
 * `TASK_STATUSES` + `<StatusPill>` — trộn hai thứ vào một component là mất luôn khác biệt đó.
 */
export const ACTIVITY_KIND_VARIANTS: Record<ActivityKind, NonNullable<BadgeProps["variant"]>> = {
  created: "outline",
  assigned: "primary",
  updated: "secondary",
  "review-requested": "warning",
  completed: "success",
  overdue: "destructive",
  deleted: "destructive"
};

/** Thứ tự này chỉ dùng cho bộ lọc nhật ký; nhật ký thật luôn sắp theo thời gian. */
export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  "created",
  "assigned",
  "updated",
  "review-requested",
  "completed",
  "overdue",
  "deleted"
];

export const NOTIFICATION_KINDS: readonly NotificationKind[] = ["mention", "assignment", "deadline", "system"];
