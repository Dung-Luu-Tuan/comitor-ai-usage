/**
 * Lọc, sắp xếp và phân trang cho bảng Công việc — hàm THUẦN, tầng 1.
 *
 * ── VÌ SAO NÓ KHÔNG NẰM TRONG FILE `"use client"` CỦA BẢNG ─────────────────────────────────
 * Đây là logic NGHIỆP VỤ đội lốt logic hiển thị. Nó quyết định người dùng NHÌN THẤY dòng nào —
 * cùng loại câu hỏi mà máy chủ sẽ phải trả lời lại y hệt khi bảng này đổi sang phân trang phía
 * server. Để nó nằm rải trong một component có state thì chỉ có đúng một cách kiểm: mở trình
 * duyệt, gõ vào ô tìm, nhìn bằng mắt. Cách đó không đi qua được những ca biên đắt nhất của module
 * (mảng lọc rỗng, trang vượt quá số trang, hai dòng bằng điểm khi sắp xếp), và cũng không chạy lại
 * ở CI.
 *
 * Ở tầng 1, cả năm cái bẫy ghi trong file này đều có một test khoá lại, và ngày nối backend thì
 * route handler gọi ĐÚNG những hàm này — không có bản thứ hai của quy tắc để lệch nhau.
 *
 * ⚠ Tầng này không biết một chữ tiếng Việt nào: nó nhận và trả `code`/`id`/số. Thứ tự nghiệp vụ
 * của `status`/`priority` cũng do nơi gọi khai (tham số `order` của `sortTasks`) chứ không nằm ở
 * đây — xem JSDoc của hàm đó.
 */

import type { TaskPriority, TaskStatus, TaskView } from "@/lib/contracts/task";

/**
 * Trạng thái của thanh bộ lọc trên bảng Công việc.
 *
 * Bốn trường mảng theo cùng một quy ước: **mảng rỗng = KHÔNG lọc theo trường đó**. Xem `matchesTask`
 * về lý do quy ước này phải được viết ra thay vì để người đọc tự đoán.
 */
export interface TaskFilter {
  search: string;
  statuses: readonly TaskStatus[];
  priorities: readonly TaskPriority[];
  projectIds: readonly string[];
  assigneeUserIds: readonly string[];
}

const NO_STATUSES: readonly TaskStatus[] = Object.freeze([]);
const NO_PRIORITIES: readonly TaskPriority[] = Object.freeze([]);
const NO_IDS: readonly string[] = Object.freeze([]);

/**
 * Bộ lọc rỗng — giá trị khởi tạo của thanh lọc, và cũng là thứ nút "Xoá bộ lọc" đặt lại.
 *
 * ⚠ ĐÓNG BĂNG, và điều đó không thừa. Đây là một hằng ở tầng MODULE, mà module trên máy chủ Node
 * sống qua NHIỀU request: một chỗ nào đó lỡ `filter.statuses.push(…)` lên chính đối tượng này thì
 * bộ lọc mặc định của người dùng tiếp theo đã có sẵn một trạng thái mà họ chưa hề chọn. TypeScript
 * chặn được đường đó lúc biên dịch (`readonly`), nhưng dữ liệu dựng từ JSON của query string thì
 * không đi qua cửa biên dịch nào cả.
 */
export const EMPTY_TASK_FILTER: TaskFilter = Object.freeze({
  search: "",
  statuses: NO_STATUSES,
  priorities: NO_PRIORITIES,
  projectIds: NO_IDS,
  assigneeUserIds: NO_IDS
});

/**
 * Chuẩn hoá chuỗi trước khi so khớp: cắt hai đầu, hạ chữ thường, gộp mọi cụm khoảng trắng thành
 * MỘT dấu cách.
 *
 * ⚠ `toLowerCase()` chứ KHÔNG phải `toLocaleLowerCase()`. Bản `locale` đọc ngôn ngữ mặc định của
 * runtime, và ở locale Thổ Nhĩ Kỳ `"I".toLocaleLowerCase()` cho ra `"ı"` (i không chấm) — chuỗi đó
 * không khớp một chữ `i` nào trong dữ liệu nữa. Bộ lọc khi ấy hỏng với đúng một nhóm người dùng,
 * trên đúng một cấu hình máy, và không bao giờ tái hiện được ở máy người đi sửa.
 *
 * Gộp khoảng trắng áp cho CẢ hai vế (chuỗi tìm và trường dữ liệu), nên `"báo   cáo"` khớp
 * `"Báo cáo"` theo cả hai chiều. `\s` của JS bao gồm cả khoảng trắng không ngắt (U+00A0) — thứ đi
 * kèm mỗi lần người dùng dán từ trình soạn thảo văn bản hay từ khung chat.
 */
