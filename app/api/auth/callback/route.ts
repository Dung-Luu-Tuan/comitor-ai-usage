import { completeSignIn } from "@comitor/account-sdk/next";
import { type NextRequest, NextResponse } from "next/server";
import { accountConfig, accountConfigured } from "@/lib/account/config";
import { writeDisplayPrefsSeed } from "@/lib/account/prefs-seed";
import { readSessionCookie, takeReturnPathCookie, writeSessionCookie } from "@/lib/account/session-cookie";
import { closeSession, createSession, readSession } from "@/lib/account/session-store";
import { apiError } from "@/lib/api/response";
import { ERROR_CODES } from "@/lib/core/api-error";
import { toSafeInternalPath } from "@/lib/core/return-path";
import { env } from "@/lib/env";
import { adoptAccountPreferences } from "@/lib/i18n/adopt";

/**
 * Nhận callback từ Comitor.Account và phát cookie phiên CỦA RIÊNG MODULE.
 *
 * ⚠ Đường dẫn này là **hợp đồng**: nó phải khớp từng ký tự với `redirect_uris` đã đăng ký cho
 * client ở Account. Ở máy phát triển, chuỗi đó do `comitor-account/scripts/seed.ts` ghi vào
 * database. Lệch một ký tự thì Account từ chối bằng `invalid_redirect_uri` — và thông điệp đó
 * KHÔNG nói bên nào sai, nên hai chỗ phải được sửa cùng nhau.
 *
 * ── `completeSignIn` KIỂM `state`, VÀ ĐÓ LÀ THỨ DUY NHẤT CHẶN CSRF Ở LUỒNG NÀY ────────────
 * Bỏ qua nó nghĩa là một trang bất kỳ ép được trình duyệt của người dùng hoàn tất một luồng đăng
 * nhập bằng tài khoản của kẻ tấn công — từ đó mọi thứ họ tạo ra trong app đều nằm trong tài khoản
 * ấy. SDK làm phép kiểm này; đừng tự viết lại luồng để "cho gọn".
 */
