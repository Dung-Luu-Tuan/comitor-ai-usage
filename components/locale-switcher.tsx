"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@comitor/ui";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import { isLocale, LOCALE_LABELS, LOCALES } from "@/lib/i18n/config";

/**
 * Bộ chọn ngôn ngữ.
 *
 * ── VÌ SAO CỤM NÀY TỰ VIẾT, VÀ VÌ SAO NÓ Ở `components/` ──────────────────────────────────
 * `@comitor/ui` có `Select` nhưng không có "bộ chọn ngôn ngữ" — vì nó không biết app dùng cơ chế
 * i18n nào, ghi lựa chọn vào đâu. Cụm này chỉ NỐI `Select` của gói với Server Action của module.
 * Nó sống ở `components/` chứ không cạnh một route vì nó là một mảnh của KHUNG APP: mặt nó xuất
 * hiện ở trang Cài đặt, và (khi có màn đăng nhập) sẽ xuất hiện ở đó nữa.
 *
 * ── ⚠ NHÃN NGÔN NGỮ CỐ Ý KHÔNG DỊCH ──────────────────────────────────────────────────────
 * `LOCALE_LABELS` viết tên mỗi ngôn ngữ BẰNG CHÍNH NÓ ("Tiếng Việt", "English"). Người chỉ đọc
 * được tiếng Anh mà đang kẹt trong giao diện tiếng Việt cần nhìn thấy chữ "English" — họ không đọc
 * được dòng chữ đang chỉ lối thoát cho mình. Đó là lý do bảng ấy nằm ngoài `messages/*.json`.
 *
 * ── VÌ SAO `useTransition` ────────────────────────────────────────────────────────────────
 * Server Action ghi cookie rồi Next render lại cả cây từ máy chủ — mất vài trăm mili giây. Không
 * bọc thì ô chọn "đơ" đúng khoảng đó và người dùng bấm lần thứ hai. `isPending` cho ta khoá ô lại
 * và nói ra rằng có việc đang chạy.
 */
export function LocaleSwitcher() {
  const t = useTranslations("settings.general");
  const current = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={isLocale(current) ? current : LOCALES[0]}
      disabled={isPending}
      onValueChange={(value) => {
        /*
         * Không `await`: Server Action trả về `void` và việc render lại do Next lo. Bọc trong
         * `startTransition` để React biết đây là một cập nhật KHÔNG khẩn cấp và giữ giao diện cũ
         * hiển thị được trong lúc chờ, thay vì nháy sang trạng thái rỗng.
         */
        startTransition(() => {
          void setLocale(value);
        });
      }}
    >
      <SelectTrigger className="w-full sm:w-64" aria-label={t("languageLabel")}>
        <Languages className="size-4 text-muted-foreground" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
