import { PageContainer, Skeleton } from "@comitor/ui";
import { getTranslations } from "next-intl/server";

/**
 * Khung chờ của khu Cài đặt — phủ luôn `/settings/notifications`, `/settings/permissions` và
 * `/settings/advanced`: `loading.tsx` ở thư mục cha tự áp cho mọi route con, nên ba tab đó không
 * cần file riêng.
 *
 * Không vẽ lại dải tab: `settings/layout.tsx` render `<SettingsTabsNav>` NGOÀI phần `children` đang
 * chờ, nên lúc khung này hiện thì dải tab đã có thật trên màn hình. Vẽ thêm một dải xám nữa là hiện
 * hai dải chồng nhau.
 *
 * Là `async` vì câu dành cho trình đọc màn hình cũng phải qua `next-intl` — một chuỗi tiếng Việt
 * cứng ở đây không nhìn thấy được bằng mắt, nên nó sẽ sống rất lâu.
 */
export default async function SettingsLoading() {
  const t = await getTranslations("settings");

  return (
    <PageContainer width="md">
      <div aria-busy="true" className="space-y-6 py-2">
        <span className="sr-only">{t("loading")}</span>

        {[0, 1].map((group) => (
          <div key={group} aria-hidden="true" className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-2/3 rounded-md" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
