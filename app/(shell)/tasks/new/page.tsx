import type { ComboboxOption } from "@comitor/ui";
import { Alert, AlertDescription, AlertTitle, Button, EmptyState, PageContainer, PageHeader } from "@comitor/ui";
import { FolderPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { directoryConfigured, listMembers } from "@/lib/account/directory";
import { requireSession } from "@/lib/account/session";
import { storageEnabled } from "@/lib/env";
import { getRoleLabeller } from "@/lib/i18n/role-label";
import { requireReadPermission } from "@/lib/permissions";
import { listOpenProjectOptions } from "@/lib/projects";
import { getAppSettings } from "@/lib/settings";
import { getTaskDraft } from "@/lib/task-drafts";
import { nextCodeFor } from "@/lib/tasks";
import { todayIso } from "@/lib/today";
import { TaskRequestForm } from "./task-request-form";

/**
 * Trang biểu mẫu — màn hình "tạo công việc" của module.
 *
 * KHÔNG có `"use client"` ở đây, và đó là chủ ý: `PageContainer`/`PageHeader` là component tĩnh nên
 * React Server Component vẽ thẳng, không tốn JS phía trình duyệt — và `generateMetadata` chỉ tồn
 * tại được trong Server Component. Toàn bộ phần cần state nằm trong `TaskRequestForm`
 * (`"use client"`), tức ranh giới client được đẩy xuống ĐÚNG chỗ cần thay vì bôi lên cả trang.
 *
 * Đây cũng là **CỬA DỮ LIỆU** của route: mọi bản ghi mà biểu mẫu cần được đọc và ghép sẵn ở đây
 * rồi truyền xuống qua prop. `task-request-form.tsx` không đọc database, không gọi API để LẤY dữ
 * liệu, và không biết dữ liệu đến từ đâu.
 *
 * ⚠ Nó KHÔNG `fetch("/api/tasks")`. Server Component gọi API của chính máy chủ mình là thêm một
 * vòng mạng, thêm một lần xác thực lại cookie, và thêm một chỗ để hai đường trả về hai hình dạng
 * khác nhau — xem ghi chú đầu `lib/tasks.ts`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  /*
   * CHỈ tên trang, không nối tên sản phẩm: `metadata.title.template` ở `app/layout.tsx` đã làm việc
   * đó cho mọi trang con. Tự nối thêm ở đây là tab hiện hai lần tên thương hiệu.
   */
  return { title: t("taskNew") };
}

