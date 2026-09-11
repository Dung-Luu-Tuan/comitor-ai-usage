"use client";

/**
 * Bảng giá LiteLLM trên /ai-usage — mỗi hãng một thẻ, mọi model có đơn giá; danh sách dài thì cuộn.
 */

import { useTranslations } from "next-intl";
import { AI_VENDOR_MODEL_RATES, type AiModelRate } from "@/lib/catalog/ai-usage";
import { modalityLabel, vendorShortLabel } from "./vendor-labels";

export function ModelRates() {
  const t = useTranslations("aiUsage");

  return (
    <div className="col-span-12 space-y-3">
      <p className="text-xs text-muted-foreground">{t("priceHint")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {AI_VENDOR_MODEL_RATES.map((group) => (
          <div
            key={group.vendorId}
            className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-background p-3"
          >
            <p className="mb-2 shrink-0 text-sm font-medium text-foreground">
              {t("priceVendorCount", { name: vendorShortLabel(t, group.vendorId), count: group.models.length })}
            </p>
            <ul className="max-h-80 min-h-0 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
              {group.models.map((model) => (
                <li key={`${model.modality}:${model.id}`} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs text-foreground">{model.id}</span>
                    <span className="text-xs text-muted-foreground">{modalityLabel(t, model.modality)}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">{rateLabel(t, model)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function rateLabel(t: ReturnType<typeof useTranslations<"aiUsage">>, model: AiModelRate): string {
  if (model.kind === "chat") {
    return t("priceChatRate", { input: formatRate(model.in), output: formatRate(model.out) });
  }
  if (model.kind === "image") {
    if ("flatUsd" in model) return t("priceImageRate", { usd: formatRate(model.flatUsd) });
    return t("priceChatRate", { input: formatRate(model.in), output: formatRate(model.out) });
  }
  if ("perSecondUsd" in model) return t("priceVideoPerSecond", { usd: formatRate(model.perSecondUsd) });
  return t("priceUnknown");
}

function formatRate(value: number): string {
  return String(value);
}
