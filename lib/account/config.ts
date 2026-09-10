import "server-only";
import type { AccountClientConfig } from "@comitor/account-sdk";
import { CURRENT_APP_ID } from "@/lib/catalog/apps";
import { env } from "@/lib/env";

/**
 * Cấu hình tích hợp **Comitor.Account** — khai ĐÚNG MỘT CHỖ.
 *
 * ── VÌ SAO GOM VÀO MỘT HẰNG ────────────────────────────────────────────────────────────────
 * Bốn giá trị dưới đây xuất hiện ở ba route (`sign-in`, `callback`, `sign-out`) và ở mọi lần đọc
 * phiên. Dựng lại object ở từng chỗ thì `redirectUri` sẽ có ngày lệch nhau đúng một ký tự — và
 * Account từ chối bằng `invalid_redirect_uri`, một thông điệp KHÔNG nói bên nào sai.
 *
 * ⚠ `redirectUri` là **hợp đồng với Account**, không phải giá trị tuỳ ý: nó phải khớp TỪNG KÝ TỰ
 * với `redirect_uris` đã đăng ký cho client. Ở máy phát triển, chuỗi đó do
 * `comitor-account/scripts/seed.ts` ghi vào database; sửa một bên mà quên bên kia là luồng đăng
 * nhập hỏng ở bước đầu tiên.
 *
 * ⚠ `appKey` KHÔNG được bỏ trống. Thiếu nó, `requireWorkspaceAccess()` của SDK **nổ** thay vì im
 * lặng bỏ qua hai lớp guard "workspace đã bật app chưa" và "bạn có chỗ ngồi chưa" — đó là lựa chọn
 * đúng của SDK: một hàm bảo vệ mà im lặng không bảo vệ gì là kiểu hỏng tệ nhất.
 *
 * ── VÀ VÌ SAO KHÔNG CÓ `extraScopes` ──────────────────────────────────────────────────────
 * SDK luôn thêm `openid profile email offline_access`. `offline_access` không phải tuỳ chọn:
 * thiếu nó thì back-channel logout **không bao giờ gọi tới app này**, và triệu chứng là log rỗng
 * chứ không phải một lỗi. Module này không cần scope nào ngoài bộ đó.
 */
export const accountConfig: AccountClientConfig = {
  accountUrl: env.accountUrl,
  clientId: env.account.clientId,
  clientSecret: env.account.clientSecret,
  redirectUri: `${env.appUrl}/api/auth/callback`,
  /*
   * ⚠ `/signed-out`, KHÔNG PHẢI `/` — và đây là cùng một bài học đã học một lần rồi, ở redirect
   * bên kia.
   *
   * Đây là nơi Account thả người dùng xuống sau khi `end-session` giết phiên toàn hệ. Trỏ về `/`
   * thì trang đó ĐÒI PHIÊN, nên nó lập tức đẩy sang `/api/auth/sign-in` và mở một lượt uỷ quyền
   * MỚI ngay trong lúc phiên vừa bị giết — Account cấp một code gắn vào phiên đã chết, và callback
   * trả `invalid_request: session no longer exists`. Người dùng bấm "đăng xuất khỏi mọi thiết bị"
   * rồi hạ cánh ở màn "không đăng nhập được": đăng xuất CHẠY ĐÚNG, màn hình cuối nói ngược lại.
   * Đo được 2026-09-03 trên luồng thật.
   *
   * `/signed-out` nằm NGOÀI `(shell)` nên nó không đi qua `requireSession()` — xem JSDoc của trang
   * đó. Đúng cùng lý do trang ấy đã được dựng cho đăng xuất mức module.
   *
   * ⚠ CHUỖI NÀY LÀ HỢP ĐỒNG VỚI ACCOUNT, khớp từng ký tự với `post_logout_redirect_uris` đã đăng
   * ký cho client. Đổi ở đây mà chưa đăng ký bên kia là đăng xuất toàn hệ hỏng HẲN, chứ không phải
   * hạ cánh sai chỗ. Bên Account: màn **quản trị nền tảng** `/admin/oauth-clients/{client_id}` cho
   * môi trường đã phát hành (seed KHÔNG cập nhật client đã tồn tại), và `scripts/seed.ts` đã đăng ký
   * sẵn cho môi trường mới. Cần tài khoản có `isPlatformAdmin`.
   */
  postLogoutRedirectUri: `${env.appUrl}/signed-out`,
  appKey: CURRENT_APP_ID,

  /**
   * Cache kết quả `/api/workspaces/me` trong 30 giây.
   *
   * ⚠ Đây là ĐỘ TRỄ của việc gỡ thành viên và thu chỗ ngồi. Hạ xuống 0 là bắt mỗi lần render một
   * trang phải trả một vòng mạng sang Account; nâng lên vài phút là để một người vừa bị gỡ vẫn
   * dùng app được lâu hơn mức chấp nhận được.
   *
   * Cách chữa ĐÚNG cho phần chính xác tức thì là **webhook**, không phải hạ TTL.
   *
   * ⚠ **Đích nhận webhook ĐÃ DỰNG** — `app/api/comitor/webhook/route.ts`, và
   * `COMITOR_WEBHOOK_SECRET` có trong `.env.example` lẫn `lib/env.ts`. Nên 30 giây KHÔNG còn là độ
   * trễ thật của việc gỡ thành viên và thu chỗ ngồi: webhook vô hiệu cache ngay khi Account bắn sự
   * kiện, và 30 giây chỉ là trần cho trường hợp sự kiện KHÔNG tới.
   *
   * ⚠ Bản trước của khối này viết rằng route đó "không tồn tại". Một comment nói sai về sự tồn tại
   * của một file là loại tài liệu nguy hiểm nhất trong repo này: người đọc kế tiếp — người hoặc
   * agent — sẽ dựng một đích nhận thứ hai cạnh cái đang chạy, hoặc chẩn đoán một sự cố "gỡ thành
   * viên xong người ta vẫn vào được" thành "đúng rồi, phải chờ 30 giây". Không cổng nào bắt được:
   * `pnpm check` không đọc văn xuôi trong JSDoc.
   *
   * ⚠ Và sự kiện KHÔNG tới là chuyện thường ở máy phát triển: Account online không gọi được vào
   * `localhost`. Xem AGENTS.md §"Account online + máy local".
   */
  contextCacheSeconds: 30
};

/**
 * Xác thực đã được cấu hình chưa.
 *
 * ⚠ FAIL-CLOSED khi thiếu: `lib/account/session.ts` KHÔNG rơi về một phiên giả nếu cờ này `false`.
 * Bản trước của repo có một phiên giả cố định, và giữ nó lại như một "dự phòng" nghĩa là một cấu
 * hình thiếu sẽ ÂM THẦM biến thành một app không có xác thực — đúng thứ nguy hiểm nhất có thể làm.
 * Thiếu cấu hình thì app nói thẳng là chưa cấu hình, và không ai vào được.
 */
export const accountConfigured = Boolean(env.account.clientId && env.account.clientSecret);
