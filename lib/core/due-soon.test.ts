import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_LEAD_DAYS, type DueSoonCandidate, selectDueSoon } from "./due-soon";

const base: DueSoonCandidate = {
  id: "t1",
  status: "todo",
  dueDate: "2026-09-03",
  remindBeforeDue: true,
  assigneeUserId: "u1"
};
const TODAY = "2026-09-02";

describe("selectDueSoon", () => {
  it("chọn việc tới hạn đúng sau `leadDays` ngày", () => {
    expect(selectDueSoon([base], TODAY).map((task) => task.id)).toEqual(["t1"]);
  });

  /**
   * ⚠ Phép kiểm quan trọng nhất của file. Điều kiện là BẰNG ĐÚNG, không phải "còn ≤ n ngày" — job
   * chạy mỗi ngày, nên `<=` sẽ nhắc lại việc đó mỗi ngày cho tới hạn.
   */
  it("KHÔNG nhắc lại việc còn nhiều hơn `leadDays` ngày, và không nhắc việc còn ít hơn", () => {
    expect(selectDueSoon([{ ...base, dueDate: "2026-09-05" }], TODAY)).toEqual([]);
    expect(selectDueSoon([{ ...base, dueDate: "2026-09-02" }], TODAY)).toEqual([]);
  });

  it("KHÔNG nhắc việc đã QUÁ HẠN — nhắc thêm chỉ là phiền", () => {
    expect(selectDueSoon([{ ...base, dueDate: "2026-08-30" }], TODAY)).toEqual([]);
  });

  it("KHÔNG nhắc việc đã xong, việc không bật cờ, việc chưa giao cho ai", () => {
    expect(selectDueSoon([{ ...base, status: "done" }], TODAY)).toEqual([]);
    expect(selectDueSoon([{ ...base, remindBeforeDue: false }], TODAY)).toEqual([]);
    expect(selectDueSoon([{ ...base, assigneeUserId: null }], TODAY)).toEqual([]);
  });

  it("đi qua biên tháng và biên năm", () => {
    expect(selectDueSoon([{ ...base, dueDate: "2026-10-01" }], "2026-09-30").map((t) => t.id)).toEqual(["t1"]);
    expect(selectDueSoon([{ ...base, dueDate: "2027-01-01" }], "2026-12-31").map((t) => t.id)).toEqual(["t1"]);
  });

  it("`leadDays` khác mặc định vẫn đúng", () => {
    expect(selectDueSoon([{ ...base, dueDate: "2026-09-09" }], TODAY, 7).map((t) => t.id)).toEqual(["t1"]);
    expect(selectDueSoon([{ ...base, dueDate: "2026-09-02" }], TODAY, 0).map((t) => t.id)).toEqual(["t1"]);
  });

  it("dữ liệu rác KHÔNG làm nổ job — trả mảng rỗng, không ném", () => {
    expect(selectDueSoon([base], "không-phải-ngày")).toEqual([]);
    expect(selectDueSoon([{ ...base, dueDate: "rác" }], TODAY)).toEqual([]);
    expect(selectDueSoon([base], TODAY, -1)).toEqual([]);
    expect(selectDueSoon([base], TODAY, 1.5)).toEqual([]);
  });

  it("mặc định là MỘT ngày", () => {
    expect(DEFAULT_REMINDER_LEAD_DAYS).toBe(1);
  });
});
