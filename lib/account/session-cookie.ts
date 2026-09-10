import "server-only";
import { cookies } from "next/headers";

/**
 * Hai cookie của luồng xác thực: **phiên** (một định danh mờ) và **đích quay lại** (ngắn hạn).
 *
 * ── VÌ SAO MODULE PHÁT COOKIE RIÊNG, KHÔNG DÙNG COOKIE CỦA ACCOUNT ────────────────────────
 * Cookie phiên của Comitor.Account nằm ở tên miền của Account và **không chia sẻ** sang tên miền
 * của module. SSO đi qua luồng OIDC chứ không đi qua một cookie dùng chung — an toàn hơn (một
 * module bị XSS không đọc được phiên của cả hệ) và đúng chuẩn hơn.
 *
 * ── VÌ SAO TOKEN KHÔNG CÒN Ở ĐÂY ─────────────────────────────────────────────────────────
 * Bản trước niêm cả bộ token vào chính cookie này. Nó hỏng ở lần xoay token đầu tiên, vì **Next
 * cấm ghi cookie trong lúc render trang** — và `getSession()` chạy đúng ở đó. Toàn bộ câu chuyện,
 * kèm số liệu đo được, nằm ở đầu `lib/account/session-store.ts`.
 *
 * Hệ quả cho file này: cookie được đặt ĐÚNG MỘT LẦN, ở route handler `callback`, và xoá ở route
 * handler `sign-out`. Cả hai là chỗ Next cho phép ghi cookie. Không còn đường nào khác chạm vào
 * nó, nên lỗi cũ không thể quay lại bằng một lối vào khác.
 *
 * Giá trị bên trong là 32 byte ngẫu nhiên; database chỉ giữ SHA-256 của nó. Vì vậy cookie này
 * KHÔNG cần mã hoá nữa: nó không nói lên điều gì, và sửa một byte chỉ làm nó tra không ra hàng
 * nào — đúng bằng "chưa đăng nhập".
 */

const COOKIE = "comitor-session";

/** 30 ngày — khớp với `expiresAt` của hàng phiên trong database. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function readSessionCookie(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function writeSessionCookie(secret: string): Promise<void> {
  (await cookies()).set(COOKIE, secret, {
    httpOnly: true,
    /*
     * ⚠ `secure` BẬT kể cả ở dev, và điều đó CHẠY ĐƯỢC: trình duyệt coi `localhost` là origin đáng
     * tin nên vẫn nhận cookie `Secure` qua http. Đặt cờ này theo `NODE_ENV` là để một môi trường
     * staging quên biến trở thành một môi trường gửi cookie phiên qua HTTP thô.
     */
    secure: true,
    /*
     * `lax` chứ không `strict`: người dùng quay về từ Comitor.Account là một điều hướng CHÉO TÊN
     * MIỀN, và `strict` sẽ không gửi cookie ở request đó — họ đăng nhập xong rồi vẫn thấy mình
     * chưa đăng nhập. `lax` gửi cookie cho điều hướng top-level dạng GET, đúng đủ cho luồng này.
     */
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * Đích quay lại sau khi đăng nhập — cookie NGẮN HẠN, chỉ sống trong một vòng OIDC.
 *
 * ── VÌ SAO LÀ COOKIE, KHÔNG PHẢI THAM SỐ TRONG URL ───────────────────────────────────────
 * Vì đường đi sang Account rồi quay lại KHÔNG mang theo query của ta: `redirect_uri` là một chuỗi
 * đã đăng ký sẵn ở Account, khớp từng ký tự, nên không nhét thêm gì vào đó được. Chỗ duy nhất còn
 * lại là `state` — mà `state` do SDK sinh và kiểm, cấy dữ liệu của app vào đó là phá phép kiểm CSRF
 * duy nhất của luồng này.
 *
 * ⚠ 600 giây, bằng đúng hạn của `state`/`code_verifier` mà `startSignIn` đặt. Dài hơn thì một đích
 * bỏ quên từ lần đăng nhập trước sẽ cướp lấy lần sau — người dùng bấm vào đường này, hạ cánh ở
 * đường kia, và không có gì giải thích.
 */
const RETURN_COOKIE = "comitor-return-to";
const RETURN_MAX_AGE_SECONDS = 600;

