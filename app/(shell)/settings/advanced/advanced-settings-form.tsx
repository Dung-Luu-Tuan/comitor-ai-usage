"use client";

import {
  Button,
  ConfirmDialog,
  FormField,
  FormSection,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast
} from "@comitor/ui";
import { Database, Trash2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSettingsDraft } from "@/hooks/use-settings-draft";
import { saveSettings } from "@/lib/api-client/settings";
import { APP_DATA_PREFS, ARCHIVE_OPTIONS } from "@/lib/catalog/settings";
import type { AppDataPrefId, AppSettingsView, ArchiveAfter } from "@/lib/contracts/settings";
import {
  HelpTip,
  NotWiredUp,
  NotYetActive,
  ReadOnlyFieldset,
  SettingsReadOnlyNotice,
  SettingsSaveBar
} from "../settings-form-chrome";

export interface AdvancedSettingsFormProps {
  /** Vai trò hiện tại có được đổi cài đặt của ứng dụng không (`app.settings`) — chốt thật ở API. */
  canEdit: boolean;
  savedSettings: AppSettingsView;
  /** Đếm ở `page.tsx`, từ database — dùng cho câu cảnh báo trong Vùng nguy hiểm. */
  taskCount: number;
  projectCount: number;
  workspaceName: string;
  /** Địa chỉ rút gọn — chuỗi người dùng phải gõ lại để mở khoá nút xoá. */
  workspaceSlug: string;
}

/**
 * Nửa TƯƠNG TÁC của tab "Nâng cao" (`/settings/advanced`).
 *
 * ⚠ TAB NÀY LÀ "NÂNG CAO CỦA MODULE", KHÔNG PHẢI CỦA KHÔNG GIAN LÀM VIỆC. Bắt buộc xác thực hai
 * bước, cho phép thành viên mời người khác, xoá không gian làm việc — cả ba từng nằm ở đây và cả ba
 * đã đi về Comitor.Account (`lib/account/links.ts`), nơi duy nhất có thẩm quyền với chúng.
 *
 * Vùng nguy hiểm còn lại vì thế hẹp hơn hẳn, và đó là điều đúng: thứ module này xoá được là DỮ LIỆU
 * CỦA CHÍNH NÓ. Không gian làm việc, thành viên và các module khác không hề hấn gì — câu mô tả
 * trong hộp thoại nói thẳng ra như vậy, vì hành động phá huỷ mà mô tả mơ hồ về phạm vi thì người
 * dùng hoặc sợ mà không dám bấm, hoặc bấm rồi mới biết mình mất gì.
 */
