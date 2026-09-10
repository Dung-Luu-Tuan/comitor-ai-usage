"use client";

/**
 * Cụm tương tác của trang Công việc — "hòn đảo client" duy nhất của trang.
 *
 * ── VÌ SAO FILE NÀY TỒN TẠI (quy ước: tự viết thì phải giải thích) ─────────────────────────
 * Đây KHÔNG phải component mới. Nó chỉ *ghép* các component có sẵn của `@comitor/ui`
 * (`SearchFilterBar` + `FilterChips` + `DataTable` + `TablePagination`) và giữ state của thanh
 * lọc. Mọi trạng thái của `DataTable` là **controlled** — gói cố ý không giữ dữ liệu, không tự
 * lọc, không tự phân trang — nên chỗ nối chúng lại là việc của app.
 *
 * Nó phục vụ đúng MỘT route nên nằm cạnh route, không nằm trong `components/`.
 *
 * ── VÀ VÌ SAO NÓ KHÔNG CÒN CHỨA MỘT DÒNG LOGIC LỌC NÀO ───────────────────────────────────
 * Lọc / sắp xếp / phân trang là logic NGHIỆP VỤ đội lốt logic hiển thị — nó quyết định người dùng
 * NHÌN THẤY dòng nào, đúng câu hỏi mà máy chủ sẽ phải trả lời lại y hệt khi bảng chuyển sang phân
 * trang phía server. Toàn bộ đã ở `lib/core/task-filter.ts` (tầng thuần, có test cho từng ca biên:
 * mảng lọc rỗng, trang vượt quá số trang, hai dòng bằng điểm). File này chỉ CẤP dữ liệu và VẼ.
 * Chép lại một nhánh nào của nó về đây là dựng bản thứ hai của quy tắc, và bản sai sẽ là bản chạy.
 *
 * ── DỮ LIỆU VÀ QUYỀN ĐỀU ĐI QUA PROP ─────────────────────────────────────────────────────
 * `page.tsx` bên cạnh (Server Component) đọc `lib/`, tính sẵn các vị từ quyền rồi truyền xuống.
 * File này không `import` một bản ghi nào và không tự gọi `can()` — xem ghi chú ở `page.tsx`.
 */

import {
  Button,
  Checkbox,
  Combobox,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  DataTableColumnToggle,
  type DataTableSort,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  type FilterChipItem,
  FilterChips,
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  LetterAvatar,
  MultiCombobox,
  PageContainer,
  PageHeader,
  RelativeTime,
  SearchFilterBar,
  StatusPill,
  sortByStatusPriority,
  TablePagination,
  toast
} from "@comitor/ui";
import {
  CircleCheckBig,
  ClipboardList,
  Download,
  Ellipsis,
  type LucideIcon,
  Plus,
  SearchX,
  SquarePen,
  Trash2,
  UserRoundPen
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useTaskPriorityConfigs, useTaskStatusConfigs } from "@/hooks/use-catalog";
import { useErrorMessage } from "@/hooks/use-error-message";
import { deleteTask, updateTask } from "@/lib/api-client/tasks";
import { TASK_PRIORITY_ORDER, TASK_STATUS_ORDER } from "@/lib/catalog/task";
import type { TaskStatus, TaskView } from "@/lib/contracts/task";
import { toCsv } from "@/lib/core/csv";
import {
  countActiveFilters,
  EMPTY_TASK_FILTER,
  filterTasks,
  paginate,
  sortTasks,
  type TaskFilter,
  type TaskSortKey,
  type TaskSortOrder
} from "@/lib/core/task-filter";
import { formatIsoDateFor, formatMinutesFor } from "@/lib/format";
import { isLocale } from "@/lib/i18n/config";
import {
  DATA_TABLE_LABELS,
  DATE_FNS_LOCALES,
  SEARCH_FILTER_BAR_LABELS,
  TABLE_PAGINATION_LABELS
} from "@/lib/i18n/ui-labels";

/* ────────────────────────────────────────────────────────────────────────────
   Hằng ở tầng module
   ──────────────────────────────────────────────────────────────────────────── */

/** Một lựa chọn của bộ lọc — dữ liệu THUẦN, ghép sẵn ở `page.tsx`. */
export interface TaskTableOption {
  id: string;
  name: string;
}

export interface TaskTableProps {
  tasks: TaskView[];
  /** Mọi dự án, KỂ CẢ dự án đã đóng: việc cũ vẫn thuộc về chúng. */
  projects: readonly TaskTableOption[];
  /** Danh bạ của không gian làm việc — câu trả lời của Comitor.Account, không phải bảng của module. */
  members: readonly TaskTableOption[];
  /**
   * Cỡ trang lúc mở bảng — đến từ cài đặt của ứng dụng (`/settings` → Chung).
   *
   * Là GIÁ TRỊ KHỞI TẠO, không phải giá trị bị khoá: ô chọn cỡ trang của `<TablePagination>` vẫn
   * đổi được cho phiên hiện tại. Nhờ prop này mà lựa chọn ở trang cài đặt có người tiêu thụ thật —
   * một trường cài đặt không ai đọc là một công tắc không làm gì cả.
   */
  defaultPageSize: number;
  canCreate: boolean;
  canEdit: boolean;
  canAssign: boolean;
  canDelete: boolean;
  canExport: boolean;
}

/**
 * Thứ tự NGHIỆP VỤ mà `sortTasks` cần — khai một lần, ở tầng module.
 *
 * Tầng thuần cố ý KHÔNG tự biết thứ tự này: sắp `status` theo bảng chữ cái là vô nghĩa với người
 * dùng, mà nhãn thì nằm ở `messages/*.json` nên mỗi ngôn ngữ cho một trật tự khác — cùng một bảng
 * sẽ đổi thứ tự dòng khi người dùng đổi ngôn ngữ. Thứ tự dưới đây suy từ `priority` của bảng khai,
 * nên nó giống nhau ở mọi ngôn ngữ.
 *
 * Ở tầng module (không dựng lại mỗi lần render) để tham chiếu ổn định — `useMemo` bên dưới phụ
 * thuộc vào nó.
 */
const SORT_ORDER: TaskSortOrder = { status: TASK_STATUS_ORDER, priority: TASK_PRIORITY_ORDER };

/**
 * Cột bấm để sắp xếp được — đúng bằng tập khoá mà `sortTasks` hiểu, không nhiều hơn.
 *
 * `project`, `assignee` và `estimate` cố ý KHÔNG có mặt: chúng sắp theo TÊN, mà tên người và tên
 * dự án đến từ danh bạ Account chứ không từ cột nào của module — sắp theo chúng ở client rồi phân
 * trang ở server (ngày dữ liệu lớn lên) là hai trật tự khác nhau trên cùng một bảng.
 */
