import "server-only";
import { memberDirectory } from "@/lib/account/directory";
import type { ActivityKind, ActivityView, NotificationKind, NotificationView } from "@/lib/contracts/task";
import { prisma } from "@/lib/prisma";

/**
 * Nhật ký hoạt động và thông báo — hai bảng, một nguyên tắc.
 *
 * ── NGUYÊN TẮC: TẦNG DỮ LIỆU GIỮ GIÁ TRỊ, KHÔNG GIỮ CÂU CHỮ ──────────────────────────────
 * Bản chỉ-giao-diện trước đây lưu sẵn cả câu: `verb: "đã đổi độ ưu tiên thành Cao"`, `body: "Bùi
 * Tiến Nam nhắc tới bạn trong CV-016"`. Đó là chuỗi HIỂN THỊ nằm trong dữ liệu, và nó hỏng theo ba
 * cách cùng lúc:
 *
 *   1. **Không dịch được.** Dòng đã ghi hôm nay sẽ nói tiếng Việt mãi mãi, kể cả với người đang
 *      đọc giao diện tiếng Anh — và không có cách nào sửa ngược.
 *   2. **Không đổi được cách viết.** Muốn rút gọn câu, hay thêm tên dự án vào, là phải viết lại
 *      lịch sử.
 *   3. **`pnpm i18n:check` không thấy nó**, vì nó không nằm trong `messages/`.
 *
 * Nay bảng chỉ giữ `kind` + vài định danh; câu chữ dựng ở tầng hiển thị từ `messages/*.json`.
 * Đánh đổi: giao diện phải có một khoá cho MỖI `kind`, và thêm một `kind` mà quên khoá thì
 * `t.has()` phải chặn — xem `activity-feed.tsx`.
 */

/**
 * Tám dòng gần nhất cho trang Tổng quan.
 *
 * `ORDER BY … LIMIT` ở tầng TRUY VẤN, không phải `sort()` trong component: nhật ký thật dài hàng
 * nghìn dòng, và tải hết về để sắp lại là một truy vấn tăng theo tuổi của khách hàng.
 */
export async function listRecentActivities(workspaceId: string, take = 8): Promise<ActivityView[]> {
  const [rows, directory] = await Promise.all([
    prisma.activity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        kind: true,
        actorUserId: true,
        targetUserId: true,
        targetCode: true,
        targetTitle: true,
        createdAt: true
      }
    }),
    memberDirectory(workspaceId)
  ]);

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as ActivityKind,
    actorUserId: row.actorUserId,
    actorName: directory.get(row.actorUserId)?.name ?? null,
    targetUserId: row.targetUserId,
    targetUserName: row.targetUserId ? (directory.get(row.targetUserId)?.name ?? null) : null,
    targetCode: row.targetCode,
    targetTitle: row.targetTitle,
    createdAt: row.createdAt.toISOString()
  }));
}

/**
 * Thông báo của MỘT người trong một không gian làm việc.
 *
 * ⚠ Lọc theo `userId` là bắt buộc, không phải tuỳ chọn. Bảng `notifications` có một dòng cho mỗi
 * NGƯỜI NHẬN (xem `prisma/schema.prisma`), nên bỏ điều kiện đó là hiện thông báo của người khác —
 * kèm cả tên công việc mà người đang xem có thể không được phép thấy.
 */
export async function listNotifications(workspaceId: string, userId: string, take = 20): Promise<NotificationView[]> {
  const [rows, directory] = await Promise.all([
    prisma.notification.findMany({
      where: { workspaceId, userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        kind: true,
        actorUserId: true,
        taskCode: true,
        taskTitle: true,
        readAt: true,
        createdAt: true
      }
    }),
    memberDirectory(workspaceId)
  ]);

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as NotificationKind,
    actorName: row.actorUserId ? (directory.get(row.actorUserId)?.name ?? null) : null,
    taskCode: row.taskCode,
    taskTitle: row.taskTitle,
    unread: row.readAt === null,
    createdAt: row.createdAt.toISOString()
  }));
}

/**
 * Ghi một dòng nhật ký.
 *
 * ── NUỐT LỖI, CÓ CHỦ ĐÍCH ────────────────────────────────────────────────────────────────
 * Ghi nhật ký luôn đi KÈM một thao tác khác (tạo việc, giao việc). Để nó làm hỏng thao tác chính
 * là đổi một dòng lịch sử lấy một lần tạo việc thất bại — sai tỉ lệ. Cùng lối với `sendMail`.
 *
 * Log cố định `[activity] KHÔNG GHI ĐƯỢC` để còn grep/alert: đó là dòng duy nhất cho biết nhật ký
 * đang thủng.
 *
 * ⚠ Tôn trọng cài đặt `keepActivityLog` là việc của NƠI GỌI, không phải của hàm này: hàm này không
 * đọc cài đặt để khỏi thêm một truy vấn vào mọi thao tác ghi.
 */
export async function recordActivity(input: {
  workspaceId: string;
  kind: ActivityKind;
  actorUserId: string;
  targetUserId?: string | null;
  targetCode: string;
  targetTitle: string;
}): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        workspaceId: input.workspaceId,
        kind: input.kind,
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId ?? null,
        targetCode: input.targetCode,
        targetTitle: input.targetTitle
      }
    });
  } catch (error) {
    console.error("[activity] KHÔNG GHI ĐƯỢC", error);
  }
}

/** Ghi một thông báo. Cùng chính sách nuốt lỗi với `recordActivity` và cùng lý do. */
export async function notify(input: {
  workspaceId: string;
  userId: string;
  kind: NotificationKind;
  actorUserId?: string | null;
  taskCode?: string | null;
  taskTitle?: string | null;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        kind: input.kind,
        actorUserId: input.actorUserId ?? null,
        taskCode: input.taskCode ?? null,
        taskTitle: input.taskTitle ?? null
      }
    });
  } catch (error) {
    console.error("[notification] KHÔNG GHI ĐƯỢC", error);
  }
}

/**
 * Đánh dấu mọi thông báo CHƯA ĐỌC của một người là đã đọc.
 *
 * ⚠ `where` mang CẢ `workspaceId` LẪN `userId`. `userId` một mình nghe là đủ (thông báo là của
 * riêng người đó), nhưng bỏ `workspaceId` đi là phá bất biến của repo ở đúng chỗ nó dễ bị coi là
 * thừa — và `pnpm tenant:check` sẽ báo đỏ, đúng như nó nên làm. Một người thuộc nhiều không gian
 * làm việc thì "đã đọc ở đây" không có nghĩa "đã đọc ở kia".
 *
 * ⚠ Chỉ ghi những hàng CHƯA đọc (`readAt: null`). Không lọc thì mỗi lần mở chuông là một lần ghi
 * đè `read_at` của mọi thông báo cũ — mất luôn thông tin "đã đọc lúc nào", và làm một lần ghi
 * đáng lẽ chạm 2 hàng thành chạm 200.
 *
 * @returns số hàng thật sự đổi.
 */
export async function markNotificationsRead(workspaceId: string, userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { workspaceId, userId, readAt: null },
    data: { readAt: new Date() }
  });
  return count;
}
