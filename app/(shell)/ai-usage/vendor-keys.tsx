"use client";

/**
 * Trạng thái cổng + form dán key hãng.
 *
 * Tách khỏi panel vì panel đã giữ bảng người/mã. Chips + lưới 3 cột thay cho một câu dài
 * và mỗi hãng một hàng FormField.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  FormSection,
  Input,
  Label,
  STATUS_TONES,
  StatusPill
} from "@comitor/ui";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useMemo } from "react";
import { AI_VENDORS } from "@/lib/catalog/ai-usage";
import type { AiUsageVendorView, AiVendorSection } from "@/lib/contracts/ai-usage";
import { modalityLabel, vendorLabel, vendorShortLabel } from "./vendor-labels";

const SECTIONS: readonly AiVendorSection[] = ["chat", "image", "video"];

export function VendorStatusBoard({
  vendors,
  gatewayOrigin
}: {
  vendors: readonly AiUsageVendorView[];
  gatewayOrigin: string;
}) {
  const t = useTranslations("aiUsage");
  const configs = useVendorKeyStatusConfigs();
  const readyCount = vendors.filter((vendor) => vendor.ready).length;
  const bySection = useMemo(() => groupVendors(vendors), [vendors]);

  return (
    <Alert variant={readyCount > 0 ? undefined : "warning"}>
      <KeyRound aria-hidden="true" />
      <AlertTitle>{t("statusTitle")}</AlertTitle>
      <AlertDescription className="w-full min-w-0">
        <span className="block">
          {t("statusGatewayLabel")} <span className="font-mono text-foreground">{gatewayOrigin}</span>
        </span>
        <span className="mt-1 block">{t("statusReadyCount", { ready: readyCount, total: vendors.length })}</span>
        <div className="mt-3 space-y-3">
          {SECTIONS.map((section) => (
            <div key={section}>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t(`statusSection.${section}`)}</p>
              <ul className="flex flex-wrap gap-2">
                {(bySection.get(section) ?? []).map((vendor) => (
                  <li
                    key={vendor.id}
                    className="flex max-w-full min-w-0 items-center gap-2 rounded-md border border-border bg-background px-2 py-1"
                  >
                    <span className="shrink-0 text-sm font-medium text-foreground">
                      {vendorShortLabel(t, vendor.id)}
                    </span>
                    <StatusPill configs={configs} value={vendor.ready ? "ready" : "missing"} short />
                    {vendor.ready ? (
                      <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{vendor.preview}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function VendorKeysForm({
  vendors,
  drafts,
  saving,
  onDraftChange,
  onSubmit
}: {
  vendors: readonly AiUsageVendorView[];
  drafts: Record<string, string>;
  saving: boolean;
  onDraftChange: (vendorId: string, value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const t = useTranslations("aiUsage");
  const tCommon = useTranslations("common");
  const configs = useVendorKeyStatusConfigs();
  const bySection = useMemo(() => groupVendors(vendors), [vendors]);
  const catalogById = useMemo(() => new Map(AI_VENDORS.map((vendor) => [vendor.id, vendor])), []);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {SECTIONS.map((section) => (
        <FormSection
          key={section}
          title={t(`vendorsSection.${section}`)}
          description={section === "chat" ? t("vendorsHint") : t(`vendorsSectionHint.${section}`)}
          icon={KeyRound}
        >
          <div className="col-span-12 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(bySection.get(section) ?? []).map((vendor) => {
              const catalog = catalogById.get(vendor.id);
              const fieldId = `vendor-key-${vendor.id}`;
              const hintId = `${fieldId}-hint`;
              const covers =
                vendor.modalities.length > 1
                  ? t("vendorCoversShort", {
                      list: vendor.modalities.map((item) => modalityLabel(t, item)).join(", ")
                    })
                  : null;
              return (
                <div key={vendor.id} className="min-w-0 space-y-2 rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Label htmlFor={fieldId} className="min-w-0 text-sm font-medium text-foreground">
                      {vendorShortLabel(t, vendor.id)}
                    </Label>
                    <StatusPill configs={configs} value={vendor.ready ? "ready" : "missing"} short />
                  </div>
                  <p id={hintId} className="text-xs text-muted-foreground">
                    {vendor.ready ? <span className="font-mono">{vendor.preview}</span> : t("vendorFieldMissing")}
                    {covers ? ` · ${covers}` : null}
                  </p>
                  <Input
                    id={fieldId}
                    type="password"
                    autoComplete="off"
                    aria-describedby={hintId}
                    aria-label={vendorLabel(t, vendor.id)}
                    value={drafts[vendor.id] ?? ""}
                    onChange={(event) => onDraftChange(vendor.id, event.target.value)}
                    placeholder={vendor.ready ? vendor.preview : (catalog?.placeholder ?? "")}
                  />
                </div>
              );
            })}
          </div>
        </FormSection>
      ))}
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? tCommon("saving") : t("saveVendors")}
        </Button>
      </div>
    </form>
  );
}

function useVendorKeyStatusConfigs() {
  const t = useTranslations("aiUsage");
  return useMemo(
    () => [
      {
        value: "ready" as const,
        label: t("vendorAdded"),
        shortLabel: t("vendorAddedShort"),
        priority: 1,
        ...STATUS_TONES.success
      },
      {
        value: "missing" as const,
        label: t("vendorMissing"),
        shortLabel: t("vendorMissing"),
        priority: 2,
        ...STATUS_TONES.warning
      }
    ],
    [t]
  );
}

function groupVendors(vendors: readonly AiUsageVendorView[]): Map<AiVendorSection, AiUsageVendorView[]> {
  const grouped = new Map<AiVendorSection, AiUsageVendorView[]>();
  for (const section of SECTIONS) grouped.set(section, []);
  for (const vendor of vendors) {
    grouped.get(vendor.section)?.push(vendor);
  }
  return grouped;
}
