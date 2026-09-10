/**
 * Chặn một route handler GHI lọt ra ngoài mà không có chốt quyền ở máy chủ.
 *
 * ── VÌ SAO CỔNG NÀY QUAN TRỌNG HƠN VẺ NGOÀI CỦA NÓ ────────────────────────────────────────
 * AGENTS.md viết: *"Ẩn một nút không phải là phân quyền. Chốt THẬT là `requirePermission()`, và
 * mọi route handler làm việc GHI phải gọi nó."* Bốn route ghi hiện có đều gọi đúng — và **không
 * có gì bắt route thứ mười một**. `tsc` không biết luật này, Biome không biết, `pnpm build` không
 * biết. Chỗ duy nhất nó được phát biểu là một câu trong tài liệu, mà một câu trong tài liệu không
 * chặn được gì.
 *
 * Kiểu hỏng cụ thể: người viết route mới sao chép một route ĐỌC làm khuôn, thêm `POST`, quên chốt
 * quyền. Giao diện vẫn ẩn nút đúng nên không ai thấy gì bất thường — cho tới khi có người gọi
 * thẳng bằng `curl`.
 *
 * ── HAI ĐIỀU KIỆN, VÀ CHÚNG KHÔNG THAY THẾ NHAU ───────────────────────────────────────────
 *  1. **`requirePermission(` được GỌI** — chốt quyền.
 *  2. **Handler bọc trong `withApiErrors`** — hàng rào chặn `error.message` của Prisma (tên bảng,
 *     tên cột, đôi khi cả câu truy vấn) rò ra ngoài. Một route ghi có quyền nhưng rò lược đồ vẫn
 *     là một route hỏng.
 *
 * ⚠ Phải BỎ COMMENT trước khi tìm. Bốn route hiện có đều *nhắc tới* `requirePermission` trong
 * phần giải thích; một cổng đọc cả comment sẽ báo xanh cho đúng ca nó sinh ra để bắt.
 *
 * ── VÌ SAO KHÔNG CÓ ALLOWLIST THEO ĐƯỜNG DẪN ──────────────────────────────────────────────
 * Một danh sách đường dẫn được miễn trừ sẽ cũ đi trong im lặng và không mang theo lý do. Chỗ ghi
 * lý do đúng là **chính file được miễn trừ**, nên cổng này nhận một chỉ thị trong comment:
 *
 *     // @api-guard: <lý do, viết đủ câu>
 *
 * Ba ca hợp lệ đã thấy trước: đích nhận webhook và back-channel logout của Account (không có
 * phiên người dùng nào để mà hỏi quyền — chúng tự xác thực bằng chữ ký), và các route hạ tầng
 * kiểu `/api/health`. Ba route `app/api/auth/*` hôm nay chỉ export `GET` nên nằm ngoài phạm vi
 * một cách tự nhiên — ngày `sign-out` đổi sang `POST` thì nó sẽ cần một chỉ thị như trên.
 *
 * Chạy: `pnpm api:check`
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./strip-comments";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const API_DIR = join(ROOT, "app", "api");

/** Phương thức HTTP làm thay đổi trạng thái. `GET` và `HEAD` nằm ngoài — chúng đọc. */
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

/** Chỉ thị miễn trừ, kèm lý do. Lý do RỖNG không được tính — nó chính là thứ ta muốn đọc. */
const GUARD_DIRECTIVE = /@api-guard:\s*(\S.*)/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

/**
 * Hai hình dạng export cùng tồn tại trong repo, và cả hai đều hợp lệ:
 *   `export const POST = withApiErrors(async (request) => …)`   ← route nghiệp vụ
 *   `export async function GET(request) { … }`                  ← ba route của luồng xác thực
 */
function exportedWriteMethods(source: string): string[] {
  return WRITE_METHODS.filter((method) => {
    const asConst = new RegExp(`export\\s+const\\s+${method}\\s*[:=]`);
    const asFunction = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\s*\\(`);
    return asConst.test(source) || asFunction.test(source);
  });
}

const problems: string[] = [];
const exempted: string[] = [];
let guarded = 0;

for (const file of walk(API_DIR)) {
  const raw = readFileSync(file, "utf8");
  const source = stripComments(raw);
  const methods = exportedWriteMethods(source);
  if (methods.length === 0) continue;

  const where = relative(ROOT, file);
  const label = `${where} (${methods.join(", ")})`;

  const directive = raw.match(GUARD_DIRECTIVE);
  if (directive) {
    exempted.push(`${label} — ${directive[1]?.trim()}`);
    continue;
  }

  if (!source.includes("requirePermission(")) {
    problems.push(`${label} — không gọi requirePermission()`);
  }
  if (!source.includes("withApiErrors")) {
    problems.push(`${label} — không bọc withApiErrors`);
  }
  guarded += 1;
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} route handler GHI thiếu chốt:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\n  Ẩn một nút KHÔNG phải là phân quyền — một `curl` không đọc giao diện.\n" +
      "  Thêm `await requirePermission(workspaceId, session.role, <quyền>)` vào đầu handler,\n" +
      "  và bọc handler trong `withApiErrors` để lỗi Prisma không rò lược đồ ra ngoài.\n" +
      "  Route KHÔNG có phiên người dùng (webhook, back-channel logout, health) thì ghi\n" +
      "  một dòng `// @api-guard: <lý do>` vào chính file đó.\n" +
      "  Xem AGENTS.md §Ranh giới Account / app.\n"
  );
  process.exit(1);
}

const summary = `✓ ${guarded} route handler GHI, tất cả đều có chốt quyền và withApiErrors.`;
console.info(exempted.length === 0 ? summary : `${summary} ${exempted.length} route được miễn trừ:`);
for (const note of exempted) console.info(`  · ${note}`);
