import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/lib/contracts/error";
import { ApiError, ERROR_CODES, type ErrorCode } from "@/lib/core/api-error";
import { REQUEST_ID_HEADER, toRequestId } from "@/lib/core/request-id";

/**
 * Hình dạng phản hồi dùng chung của mọi route handler — RÌA B.
 *
 * File này `import { NextResponse } from "next/server"` nên nó là mã CHỈ chạy ở máy chủ. Phần mà
 * trình duyệt cũng cần (`ERROR_CODES`, `class ApiError`) nằm ở `lib/core/api-error.ts` — tách ra
 * chính vì lý do đó.
 */

/**
 * Bọc một route handler: mọi lỗi ném ra đều thành JSON đúng hình dạng.
 *
 * ── VÌ SAO BỌC, CHỨ KHÔNG `try/catch` Ở TỪNG ROUTE ────────────────────────────────────────
 * Vì cái ta muốn không phải là "bắt lỗi" mà là **không có route nào rò một stack trace ra ngoài**.
 * `try/catch` viết tay thì đúng ở route thứ nhất và thiếu ở route thứ mười một, và chỗ thiếu chỉ
 * lộ ra khi có sự cố thật — tức đúng lúc tệ nhất.
 *
 * ⚠ Lỗi KHÔNG PHẢI `ApiError` thì KHÔNG được đưa `error.message` ra ngoài. Thông điệp của một lỗi
 * Prisma mang tên bảng, tên cột, đôi khi cả một phần câu truy vấn — đó là bản đồ lược đồ database
 * tặng miễn phí cho người đang dò. Chi tiết đi vào LOG; người dùng nhận một mã chung.
 */
export function withApiErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      /*
       * ⚠ DÒNG ĐẦU TIÊN CỦA `catch`, không phải dòng cuối.
       *
       * Next dùng `throw` làm cơ chế ĐIỀU KHIỂN LUỒNG: `redirect()`, `notFound()`, `forbidden()`
       * đều ném một `Error` mang `digest` đặc biệt. Một `catch` bắt mọi thứ sẽ NUỐT chúng, và
       * triệu chứng không hề giống nguyên nhân — một lệnh chuyển hướng biến thành 500
       * `INTERNAL_ERROR`, kèm một dòng `[api] LỖI KHÔNG XỬ LÝ` trong log cho một chuyện bình
       * thường.
       *
       * `unstable_rethrow` nhận diện đúng những lỗi đó và ném lại; mọi lỗi khác đi tiếp bình
       * thường. Tên có tiền tố `unstable_` nhưng nó là API công khai của Next cho đúng việc này —
       * và không có cách nào khác để phân biệt mà không đọc `digest` bằng tay.
       *
       * Ca cụ thể đã gặp ở repo này: `requireSession()` gọi từ một route handler. Cách chữa
       * chính là `requireApiSession()` (`lib/account/session.ts`); dòng dưới đây là lưới cho
       * những chỗ chưa ai nghĩ tới.
       */
      unstable_rethrow(error);

      if (error instanceof ApiError) {
        return apiError(error.status, error.code, error.message, error.metadata);
      }

      /*
       * ID LẦN VẾT. Nhánh `/api/` nằm NGOÀI matcher của `proxy.ts` nên nó không có sẵn id — tự
       * sinh ở đây, và đưa nó vào CẢ hai phía: một trường riêng trong log (để grep), và
       * `metadata.requestId` của phản hồi (để người dùng báo lỗi kèm được nó).
       *
       * ⚠ Đưa id vào một TRƯỜNG RIÊNG, đừng trộn vào câu. Các chuỗi sự kiện viết HOA
       * (`[api] LỖI KHÔNG XỬ LÝ`, `[auth] KHÔNG XOAY ĐƯỢC TOKEN`…) là hợp đồng grep/alert đã có
       * lý do ghi ở `lib/account/session.ts`; nhét một giá trị đổi theo mỗi request vào giữa chúng
       * là làm mọi cảnh báo dựng theo chuỗi đó ngừng khớp.
       */
      const requestId = toRequestId(args[0] instanceof Request ? args[0].headers.get(REQUEST_ID_HEADER) : null);
      console.error("[api] LỖI KHÔNG XỬ LÝ", { requestId }, error);
      return apiError(500, ERROR_CODES.INTERNAL_ERROR, "Unexpected server error.", { requestId });
    }
  };
}

export function apiError(
  status: number,
  code: ErrorCode,
  message: string,
  metadata?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: { code, message, ...(metadata ? { metadata } : {}) } }, { status });
}

/**
 * Phản hồi thành công.
 *
 * ⚠ **KHÔNG có envelope thành công**, và đó là quyết định có chủ đích. Một `{ ok: true, data: … }`
 * bọc quanh mọi thứ nghe gọn, nhưng nó bắt MỌI chỗ gọi bóc thêm một lớp mãi mãi để đổi lấy đúng
 * con số không: `response.ok` của HTTP đã nói điều đó rồi, và nhánh lỗi thì đã có hình dạng riêng.
 *
 * Đổi lại, mỗi phương thức của cổng API (`lib/api-client/`) tự khai kiểu trả về viết tay — nhờ vậy
 * `tsc` bắt được sai hình dạng, thứ mà một `request<T>()` tổng quát làm mất.
 */
export function apiOk<T>(body: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(body, init);
}

/** 204 — không có thân. Dùng cho DELETE và cho những thao tác không trả về gì có ích. */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
