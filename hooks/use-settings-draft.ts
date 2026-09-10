"use client";

import { toast } from "@comitor/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ApiError } from "@/lib/core/api-error";

/**
 * Bộ khung "bản nháp + lưu" dùng chung cho BỐN tab của trang Cài đặt — tầng 4 (hook cầu nối).
 *
 * ── VÌ SAO HOOK NÀY TỒN TẠI ───────────────────────────────────────────────────────────────
 * Từ khi mỗi tab là một ROUTE riêng, bốn trang biểu mẫu (Chung, Thông báo, Phân quyền, Nâng cao)
 * mỗi trang là một cây React độc lập — không còn state chung để chia. Chép bốn lần cùng một cơ chế
 * nháp / lưu / ⌘S / toast là bốn chỗ để lệch nhau; gom vào đây là một.
 *
 * GENERIC theo `T` chứ không khoá cứng vào `AppSettingsView`: tab Phân quyền sửa một MA TRẬN
 * (`PermissionMatrix`), không phải một object cài đặt phẳng. Ba tab kia truyền `AppSettingsView` và
 * không phải khai gì thêm — TypeScript suy `T` từ đối số.
 *
 * ── VÌ SAO NÓ Ở `hooks/` CHỨ KHÔNG CẠNH ROUTE ────────────────────────────────────────────
 * Vì nó KHÔNG có JSX và không biết gì về trang cài đặt: nó chỉ giữ hai bản của một giá trị và gọi
 * một hàm lưu. Thanh nút "Bỏ thay đổi · Lưu thay đổi" — phần CÓ giao diện — nằm ở
 * `app/(shell)/settings/settings-form-chrome.tsx`, cạnh đúng bốn route dùng nó.
 *
 * ── MÁY CHỦ LÀ NGUỒN SỰ THẬT SAU MỖI LẦN LƯU ─────────────────────────────────────────────
 * `persist` trả về giá trị ĐÃ LƯU do máy chủ đọc lại, và hook lấy chính giá trị đó làm `saved` +
 * `draft`. Với ma trận phân quyền thì đây không phải chi tiết thừa: `applyPermissionLocks` ở máy
 * chủ có thể ĐỔI ô người dùng vừa gửi (chủ sở hữu luôn có mọi quyền, khách không bao giờ ghi), nên
 * nếu hook tự đặt `saved = draft` thì giao diện sẽ hiện một ma trận mà database không hề chứa.
 *
 * ⚠ HỆ QUẢ CỦA ROUTE THẬT, biết trước chứ không phải lỗi: đổi tab là ĐIỀU HƯỚNG, nên bản nháp chưa
 * lưu của tab cũ mất. Đổi lại: URL chia sẻ được, nút Back hoạt động, mỗi tab có `metadata` riêng và
 * chỉ tải JS của chính nó.
 */

export interface SettingsDraft<T> {
  /** Bản ĐÃ LƯU — mốc để so "có thay đổi chưa" và để nút Bỏ thay đổi quay về. */
  saved: T;
  /** Bản đang sửa. */
  draft: T;
  update: (patch: Partial<T>) => void;
  setDraft: (next: T) => void;
  isDirty: boolean;
  /** Có một lời gọi lưu đang chạy — nút lưu khoá lại và ⌘S không kích thêm lần nữa. */
  isSaving: boolean;
  save: () => void;
  reset: () => void;
}

