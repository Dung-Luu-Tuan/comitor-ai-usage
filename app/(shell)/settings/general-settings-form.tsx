"use client";

import {
  FormField,
  FormSection,
  KeyboardHint,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from "@comitor/ui";
import { ContrastToggle, DensityToggle, FontSizeControl, ThemeToggle } from "@comitor/ui/shell";
import { Keyboard, ListChecks, Palette } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useTaskPriorityConfigs } from "@/hooks/use-catalog";
import { useSettingsDraft } from "@/hooks/use-settings-draft";
import { saveSettings } from "@/lib/api-client/settings";
import { PAGE_SIZE_OPTIONS, SHORTCUT_HINTS } from "@/lib/catalog/settings";
import type { AppSettingsView } from "@/lib/contracts/settings";
import type { TaskPriority } from "@/lib/contracts/task";
import { isLocale } from "@/lib/i18n/config";
import { SHELL_LABELS } from "@/lib/i18n/ui-labels";
import { HelpTip, ReadOnlyFieldset, SettingsReadOnlyNotice, SettingsSaveBar } from "./settings-form-chrome";

/**
 * Nửa TƯƠNG TÁC của tab "Chung" (`/settings`).
 *
 * Tách khỏi `page.tsx` vì `"use client"` là chỉ thị theo FILE: để chung thì cả trang thành client
 * component và mất `export const metadata`.
 *
 * File này KHÔNG đọc bản ghi nào: bản cài đặt đã lưu đi vào bằng prop từ `page.tsx`, và đường ghi
 * duy nhất là `saveSettings()` — cổng API ở `lib/api-client/`. Không có `fetch()` nào ở đây.
 * Những gì còn `import` là BẢNG KHAI của module (cỡ trang, phím tắt) — hằng giao
 * diện, không phải dữ liệu từ máy chủ.
 *
 * ⚠ MỌI TRƯỜNG Ở ĐÂY PHẢI ĐỔI CÁCH ỨNG DỤNG NÀY LÀM VIỆC. Tên không gian làm việc, địa chỉ rút gọn
 * và múi giờ từng nằm ở nhóm đầu của trang này; chúng đã đi về Comitor.Account, nơi duy nhất biết
 * chúng. Trường mới nào không trả lời được câu "nó đổi cách app này làm việc à?" thì chỗ của nó
 * cũng ở đó — xem `lib/account/links.ts`.
 *
 * ── NĂM TRỤC HIỂN THỊ, KHÔNG PHẢI TRƯỜNG CỦA BIỂU MẪU ────────────────────────────────────
 * Sáng/tối · bảng màu · mật độ · cỡ chữ · NGÔN NGỮ. Cả năm có hiệu lực NGAY và tự lưu (bốn trục đầu
 * vào localStorage của gói, ngôn ngữ vào cookie qua Server Action), nên KHÔNG cái nào là một trường
 * của `draft` và không cái nào đi cùng nút "Lưu thay đổi". Trộn hai kiểu thì thanh "Có thay đổi
 * chưa lưu" sáng lên cho một thay đổi đã có hiệu lực, và nút "Hoàn tác" trong toast sẽ lùi bản nháp
 * mà KHÔNG lùi được trục — giao diện tự mâu thuẫn với chính nó.
 */
