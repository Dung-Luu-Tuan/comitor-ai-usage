import { describe, expect, it } from "vitest";
import { compareIsoDate, daysBetween, isIsoDate, isOverdue, parseIsoDate, toIsoDate } from "./iso-date";

/**
 * Sinh chuỗi `YYYY-MM-DD` từ lịch của CHÍNH V8 (qua `Date` ở chế độ UTC), để dùng làm đối chứng
 * độc lập cho bảng số ngày trong tháng và quy tắc năm nhuận viết tay ở module.
 *
 * ⚠ Cố ý KHÔNG gọi `toIsoDate` ở đây: một helper test dựng bằng chính hàm đang được kiểm thì test
 * tính chất bên dưới sẽ xanh ngay cả khi cả hai cùng sai một kiểu.
 */
function isoFromUtc(timestamp: number): string {
  const date = new Date(timestamp);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MS_PER_DAY = 86_400_000;

describe("isIsoDate", () => {
  it("nhận ngày đúng dạng và có thật", () => {
    expect(isIsoDate("2026-08-28")).toBe(true);
    expect(isIsoDate("2026-01-01")).toBe(true);
    expect(isIsoDate("2026-12-31")).toBe(true);
  });

  /**
   * ⚠ Đúng dạng KHÔNG có nghĩa là có thật. Cho `2026-02-30` lọt qua thì `Date.UTC` lặng lẽ dồn nó
   * thành 2026-03-02 — một ngày khác hẳn, không lỗi, không cảnh báo.
   */
  it("loại ngày không tồn tại dù đúng dạng", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-04-31")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
    expect(isIsoDate("2026-08-00")).toBe(false);
    expect(isIsoDate("2026-08-32")).toBe(false);
  });

  /**
   * Năm nhuận đủ ba mệnh đề. Bản rút gọn `year % 4 === 0` đúng liên tục từ 1901 tới 2099, nên chỉ
   * hai mốc thế kỷ dưới đây mới phân biệt được nó với bản đúng.
   */
  it("năm nhuận: 29/02 chỉ hợp lệ ở năm nhuận thật", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2000-02-29")).toBe(true);
    expect(isIsoDate("1900-02-29")).toBe(false);
    expect(isIsoDate("2100-02-29")).toBe(false);
  });

  it("loại chuỗi rác và dạng gần đúng", () => {
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate("hôm nay")).toBe(false);
    expect(isIsoDate("28/08/2026")).toBe(false);
    expect(isIsoDate("20260828")).toBe(false);
    expect(isIsoDate("2026-8-28")).toBe(false);
    expect(isIsoDate("26-08-28")).toBe(false);
    expect(isIsoDate("2026-08-28-01")).toBe(false);
  });

  /** Không `trim()`: dữ liệu ở tầng này đến từ máy, khoảng trắng thừa là dấu hiệu hỏng chứ không phải lỗi gõ. */
  it("không tự cắt khoảng trắng", () => {
    expect(isIsoDate(" 2026-08-28")).toBe(false);
    expect(isIsoDate("2026-08-28 ")).toBe(false);
  });

  /** Nghiêm ngặt một cách cố ý: hàm này trả lời "có phải ngày chỉ-có-ngày không", không phải "đọc được ngày không". */
  it("mốc đầy đủ KHÔNG phải ngày chỉ-có-ngày", () => {
    expect(isIsoDate("2026-08-28T08:12:00+07:00")).toBe(false);
  });
});

