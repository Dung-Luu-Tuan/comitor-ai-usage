import type messages from "../messages/vi.json";

/**
 * Cho `t("…")` kiểm khoá LÚC BIÊN DỊCH.
 *
 * Không có khối này thì `useTranslations` nhận mọi chuỗi, và một khoá gõ sai **chỉ lộ ra lúc
 * chạy** — dưới dạng chính chuỗi khoá hiện giữa màn hình. `next-intl` KHÔNG ném (đã đo trên 4.14.1,
 * cả hai bundle), nên không có gì đỏ ở đâu cả: `pnpm build` xanh, và chuỗi hỏng đi thẳng ra
 * production. Đó là lý do phép kiểm phải nằm ở LÚC BIÊN DỊCH — đây là chốt duy nhất bắt được khoá
 * gõ sai; `i18n/request.ts` chỉ làm cái sót nhìn thấy được (`⟦namespace.key⟧`), nó không chặn.
 *
 * ⚠ Kiểu dựng từ ĐÚNG MỘT file — `vi.json`, ngôn ngữ mặc định. Nghĩa là nó KHÔNG thấy `en.json`
 * thiếu khoá nào; phần đó là việc của `pnpm i18n:check`. Hai cơ chế bù cho nhau, cần cả hai.
 */
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
  }
}
