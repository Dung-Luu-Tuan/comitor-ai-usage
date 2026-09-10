// @api-guard: đích nhận back-channel logout của Comitor.Account — KHÔNG có phiên người dùng nào để
// hỏi quyền. Nó tự xác thực bằng chữ ký ES256 trên `logout_token`, verify qua JWKS của Account
// (`verifyLogoutToken` của SDK), và đó là toàn bộ chốt.
//
// Cũng KHÔNG bọc `withApiErrors`, và đó là chủ ý chứ không phải bỏ sót: hàng rào ấy trả envelope
// lỗi JSON của module, trong khi Account chỉ đọc MÃ TRẠNG THÁI và không bao giờ gửi lại (§2.5).
// Mọi nhánh dưới đây tự bắt và tự ghi log — xem docblock.

import { verifyLogoutToken } from "@comitor/account-sdk";
import { after } from "next/server";
import { accountConfig } from "@/lib/account/config";
import { closeSessionsBySid } from "@/lib/account/session-store";

/**
 * OIDC Back-Channel Logout 1.0 — đầu NHẬN của module.
 *
 * Comitor.Account POST vào đây khi một phiên bên đó kết thúc, để module tự đóng phiên của mình.
 *
 * ── BỐN ĐIỀU VỀ ĐƯỜNG NÀY, ĐỀU LÀ LÝ DO CHO MỘT DÒNG MÃ DƯỚI ĐÂY ──────────────────────
 * 1. **Account CHỜ ĐỒNG BỘ, tối đa 5 giây, rồi BỎ LUÔN.** Không có lần gửi lại nào (§2.5). Nên
 *    mọi việc chậm phải nằm SAU phản hồi — xem `after()` ở cuối.
 * 2. **Nó bắn ở MỌI đường xoá phiên bên Account**, không riêng `/oauth2/end-session`: hết hạn,
 *    quản trị viên thu hồi, `/sign-out`. Route này vì thế phải rẻ và chịu được lặp.
 * 3. **KHÔNG được chuyển hướng.** Account gọi kèm `redirect: "error"`, nên một lần 301/302 là mất
 *    hẳn thông báo. Đó cũng là lý do URL đăng ký bên Account không được có dấu `/` cuối.
 * 4. **Không có `withApiErrors` bọc ngoài, và đó là chủ ý**: một ngoại lệ lọt ra thành 500 KHÔNG
 *    kèm dòng log nào của mình, trên một đường mà không ai nhìn. Mọi nhánh dưới đây tự bắt.
 *
 * ── VÌ SAO VERIFY NẰM Ở SDK ────────────────────────────────────────────────────────────
 * `verifyLogoutToken` thực hiện trọn §2.6 (chữ ký ES256 qua JWKS, `typ`, `alg`, `iss`, `aud`,
 * `iat`, `exp`, `events`, cấm `nonce`, `sub`/`sid`, `jti`). Nó ở SDK vì cả năm module Comitor cần
 * CÙNG một bản — và vì repo này là bản được SAO CHÉP, viết verifier vào đây chính là tạo ra năm
 * bản. Xem docblock của `AccountSession` trong `prisma/schema.prisma`.
 */

/** Một logout token thật ~500 byte. Chặn TRƯỚC khi đọc thân — endpoint này không xác thực người gọi. */
const MAX_BODY_BYTES = 8192;

