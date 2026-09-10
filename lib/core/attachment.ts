/**
 * Quy tắc kiểm TỆP ĐÍNH KÈM (ảnh) — hàm THUẦN, tầng 1 (xem `docs/kien-truc-ung-dung.md` §4).
 *
 * ── VÌ SAO MỘT MÔ-ĐUN RIÊNG, KHÔNG NẰM TRONG `lib/storage.ts` ──────────────────────────────
 * `lib/storage.ts` nói chuyện với kho đối tượng nên nó là mã CHỈ chạy ở máy chủ. Nhưng ba câu hỏi
 * *"tệp có rỗng không / đúng định dạng không / có quá lớn không"* phải trả lời được ở **CẢ HAI**
 * phía: trình duyệt hỏi trước khi tải lên (để người dùng biết ngay, không chờ hết 2 MB rồi mới bị
 * từ chối), máy chủ hỏi lại vì phía kia không đáng tin. Hai phía phải dùng **CÙNG một hằng số** —
 * hai bản sao lệch nhau thì hoặc trình duyệt chặn thứ máy chủ vẫn nhận (người dùng bị chặn oan),
 * hoặc trình duyệt cho qua thứ máy chủ từ chối (mất công tải lên rồi lỗi ở cuối).
 *
 * ⚠ **Đây là lớp lọc RẺ và NHANH, không phải phép kiểm thật.** `type` đến từ trình duyệt: nó là
 * thứ do phía kia KHAI, không phải thứ đo được từ nội dung. Một tệp `.exe` đổi tên thành `.png`
 * vẫn khai `image/png` và vẫn đi qua `checkAttachment` sạch sẽ. Phép kiểm THẬT là đọc BYTE ĐẦU
 * của tệp ở máy chủ (magic number) — việc đó cần chính nội dung tệp nên nó KHÔNG thuộc tầng này.
 * Đừng đọc mô-đun này như một bảo đảm về nội dung; nó chỉ loại sớm những ca hiển nhiên sai.
 */

import { ERROR_CODES, type ErrorCode } from "@/lib/core/api-error";
import { APP_ID } from "./app-identity";

/** 2 MB. Ảnh chụp màn hình và ảnh chụp từ điện thoại (đã nén) đều nằm dưới mức này. */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/**
 * MIME được nhận → ĐUÔI TỆP dùng khi dựng khoá object.
 *
 * Mỗi MIME ánh xạ sang ĐÚNG MỘT đuôi (`image/jpeg` → `.jpg`, không phải `.jpeg`): khoá phải suy
 * được một cách tất định từ kiểu tệp, nên một MIME cho hai đuôi là một chỗ để hai lần chạy sinh ra
 * hai khoá khác nhau cho cùng một tệp.
 *
 * ⚠ Đây là danh sách CHO PHÉP, không phải danh sách CHẶN. Thêm một kiểu vào đây là mở thêm một
 * loại nội dung mà trình duyệt sẽ render từ tên miền của mình — `image/svg+xml` chẳng hạn KHÔNG
 * bao giờ được thêm: SVG là XML, nó chạy được `<script>`, tức một tệp "ảnh" tải lên trở thành XSS
 * ngay trên tên miền của ứng dụng.
 */
export const ALLOWED_ATTACHMENT_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp"
};

/**
 * Các MIME được nhận, theo đúng thứ tự khai ở bảng đuôi tệp.
 *
 * ⚠ **SUY từ `ALLOWED_ATTACHMENT_EXTENSIONS`, cố ý không chép tay.** Hai danh sách rời nhau thì
 * sớm muộn lệch, và chỗ lệch có hình dạng rất khó chịu: `checkAttachment` cho một kiểu đi qua,
 * rồi `attachmentObjectKey` ném lỗi vì không tra được đuôi — tức lỗi 500 xảy ra SAU khi máy chủ đã
 * nhận trọn tệp, ở một đường mà mọi phép kiểm đều đã báo "hợp lệ". Suy ra thì hằng đúng
 * *"kiểu nào qua được cửa thì dựng được khoá"* là chuyện của kiểu dữ liệu, không phải của kỷ luật.
 */
