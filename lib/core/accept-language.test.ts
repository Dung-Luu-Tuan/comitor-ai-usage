import { describe, expect, it } from "vitest";
import { rankAcceptLanguage } from "./accept-language";

describe("rankAcceptLanguage", () => {
  it("header rỗng hoặc khuyết → danh sách rỗng", () => {
    expect(rankAcceptLanguage(null)).toEqual([]);
    expect(rankAcceptLanguage(undefined)).toEqual([]);
    expect(rankAcceptLanguage("")).toEqual([]);
  });

  /**
   * ⚠ Ca quan trọng nhất của cả file. `q` khuyết = `q=1`; coi nó là 0 thì dạng header phổ biến
   * nhất trên đời bị loại thẳng, và người dùng tiếng Anh không bao giờ nhận được tiếng Anh.
   */
  it("q khuyết nghĩa là q=1, không phải q=0", () => {
    expect(rankAcceptLanguage("en")).toEqual(["en"]);
    expect(rankAcceptLanguage("vi,en")).toEqual(["vi", "en"]);
  });

  it("hạ tag vùng về ngôn ngữ gốc", () => {
    expect(rankAcceptLanguage("en-US")).toEqual(["en"]);
    expect(rankAcceptLanguage("vi-VN,en-GB;q=0.8")).toEqual(["vi", "en"]);
  });

  it("sắp theo q giảm dần", () => {
    expect(rankAcceptLanguage("fr;q=0.2,en;q=0.9,ja;q=0.5")).toEqual(["en", "ja", "fr"]);
  });

  /** `q=0` trong RFC 9110 nghĩa là "KHÔNG chấp nhận" — giữ lại là chọn đúng thứ bị từ chối. */
  it("loại hẳn mục có q=0", () => {
    expect(rankAcceptLanguage("en;q=0,vi;q=0.5")).toEqual(["vi"]);
  });

  it("q hỏng (không phải số) bị coi như q=0", () => {
    expect(rankAcceptLanguage("en;q=abc,vi")).toEqual(["vi"]);
  });

  it("bỏ qua ký tự đại diện *", () => {
    expect(rankAcceptLanguage("*")).toEqual([]);
    expect(rankAcceptLanguage("vi,*;q=0.1")).toEqual(["vi"]);
  });

  it("chịu được khoảng trắng thừa và chữ hoa", () => {
    expect(rankAcceptLanguage("  EN-US ;  q=0.9 , VI ")).toEqual(["vi", "en"]);
  });

  /**
   * `Array.prototype.sort` ổn định từ ES2019: hai mục cùng `q` giữ nguyên thứ tự khai. Đó là điều
   * hàm này DỰA VÀO, nên khoá lại — không phải để canh V8, mà để lần sau ai đổi sang một phép sắp
   * khác thì test nói ra hệ quả.
   */
  it("cùng q thì giữ nguyên thứ tự người dùng khai", () => {
    expect(rankAcceptLanguage("ja;q=0.5,ko;q=0.5,zh;q=0.5")).toEqual(["ja", "ko", "zh"]);
  });

  it("giữ cả ngôn ngữ module không hỗ trợ — việc chọn là của tầng trên", () => {
    expect(rankAcceptLanguage("ja,fr")).toEqual(["ja", "fr"]);
  });
});
