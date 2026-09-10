import { type NextRequest, NextResponse } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/core/csp";
import { REQUEST_ID_HEADER, toRequestId } from "@/lib/core/request-id";
import { PATHNAME_HEADER } from "@/lib/core/return-path";

/**
 * Sinh `nonce` cho Content-Security-Policy, mỗi request một giá trị.
 *
 * ⚠ **TÊN FILE LÀ `proxy.ts`, KHÔNG PHẢI `middleware.ts`** — Next 16 đã đổi quy ước. Đặt sai tên
 * thì file không được nạp và KHÔNG có gì báo: trang vẫn chạy, chỉ là không có CSP và không có
 * nonce, tức lớp phòng thủ vắng mặt trong im lặng.
 *
 * ── VÌ SAO VIỆC NÀY KHÔNG SỐNG ĐƯỢC TRONG `next.config.ts` ─────────────────────────────────
 * `headers()` ở đó chỉ đặt header PHẢN HỒI, và giá trị là chuỗi hằng tính lúc build. Nonce phải
 * MỚI ở mỗi request, và quan trọng hơn: **Next đọc nonce từ header của REQUEST**. Không có
 * `proxy.ts` thì repo KHÔNG có nguồn nonce nào cả.
 *
 * Có nonce trên header request rồi thì Next TỰ gắn nó cho mọi script của chính nó. Bốn script
 * chống nháy của `@comitor/ui` (theme, contrast, density, font-size) thì KHÔNG: React 19 không gắn
 * hộ script do người viết render, nên chúng nhận `nonce` qua prop từ `app/layout.tsx`.
 * `@comitor/ui` ≥ 1.1.0 là bắt buộc vì lý do đó.
 */

/**
 * ⚠ ĐẶT ĐÚNG MỘT TÊN HEADER CSP LÊN REQUEST — đây là cái bẫy giết nonce trong im lặng.
 *
 * Next đọc `content-security-policy || content-security-policy-report-only`. Nếu ta đặt cả hai thì
 * bản ÉP thắng; và nếu bản đó không chứa directive nào bắt đầu bằng `script-src`,
 * `getScriptNonceFromHeader` trả `undefined` — mọi thứ trông đúng, nonce biến mất, không lỗi ở đâu.
 *
 * Muốn chạy thử ở chế độ CHỈ BÁO CÁO (khi thêm một script bên thứ ba và chưa chắc chính sách đủ
 * rộng) thì đổi ĐÚNG hằng này sang `"content-security-policy-report-only"` — Next rút nonce từ cả
 * header report-only, nên nonce vẫn được gắn thật trong lúc chưa chặn gì.
 */
const CSP_HEADER = "content-security-policy";

