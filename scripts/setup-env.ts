/**
 * Dựng `.env` từ `.env.example` và sinh sẵn `COMITOR_SESSION_SECRET`.
 *
 * ── VÌ SAO CẦN MỘT SCRIPT CHO MỘT VIỆC TRÔNG NHƯ MỘT LỆNH `cp` ────────────────────────────
 * Vì `cp .env.example .env` KHÔNG đủ, và chỗ thiếu không lộ ra ngay. `.env.example` cố ý ghi
 * placeholder dạng hướng dẫn (`"<sinh bằng lệnh ở dòng trên>"`), còn `lib/env.ts` thì TỪ CHỐI mọi
 * placeholder — đúng như nó nên làm. Kết quả: người làm đúng từng bước README vẫn nổ, ở bước đầu
 * tiên có thứ gì đó chạm `lib/`, với một thông điệp nói về `COMITOR_SESSION_SECRET` chứ không nói
 * "bạn quên một bước".
 *
 * Script này bỏ đúng một hòn đá ra khỏi đường đi của ngày đầu tiên. Nó KHÔNG điền hộ
 * `COMITOR_CLIENT_*` / `COMITOR_M2M_*`: hai cặp đó là bí mật do Comitor.Account cấp, không sinh
 * được ở đây, và giả vờ làm hộ chúng thì tệ hơn là nói thẳng phải lấy chúng ở đâu.
 *
 * ── VÌ SAO VIẾT BẰNG NODE CHỨ KHÔNG PHẢI `sed` ────────────────────────────────────────────
 * `sed -i ''` là cú pháp BSD (macOS); trên Linux và trong CI nó hiểu `''` là TÊN FILE và hỏng.
 * `sed -i` không đối số thì ngược lại — hỏng trên macOS. Một lệnh sửa file tại chỗ mà chạy đúng ở
 * cả hai chỗ thì phải viết bằng Node, và repo đã có `tsx` sẵn cho seed.
 *
 * Chạy: `pnpm setup:env`
 */

import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EXAMPLE = `${ROOT}.env.example`;
const TARGET = `${ROOT}.env`;

/**
 * ⚠ KHÔNG ghi đè. Một `.env` đang có thể chứa client secret mà người dùng vừa chép tay từ Account,
 * và ghi đè nó là bắt họ làm lại một việc mười phút để đổi lấy một việc mười giây.
 */
if (existsSync(TARGET)) {
  console.info("· .env đã tồn tại — không đụng tới. Xoá nó đi rồi chạy lại nếu muốn dựng từ đầu.");
  process.exit(0);
}

if (!existsSync(EXAMPLE)) {
  console.error("✗ Không thấy .env.example. Bạn đang chạy lệnh này ngoài gốc repo?");
  process.exit(1);
}

copyFileSync(EXAMPLE, TARGET);

const secret = randomBytes(32).toString("base64url");
const source = readFileSync(TARGET, "utf8");

/*
 * Chỉ thay dòng khai báo, không thay chuỗi trong comment ở trên nó — dòng comment kia là HƯỚNG DẪN
 * và người đọc `.env` cần thấy nó nguyên vẹn.
 */
const pattern = /^COMITOR_SESSION_SECRET=.*$/m;
if (!pattern.test(source)) {
  console.error("✗ .env.example không còn dòng COMITOR_SESSION_SECRET= nào. Sửa scripts/setup-env.ts cho khớp.");
  process.exit(1);
}

writeFileSync(TARGET, source.replace(pattern, `COMITOR_SESSION_SECRET="${secret}"`), "utf8");

console.info("✓ Đã tạo .env và sinh COMITOR_SESSION_SECRET.\n");
console.info("  Còn HAI cặp phải điền tay — chúng do Comitor.Account cấp, xem");
console.info("  ../comitor-account/scripts/seed-output.json:\n");
console.info("    COMITOR_CLIENT_ID / COMITOR_CLIENT_SECRET          ← khoá `tasks-web` → Comitor Starter");
console.info("    COMITOR_M2M_CLIENT_ID / COMITOR_M2M_CLIENT_SECRET  ← khoá `directory` → Comitor M2M Sample\n");
console.info("  Thiếu cặp thứ nhất: không ai đăng nhập được (fail-closed, cố ý).");
console.info("  Thiếu cặp thứ hai: danh bạ RỖNG và tạo việc trả 422 — xem lib/account/directory.ts.");
