import { describe, expect, it } from "vitest";
import type { AiUsageLogView, AiUsageUserView } from "@/lib/contracts/ai-usage";
import {
  countActiveAiUsageLogFilters,
  EMPTY_AI_USAGE_LOG_FILTER,
  filterAiUsageLogs,
  matchesAiUsageLog,
  summarizeUsageByPerson,
  uniqueSortedStrings
} from "./ai-usage-log-filter";

const USER_A: AiUsageUserView = {
  id: "u-a",
  name: "An",
  key: "sk-team-aaaa",
  keyPreview: "sk-team-aa…aaaa",
  maxBudgetUsd: 10,
  spendUsd: 1.5,
  blocked: false,
  createdAt: "2026-09-01T00:00:00.000Z"
};

const USER_B: AiUsageUserView = {
  id: "u-b",
  name: "Binh",
  key: "sk-team-bbbb",
  keyPreview: "sk-team-bb…bbbb",
  maxBudgetUsd: 0,
  spendUsd: 0.2,
  blocked: true,
  createdAt: "2026-09-02T00:00:00.000Z"
};

function log(partial: Partial<AiUsageLogView> & Pick<AiUsageLogView, "id" | "userId" | "name">): AiUsageLogView {
  return {
    at: "2026-09-11T07:00:00.000Z",
    keyPreview: partial.userId === "u-b" ? USER_B.keyPreview : USER_A.keyPreview,
    model: "gemini-3.6-flash",
    provider: "gemini",
    inputTokens: 10,
    outputTokens: 5,
    usd: 0.001,
    ok: true,
    error: null,
    ...partial
  };
}

describe("countActiveAiUsageLogFilters", () => {
  it("bo loc rong dem 0", () => {
    expect(countActiveAiUsageLogFilters(EMPTY_AI_USAGE_LOG_FILTER)).toBe(0);
  });

  it("dem NHOM, khong dem gia tri", () => {
    expect(
      countActiveAiUsageLogFilters({
        ...EMPTY_AI_USAGE_LOG_FILTER,
        userIds: ["u-a", "u-b"],
        models: ["gemini-3.6-flash", "gpt-4o"]
      })
    ).toBe(2);
  });

  it("khoang trang khong tinh la search", () => {
    expect(countActiveAiUsageLogFilters({ ...EMPTY_AI_USAGE_LOG_FILTER, search: "   " })).toBe(0);
  });
});

describe("matchesAiUsageLog", () => {
  const row = log({ id: "l-1", userId: "u-a", name: "An" });

  it("mang rong khong loc", () => {
    expect(matchesAiUsageLog(row, EMPTY_AI_USAGE_LOG_FILTER)).toBe(true);
  });

  it("loc userIds", () => {
    expect(matchesAiUsageLog(row, { ...EMPTY_AI_USAGE_LOG_FILTER, userIds: ["u-b"] })).toBe(false);
    expect(matchesAiUsageLog(row, { ...EMPTY_AI_USAGE_LOG_FILTER, userIds: ["u-a"] })).toBe(true);
  });

  it("search khong phan biet hoa thuong, gop khoang trang", () => {
    expect(matchesAiUsageLog(row, { ...EMPTY_AI_USAGE_LOG_FILTER, search: "  gemini-3.6 " })).toBe(true);
    expect(matchesAiUsageLog(row, { ...EMPTY_AI_USAGE_LOG_FILTER, search: "claude" })).toBe(false);
  });

  it("search khop ma rut gon va cau loi", () => {
    const failed = log({
      id: "l-err",
      userId: "u-a",
      name: "An",
      ok: false,
      error: "over cap"
    });
    expect(matchesAiUsageLog(failed, { ...EMPTY_AI_USAGE_LOG_FILTER, search: "sk-team-aa" })).toBe(true);
    expect(matchesAiUsageLog(failed, { ...EMPTY_AI_USAGE_LOG_FILTER, search: "over cap" })).toBe(true);
  });

  it("results ok/error", () => {
    const failed = log({ id: "l-2", userId: "u-a", name: "An", ok: false, error: "nope" });
    expect(matchesAiUsageLog(row, { ...EMPTY_AI_USAGE_LOG_FILTER, results: ["error"] })).toBe(false);
    expect(matchesAiUsageLog(failed, { ...EMPTY_AI_USAGE_LOG_FILTER, results: ["error"] })).toBe(true);
    expect(matchesAiUsageLog(failed, { ...EMPTY_AI_USAGE_LOG_FILTER, results: ["ok", "error"] })).toBe(true);
  });
});

