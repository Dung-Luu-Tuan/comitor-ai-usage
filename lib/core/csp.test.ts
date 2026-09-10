import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./csp";

/** Tách chuỗi chính sách thành từng directive để khỏi phải so bằng `includes` trên cả chuỗi. */
function directives(policy: string): string[] {
  return policy.split("; ");
}

function directive(policy: string, name: string): string | undefined {
  return directives(policy).find((entry) => entry === name || entry.startsWith(`${name} `));
}

describe("buildContentSecurityPolicy", () => {
  it("không nonce thì script-src chỉ có 'self'", () => {
    expect(directive(buildContentSecurityPolicy(), "script-src")).toBe("script-src 'self'");
  });

  it("có nonce thì script-src mang đúng nonce đó", () => {
    const policy = buildContentSecurityPolicy({ nonce: "abc123" });
    expect(directive(policy, "script-src")).toBe("script-src 'self' 'nonce-abc123'");
  });

  /**
   * ⚠ BẪY 2 của mục CSP — `getScriptNonceFromHeader` của Next tìm directive bằng
   * `startsWith("script-src")`. Một `script-src-elem` đứng TRƯỚC sẽ khớp nhầm, Next không thấy
   * `nonce-` trong đó và bỏ nonce đi TRONG IM LẶNG. Test này khoá thứ tự lại.
   */
  it("script-src đứng trước mọi directive script-src-*", () => {
    const list = directives(buildContentSecurityPolicy({ nonce: "n" }));
    const first = list.findIndex((entry) => entry.startsWith("script-src"));
    expect(list[first]?.startsWith("script-src ")).toBe(true);
    expect(list[first]?.startsWith("script-src-")).toBe(false);
  });

  /**
   * ⚠ BẪY 3 — nonce ở `style-src` làm trình duyệt BỎ QUA `'unsafe-inline'`, mà React thì đặt
   * `style=` dạng thuộc tính và CSP không có nonce cho style thuộc tính. Hậu quả đo được ở
   * Comitor.Account: thanh tiến độ hiển thị sai tỉ lệ, `sr-only` hiện ra giữa trang.
   */
  it("style-src KHÔNG bao giờ mang nonce, và luôn giữ 'unsafe-inline'", () => {
    const policy = buildContentSecurityPolicy({ nonce: "abc123" });
    const style = directive(policy, "style-src") ?? "";
    expect(style).toContain("'unsafe-inline'");
    expect(style).not.toContain("nonce-");
  });

  describe("allowEval", () => {
    it("mặc định KHÔNG có 'unsafe-eval'", () => {
      expect(directive(buildContentSecurityPolicy(), "script-src")).not.toContain("unsafe-eval");
      expect(directive(buildContentSecurityPolicy({ allowEval: false }), "script-src")).not.toContain("unsafe-eval");
    });

    it("bật tường minh thì có", () => {
      expect(directive(buildContentSecurityPolicy({ allowEval: true }), "script-src")).toContain("'unsafe-eval'");
    });

    /**
     * Đối chứng âm tính cho ranh giới fail-closed: cờ nhận `boolean`, và mọi giá trị truthy KHÁC
     * `true` (một chuỗi lọt vào từ `process.env` chẳng hạn) KHÔNG được nới chính sách. Phép so là
     * `=== true`, không phải `Boolean(...)`.
     */
    it("giá trị truthy không phải boolean true thì KHÔNG nới", () => {
      const policy = buildContentSecurityPolicy({ allowEval: "yes" as unknown as boolean });
      expect(directive(policy, "script-src")).not.toContain("unsafe-eval");
    });
  });

  describe("img-src", () => {
    it("không có endpoint kho ảnh thì chỉ self + data + blob", () => {
      expect(directive(buildContentSecurityPolicy(), "img-src")).toBe("img-src 'self' data: blob:");
    });

    it("có endpoint MinIO thì thêm đúng host đó", () => {
      const policy = buildContentSecurityPolicy({ storageEndpoint: "http://localhost:9110" });
      expect(directive(policy, "img-src")).toBe("img-src 'self' data: blob: http://localhost:9110");
    });

    /**
     * ⚠ Đối chứng quan trọng: KHÔNG mở `https:` cho mọi tên miền. Một `img-src https:` là kênh rò
     * dữ liệu rẻ nhất mà XSS dùng được — mọi ảnh của module đều đi qua bucket của chính nó, nên
     * tập nguồn đóng được và phải đóng.
     */
    it("KHÔNG mở https: cho mọi tên miền", () => {
      expect(directive(buildContentSecurityPolicy(), "img-src")).not.toMatch(/\bhttps:(\s|$)/);
    });
  });

  it("chống clickjacking nằm TRONG chuỗi này, không ở header CSP thứ hai", () => {
    expect(directives(buildContentSecurityPolicy())).toContain("frame-ancestors 'none'");
  });

  /**
   * ⚠ CA HỒI QUY, và nó là loại lỗi mà chỉ TRÌNH DUYỆT THẬT mới lộ ra: máy chủ nhận request, xử lý
   * xong, trả 307 — rồi Chrome chặn bước đi theo chuyển hướng đó. Không có gì đỏ ở phía máy chủ.
   *
   * Đăng xuất toàn hệ submit một `<form method="post">` tới route của chính app, và route trả 307
   * sang Comitor.Account. Chrome áp `form-action` cho CẢ CHUỖI chuyển hướng, nên `form-action
   * 'self'` chặn một form có `action` same-origin. Đo được 2026-09-03 trên luồng thật.
   */
  /**
   * ⚠ Ảnh đại diện đến từ bucket của ACCOUNT, không phải bucket của module — hai tên miền khác
   * nhau. Thiếu nguồn này thì trình duyệt chặn ảnh, máy chủ không có lỗi nào, và giao diện rơi về
   * avatar chữ cái: trông y hệt "người này chưa đặt ảnh". Không cổng nào bắt được lớp lỗi đó.
   */
  it("⚠ img-src mang CẢ hai kho ảnh — của module và của Account", () => {
    const list = buildContentSecurityPolicy({
      storageEndpoint: "http://localhost:9110",
      accountAssetsOrigin: "https://comitor-dev.s3.ap-southeast-1.amazonaws.com"
    }).split("; ");
    expect(list).toContain(
      "img-src 'self' data: blob: http://localhost:9110 https://comitor-dev.s3.ap-southeast-1.amazonaws.com"
    );
  });

  /**
   * ⚠ CA HỒI QUY. Bản đầu của tuỳ chọn này nhận đúng MỘT gốc, và điều đó SAI với dữ liệu thật:
   * `toDisplayUrl()` bên Account trả URL tuyệt đối đi thẳng cho ảnh social login, còn
   * `organization.logo` nhận bất kỳ URL http/https nào người quản trị dán vào. Một gốc là chặn sạch
   * hai nguồn đó, và triệu chứng chỉ là avatar chữ cái — trông y hệt "chưa đặt ảnh".
   */
  it("⚠ img-src mang NHIỀU gốc ảnh của Account, ngăn bằng khoảng trắng", () => {
    const list = buildContentSecurityPolicy({
      storageEndpoint: "http://localhost:9110",
      accountAssetsOrigin: "https://comitor-dev.s3.ap-southeast-1.amazonaws.com https://lh3.googleusercontent.com"
    }).split("; ");
    expect(list).toContain(
      "img-src 'self' data: blob: http://localhost:9110 " +
        "https://comitor-dev.s3.ap-southeast-1.amazonaws.com https://lh3.googleusercontent.com"
    );
  });

  it("cắt `/` cuối của TỪNG gốc, và bỏ qua khoảng trắng thừa giữa chúng", () => {
    const list = buildContentSecurityPolicy({
      accountAssetsOrigin: "  https://a.example/   https://b.example//  "
    }).split("; ");
    expect(list).toContain("img-src 'self' data: blob: https://a.example https://b.example");
  });

  it("thiếu kho ảnh của Account thì img-src vẫn hợp lệ, không có khoảng trắng thừa", () => {
    const list = buildContentSecurityPolicy({ storageEndpoint: "http://localhost:9110" }).split("; ");
    expect(list).toContain("img-src 'self' data: blob: http://localhost:9110");
  });

  it("⚠ KHÔNG mở `https:` cho mọi tên miền — tập nguồn ảnh phải ĐÓNG", () => {
    const policy = buildContentSecurityPolicy({
      storageEndpoint: "http://localhost:9110",
      accountAssetsOrigin: "https://comitor-dev.s3.ap-southeast-1.amazonaws.com"
    });
    const imgSrc = policy.split("; ").find((d) => d.startsWith("img-src ")) ?? "";
    expect(imgSrc).not.toMatch(/\shttps:(\s|$)/);
    expect(imgSrc).not.toContain("*");
  });

  it("⚠ form-action phải liệt kê gốc Account — nếu không, đăng xuất toàn hệ bị TRÌNH DUYỆT chặn", () => {
    const list = buildContentSecurityPolicy({ accountOrigin: "https://account.dev.comitor.ai" }).split("; ");
    expect(list).toContain("form-action 'self' https://account.dev.comitor.ai");
  });

  it("dấu `/` cuối bị cắt — với bộ khớp của CSP thì hai chuỗi đó khác nhau", () => {
    const list = buildContentSecurityPolicy({ accountOrigin: "https://account.comitor.ai/" }).split("; ");
    expect(list).toContain("form-action 'self' https://account.comitor.ai");
  });

  it("không khai accountOrigin thì form-action về đúng 'self', không có khoảng trắng thừa", () => {
    for (const origin of [undefined, "", "   "]) {
      const list = buildContentSecurityPolicy({ accountOrigin: origin }).split("; ");
      expect(list).toContain("form-action 'self'");
    }
  });

  /**
   * ⚠ Gốc Account CHỈ được xuất hiện ở `form-action`. Trình duyệt không gọi thẳng sang Account ở
   * đâu cả — mọi lời gọi đi từ máy chủ (`lib/account/`) — nên để nó lọt vào `connect-src` hay
   * `script-src` là nới bề mặt tấn công mà không đổi lấy gì.
   */
  it("gốc Account KHÔNG lọt sang directive nào khác", () => {
    const origin = "https://account.dev.comitor.ai";
    const list = buildContentSecurityPolicy({ accountOrigin: origin, nonce: "abc" }).split("; ");
    const carrying = list.filter((directive) => directive.includes(origin));
    expect(carrying).toHaveLength(1);
    expect(carrying[0]?.startsWith("form-action ")).toBe(true);
  });

  it("khai đủ base-uri và form-action", () => {
    const list = directives(buildContentSecurityPolicy());
    expect(list).toContain("base-uri 'self'");
    expect(list).toContain("form-action 'self'");
  });

  it("KHÔNG dùng 'strict-dynamic' — nó vô hiệu 'self' trong cùng directive", () => {
    expect(buildContentSecurityPolicy({ nonce: "n" })).not.toContain("strict-dynamic");
  });

  it("nonce chỉ toàn khoảng trắng được coi như không có", () => {
    expect(directive(buildContentSecurityPolicy({ nonce: "   " }), "script-src")).toBe("script-src 'self'");
  });
});
