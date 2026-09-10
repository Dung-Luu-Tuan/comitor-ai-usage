import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { version } from "./package.json";

/**
 * ⚠ KHÔNG thêm `transpilePackages: ["@comitor/ui"]`: gói đã publish sẵn ESM đã biên dịch (giữ
 * nguyên `"use client"` theo từng file), Next nạp thẳng. Bắt bundler dịch lại có nguy cơ đánh mất
 * ranh giới server/client của gói.
 *
 * ⚠ KHÔNG có header `Content-Security-Policy` ở đây, và đó KHÔNG phải vì chính sách chưa sẵn sàng
 * — nó nằm ở `proxy.ts`. Lý do là kỹ thuật và cứng: `headers()` chỉ đặt header PHẢN HỒI, còn Next
 * đọc nonce từ header của REQUEST; và giá trị ở đây là chuỗi hằng lúc build, trong khi nonce phải
 * mới ở mỗi request.
 *
 * Để lại một header CSP thứ hai ở file này là một cái bẫy có thật theo HAI cách cùng lúc: trình
 * duyệt áp CẢ HAI chính sách, nên bản không-nonce báo cáo vi phạm cho MỌI script — kể cả script đã
 * có nonce hợp lệ; và nếu nó mang tên header ÉP, Next đọc nó thay vì bản của proxy, không tìm thấy
 * directive `script-src` nào, rồi bỏ nonce đi trong im lặng.
 */
const SECURITY_HEADERS = [
  /*
   * `X-Frame-Options` Ở LẠI ĐÂY dù `frame-ancestors 'none'` đã có trong CSP: nó KHÔNG phải CSP nên
   * không đụng gì tới nonce, và nó phủ những trình duyệt/proxy cũ không đọc `frame-ancestors`.
   * Hai header này không mâu thuẫn — nơi nào hiểu CSP thì CSP thắng.
   */
  { key: "X-Frame-Options", value: "DENY" },

  /*
   * Chặn trình duyệt tự đoán kiểu nội dung. Đáng giá cụ thể ở đây vì module phục vụ TỆP DO NGƯỜI
   * DÙNG TẢI LÊN: thiếu header này, một tệp được đoán nhầm thành HTML là XSS trên chính tên miền
   * của module — và cookie phiên thì nằm ở đúng tên miền đó.
   */
  { key: "X-Content-Type-Options", value: "nosniff" },

  /*
   * `strict-origin-when-cross-origin` — KHÔNG phải `no-referrer`.
   *
   * Lý do rất cụ thể với repo này: `lib/storage.ts` trả về URL ĐÃ KÝ của S3, và một URL đã ký rò
   * qua header `Referer` là tệp riêng tư xem được bởi bất kỳ ai nhận được nó. Chính sách này cắt
   * phần đường dẫn và tham số truy vấn khi đi sang origin khác, tức chữ ký không đi theo.
   *
   * Không chọn `no-referrer` vì nó cắt luôn referrer NỘI BỘ cùng origin — thứ có ích cho việc lần
   * vết điều hướng mà không mang rủi ro gì.
   */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  /* Tắt ba API trình duyệt module không dùng. Rẻ, và nó thu hẹp thứ một XSS làm được nếu có ngày xảy ra. */
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },

  /*
   * HSTS. An toàn để khai cố định vì `lib/env.ts` đã BẮT BUỘC `COMITOR_APP_URL` là https với mọi
   * host không phải loopback — không có cấu hình hợp lệ nào của production chạy trên http.
   *
   * ⚠ KHÔNG có `preload`. Vào danh sách preload của trình duyệt là quyết định gần như KHÔNG rút
   * lại được, và nó ràng `includeSubDomains` lên mọi tên miền con — kể cả những cái chưa tồn tại.
   * Thêm `preload` là việc của người vận hành khi tên miền đã ổn định, không phải mặc định của mã.
   */
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }
];

