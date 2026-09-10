import { z } from "zod";
import type { RequestType, TaskPriority } from "@/lib/contracts/task";
import { isIsoDate } from "@/lib/core/iso-date";

/**
 * BẢN NHÁP của biểu mẫu tạo việc — hàm THUẦN, tầng 1 (xem `docs/kien-truc-ung-dung.md` §4).
 *
 * ── VÌ SAO CỘT `task_drafts.data` LÀ `Json`, VÀ VÌ SAO ĐIỀU ĐÓ BẮT BUỘC PHẢI CÓ FILE NÀY ────
 * Nháp không phải bản ghi nghiệp vụ: nó là ẢNH CHỤP trạng thái biểu mẫu, hợp lệ **một phần** theo
 * đúng nghĩa (tiêu đề còn dở, chưa chọn người phụ trách, ước lượng còn là chuỗi người dùng đang
 * gõ), và hình dạng của nó đổi theo mỗi lần biểu mẫu đổi. Ép nó thành cột thì mỗi lần thêm một
 * trường vào biểu mẫu là một migration cho một dữ liệu vốn dĩ **vứt đi được**.
 *
 * Cái giá phải trả tường minh: `Json` KHÔNG có hợp đồng nào ở tầng database. Bản ghi trong đó có
 * thể do một PHIÊN BẢN CŨ của biểu mẫu ghi, do sửa tay lúc gỡ lỗi, hoặc do một client khác. Vì vậy
 * phép đọc PHẢI tự kiểm — và chốt đó là `parseTaskDraft` dưới đây.
 *
 * ── NHÁP KHÔNG HỢP LỆ THÌ BỎ QUA, KHÔNG NÉM LỖI ────────────────────────────────────────────
 * Đây là quyết định quan trọng nhất của file. Một bản nháp hỏng KHÔNG được làm trắng trang "Tạo
 * công việc": người dùng đang muốn tạo một công việc MỚI, và thứ họ mất khi ta bỏ nháp đi là một
 * bản lưu tạm mà chính họ cũng không chắc còn cần. Đổi lại, ném lỗi ở đây nghĩa là **một dòng dữ
 * liệu hỏng khoá luôn một chức năng** — và người dùng không có cách nào tự gỡ, vì giao diện duy
 * nhất xoá được nháp lại nằm sau đúng cái trang đang hỏng.
 *
 * ── VÌ SAO `zod` ĐƯỢC PHÉP Ở TẦNG THUẦN ────────────────────────────────────────────────────
 * Nó là thư viện THUẦN: không framework, không `next/*`, không Prisma, không chuỗi hiển thị nào
 * của module. Nó chạy được ở cả trình duyệt lẫn máy chủ, và cả hai phía đều cần đúng một lược đồ
 * này — trình duyệt để không gửi rác lên, máy chủ vì phía kia không đáng tin.
 *
 * ⚠ Mọi chuỗi trong file này là chuỗi MÁY (giá trị enum, tên trường). `pnpm core:check` chặn ký tự
 * ngoài ASCII ở tầng này, nên KHÔNG đặt thông điệp lỗi tiếng Việt vào `zod`: câu chữ do giao diện
 * tra từ `messages/*.json`.
 */

/**
 * Giá trị hợp lệ, viết dưới dạng TUPLE hằng để `z.enum` sinh ra kiểu literal.
 *
 * ⚠ `satisfies` là sợi dây duy nhất nối hai danh sách này với hợp đồng ở `lib/contracts/task.ts`:
 * đổi tên hay bỏ một giá trị bên đó thì `tsc` báo đỏ ngay tại đây. Nó KHÔNG bắt được chiều ngược
 * lại (thêm một mức ưu tiên mới mà quên thêm vào đây) — chỗ đó là việc của người sửa, và là lý do
 * dòng này đứng cạnh nhau chứ không nằm ở hai file.
 *
 * Vì sao không `import { TASK_PRIORITIES }` từ `lib/catalog/`: tầng thuần không được biết tới
 * `@comitor/ui`, mà bảng khai đó mang tone màu của gói.
 */
