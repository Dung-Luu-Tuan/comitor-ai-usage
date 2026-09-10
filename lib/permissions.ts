import "server-only";
import { APP_PERMISSION_IDS, PERMISSION_RULES, WORKSPACE_ROLES } from "@/lib/catalog/permissions";
import type { WorkspaceRoleId } from "@/lib/contracts/account";
import type { AppPermissionId, PermissionMatrix } from "@/lib/contracts/settings";
import { ApiError } from "@/lib/core/api-error";
import { applyPermissionLocks, buildPermissionMatrix, can } from "@/lib/core/permissions";
import { versionOf } from "@/lib/core/version-token";
import { prisma } from "@/lib/prisma";

/**
 * Đọc và ghi MA TRẬN PHÂN QUYỀN của module.
 *
 * ⚠ **ẨN MỘT NÚT KHÔNG PHẢI LÀ PHÂN QUYỀN.** Bảng này quyết định giao diện hiện gì; chốt THẬT là
 * `requirePermission()` ở cuối file, và mọi đường GHI phải đi qua nó. Giao diện chỉ giúp người dùng
 * không bấm vào chỗ họ sẽ bị từ chối.
 */

/**
 * Ma trận đang có hiệu lực cho một không gian làm việc.
 *
 * ── BA BƯỚC, VÀ BƯỚC THỨ BA LÀ BƯỚC QUAN TRỌNG NHẤT ──────────────────────────────────────
 *   1. dựng ma trận MẶC ĐỊNH từ `PERMISSION_RULES` (bảng khai của module);
 *   2. trải những dòng đã lưu trong `role_permissions` lên trên;
 *   3. **áp đè lại hai hằng đúng** (`applyPermissionLocks`).
 *
 * Bước 3 không thừa. Dữ liệu trong database KHÔNG được tin: một dòng `guest × task.delete = true`
 * có thể lọt vào do một migration cũ, do sửa tay lúc gỡ lỗi, hoặc do một phiên bản trước của mã
 * ghi mà không kiểm. Áp đè ở TẦNG ĐỌC nghĩa là mọi dòng như vậy vô hiệu ngay lập tức; áp đè ở tầng
 * ghi thì dữ liệu cũ vẫn thoát, và nó sẽ thoát mãi mãi vì không ai ghi lại những dòng đó nữa.
 *
 * ⚠ Quyền mới thêm vào `PERMISSION_RULES` mà chưa có dòng nào trong database sẽ nhận giá trị MẶC
 * ĐỊNH của nó — đó là hành vi đúng và là lý do bước 1 tồn tại. Không có nó thì mọi quyền mới im
 * lặng thành `false` cho mọi vai trò, kể cả chủ sở hữu.
 */
export async function getPermissionMatrix(workspaceId: string): Promise<PermissionMatrix> {
  const [rows] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { workspaceId },
      select: { roleId: true, permissionId: true, granted: true }
    })
  ]);

  const matrix = buildPermissionMatrix(PERMISSION_RULES, WORKSPACE_ROLES);

  for (const row of rows) {
    const role = matrix[row.roleId as WorkspaceRoleId];
    if (!role) continue;
    // Quyền lạ (đã bị gỡ khỏi `PERMISSION_RULES`) thì bỏ qua — đừng dựng lại một cột đã chết.
    if (!(row.permissionId in role)) continue;
    role[row.permissionId as AppPermissionId] = row.granted;
  }

  return applyPermissionLocks(matrix, PERMISSION_RULES, WORKSPACE_ROLES);
}

/**
 * Ghi lại toàn bộ ma trận.
 *
 * ── VÌ SAO `deleteMany` + `createMany` TRONG MỘT GIAO DỊCH, KHÔNG PHẢI 48 LẦN `upsert` ────
 * Vì ma trận là MỘT giá trị, không phải 48 giá trị độc lập. 48 lần `upsert` nghĩa là có những
 * khoảnh khắc ma trận ở trạng thái NỬA CŨ NỬA MỚI, và một request đọc rơi đúng vào đó sẽ thấy một
 * tập quyền chưa bao giờ được ai chọn. Một giao dịch thì hoặc thấy hết cũ, hoặc thấy hết mới.
 *
 * ⚠ Vẫn áp đè `applyPermissionLocks` TRƯỚC KHI GHI, dù `getPermissionMatrix` cũng áp đè lúc đọc.
 * Hai lần không thừa: ghi sạch giữ cho database không chứa dòng mâu thuẫn (thứ sẽ gây hiểu nhầm
 * cho bất kỳ ai đọc bảng bằng SQL), còn áp đè lúc đọc là lưới an toàn cho dữ liệu ĐÃ có từ trước.
 */
