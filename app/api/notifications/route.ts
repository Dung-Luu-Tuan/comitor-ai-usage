import { requireApiSession } from "@/lib/account/session";
import { markNotificationsRead } from "@/lib/activities";
import { apiOk, withApiErrors } from "@/lib/api/response";

// @api-guard: đánh dấu ĐÃ ĐỌC là thao tác trên thông báo CỦA CHÍNH người gọi — `userId` lấy từ
// phiên, không từ thân request, nên không có gì để phân quyền. Đòi một quyền ở đây nghĩa là một
// vai trò bị hạn chế sẽ mang huy hiệu "chưa đọc" vĩnh viễn.

/**
 * `PATCH /api/notifications` — đánh dấu mọi thông báo của người đang đăng nhập là đã đọc.
 *
 * ── VÌ SAO ĐƯỜNG NÀY PHẢI CÓ TRONG MỘT BẢN MẪU ─────────────────────────────────────────
 * `Notification` là một trong những bảng mà README bảo mọi module GIỮ NGUYÊN — tức nó là hạ tầng
 * dùng chung. Nhưng cột `read_at` của nó trước đây chỉ được `scripts/seed.ts` ghi: giao diện giữ
 * "đã đọc" trong `useState`, nên nó **mất sau mỗi F5**, và huy hiệu đỏ quay lại.
 *
 * Bàn giao một hạ tầng dùng chung thiếu nửa vòng đời nghĩa là năm module cùng viết lại cùng một
 * endpoint, theo năm kiểu.
 *
 * ⚠ `userId` lấy từ PHIÊN, không nhận từ thân request. Nhận nó từ ngoài là cho phép bất kỳ ai đánh
 * dấu đã đọc hộ người khác — vô hại nghe thì có vẻ, cho tới khi ai đó dùng nó để giấu một thông
 * báo mà người kia cần thấy.
 */
export const PATCH = withApiErrors(async () => {
  const session = await requireApiSession();
  const count = await markNotificationsRead(session.workspace.id, session.user.id);
  return apiOk({ count });
});