export const ALLOWED_ATTACHMENT_TYPES: readonly string[] = Object.keys(ALLOWED_ATTACHMENT_EXTENSIONS);

/**
 * Hạ MIME về phần "essence" đã chuẩn hoá: bỏ tham số sau `;`, cắt khoảng trắng, hạ chữ thường.
 *
 * ⚠ MIME **không phân biệt hoa thường** (RFC 2045 §5.1) và **được phép mang tham số**
 * (`image/jpeg; charset=binary`). So bằng `===` với chuỗi thô thì một tệp PNG hoàn toàn hợp lệ đến
 * từ một client viết hoa header sẽ nhận `ATTACHMENT_TYPE_INVALID` — một câu trả lời SAI, và là
 * kiểu sai không bao giờ tái hiện được trên máy người sửa vì trình duyệt luôn gửi chữ thường.
 */
function normalizeContentType(contentType: string): string {
  const [essence = ""] = contentType.split(";");
  return essence.trim().toLowerCase();
}

/**
 * Kiểm một tệp đính kèm trước khi ghi lên kho. `null` = hợp lệ.
 *
 * ── THỨ TỰ KIỂM LÀ MỘT PHẦN CỦA HỢP ĐỒNG: RỖNG → KIỂU → KÍCH THƯỚC ────────────────────────
 * Mỗi phép kiểm sinh ra một CÂU BẢO NGƯỜI DÙNG LÀM GÌ, nên thứ tự sai không cho ra "lỗi khác một
 * chút", nó cho ra một lời khuyên sai:
 *
 *   - **Rỗng trước kiểu.** Một tệp 0 byte vẫn mang `type` ĐÚNG (trình duyệt lấy `type` từ đuôi tệp
 *     chứ không từ nội dung), nên nếu kiểm kiểu trước thì tệp rỗng lọt qua và ta phải bịa ra một
 *     lý do khác; còn nếu tệp rỗng lại mang kiểu lạ, nói "sai định dạng" là bảo người dùng đi đổi
 *     định dạng của một tệp mà vấn đề là nó **không có nội dung** — thường do kéo nhầm một shortcut
 *     hoặc một tệp đang đồng bộ dở.
 *   - **Kiểu trước kích thước.** Một video 40 MB sai cả hai. Nói "quá lớn" là đẩy người dùng đi nén
 *     video — việc mất thời gian và KHÔNG BAO GIỜ dẫn tới thành công, vì kiểu đó không được nhận ở
 *     bất kỳ kích thước nào. Nói "sai định dạng" mới là câu duy nhất giúp họ tiến lên.
 *
 * `size` không phải số hữu hạn dương thì không phải một số byte: `NaN` (thường do
 * `Number.parseInt` một header hỏng) và số âm đều trả `ATTACHMENT_EMPTY`. Bỏ qua nhánh này là để
 * `NaN` trượt qua CẢ HAI phép so sánh (`NaN <= 0` và `NaN > MAX` đều `false`) và cửa kích thước
 * biến mất — im lặng, đúng với input mà phía kia điều khiển được.
 * `Infinity` thì rơi vào `ATTACHMENT_TOO_LARGE`, đúng nghĩa của nó.
 */
export function checkAttachment(input: { size: number; type: string }): ErrorCode | null {
  const { size, type } = input;

  if (Number.isNaN(size) || size <= 0) return ERROR_CODES.ATTACHMENT_EMPTY;
  if (!ALLOWED_ATTACHMENT_TYPES.includes(normalizeContentType(type))) return ERROR_CODES.ATTACHMENT_TYPE_INVALID;
  if (size > MAX_ATTACHMENT_BYTES) return ERROR_CODES.ATTACHMENT_TOO_LARGE;

  return null;
}

