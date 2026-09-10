import { getRequestConfig } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { loadMessages } from "@/lib/i18n/messages";
import { resolveRequestLocale, resolveRequestTimeZone } from "@/lib/i18n/server";

/**
 * Cấu hình `next-intl` cho từng request.
 *
 * Đường dẫn file này KHÔNG tuỳ ý: nó được khai trong `next.config.ts` qua `createNextIntlPlugin`.
 * Đổi chỗ file mà quên sửa cấu hình thì mọi `useTranslations` ném lỗi lúc CHẠY, không phải lúc
 * build — và thông điệp lỗi không nói gì về đường dẫn.
 *
 * `requestLocale` (tham số `next-intl` truyền vào) LUÔN `undefined` ở đây vì module không có
 * segment `[locale]` — xem lý do trong `lib/i18n/config.ts`. Ngôn ngữ lấy từ cookie/header.
 *
 * Tham số `locale` thì KHÁC: nó có giá trị khi ai đó gọi `getTranslations({ locale: "en" })` để
 * dựng chuỗi cho MỘT NGƯỜI KHÁC. Bỏ qua tham số đó là dựng chuỗi sai thứ tiếng cho người nhận.
 * (Nội dung email thì không đi đường này — xem `lib/mail.ts` và lý do ở đó.)
 */
export default getRequestConfig(async ({ locale }) => {
  const resolved = isLocale(locale) ? locale : await resolveRequestLocale();

  return {
    locale: resolved,
    messages: await loadMessages(resolved),
    /*
     * Phải khai tường minh. Thiếu nó, server định dạng ngày theo múi giờ MÁY CHỦ còn client theo
     * múi giờ TRÌNH DUYỆT — hai chuỗi khác nhau cho cùng một mốc, và React báo lỗi hydrate ở đúng
     * những dòng ngày tháng.
     *
     * Nay là múi giờ của NGƯỜI XEM, gieo từ hồ sơ Account vào cookie ở route callback — không còn
     * là một hằng số áp cho tất cả mọi người. `resolveRequestTimeZone()` kiểm giá trị trước khi trả
     * về: cookie thì client sửa được, và một chuỗi lạ làm `Intl` NÉM từ chính file này, tức làm
     * chết cả những trang có nhiệm vụ vẫn sống khi mọi thứ khác hỏng.
     */
    timeZone: await resolveRequestTimeZone(),

    /*
     * ── LƯỚI AN TOÀN CHO KHOÁ SÓT ─────────────────────────────────────────────────────────────
     *
     * ⚠ ĐỌC KỸ, VÌ TÀI LIỆU CỦA REPO TỪNG NÓI NGƯỢC LẠI. Trong một thời gian dài AGENTS.md và
     * `docs/kien-truc-ung-dung.md` viết rằng `t()` **NÉM LỖI** khi khoá không tồn tại và "lỗi lúc
     * render làm trắng cả cây React". Điều đó KHÔNG ĐÚNG với `use-intl` 4.x. Đã đo trên chính bản
     * đang cài, bundle production:
     *
     *     t("a.khong_ton_tai")  →  trả về chuỗi  "a.khong_ton_tai"
     *     t.has("a.khong_ton_tai")  →  false
     *     không ném gì; `defaultOnError` chỉ `console.error`
     *
     * Nghĩa là một khoá bị QUÊN GỌI đi thẳng ra production: nó hiện dưới dạng **chuỗi khoá thô
     * giữa màn hình**, chỉ với người dùng đang xem đúng ngôn ngữ đó, và `pnpm build` vẫn xanh.
     * `INVALID_KEY` mà tài liệu cũ nhắc tới **không tồn tại ở bundle nào cả** — đã thử cả hai. Và
     * hai cách hỏng còn lại cũng im lặng y hệt: một khoá CHỨA DẤU CHẤM trong `messages/` nạp bình
     * thường rồi không bao giờ tra tới được, còn một tham số ICU lệch thì `FORMATTING_ERROR` và
     * cũng trả về tên khoá.
     *
     * Hai lớp bù, và chúng làm hai việc khác nhau:
     */

    /*
     * 1. THẤY BẰNG MẮT. `⟦…⟧` không phải trang trí: một khoá thô như `tasks.table.emptyFiltered`
     *    trông rất giống một nhãn kỹ thuật ai đó cố tình để đấy, nên nó sống sót qua nhiều vòng
     *    xem thử. Cặp ngoặc này thì không lẫn vào đâu được, và nó xuất hiện ở ĐÚNG vòng đi thử
     *    tiếng Anh mà AGENTS.md gọi là "bước hay bị bỏ qua nhất".
     *
     * ⚠ CỐ Ý KHÔNG ném ở môi trường phát triển. Ném là trắng trang, và trắng trang thì mất luôn
     *    phần còn lại của vòng đi thử — người ta sửa một khoá, chạy lại, gặp khoá thứ hai, sửa
     *    tiếp, mỗi vòng một khoá. Hiện ra được thì thấy CẢ BỐN cùng lúc.
     */
    getMessageFallback({ namespace, key }) {
      return `⟦${[namespace, key].filter(Boolean).join(".")}⟧`;
    },

    /*
     * 2. GREP ĐƯỢC. Tiền tố viết hoa cùng khuôn với `[auth]`, `[mail]`, `[api]` của repo — một
     *    dòng `console.error` không tiền tố (mặc định của thư viện) thì không dựng cảnh báo được,
     *    và ở production đó là dấu vết DUY NHẤT.
     */
    onError(error) {
      console.error(`[i18n] KHOÁ HỎNG — ${error.message}`);
    }
  };
});
