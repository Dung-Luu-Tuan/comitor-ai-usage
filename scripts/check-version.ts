/**
 * Chặn `package.json` trôi khỏi `CHANGELOG.md`.
 *
 * ── VÌ SAO ĐÂY KHÔNG PHẢI CHUYỆN GỌN GÀNG ──────────────────────────────────────────────────
 * Vì con số đó **hiện ra với người dùng**. `next.config.ts` đọc `version` của `package.json` rồi
 * bơm vào `NEXT_PUBLIC_APP_VERSION`, và `app/(shell)/shell-frame.tsx` in nó ở chân thanh bên. Một
 * bản đã gắn tag `v0.3.0` mà `package.json` còn `0.1.0` nghĩa là mọi người dùng nhìn thấy `v0.1.0`
 * — và khi họ báo lỗi kèm số đó, người trực đi tìm ở đúng bản sai.
 *
 * Đây đúng hạng lỗi mà Đợt 0 dành cả một gói để dọn: **bản mẫu nói dối thì mọi sản phẩm sinh ra
 * từ nó chép nguyên cái nói dối đó.** Nó đã trôi một lần trong chính repo này, ở đúng lần phát
 * hành thứ hai.
 *
 * ── VÌ SAO NEO VÀO `CHANGELOG.md`, KHÔNG NEO VÀO `git tag` ────────────────────────────────
 * Vì tag không phải lúc nào cũng có mặt: CI thường `clone --depth=1` không kèm tag, và tag được
 * đặt SAU commit — nên một cổng neo vào tag sẽ đỏ ở đúng commit tạo ra bản phát hành. `CHANGELOG.md`
 * thì là thứ con người sửa TRƯỚC khi tag, và nó nằm trong cùng một commit.
 *
 * Chạy: `pnpm version:check`
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const packageVersion = (JSON.parse(readFileSync(`${ROOT}package.json`, "utf8")) as { version?: string }).version;
if (!packageVersion) {
  console.error("✗ package.json không có trường `version`.\n");
  process.exit(1);
}

/*
 * Mục mới nhất là mục `## vX.Y.Z` ĐẦU TIÊN gặp từ trên xuống — CHANGELOG viết mới-nhất-trước.
 * Không sắp xếp lại theo semver: thứ tự trong file là thứ tự người đọc tin, và nếu hai thứ đó lệch
 * nhau thì vấn đề nằm ở file chứ không ở phép so.
 */
const changelog = readFileSync(`${ROOT}CHANGELOG.md`, "utf8");
const latest = changelog.match(/^##\s+v(\d+\.\d+\.\d+)/m)?.[1];
if (!latest) {
  console.error("✗ CHANGELOG.md không có mục nào dạng `## vX.Y.Z`.\n");
  process.exit(1);
}

if (packageVersion !== latest) {
  console.error(`✗ Phiên bản lệch nhau:\n`);
  console.error(`  package.json   ${packageVersion}`);
  console.error(`  CHANGELOG.md   ${latest}   ← mục mới nhất\n`);
  console.error(
    "  Con số của `package.json` đi vào NEXT_PUBLIC_APP_VERSION và hiện ở chân thanh bên,\n" +
      "  nên lệch nhau nghĩa là người dùng thấy sai phiên bản — và báo lỗi kèm một con số\n" +
      "  dẫn người trực tới đúng bản không có lỗi đó.\n\n" +
      "  Sửa: đặt `version` trong package.json thành " +
      latest +
      ", hoặc thêm mục mới vào CHANGELOG.\n"
  );
  process.exit(1);
}

console.info(`✓ package.json và CHANGELOG.md cùng ở v${packageVersion}.`);
