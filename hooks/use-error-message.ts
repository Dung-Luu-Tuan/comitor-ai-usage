"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

/**
 * Đổi một MÃ lỗi thành câu chữ đúng ngôn ngữ người đang xem — tầng 4 (hook cầu nối).
 *
 * ── VÌ SAO GIAO DIỆN KHÔNG IN `error.message` ─────────────────────────────────────────────
 * `ApiError.message` là BẢN DỰ PHÒNG CHO MÁY: nó đi vào log máy chủ, vào `curl` lúc gỡ lỗi, vào
 * một app khách chưa dựng bảng dịch. Nó KHÔNG đổi khi người dùng bấm "English". In nó ra màn hình
 * là để một chuỗi tiếng Việt cứng lọt vào giao diện tiếng Anh — đúng thứ mà cả tầng i18n tồn tại
 * để chặn. Giao diện đọc `code` rồi tra `errors.*`.
 *
 * ── VÌ SAO PHẢI ÉP KIỂU, VÀ VÌ SAO CHỈ ÉP Ở ĐÂY ───────────────────────────────────────────
 * `i18n/types.d.ts` làm `t()` và `t.has()` chỉ nhận khoá CÓ THẬT — đó là điều ta muốn ở mọi chỗ
 * gọi. Nhưng mã lỗi chỉ biết được lúc chạy, nên `` `errors.${code}` `` không thoả kiểu đó. Ép kiểu
 * là bắt buộc; điều quan trọng là ép ĐÚNG MỘT LẦN, ở đây, SAU `t.has()` — không rải `as never`
 * khắp các biểu mẫu, nơi nó sẽ che luôn những khoá gõ sai thật sự.
 *
 * Mã lạ (máy chủ thêm mã mới mà chưa có bản dịch) rơi về `errors.unexpected`. Đó là hành vi BẮT
 * BUỘC chứ không phải dự phòng cho đẹp — nhưng KHÔNG phải vì `next-intl` ném lỗi. Nó không ném
 * (đã đo trên 4.14.1): tra một khoá không tồn tại thì `t()` trả về **chính tên khoá**. Không có
 * `t.has()` thì người dùng gặp sự cố sẽ đọc được `⟦errors.MOT_MA_MOI⟧` giữa hộp thoại — đúng lúc
 * tệ nhất, vì họ đang cần biết chuyện gì xảy ra. `t.has()` cho ta chọn một câu chung dùng được.
 */
type ErrorLike = { code?: string | undefined; status?: number | undefined };

export function useErrorMessage() {
  const t = useTranslations("errors");

  return useCallback(
    (input: string | ErrorLike | undefined | null): string => {
      const code = typeof input === "string" ? input : input?.code;
      const status = typeof input === "string" ? undefined : input?.status;

      /*
       * ── 429 XỬ LÝ RIÊNG, VÀ KIỂM TRƯỚC `code` ────────────────────────────────────────
       * Bộ giới hạn tần suất thường trả 429 mà KHÔNG kèm `code` — nên nếu chỉ nhìn `code` thì
       * người dùng nhận "Đã có lỗi không mong muốn" đúng vào lúc câu đúng phải là "bạn thử quá
       * nhiều lần, chờ một lát".
       *
       * Đó không phải chuyện thẩm mỹ: thông điệp sai khiến người dùng bấm lại ngay, và mỗi lần bấm
       * lại đẩy cửa sổ giới hạn ra xa hơn. Câu đúng là thứ duy nhất làm họ dừng lại.
       *
       * Kiểm `status` TRƯỚC `code`: nếu có ngày máy chủ thêm `code` cho 429 thì nhánh này vẫn đúng.
       */
      if (status === 429) return t("rateLimited");

      if (!code) return t("unexpected");
      const key = code as Parameters<typeof t.has>[0];
      return t.has(key) ? t(key as Parameters<typeof t>[0]) : t("unexpected");
    },
    [t]
  );
}
