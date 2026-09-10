// @api-guard: đích nhận webhook của Comitor.Account — KHÔNG có phiên người dùng nào để hỏi quyền.
// Nó tự xác thực bằng chữ ký HMAC trên thân THÔ (`readWebhook` của SDK), và đó là toàn bộ chốt.

import { invalidateContextCache, readWebhook } from "@comitor/account-sdk";
import { NextResponse } from "next/server";
import { revokeSessionsForUser } from "@/lib/account/session-store";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * `POST /api/comitor/webhook` — Comitor.Account đẩy sự kiện sang module.
 *
 * ── VÌ SAO ĐƯỜNG NÀY TỒN TẠI, TRONG KHI ĐÃ CÓ `contextCacheSeconds: 30` ─────────────────
 * Vì cache 30 giây chỉ thu hẹp độ trễ của phép kiểm QUYỀN. Nó không đụng tới PHIÊN — và phiên ở
 * module này sống **30 ngày**. Trước route này, đường đóng phiên duy nhất là `/api/auth/sign-out`,
 * tức chính người dùng phải tự bấm. Nghĩa là: quản trị viên gỡ một người khỏi không gian làm việc
 * ở Account, người đó vẫn giữ một phiên hợp lệ ở đây, và thứ duy nhất chặn họ là màn `NOT_A_MEMBER`
 * — một màn hình, không phải một lần đăng xuất.
 *
 * ── BỐN LUẬT CỦA MỘT ĐÍCH NHẬN WEBHOOK ─────────────────────────────────────────────────
 *  1. **Đọc thân THÔ trước, parse sau.** `readWebhook` lo việc này; đừng tự `request.json()` rồi
 *     `JSON.stringify` lại để kiểm chữ ký — thứ tự khoá và cách escape đổi, chữ ký không bao giờ
 *     khớp, và triệu chứng là "webhook luôn sai chữ ký" mà không rõ vì sao.
 *  2. **KHÔNG redirect.** Account gửi với `redirect: "error"`. Vì vậy URL đăng ký bên đó không
 *     được có dấu `/` cuối, và route này không được trả 3xx trong bất kỳ nhánh nào.
 *  3. **Khử trùng lặp theo `payload.id`.** Account thử lại 5 lần, giãn dần tới 2 giờ, và mọi lần
 *     thử lại mang CÙNG id. Xử lý hai lần một `seat.revoked` thì vô hại; `member.added` thì không.
 *  4. **Trả 2xx cho thứ đã nhận, kể cả khi không làm gì.** Một sự kiện không quan tâm mà trả 4xx
 *     là mời Account thử lại năm lần cho một thứ sẽ không bao giờ đổi kết quả.
 *
 * ⚠ Chưa cấu hình `COMITOR_WEBHOOK_SECRET` thì route trả **503, không phải 200**: im lặng nuốt
 * mọi sự kiện là đúng thứ tệ nhất — Account thấy 2xx, ngừng thử lại, và không ai biết đường thu
 * hồi phiên đã chết.
 */

/** Giữ dấu vết chống trùng bao lâu. 7 ngày — thừa sức phủ vòng thử lại tối đa 2 giờ của Account. */
const DEDUPE_RETENTION_DAYS = 7;

