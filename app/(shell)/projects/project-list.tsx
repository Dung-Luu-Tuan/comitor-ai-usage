"use client";

import {
  Button,
  Combobox,
  type ComboboxOption,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  PageContainer,
  PageHeader,
  Progress,
  type StatusConfig,
  StatusPill,
  toast
} from "@comitor/ui";
import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { createProject } from "@/lib/api-client/projects";
import type { ProjectStatus, ProjectView } from "@/lib/contracts/task";
import { toIsoDate } from "@/lib/core/iso-date";
import { formatIsoDateFor } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

/**
 * Danh sách dự án + hộp thoại tạo mới.
 *
 * ⚠ `PageHeader` KHÔNG bị kéo vào đây dù nút chính thường nằm trong `actions` của nó: nút "Dự án
 * mới" ở đây không dùng chung state nào với thân trang ngoài `open` của hộp thoại, nên giữ header
 * ở Server Component là đúng — và trang giữ được `generateMetadata`. Khi nào nút chính CẦN state
 * dùng chung thì mới kéo cả header vào đảo client (xem AGENTS.md §"Thêm một trang mới").
 */

export interface ProjectListProps {
  projects: readonly ProjectView[];
  statusConfigs: readonly StatusConfig<ProjectStatus>[];
  canCreate: boolean;
  memberOptions: ComboboxOption[];
  currentUserId: string;
  locale: Locale;
}

export function ProjectList({
  projects,
  statusConfigs,
  canCreate,
  memberOptions,
  currentUserId,
  locale
}: ProjectListProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  /* Tiêu đề trang lấy từ `nav.*` — cùng chuỗi mà thanh bên dùng, để hai chỗ không lệch nhau. */
  const tNav = useTranslations("nav");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [ownerUserId, setOwnerUserId] = useState<string | null>(currentUserId);
  const [dueDate, setDueDate] = useState<Date | null>(null);

  /**
   * `Date` của bộ chọn → ISO chỉ-có-ngày cho API.
   *
   * ⚠ **KHÔNG `toISOString().slice(0, 10)`.** Cái đó luôn trả về UTC, nên ở GMT+7 thì bảy tiếng
   * đầu mỗi ngày nó cho ra ngày HÔM QUA — người dùng chọn 3/9 và dự án được lưu hạn 2/9. Đây đúng
   * là cạm bẫy mà `lib/core/iso-date.ts` sinh ra để chặn, và nó không lộ ra ở máy nào đặt múi giờ
   * UTC. Đọc từng thành phần theo giờ ĐỊA PHƯƠNG rồi ghép — đó là thứ người dùng vừa bấm.
   */
  const toApiDate = (value: Date): string =>
    toIsoDate({ year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() });

  const submit = async () => {
    setSaving(true);
    try {
      const created = await createProject({
        name,
        ownerUserId: ownerUserId ?? "",
        dueDate: dueDate ? toApiDate(dueDate) : ""
      });
      toast(t("createdToast", { code: created.code }), { variant: "success" });
      setOpen(false);
      setName("");
      setDueDate(null);
      router.refresh();
    } catch (error) {
      const like =
        error && typeof error === "object" && "code" in error ? (error as { code?: string; status?: number }) : null;
      toast(errorMessage(like), { variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    /*
     * ── VÌ SAO KHUNG TRANG NẰM Ở ĐÂY, KHÔNG Ở `page.tsx` ────────────────────────────────
     * Vì nút "Dự án mới" MỞ HỘP THOẠI, tức nó cần `setOpen` — một `useState` của chính file này,
     * và cùng state ấy còn được `EmptyState` bên dưới dùng. `page.tsx` là Server Component nên
     * không chạm tới được, và một đảo client ANH EM đặt vào `actions` sẽ có `open` RIÊNG: bấm nút
     * ở header mở một hộp thoại, bấm nút ở màn hình rỗng mở một hộp thoại khác.
     *
     * Cùng lối đi với `/tasks` — AGENTS.md §"Thêm một trang mới" bước 2 đã chốt: nút chính cần
     * state dùng chung với thân trang thì kéo `PageHeader` vào chính đảo client đó.
     *
     * ⚠ `PageContainer` theo xuống CÙNG, cả hai trong một Fragment. Fragment không sinh DOM nên
     * cây render giống hệt bản cũ; để `PageHeader` bên trong `PageContainer` thì nó ăn thêm
     * `px-4 md:px-6` và mất đường kẻ chạy hết bề ngang.
     */
    <>
      <PageHeader
        title={tNav("projects")}
        description={t("description")}
        actions={
          canCreate ? (
            <Button onClick={() => setOpen(true)} leftIcon={<FolderPlus className="size-4" />}>
              {t("create")}
            </Button>
          ) : null
        }
      />

      <PageContainer width="lg">
        <div className="flex flex-col gap-6">
          {projects.length === 0 ? (
            /*
             * ⚠ Đây là màn hình mà một không gian làm việc VỪA BẬT APP nhìn thấy đầu tiên. Không có nó
             * thì họ thấy một trang trắng, rồi sang `/tasks/new` gặp một combobox rỗng, và không có gì
             * chỉ đường. `EmptyState` của gói có sẵn chỗ cho hành động tiếp theo — dùng nó.
             */
            <EmptyState
              icon={FolderPlus}
              title={t("emptyTitle")}
              description={canCreate ? t("emptyDescription") : t("emptyDescriptionReadOnly")}
              action={canCreate ? <Button onClick={() => setOpen(true)}>{t("create")}</Button> : undefined}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4"
                >
                  <span className="font-mono text-xs text-muted-foreground">{project.code}</span>
                  <span className="font-medium text-foreground">{project.name}</span>
                  <StatusPill configs={statusConfigs} value={project.status} />
                  <span className="text-sm text-muted-foreground">{project.ownerName ?? tCommon("formerMember")}</span>
                  <span className="text-sm text-muted-foreground">{formatIsoDateFor(locale, project.dueDate)}</span>
                  <div className="ml-auto flex min-w-40 items-center gap-3">
                    <Progress
                      value={project.progress}
                      aria-label={t("progressLabel", { name: project.name })}
                      className="flex-1"
                    />
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {t("taskCount", { done: project.doneCount, total: project.taskCount })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("create")}</DialogTitle>
              </DialogHeader>
              {/* `DialogBody` để nội dung dài cuộn bên trong, nút đóng `absolute` không cuộn theo. */}
              <DialogBody className="flex flex-col gap-4">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("namePlaceholder")}
                  aria-label={t("nameLabel")}
                />
                <Combobox
                  options={memberOptions}
                  value={ownerUserId}
                  onValueChange={setOwnerUserId}
                  placeholder={t("ownerLabel")}
                  searchPlaceholder={t("ownerSearch")}
                  emptyText={t("ownerEmpty")}
                  aria-label={t("ownerLabel")}
                />
                <DatePicker value={dueDate} onValueChange={setDueDate} aria-label={t("dueLabel")} />
              </DialogBody>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                  {tCommon("cancel")}
                </Button>
                <Button onClick={() => void submit()} disabled={saving || !name.trim() || !ownerUserId || !dueDate}>
                  {saving ? tCommon("saving") : tCommon("create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PageContainer>
    </>
  );
}
