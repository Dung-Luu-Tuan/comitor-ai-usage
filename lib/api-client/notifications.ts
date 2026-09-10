import { callApi } from "./http";

/** CỔNG API của thông báo — cùng khuôn `./tasks.ts`. */

/**
 * Đánh dấu mọi thông báo của người đang đăng nhập là đã đọc.
 *
 * @returns số thông báo thật sự đổi — giao diện dùng nó để không hiện toast khi không có gì đổi.
 */
export async function markNotificationsRead(): Promise<{ count: number }> {
  return callApi<{ count: number }>("/api/notifications", { method: "PATCH" });
}
