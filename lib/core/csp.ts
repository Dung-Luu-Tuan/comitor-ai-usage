/**
 * Dựng chuỗi Content-Security-Policy — hàm THUẦN, tầng 1.
 *
 * ── VÌ SAO NÓ KHÔNG SỐNG ĐƯỢC TRONG `next.config.ts` ───────────────────────────────────────
 * `headers()` ở đó chỉ đặt header PHẢN HỒI, và giá trị của nó là một chuỗi hằng tính lúc build.
 * Nonce thì phải MỚI ở mỗi request, và Next đọc nonce từ header của **REQUEST**
 * (`app-render.js`: `headers["content-security-policy"] || headers[…"-report-only"]`). Nên chính
 * sách phải được dựng lại ở mỗi request, trong `proxy.ts`.
 *
 * Đưa nó về tầng 1 còn cho một thứ mà một chuỗi nằm trong `next.config.ts` không bao giờ có: nó
 * **test được**, và ba cái bẫy ghi bên dưới đều có phép kiểm đối chứng ở `csp.test.ts`.
 */

export interface CspOptions {
  /**
   * Nonce của lượt render này, đã mã hoá base64. Bỏ trống thì `script-src` không có `'nonce-…'` —
   * dùng cho những đường không render HTML.
   */
  nonce?: string;
  /** Endpoint kho ảnh khi nó là MinIO ở máy phát triển. Trên AWS để trống. */
  storageEndpoint?: string;
  /**
   * Các gốc phục vụ ảnh của **Comitor.Account** — ngăn nhau bằng KHOẢNG TRẮNG. Đi vào `img-src`.
   *
   * ⚠ **SỐ NHIỀU, và đó là bản sửa của một lỗ đã có thật.** Bản đầu nhận đúng MỘT origin (bucket S3
   * của Account) vì lúc đó chỉ thấy đường ảnh tải lên. Nhưng `toDisplayUrl()` bên Account
   * (`lib/storage.ts`) trả **URL tuyệt đối đi thẳng** cho ảnh không nằm trong bucket của nó:
   *
   *     if (isExternalUrl(stored)) return stored;   // ảnh Google/Facebook lúc đăng nhập social
   *
   * và `organization.logo` nhận BẤT KỲ URL http/https nào người quản trị dán vào
   * (`app/api/workspaces/[idOrSlug]/route.ts`, hàm `parseLogo`). Nên tập nguồn ảnh thật KHÔNG phải
   * một bucket — nó là bucket CỘNG những tên miền mà môi trường ấy thực sự cho phép.
   *
   * Người đăng nhập bằng Google rơi về avatar chữ cái, workspace dán logo ngoài thì mất logo — và
   * cả hai trông y hệt "chưa đặt ảnh". Không có lỗi ở máy chủ, không có gì đỏ.
   *
   * ⚠ VẪN LÀ TẬP ĐÓNG. Liệt kê từng gốc; đừng bao giờ thay bằng `https:`. Bật social login thì
   * thêm gốc CDN ảnh của nhà cung cấp (`https://lh3.googleusercontent.com`,
   * `https://platform-lookaside.fbsbx.com`), đừng mở toang.
   *
   * Đây là tên miền KHÁC `storageEndpoint`: bucket của Account không phải bucket của module.
   *
   * Một `img-src https:` mở toang là kênh rò dữ liệu rẻ nhất mà một XSS có thể dùng
   * (`<img src="https://kẻ-tấn-công/?data=…">`), nên tập nguồn phải liệt kê tay.
   */
  accountAssetsOrigin?: string;
  /**
   * Gốc của Comitor.Account — đi vào `form-action`, và **chỉ** `form-action`.
   *
   * ⚠ Không có nó thì "đăng xuất khỏi mọi sản phẩm" bị TRÌNH DUYỆT chặn, không phải máy chủ từ
   * chối. Đăng xuất toàn hệ là một `<form method="post">` gửi tới route của chính app, nhưng route
   * trả **307 sang Account** — và Chrome áp `form-action` cho CẢ CHUỖI CHUYỂN HƯỚNG mà một lần
   * submit đi qua, không chỉ cho `action` viết trong thẻ. Nên `form-action 'self'` chặn một form
   * mà `action` của nó rõ ràng là same-origin.
   *
   * Đo được 2026-09-03, Chrome, luồng thật: server NHẬN được POST (`closeSession` chạy, 146–546ms)
   * rồi trả 307, và console in *"Sending form data to 'http://localhost:3000/api/auth/sign-out
   * ?everywhere=1' violates … form-action 'self'"*. ⚠ Thông điệp gọi tên URL TRƯỚC chuyển hướng,
   * nên nó chỉ thẳng vào một địa chỉ hoàn toàn hợp lệ — đọc nguyên văn là đi sai đường.
   *
   * ⚠ CHỈ `form-action`. Đừng tiện tay thêm gốc này vào `connect-src` hay `script-src`: trình duyệt
   * KHÔNG gọi thẳng sang Account ở đâu cả (mọi lời gọi đi từ máy chủ, xem `lib/account/`), nên mở
   * thêm là nới bề mặt tấn công để đổi lấy con số không.
   *
   * Bỏ trống thì `form-action` về đúng `'self'` — hình dạng cũ, không hỏng gì.
   */
  accountOrigin?: string;
  /**
   * Cho phép `'unsafe-eval'` trong `script-src`. **CHỈ đặt `true` ở chế độ phát triển.**
   *
   * ── VÌ SAO CÓ CỜ NÀY, KHI MỤC "KHÔNG THÊM unsafe-eval" NGAY BÊN DƯỚI VẪN ĐÚNG ────────────
   * React ở chế độ dev **bắt buộc** dùng `eval` để dựng lại callstack khi gỡ lỗi, và chính nó nói
   * *"React will never use eval() in production mode"*. Nên vi phạm này là một **hằng số** của môi
   * trường dev, không phải một tín hiệu.
   *
   * Không có cờ này thì CSP ép ở dev làm console đỏ VĨNH VIỄN một dòng không ai sửa được — và một
   * kênh cảnh báo lúc nào cũng kêu là kênh sẽ bị bỏ qua, kể cả hôm nó kêu vì một `eval` THẬT. Đó
   * mới là cái giá, chứ không phải sự khó chịu.
   *
   * ⚠ Đánh đổi phải nhớ: đường chạy ở dev nay KHÁC đường chạy thật ở đúng một directive. Một đoạn
   * mã lén dùng `eval` sẽ KHÔNG bị bắt ở dev — nó chỉ lộ ra ở bản build.
   */
  allowEval?: boolean;
}

