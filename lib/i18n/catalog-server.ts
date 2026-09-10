import "server-only";
import type { StatusConfig } from "@comitor/ui";
import { getTranslations } from "next-intl/server";
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/catalog/task";
import type { ProjectStatus, TaskPriority, TaskStatus } from "@/lib/contracts/task";

/**
 * Bản SERVER của `hooks/use-catalog.ts` — ghép bảng khai với nhãn thành `StatusConfig`.
 *
 * ── VÌ SAO CÓ HAI BẢN, VÀ VÌ SAO ĐÓ KHÔNG PHẢI TRÙNG LẶP ĐÁNG SỬA ────────────────────────
 * `next-intl` có hai API cho hai runtime, và chúng KHÔNG thay thế nhau được: `useTranslations()`
 * là hook nên chỉ chạy trong Client Component; `getTranslations()` là `async` nên chỉ chạy trong
 * Server Component. Một hàm dùng chung là bất khả — không phải vì thiếu trừu tượng, mà vì hai
 * runtime thật sự khác nhau.
 *
 * Cái được chia sẻ — bảng khai `TASK_STATUSES`, thứ tự, tone — nằm ở `lib/catalog/task.ts` và chỉ
 * có MỘT bản. Phần lặp lại ở đây là bốn dòng ghép nhãn, và gộp chúng lại sẽ tốn một tầng trừu
 * tượng đắt hơn chính thứ nó tiết kiệm.
 *
 * ⚠ Hai bản PHẢI dùng cùng một khoá (`task.status.<value>.label` / `.short`). Lệch khoá thì cùng
 * một trạng thái hiện ra hai chữ khác nhau ở hai trang, và không có gì báo đỏ.
 */

async function statusConfigs<T extends string>(
  namespace: "task.status" | "task.priority" | "project.status",
  entries: readonly Omit<StatusConfig<T>, "label" | "shortLabel">[]
): Promise<StatusConfig<T>[]> {
  const t = await getTranslations(namespace);
  return entries.map((entry) => ({
    ...entry,
    label: t(`${entry.value}.label` as Parameters<typeof t>[0]),
    shortLabel: t(`${entry.value}.short` as Parameters<typeof t>[0])
  }));
}

export function getTaskStatusConfigs(): Promise<StatusConfig<TaskStatus>[]> {
  return statusConfigs<TaskStatus>("task.status", TASK_STATUSES);
}

export function getTaskPriorityConfigs(): Promise<StatusConfig<TaskPriority>[]> {
  return statusConfigs<TaskPriority>("task.priority", TASK_PRIORITIES);
}

export function getProjectStatusConfigs(): Promise<StatusConfig<ProjectStatus>[]> {
  return statusConfigs<ProjectStatus>("project.status", PROJECT_STATUSES);
}
