/**
 * Xếp hạng ngôn ngữ trong header `Accept-Language` — hàm THUẦN, tầng 1.
 *
 * ⚠ Hàm này CỐ Ý không biết module hỗ trợ ngôn ngữ nào. Tầng 1 bị cấm import `next-intl` và cấm
 * biết tới `LOCALES` (xem `docs/kien-truc-ung-dung.md` §4 tầng 1): nó chỉ trả về danh sách mã ngôn
 * ngữ GỐC đã sắp theo mức ưu tiên, còn việc chọn cái nào là của `lib/i18n/config.ts`.
 *
 * Nhờ ranh giới đó, test ở đây kiểm được ĐÚNG thuật toán phân tích — kể cả những ca mà module hôm
 * nay không hỗ trợ (`ja`, `fr`) và vì thế không đi qua được bằng cách chạy thật.
 */

/**
 * Trả về mã ngôn ngữ GỐC (`en`, `vi`, `ja`) đã sắp theo `q` giảm dần, đã loại `q=0`.
 *
 * Hai điểm dễ sai, cả hai đều có test:
 *
 *   - **`q` KHUYẾT nghĩa là `q=1`, không phải `q=0`.** Coi khuyết là 0 thì `Accept-Language: en` —
 *     dạng phổ biến nhất mà trình duyệt gửi — bị loại thẳng, và người dùng tiếng Anh luôn nhận
 *     giao diện tiếng Việt mà không hiểu vì sao.
 *   - **Phải hạ về ngôn ngữ GỐC.** Trình duyệt gửi `en-US`, `en-GB`, `vi-VN`; so bằng chuỗi đầy đủ
 *     thì không bao giờ khớp `en` hay `vi`.
 *
 * `q=0` có nghĩa RÕ RÀNG trong RFC 9110: *"không chấp nhận ngôn ngữ này"*. Giữ lại nó là chọn đúng
 * thứ người dùng vừa nói là họ không đọc được.
 */
export function rankAcceptLanguage(acceptLanguage: string | null | undefined): string[] {
  if (!acceptLanguage) return [];

  return (
    acceptLanguage
      .split(",")
      .map((part) => {
        const [tag = "", ...params] = part.trim().split(";");
        const qParam = params.find((param) => param.trim().startsWith("q="));
        const quality = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
        return {
          base: tag.trim().toLowerCase().split("-")[0] ?? "",
          quality: Number.isNaN(quality) ? 0 : quality
        };
      })
      .filter((entry) => entry.base !== "" && entry.base !== "*" && entry.quality > 0)
      /*
       * `sort` của JS ổn định từ ES2019, nên hai mục cùng `q` giữ nguyên thứ tự người dùng khai —
       * đúng ý: `Accept-Language: vi,en` phải cho `vi` trước, dù cả hai đều `q=1` ngầm.
       */
      .sort((a, b) => b.quality - a.quality)
      .map((entry) => entry.base)
  );
}
