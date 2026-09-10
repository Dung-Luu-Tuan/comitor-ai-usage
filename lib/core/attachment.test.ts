import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "./api-error";
import { APP_ID } from "./app-identity";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_TYPES,
  attachmentObjectKey,
  checkAttachment,
  MAX_ATTACHMENT_BYTES,
  safeAttachmentName,
  sniffImageType
} from "./attachment";

/** Một tệp hợp lệ để lấy làm gốc; mỗi ca chỉ đổi đúng thứ nó đang kiểm. */
const VALID = { size: 1024, type: "image/png" } as const;

describe("hằng số", () => {
  it("MAX_ATTACHMENT_BYTES đúng bằng 2 MB", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(2 * 1024 * 1024);
    expect(MAX_ATTACHMENT_BYTES).toBe(2097152);
  });

  /**
   * ⚠ Đây là hằng đúng giữ cho `checkAttachment` và `attachmentObjectKey` không nói hai chuyện
   * khác nhau. Lệch một mục là lỗi 500 SAU khi đã nhận trọn tệp — xem JSDoc của
   * `ALLOWED_ATTACHMENT_TYPES`.
   */
  it("mọi kiểu được cho phép đều có đuôi tệp, và ngược lại", () => {
    expect(ALLOWED_ATTACHMENT_TYPES).toEqual(Object.keys(ALLOWED_ATTACHMENT_EXTENSIONS));
    for (const type of ALLOWED_ATTACHMENT_TYPES) {
      expect(ALLOWED_ATTACHMENT_EXTENSIONS[type]).toMatch(/^\.[a-z0-9]+$/);
    }
  });

  it("chỉ nhận ba định dạng ảnh, và KHÔNG nhận SVG", () => {
    expect([...ALLOWED_ATTACHMENT_TYPES].sort()).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(ALLOWED_ATTACHMENT_TYPES).not.toContain("image/svg+xml");
  });
});

describe("checkAttachment", () => {
  it("tệp hợp lệ trả null", () => {
    expect(checkAttachment(VALID)).toBeNull();
  });

  it("cả ba kiểu được phép đều đi qua", () => {
    for (const type of ALLOWED_ATTACHMENT_TYPES) {
      expect(checkAttachment({ size: 1024, type })).toBeNull();
    }
  });

  it("tệp 0 byte là ATTACHMENT_EMPTY", () => {
    expect(checkAttachment({ ...VALID, size: 0 })).toBe(ERROR_CODES.ATTACHMENT_EMPTY);
  });

  /**
   * ⚠ `NaN` phải rơi vào nhánh rỗng chứ không được trượt qua. `NaN <= 0` và `NaN > MAX` đều
   * `false`, nên thiếu phép kiểm tường minh là cửa kích thước biến mất hoàn toàn — im lặng, và
   * đúng ở input mà phía kia điều khiển được.
   */
  it("size không phải số hữu hạn dương cũng là ATTACHMENT_EMPTY", () => {
    expect(checkAttachment({ ...VALID, size: Number.NaN })).toBe(ERROR_CODES.ATTACHMENT_EMPTY);
    expect(checkAttachment({ ...VALID, size: -1 })).toBe(ERROR_CODES.ATTACHMENT_EMPTY);
    expect(checkAttachment({ ...VALID, size: Number.NEGATIVE_INFINITY })).toBe(ERROR_CODES.ATTACHMENT_EMPTY);
  });

  it("size vô hạn dương là ATTACHMENT_TOO_LARGE, không phải rỗng", () => {
    expect(checkAttachment({ ...VALID, size: Number.POSITIVE_INFINITY })).toBe(ERROR_CODES.ATTACHMENT_TOO_LARGE);
  });

  it("kiểu ngoài danh sách là ATTACHMENT_TYPE_INVALID", () => {
    expect(checkAttachment({ ...VALID, type: "application/pdf" })).toBe(ERROR_CODES.ATTACHMENT_TYPE_INVALID);
    expect(checkAttachment({ ...VALID, type: "image/gif" })).toBe(ERROR_CODES.ATTACHMENT_TYPE_INVALID);
    expect(checkAttachment({ ...VALID, type: "image/svg+xml" })).toBe(ERROR_CODES.ATTACHMENT_TYPE_INVALID);
    expect(checkAttachment({ ...VALID, type: "" })).toBe(ERROR_CODES.ATTACHMENT_TYPE_INVALID);
  });

  it("MIME không phân biệt hoa thường và được phép mang tham số", () => {
    expect(checkAttachment({ ...VALID, type: "IMAGE/PNG" })).toBeNull();
    expect(checkAttachment({ ...VALID, type: " image/png " })).toBeNull();
    expect(checkAttachment({ ...VALID, type: "image/jpeg; charset=binary" })).toBeNull();
  });

  it("đúng bằng MAX_ATTACHMENT_BYTES vẫn hợp lệ; hơn một byte thì không", () => {
    expect(checkAttachment({ ...VALID, size: MAX_ATTACHMENT_BYTES })).toBeNull();
    expect(checkAttachment({ ...VALID, size: MAX_ATTACHMENT_BYTES + 1 })).toBe(ERROR_CODES.ATTACHMENT_TOO_LARGE);
  });

  /* ── Thứ tự ưu tiên: mỗi mã lỗi là một LỜI KHUYÊN, nên thứ tự sai cho ra lời khuyên sai ──── */

  it("tệp rỗng mang kiểu ĐÚNG vẫn báo rỗng — rỗng được kiểm trước kiểu", () => {
    expect(checkAttachment({ size: 0, type: "image/png" })).toBe(ERROR_CODES.ATTACHMENT_EMPTY);
  });

  it("tệp rỗng mang kiểu SAI báo rỗng, không báo sai định dạng", () => {
    expect(checkAttachment({ size: 0, type: "text/plain" })).toBe(ERROR_CODES.ATTACHMENT_EMPTY);
  });

  /** Nói "quá lớn" ở đây là bảo người dùng đi nén một tệp không bao giờ được nhận. */
  it("video 40 MB báo SAI ĐỊNH DẠNG, không báo quá lớn — kiểu được kiểm trước kích thước", () => {
    expect(checkAttachment({ size: 40 * 1024 * 1024, type: "video/mp4" })).toBe(ERROR_CODES.ATTACHMENT_TYPE_INVALID);
  });
});