describe("filterAiUsageLogs", () => {
  it("khong sua mang dau vao", () => {
    const rows = [log({ id: "l-1", userId: "u-a", name: "An" })];
    const frozen = Object.freeze([...rows]);
    const out = filterAiUsageLogs(frozen, { ...EMPTY_AI_USAGE_LOG_FILTER, models: ["gpt-4o"] });
    expect(out).toEqual([]);
    expect(frozen).toHaveLength(1);
  });
});

describe("summarizeUsageByPerson", () => {
  const logs: AiUsageLogView[] = [
    log({ id: "l-1", userId: "u-a", name: "An", usd: 0.1, inputTokens: 20, outputTokens: 4 }),
    log({ id: "l-2", userId: "u-a", name: "An", ok: false, error: "x", usd: 0, model: "gpt-4o", provider: "openai" }),
    log({ id: "l-3", userId: "u-b", name: "Binh", usd: 0.05 })
  ];

  it("nguoi khong co log van co hang, so luot 0", () => {
    const ghost: AiUsageUserView = { ...USER_A, id: "u-c", name: "Cuong", keyPreview: "sk-team-cc…cccc" };
    const rows = summarizeUsageByPerson([ghost], [], EMPTY_AI_USAGE_LOG_FILTER);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.callCount).toBe(0);
    expect(rows[0]?.spendUsd).toBe(ghost.spendUsd);
  });

  it("gom dung theo userId, giu spend tu ma", () => {
    const rows = summarizeUsageByPerson([USER_A, USER_B], logs, EMPTY_AI_USAGE_LOG_FILTER);
    const an = rows.find((row) => row.userId === "u-a");
    expect(an?.callCount).toBe(2);
    expect(an?.okCount).toBe(1);
    expect(an?.errorCount).toBe(1);
    expect(an?.inputTokens).toBe(30);
    expect(an?.logUsd).toBeCloseTo(0.1);
    expect(an?.spendUsd).toBe(1.5);
    expect(an?.keyPreview).toBe(USER_A.keyPreview);
  });

  it("usd null khong cong vao logUsd", () => {
    const rows = summarizeUsageByPerson(
      [USER_A],
      [log({ id: "l-null", userId: "u-a", name: "An", usd: null, inputTokens: 8, outputTokens: 2 })],
      EMPTY_AI_USAGE_LOG_FILTER
    );
    expect(rows[0]?.logUsd).toBe(0);
    expect(rows[0]?.inputTokens).toBe(8);
  });

  it("loc model chi doi so luot, khong doi hang nguoi khac userIds", () => {
    const rows = summarizeUsageByPerson([USER_A, USER_B], logs, {
      ...EMPTY_AI_USAGE_LOG_FILTER,
      models: ["gpt-4o"]
    });
    expect(rows.map((row) => row.userId)).toEqual(["u-a", "u-b"]);
    expect(rows[0]?.callCount).toBe(1);
    expect(rows[1]?.callCount).toBe(0);
  });

  it("userIds an nguoi khong chon", () => {
    const rows = summarizeUsageByPerson([USER_A, USER_B], logs, {
      ...EMPTY_AI_USAGE_LOG_FILTER,
      userIds: ["u-b"]
    });
    expect(rows.map((row) => row.userId)).toEqual(["u-b"]);
  });
});

describe("uniqueSortedStrings", () => {
  it("bo trung va sap theo ma ky tu", () => {
    expect(uniqueSortedStrings(["gpt-4o", "gemini-3.6-flash", "gpt-4o"])).toEqual(["gemini-3.6-flash", "gpt-4o"]);
  });
});
