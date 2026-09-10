import { z } from "zod";
import { isIsoDate } from "./iso-date";
import { ESTIMATE_MAX_MINUTES, ESTIMATE_MIN_MINUTES, REQUEST_TYPE_VALUES, TASK_PRIORITY_VALUES } from "./task-draft";

/**
 * Giới hạn độ dài của hai ô chữ tự do.
 *
 * ⚠ Xuất ra hằng vì GIAO DIỆN cũng cần đúng hai con số này: ô sửa tại chỗ ở trang chi tiết truyền
 * chúng vào `maxLength` để chặn ngay lúc gõ. Chép tay ở hai phía là để chúng lệch, và chỗ lệch có
 * hình dạng khó chịu nhất — trình duyệt cho gõ thoải mái rồi máy chủ mới từ chối sau khi người
 * dùng đã viết xong. Cùng lý do với `MAX_ATTACHMENT_BYTES` ở `lib/core/attachment.ts`.
 */
export const TASK_TITLE_MAX_LENGTH = 200;
export const TASK_SUMMARY_MAX_LENGTH = 4000;

/**
 * Hợp đồng dữ liệu của lệnh TẠO CÔNG VIỆC — hình dạng, không phải luật nghiệp vụ.
 *
 * ── VÌ SAO NẰM Ở TẦNG 1 CHỨ KHÔNG TRONG `route.ts` ───────────────────────────────────────
 * Vì nó có **hai** người dùng, và cả hai đều không phải route handler:
 *
 *   · `app/api/tasks/route.ts` (rìa B) parse thân request bằng nó — đó là chỗ dữ liệu ngoài đi vào;
 *   · `lib/tasks.ts` (tầng D) khai kiểu tham số của `createTask()` bằng `CreateTaskInput`.
 *
 * Để lược đồ trong `route.ts` thì mũi tên phụ thuộc chỉ SAI CHIỀU: tầng dữ liệu phải import từ
 * một file route để biết kiểu của chính tham số mình nhận. Ở tầng 1 thì cả hai cùng nhìn xuống,
 * và `lib/core/task-draft.ts` — lược đồ của BẢN NHÁP cùng biểu mẫu đó — đã ở sẵn đây.
 *
 * ⚠ **Không `.default()` ở đây, khác hẳn `taskDraftSchema`.** Bản nháp là ảnh chụp một biểu mẫu
 * đang gõ dở nên hợp lệ một phần là đúng nghĩa của nó; còn đây là một lệnh GHI. Thiếu trường nghĩa
 * là chỗ gọi đang nói một hợp đồng khác, và đoán hộ nó là ghi vào database một giá trị chưa ai chọn.
 *
 * ⚠ File này chỉ nói **hình dạng**. "Dự án còn mở không", "người phụ trách còn trong workspace
 * không", "workspace này có được chuyển việc ra ngoài không" đều cần database hoặc cài đặt, nên
 * chúng thuộc `lib/tasks.ts`. Ranh giới đó là lý do tầng 1 test được mà không cần mock.
 */
export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(TASK_TITLE_MAX_LENGTH),
  summary: z.string().max(TASK_SUMMARY_MAX_LENGTH),
  projectId: z.string().min(1).max(64),
  /**
   * `null` = chưa giao, và đó là trạng thái HỢP LỆ ở tầng dữ liệu (cột `assignee_user_id` nullable).
   *
   * Biểu mẫu `/tasks/new` thì ĐÒI người phụ trách — nhưng đó là luật của MỘT màn hình, không phải
   * của tài nguyên: một lần nhập liệu hàng loạt, hay một việc tạo từ email đến, hoàn toàn có thể
   * chưa có chủ. Ép ở đây là khoá luôn những đường đó vì một quy ước của một biểu mẫu.
   */
  assigneeUserId: z.string().min(1).max(64).nullable(),
  watcherUserIds: z.array(z.string().min(1).max(64)).max(20),
  priority: z.enum(TASK_PRIORITY_VALUES),
  dueDate: z.string().refine(isIsoDate),
  estimateMinutes: z.number().int().min(ESTIMATE_MIN_MINUTES).max(ESTIMATE_MAX_MINUTES),
  requestType: z.enum(REQUEST_TYPE_VALUES),
  needsApproval: z.boolean(),
  approvalFlowId: z.string().max(64).nullable(),
  /*
   * `.min(1)` — biểu mẫu đã đòi ít nhất một kênh (`errorChannelsRequired`), nhưng lược đồ thì
   * chưa, nên một lời gọi API trần tạo được việc với danh sách RỖNG: không thông báo, không thư,
   * không gì cả, và không ai biết. Từ khi `notifyChannels` thật sự gác việc gửi
   * (`lib/core/notify-channels.ts`), khoảng lệch đó thành một ca im lặng chứ không còn vô hại.
   * Lược đồ này là thứ CẢ HAI phía dùng chung — để biểu mẫu là chốt duy nhất thì nó không phải chốt.
   */
  notifyChannels: z.array(z.string().max(64)).min(1).max(8),
  remindBeforeDue: z.boolean(),
  syncWithCalendar: z.boolean()
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Hai TỪ VỰNG hợp lệ của biểu mẫu tạo việc: luồng duyệt, và kênh báo.
 *
 * ── VÌ SAO Ở TẦNG 1 CHỨ KHÔNG Ở `lib/catalog/` ───────────────────────────────────────────
 * Chúng từng nằm ở `lib/catalog/settings.ts`, và chỗ đó SAI theo một cách chỉ lộ ra khi có người
 * gọi nghiệp vụ từ ngoài một request: `lib/catalog/settings.ts` import `DEFAULT_PAGE_SIZE_OPTIONS`
 * từ `@comitor/ui`, nên `lib/tasks.ts` import nó là kéo cả gói giao diện — và cả React — vào tầng
 * dữ liệu. `next build` không phàn nàn (nó gói theo route), nhưng `tsx` thì nổ ngay:
 *
 *     SyntaxError: The requested module 'react' does not provide an export named 'useLayoutEffect'
 *
 * Tức `createTask()` không gọi được từ `pnpm seed`, từ một job nền, hay từ một script — đúng ba
 * đường mà việc tách nghiệp vụ ra khỏi `route.ts` sinh ra để phục vụ.
 *
 * Và về bản chất chúng thuộc về đây: đây là TẬP GIÁ TRỊ HỢP LỆ, không phải hằng giao diện. Hai
 * người anh em của chúng — `TASK_PRIORITY_VALUES` và `REQUEST_TYPE_VALUES` — đã ở `task-draft.ts`
 * từ đầu, và cũng được cả biểu mẫu lẫn máy chủ dùng chung y hệt.
 */
