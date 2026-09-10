/**
 * "Quay lại đúng chỗ" sau một vòng đăng nhập — hàm THUẦN + một hằng, tầng 1
 * (xem `docs/kien-truc-ung-dung.md` §4).
 *
 * ── VÌ SAO CẦN NÓ ────────────────────────────────────────────────────────────────────────
 * Khi phiên rơi giữa chừng, `requireSession()` đẩy người dùng sang `/api/auth/sign-in` và họ quay
 * lại — nhưng quay lại ĐÂU. Không giữ đích thì mọi người đều rơi về `/`, tức là cứ mỗi lần token
 * hết hạn là một người đang đọc `/tasks/new` bị ném về trang chủ và mất chỗ họ đang đứng.
 *
 * Giữ đích nghĩa là mang một đường dẫn do NGƯỜI DÙNG (hoặc kẻ tấn công) đưa vào đi qua một vòng
 * chuyển hướng — và đó đúng là hình dạng của lỗ hổng **open redirect**: một liên kết
 * `…/api/auth/sign-in?next=https://trang-gia-mao/` khiến chính tên miền của bạn tiếp tay đưa người
 * dùng sang trang lừa đảo, với thanh địa chỉ khởi đầu là tên miền thật.
 *
 * Vì vậy phép lọc ở đây là **danh sách CHO PHÉP, không phải danh sách chặn**: chỉ nhận đường dẫn
 * nội bộ, tuyệt đối, một dấu `/` mở đầu — mọi thứ khác trả `null`.
 */

/**
 * Trần độ dài. Đích quay lại đi vào một cookie ngắn hạn; một chuỗi vài KB ở đó vừa vô nghĩa vừa là
 * cách rẻ nhất để bơm phồng mọi request sau đó.
 */
const MAX_LENGTH = 512;

/**
 * Tên header mang đường dẫn của request hiện tại, do `proxy.ts` đặt.
 *
 * ⚠ Không có nó thì Server Component KHÔNG biết mình đang ở đường dẫn nào: `headers()` chỉ có
 * những gì trình duyệt gửi, và trình duyệt không gửi pathname ở đâu cả. Đây là cách duy nhất
 * `requireSession()` biết phải đưa người dùng quay lại chỗ nào sau khi đăng nhập.
 *
 * Hằng nằm ở tầng 1 vì nó là chỗ DUY NHẤT cả hai bên nhập được: `proxy.ts` chạy ở runtime riêng
 * của Next và không nhập được `lib/` phía máy chủ (những file đó mang `import "server-only"`).
 * Viết chuỗi này ra hai chỗ là để dành sẵn một lần gõ sai không ai phát hiện — hỏng của nó im
 * lặng: `?next=` biến mất, người dùng lặng lẽ rơi về trang chủ.
 */
export const PATHNAME_HEADER = "x-comitor-pathname";

/**
 * Đường dẫn nội bộ an toàn để chuyển hướng tới, hoặc `null` nếu không dùng được.
 *
 * ⚠ Năm cách vượt rào đều đã có tên và đều bị chặn ở đây, đừng gỡ cái nào:
 *
 *   · `//trang-khac.vn` — **URL giao thức tương đối**. Trình duyệt đọc nó là một tên miền KHÁC,
 *     không phải một thư mục tên rỗng. Đây là cách vượt rào phổ biến nhất, và một phép kiểm
 *     `startsWith("/")` đơn độc cho nó qua.
 *   · `/\trang-khac.vn` — cùng một trò, viết bằng dấu chéo ngược: trình duyệt chuẩn hoá `\` thành
 *     `/` TRƯỚC khi phân giải, nên chuỗi này tương đương `//trang-khac.vn`.
 *   · `https://trang-khac.vn` — URL tuyệt đối trần.
 *   · ký tự điều khiển (`\n`, `\r`, `\0`, tab) — chúng bị một số lớp trung gian cắt bỏ hoặc dùng
 *     để chèn thêm dòng header. Đường dẫn thật không bao giờ chứa chúng.
 *   · đoạn `..` — ĐÃ ĐO với `new URL()`: `/..//trang-khac.vn` phân giải ra origin NỘI BỘ (nên một
 *     phép so origin sẽ cho qua) nhưng `pathname` sau chuẩn hoá là `//trang-khac.vn`. Ở đây phép
 *     lọc KHÔNG chuẩn hoá nên chuỗi ấy chưa từng thành open redirect thật — nhưng nó cũng không
 *     có lý do gì để lọt qua một danh sách CHO PHÉP, và bất cứ ai thêm một bước chuẩn hoá vào
 *     đây sau này sẽ mở lại đúng lỗ đó mà không biết. Đường dẫn thật đến từ `nextUrl.pathname`,
 *     thứ Next đã chuẩn hoá sẵn, nên nó không bao giờ chứa `..`.
 *
 * Và một loại bị loại vì lý do KHÁC hẳn: `/api/**`. Đó không phải lỗ hổng mà là vòng lặp — đưa
 * người vừa đăng nhập xong về `/api/auth/sign-in` là bắt đầu lại đúng cái vòng vừa thoát ra.
 */
export function toSafeInternalPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_LENGTH) return null;

  /*
   * Duyệt từng codepoint thay vì một biểu thức chính quy: `\p{Cc}` cần cờ `u` và vẫn bỏ sót một số
   * ký tự phân tách dòng, còn vòng lặp này thì nói đúng điều nó muốn nói — dưới U+0020 là ký tự
   * điều khiển, U+007F là DEL.
   */
  for (const char of trimmed) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return null;
  }

  if (!trimmed.startsWith("/")) return null;
  // Ký tự thứ hai là `/` hoặc `\` → một tên miền khác đội lốt đường dẫn.
  if (trimmed[1] === "/" || trimmed[1] === "\\") return null;

  const pathname = trimmed.split(/[?#]/, 1)[0] ?? "";
  if (pathname === "/api" || pathname.startsWith("/api/")) return null;
  // Đoạn `..` — xem ca `/..//trang-khac.vn` ở JSDoc trên. Cùng luật với bản của `comitor-account`.
  if (pathname.split("/").includes("..")) return null;

  /*
   * Bỏ mảnh neo. Trình duyệt không gửi nó lên máy chủ nên nó không thể đi qua vòng chuyển hướng
   * này; giữ lại chỉ làm chuỗi trong cookie dài ra mà không ai đọc.
   */
  const withoutHash = trimmed.split("#", 1)[0] ?? "";
  return withoutHash || null;
}
