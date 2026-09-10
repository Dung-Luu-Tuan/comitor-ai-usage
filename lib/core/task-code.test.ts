import { describe, expect, it } from "vitest";
import { formatTaskCode, nextTaskCode, parseTaskCode, TASK_CODE_PREFIX } from "./task-code";

describe("TASK_CODE_PREFIX", () => {
  it("là chuỗi máy, không đổi theo ngôn ngữ giao diện", () => {
    expect(TASK_CODE_PREFIX).toBe("CV-");
  });
});

describe("parseTaskCode", () => {
  it("lấy phần số của mã dạng chuẩn", () => {
    expect(parseTaskCode("CV-014")).toBe(14);
    expect(parseTaskCode("CV-001")).toBe(1);
    expect(parseTaskCode("CV-1000")).toBe(1000);
  });

  /**
   * ⚠ Ca này khoá một quyết định có hậu quả: mã KHÔNG đệm vẫn phải đọc được. Từ chối nó thì
   * `nextTaskCode` coi `CV-14` là rác, bỏ qua, rồi cấp lại số 14 cho một việc mới — trùng mã.
   */
  it("chấp nhận mã không đệm (dữ liệu nhập từ nơi khác)", () => {
    expect(parseTaskCode("CV-14")).toBe(14);
    expect(parseTaskCode("CV-0014")).toBe(14);
  });

  it("không phân biệt hoa thường ở tiền tố", () => {
    expect(parseTaskCode("cv-014")).toBe(14);
    expect(parseTaskCode("Cv-014")).toBe(14);
  });

  it("cắt khoảng trắng hai đầu — mã dán từ bảng tính luôn kèm dấu cách", () => {
    expect(parseTaskCode("  CV-014  ")).toBe(14);
    expect(parseTaskCode("\tCV-014\n")).toBe(14);
  });

  it("sai tiền tố → null", () => {
    expect(parseTaskCode("TASK-014")).toBeNull();
    expect(parseTaskCode("014")).toBeNull();
    expect(parseTaskCode("CV014")).toBeNull();
    expect(parseTaskCode("XCV-014")).toBeNull();
  });

  it("phần số không phải chữ số → null", () => {
    expect(parseTaskCode("CV-abc")).toBeNull();
    expect(parseTaskCode("CV-")).toBeNull();
    expect(parseTaskCode("")).toBeNull();
    expect(parseTaskCode("CV-1.5")).toBeNull();
    expect(parseTaskCode("CV-+14")).toBeNull();
    expect(parseTaskCode("CV--14")).toBeNull();
  });

  /**
   * ⚠ Đây là ca mà `Number.parseInt` trần sẽ cho qua (`parseInt("14abc", 10) === 14`). Trong
   * `nextTaskCode`, một chuỗi rác được nhận không chỉ lọt — nó có thể thành mốc lớn nhất.
   */
  it("phần số có đuôi rác → null, không cắt lấy tiền tố số", () => {
    expect(parseTaskCode("CV-14abc")).toBeNull();
    expect(parseTaskCode("CV-14 15")).toBeNull();
    expect(parseTaskCode("CV-1e3")).toBeNull();
  });

  it("chữ số ngoài ASCII không được nhận — mã là chuỗi máy", () => {
    expect(parseTaskCode("CV-١٤")).toBeNull();
  });

  /** Số thứ tự bắt đầu từ 1: `CV-000` là mã không hệ thống nào cấp, nhận nó là phá vòng tròn. */
  it("số 0 → null", () => {
    expect(parseTaskCode("CV-0")).toBeNull();
    expect(parseTaskCode("CV-000")).toBeNull();
  });

  /**
   * ⚠ Ngoài `MAX_SAFE_INTEGER` thì phép cộng im lặng ngừng hoạt động, nên một mã như vậy khiến
   * `nextTaskCode` cấp lại chính mã lớn nhất đang có. Chặn ngay ở cửa vào.
   */
  it("số vượt MAX_SAFE_INTEGER → null", () => {
    expect(2 ** 53 + 1).toBe(2 ** 53);
    expect(parseTaskCode(`${TASK_CODE_PREFIX}${Number.MAX_SAFE_INTEGER}`)).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseTaskCode("CV-99999999999999999999")).toBeNull();
  });
});

