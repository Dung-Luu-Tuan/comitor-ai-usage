import "server-only";
import type { AppSettingsView } from "@/lib/contracts/settings";
import type { TaskPriority } from "@/lib/contracts/task";
import { prisma } from "@/lib/prisma";

/**
 * Đọc và ghi CÀI ĐẶT của module, theo từng không gian làm việc.
 *
 * ── VÌ SAO CÓ MỘT LỚP ĐỔI HÌNH GIỮA DATABASE VÀ GIAO DIỆN ────────────────────────────────
 * Bảng `app_settings` là các cột PHẲNG (`notify_assigned`, `notify_mentioned`…) vì cột tường minh
 * là hợp đồng mà `tsc` và migration kiểm được. Giao diện thì muốn một `Record<NotificationPrefId,
 * boolean>` để render một vòng lặp thay vì năm khối `<Switch>` chép tay.
 *
 * Hai hình dạng đó phục vụ hai mục đích khác nhau, và chỗ đúng để đổi giữa chúng là ĐÂY — một chỗ,
 * có tên, đọc được. Ép một bên chiều theo bên kia thì hoặc database thành một blob `Json` không
 * kiểm được, hoặc giao diện thành năm khối chép tay mà thêm một tuỳ chọn là sửa ba file.
 */

/**
 * Giá trị mặc định khi không gian làm việc CHƯA có dòng nào.
 *
 * ⚠ Trả về mặc định thay vì `null`, và đó là quyết định: một workspace vừa bật app phải mở được
 * trang Cài đặt ngay, không phải chờ ai đó bấm Lưu lần đầu. Cùng bộ mặc định với `@default(...)`
 * trong `prisma/schema.prisma` — hai chỗ, và chúng PHẢI khớp nhau (xem cảnh báo cuối file).
 */
const DEFAULT_SETTINGS: AppSettingsView = {
  defaultPriority: "medium",
  defaultPageSize: 20,
  autoAssignToMe: false,
  notifications: {
    assigned: true,
    "due-soon": true,
    "email-digest": true
  },
  digestFrequency: "daily",
  data: {
    "public-link": false,
    "activity-log": true
  },
  archiveAfter: "90d"
};

/**
 * ⚠ **`select` TƯỜNG MINH, VÀ NÓ KHÔNG PHẢI ĐỂ TỐI ƯU.**
 *
 * Prisma client mặc định `SELECT` **mọi cột vô hướng** của bảng. Nên chừng nào lời gọi này còn để
 * trống `select`, câu SQL nó sinh ra vẫn gọi tên bốn cột mà mã đã thôi dùng (`week_start`,
 * `notify_mentioned`, `notify_project_update`, `allow_attachment_download`) — và giây phút
 * migration bỏ chúng đi, MỌI bản deploy cũ còn đang chạy sẽ đổ ở truy vấn này với một lỗi cột
 * không tồn tại.
 *
 * Điều đó biến việc bỏ cột từ "mất dữ liệu không ai đọc" thành "không lùi lại được": lùi deploy là
 * trỏ về bản trước, mà bản trước lại đi hỏi những cột vừa biến mất. Prisma KHÔNG có `migrate down`,
 * nên đường lùi duy nhất còn lại sẽ là khôi phục từ sao lưu.
 *
 * Vì vậy `select` này phải có mặt **trọn một đợt phát hành TRƯỚC** migration bỏ cột, chứ không phải
 * cùng đợt. Và nó phải liệt kê ĐỦ mọi cột còn dùng — thiếu một cột thì `tsc` đỏ ngay ở phép đổi
 * hình bên dưới, nên đây là một danh sách tự canh chính nó.
 */
const SETTINGS_COLUMNS = {
  defaultPriority: true,
  defaultPageSize: true,
  autoAssignToMe: true,
  notifyAssigned: true,
  notifyDueSoon: true,
  notifyEmailDigest: true,
  digestFrequency: true,
  allowPublicLink: true,
  keepActivityLog: true,
  archiveAfter: true
} as const;

export async function getAppSettings(workspaceId: string): Promise<AppSettingsView> {
  const row = await prisma.appSetting.findUnique({ where: { workspaceId }, select: SETTINGS_COLUMNS });
  if (!row) return DEFAULT_SETTINGS;

  return {
    defaultPriority: row.defaultPriority as TaskPriority,
    defaultPageSize: row.defaultPageSize,
    autoAssignToMe: row.autoAssignToMe,
    notifications: {
      assigned: row.notifyAssigned,
      "due-soon": row.notifyDueSoon,
      "email-digest": row.notifyEmailDigest
    },
    digestFrequency: row.digestFrequency as AppSettingsView["digestFrequency"],
    data: {
      "public-link": row.allowPublicLink,
      "activity-log": row.keepActivityLog
    },
    archiveAfter: row.archiveAfter as AppSettingsView["archiveAfter"]
  };
}

