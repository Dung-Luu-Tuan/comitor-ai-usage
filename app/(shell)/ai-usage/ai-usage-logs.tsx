"use client";

/**
 * Hai bảng nhật ký của `/ai-usage`: tổng theo người/mã, chi tiết từng lượt.
 *
 * Ghép `SearchFilterBar` + `FilterChips` + `DataTable`. Lọc/gom nằm ở `lib/core/ai-usage-log-filter.ts`.
 */

import {
  Combobox,
  DataTable,
  type DataTableColumn,
  EmptyState,
  type FilterChipItem,
  FilterChips,
  FormSection,
  SearchFilterBar,
  STATUS_TONES
} from "@comitor/ui";
import { ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { AiUsageLogView, AiUsagePersonSummary, AiUsageUserView } from "@/lib/contracts/ai-usage";
import {
  type AiUsageLogFilter,
  type AiUsageLogResult,
  countActiveAiUsageLogFilters,
  EMPTY_AI_USAGE_LOG_FILTER,
  filterAiUsageLogs,
  summarizeUsageByPerson,
  uniqueSortedStrings
} from "@/lib/core/ai-usage-log-filter";
import type { Locale } from "@/lib/i18n/config";
import { DATA_TABLE_LABELS, SEARCH_FILTER_BAR_LABELS } from "@/lib/i18n/ui-labels";
import { BudgetUsedBar } from "./budget-used-bar";

export function AiUsageLogs({
  users,
  logs,
  locale
}: {
  users: readonly AiUsageUserView[];
  logs: readonly AiUsageLogView[];
  locale: Locale;
}) {
  const t = useTranslations("aiUsage");
  const tCommon = useTranslations("common");
  const [filter, setFilter] = useState<AiUsageLogFilter>(EMPTY_AI_USAGE_LOG_FILTER);

  const personOptions = useMemo(() => users.map((user) => ({ value: user.id, label: user.name })), [users]);
  const keyOptions = useMemo(() => users.map((user) => ({ value: user.id, label: user.keyPreview })), [users]);
  const modelOptions = useMemo(
    () => uniqueSortedStrings(logs.map((row) => row.model)).map((value) => ({ value, label: value })),
    [logs]
  );
  const providerOptions = useMemo(
    () => uniqueSortedStrings(logs.map((row) => row.provider)).map((value) => ({ value, label: value })),
    [logs]
  );

  const summaries = useMemo(() => summarizeUsageByPerson(users, logs, filter), [users, logs, filter]);
  const detailRows = useMemo(() => filterAiUsageLogs(logs, filter), [logs, filter]);
  const logsBeforeResult = useMemo(() => filterAiUsageLogs(logs, { ...filter, results: [] }), [filter, logs]);

  const resultChips: FilterChipItem<AiUsageLogResult>[] = useMemo(() => {
    let okCount = 0;
    let errorCount = 0;
    for (const row of logsBeforeResult) {
      if (row.ok) okCount += 1;
      else errorCount += 1;
    }
    return [
      { value: "ok", label: t("logOk"), count: okCount, tone: STATUS_TONES.success },
      { value: "error", label: t("logError"), count: errorCount, tone: STATUS_TONES.destructive }
    ];
  }, [logsBeforeResult, t]);

  const summaryColumns = useMemo((): DataTableColumn<AiUsagePersonSummary>[] => {
    return [
      {
        id: "name",
        header: t("colName"),
        minWidth: 140,
        hideable: false,
        cell: (row) => (
          <span className="font-medium text-foreground">
            {row.name}
            {row.blocked ? ` · ${t("blocked")}` : ""}
          </span>
        )
      },
      {
        id: "key",
        header: t("colKey"),
        width: 180,
        hideable: false,
        cell: (row) => <span className="font-mono text-sm text-muted-foreground">{row.keyPreview}</span>
      },
      {
        id: "calls",
        header: t("colCalls"),
        width: 110,
        hideable: false,
        cell: (row) => (
          <span className="tabular-nums text-muted-foreground">
            {t("callsValue", { ok: row.okCount, error: row.errorCount, total: row.callCount })}
          </span>
        )
      },
      {
        id: "tokens",
        header: t("colTokens"),
        width: 120,
        hideable: false,
        cell: (row) => (
          <span className="tabular-nums">
            {row.inputTokens}+{row.outputTokens}
          </span>
        )
      },
      {
        id: "logUsd",
        header: t("colUsd"),
        width: 90,
        hideable: false,
        cell: (row) => <span className="tabular-nums">{row.logUsd}</span>
      },
      {
        id: "budget",
        header: t("colSpend"),
        minWidth: 200,
        hideable: false,
        cell: (row) => <BudgetUsedBar name={row.name} spendUsd={row.spendUsd} maxBudgetUsd={row.maxBudgetUsd} />
      }
    ];
  }, [t]);

  const logColumns = useMemo((): DataTableColumn<AiUsageLogView>[] => {
    return [
      {
        id: "at",
        header: t("colWhen"),
        width: 170,
        hideable: false,
        cell: (row) => (
          <span className="tabular-nums text-muted-foreground">{row.at.replace("T", " ").slice(0, 19)}</span>
        )
      },
      {
        id: "name",
        header: t("colName"),
        width: 140,
        hideable: false,
        cell: (row) => row.name
      },
      {
        id: "key",
        header: t("colKey"),
        width: 160,
        hideable: false,
        cell: (row) => <span className="font-mono text-xs text-muted-foreground">{row.keyPreview}</span>
      },
      {
        id: "model",
        header: t("colModel"),
        width: 160,
        hideable: false,
        cell: (row) => <span className="font-mono text-xs">{row.model}</span>
      },
      {
        id: "provider",
        header: t("colProvider"),
        width: 110,
        hideable: false,
        cell: (row) => row.provider
      },
      {
        id: "tokens",
        header: t("colTokens"),
        width: 110,
        hideable: false,
        cell: (row) => (
          <span className="tabular-nums">
            {row.inputTokens}+{row.outputTokens}
          </span>
        )
      },
      {
        id: "usd",
        header: t("colUsd"),
        width: 90,
        hideable: false,
        cell: (row) => <span className="tabular-nums">{row.usd ?? t("priceUnknown")}</span>
      },
      {
        id: "status",
        header: t("colStatus"),
        minWidth: 160,
        hideable: false,
        cell: (row) =>
          row.ok ? t("logOk") : <span className="text-destructive-ink">{row.error ?? t("logError")}</span>
      }
    ];
  }, [t]);

  function updateFilter(patch: Partial<AiUsageLogFilter>) {
    setFilter((current) => ({ ...current, ...patch }));
  }

  const hasPeople = users.length > 0;

  return (
    <>
      <FormSection title={t("logsSummaryTitle")} description={t("logsSummaryHint")} icon={ScrollText}>
        <div className="col-span-12">
          {!hasPeople ? (
            <EmptyState icon={ScrollText} title={t("logsSummaryEmpty")} description={t("logsSummaryEmptyHint")} />
          ) : (
            <DataTable
              aria-label={t("logsSummaryTableLabel")}
              columns={summaryColumns}
              rows={summaries}
              getRowId={(row) => row.userId}
              visibleColumnIds={summaryColumns.map((column) => column.id)}
              labels={DATA_TABLE_LABELS[locale]}
              minWidth={900}
              onRowClick={(row) => updateFilter({ userIds: [row.userId] })}
            />
          )}
        </div>
      </FormSection>

      <FormSection title={t("logsDetailTitle")} description={t("logsHint")} icon={ScrollText}>
        <div className="col-span-12 space-y-3">
          <SearchFilterBar
            searchValue={filter.search}
            onSearchChange={(search) => updateFilter({ search })}
            searchPlaceholder={t("filter.searchPlaceholder")}
            debounceMs={0}
            activeFilterCount={countActiveAiUsageLogFilters(filter)}
            onClearFilters={() => setFilter(EMPTY_AI_USAGE_LOG_FILTER)}
            resultCount={detailRows.length}
            total={logs.length}
            unitLabel={t("filter.unit")}
            labels={SEARCH_FILTER_BAR_LABELS[locale]}
          >
            <div className="w-full sm:w-44">
              <Combobox
                options={personOptions}
                value={filter.userIds[0] ?? null}
                onValueChange={(value) => updateFilter({ userIds: value === null ? [] : [value] })}
                placeholder={t("filter.person")}
                searchPlaceholder={t("filter.personSearch")}
                emptyText={t("filter.personEmpty")}
                clearable
                clearLabel={tCommon("clearSelection")}
                aria-label={t("filter.personLabel")}
              />
            </div>
            <div className="w-full sm:w-52">
              <Combobox
                options={keyOptions}
                value={filter.userIds[0] ?? null}
                onValueChange={(value) => updateFilter({ userIds: value === null ? [] : [value] })}
                placeholder={t("filter.key")}
                searchPlaceholder={t("filter.keySearch")}
                emptyText={t("filter.keyEmpty")}
                clearable
                clearLabel={tCommon("clearSelection")}
                aria-label={t("filter.keyLabel")}
              />
            </div>
            <div className="w-full sm:w-48">
              <Combobox
                options={modelOptions}
                value={filter.models[0] ?? null}
                onValueChange={(value) => updateFilter({ models: value === null ? [] : [value] })}
                placeholder={t("filter.model")}
                searchPlaceholder={t("filter.modelSearch")}
                emptyText={t("filter.modelEmpty")}
                clearable
                clearLabel={tCommon("clearSelection")}
                aria-label={t("filter.modelLabel")}
              />
            </div>
            <div className="w-full sm:w-40">
              <Combobox
                options={providerOptions}
                value={filter.providers[0] ?? null}
                onValueChange={(value) => updateFilter({ providers: value === null ? [] : [value] })}
                placeholder={t("filter.provider")}
                searchPlaceholder={t("filter.providerSearch")}
                emptyText={t("filter.providerEmpty")}
                clearable
                clearLabel={tCommon("clearSelection")}
                aria-label={t("filter.providerLabel")}
              />
            </div>
          </SearchFilterBar>

          <FilterChips
            items={resultChips}
            value={[...filter.results]}
            onValueChange={(next) => updateFilter({ results: Array.isArray(next) ? next : next ? [next] : [] })}
            multiple
            showAll
            allLabel={t("filter.resultAll")}
            allCount={logsBeforeResult.length}
            label={t("filter.resultLabel")}
          />

          {logs.length === 0 ? (
            <EmptyState icon={ScrollText} title={t("logsEmpty")} description={t("logsEmptyHint")} />
          ) : (
            <DataTable
              aria-label={t("logsTableLabel")}
              columns={logColumns}
              rows={detailRows}
              getRowId={(row) => row.id}
              visibleColumnIds={logColumns.map((column) => column.id)}
              labels={DATA_TABLE_LABELS[locale]}
              minWidth={980}
              striped
              empty={
                <EmptyState icon={ScrollText} title={t("logsFilteredEmpty")} description={t("logsFilteredEmptyHint")} />
              }
            />
          )}
        </div>
      </FormSection>
    </>
  );
}
