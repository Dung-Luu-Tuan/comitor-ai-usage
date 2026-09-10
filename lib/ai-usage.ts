import "server-only";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AI_GATEWAY_ORIGIN } from "@/lib/catalog/ai-usage";
import type { AiUsageLogView, AiUsageSnapshot, AiUsageUserView, CreatedAiUsageUser } from "@/lib/contracts/ai-usage";
import type { CreateAiUsageUserInput, SetAiUsageVendorsInput } from "@/lib/core/ai-usage-input";
import { ApiError } from "@/lib/core/api-error";

/**
 * Đọc/ghi `ai-gateway/data/store.json` — CÙNG file mà tiến trình Express cổng 3100 dùng.
 *
 * ⚠ Không đưa sang Prisma: đây không phải dữ liệu theo `workspaceId` của module Công việc. Cổng
 * LLM phải đọc được key khi Claude Code gọi vào, kể cả khi không có phiên Account.
 */

interface StoreUser {
  id: string;
  name: string;
  key: string;
  maxBudgetUsd: number;
  spendUsd: number;
  blocked: boolean;
  createdAt: string;
}

interface StoreLog {
  at: string;
  userId: string;
  name: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  usd: number;
  ok: boolean;
  error: string | null;
}

interface Store {
  vendorKeys: { claude: string; grok: string; gemini: string };
  users: StoreUser[];
  logs: StoreLog[];
}

function emptyStore(): Store {
  return { vendorKeys: { claude: "", grok: "", gemini: "" }, users: [], logs: [] };
}

function storePath(): string {
  return join(process.cwd(), "ai-gateway", "data", "store.json");
}

function normalize(raw: unknown): Store {
  const empty = emptyStore();
  const parsed = raw && typeof raw === "object" ? (raw as Partial<Store>) : {};
  return {
    vendorKeys: { ...empty.vendorKeys, ...(parsed.vendorKeys ?? {}) },
    users: Array.isArray(parsed.users) ? parsed.users : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : []
  };
}

function loadStore(): Store {
  const path = storePath();
  mkdirSync(join(process.cwd(), "ai-gateway", "data"), { recursive: true });
  if (!existsSync(path)) {
    saveStore(emptyStore());
  }
  try {
    return normalize(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return emptyStore();
  }
}

function saveStore(store: Store): void {
  const path = storePath();
  mkdirSync(join(process.cwd(), "ai-gateway", "data"), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(normalize(store), null, 2)}\n`);
  renameSync(tmp, path);
}

function maskKey(key: string): string {
  const value = key.trim();
  if (value.length < 12) return value ? "••••" : "";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function vendorReady(key: string): boolean {
  const value = key.trim();
  return value.length > 12 && !/placeholder|chua-co|example/i.test(value);
}

function toUserView(user: StoreUser): AiUsageUserView {
  return {
    id: user.id,
    name: user.name,
    keyPreview: `${user.key.slice(0, 10)}…${user.key.slice(-4)}`,
    maxBudgetUsd: user.maxBudgetUsd,
    spendUsd: user.spendUsd,
    blocked: user.blocked,
    createdAt: user.createdAt
  };
}

function toLogView(row: StoreLog): AiUsageLogView {
  return {
    at: row.at,
    name: row.name,
    model: row.model,
    provider: row.provider,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    usd: row.usd,
    ok: row.ok,
    error: row.error
  };
}

export function getAiUsageSnapshot(): AiUsageSnapshot {
  const store = loadStore();
  return {
    gatewayOrigin: AI_GATEWAY_ORIGIN,
    vendorKeys: {
      claude: vendorReady(store.vendorKeys.claude),
      grok: vendorReady(store.vendorKeys.grok),
      gemini: vendorReady(store.vendorKeys.gemini)
    },
    vendorPreview: {
      claude: maskKey(store.vendorKeys.claude),
      grok: maskKey(store.vendorKeys.grok),
      gemini: maskKey(store.vendorKeys.gemini)
    },
    users: store.users.map(toUserView),
    logs: store.logs.map(toLogView)
  };
}

export function setAiUsageVendors(input: SetAiUsageVendorsInput): AiUsageSnapshot {
  const store = loadStore();
  for (const name of ["claude", "grok", "gemini"] as const) {
    const value = input[name];
    if (typeof value === "string" && value.trim()) {
      store.vendorKeys[name] = value.trim();
    }
  }
  saveStore(store);
  return getAiUsageSnapshot();
}

export function createAiUsageUser(input: CreateAiUsageUserInput): CreatedAiUsageUser {
  const store = loadStore();
  const user: StoreUser = {
    id: randomBytes(6).toString("hex"),
    name: input.name,
    key: `sk-team-${randomBytes(16).toString("hex")}`,
    maxBudgetUsd: input.maxBudget,
    spendUsd: 0,
    blocked: false,
    createdAt: new Date().toISOString()
  };
  store.users.push(user);
  saveStore(store);
  return { user: toUserView(user), key: user.key };
}

export function setAiUsageUserBudget(id: string, maxBudgetUsd: number): AiUsageUserView {
  const store = loadStore();
  const user = store.users.find((item) => item.id === id);
  if (!user) {
    throw ApiError.notFound();
  }
  user.maxBudgetUsd = maxBudgetUsd;
  saveStore(store);
  return toUserView(user);
}

export function setAiUsageUserBlocked(id: string, blocked: boolean): AiUsageUserView {
  const store = loadStore();
  const user = store.users.find((item) => item.id === id);
  if (!user) {
    throw ApiError.notFound();
  }
  user.blocked = blocked;
  saveStore(store);
  return toUserView(user);
}
