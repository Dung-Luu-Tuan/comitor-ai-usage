"use client";

import {
  FormField,
  FormSection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from "@comitor/ui";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSettingsDraft } from "@/hooks/use-settings-draft";
import { saveSettings } from "@/lib/api-client/settings";
import { DIGEST_FREQUENCIES, NOTIFICATION_PREFS } from "@/lib/catalog/settings";
import type { AppSettingsView, DigestFrequency, NotificationPrefId } from "@/lib/contracts/settings";
import { NotYetActive, ReadOnlyFieldset, SettingsReadOnlyNotice, SettingsSaveBar } from "../settings-form-chrome";

/**
 * Nửa TƯƠNG TÁC của tab "Thông báo" (`/settings/notifications`).
 *
 * Phạm vi của tab này là SỰ KIỆN CỦA MODULE NÀY — ranh giới đi qua đúng giữa hai câu: **SỰ KIỆN NÀO
 * của module đáng gửi đi** là chuyện của module Công việc; **gửi tới địa chỉ email nào, số điện
 * thoại nào** là hồ sơ cá nhân, tức của Comitor.Account (`lib/account/links.ts`).
 *
 * ⚠ Bản trước diễn đạt vế đầu ở ngôi thứ nhất (*"báo cho tôi khi có người giao việc"*), và cách nói
 * ấy đã đi thẳng vào nhãn của cả tab. Nó SAI: `app_settings` khoá theo `workspaceId`, nên mọi công
 * tắc ở đây là của CẢ KHÔNG GIAN LÀM VIỆC — `lib/tasks.ts` gọi đúng giá trị ấy là `workspaceAllows`.
 */
export function NotificationSettingsForm({
  savedSettings,
  canEdit
}: {
  savedSettings: AppSettingsView;
  /** Vai trò hiện tại có được đổi cài đặt của ứng dụng không (`app.settings`) — chốt thật ở API. */
  canEdit: boolean;
}) {
  const t = useTranslations("settings.notifications");
  const { draft, setDraft, update, isDirty, isSaving, save, reset } = useSettingsDraft(savedSettings, saveSettings, {
    canEdit
  });

  const toggleNotification = (id: NotificationPrefId, value: boolean) =>
    setDraft({ ...draft, notifications: { ...draft.notifications, [id]: value } });

  const digestEnabled = draft.notifications["email-digest"];

  return (
    <div className="space-y-5">
      {!canEdit && <SettingsReadOnlyNotice />}
      {/* Cả nhóm này là cài đặt của KHÔNG GIAN LÀM VIỆC — thiếu `app.settings` thì không lật được công tắc nào. */}
      <ReadOnlyFieldset canEdit={canEdit}>
        <FormSection title={t("title")} description={t("description")} icon={Bell}>
          {/* `<Switch>` tự dựng nhãn + mô tả khi có prop `label`/`description` — không phải bọc thêm
          FormField cho từng dòng. */}
          <div className="col-span-12 space-y-4">
            {/*
             * ⚠ MỘT DẤU CHO MỘT TÍNH NĂNG, VÀ NÓ PHẢI ĐẶT Ở CÁI GÁC.
             *
             * Trước đây `<NotYetActive />` nằm ở ô chọn TẦN SUẤT bên dưới, còn cái công tắc GÁC nó
             * thì trần — nên người dùng bật công tắc (không dấu, trông như thật) rồi mới gặp lời
             * cảnh báo ở control tiếp theo. Nay ngược lại: đánh dấu cái gác, và ô chọn tần suất
             * sạch, vì trạng thái bị khoá của nó đã trỏ về đây rồi.
             *
             * Không đánh dấu CẢ HAI: hai câu cảnh báo giống hệt nhau ở hai dòng liền kề đọc như một
             * lỗi lặp, và khi công tắc đang tắt thì người dùng còn gặp một câu thứ ba bảo họ đi bật
             * một control vừa được tuyên bố là chưa hoạt động.
             *
             * Dấu nằm TRONG `description`, tức trong cột nhãn của gói — nhờ `@comitor/ui` 1.8.0
             * nới `SwitchProps.description` từ `string` sang `ReactNode`. Bản trước phải kéo mô tả
             * ra một thẻ anh em rồi căn lề bằng `w-9 + gap-2.5` lấy từ nội thất của gói; đó là chép
             * hằng số riêng của gói vào app, thứ một bản nâng gói phá trong im lặng.
             */}
            {NOTIFICATION_PREFS.map((id) => (
              <Switch
                key={id}
                checked={draft.notifications[id]}
                onCheckedChange={(checked) => toggleNotification(id, checked)}
                label={t(`pref.${id}.label`)}
                description={
                  id === "email-digest" ? (
                    <>
                      {t(`pref.${id}.description`)} <NotYetActive />
                    </>
                  ) : (
                    t(`pref.${id}.description`)
                  )
                }
              />
            ))}
          </div>

          <div className="col-span-12 border-t border-border" />

          <FormField
            label={t("digestLabel")}
            colSpan={12}
            /*
             * `colSpan={12}` chứ không phải 6: hàng này KHÔNG có trường thứ hai bên cạnh, nên ở
             * colSpan 6 nửa phải bỏ trống (đo được 457px chữ trong card 976px) và câu cảnh báo bị
             * ép xuống nhiều dòng vô cớ. Ô chọn giữ bề rộng cũ bằng THẺ BỌC NGOÀI — cùng khuôn với
             * Combobox ở AGENTS.md, và là cách duy nhất giữ được `aria-describedby` mà `FormField`
             * tiêm xuống control (tách cảnh báo ra một hàng riêng sẽ cắt mất liên kết đó).
             */
            /*
             * HAI câu mô tả cho hai tình huống, không phải một câu chung: ô chọn bị khoá mà không nói
             * VÌ SAO thì người dùng nghĩ giao diện hỏng. Câu thứ hai chỉ thẳng cái công tắc phải bật.
             */
            /* Dấu "chưa hoạt động" đã đặt ở CÔNG TẮC gác phía trên — xem giải thích ở đó. */
            description={digestEnabled ? t("digestDescription") : t("digestDisabledDescription")}
          >
            {(control) => (
              <div className="sm:max-w-md">
                <Select
                  value={draft.digestFrequency}
                  onValueChange={(value) => update({ digestFrequency: value as DigestFrequency })}
                  disabled={!digestEnabled}
                >
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIGEST_FREQUENCIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`digest.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </FormField>
        </FormSection>
      </ReadOnlyFieldset>

      <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} canEdit={canEdit} onReset={reset} onSave={save} />
    </div>
  );
}
