import { callApi } from "./http";

/** CỔNG API của không gian làm việc — cùng khuôn `./tasks.ts`. */

/**
 * Đổi không gian làm việc đang mở.
 *
 * ⚠ Sau lời gọi này phải **tải lại cả trang**, không chỉ `router.refresh()`: workspace đổi nghĩa
 * là MỌI dữ liệu trên màn hình đổi theo — kể cả những thứ layout đã đọc (thông báo, số việc mở,
 * tập quyền). `refresh()` dựng lại cây server nhưng giữ state của các đảo client, và một bộ lọc
 * còn sót lại của workspace cũ là một màn hình nói sai.
 */
export async function switchWorkspace(slug: string): Promise<{ slug: string }> {
  return callApi<{ slug: string }>("/api/workspace", { method: "PUT", json: { slug } });
}
