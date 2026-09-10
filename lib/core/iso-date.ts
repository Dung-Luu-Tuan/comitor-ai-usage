/**
 * Ngày ISO chỉ-có-ngày (`YYYY-MM-DD`) — hàm THUẦN, tầng 1 (xem `docs/kien-truc-ung-dung.md` §4).
 *
 * ── VÌ SAO CẮT CHUỖI CHỨ KHÔNG `new Date(chuỗi)` ──────────────────────────────────────────
 * `new Date("2026-08-28")` KHÔNG cho ra nửa đêm ở máy đang chạy. Đặc tả ECMAScript nói chuỗi
 * chỉ-có-ngày được hiểu là mốc **UTC**, còn `getFullYear()`/`getDate()` lại đọc theo múi giờ máy.
 * Ghép hai điều đó lại:
 *
 *   · GMT+7 (Việt Nam): `new Date("2026-08-28").getDate()` → **28** — đúng, may mắn thôi.
 *   · GMT-5 (New York): cùng dòng đó → **27** — hạn chót lùi một ngày cho mọi người dùng ở Mỹ.
 *
 * ⚠ Cái bẫy nằm ở chỗ nó KHÔNG lộ ra trên máy lập trình viên ở GMT+7: mọi test tay đều xanh, mọi
 * ảnh chụp màn hình đều đúng, và lỗi chỉ xuất hiện sau khi deploy — dưới dạng "công việc này quá
 * hạn từ hôm qua" cho một công việc còn hạn tới hôm nay. Không có cảnh báo nào, không có ngoại lệ
 * nào; chỉ có những con số sai đúng một đơn vị.
 *
 * Vì vậy mọi hàm ở đây làm việc trên CHUỖI và SỐ: tách `YYYY-MM-DD` bằng regex, tự kiểm số ngày
 * trong tháng bằng bảng + quy tắc năm nhuận. Không có đối tượng `Date` nào tham gia vào việc phân
 * tích, nên không có múi giờ nào tham gia vào kết quả.
 *
 * ── VÌ SAO `daysBetween` LẠI DÙNG `Date.UTC` ──────────────────────────────────────────────
 * Đếm số ngày lịch giữa hai ngày thì tự viết sẽ phải tự đếm năm nhuận — thứ `Date` đã làm đúng.
 * Nhưng phải nạp qua **`Date.UTC`**, tuyệt đối không `new Date(y, m, d)` (giờ ĐỊA PHƯƠNG):
 *
 *   · Ở múi giờ có DST, một ngày lịch dài **23 hoặc 25 giờ**. Chia hiệu số mili-giây cho 86 400 000
 *     ra `0,958…` hoặc `1,041…`, và `Math.round` che được ca một ngày nhưng KHÔNG che được sai số
 *     tích luỹ khi khoảng cách trải qua nhiều lần đổi giờ.
 *   · UTC không có DST: mọi ngày đúng 86 400 000 ms, nên phép chia là số nguyên chính xác, và kết
 *     quả KHÔNG phụ thuộc máy nào đang chạy — cùng một đầu vào cho cùng một số ở mọi nơi.
 *
 * Cả hai vế trên đều có test đối chứng ở `iso-date.test.ts`.
 */

/** Ngày lịch đã tách thành số. `month` đếm từ **1** (tháng Một = 1), không phải từ 0 như `Date`. */
export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Đúng bốn chữ số năm, hai chữ số tháng, hai chữ số ngày — neo hai đầu.
 *
 * ⚠ Bắt buộc đủ chữ số, KHÔNG nhận `2026-8-28`. Dạng thiếu số 0 vẫn "đọc được" với người, nhưng nó
 * phá phép so sánh theo từ điển mà `compareIsoDate` dựa vào (`"2026-8-28" > "2026-12-01"` vì `"8"`
 * lớn hơn `"1"`). Nhận vào rồi chuẩn hoá sau thì hai chuỗi cùng nghĩa lại khác nhau khi làm khoá,
 * khi so `===`, khi gom nhóm. Chặt ngay từ cửa là rẻ nhất.
 */
