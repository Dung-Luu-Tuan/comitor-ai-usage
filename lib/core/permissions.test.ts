import { describe, expect, it } from "vitest";
import type { WorkspaceRoleId } from "@/lib/contracts/account";
import type { AppPermissionId, PermissionMatrix } from "@/lib/contracts/settings";
import { applyPermissionLocks, buildPermissionMatrix, can, type PermissionRule, permissionLock } from "./permissions";

const ALL_ROLES: readonly WorkspaceRoleId[] = ["owner", "admin", "member", "guest"];

/**
 * Bảng quyền RÚT GỌN, đủ năm hình dạng cần cho các ca dưới đây: một quyền đọc mở cho khách, một
 * quyền ghi thường, một quyền ghi hẹp, một quyền ĐỌC nhưng hẹp (`report.export` — xuất dữ liệu
 * không phải thao tác ghi), và một quyền mà bảng khai KHÔNG cấp cho ai, kể cả chủ sở hữu.
 */
const RULES: readonly PermissionRule[] = [
  { id: "task.view", write: false, defaultRoles: ["owner", "admin", "member", "guest"] },
  { id: "task.create", write: true, defaultRoles: ["owner", "admin", "member"] },
  { id: "task.delete", write: true, defaultRoles: ["owner", "admin"] },
  { id: "report.export", write: false, defaultRoles: ["owner", "admin"] },
  { id: "app.permissions", write: true, defaultRoles: [] }
];

/**
 * Dựng một ma trận KHUYẾT để mô phỏng dữ liệu đọc từ database.
 *
 * `as` ở đây là hợp lệ và không thể tránh: đối tượng của các ca này CHÍNH LÀ thứ mà kiểu
 * `PermissionMatrix` không diễn đạt được — một bản ghi thiếu hàng, thiếu cột, hoặc mang giá trị
 * không phải `boolean`. Không có cách nào kiểm `can()` fail-closed nếu chỉ được truyền vào những
 * ma trận đã đầy đủ.
 */
function partialMatrix(
  rows: Partial<Record<WorkspaceRoleId, Partial<Record<AppPermissionId, unknown>>>>
): PermissionMatrix {
  return rows as PermissionMatrix;
}

describe("permissionLock", () => {
  /** Hằng đúng 1: bỏ tick ở cột chủ sở hữu là tạo ra trạng thái không ai bật lại được. */
  it("chủ sở hữu bị khoá ở hướng always, với cả quyền đọc lẫn quyền ghi", () => {
    expect(permissionLock("owner", false)).toBe("always");
    expect(permissionLock("owner", true)).toBe("always");
  });

  /** Hằng đúng 2: khách là người ngoài tổ chức, một lời mời khách không được thành đường ghi. */
  it("khách bị khoá ở hướng never với quyền GHI", () => {
    expect(permissionLock("guest", true)).toBe("never");
  });

  it("khách KHÔNG bị khoá với quyền đọc — ô đó vẫn bật/tắt được", () => {
    expect(permissionLock("guest", false)).toBeUndefined();
  });

  it("quản trị viên và thành viên không có ô nào bị khoá", () => {
    expect(permissionLock("admin", true)).toBeUndefined();
    expect(permissionLock("admin", false)).toBeUndefined();
    expect(permissionLock("member", true)).toBeUndefined();
    expect(permissionLock("member", false)).toBeUndefined();
  });
});

