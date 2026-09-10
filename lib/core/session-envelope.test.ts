import { describe, expect, it } from "vitest";
import { isSessionShape, parseEnvelope } from "./session-envelope";

/* Phong bì hợp lệ: 16 ký tự (IV 12 byte) · 22 ký tự (thẻ 16 byte) · thân bất kỳ. */
const IV = "A".repeat(16);
const TAG = "B".repeat(22);
const BODY = "Q2hhbw";
const VALID = `${IV}.${TAG}.${BODY}`;

describe("parseEnvelope", () => {
  it("nhận phong bì đúng ba mảnh, đúng độ dài", () => {
    expect(parseEnvelope(VALID)).toEqual({ iv: IV, tag: TAG, body: BODY });
  });

  /*
   * Ca này là lý do file tồn tại. Khuôn cũ `const [a = "", b = "", c = ""] = raw.split(".")` bỏ QUA
   * mảnh thứ tư trong im lặng, nên hai định dạng phong bì cùng tồn tại mà không ai biết.
   */
  it("từ chối mảnh THỪA", () => {
    expect(parseEnvelope(`${VALID}.rac`)).toBeNull();
    expect(parseEnvelope(`${VALID}.`)).toBeNull();
  });

  it("từ chối thiếu mảnh", () => {
    expect(parseEnvelope(`${IV}.${TAG}`)).toBeNull();
    expect(parseEnvelope(IV)).toBeNull();
    expect(parseEnvelope("")).toBeNull();
  });

  /*
   * Đã đo trên Node 24: `decipher.setAuthTag()` NHẬN thẻ 4 byte và vẫn giải mã thành công — lớp xác
   * thực tụt từ 2^127 xuống 2^31 lần thử, và thứ duy nhất Node nói là một DeprecationWarning không
   * bao giờ tới production.
   */
  it("từ chối thẻ xác thực NGẮN", () => {
    for (const bytes of [4, 8, 12, 15]) {
      const shortTag = "B".repeat(Math.ceil((bytes * 4) / 3));
      expect(parseEnvelope(`${IV}.${shortTag}.${BODY}`)).toBeNull();
    }
  });

  it("từ chối thẻ DÀI hơn 16 byte", () => {
    expect(parseEnvelope(`${IV}.${"B".repeat(23)}.${BODY}`)).toBeNull();
  });

  it("từ chối IV sai độ dài", () => {
    expect(parseEnvelope(`${"A".repeat(15)}.${TAG}.${BODY}`)).toBeNull();
    expect(parseEnvelope(`${"A".repeat(22)}.${TAG}.${BODY}`)).toBeNull();
  });

  it("từ chối thân rỗng", () => {
    expect(parseEnvelope(`${IV}.${TAG}.`)).toBeNull();
  });

  /* base64url KHÔNG có `+`, `/`, `=` — chuỗi mang chúng là chuỗi từ một định dạng khác. */
  it("từ chối ký tự ngoài bảng base64url", () => {
    expect(parseEnvelope(`${"A".repeat(15)}+.${TAG}.${BODY}`)).toBeNull();
    expect(parseEnvelope(`${IV}.${"B".repeat(21)}=.${BODY}`)).toBeNull();
    expect(parseEnvelope(`${IV}.${TAG}.a/b`)).toBeNull();
  });
});

describe("isSessionShape", () => {
  it("nhận phiên tối thiểu dùng được", () => {
    expect(isSessionShape({ tokens: { accessToken: "at" } })).toBe(true);
  });

  it("cho trường lạ đi qua — chủ ý, để không chép hợp đồng SDK xuống tầng 1", () => {
    expect(isSessionShape({ tokens: { accessToken: "at", scope: "openid", truongMoi: 1 }, userId: "u" })).toBe(true);
  });

  /*
   * Bốn giá trị này đều đi qua `JSON.parse(...) as StoredSession` của bản trước, và trở thành một
   * "phiên" mà `stored.tokens` là `undefined`.
   */
  it("từ chối thứ KHÔNG phải object phiên", () => {
    for (const value of ["chuoi", 42, true, null, [], [{ tokens: { accessToken: "at" } }], {}]) {
      expect(isSessionShape(value)).toBe(false);
    }
  });

  it("từ chối tokens sai hình dạng", () => {
    expect(isSessionShape({ tokens: null })).toBe(false);
    expect(isSessionShape({ tokens: "at" })).toBe(false);
    expect(isSessionShape({ tokens: [] })).toBe(false);
    expect(isSessionShape({ tokens: {} })).toBe(false);
  });

  it("từ chối accessToken rỗng hoặc sai kiểu", () => {
    expect(isSessionShape({ tokens: { accessToken: "" } })).toBe(false);
    expect(isSessionShape({ tokens: { accessToken: 123 } })).toBe(false);
  });
});
