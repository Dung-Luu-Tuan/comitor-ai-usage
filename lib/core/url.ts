/**
 * Quy tắc về URL — hàm THUẦN, tầng 1 (xem `docs/kien-truc-ung-dung.md` §4).
 *
 * Ở đây vì `lib/env.ts` cần chúng lúc KHỞI ĐỘNG, mà `lib/env.ts` là mã chỉ chạy ở máy chủ và
 * không test được. Tách phần quyết định ra tầng thuần thì `vitest` khoá được từng ca biên — kể cả
 * ca `localhost.` với dấu chấm cuối, thứ không ai nghĩ tới cho tới lúc nó vượt qua một bộ lọc.
 */

/**
 * Những host được coi là "máy của chính mình", tức được phép dùng `http://` trần.
 *
 * ⚠ `[::1]` viết CẢ HAI dạng: `URL.hostname` của WHATWG trả về IPv6 kèm dấu ngoặc vuông
 * (`new URL("http://[::1]:3000").hostname === "[::1]"`), nhưng người viết `.env` bằng tay thì gõ
 * `::1`. So thiếu một dạng là một nửa số ca hợp lệ bị từ chối lúc khởi động.
 */
export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

/**
 * Chuẩn hoá hostname trước khi so sánh: hạ chữ thường và CẮT dấu chấm cuối.
 *
 * ⚠ Dấu chấm cuối là một đường vòng có thật. `new URL("http://localhost./x").hostname` giữ nguyên
 * `"localhost."`, và DNS thì coi `localhost.` và `localhost` là một. Nghĩa là một phép so chuỗi
 * thẳng vừa TỪ CHỐI một địa chỉ hợp lệ, vừa — ở một bộ lọc chặn thay vì cho phép — CHO QUA đúng
 * cái host mà nó định chặn.
 */
export function normalizeHost(hostname: string): string {
  return hostname.replace(/\.+$/, "").toLowerCase();
}

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(normalizeHost(hostname));
}
