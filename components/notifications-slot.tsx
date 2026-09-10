"use client";

import { Badge, Button, Popover, PopoverContent, PopoverTrigger, RelativeTime, toast } from "@comitor/ui";
import { NotificationsButton } from "@comitor/ui/shell";
import { Clock, Info, type LucideIcon, MessageSquare, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { markNotificationsRead } from "@/lib/api-client/notifications";
import type { NotificationKind, NotificationView } from "@/lib/contracts/task";
import { isLocale } from "@/lib/i18n/config";
import { DATE_FNS_LOCALES } from "@/lib/i18n/ui-labels";

/**
 * Bảng thông báo của chuông trên header.
 *
 * VÌ SAO CỤM NÀY TỒN TẠI: `@comitor/ui` cố ý chỉ xuất ra cái NÚT (`NotificationsButton`), không
 * đóng sẵn bảng — nội dung thông báo là app-specific, gói mà đóng khuôn thì app nào cũng phải uốn
 * dữ liệu của mình cho vừa. `AppHeader` chừa `notificationsSlot` cho đúng việc này, và đây là bản
 * dựng của starter theo mẫu **AppHeader ở mục Patterns của comitor-ds**.
 *
 * Nằm ở `components/` (không phải cạnh một route) vì nó là một mảnh của KHUNG APP: mọi route đều
 * thấy nó.
 *
 * `Popover` chứ không `DropdownMenu` — dù bản duyệt vẽ bằng DropdownMenu. Đây là DANH SÁCH ĐỌC,
 * không phải menu lệnh: gắn `role="menuitem"` cho từng dòng là nói dối trình đọc màn hình, và
 * typeahead của Radix sẽ nuốt phím khi người dùng gõ. Cùng lý do mà `WorkspaceSwitcher` của gói
 * chọn Popover.
 *
 * ── DỮ LIỆU GIỮ GIÁ TRỊ, GIAO DIỆN DỰNG CÂU ──────────────────────────────────────────────
 * `NotificationView` KHÔNG mang trường `body`: câu chữ được dựng ở đây từ `kind` + vài tham số,
 * qua `notifications.sentence.*` trong `messages/`. Một câu nằm sẵn trong database thì nói mãi
 * một thứ tiếng, kể cả với người đang xem giao diện tiếng Anh — và không sửa lại được mà không
 * chạy migration.
 */

/**
 * Icon theo loại thông báo — BẢNG KHAI GIAO DIỆN, không phải dữ liệu, nên nó ở đây chứ không ở
 * tầng đọc dữ liệu: icon là component React và không tuần tự hoá được qua ranh giới
 * server → client.
 */
const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  mention: MessageSquare,
  assignment: UserPlus,
  deadline: Clock,
  system: Info
};

export interface NotificationsSlotProps {
  /**
   * Dữ liệu đọc sẵn ở `app/(shell)/layout.tsx` — cụm này không đọc bản ghi nào và không gọi API.
   *
   * KHÔNG còn prop `now`: dữ liệu nay đến từ database (seed dời theo ngày chạy), nên đồng hồ THẬT
   * mới là mốc đúng cho `<RelativeTime>`. Prop `now` chỉ đúng với dữ liệu đứng yên.
   */
  notifications: NotificationView[];
}

