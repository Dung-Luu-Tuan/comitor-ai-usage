import { callApi } from "@/lib/api-client/http";
import type { AppSettingsView, PermissionMatrix } from "@/lib/contracts/settings";

/**
 * CỔNG API của trang Cài đặt — nửa TRÌNH DUYỆT của hai route handler `PUT /api/settings` và
 * `PUT /api/permissions`.
 *
 * ── VÌ SAO KIỂU TRẢ VỀ VIẾT TAY ───────────────────────────────────────────────────────────
 * `callApi<T>` là generic, nên nó tin bất cứ `T` nào nơi gọi khai. Khai một lần ở đây, cạnh đúng
 * cái URL sinh ra nó, là chỗ duy nhất mà một lần đổi hình dạng phản hồi có thể được bắt lại — rải
 * `callApi<AppSettingsView>(…)` vào từng biểu mẫu thì mỗi biểu mẫu là một lời khai độc lập, và
 * `tsc` không có gì để đối chiếu chúng với nhau.
 *
 * ── VÀ VÌ SAO CẢ HAI TRẢ VỀ GIÁ TRỊ, KHÔNG PHẢI `void` ───────────────────────────────────
 * Vì máy chủ có quyền SỬA thứ nó nhận. `savePermissionMatrix` áp đè hai hằng đúng (chủ sở hữu luôn
 * có mọi quyền, khách không bao giờ ghi) nên ma trận đọc lại có thể khác ma trận vừa gửi. Giao diện
 * lấy bản đọc lại làm bản "đã lưu" — xem `hooks/use-settings-draft.ts`.
 *
 * File này KHÔNG cần `import "client-only"`: `lib/api-client/http.ts` đã mang nó, và mọi đường vào
 * đây đều đi qua đó.
 */

/** Ghi đè TOÀN BỘ cài đặt của module cho không gian làm việc hiện tại. */
export function saveSettings(settings: AppSettingsView): Promise<AppSettingsView> {
  return callApi<AppSettingsView>("/api/settings", { method: "PUT", json: settings });
}

/** Ma trận kèm thẻ phiên bản của chính nó — hình dạng đi cả hai chiều trên `/api/permissions`. */
export interface VersionedMatrix {
  matrix: PermissionMatrix;
  version: string;
}

/**
 * Ghi đè TOÀN BỘ ma trận phân quyền.
 *
 * `version` là thẻ của bản mà người dùng ĐÃ ĐỌC, gửi lại nguyên văn. Máy chủ tính lại thẻ từ bản
 * đang lưu, bên trong giao dịch ghi, và trả **409 `STALE_WRITE`** nếu lệch — nghĩa là có người khác
 * đã lưu trong lúc trang này mở. Không có nó thì người lưu sau ghi đè người lưu trước bằng một ảnh
 * chụp cũ, và thứ vừa mất là một quyết định phân quyền.
 *
 * Trả về ma trận ĐANG CÓ HIỆU LỰC (máy chủ áp đè khoá) kèm thẻ MỚI để lần lưu kế tiếp dùng.
 */
export function savePermissions(matrix: PermissionMatrix, version: string): Promise<VersionedMatrix> {
  return callApi<VersionedMatrix>("/api/permissions", { method: "PUT", json: { version, matrix } });
}
