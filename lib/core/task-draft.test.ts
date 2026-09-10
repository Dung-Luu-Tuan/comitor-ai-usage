import { describe, expect, it } from "vitest";
import {
  EMPTY_TASK_DRAFT,
  parseTaskDraft,
  REQUEST_TYPE_VALUES,
  TASK_PRIORITY_VALUES,
  taskDraftSchema
} from "./task-draft";

/** Một bản nháp đầy đủ, hợp lệ — mốc so sánh cho mọi ca bên dưới. */
const FULL_DRAFT = {
  title: "Rà soát thông báo lỗi của biểu mẫu",
  summary: "Bối cảnh và điều kiện nghiệm thu.",
  projectId: "p-nen-tang",
  assigneeUserId: "u-bao",
  watcherUserIds: ["u-ha", "u-anh"],
  priority: "high",
  dueDate: "2026-09-30",
  estimateHours: "7,5",
  requestType: "improvement",
  needsApproval: true,
  approvalFlowId: "two-level",
  notifyChannels: ["in-app", "email"],
  remindBeforeDue: true,
  syncWithCalendar: false
};

describe("taskDraftSchema", () => {
  it("giữ nguyên một bản nháp đầy đủ", () => {
    expect(parseTaskDraft(FULL_DRAFT)).toEqual(FULL_DRAFT);
  });

  /**
   * ⚠ Ca khoá quyết định quan trọng nhất của lược đồ: bản nháp do một PHIÊN BẢN CŨ của biểu mẫu ghi
   * (thiếu những trường mới thêm) vẫn phải đọc được. Không có `.default()` thì mỗi lần thêm một ô
   * vào biểu mẫu là mọi bản nháp đang có của mọi người dùng đồng loạt bị coi là hỏng.
   */
  it("thiếu trường thì lấy mặc định, không coi là hỏng", () => {
    const parsed = parseTaskDraft({ title: "Còn dở" });
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual({ ...EMPTY_TASK_DRAFT, title: "Còn dở" });
  });

  it("object rỗng cho ra đúng bản nháp trống", () => {
    expect(parseTaskDraft({})).toEqual(EMPTY_TASK_DRAFT);
  });

  it("loại bỏ khoá lạ — trường đã gỡ khỏi biểu mẫu không được sống sót trong nháp", () => {
    const parsed = parseTaskDraft({ ...FULL_DRAFT, legacyField: "bỏ đi" });
    expect(parsed).toEqual(FULL_DRAFT);
    expect(parsed).not.toHaveProperty("legacyField");
  });
});

describe("parseTaskDraft — dữ liệu không đọc được", () => {
  it("sai KIỂU thì bỏ cả bản, không đoán ý", () => {
    expect(parseTaskDraft({ ...FULL_DRAFT, title: 123 })).toBeNull();
    expect(parseTaskDraft({ ...FULL_DRAFT, needsApproval: "true" })).toBeNull();
    expect(parseTaskDraft({ ...FULL_DRAFT, watcherUserIds: "u-ha" })).toBeNull();
  });

  it("giá trị union lạ thì bỏ cả bản", () => {
    expect(parseTaskDraft({ ...FULL_DRAFT, priority: "critical" })).toBeNull();
    expect(parseTaskDraft({ ...FULL_DRAFT, requestType: "chore" })).toBeNull();
  });

  /**
   * `2026-02-30` khớp mọi regex `\d{4}-\d{2}-\d{2}` nhưng KHÔNG tồn tại — và một ngày không tồn tại
   * trôi xuống `Date.UTC` sẽ được "sửa" âm thầm thành 2026-03-02. Chặn ở cửa vào là chỗ duy nhất
   * còn nhìn thấy được nó sai.
   */
  it("ngày không có thật hoặc sai dạng thì bỏ cả bản", () => {
    expect(parseTaskDraft({ ...FULL_DRAFT, dueDate: "2026-02-30" })).toBeNull();
    expect(parseTaskDraft({ ...FULL_DRAFT, dueDate: "2026-9-30" })).toBeNull();
    expect(parseTaskDraft({ ...FULL_DRAFT, dueDate: "30/09/2026" })).toBeNull();
    expect(parseTaskDraft({ ...FULL_DRAFT, dueDate: "2026-09-30T00:00:00Z" })).toBeNull();
  });

  it("chưa chọn hạn chót là HỢP LỆ — nháp vốn dĩ dở dang", () => {
    expect(parseTaskDraft({ ...FULL_DRAFT, dueDate: null })).toEqual({ ...FULL_DRAFT, dueDate: null });
  });

  it("vượt trần độ dài thì bỏ cả bản", () => {
    expect(parseTaskDraft({ ...FULL_DRAFT, title: "x".repeat(201) })).toBeNull();
    expect(parseTaskDraft({ ...FULL_DRAFT, watcherUserIds: Array.from({ length: 21 }, () => "u-ha") })).toBeNull();
  });

  it("không phải object thì trả null thay vì nổ", () => {
    expect(parseTaskDraft(null)).toBeNull();
    expect(parseTaskDraft(undefined)).toBeNull();
    expect(parseTaskDraft("draft")).toBeNull();
    expect(parseTaskDraft([FULL_DRAFT])).toBeNull();
  });
});

describe("EMPTY_TASK_DRAFT", () => {
  it("là mặc định của chính lược đồ, không phải một bản chép tay", () => {
    expect(EMPTY_TASK_DRAFT).toEqual(taskDraftSchema.parse({}));
  });

  it("mở biểu mẫu trống thì không có gì được chọn sẵn ngoài mức ưu tiên", () => {
    expect(EMPTY_TASK_DRAFT.projectId).toBeNull();
    expect(EMPTY_TASK_DRAFT.assigneeUserId).toBeNull();
    expect(EMPTY_TASK_DRAFT.dueDate).toBeNull();
    expect(EMPTY_TASK_DRAFT.watcherUserIds).toEqual([]);
    expect(EMPTY_TASK_DRAFT.priority).toBe("medium");
  });
});

describe("bảng giá trị", () => {
  it("khớp thứ tự và nội dung của hợp đồng", () => {
    expect(TASK_PRIORITY_VALUES).toEqual(["low", "medium", "high", "urgent"]);
    expect(REQUEST_TYPE_VALUES).toEqual(["task", "incident", "improvement", "external"]);
  });
});