describe("parseIsoDate", () => {
  it("tách ngày chỉ-có-ngày, tháng đếm từ 1", () => {
    expect(parseIsoDate("2026-08-28")).toEqual({ year: 2026, month: 8, day: 28 });
    expect(parseIsoDate("2026-01-01")).toEqual({ year: 2026, month: 1, day: 1 });
  });

  /**
   * ⚠ Cái bẫy gốc của cả file: `new Date("2026-08-28")` là mốc UTC, nên `getDate()` ở múi giờ âm
   * trả về 27. Test này khoá lại rằng module KHÔNG đi đường đó — kết quả là 28 bất kể máy nào.
   */
  it("không đi qua new Date(): ngày giữ nguyên, không lệch theo múi giờ", () => {
    expect(parseIsoDate("2026-08-28")?.day).toBe(28);
    // Đối chứng: đây là con số sai mà đường new Date() sẽ cho ở một máy GMT âm.
    expect(new Date("2026-08-28").getUTCDate()).toBe(28);
  });

  it("nhận mốc đầy đủ bằng cách cắt phần sau chữ T", () => {
    expect(parseIsoDate("2026-08-28T08:12:00+07:00")).toEqual({ year: 2026, month: 8, day: 28 });
    expect(parseIsoDate("2026-08-28T00:00:00Z")).toEqual({ year: 2026, month: 8, day: 28 });
    expect(parseIsoDate("2026-08-28T23:59:59.999-05:00")).toEqual({ year: 2026, month: 8, day: 28 });
  });

  /**
   * ⚠ Ngày lấy THEO ĐÚNG offset ghi trong chuỗi, không quy đổi. Cùng một thời điểm vật lý mà viết
   * ở hai offset khác nhau thì cho hai ngày khác nhau — và đó là chủ ý: hạn chót người dùng nhìn
   * thấy là hạn chót theo lịch của họ.
   */
  it("không quy đổi múi giờ: ngày lấy theo đúng offset trong chuỗi", () => {
    expect(parseIsoDate("2026-08-29T00:30:00+07:00")?.day).toBe(29);
    expect(parseIsoDate("2026-08-28T17:30:00Z")?.day).toBe(28);
  });

  it("chuỗi không hợp lệ trả về null, không ném ngoại lệ", () => {
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("không phải ngày")).toBeNull();
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("2026-02-30T10:00:00Z")).toBeNull();
    expect(parseIsoDate("T08:12:00")).toBeNull();
  });
});

describe("toIsoDate", () => {
  it("đệm đủ 4-2-2 chữ số", () => {
    expect(toIsoDate({ year: 2026, month: 8, day: 5 })).toBe("2026-08-05");
    expect(toIsoDate({ year: 2026, month: 12, day: 31 })).toBe("2026-12-31");
    expect(toIsoDate({ year: 26, month: 1, day: 1 })).toBe("0026-01-01");
  });

  /** Hàm ĐỊNH DẠNG thuần: không kiểm, không tự dồn tháng. Muốn chắc thì bọc bằng `isIsoDate`. */
  it("không tự kiểm và không tự dồn ngày tràn", () => {
    expect(toIsoDate({ year: 2026, month: 13, day: 40 })).toBe("2026-13-40");
    expect(isIsoDate(toIsoDate({ year: 2026, month: 13, day: 40 }))).toBe(false);
  });
});

describe("compareIsoDate", () => {
  it("sắp theo thời gian, không theo độ dài chuỗi", () => {
    expect(compareIsoDate("2026-08-27", "2026-08-28")).toBeLessThan(0);
    expect(compareIsoDate("2026-08-28", "2026-08-27")).toBeGreaterThan(0);
    expect(compareIsoDate("2026-08-28", "2026-08-28")).toBe(0);
    expect(compareIsoDate("2026-09-01", "2026-12-01")).toBeLessThan(0);
    expect(compareIsoDate("2025-12-31", "2026-01-01")).toBeLessThan(0);
  });

  /**
   * ⚠ Đây là lý do phải chuẩn hoá qua `parseIsoDate` thay vì so chuỗi thẳng: `"2026-08-28T…"` dài
   * hơn và cùng tiền tố với `"2026-08-28"`, nên phép so chuỗi trần xếp nó SAU dù là cùng ngày.
   */
  it("mốc đầy đủ và ngày trần cùng ngày thì BẰNG nhau", () => {
    expect(compareIsoDate("2026-08-28T09:00:00Z", "2026-08-28")).toBe(0);
    expect("2026-08-28T09:00:00Z" > "2026-08-28").toBe(true);
  });

  it("chuỗi hỏng xếp sau mọi ngày hợp lệ", () => {
    expect(compareIsoDate("rác", "2026-08-28")).toBeGreaterThan(0);
    expect(compareIsoDate("2026-08-28", "rác")).toBeLessThan(0);
    expect(compareIsoDate("9999-12-31", "rác")).toBeLessThan(0);
  });

  /**
   * `sort` đòi một thứ tự TOÀN PHẦN nhất quán; hàm so mâu thuẫn làm engine sắp ra mảng lộn xộn
   * tuỳ thuật toán, không lỗi, không đoán được. Sắp một mảng có lẫn chuỗi hỏng là phép kiểm rẻ nhất.
   */
  it("dùng làm hàm so cho sort: ngày đúng thứ tự, chuỗi hỏng dồn về cuối", () => {
    const sorted = ["2026-12-01", "rác", "2026-01-05", "2026-08-28T09:00:00Z", ""].sort(compareIsoDate);
    expect(sorted.slice(0, 3)).toEqual(["2026-01-05", "2026-08-28T09:00:00Z", "2026-12-01"]);
    expect(sorted.slice(3).sort()).toEqual(["", "rác"]);
  });

  /**
   * Tính chất: phản đối xứng — đảo hai đối số phải đảo dấu, kể cả với chuỗi hỏng.
   *
   * Viết dạng TỔNG bằng 0 thay vì `sign(a,b) === -sign(b,a)` vì `-0` là một giá trị riêng trong JS
   * và `toBe` (tức `Object.is`) phân biệt nó với `+0` — một chi tiết vụn của ngôn ngữ, không phải
   * điều module này quy định, nên đừng để nó làm hỏng phép kiểm.
   */
  it("tính chất: compare(a, b) và compare(b, a) luôn ngược dấu", () => {
    const samples = ["2026-08-28", "2026-08-29", "2026-08-28T23:59:59Z", "rác", "", "0026-01-01"];
    for (const a of samples) {
      for (const b of samples) {
        expect(Math.sign(compareIsoDate(a, b)) + Math.sign(compareIsoDate(b, a))).toBe(0);
      }
    }
  });
});