export function buildContentSecurityPolicy(options: CspOptions = {}): string {
  const nonce = options.nonce?.trim() ?? "";
  const allowEval = options.allowEval === true;
  const storageEndpoint = options.storageEndpoint?.trim() ?? "";
  /* Cắt `/` cuối: `https://a.com/` và `https://a.com` là hai chuỗi khác nhau với bộ khớp của CSP. */
  const accountOrigin = (options.accountOrigin?.trim() ?? "").replace(/\/+$/, "");
  /*
   * Tách theo khoảng trắng rồi cắt `/` cuối TỪNG gốc: `https://a.com/` và `https://a.com` là hai
   * chuỗi khác nhau với bộ khớp của CSP, và một dấu `/` sót lại làm cả gốc đó thành dòng chết.
   */
  const accountAssetsOrigins = (options.accountAssetsOrigin ?? "")
    .split(/\s+/)
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  /*
   * Ảnh đến từ ba nguồn: URL ĐÃ KÝ của kho đối tượng (tệp đính kèm), `data:` (ảnh xem trước dựng
   * tại chỗ trước khi tải lên), và `blob:` (cùng lý do).
   *
   * ⚠ KHÔNG mở `https:` cho mọi tên miền. Comitor.Account phải mở vì `app.iconUrl` là URL do quản
   * trị viên nhập, tức một tập tên miền không đóng được; module này thì mọi ảnh đều đi qua bucket
   * của chính nó, nên tập nguồn ĐÓNG được — và một `img-src https:` mở toang là kênh rò dữ liệu
   * rẻ nhất mà một XSS có thể dùng (nhét `<img src="https://kẻ-tấn-công/?data=…">`).
   */
  const imgSrc = ["'self'", "data:", "blob:", storageEndpoint, ...accountAssetsOrigins].filter(Boolean).join(" ");

  /*
   * Kho ảnh cũng là đích của `fetch` khi Uppy tải tệp lên… KHÔNG: Uppy POST về chính máy chủ này
   * (`/api/tasks/{id}/attachment`), không POST thẳng lên S3. Xem `lib/storage.ts` về lý do CỐ Ý
   * không dùng presigned PUT. Vì vậy `connect-src` chỉ cần `'self'`.
   */
  return [
    "default-src 'self'",

    /*
     * ⚠ `script-src` PHẢI đứng TRƯỚC mọi directive bắt đầu bằng `script-src-`.
     *
     * `getScriptNonceFromHeader` của Next tìm directive bằng `startsWith("script-src")` — nên nếu
     * `script-src-elem` đứng trước, nó khớp NHẦM vào đó, không thấy `nonce-` và trả `undefined`.
     * Kết quả: chính sách trông đúng, nonce biến mất, KHÔNG có lỗi nào ở đâu. Hôm nay repo không
     * khai `script-src-elem`, và thứ tự này là chốt để lần thêm sau không mở lại cái bẫy đó.
     */
    `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}${allowEval ? " 'unsafe-eval'" : ""}`,

    /*
     * ⚠ TUYỆT ĐỐI KHÔNG thêm nonce (hay hash) vào `style-src`.
     *
     * CSP3: hễ `style-src` có nonce, trình duyệt **bỏ qua `'unsafe-inline'`**. Mà `'unsafe-inline'`
     * ở đây là KHÔNG TRÁNH ĐƯỢC — React đặt `style=` NỘI TUYẾN THUỘC TÍNH, và CSP không có nonce
     * cho style thuộc tính, chỉ có cho thẻ `<style>`.
     *
     * Hậu quả đã đo được ở Comitor.Account khi bỏ `'unsafe-inline'` (trình duyệt thật, bản
     * production): thanh tiến độ hiển thị SAI TỈ LỆ (giao diện NÓI DỐI, không phải lệch CSS), icon
     * mất màu thương hiệu, phần tử `sr-only` HIỆN RA giữa trang. Thêm nữa Sonner tiêm một thẻ
     * `<style>` gần 15 nghìn ký tự không nonce.
     *
     * Ví dụ trong tài liệu Next CÓ nonce ở `style-src` — chép nguyên là hỏng theo đúng ba cách trên.
     */
    "style-src 'self' 'unsafe-inline'",

    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    "connect-src 'self'",

    // Không nhúng plugin, không nhúng trang khác.
    "object-src 'none'",
    "frame-src 'none'",

    /*
     * Chống clickjacking.
     *
     * ⚠ Nó nằm TRONG chuỗi này chứ không ở một header CSP riêng. Hai header CSP cùng lúc nghĩa là
     * trình duyệt áp CẢ HAI, và cái không có nonce sẽ báo cáo vi phạm cho MỌI script — kể cả script
     * đã có nonce hợp lệ. `X-Frame-Options: DENY` thì vẫn giữ ở `next.config.ts`: nó KHÔNG phải
     * CSP, nên nó không đụng gì tới nonce, và nó phủ những trình duyệt/proxy cũ.
     */
    "frame-ancestors 'none'",

    /*
     * `base-uri` và `form-action` là hai directive rẻ nhất mà hay bị quên. `base-uri 'self'` chặn
     * một thẻ `<base>` tiêm vào làm đổi đích của MỌI đường dẫn tương đối trên trang.
     *
     * ⚠ KHÔNG thêm `'strict-dynamic'`: khi `script-src` có nó, trình duyệt CSP3 BỎ QUA `'self'` và
     * mọi host-source trong CÙNG directive — biến chúng thành những dòng chết gây hiểu nhầm.
     */
    "base-uri 'self'",

    /*
     * ⚠ `form-action` PHẢI liệt kê gốc của Account — xem `accountOrigin` ở trên. Đây là directive
     * duy nhất trong chính sách này mà một tên miền ngoài được phép xuất hiện, và lý do rất hẹp:
     * đăng xuất toàn hệ submit một form rồi đi theo 307 sang Account.
     */
    `form-action 'self'${accountOrigin ? ` ${accountOrigin}` : ""}`
  ].join("; ");
}
