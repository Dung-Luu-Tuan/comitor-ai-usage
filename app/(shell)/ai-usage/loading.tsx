import { PageContainer, Skeleton } from "@comitor/ui";
import { getTranslations } from "next-intl/server";

export default async function AiUsageLoading() {
  const t = await getTranslations("aiUsage");

  return (
    <PageContainer width="lg">
      <div aria-busy="true" className="space-y-6 py-2">
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    </PageContainer>
  );
}