export async function GET(request: NextRequest) {
  if (!accountConfigured) {
    return apiError(503, ERROR_CODES.SERVICE_UNAVAILABLE, "Comitor.Account is not configured.");
  }

  let tokens: Awaited<ReturnType<typeof completeSignIn>>;
  try {
    tokens = await completeSignIn(accountConfig, new URL(request.url));
  } catch (error) {
    /*
     * Bốn nguyên nhân đổ vào đây, và cả bốn có CÙNG một cách sửa của người dùng: đăng nhập lại.
     *   · người dùng bấm "Từ chối" ở màn đồng ý;
     *   · `state` không khớp (cookie đã hết hạn, hoặc CSRF);
     *   · code đã bị dùng — ⚠ ở Account, dùng lại một authorization code làm HỎNG LUÔN refresh
     *     token của grant đó, nên "thử lại bằng F5" là thao tác tệ nhất người dùng có thể làm;
     *   · Account từ chối `redirect_uri`.
     *
     * Vì vậy: một trang giải thích, KHÔNG hiện `error.message` (nó là chuỗi cho lập trình viên, và
     * ở luồng xác thực nó còn tiết lộ chi tiết cấu hình), và KHÔNG tự chuyển hướng lại
     * `/api/auth/sign-in` — vòng lặp chuyển hướng vô hạn là kết cục quen thuộc của cách đó.
     *
     * ⚠ ĐÍCH LÀ `/sign-in-failed`, KHÔNG PHẢI `/?auth=failed`.
     *
     * Bản trước dùng cờ truy vấn trên `/`, và nó hỏng theo hai tầng: không chỗ nào trong repo ĐỌC
     * cờ đó, và `/` đòi phiên nên nó đẩy sang `/api/auth/sign-in` trước khi kịp render — tức là
     * vẫn đúng cái vòng lặp mà đoạn trên nói là muốn tránh, chỉ dài thêm một chặng. Đo được trên
     * luồng thật 2026-09-01: một code bị gửi hai lần → lần thứ hai `invalid_grant` → `?auth=failed`
     * → `sign-in` → đăng nhập lại thành công, và người dùng KHÔNG THẤY GÌ. Đầy đủ ở JSDoc của
     * `app/sign-in-failed/page.tsx`; trang đó nằm ngoài `(shell)` nên nó hiện được khi không phiên.
     */
    /*
     * ⚠ TRƯỚC KHI KÊU HỎNG, HỎI XEM NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP ĐƯỢC CHƯA.
     *
     * Một authorization code có thể tới đây HAI LẦN, và khi đó lần thứ hai LUÔN thất bại với
     * `invalid_grant` — dù lần thứ nhất đã thành công trọn vẹn và đã đặt cookie phiên. Đo được
     * 2026-09-03, hai điều hướng top-level thật (`navigate/document/cross-site`, không phải
     * prefetch) tới cùng một URL, cách nhau 392ms:
     *
     *   03:20:45.520  vào            code=8lsBm01A
     *   03:20:45.835  đổi code XONG  (315ms)      ← #1 thành công, phiên được tạo
     *   03:20:45.912  vào            code=8lsBm01A ← #2 bắt đầu khi #1 còn đang bay
     *   03:20:46.042  #1 trả 307 về "/"
     *                 #2 → invalid_grant → /sign-in-failed
     *
     * Người dùng ĐANG đăng nhập, và ta hiện cho họ màn "không đăng nhập được" — rồi nút trên đó
     * đưa họ đi đăng nhập lại một lần nữa. Giao diện nói dối, ở đúng thứ nó biết chắc là sai.
     *
     * ⚠ **PHÉP KIỂM NÀY KHÔNG CỨU ĐƯỢC CA ĐUA Ở TRÊN, và đừng tin là nó cứu.** Nhìn lại mốc thời
     * gian: #2 xuất phát lúc 45.912, còn #1 mãi 46.042 mới trả `Set-Cookie`. Cookie đọc ở đây là
     * cookie CỦA REQUEST #2 — tại thời điểm nó rời trình duyệt, phiên chưa tồn tại. Nên nhánh này
     * chỉ ăn khi lần gọi thứ hai tới SAU khi lần thứ nhất đã xong (tải lại trang, bấm Back), không
     * ăn khi hai request chạy song song.
     *
     * Giữ nó vì ca tuần tự có thật và rẻ để chặn. Bản sửa THẬT nằm ở trang đăng nhập của Account:
     * `redirectPlugin` có sẵn của Better Auth tự chạy `window.location.href` khi phản hồi mang
     * `{redirect:true, url}`, còn `continueAfterAuth()` chạy lần thứ hai với CÙNG url ấy sau
     * `await adoptProfileLocale()` — và 392ms chính là thời gian của Server Action đó.
     *
     * Nguồn phát ra hai lần điều hướng nằm ở trang đăng nhập của Comitor.Account, không ở đây. Phép
     * kiểm này KHÔNG che lỗi đó (log `[auth] ĐĂNG NHẬP HỎNG Ở CALLBACK` vẫn ghi nguyên) — nó chỉ
     * ngăn một cuộc đua vô hại trở thành một màn lỗi cho người dùng.
     *
     * ⚠ Kiểm PHIÊN THẬT trong database, không chỉ sự tồn tại của cookie: một cookie trỏ vào hàng
     * đã bị xoá thì người dùng KHÔNG đăng nhập, và đưa họ về `/` là đẩy họ vào một vòng chuyển
     * hướng thay vì một câu giải thích.
     */
    console.error("[auth] ĐĂNG NHẬP HỎNG Ở CALLBACK", error);

    const existing = await readSessionCookie();
    if (existing && (await readSession(existing))) {
      console.info("[auth] …NHƯNG PHIÊN ĐÃ CÓ — cùng một code tới hai lần, cho người dùng đi tiếp");
      const back = toSafeInternalPath(await takeReturnPathCookie());
      return NextResponse.redirect(new URL(back ?? "/", env.appUrl), 303);
    }

    return NextResponse.redirect(new URL("/sign-in-failed", env.appUrl), 303);
  }

  /*
   * Chưa biết workspace nào: để trống, `getSession()` sẽ chọn workspace đầu tiên đã bật app này.
   * Xem ghi chú dài ở `lib/account/session.ts` về việc workspace nằm trong phiên chứ không trong URL.
   *
   * ⚠ ĐÂY LÀ CHỖ DUY NHẤT COOKIE PHIÊN ĐƯỢC ĐẶT, và đó là chủ ý. Bộ token nằm ở database
   * (`lib/account/session-store.ts`), nên xoay token về sau KHÔNG phải chạm vào cookie nữa — cũng
   * chính là thứ đã làm bản trước hỏng, vì Next cấm ghi cookie giữa lúc render trang.
   */
  /*
   * ĐÓNG PHIÊN CŨ CỦA CHÍNH TRÌNH DUYỆT NÀY, trước khi mở phiên mới.
   *
   * Đăng nhập lại khi đang có phiên là chuyện thường (phiên rơi, hoặc người dùng bấm một liên kết
   * đăng nhập). Không đóng phiên cũ thì cookie mới đè lên cookie cũ, còn hàng phiên cũ và refresh
   * token của nó vẫn sống hết vòng đời 30 ngày — **không ai với tới được nữa mà vẫn đổi được
   * access token**. Đo được 2026-09-01: 14 refresh token còn sống cho client này, phần lớn là rác
   * kiểu đó.
   *
   * ⚠ Đây là "THAY THẾ phiên của trình duyệt này", KHÔNG phải "đăng xuất mọi thiết bị": chỉ phiên
   * mà cookie đang trỏ vào bị đóng. Điện thoại và máy ở nhà không bị đụng tới.
   *
   * ⚠ Nuốt lỗi, cố ý: dọn dẹp KHÔNG được phép làm hỏng một lần đăng nhập vốn đã thành công. Người
   * dùng đã qua được Account; để họ rơi vào màn lỗi vì một phép xoá thất bại là đổi một phiền toái
   * nhỏ lấy một lỗi lớn.
   */
  const previous = await readSessionCookie();
  if (previous) {
    try {
      await closeSession(previous);
    } catch (error) {
      console.warn("[auth] không đóng được phiên cũ:", error);
    }
  }

  /*
   * Lấy id người dùng NGAY tại đây để ghi vào cột `user_id` của phiên — đó là thứ duy nhất cho
   * phép thu hồi phiên theo người sau này (webhook `member.removed` / `seat.revoked`). `payload`
   * đã niêm bằng AES-GCM nên không truy vấn theo nó được.
   *
   * ⚠ Nuốt lỗi: không đọc được id thì phiên vẫn tạo, chỉ là không thu hồi từ xa được. Để một lần
   * đăng nhập ĐÃ THÀNH CÔNG ở Account hỏng vì một lời gọi phụ là đổi một thiếu sót lấy một sự cố.
   */
  let userId: string | undefined;
  /*
   * Hình dạng của SDK, KHÔNG phải `AccountUser` nội bộ ở `lib/contracts/account.ts`: bốn trục ở đây
   * là bốn trường PHẲNG và OPTIONAL (bản Account cũ không gửi chúng), còn hợp đồng nội bộ gom chúng
   * vào `displayPrefs` và đã gộp `undefined` về `null`. Phép gộp ấy làm ở biên phiên, không ở đây.
   */
  let accountUser:
    | {
        id: string;
        locale: string;
        timezone: string;
        theme?: string | null;
        contrast?: string | null;
        density?: string | null;
        fontSize?: string | null;
      }
    | undefined;
  try {
    const { getAccountContext } = await import("@comitor/account-sdk");
    accountUser = (await getAccountContext(accountConfig, tokens.accessToken)).user;
    userId = accountUser.id;
  } catch (error) {
    console.warn("[auth] KHÔNG ĐỌC ĐƯỢC id người dùng lúc tạo phiên — phiên này sẽ không thu hồi từ xa được", error);
  }

  /*
   * ⚠ CÙNG MỘT LỜI GỌI, BA GIÁ TRỊ — và hai trong ba từng bị vứt đi.
   *
   * `getAccountContext` trả về trọn `AccountUser`, trong đó `locale` và `timezone` đã có sẵn từ SDK
   * 0.1.1. Bản trước chỉ giữ `id` và để module tự nuôi một cookie ngôn ngữ song song cùng một hằng
   * múi giờ — tức hai cửa vào cùng một dữ liệu, đúng thứ ranh giới Account/app dựng ra để tránh.
   * Nhặt chúng ở đây KHÔNG tốn thêm một vòng mạng nào.
   *
   * ⚠ **`try` RIÊNG, KHÔNG DÙNG CHUNG VỚI KHỐI TRÊN.** Gộp vào thì một lỗi ném từ
   * `adoptAccountPreferences` sẽ được báo bằng dòng log của khối kia — *"KHÔNG ĐỌC ĐƯỢC id người
   * dùng… phiên này sẽ không thu hồi từ xa được"* — một câu SAI cả hai vế (id đọc được, phiên thu
   * hồi được) chỉ thẳng người đọc sang một hệ thống con không liên quan. Hai sự cố khác nhau thì
   * phải để lại hai dòng khác nhau; đó là cùng một luật đã viết cho nửa đầu và nửa sau của chính
   * route này.
   *
   * Vẫn NUỐT lỗi, và vẫn cùng lý do: một lần đăng nhập ĐÃ THÀNH CÔNG ở Account không được hỏng vì
   * một tuỳ chọn hiển thị. Thiếu nó thì người dùng rơi về ngôn ngữ trình duyệt và múi giờ mặc định
   * — cả hai đều là trạng thái dùng được.
   */
  if (accountUser) {
    try {
      await adoptAccountPreferences(accountUser);

      /*
       * Bốn trục hiển thị đi đường KHÁC hai trục trên, và khác một cách bắt buộc.
       *
       * Ngôn ngữ và múi giờ được MÁY CHỦ đọc (`i18n/request.ts`), nên cookie của chúng là cookie
       * hiệu lực. Bốn trục này thì máy chủ không đọc bao giờ — giá trị có hiệu lực nằm ở
       * `localStorage`, vì chúng phải áp TRƯỚC lượt sơn đầu tiên. Nên ở đây ta chỉ đặt một cookie
       * TRUNG CHUYỂN sống ngắn, và `app/layout.tsx` biến nó thành một script gieo.
       *
       * ⚠ Trục nào `null` (chưa từng chọn) thì KHÔNG vào cookie — gieo một giá trị mặc định thay
       * cho `null` là ghi đè lựa chọn tại chỗ của người dùng bằng một thứ chưa ai chọn bao giờ.
       */
      await writeDisplayPrefsSeed({
        theme: accountUser.theme ?? null,
        contrast: accountUser.contrast ?? null,
        density: accountUser.density ?? null,
        fontSize: accountUser.fontSize ?? null
      });
    } catch (error) {
      console.warn("[auth] KHÔNG GIEO ĐƯỢC TUỲ CHỌN HIỂN THỊ — người dùng sẽ thấy ngôn ngữ trình duyệt", error);
    }
  }

  /*
   * ⚠ ĐÂY LÀ NỬA SAU CỦA LUỒNG, VÀ NÓ HỎNG KHÁC HẲN NỬA ĐẦU — nên nó phải nói khác.
   *
   * Tới dòng này, người dùng ĐÃ đăng nhập thành công ở Account và authorization code ĐÃ BỊ TIÊU.
   * Nếu `createSession` ném (database không với tới được là ca thường gặp nhất), bản trước để lỗi
   * đó bay ra ngoài thành một 500 KHÔNG có dòng log nào của app — và thứ người dùng nhìn thấy lại
   * là `/sign-in-failed`, trang nói *"liên kết đăng nhập đã dùng một lần rồi"*.
   *
   * Câu đó SAI, và nó sai theo hướng tệ nhất: nó mô tả đúng triệu chứng của request THỨ HAI (lần
   * thử lại gặp `invalid_grant` vì code đã tiêu) trong khi nguyên nhân thật nằm ở request thứ
   * nhất. Đo được 2026-09-03: Postgres dừng → `createSession` ném `Can't reach database server at
   * localhost:5436` → người dùng đọc "liên kết đã dùng rồi" và đi đăng nhập lại, mãi mãi.
   *
   * Nuốt và chuyển hướng thì KHÔNG được: người dùng vẫn phải rời khỏi đây. Nhưng phải để lại một
   * dòng viết HOA, grep được, và KHÁC HẲN dòng của nửa đầu — một sự cố hạ tầng và một liên kết hết
   * hạn cần hai phản ứng khác nhau, nên chúng không được nói giống nhau trong log.
   */
  let secret: string;
  try {
    /*
     * ⚠ `tokens.sid` phải đi cùng phiên, nếu không back-channel logout là NO-OP IM LẶNG: route
     * `/api/comitor/backchannel-logout` xác thực token hoàn hảo rồi xoá theo một cột toàn NULL,
     * khớp 0 hàng, trả 200 — Account ghi nhận giao thành công và phiên module sống trọn 30 ngày.
     * SDK đọc nó từ `id_token` (`AccountTokens.sid`); `undefined` khi Account không phát `sid`, và
     * lúc đó cột để trống là đúng — không bịa giá trị.
     */
    secret = await createSession({
      tokens,
      ...(userId ? { userId } : {}),
      ...(tokens.sid ? { sid: tokens.sid } : {})
    });
    await writeSessionCookie(secret);
  } catch (error) {
    console.error(
      "[auth] KHÔNG TẠO ĐƯỢC PHIÊN SAU KHI ACCOUNT ĐÃ XÁC THỰC XONG — đăng nhập đúng, hạ tầng của " +
        "module hỏng (thường là database). Người dùng sẽ thấy /sign-in-failed, và câu trên trang đó " +
        "KHÔNG mô tả ca này.",
      error
    );
    return NextResponse.redirect(new URL("/sign-in-failed", env.appUrl));
  }

  /*
   * Trả người dùng về đúng chỗ họ đang đứng lúc phiên rơi. Lọc LẦN NỮA dù cookie do chính ta ghi:
   * nó có thể là cookie của một bản mã cũ, hoặc của một tên miền anh em nếu có ngày ai đó nới
   * `domain`. Một phép kiểm hai lần ở đường chuyển hướng rẻ hơn một open redirect.
   */
  const next = toSafeInternalPath(await takeReturnPathCookie());
  return NextResponse.redirect(new URL(next ?? "/", env.appUrl));
}
