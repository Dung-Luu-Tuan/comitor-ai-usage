import { describe, expect, it } from "vitest";
import { versionOf } from "./version-token";

describe("versionOf", () => {
  it("cùng nội dung → cùng thẻ", () => {
    expect(versionOf({ a: 1, b: [2, 3] })).toBe(versionOf({ a: 1, b: [2, 3] }));
  });

  /*
   * Ca này là lý do `stable()` tồn tại. `JSON.stringify` giữ thứ tự chèn, nên nếu thiếu phép sắp
   * xếp thì cùng một ma trận đọc từ hai đường khác nhau cho ra hai thẻ — tức 409 cho một lần ghi
   * hoàn toàn hợp lệ, và một cổng báo động giả là một cổng sẽ bị tắt.
   */
  it("khác THỨ TỰ KHOÁ vẫn ra cùng thẻ, ở mọi độ sâu", () => {
    expect(versionOf({ a: 1, b: 2 })).toBe(versionOf({ b: 2, a: 1 }));
    expect(versionOf({ x: { p: 1, q: 2 } })).toBe(versionOf({ x: { q: 2, p: 1 } }));
    expect(versionOf({ m: [{ i: 1, j: 2 }] })).toBe(versionOf({ m: [{ j: 2, i: 1 }] }));
  });

  /* ĐỐI CHỨNG ÂM TÍNH — thứ làm cho phép so có ý nghĩa. */
  it("lệch ĐÚNG MỘT ô → thẻ khác", () => {
    const before = { owner: { "task.delete": true }, member: { "task.delete": false } };
    const after = { owner: { "task.delete": true }, member: { "task.delete": true } };
    expect(versionOf(before)).not.toBe(versionOf(after));
  });

  it("thứ tự PHẦN TỬ MẢNG là có nghĩa — mảng không phải tập hợp", () => {
    expect(versionOf([1, 2])).not.toBe(versionOf([2, 1]));
  });

  it("phân biệt được chín giá trị dễ lẫn", () => {
    /*
     * `0` ⇄ `false` ⇄ `""` ⇄ `"0"` là bộ va chạm kinh điển của mọi phép so lỏng. `undefined` bị lọc
     * bỏ khỏi object, nên `{ v: undefined }` băm ra chuỗi `{}` — vẫn KHÁC `{ v: {} }` (băm ra
     * `{"v":{}}`), và đó là điều phải khẳng định chứ không phải điều hiển nhiên.
     */
    const tags = [undefined, null, 0, false, "", "0", "false", [], {}].map((v) => versionOf({ v }));
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("luôn ra 8 ký tự hex", () => {
    for (const v of [{}, { a: 1 }, [1, 2, 3], "x", 42, null]) {
      expect(versionOf(v)).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});
