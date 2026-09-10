import "server-only";
import { cookies } from "next/headers";
import { type DisplayPrefs, decodeDisplayPrefs, parseDisplayPrefs } from "@/lib/core/display-prefs";

/**
 * Cookie mang MẶC ĐỊNH hiển thị của tài khoản, từ Account xuống thiết bị.
 *
 * ── VÌ SAO PHẢI ĐI QUA COOKIE, KHÔNG ĐỌC PHIÊN Ở LAYOUT ─────────────────────────────────
 * Bốn provider hiển thị nằm ở **root layout** (`app/layout.tsx`), thứ bọc MỌI trang — kể cả
 * `/sign-in-failed`, `/signed-out`, `error.tsx` và bốn màn hình chặn, nơi **không có phiên nào**.
 * Một `getSession()` ở đó sẽ hoặc trả `null` (vô dụng) hoặc kéo Account thành phụ thuộc cứng của
 * việc render một trang báo lỗi. Cùng lý do đã khiến ngôn ngữ và múi giờ đi đường cookie.
 *
 * ── VÌ SAO SỐNG NGẮN ────────────────────────────────────────────────────────────────────
 * Cookie này chỉ có một việc: sống sót từ route callback tới lượt render đầu tiên sau đăng nhập.
 * Nó được ghi LẠI ở mỗi lần đăng nhập, nên không cần sống lâu — và một cookie sống lâu ở đây là
 * một bản sao cũ của hồ sơ nằm lại trong trình duyệt hàng tháng.
 *
 * ⚠ Script gieo chạy ở MỌI lượt render trong khoảng cookie còn sống, và điều đó AN TOÀN vì phép
 * gieo là **idempotent**: chạy lần thứ hai thì `current === seed` và `marker === seed` nên không
 * ghi gì. Xem `components/display-prefs-seed.tsx`.
 *
 * KHÔNG `httpOnly` là **cố ý ngược lại**: cookie này KHÔNG cần client đọc — chỉ máy chủ đọc rồi
 * dựng script. Đặt `httpOnly` được thì tốt hơn, và ta đặt.
 */
export const PREFS_SEED_COOKIE = "comitor-prefs-seed";

/** Mười phút — thừa cho quãng callback → lượt render đầu, và ngắn để không nằm lại lâu. */
const PREFS_SEED_MAX_AGE = 10 * 60;

/**
 * Ghi cookie gieo. Gọi ở **route callback OIDC** — chỗ duy nhất hợp lệ để ghi cookie ngoài Server
 * Action và `proxy.ts`.
 *
 * ⚠ Chỉ ghi những trục THẬT SỰ có giá trị. `null` (chưa từng chọn) và `undefined` (bản Account cũ
 * không gửi) đều dẫn tới cùng một kết cục: trục ấy vắng mặt trong cookie, nên script không gieo gì
 * cho nó. Gieo một giá trị mặc định thay cho `null` là ghi đè lựa chọn tại chỗ của người dùng bằng
 * một thứ chưa ai chọn bao giờ.
 *
 * ⚠ Lọc qua `parseDisplayPrefs` NGAY Ở ĐÂY dù giá trị đến từ Account chứ không từ người dùng: cột
 * bên Account là `String` tự do, và một hàng cũ có thể mang giá trị mà bản `@comitor/ui` hiện tại
 * không còn biết. Gác cả hai đầu — đầu ghi để không gieo rác, đầu đọc để rác người khác gieo cũng
 * không đi vào script.
 */
export async function writeDisplayPrefsSeed(prefs: {
  theme: string | null;
  contrast: string | null;
  density: string | null;
  fontSize: string | null;
}): Promise<void> {
  const clean = parseDisplayPrefs({
    ...(prefs.theme === null ? {} : { theme: prefs.theme }),
    ...(prefs.contrast === null ? {} : { contrast: prefs.contrast }),
    ...(prefs.density === null ? {} : { density: prefs.density }),
    ...(prefs.fontSize === null ? {} : { fontSize: prefs.fontSize })
  });

  const store = await cookies();

  /*
   * Không trục nào hợp lệ → XOÁ cookie thay vì ghi một object rỗng. Một cookie rỗng nằm lại chỉ để
   * script chạy một vòng lặp không có gì trong đó.
   */
  if (Object.keys(clean).length === 0) {
    store.delete(PREFS_SEED_COOKIE);
    return;
  }

  /*
   * `encodeURIComponent`: `{`, `}`, `"` và `,` đều KHÔNG hợp lệ trong giá trị cookie theo RFC 6265,
   * và một cookie sai cú pháp bị trình duyệt bỏ qua **trong im lặng** — tức mặc định không bao giờ
   * áp, và không có gì báo.
   */
  store.set(PREFS_SEED_COOKIE, encodeURIComponent(JSON.stringify(clean)), {
    path: "/",
    maxAge: PREFS_SEED_MAX_AGE,
    sameSite: "lax",
    /* Client không cần đọc cookie này — chỉ máy chủ đọc rồi dựng script. Khoá lại được thì khoá. */
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  });
}

/** Đọc cookie gieo và LỌC. Trả object rỗng khi không có gì hợp lệ — tức "không gieo gì cả". */
export async function readDisplayPrefsSeed(): Promise<DisplayPrefs> {
  return decodeDisplayPrefs((await cookies()).get(PREFS_SEED_COOKIE)?.value);
}