const nextConfig: NextConfig = {
  /**
   * Gói mọi thứ cần để chạy vào `.next/standalone` — ảnh container không phải mang `node_modules`.
   *
   * ⚠ **`server.js` KHÔNG tự copy `public/` và `.next/static/`.** Đây là cạm bẫy hỏng ÂM THẦM và
   * nó trông y hệt cạm bẫy `allowedDevOrigins`: HTML do server render vẫn về đủ nên trang hiện ra
   * và có cả dữ liệu, nhưng không một chunk JS hay tệp tĩnh nào tải được → React không hydrate →
   * mọi thứ cần client im lặng không chạy. Dockerfile phải copy hai thư mục đó vào ảnh:
   *
   *     COPY --from=build /app/.next/standalone ./
   *     COPY --from=build /app/.next/static ./.next/static
   *     COPY --from=build /app/public ./public
   *
   * Xem docs/trien-khai.md.
   *
   * ⚠ **TẮT trên Vercel, và đó không phải sở thích.** Khoá này khiến `next build` chạy thêm bước
   * `writeStandaloneDirectory` ở cuối, mà bước đó ĐỌC `.next/next-server.js.nft.json` — bảng kê
   * tệp do bước lần vết sinh ra. Trên Vercel bảng kê ấy không có, nên build gãy bằng một thông
   * điệp không nói gì về nguyên nhân:
   *
   *     Error: ENOENT: no such file or directory, open '/vercel/path0/.next/next-server.js.nft.json'
   *
   * Vercel dựng bằng ADAPTER của chính nó (`adapterPath` + `onBuildComplete`): nó TỰ lần vết và
   * tự đóng gói thành serverless function, nên standalone vừa thừa vừa đụng đường. Next biết hai
   * đường này va nhau — `node_modules/next/dist/build/index.js`, ngay trên nhánh standalone:
   * *"in the future output: standalone might not be allowed if an adapter with onBuildComplete is
   * configured"*. Standalone là đường của ẢNH CONTAINER tự vận hành (docs/trien-khai.md §2), không
   * phải của Vercel.
   *
   * `VERCEL` là biến hệ thống Vercel đặt ở MỌI build. Nó do nền tảng đặt chứ không phải cấu hình
   * của ứng dụng — cùng loại với `NODE_ENV` — nên nó không thuộc luật "chỉ `lib/env.ts` đọc
   * `process.env`" ở AGENTS.md; lệnh đếm của mục đó cũng không quét `next.config.ts`.
   */
  output: process.env.VERCEL ? undefined : "standalone",

  /**
   * Số phiên bản hiện ở chân thanh bên, và nó phải là CÙNG một con số với `version` trong
   * `package.json`. Chép tay thì lần `pnpm version` kế tiếp là giao diện nói dối. Next thay
   * `process.env.NEXT_PUBLIC_APP_VERSION` bằng giá trị thật lúc build nên không có gì phải đọc
   * `package.json` ở phía trình duyệt.
   */
  env: { NEXT_PUBLIC_APP_VERSION: version },

  /*
   * Bỏ `X-Powered-By: Next.js`. Nó không bịt được lỗ nào — phiên bản vẫn đoán được từ dấu vết khác
   * — nhưng nó là thông tin cho không.
   */
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  /**
   * Cho phép xem `pnpm dev` qua một tên miền KHÁC `localhost`.
   *
   * VÌ SAO CẦN: khi dev server chạy trong sandbox/máy ảo và ta mở nó qua URL công khai
   * (`sb-….vercel.run`, preview của v0…), Next coi mọi request tới `/_next/*` là cross-origin và
   * CHẶN — cả `/_next/static/chunks/*` lẫn `/_next/hmr`. Hậu quả rất dễ chẩn đoán sai: HTML do
   * server render vẫn về đủ nên trang *trông* bình thường, nhưng KHÔNG một chunk JS nào tải được,
   * React không hydrate, và mọi thứ cần client thì im lặng không hoạt động — popover không mở,
   * `ResponsiveContainer` của recharts không đo được khung nên biểu đồ trống trơn. Không có lỗi
   * nào hiện ở console trình duyệt (request bị chặn ở phía server), chỉ có cảnh báo trong log dev.
   *
   * Chỉ ảnh hưởng `next dev`; `next build`/`next start` không đọc khoá này. Để wildcard vì mỗi
   * sandbox là một subdomain mới, hardcode một host thì lần sau lại chặn.
   */
  allowedDevOrigins: ["*.vercel.run", "*.vusercontent.net", "*.v0.dev", "*.v0.app"]
};

/**
 * `next-intl` chỉ cần được chỉ chỗ file cấu hình theo-request.
 *
 * Đường dẫn phải khai TƯỜNG MINH dù `./i18n/request.ts` cũng là một trong các vị trí mặc định:
 * plugin tìm ở nhiều chỗ và IM LẶNG khi không thấy chỗ nào — `useTranslations` sẽ ném lỗi lúc CHẠY
 * chứ không lúc build, và thông điệp lỗi không nói gì về đường dẫn.
 *
 * KHÔNG bật `experimental.extract` / `createMessagesDeclaration`: chuỗi ở đây viết tay vào
 * `messages/*.json` và kiểu đã có qua `i18n/types.d.ts`. Bật trích xuất là thêm `@swc/core` +
 * `@parcel/watcher` vào đường build cho một việc đang được làm bằng tay tốt hơn — và
 * `pnpm-workspace.yaml` đã cố ý CHẶN build hai gói đó.
 */
export default createNextIntlPlugin({ requestConfig: "./i18n/request.ts" })(nextConfig);