export function useSettingsDraft<T extends object>(
  savedValue: T,
  /** Ghi giá trị lên máy chủ và trả về bản máy chủ ĐỌC LẠI — xem chú thích đầu file. */
  persist: (value: T) => Promise<T>,
  options: {
    /**
     * `false` = trang chỉ đọc: KHÔNG đăng ký ⌘S, và `save()` không làm gì.
     *
     * ⚠ Không đủ nếu chỉ ẩn thanh lưu. Phím tắt là một đường ghi THỨ HAI, và nó không đi qua nút
     * nào cả — người chỉ-đọc nhấn ⌘S theo phản xạ sẽ bắn một request để nhận 403, tức một toast
     * đỏ cho một thao tác họ không hề thấy mình vừa làm.
     */
    canEdit?: boolean;
  } = {}
): SettingsDraft<T> {
  const canEdit = options.canEdit ?? true;
  const t = useTranslations("settings.draft");
  const describeError = useErrorMessage();

  const [saved, setSaved] = useState<T>(savedValue);
  const [draft, setDraft] = useState<T>(savedValue);
  const [isSaving, setIsSaving] = useState(false);

  /*
   * `persist` gần như luôn là một hàm mũi tên viết thẳng trong JSX của biểu mẫu, tức một tham chiếu
   * MỚI ở mỗi lần render. Đọc nó qua ref giữ cho `save` không đổi danh tính, nhờ vậy effect ⌘S bên
   * dưới không gỡ rồi gắn lại listener sau mỗi phím người dùng gõ.
   */
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  });

  // So nông bằng JSON là đủ cho một object phẳng và cho một ma trận 4 × 12: cả hai chỉ có giá trị
  // nguyên thuỷ, không có `Date`, không có `undefined`, và thứ tự khoá do chính module dựng ra.
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const update = useCallback((patch: Partial<T>) => setDraft((current) => ({ ...current, ...patch })), []);

  /*
   * Hàm có TÊN (`run`) để nhánh "Hoàn tác" bên dưới gọi lại được chính nó mà không phải tham chiếu
   * tới biến `commit` đang được khai — thứ khiến TypeScript báo lỗi vòng lặp kiểu.
   */
  const commit = useCallback(
    async function run(value: T, undoTo?: T): Promise<void> {
      setIsSaving(true);
      try {
        const stored = await persistRef.current(value);
        setSaved(stored);
        setDraft(stored);

        toast(undoTo === undefined ? t("undoneTitle") : t("savedTitle"), {
          variant: "success",
          description: t("savedDescription"),
          /*
           * "Hoàn tác" là một lần GHI THẬT nữa, không phải một phép lùi trong bộ nhớ: bản trước đã
           * nằm trong database rồi. Vì vậy nó cũng đi qua đây, và cũng có thể hỏng — khi đó nó rơi
           * vào đúng nhánh lỗi bên dưới thay vì im lặng.
           *
           * Toast của lần hoàn tác KHÔNG mang nút hoàn tác nữa: một chuỗi hoàn-tác-của-hoàn-tác chỉ
           * làm người dùng mất dấu mình đang ở bản nào.
           */
          ...(undoTo === undefined ? {} : { action: { label: t("undo"), onClick: () => void run(undoTo) } })
        });
      } catch (error) {
        /*
         * Giao diện KHÔNG in `error.message`: đó là bản dự phòng cho MÁY, viết bằng tiếng Anh và
         * không đổi theo ngôn ngữ người xem. `useErrorMessage()` tra `errors.*` theo `code`, và lỗi
         * lạ (không phải `ApiError`) rơi về câu chung.
         */
        toast(t("failedTitle"), {
          variant: "destructive",
          description: describeError(error instanceof ApiError ? error : undefined)
        });
      } finally {
        setIsSaving(false);
      }
    },
    [describeError, t]
  );

  const save = useCallback(() => {
    if (!canEdit || !isDirty || isSaving) return;
    // Chụp bản đã lưu TRƯỚC khi ghi đè — đó là thứ nút "Hoàn tác" trong toast khôi phục.
    void commit(draft, saved);
  }, [canEdit, commit, draft, isDirty, isSaving, saved]);

  const reset = useCallback(() => setDraft(saved), [saved]);

  /*
   * ⌘/Ctrl + S — lưu nhanh. Đăng ký ở đây chứ không ở shell vì phím này chỉ có nghĩa trên trang có
   * gì đó để lưu, và `<KeyboardHint keys="mod+s">` ở thanh lưu chỉ được phép hiện khi phím thật sự
   * chạy.
   *
   * KHÁC với phím tắt toàn cục của `AppShell`: chỗ này CỐ Ý không bỏ qua khi con trỏ đang ở trong ô
   * nhập — người dùng vừa gõ xong thì đúng lúc đó mới cần lưu. `preventDefault` để trình duyệt
   * không mở hộp thoại "Lưu trang".
   */
  useEffect(() => {
    if (!canEdit) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || !(event.metaKey || event.ctrlKey) || event.shiftKey) return;
      event.preventDefault();
      save();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canEdit, save]);

  return { saved, draft, update, setDraft, isDirty, isSaving, save, reset };
}