const TASK_SORT_KEYS: readonly TaskSortKey[] = ["code", "title", "status", "priority", "dueDate", "updatedAt"];

function toTaskSortKey(columnId: string): TaskSortKey | null {
  return TASK_SORT_KEYS.find((key) => key === columnId) ?? null;
}

/**
 * Bố cục cột mặc định.
 *
 * ⚠ Phải liệt kê CẢ những cột không ẩn được (`code`, `title`, `actions`): `DataTable` lọc cột theo
 * đúng tập hợp này chứ không nhìn cờ `hideable` — thiếu id nào là cột đó biến mất và menu ẩn/hiện
 * cũng không có đường bật lại (menu chỉ liệt kê cột `hideable`).
 *
 * Gói cố ý KHÔNG tự ghi nhớ bố cục: ở SaaS nhiều workspace, bố cục bảng thuộc về cặp
 * (người dùng × workspace) và thường phải đồng bộ giữa các máy.
 */
const DEFAULT_COLUMN_IDS: readonly string[] = [
  "code",
  "title",
  "project",
  "status",
  "priority",
  "assignee",
  "dueDate",
  "updatedAt",
  // "estimate" cố ý KHÔNG có mặt: bảng 10 cột phải cuộn ngang trên laptop, mà giờ ước lượng chỉ
  // vài nhóm dùng tới. Ai cần thì bật lại trong menu "Cột hiển thị" — và đó cũng là cách nhanh
  // nhất để thấy menu ẩn/hiện cột thật sự có tác dụng.
  "actions"
];

/* ────────────────────────────────────────────────────────────────────────────
   Menu hành động của một dòng
   ──────────────────────────────────────────────────────────────────────────── */

/** Một mục trong menu hành động. Nhãn đã dịch sẵn ở nơi gọi — component này không tra chuỗi. */
interface TaskAction {
  id: string;
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  onSelect: (task: TaskView) => void;
}

/**
 * Menu hành động của một việc.
 *
 * VÌ SAO TÁCH RA: đúng menu này xuất hiện ở HAI nơi — ô cột `actions` của `DataTable` (desktop) và
 * thẻ việc ở danh sách dọc (mobile). Viết hai lần thì thêm một hành động phải sửa hai chỗ, và sớm
 * muộn hai chỗ lệch nhau. Nó chỉ *ghép* `DropdownMenu` + `Button` của gói.
 *
 * Nhận `actions` đã LỌC THEO QUYỀN từ nơi gọi, nên nó không biết gì về phân quyền — và mảng rỗng
 * thì không render cái nút nào cả, thay vì mở ra một menu trống.
 */
