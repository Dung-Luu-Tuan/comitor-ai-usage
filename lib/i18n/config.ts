import { rankAcceptLanguage } from "@/lib/core/accept-language";

/**
 * Hằng số đa ngôn ngữ dùng chung cho CẢ server lẫn client.
 *
 * File này KHÔNG được import `next/headers`, `next/server`, `@/lib/prisma` hay bất cứ thứ gì chỉ
 * chạy ở server: `components/locale-switcher.tsx` là Client Component và nó cần `LOCALES` +
 * `LOCALE_LABELS`. Phần chỉ chạy ở server nằm ở `lib/i18n/server.ts`.
 *
 * ── VÌ SAO LOCALE KHÔNG NẰM TRONG URL ─────────────────────────────────────────────────────
 * Module này không có `/[locale]/…`. Ba lý do, theo thứ tự sức nặng:
 *
 *   1. **Comitor.Account chuyển hướng người dùng tới đường dẫn của module** sau khi đăng nhập, và
 *      nó không biết ngôn ngữ của người đó — lúc redirect thì phiên ở phía module còn chưa tồn
 *      tại. Một tiền tố ngôn ngữ biến mỗi `redirect_uri` đã đăng ký thành N đường.
 *   2. Liên kết trong email (được giao việc, nhắc hạn) là đường dẫn CỐ ĐỊNH, gửi đi rồi thì sống
 *      lâu hơn mọi lựa chọn ngôn ngữ.
 *   3. Đây là trang sau đăng nhập, không index — lợi ích SEO của locale-in-URL, thứ duy nhất thật
 *      sự biện minh cho nó, không tồn tại ở đây.
 *
 * Đánh đổi phải chấp nhận: chia sẻ một liên kết KHÔNG mang theo ngôn ngữ. Người nhận đọc theo ngôn
 * ngữ của chính họ — với một app nội bộ thì đó là hành vi ĐÚNG, không phải thiếu sót.
 */

/**
 * Thứ tự trong mảng là thứ tự hiện ra ở bộ chọn ngôn ngữ. Phần tử ĐẦU là mặc định.
 *
 * Thêm ngôn ngữ = thêm vào đây + thêm `messages/<mã>.json` + thêm một khoản vào `LOCALE_LABELS`,
 * rồi điền `lib/i18n/ui-labels.tsx` và `lib/mail.ts` (cả hai là `Record<Locale, …>` nên TypeScript
 * sẽ báo đỏ cho tới khi xong). Không có chỗ thứ sáu nào phải sửa; nếu có ngày phải sửa chỗ thứ
 * sáu, đó là dấu hiệu ai đó đã chép danh sách này ra một bản sao thứ hai.
 */
