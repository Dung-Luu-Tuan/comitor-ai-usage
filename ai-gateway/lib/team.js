import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../../lib/catalog/ai-vendors.json" with { type: "json" };
import { litellmCandidateNames, priceUsage, roundUsd } from "../../lib/core/model-price.ts";
import { defaultWorkspaceId, query, withTransaction } from "./db.js";
import { vendorReady } from "./store.js";

const PRICE_SNAPSHOT = join(dirname(fileURLToPath(import.meta.url)), "../../lib/catalog/litellm-model-prices.json");

let priceCache = { mtimeMs: -1, models: {} };

function litellmModels() {
  if (!existsSync(PRICE_SNAPSHOT)) return priceCache.models;
  const mtimeMs = statSync(PRICE_SNAPSHOT).mtimeMs;
  if (mtimeMs === priceCache.mtimeMs) return priceCache.models;
  try {
    const snap = JSON.parse(readFileSync(PRICE_SNAPSHOT, "utf8"));
    const models = snap?.models && typeof snap.models === "object" ? snap.models : {};
    priceCache = { mtimeMs, models };
  } catch {
    /* Giữ cache cũ nếu file đang ghi dở. */
  }
  return priceCache.models;
}

export const MODELS = catalog.models.map((item) => ({
  id: item.id,
  provider: item.provider,
  kind: item.kind,
  upstream: item.upstream
}));

const ALIASES = {
  "claude-sonnet-4-6": "claude-sonnet-4-6",
  "claude-sonnet-4-5": "claude-sonnet-4-6",
  "claude-sonnet-4": "claude-sonnet-4-6",
  "claude-3-7-sonnet-latest": "claude-sonnet-4-6",
  "claude-3-5-sonnet-latest": "claude-sonnet-4-6",
  "claude-3-5-sonnet": "claude-sonnet-4-6",
  "claude-opus-4-1": "claude-sonnet-4-6",
  "claude-opus-4": "claude-sonnet-4-6",
  "claude-3-5-haiku-latest": "claude-sonnet-4-6",
  "gpt-4o": "gpt-4o",
  "gpt-4.1": "gpt-4o",
  "gpt-4": "gpt-4o",
  "gpt-5": "gpt-5.4",
  "gpt-5.4": "gpt-5.4",
  "gpt-5.5": "gpt-5.4",
  "grok-3": "grok-3",
  "grok-3-latest": "grok-3",
  "grok-2": "grok-3",
  "grok-2-latest": "grok-3",
  "grok-beta": "grok-3",
  "gemini-3.6-flash": "gemini-3.6-flash",
  "gemini-3.6": "gemini-3.6-flash",
  "gemini-2.5-flash": "gemini-3.6-flash",
  "gemini-2.0-flash": "gemini-3.6-flash",
  "gemini-flash-latest": "gemini-3.6-flash",
  "gemini-1.5-flash": "gemini-3.6-flash",
  "deepseek-flash": "deepseek-flash",
  "deepseek-v4-flash": "deepseek-flash",
  "deepseek-v4-flash-vision-exp": "deepseek-flash",
  "deepseek-chat": "deepseek-flash",
  "deepseek-reasoner": "deepseek-flash",
  "deepseek-v4-pro": "deepseek-v4-pro",
  "mistral-large-latest": "mistral-large-latest",
  "mistral-large": "mistral-large-latest",
  "dall-e-3": "gpt-image-1",
  "gpt-image-1": "gpt-image-1",
  "sora-2": "sora-2",
  sora: "sora-2"
};