export async function writeReturnPathCookie(path: string): Promise<void> {
  (await cookies()).set(RETURN_COOKIE, path, {
    httpOnly: true,
    secure: true,
    /*
     * `lax` là BẮT BUỘC ở đây, cùng lý do với cookie phiên: cookie này được đọc ở `callback`, tức
     * ở một điều hướng đến TỪ tên miền của Account. `strict` là cookie không được gửi, và đích
     * quay lại biến mất đúng vào lúc cần nó.
     */
    sameSite: "lax",
    path: "/",
    maxAge: RETURN_MAX_AGE_SECONDS
  });
}

/** Đọc đích rồi XOÁ ngay — dùng một lần, để nó không cướp lần đăng nhập sau. */
export async function takeReturnPathCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(RETURN_COOKIE)?.value ?? null;
  if (value) store.delete(RETURN_COOKIE);
  return value;
}

/**
 * "Lần đăng xuất vừa rồi là TOÀN HỆ" — cờ một lần, để `/signed-out` nói đúng sự thật.
 *
 * ── VÌ SAO TRANG ĐÓ KHÔNG TỰ BIẾT ────────────────────────────────────────────────────────
 * `/signed-out` có HAI lối vào, và chúng để lại hai trạng thái trái ngược ở Account:
 *
 *   · đăng xuất mức module  → phiên tại Account CÒN SỐNG;
 *   · `?everywhere=1`       → phiên tại Account ĐÃ CHẾT, và người dùng quay về đây qua
 *                             `post_logout_redirect_uri` của Account.
 *
 * Trang không phân biệt được hai lối đó, nên bản trước in một câu cho cả hai: *"Bạn vẫn đang đăng
 * nhập ở Comitor.Account"*. Với lối thứ hai câu đó SAI — và nó sai ở đúng chỗ người dùng vừa làm
 * một thao tác bảo mật có chủ đích, trên một máy có thể là máy dùng chung.
 *
 * ── VÌ SAO LÀ COOKIE, VÀ VÌ SAO NÓ KHÔNG RÒ ──────────────────────────────────────────────
 * Cùng lý do với `comitor-return-to`: đường đi sang Account rồi quay lại không mang được query của
 * ta (`post_logout_redirect_uri` khớp từng ký tự với chuỗi đã đăng ký).
 *
 * ⚠ Trang `/signed-out` là Server Component nên nó **chỉ được ĐỌC** — Next cấm ghi cookie trong lúc
 * render (xem `lib/account/session-store.ts`). Vì vậy cờ này KHÔNG tự xoá lúc đọc. Chỗ xoá nằm ở
 * nhánh đăng xuất mức module của chính route handler: mỗi lần đăng xuất đều đi qua đó, và nó ghi
 * đè trạng thái trước khi người dùng kịp nhìn thấy trang. Nhờ vậy không có cửa sổ nào mà một cờ cũ
 * còn sót lại nói dối cho một lần đăng xuất mới.
 */
const GLOBAL_SIGN_OUT_COOKIE = "comitor-signed-out-everywhere";

/** Đặt cờ TRƯỚC khi chuyển tiếp sang `end-session` của Account. */
export async function markGlobalSignOut(): Promise<void> {
  (await cookies()).set(GLOBAL_SIGN_OUT_COOKIE, "1", {
    httpOnly: true,
    secure: true,
    /* `lax`: cờ phải sống sót một điều hướng đến TỪ tên miền của Account — như cookie đích quay lại. */
    sameSite: "lax",
    path: "/",
    /* Đủ cho một vòng sang Account và quay về; hết hạn là trạng thái an toàn (rơi về câu mặc định). */
    maxAge: 300
  });
}

/** Xoá cờ — gọi ở nhánh đăng xuất mức module, để lần trước không nói hộ lần này. */
export async function clearGlobalSignOut(): Promise<void> {
  (await cookies()).delete(GLOBAL_SIGN_OUT_COOKIE);
}

/** CHỈ đọc. Xem ghi chú ở trên về việc vì sao nó không tự xoá. */
export async function readGlobalSignOut(): Promise<boolean> {
  return (await cookies()).get(GLOBAL_SIGN_OUT_COOKIE)?.value === "1";
}