export const LOCALES = ["vi", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = LOCALES[0];

/**
 * Tên ngôn ngữ viết BẰNG CHÍNH NGÔN NGỮ ĐÓ (endonym), không dịch.
 *
 * Người đang mắc kẹt ở giao diện tiếng Việt mà chỉ đọc được tiếng Anh cần nhìn thấy chữ "English",
 * không phải "Tiếng Anh" — họ không đọc được dòng chữ đang chỉ lối thoát cho mình. Vì vậy bảng này
 * nằm NGOÀI `messages/*.json`: nó CỐ Ý không dịch theo ngôn ngữ đang hiển thị.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English"
};

/**
 * Múi giờ dùng khi **chưa biết múi giờ của người xem** — giá trị DỰ PHÒNG, không phải câu trả lời.
 *
 * Phải khai TƯỜNG MINH cho `next-intl`: thiếu nó thì server định dạng theo múi giờ của MÁY CHỦ còn
 * client theo múi giờ của TRÌNH DUYỆT — hai kết quả khác nhau cho cùng một mốc, và React báo lỗi
 * hydrate ở đúng những dòng ngày tháng.
 *
 * Múi giờ THẬT của người xem đến từ hồ sơ Comitor.Account (`AccountUser.timezone`), được gieo vào
 * cookie `comitor-tz` ở route callback. Hằng này chỉ áp khi cookie chưa có hoặc không hợp lệ —
 * tức trước lần đăng nhập đầu tiên, và ở những trang không có phiên nào.
 */
export const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * Cookie giữ múi giờ HIỂN THỊ của người xem, gieo từ hồ sơ Account.
 *
 * Vì sao là cookie chứ không đọc phiên lúc render: `i18n/request.ts` chạy TRƯỚC và NGOÀI mọi phiên
 * — nó phục vụ cả những trang không có phiên nào. Cùng một lý do đã khiến ngôn ngữ đi đường cookie.
 *
 * KHÔNG `httpOnly`, cùng họ với `comitor-locale`: đây không phải bí mật.
 * ⚠ Giá trị đọc ra phải qua `isTimeZone()` (`lib/core/time-zone.ts`) — cookie thì client sửa được,
 * và một chuỗi lạ làm `Intl.DateTimeFormat` NÉM từ chính file cấu hình request.
 */
export const TIME_ZONE_COOKIE = "comitor-tz";

/**
 * Hai cookie DẤU — mỗi cái giữ *giá trị Account đã gieo lần trước* cho cookie cùng tên gốc.
 *
 * Chúng là thứ biến "gieo một lần rồi thôi" thành "đi theo Account, trừ khi bạn đã tự đổi trên
 * thiết bị này". Không có chúng thì một lần đổi ngôn ngữ ở Account KHÔNG BAO GIỜ tới được một
 * module đã dùng qua — cookie sống một năm. Luật đầy đủ ở `lib/i18n/adopt.ts`.
 */
export const LOCALE_SEED_COOKIE = "comitor-locale-seed";
export const TIME_ZONE_SEED_COOKIE = "comitor-tz-seed";

/*
 * ⚠ **`WORKSPACE_TIME_ZONE` ĐÃ BỊ BỎ (05.09.2026). ĐỪNG THÊM LẠI.**
 *
 * (Khối `/* *\/` thường, KHÔNG phải JSDoc: dưới nó không có khai báo nào để gắn vào, và một JSDoc
 * mồ côi sẽ bị công cụ dán nhầm vào ký hiệu kế tiếp.)
 *
 * Nó từng là múi giờ mà "hôm nay" và "quá hạn" được tính theo, tách bạch với `DEFAULT_TIME_ZONE`,
 * và AGENTS.md từng liệt nó vào **hợp đồng liên module đóng băng #2** với lý lẽ: *một hạn chót là
 * cam kết của cả nhóm, nên nó phải được đọc bằng MỘT cái lịch, nếu không hai đồng nghiệp ở hai
 * nước thấy hai con số "quá hạn" khác nhau.*
 *
 * ── QUYẾT ĐỊNH MỚI, VÀ CÁI GIÁ ĐÃ ĐƯỢC NÊU RA TRƯỚC KHI CHỌN ─────────────────────────────
 * **Mọi mốc thời gian lưu UTC trong database và hiển thị theo múi giờ CỦA NGƯỜI XEM.** Không có
 * "múi giờ của không gian làm việc" ở bất cứ tầng nào; Comitor.Account KHÔNG mọc cột
 * `organizations.time_zone`, và không có hợp đồng liên module nào về lịch.
 *
 * Cái giá, đã cân nhắc và chấp nhận: `dueDate` là một NGÀY LỊCH chứ không phải một mốc, nên câu
 * *"việc này quá hạn chưa"* nay được trả lời bằng lịch của từng người — hai đồng nghiệp ở hai múi
 * giờ **sẽ** thấy hai con số quá hạn khác nhau trong khoảng lệch giữa họ. Đó là điều lý lẽ cũ tìm
 * cách ngăn; nó được đánh đổi lấy việc bỏ hẳn một khái niệm mà không sản phẩm nào trong hệ đang
 * cần, và bỏ luôn một cột phải thêm vào một dịch vụ danh tính dùng chung.
 *
 * Chỗ không có "người xem" — job nhắc hạn ở `scripts/jobs/due-soon-reminders.ts` — tính theo múi
 * giờ của NGƯỜI NHẬN THƯ, vì đó là suy rộng mạch lạc duy nhất của luật trên. Xem `lib/reminders.ts`.
 *
 * Ai đọc tài liệu cũ và định "nối `WORKSPACE_TIME_ZONE` vào Account cho xong": đừng — việc đó đã
 * được xét và bác bỏ, không phải bị bỏ quên.
 */

/**
 * Cookie giữ lựa chọn ngôn ngữ.
 *
 * Cùng họ tiền tố `comitor-` với `comitor-theme` / `comitor-contrast` / `comitor-density` /
 * `comitor-font-size` của `@comitor/ui` — bốn trục hiển thị đó đều là "áp cho riêng bạn, trên
 * thiết bị này", và ngôn ngữ là trục thứ năm cùng loại.
 *
 * KHÔNG `httpOnly`: đây không phải bí mật, và Server Action ghi nó xong thì client cũng cần đọc
 * được để bộ chọn ngôn ngữ hiện đúng giá trị hiện tại mà không phải chờ một vòng request.
 */
export const LOCALE_COOKIE = "comitor-locale";

/** Một năm. Lựa chọn ngôn ngữ không nên hết hạn giữa hai lần đăng nhập. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Chọn ngôn ngữ khớp nhất từ header `Accept-Language`.
 *
 * Tự phân tích thay vì dùng `@formatjs/intl-localematcher` + `negotiator`: hai gói đó nặng gần
 * 40KB cho một việc mà quy tắc thật sự cần chỉ có ba dòng, và chúng kéo theo một bản `Intl`
 * polyfill mà Node 24 không cần.
 *
 * Hai điểm dễ sai, đã xử lý và đã có test ở `lib/core/accept-language.test.ts`:
 *   - `q` KHUYẾT nghĩa là `q=1`, không phải `q=0`. Coi khuyết là 0 thì `Accept-Language: en` —
 *     dạng phổ biến nhất — bị loại thẳng.
 *   - So khớp phải hạ về ngôn ngữ GỐC: trình duyệt gửi `en-US`, `en-GB`, `vi-VN`; so bằng chuỗi
 *     đầy đủ thì không bao giờ khớp `en` hay `vi`.
 *
 * ⚠ Phần thuật toán nằm ở `lib/core/accept-language.ts` (tầng 1, có test); ở đây chỉ là chỗ ghép
 * nó với danh sách `LOCALES`. Lõi thuần không được biết ngôn ngữ nào tồn tại — xem
 * `docs/kien-truc-ung-dung.md` §4 tầng 1.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  for (const base of rankAcceptLanguage(acceptLanguage)) {
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
