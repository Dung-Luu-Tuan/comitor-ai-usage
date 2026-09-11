import "server-only";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AI_GATEWAY_ORIGIN, AI_VENDORS, isAiVendorId, isAiVendorSection } from "@/lib/catalog/ai-usage";
import type { AiUsageLogView, AiUsageSnapshot, AiUsageUserView, CreatedAiUsageUser } from "@/lib/contracts/ai-usage";
import type { CreateAiUsageUserInput, SetAiUsageVendorsInput } from "@/lib/core/ai-usage-input";
import { ApiError } from "@/lib/core/api-error";
import { prisma } from "@/lib/prisma";

/**
 * Key hãng, mã nội bộ và nhật ký — PostgreSQL schema `ai-usage` (cùng `DATABASE_URL` với phiên).
 *
 * Cổng Express 3100 đọc CÙNG ba bảng qua `pg`. File `ai-gateway/data/store.json` chỉ còn để nhập
 * một lần nếu workspace còn trống.
 */

interface LegacyStoreUser {
  id: string;
  name: string;
  key: string;
  maxBudgetUsd: number;
  spendUsd: number;
  blocked: boolean;
  createdAt: string;
}

interface LegacyStoreLog {
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

interface LegacyStore {
  vendorKeys: { claude: string; grok: string; gemini: string };
  users: LegacyStoreUser[];
  logs: LegacyStoreLog[];
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

function toUserView(user: {
  id: string;
  name: string;
  key: string;
  maxBudgetUsd: number;
  spendUsd: number;
  blocked: boolean;
  createdAt: Date;
}): AiUsageUserView {
  return {
    id: user.id,
    name: user.name,
    key: user.key,
    keyPreview: `${user.key.slice(0, 10)}…${user.key.slice(-4)}`,
    maxBudgetUsd: user.maxBudgetUsd,
    spendUsd: user.spendUsd,
    blocked: user.blocked,
    createdAt: user.createdAt.toISOString()
  };
}

function toLogView(
  row: {
    id: string;
    at: Date;
    userId: string;
    name: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    usd: number | null;
    ok: boolean;
    error: string | null;
  },
  keyPreview: string
): AiUsageLogView {
  return {
    id: row.id,
    at: row.at.toISOString(),
    userId: row.userId,
    name: row.name,
    keyPreview,
    model: row.model,
    provider: row.provider,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    usd: row.usd,
    ok: row.ok,
    error: row.error
  };
}

function legacyStorePath(): string {
  return join(process.cwd(), "ai-gateway", "data", "store.json");
}

function readLegacyStore(): LegacyStore | null {
  const path = legacyStorePath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<LegacyStore>;
    return {
      vendorKeys: {
        claude: parsed.vendorKeys?.claude ?? "",
        grok: parsed.vendorKeys?.grok ?? "",
        gemini: parsed.vendorKeys?.gemini ?? ""
      },
      users: Array.isArray(parsed.users) ? parsed.users : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : []
    };
  } catch {
    return null;
  }
}

async function importLegacyStoreIfEmpty(workspaceId: string): Promise<void> {
  const [userCount, secretCount] = await Promise.all([
    prisma.aiTeamUser.count({ where: { workspaceId } }),
    prisma.aiVendorSecret.count({ where: { workspaceId } })
  ]);
  if (userCount > 0 || secretCount > 0) return;

  const legacy = readLegacyStore();
  if (!legacy) return;
  const hasVendors =
    vendorReady(legacy.vendorKeys.claude) ||
    vendorReady(legacy.vendorKeys.grok) ||
    vendorReady(legacy.vendorKeys.gemini);
  if (!hasVendors && legacy.users.length === 0) return;

  await prisma.$transaction(async (tx) => {
    const again = await tx.aiTeamUser.count({ where: { workspaceId } });
    const secretsAgain = await tx.aiVendorSecret.count({ where: { workspaceId } });
    if (again > 0 || secretsAgain > 0) return;

    for (const [vendor, secret] of Object.entries(legacy.vendorKeys)) {
      await tx.aiVendorSecret.create({
        data: { workspaceId, vendor, secret }
      });
    }

    for (const user of legacy.users) {
      await tx.aiTeamUser.create({
        data: {
          id: user.id,
          workspaceId,
          name: user.name,
          key: user.key,
          maxBudgetUsd: user.maxBudgetUsd,
          spendUsd: user.spendUsd,
          blocked: user.blocked,
          createdAt: new Date(user.createdAt)
        }
      });
    }

    for (const row of legacy.logs.slice(0, 200)) {
      await tx.aiUsageLog.create({
        data: {
          workspaceId,
          userId: row.userId,
          name: row.name,
          model: row.model,
          provider: row.provider,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          usd: row.usd,
          ok: row.ok,
          error: row.error,
          at: new Date(row.at)
        }
      });
    }
  });
}

export async function getAiUsageSnapshot(workspaceId: string): Promise<AiUsageSnapshot> {
  await importLegacyStoreIfEmpty(workspaceId);

  const [secrets, users, logs] = await Promise.all([
    prisma.aiVendorSecret.findMany({ where: { workspaceId } }),
    prisma.aiTeamUser.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
    prisma.aiUsageLog.findMany({
      where: { workspaceId },
      orderBy: { at: "desc" },
      take: 200
    })
  ]);

  const byVendor = new Map(secrets.map((row) => [row.vendor, row.secret]));

  const userViews = users.map(toUserView);
  const keyPreviewByUserId = new Map(userViews.map((user) => [user.id, user.keyPreview]));

  return {
    gatewayOrigin: AI_GATEWAY_ORIGIN,
    vendors: AI_VENDORS.map((vendor) => {
      const secret = byVendor.get(vendor.id) ?? "";
      return {
        id: vendor.id,
        section: isAiVendorSection(vendor.section) ? vendor.section : "chat",
        ready: vendorReady(secret),
        preview: maskKey(secret),
        modalities: vendor.modalities
      };
    }),
    users: userViews,
    logs: logs.map((row) => toLogView(row, keyPreviewByUserId.get(row.userId) ?? ""))
  };
}

export async function setAiUsageVendors(workspaceId: string, input: SetAiUsageVendorsInput): Promise<AiUsageSnapshot> {
  for (const [vendor, value] of Object.entries(input)) {
    if (!isAiVendorId(vendor)) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    const secret = value.trim();
    await prisma.aiVendorSecret.upsert({
      where: { workspaceId_vendor: { workspaceId, vendor } },
      create: { workspaceId, vendor, secret },
      update: { secret }
    });
  }

  return getAiUsageSnapshot(workspaceId);
}

export async function createAiUsageUser(
  workspaceId: string,
  input: CreateAiUsageUserInput
): Promise<CreatedAiUsageUser> {
  const user = await prisma.aiTeamUser.create({
    data: {
      id: randomBytes(6).toString("hex"),
      workspaceId,
      name: input.name,
      key: `sk-team-${randomBytes(16).toString("hex")}`,
      maxBudgetUsd: input.maxBudget,
      spendUsd: 0,
      blocked: false
    }
  });
  return { user: toUserView(user), key: user.key };
}

export async function setAiUsageUserBudget(
  workspaceId: string,
  id: string,
  maxBudgetUsd: number
): Promise<AiUsageUserView> {
  const updated = await prisma.aiTeamUser.updateMany({
    where: { workspaceId, id },
    data: { maxBudgetUsd }
  });
  if (updated.count === 0) {
    throw ApiError.notFound();
  }
  const user = await prisma.aiTeamUser.findFirst({ where: { workspaceId, id } });
  if (!user) {
    throw ApiError.notFound();
  }
  return toUserView(user);
}

export async function setAiUsageUserBlocked(
  workspaceId: string,
  id: string,
  blocked: boolean
): Promise<AiUsageUserView> {
  const updated = await prisma.aiTeamUser.updateMany({
    where: { workspaceId, id },
    data: { blocked }
  });
  if (updated.count === 0) {
    throw ApiError.notFound();
  }
  const user = await prisma.aiTeamUser.findFirst({ where: { workspaceId, id } });
  if (!user) {
    throw ApiError.notFound();
  }
  return toUserView(user);
}
