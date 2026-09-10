import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/account/session";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { ARCHIVE_OPTIONS, DIGEST_FREQUENCIES, PAGE_SIZE_OPTIONS } from "@/lib/catalog/settings";
import { TASK_PRIORITY_ORDER } from "@/lib/catalog/task";
import { ApiError } from "@/lib/core/api-error";
import { requirePermission } from "@/lib/permissions";
import { saveAppSettings } from "@/lib/settings";

/**
 * `PUT /api/settings` — ghi đè toàn bộ cài đặt của module cho không gian làm việc hiện tại.
 *
 * ── VÌ SAO KHÔNG CÓ `GET` ────────────────────────────────────────────────────────────────
 * Vì không ai cần nó. Trang Cài đặt là Server Component: nó đọc thẳng `getAppSettings()` qua Prisma,
 * không đi vòng qua HTTP của chính mình. Một `GET` ở đây sẽ là một cửa thứ hai vào cùng dữ liệu,
 * chậm hơn (thêm một vòng mạng) và chỉ tồn tại để trông cho "đủ bộ REST".
 *
 * ── VÌ SAO `PUT` CHỨ KHÔNG `PATCH` ───────────────────────────────────────────────────────
 * Vì biểu mẫu gửi CẢ object. Một `PATCH` từng trường sẽ phải trả lời câu *"thiếu trường nghĩa là
 * giữ nguyên hay đặt về mặc định"* — câu hỏi không có câu trả lời đúng, chỉ có hai câu trả lời sai
 * theo hai cách khác nhau. Xem thêm `saveAppSettings` trong `lib/settings.ts`.
 */

/**
 * ⚠ **NĂM KHOÁ THÔNG BÁO VÀ BA KHOÁ DỮ LIỆU VIẾT TƯỜNG MINH, KHÔNG SINH TỪ BẢNG KHAI.**
 *
 * Nhìn thì đây là chỗ nên `Object.fromEntries(NOTIFICATION_PREFS.map(…))` cho gọn. Nhưng bản sinh
 * động cho ra `Record<string, boolean>` — tức một lược đồ nhận MỌI khoá và không còn kiểm được gì.
 * Viết tay thì kiểu đầu ra của `z.infer` khớp chính xác `Record<NotificationPrefId, boolean>`, nên
 * ngày ai đó thêm một mục vào `NOTIFICATION_PREFS`, `saveAppSettings(...)` ở cuối file này ĐỎ ngay
 * vì thiếu khoá. Đó là toàn bộ giá trị của việc gõ tay tám dòng.
 *
 * Giá trị union thì ngược lại: chúng LẤY từ bảng khai (`WEEK_STARTS`, `DIGEST_FREQUENCIES`…), vì ở
 * đó bảng khai chính là tập hợp lệ, và chép lại nó là mở đường cho hai danh sách lệch nhau.
 */
const settingsSchema = z.object({
  defaultPriority: z.enum(TASK_PRIORITY_ORDER),
  /*
   * Cỡ trang phải nằm trong danh sách của gói. Thiếu phép kiểm này thì một client tự chế lưu được
   * `defaultPageSize: 10000`, và cái bảng nhận con số đó sẽ cố vẽ toàn bộ dữ liệu trong một trang.
   */
  defaultPageSize: z
    .number()
    .int()
    .refine((size) => PAGE_SIZE_OPTIONS.includes(size), "Unsupported page size."),
  autoAssignToMe: z.boolean(),
  notifications: z.object({
    assigned: z.boolean(),
    "due-soon": z.boolean(),
    "email-digest": z.boolean()
  }),
  digestFrequency: z.enum(DIGEST_FREQUENCIES),
  data: z.object({
    "public-link": z.boolean(),
    "activity-log": z.boolean()
  }),
  archiveAfter: z.enum(ARCHIVE_OPTIONS)
});

export const PUT = withApiErrors(async (request: NextRequest) => {
  const session = await requireApiSession();

  /*
   * CHỐT THẬT của phân quyền. Giao diện đã ẩn thanh lưu với người không có quyền, nhưng ẩn một nút
   * KHÔNG phải là phân quyền: `curl` không đọc giao diện. `requirePermission` đọc CÙNG bảng mà
   * trang `/settings/permissions` hiện ra — một bảng quyền thứ hai ở máy chủ thì sớm muộn nói khác
   * bảng người dùng nhìn thấy.
   */
  await requirePermission(session.workspace.id, session.role, "app.settings");

  const body: unknown = await request.json().catch(() => {
    throw ApiError.validation("Request body is not valid JSON.");
  });

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    /*
     * Chỉ ĐƯỜNG DẪN của trường sai đi ra ngoài, không kèm câu chữ của zod: thông điệp mặc định là
     * tiếng Anh cho lập trình viên, còn giao diện tra `errors.VALIDATION_ERROR` để có đúng ngôn ngữ
     * người đang xem.
     */
    throw ApiError.validation("Invalid settings payload.", {
      fields: parsed.error.issues.map((issue) => issue.path.join("."))
    });
  }

  await saveAppSettings(session.workspace.id, parsed.data);

  /*
   * Trả lại chính giá trị vừa ghi. Khác `/api/permissions` (nơi máy chủ ĐỌC LẠI vì `applyPermission
   * Locks` có thể sửa ô), ở đây `saveAppSettings` ghi nguyên vẹn từng cột nên một lần đọc lại chỉ
   * là một truy vấn nữa cho cùng một kết quả.
   */
  return apiOk(parsed.data);
});
