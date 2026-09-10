import { parseIsoDate } from "@/lib/core/iso-date";
import type { Locale } from "@/lib/i18n/config";

/**
 * Định dạng NGÀY và THỜI LƯỢNG cho hiển thị.
 *
 * ── VÌ SAO FILE NÀY KHÔNG NẰM Ở `lib/core/` ────────────────────────────────────────────────
 * Vì nó TRẢ VỀ CHUỖI HIỂN THỊ, và tầng 1 bị cấm điều đó (`pnpm core:check` sẽ báo đỏ). Phần quy
 * tắc — cắt chuỗi ISO, đếm ngày, so sánh — nằm ở `lib/core/iso-date.ts` và có test; ở đây chỉ là
 * lớp mỏng đổi giá trị thành chữ.
 *
 * ── VÌ SAO NHẬN `locale` QUA THAM SỐ, KHÔNG ĐỌC TỪ CONTEXT ────────────────────────────────
 * Vì cùng một hàm phải dùng được ở BA nơi có ba nguồn ngôn ngữ khác nhau:
 *   · Server Component  → `getLocale()` của next-intl;
 *   · Client Component  → `useLocale()`;
 *   · nội dung EMAIL    → ngôn ngữ của NGƯỜI NHẬN, không phải của request (xem `lib/mail.ts`).
 * Một hàm tự đọc context sẽ đúng ở hai chỗ đầu và SAI ÂM THẦM ở chỗ thứ ba — gửi thư tiếng Việt
 * cho người đã chọn tiếng Anh, và không có gì báo.
 *
 * File này KHÔNG có `server-only`: nó chạy được ở cả hai phía, và đó là mục đích.
 */

/**
 * Khuôn `Intl` theo ngôn ngữ, dựng LƯỜI và giữ lại.
 *
 * `new Intl.DateTimeFormat(...)` là một phép dựng ĐẮT (nó phải nạp dữ liệu locale). Gọi nó trong
 * một vòng lặp render 25 dòng bảng là 25 lần dựng cho một kết quả giống hệt nhau.
 */
const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();

/** `vi` → `28/08/2026` · `en` → `Aug 28, 2026`. Khuôn khác nhau là ĐÚNG, không phải chưa thống nhất. */
const DATE_FORMAT_OPTIONS: Record<Locale, Intl.DateTimeFormatOptions> = {
  vi: { day: "2-digit", month: "2-digit", year: "numeric" },
  en: { day: "numeric", month: "short", year: "numeric" }
};

/** Mã BCP-47 đầy đủ. `vi` một mình cũng chạy, nhưng `vi-VN` khoá đúng cách viết ngày của Việt Nam. */
const INTL_LOCALES: Record<Locale, string> = { vi: "vi-VN", en: "en-US" };

function dateFormatter(locale: Locale): Intl.DateTimeFormat {
  const cached = dateFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], DATE_FORMAT_OPTIONS[locale]);
  dateFormatters.set(locale, formatter);
  return formatter;
}

/**
 * Chuỗi ISO → ngày đọc được. Nhận CẢ HAI dạng: chỉ-có-ngày (`2026-08-28`) và mốc đầy đủ
 * (`2026-08-28T08:12:00+07:00`).
 *
 * ⚠ Đi qua `parseIsoDate` rồi mới dựng `Date` bằng `Date.UTC(...)`, TUYỆT ĐỐI không
 * `new Date("2026-08-28")`: JS hiểu chuỗi đó là mốc **UTC**, nên máy ở múi giờ âm in ra NGÀY HÔM
 * TRƯỚC. Lỗi này không lộ ra ở GMT+7 — nó chỉ xuất hiện sau khi deploy, và chỉ với một phần người
 * dùng.
 *
 * Dựng bằng `Date.UTC` rồi định dạng với `timeZone: "UTC"` thì con số in ra đúng bằng con số trong
 * chuỗi, ở mọi múi giờ. Đó là điều duy nhất ta muốn với một ngày chỉ-có-ngày.
 *
 * Chuỗi không đúng dạng thì trả NGUYÊN VĂN: một ngày hiển thị lạ vẫn hơn `NaN/NaN/NaN`.
 */
export function formatIsoDateFor(locale: Locale, isoDate: string): string {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { ...DATE_FORMAT_OPTIONS[locale], timeZone: "UTC" }).format(
    value
  );
}

/** Dùng khi đã có sẵn một `Date` (từ `<DatePicker>`), tức không có chuyện diễn giải nhầm múi giờ. */
export function formatDateFor(locale: Locale, value: Date): string {
  return dateFormatter(locale).format(value);
}

/**
 * Phút → chuỗi giờ đọc được: `90` → `1,5 giờ` (vi) / `1.5 h` (en).
 *
 * Đơn vị lưu là PHÚT (số nguyên) chứ không phải giờ (số thực) — xem `estimateMinutes` trong
 * `prisma/schema.prisma` về lý do. Phép đổi sang giờ chỉ xảy ra ở tầng hiển thị này.
 *
 * `unitLabel` truyền vào từ nơi gọi (đã tra `messages/`), vì file này không được biết tới i18n:
 * kéo `next-intl` vào đây là kéo nó vào cả đường EMAIL, nơi không có request nào để mà đọc context.
 */
export function formatMinutesFor(locale: Locale, minutes: number, unitLabel: string): string {
  const hours = minutes / 60;
  const number = new Intl.NumberFormat(INTL_LOCALES[locale], { maximumFractionDigits: 1 }).format(hours);
  return `${number} ${unitLabel}`;
}