describe("attachmentObjectKey", () => {
  const INPUT = { taskId: "ckt1a2b3c4d5", contentType: "image/png", random: "9f8e7d6c" } as const;

  it("dựng đúng dạng {APP_ID}/attachment/{taskId}/{random}{ext}", () => {
    expect(attachmentObjectKey(INPUT)).toBe(`${APP_ID}/attachment/ckt1a2b3c4d5/9f8e7d6c.png`);
  });

  /** ⚠ Tiền tố là thứ IAM dùng để giới hạn quyền theo app — mất nó là mất luôn cách phân quyền. */
  it("luôn bắt đầu bằng tiền tố {app}/{tính năng}", () => {
    for (const type of ALLOWED_ATTACHMENT_TYPES) {
      expect(attachmentObjectKey({ ...INPUT, contentType: type }).startsWith(`${APP_ID}/attachment/`)).toBe(true);
    }
  });

  it("mỗi kiểu cho đúng đuôi tệp của nó", () => {
    expect(attachmentObjectKey({ ...INPUT, contentType: "image/png" }).endsWith(".png")).toBe(true);
    expect(attachmentObjectKey({ ...INPUT, contentType: "image/jpeg" }).endsWith(".jpg")).toBe(true);
    expect(attachmentObjectKey({ ...INPUT, contentType: "image/webp" }).endsWith(".webp")).toBe(true);
  });

  it("nhận MIME viết hoa và MIME có tham số, y như checkAttachment", () => {
    expect(attachmentObjectKey({ ...INPUT, contentType: "IMAGE/PNG" })).toBe(attachmentObjectKey(INPUT));
    expect(attachmentObjectKey({ ...INPUT, contentType: "image/png; charset=binary" })).toBe(
      attachmentObjectKey(INPUT)
    );
  });

  /**
   * Hằng đúng nối hai hàm: kiểu nào `checkAttachment` cho qua thì `attachmentObjectKey` PHẢI dựng
   * được khoá. Test theo tính chất chứ không ghim ba ca, để thêm một kiểu vào bảng là tự có phép
   * kiểm.
   */
  it("mọi kiểu qua được checkAttachment đều dựng được khoá", () => {
    for (const type of ALLOWED_ATTACHMENT_TYPES) {
      expect(checkAttachment({ size: 1, type })).toBeNull();
      expect(() => attachmentObjectKey({ ...INPUT, contentType: type })).not.toThrow();
    }
  });

  it("kiểu ngoài danh sách thì NÉM lỗi, không trả khoá dở", () => {
    expect(() => attachmentObjectKey({ ...INPUT, contentType: "image/gif" })).toThrow(/Unsupported/);
    expect(() => attachmentObjectKey({ ...INPUT, contentType: "" })).toThrow(/Unsupported/);
  });

  /** Vì `random` là tham số chứ không sinh trong hàm, khoá kiểm được bằng giá trị chứ không bằng regex. */
  it("tất định — cùng input cho cùng khoá", () => {
    expect(attachmentObjectKey(INPUT)).toBe(attachmentObjectKey(INPUT));
  });

  it("random khác nhau cho khoá khác nhau — hai người tải cùng tên tệp không ghi đè nhau", () => {
    const first = attachmentObjectKey({ ...INPUT, random: "aaa" });
    const second = attachmentObjectKey({ ...INPUT, random: "bbb" });
    expect(first).not.toBe(second);
  });

  it("đoạn khoá dị dạng thì ném lỗi, không đưa dấu / hay .. vào khoá", () => {
    expect(() => attachmentObjectKey({ ...INPUT, taskId: "../../secret" })).toThrow(/taskId/);
    expect(() => attachmentObjectKey({ ...INPUT, taskId: "a/b" })).toThrow(/taskId/);
    expect(() => attachmentObjectKey({ ...INPUT, taskId: "" })).toThrow(/taskId/);
    expect(() => attachmentObjectKey({ ...INPUT, random: "../evil" })).toThrow(/random/);
    expect(() => attachmentObjectKey({ ...INPUT, random: "" })).toThrow(/random/);
  });
});