export default async function TaskRequestPage() {
  const session = await requireSession();
  const workspaceId = session.workspace.id;

  /*
   * ⚠ Trước chốt này, `/tasks/new` KHÔNG kiểm `task.create` một lần nào. Người không có quyền thấy
   * mục trong thanh bên và trong ⌘K, mở được trang, điền hết một biểu mẫu 949 dòng, bấm Gửi — rồi
   * mới nhận 403. Trong khi `/tasks` đã ẩn nút đúng từ đầu.
   */
  await requireReadPermission(workspaceId, session.role, "task.create");

  const [t, tNav, roleLabel, projects, members, nextCode, settings, draft] = await Promise.all([
    getTranslations("taskNew"),
    getTranslations("nav"),
    getRoleLabeller(),
    listOpenProjectOptions(workspaceId),
    listMembers(workspaceId),
    nextCodeFor(workspaceId),
    getAppSettings(workspaceId),
    getTaskDraft(workspaceId, session.user.id)
  ]);

  /*
   * Lựa chọn của các ô `Combobox` dựng ở server. Chỉ đặt trường DỮ LIỆU (`value`/`label`/
   * `description`/`keywords`) — `ComboboxOption` còn nhận `icon`, nhưng icon là một *component*,
   * không tuần tự hoá được qua ranh giới server → client.
   *
   * Dự án đã ĐÓNG không có mặt trong danh sách: `listOpenProjectOptions` lọc chúng ra ở tầng truy
   * vấn vì chúng không nhận việc mới, và thứ không tồn tại thì không phải giải thích. (Máy chủ vẫn
   * kiểm lại — xem `PROJECT_CLOSED` trong `app/api/tasks/route.ts`: danh sách này được dựng lúc mở
   * trang, còn dự án thì có thể đóng lại trong lúc người dùng đang điền.)
   */
  const projectOptions: ComboboxOption[] = projects.map((project) => ({
    value: project.id,
    label: project.name
  }));

  // Tìm được cả bằng email lẫn tên không dấu — `Combobox` khớp không dấu sẵn.
  const memberOptions: ComboboxOption[] = members.map((member) => ({
    value: member.id,
    label: member.name,
    description: roleLabel(member.role),
    keywords: [member.email]
  }));

  /*
   * Ảnh đại diện đi RIÊNG, không nhét vào `memberOptions`.
   *
   * `ComboboxOption` của gói chỉ có `icon?: IconComponent` — một COMPONENT, không phải URL — nên
   * không có chỗ nào hợp lệ để gắn một tấm ảnh vào đó. Nhét bừa một trường ngoài hợp đồng thì
   * `tsc` chặn, và sửa hợp đồng của gói cho một chỗ dùng là cái giá sai.
   *
   * Chỉ liệt kê người CÓ ảnh: bản ghi này đi qua ranh giới server → client ở mọi lần mở trang, và
   * những người không có ảnh không cần một cặp khoá-giá trị `null` để nói điều đó.
   */
  const memberAvatarUrls = Object.fromEntries(
    members.flatMap((member) => (member.avatarUrl ? [[member.id, member.avatarUrl] as const] : []))
  );

  return (
    <>
      {/* `PageHeader` NGOÀI `PageContainer` — cùng khuôn với `app/(shell)/tasks/page.tsx`. */}
      <PageHeader
        title={tNav("taskNew")}
        description={t("description")}
        breadcrumb={[{ label: tNav("tasks"), href: "/tasks" }, { label: tNav("taskNew") }]}
        /* Breadcrumb mặc định dùng thẻ <a> (tải lại cả trang). Truyền `next/link` vào để điều hướng
           phía client — gói cố ý không tự import `next/*` để còn chạy được ngoài Next. */
        LinkComponent={Link}
      />

      <PageContainer width="lg">
        {/*
          ⚠ MÀN HÌNH CỨU MỘT KHÔNG GIAN LÀM VIỆC RỖNG.

          Mọi công việc thuộc về một dự án, nên không có dự án nào thì combobox "Dự án" rỗng và
          biểu mẫu KHÔNG gửi được — người dùng điền hết rồi mới biết. Trước đây không có gì chỉ
          đường; nay nó dẫn thẳng sang chỗ tạo dự án.
        */}
        {projectOptions.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            title={t("noProjectTitle")}
            description={t("noProjectDescription")}
            action={
              <Button asChild>
                <Link href="/projects">{t("noProjectAction")}</Link>
              </Button>
            }
          />
        ) : null}

        {/*
          Cùng khuôn mà repo đã dùng cho `storageEnabled`: một chức năng chưa cấu hình thì GIAO DIỆN
          NÓI RA, chứ không im lặng hỏng ở giữa luồng.

          ⚠ Đặt ở page (Server Component) chứ không trong `TaskRequestForm`: `directoryConfigured`
          đọc từ `lib/env.ts`, mà file đó mang `import "server-only"`. Và cảnh báo này nói về MÔI
          TRƯỜNG chứ không về trạng thái biểu mẫu, nên nó không thuộc về đảo client.
        */}
        {!directoryConfigured && (
          <Alert variant="warning" className="mb-6">
            <AlertTitle>{t("directoryUnavailableTitle")}</AlertTitle>
            <AlertDescription>{t("directoryUnavailableDescription")}</AlertDescription>
          </Alert>
        )}

        <TaskRequestForm
          projectOptions={projectOptions}
          memberOptions={memberOptions}
          memberAvatarUrls={memberAvatarUrls}
          nextTaskCode={nextCode}
          /* Hai cài đặt của không gian làm việc quyết định GIÁ TRỊ MỞ SẴN của biểu mẫu trống. */
          defaultPriority={settings.defaultPriority}
          autoAssignToMe={settings.autoAssignToMe}
          /*
           * "Hôm nay" tính Ở MÁY CHỦ, theo múi giờ trong hồ sơ Account của người xem — cùng phép
           * tính mà `isOverdue` dùng. Để biểu mẫu tự đọc `new Date()` là lấy múi giờ của HỆ ĐIỀU
           * HÀNH, và khi hai cái lệch nhau thì ô chọn hạn chót cho phép một ngày mà máy chủ lập
           * tức đánh dấu quá hạn.
           */
          todayIso={todayIso(session.user.timezone)}
          /*
           * "Chuyển cho đối tác" đưa việc ra NGOÀI không gian làm việc nên nó nằm sau cài đặt
           * `allow_public_link`. Cờ này đi qua prop chứ không nằm trong `REQUEST_TYPES`: bảng khai
           * là HẰNG giao diện, còn "workspace này có được chuyển việc ra ngoài không" là DỮ LIỆU.
           */
          allowExternalRequest={settings.data["public-link"]}
          currentUserId={session.user.id}
          /*
           * Đọc ở SERVER rồi truyền xuống: `lib/env.ts` mang `import "server-only"` (nó giữ khoá S3
           * và mật khẩu SMTP), nên một file `"use client"` import nó sẽ hỏng lúc BIÊN DỊCH.
           */
          storageEnabled={storageEnabled}
          draft={draft?.data ?? null}
          draftSavedAt={draft?.savedAt ?? null}
        />
      </PageContainer>
    </>
  );
}