/** Ký tự hợp lệ trong một đoạn khoá. `cuid()` của Prisma và mọi id/hex/uuid đều nằm trong tập này. */
const KEY_SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * Chặn một đoạn khoá dị dạng NGAY TẠI ĐÂY thay vì để nó đi vào chuỗi khoá.
 *
 * `taskId` lẽ ra luôn là một `cuid()` đọc từ database, nhưng "lẽ ra" là thứ đúng cho tới lần đầu
 * một route handler chuyền thẳng `params.taskId` xuống. Một đoạn chứa `/` hay `..` biến khoá thành
 * một đường dẫn khác hẳn tiền tố mà chính sách IAM đang giới hạn — tức tệp rơi ra ngoài phạm vi
 * quyền đã cấp, và ném lỗi ở đây thì hỏng NGAY, ồn ào, trước khi có byte nào được ghi.
 */
function assertKeySegment(label: string, value: string): void {
  if (KEY_SEGMENT.test(value)) return;

  const got = JSON.stringify(value);
  throw new Error(`Attachment object key segment "${label}" must match [A-Za-z0-9_-]+, got: ${got}`);
}

/**
 * Dựng KHOÁ object cho một tệp đính kèm: `{APP_ID}/attachment/{taskId}/{random}{ext}`.
 *
 * ── ⚠ TIỀN TỐ `{app}/{tính-năng}` LÀ BẮT BUỘC ─────────────────────────────────────────────
 * Mọi app Comitor dùng CHUNG một bucket. Không có tiền tố thì hai app ghi đè lên nhau (một khoá
 * `abc123.png` là của ai?), và — nặng hơn — **không giới hạn được quyền theo từng app**: chính
 * sách IAM/bucket phân quyền theo TIỀN TỐ khoá, nên một app không có tiền tố riêng thì hoặc được
 * cấp quyền trên toàn bucket, hoặc không được cấp gì. Tầng `{tính-năng}` cho thêm một thứ rẻ mà
 * sau này rất khó thêm: một quy tắc vòng đời (xoá sau N ngày) đặt được cho riêng tệp đính kèm.
 *
 * ⚠ Tiền tố đến từ `APP_ID` (`lib/core/app-identity.ts`), KHÔNG viết cứng ở đây. Một module mới
 * quên đổi nó sẽ ghi tệp của khách hàng mình vào vùng khoá của app khác — nằm ngoài phạm vi IAM
 * được cấp, và không có gì báo.
 *
 * ── ⚠ KHÔNG BAO GIỜ DÙNG TÊN TỆP GỐC LÀM KHOÁ ─────────────────────────────────────────────
 * Tên gốc do người dùng đặt: nó chứa dấu, khoảng trắng, dấu `/`, và cả `..`. Ba hậu quả, theo thứ
 * tự nặng dần: khoá phải mã hoá URL ở mọi chỗ dùng; hai người tải lên cùng một `anh.png` thì người
 * sau ghi đè tệp người trước; và một tên chứa `../` đưa object ra ngoài tiền tố nói trên. Tên gốc
 * đi vào cột `attachmentName` để HIỂN THỊ (qua `safeAttachmentName`), không đi vào khoá.
 *
 * ── VÌ SAO `random` ĐƯỢC TRUYỀN VÀO CHỨ KHÔNG SINH TRONG HÀM ──────────────────────────────
 * Hàm thuần phải TẤT ĐỊNH. Tự gọi `crypto.randomUUID()` bên trong là biến hàm này thành thứ chỉ
 * kiểm được bằng một regex ("khoá trông giống khoá"), chứ không kiểm được "với đúng input này thì
 * khoá phải LÀ chuỗi này" — mà cái sau mới là thứ khoá được hình dạng khoá lại. Nơi gọi (rìa B)
 * giữ nguồn ngẫu nhiên; nó cũng là nơi biết phải dùng nguồn nào cho đủ mạnh.
 *
 * Phần ngẫu nhiên còn phải KHÔNG ĐOÁN ĐƯỢC, không chỉ là duy nhất: khoá đoán được cộng với một URL
 * ký nhầm phạm vi là một đường liệt kê tệp của cả không gian làm việc.
 *
 * @throws Error nếu `contentType` không nằm trong `ALLOWED_ATTACHMENT_TYPES`, hoặc `taskId` /
 *   `random` không phải một đoạn khoá hợp lệ. Ném chứ không trả `null`: tới bước dựng khoá thì
 *   `checkAttachment` đã phải chạy rồi, nên một kiểu sai ở đây là LỖI LẬP TRÌNH, không phải input
 *   xấu của người dùng — và lỗi lập trình thì phải nổ, đừng để nó thành một khoá `undefined`.
 */
