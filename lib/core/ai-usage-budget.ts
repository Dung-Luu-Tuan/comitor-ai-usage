/**
 * Trần USD của một mã nội bộ — hàm THUẦN, tầng 1.
 *
 * `spendUsd / maxBudgetUsd` phải ra cùng một phần trăm ở bảng cấp mã và bảng tổng nhật ký.
 * Viết tại chỗ gọi thì một bên kẹp 100, một bên để 150% làm vỡ thanh.
 */

/** Từ tỉ lệ này trở lên, thanh chuyển tông cảnh báo (vạch chéo của gói). */
export const BUDGET_WARNING_RATIO = 0.8;

export type BudgetBarTone = "default" | "warning" | "destructive";

/**
 * Phần trăm đã dùng 0–100, đã làm tròn.
 *
 * Trần `0` là không giới hạn → 0 (thanh trống). UI hiện nhãn "không trần", không hiểu 0% là hết.
 * `NaN` / số âm / `Infinity` ở mẫu số đều bị chặn trước khi thành `NaN` trên giao diện.
 */
export function budgetUsedPercent(spendUsd: number, maxBudgetUsd: number): number {
  if (!(maxBudgetUsd > 0)) return 0;
  if (!(spendUsd > 0)) return 0;
  const ratio = spendUsd / maxBudgetUsd;
  if (!(ratio > 0)) return 0;
  return Math.round(Math.min(ratio, 1) * 100);
}

export function budgetBarTone(spendUsd: number, maxBudgetUsd: number): BudgetBarTone {
  if (!(maxBudgetUsd > 0)) return "default";
  if (!(spendUsd > 0)) return "default";
  if (spendUsd >= maxBudgetUsd) return "destructive";
  if (spendUsd / maxBudgetUsd >= BUDGET_WARNING_RATIO) return "warning";
  return "default";
}
