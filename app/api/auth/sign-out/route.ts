// @api-guard: đăng xuất là thao tác trên CHÍNH PHIÊN của người gọi — không có quyền nào để hỏi,
// và đòi một quyền ở đây nghĩa là một người bị gỡ khỏi workspace không thoát ra được. Chốt của nó
// là cookie phiên: không có cookie thì không có gì để đóng.

import { createLogoutUrl } from "@comitor/account-sdk";
import { type NextRequest, NextResponse } from "next/server";
import { accountConfig } from "@/lib/account/config";
import {
  clearGlobalSignOut,
  clearSessionCookie,
  markGlobalSignOut,
  readSessionCookie
} from "@/lib/account/session-cookie";
import { closeSession } from "@/lib/account/session-store";
import { env } from "@/lib/env";

/**
 * Đăng xuất — và **hai mức độ, cố ý khác nhau**.
 *
 *   · mặc định: thoát khỏi RIÊNG module này. Xoá cookie phiên của module và thu hồi refresh token.
 *     Phiên tại Comitor.Account còn nguyên, nên người dùng vẫn đang đăng nhập ở Chat, CRM, và ở
 *     chính Account. Bấm "Đăng nhập" lần sau là vào thẳng, không phải gõ mật khẩu lại.
 *   · `?everywhere=1`: thoát khỏi **toàn hệ** — chuyển tiếp sang `end_session` của Account.
 *
 * ⚠ Gộp hai mức này làm một là một lựa chọn tệ theo cả hai hướng. Chỉ có mức "toàn hệ" thì một
 * người dùng bấm đăng xuất ở Công việc bị văng khỏi mọi sản phẩm đang mở — bất ngờ và khó chịu.
 * Chỉ có mức "riêng app" thì máy dùng chung không có cách nào thoát thật sự, và đó là một lỗ hổng.
 *
 * ── VÌ SAO THU HỒI REFRESH TOKEN, KHI ĐÃ XOÁ COOKIE ──────────────────────────────────────
 * Vì cookie chỉ là BẢN SAO. Nó có thể đã bị chép ra ngoài (sao lưu trình duyệt, extension, log của
 * proxy), và một refresh token còn sống thì đổi được access token mới cho tới khi hết hạn — hàng
 * tuần. Xoá cookie làm người dùng thấy mình đã thoát; thu hồi token làm điều đó thành sự thật.
 *
 * Thu hồi là BEST-EFFORT: Account không với tới được thì vẫn phải xoá cookie và cho người dùng
 * thoát. Ném lỗi ở đây là để họ mắc kẹt trong một phiên họ vừa nói là muốn kết thúc.
 *
 * Phép thu hồi nằm trong `closeSession()` chứ không ở đây, và đó là chủ ý: nó đi LIỀN với phép xoá
 * hàng phiên, nên không có đường nào xoá phiên mà quên thu hồi token. `callback` dùng chung đúng
 * hàm đó để đóng phiên cũ khi người dùng đăng nhập lại.
 */
/**
 * ⚠ **`POST`, KHÔNG PHẢI `GET`** — và đây không phải chuyện thuần tuý REST.
 *
 * `?everywhere=1` chuyển tiếp sang `end_session` của Comitor.Account, tức nó đăng xuất người dùng
 * khỏi **mọi sản phẩm Comitor**. Với `GET`, một thẻ `<img src="/api/auth/sign-out?everywhere=1">`
 * hay một liên kết trong tin nhắn là đủ để làm điều đó thay họ.
 *
 * ⚠ Và `sameSite=lax` KHÔNG cứu được ca đó. `lax` chặn cookie ở request phụ (ảnh, XHR) nhưng **có
 * gửi** cho điều hướng top-level — tức đúng cái người dùng làm khi bấm một liên kết. Chỉ có việc
 * đổi sang một phương thức không-an-toàn mới đóng đường này lại, vì `<a>` và `<img>` không phát ra
 * `POST` được.
 */
