import { Card, CardContent, PageContainer, PageHeader, StatusPill } from "@comitor/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { listMembers } from "@/lib/account/directory";
import { requireSession } from "@/lib/account/session";
import { can } from "@/lib/core/permissions";
import { storageEnabled } from "@/lib/env";
import { formatIsoDateFor, formatMinutesFor } from "@/lib/format";
import { getTaskPriorityConfigs, getTaskStatusConfigs } from "@/lib/i18n/catalog-server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getPermissionMatrix, requireReadPermission } from "@/lib/permissions";
import { listOpenProjectOptions } from "@/lib/projects";
import { getTask } from "@/lib/tasks";
import { TaskAttachmentField } from "./task-attachment-field";
import { TaskDetailActions } from "./task-detail-actions";
import { TaskSummaryField, TaskTitleField } from "./task-text-fields";
import { TaskUpdatedAt } from "./updated-at";

/**
 * `/tasks/{taskId}` — trang chi tiết một công việc.
 *
 * ── VÌ SAO TRANG NÀY TỒN TẠI TRONG MỘT BẢN MẪU ──────────────────────────────────────────
 * Không phải vì module mẫu cần nó, mà vì trước nó **cả repo không có một đoạn route động nào**
 * (`find app -type d | grep '\['` ra rỗng). Bốn cạm bẫy Next 16 mà AGENTS.md cảnh báo vì thế không
 * có một dòng mã nào minh hoạ — và chỗ nguy hiểm nhất lại là chỗ không có gì để chép. File này là
 * bản chép đó:
 *
 *   1. **`params` là `Promise`** — phải `await`. Quên thì `params.taskId` là `undefined`, và
 *      `getTask` trả `null`, và bạn nhận một trang 404 cho một việc đang tồn tại.
 *   2. **Giá trị có thể là MẢNG** khi query bị lặp — chuẩn hoá bằng `readTaskId` (dùng chung với
 *      route handler bên cạnh, một quy tắc một chỗ).
 *   3. **`notFound()` thuộc về RÌA A.** Nó ném một lỗi điều khiển luồng mà Next bắt để render
 *      `not-found.tsx`. Rìa B thì ngược lại — nó trả MÃ (`404` + `TASK_NOT_FOUND`), vì `curl`
 *      không render trang. Hai rìa, hai cách nói "không thấy".
 *   4. **`generateMetadata` phụ thuộc bản ghi** nên nó phải chịu được bản ghi không tồn tại: nó
 *      chạy TRƯỚC component, và ném ở đó thì người dùng nhận một trang lỗi thay vì trang 404.
 *
 * ⚠ `getTask` lọc theo `workspaceId` từ phiên, nên một id của workspace khác cho ra **404** — chứ
 * không phải 403. 403 xác nhận rằng bản ghi đó tồn tại, và với id đoán được thì đó là một đường
 * liệt kê dữ liệu của khách hàng khác.
 */

type PageProps = { params: Promise<{ taskId: string | string[] }> };

/** Cùng quy tắc chuẩn hoá với `app/api/tasks/[taskId]/route.ts`. Chuỗi rỗng = không có. */
function readTaskId(raw: string | string[]): string {
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const session = await requireSession();
  const task = await getTask(session.workspace.id, readTaskId((await params).taskId), session.user.timezone);

  /*
   * KHÔNG `notFound()` ở đây. `generateMetadata` chạy trước component, và ném lỗi điều khiển luồng
   * từ đây làm Next mất luôn cơ hội render `not-found`. Trả tiêu đề chung và để component quyết
   * định — nó sẽ gọi `getTask` lần nữa, nhưng lời gọi đó đi qua `cache()` của React nên không có
   * vòng truy vấn thứ hai.
   */
  if (!task) {
    const tNav = await getTranslations("nav");
    return { title: tNav("tasks") };
  }
  return { title: `${task.code} · ${task.title}` };
}

