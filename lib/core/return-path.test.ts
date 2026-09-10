import { describe, expect, it } from "vitest";
import { toSafeInternalPath } from "./return-path";

describe("toSafeInternalPath", () => {
  it("nhận đường dẫn nội bộ thường gặp", () => {
    expect(toSafeInternalPath("/tasks")).toBe("/tasks");
    expect(toSafeInternalPath("/tasks/new")).toBe("/tasks/new");
    expect(toSafeInternalPath("/settings/permissions")).toBe("/settings/permissions");
    expect(toSafeInternalPath("/")).toBe("/");
  });

  it("giữ nguyên query — bộ lọc của /tasks nằm trong đó", () => {
    expect(toSafeInternalPath("/tasks?status=open&page=3")).toBe("/tasks?status=open&page=3");
  });

  it("cắt mảnh neo, vì máy chủ không bao giờ nhận được nó", () => {
    expect(toSafeInternalPath("/tasks#CV-016")).toBe("/tasks");
    expect(toSafeInternalPath("/tasks?page=2#CV-016")).toBe("/tasks?page=2");
  });

  it("cắt khoảng trắng thừa", () => {
    expect(toSafeInternalPath("  /tasks  ")).toBe("/tasks");
  });

  /**
   * ⚠ Bốn phép kiểm dưới đây là lý do file này tồn tại. Mỗi cái là một cách biến trang đăng nhập
   * của chính mình thành bàn đạp đưa người dùng sang trang lừa đảo.
   */
  it("TỪ CHỐI URL giao thức tương đối — cách vượt rào phổ biến nhất", () => {
    expect(toSafeInternalPath("//trang-gia-mao.vn")).toBeNull();
    expect(toSafeInternalPath("//trang-gia-mao.vn/dang-nhap")).toBeNull();
  });

  it("TỪ CHỐI biến thể dấu chéo ngược — trình duyệt đổi `\\` thành `/` trước khi phân giải", () => {
    expect(toSafeInternalPath("/\\trang-gia-mao.vn")).toBeNull();
    expect(toSafeInternalPath("/\\/trang-gia-mao.vn")).toBeNull();
  });

  it("TỪ CHỐI URL tuyệt đối, kể cả khi cùng giao thức", () => {
    expect(toSafeInternalPath("https://trang-gia-mao.vn")).toBeNull();
    expect(toSafeInternalPath("http://localhost:3000/tasks")).toBeNull();
    expect(toSafeInternalPath("javascript:alert(1)")).toBeNull();
    expect(toSafeInternalPath("data:text/html,<script>")).toBeNull();
  });

  it("TỪ CHỐI ký tự điều khiển — chúng dùng để chèn thêm dòng header", () => {
    expect(toSafeInternalPath("/tasks\nLocation: https://trang-gia-mao.vn")).toBeNull();
    expect(toSafeInternalPath("/tasks\r\nSet-Cookie: a=b")).toBeNull();
    expect(toSafeInternalPath("/tasks\tvà-thêm")).toBeNull();
    expect(toSafeInternalPath("/tasks\u007f")).toBeNull();
  });

  /**
   * Không phải lỗ hổng mà là VÒNG LẶP: đưa người vừa đăng nhập xong về `/api/auth/sign-in` là bắt
   * đầu lại đúng cái vòng họ vừa thoát ra.
   */
  it("TỪ CHỐI đường dẫn API", () => {
    expect(toSafeInternalPath("/api/auth/sign-in")).toBeNull();
    expect(toSafeInternalPath("/api/tasks")).toBeNull();
    expect(toSafeInternalPath("/api")).toBeNull();
  });

  it("không nhầm một trang thường có tiền tố giống `api`", () => {
    expect(toSafeInternalPath("/apis")).toBe("/apis");
    expect(toSafeInternalPath("/api-keys")).toBe("/api-keys");
  });

  it("TỪ CHỐI đường dẫn tương đối — chúng phân giải theo trang hiện tại, không đoán trước được", () => {
    expect(toSafeInternalPath("tasks")).toBeNull();
    expect(toSafeInternalPath("../tasks")).toBeNull();
    expect(toSafeInternalPath("./tasks")).toBeNull();
  });

  it("TỪ CHỐI mọi đoạn `..` — `/..//trang-khac.vn` chuẩn hoá RA thành `//trang-khac.vn`", () => {
    /*
     * Đã đo với `new URL()`: origin giữ NGUYÊN gốc nội bộ — nên một phép so origin sẽ cho qua —
     * còn `pathname` sau chuẩn hoá là `//trang-khac.vn`, đúng cái giao thức tương đối bị chặn ở
     * trên. Phép lọc này không chuẩn hoá nên chuỗi ấy chưa từng đi tới đó; loại thẳng để người
     * sau có thêm một bước chuẩn hoá cũng không mở lại được lỗ đó.
     */
    expect(toSafeInternalPath("/..//trang-khac.vn")).toBeNull();
    expect(toSafeInternalPath("/tasks/..//trang-khac.vn")).toBeNull();
    expect(toSafeInternalPath("/tasks/../projects")).toBeNull();
    /* `..` trong QUERY không phải đoạn đường dẫn — nó chỉ là ký tự, và nó vô hại. */
    expect(toSafeInternalPath("/tasks?from=../x")).toBe("/tasks?from=../x");
    /* Và đừng chặn nhầm một đoạn chỉ TÌNH CỜ chứa hai dấu chấm. */
    expect(toSafeInternalPath("/tasks/..bug")).toBe("/tasks/..bug");
    expect(toSafeInternalPath("/tasks/a..b")).toBe("/tasks/a..b");
  });

  it("TỪ CHỐI giá trị rỗng, thiếu, hoặc quá dài", () => {
    expect(toSafeInternalPath(undefined)).toBeNull();
    expect(toSafeInternalPath(null)).toBeNull();
    expect(toSafeInternalPath("")).toBeNull();
    expect(toSafeInternalPath("   ")).toBeNull();
    expect(toSafeInternalPath(`/${"a".repeat(512)}`)).toBeNull();
  });

  it("nhận đúng ở sát trần độ dài", () => {
    const vua_du = `/${"a".repeat(511)}`;
    expect(vua_du).toHaveLength(512);
    expect(toSafeInternalPath(vua_du)).toBe(vua_du);
  });
});