export const TASK_PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const satisfies readonly TaskPriority[];

export const REQUEST_TYPE_VALUES = [
  "task",
  "incident",
  "improvement",
  "external"
] as const satisfies readonly RequestType[];

/**
 * Trần độ dài — KHÔNG phải luật nghiệp vụ, mà là cái chặn kích thước.
 *
 * Cột `Json` nhận bất cứ thứ gì, nên không có trần thì một client (hoặc một vòng lặp lỗi) ghi được
 * một bản nháp vài megabyte, và mỗi lần MỞ trang là một lần đọc + tuần tự hoá chừng ấy dữ liệu qua
 * ranh giới server → client. Trần ở đây rộng hơn hẳn mọi giá trị người dùng thật gõ ra, nên nó
 * không bao giờ chắn đường người dùng — nó chỉ chắn đường dữ liệu bất thường.
 */
const MAX_TITLE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 4000;
/** Đủ cho `cuid()` (25 ký tự) và cho id do Comitor.Account cấp (`u-anh`). */
const MAX_ID_LENGTH = 64;
const MAX_WATCHERS = 20;
const MAX_CHANNELS = 8;
/** Ước lượng giữ nguyên CHUỖI người dùng đang gõ, nên trần chỉ cần đủ cho một số có dấu thập phân. */
const MAX_ESTIMATE_TEXT_LENGTH = 12;

const idSchema = z.string().max(MAX_ID_LENGTH);

/**
 * Ước lượng hợp lệ của MỘT công việc, tính bằng PHÚT.
 *
 * ⚠ Đây là luật nghiệp vụ, và nó phải sống ở ĐÚNG MỘT chỗ: biểu mẫu dùng nó để báo lỗi ngay khi
 * người dùng gõ, route handler dùng nó vì phía kia không đáng tin. Hai bản sao lệch nhau thì hoặc
 * giao diện chặn thứ máy chủ vẫn nhận (người dùng bị chặn oan), hoặc giao diện cho qua thứ máy chủ
 * từ chối — mất công điền cả biểu mẫu rồi lỗi ở bước cuối.
 *
 * Trần 40 giờ không phải con số kỹ thuật: nó là câu *"việc lớn hơn một tuần làm việc thì nên tách
 * nhỏ"*. Đổi nó là đổi một quy ước làm việc, không phải nới một giới hạn.
 *
 * Đơn vị là PHÚT vì cột `estimate_minutes` là `Int` — xem `prisma/schema.prisma` về lý do không
 * dùng `Decimal` cho "số giờ".
 */
export const ESTIMATE_MIN_MINUTES = 60;
export const ESTIMATE_MAX_MINUTES = 40 * 60;

/**
 * Lược đồ của bản nháp.
 *
 * ── MỌI TRƯỜNG ĐỀU CÓ `.default()`, VÀ ĐÓ LÀ CHỦ Ý ─────────────────────────────────────────
 * Nhờ vậy một bản nháp ghi bởi PHIÊN BẢN CŨ của biểu mẫu (thiếu trường vừa được thêm) vẫn đọc được
 * — trường mới nhận giá trị mặc định. Nếu không, mỗi lần thêm một ô vào biểu mẫu là mọi bản nháp
 * đang có của mọi người dùng đồng loạt bị coi là hỏng.
 *
 * Ngược lại, SAI KIỂU thì vẫn hỏng cả bản (`title: 123`): đó không phải dữ liệu cũ mà là dữ liệu
 * không nói cùng một ngôn ngữ, và đoán ý nó là mở đường cho một giá trị vô nghĩa đi thẳng vào ô
 * nhập.
 *
 * Khoá lạ bị LOẠI BỎ (mặc định của `z.object`): một trường vừa bị gỡ khỏi biểu mẫu không được
 * sống sót trong nháp rồi bò ngược ra ngoài ở lần lưu sau.
 */
