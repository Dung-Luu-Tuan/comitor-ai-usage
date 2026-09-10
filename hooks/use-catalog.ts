"use client";

import type { StatusConfig } from "@comitor/ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/catalog/task";
import type { ProjectStatus, TaskPriority, TaskStatus } from "@/lib/contracts/task";

/**
 * Ghép BẢNG KHAI (`lib/catalog/task.ts`) với NHÃN (`messages/*.json`) thành `StatusConfig` mà
 * `@comitor/ui` cần — tầng 4 (hook cầu nối).
 *
 * ── VÌ SAO PHẢI CÓ MỘT CHỖ GHÉP, THAY VÌ ĐỂ NHÃN NGAY TRONG BẢNG KHAI ─────────────────────
 * Vì nhãn phụ thuộc NGÔN NGỮ ĐANG XEM, còn bảng khai là hằng ở scope module — nó được đánh giá
 * đúng một lần, trước khi có request nào. Nhét nhãn vào đó là khoá cứng một thứ tiếng vào bundle.
 *
 * ── VÌ SAO `useMemo` ─────────────────────────────────────────────────────────────────────
 * `StatusConfig[]` đi vào prop `configs` của `<DataTable>` và `<StatusPill>`. Dựng mảng mới ở mỗi
 * lần render là mỗi lần một tham chiếu khác, và mọi `memo`/`useEffect` phía dưới coi đó là dữ liệu
 * đã đổi. Với một bảng 25 dòng thì đó là 25 lần vẽ lại thừa cho mỗi ký tự người dùng gõ vào ô tìm
 * kiếm.
 *
 * ── ⚠ `shortLabel` LÀ BẮT BUỘC, KHÔNG PHẢI TUỲ CHỌN ──────────────────────────────────────
 * Nó là thứ hiện ra ở cột hẹp và ở màn hình 375px. Bỏ trống thì gói rơi về `label` đầy đủ và cột
 * trạng thái đẩy bảng tràn ngang — một lỗi chỉ thấy được ở bề rộng nhỏ, tức chỗ ít ai mở.
 */

function useStatusConfigs<T extends string>(
  namespace: "task.status" | "task.priority" | "project.status",
  entries: readonly Omit<StatusConfig<T>, "label" | "shortLabel">[]
): StatusConfig<T>[] {
  const t = useTranslations(namespace);
  return useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        label: t(`${entry.value}.label` as Parameters<typeof t>[0]),
        shortLabel: t(`${entry.value}.short` as Parameters<typeof t>[0])
      })),
    [t, entries]
  );
}

export function useTaskStatusConfigs(): StatusConfig<TaskStatus>[] {
  return useStatusConfigs<TaskStatus>("task.status", TASK_STATUSES);
}

export function useTaskPriorityConfigs(): StatusConfig<TaskPriority>[] {
  return useStatusConfigs<TaskPriority>("task.priority", TASK_PRIORITIES);
}

export function useProjectStatusConfigs(): StatusConfig<ProjectStatus>[] {
  return useStatusConfigs<ProjectStatus>("project.status", PROJECT_STATUSES);
}
