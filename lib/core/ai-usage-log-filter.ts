/**
 * Lọc nhật ký AI và gom theo người/mã — hàm THUẦN, tầng 1.
 *
 * Mảng rỗng = không lọc theo trường đó (cùng quy ước `task-filter`). Search khớp tên, mã rút gọn,
 * model, provider, câu lỗi — không phân biệt hoa thường, không bỏ dấu.
 */

import type { AiUsageLogView, AiUsagePersonSummary, AiUsageUserView } from "@/lib/contracts/ai-usage";

export type AiUsageLogResult = "ok" | "error";

export interface AiUsageLogFilter {
  search: string;
  userIds: readonly string[];
  models: readonly string[];
  providers: readonly string[];
  results: readonly AiUsageLogResult[];
}

const NO_IDS: readonly string[] = Object.freeze([]);
const NO_MODELS: readonly string[] = Object.freeze([]);
const NO_PROVIDERS: readonly string[] = Object.freeze([]);
const NO_RESULTS: readonly AiUsageLogResult[] = Object.freeze([]);

export const EMPTY_AI_USAGE_LOG_FILTER: AiUsageLogFilter = Object.freeze({
  search: "",
  userIds: NO_IDS,
  models: NO_MODELS,
  providers: NO_PROVIDERS,
  results: NO_RESULTS
});

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function countActiveAiUsageLogFilters(filter: AiUsageLogFilter): number {
  let count = 0;
  if (normalizeSearchText(filter.search) !== "") count += 1;
  if (filter.userIds.length > 0) count += 1;
  if (filter.models.length > 0) count += 1;
  if (filter.providers.length > 0) count += 1;
  if (filter.results.length > 0) count += 1;
  return count;
}

function matchesList(selected: readonly string[], value: string): boolean {
  return selected.length === 0 || selected.includes(value);
}

export function matchesAiUsageLog(row: AiUsageLogView, filter: AiUsageLogFilter): boolean {
  if (!matchesList(filter.userIds, row.userId)) return false;
  if (!matchesList(filter.models, row.model)) return false;
  if (!matchesList(filter.providers, row.provider)) return false;
  if (filter.results.length > 0) {
    const result: AiUsageLogResult = row.ok ? "ok" : "error";
    if (!filter.results.includes(result)) return false;
  }

  const needle = normalizeSearchText(filter.search);
  if (needle === "") return true;

  const haystack = [row.name, row.keyPreview, row.model, row.provider, row.error ?? ""]
    .map(normalizeSearchText)
    .join(" ");
  return haystack.includes(needle);
}

export function filterAiUsageLogs(logs: readonly AiUsageLogView[], filter: AiUsageLogFilter): AiUsageLogView[] {
  return logs.filter((row) => matchesAiUsageLog(row, filter));
}

export function matchesAiUsagePerson(user: AiUsageUserView, filter: AiUsageLogFilter): boolean {
  if (!matchesList(filter.userIds, user.id)) return false;
  const needle = normalizeSearchText(filter.search);
  if (needle === "") return true;
  return [user.name, user.keyPreview].map(normalizeSearchText).join(" ").includes(needle);
}

/**
 * Một hàng một người. Số lượt/token/USD lấy từ nhật ký ĐANG LỌC; trần và đã dùng lấy từ mã
 * (nguồn sự thật của hạn mức, không suy từ 200 dòng log gần nhất).
 */
export function summarizeUsageByPerson(
  users: readonly AiUsageUserView[],
  logs: readonly AiUsageLogView[],
  filter: AiUsageLogFilter
): AiUsagePersonSummary[] {
  const visibleUsers = users.filter((user) => matchesAiUsagePerson(user, filter));
  const logFilterForCounts: AiUsageLogFilter = {
    ...filter,
    search: "",
    userIds: NO_IDS
  };
  const counted = filterAiUsageLogs(logs, logFilterForCounts);

  const byUser = new Map<
    string,
    {
      callCount: number;
      okCount: number;
      errorCount: number;
      inputTokens: number;
      outputTokens: number;
      logUsd: number;
    }
  >();
  for (const row of counted) {
    const current = byUser.get(row.userId) ?? {
      callCount: 0,
      okCount: 0,
      errorCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      logUsd: 0
    };
    current.callCount += 1;
    if (row.ok) current.okCount += 1;
    else current.errorCount += 1;
    current.inputTokens += row.inputTokens;
    current.outputTokens += row.outputTokens;
    current.logUsd += row.usd ?? 0;
    byUser.set(row.userId, current);
  }

  return visibleUsers.map((user) => {
    const stats = byUser.get(user.id);
    return {
      userId: user.id,
      name: user.name,
      keyPreview: user.keyPreview,
      blocked: user.blocked,
      maxBudgetUsd: user.maxBudgetUsd,
      spendUsd: user.spendUsd,
      callCount: stats?.callCount ?? 0,
      okCount: stats?.okCount ?? 0,
      errorCount: stats?.errorCount ?? 0,
      inputTokens: stats?.inputTokens ?? 0,
      outputTokens: stats?.outputTokens ?? 0,
      logUsd: stats?.logUsd ?? 0
    };
  });
}

export function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}
