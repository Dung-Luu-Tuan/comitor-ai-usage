import { describe, expect, it } from "vitest";
import {
  DISPLAY_PREF_KEYS,
  DISPLAY_PREF_STORAGE_KEYS,
  DISPLAY_PREF_VALUES,
  decodeDisplayPrefs,
  parseDisplayPrefs
} from "./display-prefs";

describe("parseDisplayPrefs", () => {
  it("giữ đủ bốn trục khi tất cả đều hợp lệ", () => {
    expect(parseDisplayPrefs({ theme: "dark", contrast: "high", density: "compact", fontSize: "lg" })).toEqual({
      theme: "dark",
      contrast: "high",
      density: "compact",
      fontSize: "lg"
    });
  });

  it("giữ `system` — lựa chọn THẬT, không phải trạng thái chưa chọn", () => {
    expect(parseDisplayPrefs({ theme: "system" })).toEqual({ theme: "system" });
  });

  it("giữ trục hợp lệ và bỏ trục hỏng trong CÙNG một object", () => {
    // Một trục sai không được kéo theo ba trục kia — chúng độc lập nhau.
    expect(parseDisplayPrefs({ theme: "dark", contrast: "chói loà", density: "compact" })).toEqual({
      theme: "dark",
      density: "compact"
    });
  });

  it("loại giá trị ngoài tập đóng", () => {
    expect(parseDisplayPrefs({ theme: "midnight", fontSize: "xl" })).toEqual({});
  });

  it("loại khoá lạ — kể cả khoá nghe như thật", () => {
    expect(parseDisplayPrefs({ isPlatformAdmin: true, locale: "en", themes: "dark" })).toEqual({});
  });

  it("⚠ loại chuỗi tiêm mã — đây là lý do hàm này tồn tại", () => {
    /*
     * Giá trị đi vào một `<script>` MANG NONCE. Lọt một chuỗi ở đây là chạy được mã trong ngữ cảnh
     * trang, và CSP không chặn vì nonce đã bảo trình duyệt tin script đó.
     */
    expect(parseDisplayPrefs({ theme: '";alert(1);//' })).toEqual({});
    expect(parseDisplayPrefs({ theme: "</script><script>alert(1)</script>" })).toEqual({});
    expect(parseDisplayPrefs({ contrast: 'high";localStorage.clear();"' })).toEqual({});
  });

  it("loại giá trị không phải chuỗi", () => {
    expect(parseDisplayPrefs({ theme: 1, contrast: null, density: ["compact"], fontSize: { v: "lg" } })).toEqual({});
  });

  it("loại `__proto__` mà không làm bẩn Object.prototype", () => {
    const out = parseDisplayPrefs(JSON.parse('{"__proto__":{"polluted":true},"theme":"dark"}'));
    expect(out).toEqual({ theme: "dark" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("nhận mọi thứ không phải object mà không ném", () => {
    for (const bad of [null, undefined, 42, "dark", true, ["dark"]]) {
      expect(parseDisplayPrefs(bad)).toEqual({});
    }
  });

  it("⚠ trả về HẰNG của repo, không phải chuỗi đi vào", () => {
    /*
     * Hai chuỗi bằng nhau nhưng KHÁC ĐỐI TƯỢNG. Phép so `===` trên chuỗi nguyên thuỷ luôn đúng, nên
     * điều thật sự cần khẳng định là: giá trị trả ra nằm TRONG mảng hằng — tức không có đường nào
     * để một chuỗi ngoài đi tiếp mà không khớp một phần tử đã khai.
     */
    const value = parseDisplayPrefs({ theme: ["d", "a", "r", "k"].join("") }).theme;
    expect(DISPLAY_PREF_VALUES.theme).toContain(value);
  });
});

describe("decodeDisplayPrefs", () => {
  it("đọc được chuỗi cookie đã mã hoá", () => {
    const cookie = encodeURIComponent(JSON.stringify({ theme: "dark", fontSize: "sm" }));
    expect(decodeDisplayPrefs(cookie)).toEqual({ theme: "dark", fontSize: "sm" });
  });

  it("cookie rỗng / thiếu → không gieo gì", () => {
    expect(decodeDisplayPrefs(undefined)).toEqual({});
    expect(decodeDisplayPrefs("")).toEqual({});
  });

  it("JSON hỏng KHÔNG ném — cookie hỏng là trạng thái bình thường", () => {
    expect(decodeDisplayPrefs("khong-phai-json")).toEqual({});
    expect(decodeDisplayPrefs("%7B%22theme%22%3A")).toEqual({});
  });

  it("chuỗi mã hoá URL hỏng KHÔNG ném", () => {
    // `decodeURIComponent("%")` ném `URIError` — đường này phải nuốt nó.
    expect(decodeDisplayPrefs("%")).toEqual({});
  });
});

describe("bảng khoá localStorage", () => {
  it("có đúng một khoá cho mỗi trục", () => {
    expect(Object.keys(DISPLAY_PREF_STORAGE_KEYS).sort()).toEqual([...DISPLAY_PREF_KEYS].sort());
  });

  it("mọi khoá mang tiền tố `comitor-` và KHÔNG trùng nhau", () => {
    const keys = Object.values(DISPLAY_PREF_STORAGE_KEYS);
    for (const key of keys) expect(key.startsWith("comitor-")).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("⚠ khớp TỪNG KÝ TỰ với @comitor/ui — lệch là gieo vào khoá không ai đọc", () => {
    expect(DISPLAY_PREF_STORAGE_KEYS).toEqual({
      theme: "comitor-theme",
      contrast: "comitor-contrast",
      density: "comitor-density",
      fontSize: "comitor-font-size"
    });
  });
});
