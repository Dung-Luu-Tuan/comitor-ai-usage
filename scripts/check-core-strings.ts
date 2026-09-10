/**
 * Chặn CHUỖI HIỂN THỊ lọt vào `lib/core/` — cổng mà lint không dựng nổi.
 *
 * ── VÌ SAO CẦN MỘT SCRIPT RIÊNG ────────────────────────────────────────────────────────────
 * `biome.json` chặn được `import` sai tầng, và `server-only` chặn được đường bắc cầu sang mã máy
 * chủ. Không cơ chế nào trong hai cái đó bắt được một hàm **TRẢ VỀ** một câu tiếng Việt — mà đó
 * đúng là kiểu rò rỉ ngôn ngữ kín nhất, vì:
 *
 *   · nó không nằm trong `messages/` nên `pnpm i18n:check` không thấy;
 *   · nó không nằm trong JSX nên đọc lướt không thấy;
 *   · và nó CHẠY ĐÚNG ở tiếng Việt, nên không ai báo lỗi cho tới khi có người mở giao diện tiếng
 *     Anh và gặp một câu tiếng Việt giữa màn hình.
 *
 * Luật: **hàm trong `lib/core/` chỉ trả `code` / `level` / `id`; nơi gọi tra nhãn.**
 *
 * ── PHÉP KIỂM: KÝ TỰ NGOÀI ASCII TRONG CHUỖI VÀ TEMPLATE ──────────────────────────────────
 * Thô nhưng đúng việc: tiếng Việt luôn có dấu, nên một chuỗi hiển thị tiếng Việt KHÔNG THỂ toàn
 * ASCII. Chiều ngược lại không đúng (một chuỗi tiếng Anh vẫn lọt), và script này không giả vờ bắt
 * được ca đó — nó bắt được ca ĐÃ XẢY RA THẬT trong hệ Comitor.
 *
 * COMMENT ĐƯỢC PHÉP có dấu, và đó là chủ ý: quy ước của repo là comment và tài liệu viết bằng
 * tiếng Việt. Script vì vậy phải BỎ comment ra trước khi tìm — không thì nó đỏ ở mọi file và một
 * bộ kiểm lúc nào cũng đỏ là bộ kiểm sẽ bị gỡ.
 *
 * Chạy: `pnpm core:check`
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./strip-comments";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CORE_DIR = join(ROOT, "lib", "core");

/** Chuỗi và template literal còn lại sau khi đã bỏ comment. */
function stringLiterals(source: string): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = [];
  const pattern = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

  for (const match of source.matchAll(pattern)) {
    const text = match[0];
    const line = source.slice(0, match.index).split("\n").length;
    found.push({ line, text });
  }
  return found;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    // Test được phép có chuỗi tiếng Việt: `it("…")` là mô tả cho người đọc kết quả test.
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

/**
 * Có ký tự ngoài ASCII không.
 *
 * ⚠ CỐ Ý KHÔNG dùng regex. Cách viết hiển nhiên — một lớp ký tự phủ định dải `\u0000-\u007F` —
 * làm Biome báo `noControlCharactersInRegex`, và luật đó ĐÚNG: ký tự điều khiển trong một lớp ký
 * tự gần như luôn là dấu hiệu của một regex viết nhầm. Tắt luật cho riêng file này là mở cửa cho
 * những chỗ nó thật sự cần bắt.
 *
 * Duyệt `for…of` còn đúng hơn về mặt Unicode: nó lặp theo ĐIỂM MÃ chứ không theo đơn vị UTF-16,
 * nên một emoji (cặp surrogate) được tính là MỘT ký tự có mã > 127, thay vì hai nửa vô nghĩa.
 */
function hasNonAscii(text: string): boolean {
  for (const char of text) {
    if ((char.codePointAt(0) ?? 0) > 127) return true;
  }
  return false;
}

const problems: string[] = [];
let checked = 0;

for (const file of walk(CORE_DIR)) {
  checked += 1;
  const source = stripComments(readFileSync(file, "utf8"));
  for (const literal of stringLiterals(source)) {
    if (!hasNonAscii(literal.text)) continue;
    problems.push(`${relative(ROOT, file)}:${literal.line} — chuỗi có ký tự ngoài ASCII: ${literal.text.slice(0, 60)}`);
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} chuỗi hiển thị lọt vào lib/core/:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\n  lib/core/ là LÕI THUẦN: nó trả code/level/id, KHÔNG trả câu chữ.\n" +
      "  Đưa chuỗi ra messages/*.json và để nơi gọi tra nhãn.\n" +
      "  Xem docs/kien-truc-ung-dung.md §4 tầng 1.\n"
  );
  process.exit(1);
}

console.info(`✓ ${checked} file trong lib/core/, không chuỗi hiển thị nào lọt vào.`);
