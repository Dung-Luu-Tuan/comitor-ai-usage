import { describe, expect, it } from "vitest";
import type { TaskStatus } from "@/lib/contracts/task";
import { isOpenStatus, projectProgress, weightedAverageProgress } from "./project-progress";

/** Toàn bộ giá trị của `TaskStatus`. Khai đủ ở đây để một trạng thái mới không lọt qua test này. */
const ALL_STATUSES: readonly TaskStatus[] = ["todo", "in-progress", "in-review", "done", "overdue"];

describe("isOpenStatus", () => {
  it("chỉ done là đóng", () => {
    expect(isOpenStatus("done")).toBe(false);
  });

  /**
   * ⚠ Hai ca hay bị đếm nhầm sang phía đóng vì trông như trạng thái cuối. Một việc chờ duyệt có
   * thể bị trả lại, một việc quá hạn thì càng chưa xong — cả hai vẫn đang mở.
   */
  it("in-review và overdue vẫn là đang mở", () => {
    expect(isOpenStatus("in-review")).toBe(true);
    expect(isOpenStatus("overdue")).toBe(true);
  });

  it("todo và in-progress là đang mở", () => {
    expect(isOpenStatus("todo")).toBe(true);
    expect(isOpenStatus("in-progress")).toBe(true);
  });

  /**
   * Tính chất, không phải danh sách: trong toàn bộ tập trạng thái có ĐÚNG MỘT trạng thái đóng.
   * Thêm một trạng thái mới mà quên nghĩ tới chỗ này thì test vẫn xanh (mặc định là "đang mở",
   * đúng chủ ý), nhưng đổi định nghĩa thành hai trạng thái đóng thì test đỏ ngay.
   */
  it("đúng một trạng thái đóng trên toàn bộ tập trạng thái", () => {
    expect(ALL_STATUSES.filter((status) => !isOpenStatus(status))).toEqual(["done"]);
  });

  /** Ba chỗ gọi (thẻ chỉ số, badge thanh bên, bộ lọc bảng) phải ra cùng một con số. */
  it("số việc mở + số việc đóng = tổng số việc", () => {
    const statuses: TaskStatus[] = ["todo", "done", "overdue", "in-review", "done", "in-progress"];
    const open = statuses.filter(isOpenStatus).length;
    const done = statuses.filter((status) => !isOpenStatus(status)).length;
    expect(open).toBe(4);
    expect(done).toBe(2);
    expect(open + done).toBe(statuses.length);
  });
});

describe("projectProgress", () => {
  /**
   * ⚠ Ca quan trọng nhất của file. `0 / 0` là `NaN`, và một `NaN` lọt ra sẽ in "NaN%" giữa giao
   * diện rồi làm hỏng mọi phép tổng ở tầng trên. Kết quả phải là 0, KHÔNG phải 100: dự án chưa có
   * việc nào là chưa bắt đầu, không phải đã xong.
   */
  it("dự án chưa có việc nào → 0, không phải NaN và không phải 100", () => {
    const result = projectProgress(0, 0);
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
    expect(result).not.toBe(100);
  });

  it("chưa xong việc nào → 0; xong hết → 100", () => {
    expect(projectProgress(0, 12)).toBe(0);
    expect(projectProgress(12, 12)).toBe(100);
  });

  /** `Math.round` làm tròn 0.5 LÊN: 1/8 = 12.5% phải hiện 13%, không phải 12%. */
  it("làm tròn 0.5 lên", () => {
    expect(projectProgress(1, 8)).toBe(13);
    expect(projectProgress(3, 8)).toBe(38);
  });

  it("làm tròn tới số nguyên gần nhất ở các tỉ lệ lẻ", () => {
    expect(projectProgress(1, 3)).toBe(33);
    expect(projectProgress(2, 3)).toBe(67);
    expect(projectProgress(1, 300)).toBe(0);
  });

  /**
   * Dữ liệu hỏng (hai nguồn đếm lệch, hoặc một việc bị đếm hai lần) không được sinh ra 150%: thanh
   * tiến độ tràn ra khỏi máng của nó và làm vỡ bố cục mà không chỉ ra được nguyên nhân thật.
   */
  it("doneCount > taskCount bị kẹp về 100", () => {
    expect(projectProgress(15, 10)).toBe(100);
    expect(projectProgress(1, 0)).toBe(0);
  });

  /**
   * ⚠ Đây là lý do điều kiện viết `!(taskCount > 0)` chứ không phải `taskCount <= 0`: với `NaN`
   * phép `<= 0` cho `false` nên `NaN` lọt qua cửa và hàm trả về `NaN`.
   */
  it("số âm và NaN đều cho 0, không cho NaN", () => {
    expect(projectProgress(-3, 10)).toBe(0);
    expect(projectProgress(5, -10)).toBe(0);
    expect(projectProgress(Number.NaN, 10)).toBe(0);
    expect(projectProgress(5, Number.NaN)).toBe(0);
    expect(projectProgress(Number.NaN, Number.NaN)).toBe(0);
  });

  /** Tính chất: kết quả luôn là số nguyên trong khoảng 0–100, với mọi cặp đầu vào hợp lệ. */
  it("luôn trả số nguyên trong khoảng 0–100", () => {
    for (let taskCount = 0; taskCount <= 20; taskCount += 1) {
      for (let doneCount = 0; doneCount <= 25; doneCount += 1) {
        const result = projectProgress(doneCount, taskCount);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }
    }
  });

  /** Tính chất: xong thêm một việc thì tiến độ không bao giờ giảm. */
  it("đơn điệu không giảm theo doneCount", () => {
    let previous = -1;
    for (let doneCount = 0; doneCount <= 7; doneCount += 1) {
      const result = projectProgress(doneCount, 7);
      expect(result).toBeGreaterThanOrEqual(previous);
      previous = result;
    }
    expect(previous).toBe(100);
  });
});

