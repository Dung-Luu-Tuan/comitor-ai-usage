/**
 * Hình dạng LỖI đi qua HTTP — TẦNG 0: chỉ KIỂU.
 *
 * Tách khỏi `lib/core/api-error.ts` (nơi có `ERROR_CODES` và `class ApiError`, tức mã CHẠY ĐƯỢC)
 * để chỗ nào chỉ cần kiểu thì không kéo theo gì cả.
 */

import type { ErrorCode } from "@/lib/core/api-error";

/**
 * Thân của một phản hồi lỗi: `{ "error": { code, message, metadata? } }`.
 *
 * ── `message` LÀ BẢN DỰ PHÒNG CHO MÁY, KHÔNG PHẢI CHUỖI HIỂN THỊ ──────────────────────────
 * Nó đi vào log máy chủ, vào `curl` lúc gỡ lỗi, vào một client chưa dựng bảng dịch. Giao diện
 * KHÔNG in nó ra: nó đọc `code` rồi tra `errors.*` để ra đúng ngôn ngữ người đang xem.
 *
 * Phép thử một câu: *nếu chuỗi này phải đổi khi người dùng bấm "English", nó là chuỗi hiển thị.*
 * `message` không đổi — nơi nó tới không có "người xem" nào cả.
 */
export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}
