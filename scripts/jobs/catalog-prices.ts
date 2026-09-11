/**
 * JOB NỀN: tải bảng giá LiteLLM (ước tính USD trên nhật ký và trang Model và giá).
 *
 * Chạy: `pnpm job:catalog-prices`
 *
 * File này cố tình MỎNG — nghiệp vụ rút JSON nằm ở `scripts/sync-litellm-prices.ts`. Job không nạp
 * `server-only`, nên không cần `--conditions=react-server`.
 *
 * ── HẸN GIỜ: CRON CỦA HẠ TẦNG, KHÔNG PHẢI `setInterval` TRONG NEXT ─────────────────────────
 * N instance Next là N lần tải mỗi tuần, và N đổi theo co giãn. Dùng CronJob Kubernetes, scheduled
 * task của nền tảng, hoặc cron của máy — đúng MỘT tiến trình.
 *
 * Repo đã có sẵn một cron: `.github/workflows/catalog-prices.yml` (thứ Hai 03:00 UTC = 10:00 ICT).
 * Nó mở PR nếu bản chụp đổi; merge xong thì `pnpm dev` / build mới đọc số mới. Cổng 3100 đọc lại
 * file theo mtime, không cần restart.
 */

import { syncLitellmPrices } from "../sync-litellm-prices";

await syncLitellmPrices({ localOnly: process.argv.includes("--local") });
