import { ContrastProvider, DensityProvider, FontSizeProvider, ThemeProvider } from "@comitor/ui/shell";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DisplayPrefsSeed } from "@/components/display-prefs-seed";
import { readDisplayPrefsSeed } from "@/lib/account/prefs-seed";
import "./globals.css";

/**
 * App tự nạp Inter và gán vào `--font-inter`; gói `@comitor/ui` chỉ TIÊU THỤ biến đó
 * (`--font-sans` trỏ vào nó). Cần subset `vietnamese`, thiếu là dấu tiếng Việt rơi về font hệ
 * thống và chữ nhảy chân.
 */
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter"
});

/**
 * ĐÂY là chỗ DUY NHẤT khai đuôi thương hiệu trong tiêu đề tab.
 *
 * `template` được Next áp cho mọi `title` dạng chuỗi của trang con, nên trang con chỉ đưa TÊN
 * TRANG — tự nối thêm "· Tên sản phẩm" ở đó là tab hiện hai lần tên thương hiệu.
 *
 * `default` và `template` phải mang CÙNG một chuỗi thương hiệu: `default` dùng cho trang chủ và nó
 * KHÔNG đi qua `template`, nên nếu hai chuỗi lệch nhau thì trang chủ và trang con gọi sản phẩm
 * bằng hai tên khác nhau.
 *
 * ⚠ `generateMetadata` chứ không phải một hằng `metadata`: tên và mô tả sản phẩm nay nằm trong
 * `messages/*.json`, và một hằng ở scope module thì được đánh giá TRƯỚC khi có request nào — tức
 * trước khi biết người dùng đọc ngôn ngữ gì.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("description")
  };
}

/*
 * KHÔNG khai `export const viewport = { themeColor: … }`: giá trị đó là MÀU, mà màu của hệ Comitor
 * nằm trong token của gói. Ghi hex vào metadata là dựng một bản sao thứ hai sẽ lệch ngay lần gói
 * đổi nền. Cần thanh trạng thái trình duyệt theo brand thì thêm token + hướng dẫn ở @comitor/ui.
 */

/**
 * BỐN TRỤC HIỂN THỊ, độc lập nhau, tất cả đều ở root layout và tất cả đều "áp cho riêng bạn, trên
 * thiết bị này" — người dùng đổi ở `/settings`, mục Giao diện:
 *
 *   1. sáng/tối          `<ThemeProvider>`      → class `.dark` trên `<html>`
 *   2. bảng màu          `<ContrastProvider>`   → `data-contrast="high"`
 *   3. mật độ bố cục     `<DensityProvider>`    → `data-density="compact"`
 *   4. cỡ chữ            `<FontSizeProvider>`   → `data-font-size="sm|lg"`
 *
 * Bốn trục không biết gì về nhau nên THỨ TỰ LỒNG không quan trọng — mỗi provider chỉ sửa đúng
 * thuộc tính của nó. Ngôn ngữ là trục thứ NĂM cùng họ, nhưng nó đi đường khác: cookie
 * `comitor-locale` được đọc ở máy chủ (`lib/i18n/server.ts`) vì bộ chuỗi phải có mặt ngay trong
 * HTML đầu tiên.
 *
 * `suppressHydrationWarning` trên `<html>` là BẮT BUỘC: cả bốn script chống nháy sửa thẻ này TRƯỚC
 * khi React hydrate, nên HTML client luôn khác HTML server.
 *
 * ── ⚠ `nonce` — VÀ VÌ SAO NÓ PHẢI ĐI QUA PROP ─────────────────────────────────────────────
 * `proxy.ts` sinh nonce mỗi request và đặt nó lên header REQUEST cùng chuỗi CSP. Next TỰ gắn nonce
 * cho mọi script của CHÍNH NÓ, nhưng React 19 KHÔNG gắn hộ script do người viết render — mà bốn
 * script chống nháy ở trên chính là loại đó.
 *
 * Bỏ `nonce` đi thì hậu quả KHÔNG phải trang vỡ, mà là **nháy giao diện**: provider vẫn đặt thuộc
 * tính qua `useEffect`, nhưng SAU lượt sơn đầu tiên — nên người dùng chế độ tối thấy một chớp
 * trắng ở mỗi lần tải trang. Kèm theo đó là bốn vi phạm CSP trong console.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const displayPrefs = await readDisplayPrefsSeed();

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {/*
         * ⚠ CON ĐẦU TIÊN CỦA `<body>`, TRÊN MỌI PROVIDER — và thứ tự này là toàn bộ giá trị của nó.
         *
         * Script đồng bộ chạy theo thứ tự xuất hiện trong tài liệu. Bốn provider bên dưới mỗi cái
         * render một script chống nháy ĐỌC `localStorage`; script này GHI vào đó. Đặt nó sau bất kỳ
         * provider nào là để gói đọc trước khi ta ghi — mặc định của tài khoản chỉ có hiệu lực từ
         * lượt tải trang SAU, tức đúng một khung hình sai ở mỗi lần đăng nhập trên máy mới.
         *
         * Trả về `null` khi không có gì để gieo, nên ở đường thường nó không thêm byte nào.
         */}
        <DisplayPrefsSeed prefs={displayPrefs} nonce={nonce} />
        {/*
         * `NextIntlClientProvider` KHÔNG nhận prop `messages`: từ next-intl 4, nó tự lấy bộ chuỗi
         * và `locale` từ cấu hình theo-request (`i18n/request.ts`) qua React context của Server
         * Component. Truyền tay lại là gửi CẢ bộ chuỗi xuống bundle trình duyệt hai lần.
         */}
        <NextIntlClientProvider>
          <ThemeProvider nonce={nonce}>
            <ContrastProvider nonce={nonce}>
              <DensityProvider nonce={nonce}>
                <FontSizeProvider nonce={nonce}>{children}</FontSizeProvider>
              </DensityProvider>
            </ContrastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
