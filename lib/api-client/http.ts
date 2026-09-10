import "client-only";
import type { ApiErrorPayload } from "@/lib/contracts/error";
import { ApiError, ERROR_CODES } from "@/lib/core/api-error";

/**
 * Phần HTTP chung của CỔNG API — **nội bộ của `lib/api-client/`, không xuất ra ngoài**.
 *
 * ── VÌ SAO CÓ MỘT TẦNG CỔNG, THAY VÌ `fetch()` NGAY TRONG COMPONENT ──────────────────────
 * Vì `fetch()` trần bắt MỖI chỗ gọi tự đọc `error.code` ra khỏi thân phản hồi, và ai cũng làm
 * thiếu ở đúng một nhánh: nhánh MẠNG HỎNG. Khi đó `catch` nhận một `TypeError` không có `code`, và
 * giao diện hiện "lỗi không xác định" cho mọi sự cố đứt mạng.
 *
 * Cổng đổi CẢ HAI loại — lỗi HTTP và lỗi mạng — thành một `ApiError` mang `code`, nên một nhánh
 * `catch` phục vụ được cả hai và `useErrorMessage()` tra được `errors.*`.
 *
 * ── VÌ SAO KHÔNG PHẢI MỘT `request<T>(path)` CÔNG KHAI ───────────────────────────────────
 * Vì một hàm generic công khai nghĩa là MỖI chỗ gọi tự khai `T`, và `tsc` không còn bắt được sai
 * hình dạng nữa — nó chỉ tin những gì chỗ gọi khai. Helper này vì thế `private` theo quy ước
 * (không tái xuất từ `index.ts`), và **mỗi phương thức của cổng tự khai kiểu trả về viết tay**.
 *
 * ── `client-only` ────────────────────────────────────────────────────────────────────────
 * Cổng gọi đường dẫn TƯƠNG ĐỐI (`/api/...`), thứ không có nghĩa ở phía máy chủ. Import nhầm từ một
 * Server Component sẽ hỏng lúc chạy với một thông điệp khó hiểu; `client-only` biến nó thành lỗi
 * BIÊN DỊCH. Server Component đọc dữ liệu qua `lib/` (Prisma), không qua cổng này.
 */

/**
 * `Response` đã biết là lỗi → `ApiError` mang đúng `code`.
 *
 * Thân không phải JSON (một proxy chen vào, một 502 dạng HTML) vẫn phải cho ra một `code` dùng
 * được: giao diện tra `errors.*` bằng `code`, và `undefined` ở đó làm `t()` ném lỗi lúc render —
 * đổi một thông báo lỗi lấy một trang trắng.
 */
async function toApiError(response: Response): Promise<ApiError> {
  let payload: ApiErrorPayload | undefined;
  try {
    const body = (await response.json()) as { error?: ApiErrorPayload };
    payload = body.error;
  } catch {
    // Rơi xuống nhánh mặc định bên dưới.
  }

  const code = payload?.code ?? ERROR_CODES.INTERNAL_ERROR;
  return new ApiError(response.status, code, payload?.message ?? "", payload?.metadata);
}

interface RequestInput {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Thân JSON. `FormData` đi qua `body` thô bên dưới, không qua đây. */
  json?: unknown;
  body?: BodyInit;
  signal?: AbortSignal;
}

/** Gọi API của chính module. Ném `ApiError` khi máy chủ trả 4xx/5xx **hoặc khi mạng hỏng**. */
export async function callApi<T>(path: string, input: RequestInput = {}): Promise<T> {
  const { method = "GET", json, body, signal } = input;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      /*
       * `same-origin` là mặc định của `fetch` hiện đại, nhưng khai TƯỜNG MINH vì cả cổng này phụ
       * thuộc vào cookie phiên. Một mặc định ngầm là một mặc định sẽ đổi ở một bản trình duyệt nào
       * đó, và khi đổi thì mọi thao tác ghi trả 401 mà không ai nối được nguyên nhân.
       */
      credentials: "same-origin",
      headers: json === undefined ? undefined : { "content-type": "application/json" },
      body: json === undefined ? body : JSON.stringify(json),
      /*
       * ⚠ `no-store` cho MỌI lời gọi của cổng. Đọc lại ngay sau một thao tác GHI mà đi qua HTTP
       * cache của trình duyệt thì thay đổi vừa làm **không xuất hiện** — đúng loại lỗi "chạy đúng
       * trên máy tôi vì tôi bấm chậm".
       */
      cache: "no-store",
      signal
    });
  } catch (error) {
    // `AbortError` là người dùng gõ tiếp / rời trang, KHÔNG phải sự cố — đừng biến nó thành toast đỏ.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, ERROR_CODES.NETWORK_ERROR, "Could not reach the server.");
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
