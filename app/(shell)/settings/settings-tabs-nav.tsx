"use client";

import { RouteTabs } from "@comitor/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SETTINGS_TABS } from "@/lib/catalog/settings";

/**
 * Dải tab của trang Cài đặt.
 *
 * VÌ SAO CỤM NÀY TỒN TẠI: `RouteTabs` của gói cần `pathname` và `LinkComponent`, mà `pathname` chỉ
 * đọc được ở client (`usePathname`). Đây là đảo client nhỏ nhất có thể — `layout.tsx` bao quanh nó
 * vẫn là Server Component.
 *
 * `RouteTabs` chứ không phải `Tabs`: mỗi tab là một ROUTE thật. `Tabs` của Radix dựng
 * `role="tablist"` + `aria-controls` trỏ tới một tabpanel CÙNG TRANG — không có tabpanel nào ở đây,
 * và `role="tab"` sẽ nói dối trình đọc màn hình rằng bấm vào chỉ đổi panel tại chỗ. Hai component
 * dùng chung một bảng lớp nên nhìn không khác gì nhau.
 *
 * `LinkComponent={Link}` là BẮT BUỘC trên Next: bỏ trống thì gói render `<a>` thô và mỗi lần đổi
 * tab là tải lại cả trang.
 */

/**
 * Nhãn tab lấy từ `messages/*.json` mục `nav.*`, dùng thẳng `tab.id`.
 *
 * Nhãn KHÔNG khai lại ở namespace `settings`: thanh bên và dải tab này chỉ ra cùng bốn trang, và
 * hai bộ chuỗi cho cùng bốn trang thì sớm muộn gọi chúng bằng hai cái tên khác nhau.
 *
 * ⚠ Bản trước có một hàm `navKeyFor()` ghép `"general"` thành `"settingsGeneral"` lúc CHẠY, và tự
 * ghi rằng `tsc` không bắt được khoá sai vì khoá chỉ dựng xong lúc chạy. Hàm ấy chỉ cần thiết khi
 * `SETTINGS_TABS` còn khai tay `id: string`; nay nó SUY từ `NAV_ITEMS`, nên `tab.id` đã LÀ khoá
 * `nav.*` và kiểu của nó là `NavItemId` — thêm một tab mà quên khoá dịch là **lỗi biên dịch**,
 * không còn là một chuỗi `⟦nav.…⟧` giữa màn hình. Lệnh ép kiểu `as Parameters<typeof tNav>[0]`
 * cũng đi theo; nó là cái cuối cùng của họ đó trong repo.
 */

export function SettingsTabsNav() {
  const pathname = usePathname();
  const t = useTranslations("settings");
  const tNav = useTranslations("nav");

  return (
    <RouteTabs
      variant="pills"
      pathname={pathname}
      LinkComponent={Link}
      label={t("tabsLabel")}
      items={SETTINGS_TABS.map((tab) => ({
        href: tab.href,
        label: tNav(tab.id)
      }))}
      className="w-full"
      // `flex-1` dàn đều các pill khi còn chỗ; hẹp hơn thì `RouteTabs` tự cuộn ngang.
      itemClassName="flex-1"
    />
  );
}
