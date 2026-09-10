import "server-only";
import { parseTaskDraft, type TaskDraftData } from "@/lib/core/task-draft";
import { prisma } from "@/lib/prisma";

/**
 * Đọc và ghi BẢN NHÁP của biểu mẫu tạo việc — một bản cho mỗi NGƯỜI, trong mỗi không gian làm việc.
 *
 * ── VÌ SAO NHÁP LÀ DỮ LIỆU CỦA MODULE, KHÔNG PHẢI CỦA ACCOUNT ─────────────────────────────
 * Vì nó là trạng thái dở dang của MỘT BIỂU MẪU trong module này. Comitor.Account trả lời "bạn là
 * ai"; nó không biết module này có biểu mẫu nào, và không nên biết.
 *
 * ── LỚP KIỂM Ở TẦNG ĐỌC, KHÔNG CHỈ Ở TẦNG GHI ─────────────────────────────────────────────
 * Cột `data` là `Json`, tức KHÔNG có hợp đồng nào ở tầng database. Kiểm khi ghi là chưa đủ: dòng
 * đang nằm sẵn trong bảng có thể do một phiên bản CŨ của biểu mẫu ghi, do sửa tay lúc gỡ lỗi, hoặc
 * do một migration nhập từ nơi khác — và những dòng đó sẽ không bao giờ được ghi lại. Vì vậy phép
 * kiểm nằm ở CẢ HAI chiều, và `parseTaskDraft` (`lib/core/task-draft.ts`, có test) là chốt chung.
 *
 * Cùng khuôn với `getPermissionMatrix`, nơi `applyPermissionLocks` cũng chạy ở tầng đọc và vì đúng
 * lý do đó.
 */

/** Bản nháp kèm mốc lưu — mốc là thứ giao diện cần để nói "lưu 5 phút trước". */
export interface StoredTaskDraft {
  data: TaskDraftData;
  /** ISO đầy đủ — hợp với `<RelativeTime>`. */
  savedAt: string;
}

/**
 * Bản nháp đang lưu, hoặc `null`.
 *
 * `null` ở đây gộp BA ca — chưa có dòng nào, dòng có nhưng không đọc được, và (khi ta còn ghi log)
 * một dòng vừa bị bỏ đi. Gộp là CỐ Ý: nơi gọi luôn muốn cùng một hành vi là mở biểu mẫu trống, và
 * phân biệt ba ca ở chữ ký hàm chỉ đẩy một quyết định không ai cần lên tầng trên.
 *
 * ⚠ Nháp hỏng thì GHI LOG rồi bỏ qua, tuyệt đối không ném lỗi: trang "Tạo công việc" phải mở được.
 * Ném lỗi ở đây nghĩa là một dòng dữ liệu hỏng khoá luôn cả chức năng, và người dùng không có cách
 * nào tự gỡ vì giao diện duy nhất xoá được nháp lại nằm sau đúng cái trang đang hỏng.
 */
export async function getTaskDraft(workspaceId: string, userId: string): Promise<StoredTaskDraft | null> {
  const row = await prisma.taskDraft.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } }
  });
  if (!row) return null;

  const data = parseTaskDraft(row.data);
  if (!data) {
    /*
     * Log cố định để còn grep được: đây là dòng DUY NHẤT cho biết có người vừa mất một bản nháp.
     * Không in `row.data` ra: nội dung nháp là dữ liệu của khách hàng (tiêu đề công việc, mô tả),
     * và log thường đi vào một hệ gom log mà nhiều người đọc được.
     */
    console.warn("[task-draft] BAN NHAP KHONG DOC DUOC, da bo qua", { workspaceId, userId });
    return null;
  }

  return { data, savedAt: row.savedAt.toISOString() };
}

/**
 * Ghi đè bản nháp. Trả về mốc lưu mới, hoặc `null` khi dữ liệu gửi lên không đọc được.
 *
 * ── `upsert`, KHÔNG `update` ───────────────────────────────────────────────────────────────
 * Chưa có nháp là trạng thái BÌNH THƯỜNG — nó là trạng thái của mọi người dùng ở lần bấm "Lưu
 * nháp" đầu tiên. `update` sẽ ném `RecordNotFound` đúng lúc đó, tức một lỗi chỉ xảy ra với người
 * dùng mới: chỗ khó phát hiện nhất.
 *
 * ── GHI ĐÈ CẢ BẢN, KHÔNG GHI TỪNG PHẦN ────────────────────────────────────────────────────
 * Biểu mẫu gửi trọn state của nó. Một phép ghi từng phần sẽ phải trả lời câu *"thiếu trường nghĩa
 * là giữ nguyên hay đặt về mặc định"* — câu không có câu trả lời đúng, chỉ có hai câu trả lời sai
 * theo hai cách khác nhau. Xoá một người theo dõi rồi lưu thì người đó phải BIẾN MẤT, và chỉ ghi
 * đè cả bản mới làm được điều đó.
 *
 * ⚠ Nhận `unknown` chứ không nhận `TaskDraftData`: nơi gọi gần nhất là một route handler, tức dữ
 * liệu đến từ ngoài. Nhận sẵn kiểu đã đúng là mời chỗ gọi ép kiểu để cho qua `tsc` — và phép ép đó
 * không kiểm gì cả.
 */
export async function saveTaskDraft(workspaceId: string, userId: string, input: unknown): Promise<string | null> {
  const data = parseTaskDraft(input);
  if (!data) return null;

  const row = await prisma.taskDraft.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    create: { workspaceId, userId, data },
    update: { data }
  });

  return row.savedAt.toISOString();
}

/**
 * Bỏ bản nháp. Không có nháp cũng KHÔNG lỗi (`deleteMany` thay vì `delete`).
 *
 * Gọi sau khi công việc đã được tạo thành công: giữ lại nháp lúc đó nghĩa là lần mở trang kế tiếp
 * biểu mẫu tự điền lại đúng công việc VỪA TẠO — và người dùng dễ bấm Gửi lần nữa, ra hai bản ghi
 * trùng nội dung. Đây là dọn dẹp đi kèm một thao tác khác nên nó không được phép làm hỏng thao tác
 * đó; nơi gọi nuốt lỗi, cùng lối với `recordActivity` và `sendMail`.
 */
export async function clearTaskDraft(workspaceId: string, userId: string): Promise<void> {
  await prisma.taskDraft.deleteMany({ where: { workspaceId, userId } });
}
