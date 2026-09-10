/**
 * MÃ CÔNG VIỆC hiển thị (`CV-014`) — hàm THUẦN, tầng 1 (xem `docs/kien-truc-ung-dung.md` §4).
 *
 * ── VÌ SAO MÃ NÀY KHÔNG PHẢI LÀ `id` ───────────────────────────────────────────────────────
 * `TaskView.id` là khoá kỹ thuật (cuid/uuid): người dùng không đọc được nó qua điện thoại, không
 * gõ lại được vào ô tìm kiếm, và không nhắc tới nó trong một cuộc họp. `code` sinh ra cho đúng
 * việc đó — nó NGẮN, ĐỌC ĐƯỢC, và tăng dần. Hai thứ tồn tại song song, không thay nhau.
 *
 * ── VÌ SAO Ở TẦNG THUẦN, KHÔNG PHẢI TRONG TẦNG ĐỌC DATABASE ────────────────────────────────
 * Vì cả ba hàm ở đây là quyết định thuần: một chuỗi vào, một số ra. Đặt chúng cạnh Prisma thì
 * nhánh biên duy nhất thật sự nguy hiểm — `nextTaskCode` trên một dãy có lỗ — chỉ kiểm được bằng
 * cách dựng dữ liệu thật, tức là không ai kiểm. Ở đây `vitest` khoá được từng ca trong `node` trần.
 *
 * ── TIỀN TỐ LÀ CHUỖI MÁY, KHÔNG PHẢI CHUỖI DỊCH ────────────────────────────────────────────
 * `CV-` đi vào database, vào URL chia sẻ, vào tiêu đề email thông báo và vào ô tìm kiếm mà người
 * dùng gõ tay. Dịch nó theo ngôn ngữ giao diện thì cùng một công việc mang hai tên gọi, và một mã
 * chép từ giao diện tiếng Anh dán vào giao diện tiếng Việt sẽ không tra ra gì. Nên tiền tố **cố
 * định cho mọi ngôn ngữ**, và vì thế nó được phép nằm trong tầng lõi.
 */

/** Tiền tố của mọi mã công việc. Cố định cho mọi ngôn ngữ — xem ghi chú đầu file. */
export const TASK_CODE_PREFIX = "CV-";

/**
 * Số chữ số TỐI THIỂU của phần số. Đây là ngưỡng đệm, KHÔNG phải giới hạn trên: `formatTaskCode`
 * không bao giờ cắt bớt, nên vượt 999 thì mã dài thêm chứ không quay vòng (xem hàm đó).
 */
const SEQUENCE_PAD_WIDTH = 3;

/**
 * Phần số phải là chữ số ASCII, và CHỈ chữ số.
 *
 * ⚠ Đừng thay bằng `Number.parseInt` trần: `parseInt("14abc", 10)` trả `14` — nghĩa là `CV-14abc`
 * sẽ được nhận như một mã hợp lệ. Trong `nextTaskCode` thì một chuỗi rác kiểu đó không chỉ lọt,
 * nó còn có thể trở thành mốc lớn nhất và đẩy cả dãy mã đi sai.
 *
 * `\d` trong JS (không cờ `u`) chỉ khớp `0-9`, nên chữ số Ả Rập-Ấn (`١٤`) bị loại — đúng ý: mã là
 * chuỗi máy, không đổi theo bàn phím người nhập.
 */
const SEQUENCE_PATTERN = /^\d+$/;

/**
 * Lấy phần số của một mã công việc. `"CV-014"` → `14`. Không phải mã hợp lệ → `null`.
 *
 * Bốn quyết định đáng ghi, cả bốn đều có test khoá lại:
 *
 *   - **Chấp nhận mã KHÔNG đệm** (`CV-14`). Dữ liệu nhập từ hệ thống cũ, từ bảng tính, hay từ một
 *     phiên bản trước khi có quy tắc đệm đều có dạng này. Từ chối chúng thì `nextTaskCode` coi
 *     `CV-14` là rác, bỏ qua nó, rồi cấp lại đúng con số đó cho một việc mới — **trùng mã với một
 *     việc đang tồn tại**. Nới ở đầu vào, chặt ở đầu ra: đọc nhiều dạng, chỉ SINH ra một dạng.
 *   - **Không phân biệt hoa thường ở tiền tố** (`cv-14` cũng nhận). Người dùng gõ mã vào ô tìm
 *     kiếm bằng chữ thường. Việc này chỉ NỚI tập nhận vào và không sinh mơ hồ, vì dạng chuẩn duy
 *     nhất luôn do `formatTaskCode` tạo ra.
 *   - **Cắt khoảng trắng hai đầu.** Mã dán từ bảng tính hay từ một dòng chat gần như luôn kèm một
 *     dấu cách; để nó làm hỏng phép tra là bắt người dùng chịu một lỗi họ không nhìn thấy.
 *   - **`0` và số âm là KHÔNG hợp lệ** (`CV-000` → `null`). Số thứ tự bắt đầu từ 1, nên `CV-000`
 *     là một mã không hệ thống nào cấp. Trả `0` ở đây thì `formatTaskCode(0)` — hàm nghịch đảo —
 *     lại ném lỗi, tức vòng tròn parse → format gãy ở đúng một giá trị. Loại nó ngay tại cửa vào
 *     thì hai hàm này là song ánh trên đúng tập mã có thật.
 *
 * ⚠ Số quá lớn (ngoài `Number.MAX_SAFE_INTEGER`) cũng trả `null`, và đây là cái bẫy kín nhất của
 * file: ở vùng đó phép cộng im lặng ngừng hoạt động — `2 ** 53 + 1 === 2 ** 53`. Nhận một mã như
 * vậy thì `nextTaskCode` cấp lại CHÍNH mã lớn nhất đang có mà không có dấu hiệu nào.
 */
