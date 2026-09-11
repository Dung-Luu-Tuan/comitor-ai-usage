/**
 * Tra USD từ bảng giá LiteLLM — hàm THUẦN, tầng 1.
 *
 * Cổng 3100 và trang `/ai-usage` dùng cùng phép. Bảng đầy đủ nằm ở
 * `lib/catalog/litellm-model-prices.json` (bản chụp; cron tuần hoặc `pnpm catalog:prices`).
 * Hàm này nhận map, không đọc file: test không kéo 3000 model, và component client không bundle
 * bản chụp.
 *
 * Không khớp id → `null`. Không nhân mặc định 3/15 — số bịa còn tệ hơn ô trống.
 */

/** Ngưỡng ngữ cảnh dài của xAI / Claude trên bảng LiteLLM. */
export const LITELLM_LONG_CONTEXT_TOKENS = 200_000;

export interface LitellmPriceEntry {
  mode?: string;
  litellm_provider?: string;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  input_cost_per_token_above_200k_tokens?: number;
  output_cost_per_token_above_200k_tokens?: number;
  output_cost_per_image?: number;
  input_cost_per_image?: number;
  output_cost_per_video_per_second?: number;
}

export type LitellmPriceMap = Record<string, LitellmPriceEntry>;

export type CatalogModelKind = "chat" | "image" | "video";

export interface PriceUsageInput {
  names: readonly string[];
  kind: CatalogModelKind;
  inputTokens: number;
  outputTokens: number;
  imageCount?: number;
  videoSeconds?: number;
}

export type DisplayRate =
  | { kind: "chat"; in: number; out: number }
  | { kind: "image"; flatUsd: number }
  | { kind: "image"; in: number; out: number }
  | { kind: "video"; perSecondUsd: number }
  | { kind: "unknown" };

const PROVIDER_PREFIX: Record<string, readonly string[]> = {
  openai: ["openai"],
  claude: ["anthropic"],
  grok: ["xai"],
  gemini: ["gemini"],
  deepseek: ["deepseek"],
  mistral: ["mistral"],
  flux: ["black_forest_labs"],
  runway: ["runwayml"]
};

/** Hãng trên `/ai-usage` → `litellm_provider` trong bảng giá. */
export const LITELLM_VENDOR_PROVIDERS: Record<string, readonly string[]> = {
  claude: ["anthropic"],
  openai: ["openai"],
  grok: ["xai"],
  gemini: ["gemini"],
  deepseek: ["deepseek"],
  mistral: ["mistral"],
  flux: ["black_forest_labs"],
  stability: ["stability"],
  runway: ["runwayml"],
  hailuo: ["minimax"]
};

export type PricedDisplayRate = Exclude<DisplayRate, { kind: "unknown" }>;

export type PricedModelRow = { id: string; modality: CatalogModelKind } & PricedDisplayRate;

/** Id catalog → key LiteLLM khi hai bên đặt tên khác nhau. */
const ID_ALIASES: Record<string, readonly string[]> = {
  "deepseek-flash": ["deepseek-v4-flash", "deepseek/deepseek-v4-flash"],
  "gemini-imagen": ["gemini/imagen-4.0-generate-001"],
  "veo-3.1": ["gemini/veo-3.1-generate-preview", "gemini/veo-3.1-generate-001"],
  "flux-pro": ["black_forest_labs/flux-kontext-pro"],
  "grok-imagine-image": ["xai/grok-imagine-image"],
  "grok-imagine-video": ["xai/grok-imagine-video"],
  "sora-2": ["openai/sora-2"],
  "mistral-large-latest": ["mistral/mistral-large-latest", "mistral/mistral-large-3"]
};

export function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function tokenUsdPerMillion(costPerToken: number): number {
  return roundUsd(costPerToken * 1_000_000);
}

function pushUnique(target: string[], value: string): void {
  const key = value.trim();
  if (key === "" || target.includes(key)) return;
  target.push(key);
}

/**
 * Các key lần lượt thử trên bảng LiteLLM: alias khai tay, id catalog, upstream, rồi `hang/id`.
 */
export function litellmCandidateNames(input: {
  id: string;
  provider: string;
  upstream?: string;
  aliases?: readonly string[];
}): string[] {
  const names: string[] = [];
  for (const alias of input.aliases ?? []) pushUnique(names, alias);
  for (const alias of ID_ALIASES[input.id] ?? []) pushUnique(names, alias);
  pushUnique(names, input.id);
  if (input.upstream) {
    pushUnique(names, input.upstream);
    for (const alias of ID_ALIASES[input.upstream] ?? []) pushUnique(names, alias);
  }
  const prefixes = PROVIDER_PREFIX[input.provider] ?? [];
  for (const prefix of prefixes) {
    pushUnique(names, `${prefix}/${input.id}`);
    if (input.upstream) pushUnique(names, `${prefix}/${input.upstream}`);
  }
  return names;
}

