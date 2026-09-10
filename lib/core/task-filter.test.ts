import { describe, expect, it } from "vitest";
import type { TaskView } from "@/lib/contracts/task";
import {
  countActiveFilters,
  EMPTY_TASK_FILTER,
  filterTasks,
  isEmptyFilter,
  matchesTask,
  paginate,
  sortTasks,
  type TaskFilter,
  type TaskSortOrder
} from "./task-filter";

/** Thứ tự nghiệp vụ — đúng thứ mà giao diện sẽ truyền xuống. */
const ORDER: TaskSortOrder = {
  status: ["todo", "in-progress", "in-review", "done", "overdue"],
  priority: ["urgent", "high", "medium", "low"]
};

const BASE_TASK: TaskView = {
  id: "t-1",
  code: "CV-001",
  title: "Chuẩn bị báo cáo quý",
  summary: "",
  projectId: "p-1",
  projectName: "Nội thất Mỹ Đình",
  assigneeUserId: "u-1",
  assigneeUnknown: false,
  assigneeName: "Lê Minh",
  assigneeAvatarUrl: null,
  status: "todo",
  priority: "medium",
  dueDate: "2026-09-10",
  updatedAt: "2026-08-30T09:12:00.000Z",
  estimateMinutes: 60,
  attachmentUrl: null,
  attachmentName: null
};

function makeTask(overrides: Partial<TaskView>): TaskView {
  return { ...BASE_TASK, ...overrides };
}

function makeFilter(overrides: Partial<TaskFilter>): TaskFilter {
  return { ...EMPTY_TASK_FILTER, ...overrides };
}

describe("EMPTY_TASK_FILTER", () => {
  it("mọi trường đều rỗng", () => {
    expect(EMPTY_TASK_FILTER.search).toBe("");
    expect(EMPTY_TASK_FILTER.statuses).toEqual([]);
    expect(EMPTY_TASK_FILTER.priorities).toEqual([]);
    expect(EMPTY_TASK_FILTER.projectIds).toEqual([]);
    expect(EMPTY_TASK_FILTER.assigneeUserIds).toEqual([]);
  });

  /**
   * ⚠ Hằng ở tầng module sống qua nhiều request trên máy chủ Node. Nếu nó sửa được thì bộ lọc mặc
   * định của người dùng sau đã mang sẵn lựa chọn của người dùng trước.
   */
  it("đóng băng cả đối tượng lẫn từng mảng con", () => {
    expect(Object.isFrozen(EMPTY_TASK_FILTER)).toBe(true);
    expect(Object.isFrozen(EMPTY_TASK_FILTER.statuses)).toBe(true);
    expect(Object.isFrozen(EMPTY_TASK_FILTER.priorities)).toBe(true);
    expect(Object.isFrozen(EMPTY_TASK_FILTER.projectIds)).toBe(true);
    expect(Object.isFrozen(EMPTY_TASK_FILTER.assigneeUserIds)).toBe(true);
  });
});

describe("isEmptyFilter / countActiveFilters", () => {
  it("bộ lọc rỗng: không nhóm nào bật", () => {
    expect(isEmptyFilter(EMPTY_TASK_FILTER)).toBe(true);
    expect(countActiveFilters(EMPTY_TASK_FILTER)).toBe(0);
  });

  it("đếm NHÓM chứ không đếm giá trị — ba trạng thái vẫn là một nhóm", () => {
    const filter = makeFilter({ statuses: ["todo", "in-progress", "done"] });
    expect(countActiveFilters(filter)).toBe(1);
    expect(isEmptyFilter(filter)).toBe(false);
  });

  it("bật cả năm nhóm thì đếm được đúng năm", () => {
    const filter: TaskFilter = {
      search: "bao cao",
      statuses: ["todo"],
      priorities: ["high"],
      projectIds: ["p-1"],
      assigneeUserIds: ["u-1"]
    };
    expect(countActiveFilters(filter)).toBe(5);
  });

  /** Gõ vài dấu cách rồi xoá chữ đi mà huy hiệu vẫn báo "1" là huy hiệu đang nói dối. */
  it("chuỗi tìm chỉ có khoảng trắng KHÔNG tính là một nhóm", () => {
    const filter = makeFilter({ search: "   \t \n " });
    expect(countActiveFilters(filter)).toBe(0);
    expect(isEmptyFilter(filter)).toBe(true);
  });

  /**
   * Tính chất bắt buộc: hai hàm phải nói cùng một câu chuyện. Lệch nhau thì nút "Xoá bộ lọc" hiện
   * ra trong khi huy hiệu báo 0 — hoặc ngược lại.
   */
  it("isEmptyFilter luôn bằng (countActiveFilters === 0)", () => {
    const samples: TaskFilter[] = [
      EMPTY_TASK_FILTER,
      makeFilter({ search: " " }),
      makeFilter({ search: "a" }),
      makeFilter({ statuses: ["done"] }),
      makeFilter({ priorities: ["low"], projectIds: ["p-2"] }),
      makeFilter({ assigneeUserIds: ["u-9"] })
    ];
    for (const filter of samples) {
      expect(isEmptyFilter(filter)).toBe(countActiveFilters(filter) === 0);
    }
  });
});

