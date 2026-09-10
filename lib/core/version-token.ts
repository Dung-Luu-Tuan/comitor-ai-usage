/**
 * Thẻ phiên bản cho các lệnh ghi ĐÈ CẢ GIÁ TRỊ.
 *
 * ── VẤN ĐỀ ────────────────────────────────────────────────────────────────────────────────
 * `PUT /api/permissions` gửi CẢ ma trận. Hai quản trị viên cùng mở tab Phân quyền lúc 9:00; A tắt
 * `task.delete` của `member` và lưu lúc 9:05; B bật `report.export` và lưu lúc 9:06 — bằng bản chụp
 * từ 9:00. Thay đổi của A biến mất, **không có gì báo cho ai**, và thứ vừa mất là một quyết định
 * bảo mật. Giao dịch không cứu được: nó bảo đảm không ai ĐỌC được trạng thái nửa vời, chứ không nói
 * gì về việc lệnh sau ghi đè lệnh trước.
 *
 * ── VÌ SAO BĂM NỘI DUNG, KHÔNG PHẢI `updatedAt`, KHÔNG PHẢI CỘT ĐẾM ────────────────────────
 * Ba lý do, và cả ba là lý do một module CHƯA TỒN TẠI vẫn áp dụng được:
 *
 * · **Không cần migration.** `role_permissions` không có cột thời gian nào. Một cột `version` thì
 *   phải thêm vào MỌI bảng có đường ghi đè, và bảng thêm quý sau lại quên. Băm chạy được trên một
 *   bảng chưa tồn tại.
 * · **Không có đồng hồ để lệch.** `@updatedAt` của Prisma do TIẾN TRÌNH APP đặt, không phải
 *   database. N instance là N đồng hồ; lệch giờ thì một bản ghi MỚI có thể mang mốc CŨ HƠN, và
 *   phép so `updatedAt` khi đó **im lặng cho qua** — đúng hạng lỗi repo này ghét nhất.
 * · **Không có bộ đếm để lệch.** AGENTS.md đã có luật "con số nào suy được thì suy, đừng thêm cột
 *   đếm". Một cột `version` LÀ một bộ đếm, và nó lệch ở lần đầu tiên có ai ghi bằng đường không đi
 *   qua chỗ tăng nó. Băm là giá trị SUY RA — không lệch được, vì không có gì để lệch.
 *
 * ⚠ Băm này KHÔNG phải để chống giả mạo. Nó phát hiện THAY ĐỔI NGẪU NHIÊN giữa lúc đọc và lúc ghi,
 * không phải một kẻ tấn công cố tình dựng va chạm — kẻ đó đã có `PUT` trong tay và không cần va
 * chạm để làm gì. FNV-1a 32-bit là đủ và không kéo `node:crypto` xuống tầng 1 (xem
 * `lib/core/request-id.ts` về lý do tầng 1 tránh API riêng của Node).
 */

/**
 * Tuần tự hoá ỔN ĐỊNH: khoá được sắp xếp ở mọi độ sâu.
 *
 * ⚠ `JSON.stringify` giữ THỨ TỰ CHÈN, nên cùng một ma trận đọc từ hai đường khác nhau cho ra hai
 * chuỗi khác nhau và thẻ sẽ lệch — tức 409 cho một lần ghi hoàn toàn hợp lệ. Một cổng báo động
 * giả là một cổng sẽ bị tắt.
 */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}

/** FNV-1a 32-bit. Không phải mật mã — xem khối chú thích đầu file. */
export function versionOf(value: unknown): string {
  const text = stable(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