/**
 * Quy trình phê duyệt — chỉ dùng khi công việc bật cờ "cần phê duyệt".
 *
 * ⚠ Đây là bảng khai TĨNH ở starter, và ở một module thật thì nó gần như chắc chắn là DỮ LIỆU
 * (một bảng `approval_flows` mà quản trị viên tự dựng). Giữ nó ở đây là quyết định của bản mẫu, và
 * chỗ đổi khi cần là: thêm model vào `prisma/schema.prisma`, đọc ở `page.tsx`, truyền xuống prop.
 * Giao diện không phải sửa — biểu mẫu đã nhận danh sách này qua prop chứ không `import` nó.
 */
export const APPROVAL_FLOWS: readonly string[] = ["team-lead", "two-level", "product-board"];

/** Kênh báo cho người phụ trách và người theo dõi khi công việc được tạo. */
export const NOTIFY_CHANNELS: readonly string[] = ["in-app", "email", "chat", "sms"];

/**
 * Lệnh SỬA một công việc — tập con của lệnh tạo, và mọi trường đều tuỳ chọn.
 *
 * ── VÌ SAO KHÔNG PHẢI `createTaskSchema.partial()` ───────────────────────────────────────
 * Vì hai lệnh không có cùng tập trường, và `.partial()` che mất chỗ khác nhau:
 *
 *   · `code` KHÔNG sửa được — nó đã đi vào email, vào nhật ký, vào câu người ta nói với nhau
 *     ("CV-014 xong chưa"). Đổi nó là làm mọi tham chiếu ngoài hệ thống thành sai.
 *   · `status` CHỈ có ở đây — lệnh tạo cố ý không nhận nó (việc mới luôn là `todo`), còn lệnh sửa
 *     thì đó chính là trường được đổi nhiều nhất.
 *   · `watcherUserIds` cố ý CHƯA có ở đây: sửa danh sách người theo dõi là một lệnh riêng (thêm /
 *     bớt từng người), không phải một lần ghi đè cả mảng — ghi đè thì hai người sửa đồng thời sẽ
 *     xoá lựa chọn của nhau mà không ai biết.
 *
 * ⚠ `overdue` KHÔNG nằm trong tập nhận được, dù nó là một `TaskStatus` hợp lệ: nó được SUY RA lúc
 * đọc từ `dueDate` so với hôm nay, không bao giờ được lưu. Nhận nó ở đây là mở một đường ghi vào
 * database một trạng thái mà lần đọc kế tiếp sẽ tính lại và ghi đè.
 */
export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(TASK_TITLE_MAX_LENGTH),
    summary: z.string().max(TASK_SUMMARY_MAX_LENGTH),
    projectId: z.string().min(1).max(64),
    assigneeUserId: z.string().min(1).max(64).nullable(),
    status: z.enum(["todo", "in-progress", "in-review", "done"]),
    priority: z.enum(TASK_PRIORITY_VALUES),
    dueDate: z.string().refine(isIsoDate),
    estimateMinutes: z.number().int().min(ESTIMATE_MIN_MINUTES).max(ESTIMATE_MAX_MINUTES)
  })
  .partial()
  /*
   * Một `PATCH` rỗng là một lệnh không nói gì. Chấp nhận nó thì nó vẫn ghi `updatedAt`, vẫn sinh
   * một dòng nhật ký "đã cập nhật", và người đọc nhật ký đi tìm xem cái gì đã đổi — không có gì cả.
   */
  .refine((value) => Object.keys(value).length > 0);

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
