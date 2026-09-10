/**
 * JOB NỀN: nhắc trước hạn.
 *
 * Chạy: `pnpm job:due-soon`
 *
 * ── KHUÔN CỦA MỌI JOB NỀN TRONG MỘT MODULE COMITOR ──────────────────────────────────────
 * File này cố tình MỎNG. Nó làm đúng ba việc — chọn không gian làm việc, gọi nghiệp vụ ở `lib/`,
 * và in kết quả — vì mọi thứ khác phải gọi lại được từ chỗ khác. Nghiệp vụ nằm ở
 * `lib/reminders.ts`; quy tắc thuần "hôm nay nhắc việc nào" nằm ở `lib/core/due-soon.ts` cùng
 * test của nó.
 *
 * ⚠ **`--conditions=react-server` là BẮT BUỘC** (đã có trong `package.json`). `lib/` phía máy chủ
 * mang `import "server-only"`, và gói đó NÉM khi được nạp thiếu điều kiện resolution ấy — với một
 * thông điệp ("This module cannot be imported from a Client Component module") không liên quan gì
 * tới nguyên nhân thật.
 *
 * ── HẸN GIỜ Ở PRODUCTION: CRON CỦA HẠ TẦNG, KHÔNG PHẢI `setInterval` ────────────────────
 * Đừng bao giờ đặt một `setInterval` trong tiến trình Next để chạy việc này. N instance nghĩa là
 * N lần chạy mỗi ngày, tức mỗi người nhận N lá thư — và con số N đổi theo mức tự động co giãn, nên
 * triệu chứng là "thỉnh thoảng khách hàng nhận thư trùng". Dùng CronJob của Kubernetes, một
 * scheduled task của nền tảng, hoặc `cron` của máy — thứ chạy ĐÚNG MỘT tiến trình.
 *
 * ⚠ Job phải chịu được chạy lại. Ở đây tính chất đó đến từ chính quy tắc chọn (`selectDueSoon` chỉ
 * lấy việc tới hạn ĐÚNG sau N ngày) — nhưng chạy hai lần trong một ngày thì vẫn GỬI hai lần. Với
 * một lời nhắc, gửi trùng là phiền chứ không sai; job nào mà gửi trùng là SAI thì phải có bảng
 * chống trùng riêng, cùng khuôn `webhook_events`.
 */

import { prisma } from "@/lib/prisma";
import { runDueSoonReminders } from "@/lib/reminders";

/*
 * Chạy cho MỌI không gian làm việc có dữ liệu trong module này.
 *
 * ⚠ Lấy danh sách từ CHÍNH database của module, không hỏi Account. Account biết mọi workspace của
 * cả hệ; module chỉ có việc với những workspace đã dùng nó. Hỏi Account là gửi thư cho khách hàng
 * chưa bao giờ mở app này.
 */
const workspaces = await prisma.task.findMany({
  where: { remindBeforeDue: true, status: { not: "done" } },
  distinct: ["workspaceId"],
  select: { workspaceId: true }
});

if (workspaces.length === 0) {
  console.info("· Không có không gian làm việc nào bật nhắc trước hạn.");
} else {
  let sent = 0;
  for (const { workspaceId } of workspaces) {
    /*
     * ⚠ Một workspace hỏng KHÔNG được làm chết cả vòng chạy. Với một job chạy mỗi ngày một lần,
     * dừng ở workspace thứ hai nghĩa là tám workspace còn lại không được nhắc — và không ai biết,
     * vì job vẫn "đã chạy".
     */
    try {
      const run = await runDueSoonReminders(workspaceId);
      sent += run.sent;
      console.info(
        `· ${workspaceId}: chọn ${run.selected}, gửi ${run.sent}` +
          (run.skippedReason ? ` (bỏ qua: ${run.skippedReason})` : "")
      );
    } catch (error) {
      console.error("[reminders] LỖI Ở MỘT KHÔNG GIAN LÀM VIỆC", { workspaceId }, error);
    }
  }
  console.info(`\n✓ Xong: ${workspaces.length} không gian làm việc, ${sent} lời nhắc đã gửi.`);
}

await prisma.$disconnect();
