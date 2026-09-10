/**
 * MÃ LỖI và lớp `ApiError` — hạt nhân THUẦN của hợp đồng lỗi, dùng được ở CẢ hai phía.
 *
 * ── VÌ SAO TÁCH KHỎI `lib/api/response.ts` ────────────────────────────────────────────────
 * File đó `import { NextResponse } from "next/server"` nên cả file là mã CHỈ chạy ở máy chủ — một
 * Client Component (hay `lib/api-client/`) import nó là kéo `next/server` vào bundle trình duyệt.
 * Nhưng cổng API ở trình duyệt cần đúng hai thứ: TẬP MÃ LỖI, và một lớp lỗi mang mã đó.
 *
 * Vậy nên: `ERROR_CODES` và `class ApiError` ở đây (tầng 1); `ApiErrorPayload` (chỉ KIỂU) ở
 * `lib/contracts/error.ts` (tầng 0); phần dựng `NextResponse` ở `lib/api/response.ts` (rìa B).
 *
 * ── VÀ VÌ SAO `ApiError.message` KHÔNG VI PHẠM LUẬT "LÕI KHÔNG TRẢ CHUỖI HIỂN THỊ" ─────────
 * Vì nó không phải chuỗi hiển thị. Nó là BẢN DỰ PHÒNG CHO MÁY: đi vào log máy chủ, vào `curl`, vào
 * một client chưa có bảng dịch. Giao diện KHÔNG BAO GIỜ in nó — nó đọc `code` rồi tra `errors.*`.
 *
 * ⚠ Chính vì thế mọi `message` ở file này viết bằng TIẾNG ANH: `pnpm core:check` chặn ký tự ngoài
 * ASCII trong `lib/core/`, và đó là cái chốt giữ cho không ai lỡ coi chỗ này là nơi đặt câu chữ
 * cho người dùng.
 */

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  STALE_WRITE: "STALE_WRITE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  /** Mạng hỏng / không tới được máy chủ. Chỉ SINH RA Ở TRÌNH DUYỆT — không route nào trả mã này. */
  NETWORK_ERROR: "NETWORK_ERROR",
  /**
   * Một chức năng CHƯA ĐƯỢC CẤU HÌNH — khác hẳn "hệ thống hỏng".
   *
   * Hai thứ đó cần hai cách sửa khác nhau: cái này là việc của người vận hành (điền `.env`), cái
   * kia là một sự cố. Gộp chúng vào `INTERNAL_ERROR` là để người vận hành đi tìm một sự cố không
   * tồn tại.
   */
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",

  /* ── Công việc ─────────────────────────────────────────────────────────────────────────── */
  TASK_NOT_FOUND: "TASK_NOT_FOUND",
  TASK_CODE_TAKEN: "TASK_CODE_TAKEN",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  /** Dự án đã đóng thì không nhận việc mới. */
  PROJECT_CLOSED: "PROJECT_CLOSED",
  /** Người được giao không nằm trong danh bạ của không gian làm việc. */
  ASSIGNEE_NOT_IN_WORKSPACE: "ASSIGNEE_NOT_IN_WORKSPACE",

  /* ── Tệp đính kèm ──────────────────────────────────────────────────────────────────────── */
  ATTACHMENT_EMPTY: "ATTACHMENT_EMPTY",
  ATTACHMENT_TYPE_INVALID: "ATTACHMENT_TYPE_INVALID",
  ATTACHMENT_TOO_LARGE: "ATTACHMENT_TOO_LARGE",
  /**
   * Kho ảnh CHƯA CẤU HÌNH — khác hẳn "hệ thống hỏng", và hai thứ này cần hai cách sửa khác nhau:
   * một cái là việc của người vận hành (điền `.env`), một cái là sự cố.
   */
  STORAGE_NOT_CONFIGURED: "STORAGE_NOT_CONFIGURED"
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Lỗi có chủ đích, ném từ bất kỳ đâu trong tầng API rồi bắt ở `withApiErrors`.
 *
 * Vì sao dùng exception chứ không trả về giá trị: một route handler hay có bốn năm phép kiểm lồng
 * nhau (có phiên? là thành viên? đủ quyền? bản ghi có tồn tại?), và trả về giá trị ở mỗi tầng biến
 * hàm thành một bậc thang `if`. Ném lỗi giữ đường đi CHÍNH thẳng.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthorized(message = "Sign in required."): ApiError {
    return new ApiError(401, ERROR_CODES.UNAUTHORIZED, message);
  }
  static forbidden(message = "You do not have permission to do this."): ApiError {
    return new ApiError(403, ERROR_CODES.FORBIDDEN, message);
  }
  static notFound(code: ErrorCode = ERROR_CODES.NOT_FOUND, message = "Not found."): ApiError {
    return new ApiError(404, code, message);
  }
  /**
   * 429 — quá nhiều yêu cầu.
   *
   * ⚠ Mã này KHÔNG do module tự sinh (module chưa có bộ giới hạn nào — xem AGENTS.md
   * §"Giới hạn tần suất"). Nó tồn tại để CHUYỂN TIẾP một 429 nhận từ Comitor.Account thay vì để nó
   * rơi vào nhánh 500. Trước bản này, Account trả 429 thì `withApiErrors` gọi đó là
   * `INTERNAL_ERROR` — người dùng đọc "lỗi hệ thống" cho một chuyện tự hết sau vài giây, và mọi
   * cảnh báo dựng theo tỉ lệ 500 kêu sai.
   */
  /**
   * 409 — giá trị đã đổi kể từ lúc người gửi đọc nó.
   *
   * Mã RIÊNG, không dùng lại `VALIDATION_ERROR`: giao diện phải phân biệt được "bạn gửi sai" (sửa
   * rồi gửi lại) với "có người khác vừa sửa" (đọc lại rồi QUYẾT ĐỊNH). Hai câu, hai hành động —
   * gộp chúng là bắt người dùng bấm Lưu lần nữa và ghi đè đúng thứ họ vừa được cảnh báo.
   */
  static stale(message = "The value changed since it was read."): ApiError {
    return new ApiError(409, ERROR_CODES.STALE_WRITE, message);
  }

  static rateLimited(message = "Too many requests. Try again shortly."): ApiError {
    return new ApiError(429, ERROR_CODES.RATE_LIMITED, message);
  }

  static validation(message: string, metadata?: Record<string, unknown>): ApiError {
    return new ApiError(400, ERROR_CODES.VALIDATION_ERROR, message, metadata);
  }
}
