/**
 * Hằng quản lý AI — id, model, nhóm form. Nhãn nằm ở `messages/`.
 *
 * Giá USD: `litellm-vendor-rates.json` (mọi model LiteLLM có đơn giá của hãng đó).
 */

import type { PricedModelRow } from "@/lib/core/model-price";
import catalog from "./ai-vendors.json";
import vendorRates from "./litellm-vendor-rates.json";

export const AI_GATEWAY_ORIGIN = "http://localhost:3100";

export const AI_VENDORS = catalog.vendors;

export const AI_VENDOR_IDS = AI_VENDORS.map((vendor) => vendor.id);

export type AiVendorId = (typeof AI_VENDORS)[number]["id"];

export type AiVendorSection = (typeof AI_VENDORS)[number]["section"];

export const AI_MODELS = catalog.models;

export type AiModelRate = PricedModelRow;

export const AI_VENDOR_MODEL_RATES: { vendorId: string; models: AiModelRate[] }[] = AI_VENDORS.map((vendor) => ({
  vendorId: vendor.id,
  models: (vendorRates as Record<string, AiModelRate[]>)[vendor.id] ?? []
})).filter((group) => group.models.length > 0);

export const AI_MODEL_HINTS = [
  { task: "daily", modelId: "claude-sonnet-4-6" },
  { task: "openai", modelId: "gpt-4o" },
  { task: "quick", modelId: "gemini-3.6-flash" },
  { task: "cheap", modelId: "deepseek-flash" },
  { task: "grok", modelId: "grok-3" },
  { task: "eu", modelId: "mistral-large-latest" },
  { task: "image", modelId: "gpt-image-1" },
  { task: "video", modelId: "sora-2" }
] as const;

export function isAiVendorId(value: string): value is AiVendorId {
  return AI_VENDOR_IDS.includes(value as AiVendorId);
}

export function isAiVendorSection(value: string): value is "chat" | "image" | "video" {
  return value === "chat" || value === "image" || value === "video";
}
