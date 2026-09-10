import { requireApiSession } from "@/lib/account/session";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { ApiError, ERROR_CODES } from "@/lib/core/api-error";
import { MAX_ATTACHMENT_BYTES } from "@/lib/core/attachment";
import { requirePermission } from "@/lib/permissions";
import { clearTaskAttachment, setTaskAttachment } from "@/lib/tasks";

/**
 * `POST` / `DELETE /api/tasks/{taskId}/attachment` — gắn và gỡ tệp đính kèm.
 *
 * ── HẠ TẦNG ĐÃ CÓ SẴN 90%; 20% NẰM Ở ĐÂY, VÀ NÓ CHỨA TOÀN BỘ QUYẾT ĐỊNH BẢO MẬT ─────────
 * Bucket riêng tư, URL ký theo cửa sổ 15 phút, kẹp `expiresIn` theo hạn credential, khoá mang tiền
 * tố `{APP_ID}/attachment/…`, `lib/core/attachment.ts` với gần 40 phép kiểm — tất cả đã có trước
 * file này. Cái chưa có là **cửa**, và cửa là chỗ ba quyết định dưới đây phải đúng.
 *
 * ── 1. TỪ CHỐI THEO KÍCH THƯỚC **TRƯỚC** KHI ĐỌC THÂN REQUEST ───────────────────────────
 * `request.formData()` đọc TRỌN thân vào bộ nhớ. Kiểm kích thước sau lời gọi đó nghĩa là một tệp
 * 500 MB vẫn được nuốt hết rồi mới bị từ chối — tức bất kỳ ai có một phiên hợp lệ cũng làm cạn bộ
 * nhớ máy chủ bằng vài request song song. `Content-Length` là thứ duy nhất đọc được TRƯỚC.
 *
 * ⚠ `Content-Length` là lời khai của phía kia, nên nó KHÔNG thay được phép kiểm kích thước thật —
 * nó chỉ là cái chặn rẻ ở cửa. Kích thước thật được kiểm lại ở `lib/tasks.ts` trên byte đã đọc.
 *
 * ── 2. KIỂU TỆP ĐỌC TỪ NỘI DUNG, KHÔNG TỪ LỜI KHAI ─────────────────────────────────────
 * Ở `lib/tasks.ts`, qua `sniffImageType`. Xem lý do ở đó.
 *
 * ── 3. TỆP THUỘC VỀ MỘT CÔNG VIỆC CỦA ĐÚNG KHÔNG GIAN LÀM VIỆC ────────────────────────
 * `taskId` đến TỪ URL. `lib/tasks.ts` tra bằng `findFirst({ where: { workspaceId, id } })` và trả
 * **404** cho id của workspace khác. Không có phép kiểm đó thì một id đoán được là một đường ghi
 * tệp vào công việc của khách hàng khác.
 */

type RouteContext = { params: Promise<{ taskId: string | string[] }> };

function readTaskId(raw: string | string[]): string {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!value) throw ApiError.validation("Task id is missing from the URL.", { fields: ["taskId"] });
  return value;
}

export const POST = withApiErrors(async (request: Request, context: RouteContext) => {
  const session = await requireApiSession();
  await requirePermission(session.workspace.id, session.role, "task.edit");

  const taskId = readTaskId((await context.params).taskId);

  /*
   * Cửa thứ nhất. `multipart/form-data` thêm phần bao ngoài quanh nội dung, nên `Content-Length`
   * luôn lớn hơn kích thước tệp một chút — cộng một biên 1 KB để không từ chối nhầm một tệp đúng
   * bằng giới hạn. Biên rộng hơn thế thì phép kiểm mất ý nghĩa; hẹp hơn thì nó báo nhầm.
   */
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_ATTACHMENT_BYTES + 1024) {
    throw new ApiError(413, ERROR_CODES.ATTACHMENT_TOO_LARGE, "Attachment is too large.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw ApiError.validation("Request body is not valid multipart form data.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw ApiError.validation("Field `file` is missing or is not a file.", { fields: ["file"] });
  }

  return apiOk(
    await setTaskAttachment(session, taskId, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      name: file.name
    })
  );
});

export const DELETE = withApiErrors(async (_request: Request, context: RouteContext) => {
  const session = await requireApiSession();
  await requirePermission(session.workspace.id, session.role, "task.edit");

  /*
   * Trả `TaskView` chứ không 204: chỗ gọi cần bản ghi SAU khi gỡ để vẽ lại — và nếu nó phải gọi
   * thêm một lần đọc nữa thì giữa hai lời gọi đó có một khoảng mà màn hình nói sai.
   */
  return apiOk(await clearTaskAttachment(session, readTaskId((await context.params).taskId)));
});
