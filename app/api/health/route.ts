// @api-guard: health check của hạ tầng — không có phiên người dùng, và cố ý không chạm gì.

import { NextResponse } from "next/server";

/**
 * `GET /api/health` — **liveness**: tiến trình này còn sống không.
 *
 * ── VÌ SAO CẦN, TRONG KHI `GET /` CŨNG TRẢ VỀ ĐƯỢC ─────────────────────────────────────
 * Vì `GET /` **nói dối**. Nó đi qua `requireSession()` và trả **307** sang trang đăng nhập TRƯỚC
 * khi chạm database — nên nó "khoẻ" ngay cả khi Postgres đã chết, và một load balancer dựa vào nó
 * sẽ tiếp tục đẩy người dùng vào một instance không phục vụ được gì.
 *
 * ── LIVENESS ≠ READINESS, VÀ GỘP HAI CÁI LÀ MỘT LỖI ĐẮT ────────────────────────────────
 * Route này cố ý **không chạm database**, không gọi Account, không đọc bucket. Nó trả lời đúng một
 * câu: *"tiến trình này có còn xử lý được request không?"*
 *
 * Nếu nó cũng kiểm database thì một sự cố Postgres kéo dài sẽ làm liveness probe đỏ → orchestrator
 * GIẾT VÀ KHỞI ĐỘNG LẠI mọi instance → cơn bão khởi động lại chồng lên một database vốn đã quá
 * tải. Câu "database có sẵn sàng không" thuộc về `/api/ready`, và readiness chỉ khiến instance bị
 * RÚT KHỎI luồng chứ không bị giết.
 */

/**
 * ⚠ BẮT BUỘC. Không có nó, Next thấy một `GET` không đọc gì động và **prerender nó thành tĩnh lúc
 * build** — health check khi đó trả về một phản hồi đóng băng từ lúc build, tức nó nói "khoẻ" kể
 * cả khi tiến trình đang hấp hối. Cùng lý do ở `/api/ready`, nơi hậu quả còn nặng hơn.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