function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Không còn điều kiện nào đang bật — bảng đang hiển thị toàn bộ dữ liệu. */
export function isEmptyFilter(filter: TaskFilter): boolean {
  return countActiveFilters(filter) === 0;
}

/**
 * Đếm số NHÓM bộ lọc đang bật (tối đa 5) — con số hiện trên nút "Bộ lọc".
 *
 * ⚠ Đếm NHÓM, không đếm giá trị. Chọn ba trạng thái là **một** nhóm đang bật, không phải ba: con số
 * trên nút phải khớp với số điều kiện người dùng cần gỡ để thấy lại bảng đầy đủ. Đếm giá trị thì
 * huy hiệu nhảy lên 3 trong khi bảng chỉ hẹp đi theo đúng một chiều, và người dùng đi tìm hai bộ
 * lọc không tồn tại.
 *
 * Chuỗi tìm chỉ tính là một nhóm khi nó còn nội dung SAU chuẩn hoá — gõ vài dấu cách rồi xoá chữ
 * đi mà nút vẫn báo "1" là nút đang nói dối.
 */
export function countActiveFilters(filter: TaskFilter): number {
  let count = 0;
  if (normalizeSearchText(filter.search) !== "") count += 1;
  if (filter.statuses.length > 0) count += 1;
  if (filter.priorities.length > 0) count += 1;
  if (filter.projectIds.length > 0) count += 1;
  if (filter.assigneeUserIds.length > 0) count += 1;
  return count;
}

/**
 * Một công việc có qua được bộ lọc hay không.
 *
 * ⚠ **MẢNG RỖNG NGHĨA LÀ "KHÔNG LỌC THEO TRƯỜNG NÀY", KHÔNG PHẢI "KHÔNG KHỚP GÌ CẢ".** Đây là
 * nhầm lẫn tốn kém nhất của cả module, vì nó không trông giống một lỗi: viết thẳng
 * `filter.statuses.includes(task.status)` thì mọi vị từ đều đúng về mặt logic, `tsc` xanh, Biome
 * xanh — và bảng đang đầy dữ liệu biến thành bảng RỖNG ngay giây người dùng mở thanh lọc lần đầu,
 * trước khi họ kịp chọn gì. Người dùng đọc cảnh đó là "mất hết dữ liệu", không phải "lọc hơi chặt".
 *
 * Các nhóm nối với nhau bằng VÀ (giao), giá trị trong cùng một nhóm nối bằng HOẶC (hợp) — đúng như
 * hình dạng một hàng ô đánh dấu gợi ra.
 *
 * Chuỗi tìm khớp KHÔNG phân biệt hoa thường và bỏ qua khoảng trắng thừa, trên bốn trường: `code`,
 * `title`, `projectName`, `assigneeName`. Cố ý KHÔNG bỏ dấu tiếng Việt: bỏ dấu thì `"má"` khớp cả
 * `"ma"` lẫn `"mà"`, và ở một bảng công việc thật, số dòng thừa đổ về nhiều hơn số dòng nó cứu.
 *
 * `assigneeName` là `null` khi việc chưa giao — trạng thái HỢP LỆ (xem `TaskView`), nên nó được coi
 * là chuỗi rỗng chứ không được ném lỗi. Và một việc chưa giao thì KHÔNG BAO GIỜ khớp bộ lọc theo
 * người phụ trách: muốn tìm việc chưa giao thì cần một bộ lọc riêng, không phải một id giả.
 */
export function matchesTask(task: TaskView, filter: TaskFilter): boolean {
  if (filter.statuses.length > 0 && !filter.statuses.includes(task.status)) return false;
  if (filter.priorities.length > 0 && !filter.priorities.includes(task.priority)) return false;
  if (filter.projectIds.length > 0 && !filter.projectIds.includes(task.projectId)) return false;

  if (filter.assigneeUserIds.length > 0) {
    const assignee = task.assigneeUserId;
    if (assignee === null || !filter.assigneeUserIds.includes(assignee)) return false;
  }

  const needle = normalizeSearchText(filter.search);
  if (needle === "") return true;

  const haystack = [task.code, task.title, task.projectName, task.assigneeName ?? ""];
  return haystack.some((field) => normalizeSearchText(field).includes(needle));
}

/** Lọc một danh sách. Luôn trả MẢNG MỚI, kể cả khi bộ lọc rỗng. */
export function filterTasks(tasks: readonly TaskView[], filter: TaskFilter): TaskView[] {
  return tasks.filter((task) => matchesTask(task, filter));
}