describe("daysBetween", () => {
  it("đếm xuôi, ngược và bằng không", () => {
    expect(daysBetween("2026-08-28", "2026-08-29")).toBe(1);
    expect(daysBetween("2026-08-29", "2026-08-28")).toBe(-1);
    expect(daysBetween("2026-08-28", "2026-08-28")).toBe(0);
  });

  it("qua ranh giới tháng và năm", () => {
    expect(daysBetween("2026-08-31", "2026-09-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
  });

  /** 2028 nhuận nên năm đó có 366 ngày; 2027 thì không. */
  it("năm nhuận được đếm đủ 366 ngày", () => {
    expect(daysBetween("2028-01-01", "2029-01-01")).toBe(366);
    expect(daysBetween("2027-01-01", "2028-01-01")).toBe(365);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2027-02-28", "2027-03-01")).toBe(1);
  });

  /**
   * ⚠ Khoá lại vì sao dùng `Date.UTC` chứ không `new Date(y, m, d)`: khoảng dưới đây trùm cả hai
   * lần đổi giờ DST của bán cầu Bắc lẫn Nam, nơi một ngày lịch dài 23 hoặc 25 giờ. UTC không có
   * DST nên mọi ngày đúng 86 400 000 ms và con số không phụ thuộc máy nào đang chạy.
   */
  it("không lệch vì DST: các khoảng trùm ngày đổi giờ vẫn ra số nguyên đúng", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-01-01", "2026-12-31")).toBe(364);
  });

  it("phần giờ bị bỏ: đếm theo ngày lịch, không theo 24 giờ trôi qua", () => {
    expect(daysBetween("2026-08-28T23:59:00+07:00", "2026-08-29T00:01:00+07:00")).toBe(1);
    expect(daysBetween("2026-08-28T00:01:00Z", "2026-08-28T23:59:00Z")).toBe(0);
  });

  /**
   * ⚠ `Date.UTC` ánh xạ năm 0..99 thành 1900..1999. Regex cho phép `0099-12-31` nên đường đó đi
   * tới được `Date.UTC`; không gỡ thì con số dưới đây là gần 700 nghìn ngày ÂM thay vì 1.
   */
  it("năm hai chữ số không bị Date.UTC đẩy về thế kỷ 20", () => {
    expect(daysBetween("0099-12-31", "0100-01-01")).toBe(1);
    expect(daysBetween("0026-01-01", "0026-01-02")).toBe(1);
    expect(daysBetween("0001-01-01", "0002-01-01")).toBe(365);
  });

  it("một trong hai chuỗi hỏng thì trả null, không phải 0 hay NaN", () => {
    expect(daysBetween("rác", "2026-08-28")).toBeNull();
    expect(daysBetween("2026-08-28", "rác")).toBeNull();
    expect(daysBetween("2026-02-30", "2026-03-01")).toBeNull();
    expect(daysBetween("", "")).toBeNull();
  });
});

describe("isOverdue", () => {
  it("hạn chót trước hôm nay là quá hạn", () => {
    expect(isOverdue("2026-08-27", "2026-08-28")).toBe(true);
    expect(isOverdue("2025-12-31", "2026-01-01")).toBe(true);
  });

  /** ⚠ Hạn chót "28/08" nghĩa là hết ngày 28: sáng 28 mà đã tô đỏ là báo động sai. */
  it("cùng ngày KHÔNG phải quá hạn", () => {
    expect(isOverdue("2026-08-28", "2026-08-28")).toBe(false);
    expect(isOverdue("2026-08-28T23:59:00Z", "2026-08-28")).toBe(false);
  });

  it("hạn chót sau hôm nay thì chưa quá hạn", () => {
    expect(isOverdue("2026-08-29", "2026-08-28")).toBe(false);
  });

  /**
   * ⚠ Thiên lệch chủ ý, và là lý do hàm đi qua `daysBetween` chứ không qua `compareIsoDate`: nếu
   * so bằng thứ tự sắp xếp thì `today` hỏng sẽ gắn cờ quá hạn cho MỌI công việc.
   */
  it("ngày hỏng ở bất kỳ vế nào cũng KHÔNG bị gắn cờ quá hạn", () => {
    expect(isOverdue("rác", "2026-08-28")).toBe(false);
    expect(isOverdue("2026-08-28", "rác")).toBe(false);
    expect(isOverdue("2020-01-01", "")).toBe(false);
    // Đối chứng: compareIsoDate — đúng để sắp xếp — sẽ trả lời "quá hạn" ở ca thứ hai.
    expect(compareIsoDate("2026-08-28", "rác")).toBeLessThan(0);
  });
});

describe("tính chất trên một dải ngày liên tiếp", () => {
  /*
   * Dải bắt đầu từ 2027-11-15 và dài 800 ngày, tức trùm trọn tháng 2 năm 2028 (nhuận) và tháng 2
   * năm 2029 (không nhuận), cùng đủ 12 độ dài tháng khác nhau. Chuỗi đối chứng do lịch của V8 sinh
   * ra, nên bảng số ngày trong tháng và quy tắc năm nhuận viết tay ở module được kiểm chéo với
   * một nguồn độc lập chứ không tự kiểm chính mình.
   */
  const START = Date.UTC(2027, 10, 15);
  const LENGTH = 800;
  const dates = Array.from({ length: LENGTH }, (_, offset) => isoFromUtc(START + offset * MS_PER_DAY));

  it("mọi ngày sinh ra đều được isIsoDate công nhận", () => {
    for (const date of dates) expect(isIsoDate(date)).toBe(true);
  });

  /** Tính chất khứ hồi: `toIsoDate(parseIsoDate(x)) === x` với mọi `x` hợp lệ. */
  it("tính chất: toIsoDate(parseIsoDate(x)) === x", () => {
    for (const date of dates) {
      const parts = parseIsoDate(date);
      expect(parts).not.toBeNull();
      if (parts === null) continue;
      expect(toIsoDate(parts)).toBe(date);
    }
  });

  it("tính chất: khoảng cách tới ngày đầu dải bằng đúng chỉ số của nó", () => {
    const [first = ""] = dates;
    dates.forEach((date, offset) => {
      expect(daysBetween(first, date)).toBe(offset);
      // `0 - offset` chứ không `-offset`: với offset 0 thì `-offset` là `-0`, và `toBe` phân biệt.
      expect(daysBetween(date, first)).toBe(0 - offset);
    });
  });

  it("tính chất: compareIsoDate tăng đơn điệu theo dải, và isOverdue khớp với nó", () => {
    for (let index = 1; index < dates.length; index += 1) {
      const [previous = "", current = ""] = [dates[index - 1], dates[index]];
      expect(compareIsoDate(previous, current)).toBeLessThan(0);
      expect(isOverdue(previous, current)).toBe(true);
      expect(isOverdue(current, previous)).toBe(false);
      expect(isOverdue(current, current)).toBe(false);
    }
  });
});
