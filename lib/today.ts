import { toIsoDate } from "@/lib/core/iso-date";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/config";

/**
 * "Hôm nay" là ngày nào — theo MÚI GIỜ ĐƯỢC TRUYỀN VÀO, không phải của máy chủ.
 *
 * ⚠ **Luôn truyền `timeZone` tường minh ở đường request.** Từ 05.09.2026 "hôm nay" được đọc bằng
 * lịch của NGƯỜI XEM (`AccountUser.timezone`), nên giá trị mặc định dưới đây chỉ là lưới đỡ cho
 * những chỗ chưa biết người xem là ai — không phải câu trả lời đúng. Khái niệm "múi giờ của không
 * gian làm việc" đã bị bỏ; xem `lib/i18n/config.ts` cho quyết định đầy đủ và cái giá của nó.
 *
 * ── VÌ SAO KHÔNG DÙNG `new Date().toISOString().slice(0, 10)` ─────────────────────────────
 * Vì `toISOString()` luôn trả về UTC. Lúc 09:00 sáng ngày 25/08 ở Việt Nam (GMT+7) thì UTC vẫn
 * đang là 02:00 ngày 25/08 — trùng nhau, may mắn. Nhưng lúc **06:30 sáng ngày 25/08** ở Việt Nam,
 * UTC là 23:30 ngày **24/08**: mọi phép so "quá hạn chưa" lùi đúng một ngày, mỗi ngày, trong bảy
 * tiếng đầu.
 *
 * Hậu quả cụ thể: một công việc hạn 24/08 KHÔNG được đánh dấu quá hạn cho tới sau 7 giờ sáng — và
 * đó là khoảng thời gian mà người dùng Việt Nam mở app nhiều nhất. Máy chủ chạy ở vùng nào thì
 * khoảng lệch đổi theo vùng đó, nên lỗi này còn "di chuyển" theo hạ tầng.
 *
 * ── VÌ SAO `formatToParts` CHỨ KHÔNG `Intl` VỚI LOCALE `en-CA` ────────────────────────────
 * `en-CA` tình cờ in ra `YYYY-MM-DD`, và rất nhiều mã trên mạng dựa vào điều đó. Nhưng đó là một
 * QUY ƯỚC HIỂN THỊ của một locale, không phải một hợp đồng — nó đổi được ở một bản CLDR sau, và
 * khi đổi thì mọi so sánh ngày trong app hỏng im lặng. `formatToParts` lấy ra từng thành phần rồi
 * ta tự ghép: kết quả không phụ thuộc cách một locale nào đó thích viết ngày.
 */
export function todayIso(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const find = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? Number(value) : 0;
  };

  return toIsoDate({ year: find("year"), month: find("month"), day: find("day") });
}
