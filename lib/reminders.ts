import "server-only";
import { fetchMembers } from "@/lib/account/directory";
import { notify } from "@/lib/activities";
import { DEFAULT_REMINDER_LEAD_DAYS, selectDueSoon } from "@/lib/core/due-soon";
import { resolveNotifyDelivery } from "@/lib/core/notify-channels";
import { env } from "@/lib/env";
import { formatIsoDateFor } from "@/lib/format";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/config";
import { mailTemplates, sendMail, toMailLocale } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { todayIso } from "@/lib/today";

/**
 * NHẮC TRƯỚC HẠN — nghiệp vụ của job nền `scripts/jobs/due-soon-reminders.ts`.
 *
 * ── VÌ SAO NÓ Ở `lib/`, KHÔNG Ở TRONG CHÍNH FILE JOB ────────────────────────────────────
 * Cùng lý do mà `createTask` không ở trong `route.ts`: nghiệp vụ nằm trong một điểm vào thì chỉ
 * điểm vào đó gọi được. Ở đây thì một route "chạy thủ công", một test tích hợp, hay một lệnh gỡ
 * lỗi đều gọi được cùng một hàm.
 *
 * ── VÌ SAO CÓ HÀM NÀY THÌ BA CÀI ĐẶT MỚI THÔI NÓI DỐI ──────────────────────────────────
 * `notifications["due-soon"]` (cài đặt của không gian làm việc) và `Task.remindBeforeDue` (cờ của
 * từng việc) được lưu, được kiểm bằng zod, được hiện trong giao diện — và trước file này **không
 * ai đọc chúng**. Người dùng bật "nhắc trước hạn" rồi không có gì nhắc. Đó là giao diện nói dối,
 * và với một bản mẫu thì nó còn dạy rằng thêm một công tắc mà không nối gì là chấp nhận được.
 *
 * ⚠ **Job phải IDEMPOTENT theo NGÀY.** Chạy hai lần trong một ngày (thử lại, hai node cùng cron,
 * một lần chạy tay) không được gửi hai lần. Ở đây tính chất đó đến từ chính quy tắc chọn:
 * `selectDueSoon` chỉ lấy việc tới hạn ĐÚNG sau `leadDays` ngày, nên tập kết quả không đổi trong
 * một ngày — nhưng **gửi lại thì vẫn gửi lại**. Chống trùng thật (một bảng `reminder_sent`) là
 * việc của module nào cần nó; với một lời nhắc thì gửi trùng là phiền, không phải sai.
 */

export interface ReminderRun {
  workspaceId: string;
  /** Số việc được chọn — khác `sent` khi danh bạ không tra được người phụ trách. */
  selected: number;
  sent: number;
  skippedReason?: "disabled" | "no-directory";
}

/**
 * Chạy một vòng nhắc cho MỘT không gian làm việc.
 *
 * ── ⚠ MÚI GIỜ Ở ĐÂY LÀ MỘT KHOẢN NỢ ĐÃ BIẾT, KHÔNG PHẢI MỘT CHỖ BỎ QUÊN ─────────────────
 * Từ 05.09.2026, "hôm nay" trong cả app được đọc bằng lịch của NGƯỜI XEM. Job này không có người
 * xem — nó liệt kê workspace từ database của chính module, trong một tiến trình không có phiên
 * nào — nên suy rộng mạch lạc duy nhất là tính theo lịch của **NGƯỜI NHẬN THƯ**.
 *
 * **Và hôm nay điều đó chưa làm được**, vì một lý do cụ thể và kiểm chứng được: danh bạ không mang
 * múi giờ. `AccountMember` (`lib/contracts/account.ts`) có `id`/`name`/`email`/`role`/`avatarUrl`,
 * và `timezone` chỉ tồn tại trên `AccountUser` — tức người ĐANG HỎI, không phải người được liệt kê.
 * Muốn làm đúng thì API danh bạ của Account phải trả thêm trường đó, rồi `selectDueSoon` phải chạy
 * MỘT LẦN CHO MỖI người nhận thay vì một lần cho cả workspace.
 *
 * Cho tới lúc đó, `DEFAULT_TIME_ZONE` được truyền TƯỜNG MINH — không để rơi vào giá trị mặc định
 * của `todayIso()`, vì một tham số bỏ trống trông y hệt một tham số bị quên. Hậu quả có giới hạn và
 * đã biết: người nhận ở múi giờ khác có thể nhận lời nhắc lệch tối đa một ngày so với lịch của họ.
 * Đó là phiền, không phải sai — khác hẳn một cột "quá hạn" hiện sai, thứ người dùng tin là sự thật.
 *
 * @param today Cho phép truyền vào để test và để chạy bù một ngày đã qua.
 */
