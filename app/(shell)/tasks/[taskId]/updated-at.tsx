"use client";

import { RelativeTime } from "@comitor/ui";
import { useLocale, useTranslations } from "next-intl";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { DATE_FNS_LOCALES } from "@/lib/i18n/ui-labels";

/**
 * Dòng "Cập nhật … trước" ở đầu trang chi tiết công việc — một hòn đảo client CHỈ VÌ ngôn ngữ.
 *
 * ── VÌ SAO KHÔNG ĐỂ THẲNG TRONG `page.tsx` ──────────────────────────────────────────────
 * Vì `<RelativeTime>` cần `locale` của **date-fns** để nói "18 minutes ago" thay vì "18 phút
 * trước", mà một `Locale` của date-fns là object CHỨA HÀM (`formatDistance`, `localize`…). Hàm
 * không tuần tự hoá được qua ranh giới server → client: Next ném *"Functions cannot be passed
 * directly to Client Components"* và trang rơi vào `error.tsx`. Bảng `DATE_FNS_LOCALES` vì thế
 * phải được `import` từ bên TRONG một file client. Cùng lý do với `app/(shell)/activity-feed.tsx`.
 *
 * ⚠ Và không truyền `locale` cũng không phải lối thoát: gói mặc định TIẾNG VIỆT, nên bỏ qua nó
 * thì không có gì báo đỏ — giao diện tiếng Anh vẫn chạy, chỉ mỗi mốc thời gian nói tiếng Việt.
 * Đó chính xác là hình dạng lỗi đã lọt vào trang này ở Đợt 1. `pnpm i18n:check` nay chặn cả hai
 * hình dạng: `<RelativeTime>` trong file KHÔNG `"use client"`, và `<RelativeTime>` thiếu `locale`.
 *
 * File này KHÔNG đọc bản ghi nào — `value` vào qua prop dưới dạng chuỗi ISO.
 */
export function TaskUpdatedAt({ value }: { value: string }) {
  const t = useTranslations("taskDetail");
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  return (
    <span className="ml-auto text-sm text-muted-foreground">
      {t("updated")} <RelativeTime value={value} locale={DATE_FNS_LOCALES[locale]} />
    </span>
  );
}
