"use client";

import {
  CommandPalette,
  type CommandPaletteGroup,
  type CommandPaletteItem,
  getStatusConfig,
  getStatusLabel,
  matchesSearch
} from "@comitor/ui";
import { useShell } from "@comitor/ui/shell";
import { ListChecks, MoonStar, SunMedium, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { useTaskStatusConfigs } from "@/hooks/use-catalog";
import type { TaskStatus } from "@/lib/contracts/task";

/**
 * Bảng lệnh (⌘/Ctrl + K) của module.
 *
 * VÌ SAO FILE NÀY NẰM TRONG `components/`: nó không thuộc về một route nào cả — nó là một mảnh của
 * KHUNG app, dùng ở `app/(shell)/shell-frame.tsx` và sống trên mọi trang. Những cụm gắn với đúng
 * một màn hình (`task-table.tsx`, `settings-tabs-nav.tsx`…) thì nằm cạnh route.
 *
 * VÌ SAO NÓ TỒN TẠI: `<AppShell>` KHÔNG tự vẽ bảng lệnh. Header của gói luôn hiện ô tìm kiếm kèm
 * gợi ý phím ⌘K, và shell bắt sẵn phím đó để lật cờ `commandPaletteOpen` — nhưng nội dung tìm
 * kiếm là dữ liệu của app (trang nào, lệnh nào, việc nào) nên gói chỉ chừa một slot:
 * `<AppShell commandPaletteSlot={…}>`. Không truyền slot thì ô tìm kiếm và phím ⌘K trên header
 * trở thành control chết — bấm vào không có gì xảy ra.
 *
 * Ở đây không có component tự viết nào: `<CommandPalette>` là của gói, file này chỉ nối nó với
 * state của shell, với `nav` và với những việc mà khung app truyền xuống.
 *
 * BẢN GHI đi vào bằng PROP, không bằng `import`: `app/(shell)/layout.tsx` đọc database, cắt gọn,
 * rồi truyền xuống. Thứ duy nhất file này `import` là BẢNG KHAI qua `useTaskStatusConfigs()` —
 * thứ tự và tone của trạng thái, không phải dữ liệu từ máy chủ.
 */

/**
 * Bảng lệnh không phải trang danh sách: quá 6 dòng kết quả là người dùng bắt đầu đọc thay vì
 * chọn. Gõ hẹp lại, hoặc mở `/tasks` để lọc đầy đủ.
 */
const TASK_RESULT_LIMIT = 6;

/**
 * Từ khoá tìm kiếm của một mục — MỘT chuỗi ngăn cách bằng dấu phẩy trong `messages/`, tách ở đây.
 *
 * ── VÌ SAO CHÚNG PHẢI ĐI QUA `messages/` ─────────────────────────────────────────────────
 * Vì đây là CHUỖI NGƯỜI DÙNG GÕ, không phải hằng máy: người xem giao diện tiếng Anh gõ "invite",
 * người xem tiếng Việt gõ "mời". Khoá cứng một danh sách tiếng Việt là mục "Mở Comitor.Account"
 * không bao giờ tìm được ở bản tiếng Anh — một lỗi không có gì báo đỏ, vì mục vẫn hiện ra khi
 * chưa gõ gì.
 *
 * ── VÌ SAO MỘT CHUỖI, KHÔNG PHẢI MẢNG JSON ───────────────────────────────────────────────
 * Vì `pnpm i18n:check` đối chiếu TẬP KHOÁ và tham số ICU, không đối chiếu độ dài mảng. Để mảng
 * thì hai ngôn ngữ lệch số phần tử mà không ai báo, và người dịch dễ tưởng phải giữ đúng số từ —
 * trong khi tiếng Anh cần "member, members" còn tiếng Việt chỉ cần "thành viên". Một chuỗi tự
 * nhiên, mỗi ngôn ngữ dài ngắn tuỳ ý, là hình dạng đúng cho thứ này.
 *
 * Viết CÓ DẤU trong `messages/`: `matchesSearch` của gói bỏ dấu ở cả hai vế, nên gõ "vai tro" vẫn
 * khớp "vai trò".
 */
const parseKeywords = (value: string): string[] =>
  value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);

/** Một việc như bảng lệnh cần — đã ghép sẵn tên, không còn id để tra ngược. */
export interface CommandTask {
  id: string;
  code: string;
  title: string;
  projectName: string;
  /** `null` = chưa giao. Trạng thái HỢP LỆ, không phải dữ liệu thiếu. */
  assigneeName: string | null;
  status: TaskStatus;
}

export interface CommandPaletteSlotProps {
  /** Việc tìm được trong bảng lệnh. Bản khởi tạo truyền 50 dòng đầu; app thật truyền kết quả API. */
  tasks: CommandTask[];
  /**
   * Mở Comitor.Account — thành viên, lời mời, vai trò thô, hồ sơ cá nhân đều ở đó.
   *
   * Là CALLBACK chứ không phải một chuỗi href: đích phụ thuộc workspace đang mở, mà workspace là
   * state của khung app. Truyền href xuống đây là file này phải biết cả địa chỉ rút gọn — tức lại
   * `import` một bản ghi, đúng thứ nó cố ý không làm.
   */
  onOpenAccount: () => void;
}