export default async function TaskDetailPage({ params }: PageProps) {
  const session = await requireSession();
  const workspaceId = session.workspace.id;

  await requireReadPermission(workspaceId, session.role, "task.view");

  const task = await getTask(workspaceId, readTaskId((await params).taskId), session.user.timezone);
  if (!task) notFound();

  const [t, tNav, tTask, tCommon, rawLocale, matrix, projects, members, statusConfigs, priorityConfigs] =
    await Promise.all([
      getTranslations("taskDetail"),
      getTranslations("nav"),
      getTranslations("task"),
      getTranslations("common"),
      getLocale(),
      getPermissionMatrix(workspaceId),
      listOpenProjectOptions(workspaceId),
      listMembers(workspaceId),
      getTaskStatusConfigs(),
      getTaskPriorityConfigs()
    ]);

  /* `getLocale()` trả `string`; `formatIsoDateFor` đòi `Locale`. Cùng khuôn với `app/(shell)/page.tsx`. */
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  /* Vị từ quyền tính ở SERVER rồi truyền BOOLEAN xuống — xem chú thích dài ở `../page.tsx`. */
  const canEdit = can(matrix, session.role, "task.edit");
  const canAssign = can(matrix, session.role, "task.assign");
  const canDelete = can(matrix, session.role, "task.delete");

  const fields = [
    { id: "project", label: t("project"), value: task.projectName },
    {
      id: "assignee",
      label: t("assignee"),
      /* Ba trạng thái — xem `TaskView.assigneeUnknown`. */
      value: task.assigneeName ?? (task.assigneeUnknown ? tCommon("formerMember") : tCommon("unassigned"))
    },
    { id: "due", label: t("due"), value: formatIsoDateFor(locale, task.dueDate) },
    { id: "estimate", label: t("estimate"), value: formatMinutesFor(locale, task.estimateMinutes, tTask("hourUnit")) }
  ];

  return (
    <>
      {/*
       * ── VÌ SAO HEADER MANG MÃ VIỆC, KHÔNG MANG TÊN VIỆC ───────────────────────────────
       * Tên việc nay SỬA ĐƯỢC TẠI CHỖ, mà `PageHeader` bọc `title` trong
       * `<h1 className="truncate …">` — tức `white-space: nowrap` + `overflow: hidden`. Ô nhập
       * đặt trong đó bị CẮT ngay khi gõ, và cắt im lặng vì lúc chưa sửa chữ vẫn trông bình
       * thường. Mã việc là chuỗi ngắn cố định, không bao giờ chạm giới hạn ấy.
       * Tên và mô tả xuống thân trang — xem `task-text-fields.tsx`.
       */}
      <PageHeader
        title={task.code}
        breadcrumb={[{ label: tNav("tasks"), href: "/tasks" }]}
        LinkComponent={Link}
        actions={
          <TaskDetailActions
            task={task}
            canEdit={canEdit}
            canAssign={canAssign}
            canDelete={canDelete}
            projectOptions={projects.map((project) => ({ value: project.id, label: project.name }))}
            memberOptions={members.map((member) => ({ value: member.id, label: member.name }))}
          />
        }
      />

      <PageContainer width="lg">
        {/*
         * ⚠ `grid-cols-1` ở bậc CƠ SỞ là BẮT BUỘC, không phải thừa. `grid gap-6 lg:grid-cols-3`
         * không có template nào dưới `lg`, nên cột là một track NGẦM `auto` — mà `auto` lấy
         * min-content làm SÀN. Một phần tử `truncate` bên trong có min-content bằng TOÀN BỘ chuỗi,
         * nên cột phình theo chuỗi dài nhất và card thò ra ngoài màn hình. Đã đo ở `/` 375px: cột
         * 444,7px trong khung 343px. `grid-cols-1` của Tailwind là `repeat(1, minmax(0, 1fr))` —
         * cùng một cột, chỉ bỏ cái sàn ấy đi.
         *
         * `items-start`: không có nó thì hai cột kéo bằng chiều cao nhau, và card thuộc tính bị
         * giãn ra theo cột nội dung dài.
         */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {/* Cột chính — chữ do NGƯỜI DÙNG viết, và tệp họ đính kèm. */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <div className="flex flex-col gap-2">
              <TaskTitleField taskId={task.id} value={task.title} canEdit={canEdit} />
              <TaskSummaryField taskId={task.id} value={task.summary} canEdit={canEdit} />
            </div>

            <Card>
              <CardContent className="pt-6">
                <span className="mb-3 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("attachment")}
                </span>
                <TaskAttachmentField
                  taskId={task.id}
                  attachmentUrl={task.attachmentUrl}
                  attachmentName={task.attachmentName}
                  canEdit={canEdit}
                  /*
                   * Đọc ở SERVER rồi truyền xuống: `lib/env.ts` mang `import "server-only"` (nó giữ
                   * khoá S3 và mật khẩu SMTP), nên một file `"use client"` import nó hỏng lúc BIÊN DỊCH.
                   */
                  storageEnabled={storageEnabled}
                />
              </CardContent>
            </Card>
          </div>

          {/*
           * Rìa phải — THUỘC TÍNH: thứ máy suy ra hoặc người khác đặt, không phải chữ người dùng gõ.
           * Tách khỏi cột nội dung vì hai nhóm được đọc theo hai nhịp: nội dung thì đọc, thuộc tính
           * thì liếc. Xếp chung một cột dọc là bắt mắt đi qua cả hai mỗi lần mở trang.
           */}
          <aside aria-labelledby="task-properties-heading">
            <Card>
              <CardContent className="flex flex-col gap-5 pt-6">
                <h2
                  id="task-properties-heading"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {t("properties")}
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill configs={statusConfigs} value={task.status} />
                  <StatusPill configs={priorityConfigs} value={task.priority} variant="dot" />
                </div>

                <dl className="flex flex-col gap-4">
                  {fields.map((field) => (
                    <div key={field.id} className="flex flex-col gap-1">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="text-sm text-foreground">{field.value}</dd>
                    </div>
                  ))}
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("updated")}
                    </dt>
                    {/*
                     * `RelativeTime` cần `locale` của date-fns — một object CHỨA HÀM, không tuần tự
                     * hoá được qua ranh giới server → client. Vì thế nó sống trong đảo `TaskUpdatedAt`.
                     */}
                    <dd className="text-sm text-foreground">
                      <TaskUpdatedAt value={task.updatedAt} />
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </aside>
        </div>
      </PageContainer>
    </>
  );
}