export function resolveModel(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const aliased = ALIASES[raw] || ALIASES[lower];
  if (aliased) return MODELS.find((item) => item.id === aliased) ?? null;
  const exact = MODELS.find((item) => item.id === raw || item.id === lower);
  if (exact) return exact;
  if (lower.includes("gemini") || lower.includes("imagen") || lower.includes("veo")) {
    return MODELS.find((item) => item.provider === "gemini" && item.kind === "chat") ?? null;
  }
  if (lower.includes("grok")) return MODELS.find((item) => item.provider === "grok" && item.kind === "chat") ?? null;
  if (lower.includes("claude") || lower.includes("sonnet") || lower.includes("opus") || lower.includes("haiku")) {
    return MODELS.find((item) => item.provider === "claude") ?? null;
  }
  if (lower.includes("gpt") || lower.includes("openai")) {
    return MODELS.find((item) => item.provider === "openai" && item.kind === "chat") ?? null;
  }
  if (lower.includes("deepseek")) {
    if (lower.includes("pro")) return MODELS.find((item) => item.id === "deepseek-v4-pro") ?? null;
    return MODELS.find((item) => item.id === "deepseek-flash") ?? null;
  }
  if (lower.includes("mistral")) return MODELS.find((item) => item.provider === "mistral") ?? null;
  return null;
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    key: row.key,
    maxBudgetUsd: Number(row.max_budget_usd),
    spendUsd: Number(row.spend_usd),
    blocked: row.blocked,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  };
}

export async function findUserByKey(rawKey) {
  const key = String(rawKey ?? "").trim();
  if (!key) return null;
  const result = await query(
    `SELECT id, workspace_id, name, key, max_budget_usd, spend_usd, blocked, created_at
     FROM ai_team_users WHERE key = $1 AND blocked = false LIMIT 1`,
    [key]
  );
  return mapUser(result.rows[0]);
}

export const VENDORS = catalog.vendors;

export async function resolveAdminWorkspaceId() {
  const fromEnv = defaultWorkspaceId();
  if (fromEnv) return fromEnv;
  const vendors = await query("SELECT DISTINCT workspace_id FROM ai_vendor_secrets LIMIT 2");
  if (vendors.rows.length === 1) return vendors.rows[0].workspace_id;
  const users = await query("SELECT DISTINCT workspace_id FROM ai_team_users LIMIT 2");
  if (users.rows.length === 1) return users.rows[0].workspace_id;
  throw fail(500, "Đặt AI_USAGE_WORKSPACE_ID trong .env của cổng 3100 (id workspace Account).");
}

export async function createUser({ name, maxBudgetUsd }) {
  const workspaceId = await resolveAdminWorkspaceId();
  const user = {
    id: randomBytes(6).toString("hex"),
    workspaceId,
    name,
    key: `sk-team-${randomBytes(16).toString("hex")}`,
    maxBudgetUsd,
    spendUsd: 0,
    blocked: false,
    createdAt: new Date().toISOString()
  };
  await query(
    `INSERT INTO ai_team_users (id, workspace_id, name, key, max_budget_usd, spend_usd, blocked, created_at)
     VALUES ($1, $2, $3, $4, $5, 0, false, $6)`,
    [user.id, user.workspaceId, user.name, user.key, user.maxBudgetUsd, user.createdAt]
  );
  return user;
}

export async function listUsers() {
  const workspaceId = await resolveAdminWorkspaceId();
  const result = await query(
    `SELECT id, workspace_id, name, key, max_budget_usd, spend_usd, blocked, created_at
     FROM ai_team_users WHERE workspace_id = $1 ORDER BY created_at ASC`,
    [workspaceId]
  );
  return result.rows.map((row) => {
    const user = mapUser(row);
    return { ...user, keyPreview: `${user.key.slice(0, 10)}…${user.key.slice(-4)}` };
  });
}

export async function blockUser(id, blocked = true) {
  const workspaceId = await resolveAdminWorkspaceId();
  const result = await query(
    `UPDATE ai_team_users SET blocked = $1 WHERE id = $2 AND workspace_id = $3
     RETURNING id, workspace_id, name, key, max_budget_usd, spend_usd, blocked, created_at`,
    [blocked, id, workspaceId]
  );
  return mapUser(result.rows[0]);
}

export async function setUserBudget(id, maxBudgetUsd) {
  const workspaceId = await resolveAdminWorkspaceId();
  const result = await query(
    `UPDATE ai_team_users SET max_budget_usd = $1 WHERE id = $2 AND workspace_id = $3
     RETURNING id, workspace_id, name, key, max_budget_usd, spend_usd, blocked, created_at`,
    [maxBudgetUsd, id, workspaceId]
  );
  return mapUser(result.rows[0]);
}