describe("formatTaskCode", () => {
  it("đệm đủ 3 chữ số", () => {
    expect(formatTaskCode(1)).toBe("CV-001");
    expect(formatTaskCode(14)).toBe("CV-014");
    expect(formatTaskCode(999)).toBe("CV-999");
  });

  /** Đệm là ngưỡng SÀN. Cắt cho "đẹp cột" thì việc thứ 1000 và việc thứ 1 mang cùng một mã. */
  it("số từ 1000 trở lên không bị cắt", () => {
    expect(formatTaskCode(1000)).toBe("CV-1000");
    expect(formatTaskCode(123456)).toBe("CV-123456");
  });

  it("ném lỗi với số thứ tự <= 0", () => {
    expect(() => formatTaskCode(0)).toThrow(/sequence must be a safe integer/);
    expect(() => formatTaskCode(-1)).toThrow(/sequence must be a safe integer/);
  });

  it("ném lỗi với số không nguyên và với NaN / Infinity", () => {
    expect(() => formatTaskCode(1.5)).toThrow(/sequence must be a safe integer/);
    expect(() => formatTaskCode(Number.NaN)).toThrow(/sequence must be a safe integer/);
    expect(() => formatTaskCode(Number.POSITIVE_INFINITY)).toThrow(/sequence must be a safe integer/);
  });

  it("ném lỗi ở vùng số nguyên không an toàn", () => {
    expect(() => formatTaskCode(2 ** 53)).toThrow(/sequence must be a safe integer/);
  });

  /** Thông điệp lỗi là bản dự phòng cho MÁY: tiếng Anh, ASCII thuần (xem `pnpm core:check`). */
  it("thông điệp lỗi là ASCII thuần", () => {
    let message = "";
    try {
      formatTaskCode(0);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toBe("");
    // Kiểm bằng mã ký tự thay vì regex phạm vi: không phải mượn ký tự điều khiển vào biểu thức.
    expect([...message].every((char) => (char.codePointAt(0) ?? 0) < 128)).toBe(true);
  });
});

describe("vòng tròn parse ↔ format", () => {
  /**
   * Tính chất, không phải giá trị ghim: với MỌI số thứ tự hợp lệ, `parse(format(n)) === n`. Test
   * theo tính chất bắt được cả những ca mà không ai nghĩ tới lúc viết bảng giá trị — nhất là chỗ
   * chuyển bậc đệm (999 → 1000).
   */
  it("parse(format(n)) === n với mọi n hợp lệ", () => {
    const samples = [1, 2, 9, 10, 99, 100, 101, 999, 1000, 1001, 54321, Number.MAX_SAFE_INTEGER];
    for (const sequence of samples) {
      expect(parseTaskCode(formatTaskCode(sequence))).toBe(sequence);
    }
  });

  it("format(parse(code)) === code với mã đã ở dạng chuẩn", () => {
    for (const code of ["CV-001", "CV-014", "CV-999", "CV-1000"]) {
      const sequence = parseTaskCode(code);
      expect(sequence).not.toBeNull();
      expect(formatTaskCode(sequence ?? 0)).toBe(code);
    }
  });

  /**
   * Chiều ngược lại CHỈ đúng với dạng chuẩn — đó là chủ ý "nới ở đầu vào, chặt ở đầu ra": đọc
   * được nhiều dạng, nhưng chỉ sinh ra một dạng duy nhất.
   */
  it("mã không chuẩn được chuẩn hoá về dạng duy nhất", () => {
    const sequence = parseTaskCode(" cv-14 ");
    expect(sequence).toBe(14);
    expect(formatTaskCode(sequence ?? 0)).toBe("CV-014");
  });
});

describe("nextTaskCode", () => {
  it("danh sách rỗng → CV-001", () => {
    expect(nextTaskCode([])).toBe("CV-001");
  });

  it("đếm tiếp từ mã lớn nhất", () => {
    expect(nextTaskCode(["CV-001", "CV-002", "CV-003"])).toBe("CV-004");
  });

  /**
   * ⚠ Ca quan trọng nhất của cả file. Dãy có lỗ là chuyện thường (việc bị xoá), và `length + 1`
   * ở đây cho `CV-003` — một mã còn trống, nghe rất hợp lý, nhưng SAI quy tắc "đếm từ mã lớn nhất".
   */
  it("dãy có lỗ: CV-001, CV-005 → CV-006, không phải CV-003", () => {
    expect(nextTaskCode(["CV-001", "CV-005"])).toBe("CV-006");
  });

  /** Cùng bẫy, ở dạng nguy hiểm hơn: `length + 1` cho ra một mã ĐANG ĐƯỢC DÙNG. */
  it("dãy có lỗ ở giữa: length + 1 sẽ trùng một việc đang tồn tại", () => {
    const existing = ["CV-001", "CV-002", "CV-004"];
    expect(nextTaskCode(existing)).toBe("CV-005");
    expect(existing).toContain(`CV-00${existing.length + 1}`);
  });

  it("không phụ thuộc thứ tự danh sách", () => {
    expect(nextTaskCode(["CV-009", "CV-001", "CV-005"])).toBe("CV-010");
  });

  it("mã rác bị bỏ qua, không làm hỏng kết quả", () => {
    expect(nextTaskCode(["CV-001", "rác", "", "TASK-999", "CV-", "CV-abc", "CV-002"])).toBe("CV-003");
  });

  it("danh sách toàn mã rác → CV-001", () => {
    expect(nextTaskCode(["rác", "TASK-9", "CV-x"])).toBe("CV-001");
  });

  /** Hệ quả trực tiếp của việc `parseTaskCode` nhận mã không đệm: nó vẫn được tính vào mốc. */
  it("mã không đệm và mã viết thường vẫn được tính vào mốc lớn nhất", () => {
    expect(nextTaskCode(["CV-001", "CV-14"])).toBe("CV-015");
    expect(nextTaskCode(["CV-001", "cv-020"])).toBe("CV-021");
  });

  it("vượt bậc đệm: CV-999 → CV-1000", () => {
    expect(nextTaskCode(["CV-999"])).toBe("CV-1000");
  });

  it("mã mới sinh ra không bao giờ trùng mã đã có", () => {
    const existing = ["CV-001", "CV-002", "CV-007", "cv-12", "rác"];
    const next = nextTaskCode(existing);
    const nextSequence = parseTaskCode(next);
    expect(nextSequence).not.toBeNull();
    for (const code of existing) {
      const sequence = parseTaskCode(code);
      if (sequence === null) continue;
      expect(sequence).toBeLessThan(nextSequence ?? 0);
    }
  });

  /** Ở ngưỡng an toàn, `+ 1` không còn tăng — dừng ồn ào tốt hơn cấp trùng mã im lặng. */
  it("chạm MAX_SAFE_INTEGER thì ném lỗi thay vì cấp trùng", () => {
    expect(() => nextTaskCode([`${TASK_CODE_PREFIX}${Number.MAX_SAFE_INTEGER}`])).toThrow(
      /sequence must be a safe integer/
    );
  });
});
