"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  FormSection,
  Input,
  PageContainer,
  PageHeader,
  toast
} from "@comitor/ui";
import { BookOpen, Copy, KeyRound, ScrollText, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useMemo, useState } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  createAiUsageUser,
  saveAiUsageVendors,
  setAiUsageUserBlocked,
  setAiUsageUserBudget
} from "@/lib/api-client/ai-usage";
import { AI_MODEL_HINTS } from "@/lib/catalog/ai-usage";
import type { AiUsageLogView, AiUsageSnapshot, AiUsageUserView } from "@/lib/contracts/ai-usage";
import { ApiError } from "@/lib/core/api-error";
import type { Locale } from "@/lib/i18n/config";
import { DATA_TABLE_LABELS } from "@/lib/i18n/ui-labels";

/**
 * Nửa tương tác của `/ai-usage`.
 *
 * `PageHeader` nằm ở đây vì nút không cần, nhưng thân trang giữ state mã vừa cấp (chỉ hiện một lần)
 * dùng chung với bảng user sau `router.refresh()`.
 */

export function AiUsagePanel({ snapshot, locale }: { snapshot: AiUsageSnapshot; locale: Locale }) {
  const t = useTranslations("aiUsage");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const [claude, setClaude] = useState("");
  const [grok, setGrok] = useState("");
  const [gemini, setGemini] = useState("");
  const [savingVendors, setSavingVendors] = useState(false);

  const [name, setName] = useState("");
  const [maxBudget, setMaxBudget] = useState("10");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const [userToBlock, setUserToBlock] = useState<AiUsageUserView | null>(null);
  const [budgetUser, setBudgetUser] = useState<AiUsageUserView | null>(null);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const userColumns = useMemo((): DataTableColumn<AiUsageUserView>[] => {
    return [
      {
        id: "name",
        header: t("colName"),
        minWidth: 160,
        hideable: false,
        cell: (user) => <span className="font-medium text-foreground">{user.name}</span>
      },
      {
        id: "key",
        header: t("colKey"),
        width: 180,
        hideable: false,
        cell: (user) => <span className="font-mono text-sm text-muted-foreground">{user.keyPreview}</span>
      },
      {
        id: "spend",
        header: t("colSpend"),
        width: 160,
        hideable: false,
        cell: (user) => (
          <span className="tabular-nums text-muted-foreground">
            {t("spendValue", {
              used: user.spendUsd,
              cap: user.maxBudgetUsd === 0 ? t("unlimited") : String(user.maxBudgetUsd)
            })}
            {user.blocked ? ` · ${t("blocked")}` : ""}
          </span>
        )
      },
      {
        id: "actions",
        header: t("colActions"),
        width: 200,
        hideable: false,
        cell: (user) => (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setUserToBlock(user)}>
              {user.blocked ? t("unblock") : t("block")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setBudgetUser(user);
                setBudgetDraft(String(user.maxBudgetUsd));
              }}
            >
              {t("editBudget")}
            </Button>
          </div>
        )
      }
    ];
  }, [t]);

  const logColumns = useMemo((): DataTableColumn<AiUsageLogView>[] => {
    return [
      {
        id: "at",
        header: t("colWhen"),
        width: 170,
        hideable: false,
        cell: (row) => (
          <span className="tabular-nums text-muted-foreground">{row.at.replace("T", " ").slice(0, 19)}</span>
        )
      },
      {
        id: "name",
        header: t("colName"),
        width: 140,
        hideable: false,
        cell: (row) => row.name
      },
      {
        id: "model",
        header: t("colModel"),
        width: 160,
        hideable: false,
        cell: (row) => <span className="font-mono text-xs">{row.model}</span>
      },
      {
        id: "tokens",
        header: t("colTokens"),
        width: 110,
        hideable: false,
        cell: (row) => (
          <span className="tabular-nums">
            {row.inputTokens}+{row.outputTokens}
          </span>
        )
      },
      {
        id: "usd",
        header: t("colUsd"),
        width: 90,
        hideable: false,
        cell: (row) => <span className="tabular-nums">{row.usd}</span>
      },
      {
        id: "status",
        header: t("colStatus"),
        minWidth: 160,
        hideable: false,
        cell: (row) =>
          row.ok ? t("logOk") : <span className="text-destructive-ink">{row.error ?? t("logError")}</span>
      }
    ];
  }, [t]);

  const userColumnIds = userColumns.map((column) => column.id);
  const logColumnIds = logColumns.map((column) => column.id);

  const snippetClaude = `{
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL", "value": "${snapshot.gatewayOrigin}" },
    { "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-team-…" }
  ]
}`;

  async function onSaveVendors(event: FormEvent) {
    event.preventDefault();
    setSavingVendors(true);
    try {
      await saveAiUsageVendors({ claude, grok, gemini });
      setClaude("");
      setGrok("");
      setGemini("");
      toast(t("vendorsSaved"), { variant: "success" });
      router.refresh();
    } catch (error) {
      toast(errorMessage(toErrorLike(error)), { variant: "destructive" });
    } finally {
      setSavingVendors(false);
    }
  }

  async function onCreateUser(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const created = await createAiUsageUser({ name: name.trim(), maxBudget: Number(maxBudget) });
      setNewKey(created.key);
      setName("");
      toast(t("userCreated"), { variant: "success" });
      router.refresh();
    } catch (error) {
      toast(errorMessage(toErrorLike(error)), { variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function onConfirmBlock() {
    if (!userToBlock) return;
    try {
      await setAiUsageUserBlocked(userToBlock.id, { blocked: !userToBlock.blocked });
      toast(userToBlock.blocked ? t("unblockedToast") : t("blockedToast"), { variant: "success" });
      setUserToBlock(null);
      router.refresh();
    } catch (error) {
      toast(errorMessage(toErrorLike(error)), { variant: "destructive" });
    }
  }

  async function onSaveBudget() {
    if (!budgetUser) return;
    setSavingBudget(true);
    try {
      await setAiUsageUserBudget(budgetUser.id, { maxBudget: Number(budgetDraft) });
      toast(t("budgetSaved"), { variant: "success" });
      setBudgetUser(null);
      router.refresh();
    } catch (error) {
      toast(errorMessage(toErrorLike(error)), { variant: "destructive" });
    } finally {
      setSavingBudget(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    toast(t("copied"), { variant: "success" });
  }

  return (
    <>
      <PageHeader title={tNav("aiUsage")} description={t("description")} />
      <PageContainer width="lg" className="space-y-5">
        <Alert
          variant={
            snapshot.vendorKeys.claude || snapshot.vendorKeys.grok || snapshot.vendorKeys.gemini ? undefined : "warning"
          }
        >
          <KeyRound aria-hidden="true" />
          <AlertTitle>{t("statusTitle")}</AlertTitle>
          <AlertDescription>
            {t("statusGateway", { origin: snapshot.gatewayOrigin })}
            <span className="mt-1 block">
              {t("statusVendors", {
                claude: snapshot.vendorKeys.claude
                  ? t("vendorReady", { preview: snapshot.vendorPreview.claude })
                  : t("vendorMissing"),
                grok: snapshot.vendorKeys.grok
                  ? t("vendorReady", { preview: snapshot.vendorPreview.grok })
                  : t("vendorMissing"),
                gemini: snapshot.vendorKeys.gemini
                  ? t("vendorReady", { preview: snapshot.vendorPreview.gemini })
                  : t("vendorMissing")
              })}
            </span>
          </AlertDescription>
        </Alert>

        <form onSubmit={(event) => void onSaveVendors(event)}>
          <FormSection title={t("vendorsTitle")} description={t("vendorsHint")} icon={KeyRound}>
            <FormField label={t("vendorClaude")} colSpan={12} description={t("vendorEmptyKeeps")}>
              {(control) => (
                <div className="max-w-md">
                  <Input
                    {...control}
                    type="password"
                    autoComplete="off"
                    value={claude}
                    onChange={(event) => setClaude(event.target.value)}
                    placeholder="sk-ant-…"
                  />
                </div>
              )}
            </FormField>
            <FormField label={t("vendorGrok")} colSpan={12}>
              {(control) => (
                <div className="max-w-md">
                  <Input
                    {...control}
                    type="password"
                    autoComplete="off"
                    value={grok}
                    onChange={(event) => setGrok(event.target.value)}
                    placeholder="xai-…"
                  />
                </div>
              )}
            </FormField>
            <FormField label={t("vendorGemini")} colSpan={12}>
              {(control) => (
                <div className="max-w-md">
                  <Input
                    {...control}
                    type="password"
                    autoComplete="off"
                    value={gemini}
                    onChange={(event) => setGemini(event.target.value)}
                    placeholder="AIza…"
                  />
                </div>
              )}
            </FormField>
            <div className="col-span-12">
              <Button type="submit" disabled={savingVendors}>
                {savingVendors ? tCommon("saving") : t("saveVendors")}
              </Button>
            </div>
          </FormSection>
        </form>

        <form onSubmit={(event) => void onCreateUser(event)}>
          <FormSection title={t("usersTitle")} description={t("usersHint")} icon={Users}>
            <FormField label={t("userName")} colSpan={6}>
              {(control) => (
                <Input
                  {...control}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("userNamePlaceholder")}
                  required
                />
              )}
            </FormField>
            <FormField label={t("userBudget")} colSpan={6} description={t("userBudgetHint")}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={0}
                  step="0.5"
                  value={maxBudget}
                  onChange={(event) => setMaxBudget(event.target.value)}
                  required
                />
              )}
            </FormField>
            <div className="col-span-12">
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? tCommon("saving") : t("createUser")}
              </Button>
            </div>
          </FormSection>
        </form>

        {newKey ? (
          <Alert>
            <Copy aria-hidden="true" />
            <AlertTitle>{t("newKeyTitle")}</AlertTitle>
            <AlertDescription>
              <span className="block font-mono text-sm text-foreground">{newKey}</span>
              <Button
                type="button"
                size="sm"
                className="mt-2"
                leftIcon={<Copy className="size-4" />}
                onClick={() => void copyKey()}
              >
                {t("copyKey")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {snapshot.users.length === 0 ? (
          <EmptyState icon={Users} title={t("usersEmpty")} description={t("usersEmptyHint")} />
        ) : (
          <DataTable
            aria-label={t("usersTableLabel")}
            columns={userColumns}
            rows={snapshot.users}
            getRowId={(user) => user.id}
            visibleColumnIds={userColumnIds}
            labels={DATA_TABLE_LABELS[locale]}
            minWidth={720}
          />
        )}

        <FormSection title={t("logsTitle")} description={t("logsHint")} icon={ScrollText}>
          <div className="col-span-12">
            {snapshot.logs.length === 0 ? (
              <EmptyState icon={ScrollText} title={t("logsEmpty")} description={t("logsEmptyHint")} />
            ) : (
              <DataTable
                aria-label={t("logsTableLabel")}
                columns={logColumns}
                rows={snapshot.logs}
                getRowId={(row) => `${row.at}-${row.name}-${row.model}-${row.inputTokens}-${row.outputTokens}`}
                visibleColumnIds={logColumnIds}
                labels={DATA_TABLE_LABELS[locale]}
                minWidth={800}
                striped
              />
            )}
          </div>
        </FormSection>

        <FormSection title={t("modelsTitle")} description={t("modelsHint")} icon={BookOpen}>
          <div className="col-span-12 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{t("colTask")}</th>
                  <th className="py-2 font-medium">{t("colModel")}</th>
                </tr>
              </thead>
              <tbody>
                {AI_MODEL_HINTS.map((row) => (
                  <tr key={row.modelId} className="border-b border-border">
                    <td className="py-2 pr-4">
                      {row.task === "daily" ? t("hint.daily") : row.task === "quick" ? t("hint.quick") : t("hint.grok")}
                    </td>
                    <td className="py-2 font-mono text-xs">{row.modelId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormSection>

        <FormSection title={t("setupTitle")} description={t("setupHint")} icon={BookOpen}>
          <div className="col-span-12 space-y-3 text-sm text-muted-foreground">
            <p>{t("setupClaude")}</p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs text-foreground">
              {snippetClaude}
            </pre>
            <p>{t("setupOpenai", { origin: `${snapshot.gatewayOrigin}/v1` })}</p>
            <p>{t("setupCursor", { origin: `${snapshot.gatewayOrigin}/v1` })}</p>
          </div>
        </FormSection>
      </PageContainer>

      <ConfirmDialog
        open={userToBlock !== null}
        onOpenChange={(open) => {
          if (!open) setUserToBlock(null);
        }}
        variant={userToBlock?.blocked ? undefined : "destructive"}
        title={userToBlock?.blocked ? t("unblockTitle") : t("blockTitle")}
        description={
          userToBlock
            ? userToBlock.blocked
              ? t("unblockDescription", { name: userToBlock.name })
              : t("blockDescription", { name: userToBlock.name })
            : ""
        }
        confirmLabel={userToBlock?.blocked ? t("unblock") : t("block")}
        cancelLabel={tCommon("cancel")}
        pendingLabel={tCommon("saving")}
        onConfirm={() => void onConfirmBlock()}
      />

      <Dialog
        open={budgetUser !== null}
        onOpenChange={(open) => {
          if (!open) setBudgetUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("budgetTitle")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={budgetDraft}
              onChange={(event) => setBudgetDraft(event.target.value)}
              aria-label={t("userBudget")}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setBudgetUser(null)} disabled={savingBudget}>
              {tCommon("cancel")}
            </Button>
            <Button type="button" onClick={() => void onSaveBudget()} disabled={savingBudget}>
              {savingBudget ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function toErrorLike(error: unknown) {
  return error instanceof ApiError ? error : error instanceof Error ? { code: undefined } : { code: undefined };
}
