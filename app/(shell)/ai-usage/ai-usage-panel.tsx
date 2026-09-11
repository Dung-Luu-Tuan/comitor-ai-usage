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
import { BookOpen, Copy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useCallback, useMemo, useState } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  createAiUsageUser,
  saveAiUsageVendors,
  setAiUsageUserBlocked,
  setAiUsageUserBudget
} from "@/lib/api-client/ai-usage";
import type { AiUsageSnapshot, AiUsageUserView } from "@/lib/contracts/ai-usage";
import { ApiError } from "@/lib/core/api-error";
import type { Locale } from "@/lib/i18n/config";
import { DATA_TABLE_LABELS } from "@/lib/i18n/ui-labels";
import { AiUsageLogs } from "./ai-usage-logs";
import { BudgetUsedBar } from "./budget-used-bar";
import { ModelRates } from "./model-rates";
import { SetupGuides } from "./setup-guides";
import { VendorKeysForm, VendorStatusBoard } from "./vendor-keys";

/**
 * Nửa tương tác của `/ai-usage`.
 *
 * `PageHeader` nằm ở đây vì nút Copy mã trên bảng dùng chung state toast với alert mã vừa cấp.
 */

export function AiUsagePanel({ snapshot, locale }: { snapshot: AiUsageSnapshot; locale: Locale }) {
  const t = useTranslations("aiUsage");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingVendors, setSavingVendors] = useState(false);

  const [name, setName] = useState("");
  const [maxBudget, setMaxBudget] = useState("10");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const [userToBlock, setUserToBlock] = useState<AiUsageUserView | null>(null);
  const [budgetUser, setBudgetUser] = useState<AiUsageUserView | null>(null);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const copyText = useCallback(
    async (value: string) => {
      await navigator.clipboard.writeText(value);
      toast(t("copied"), { variant: "success" });
    },
    [t]
  );

  const userColumns = useMemo((): DataTableColumn<AiUsageUserView>[] => {
    return [
      {
        id: "name",
        header: t("colName"),
        minWidth: 160,
        hideable: false,
        cell: (user) => (
          <span className="font-medium text-foreground">
            {user.name}
            {user.blocked ? ` · ${t("blocked")}` : ""}
          </span>
        )
      },
      {
        id: "key",
        header: t("colKey"),
        width: 280,
        hideable: false,
        cell: (user) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{user.keyPreview}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              leftIcon={<Copy className="size-4" />}
              onClick={() => void copyText(user.key)}
            >
              {t("copyKey")}
            </Button>
          </div>
        )
      },
      {
        id: "spend",
        header: t("colSpend"),
        minWidth: 200,
        hideable: false,
        cell: (user) => <BudgetUsedBar name={user.name} spendUsd={user.spendUsd} maxBudgetUsd={user.maxBudgetUsd} />
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
  }, [copyText, t]);

  const userColumnIds = userColumns.map((column) => column.id);

  async function onSaveVendors(event: FormEvent) {
    event.preventDefault();
    setSavingVendors(true);
    try {
      await saveAiUsageVendors(drafts);
      setDrafts({});
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
    await copyText(newKey);
  }

  return (
    <>
      <PageHeader title={tNav("aiUsage")} description={t("description")} />
      <PageContainer width="lg" className="space-y-5">
        <VendorStatusBoard vendors={snapshot.vendors} gatewayOrigin={snapshot.gatewayOrigin} />

        <VendorKeysForm
          vendors={snapshot.vendors}
          drafts={drafts}
          saving={savingVendors}
          onDraftChange={(vendorId, value) => setDrafts((current) => ({ ...current, [vendorId]: value }))}
          onSubmit={(event) => void onSaveVendors(event)}
        />

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
            minWidth={800}
          />
        )}

        <AiUsageLogs users={snapshot.users} logs={snapshot.logs} locale={locale} />

        <FormSection
          title={t("modelsTitle")}
          description={t("modelsHint", { origin: snapshot.gatewayOrigin })}
          icon={BookOpen}
        >
          <ModelRates />
        </FormSection>

        <FormSection title={t("setupTitle")} description={t("setupHint")} icon={BookOpen}>
          <SetupGuides origin={snapshot.gatewayOrigin} onCopy={copyText} />
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
