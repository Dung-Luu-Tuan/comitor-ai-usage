"use client";

import {
  Badge,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  LetterAvatar,
  RelativeTime
} from "@comitor/ui";
import { useLocale, useTranslations } from "next-intl";
import { Fragment } from "react";
import { ACTIVITY_KIND_VARIANTS } from "@/lib/catalog/task";
import type { ActivityView } from "@/lib/contracts/task";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { DATE_FNS_LOCALES } from "@/lib/i18n/ui-labels";

/**
 * Danh sách nhật ký của trang Tổng quan — hòn đảo client thứ hai của trang.
 *
 * ── VÌ SAO NÓ PHẢI LÀ `"use client"`, DÙ KHÔNG CÓ MỘT DÒNG STATE NÀO ─────────────────────
 * Vì `<RelativeTime>` cần `locale` của **date-fns** để nói "3 minutes ago" thay vì "3 phút trước",
 * mà một `Locale` của date-fns là một object CHỨA HÀM (`formatDistance`, `localize`…). Hàm không
 * tuần tự hoá được qua ranh giới server → client, nên một Server Component KHÔNG thể truyền nó
 * xuống — Next ném lỗi ngay lúc render. Bảng `DATE_FNS_LOCALES` vì thế phải được `import` từ bên
 * TRONG một file client, và đó là toàn bộ lý do file này tồn tại.
 *
 * Bỏ qua chuyện đó (không truyền `locale`) thì không có gì báo đỏ: giao diện tiếng Anh vẫn chạy,
 * chỉ có mỗi cột thời gian nói tiếng Việt.
 *
 * ── NÓ KHÔNG ĐỌC BẢN GHI NÀO ────────────────────────────────────────────────────────────
 * `activities` vào qua PROP dưới dạng thuần (`ActivityView[]` — chỉ chuỗi). Thứ duy nhất file này
 * `import` là BẢNG KHAI (`ACTIVITY_KIND_VARIANTS`), thứ không đến từ máy chủ. Nhánh RỖNG nằm ở
 * `page.tsx` chứ không ở đây: nơi có dữ liệu mới là nơi biết danh sách rỗng hay không.
 *
 * ── CÂU CHỮ DỰNG TỪ `kind`, KHÔNG LẤY TỪ DỮ LIỆU ────────────────────────────────────────
 * `ActivityView` cố ý KHÔNG có trường `verb`: một câu đã ghi vào database thì nói mãi một thứ
 * tiếng. Ở đây câu được ghép từ `activity.sentence.<kind>` trong `messages/*.json` — xem chú thích
 * đầu `lib/activities.ts`.
 */
export function ActivityFeed({ activities }: { activities: ActivityView[] }) {
  const t = useTranslations("activity");
  const tCommon = useTranslations("common");
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  return (
    <ItemGroup>
      {activities.map((activity, index) => {
        // Fail-soft: người rời nhóm không được làm mất dòng nhật ký của họ.
        const actorName = activity.actorName ?? tCommon("formerMember");
        const sentenceKey = `sentence.${activity.kind}` as const;

        /*
         * `t.has()` chặn đúng một ca: ai đó thêm một `kind` vào `ActivityKind` và vào database mà
         * quên khoá trong `messages/`. Không có nó thì next-intl in NGUYÊN ĐƯỜNG DẪN KHOÁ ra giữa
         * màn hình ("activity.sentence.blocked"). Thiếu câu thì bỏ câu — dòng vẫn còn tên người,
         * mã việc và thời điểm, tức vẫn đọc được; in một chuỗi máy ra thì không.
         */
        /*
         * ⚠ BA TRẠNG THÁI, KHÔNG PHẢI HAI — cùng luật đã áp cho `TaskView.assigneeUnknown`.
         *
         * `targetUserName` là `null` vì HAI lý do trái ngược, và `lib/activities.ts` không gộp
         * chúng: `targetUserId === null` là "không có ai để nhắc tới", còn có `targetUserId` mà
         * danh bạ tra không ra tên là "CÓ người, ta không biết tên" — ba đường dẫn tới ca sau đều
         * xảy ra thật (Account chập chờn, M2M chưa cấu hình, người đã bị gỡ khỏi workspace), và
         * `memberDirectory()` cố ý fail-open trả Map rỗng.
         *
         * Đổ cả hai về "Chưa giao" là in ra "đã giao việc cho Chưa giao" cho một việc ĐANG CÓ CHỦ —
         * tức một LỜI MỜI người khác nhận việc, đúng chữ trong AGENTS.md. Dòng ngay trên đã làm
         * đúng cho `actorName` (rơi về `common.formerMember`); đây chỉ là áp cùng phép phân biệt
         * cho `target`, và `targetUserId` đã nằm sẵn trong prop nên không phải đọc thêm gì.
         */
        const targetLabel =
          activity.targetUserName ?? (activity.targetUserId ? tCommon("formerMember") : tCommon("unassigned"));

        const sentence = t.has(sentenceKey)
          ? // Khoá `assigned` có tham số `{target}`; các khoá khác bỏ qua giá trị thừa.
            t(sentenceKey, { target: targetLabel })
          : null;

        return (
          <Fragment key={activity.id}>
            {index > 0 && <ItemSeparator />}
            {/* `px-0` để dòng thẳng lề với tiêu đề thẻ — thẻ đã có padding của nó rồi. */}
            <Item size="sm" className="px-0">
              <ItemMedia>
                <LetterAvatar name={actorName} size="sm" />
              </ItemMedia>

              <ItemContent className="min-w-0">
                <ItemTitle className="w-full min-w-0">
                  <span className="truncate">{activity.targetTitle}</span>
                </ItemTitle>
                {/* Khoảng trắng bọc trong `<span>` chứ không thả trần giữa JSX: chuỗi trần ở đây bị
                    Biome gộp lại theo cách khác nhau tuỳ chỗ xuống dòng, và khi `sentence` là
                    `null` thì còn lại hai dấu cách dính nhau. */}
                <ItemDescription className="line-clamp-1">
                  <span className="font-medium text-foreground">{actorName}</span>
                  {sentence === null ? null : <span> {sentence}</span>}
                  <span> · </span>
                  {/*
                   * KHÔNG truyền `now`: dữ liệu này đến từ database và mốc là thời điểm thật, nên
                   * đồng hồ thật là mốc đo ĐÚNG. (Bản chỉ-giao-diện trước đây phải truyền
                   * `now={DATASET_NOW}` vì dữ liệu mẫu đứng yên — lý do đó không còn.)
                   */}
                  <RelativeTime value={activity.createdAt} locale={DATE_FNS_LOCALES[locale]} />
                </ItemDescription>
              </ItemContent>

              <ItemActions>
                <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                  {activity.targetCode}
                </span>
                {/*
                 * Biến thể lấy từ bảng khai của module (`lib/catalog/task.ts`), không viết cứng tại
                 * chỗ: đổi màu một loại sự kiện thì sửa một dòng. Nhãn thì tra từ `messages/` —
                 * bảng khai cố ý KHÔNG mang chuỗi hiển thị nào.
                 */}
                <Badge variant={ACTIVITY_KIND_VARIANTS[activity.kind]} size="sm">
                  {t(`kind.${activity.kind}`)}
                </Badge>
              </ItemActions>
            </Item>
          </Fragment>
        );
      })}
    </ItemGroup>
  );
}