describe("matchesTask", () => {
  /**
   * ⚠ Cái bẫy đắt nhất của cả module. Viết `filter.statuses.includes(task.status)` mà không kiểm
   * độ dài thì bảng đang đầy dữ liệu thành bảng RỖNG ngay giây người dùng mở thanh lọc lần đầu.
   */
  it("mảng rỗng nghĩa là KHÔNG lọc, không phải không khớp gì cả", () => {
    expect(matchesTask(BASE_TASK, EMPTY_TASK_FILTER)).toBe(true);
    expect(matchesTask(makeTask({ status: "overdue", priority: "urgent" }), EMPTY_TASK_FILTER)).toBe(true);
  });

  it("lọc theo trạng thái: khớp thì nhận, không khớp thì loại", () => {
    expect(matchesTask(BASE_TASK, makeFilter({ statuses: ["todo"] }))).toBe(true);
    expect(matchesTask(BASE_TASK, makeFilter({ statuses: ["done"] }))).toBe(false);
  });

  it("nhiều giá trị trong CÙNG một nhóm nối bằng HOẶC", () => {
    const filter = makeFilter({ statuses: ["done", "todo"] });
    expect(matchesTask(BASE_TASK, filter)).toBe(true);
  });

  it("các nhóm KHÁC nhau nối bằng VÀ", () => {
    const filter = makeFilter({ statuses: ["todo"], priorities: ["urgent"] });
    expect(matchesTask(BASE_TASK, filter)).toBe(false);
    expect(matchesTask(makeTask({ priority: "urgent" }), filter)).toBe(true);
  });

  it("lọc theo dự án và theo người phụ trách", () => {
    expect(matchesTask(BASE_TASK, makeFilter({ projectIds: ["p-1"] }))).toBe(true);
    expect(matchesTask(BASE_TASK, makeFilter({ projectIds: ["p-2"] }))).toBe(false);
    expect(matchesTask(BASE_TASK, makeFilter({ assigneeUserIds: ["u-1"] }))).toBe(true);
    expect(matchesTask(BASE_TASK, makeFilter({ assigneeUserIds: ["u-2"] }))).toBe(false);
  });

  /** Việc chưa giao là trạng thái HỢP LỆ — không được ném lỗi, và cũng không được khớp bừa. */
  it("việc chưa giao không khớp bộ lọc theo người phụ trách", () => {
    const unassigned = makeTask({ assigneeUserId: null, assigneeName: null });
    expect(matchesTask(unassigned, makeFilter({ assigneeUserIds: ["u-1"] }))).toBe(false);
    expect(matchesTask(unassigned, EMPTY_TASK_FILTER)).toBe(true);
  });

  it("tìm không phân biệt hoa thường", () => {
    expect(matchesTask(BASE_TASK, makeFilter({ search: "BÁO CÁO" }))).toBe(true);
    expect(matchesTask(BASE_TASK, makeFilter({ search: "báo cáo" }))).toBe(true);
  });

  it("khoảng trắng thừa ở CHUỖI TÌM bị bỏ qua", () => {
    expect(matchesTask(BASE_TASK, makeFilter({ search: "   báo    cáo  " }))).toBe(true);
  });

  it("khoảng trắng thừa ở DỮ LIỆU cũng bị bỏ qua", () => {
    const messy = makeTask({ title: "Chuẩn bị   báo  cáo quý" });
    expect(matchesTask(messy, makeFilter({ search: "báo cáo" }))).toBe(true);
  });

  it("tìm được trên cả code, tiêu đề, tên dự án và tên người phụ trách", () => {
    expect(matchesTask(BASE_TASK, makeFilter({ search: "cv-001" }))).toBe(true);
    expect(matchesTask(BASE_TASK, makeFilter({ search: "quý" }))).toBe(true);
    expect(matchesTask(BASE_TASK, makeFilter({ search: "mỹ đình" }))).toBe(true);
    expect(matchesTask(BASE_TASK, makeFilter({ search: "lê minh" }))).toBe(true);
    expect(matchesTask(BASE_TASK, makeFilter({ search: "không có trong dữ liệu" }))).toBe(false);
  });

  /** `summary` CỐ Ý không nằm trong tập tìm kiếm — nó dài, và nó kéo về hàng loạt dòng nhiễu. */
  it("không tìm trong summary", () => {
    const withSummary = makeTask({ summary: "một chữ rất riêng: zebracode" });
    expect(matchesTask(withSummary, makeFilter({ search: "zebracode" }))).toBe(false);
  });

  it("assigneeName null không làm hàm ném lỗi khi đang tìm", () => {
    const unassigned = makeTask({ assigneeUserId: null, assigneeName: null });
    expect(matchesTask(unassigned, makeFilter({ search: "báo cáo" }))).toBe(true);
    expect(matchesTask(unassigned, makeFilter({ search: "lê minh" }))).toBe(false);
  });

  it("chuỗi tìm chỉ có khoảng trắng không lọc gì cả", () => {
    expect(matchesTask(BASE_TASK, makeFilter({ search: "    " }))).toBe(true);
  });
});