describe("buildPermissionMatrix", () => {
  const matrix = buildPermissionMatrix(RULES, ALL_ROLES);

  it("sinh đủ lưới 4 vai trò × N quyền, không thiếu ô nào", () => {
    expect(Object.keys(matrix)).toEqual([...ALL_ROLES]);
    for (const roleId of ALL_ROLES) {
      expect(Object.keys(matrix[roleId])).toEqual(RULES.map((rule) => rule.id));
    }
    const cellCount = ALL_ROLES.reduce((total, roleId) => total + Object.keys(matrix[roleId]).length, 0);
    expect(cellCount).toBe(ALL_ROLES.length * RULES.length);
  });

  /**
   * ⚠ Ca then chốt của hằng đúng 1: `app.permissions` khai `defaultRoles: []`, tức bảng khai nói
   * KHÔNG cấp cho ai. Chủ sở hữu vẫn phải có — hằng đúng ĐÈ LÊN bảng khai, không phải ngược lại.
   */
  it("chủ sở hữu có mọi quyền, kể cả quyền mà bảng khai không cấp cho ai", () => {
    for (const rule of RULES) {
      expect(can(matrix, "owner", rule.id)).toBe(true);
    }
  });

  it("khách không có quyền GHI nào", () => {
    expect(can(matrix, "guest", "task.create")).toBe(false);
    expect(can(matrix, "guest", "task.delete")).toBe(false);
    expect(can(matrix, "guest", "app.permissions")).toBe(false);
  });

  /** Đối chứng: hằng đúng chỉ chặn GHI. Khách vẫn được cấp quyền ĐỌC như bảng khai nói. */
  it("khách VẪN có quyền đọc mà bảng khai cấp, và không có quyền đọc mà bảng khai không cấp", () => {
    expect(can(matrix, "guest", "task.view")).toBe(true);
    expect(can(matrix, "guest", "report.export")).toBe(false);
  });

  it("vai trò không bị khoá thì theo đúng defaultRoles", () => {
    expect(can(matrix, "member", "task.create")).toBe(true);
    expect(can(matrix, "member", "task.delete")).toBe(false);
    expect(can(matrix, "admin", "task.delete")).toBe(true);
  });

  /**
   * Hằng đúng phải thắng cả một bảng khai SAI. Đây là kiểu lỗi mà `tsc` và Biome đều thấy hợp lệ:
   * một `boolean` đúng kiểu, một mảng đúng kiểu, chỉ nội dung là mâu thuẫn.
   */
  it("bảng khai cấp quyền ghi cho khách vẫn bị áp đè", () => {
    const poisoned: readonly PermissionRule[] = [
      { id: "task.delete", write: true, defaultRoles: ["owner", "admin", "member", "guest"] }
    ];
    expect(can(buildPermissionMatrix(poisoned, ALL_ROLES), "guest", "task.delete")).toBe(false);
  });

  it("lưới rỗng theo cả hai chiều vẫn cho ma trận hợp lệ", () => {
    expect(buildPermissionMatrix([], ALL_ROLES)).toEqual({ owner: {}, admin: {}, member: {}, guest: {} });
    expect(buildPermissionMatrix(RULES, [])).toEqual({});
  });

  it("chỉ dựng những vai trò được yêu cầu", () => {
    expect(Object.keys(buildPermissionMatrix(RULES, ["member"]))).toEqual(["member"]);
  });
});