export function AdvancedSettingsForm({
  savedSettings,
  canEdit,
  taskCount,
  projectCount,
  workspaceName,
  workspaceSlug
}: AdvancedSettingsFormProps) {
  const t = useTranslations("settings.advanced");
  const { draft, setDraft, update, isDirty, isSaving, save, reset } = useSettingsDraft(savedSettings, saveSettings, {
    canEdit
  });

  const toggleDataPref = (id: AppDataPrefId, value: boolean) =>
    setDraft({ ...draft, data: { ...draft.data, [id]: value } });

  return (
    <div className="space-y-5">
      {!canEdit && <SettingsReadOnlyNotice />}
      {/* Bọc CẢ vùng nguy hiểm: xoá dữ liệu ứng dụng cũng chốt bằng `app.settings` ở `app/api/settings`. */}
      <ReadOnlyFieldset canEdit={canEdit}>
        <FormSection
          title={t("dataTitle")}
          description={t("dataDescription")}
          icon={Database}
          actions={<HelpTip label={t("helpLabel")}>{t("help")}</HelpTip>}
        >
          <div className="col-span-12 space-y-4">
            {APP_DATA_PREFS.map((id) => (
              <Switch
                key={id}
                checked={draft.data[id]}
                onCheckedChange={(checked) => toggleDataPref(id, checked)}
                label={t(`data.${id}.label`)}
                description={t(`data.${id}.description`)}
              />
            ))}
          </div>

          <div className="col-span-12 border-t border-border" />

          <FormField
            label={t("archiveLabel")}
            colSpan={12}
            /*
             * `colSpan={12}` chứ không phải 6: hàng này KHÔNG có trường thứ hai bên cạnh, nên ở
             * colSpan 6 nửa phải bỏ trống (đo được 457px chữ trong card 976px) và câu cảnh báo bị
             * ép xuống nhiều dòng vô cớ. Ô chọn giữ bề rộng cũ bằng THẺ BỌC NGOÀI — cùng khuôn với
             * Combobox ở AGENTS.md, và là cách duy nhất giữ được `aria-describedby` mà `FormField`
             * tiêm xuống control (tách cảnh báo ra một hàng riêng sẽ cắt mất liên kết đó).
             */
            description={
              <>
                {t("archiveDescription")} <NotYetActive />
              </>
            }
          >
            {(control) => (
              <div className="sm:max-w-md">
                <Select
                  value={draft.archiveAfter}
                  onValueChange={(value) => update({ archiveAfter: value as ArchiveAfter })}
                >
                  <SelectTrigger {...control} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARCHIVE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`archive.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </FormField>
        </FormSection>

        {/* `accent="destructive"` vẽ vạch đỏ bên trái — dấu hiệu thị giác của nhóm nguy hiểm. */}
        <FormSection
          title={t("dangerTitle")}
          description={t("dangerDescription")}
          icon={TriangleAlert}
          accent="destructive"
        >
          <div className="col-span-12 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t("resetTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("resetDescription", { tasks: taskCount, projects: projectCount })}
              </p>
              {/*
                Ô `archiveAfter` ngay phía trên đã mang dấu này; vùng nguy hiểm thì chưa, dù nó
                cũng chưa nối máy chủ. Người dùng chỉ biết SAU KHI đã gõ đúng slug workspace và
                bấm nút — tức sau khi đã tin rằng nó thật. Luật ở AGENTS.md: "một cài đặt không
                làm gì tệ hơn một cài đặt còn thiếu".

                ⚠ `NotWiredUp`, KHÔNG phải `NotYetActive`: cái sau nói "giá trị được lưu nhưng chưa
                có gì đọc" — đúng cho một ô cài đặt, sai cho một cái nút.
              */}
              <NotWiredUp />
            </div>
            <ResetAppDataDialog workspaceName={workspaceName} workspaceSlug={workspaceSlug} />
          </div>
        </FormSection>
      </ReadOnlyFieldset>

      <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} canEdit={canEdit} onReset={reset} onSave={save} />
    </div>
  );
}

/**
 * Xác nhận xoá dữ liệu module — hành động nguy hiểm nhất còn lại trong app.
 *
 * Ba lớp bảo vệ, đúng kiểu các sản phẩm SaaS lớn: `variant="destructive"` (nút đỏ + icon đỏ), phải
 * GÕ LẠI địa chỉ rút gọn thì nút xác nhận mới mở khoá (`confirmDisabled`), và tự dọn ô nhập mỗi lần
 * đóng để lần mở sau không còn "mở khoá sẵn".
 *
 * `open`/`onOpenChange` do trang giữ (controlled) chính vì lớp thứ ba đó; nếu không cần dọn state
 * thì để `ConfirmDialog` tự quản là đủ.
 *
 * ⚠ ĐÂY LÀ CHỖ DUY NHẤT TRONG KHU CÀI ĐẶT CHƯA NỐI MÁY CHỦ, và cố ý: một endpoint xoá sạch dữ liệu
 * của cả không gian làm việc không phải thứ nên có mặt sẵn trong một bản khởi tạo. Nối nó là việc
 * của module thật, và lúc đó `onConfirm` trả về một Promise — `ConfirmDialog` tự khoá nút và hiện
 * trạng thái đang xử lý cho tới khi xong.
 */
function ResetAppDataDialog({ workspaceName, workspaceSlug }: { workspaceName: string; workspaceSlug: string }) {
  const t = useTranslations("settings.advanced");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
      trigger={
        <Button variant="destructive" leftIcon={<Trash2 className="size-4" />}>
          {t("resetButton")}
        </Button>
      }
      variant="destructive"
      icon={TriangleAlert}
      title={t("dialogTitle")}
      description={t.rich("dialogDescription", {
        workspace: workspaceName,
        strong: (chunks) => <strong className="font-medium text-foreground">{chunks}</strong>
      })}
      confirmLabel={t("confirmLabel")}
      cancelLabel={t("cancelLabel")}
      confirmDisabled={confirmText.trim() !== workspaceSlug}
      onConfirm={() => {
        toast(tCommon("notConnected"), { variant: "info", description: tCommon("notConnectedHint") });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="reset-app-data-confirm">
          {t.rich("confirmHint", {
            slug: workspaceSlug,
            code: (chunks) => (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{chunks}</code>
            )
          })}
        </Label>
        <Input
          id="reset-app-data-confirm"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder={workspaceSlug}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </ConfirmDialog>
  );
}