export async function loadVendorKeys(workspaceId) {
  const result = await query("SELECT vendor, secret FROM ai_vendor_secrets WHERE workspace_id = $1", [workspaceId]);
  const keys = {};
  for (const vendor of catalog.vendors) keys[vendor.id] = "";
  for (const row of result.rows) keys[row.vendor] = row.secret ?? "";
  return keys;
}

export async function setVendorKeys(input) {
  const workspaceId = await resolveAdminWorkspaceId();
  const allowed = new Set(catalog.vendors.map((item) => item.id));
  for (const [name, value] of Object.entries(input ?? {})) {
    if (!allowed.has(name) || typeof value !== "string" || !value.trim()) continue;
    await query(
      `INSERT INTO ai_vendor_secrets (workspace_id, vendor, secret, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (workspace_id, vendor) DO UPDATE SET secret = EXCLUDED.secret, updated_at = NOW()`,
      [workspaceId, name, value.trim()]
    );
  }
  return loadVendorKeys(workspaceId);
}

export async function vendorStatus() {
  const result = await query("SELECT vendor, secret FROM ai_vendor_secrets");
  const ready = {};
  for (const vendor of catalog.vendors) ready[vendor.id] = false;
  for (const row of result.rows) {
    if (vendorReady(row.secret)) ready[row.vendor] = true;
  }
  return ready;
}

export function assertBudget(user) {
  if (user.blocked) {
    throw fail(403, "Mã đã bị khóa.");
  }
  if (user.maxBudgetUsd > 0 && user.spendUsd >= user.maxBudgetUsd) {
    throw fail(402, "Hết trần. Báo admin nạp thêm hoặc nâng hạn.");
  }
}

export async function recordUse({ user, model, provider, inputTokens, outputTokens, usd, ok, error }) {
  const billed = typeof usd === "number" && Number.isFinite(usd) ? roundUsd(usd) : null;
  await withTransaction(async (client) => {
    if (ok && billed !== null) {
      await client.query(
        `UPDATE ai_team_users SET spend_usd = ROUND(($1 + spend_usd)::numeric, 6)
         WHERE id = $2 AND workspace_id = $3`,
        [billed, user.id, user.workspaceId]
      );
    }
    await client.query(
      `INSERT INTO ai_usage_logs (
         id, workspace_id, user_id, name, model, provider, input_tokens, output_tokens, usd, ok, error, at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        `log_${randomBytes(8).toString("hex")}`,
        user.workspaceId,
        user.id,
        user.name,
        model,
        provider,
        inputTokens,
        outputTokens,
        billed,
        ok,
        error ?? null
      ]
    );
    const extra = await client.query(
      `SELECT id FROM ai_usage_logs WHERE workspace_id = $1 ORDER BY at DESC OFFSET 200`,
      [user.workspaceId]
    );
    if (extra.rows.length > 0) {
      await client.query(`DELETE FROM ai_usage_logs WHERE id = ANY($1::text[]) AND workspace_id = $2`, [
        extra.rows.map((row) => row.id),
        user.workspaceId
      ]);
    }
  });
}

export async function listLogs() {
  const workspaceId = await resolveAdminWorkspaceId();
  const result = await query(
    `SELECT at, name, model, provider, input_tokens, output_tokens, usd, ok, error
     FROM ai_usage_logs WHERE workspace_id = $1 ORDER BY at DESC LIMIT 200`,
    [workspaceId]
  );
  return result.rows.map((row) => ({
    at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
    name: row.name,
    model: row.model,
    provider: row.provider,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    usd: row.usd === null || row.usd === undefined ? null : Number(row.usd),
    ok: row.ok,
    error: row.error
  }));
}

export function extractUserKey(req) {
  const header = String(req.headers.authorization ?? "");
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1];
  const apiKey = req.headers["x-api-key"] || req.headers["x-goog-api-key"];
  const queryKey = typeof req.query?.key === "string" ? req.query.key : "";
  return String(bearer || apiKey || queryKey || "").trim();
}

export function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text ?? "").length / 4));
}

export function priceUsd(model, inputTokens, outputTokens) {
  const names = litellmCandidateNames({
    id: model.id,
    provider: model.provider,
    upstream: model.upstream
  });
  return priceUsage(litellmModels(), {
    names,
    kind: model.kind,
    inputTokens,
    outputTokens
  });
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
