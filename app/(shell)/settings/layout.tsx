import { PageContainer, PageHeader } from "@comitor/ui";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SettingsTabsNav } from "./settings-tabs-nav";

/**
 * Khung dùng chung của MỌI tab trong Cài đặt — `/settings`, `/settings/notifications`,
 * `/settings/permissions`, `/settings/advanced`.
 *
 * ⚠ CẢ BỐN TAB LÀ CÀI ĐẶT CỦA RIÊNG MODULE NÀY. Không gian làm việc, thành viên, lời mời, hồ sơ cá
 * nhân và bảo mật thuộc **Comitor.Account** — xem `lib/account/links.ts`. Câu mô tả dưới nói ra ranh
 * giới đó ĐÚNG MỘT LẦN, ở chỗ luôn nhìn thấy; nhắc lại nó trong từng tab là bốn bản chép rời để
 * lệch nhau.
 *
 * Vì sao là layout chứ không phải chép header vào từng trang: header và dải tab không đổi giữa các
 * tab, nên Next giữ nguyên cây này khi điều hướng qua lại — không nháy, không dựng lại.
 *
 * Vẫn là Server Component: chỉ mỗi `<SettingsTabsNav>` cần client (nó đọc `usePathname`). Tiêu đề
 * lấy từ `nav.settings` — CÙNG chuỗi mà thanh bên đang hiện, vì hai chỗ đó nói về đúng một trang.
 *
 * `PageHeader` đặt NGOÀI `PageContainer`: header của gói tự có padding, nền và đường kẻ dưới nên nó
 * chạy hết bề ngang vùng nội dung, còn `PageContainer` mới là thứ giới hạn bề rộng phần thân.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("settings");
  const tNav = await getTranslations("nav");

  return (
    <>
      <PageHeader title={tNav("settings")} description={t("headerDescription")} />
      <PageContainer width="md" className="space-y-5">
        <SettingsTabsNav />
        {children}
      </PageContainer>
    </>
  );
}