describe("filterTasks", () => {
  const tasks: readonly TaskView[] = [
    makeTask({ id: "t-1", code: "CV-001", status: "todo", projectId: "p-1" }),
    makeTask({ id: "t-2", code: "CV-002", status: "done", projectId: "p-1" }),
    makeTask({ id: "t-3", code: "CV-003", status: "todo", projectId: "p-2" })
  ];

  it("danh sách rỗng cho kết quả rỗng", () => {
    expect(filterTasks([], makeFilter({ statuses: ["todo"] }))).toEqual([]);
  });

  it("bộ lọc rỗng giữ nguyên mọi dòng, theo đúng thứ tự", () => {
    expect(filterTasks(tasks, EMPTY_TASK_FILTER).map((task) => task.id)).toEqual(["t-1", "t-2", "t-3"]);
  });

  it("giao của hai nhóm", () => {
    const result = filterTasks(tasks, makeFilter({ statuses: ["todo"], projectIds: ["p-2"] }));
    expect(result.map((task) => task.id)).toEqual(["t-3"]);
  });

  it("luôn trả mảng MỚI, kể cả khi không loại dòng nào", () => {
    const result = filterTasks(tasks, EMPTY_TASK_FILTER);
    expect(result).not.toBe(tasks);
  });

  it("không sửa mảng đầu vào", () => {
    const input = [...tasks];
    const snapshot = [...tasks];
    filterTasks(input, makeFilter({ statuses: ["todo"] }));
    expect(input).toEqual(snapshot);
  });
});

