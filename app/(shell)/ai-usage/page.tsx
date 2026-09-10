import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/account/session";
import { getAiUsageSnapshot } from "@/lib/ai-usage";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { requireReadPermission } from "@/lib/permissions";
import { AiUsagePanel } from "./ai-usage-panel";

/**
 * `/ai-usage` — giao diện admin của cổng LLM nội bộ, dựng bằng `@comitor/ui`.
 *
 * Cổng hỏi AI vẫn là Express `ai-gateway` cổng 3100 (Claude Code / Cline không đi qua phiên
 * Account). Trang này chỉ CẤP MÃ, dán key hãng và đọc nhật ký — cùng file JSON mà Express đọc.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("aiUsage") };
}

export default async function AiUsagePage() {
  const session = await requireSession();
  await requireReadPermission(session.workspace.id, session.role, "app.settings");
  const snapshot = getAiUsageSnapshot();
  const rawLocale = await getLocale();

  return <AiUsagePanel snapshot={snapshot} locale={isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE} />;
}