/** Cột có thể bấm để sắp xếp. Đúng bằng tập cột sắp xếp được của bảng — không nhiều hơn. */
export type TaskSortKey = "code" | "title" | "status" | "priority" | "dueDate" | "updatedAt";

export type SortDirection = "asc" | "desc";

/**
 * Thứ tự NGHIỆP VỤ của hai trường union, do nơi gọi khai.
 *
 * ⚠ Đây là lý do `sortTasks` có tham số thứ tư thay vì tự biết lấy. Sắp `status` theo bảng chữ cái
 * là vô nghĩa với người dùng: nó xếp "Chờ duyệt" trước "Đang làm" trước "Xong" thuần vì chữ C, Đ,
 * X — một trật tự không kể câu chuyện nào về quy trình. Mà thứ tự đúng lại KHÔNG suy được ở tầng
 * này: nhãn nằm ở `messages/*.json` và mỗi ngôn ngữ cho một trật tự chữ cái khác nhau, nên sắp
 * theo nhãn còn tệ hơn — cùng một bảng đổi thứ tự dòng khi người dùng đổi ngôn ngữ.
 *
 * Nơi gọi khai một lần thứ tự quy trình (`todo` → `in-progress` → … ) và mọi ngôn ngữ dùng chung.
 */
export interface TaskSortOrder {
  status: readonly TaskStatus[];
  priority: readonly TaskPriority[];
}

/**
 * Hạng của một giá trị trong thứ tự nghiệp vụ.
 *
 * ⚠ Giá trị KHÔNG có trong bảng thứ tự bị đẩy xuống CUỐI, không phải lên đầu. `indexOf` trả `-1`,
 * và `-1` là số nhỏ nhất — dùng thẳng thì một trạng thái mới thêm vào (mà ai đó quên khai vào bảng
 * thứ tự) tự động chiếm hàng đầu bảng, đúng chỗ dễ thấy nhất, mà không ai hiểu vì sao.
 */