export function attachmentObjectKey(input: { taskId: string; contentType: string; random: string }): string {
  const extension = ALLOWED_ATTACHMENT_EXTENSIONS[normalizeContentType(input.contentType)];
  if (extension === undefined) {
    // `JSON.stringify` để một `\n` cài trong header không bẻ dòng log thành hai dòng giả.
    throw new Error(`Unsupported attachment content type: ${JSON.stringify(input.contentType)}`);
  }

  assertKeySegment("taskId", input.taskId);
  assertKeySegment("random", input.random);

  return `${APP_ID}/attachment/${input.taskId}/${input.random}${extension}`;
}

/** Giới hạn của cột hiển thị. Đủ dài cho một tên thật, đủ ngắn để không phá bố cục bảng. */
const MAX_ATTACHMENT_NAME_LENGTH = 120;

/**
 * Ký tự điều khiển: C0 (`\u0000`–`\u001F`), DEL (`\u007F`) và C1 (`\u0080`–`\u009F`).
 *
 * Viết bằng `codePointAt` chứ không bằng regex vì Biome cấm ký tự điều khiển trong một regex literal
 * (`noControlCharactersInRegex`) — và luật đó đúng: gõ thẳng một ký tự điều khiển vào regex gần như
 * luôn là gõ nhầm. Ở đây ta CỐ Ý nói về chúng, nên nói bằng số.
 */
function isControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
}

/**
 * Làm sạch tên tệp gốc để LƯU HIỂN THỊ — **không phải** để làm khoá (khoá dựng bằng
 * `attachmentObjectKey`).
 *
 * Ba phép làm sạch, mỗi phép vá một hậu quả có thật:
 *
 *   - **Cắt đường dẫn** (cả `/` lẫn `\`). Vài trình duyệt/agent gửi cả đường dẫn máy người dùng
 *     (`C:\Users\thanh\anh.png`); giữ nguyên là vừa lộ tên tài khoản và cấu trúc thư mục của họ,
 *     vừa in ra một chuỗi vô nghĩa trong danh sách tệp.
 *   - **Bỏ ký tự điều khiển.** Chuỗi này đi vào log máy chủ và vào **bản xuất CSV** (`lib/core/csv.ts`):
 *     một ký tự `\r\n` lọt vào giữa tên tệp là một DÒNG mới trong tệp CSV, tức bảng tính đọc lệch
 *     từ dòng đó trở đi. Đây là lỗi hỏng-dữ-liệu, không phải lỗi thẩm mỹ.
 *   - **Giới hạn 120 KÝ TỰ (code point), không phải 120 đơn vị UTF-16.** `"…".slice(0, 120)` cắt
 *     giữa một cặp surrogate (emoji trong tên tệp là chuyện thường) và để lại một nửa ký tự — thứ
 *     hiện ra là ô vuông `\uFFFD` ở mọi chỗ đọc, và là một chuỗi mà vài bộ phân tích JSON nghiêm
 *     ngặt từ chối. `Array.from` duyệt theo code point nên không bao giờ cắt vỡ.
 *
 * ⚠ Đây KHÔNG phải phép thoát cho header `Content-Disposition`. Nơi dựng header đó phải tự thoát
 * (hoặc dùng `filename*=UTF-8''…` theo RFC 6266) — tên trả về ở đây vẫn có thể chứa dấu nháy kép.
 * Và nó cũng không chống được trò lật chiều hiển thị (U+202E) để một tên trông như `.png`: cái chốt
 * cho chuyện đó là ĐUÔI TỆP trong khoá, vốn suy từ MIME đã kiểm chứ không lấy từ tên này.
 */
