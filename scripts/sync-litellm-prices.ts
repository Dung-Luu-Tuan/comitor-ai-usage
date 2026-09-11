/**
 * Tải bảng giá LiteLLM, rút còn trường cần để tính USD, ghi bản chụp vào `lib/catalog/`.
 *
 * Không gọi LiteLLM từng request — cổng 3100 đọc file này (lại theo mtime). Cron tuần:
 * `pnpm job:catalog-prices` hoặc `.github/workflows/catalog-prices.yml`. Tay: `pnpm catalog:prices`.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../lib/catalog/ai-vendors.json";
import {
  type CatalogModelKind,
  displayRate,
  findLitellmEntry,
  type LitellmPriceEntry,
  type LitellmPriceMap,
  litellmCandidateNames,
  vendorModelRates
} from "../lib/core/model-price";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SOURCE = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const SNAPSHOT_PATH = join(ROOT, "../lib/catalog/litellm-model-prices.json");

function takeNumber(source: Record<string, unknown>, field: string): number | undefined {
  const value = source[field];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function slimEntry(raw: unknown): LitellmPriceEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const entry: LitellmPriceEntry = {};
  if (typeof source.mode === "string" && source.mode !== "") entry.mode = source.mode;
  if (typeof source.litellm_provider === "string" && source.litellm_provider !== "") {
    entry.litellm_provider = source.litellm_provider;
  }
  const inCost = takeNumber(source, "input_cost_per_token");
  const outCost = takeNumber(source, "output_cost_per_token");
  const inLong = takeNumber(source, "input_cost_per_token_above_200k_tokens");
  const outLong = takeNumber(source, "output_cost_per_token_above_200k_tokens");
  const outImage = takeNumber(source, "output_cost_per_image");
  const inImage = takeNumber(source, "input_cost_per_image");
  const perSecond = takeNumber(source, "output_cost_per_video_per_second");
  if (inCost !== undefined) entry.input_cost_per_token = inCost;
  if (outCost !== undefined) entry.output_cost_per_token = outCost;
  if (inLong !== undefined) entry.input_cost_per_token_above_200k_tokens = inLong;
  if (outLong !== undefined) entry.output_cost_per_token_above_200k_tokens = outLong;
  if (outImage !== undefined) entry.output_cost_per_image = outImage;
  if (inImage !== undefined) entry.input_cost_per_image = inImage;
  if (perSecond !== undefined) entry.output_cost_per_video_per_second = perSecond;
  const hasMoney =
    inCost !== undefined ||
    outCost !== undefined ||
    inLong !== undefined ||
    outLong !== undefined ||
    outImage !== undefined ||
    inImage !== undefined ||
    perSecond !== undefined;
  return hasMoney ? entry : null;
}

export async function syncLitellmPrices(input: { localOnly?: boolean } = {}): Promise<void> {
  const localOnly = input.localOnly ?? process.argv.includes("--local");
  let models: LitellmPriceMap = {};
  let fetchedAt = new Date().toISOString();

  if (localOnly) {
    if (!existsSync(SNAPSHOT_PATH)) {
      throw new Error("Missing lib/catalog/litellm-model-prices.json; run without --local first.");
    }
    const snap = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as {
      fetchedAt?: string;
      models: LitellmPriceMap;
    };
    models = snap.models;
    fetchedAt = snap.fetchedAt ?? fetchedAt;
  } else {
    const response = await fetch(SOURCE);
    if (!response.ok) {
      throw new Error(`LiteLLM prices HTTP ${String(response.status)}`);
    }
    const raw = (await response.json()) as Record<string, unknown>;
    for (const [key, value] of Object.entries(raw)) {
      if (key === "sample_spec") continue;
      const entry = slimEntry(value);
      if (entry) models[key] = entry;
    }
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify({ source: SOURCE, fetchedAt, models })}\n`);
  }

  const uiRates: Record<string, ReturnType<typeof displayRate>> = {};
  for (const model of catalog.models) {
    const kind = model.kind as CatalogModelKind;
    const names = litellmCandidateNames({
      id: model.id,
      provider: model.provider,
      upstream: model.upstream
    });
    const found = findLitellmEntry(models, names);
    uiRates[model.id] = displayRate(found?.entry ?? null, kind);
  }

  writeFileSync(join(ROOT, "../lib/catalog/litellm-ui-rates.json"), `${JSON.stringify(uiRates, null, 2)}\n`);

  const vendorRates: Record<string, ReturnType<typeof vendorModelRates>> = {};
  for (const vendor of catalog.vendors) {
    const preferred = catalog.models.filter((model) => model.provider === vendor.id).map((model) => model.id);
    const rows = vendorModelRates(models, vendor.id, preferred);
    if (rows.length > 0) vendorRates[vendor.id] = rows;
  }
  writeFileSync(join(ROOT, "../lib/catalog/litellm-vendor-rates.json"), `${JSON.stringify(vendorRates)}\n`);

  console.info(`LiteLLM snapshot: ${String(Object.keys(models).length)} models`);
  console.info(`UI allowlist: ${String(Object.keys(uiRates).length)} rows → lib/catalog/litellm-ui-rates.json`);
  const vendorCounts = Object.entries(vendorRates)
    .map(([id, rows]) => `${id}:${String(rows.length)}`)
    .join(" ");
  console.info(`UI vendors: ${vendorCounts} → lib/catalog/litellm-vendor-rates.json`);
}

function invokedAsCli(): boolean {
  return process.argv.some((arg) => arg.replaceAll("\\", "/").endsWith("scripts/sync-litellm-prices.ts"));
}

if (invokedAsCli()) {
  await syncLitellmPrices();
}
