import { describe, expect, it } from "vitest";
import { isTimeZone } from "./time-zone";

describe("isTimeZone", () => {
  it("nhận tên vùng IANA thường gặp", () => {
    expect(isTimeZone("Asia/Ho_Chi_Minh")).toBe(true);
    expect(isTimeZone("Europe/London")).toBe(true);
    expect(isTimeZone("America/New_York")).toBe(true);
    expect(isTimeZone("Australia/Sydney")).toBe(true);
  });

  it("nhận cả tên có BA đoạn", () => {
    // Bỏ qua đoạn thứ ba là loại thẳng cả một vùng có thật.
    expect(isTimeZone("America/Argentina/Buenos_Aires")).toBe(true);
  });

  it("⚠ nhận BÍ DANH — đây là lý do không dùng Intl.supportedValuesOf", () => {
    /*
     * `Asia/Ho_Chi_Minh` là bí danh của `Asia/Saigon` và KHÔNG có trong
     * `Intl.supportedValuesOf("timeZone")`. Nó cũng chính là `DEFAULT_TIME_ZONE` của repo — nên một
     * phép kiểm dựa vào danh sách đó sẽ loại bỏ đúng giá trị mặc định của chính mình.
     */
    expect(Intl.supportedValuesOf("timeZone")).not.toContain("Asia/Ho_Chi_Minh");
    expect(isTimeZone("Asia/Ho_Chi_Minh")).toBe(true);
  });

  it("từ chối giá trị không phải chuỗi và chuỗi rỗng", () => {
    expect(isTimeZone(undefined)).toBe(false);
    expect(isTimeZone(null)).toBe(false);
    expect(isTimeZone(7)).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });

  it("từ chối chuỗi đúng hình dạng nhưng KHÔNG phải vùng có thật", () => {
    // Qua được regex, nên chỉ `Intl` mới loại được — đây là ca chứng minh nhánh try/catch có việc.
    expect(isTimeZone("Asia/Khong_Co_That")).toBe(false);
    expect(isTimeZone("Mars/Olympus_Mons")).toBe(false);
  });

  it("từ chối những thứ Intl vốn rộng lượng chấp nhận", () => {
    // Không có dấu `/` — ta chỉ muốn tên VÙNG, không nhận viết tắt hay offset.
    expect(isTimeZone("UTC")).toBe(false);
    expect(isTimeZone("GMT")).toBe(false);
    expect(isTimeZone("+07:00")).toBe(false);
  });

  it("từ chối ký tự xuống dòng — giá trị này đi vào log", () => {
    expect(isTimeZone("Asia/Ho_Chi_Minh\n[auth] KHÔNG XOAY ĐƯỢC TOKEN")).toBe(false);
    expect(isTimeZone("Asia/\nHo_Chi_Minh")).toBe(false);
  });

  it("từ chối khoảng trắng thừa thay vì tự cắt", () => {
    // Cắt hộ là đoán ý người gọi; ở một phép kiểm bảo mật thì từ chối rõ ràng an toàn hơn.
    expect(isTimeZone(" Asia/Ho_Chi_Minh")).toBe(false);
    expect(isTimeZone("Asia/Ho_Chi_Minh ")).toBe(false);
  });
});