export function parseTaskCode(code: string): number | null {
  const trimmed = code.trim();
  if (trimmed.length <= TASK_CODE_PREFIX.length) return null;

  const prefix = trimmed.slice(0, TASK_CODE_PREFIX.length);
  if (prefix.toUpperCase() !== TASK_CODE_PREFIX) return null;

  const digits = trimmed.slice(TASK_CODE_PREFIX.length);
  if (!SEQUENCE_PATTERN.test(digits)) return null;

  const sequence = Number.parseInt(digits, 10);
  if (!Number.isSafeInteger(sequence) || sequence < 1) return null;
  return sequence;
}

/**
 * Dựng mã hiển thị từ số thứ tự. `14` → `"CV-014"`.
 *
 * **Đệm 3 chữ số là ngưỡng SÀN, không phải trần.** `1000` → `"CV-1000"`, không cắt, không quay
 * vòng. Cắt cho "đẹp cột" thì việc thứ 1000 và việc thứ 1 mang cùng một mã, và mã trùng thì mọi
 * thứ tra theo mã — email, đường dẫn chia sẻ, câu nhắc trong chat — trỏ vào sai bản ghi.
 *
 * ⚠ **Ném lỗi thay vì trả về một mã hỏng.** Số thứ tự sai (`0`, âm, `1.5`, `NaN`) luôn là lỗi lập
 * trình ở nơi gọi — một bộ đếm đọc nhầm, một phép trừ ra số âm. Trả về `"CV-000"` hay `"CV-NaN"`
 * thì chuỗi đó đi thẳng vào database và vào mắt người dùng, còn nguyên nhân thì đã trôi qua từ lâu.
 *
 * `message` viết bằng TIẾNG ANH thuần ASCII: nó là bản dự phòng cho MÁY (log, `curl`), giao diện
 * không bao giờ in nó — cùng lý do đã ghi ở `lib/core/api-error.ts`, và `pnpm core:check` chặn mọi
 * ký tự ngoài ASCII ở tầng này để giữ đúng ranh giới đó.
 */
export function formatTaskCode(sequence: number): string {
  /*
   * `isSafeInteger` chứ không `isInteger`: nó loại luôn `NaN`, `Infinity` và cả vùng số nguyên
   * lớn mà `parseTaskCode` từ chối. Nhờ vậy mọi mã hàm này sinh ra đều đọc ngược lại được — thiếu
   * điều đó thì hai hàm nói hai thứ khác nhau về cùng một tập giá trị.
   */
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error(`formatTaskCode: sequence must be a safe integer >= 1, received ${sequence}`);
  }
  return `${TASK_CODE_PREFIX}${String(sequence).padStart(SEQUENCE_PAD_WIDTH, "0")}`;
}

/**
 * Mã kế tiếp, tính từ danh sách mã ĐANG CÓ. Danh sách rỗng → `"CV-001"`.
 *
 * ⚠ **Đếm từ mã LỚN NHẤT, tuyệt đối không từ `existingCodes.length`.** Dãy mã thật luôn có lỗ:
 * việc bị xoá, bị gộp, hoặc một lần nhập liệu bỏ dở. Với `[CV-001, CV-005]` thì `length + 1` cho
 * `CV-003` — một mã CÒN TRỐNG, nghe rất hợp lý — nhưng với `[CV-001, CV-002, CV-004]` thì nó cho
 * `CV-004`, **trùng đúng một việc đang tồn tại**. Độ dài mảng không biết gì về lỗ trong dãy, và
 * khi mã trùng thì lỗi không nằm ở đây: nó nằm ở lần một người mở nhầm công việc của người khác.
 *
 * Mã rác trong danh sách bị BỎ QUA chứ không làm hỏng kết quả: hàm này hay chạy trên dữ liệu nhập
 * từ nơi khác, và ném lỗi vì một dòng hỏng thì cả thao tác tạo việc dừng lại vì một bản ghi mà
 * người dùng không hề đụng tới.
 *
 * ⚠ Nếu mã lớn nhất đã chạm `Number.MAX_SAFE_INTEGER` thì hàm này NÉM LỖI (qua `formatTaskCode`).
 * Đó là chủ ý: ở ngưỡng đó `+ 1` không còn tăng, nên lựa chọn duy nhất còn lại là cấp trùng mã.
 * Dừng ồn ào tốt hơn hỏng im lặng.
 *
 * App thật gọi hàm này ở tầng đọc dữ liệu; đường chắc chắn hơn là một `sequence` của database
 * (khoá duy nhất + giao dịch), vì hai request cùng lúc đọc cùng một danh sách sẽ tính ra cùng một
 * mã — hàm thuần không giải được cuộc đua đó, và cũng không nên giả vờ là giải được.
 */
export function nextTaskCode(existingCodes: readonly string[]): string {
  let highest = 0;
  for (const code of existingCodes) {
    const sequence = parseTaskCode(code);
    if (sequence !== null && sequence > highest) highest = sequence;
  }
  return formatTaskCode(highest + 1);
}