describe("weightedAverageProgress", () => {
  it("mảng rỗng → 0", () => {
    expect(weightedAverageProgress([])).toBe(0);
  });

  it("mọi dự án đều chưa có việc nào → 0", () => {
    expect(
      weightedAverageProgress([
        { progress: 0, taskCount: 0 },
        { progress: 100, taskCount: 0 }
      ])
    ).toBe(0);
  });

  /**
   * ⚠ Ca biện minh cho toàn bộ hàm này. Trung bình cộng cho 50% — một câu SAI, vì 99 trên 100 việc
   * còn nguyên. Có trọng số cho 1%.
   */
  it("một dự án 1 việc không kéo nổi một dự án 99 việc", () => {
    const result = weightedAverageProgress([
      { progress: 100, taskCount: 1 },
      { progress: 0, taskCount: 99 }
    ]);
    expect(result).toBe(1);
    expect(result).not.toBe(50);
  });

  it("dự án 9 việc nặng hơn dự án 2 việc", () => {
    // (100 × 9 + 0 × 2) / 11 = 81,8…
    expect(
      weightedAverageProgress([
        { progress: 100, taskCount: 9 },
        { progress: 0, taskCount: 2 }
      ])
    ).toBe(82);
  });

  it("một dự án duy nhất trả đúng tiến độ của nó", () => {
    expect(weightedAverageProgress([{ progress: 37, taskCount: 5 }])).toBe(37);
  });

  it("dự án 0 việc không làm lệch kết quả", () => {
    const withEmpty = weightedAverageProgress([
      { progress: 40, taskCount: 10 },
      { progress: 100, taskCount: 0 }
    ]);
    expect(withEmpty).toBe(40);
  });

  it("làm tròn 0.5 lên", () => {
    // (0 × 1 + 1 × 1) / 2 = 0,5 → 1
    expect(
      weightedAverageProgress([
        { progress: 0, taskCount: 1 },
        { progress: 1, taskCount: 1 }
      ])
    ).toBe(1);
  });

  it("progress ngoài khoảng 0–100 bị kẹp trước khi cộng", () => {
    expect(
      weightedAverageProgress([
        { progress: 150, taskCount: 1 },
        { progress: 100, taskCount: 1 }
      ])
    ).toBe(100);
    expect(
      weightedAverageProgress([
        { progress: -50, taskCount: 1 },
        { progress: 100, taskCount: 1 }
      ])
    ).toBe(50);
  });

  /**
   * ⚠ `progress` hỏng thì kẹp về 0 và GIỮ trọng số, không bỏ dòng đi. Bỏ dòng là rút nó khỏi mẫu
   * số, tức làm con số ĐẸP LÊN — một lỗi dữ liệu không được phép khiến kết quả trông khá hơn thực
   * tế, vì khi đó không ai đi tìm lỗi nữa.
   */
  it("progress là NaN thì kẹp về 0 nhưng vẫn giữ trọng số", () => {
    expect(
      weightedAverageProgress([
        { progress: Number.NaN, taskCount: 1 },
        { progress: 100, taskCount: 1 }
      ])
    ).toBe(50);
  });

  it("taskCount âm hoặc NaN bị bỏ qua, không làm hỏng kết quả", () => {
    expect(
      weightedAverageProgress([
        { progress: 100, taskCount: Number.NaN },
        { progress: 100, taskCount: -5 },
        { progress: 40, taskCount: 10 }
      ])
    ).toBe(40);
  });

  /** Tính chất: kết quả luôn nằm giữa tiến độ nhỏ nhất và lớn nhất của các dự án có việc. */
  it("kết quả luôn nằm trong khoảng [min, max] của các dự án có việc", () => {
    const projects = [
      { progress: 12, taskCount: 3 },
      { progress: 87, taskCount: 9 },
      { progress: 55, taskCount: 1 },
      { progress: 100, taskCount: 0 }
    ];
    const result = weightedAverageProgress(projects);
    expect(result).toBeGreaterThanOrEqual(12);
    expect(result).toBeLessThanOrEqual(87);
    expect(Number.isInteger(result)).toBe(true);
  });

  /** Hai hàm phải khớp nhau: nối `projectProgress` vào rồi cộng lại vẫn ra tỉ lệ chung. */
  it("ghép với projectProgress cho đúng tỉ lệ tổng việc xong trên tổng việc", () => {
    const raw = [
      { doneCount: 3, taskCount: 4 },
      { doneCount: 1, taskCount: 4 },
      { doneCount: 0, taskCount: 8 }
    ];
    const projects = raw.map((project) => ({
      progress: projectProgress(project.doneCount, project.taskCount),
      taskCount: project.taskCount
    }));
    // 4 việc xong trên tổng 16 việc = 25%.
    expect(weightedAverageProgress(projects)).toBe(25);
  });
});