export function NotificationsSlot({ notifications }: NotificationsSlotProps) {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : "vi";

  /*
   * Trạng thái "đã đọc" TẠM, chỉ sống từ lúc bấm tới lúc `router.refresh()` trả về dữ liệu mới.
   *
   * ⚠ Trước đây đây là nguồn sự thật DUY NHẤT: cột `read_at` chỉ được `pnpm seed` ghi, nên "đã
   * đọc" mất sau mỗi F5 và huy hiệu đỏ quay lại. Nay nó chỉ để giao diện phản hồi ngay — máy chủ
   * mới là nơi giữ thật, và `refresh()` xoá nó đi bằng dữ liệu đúng.
   */
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set());
  const [marking, setMarking] = useState(false);

  /**
   * Dựng CÂU cho từng dòng, ngay tại đây.
   *
   * ⚠ Ba trường có thể `null`, và hai cách xử lý KHÔNG giống nhau:
   *   · `actorName === null` (người gửi đã rời không gian làm việc) → thay bằng
   *     `common.formerMember`. Câu vẫn đủ nghĩa: ai nhắc không quan trọng bằng việc bạn bị nhắc.
   *   · thiếu `taskCode` hoặc `taskTitle` → RƠI VỀ khoá `system`, không phải chèn chuỗi rỗng.
   *     Ba câu `mention`/`assignment`/`deadline` đều nói VỀ một công việc cụ thể; mất mã và tiêu
   *     đề thì "Bạn được giao  · " là một câu cụt hiện giữa màn hình. Câu `system` không nhận tham
   *     số nào nên nó luôn đọc được — và icon đi theo cùng `kind` đã rơi, để chữ và hình không nói
   *     hai chuyện khác nhau.
   */
  const items = notifications.map((item) => {
    const unread = item.unread && !readIds.has(item.id);
    const { taskCode, taskTitle } = item;

    if (item.kind === "system" || taskCode === null || taskTitle === null) {
      return {
        id: item.id,
        createdAt: item.createdAt,
        unread,
        kind: "system" as const,
        sentence: t("sentence.system")
      };
    }

    return {
      id: item.id,
      createdAt: item.createdAt,
      unread,
      kind: item.kind,
      sentence: t(`sentence.${item.kind}`, {
        actor: item.actorName ?? tCommon("formerMember"),
        code: taskCode,
        title: taskTitle
      })
    };
  });

  const unreadCount = items.filter((item) => item.unread).length;

  const markAllRead = () => {
    if (marking || unreadCount === 0) return;
    setMarking(true);

    /*
     * Đổi giao diện NGAY rồi mới gọi máy chủ: người dùng bấm để huy hiệu đỏ biến mất, và chờ một
     * vòng mạng cho việc đó là một cảm giác chậm không cần thiết. Hỏng thì trả lại — `refresh()`
     * ở nhánh thành công cũng làm đúng việc đó bằng dữ liệu thật.
     */
    const previous = readIds;
    setReadIds(new Set(notifications.map((item) => item.id)));

    void markNotificationsRead()
      .then(() => router.refresh())
      .catch((error: unknown) => {
        setReadIds(previous);
        const like =
          error && typeof error === "object" && "code" in error ? (error as { code?: string; status?: number }) : null;
        toast(errorMessage(like), { variant: "destructive" });
      })
      .finally(() => setMarking(false));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* Có `notificationsSlot` thì `AppHeader` BỎ QUA `notificationCount`, nên số trên chuông là
            con số của chính state này — không phải một prop thứ hai truyền cho shell.

            ⚠ `label` là BẮT BUỘC dù nó là prop optional. `NotificationsButton` đọc
            `DEFAULT_SHELL_LABELS.notifications` làm dự phòng — **không** đọc `labels` mà root
            layout truyền cho `ShellProvider` — nên bỏ trống là tên trợ năng của cái chuông thành
            "Thông báo (3)" giữa giao diện tiếng Anh. Đo được bằng `read_page` ở locale `en`; mắt
            thường không thấy vì nút chỉ có icon. Xem bảng prop nhãn RỜI ở `lib/i18n/ui-labels.tsx`. */}
        <NotificationsButton count={unreadCount} label={t("title")} />
      </PopoverTrigger>

      {/* `p-0` vì đầu/thân/chân tự quản đệm riêng — đúng khuôn bảng của bản duyệt. */}
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">{t("title")}</span>
          {unreadCount > 0 ? <Badge size="sm">{t("unreadCount", { count: unreadCount })}</Badge> : null}
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {items.map((item) => {
              const Icon = KIND_ICONS[item.kind];
              return (
                <li
                  key={item.id}
                  /* Nền dòng chưa đọc dùng tint của accent app (`/5` — trong trần `/5`–`/15` mà
                     hợp đồng màu cho phép), KHÔNG phải một bậc gold thô: app không sở hữu màu. */
                  className={`flex gap-3 px-4 py-3 ${item.unread ? "bg-app-accent/5" : ""}`}
                >
                  {/* Cỡ đặt bằng `size-7` + căn giữa chứ không bằng `p-1.5` quanh icon: hình
                      TRÒN chỉ tròn khi hộp vuông, mà hộp dựng bằng padding thì bề ngang phụ thuộc
                      hộp chữ của chính glyph — đổi icon là ra bầu dục. Đây cũng là công thức ô icon
                      của `StatCard` trong gói (`flex size-7 items-center justify-center`). */}
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    {/* Icon TRANG TRÍ: loại thông báo đã nằm trong chính câu chữ bên cạnh, nên gắn
                        nhãn cho nó là bắt trình đọc màn hình nghe hai lần cùng một tin.
                        `-ink` là bậc màu app khi đi LÊN nền trang; `text-app-accent` là token TÔ NỀN
                        và chỉ được 1,7:1 ở đây. */}
                    <Icon aria-hidden="true" className="size-3.5 text-app-accent-ink" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">{item.sentence}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {/* `locale` của date-fns là tham số HÀNH VI, không phải chuỗi hiển thị: thiếu
                          nó thì giao diện tiếng Anh vẫn in "3 phút trước". Không truyền `now` —
                          dữ liệu đến từ database nên đồng hồ thật là mốc đúng. */}
                      <RelativeTime value={item.createdAt} locale={DATE_FNS_LOCALES[locale]} />
                    </p>
                  </div>
                  {/* Chấm chưa đọc: một <span> trần không có role nên KHÔNG mang được `aria-label`
                      (Biome bắt đúng). Trạng thái đi bằng chữ ẩn, chấm chỉ còn là trang trí — nhờ
                      vậy "chưa đọc" không phải là thông tin chỉ-bằng-màu, vốn là lỗi WCAG 1.4.1.

                      Chữ ẩn mượn `unreadCount` với `count: 1` thay vì thêm một khoá riêng: cả bộ
                      `notifications.*` là namespace DÙNG CHUNG, và "1 chưa đọc" / "1 unread" đọc
                      lên vẫn đúng nghĩa cho đúng một dòng. */}
                  {item.unread ? (
                    <>
                      <span className="sr-only">{t("unreadCount", { count: 1 })}</span>
                      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-app-accent-ink" />
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-none"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            {t("markAllRead")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