export const taskDraftSchema = z.object({
  title: z.string().max(MAX_TITLE_LENGTH).default(""),
  summary: z.string().max(MAX_SUMMARY_LENGTH).default(""),
  projectId: idSchema.nullable().default(null),
  /** `null` = chưa giao. Biểu mẫu ĐÒI người phụ trách, nhưng một bản NHÁP thì không. */
  assigneeUserId: idSchema.nullable().default(null),
  watcherUserIds: z.array(idSchema).max(MAX_WATCHERS).default([]),
  priority: z.enum(TASK_PRIORITY_VALUES).default("medium"),
  /**
   * ISO chỉ-có-ngày (`YYYY-MM-DD`), hoặc `null`.
   *
   * ⚠ Kiểm bằng `isIsoDate` chứ không bằng regex tại chỗ: hàm đó còn kiểm NGÀY CÓ THẬT
   * (`2026-02-30` khớp mọi regex nhưng không tồn tại), và một ngày không tồn tại trôi xuống
   * `Date.UTC` sẽ được "sửa" âm thầm thành một ngày khác hẳn.
   */
  dueDate: z.string().refine(isIsoDate).nullable().default(null),
  /**
   * Ước lượng giữ nguyên dạng CHUỖI người dùng gõ (`"7,5"`), không đổi sang số.
   *
   * Nháp là ảnh chụp Ô NHẬP, không phải giá trị nghiệp vụ: đổi sang số ở đây thì một chuỗi đang gõ
   * dở (`"1,"`) trở thành `NaN` hoặc `1`, và người dùng quay lại thấy con số mình không hề gõ. Phép
   * đổi sang PHÚT xảy ra đúng một lần, lúc gửi lên API.
   */
  estimateHours: z.string().max(MAX_ESTIMATE_TEXT_LENGTH).default(""),
  requestType: z.enum(REQUEST_TYPE_VALUES).default("task"),
  needsApproval: z.boolean().default(false),
  approvalFlowId: idSchema.nullable().default(null),
  notifyChannels: z.array(idSchema).max(MAX_CHANNELS).default([]),
  remindBeforeDue: z.boolean().default(false),
  syncWithCalendar: z.boolean().default(false)
});

/**
 * Hình dạng bản nháp SAU khi kiểm — cũng chính là hình dạng STATE của biểu mẫu.
 *
 * Một kiểu cho cả hai, cố ý: "lưu nháp" trở thành gửi thẳng state đi, và "khôi phục nháp" trở
 * thành gán thẳng vào state. Hai hình dạng gần-giống-nhau là chỗ để một trường bị quên ở đúng một
 * chiều, và chiều bị quên luôn là chiều ít người thử.
 */
export type TaskDraftData = z.infer<typeof taskDraftSchema>;

/**
 * Bản nháp TRỐNG — mọi mặc định của lược đồ, dựng một lần.
 *
 * Suy từ chính `taskDraftSchema` thay vì gõ lại một object: hai bản mặc định rời nhau thì biểu mẫu
 * trống và biểu mẫu vừa xoá nháp có thể khác nhau, và không có gì báo.
 */
export const EMPTY_TASK_DRAFT: TaskDraftData = taskDraftSchema.parse({});

/**
 * Giá trị thô (cột `Json`, thân request) → bản nháp, hoặc `null` khi không đọc được.
 *
 * Trả `null` chứ không ném: nơi gọi luôn muốn CÙNG một hành vi — bỏ qua nháp và mở biểu mẫu trống
 * — và một ngoại lệ ở đây chỉ tạo thêm một khối `try` ở mọi chỗ đọc. Xem ghi chú đầu file về lý do
 * bỏ qua là câu trả lời đúng.
 */
export function parseTaskDraft(value: unknown): TaskDraftData | null {
  const result = taskDraftSchema.safeParse(value);
  return result.success ? result.data : null;
}