export function findLitellmEntry(
  map: LitellmPriceMap,
  names: readonly string[]
): { key: string; entry: LitellmPriceEntry } | null {
  for (const name of names) {
    const entry = map[name];
    if (entry && typeof entry === "object") return { key: name, entry };
  }
  return null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tokensOrZero(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function imageUnitUsd(entry: LitellmPriceEntry): number | null {
  return finiteNumber(entry.output_cost_per_image) ?? finiteNumber(entry.input_cost_per_image);
}

function chatTokenRates(entry: LitellmPriceEntry, inputTokens: number): { in: number; out: number } | null {
  const long = inputTokens >= LITELLM_LONG_CONTEXT_TOKENS;
  const inCost = long
    ? (finiteNumber(entry.input_cost_per_token_above_200k_tokens) ?? finiteNumber(entry.input_cost_per_token))
    : finiteNumber(entry.input_cost_per_token);
  const outCost = long
    ? (finiteNumber(entry.output_cost_per_token_above_200k_tokens) ?? finiteNumber(entry.output_cost_per_token) ?? 0)
    : (finiteNumber(entry.output_cost_per_token) ?? 0);
  if (inCost === null) return null;
  return { in: inCost, out: outCost };
}

/**
 * USD của một lượt. `null` = bảng không có giá cho id này, hoặc thiếu đơn vị (video/giây mà không
 * có thời lượng).
 */
export function priceUsage(map: LitellmPriceMap, input: PriceUsageInput): number | null {
  const found = findLitellmEntry(map, input.names);
  if (!found) return null;
  const { entry } = found;
  const inputTokens = tokensOrZero(input.inputTokens);
  const outputTokens = tokensOrZero(input.outputTokens);

  if (input.kind === "video") {
    const perSecond = finiteNumber(entry.output_cost_per_video_per_second);
    const seconds = finiteNumber(input.videoSeconds);
    if (perSecond !== null && seconds !== null && seconds > 0) {
      return roundUsd(perSecond * seconds);
    }
    return null;
  }

  if (input.kind === "image") {
    const perImage = imageUnitUsd(entry);
    if (perImage !== null) {
      const count = finiteNumber(input.imageCount) ?? 1;
      if (!(count > 0)) return null;
      return roundUsd(perImage * count);
    }
    const rates = chatTokenRates(entry, inputTokens);
    if (!rates) return null;
    return roundUsd(inputTokens * rates.in + outputTokens * rates.out);
  }

  const rates = chatTokenRates(entry, inputTokens);
  if (!rates) return null;
  return roundUsd(inputTokens * rates.in + outputTokens * rates.out);
}

export function displayRate(entry: LitellmPriceEntry | null, catalogKind: CatalogModelKind): DisplayRate {
  if (!entry) return { kind: "unknown" };

  if (catalogKind === "video") {
    const perSecond = finiteNumber(entry.output_cost_per_video_per_second);
    if (perSecond === null) return { kind: "unknown" };
    return { kind: "video", perSecondUsd: roundUsd(perSecond) };
  }

  if (catalogKind === "image") {
    const perImage = imageUnitUsd(entry);
    if (perImage !== null) return { kind: "image", flatUsd: roundUsd(perImage) };
    const inCost = finiteNumber(entry.input_cost_per_token);
    if (inCost === null) return { kind: "unknown" };
    return {
      kind: "image",
      in: tokenUsdPerMillion(inCost),
      out: tokenUsdPerMillion(finiteNumber(entry.output_cost_per_token) ?? 0)
    };
  }

  const inCost = finiteNumber(entry.input_cost_per_token);
  if (inCost === null) return { kind: "unknown" };
  return {
    kind: "chat",
    in: tokenUsdPerMillion(inCost),
    out: tokenUsdPerMillion(finiteNumber(entry.output_cost_per_token) ?? 0)
  };
}

export function catalogKindFromMode(mode: string | undefined): CatalogModelKind | null {
  if (mode === "image_generation" || mode === "image_edit") return "image";
  if (mode === "video_generation") return "video";
  if (mode === "chat" || mode === "completion" || mode === "responses" || mode === "realtime") return "chat";
  return null;
}

export function litellmDisplayId(key: string, provider: string): string {
  const prefix = `${provider}/`;
  if (key.startsWith(prefix)) return key.slice(prefix.length);
  return key;
}

function rateFingerprint(rate: PricedDisplayRate): string {
  if (rate.kind === "chat") return `chat:${String(rate.in)}:${String(rate.out)}`;
  if (rate.kind === "image") {
    if ("flatUsd" in rate) return `image:${String(rate.flatUsd)}`;
    return `image:${String(rate.in)}:${String(rate.out)}`;
  }
  return `video:${String(rate.perSecondUsd)}`;
}

/**
 * Mọi model LiteLLM của một hãng có đơn giá chat/ảnh/video. Bỏ embedding, audio, OCR.
 * Trùng `gemini/x` và `x` (cùng giá) chỉ giữ một dòng.
 */
export function vendorModelRates(
  map: LitellmPriceMap,
  vendorId: string,
  preferredIds: readonly string[] = []
): PricedModelRow[] {
  const providers = new Set(LITELLM_VENDOR_PROVIDERS[vendorId] ?? []);
  if (providers.size === 0) return [];

  const chosen = new Map<string, PricedModelRow>();
  for (const [key, entry] of Object.entries(map)) {
    const provider = entry.litellm_provider;
    if (!provider || !providers.has(provider)) continue;
    const modality = catalogKindFromMode(entry.mode);
    if (!modality) continue;
    const rate = displayRate(entry, modality);
    if (rate.kind === "unknown") continue;
    const id = litellmDisplayId(key, provider);
    const dedupeKey = `${id}|${rateFingerprint(rate)}`;
    const row: PricedModelRow = { id, modality, ...rate };
    const existing = chosen.get(dedupeKey);
    if (!existing || existing.id.length > row.id.length) chosen.set(dedupeKey, row);
  }

  const preferredIndex = new Map(preferredIds.map((id, index) => [id, index]));
  return [...chosen.values()].sort((left, right) => {
    const leftPref = preferredIndex.get(left.id);
    const rightPref = preferredIndex.get(right.id);
    if (leftPref !== undefined && rightPref !== undefined) return leftPref - rightPref;
    if (leftPref !== undefined) return -1;
    if (rightPref !== undefined) return 1;
    if (left.id < right.id) return -1;
    if (left.id > right.id) return 1;
    return 0;
  });
}