describe("sortTasks", () => {
  /**
   * ⚠ Lý do `order` là tham số. Theo bảng chữ cái mã máy thì `done` < `in-progress` < `todo`; theo
   * quy trình thì ngược hẳn lại. Người dùng đọc bảng theo quy trình.
   */
  it("sắp status theo thứ tự NGHIỆP VỤ, không theo bảng chữ cái", () => {
    const tasks = [
      makeTask({ id: "a", status: "done" }),
      makeTask({ id: "b", status: "todo" }),
      makeTask({ id: "c", status: "in-review" })
    ];
    expect(sortTasks(tasks, "status", "asc", ORDER).map((task) => task.id)).toEqual(["b", "c", "a"]);
  });

  it("sắp priority theo thứ tự nghiệp vụ (urgent trước low)", () => {
    const tasks = [
      makeTask({ id: "a", priority: "low" }),
      makeTask({ id: "b", priority: "urgent" }),
      makeTask({ id: "c", priority: "medium" })
    ];
    expect(sortTasks(tasks, "priority", "asc", ORDER).map((task) => task.id)).toEqual(["b", "c", "a"]);
  });

  /** Giá trị lạ (quên khai vào bảng thứ tự) phải rơi xuống CUỐI, không chiếm hàng đầu bảng. */
  it("giá trị không có trong bảng thứ tự bị đẩy xuống cuối", () => {
    const partialOrder: TaskSortOrder = { status: ["todo", "in-progress"], priority: ORDER.priority };
    const tasks = [
      makeTask({ id: "a", status: "done" }),
      makeTask({ id: "b", status: "todo" }),
      makeTask({ id: "c", status: "in-progress" })
    ];
    expect(sortTasks(tasks, "status", "asc", partialOrder).map((task) => task.id)).toEqual(["b", "c", "a"]);
  });

  it("chiều desc đảo thứ tự", () => {
    const tasks = [
      makeTask({ id: "a", status: "done" }),
      makeTask({ id: "b", status: "todo" }),
      makeTask({ id: "c", status: "in-review" })
    ];
    expect(sortTasks(tasks, "status", "desc", ORDER).map((task) => task.id)).toEqual(["a", "c", "b"]);
  });

  /**
   * ⚠ Tính chất mà cả hàm dựa vào: `sort` của JS ổn định từ ES2019. Và vì `desc` làm bằng cách đổi
   * DẤU chứ không `.reverse()`, các dòng bằng điểm giữ nguyên trật tự gốc ở CẢ HAI chiều — bấm đổi
   * chiều không được xáo lại những dòng vốn ngang nhau.
   */
  it("ổn định: dòng bằng điểm giữ nguyên trật tự gốc ở cả hai chiều", () => {
    const tasks = [
      makeTask({ id: "a", status: "todo" }),
      makeTask({ id: "b", status: "todo" }),
      makeTask({ id: "c", status: "todo" }),
      makeTask({ id: "z", status: "done" })
    ];
    expect(sortTasks(tasks, "status", "asc", ORDER).map((task) => task.id)).toEqual(["a", "b", "c", "z"]);
    expect(sortTasks(tasks, "status", "desc", ORDER).map((task) => task.id)).toEqual(["z", "a", "b", "c"]);
  });

  /** So chuỗi thẳng cho `"CV-10" < "CV-9"` — thứ tự mà không ai gọi là thứ tự. */
  it("mã việc sắp theo SỐ, không theo ký tự", () => {
    const tasks = [
      makeTask({ id: "a", code: "CV-10" }),
      makeTask({ id: "b", code: "CV-9" }),
      makeTask({ id: "c", code: "CV-100" })
    ];
    expect(sortTasks(tasks, "code", "asc", ORDER).map((task) => task.id)).toEqual(["b", "a", "c"]);
  });

  /** `"Ă"` (U+0102) lớn hơn `"B"` (U+0042): so theo mã ký tự dồn chữ có dấu xuống cuối bảng. */
  it("tiêu đề sắp theo đối chiếu ngôn ngữ, không theo mã ký tự", () => {
    const tasks = [makeTask({ id: "a", title: "Bàn giao hồ sơ" }), makeTask({ id: "b", title: "Ăn khớp số liệu" })];
    expect(sortTasks(tasks, "title", "asc", ORDER).map((task) => task.id)).toEqual(["b", "a"]);
  });

  it("sắp theo hạn và theo lần cập nhật gần nhất", () => {
    const tasks = [
      makeTask({ id: "a", dueDate: "2026-09-10", updatedAt: "2026-08-30T09:12:00.000Z" }),
      makeTask({ id: "b", dueDate: "2026-01-05", updatedAt: "2026-08-31T23:59:00.000Z" }),
      makeTask({ id: "c", dueDate: "2026-01-15", updatedAt: "2026-08-29T00:00:00.000Z" })
    ];
    expect(sortTasks(tasks, "dueDate", "asc", ORDER).map((task) => task.id)).toEqual(["b", "c", "a"]);
    expect(sortTasks(tasks, "updatedAt", "desc", ORDER).map((task) => task.id)).toEqual(["b", "a", "c"]);
  });

  it("danh sách rỗng vẫn chạy", () => {
    expect(sortTasks([], "code", "asc", ORDER)).toEqual([]);
  });

  /**
   * ⚠ `Array.prototype.sort` sắp TẠI CHỖ. Xáo nhầm mảng trong state của React rồi `setState` cùng
   * tham chiếu là cách chắc chắn nhất để giao diện không vẽ lại.
   */
  it("không sửa mảng đầu vào, và trả mảng mới", () => {
    const input = [
      makeTask({ id: "a", code: "CV-030" }),
      makeTask({ id: "b", code: "CV-010" }),
      makeTask({ id: "c", code: "CV-020" })
    ];
    const snapshot = [...input];
    const result = sortTasks(input, "code", "asc", ORDER);

    expect(input).toEqual(snapshot);
    expect(input.map((task) => task.id)).toEqual(["a", "b", "c"]);
    expect(result).not.toBe(input);
    expect(result.map((task) => task.id)).toEqual(["b", "c", "a"]);
  });
});

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("cắt đúng trang, đếm đúng số trang", () => {
    expect(paginate(items, 1, 4)).toEqual({ items: [1, 2, 3, 4], page: 1, pageCount: 3 });
    expect(paginate(items, 2, 4)).toEqual({ items: [5, 6, 7, 8], page: 2, pageCount: 3 });
  });

  it("trang cuối được phép thiếu phần tử", () => {
    expect(paginate(items, 3, 4).items).toEqual([9, 10]);
  });

  /**
   * ⚠ Ca quan trọng nhất của hàm. Đang ở trang 5, gõ thêm một chữ vào ô tìm, còn 3 dòng — không kẹp
   * thì người dùng nhìn thấy bảng TRỐNG và kết luận là "tìm không ra".
   */
  it("trang vượt quá số trang bị kẹp về trang cuối, và trang đã kẹp được trả ra", () => {
    const result = paginate([1, 2, 3], 5, 10);
    expect(result).toEqual({ items: [1, 2, 3], page: 1, pageCount: 1 });

    const result2 = paginate(items, 99, 4);
    expect(result2).toEqual({ items: [9, 10], page: 3, pageCount: 3 });
  });

  it("trang nhỏ hơn 1 bị kẹp về 1", () => {
    expect(paginate(items, 0, 4).page).toBe(1);
    expect(paginate(items, -5, 4).page).toBe(1);
  });

  /**
   * ⚠ `NaN` (một phép tính hỏng ở nơi gọi) về trang 1, còn `Infinity` chỉ là "một số quá lớn" nên
   * nó đi theo luật kẹp như `page = 99`. Gộp hai ca vào một nhánh thì `999` về trang cuối còn
   * `Infinity` về trang đầu — hai câu trả lời ngược nhau cho cùng một ý định.
   */
  it("NaN về trang 1, còn Infinity đi theo luật kẹp như mọi số quá lớn", () => {
    expect(paginate(items, Number.NaN, 4).page).toBe(1);
    expect(paginate(items, Number.POSITIVE_INFINITY, 4).page).toBe(3);
    expect(paginate(items, Number.NEGATIVE_INFINITY, 4).page).toBe(1);
  });

  /** "Trang 1/0" là câu vô nghĩa, và nó làm mọi phép kẹp ở nơi gọi lệch một. */
  it("danh sách rỗng vẫn là trang 1 trên 1", () => {
    expect(paginate([], 1, 20)).toEqual({ items: [], page: 1, pageCount: 1 });
    expect(paginate([], 7, 20)).toEqual({ items: [], page: 1, pageCount: 1 });
  });

  it("pageSize hỏng được quy về 1 thay vì cho ra Infinity hay NaN", () => {
    expect(paginate(items, 1, 0)).toEqual({ items: [1], page: 1, pageCount: 10 });
    expect(paginate(items, 1, -3)).toEqual({ items: [1], page: 1, pageCount: 10 });
    expect(paginate(items, 1, Number.NaN)).toEqual({ items: [1], page: 1, pageCount: 10 });
    expect(paginate(items, 2, 2.7).items).toEqual([3, 4]);
  });

  it("không sửa mảng đầu vào, và trả mảng mới", () => {
    const input = [...items];
    const snapshot = [...items];
    const result = paginate(input, 2, 4);

    expect(input).toEqual(snapshot);
    expect(result.items).not.toBe(input);
  });

  /** Ghép ba hàm lại — đúng chuỗi mà bảng Công việc sẽ gọi. */
  it("lọc → sắp xếp → phân trang cho ra đúng lát người dùng nhìn thấy", () => {
    const tasks = [
      makeTask({ id: "a", code: "CV-003", status: "done" }),
      makeTask({ id: "b", code: "CV-001", status: "todo" }),
      makeTask({ id: "c", code: "CV-002", status: "todo" }),
      makeTask({ id: "d", code: "CV-004", status: "todo" })
    ];
    const kept = filterTasks(tasks, makeFilter({ statuses: ["todo"] }));
    const ordered = sortTasks(kept, "code", "asc", ORDER);
    const visible = paginate(ordered, 2, 2);

    expect(visible.pageCount).toBe(2);
    expect(visible.items.map((task) => task.id)).toEqual(["d"]);
  });
});