function noStore(status: number): Response {
  // `Cache-Control: no-store` theo §2.8. Thân rỗng: Account không đọc gì ngoài mã trạng thái.
  return new Response(null, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  /*
   * V0 — CHẶN Ở TẦNG VẬN CHUYỂN, trước khi đọc một byte thân nào.
   *
   * Account gửi `application/x-www-form-urlencoded` (`URLSearchParams({ logout_token })`). Đây là
   * endpoint công khai và không xác thực được người gọi trước khi verify, nên không rào kích thước
   * là để bất kỳ ai POST một thân nhiều GB vào bộ nhớ trước khi phép kiểm đầu tiên chạy.
   */
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
    console.warn("[backchannel-logout] SAI CONTENT-TYPE:", contentType || "(trống)");
    return noStore(400);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    console.warn("[backchannel-logout] THÂN QUÁ LỚN:", declaredLength);
    return noStore(400);
  }

  // V1 — đọc trường. `formData()` NÉM khi thân không phải form data, và ngoại lệ đó xảy ra TRƯỚC
  // mọi mã của mình → 500 không log. Bắt tại chỗ.
  let logoutToken: string | null = null;
  try {
    const form = await request.formData();
    const value = form.get("logout_token");
    logoutToken = typeof value === "string" ? value : null;
  } catch {
    console.warn("[backchannel-logout] THÂN KHÔNG ĐỌC ĐƯỢC THÀNH FORM DATA");
    return noStore(400);
  }
  if (!logoutToken) {
    console.warn("[backchannel-logout] THIẾU `logout_token`");
    return noStore(400);
  }

  // V2–V18 — toàn bộ §2.6 nằm trong SDK. Nó TRẢ PHÁN QUYẾT chứ không ném.
  const verdict = await verifyLogoutToken(accountConfig, logoutToken);
  if (!verdict.valid) {
    /*
     * ⚠ 400, KHÔNG PHẢI 200. Trả 200 cho một token hỏng là nói với Account rằng đã đăng xuất xong
     * trong khi chưa làm gì — một nhánh fail-open, và là mã thành công cho một việc chưa xảy ra.
     * Log kèm `cause` để phân biệt ba thứ cần ba phản ứng khác nhau: token méo (`token`), claim sai
     * (`claims` — có thể là giả mạo), và không tra được khoá (`key` — thường là sự cố JWKS/mạng).
     */
    console.warn(`[backchannel-logout] TỪ CHỐI [${verdict.cause}] ${verdict.reason}`);
    return noStore(400);
  }

  /*
   * V19 — ĐÒI `sid`.
   *
   * §2.6 #4 cho phép token chỉ mang `sub`. Module này khớp phiên theo `sid`, nên với một token như
   * vậy nó KHÔNG triển khai được yêu cầu — và câu trả lời đúng theo §2.8 là 501, không phải 200.
   *
   * ⚠ Và cố ý KHÔNG lùi sang xoá theo `sub`: back-channel logout nghĩa là "MỘT phiên tại Account
   * vừa kết thúc", không phải "người này ra khỏi mọi thiết bị". Một chốt an ninh không được MỞ RỘNG
   * phạm vi vì tìm thấy ÍT bằng chứng hơn.
   *
   * Hôm nay Account luôn gửi cả `sub` lẫn `sid`, nên nhánh này không tới được — nó ở đây để một
   * thay đổi cấu hình tương lai không lặng lẽ biến route thành no-op.
   */
  if (!verdict.claims.sid) {
    console.warn("[backchannel-logout] TOKEN CHỈ CÓ `sub`, MODULE KHỚP THEO `sid` — không xử lý được");
    return noStore(501);
  }

  const { sid, jti } = verdict.claims;

  /*
   * ⚠ ĐÓNG PHIÊN SAU KHI ĐÃ TRẢ LỜI. Account chờ đồng bộ 5 giây rồi bỏ, không gửi lại — mà
   * `deleteMany` có thể phải xếp hàng sau một `SELECT … FOR UPDATE` mà `freshTokens` đang giữ
   * trong lúc gọi mạng sang Account. Back-channel logout bắn đúng lúc người dùng đăng xuất, tức
   * đúng lúc một tab khác có thể đang xoay token. Chặn quá 5 giây là mất hẳn thông báo, và log
   * phía module chỉ thấy một request không bao giờ kết thúc.
   *
   * `after()` chạy sau khi phản hồi đã đi. Lỗi trong đó KHÔNG được lọt ra — nuốt kèm log cố định.
   */
  after(async () => {
    try {
      const closed = await closeSessionsBySid(sid);
      // `closed === 0` là BÌNH THƯỜNG: token phát lại, phiên đã đóng, hoặc người dùng chưa từng mở
      // module này. Vẫn ghi log — đây là cách duy nhất phân biệt nó với "route không bao giờ chạy".
      console.info(`[backchannel-logout] jti=${jti} sid=${sid} — đã đóng ${closed} phiên`);
    } catch (error) {
      console.error("[backchannel-logout] KHÔNG ĐÓNG ĐƯỢC PHIÊN", error);
    }
  });

  return noStore(200);
}
