import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest CHỈ chạy trên `lib/core/` — tầng 1 của `docs/kien-truc-ung-dung.md`.
 *
 * ── VÌ SAO GIỚI HẠN Ở ĐÚNG MỘT TẦNG ─────────────────────────────────────────────────────────
 * Vì đó là tầng DUY NHẤT mà unit test là công cụ đúng. Tầng 1 bị cấm import `react`, `next/*`,
 * `@prisma/*`, `@comitor/ui`, `next-intl` — nên test ở đây chạy trong `node` trần: không jsdom,
 * không setup file, KHÔNG MOCK. Nó nhanh, nó tất định, và nó bắt được đúng những nhánh biên mà
 * chạy thật không đi qua được (một dự án 0 công việc, một chuỗi ngày méo, một ma trận quyền mâu
 * thuẫn với chính hằng đúng của nó).
 *
 * ⚠ **Ngày nào một test ở đây cần mock là ngày một quy tắc nghiệp vụ đã rò ra khỏi tầng thuần.**
 * Sửa chỗ rò, đừng thêm mock. Đó là toàn bộ giá trị của việc giới hạn phạm vi này.
 *
 * ── VÌ SAO KHÔNG VIẾT UNIT TEST CHO ROUTE HANDLER VÀ COMPONENT ─────────────────────────────
 * Mock Prisma thì test sẽ XANH với những giả định mà database thật không chia sẻ — và một bộ test
 * xanh sai còn tệ hơn không có test, vì nó mua được sự tự tin mà không mua được sự đúng. Route
 * handler và giao diện được kiểm bằng cách CHẠY THẬT: `pnpm build` cho phần biên dịch, và một vòng
 * đi tay qua bảy route ở cả hai ngôn ngữ cho phần hành vi (xem AGENTS.md §"Kiểm chứng thay đổi").
 *
 * Một module trưởng thành nên bổ sung Playwright cho tầng đó — `../comitor-account/docs/kien-truc-ung-dung.md` §10 mô
 * tả sẵn hình dạng; starter cố ý chưa dựng để không giao một bộ e2e chưa ai chạy.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/core/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/core/**/*.ts"],
      exclude: ["lib/core/**/*.test.ts"],
      /**
       * Ngưỡng đặt ở 90, KHÔNG phải ở con số đang đo được (~99).
       *
       * Một ngưỡng sát mép đỏ ngay ở lần đầu ai thêm một nhánh chưa test, và thứ xảy ra sau đó
       * không bao giờ là "viết thêm test" — nó là hạ ngưỡng. Hạ hai lần thì cổng chết, và một
       * cổng chết còn tệ hơn không có cổng: nó vẫn nằm trong `pnpm check` và vẫn báo xanh.
       *
       * 90 là mức mà một tầng THUẦN, không mock, không I/O phải đạt được không cần cố gắng —
       * nên rơi xuống dưới nó là một tín hiệu thật: có nhánh nghiệp vụ nào đó chưa ai nghĩ tới.
       */
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 }
    }
  },
  resolve: {
    // Alias `@/` của tsconfig — Vite không tự đọc `paths`.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) }
  }
});