export async function runDueSoonReminders(
  workspaceId: string,
  today: string = todayIso(DEFAULT_TIME_ZONE),
  leadDays: number = DEFAULT_REMINDER_LEAD_DAYS
): Promise<ReminderRun> {
  const settings = await getAppSettings(workspaceId);
  if (!settings.notifications["due-soon"]) {
    return { workspaceId, selected: 0, sent: 0, skippedReason: "disabled" };
  }

  const rows = await prisma.task.findMany({
    where: { workspaceId, status: { not: "done" }, remindBeforeDue: true },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      dueDate: true,
      remindBeforeDue: true,
      assigneeUserId: true,
      /*
       * Kênh do NGƯỜI TẠO VIỆC chọn. Job này tôn trọng chúng vì `notifyChannels` là MỘT trường có
       * MỘT nghĩa: nếu nó chỉ áp lúc tạo việc thì người dùng không có cách nào biết được điều đó,
       * và ta lại dựng đúng kiểu giao diện nói dối vừa chữa xong. Tiền lệ đã có ngay trong file
       * này: `remindBeforeDue` cũng là cờ theo từng việc và job vẫn tôn trọng nó.
       */
      notifyChannels: true
    }
  });

  const due = selectDueSoon(
    rows.map((row) => ({ ...row, dueDate: row.dueDate.toISOString().slice(0, 10) })),
    today,
    leadDays
  );
  if (due.length === 0) return { workspaceId, selected: 0, sent: 0 };

  /*
   * ⚠ `fetchMembers`, KHÔNG `listMembers`. Bản kia bọc `cache()` của React, và `cache()` chỉ có
   * nghĩa trong phạm vi MỘT request — gọi nó từ một tiến trình không có request nào là dựa vào một
   * cơ chế không tồn tại ở đó. Chính JSDoc của `fetchMembers` nói nó dành cho đường này.
   */
  const members = await fetchMembers(workspaceId);
  if (members.length === 0) {
    /*
     * Danh bạ rỗng nghĩa là M2M chưa cấu hình HOẶC Account đang gián đoạn. Cả hai đều không phải
     * lý do để gửi một loạt thư thiếu tên người nhận — dừng lại và nói ra.
     */
    console.warn("[reminders] DANH BẠ RỖNG, BỎ QUA", { workspaceId, selected: due.length });
    return { workspaceId, selected: due.length, sent: 0, skippedReason: "no-directory" };
  }
  const directory = new Map(members.map((member) => [member.id, member]));

  let sent = 0;
  for (const task of due) {
    const assignee = task.assigneeUserId ? directory.get(task.assigneeUserId) : undefined;
    if (!assignee) continue;

    const delivery = resolveNotifyDelivery({
      channels: task.notifyChannels,
      workspaceAllows: settings.notifications["due-soon"]
    });

    /*
     * TUẦN TỰ, không `Promise.all`: một vòng nhắc có thể chạm hàng trăm việc, và bắn hàng trăm lời
     * gọi SMTP cùng lúc là tự chạm rate limit của nhà cung cấp — rồi phần lớn thư không đi.
     */
    if (delivery.inApp) {
      await notify({
        workspaceId,
        userId: assignee.id,
        kind: "deadline",
        taskCode: task.code,
        taskTitle: task.title
      });
    }

    if (delivery.email) {
      /* Ngôn ngữ của lá thư là ngôn ngữ NGƯỜI NHẬN — xem `lib/mail.ts`. */
      const locale = toMailLocale(undefined);
      await sendMail({
        to: assignee.email,
        ...mailTemplates.taskDueSoon(locale, {
          actorName: assignee.name,
          taskCode: task.code,
          taskTitle: task.title,
          dueDate: formatIsoDateFor(locale, task.dueDate),
          url: `${env.appUrl}/tasks/${encodeURIComponent(task.id)}`
        })
      });
    }

    /*
     * Chỉ đếm khi CÓ THỨ GÌ ĐÓ đi ra. Đếm cả những việc mà mọi kênh đều tắt thì `sent` nói dối
     * đúng theo kiểu file này vừa chữa — và `selected - sent` mất luôn ý nghĩa "bao nhiêu việc
     * tới hạn mà không ai được báo".
     */
    if (delivery.inApp || delivery.email) sent += 1;
  }

  return { workspaceId, selected: due.length, sent };
}
