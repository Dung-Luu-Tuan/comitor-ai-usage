import { describe, expect, it } from "vitest";
import { isLoopbackHost, LOOPBACK_HOSTS, normalizeHost } from "./url";

describe("normalizeHost", () => {
  it("hạ chữ thường", () => {
    expect(normalizeHost("LocalHost")).toBe("localhost");
    expect(normalizeHost("TASKS.COMITOR.AI")).toBe("tasks.comitor.ai");
  });

  it("cắt dấu chấm cuối — kể cả nhiều dấu", () => {
    expect(normalizeHost("localhost.")).toBe("localhost");
    expect(normalizeHost("localhost...")).toBe("localhost");
  });

  it("không đụng vào dấu chấm ở giữa", () => {
    expect(normalizeHost("a.b.c")).toBe("a.b.c");
  });

  it("idempotent — chạy hai lần cho cùng kết quả", () => {
    const once = normalizeHost("LocalHost.");
    expect(normalizeHost(once)).toBe(once);
  });
});

describe("isLoopbackHost", () => {
  it("nhận bốn dạng loopback thường gặp", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
  });

  /**
   * ⚠ Ca này là lý do `LOOPBACK_HOSTS` khai IPv6 hai lần. `URL.hostname` trả về dạng có ngoặc
   * vuông, còn người gõ `.env` thì viết dạng trần — thiếu một dạng là app từ chối khởi động trên
   * một cấu hình hoàn toàn hợp lệ.
   */
  it("nhận IPv6 cả dạng có ngoặc vuông (dạng mà URL.hostname trả về)", () => {
    expect(new URL("http://[::1]:3000").hostname).toBe("[::1]");
    expect(isLoopbackHost("[::1]")).toBe(true);
  });

  /** Đối chứng âm tính: dấu chấm cuối KHÔNG được dùng làm đường vòng theo cả hai hướng. */
  it("dấu chấm cuối vẫn là loopback, và host thật vẫn không phải", () => {
    expect(isLoopbackHost("localhost.")).toBe(true);
    expect(isLoopbackHost("tasks.comitor.ai")).toBe(false);
    expect(isLoopbackHost("localhost.evil.com")).toBe(false);
  });

  it("phân biệt hoa thường không làm thay đổi kết quả", () => {
    expect(isLoopbackHost("LOCALHOST")).toBe(true);
  });

  it("LOOPBACK_HOSTS được xuất ra để lib/env.ts và test dùng chung một danh sách", () => {
    expect(LOOPBACK_HOSTS.has("localhost")).toBe(true);
  });
});
