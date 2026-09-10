import { describe, expect, it } from "vitest";
import { ApiError, ERROR_CODES, type ErrorCode } from "./api-error";

/**
 * `api-error.ts` là module `lib/core/` DUY NHẤT từng không có test — và nó là module có nhiều chỗ
 * gọi nhất trong repo: mọi route handler ném nó, `withApiErrors` bắt nó, `lib/api-client/http.ts`
 * dựng lại nó ở trình duyệt, và `hooks/use-error-message.ts` tra `code` của nó ra câu chữ.
 *
 * Vì thế cái đáng khoá lại không phải "class có chạy không" mà là ba HỢP ĐỒNG mà bốn chỗ kia
 * ngầm tin, và không chỗ nào tự kiểm được:
 *
 *   1. `instanceof ApiError` phân biệt được lỗi CÓ CHỦ ĐÍCH với lỗi bất ngờ — nếu hỏng thì
 *      `withApiErrors` trả 500 cho một lỗi 403, tức người dùng nhận "lỗi hệ thống" cho một
 *      chuyện bình thường.
 *   2. Khoá và giá trị của `ERROR_CODES` TRÙNG NHAU. Giá trị là thứ đi qua dây (JSON) và thành
 *      hậu tố khoá i18n (`errors.*`); khoá là thứ mã nguồn gọi. Lệch một chữ giữa hai bên thì
 *      `tsc` vẫn xanh, `pnpm i18n:check` vẫn xanh, và người dùng nhận một khoá thô.
 *   3. `metadata` KHÔNG tự sinh ra khi không truyền — `apiError()` chỉ đính `metadata` vào thân
 *      phản hồi khi nó tồn tại, nên một `{}` rỗng ngoài ý muốn sẽ đổi hình dạng JSON.
 */

describe("ERROR_CODES", () => {
  it("mọi khoá trùng đúng giá trị của nó", () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value).toBe(key);
    }
  });

  it("không có giá trị nào trùng nhau", () => {
    const values = Object.values(ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });

  /**
   * Giá trị của mã đi thẳng vào khoá i18n qua `errors.${code}`. `next-intl` dùng dấu chấm làm dấu
   * phân cấp namespace, nên một mã chứa dấu chấm sẽ tra nhầm tầng — cùng họ với cạm bẫy đã ghi ở
   * AGENTS.md cho mã quyền (`task.view`), chỉ khác là ở đó có `toPermissionMessageKey()` làm phép
   * đổi, còn ở đây thì KHÔNG có và cũng không nên có.
   */
  it("không mã nào chứa dấu chấm hay khoảng trắng — chúng đi thẳng vào khoá i18n", () => {
    for (const value of Object.values(ERROR_CODES)) {
      expect(value).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});

describe("ApiError", () => {
  it("mang đủ status, code, message và metadata", () => {
    const error = new ApiError(409, ERROR_CODES.TASK_CODE_TAKEN, "Task code already used.", { code: "CV-014" });

    expect(error.status).toBe(409);
    expect(error.code).toBe(ERROR_CODES.TASK_CODE_TAKEN);
    expect(error.message).toBe("Task code already used.");
    expect(error.metadata).toEqual({ code: "CV-014" });
  });

  it("là một Error thật, và `withApiErrors` nhận ra nó qua instanceof", () => {
    const error = new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Bad input.");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.name).toBe("ApiError");
  });

  it("giữ nguyên bản chất sau khi bị ném và bắt lại", () => {
    let caught: unknown;
    try {
      throw ApiError.forbidden();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(403);
  });

  it("không tự sinh metadata khi không được truyền", () => {
    expect(new ApiError(500, ERROR_CODES.INTERNAL_ERROR, "Boom.").metadata).toBeUndefined();
  });
});

describe("ApiError — bốn hàm dựng sẵn", () => {
  it("unauthorized() là 401 với mã UNAUTHORIZED", () => {
    const error = ApiError.unauthorized();
    expect(error.status).toBe(401);
    expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    expect(error.message.length).toBeGreaterThan(0);
  });

  it("forbidden() là 403 với mã FORBIDDEN", () => {
    const error = ApiError.forbidden();
    expect(error.status).toBe(403);
    expect(error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it("notFound() mặc định là 404/NOT_FOUND", () => {
    const error = ApiError.notFound();
    expect(error.status).toBe(404);
    expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  /**
   * Ca quan trọng hơn ca mặc định: 404 mang mã CỦA MIỀN. Giao diện phân biệt "không tìm thấy việc"
   * với "không tìm thấy dự án" bằng chính mã này, và cả hai đều là 404 nên `status` không đủ.
   */
  it("notFound() nhận mã của miền mà vẫn giữ 404", () => {
    const error = ApiError.notFound(ERROR_CODES.PROJECT_NOT_FOUND, "Project is gone.");
    expect(error.status).toBe(404);
    expect(error.code).toBe(ERROR_CODES.PROJECT_NOT_FOUND);
    expect(error.message).toBe("Project is gone.");
  });

  it("validation() là 400 và chuyển tiếp metadata", () => {
    const error = ApiError.validation("Title is required.", { fields: { title: "REQUIRED" } });
    expect(error.status).toBe(400);
    expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(error.metadata).toEqual({ fields: { title: "REQUIRED" } });
  });

  it("cho phép ghi đè thông điệp mặc định", () => {
    expect(ApiError.unauthorized("Session expired.").message).toBe("Session expired.");
    expect(ApiError.forbidden("Owners only.").message).toBe("Owners only.");
  });

  /**
   * `message` là BẢN DỰ PHÒNG CHO MÁY (log, `curl`, client chưa có bảng dịch) — nên nó phải là
   * tiếng Anh ASCII. `pnpm core:check` canh điều đó cho mã nguồn, nhưng nó BỎ QUA file `.test.ts`,
   * nên phép kiểm dưới đây là chỗ duy nhất khoá được các thông điệp MẶC ĐỊNH.
   */
  it("mọi thông điệp mặc định là ASCII — chúng đi vào log, không vào giao diện", () => {
    const defaults = [ApiError.unauthorized(), ApiError.forbidden(), ApiError.notFound()];
    for (const error of defaults) {
      expect(error.message).toMatch(/^[ -~]+$/);
    }
  });
});

describe("ErrorCode", () => {
  it("kiểu hẹp đúng bằng tập giá trị của ERROR_CODES", () => {
    const code: ErrorCode = ERROR_CODES.STORAGE_NOT_CONFIGURED;
    expect(Object.values(ERROR_CODES)).toContain(code);
  });
});