export async function POST(request: Request) {
  const secret = env.account.webhookSecret;
  if (!secret) {
    console.error("[webhook] CHƯA CẤU HÌNH COMITOR_WEBHOOK_SECRET — mọi sự kiện của Account bị bỏ qua");
    return NextResponse.json({ error: { code: "SERVICE_UNAVAILABLE" } }, { status: 503 });
  }

  const result = await readWebhook(request, secret);
  if (!result.ok) {
    /*
     * 401 chứ không 400: chữ ký sai nghĩa là người gửi không chứng minh được mình là Account. Và
     * KHÔNG đưa `reason` ra ngoài — nó nói chỗ nào của chữ ký lệch, tức nó là gợi ý cho người đang
     * dò. Chi tiết vào log, người gửi nhận một mã.
     */
    console.warn("[webhook] CHỮ KÝ KHÔNG HỢP LỆ", { reason: result.reason });
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { id, event, data } = result.payload;

  /*
   * Khử trùng bằng chính khoá chính: `create` ném `P2002` nếu id đã có. Dùng ràng buộc thay vì
   * `findUnique` rồi `create` là bỏ được cửa sổ đua giữa hai lần thử lại tới cùng lúc — và Account
   * thử lại thì hoàn toàn có thể tới cùng lúc.
   */
  try {
    await prisma.webhookEvent.create({ data: { id, event } });
  } catch {
    return NextResponse.json({ ok: true, deduped: true });
  }

  /* Dọn inline, cùng khuôn `account_sessions`: không thêm một cron phải cài và phải nhớ khi sao chép. */
  const cutoff = new Date(Date.now() - DEDUPE_RETENTION_DAYS * 86_400_000);
  await prisma.webhookEvent.deleteMany({ where: { receivedAt: { lt: cutoff } } });

  const userId = typeof data?.userId === "string" ? data.userId : null;

  /*
   * ⚠ TÊN SỰ KIỆN LÀ HỢP ĐỒNG VỚI ACCOUNT, KHÔNG PHẢI TÊN TỰ ĐẶT.
   * Danh mục chuẩn nằm ở `comitor-account/lib/webhooks/events.ts` (`WEBHOOK_EVENTS`) — 13 sự
   * kiện, và Account TỪ CHỐI lúc đăng ký đích nếu bạn khai một tên ngoài danh mục đó.
   *
   * Bản trước có `case "app.suspended"` — một tên KHÔNG có trong danh mục, tức một nhánh không
   * bao giờ chạy được. Nó hỏng theo kiểu tệ nhất: mã trông như đã lo liệu tình huống "app bị tạm
   * ngừng", nên không ai đi kiểm, trong khi ba sự kiện Account THẬT SỰ phát cho tình huống đó
   * (`workspace.suspended`, `workspace.app_disabled`, `user.deleted`) rơi thẳng vào `default:` và
   * nhận 200 — Account coi như đã giao xong và ngừng thử lại.
   */
  switch (event) {
    /*
     * NGƯỜI NÀY KHÔNG CÒN LÀ NGƯỜI DÙNG HỢP LỆ Ở ĐÂY → THU HỒI PHIÊN.
     *
     * Hai việc, không phải một: bỏ cache ngữ cảnh (để phép kiểm quyền thôi trả lời theo bản cũ
     * trong 30 giây) và xoá phiên (để họ không đi tiếp được với token đang cầm).
     *
     * `user.deleted` nằm ở đây vì tài khoản đã biến mất — không còn ai để hiện màn chặn cho.
     * ⚠ Account ghi nghĩa vụ kèm theo: "app PHẢI dọn dữ liệu cá nhân (nghĩa vụ pháp lý)". Module
     * này thu hồi phiên nhưng CHƯA dọn dữ liệu — xem `docs/kien-truc-ung-dung.md` §"Còn tồn".
     */
    case "member.removed":
    case "seat.revoked":
    case "user.deleted": {
      invalidateContextCache();
      if (userId) {
        const revoked = await revokeSessionsForUser(userId);
        console.info("[webhook] ĐÃ THU HỒI PHIÊN", { event, userId, revoked });
      }
      break;
    }

    /*
     * CẤP WORKSPACE → BỎ CACHE, **KHÔNG** THU HỒI PHIÊN.
     *
     * Đây là chỗ dễ làm sai nhất của cả route, và làm sai thì không có gì báo. Thu hồi phiên khi
     * workspace bị tạm ngừng nghĩa là đá người dùng về màn ĐĂNG NHẬP — họ đăng nhập lại thành
     * công (tài khoản vẫn tốt), rồi lại bị đá, và không chỗ nào nói vì sao. Bỏ cache thì lần kiểm
     * quyền kế tiếp hỏi lại Account, SDK ném `APP_SUSPENDED`/`APP_NOT_ENABLED`, và người dùng
     * thấy ĐÚNG một trong bốn màn chặn — tức câu trả lời cho "tôi phải đi hỏi ai".
     *
     * Nhóm dưới gồm cả các sự kiện CẤP THÊM quyền (`member.added`, `seat.granted`,
     * `workspace.app_enabled`, `workspace.resumed`, `workspace.plan_changed`): không bỏ cache thì
     * người vừa được cấp chỗ ngồi phải đợi tới 30 giây mới vào được, và họ sẽ bấm lại vài lần
     * trước khi đi báo lỗi.
     */
    case "workspace.suspended":
    case "workspace.app_disabled":
    case "workspace.resumed":
    case "workspace.app_enabled":
    case "workspace.plan_changed":
    case "member.added":
    case "member.role_changed":
    case "seat.granted":
      invalidateContextCache();
      break;

    /*
     * ⚠ CHƯA XỬ LÝ ĐƯỢC, và nói ra thay vì để nó lẫn vào `default:`.
     *
     * Phiên lưu `workspaceSlug`, nên đổi slug làm mọi phiên đang mở trỏ vào một slug không còn
     * tồn tại — người dùng nhận `NOT_A_MEMBER`, tức một câu SAI về nguyên nhân. Sửa được thì phải
     * cập nhật slug trong các phiên đang lưu, mà payload phiên được NIÊM nên không truy theo slug
     * được; đổi khoá tra cứu là đổi lược đồ.
     *
     * Chưa làm vì phiên tự hết hạn sau 30 ngày và đổi slug là việc hiếm. Làm khi: có một module
     * thật báo ca này, HOẶC `account_sessions` mang thêm cột tra cứu được vì lý do khác.
     */
    case "workspace.slug_changed":
      console.warn("[webhook] SLUG ĐỔI — PHIÊN ĐANG MỞ SẼ TRỎ SAI", { event });
      invalidateContextCache();
      break;

    /* Gửi thử từ trang quản trị Account. Không làm gì là ĐÚNG — nó chỉ kiểm đường truyền. */
    case "ping":
      break;

    default:
      /*
       * Sự kiện ngoài 13 cái đã biết: vẫn 2xx (luật 4), nhưng GHI LẠI. Im lặng ở đây nghĩa là
       * Account thêm một sự kiện mới và không module nào biết mình đang bỏ qua nó.
       */
      console.warn("[webhook] SỰ KIỆN CHƯA BIẾT", { event });
      break;
  }

  return NextResponse.json({ ok: true });
}