export function CommandPaletteSlot({ tasks, onOpenAccount }: CommandPaletteSlotProps) {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen, nav } = useShell();
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("commandPalette");
  const tCommon = useTranslations("common");
  /*
   * Nhãn "Mở Comitor.Account" lấy từ namespace `shell`, KHÔNG khai lại ở đây: cùng một chuỗi cũng
   * là tiêu đề của toast mà `shell-frame.tsx` bật lên ngay sau khi bấm mục này. Hai bản chép rời
   * thì lần đầu ai đó sửa chữ, mục và toast gọi cùng một việc bằng hai cái tên.
   */
  const tShell = useTranslations("shell");

  /**
   * `StatusConfig` đã ghép NHÃN theo ngôn ngữ đang xem — bảng khai ở `lib/catalog/task.ts` cố ý
   * không mang nhãn nào. Hook đã `useMemo` sẵn nên mảng giữ nguyên tham chiếu giữa các lần render,
   * và `groups` bên dưới lấy nó làm phụ thuộc mà không bị dựng lại mỗi ký tự người dùng gõ.
   */
  const statusConfigs = useTaskStatusConfigs();

  /**
   * App TỰ LỌC thay vì để `cmdk` lọc (truyền `onSearchChange` là tắt bộ lọc nội bộ của gói).
   *
   * Lý do không phải "thích tự làm": nhóm "Công việc" chỉ được xuất hiện KHI CÓ TỪ KHOÁ và phải
   * cắt bớt còn vài dòng — hai luật đó nằm ngoài tầm của một bộ lọc chạy sau khi mọi mục đã dựng.
   * Phép so khớp vẫn là của gói (`matchesSearch`: bỏ dấu, không phân biệt hoa thường) nên gõ
   * "chuan hoa" vẫn ra "Chuẩn hoá…" — đúng một luật với ô tìm kiếm ở trang Công việc.
   *
   * Đây cũng là chỗ nối tìm kiếm THẬT khi dữ liệu lớn lên: `onSearchChange` gọi
   * `lib/api-client/` (nhớ debounce), kết quả đổ vào `groups`, và bật prop `loading` trong lúc chờ.
   */
  const [query, setQuery] = useState("");

  /**
   * ⚠ Gói tự dọn ô nhập khi bảng lệnh đóng, nhưng nó KHÔNG gọi `onSearchChange` để báo — nên
   * `query` ở đây phải tự dọn. Thiếu effect này thì lần mở sau ô nhập trống trơn mà danh sách
   * vẫn đang lọc theo từ khoá cũ.
   */
  useEffect(() => {
    if (!commandPaletteOpen) setQuery("");
  }, [commandPaletteOpen]);

  const groups = useMemo<CommandPaletteGroup[]>(() => {
    /** Cùng trường mà `cmdk` đối chiếu khi tự lọc: nhãn + dòng mô tả + từ khoá phụ. */
    const matchesQuery = (item: CommandPaletteItem) =>
      matchesSearch([item.label, item.description ?? "", ...(item.keywords ?? [])].join(" "), query);

    /**
     * Nguồn của nhóm "Điều hướng" là `nav` LẤY TỪ SHELL — tức chính `NAV_ITEMS`
     * (`lib/catalog/navigation.ts`) mà `shell-frame.tsx` đã ghép nhãn và truyền cho
     * `<AppShell>`, không phải một danh sách chép tay thứ hai. Thêm một trang vào thanh bên là
     * bảng lệnh có ngay mục đó; quên thì cả hai cùng quên, không có chuyện lệch nhau. Nhãn ở đó
     * cũng đã đi qua `messages/` rồi (`shell-frame.tsx` ghép `nav.*`), nên ở đây không dịch lại.
     */
    const navItems: CommandPaletteItem[] = nav
      .flatMap((group) =>
        group.items.flatMap((item) => {
          // Mục CHA có `children` chỉ đóng/mở nhánh ở thanh bên, không phải một đích riêng —
          // đưa vào bảng lệnh sẽ thành một dòng trùng đích với mục con đầu tiên.
          const parent: CommandPaletteItem[] = item.children?.length
            ? []
            : [
                {
                  id: `nav-${item.id}`,
                  label: item.label,
                  description: group.label,
                  icon: item.icon,
                  // `href` là chuỗi MÁY, không dịch: nó cho người dùng gõ "/tasks" ra đúng trang.
                  keywords: [item.href],
                  onSelect: () => router.push(item.href)
                }
              ];

          const children: CommandPaletteItem[] = (item.children ?? []).map((child) => ({
            id: `nav-${child.id}`,
            label: child.label,
            // Mục con là một lát cắt của trang cha → nói rõ nó nằm ở đâu, nếu không bảng lệnh có
            // bốn dòng "Chung", "Thông báo", "Phân quyền", "Nâng cao" không rõ thuộc trang nào.
            description: item.label,
            icon: child.icon ?? item.icon,
            keywords: [child.href, item.label],
            onSelect: () => router.push(child.href)
          }));

          return [...parent, ...children];
        })
      )
      .filter(matchesQuery);

    const actionItems: CommandPaletteItem[] = [
      {
        /*
         * Module KHÔNG dựng lại màn hình thành viên: mời người, đổi vai trò và cài đặt không gian
         * làm việc thuộc Comitor.Account. Mục này giữ nguyên đường vào — người dùng vẫn gõ
         * "thành viên" là ra, chỉ có đích là sang sản phẩm khác.
         */
        id: "open-account",
        label: tShell("openAccount"),
        description: t("accountDescription"),
        icon: UserCog,
        keywords: parseKeywords(t("accountKeywords")),
        onSelect: onOpenAccount
      },
      {
        id: "toggle-theme",
        label: resolvedTheme === "dark" ? t("themeToLight") : t("themeToDark"),
        description: t("themeDescription"),
        icon: resolvedTheme === "dark" ? SunMedium : MoonStar,
        keywords: parseKeywords(t("themeKeywords")),
        onSelect: () => setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
    ].filter(matchesQuery);

    /**
     * Công việc chỉ hiện KHI ĐÃ GÕ: mở bảng lệnh ra mà thấy ngay một danh sách việc là bắt người
     * dùng đọc trước khi họ kịp hỏi. Trạng thái "Quá hạn" (`priority: 0` trong `TASK_STATUSES`)
     * nổi lên đầu — thứ tự lấy từ chính bảng trạng thái của module, không phải một luật riêng
     * chép tay ở đây.
     */
    const statusRank = (status: TaskStatus) =>
      getStatusConfig(statusConfigs, status)?.priority ?? Number.MAX_SAFE_INTEGER;

    /** Việc chưa giao vẫn phải tìm được: gõ "chưa giao" là ra đúng những dòng chưa có người nhận. */
    const assigneeLabel = (task: CommandTask) => task.assigneeName ?? tCommon("unassigned");

    const matchedTasks =
      query.trim() === ""
        ? []
        : tasks
            .filter((task) =>
              matchesSearch([task.title, task.code, task.projectName, assigneeLabel(task)].join(" "), query)
            )
            .sort((a, b) => statusRank(a.status) - statusRank(b.status));

    const taskItems: CommandPaletteItem[] = matchedTasks.slice(0, TASK_RESULT_LIMIT).map((task) => ({
      id: `task-${task.id}`,
      label: task.title,
      // Ba mảnh đủ để nhận ra đúng việc mà không phải mở nó: mã, dự án, trạng thái.
      description: `${task.code} · ${task.projectName} · ${getStatusLabel(statusConfigs, task.status)}`,
      icon: ListChecks,
      keywords: [task.code, assigneeLabel(task)],
      // Bản khởi tạo chưa có route chi tiết cho một công việc nên đích là màn hình danh sách. App
      // thật đổi đúng dòng này thành lệnh đi tới route chi tiết của công việc.
      onSelect: () => router.push("/tasks")
    }));

    /*
     * Số chèn vào nhãn đi bằng THAM SỐ ICU, không phải nối chuỗi: trật tự từ mỗi ngôn ngữ một
     * khác, và `{total}` còn được `Intl` định dạng theo locale khi con số lớn lên.
     */
    const taskGroupLabel =
      matchedTasks.length > TASK_RESULT_LIMIT
        ? t("tasksTruncated", { shown: TASK_RESULT_LIMIT, total: matchedTasks.length })
        : t("tasksGroup");

    /**
     * Bỏ nhóm RỖNG trước khi trả về: đã tự lọc thì gói không còn ẩn nhóm giúp nữa, để nguyên là
     * bảng lệnh hiện một tiêu đề nhóm treo lơ lửng không có dòng nào bên dưới.
     */
    return [
      { id: "navigation", label: t("navigationGroup"), items: navItems },
      { id: "tasks", label: taskGroupLabel, items: taskItems },
      { id: "actions", label: t("actionsGroup"), items: actionItems }
    ].filter((group) => group.items.length > 0);
  }, [nav, onOpenAccount, query, router, resolvedTheme, setTheme, statusConfigs, t, tCommon, tShell, tasks]);

  return (
    <CommandPalette
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      groups={groups}
      onSearchChange={setQuery}
      /*
       * BẮT BUỘC `false` khi dùng trong `<AppShell>`: shell đã gắn listener ⌘K của riêng nó
       * (`ShellProvider`). Để mặc định `true` là hai listener cùng lật một cờ trong một lần bấm
       * — bảng lệnh mở rồi đóng ngay, trông như phím tắt hỏng.
       */
      registerShortcut={false}
      placeholder={t("placeholder")}
      emptyText={t("empty")}
      /*
       * `recent` cố ý BỎ TRỐNG: "Gần đây" phải là lịch sử thật của người dùng (đọc từ server hoặc
       * localStorage). Nhồi vài mục cố định vào cho đẹp là dựng một tính năng giả.
       */
      footer={<span>{t("footer")}</span>}
    />
  );
}