export async function savePermissionMatrix(
  workspaceId: string,
  matrix: PermissionMatrix,
  expectedVersion: string
): Promise<void> {
  const safe = applyPermissionLocks(matrix, PERMISSION_RULES, WORKSPACE_ROLES);

  const rows = WORKSPACE_ROLES.flatMap((roleId) =>
    PERMISSION_RULES.map((rule) => ({
      workspaceId,
      roleId,
      permissionId: rule.id,
      granted: safe[roleId][rule.id] === true
    }))
  );

  /*
   * ⚠ GIAO DỊCH TƯƠNG TÁC, không phải dạng mảng — và đó là toàn bộ điểm mấu chốt.
   *
   * Đọc lại ma trận rồi so thẻ Ở NGOÀI giao dịch thì chỉ HẸP cửa sổ đua lại vài mili-giây, không
   * đóng nó: giữa lần đọc để so và lần ghi, một lệnh khác vẫn chen vào được. So BÊN TRONG giao
   * dịch thì lần đọc và lần ghi ở cùng một ảnh chụp, nên hoặc thẻ khớp và bản ghi đi trọn, hoặc
   * giao dịch bị huỷ.
   *
   * ⚠ Và thẻ phải tính từ bản ĐANG LƯU, không phải từ payload gửi lên. Tính từ payload thì nó luôn
   * khớp với chính nó — một phép kiểm bảo vệ bằng KHÔNG, nhưng trông y hệt một phép kiểm thật.
   */
  await prisma.$transaction(async (tx) => {
    const current = await tx.rolePermission.findMany({
      where: { workspaceId },
      select: { roleId: true, permissionId: true, granted: true }
    });

    if (versionOf(toVersionInput(current)) !== expectedVersion) {
      throw ApiError.stale();
    }

    await tx.rolePermission.deleteMany({ where: { workspaceId } });
    await tx.rolePermission.createMany({ data: rows });
  });
}

/**
 * Hình dạng dùng để tính thẻ phiên bản — **một** biểu diễn cho cả đường đọc lẫn đường ghi.
 *
 * ⚠ Hai chỗ tính thẻ theo hai cách là hai thẻ không bao giờ khớp, tức 409 cho mọi lần lưu. Vì vậy
 * `permissionMatrixVersion()` (đường đọc) và phép so trong giao dịch (đường ghi) đều đi qua đây,
 * và cả hai bắt đầu từ CÁC HÀNG THÔ chứ không từ ma trận đã dựng: ma trận đã dựng mang cả những ô
 * `applyPermissionLocks` áp đè, nên hai bản ghi database khác nhau có thể cho ra cùng một ma trận.
 * Thẻ phải nói về thứ NẰM TRONG BẢNG.
 */
function toVersionInput(rows: Array<{ roleId: string; permissionId: string; granted: boolean }>): string[] {
  return rows.map((row) => `${row.roleId}:${row.permissionId}:${row.granted ? 1 : 0}`).sort();
}

/**
 * Thẻ phiên bản của ma trận đang lưu — đi kèm ma trận ra tới trình duyệt, rồi quay về nguyên văn
 * trong thân của `PUT`.
 */
export async function permissionMatrixVersion(workspaceId: string): Promise<string> {
  const rows = await prisma.rolePermission.findMany({
    where: { workspaceId },
    select: { roleId: true, permissionId: true, granted: true }
  });
  return versionOf(toVersionInput(rows));
}

/**
 * CHỐT THẬT. Mọi route handler và mọi Server Action làm việc GHI phải gọi hàm này.
 *
 * ⚠ Nó đọc CÙNG bảng mà giao diện đọc — đó là điểm mấu chốt. Một phép kiểm quyền viết riêng ở máy
 * chủ ("chỉ admin mới được xoá") là một nguồn sự thật THỨ HAI, và hai nguồn thì sớm muộn nói khác
 * nhau: quản trị viên tắt một ô trong bảng, giao diện ẩn nút, mà API vẫn cho qua.
 *
 * Ném `ApiError` 403 chứ không trả `false`: nơi gọi không phải nhớ kiểm giá trị trả về, và một chỗ
 * quên kiểm sẽ là một chỗ bỏ qua phân quyền trong im lặng.
 */
export async function requirePermission(
  workspaceId: string,
  roleId: WorkspaceRoleId,
  permissionId: AppPermissionId
): Promise<void> {
  const matrix = await getPermissionMatrix(workspaceId);
  if (!can(matrix, roleId, permissionId)) {
    throw ApiError.forbidden(`Role "${roleId}" is not allowed to "${permissionId}".`);
  }
}

