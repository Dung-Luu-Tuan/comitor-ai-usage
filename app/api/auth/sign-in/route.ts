import { startSignIn } from "@comitor/account-sdk/next";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { accountConfig, accountConfigured } from "@/lib/account/config";
import { writeReturnPathCookie } from "@/lib/account/session-cookie";
import { apiError } from "@/lib/api/response";
import { ERROR_CODES } from "@/lib/core/api-error";
import { toSafeInternalPath } from "@/lib/core/return-path";

/**
 * Bắt đầu đăng nhập — đẩy người dùng sang Comitor.Account.
 *
 * `startSignIn` cất `state` và `code_verifier` vào hai cookie `httpOnly` sống 600 giây — khớp đúng
 * hạn của authorization code ở phía Account. Đặt dài hơn chỉ để lại rác trong trình duyệt; đặt
 * ngắn hơn thì người gõ mật khẩu chậm sẽ hỏng luồng.
 *
 * ── VÌ SAO LÀ MỘT ROUTE HANDLER, KHÔNG PHẢI MỘT `<Link>` THẲNG SANG ACCOUNT ───────────────
 * Vì URL uỷ quyền mang `state` và `code_challenge` **sinh mới mỗi lần**, và cả hai phải được ghi
 * xuống cookie CÙNG LÚC với việc dựng URL. Một `<Link href="https://account…">` dựng lúc render
 * thì cặp đó hoặc không tồn tại, hoặc cũ — và `completeSignIn` sẽ từ chối ở bước sau với một thông
 * điệp không ai lần ra được.
 *
 * ⚠ KHÔNG bọc `redirect()` trong `try/catch`: Next cài đặt nó bằng cách NÉM một lỗi đặc biệt, nên
 * một `catch` bắt mọi thứ sẽ nuốt luôn lệnh chuyển hướng.
 */
export async function GET(request: NextRequest) {
  if (!accountConfigured) {
    /*
     * FAIL-CLOSED, và nói thẳng nguyên nhân. Rơi về một phiên giả ở đây là biến một cấu hình thiếu
     * thành một app không có xác thực — im lặng, và đúng ở nơi nguy hiểm nhất.
     */
    return apiError(
      503,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      "Comitor.Account is not configured. Set COMITOR_CLIENT_ID and COMITOR_CLIENT_SECRET."
    );
  }

  /*
   * ĐÍCH QUAY LẠI, nếu người gọi có đưa. `requireSession()` đính nó vào khi đẩy người dùng tới đây,
   * để phiên rơi giữa chừng không làm họ mất chỗ đang đứng.
   *
   * ⚠ `toSafeInternalPath` là chốt an toàn, không phải phép dọn dẹp: `?next=` đến thẳng từ URL nên
   * bất kỳ ai cũng dựng được một liên kết tới đây. Không lọc thì đây là một **open redirect** —
   * tên miền thật của Comitor đứng ra bảo lãnh cho một trang lừa đảo. Xem `lib/core/return-path.ts`.
   *
   * Đặt cookie TRƯỚC `redirect()`: `redirect()` hoạt động bằng cách ném lỗi, nên mọi dòng sau nó
   * không chạy.
   */
  const next = toSafeInternalPath(request.nextUrl.searchParams.get("next"));
  if (next) await writeReturnPathCookie(next);

  redirect(await startSignIn(accountConfig));
}
