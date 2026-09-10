"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  KeyboardHint,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@comitor/ui";
import { Info, Lock, Save, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Phần GIAO DIỆN dùng chung của bốn biểu mẫu trong Cài đặt: thanh lưu ở cuối trang và nút chú
 * thích "i" ở đầu mỗi nhóm trường.
 *
 * Cơ chế nháp/lưu — phần KHÔNG có giao diện — nằm ở `hooks/use-settings-draft.ts`. Hai thứ tách
 * nhau vì chúng đổi vì những lý do khác nhau: thanh nút đổi khi thiết kế đổi, còn cơ chế lưu đổi
 * khi API đổi.
 *
 * Cụm này ở CẠNH ROUTE chứ không ở `components/`: nó chỉ phục vụ khu `/settings`, và bốn tab của
 * khu đó là toàn bộ người dùng của nó.
 */

/**
 * Báo cho người không có quyền sửa biết rằng trang này CHỈ ĐỌC — trước khi họ gõ.
 *
 * ⚠ Ba trong bốn tab của `/settings` từng render `SettingsSaveBar` sáng bình thường cho MỌI vai
 * trò, trong khi API chốt `app.settings` (chỉ owner/admin). Một `member` mở trang, đổi vài ô, bấm
 * Lưu (hoặc ⌘S) — và nhận một toast đỏ chung chung sau khi đã mất công. Tab Phân quyền thì làm
 * đúng ngay từ đầu; ba tab kia không, và chỗ lệch đó không cổng nào bắt được.
 */
export function SettingsReadOnlyNotice() {
  const t = useTranslations("settings.readOnly");

  return (
    <Alert variant="warning">
      <Lock aria-hidden="true" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>{t("description")}</AlertDescription>
    </Alert>
  );
}

/**
 * Vô hiệu hoá cả một vùng biểu mẫu khi vai trò hiện tại không có quyền sửa.
 *
 * ── VÌ SAO CẦN, KHI ĐÃ CÓ `SettingsReadOnlyNotice` VÀ THANH LƯU ĐÃ BIẾN MẤT ──────────────
 * Vì lời cảnh báo ở đầu trang không chặn được ngón tay. Đã đo trên luồng thật: một người chỉ-đọc
 * mở tab Thông báo, bấm một công tắc — công tắc LẬT (`aria-checked` true → false), không control
 * nào bị vô hiệu, và vì thanh lưu không render nên **không có gì nói rằng thay đổi đó không được
 * lưu**. Họ rời trang và tin là đã đổi. Giao diện nói dối, đúng hạng lỗi mà đợt này dọn.
 *
 * ── VÌ SAO `<fieldset disabled>` CHỨ KHÔNG PHẢI `disabled` TỪNG CONTROL ────────────────────
 * Vì `disabled` rải ra từng control là thứ sẽ bị quên ở control tiếp theo có người thêm vào, và
 * không cổng nào bắt được cái quên đó. `<fieldset disabled>` vô hiệu hoá MỌI control hậu duệ theo
 * đặc tả HTML, kể cả cái vừa được thêm.
 *
 * `className="contents"` là phần bắt buộc: bốn biểu mẫu này là lưới 12 cột và con của chúng mang
 * `col-span-*`, nên một hộp `<fieldset>` thật xen vào giữa sẽ cắt đứt quan hệ cha-con của lưới.
 * `display: contents` bỏ hộp đi mà giữ nguyên ngữ nghĩa. Đã đo cả ba mặt trên trình duyệt thật:
 * click KHÔNG chạy, `:disabled` KHỚP (nên biến thể `disabled:` của Tailwind vẫn ăn), và phần tử
 * rời khỏi thứ tự Tab.
 *
 * ⚠ Đừng bọc phần **Giao diện** ở tab Chung: sáng/tối, tương phản, mật độ, cỡ chữ và ngôn ngữ là
 * tuỳ chọn của RIÊNG người đang xem, trên RIÊNG máy này — chúng không phải cài đặt của không gian
 * làm việc, nên quyền `app.settings` không nói gì về chúng.
 */
export function ReadOnlyFieldset({ canEdit, children }: { canEdit: boolean; children: ReactNode }) {
  if (canEdit) return children;

  return (
    <fieldset disabled className="contents">
      {children}
    </fieldset>
  );
}

/**
 * Thanh "Bỏ thay đổi · Lưu thay đổi" đứng cuối mỗi trang biểu mẫu.
 *
 * `canEdit === false` thì thanh này KHÔNG render gì: một thanh nút bị vô hiệu vẫn mời người ta thử
 * bấm, và câu trả lời cho "vì sao mờ" nằm ở `SettingsReadOnlyNotice` phía trên chứ không ở đây.
 */
export function SettingsSaveBar({
  isDirty,
  isSaving,
  canEdit = true,
  onReset,
  onSave
}: {
  isDirty: boolean;
  isSaving: boolean;
  canEdit?: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  const t = useTranslations("settings.draft");
  const tCommon = useTranslations("common");

  if (!canEdit) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
      <p className="mr-auto text-xs text-muted-foreground">
        {isDirty
          ? /*
             * Phím tắt chèn vào GIỮA câu bằng thẻ ICU chứ không nối chuỗi: trật tự từ mỗi ngôn ngữ
             * một khác, và một câu vỡ làm hai mảnh `"… nhấn"` + `"để lưu nhanh"` thì bản dịch nào
             * cần đảo vế cũng không có cách nào đảo. Nội dung trong thẻ (`mod+s`) không hiện ra —
             * `<KeyboardHint>` tự vẽ ký hiệu đúng theo hệ điều hành đang chạy.
             */
            t.rich("dirty", { kbd: () => <KeyboardHint keys="mod+s" compact /> })
          : t("clean")}
      </p>
      <Button variant="ghost" onClick={onReset} disabled={!isDirty || isSaving}>
        {tCommon("discard")}
      </Button>
      <Button onClick={onSave} disabled={!isDirty || isSaving} leftIcon={<Save className="size-4" />}>
        {isSaving ? tCommon("saving") : tCommon("save")}
      </Button>
    </div>
  );
}

/**
 * Nút "i" mở một chú thích ngắn.
 *
 * Là `<Button>` thật chứ không phải `<span>`: Radix Tooltip mở khi trigger được hover HOẶC nhận
 * focus, đặt lên phần tử không focus được là bỏ rơi người dùng bàn phím. `aria-label` bắt buộc —
 * nút chỉ có icon, và tooltip KHÔNG phải tên gọi trợ năng (Radix chỉ gắn nó lúc hover/focus).
 */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground">
          <Info className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Đánh dấu một HÀNH ĐỘNG chưa nối máy chủ.
 *
 * ⚠ KHÁC `<NotYetActive />`, và khác ở CÂU CHỮ chứ không ở hình thức. `NotYetActive` nói "giá trị
 * này được lưu nhưng chưa có gì đọc nó" — đúng cho một ô cài đặt, SAI cho một cái nút: nút không
 * lưu giá trị nào cả. Dùng nhầm là dán một câu không liên quan lên đúng chỗ người dùng cần một câu
 * chính xác.
 *
 * Ca thật: vùng nguy hiểm ở `/settings/advanced` là chỗ DUY NHẤT trong khu cài đặt chưa nối máy chủ
 * (cố ý — xem `docs/con-ton.md` §2), nhưng nó không mang dấu nào, trong khi ô ngay phía trên thì
 * có. Người dùng chỉ biết SAU KHI đã gõ đúng slug workspace và bấm nút — tức sau khi đã tin rằng
 * nó thật.
 */
export function NotWiredUp() {
  const t = useTranslations("common");

  return (
    <span className="mt-1.5 flex items-start gap-1.5 text-xs text-warning-ink">
      <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span>{t("notConnectedHint")}</span>
    </span>
  );
}

/**
 * Đánh dấu một ô cài đặt ĐƯỢC LƯU nhưng CHƯA CÓ AI ĐỌC.
 *
 * ── VÌ SAO KHÔNG XOÁ HẲN Ô ĐÓ ĐI ────────────────────────────────────────────────────────
 * Vì hình dạng của cài đặt là đúng — thứ còn thiếu là một job nền, và module thật sẽ dựng nó. Xoá
 * đi rồi dựng lại là mất cả cột database lẫn bản dịch.
 *
 * ── NHƯNG ĐỂ NGUYÊN THÌ GIAO DIỆN NÓI DỐI ──────────────────────────────────────────────
 * Người dùng chọn "lưu trữ sau 90 ngày", bấm Lưu, thấy toast xanh — và không gì lưu trữ. Với một
 * bản mẫu thì tệ hơn một tầng nữa: nó dạy rằng thêm một công tắc vào `/settings` mà không nối gì
 * là chấp nhận được, và đó chính xác là thói quen sinh ra bốn ô như thế này.
 *
 * Nói ra thì rẻ, đúng, và tự xoá khi ai đó nối xong: gỡ `<NotYetActive />` là xong.
 *
 * ⚠ Câu nói ra là câu cho NGƯỜI DÙNG CUỐI, nên nó không được nhắc `scripts/jobs/` hay
 * `lib/reminders.ts` — người mở /settings không đọc mã. Khuôn job nền ở `scripts/jobs/`,
 * và một job đã nối đủ ở `lib/reminders.ts`; chỗ ghi hai đường dẫn đó là ĐÂY.
 *
 * ⚠ Và chuỗi phải dùng THẺ ICU (`<strong>…</strong>`), không dùng markdown `**…**`:
 * `t.rich` chỉ hiểu thẻ, còn dấu sao thì nó in ra nguyên văn. Bản đầu viết markdown và
 * hai dấu sao hiện thẳng lên giao diện ở cả hai ngôn ngữ.
 */
export function NotYetActive() {
  const t = useTranslations("settings");

  return (
    <span className="mt-1.5 flex items-start gap-1.5 text-xs text-warning-ink">
      {/*
       * `shrink-0`: không có nó thì icon bị NÉN NGANG khi dòng chật — đo được 11.3×14 cho một
       * icon khai 14×14, tức méo 19% mà không có gì báo.
       */}
      <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      {/*
       * Bọc phần chữ trong MỘT <span>. `t.rich` trả về một MẢNG node — chữ trước, <strong>, chữ
       * sau — và mỗi phần tử của mảng thành MỘT FLEX ITEM riêng nếu là con trực tiếp của flex
       * container. Đo được: một câu bị xé thành ba cột, mỗi cột tự xuống dòng riêng. Bọc lại thì
       * cả câu là một item và chảy như văn bản bình thường.
       */}
      <span>{t.rich("notYetActive", { strong: (chunks) => <strong className="font-semibold">{chunks}</strong> })}</span>
    </span>
  );
}