describe("applyPermissionLocks", () => {
  /**
   * ⚠ Ca quan trọng nhất của cả file: một ma trận MÂU THUẪN như thứ đọc lên từ database sau một
   * migration cũ hoặc một lần sửa tay bằng `psql`. Cả hai hằng đúng phải được vá tại TẦNG ĐỌC.
   */
  it("sửa được ma trận mâu thuẫn: khách bị gỡ quyền ghi, chủ sở hữu được trả lại quyền", () => {
    const fromDatabase = partialMatrix({
      owner: { "task.view": false, "task.create": false, "app.permissions": false },
      admin: { "task.view": true, "task.delete": true },
      member: { "task.view": true },
      guest: { "task.view": true, "task.delete": true, "app.permissions": true }
    });

    const fixed = applyPermissionLocks(fromDatabase, RULES, ALL_ROLES);

    expect(can(fixed, "guest", "task.delete")).toBe(false);
    expect(can(fixed, "guest", "app.permissions")).toBe(false);
    expect(can(fixed, "owner", "task.view")).toBe(true);
    expect(can(fixed, "owner", "app.permissions")).toBe(true);
    // Ô không bị khoá thì giữ nguyên những gì database nói — kể cả khi khách vẫn được xem.
    expect(can(fixed, "guest", "task.view")).toBe(true);
    expect(can(fixed, "admin", "task.delete")).toBe(true);
  });

  /**
   * Áp đè KHÔNG phải là dựng lại từ mặc định. Một không gian làm việc cố ý cấp thêm quyền cho
   * thành viên thì lần đọc sau vẫn phải thấy quyền đó — nếu không, mọi tuỳ chỉnh im lặng biến mất.
   */
  it("không kéo ô hợp lệ về lại giá trị mặc định", () => {
    const customised = applyPermissionLocks(
      partialMatrix({ owner: {}, admin: {}, member: { "task.delete": true }, guest: {} }),
      RULES,
      ALL_ROLES
    );
    expect(can(customised, "member", "task.delete")).toBe(true);
  });

  it("ô khuyết và hàng khuyết đều thành false, không phải true", () => {
    const sparse = applyPermissionLocks(partialMatrix({ admin: { "task.view": true } }), RULES, ALL_ROLES);
    expect(can(sparse, "member", "task.view")).toBe(false);
    expect(can(sparse, "admin", "task.create")).toBe(false);
    expect(can(sparse, "guest", "task.view")).toBe(false);
    // Chủ sở hữu là ngoại lệ duy nhất, và vì hằng đúng chứ không vì dữ liệu.
    expect(can(sparse, "owner", "task.view")).toBe(true);
  });

  it("bỏ vai trò và quyền không nằm trong lưới khai báo — tàn dư của lược đồ cũ", () => {
    const stale = partialMatrix({
      admin: { "task.view": true, "task.edit": true },
      support: { "task.view": true }
    } as Record<string, Record<string, boolean>>);

    const trimmed = applyPermissionLocks(stale, RULES, ALL_ROLES);

    expect(Object.keys(trimmed)).toEqual([...ALL_ROLES]);
    expect(Object.keys(trimmed.admin)).not.toContain("task.edit");
  });

  /** Tính chất: hàm bất động. Đọc hai lần, hay đọc rồi ghi rồi đọc lại, đều cho cùng một ma trận. */
  it("bất động — áp đè lần hai không đổi gì nữa", () => {
    const once = applyPermissionLocks(partialMatrix({ guest: { "task.delete": true } }), RULES, ALL_ROLES);
    expect(applyPermissionLocks(once, RULES, ALL_ROLES)).toEqual(once);
  });

  /** Tính chất: ma trận dựng từ bảng khai đã thoả sẵn hai hằng đúng, nên áp đè lên nó là phép đồng nhất. */
  it("ma trận dựng từ bảng khai đi qua áp đè mà không đổi", () => {
    const built = buildPermissionMatrix(RULES, ALL_ROLES);
    expect(applyPermissionLocks(built, RULES, ALL_ROLES)).toEqual(built);
  });
});

describe("can", () => {
  const matrix = buildPermissionMatrix(RULES, ALL_ROLES);

  it("đọc đúng một ô đã bật và một ô đã tắt", () => {
    expect(can(matrix, "member", "task.view")).toBe(true);
    expect(can(matrix, "member", "task.delete")).toBe(false);
  });

  /**
   * ⚠ `noUncheckedIndexedAccess` KHÔNG phủ ca này — `PermissionMatrix` là mapped type trên union
   * hữu hạn nên `tsc` tin là đủ hàng đủ cột. Phép phòng vệ trong `can()` vì thế phải viết tay, và
   * hai ca dưới đây là thứ giữ nó không bị ai "dọn" đi.
   */
  it("vai trò không tồn tại → false", () => {
    expect(can(matrix, "support" as WorkspaceRoleId, "task.view")).toBe(false);
  });

  it("quyền không tồn tại → false", () => {
    expect(can(matrix, "owner", "task.archive" as AppPermissionId)).toBe(false);
  });

  it("ma trận rỗng → false ở mọi câu hỏi", () => {
    expect(can(partialMatrix({}), "owner", "task.view")).toBe(false);
    expect(can(partialMatrix({ owner: {} }), "owner", "task.view")).toBe(false);
  });

  /**
   * Dữ liệu qua `JSON.parse` hay qua một cột `text` có thể cho ra chuỗi `"true"` thay vì `true`.
   * Một phép kiểm quyền viết bằng `Boolean(...)` sẽ CHO QUA — đó là lý do `can()` so `=== true`.
   */
  it("giá trị không phải boolean cũng là từ chối", () => {
    expect(can(partialMatrix({ owner: { "task.view": "true" } }), "owner", "task.view")).toBe(false);
    expect(can(partialMatrix({ owner: { "task.view": 1 } }), "owner", "task.view")).toBe(false);
  });
});
