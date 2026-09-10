import { describe, expect, it } from "vitest";
import { REQUEST_ID_HEADER, toRequestId } from "./request-id";

describe("toRequestId", () => {
  it("giữ nguyên id hợp lệ từ phía gọi — đó là cách một request giữ cùng sợi chỉ qua nhiều dịch vụ", () => {
    expect(toRequestId("abc123XYZ_-def")).toBe("abc123XYZ_-def");
    expect(toRequestId("  abc123XYZ  ")).toBe("abc123XYZ");
  });

  /**
   * ⚠ Phép kiểm quan trọng nhất của file. Giá trị này đến từ client và đi thẳng vào log; một ký tự
   * xuống dòng cài trong đó bẻ một dòng log thành hai dòng giả — đủ để dựng một sự kiện chưa từng
   * xảy ra, mang đúng khuôn của những dòng viết HOA mà repo dùng làm hợp đồng grep/alert.
   */
  it("TỪ CHỐI giá trị mang xuống dòng, khoảng trắng, hay ký tự điều khiển", () => {
    const bad = ["abc\ndef12345", "abc\r\n[auth] KHONG XOAY DUOC TOKEN", "abc def12345", "abc\tdef12345"];
    for (const value of bad) {
      expect(toRequestId(value)).not.toBe(value);
      expect(toRequestId(value)).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("TỪ CHỐI giá trị quá ngắn hoặc quá dài", () => {
    expect(toRequestId("abc")).not.toBe("abc");
    expect(toRequestId("a".repeat(65))).not.toBe("a".repeat(65));
    expect(toRequestId("a".repeat(64))).toBe("a".repeat(64));
  });

  it("sinh mới khi không có gì đến từ ngoài", () => {
    for (const missing of [null, undefined, ""]) {
      expect(toRequestId(missing)).toMatch(/^[A-Za-z0-9_-]{8,}$/);
    }
  });

  it("hai lần sinh không trùng nhau", () => {
    const ids = new Set(Array.from({ length: 200 }, () => toRequestId(null)));
    expect(ids.size).toBe(200);
  });

  it("tên header là hằng của cả hệ, không đọc từ cấu hình", () => {
    expect(REQUEST_ID_HEADER).toBe("x-request-id");
  });
});
