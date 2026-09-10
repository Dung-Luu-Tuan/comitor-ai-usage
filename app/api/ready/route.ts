// @api-guard: readiness check của hạ tầng — không có phiên người dùng nào để hỏi quyền.

import { NextResponse } from "next/server";
import { accountConfigured } from "@/lib/account/config";
import { storageEnabled } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * `GET /api/ready` — **readiness**: instance này nhận được lưu lượng chưa.
 *
 * Trả **200** khi mọi phụ thuộc BẮT BUỘC sẵn sàng, **503** khi không. 503 khiến load balancer rút
 * instance khỏi luồng mà KHÔNG giết nó — khác hẳn liveness (`/api/health`), nơi đỏ nghĩa là bị
 * khởi động lại. Xem chú thích ở đó cho lý do hai route tách nhau.
 *
 * ── BA PHỤ THUỘC, VÀ CHỈ MỘT TRONG BA LÀ BẮT BUỘC ────────────────────────────────────────
 *  · **database** — bắt buộc. Không có nó thì mọi trang đổ ở truy vấn đầu tiên.
 *  · **xác thực** — bắt buộc. `accountConfigured` là fail-closed: thiếu cấu hình thì KHÔNG AI vào
 *    được, nên một instance như vậy không nên nhận lưu lượng.
 *  · **kho tệp** — KHÔNG bắt buộc, và đó là chủ ý: thiếu MinIO/S3 thì chỉ chức năng đính kèm tự
 *    tắt và giao diện nói rõ. Rút cả instance khỏi luồng vì một tính năng phụ là biến một sự suy
 *    giảm thành một sự cố. Nó vẫn được BÁO CÁO để người trực nhìn thấy.
 *
 * ⚠ **KHÔNG bọc `withApiErrors`.** Wrapper đó trả **500** cho lỗi không lường trước, còn readiness
 * cần **503** — 500 nói "instance hỏng", 503 nói "chưa sẵn sàng", và orchestrator xử lý hai thứ đó
 * khác nhau.
 *
 * ⚠ **Thân phản hồi chỉ mang TÊN phép kiểm và trạng thái.** Không đưa thông điệp lỗi của Prisma ra
 * — nó mang tên bảng, tên cột, đôi khi cả chuỗi kết nối. Endpoint này thường mở cho cả mạng nội bộ.
 */

/**
 * ⚠ BẮT BUỘC, và ở đây hậu quả nặng hơn `/api/health`.
 *
 * Không có dòng này, Next prerender route thành tĩnh lúc build — tức nó ghi lại kết quả của một
 * lần kiểm chạy **trên máy build**, nơi không có database nào. Readiness khi đó **nói dối vĩnh
 * viễn**: hoặc luôn 503 (và không instance nào vào được luồng), hoặc luôn 200 (và mọi instance vào
 * luồng kể cả khi database chết). Cả hai đều là sự cố, và cả hai đều không có dấu vết nào trong log.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;
  try {
    /* `SELECT 1` — rẻ nhất có thể, và nó đi qua đúng thứ ta cần biết: kết nối còn dùng được không. */
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch (error) {
    console.error("[ready] DATABASE KHÔNG SẴN SÀNG", error);
  }

  const checks = { database, auth: accountConfigured, storage: storageEnabled };
  const ready = checks.database && checks.auth;

  return NextResponse.json({ ready, checks }, { status: ready ? 200 : 503 });
}