export function safeAttachmentName(name: string): string {
  const lastSegment = name.split(/[\\/]/).at(-1) ?? "";
  const cleaned = Array.from(lastSegment)
    .filter((character) => !isControlCharacter(character))
    .join("")
    .trim();
  const truncated = Array.from(cleaned).slice(0, MAX_ATTACHMENT_NAME_LENGTH).join("").trim();

  // `.` và `..` là tên THƯ MỤC, không phải tên tệp — hiển thị chúng chỉ làm người đọc bối rối.
  if (truncated === "" || truncated === "." || truncated === "..") return "attachment";

  return truncated;
}

/**
 * Số byte đầu cần đọc để nhận ra kiểu ảnh. 12 là đủ cho cả ba kiểu được phép.
 *
 * Đọc ít nhất có thể là chủ ý: rìa B phải đọc chừng này byte TRƯỚC khi quyết định có nhận phần
 * còn lại hay không, nên con số này nằm trên đường nóng của mọi lần tải lên.
 */
export const IMAGE_SNIFF_BYTES = 12;

/**
 * Nhận kiểu ảnh từ NỘI DUNG, không từ lời khai của trình duyệt.
 *
 * ── VÌ SAO HÀM NÀY LÀ PHÉP KIỂM THẬT, CÒN `checkAttachment` THÌ KHÔNG ────────────────────
 * `checkAttachment` đọc `file.type` — một chuỗi do PHÍA KIA khai. Một tệp `.exe` đổi tên thành
 * `.png` khai `image/png` và đi qua nó sạch sẽ. Chỉ có byte đầu mới nói được nội dung thật là gì,
 * và byte đầu thì chỉ có ở rìa B.
 *
 * Hậu quả cụ thể của việc tin lời khai: object được ghi với `Content-Type: image/png`, nên khi
 * người dùng mở URL đã ký, trình duyệt **render nó từ tên miền của ứng dụng**. Với một tệp HTML
 * hay SVG cải trang, đó là XSS trên chính origin của mình — cùng lý do `image/svg+xml` không bao
 * giờ có mặt trong danh sách cho phép.
 *
 * ── VÌ SAO Ở TẦNG 1 ─────────────────────────────────────────────────────────────────────
 * Nó là một hàm thuần trên một mảng byte: không I/O, không framework, tất định. Đúng loại thứ mà
 * unit test bắt được nhánh biên (tệp cụt, chữ ký đúng một nửa, WebP thiếu phần "WEBP") còn chạy
 * thật thì không bao giờ đi qua.
 *
 * @returns MIME nhận ra được, hoặc `null` nếu không phải kiểu nào được phép.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const at = (index: number): number => bytes[index] ?? -1;

  /* PNG: 89 50 4E 47 0D 0A 1A 0A — tám byte, không kiểu nào khác dùng chuỗi này. */
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((byte, index) => at(index) === byte)) return "image/png";

  /*
   * JPEG: FF D8 FF. Byte thứ tư đổi theo biến thể (JFIF/Exif/…) nên KHÔNG kiểm nó — kiểm chặt hơn
   * mức chữ ký thật sự bảo đảm là từ chối những tệp hợp lệ, và một phép kiểm từ chối nhầm sẽ bị gỡ.
   */
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";

  /*
   * WebP: "RIFF" ở byte 0–3, rồi 4 byte độ dài, rồi "WEBP" ở byte 8–11.
   *
   * ⚠ Phải kiểm CẢ HAI cụm. "RIFF" một mình còn là WAV, AVI và một họ định dạng khác — nhận
   * nhầm ở đây nghĩa là ghi một tệp âm thanh vào bucket dưới nhãn `image/webp`.
   */
  const RIFF = [0x52, 0x49, 0x46, 0x46];
  const WEBP = [0x57, 0x45, 0x42, 0x50];
  if (RIFF.every((byte, index) => at(index) === byte) && WEBP.every((byte, index) => at(8 + index) === byte)) {
    return "image/webp";
  }

  return null;
}