function rankOf<T>(value: T, order: readonly T[]): number {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

/**
 * So hai mốc ISO bằng phép so CHUỖI.
 *
 * ⚠ Cố ý không `new Date(…)`. ISO 8601 chỉ-có-ngày (`YYYY-MM-DD`) được JS hiểu là mốc **UTC**, nên
 * ở múi giờ âm nó lùi một ngày — lỗi không lộ ra ở GMT+7 và chỉ xuất hiện sau khi deploy. Và với
 * chuỗi ISO có cùng độ dài, thứ tự từ điển ĐÚNG BẰNG thứ tự thời gian, nên phép so chuỗi vừa rẻ
 * hơn vừa không có múi giờ nào để hiểu sai.
 */
function compareIsoText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Bộ so sánh văn bản cho `code` và `title`.
 *
 * ⚠ Locale được GHIM, không để `undefined`. `localeCompare()` không tham số đọc locale MẶC ĐỊNH
 * của runtime — mà ở đây có hai runtime: Node lúc server render, trình duyệt lúc người dùng bấm
 * đổi cột. Hai locale khác nhau cho hai thứ tự khác nhau trên cùng một tập dữ liệu, và triệu chứng
 * là bảng "nhảy một nhịp" ngay sau hydrate, không kèm lỗi nào ở đâu cả.
 *
 * `numeric: true` để `CV-9` đứng TRƯỚC `CV-10`. So chuỗi thẳng thì `"CV-10" < "CV-9"` (ký tự `1`
 * nhỏ hơn `9`) — bảng đánh số việc theo một thứ tự mà không ai gọi là thứ tự.
 *
 * Và vì sao không dùng `<` cho `title`: `"Ă"` là U+0102, lớn hơn `"B"` (U+0042), nên so theo mã ký
 * tự dồn mọi tiêu đề bắt đầu bằng chữ có dấu xuống cuối bảng.
 *
 * Ngày nào cần sắp theo đúng ngôn ngữ người dùng thì truyền một comparator từ tầng trên xuống —
 * tầng 1 không được biết ngôn ngữ đang hiển thị là gì.
 */
const TEXT_COLLATOR = new Intl.Collator("vi", { numeric: true });

function compareByKey(a: TaskView, b: TaskView, key: TaskSortKey, order: TaskSortOrder): number {
  switch (key) {
    case "code":
      return TEXT_COLLATOR.compare(a.code, b.code);
    case "title":
      return TEXT_COLLATOR.compare(a.title, b.title);
    case "status":
      return rankOf(a.status, order.status) - rankOf(b.status, order.status);
    case "priority":
      return rankOf(a.priority, order.priority) - rankOf(b.priority, order.priority);
    case "dueDate":
      return compareIsoText(a.dueDate, b.dueDate);
    case "updatedAt":
      return compareIsoText(a.updatedAt, b.updatedAt);
  }
}

/**
 * Sắp xếp một danh sách. Trả MẢNG MỚI — mảng đầu vào không bị đụng tới.
 *
 * ⚠ Không sửa đầu vào là bắt buộc, không phải lịch sự. `Array.prototype.sort` sắp TẠI CHỖ, nên
 * `tasks.sort(…)` thẳng sẽ xáo luôn mảng mà React đang giữ trong state hoặc mảng mà tầng dữ liệu
 * vừa trả về — và ở React 19, sửa tại chỗ một mảng rồi `setState` cùng tham chiếu đó là cách chắc
 * chắn nhất để giao diện KHÔNG vẽ lại.
 *
 * ⚠ Sắp xếp ỔN ĐỊNH, và chiều `desc` được làm bằng cách ĐỔI DẤU kết quả so sánh chứ không phải
 * `.reverse()` mảng kết quả. Khác biệt lộ ra ở những dòng BẰNG ĐIỂM: đảo mảng thì mười việc cùng
 * trạng thái cũng đảo thứ tự theo, nên mỗi lần bấm đổi chiều là toàn bảng xáo lại và người dùng
 * mất dấu dòng họ đang nhìn. Đổi dấu thì các dòng bằng điểm giữ nguyên trật tự gốc ở cả hai chiều.
 * (`sort` của JS ổn định từ ES2019 — đó là tính chất hàm này DỰA VÀO, nên nó có test riêng.)
 */
export function sortTasks(
  tasks: readonly TaskView[],
  key: TaskSortKey,
  direction: SortDirection,
  order: TaskSortOrder
): TaskView[] {
  const sign = direction === "desc" ? -1 : 1;
  return [...tasks].sort((a, b) => sign * compareByKey(a, b, key, order));
}

/**
 * Cắt một trang. `page` đếm từ **1** (số người dùng nhìn thấy), không phải từ 0.
 *
 * ⚠ `page` được KẸP vào `[1, pageCount]`, và trang đã kẹp được TRẢ RA để nơi gọi ghi ngược lại vào
 * state. Đây là ca hỏng kinh điển của mọi bảng có lọc: người dùng đang ở trang 5, gõ thêm một chữ
 * vào ô tìm, kết quả còn 3 dòng — không kẹp thì `slice(80, 100)` trả mảng rỗng và họ nhìn thấy một
 * bảng TRỐNG. Không có thông báo lỗi nào; kết luận tự nhiên của người dùng là "tìm không ra", nên
 * họ xoá chữ vừa gõ và không bao giờ biết dữ liệu vẫn ở đó, cách một cú bấm "về trang 1".
 *
 * ⚠ `pageCount` tối thiểu là 1 kể cả khi danh sách rỗng. Một bảng rỗng vẫn phải nói "trang 1/1" —
 * "trang 1/0" là câu vô nghĩa, và nó còn làm mọi phép tính `page > pageCount` ở nơi gọi kẹp `page`
 * về 0, tức lệch một so với quy ước đếm-từ-1 của chính hàm này.
 *
 * `pageSize` không hợp lệ (0, âm, `NaN`) được quy về 1, để `pageCount` không bao giờ thành `NaN`
 * hay `Infinity` — hai giá trị đó lọt thẳng ra giao diện thành chuỗi "NaN" hoặc một thanh phân
 * trang vô tận.
 *
 * ⚠ Chỉ `NaN` mới bị quy về trang 1; `Infinity` thì KHÔNG. `NaN` là một con số hỏng (một phép tính
 * sai ở nơi gọi, hoặc `Number.parseInt` của một query string rỗng), còn `Infinity` là một con số
 * quá lớn — và quy tắc cho số quá lớn đã có sẵn ngay trên: kẹp về trang cuối. Bắt hai ca đó bằng
 * cùng một nhánh thì `page=999` nhảy về trang cuối còn `page=Infinity` nhảy về trang đầu, hai câu
 * trả lời ngược nhau cho cùng một ý định.
 */
export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number
): { items: T[]; page: number; pageCount: number } {
  const size = Number.isNaN(pageSize) ? 1 : Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const requested = Number.isNaN(page) ? 1 : Math.floor(page);
  const current = Math.min(Math.max(requested, 1), pageCount);
  const start = (current - 1) * size;

  return { items: items.slice(start, start + size), page: current, pageCount };
}