export function GeneralSettingsForm({
  savedSettings,
  canEdit
}: {
  savedSettings: AppSettingsView;
  /** Vai trò hiện tại có được đổi cài đặt của ứng dụng không (`app.settings`) — chốt thật ở API. */
  canEdit: boolean;
}) {
  const t = useTranslations("settings.general");
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : "vi";
  const priorities = useTaskPriorityConfigs();

  const { draft, update, isDirty, isSaving, save, reset } = useSettingsDraft(savedSettings, saveSettings, { canEdit });

  return (
    <div className="space-y-5">
      {!canEdit && <SettingsReadOnlyNotice />}
      {/* CHỈ nhóm này bị khoá. Nhóm Giao diện bên dưới KHÔNG — sáng/tối, tương phản, mật độ, cỡ
        chữ và ngôn ngữ là tuỳ chọn của riêng người đang xem, trên riêng máy này, nên `app.settings`
        không nói gì về chúng. Khoá cả trang là lấy mất của người chỉ-đọc thứ vốn là của họ. */}
      <ReadOnlyFieldset canEdit={canEdit}>
        <FormSection
          title={t("taskTitle")}
          description={t("taskDescription")}
          icon={ListChecks}
          actions={<HelpTip label={t("taskHelpLabel")}>{t("taskHelp")}</HelpTip>}
        >
          {/* `children` dạng HÀM: FormField tiêm sẵn id + aria-required + aria-describedby xuống
          control, khỏi phải nhớ từng thuộc tính ở mỗi trường. */}
          <FormField label={t("defaultPriorityLabel")} colSpan={6} description={t("defaultPriorityDescription")}>
            {(control) => (
              <Select
                value={draft.defaultPriority}
                onValueChange={(value) => update({ defaultPriority: value as TaskPriority })}
              >
                <SelectTrigger {...control} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Nhãn lấy từ CÙNG bảng mà bảng công việc dùng để tô chip (`useTaskPriorityConfigs`).
                  Gõ lại bốn nhãn ở đây là hai bảng cùng nói một chuyện rồi lệch chữ nhau. */}
                  {priorities.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField label={t("pageSizeLabel")} colSpan={6} description={t("pageSizeDescription")}>
            {(control) => (
              /* Giá trị là SỐ trong dữ liệu nhưng `Select` của Radix chỉ làm việc với chuỗi, nên phép
               đổi nằm đúng ở ranh giới này — không phải trong `AppSettingsView`. */
              <Select
                value={String(draft.defaultPageSize)}
                onValueChange={(value) => update({ defaultPageSize: Number(value) })}
              >
                <SelectTrigger {...control} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {/* Số đi qua ICU chứ không nối chuỗi: "20 dòng" và "20 rows" đặt con số ở hai
                      chỗ khác nhau trong câu ở nhiều ngôn ngữ. */}
                      {t("pageSizeOption", { count: size })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="col-span-12 border-t border-border pt-4">
            <Switch
              checked={draft.autoAssignToMe}
              onCheckedChange={(checked) => update({ autoAssignToMe: checked })}
              label={t("autoAssignLabel")}
              description={t("autoAssignDescription")}
            />
          </div>
        </FormSection>
      </ReadOnlyFieldset>

      <FormSection title={t("appearanceTitle")} description={t("appearanceDescription")} icon={Palette}>
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("themeLabel")}</p>
            <p className="text-xs text-muted-foreground">{t("themeDescription")}</p>
          </div>
          {/*
           * Nhãn của MENU sáng/tối lấy từ `SHELL_LABELS` chứ không từ namespace `settings`: đó là
           * chuỗi của GÓI (`ShellLabels`), và cùng bốn chuỗi ấy đã phục vụ menu theme trên header.
           * Khai lại chúng ở đây là bản sao thứ hai sẽ lệch ngay lần gói sửa chữ.
           */}
          <ThemeToggle variant="menu" labels={SHELL_LABELS[locale]} className="border border-input" />
        </div>

        {/* Trục thứ HAI, độc lập với sáng/tối: BẢNG MÀU. */}
        <div className="col-span-12 border-t border-border pt-4">
          <ContrastToggle labels={{ label: t("contrastLabel"), description: t("contrastDescription") }} />
        </div>

        {/* Trục thứ BA — mật độ. */}
        <div className="col-span-12 border-t border-border pt-4">
          <DensityToggle label={t("densityLabel")} description={t("densityDescription")} />
        </div>

        {/* Trục thứ TƯ — cỡ chữ. Phóng theo TỈ LỆ (chữ, icon, khoảng cách, chiều cao control cùng
          đi) chứ không chỉ đổi cỡ chữ, vì icon trong gói lấy cỡ từ thang khoảng cách. */}
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("fontSizeLabel")}</p>
            <p className="text-xs text-muted-foreground">{t("fontSizeDescription")}</p>
          </div>
          <FontSizeControl
            label={t("fontSizeLabel")}
            optionLabels={{ sm: t("fontSizeOption.sm"), md: t("fontSizeOption.md"), lg: t("fontSizeOption.lg") }}
          />
        </div>

        {/*
         * Trục thứ NĂM — ngôn ngữ. Cùng luật với bốn trục trên: có hiệu lực ngay, tự lưu, không nằm
         * trong `draft`. Khác ở chỗ nó ghi COOKIE (qua Server Action) chứ không ghi localStorage,
         * vì máy chủ phải biết ngôn ngữ để render HTML lần đầu đúng thứ tiếng.
         */}
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("languageLabel")}</p>
            <p className="text-xs text-muted-foreground">{t("languageDescription")}</p>
          </div>
          <LocaleSwitcher />
        </div>
      </FormSection>

      <FormSection title={t("shortcutsTitle")} description={t("shortcutsDescription")} icon={Keyboard}>
        {/*
         * ⚠ `mod+s` chỉ được ĐĂNG KÝ khi `canEdit` (xem `hooks/use-settings-draft.ts`), nên liệt kê
         * nó cho người chỉ-đọc là quảng cáo một phím tắt không tồn tại với họ. Cùng một luật với
         * `<ReadOnlyFieldset>`: giao diện không được nói về những thứ nó không làm.
         */}
        <ul className="col-span-12 divide-y divide-border">
          {SHORTCUT_HINTS.filter((shortcut) => canEdit || shortcut.id !== "save-settings").map((shortcut) => (
            <li key={shortcut.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <span className="text-sm text-foreground">{t(`shortcut.${shortcut.id}` as Parameters<typeof t>[0])}</span>
              <KeyboardHint keys={shortcut.keys} />
            </li>
          ))}
        </ul>
      </FormSection>

      <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} canEdit={canEdit} onReset={reset} onSave={save} />
    </div>
  );
}
