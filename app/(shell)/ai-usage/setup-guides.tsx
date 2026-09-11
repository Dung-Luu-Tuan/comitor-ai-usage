"use client";

/**
 * Hướng dẫn khai mã trên /ai-usage: Claude Code VS Code + ứng dụng Desktop, rồi Cline / Cursor.
 *
 * Tách khỏi panel vì panel đã giữ bảng người/mã. Chuỗi menu Desktop giữ tiếng Anh vì đó là nhãn
 * trên ứng dụng Anthropic.
 */

import { Button } from "@comitor/ui";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

export function SetupGuides({ origin, onCopy }: { origin: string; onCopy: (value: string) => Promise<void> }) {
  const t = useTranslations("aiUsage");
  const snippet = vscodeSnippet(origin);
  const openaiOrigin = `${origin}/v1`;

  return (
    <div className="col-span-12 space-y-4 text-sm text-muted-foreground">
      <p>{t("setupClaudeNeed")}</p>

      <div className="space-y-3 rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-medium text-foreground">{t("setupVscodeTitle")}</h3>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>{t("setupVscodeStep1")}</li>
          <li>{t("setupVscodeStep2")}</li>
          <li>{t("setupVscodeStep3")}</li>
          <li>{t("setupVscodeStep4")}</li>
        </ol>
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs text-foreground">{snippet}</pre>
        <Button
          type="button"
          size="sm"
          variant="outline"
          leftIcon={<Copy className="size-4" />}
          onClick={() => void onCopy(snippet)}
        >
          {t("copySnippet")}
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-medium text-foreground">{t("setupDesktopTitle")}</h3>
        <p>{t("setupDesktopIntro")}</p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>{t("setupDesktopStep1")}</li>
          <li>{t("setupDesktopStep2")}</li>
          <li>{t("setupDesktopStep3")}</li>
          <li>{t("setupDesktopStep4")}</li>
          <li>{t("setupDesktopStep5")}</li>
        </ol>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-x-4">
          <dt className="text-xs font-medium text-muted-foreground">{t("setupDesktopFieldProvider")}</dt>
          <dd className="font-mono text-xs text-foreground">{t("setupDesktopValueProvider")}</dd>
          <dt className="text-xs font-medium text-muted-foreground">{t("setupDesktopFieldKind")}</dt>
          <dd className="font-mono text-xs text-foreground">{t("setupDesktopValueKind")}</dd>
          <dt className="text-xs font-medium text-muted-foreground">{t("setupDesktopFieldUrl")}</dt>
          <dd className="min-w-0 font-mono text-xs text-foreground">{origin}</dd>
          <dt className="text-xs font-medium text-muted-foreground">{t("setupDesktopFieldKey")}</dt>
          <dd className="font-mono text-xs text-foreground">{t("setupDesktopValueKey")}</dd>
          <dt className="text-xs font-medium text-muted-foreground">{t("setupDesktopFieldAuth")}</dt>
          <dd className="font-mono text-xs text-foreground">{t("setupDesktopValueAuth")}</dd>
        </dl>
        <Button
          type="button"
          size="sm"
          variant="outline"
          leftIcon={<Copy className="size-4" />}
          onClick={() => void onCopy(origin)}
        >
          {t("copyGatewayOrigin")}
        </Button>
      </div>

      <p>{t("setupOpenai", { origin: openaiOrigin })}</p>
      <p>{t("setupCursor", { origin: openaiOrigin })}</p>
    </div>
  );
}

function vscodeSnippet(origin: string): string {
  return `{
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL", "value": "${origin}" },
    { "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-team-…" }
  ]
}`;
}
