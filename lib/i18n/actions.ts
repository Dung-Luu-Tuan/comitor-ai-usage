"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/lib/i18n/config";

/**
 * Ghi cookie ngôn ngữ. Khai tuỳ chọn cookie ở ĐÚNG MỘT chỗ — hai chỗ khai lệch nhau (một cái
 * `sameSite: "lax"`, một cái quên) là loại lỗi chỉ lộ ra khi trình duyệt đến từ tên miền khác,
 * tức đúng lúc người dùng vừa được Comitor.Account chuyển hướng sang.
 */
async function writeLocaleCookie(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    /*
     * KHÔNG `httpOnly`: bộ chọn ngôn ngữ ở client cần đọc được giá trị hiện tại. Đây không phải bí
     * mật — nó là một trong hai mã ngôn ngữ mà bất kỳ ai cũng đoán được.
     */
    httpOnly: false,
    secure: process.env.NODE_ENV === "production"
  });
}

/**
 * Người dùng tự đổi ngôn ngữ.
 *
 * ⚠ CHỈ GHI COOKIE, tức lựa chọn theo THIẾT BỊ. Ngôn ngữ theo TÀI KHOẢN (đổi máy vẫn giữ, và email
 * gửi đúng thứ tiếng) là một trường trong hồ sơ ở **Comitor.Account** — module không sở hữu hồ sơ
 * cá nhân và không được dựng lại nó — xem AGENTS.md §"Ranh giới Account / app".
 *
 * ── ⚠ HAI VIỆC MÀ BẢN TRƯỚC CỦA GHI CHÚ NÀY DẶN LÀM, VÀ CẢ HAI ĐỀU KHÔNG LÀM ĐƯỢC ────────
 * Chúng được ghi lại ở đây thay vì xoá đi, vì cả hai nghe rất hợp lý và người sau sẽ nghĩ ra lại.
 *
 *   1. **"gọi SDK cập nhật `user.locale`"** — KHÔNG ĐƯỢC. `assertSessionActor` bên Account
 *      (`lib/api/actor.ts`) ném **403** cho mọi actor không phải phiên người dùng, và nó được đóng
 *      như vậy sau một khai thác đã chứng minh: một app xin `scope=openid profile email` mà ghi
 *      được hồ sơ thì cũng ghi được mọi thứ khác. Module **không bao giờ** ghi được một trường của
 *      Account. Đường thoát duy nhất được phép — nêu trong chính comment của file đó — là khai một
 *      scope RIÊNG (`account.workspace.write`) và kiểm bằng `requireScope`, chứ không phải nới
 *      phép kiểm ấy ra.
 *
 *      Hệ quả cho cả kiến trúc: mọi "cái này quản ở Account" vĩnh viễn là **ĐỌC + LIÊN KẾT**.
 *
 *   2. **"kéo `user.locale` xuống cookie trong `lib/account/session.ts`"** — SAI CHỖ. File đó chạy
 *      từ `page.tsx`, mà **Next cấm ghi cookie trong lúc render trang**: `cookies().set()` ở đó
 *      NÉM. Chỗ đúng là `app/api/auth/callback/route.ts` — một Route Handler (nơi ghi cookie hợp
 *      lệ), chạy đúng một lần mỗi lần đăng nhập, và **đã** gọi `getAccountContext()` sẵn để lấy
 *      `user.id`, nên `user.locale` nằm ngay trong tay ở đó, không tốn thêm một vòng mạng nào.
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  await writeLocaleCookie(locale);
}
