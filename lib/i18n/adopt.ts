import "server-only";
import { cookies } from "next/headers";
import { isTimeZone } from "@/lib/core/time-zone";
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_SEED_COOKIE,
  TIME_ZONE_COOKIE,
  TIME_ZONE_SEED_COOKIE
} from "@/lib/i18n/config";

/**
 * Kéo NGÔN NGỮ và MÚI GIỜ từ hồ sơ Comitor.Account xuống cookie của thiết bị này.
 *
 * ── ⚠ CHỈ GỌI TỪ ROUTE CALLBACK. KHÔNG GỌI TỪ `lib/account/session.ts`. ─────────────────
 * Ghi cookie chỉ hợp lệ trong **Server Action, Route Handler và `proxy.ts`**. `getSession()` chạy
 * từ `page.tsx`, nên `cookies().set()` ở đó NÉM — và nó ném ở lần đầu tiên có thứ gì cần ghi, chứ
 * không phải lúc build. Bản trước của ghi chú trong `lib/i18n/actions.ts` chỉ vào đúng file sai đó;
 * xem lời đính chính ở đấy.
 *
 * Route callback là chỗ đúng vì cả ba điều cùng đúng ở đó: nó là Route Handler, nó chạy đúng một
 * lần cho mỗi lần đăng nhập, và nó **đã** gọi `getAccountContext()` sẵn — nên hai giá trị này về
 * tay mà không tốn thêm một vòng mạng nào.
 *
 * ── VÌ SAO GIEO VÀO COOKIE THAY VÌ ĐỌC HỒ SƠ LÚC RENDER ─────────────────────────────────
 * `resolveRequestLocale()` và `i18n/request.ts` chạy ở MỌI request có render — kể cả những trang
 * KHÔNG có phiên nào: bốn màn hình chặn, `/signed-out`, `/sign-in-failed`, `error.tsx`. Bắt ngôn
 * ngữ phụ thuộc một lời gọi sang Account là lột mất chữ khỏi đúng cái màn hình có nhiệm vụ nói
 * "không gọi được sang Account". Cookie là bản sao đọc-nhanh; hồ sơ Account là bản gốc.
 *
 * ── ⚠ LUẬT GIEO LẠI: CÓ DẤU, KHÔNG PHẢI "CHỈ GIEO KHI TRỐNG" ────────────────────────────
 * "Chỉ gieo khi thiết bị chưa có giá trị" nghe an toàn, và nó SAI ở chỗ quan trọng nhất: cookie
 * sống một năm, nên một lần đổi ngôn ngữ ở Account sẽ **không bao giờ** tới được một module đã
 * dùng qua. Năm sản phẩm lệch nhau vĩnh viễn sau mỗi cái một lần ghé — tức đúng điều mà việc đưa
 * tuỳ chọn lên Account định chữa.
 *
 * Nên cạnh mỗi cookie hiệu lực có một cookie DẤU giữ *giá trị Account đã gieo lần trước*, và luật
 * là: **đi theo Account, trừ khi bạn đã tự đổi trên thiết bị này.**
 *
 *   · chưa có giá trị hiệu lực            → gieo (lần đầu);
 *   · Account đổi, mà giá trị tại chỗ vẫn  → gieo (người dùng chưa từng đè lên);
 *     đúng bằng cái đã gieo lần trước
 *   · Account đổi, giá trị tại chỗ KHÁC    → GIỮ NGUYÊN. Họ đã tự chọn trên máy này, và lựa chọn
 *     cái đã gieo                            đó thắng một giá trị hồ sơ có thể đã đặt từ lâu.
 *
 * Dấu luôn được cập nhật, kể cả ở nhánh thứ ba — nếu không, một lần đổi bị bỏ qua sẽ còn bị hỏi
 * lại mãi ở mọi lần đăng nhập sau.
 *
 * ⚠ Hệ quả đã chấp nhận: thay đổi ở Account chỉ tới ở **lần đăng nhập kế tiếp**, không tới ngay
 * trong một tab đang mở. Account không phát sự kiện `user.updated` nào để làm tốt hơn.
 *
 * ⚠ **`user.locale` của Account là `NOT NULL DEFAULT 'vi'`**, nên nó KHÔNG phân biệt được "chưa
 * từng chọn" với "đã chọn tiếng Việt". Vì vậy ở lần gieo đầu tiên, một trình duyệt gửi
 * `Accept-Language: en` mà chủ tài khoản chưa bao giờ đụng vào ô ngôn ngữ sẽ nhận tiếng Việt. Đây
 * là hành vi Comitor.Account tự áp cho chính nó (`adoptProfileLocale`), nên module làm giống là
 * NHẤT QUÁN — nhưng cách chữa đúng là để cột đó NULL được ở Account, và ngày đó thì nhánh "lần
 * đầu" dưới đây chỉ cần thêm một phép kiểm `!= null`.
 */
export async function adoptAccountPreferences(user: { locale: string; timezone: string }): Promise<void> {
  const store = await cookies();

  const seed = (
    cookieName: string,
    seedName: string,
    accountValue: string,
    isValid: (value: unknown) => boolean
  ): void => {
    if (!isValid(accountValue)) return;

    const current = store.get(cookieName)?.value;
    const marker = store.get(seedName)?.value;

    const untouched = current === undefined || current === marker;
    if (untouched && current !== accountValue) {
      store.set(cookieName, accountValue, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
        /* KHÔNG `httpOnly`: bộ chọn ngôn ngữ ở client phải đọc được giá trị hiện tại. */
        httpOnly: false,
        secure: process.env.NODE_ENV === "production"
      });
    }

    /* Dấu cập nhật ở MỌI nhánh — xem giải thích ở JSDoc. */
    if (marker !== accountValue) {
      store.set(seedName, accountValue, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production"
      });
    }
  };

  seed(LOCALE_COOKIE, LOCALE_SEED_COOKIE, user.locale, isLocale);
  /*
   * ⚠ `isTimeZone` chứ không phải "có chuỗi là được": giá trị này đi thẳng vào
   * `Intl.DateTimeFormat` ở `i18n/request.ts`, nơi một chuỗi lạ NÉM `RangeError` từ chính file cấu
   * hình request — tức làm chết mọi trang, kể cả những trang có nhiệm vụ vẫn sống khi mọi thứ khác
   * hỏng. Gác ở đây là gác ở đầu VÀO; đầu ĐỌC cũng gác lần nữa, vì cookie thì client sửa được.
   */
  seed(TIME_ZONE_COOKIE, TIME_ZONE_SEED_COOKIE, user.timezone, isTimeZone);
}