const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Số ngày của 12 tháng trong năm THƯỜNG; tháng Hai được tính riêng ở `daysInMonth`. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Quy tắc năm nhuận lịch Gregory, đủ **cả ba** mệnh đề.
 *
 * ⚠ Bản rút gọn `year % 4 === 0` đúng liên tục từ 1901 đến 2099, nên nó sống sót qua mọi test viết
 * bằng dữ liệu "đời thường" và chỉ sai ở năm 2100. Viết đủ ba mệnh đề không đắt hơn, và nó còn
 * đúng cho năm 2000 (nhuận vì chia hết 400) — mốc mà nhiều hệ đã trả lời sai.
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Số ngày của một tháng cụ thể. Gọi sau khi đã chắc `month` nằm trong 1..12. */
function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

/** Phần chung của `isIsoDate` và `parseIsoDate`: tách + kiểm ngày CÓ THẬT, trên chuỗi chỉ-có-ngày. */
function parseDateOnly(value: string): DateParts | null {
  const match = ISO_DATE_ONLY.exec(value);
  if (!match) return null;

  const [, yearText = "", monthText = "", dayText = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  /*
   * Kiểm NGÀY CÓ THẬT chứ không chỉ đúng dạng: `2026-02-30` khớp regex nhưng không tồn tại. Nếu
   * cho qua thì nó lặng lẽ trôi xuống `Date.UTC`, chỗ tự "sửa" thành 2026-03-02 — một ngày khác
   * hẳn, không lỗi, không cảnh báo. Chặn ở đây để dữ liệu hỏng dừng lại ở cửa, không hoá thành
   * dữ liệu sai.
   */
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return { year, month, day };
}

/**
 * Chuỗi có đúng dạng `YYYY-MM-DD` **và** là một ngày có thật không?
 *
 * NGHIÊM NGẶT một cách cố ý: mốc đầy đủ (`2026-08-28T08:12:00+07:00`) trả `false`, vì hàm này trả
 * lời câu *"đây có phải một ngày chỉ-có-ngày không"* — dùng để canh cửa dữ liệu vào (query, thân
 * request, cột database). Cần đọc ngày TỪ một mốc đầy đủ thì đó là việc của `parseIsoDate`.
 *
 * Cũng không `trim()`: chuỗi ở tầng này đến từ máy (API, database, URL), không từ người gõ tay.
 * Tự cắt khoảng trắng là im lặng nhận vào dữ liệu bẩn ở đúng chỗ đáng ra phải báo.
 */
export function isIsoDate(value: string): boolean {
  return parseDateOnly(value) !== null;
}

/**
 * Tách chuỗi ISO thành `{ year, month, day }`. Chuỗi không hợp lệ → `null`.
 *
 * Nhận **cả hai** dạng: chỉ-có-ngày (`2026-08-28`) và mốc đầy đủ (`2026-08-28T08:12:00+07:00`) —
 * phần sau chữ `T` bị cắt bỏ trước khi tách.
 *
 * ⚠ Với mốc đầy đủ, kết quả là ngày **theo đúng offset ghi trong chuỗi**, không quy đổi về UTC hay
 * về múi giờ máy. `2026-08-28T23:30:00+07:00` cho ngày 28, dù cùng thời điểm đó ở UTC đã là 28
 * lúc 16:30 và ở GMT-5 vẫn là 28 lúc 11:30 — nhưng `2026-08-29T00:30:00+07:00` thì cho ngày 29 dù
 * ở UTC vẫn còn là 28. Đó là chủ ý: hạn chót "ngày 29" mà người dùng nhìn thấy là ngày 29 theo
 * lịch của họ, và quy đổi múi giờ ở đây sẽ làm chính cái lỗi mà cả file này sinh ra để tránh.
 *
 * Trả `null` chứ không ném ngoại lệ, và cũng không có giá trị mặc định: nơi gọi phải quyết định
 * ngày hỏng nghĩa là gì trong ngữ cảnh của nó (bỏ qua, báo lỗi, hay xếp cuối danh sách).
 */
export function parseIsoDate(value: string): DateParts | null {
  const [datePart = ""] = value.split("T");
  return parseDateOnly(datePart);
}

/**
 * `{ year, month, day }` → `YYYY-MM-DD`, đệm số 0 cho đủ 4-2-2 chữ số.
 *
 * ⚠ Đây là hàm ĐỊNH DẠNG thuần, KHÔNG kiểm tra: `{ year: 2026, month: 13, day: 40 }` cho ra
 * `"2026-13-40"` chứ không `null` và không tự dồn sang tháng sau. Nó nhận đầu vào từ
 * `parseIsoDate` (đã hợp lệ) hoặc từ phép tính của nơi gọi (nơi gọi tự chịu trách nhiệm). Muốn
 * chắc thì `isIsoDate(toIsoDate(parts))`.
 *
 * Đệm năm đủ **4** chữ số chứ không chỉ tháng/ngày: thiếu nó thì năm 26 in ra `"26-01-01"`, chuỗi
 * đó không khớp `ISO_DATE_ONLY` nên vòng `parse → to → parse` gãy ở bước hai.
 */
export function toIsoDate(parts: DateParts): string {
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * So chuỗi thô theo từ điển, trả về đúng ba giá trị `-1 | 0 | 1`.
 *
 * Không dùng `localeCompare`: nó phụ thuộc locale của máy đang chạy (ở một số ngôn ngữ, dấu và
 * chữ hoa được xếp theo luật riêng), nên cùng một mảng có thể sắp ra hai thứ tự khác nhau trên
 * hai máy. Ở tầng thuần thì tất định quan trọng hơn "đúng ngữ văn".
 */
function compareText(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/**
 * So sánh hai ngày ISO. Trả `< 0` nếu `a` trước `b`, `0` nếu cùng ngày, `> 0` nếu `a` sau `b` —
 * đúng khuôn `Array.prototype.sort` chờ đợi.
 *
 * Dạng `YYYY-MM-DD` sắp theo từ điển TRÙNG với sắp theo thời gian (đó là lý do ISO 8601 chọn thứ
 * tự lớn-đến-nhỏ), nên phép so cuối cùng chỉ là so chuỗi. **Nhưng phải chuẩn hoá qua `parseIsoDate`
 * trước**, vì so thẳng thì mốc đầy đủ hỏng cả hai chiều: `"2026-08-28T09:00:00Z"` xếp SAU
 * `"2026-08-28"` (chuỗi dài hơn, cùng tiền tố) dù là cùng ngày, và một chuỗi hợp lệ cạnh một chuỗi
 * rác thì so ra thứ tự tuỳ ký tự đầu.
 *
 * ⚠ Chuỗi KHÔNG hợp lệ xếp **sau tất cả** ngày hợp lệ, và hai chuỗi hỏng so với nhau theo từ điển.
 * Không phải để "đẹp", mà vì `sort` đòi một **thứ tự toàn phần nhất quán**: một hàm so trả kết quả
 * mâu thuẫn (a<b, b<c, nhưng c<a) làm engine sắp ra một mảng lộn xộn tuỳ thuật toán, không lỗi,
 * không đoán được. Xếp mọi chuỗi hỏng về cuối là cách rẻ nhất giữ được tính nhất quán đó — và nó
 * cũng đúng về mặt giao diện: bản ghi có ngày hỏng không nên chen vào giữa dòng thời gian.
 */
export function compareIsoDate(a: string, b: string): number {
  const left = parseIsoDate(a);
  const right = parseIsoDate(b);

  if (left === null && right === null) return compareText(a, b);
  if (left === null) return 1;
  if (right === null) return -1;

  const leftIso = toIsoDate(left);
  const rightIso = toIsoDate(right);
  return leftIso < rightIso ? -1 : leftIso > rightIso ? 1 : 0;
}

/**
 * Nạp một ngày lịch thành mốc UTC (mili-giây).
 *
 * ⚠ `Date.UTC` có một quy tắc kế thừa từ 1995: năm **0..99 bị ánh xạ thành 1900..1999**
 * (`Date.UTC(99, 0, 1)` là 1999, không phải năm 99). Regex ở trên cho phép `0099-12-31` — bốn chữ
 * số, ngày có thật — nên đường đó ĐI TỚI ĐƯỢC đây. Không gỡ thì `daysBetween("0099-12-31",
 * "0100-01-01")` trả về gần 700 nghìn ngày ÂM thay vì 1, và không có gì báo động.
 *
 * Ngày như vậy không xuất hiện trong dữ liệu nghiệp vụ thật, nhưng nó xuất hiện trong dữ liệu
 * SINH RA (fuzz, seed ngẫu nhiên, một trường bị lệch chữ số) — đúng loại đầu vào mà một hàm thuần
 * phải trả lời nhất quán thay vì trả lời bừa.
 */
function toUtcTimestamp(parts: DateParts): number {
  const timestamp = Date.UTC(parts.year, parts.month - 1, parts.day);
  if (parts.year < 0 || parts.year > 99) return timestamp;

  const date = new Date(timestamp);
  date.setUTCFullYear(parts.year);
  return date.getTime();
}

const MS_PER_DAY = 86_400_000;

/**
 * Số ngày lịch từ `from` đến `to` (`to - from`). Dương khi `to` sau `from`, âm khi trước, `0` khi
 * cùng ngày. `null` khi một trong hai chuỗi không hợp lệ.
 *
 * Đếm theo NGÀY LỊCH, không theo "24 giờ trôi qua": phần giờ trong mốc đầy đủ bị bỏ hẳn ở bước
 * `parseIsoDate`, nên `2026-08-28T23:59` → `2026-08-29T00:01` là **1** ngày, không phải 0.
 *
 * `null` thay vì `0` hay `NaN`: `0` nói dối rằng hai ngày trùng nhau, còn `NaN` thì lây lan âm
 * thầm qua mọi phép tính sau đó (`NaN > 3` là `false`, `NaN < 3` cũng `false` — không nhánh nào
 * bắt được). `null` buộc nơi gọi phải xử lý, và `tsc` với `strict` không cho quên.
 */
export function daysBetween(from: string, to: string): number | null {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (start === null || end === null) return null;

  /*
   * Hiệu của hai mốc UTC nửa đêm luôn là bội số CHÍNH XÁC của 86 400 000 (UTC không có DST, không
   * có giây nhuận trong thang thời gian của JS), nên phép chia này ra số nguyên và không cần làm
   * tròn. Vẫn để `Math.round` như một cái chốt: nếu sau này ai đổi sang giờ địa phương, kết quả
   * vẫn là số nguyên — và test DST bên cạnh mới là chỗ báo động, chứ không phải một con số lẻ
   * lọt vào giao diện.
   */
  return Math.round((toUtcTimestamp(end) - toUtcTimestamp(start)) / MS_PER_DAY);
}

/**
 * Hạn chót đã qua chưa, so với ngày `today`?
 *
 * NGHIÊM NGẶT: cùng ngày là **chưa** quá hạn. Hạn chót "28/08" nghĩa là hết ngày 28, nên sáng ngày
 * 28 mà đã tô đỏ là báo động sai — và một chỉ báo báo động sai thì người dùng học cách phớt lờ,
 * kể cả hôm nó đúng.
 *
 * ⚠ Ngày hỏng → `false` (KHÔNG quá hạn), và đây là chỗ duy nhất trong file có thiên lệch chủ ý.
 * Cũng vì thế hàm này đi qua `daysBetween` chứ không qua `compareIsoDate`: `compareIsoDate` xếp
 * chuỗi hỏng về CUỐI, nghĩa là `compareIsoDate(dueDate_hỏng, today) > 0` — nhưng cũng có nghĩa
 * `compareIsoDate(dueDate, today_hỏng) < 0`, tức MỌI công việc bị gắn cờ quá hạn khi cái đồng hồ
 * truyền vào bị hỏng. Đúng thứ tự để sắp xếp, sai thứ tự để kết tội. `daysBetween` trả `null` cho
 * cả hai chiều, nên nhánh này chỉ có một câu trả lời.
 */
export function isOverdue(dueDate: string, today: string): boolean {
  const elapsed = daysBetween(dueDate, today);
  return elapsed !== null && elapsed > 0;
}
