import { describe, expect, it } from "vitest";
import { BUDGET_WARNING_RATIO, budgetBarTone, budgetUsedPercent } from "./ai-usage-budget";

describe("budgetUsedPercent", () => {
  it("tran 0 (khong gioi han) cho 0", () => {
    expect(budgetUsedPercent(4, 0)).toBe(0);
  });

  it("chua dung gi cho 0", () => {
    expect(budgetUsedPercent(0, 10)).toBe(0);
  });

  it("lam tron nua len", () => {
    expect(budgetUsedPercent(1, 8)).toBe(13);
  });

  it("kep 100 khi vuot tran", () => {
    expect(budgetUsedPercent(15, 10)).toBe(100);
  });

  it("NaN va so am khong thanh NaN tren giao dien", () => {
    expect(budgetUsedPercent(Number.NaN, 10)).toBe(0);
    expect(budgetUsedPercent(5, Number.NaN)).toBe(0);
    expect(budgetUsedPercent(-1, 10)).toBe(0);
    expect(budgetUsedPercent(5, -2)).toBe(0);
  });
});

describe("budgetBarTone", () => {
  it("default duoi nguong canh bao", () => {
    expect(budgetBarTone(7.9, 10)).toBe("default");
  });

  it("warning tu dung ti le nguong", () => {
    expect(BUDGET_WARNING_RATIO).toBe(0.8);
    expect(budgetBarTone(8, 10)).toBe("warning");
    expect(budgetBarTone(9.9, 10)).toBe("warning");
  });

  it("destructive khi cham hoac vuot tran", () => {
    expect(budgetBarTone(10, 10)).toBe("destructive");
    expect(budgetBarTone(12, 10)).toBe("destructive");
  });

  it("khong gioi han khong canh bao", () => {
    expect(budgetBarTone(999, 0)).toBe("default");
  });
});
