import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/account/session";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { ApiError } from "@/lib/core/api-error";
import {
  getPermissionMatrix,
  permissionMatrixVersion,
  requirePermission,
  savePermissionMatrix
} from "@/lib/permissions";

/**
 * `PUT /api/permissions` — ghi đè toàn bộ ma trận **vai trò × quyền** của module.
 *
 * ── VÌ SAO CẢ MA TRẬN, KHÔNG PHẢI TỪNG Ô ─────────────────────────────────────────────────
 * Vì ma trận là MỘT giá trị. Một endpoint "bật/tắt một ô" nghĩa là 48 lời gọi cho một lần bấm Lưu,
 * và có những khoảnh khắc bảng ở trạng thái nửa cũ nửa mới — một request đọc rơi vào đó sẽ thấy một
 * tập quyền chưa bao giờ được ai chọn. `savePermissionMatrix` ghi trong MỘT giao dịch.
 *
 * ── VÌ SAO TRẢ VỀ MA TRẬN ĐỌC LẠI ────────────────────────────────────────────────────────
 * Vì máy chủ có quyền SỬA thứ nó nhận: `applyPermissionLocks` áp đè hai hằng đúng của module (chủ
 * sở hữu luôn có mọi quyền, khách không bao giờ có quyền ghi). Trả về đúng cái client vừa gửi sẽ để
 * giao diện tin vào một ma trận mà database không hề chứa — và người dùng chỉ phát hiện ra sau khi
 * tải lại trang.
 */

/**
 * ⚠ MƯỜI HAI MÃ QUYỀN VIẾT TƯỜNG MINH, cùng lý do với `app/api/settings/route.ts`: bản sinh động
 * từ `PERMISSION_RULES` cho ra `Record<string, boolean>`, tức một lược đồ không kiểm được gì. Viết
 * tay thì ngày ai đó thêm một quyền vào `AppPermissionId`, `savePermissionMatrix(...)` dưới kia ĐỎ
 * ngay vì thiếu khoá.
 *
 * ⚠ Dấu CHẤM ở đây là an toàn: đây là khoá JSON, không phải khoá `messages/*.json`. Chỗ dấu chấm
 * làm hỏng cả app là bộ chuỗi — xem `toPermissionMessageKey()` trong `lib/catalog/permissions.ts`.
 */
const permissionFlagsSchema = z.object({
  "task.view": z.boolean(),
  "task.create": z.boolean(),
  "task.edit": z.boolean(),
  "task.assign": z.boolean(),
  "task.delete": z.boolean(),
  "project.view": z.boolean(),
  "project.create": z.boolean(),
  "report.view": z.boolean(),
  "report.export": z.boolean(),
  "app.settings": z.boolean(),
  "app.permissions": z.boolean()
});

/** Bốn vai trò THÔ của Comitor.Account — module chỉ đọc chúng, không phát thêm vai trò thứ năm. */
const matrixSchema = z.object({
  owner: permissionFlagsSchema,
  admin: permissionFlagsSchema,
  member: permissionFlagsSchema,
  guest: permissionFlagsSchema
});

/**
 * Thân của `PUT`: ma trận **kèm thẻ phiên bản** của bản mà client đã đọc.
 *
 * ⚠ `version` là BẮT BUỘC, và thiếu nó là 400 chứ không phải "bỏ qua phép so". Một phép kiểm chỉ
 * chạy khi client chịu gửi tham số là một phép kiểm không tồn tại — client cũ, client viết vội, hay
 * một lệnh `curl` chép từ tài liệu cũ đều sẽ bỏ nó, và đường ghi đè im lặng quay lại nguyên vẹn.
 */
const putSchema = z.object({
  version: z.string().min(1),
  matrix: matrixSchema
});

export const PUT = withApiErrors(async (request: NextRequest) => {
  const session = await requireApiSession();

  /*
   * Quyền SỬA BẢNG QUYỀN, không phải quyền đổi cài đặt: `app.permissions` mặc định chỉ chủ sở hữu
   * có. Đây là chốt thật — giao diện đã chuyển bảng sang chế độ chỉ đọc cho người thiếu quyền,
   * nhưng ẩn một nút không phải là phân quyền.
   */
  await requirePermission(session.workspace.id, session.role, "app.permissions");

  const body: unknown = await request.json().catch(() => {
    throw ApiError.validation("Request body is not valid JSON.");
  });

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    throw ApiError.validation("Invalid permission matrix payload.", {
      fields: parsed.error.issues.map((issue) => issue.path.join("."))
    });
  }

  /*
   * Phép so thẻ nằm BÊN TRONG giao dịch của `savePermissionMatrix` — xem khối chú thích ở đó. Đọc
   * lại rồi so ở ĐÂY sẽ chỉ hẹp cửa sổ đua chứ không đóng nó, mà một phép kiểm hẹp cửa sổ trông y
   * hệt một phép kiểm đóng cửa sổ.
   */
  await savePermissionMatrix(session.workspace.id, parsed.data.matrix, parsed.data.version);

  return apiOk({
    matrix: await getPermissionMatrix(session.workspace.id),
    version: await permissionMatrixVersion(session.workspace.id)
  });
});
