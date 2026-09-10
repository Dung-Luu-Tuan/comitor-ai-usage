import { describe, expect, it } from "vitest";
import { nextProjectCode, suggestProjectCode } from "./project-code";

describe("suggestProjectCode", () => {
  it("lấy chữ đầu của hai từ đầu tiên", () => {
    expect(suggestProjectCode("Nen tang dung chung")).toBe("NT");
    expect(suggestProjectCode("Bo bao cao")).toBe("BB");
  });

  /**
   * ⚠ Lý do file này tồn tại. Tên dự án ở một sản phẩm Việt Nam gần như luôn có dấu, và một phép
   * cắt chuỗi ngây thơ cho ra `NỀ` — thứ không dùng được làm nhãn trục X, và không gõ lại được.
   */
  it("bỏ dấu tiếng Việt", () => {
    expect(suggestProjectCode("Nền tảng dùng chung")).toBe("NT");
    expect(suggestProjectCode("Ứng dụng di động")).toBe("UD");
    expect(suggestProjectCode("Hạ tầng")).toBe("HT");
  });

  /** `đ` KHÔNG phân tách được bằng NFD — nó là một chữ cái riêng, phải đổi bằng tay. */
  it("xử lý được chữ đ và Đ", () => {
    expect(suggestProjectCode("Đường dẫn")).toBe("DD");
    expect(suggestProjectCode("đo lường")).toBe("DL");
  });

  it("tên MỘT từ thì lấy hai chữ đầu của chính nó", () => {
    expect(suggestProjectCode("Marketing")).toBe("MA");
    expect(suggestProjectCode("Kho")).toBe("KH");
  });

  it("tên quá ngắn thì đệm, tên không có chữ cái thì null", () => {
    expect(suggestProjectCode("A")).toBe("AX");
    expect(suggestProjectCode("   ")).toBeNull();
    expect(suggestProjectCode("!!! ???")).toBeNull();
    expect(suggestProjectCode("")).toBeNull();
  });
});

describe("nextProjectCode", () => {
  it("trả mã suy được khi nó còn trống", () => {
    expect(nextProjectCode("Nền tảng dùng chung", [])).toBe("NT");
  });

  /**
   * ⚠ Hai dự án bắt đầu bằng cùng hai chữ là chuyện BÌNH THƯỜNG. Không né thì mọi lần tạo dự án
   * thứ hai đều đỏ vì `@@unique([workspaceId, code])`.
   */
  it("né mã đã bị dùng, GIỮ chữ đầu vì nó mang nghĩa", () => {
    expect(nextProjectCode("Nền tảng dùng chung", ["NT"])).toBe("NA");
    expect(nextProjectCode("Nền tảng dùng chung", ["NT", "NA", "NB"])).toBe("NC");
  });

  it("so sánh KHÔNG phân biệt hoa thường và bỏ khoảng trắng", () => {
    expect(nextProjectCode("Nền tảng", ["nt", "  NA  "])).toBe("NB");
  });

  it("hết chữ cái thì rơi về chữ số", () => {
    const taken = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => `N${c}`);
    expect(nextProjectCode("Nền tảng", [...taken, "NT"])).toBe("N0");
  });

  it("hết sạch thì trả null — nơi gọi phải xử lý, không nhận một mã trùng", () => {
    const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("").map((c) => `N${c}`);
    expect(nextProjectCode("Nền tảng", all)).toBeNull();
    expect(nextProjectCode("???", [])).toBeNull();
  });
});
