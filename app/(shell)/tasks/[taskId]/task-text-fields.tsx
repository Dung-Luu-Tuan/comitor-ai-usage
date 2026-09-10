"use client";

import { InlineEdit, toast } from "@comitor/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { updateTask } from "@/lib/api-client/tasks";
import { TASK_SUMMARY_MAX_LENGTH, TASK_TITLE_MAX_LENGTH } from "@/lib/core/task-input";

/**
 * Hai ô chữ tự do của trang chi tiết — sửa TẠI CHỖ, kiểu Linear.
 *
 * ── VÌ SAO KHÔNG NẰM TRONG `PageHeader` ─────────────────────────────────────────────────────
 * Vì `PageHeader` bọc tiêu đề trong `<h1 className="truncate …">`, mà `truncate` là
 * `white-space: nowrap` + `overflow: hidden`. Một ô nhập đặt trong đó bị CẮT ngay khi người dùng
 * bắt đầu gõ — và cắt ở chỗ không có gì báo, vì chữ hiển thị lúc chưa sửa thì vẫn trông bình
 * thường. Tiêu đề vì thế xuống thân trang, nơi nó xuống dòng được; header giữ mã việc (`CV-026`),
 * là chuỗi ngắn và không bao giờ chạm giới hạn của `truncate`.
 *
 * ── VÌ SAO KHÔNG DỰNG Ô SỬA TỰ VIẾT ─────────────────────────────────────────────────────────
 * `InlineEdit` của `@comitor/ui` đã có, và nó mang bốn thứ mà một `<input>` trần không có: trạng
 * thái đang lưu khi `onSave` trả Promise, Esc để huỷ, `saveOnBlur`, và ranh giới hiển-thị/sửa để
 * người chỉ định bấm chọn không lỡ tay sửa. Viết lại là chép mã ra khỏi gói — điều repo cấm.
 *
 * ⚠ File này KHÔNG gọi `can()`; nó nhận câu TRẢ LỜI (`canEdit`) qua prop. Cùng lý do đã ghi ở
 * `task-detail-actions.tsx`, và ẩn một ô nhập vẫn không phải phân quyền: chốt thật là
 * `requirePermission()` ở route handler.
 */

/**
 * Lưu MỘT trường rồi dựng lại cây server.
 *
 * `router.refresh()` chứ không `useState`: dữ liệu trang do Server Component sở hữu, và giữ bản sao
 * ở đây là dựng nguồn sự thật thứ hai sẽ lệch với `updatedAt`. Cùng lập luận đã ghi ở
 * `task-detail-actions.tsx` — hai file, một quy tắc.
 */
function useSaveField(taskId: string) {
  const t = useTranslations("taskDetail");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const toErrorLike = (error: unknown) =>
    error && typeof error === "object" && "code" in error ? (error as { code?: string; status?: number }) : null;

  return async (patch: { title: string } | { summary: string }) => {
    try {
      await updateTask(taskId, patch);
      toast(t("savedToast"), { variant: "success" });
      startTransition(() => router.refresh());
    } catch (error) {
      toast(errorMessage(toErrorLike(error)), { variant: "destructive" });
      /*
       * NÉM LẠI: `InlineEdit` chỉ giữ người dùng ở chế độ sửa khi `onSave` từ chối. Nuốt lỗi ở đây
       * thì ô thoát ra và nháy về giá trị cũ — người dùng thấy chữ mình vừa gõ biến mất trong khi
       * toast đỏ nói "không lưu được", và họ mất luôn cả nội dung để thử lại.
       */
      throw error;
    }
  };
}

export interface TaskTitleFieldProps {
  taskId: string;
  value: string;
  canEdit: boolean;
}

export function TaskTitleField({ taskId, value, canEdit }: TaskTitleFieldProps) {
  const t = useTranslations("taskDetail");
  const save = useSaveField(taskId);

  return (
    <InlineEdit
      value={value}
      onSave={(next) => save({ title: next })}
      disabled={!canEdit}
      maxLength={TASK_TITLE_MAX_LENGTH}
      ariaLabel={t("titleAria")}
      /*
       * `required` để mặc định (true): một công việc không tên là bản ghi không tra ra được ở bảng
       * `/tasks`, và máy chủ cũng từ chối (`z.string().trim().min(1)`). Chặn ở đây thì người dùng
       * biết ngay thay vì biết sau một vòng mạng.
       */
      /*
       * ⚠ TIÊU ĐỀ DÀI BỊ CẮT BẰNG BA CHẤM, và đó là điều ĐÃ BIẾT, không phải chỗ sót.
       * `InlineEdit` ghi cứng `block truncate` lên thẻ hiển thị bên trong khi `multiline` tắt
       * (`inline-edit.tsx` của gói), còn `displayClassName` thì rơi vào thẻ NGOÀI — nên từ app
       * không với tới được. Đã cân nhắc và bỏ hai lối:
       *   · bật `multiline` cho tiêu đề: nó xuống dòng thật, nhưng Enter thành ký tự xuống dòng và
       *     tiêu đề lưu được `\n`, rồi bảng `/tasks` hiển thị lem — đổi một khuyết điểm nhìn thấy
       *     lấy một khuyết điểm nằm trong dữ liệu;
       *   · sửa ở gói (thêm prop `wrap`): đúng chỗ, nhưng là repo khác + bump + publish.
       * Chốt ngày 04/09/2026: CHẤP NHẬN CẮT. Ngày gói có prop cho phép xuống dòng thì bỏ khối chú
       * thích này đi cùng lúc với việc dùng nó.
       */
      displayClassName="text-xl font-semibold tracking-tight text-foreground md:text-2xl"
    />
  );
}

export interface TaskSummaryFieldProps {
  taskId: string;
  value: string;
  canEdit: boolean;
}

export function TaskSummaryField({ taskId, value, canEdit }: TaskSummaryFieldProps) {
  const t = useTranslations("taskDetail");
  const save = useSaveField(taskId);

  return (
    <InlineEdit
      value={value}
      onSave={(next) => save({ summary: next })}
      disabled={!canEdit}
      multiline
      /* Mô tả ĐƯỢC PHÉP rỗng — khác tiêu đề. `z.string().max(…)` không có `.min(1)`. */
      required={false}
      maxLength={TASK_SUMMARY_MAX_LENGTH}
      placeholder={t("summaryPlaceholder")}
      ariaLabel={t("summaryAria")}
      displayClassName="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
    />
  );
}
