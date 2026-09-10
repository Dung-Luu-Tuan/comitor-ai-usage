/**
 * Chặn MÃ MÀU viết thẳng vào mã của app — quy tắc số 1 của repo, và cho tới nay là quy tắc lớn
 * duy nhất không có cổng nào canh.
 *
 * ── LUẬT ──────────────────────────────────────────────────────────────────────────────────
 * *"App KHÔNG sở hữu màu."* Màu thuộc về `@comitor/ui`: thiếu token thì thêm vào gói, bump, publish,
 * nâng version ở đây. Vá tại chỗ thì nhanh hơn, nhưng đổi lại là app lệch màu với mọi app khác
 * trong hệ, hỏng chế độ tối, và không ai đo lại tương phản.
 *
 * ── VÌ SAO PHẢI LÀ MỘT CỔNG, KHÔNG PHẢI MỘT CÂU TRONG TÀI LIỆU ────────────────────────────
 * AGENTS.md đã ghi sẵn lệnh grep để tự kiểm, và repo hôm nay SẠCH. Nhưng một lệnh chép trong tài
 * liệu chỉ chạy khi có người nhớ chạy nó, còn `#D64545` thì lọt vào đúng lúc ai đó đang vội. Khoá
 * trạng thái sạch lại lúc nó đang sạch là lúc rẻ nhất; sau khi đã có năm module thì mỗi module
 * phải tự dọn lấy.
 *
 * ── PHÉP KIỂM ─────────────────────────────────────────────────────────────────────────────
 * Đúng lệnh grep mà AGENTS.md công bố, không hơn:
 *
 *     grep -rE "#[0-9A-Fa-f]{3,8}" app lib components hooks --exclude=icon.svg
 *
 * ⚠ CỐ Ý KHÔNG bỏ comment ra trước (khác `core:check` và `api:check`). Một mã màu nằm trong
 * comment vẫn là một mã màu được chép đi chép lại — và nó là bước đầu tiên của mọi lần vi phạm.
 *
 * ⚠ CỐ Ý KHÔNG kiểm VAI TRÒ của màu (`--x` nền · `--x-foreground` chữ trên nền đó · `--x-ink`
 * màu đó trên nền trang). Phép kiểm ấy phải viết bằng regex, và `text-destructive-foreground`,
 * `border-input`, hay một class đi qua `cn()` đều làm nó báo nhầm. README của chính gói đã viết:
 * *"một cổng lúc nào cũng đỏ thì lần sau không ai chạy."* Vai trò màu được kiểm bằng MẮT, ở cả
 * hai theme — xem AGENTS.md §Kiểm chứng thay đổi.
 *
 * ── NGOẠI LỆ DUY NHẤT CỦA REPO ────────────────────────────────────────────────────────────
 * `app/icon.svg`. Favicon do trình duyệt vẽ NGOÀI trang nên nó không đọc được `var(--color-*)`;
 * vector và mã màu chép nguyên từ `<ComitorLogo>` của gói. Ngoại lệ này được ghi ở AGENTS.md, ở
 * README, và ở đây — ba chỗ, cùng một lý do.
 *
 * Chạy: `pnpm color:check`
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Bốn thư mục chứa mã của app. `messages/` không nằm ở đây: chuỗi hiển thị không mang màu. */
const SCAN_DIRS = ["app", "lib", "components", "hooks"];

/** Nơi màu có thể lọt vào: mã, CSS, và SVG tự vẽ. */
const EXTENSIONS = [".ts", ".tsx", ".css", ".svg"];

/** Xem khối "NGOẠI LỆ DUY NHẤT" ở đầu file. Đường dẫn tương đối so với gốc repo. */
const EXCEPTIONS = new Set(["app/icon.svg"]);

const HEX = /#[0-9A-Fa-f]{3,8}/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.some((extension) => entry.name.endsWith(extension))) out.push(full);
  }
  return out;
}

const problems: string[] = [];
let checked = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const where = relative(ROOT, file);
    if (EXCEPTIONS.has(where)) continue;
    checked += 1;

    const lines = readFileSync(file, "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
      const match = line.match(HEX);
      if (match) problems.push(`${where}:${index + 1} — ${match[0]}  ${line.trim().slice(0, 70)}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} mã màu viết thẳng trong mã của app:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\n  App KHÔNG sở hữu màu. Dùng class và biến của @comitor/ui.\n" +
      "  Thiếu token thì sửa Ở GÓI: thêm token vào ../comitor-ui → bump → publish → nâng version.\n" +
      "  TUYỆT ĐỐI không sửa file trong node_modules/@comitor/ui.\n" +
      "  Xem AGENTS.md §Quy ước bắt buộc giữ, mục đầu tiên.\n"
  );
  process.exit(1);
}

console.info(`✓ ${checked} file trong ${SCAN_DIRS.join("/ ")}/, không mã màu nào viết thẳng.`);
