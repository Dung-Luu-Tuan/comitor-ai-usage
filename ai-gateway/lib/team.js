import { randomBytes } from "node:crypto";
import { loadStore, saveStore, vendorReady } from "./store.js";

export const MODELS = [
  { id: "claude-sonnet-4-6", provider: "claude", label: "Claude Sonnet" },
  { id: "grok-3", provider: "grok", label: "Grok" },
  { id: "gemini-2.5-flash", provider: "gemini", label: "Gemini Flash" }
];

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
  "grok-3": "grok-3",
  "grok-3-latest": "grok-3",
  "grok-2": "grok-3",
  "grok-2-latest": "grok-3",
  "grok-beta": "grok-3",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.0-flash": "gemini-2.5-flash",
  "gemini-flash-latest": "gemini-2.5-flash",
  "gemini-1.5-flash": "gemini-2.5-flash"
};

export function resolveModel(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const aliased = ALIASES[raw] || ALIASES[lower];
  if (aliased) return MODELS.find((item) => item.id === aliased) ?? null;
  if (lower.includes("gemini")) return MODELS.find((item) => item.provider === "gemini") ?? null;
  if (lower.includes("grok")) return MODELS.find((item) => item.provider === "grok") ?? null;
  if (lower.includes("claude") || lower.includes("sonnet") || lower.includes("opus") || lower.includes("haiku")) {
    return MODELS.find((item) => item.provider === "claude") ?? null;
  }
  return MODELS.find((item) => item.id === raw) ?? null;
}

export function findUserByKey(rawKey) {
  const key = String(rawKey ?? "").trim();
  if (!key) return null;
  return loadStore().users.find((user) => user.key === key && !user.blocked) ?? null;
}

export function createUser({ name, maxBudgetUsd }) {
  const store = loadStore();
  const user = {
    id: randomBytes(6).toString("hex"),
    name,
    key: `sk-team-${randomBytes(16).toString("hex")}`,
    maxBudgetUsd,
    spendUsd: 0,
    blocked: false,
    createdAt: new Date().toISOString()
  };
  store.users.push(user);
  saveStore(store);
  return user;
}

export function listUsers() {
  return loadStore().users.map((user) => ({
    ...user,
    keyPreview: `${user.key.slice(0, 10)}…${user.key.slice(-4)}`
  }));
}

export function blockUser(id, blocked = true) {
  const store = loadStore();
  const user = store.users.find((item) => item.id === id);
  if (!user) return null;
  user.blocked = blocked;
  saveStore(store);
  return user;
}

export function setUserBudget(id, maxBudgetUsd) {
  const store = loadStore();
  const user = store.users.find((item) => item.id === id);
  if (!user) return null;
  user.maxBudgetUsd = maxBudgetUsd;
  saveStore(store);
  return user;
}

export function setVendorKeys(input) {
  const store = loadStore();
  for (const name of ["claude", "grok", "gemini"]) {
    if (typeof input[name] === "string" && input[name].trim()) {
      store.vendorKeys[name] = input[name].trim();
    }
  }
  saveStore(store);
  return store.vendorKeys;
}

export function vendorStatus() {
  const keys = loadStore().vendorKeys;
  return {
    claude: vendorReady(keys.claude),
    grok: vendorReady(keys.grok),
    gemini: vendorReady(keys.gemini)
  };
}

export function assertBudget(user) {
  if (user.blocked) {
    throw fail(403, "Mã đã bị khóa.");
  }
  if (user.maxBudgetUsd > 0 && user.spendUsd >= user.maxBudgetUsd) {
    throw fail(402, "Hết trần. Báo admin nạp thêm hoặc nâng hạn.");
  }
}

export function recordUse({ user, model, provider, inputTokens, outputTokens, usd, ok, error }) {
  const store = loadStore();
  const row = store.users.find((item) => item.id === user.id);
  if (row && ok) {
    row.spendUsd = roundUsd(row.spendUsd + usd);
  }
  store.logs.unshift({
    at: new Date().toISOString(),
    userId: user.id,
    name: user.name,
    model,
    provider,
    inputTokens,
    outputTokens,
    usd: roundUsd(usd),
    ok,
    error: error ?? null
  });
  store.logs = store.logs.slice(0, 200);
  saveStore(store);
}

export function listLogs() {
  return loadStore().logs;
}

export function extractUserKey(req) {
  const header = String(req.headers.authorization ?? "");
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1];
  const apiKey = req.headers["x-api-key"];
  return String(bearer || apiKey || "").trim();
}

export function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text ?? "").length / 4));
}

export function priceUsd(modelId, inputTokens, outputTokens) {
  const rates = {
    "claude-sonnet-4-6": { in: 3, out: 15 },
    "grok-3": { in: 3, out: 15 },
    "gemini-2.5-flash": { in: 0.15, out: 0.6 }
  };
  const rate = rates[modelId] ?? { in: 3, out: 15 };
  return roundUsd((inputTokens * rate.in + outputTokens * rate.out) / 1_000_000);
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
