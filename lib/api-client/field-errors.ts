import type { ApiError } from "@/lib/core/api-error";

/**
 * Rút DANH SÁCH TRƯỜNG SAI ra khỏi một lỗi API.
 *
 * ── VÌ SAO HÀM NÀY PHẢI TỒN TẠI ─────────────────────────────────────────────────────────
 * Máy chủ dựng `metadata.fields` ở **năm chỗ** và `lib/api-client/http.ts` mang `metadata` sang
 * `ApiError` nguyên vẹn — rồi **không ai đọc nó**. Hạ tầng TRÔNG như đủ, và người dùng gặp "dự án
 * đã đóng" chỉ thấy một câu chung, phải tự đoán ô nào sai trong một biểu mẫu có hơn hai chục ô.
 *
 * ⚠ Hàm này chỉ trả TÊN TRƯỜNG, không trả câu chữ. Câu chữ do nơi gọi tra từ `messages/` bằng
 * `useErrorMessage()` — giữ đúng luật "không chuỗi hiển thị ngoài `messages/`", và giữ luôn khả
 * năng một biểu mẫu nói câu khác cho cùng một mã lỗi khi ngữ cảnh của nó khác.
 */

/** Hình dạng `metadata` mà `ApiError.validation()` và các lỗi nghiệp vụ đặt vào. */
interface FieldMetadata {
  fields?: unknown;
}

/**
 * @returns tập tên trường mà máy chủ nói là sai. Rỗng khi lỗi không mang thông tin đó — nơi gọi
 *   khi ấy hiện một thông báo chung, chứ không đoán bừa một ô.
 */
export function fieldsInError(error: unknown): Set<string> {
  const metadata = (error as { metadata?: FieldMetadata } | null)?.metadata;
  const fields = metadata?.fields;
  if (!Array.isArray(fields)) return new Set();

  /*
   * Lọc lấy chuỗi: `metadata` đi qua JSON từ máy chủ, nên kiểu của nó là lời khai chứ không phải
   * bảo đảm. Một phần tử không phải chuỗi lọt vào đây sẽ thành một khoá `Set` không bao giờ khớp —
   * im lặng, và rất khó lần ra.
   */
  return new Set(fields.filter((field): field is string => typeof field === "string"));
}

/**
 * Tên trường mà một MÃ LỖI NGHIỆP VỤ nói tới.
 *
 * `VALIDATION_ERROR` mang sẵn `metadata.fields`, nhưng các mã nghiệp vụ thì không — chúng nói về
 * một tình huống (`PROJECT_CLOSED`), và việc "tình huống đó thuộc ô nào" là kiến thức của GIAO
 * DIỆN, không của máy chủ. Bảng này là chỗ giữ kiến thức đó, một chỗ.
 */
const CODE_TO_FIELD: Record<string, string> = {
  PROJECT_NOT_FOUND: "projectId",
  PROJECT_CLOSED: "projectId",
  ASSIGNEE_NOT_IN_WORKSPACE: "assigneeUserId",
  TASK_CODE_TAKEN: "code",
  ATTACHMENT_TOO_LARGE: "file",
  ATTACHMENT_TYPE_INVALID: "file",
  ATTACHMENT_EMPTY: "file"
};

/** Gộp cả hai nguồn: `metadata.fields` của máy chủ và bảng suy từ mã lỗi. */
export function errorFields(error: unknown): Set<string> {
  const fields = fieldsInError(error);
  const code = (error as Partial<ApiError> | null)?.code;
  const mapped = typeof code === "string" ? CODE_TO_FIELD[code] : undefined;
  if (mapped) fields.add(mapped);
  return fields;
}