describe("safeAttachmentName", () => {
  it("giữ nguyên một tên bình thường, kể cả dấu tiếng Việt và khoảng trắng", () => {
    expect(safeAttachmentName("ảnh chụp màn hình.png")).toBe("ảnh chụp màn hình.png");
  });

  it("cắt đường dẫn POSIX, chỉ giữ tên tệp", () => {
    expect(safeAttachmentName("/home/thanh/anh.png")).toBe("anh.png");
  });

  /** Đường dẫn Windows lộ tên tài khoản và cấu trúc thư mục của người tải lên. */
  it("cắt cả đường dẫn Windows", () => {
    expect(safeAttachmentName("C:\\Users\\thanh\\anh.png")).toBe("anh.png");
  });

  it("tên chứa ../ chỉ còn đoạn cuối", () => {
    expect(safeAttachmentName("../../etc/passwd")).toBe("passwd");
    expect(safeAttachmentName("..\\..\\windows\\system32\\config")).toBe("config");
  });

  it("bản thân . và .. không phải tên tệp", () => {
    expect(safeAttachmentName("..")).toBe("attachment");
    expect(safeAttachmentName(".")).toBe("attachment");
  });

  /** ⚠ Một `\r\n` lọt vào tên là một DÒNG mới trong bản xuất CSV — bảng tính đọc lệch từ đó. */
  it("bỏ ký tự điều khiển", () => {
    expect(safeAttachmentName("anh\r\nchen-dong.png")).toBe("anhchen-dong.png");
    expect(safeAttachmentName("anh\u0000\u0007\u007F.png")).toBe("anh.png");
    expect(safeAttachmentName("anh\tdep.png")).toBe("anhdep.png");
  });

  it("giới hạn 120 ký tự", () => {
    const long = `${"a".repeat(200)}.png`;
    expect(safeAttachmentName(long)).toHaveLength(120);
    expect(safeAttachmentName("a".repeat(120))).toHaveLength(120);
  });

  /**
   * ⚠ `slice` đếm theo đơn vị UTF-16 nên nó cắt vỡ cặp surrogate và để lại NỬA ký tự. Test khoá
   * lại bằng tính chất: không có surrogate lẻ nào trong kết quả.
   */
  it("không cắt vỡ ký tự nhiều mã đơn vị (emoji)", () => {
    const emoji = "👍".repeat(200);
    const safe = safeAttachmentName(emoji);

    expect(Array.from(safe)).toHaveLength(120);
    expect(safe).toBe("👍".repeat(120));
    expect(/[\uD800-\uDFFF]/.test(safe.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ""))).toBe(false);
  });

  it("tên rỗng, toàn khoảng trắng, hay chỉ có đường dẫn thì thành attachment", () => {
    expect(safeAttachmentName("")).toBe("attachment");
    expect(safeAttachmentName("   ")).toBe("attachment");
    expect(safeAttachmentName("/home/thanh/")).toBe("attachment");
    expect(safeAttachmentName("\u0000\u0001")).toBe("attachment");
  });

  it("idempotent — làm sạch một tên đã sạch không đổi gì", () => {
    const once = safeAttachmentName("C:\\Users\\thanh\\anh\r\n.png");
    expect(safeAttachmentName(once)).toBe(once);
  });
});

describe("sniffImageType", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
  const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0);
  const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);

  it("nhận ra ba kiểu được phép", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBe("image/webp");
  });

  /**
   * ⚠ Ba phép kiểm dưới đây là lý do hàm này tồn tại. `checkAttachment` đọc `file.type` — lời khai
   * của trình duyệt — nên cả ba tệp này đều đi qua nó sạch sẽ khi khai `image/png`.
   */
  it("TỪ CHỐI tệp cải trang: HTML, SVG, và tệp thực thi", () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/>');
    const exe = bytes(0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0);
    expect(sniffImageType(html)).toBeNull();
    expect(sniffImageType(svg)).toBeNull();
    expect(sniffImageType(exe)).toBeNull();
  });

  it("TỪ CHỐI RIFF không phải WebP — WAV và AVI cũng bắt đầu bằng RIFF", () => {
    const wav = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45);
    const avi = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20);
    expect(sniffImageType(wav)).toBeNull();
    expect(sniffImageType(avi)).toBeNull();
  });

  it("chịu được tệp CỤT — không đọc quá cuối mảng", () => {
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(bytes(0x89, 0x50))).toBeNull();
    // "RIFF" đủ, nhưng cắt trước khi tới "WEBP".
    expect(sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4))).toBeNull();
  });

  it("chữ ký đúng MỘT NỬA không được tính", () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0))).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 0))).toBeNull();
  });

  it("mọi kiểu nhận ra được đều nằm trong danh sách CHO PHÉP", () => {
    for (const sample of [PNG, JPEG, WEBP]) {
      const type = sniffImageType(sample);
      expect(type).not.toBeNull();
      expect(ALLOWED_ATTACHMENT_TYPES).toContain(type);
    }
  });
});