function TaskActionsMenu({ task, label, actions }: { task: TaskView; label: string; actions: readonly TaskAction[] }) {
  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          // Chặn nổi bọt: bấm nút này không được kích hoạt `onRowClick` (mở chi tiết). `DataTable`
          // chỉ tự chặn giúp ở ô checkbox — control nào app tự đặt vào ô thì app tự chặn. Dùng
          // `stopPropagation` (không phải `preventDefault`) để Radix vẫn mở menu.
          onClick={(event) => event.stopPropagation()}
        >
          <Ellipsis aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      {/* Menu nằm trong portal nên click bên trong không nổi bọt lên dòng. */}
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{task.code}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            {...(action.destructive ? { variant: "destructive" as const } : {})}
            onSelect={() => action.onSelect(task)}
          >
            <action.icon />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Bảng công việc
   ──────────────────────────────────────────────────────────────────────────── */

export function TaskTable({
  tasks,
  projects,
  members,
  defaultPageSize,
  canCreate,
  canEdit,
  canAssign,
  canDelete,
  canExport
}: TaskTableProps) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const tTask = useTranslations("task");
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : "vi";

  const statusConfigs = useTaskStatusConfigs();
  const priorityConfigs = useTaskPriorityConfigs();

  const [filter, setFilter] = useState<TaskFilter>(EMPTY_TASK_FILTER);
  // Mặc định "vừa động vào gần đây nhất lên đầu" — sắp theo hạn chót thì cả trang đầu là việc đã
  // xong từ lâu (hạn cũ nhất), người dùng phải cuộn mới thấy việc đang chạy.
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: "updatedAt", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>([...DEFAULT_COLUMN_IDS]);
  /** Dòng vừa mở chi tiết — làm nổi để người dùng không mất dấu khi đóng panel/quay lại. */
  const [activeId, setActiveId] = useState<string | null>(null);
  /**
   * Việc đang chờ xác nhận xoá — `null` = hộp thoại đóng.
   *
   * Giữ ở TẦNG NÀY chứ không trong từng dòng: một bản `ConfirmDialog` cho cả màn hình thay vì một
   * bản mỗi dòng, và nó sống sót khi dòng bị lọc mất hoặc bảng render lại.
   */
  const [taskToDelete, setTaskToDelete] = useState<TaskView | null>(null);

  /**
   * Chạy một lệnh GHI rồi dựng lại dữ liệu của trang.
   *
   * ⚠ `router.refresh()` chứ KHÔNG sửa state cục bộ. Bảng này nhận `tasks` qua prop từ Server
   * Component; vá tay vào một bản sao ở đây là dựng nguồn sự thật thứ hai, và nó lệch ngay ở
   * những chỗ máy chủ tính lại — `updatedAt`, và nhất là `overdue`, vốn được SUY RA từ `dueDate`
   * so với hôm nay chứ không lưu trong database.
   *
   * `useErrorMessage` nhận `string | ErrorLike`, còn `catch` cho `unknown`: thu hẹp ở đúng một
   * chỗ thay vì ép kiểu rải rác.
   */
  const runWrite = async (work: () => Promise<unknown>, success: string) => {
    try {
      await work();
      toast(success, { variant: "success" });
      router.refresh();
    } catch (error) {
      const like =
        error && typeof error === "object" && "code" in error ? (error as { code?: string; status?: number }) : null;
      toast(errorMessage(like), { variant: "destructive" });
    }
  };

  /**
   * Đổi BẤT KỲ điều kiện lọc nào cũng phải quay về trang 1: đang ở trang 3 mà lọc còn 12 kết quả
   * thì bảng rỗng trơn, người dùng tưởng "không có dữ liệu" chứ không nghĩ là sai trang.
   *
   * (`paginate` cũng tự kẹp trang, nên đây là lớp thứ hai — nhưng nó là lớp người dùng CẢM được:
   * kẹp về trang cuối và quay về trang đầu là hai trải nghiệm khác nhau.)
   */
  const updateFilter = (patch: Partial<TaskFilter>) => {
    setFilter((previous) => ({ ...previous, ...patch }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilter(EMPTY_TASK_FILTER);
    setPage(1);
  };

  /**
   * Chọn/bỏ chọn một việc từ danh sách dọc ở mobile.
   *
   * Desktop dùng `selectable` của `DataTable` (gói tự vẽ ô chọn); mobile không có bảng nên app tự
   * nối vào cùng một `selectedIds` — nhờ vậy dải hành động hàng loạt phía trên hoạt động giống
   * nhau ở cả hai bố cục.
   */
  const toggleRow = (id: string, checked: boolean) =>
    setSelectedIds((previous) =>
      checked ? [...new Set([...previous, id])] : previous.filter((value) => value !== id)
    );

  /* ── Lọc, sắp xếp, phân trang: ba lời gọi vào tầng thuần ──────────────────
     Chặng đầu bỏ QUA điều kiện trạng thái. Số đếm trên chip trạng thái lấy từ chặng này, nên chip
     vẫn cho biết "bấm vào sẽ được bao nhiêu việc" thay vì tự đếm chính mình rồi tụt về 0 ở mọi
     chip không được chọn. */
  const tasksBeforeStatusFilter = useMemo(
    () => filterTasks(tasks, { ...filter, statuses: EMPTY_TASK_FILTER.statuses }),
    [tasks, filter]
  );

  /* Chặng đủ — vẫn là CÙNG một hàm thuần, không phải một vòng `filter` viết tay ở đây: chép lại
     dù chỉ một vị từ là dựng bản thứ hai của quy tắc "mảng rỗng = không lọc theo trường này". */
  const filteredTasks = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

  const sortedTasks = useMemo(() => {
    if (!sort) return filteredTasks;
    const key = toTaskSortKey(sort.columnId);
    if (!key) return filteredTasks;
    return sortTasks(filteredTasks, key, sort.direction, SORT_ORDER);
  }, [filteredTasks, sort]);

  const pageResult = paginate(sortedTasks, page, pageSize);

  /*
   * BA trạng thái, không phải hai. "Chưa giao" là một LỜI MỜI người khác nhận việc — nói câu đó về
   * một việc đã có chủ (mà danh bạ chỉ đang không tra ra tên) là làm hai người cùng nhận, hoặc làm
   * việc đó rơi. Xem `TaskView.assigneeUnknown`.
   */
  const assigneeLabel = (task: TaskView) =>
    task.assigneeName ?? (task.assigneeUnknown ? tCommon("formerMember") : tCommon("unassigned"));
  const statusLabel = (task: TaskView) =>
    statusConfigs.find((config) => config.value === task.status)?.label ?? task.status;
  const priorityLabel = (task: TaskView) =>
    priorityConfigs.find((config) => config.value === task.priority)?.label ?? task.priority;

  /**
   * Xuất CSV chạy THẬT — không cần backend vì mọi dòng đã nằm sẵn ở client.
   *
   * Xuất `sortedTasks`: đúng tập ĐANG LỌC VÀ ĐANG SẮP mà người dùng đang nhìn, không phải `tasks`
   * gốc — người bấm nút vừa lọc xong và muốn mang chính kết quả đó đi.
   *
   * ⚠ `toCsv` đã tự thoát TỪNG ô qua `escapeCsvCell` (chống công thức, bọc theo RFC 4180) và đã tự
   * ghi BOM. Gọi `escapeCsvCell` thêm một lần ở đây là thoát HAI lần — hàm đó cố ý không idempotent
   * (`a,b` → `"a,b"` → `"""a,b"""` là một ô hợp lệ mang nội dung khác).
   *
   * Phần `Blob` + thẻ `<a download>` là DOM nên nó ở ĐÂY, không ở `lib/core/` (tầng thuần).
   */
  function handleExportCsv() {
    const csv = toCsv([
      [
        tTask("field.code"),
        tTask("field.title"),
        tTask("field.project"),
        tTask("field.assignee"),
        tTask("field.status"),
        tTask("field.priority"),
        tTask("field.dueDate")
      ],
      ...sortedTasks.map((task) => [
        task.code,
        task.title,
        task.projectName,
        assigneeLabel(task),
        statusLabel(task),
        priorityLabel(task),
        formatIsoDateFor(locale, task.dueDate)
      ])
    ]);

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = t("exportFileName");
    link.click();
    URL.revokeObjectURL(url);
  }

  const openTask = (task: TaskView) => {
    setActiveId(task.id);
    router.push(`/tasks/${encodeURIComponent(task.id)}`);
  };

  /**
   * Hành động của một dòng, đã LỌC THEO QUYỀN.
   *
   * ⚠ Vị từ đến từ `page.tsx` (tầng server) — file này không gọi `can()`. Và ẩn một mục menu không
   * phải là phân quyền: chốt thật nằm ở máy chủ, đọc cùng ma trận đó.
   */
  const rowActions: TaskAction[] = [
    /*
     * "Sửa" và "Giao việc" mở TRANG CHI TIẾT chứ không mở một hộp thoại sửa tại chỗ: biểu mẫu sửa
     * đầy đủ là một màn hình, và dựng nó hai lần (một trong bảng, một ở trang chi tiết) là hai bản
     * sẽ lệch. "Hoàn thành" thì khác — nó là MỘT trường, nên nó ghi thẳng từ đây.
     */
    ...(canEdit ? [{ id: "edit", label: t("action.edit"), icon: SquarePen, onSelect: openTask }] : []),
    ...(canAssign ? [{ id: "assign", label: t("action.assign"), icon: UserRoundPen, onSelect: openTask }] : []),
    ...(canEdit
      ? [
          {
            id: "complete",
            label: t("action.complete"),
            icon: CircleCheckBig,
            onSelect: (task: TaskView) =>
              void runWrite(() => updateTask(task.id, { status: "done" }), t("toast.completed", { code: task.code }))
          }
        ]
      : []),
    ...(canDelete
      ? [
          {
            id: "delete",
            label: t("action.delete"),
            icon: Trash2,
            destructive: true,
            /*
             * Chỉ MỞ hộp thoại ở component cha, không tự xoá và cũng không lồng `ConfirmDialog` vào
             * mục menu: Radix đóng `DropdownMenu` và tháo nó khỏi DOM ngay khi một mục được chọn,
             * xảy ra TRƯỚC khi `AlertDialog` bên trong kịp mở — hộp xác nhận biến mất theo menu chứ
             * không hiện ra.
             */
            onSelect: (task: TaskView) => setTaskToDelete(task)
          }
        ]
      : [])
  ];

  /**
   * HAI câu rỗng, không phải một.
   *
   * "Chưa có việc nào" (dữ liệu thật sự rỗng) và "lọc không ra kết quả" là hai tình huống khác nhau
   * và cần hai hành động khác nhau: một cái mời tạo việc đầu tiên, một cái mời xoá bộ lọc. Dùng
   * chung một câu thì người mở trang lần đầu — đúng lúc app còn trống — bị bảo đi xoá một bộ lọc họ
   * chưa hề đặt. Điều kiện phân nhánh là ĐỘ DÀI TRƯỚC KHI LỌC (`tasks`), không phải sau.
   *
   * Một hàm chứ không hai lời gọi rời: hai nhánh bố cục (bảng ở desktop, danh sách thẻ ở mobile)
   * khác nhau đúng một prop `bordered`, và trước đây chúng là hai khối chép tay nên đã lệch sẵn.
   */
  const renderEmptyState = ({ bordered }: { bordered?: boolean }) =>
    tasks.length === 0 ? (
      <EmptyState
        bordered={bordered}
        icon={ClipboardList}
        title={t("empty.title")}
        description={t("empty.description")}
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/tasks/new">{t("empty.action")}</Link>
            </Button>
          ) : null
        }
      />
    ) : (
      <EmptyState
        bordered={bordered}
        icon={SearchX}
        title={t("empty.filteredTitle")}
        description={t("empty.filteredDescription")}
        action={
          <Button variant="outline" onClick={clearFilters}>
            {t("empty.filteredAction")}
          </Button>
        }
      />
    );

  /* ── Chip trạng thái ────────────────────────────────────────────────────── */
  const statusChips: FilterChipItem<TaskStatus>[] = useMemo(() => {
    const counts = new Map<TaskStatus, number>();
    for (const task of tasksBeforeStatusFilter) counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
    // Sắp theo `priority` của `StatusConfig`, không theo thứ tự khai báo: "Quá hạn" (priority 0)
    // phải là chip đầu tiên.
    return sortByStatusPriority(statusConfigs).map((config) => ({
      value: config.value,
      label: config.label,
      count: counts.get(config.value) ?? 0,
      // `StatusConfig` đã có sẵn 3 lớp màu của `StatusTone` → truyền thẳng, không khai lại màu.
      tone: config
    }));
  }, [statusConfigs, tasksBeforeStatusFilter]);

  /* ── Cột ────────────────────────────────────────────────────────────────── */
  const columns: DataTableColumn<TaskView>[] = [
    {
      id: "code",
      header: tTask("field.code"),
      width: 96,
      // Ghim trái để mã việc luôn nhìn thấy khi cuộn ngang; cột ghim BẮT BUỘC có `width` vì offset
      // sticky được cộng dồn từ giá trị đó.
      pinned: "left",
      hideable: false,
      sortable: true,
      cell: (task) => <span className="tabular-nums text-muted-foreground">{task.code}</span>
    },
    {
      id: "title",
      header: tTask("field.title"),
      minWidth: 280,
      hideable: false,
      sortable: true,
      // Cắt bằng `max-w` + `truncate` (kèm `title` để rê chuột đọc đủ): bảng dùng `table-layout:
      // auto` nên một tên việc dài sẽ kéo giãn cả cột và đẩy các cột sau ra khỏi màn hình.
      cell: (task) => (
        <span title={task.title} className="block max-w-[26rem] truncate font-medium text-foreground">
          {task.title}
        </span>
      )
    },
    {
      id: "project",
      header: tTask("field.project"),
      width: 180,
      cell: (task) => (
        <span className="flex min-w-0 items-center gap-2">
          {/* `aria-hidden`: `LetterAvatar` luôn kèm sẵn tên ở dạng `sr-only` (để dùng một mình vẫn
              có nghĩa), nên đặt cạnh tên hiện hình là trình đọc màn hình đọc tên hai lần. */}
          <LetterAvatar name={task.projectName} size="xs" square aria-hidden />
          <span className="truncate">{task.projectName}</span>
        </span>
      )
    },
    {
      id: "status",
      header: tTask("field.status"),
      width: 140,
      sortable: true,
      cell: (task) => <StatusPill configs={statusConfigs} value={task.status} />
    },
    {
      id: "priority",
      header: tTask("field.priority"),
      width: 140,
      sortable: true,
      // Biến thể "dot": chấm màu + chữ thường, để hai cột chip cạnh nhau không thành hai mảng màu
      // chọi nhau.
      cell: (task) => <StatusPill configs={priorityConfigs} value={task.priority} variant="dot" />
    },
    {
      id: "assignee",
      header: tTask("field.assignee"),
      width: 200,
      cell: (task) => (
        <span className="flex min-w-0 items-center gap-2">
          <LetterAvatar name={assigneeLabel(task)} src={task.assigneeAvatarUrl} size="sm" aria-hidden />
          <span className="truncate">{assigneeLabel(task)}</span>
        </span>
      )
    },
    {
      id: "dueDate",
      header: tTask("field.dueDate"),
      width: 130,
      sortable: true,
      cell: (task) => (
        <span
          className={
            // Bậc `-ink` là màu dùng khi chữ đứng trên NỀN TRANG; `text-destructive` là token tô
            // nền, đặt làm màu chữ là hỏng tương phản ở chế độ sáng.
            task.status === "overdue" ? "font-medium tabular-nums text-destructive-ink" : "tabular-nums"
          }
        >
          {formatIsoDateFor(locale, task.dueDate)}
        </span>
      )
    },
    {
      id: "updatedAt",
      header: tTask("field.updatedAt"),
      width: 140,
      sortable: true,
      /*
       * KHÔNG truyền `now`: dữ liệu đến từ database và được seed dời theo ngày chạy, nên đồng hồ
       * THẬT là mốc đúng. (`now` chỉ dành cho dữ liệu đứng yên — bản mẫu, ảnh chụp, test.)
       *
       * `locale` thì BẮT BUỘC truyền: bỏ trống là giao diện tiếng Anh vẫn hiện "3 phút trước".
       */
      cell: (task) => (
        <RelativeTime value={task.updatedAt} locale={DATE_FNS_LOCALES[locale]} className="text-muted-foreground" />
      )
    },
    {
      id: "estimate",
      header: tTask("field.estimate"),
      width: 120,
      align: "right",
      /*
       * Đơn vị lưu là PHÚT (số nguyên); phép đổi sang giờ chỉ xảy ra ở tầng hiển thị, và đơn vị đi
       * kèm là một khoá dịch chứ không phải chữ "giờ" chôn trong chuỗi.
       */
      cell: (task) => (
        <span className="tabular-nums">{formatMinutesFor(locale, task.estimateMinutes, tTask("hourUnit"))}</span>
      )
    }
  ];

  if (rowActions.length > 0) {
    columns.push({
      id: "actions",
      // Cột chỉ chứa nút: tiêu đề rỗng về mặt thị giác nhưng vẫn phải có tên cho trình đọc màn hình.
      header: <span className="sr-only">{t("column.actions")}</span>,
      label: t("column.actions"),
      width: 56,
      align: "center",
      pinned: "right",
      hideable: false,
      cell: (task) => <TaskActionsMenu task={task} label={t("row.actions", { code: task.code })} actions={rowActions} />
    });
  }

  const unitLabel = tTask("unit");

  return (
    /*
     * ── VÌ SAO KHUNG TRANG NẰM Ở ĐÂY, KHÔNG Ở `page.tsx` ────────────────────────────────
     * Vì nút "Xuất danh sách" phải xuất ĐÚNG TẬP ĐANG LỌC (`sortedTasks`), mà `filter` và `sort`
     * là hai `useState` của chính file này. `page.tsx` là Server Component nên không đọc được
     * chúng, và một đảo client ANH EM đặt vào `actions` cũng không: nó chỉ thấy `tasks` gốc, tức
     * sẽ xuất cả những dòng người dùng vừa lọc bỏ — đúng thứ AGENTS.md cấm.
     *
     * Nối hai nhánh bằng context/store thì rơi vào điều kiện 2 của `docs/kien-truc-ung-dung.md`
     * §3 tầng 3 ("hai nhánh cây React xa nhau cùng đọc và cùng ghi"), tức phải dựng store — thứ
     * repo cố ý chưa có. AGENTS.md §"Thêm một trang mới" bước 2 đã chốt lối đi: kéo `PageHeader`
     * vào chính đảo client này.
     *
     * ⚠ `PageContainer` phải theo xuống CÙNG, và cả hai phải nằm trong một Fragment. Fragment
     * không sinh DOM nên cây render giống hệt bản cũ — để `PageHeader` bên trong `PageContainer`
     * thì nó ăn thêm `px-4 md:px-6` (đường kẻ dưới thôi chạy hết bề ngang) và bị `py-4 md:py-6`
     * đẩy xuống, nên `sticky top-0` không còn dính sát đỉnh.
     */
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            {/*
             * "Xuất danh sách" đứng cạnh "Việc mới" vì cả hai là HÀNH ĐỘNG của trang. Trước đây nó
             * nằm trong `actions` của `SearchFilterBar` — mà thanh đó `flex-wrap` và đẩy `ml-auto`,
             * nên ở bề rộng trung gian hai nút rơi xuống một dòng riêng rồi bị đẩy sang phải: hai
             * control lơ lửng bên phải một dòng trống.
             */}
            {canExport ? (
              <Button
                variant="outline"
                leftIcon={<Download className="size-4" />}
                disabled={sortedTasks.length === 0}
                onClick={handleExportCsv}
              >
                {t("action.export")}
              </Button>
            ) : null}
            {canCreate ? (
              /*
               * `asChild` bỏ qua `leftIcon`/`rightIcon` (Radix Slot chỉ nhận đúng một phần tử con)
               * → icon phải nằm bên trong `<Link>`.
               */
              <Button asChild>
                <Link href="/tasks/new">
                  <Plus className="size-4" aria-hidden="true" />
                  {t("newTask")}
                </Link>
              </Button>
            ) : null}
          </div>
        }
        sticky
      />

      {/* `width="full"`: bảng nhiều cột cần hết bề ngang, không kẹp vào khung chữ như trang văn bản. */}
      <PageContainer width="full">
        <div className="flex flex-col gap-4">
          <SearchFilterBar
            searchValue={filter.search}
            onSearchChange={(search) => updateFilter({ search })}
            searchPlaceholder={t("searchPlaceholder")}
            // Dữ liệu nằm sẵn trong bộ nhớ nên lọc ngay từng phím gõ. App gọi API thì để mặc định
            // (250ms) hoặc cao hơn — mỗi phím gõ là một request.
            debounceMs={0}
            // Đếm NHÓM, không đếm giá trị: con số phải khớp với số điều kiện người dùng cần gỡ để thấy
            // lại bảng đầy đủ. Phép đếm ở tầng thuần, cùng chỗ với phép lọc.
            activeFilterCount={countActiveFilters(filter)}
            onClearFilters={clearFilters}
            resultCount={sortedTasks.length}
            total={tasks.length}
            unitLabel={unitLabel}
            labels={SEARCH_FILTER_BAR_LABELS[locale]}
          >
            {/* Combobox tự trải rộng `w-full` để dùng được trong biểu mẫu một cột; trên thanh lọc phải
            bọc bằng lớp có bề rộng cố định, nếu không nó chiếm trọn hàng. */}
            <div className="w-full sm:w-48">
              <Combobox
                options={projects.map((project) => ({ value: project.id, label: project.name }))}
                /* Tầng thuần dùng MẢNG cho mọi bộ lọc (mảng rỗng = không lọc); ô này chỉ chọn một, nên
               phép đổi hình nằm gọn ở hai dòng dưới đây thay vì rải vào tầng lọc. */
                value={filter.projectIds[0] ?? null}
                onValueChange={(value) => updateFilter({ projectIds: value === null ? [] : [value] })}
                placeholder={t("filter.project")}
                searchPlaceholder={t("filter.projectSearch")}
                emptyText={t("filter.projectEmpty")}
                clearable
                clearLabel={tCommon("clearSelection")}
                aria-label={t("filter.projectLabel")}
              />
            </div>
            <div className="w-full sm:w-44">
              <Combobox
                options={priorityConfigs.map((config) => ({ value: config.value, label: config.label }))}
                value={filter.priorities[0] ?? null}
                /* Lọc lại từ `priorityConfigs` thay vì ép kiểu chuỗi trả về: `config.value` đã là
               `TaskPriority`, nên phép thu hẹp kiểu là thật chứ không phải một lời hứa với `tsc`. */
                onValueChange={(value) =>
                  updateFilter({
                    priorities: priorityConfigs.filter((config) => config.value === value).map((config) => config.value)
                  })
                }
                placeholder={t("filter.priority")}
                searchPlaceholder={t("filter.prioritySearch")}
                emptyText={t("filter.priorityEmpty")}
                clearable
                clearLabel={tCommon("clearSelection")}
                aria-label={t("filter.priorityLabel")}
              />
            </div>
            <div className="w-full sm:w-56">
              <MultiCombobox
                options={members.map((member) => ({ value: member.id, label: member.name }))}
                value={[...filter.assigneeUserIds]}
                onValueChange={(assigneeUserIds) => updateFilter({ assigneeUserIds })}
                placeholder={t("filter.assignee")}
                searchPlaceholder={t("filter.assigneeSearch")}
                emptyText={t("filter.assigneeEmpty")}
                aria-label={t("filter.assigneeLabel")}
                /*
                 * ⚠ Nhãn RỜI của gói mặc định là TIẾNG VIỆT. Không truyền thì giao diện tiếng Anh hiện
                 * "Đã chọn 2/8" — xem bảng ở đầu `lib/i18n/ui-labels.tsx`.
                 */
                selectedCountLabel={(selected, max) => t("filter.assigneeSelected", { selected, max })}
              />
            </div>
          </SearchFilterBar>

          {/*
           * ── Hàng lọc trạng thái, và nút cột nằm cuối hàng ──────────────────────────────────
           *
           * Wrapper là của APP, không phải của gói: `FilterChips` không có slot trailing, và root của
           * nó là `role="group" aria-label="Lọc theo trạng thái"` — nhét nút cột vào trong là gán nó
           * vào đúng cái nhóm ấy trong cây trợ năng, tức nói sai với người dùng đọc màn hình.
           *
           * ⚠ Wrapper KHÔNG `flex-wrap` và dùng `items-start`, cả hai đều có lý do đo được: ở 375px
           * sáu chip (5 trạng thái + "Tất cả", mỗi chip kèm số đếm) tràn 2–3 dòng. Nếu cùng container
           * wrap thì auto-margin của flexbox phân giải THEO TỪNG DÒNG, nên nút rơi xuống dòng chip
           * cuối — lơ lửng giữa các chip, đúng cảm giác đang muốn chữa. Còn `items-center` sẽ canh nút
           * theo giữa cả khối chip nhiều dòng thay vì thẳng hàng chip đầu.
           */}
          <div className="flex items-start gap-2">
            <FilterChips
              className="min-w-0 flex-1"
              items={statusChips}
              value={[...filter.statuses]}
              // Chọn nhiều nên `onValueChange` vẫn khai kiểu hợp `T[] | T | null`; chuẩn hoá về mảng ngay
              // tại đây để phần còn lại của trang chỉ làm việc với một kiểu.
              onValueChange={(next) => updateFilter({ statuses: Array.isArray(next) ? next : next ? [next] : [] })}
              multiple
              showAll
              allLabel={t("filter.statusAll")}
              allCount={tasksBeforeStatusFilter.length}
              label={t("filter.statusLabel")}
            />

            {/*
             * Ẩn dưới `md`: ở mobile bảng được thay bằng danh sách thẻ, và nhánh thẻ KHÔNG đọc
             * `visibleColumnIds` một lần nào — một nút bấm được mà không đổi gì trên màn hình là giao
             * diện nói dối, cùng lớp lỗi mà `ReadOnlyFieldset` ở `/settings` được dựng để chặn.
             *
             * ⚠ `className` truyền THẲNG vào component của gói. Bản trước bọc bằng `<span>` kèm chú
             * thích "component của gói không nhận `className`" — SAI: `DataTableColumnToggle` khai
             * `className?: string` và forward thẳng vào `<Button>` bên trong. Một chú thích sai kiểu
             * đó là hàng rào giả: người đọc sau sẽ kết luận "không tạo hình được, phải tự dựng lại".
             *
             * `rounded-full` là thay đổi HÌNH DẠNG, không phải màu — luật số 1 của repo chỉ cấm app
             * sở hữu MÀU. Cố ý KHÔNG đắp thêm năm class nữa để giả cho giống hệt chip (cỡ chữ, chiều
             * cao, nền, màu chữ, hover): đó là chép style của gói ra chỗ thứ hai, và nó sẽ lệch ở lần
             * gói sửa tiếp theo. Viền của nút và của chip vốn cùng bậc `--control-edge` nên hai thứ
             * đứng cạnh nhau đã hợp tông.
             */}
            <DataTableColumnToggle
              className="hidden shrink-0 rounded-full md:inline-flex"
              columns={columns}
              visibleColumnIds={visibleColumnIds}
              onVisibleColumnIdsChange={setVisibleColumnIds}
              labels={DATA_TABLE_LABELS[locale]}
            />
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
              {/*
               * Số đã chọn và nút bỏ chọn đứng CẠNH NHAU ở góc trái, tách khỏi nhóm hành động bên
               * phải. Trước đây "Bỏ chọn" là phần tử cuối của nhóm ấy, nên khi dải wrap (mobile,
               * hoặc khi tên người trong ô giao việc dài) nó rơi xuống một dòng RIÊNG và nằm trơ
               * một mình dưới đáy thẻ.
               *
               * Nó thuộc về chỗ này về nghĩa, không chỉ về chỗ trống: "3 đã chọn" và "bỏ chọn" nói
               * về cùng một thứ — TẬP ĐANG CHỌN. "Hoàn thành"/"Giao"/"Xoá" thì nói về việc LÀM GÌ
               * với tập đó.
               *
               * ⚠ Nút để NGOÀI `role="status"`: vùng đó là live region, nhét nút vào là mỗi lần số
               * đếm đổi, trình đọc màn hình lại đọc kèm cả nhãn nút.
               */}
              <div className="flex items-center gap-3">
                <span role="status" className="text-sm font-medium">
                  {t("bulk.selected", { count: selectedIds.length })}
                </span>
                {/*
                  ⚠ `hover:bg-background`, đè lên hover mặc định của `variant="ghost"`.
                  Ghost của gói dùng `hover:bg-muted` — hợp lý khi nút đứng trên `--background`
                  hoặc `--card`, nhưng dải này CHÍNH LÀ `bg-muted`, nên hover tô đúng cái màu đang
                  có: đổi 0. Đo được tỉ lệ 1.000, tức không phân biệt được.
                  `--accent` và `--secondary` KHÔNG dùng được: ở dark cả hai bằng đúng `--muted`
                  (1.000), nên chọn chúng là sửa được sáng và để chết tối — kiểu nửa vời đi lọt một
                  vòng xem chỉ-sáng. `--background` chênh ở CẢ HAI: 1,071 sáng · 1,174 tối.
                */}
                <Button variant="ghost" size="sm" className="hover:bg-background" onClick={() => setSelectedIds([])}>
                  {t("bulk.clear")}
                </Button>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {canEdit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<CircleCheckBig className="size-4" />}
                    onClick={() =>
                      void runWrite(
                        async () => {
                          /*
                           * ⚠ Tuần tự, KHÔNG `Promise.all`. Mỗi lệnh là một request có chốt quyền và một
                           * lần ghi nhật ký riêng; bắn 20 cái cùng lúc là tự tạo một đợt tải đúng vào
                           * database của mình, và khi một cái hỏng thì không nói được cái nào.
                           *
                           * Đây là chỗ một module thật sẽ cần `PATCH /api/tasks` nhận nhiều id — nhưng
                           * đó là một endpoint khác, với ngữ nghĩa lỗi một-phần riêng của nó.
                           */
                          for (const id of selectedIds) await updateTask(id, { status: "done" });
                          setSelectedIds([]);
                        },
                        t("toast.completedMany", { count: selectedIds.length })
                      )
                    }
                  >
                    {t("action.complete")}
                  </Button>
                ) : null}
                {canAssign ? (
                  /*
                   * Giao hàng loạt là một ô CHỌN, không phải một cái nút: hành động này cần một tham
                   * số (giao cho ai), và một cái nút mở hộp thoại chỉ để hỏi đúng một câu là thêm một
                   * lớp cho không thêm gì. Chọn xong là chạy luôn.
                   *
                   * ⚠ Bề rộng đặt ở THẺ BỌC NGOÀI, không truyền `className` vào `<Combobox>` — xem
                   * lý do đã đo ở `[taskId]/task-detail-actions.tsx`.
                   */
                  <div className="w-48">
                    <Combobox
                      options={members.map((member) => ({ value: member.id, label: member.name }))}
                      value={null}
                      onValueChange={(assigneeUserId) => {
                        if (!assigneeUserId) return;
                        const ids = [...selectedIds];
                        void runWrite(
                          async () => {
                            for (const id of ids) await updateTask(id, { assigneeUserId });
                            setSelectedIds([]);
                          },
                          t("toast.assignedMany", { count: ids.length })
                        );
                      }}
                      placeholder={t("action.assign")}
                      searchPlaceholder={t("filter.assigneeSearch")}
                      emptyText={t("filter.assigneeEmpty")}
                      aria-label={t("action.assign")}
                    />
                  </div>
                ) : null}
                {canDelete ? (
                  /* Hành động không hoàn tác được thì hỏi lại — và hỏi bằng đúng một component để mọi
                 app của hệ sinh thái hỏi giống nhau. Dải này KHÔNG nằm trong một `DropdownMenu` nên
                 dạng `trigger` dùng được; hộp thoại của từng dòng thì phải controlled (xem dưới). */
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm" leftIcon={<Trash2 className="size-4" />}>
                        {tCommon("delete")}
                      </Button>
                    }
                    title={t("bulk.deleteTitle", { count: selectedIds.length })}
                    description={t("bulk.deleteDescription")}
                    variant="destructive"
                    confirmLabel={t("action.delete")}
                    cancelLabel={tCommon("cancel")}
                    onConfirm={() =>
                      runWrite(
                        async () => {
                          for (const id of selectedIds) await deleteTask(id);
                          setSelectedIds([]);
                        },
                        t("toast.deletedMany", { count: selectedIds.length })
                      )
                    }
                  />
                ) : null}
              </div>
            </div>
          )}

          {/*
           * ── Mobile: danh sách dọc thay cho bảng ──────────────────────────────────
           *
           * VÌ SAO CÓ HAI BỐ CỤC: bảng này rộng 1200px và có 9 cột. Nhồi vào màn 375px thì người dùng
           * chỉ thấy được cột `code` cùng một mẩu tên việc bị cắt giữa từ, còn trạng thái/hạn chót —
           * đúng những thứ người ta mở danh sách để xem — nằm ngoài màn hình sau hai lần cuộn ngang.
           *
           * Nên dưới `md` bảng được thay bằng danh sách thẻ dọc. Đây KHÔNG phải component mới — nó ghép
           * `ItemGroup` + `Item` của gói, cùng bộ `StatusPill`/`LetterAvatar` mà bảng đang dùng, nên hai
           * bố cục nói cùng một ngôn ngữ thị giác.
           *
           * Cả hai nhánh đọc CÙNG `pageResult.items`, `selectedIds`, `sort` — không nhân bản state, nên
           * lọc/phân trang/chọn hàng loạt hoạt động y hệt ở hai bề rộng.
           */}
          <div className="md:hidden">
            {pageResult.items.length === 0 ? (
              renderEmptyState({ bordered: true })
            ) : (
              <ItemGroup className="gap-2">
                {pageResult.items.map((task) => {
                  const selected = selectedIds.includes(task.id);

                  return (
                    <Item key={task.id} variant="outline" className="items-start gap-3">
                      <ItemMedia>
                        {/*
                         * VÙNG CHẠM MỞ RỘNG BẰNG LỚP PHỦ, KHÔNG BẰNG HỘP TRONG BỐ CỤC.
                         *
                         * Bản trước bọc ô chọn trong `size-11` để đủ lớn cho ngón tay. Vùng chạm thì
                         * đúng, nhưng nó chiếm chỗ THẬT: đo ở 375px, một ô 16px ăn 44px bề ngang, và
                         * chữ bắt đầu cách mép thẻ 73px (16 padding + 44 ô + 12 gap) — tức 28px trống
                         * quanh ô chọn, chồng lên padding và gap mà `<Item>` vốn đã có.
                         *
                         * `after:-inset-3` cho vùng bấm 40×40 mà KHÔNG tốn một pixel bố cục nào: phần
                         * tử giả nằm ngoài luồng, chỉ nhận sự kiện chuột. 12px mở sang phải đúng bằng
                         * `gap-3` của thẻ, nên nó chạm mép nút tiêu đề chứ không đè lên — đè thì nó
                         * nuốt mất những cú bấm vào tiêu đề, và đó là lỗi không ai nghĩ tới khi nhìn
                         * màn hình.
                         *
                         * 40×40 vượt xa ngưỡng 24×24 của WCAG 2.5.8 (AA), thấp hơn 44×44 của 2.5.5
                         * (AAA) 4px — đánh đổi có ý thức: nút tiêu đề ngay cạnh đã là vùng chạm cao
                         * 44px và là đích CHÍNH của thẻ.
                         */}
                        <span className="flex items-center justify-center">
                          <Checkbox
                            className="relative after:absolute after:-inset-3 after:content-['']"
                            checked={selected}
                            onCheckedChange={(value) => toggleRow(task.id, value === true)}
                            aria-label={
                              selected ? t("row.deselect", { code: task.code }) : t("row.select", { code: task.code })
                            }
                          />
                        </span>
                      </ItemMedia>

                      <ItemContent className="min-w-0 gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground tabular-nums">{task.code}</span>
                          {/* KHÔNG dùng nhãn rút gọn ở đây: thẻ có đủ chỗ cho nhãn đầy đủ, mà bản viết
                          tắt ("ĐL", "CD") thì người mới vào không đoán ra nghĩa. */}
                          <StatusPill configs={statusConfigs} value={task.status} />
                          <StatusPill configs={priorityConfigs} value={task.priority} variant="dot" />
                        </div>

                        <ItemTitle className="w-full min-w-0">
                          {/*
                           * Chỗ mở việc là một <button> thật, không phải `onClick` đặt lên cả thẻ: div
                           * bấm được thì bàn phím không tới được và trình đọc màn hình không biết nó
                           * bấm được. `text-left` vì <button> mặc định căn giữa.
                           */}
                          <button
                            type="button"
                            className="min-h-11 w-full text-left font-medium text-foreground"
                            onClick={() => openTask(task)}
                          >
                            <span className="line-clamp-2">{task.title}</span>
                          </button>
                        </ItemTitle>

                        {/* Không dùng `ItemDescription`: nó render ra <p>, mà avatar là <div> — <div>
                        lồng trong <p> là HTML không hợp lệ, trình duyệt sẽ tự tách thẻ. */}
                        {/* Xếp DỌC, không phải `flex-wrap` + dấu `·`: ở 375px hai tên gần như luôn phải
                        xuống dòng, và khi đó dấu phân cách bị đẩy ra cuối dòng trên — trông như một
                        dấu chấm lạc. Xếp dọc thì không cần dấu phân cách nào. */}
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <LetterAvatar name={task.projectName} size="xs" square aria-hidden />
                            <span className="truncate">{task.projectName}</span>
                          </span>
                          <span className="flex min-w-0 items-center gap-1.5">
                            <LetterAvatar
                              name={assigneeLabel(task)}
                              src={task.assigneeAvatarUrl}
                              size="xs"
                              aria-hidden
                            />
                            <span className="truncate">{assigneeLabel(task)}</span>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span
                            className={
                              // Cùng quy tắc với cột "Hạn chót" của bảng: bậc `-ink` là màu chữ trên nền
                              // trang, `text-destructive` là token tô nền.
                              task.status === "overdue"
                                ? "font-medium text-destructive-ink tabular-nums"
                                : "tabular-nums"
                            }
                          >
                            {t("row.due", { date: formatIsoDateFor(locale, task.dueDate) })}
                          </span>
                          <span aria-hidden="true">·</span>
                          <RelativeTime value={task.updatedAt} locale={DATE_FNS_LOCALES[locale]} />
                        </div>
                      </ItemContent>

                      <ItemActions>
                        <TaskActionsMenu
                          task={task}
                          label={t("row.actions", { code: task.code })}
                          actions={rowActions}
                        />
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            )}
          </div>

          {/* ── Desktop: bảng đầy đủ ── */}
          <DataTable
            // `containerClassName` (khung cuộn bọc ngoài), KHÔNG phải `className` (thẻ <table>): ẩn
            // riêng cái bảng thì khung viền + nền vẫn render, để lại một hộp rỗng cao 0 trên mobile.
            containerClassName="hidden md:block"
            aria-label={t("tableLabel")}
            columns={columns}
            rows={pageResult.items}
            getRowId={(task) => task.id}
            minWidth={1200}
            // Sọc xen kẽ — đúng mẫu DataTable ở mục Patterns của comitor-ds. Bảng này dài (20 dòng/trang)
            // và rộng 1200px nên sọc giúp dò hàng khi cuộn ngang.
            striped
            sort={sort}
            onSortChange={setSort}
            selectable
            selectedIds={selectedIds}
            // Tập chọn giữ theo id nên vẫn còn khi sang trang khác — ô chọn ở đầu bảng chỉ thao tác trên
            // các dòng ĐANG hiển thị, đúng như người dùng nhìn thấy.
            onSelectedIdsChange={setSelectedIds}
            visibleColumnIds={visibleColumnIds}
            onRowClick={openTask}
            /*
             * Dòng đang mở dùng thẳng prop `isRowActive` của gói — gói đánh dấu bằng `outline`.
             *
             * ⚠ Đừng "cải tiến" thành một lớp NỀN: mọi lớp nền trạng thái của `DataTable` đều có alpha,
             * và qua `cn()` cùng `bg-card` thì tailwind-merge BỎ `bg-card`, khiến ô cột ghim
             * (`bg-inherit`) gần như trong suốt và để lộ nội dung đang cuộn bên dưới.
             */
            isRowActive={(task) => task.id === activeId}
            labels={DATA_TABLE_LABELS[locale]}
            empty={renderEmptyState({})}
          />

          <TablePagination
            // Trang ĐÃ KẸP do `paginate` trả về, không phải `page` thô: kết quả tụt xuống dưới trang
            // đang đứng thì thanh phân trang phải nói đúng trang mà bảng đang hiển thị.
            page={pageResult.page}
            pageSize={pageSize}
            total={sortedTasks.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            unitLabel={unitLabel}
            labels={TABLE_PAGINATION_LABELS[locale]}
          />

          {/* Dạng CONTROLLED, đặt ngoài mọi `DropdownMenu` — xem lý do ở `rowActions`. */}
          {taskToDelete ? (
            <ConfirmDialog
              open={taskToDelete !== null}
              onOpenChange={(open) => {
                if (!open) setTaskToDelete(null);
              }}
              title={t("delete.title", { code: taskToDelete.code })}
              description={t("delete.description", { title: taskToDelete.title })}
              icon={Trash2}
              variant="destructive"
              confirmLabel={t("action.delete")}
              cancelLabel={tCommon("cancel")}
              onConfirm={async () => {
                const target = taskToDelete;
                await runWrite(() => deleteTask(target.id), t("toast.deleted", { code: target.code }));
                setTaskToDelete(null);
              }}
            />
          ) : null}
        </div>
      </PageContainer>
    </>
  );
}