export function proxy(request: NextRequest): NextResponse {
  /*
   * 16 byte ngẫu nhiên, base64. Dùng `crypto.getRandomValues` chứ không `randomUUID`: UUID có 6 bit
   * cố định cho version/variant, tức entropy thật thấp hơn số ký tự gợi ý. Với nonce thì entropy là
   * toàn bộ giá trị của nó.
   */
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...bytes));

  const policy = buildContentSecurityPolicy({
    nonce,
    storageEndpoint: process.env.COMITOR_S3_ENDPOINT ?? "",

    /*
     * Gốc của Account, CHỈ để đưa vào `form-action` — xem `lib/core/csp.ts`. Thiếu nó thì nút
     * "đăng xuất khỏi mọi sản phẩm" bị chính TRÌNH DUYỆT chặn ở bước đi theo 307 sang Account, và
     * thông điệp vi phạm gọi tên một URL same-origin hoàn toàn hợp lệ.
     *
     * Đọc `process.env` thẳng, như hai biến trên: file này chạy ở runtime riêng của Next và không
     * nạp được `lib/env.ts` (nó mang `server-only`). `NEXT_PUBLIC_*` cũng phải viết NGUYÊN VĂN tên
     * biến để phép thay thế văn bản lúc build tìm thấy nó.
     */
    accountOrigin: process.env.NEXT_PUBLIC_COMITOR_ACCOUNT_URL ?? "",

    /*
     * Kho ảnh của Account — nguồn của ảnh đại diện, vào `img-src`. Khác bucket của module, nên nó
     * là một biến riêng chứ không suy được từ `COMITOR_S3_ENDPOINT` hay từ gốc Account.
     * Thiếu nó thì avatar bị trình duyệt chặn và trông y hệt "chưa đặt ảnh".
     */
    accountAssetsOrigin: process.env.COMITOR_ACCOUNT_ASSETS_ORIGIN ?? "",

    /*
     * ⚠ `=== "development"`, KHÔNG phải `!== "production"`.
     *
     * Khác biệt một ký tự này là ranh giới fail-closed. Với `!==`, một môi trường mà `NODE_ENV`
     * khuyết hoặc bị đặt thành thứ khác (`test`, `staging`, một script gọi tay) sẽ nhận
     * `'unsafe-eval'` — tức lớp phòng thủ tự mở ra ở đúng nơi không ai ngờ.
     *
     * ⚠ Và phép so này chỉ đáng tin VÌ nó chạy ở đây. `lib/env.ts` cố ý tránh mọi nhánh theo
     * `NODE_ENV` bởi `next build` chạy với `NODE_ENV=production` — nhưng `proxy.ts` chạy ở LÚC CÓ
     * REQUEST, nơi `next dev` là `development` và `next start` là `production`. Đừng bê khuôn này
     * ngược lại vào `lib/env.ts`.
     *
     * ⚠ Cũng đừng đọc `env` từ `@/lib/env` ở đây: file đó mang `import "server-only"` và đọc khoá
     * bí mật, còn `proxy.ts` chạy ở runtime riêng của Next. Bốn biến cần ở đây đọc thẳng là đúng.
     */
    allowEval: process.env.NODE_ENV === "development"
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_HEADER, policy);
  requestHeaders.set("x-nonce", nonce);

  /*
   * ĐƯỜNG DẪN ĐANG MỞ, để `requireSession()` biết phải đưa người dùng quay lại đâu sau khi đăng
   * nhập. Không có dòng này thì Server Component KHÔNG có cách nào biết pathname: `headers()` chỉ
   * chứa những gì trình duyệt gửi, mà trình duyệt không gửi pathname ở đâu cả.
   *
   * `pathname + search`, không phải `href`: giữ nguyên bộ lọc đang đặt ở `/tasks?status=open`,
   * nhưng KHÔNG mang theo tên miền — thứ sẽ biến header này thành một open redirect nếu ai đó tin
   * nó. `toSafeInternalPath` vẫn kiểm lại lần nữa ở đầu bên kia.
   *
   * ⚠ Đặt lên header REQUEST, không phải response: nó là dữ liệu cho lượt render này, không phải
   * thứ để gửi ra trình duyệt.
   */
  requestHeaders.set(PATHNAME_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);

  /*
   * ID LẦN VẾT — lấy của phía gọi nếu có, sinh mới nếu không.
   *
   * ⚠ Giá trị đến từ ngoài phải qua `toRequestId()` trước: nó đi thẳng vào log, và một ký tự xuống
   * dòng cài trong đó bẻ một dòng log thành hai dòng giả — mang đúng khuôn của những chuỗi viết
   * HOA mà repo dùng làm hợp đồng grep/alert (`[auth] KHÔNG XOAY ĐƯỢC TOKEN`…).
   *
   * ⚠ Matcher LOẠI `/api/` (xem cuối file), nên nhánh API KHÔNG đi qua đây — nó tự sinh id trong
   * `withApiErrors`. Đừng mở rộng matcher để "gộp cho gọn": `proxy.ts` chạy trước MỌI request và
   * mỗi thứ thêm vào đây là chi phí trả trên toàn bộ lưu lượng.
   */
  const requestId = toRequestId(request.headers.get(REQUEST_ID_HEADER));
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  /* Trả id ra trình duyệt: người dùng báo lỗi kèm được nó, và người trực grep thẳng ra dòng log. */
  response.headers.set(REQUEST_ID_HEADER, requestId);
  // Và cùng chuỗi đó lên PHẢN HỒI — đây mới là bản trình duyệt thật sự áp dụng.
  response.headers.set(CSP_HEADER, policy);
  return response;
}

export const config = {
  /*
   * Bỏ qua ba nhóm, mỗi nhóm một lý do:
   *   · `/api/…`                       — không render HTML nên nonce vô nghĩa.
   *   · `_next/static`, `_next/image`  — tài nguyên tĩnh, không có HTML để gắn nonce.
   *   · `favicon.ico`                  — cùng lý do.
   *
   * ⚠ Đừng thêm đường nào khác vì thấy "gọn hơn": mọi đường CÓ render HTML phải đi qua đây, nếu
   * không trang đó mất nonce và mọi script nội tuyến của nó bị chặn.
   */
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"]
};
