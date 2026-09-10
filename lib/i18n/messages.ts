import type { AbstractIntlMessages } from "next-intl";
import type { Locale } from "@/lib/i18n/config";

/**
 * Nạp bộ chuỗi của một ngôn ngữ.
 *
 * BẢNG TĨNH, không phải `import(\`../../messages/${locale}.json\`)`. Ba lý do:
 *
 *   1. Template literal trong `import()` buộc bundler gom CẢ THƯ MỤC vào một context module — mọi
 *      ngôn ngữ đi vào bundle dù người dùng chỉ đọc một.
 *   2. Thiếu file thì bảng tĩnh hỏng lúc BUILD; template literal hỏng lúc CHẠY, và hỏng đúng vào
 *      lúc người dùng đầu tiên chọn ngôn ngữ mới.
 *   3. `Record<Locale, …>` bắt TypeScript báo đỏ khi ai đó thêm mã ngôn ngữ vào `LOCALES` mà quên
 *      thêm file. Đó là toàn bộ danh sách việc phải làm khi thêm một ngôn ngữ, và nó tự nhắc.
 */
const LOADERS: Record<Locale, () => Promise<{ default: AbstractIntlMessages }>> = {
  vi: () => import("@/messages/vi.json"),
  en: () => import("@/messages/en.json")
};

export async function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  return (await LOADERS[locale]()).default;
}