export async function POST(request: NextRequest) {
  const everywhere = new URL(request.url).searchParams.get("everywhere") === "1";
  const secret = await readSessionCookie();

  /*
   * XOÁ CẢ HAI: hàng trong database (kèm thu hồi token) và cookie.
   *
   * Thiếu vế đầu thì phiên vẫn tra được — ai cầm được bản sao cookie cũ vẫn vào lại như thường,
   * và "đăng xuất" chỉ còn là một câu nói. Thiếu vế sau thì người dùng mang một cookie trỏ vào hư
   * không, vô hại nhưng bẩn.
   *
   * ⚠ `clearSessionCookie()` chạy KỂ CẢ khi `closeSession` hỏng, và thứ tự đó là chủ ý: người dùng
   * đã nói họ muốn thoát. Database không với tới được là một sự cố của hệ thống, không phải lý do
   * để giữ họ ở lại trong một phiên đang mở trên máy có thể là máy dùng chung.
   */
  let stored: Awaited<ReturnType<typeof closeSession>> = null;
  if (secret) {
    try {
      stored = await closeSession(secret);
    } catch (error) {
      console.error("[auth] KHÔNG ĐÓNG ĐƯỢC PHIÊN", error);
    }
  }
  await clearSessionCookie();

  if (everywhere && stored?.tokens.idToken) {
    /*
     * Đánh dấu để `/signed-out` — nơi Account sẽ thả người dùng xuống — nói ĐÚNG chuyện vừa xảy ra.
     * Không có cờ này thì trang đó in "bạn vẫn đang đăng nhập ở Comitor.Account" cho một người vừa
     * đăng xuất khỏi Comitor.Account. Xem `markGlobalSignOut`.
     */
    await markGlobalSignOut();
    /*
     * `end_session` cần `id_token_hint` để biết đang kết thúc phiên của AI — thiếu nó, Account
     * (đúng theo chuẩn) sẽ hỏi lại người dùng, và một lần hỏi giữa luồng đăng xuất trông y như
     * một lỗi.
     */
    /*
     * ⚠ **303, KHÔNG PHẢI 307** — khác biệt một con số này là ranh giới giữa "đăng xuất sạch" và
     * "đăng xuất để lại một trình duyệt hỏng NỬA VỜI".
     *
     * `NextResponse.redirect` mặc định **307**, tức GIỮ NGUYÊN METHOD. Lời gọi tới đây là `POST`
     * (cố ý, xem JSDoc trên), nên trình duyệt sẽ **POST xuyên site** sang `/oauth2/end-session` của
     * Account. Mà cookie phiên của Account là `SameSite=Lax`, và **Lax KHÔNG gửi cookie cho một
     * POST xuyên site** — nó chỉ gửi cho điều hướng top-level bằng method an toàn.
     *
     * Đo được 2026-09-03, và hậu quả là một trạng thái NỬA VỜI chứ không phải một lỗi sạch:
     * Account nhận request không kèm cookie → `getCurrentBrowserSession()` trả `null` →
     * `matchesCurrentSession` sai → **`deleteSessionCookie` không bao giờ chạy**. Nhưng
     * `id_token_hint` vẫn hợp lệ, nên hàng phiên VẪN bị xoá theo `sid`.
     *
     * Còn lại: database nói "đã đăng xuất", trình duyệt vẫn cầm cookie phiên VÀ ảnh chụp
     * `cookieCache` (60 giây, xem `session.cookieCache` trong `comitor-account/lib/auth.ts`).
     * Trong 60 giây đó, MỌI lần đăng nhập lại đều được `/oauth2/authorize` cấp code mà không hỏi
     * mật khẩu, rồi đổi token thất bại với `invalid_request: session no longer exists`. Người dùng
     * bấm "Thử đăng nhập lại" và KHÔNG ĐI ĐÂU CẢ — đo được 4 vòng liên tiếp trong log.
     *
     * 303 đổi POST thành GET cho chặng sau, nên nó thành một điều hướng top-level an toàn: Lax gửi
     * cookie, Account thấy phiên, và `deleteSessionCookie` dọn cả cookie lẫn `cookieCache`.
     */
    return NextResponse.redirect(createLogoutUrl(accountConfig, stored.tokens.idToken), 303);
  }

  /*
   * ⚠ ĐÍCH LÀ `/signed-out`, KHÔNG PHẢI `/`.
   *
   * Đo được trên luồng thật: chuyển hướng về `/` thì trang đó đòi phiên → đẩy sang
   * `/api/auth/sign-in` → phiên tại Account còn nguyên và client bật `skip_consent` → người dùng
   * quay lại đã đăng nhập, tất cả trong 38 mili-giây. Đăng xuất CHẠY ĐÚNG (token bị thu hồi thật)
   * mà người dùng thấy nút của mình không làm gì.
   *
   * Đây là cái giá phải trả có ý thức của việc đăng xuất hai mức, và `/signed-out` là chỗ đứng lại
   * KHÔNG cần phiên — xem JSDoc của trang đó.
   */
  /*
   * Nhánh mức module: XOÁ cờ. Một lần đăng xuất toàn hệ trước đó để lại cờ sống 300 giây, và nếu
   * không xoá thì lần đăng xuất mức module ngay sau nó sẽ mượn câu chữ của lần trước — nói rằng
   * phiên ở Account đã đóng trong khi nó còn nguyên. Xoá ở ĐÂY là chỗ hợp lệ duy nhất: trang
   * `/signed-out` là Server Component và không ghi cookie được.
   */
  await clearGlobalSignOut();
  /*
   * 303 ở đây nữa, cùng lý do method: 307 bắt trình duyệt **POST** sang `/signed-out`, mà đó là một
   * trang App Router — nó chỉ trả lời `GET`. Đường từ menu người dùng không lộ ra ca này (nó dùng
   * `fetch` rồi tự `window.location.assign`), nhưng `<form method="post">` ở màn chặn
   * (`components/access-denied.tsx`) thì đi thẳng vào đó.
   */
  return NextResponse.redirect(new URL("/signed-out", env.appUrl), 303);
}