/**
 * Ghi đè toàn bộ cài đặt.
 *
 * `upsert` chứ không `update`: workspace chưa có dòng nào là trạng thái BÌNH THƯỜNG (xem
 * `DEFAULT_SETTINGS`), nên `update` sẽ ném `RecordNotFound` ở đúng lần lưu đầu tiên của mỗi khách
 * hàng mới — một lỗi chỉ xuất hiện với người dùng mới, tức chỗ khó phát hiện nhất.
 *
 * Ghi ĐỦ MỌI TRƯỜNG, không ghi từng phần: giao diện gửi cả object, và một `PATCH` từng trường ở
 * đây sẽ phải trả lời câu "thiếu trường nghĩa là giữ nguyên hay đặt về mặc định" — một câu hỏi
 * không có câu trả lời đúng, chỉ có hai câu trả lời sai theo hai cách khác nhau.
 */
export async function saveAppSettings(workspaceId: string, settings: AppSettingsView): Promise<void> {
  const columns = {
    defaultPriority: settings.defaultPriority,
    defaultPageSize: settings.defaultPageSize,
    autoAssignToMe: settings.autoAssignToMe,
    notifyAssigned: settings.notifications.assigned,
    notifyDueSoon: settings.notifications["due-soon"],
    notifyEmailDigest: settings.notifications["email-digest"],
    digestFrequency: settings.digestFrequency,
    allowPublicLink: settings.data["public-link"],
    keepActivityLog: settings.data["activity-log"],
    archiveAfter: settings.archiveAfter
  };

  await prisma.appSetting.upsert({
    where: { workspaceId },
    create: { workspaceId, ...columns },
    update: columns,
    /*
     * ⚠ `select` Ở ĐÂY LÀ ĐỂ GIỚI HẠN `RETURNING`, KHÔNG PHẢI ĐỂ TỐI ƯU — VÀ THIẾU NÓ THÌ CẢ CÂU
     * CHUYỆN "BỎ CỘT SAU MỘT ĐỢT" Ở CUỐI FILE LÀ SAI.
     *
     * `create`/`update` chỉ nêu tên những cột ta thực sự ghi, nên INSERT và UPDATE đã sạch. Nhưng
     * `upsert` **trả về bản ghi**, và Prisma dựng `RETURNING` liệt kê **mọi cột vô hướng** của model
     * — kể cả bốn cột mồ côi. Nên nếu không giới hạn ở đây, câu lệnh GHI vẫn gọi tên chúng, và
     * `PUT /api/settings` sẽ đổ ngay sau migration bỏ cột dù đường ĐỌC đã được chặn.
     *
     * Chỉ giữ `workspaceId`: nơi gọi vứt kết quả đi (`Promise<void>`), và trả về ít nhất một cột là
     * cách nói "không cần gì cả" mà Prisma chấp nhận.
     */
    select: { workspaceId: true }
  });
}

/**
 * ⚠ HAI NƠI KHAI MẶC ĐỊNH, VÀ CHÚNG PHẢI KHỚP NHAU.
 *
 * `DEFAULT_SETTINGS` ở trên phục vụ ca "chưa có dòng nào"; `@default(...)` trong
 * `prisma/schema.prisma` phục vụ ca "có dòng nhưng thiếu cột" (một migration vừa thêm cột). Hai ca
 * khác nhau nên cần cả hai, nhưng lệch nhau thì một workspace mới và một workspace cũ sẽ có hành
 * vi khác nhau mà không ai đoán ra vì sao.
 *
 * Không có cách nào bắt máy kiểm điều này (Prisma không xuất giá trị mặc định ra TypeScript), nên
 * nó là một dòng ghi chú — và là lý do mọi thay đổi mặc định phải sửa ĐỦ HAI CHỖ trong cùng một
 * commit.
 */

/**
 * ⚠ **BỐN CỘT ĐANG MỒ CÔI TRONG LƯỢC ĐỒ, VÀ ĐÓ LÀ TRẠNG THÁI CÓ CHỦ ĐÍCH.**
 *
 * `week_start`, `notify_mentioned`, `notify_project_update` và `allow_attachment_download` vẫn còn
 * trong `prisma/schema.prisma` nhưng không còn được đọc hay ghi ở bất cứ đâu.
 *
 * ⚠ **BA CHỖ phải cùng im lặng về chúng, không phải hai** — thiếu chỗ thứ ba là chỗ dễ sót nhất:
 *   1. `SETTINGS_COLUMNS` giới hạn `SELECT` của đường đọc;
 *   2. `columns` giới hạn danh sách cột của INSERT và UPDATE;
 *   3. `select` trong chính lời gọi `upsert` giới hạn **`RETURNING`** — Prisma trả về bản ghi nên
 *      mặc định nó liệt kê MỌI cột vô hướng, và một câu GHI vẫn gọi tên cột đã bỏ thì vẫn đổ.
 *
 * **Đừng gộp việc bỏ cột vào cùng đợt này.** `prisma migrate deploy` chạy TRƯỚC khi mã mới lên, nên
 * luôn có một khoảng mã CŨ chạy trên lược đồ MỚI. Bỏ cột ngay bây giờ là bắt bản deploy trước —
 * bản chưa có ba giới hạn trên — đi hỏi những cột vừa biến mất.
 *
 * Trình tự đúng: đợt này lên production và ổn định → **rồi** mới sinh migration bỏ bốn cột.
 * Lúc đó nhớ xoá luôn `@default(...)` tương ứng, và đọc `DATABASE_URL` trước khi gõ lệnh: hồ sơ
 * RDS là database của CẢ ĐỘI.
 */
export { DEFAULT_SETTINGS };
