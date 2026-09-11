"use client";

/**
 * Thanh đã dùng / trần — cùng phép tính `budgetUsedPercent` ở cả bảng cấp mã và bảng tổng.
 */

import { Progress } from "@comitor/ui";
import { useTranslations } from "next-intl";
import { budgetBarTone, budgetUsedPercent } from "@/lib/core/ai-usage-budget";

export function BudgetUsedBar({
  name,
  spendUsd,
  maxBudgetUsd
}: {
  name: string;
  spendUsd: number;
  maxBudgetUsd: number;
}) {
  const t = useTranslations("aiUsage");
  const percent = budgetUsedPercent(spendUsd, maxBudgetUsd);
  const tone = budgetBarTone(spendUsd, maxBudgetUsd);
  const cap = maxBudgetUsd === 0 ? t("unlimited") : String(maxBudgetUsd);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Progress value={percent} tone={tone} aria-label={t("budgetBarLabel", { name })} className="w-full min-w-32" />
      <span className="text-xs tabular-nums text-muted-foreground">{t("spendValue", { used: spendUsd, cap })}</span>
    </div>
  );
}
