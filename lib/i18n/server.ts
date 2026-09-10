import "server-only";
import { cookies, headers } from "next/headers";
import { isTimeZone } from "@/lib/core/time-zone";
import {
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
  negotiateLocale,
  TIME_ZONE_COOKIE
} from "@/lib/i18n/config";

/**
 * Ngôn ngữ của REQUEST hiện tại. Đây là nguồn duy nhất; `i18n/request.ts` chỉ gọi vào đây.
 *
 * Thứ tự ưu tiên — cookie THẮNG `Accept-Language`, và đó là chủ ý:
 *
 *   1. cookie `comitor-locale` — người dùng đã tự chọn, lựa chọn đó phải thắng mọi phỏng đoán;
 *   2. header `Accept-Language` — phỏng đoán đầu tiên cho người mới tới;
 *   3. `vi`.
 *
 * ⚠ CỐ Ý KHÔNG ĐỌC NGÔN NGỮ TỪ HỒ SƠ Ở COMITOR.ACCOUNT Ở ĐÂY. Hàm này chạy ở MỌI request có
 * render; thêm một lời gọi HTTP sang Account vào đường đó là trả giá mạng cho một giá trị gần như
 * không bao giờ đổi — và biến Account thành phụ thuộc cứng của việc render một trang tĩnh.
 *
 * Ngôn ngữ theo TÀI KHOẢN đến bằng đường khác: `user.locale` được kéo xuống cookie này ở
 * **route callback** sau mỗi lần đăng nhập, theo luật có-dấu ở `lib/i18n/adopt.ts`. Người vừa bấm
 * "English" ở màn đăng nhập rồi vào một tài khoản `locale = "vi"` vẫn tiếp tục thấy tiếng Anh —
 * lựa chọn tại chỗ thắng, và đó là điều luật ấy bảo đảm.
 *
 * ⚠ Bản trước của khối này ghi chỗ làm việc đó là `lib/account/session.ts`. **SAI** — file ấy chạy
 * từ `page.tsx`, nơi `cookies().set()` NÉM. Xem lời đính chính đầy đủ ở `lib/i18n/actions.ts`.
 *
 * `cookies()` và `headers()` là API động của Next: gọi chúng làm mọi trang thành dynamic. Ở đây
 * không mất gì — module là app sau đăng nhập, không trang nào tĩnh được.
 */
export async function resolveRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const chosen = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const headerStore = await headers();
  return negotiateLocale(headerStore.get("accept-language")) ?? DEFAULT_LOCALE;
}

/**
 * Múi giờ HIỂN THỊ của request hiện tại — của NGƯỜI XEM, không phải của máy chủ.
 *
 * Cùng khuôn với `resolveRequestLocale()`, và cùng lý do đi đường cookie thay vì đọc phiên: hàm này
 * phục vụ `i18n/request.ts`, thứ chạy TRƯỚC và NGOÀI mọi phiên — kể cả ở những trang có nhiệm vụ
 * vẫn hoạt động khi không gọi được sang Account.
 *
 * ⚠ **`isTimeZone` ở đây KHÔNG thừa dù `adopt.ts` đã kiểm lúc ghi.** Cookie không `httpOnly`, nên
 * client sửa được — và giá trị này đi thẳng vào `Intl.DateTimeFormat`, nơi một chuỗi lạ ném
 * `RangeError` từ chính file cấu hình request. Gác lúc ghi là để không gieo rác; gác lúc đọc là để
 * rác người khác gieo cũng không làm chết trang.
 */
export async function resolveRequestTimeZone(): Promise<string> {
  const chosen = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return isTimeZone(chosen) ? chosen : DEFAULT_TIME_ZONE;
}