/**
 * CHỐT QUYỀN **ĐỌC** — cho rìa A (Server Component), song sinh với `requirePermission` của rìa B.
 *
 * ── VÌ SAO CẦN MỘT HÀM RIÊNG THAY VÌ DÙNG LẠI `requirePermission` ────────────────────────
 * Vì hai rìa nói "không được phép" bằng hai ngôn ngữ khác nhau. Rìa B trả một **mã** (`403` +
 * `FORBIDDEN`) cho một client đọc JSON; rìa A phải trả một **màn hình** cho một con người. Ném
 * `ApiError` từ một Server Component chỉ cho ra `app/error.tsx` với câu "đã có lỗi xảy ra" — sai
 * hoàn toàn: không có lỗi nào cả, người dùng chỉ không có quyền.
 *
 * ── VÌ SAO `notFound()` CHỨ KHÔNG PHẢI MỘT MÀN "BẠN KHÔNG CÓ QUYỀN" ────────────────────
 * Cùng lý do mà bản ghi của workspace khác trả 404: một màn hình nói "bạn không được xem BẢNG CÔNG
 * VIỆC" xác nhận rằng có một bảng công việc ở đó. Với một quyền bị tắt thì điều đúng là màn hình
 * ấy **không tồn tại** đối với người này — và `lib/catalog/navigation.ts` cũng phải giấu mục
 * tương ứng khỏi thanh bên, nếu không ta lại nói ra đúng thứ vừa giấu.
 *
 * ⚠ **Đừng dùng lại `components/access-denied.tsx`** cho ca này. Nó nhận đúng bốn mã guard của
 * Comitor.Account (`NOT_A_MEMBER`, `APP_NOT_ENABLED`, `NO_SEAT`, `APP_SUSPENDED`) và mỗi mã dẫn
 * tới một hành động khác nhau ở Account. Từ chối theo ma trận quyền của MODULE là chuyện thứ năm,
 * và nhét nó vào đó là làm hỏng hợp đồng bốn-mã-bốn-màn-hình mà SDK dựng lên.
 */
export async function requireReadPermission(
  workspaceId: string,
  roleId: WorkspaceRoleId,
  permissionId: AppPermissionId
): Promise<void> {
  const matrix = await getPermissionMatrix(workspaceId);
  if (can(matrix, roleId, permissionId)) return;

  /*
   * ⚠ `import()` ĐỘNG, không phải import tĩnh ở đầu file — và đây không phải chuyện phong cách.
   *
   * `next/navigation` kéo theo runtime client của React. Một import TĨNH ở đây làm cả
   * `lib/permissions.ts` không nạp được bằng `tsx`, tức `requirePermission()` — hàm mà `pnpm seed`,
   * một job nền hay một script bảo trì đều có thể cần — chết theo. Đúng lớp lỗi mà tầng D đã gặp
   * một lần với `@comitor/ui` (xem `lib/core/task-input.ts`), chỉ đổi tên gói.
   *
   * Hoãn lại thì chỉ CHÍNH hàm này cần Next, và nó là hàm của rìa A nên điều đó đúng. Cùng khuôn
   * mà `lib/account/session.ts` dùng cho `getAccountContext`.
   *
   * `pnpm lint` canh luật này: tầng dữ liệu bị cấm import tĩnh `next/*`.
   */
  // biome-ignore lint/style/noRestrictedImports: import() ĐỘNG là CÁCH CHỮA mà luật này chỉ tới, không phải vi phạm — nó giữ file nạp được bằng tsx.
  const { notFound } = await import("next/navigation");
  notFound();
}

/**
 * Tập quyền của một vai trò, dạng THUẦN — để truyền qua ranh giới server → client.
 *
 * ⚠ Truyền tập QUYỀN chứ không truyền ma trận. Một ma trận đi xuống trình duyệt là một ma trận có
 * thể bị sửa trước khi được hỏi; một mảng mã quyền thì chỉ trả lời được đúng câu hỏi "vai trò này
 * có gì", và đó là tất cả những gì giao diện cần để ẩn/hiện. Chốt thật vẫn ở hai hàm trên.
 */
export async function grantedPermissions(workspaceId: string, roleId: WorkspaceRoleId): Promise<AppPermissionId[]> {
  const matrix = await getPermissionMatrix(workspaceId);
  return APP_PERMISSION_IDS.filter((id) => can(matrix, roleId, id));
}
