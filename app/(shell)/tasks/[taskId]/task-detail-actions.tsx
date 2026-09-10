"use client";

import { Button, Combobox, type ComboboxOption, ConfirmDialog, toast } from "@comitor/ui";
import { CircleCheckBig, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { deleteTask, updateTask } from "@/lib/api-client/tasks";
import type { TaskView } from "@/lib/contracts/task";

/**
 * Đảo client của trang chi tiết — nơi DUY NHẤT trên trang đó gọi ra ngoài.
 *
 * ── VÌ SAO TÁCH RA MỘT FILE, KHÔNG ĐẶT `"use client"` LÊN `page.tsx` ─────────────────────
 * Vì `"use client"` là chỉ thị theo FILE: đặt nó lên trang là mất `generateMetadata` (Next cấm hai
 * thứ cùng file) và đẩy cả phần đọc dữ liệu sang bundle trình duyệt. Khuôn đúng là trang ở server,
 * một đảo client bên cạnh nhận **dữ liệu thuần + vị từ quyền dạng boolean** qua prop.
 *
 * ⚠ File này KHÔNG gọi `can()` và không nhận ma trận quyền. Nó nhận câu TRẢ LỜI (`canEdit`…), vì
 * một ma trận đi qua ranh giới server → client là một ma trận có thể bị sửa trước khi được hỏi.
 * Và ẩn một nút không phải là phân quyền: chốt thật là `requirePermission()` ở route handler.
 *
 * ── VÌ SAO `router.refresh()` CHỨ KHÔNG PHẢI `useState` ─────────────────────────────────
 * Dữ liệu của trang do Server Component sở hữu. Giữ một bản sao trong state ở đây là dựng nguồn sự
 * thật thứ hai: nó sẽ lệch với `updatedAt`, với trạng thái suy ra (`overdue` tính lại theo hôm
 * nay), và với bất cứ thứ gì máy chủ đổi thêm. `refresh()` bảo Next dựng lại cây server và trộn
 * vào — không mất state của các đảo client khác, và không có bản sao nào để lệch.
 */

export interface TaskDetailActionsProps {
  task: TaskView;
  canEdit: boolean;
  canAssign: boolean;
  canDelete: boolean;
  projectOptions: ComboboxOption[];
  memberOptions: ComboboxOption[];
}

export function TaskDetailActions({ task, canEdit, canAssign, canDelete, memberOptions }: TaskDetailActionsProps) {
  const t = useTranslations("taskDetail");
  const tTasks = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /**
   * `useErrorMessage` nhận `string | ErrorLike`, còn `catch` cho ta `unknown`. Thu hẹp ở ĐÚNG MỘT
   * chỗ thay vì ép kiểu ở từng lời gọi — `ApiError` của `lib/api-client/http.ts` luôn mang `code`,
   * và mọi thứ khác rơi về câu lỗi chung.
   */
  const toErrorLike = (error: unknown) =>
    error && typeof error === "object" && "code" in error ? (error as { code?: string; status?: number }) : null;

  const run = async (work: () => Promise<void>, success: string) => {
    try {
      await work();
      toast(success, { variant: "success" });
      startTransition(() => router.refresh());
    } catch (error) {
      toast(errorMessage(toErrorLike(error)), { variant: "destructive" });
    }
  };

  const isDone = task.status === "done";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/*
        ⚠ Bề rộng đặt ở THẺ BỌC NGOÀI, KHÔNG truyền `className="w-56"` vào `<Combobox>`.

        Đã đo trên `@comitor/ui` 1.3.4: `className` rơi vào NÚT bên trong, còn cụm icon (xoá +
        mũi tên) được định vị tuyệt đối theo WRAPPER — mà wrapper luôn là `relative w-full`. Hệ
        quả: nút rộng 224px, wrapper rộng 572px, và hai icon trôi ra cách nút 350px, nằm lơ lửng
        giữa khoảng trống. Không có gì báo đỏ; nó chỉ trông như một lỗi thiết kế.

        Bọc ngoài thì `w-full` của wrapper bằng đúng bề rộng ta muốn, và icon về đúng chỗ.
      */}
      {canAssign ? (
        <div className="w-56">
          <Combobox
            options={memberOptions}
            value={task.assigneeUserId}
            onValueChange={(assigneeUserId) =>
              void run(async () => {
                await updateTask(task.id, { assigneeUserId });
              }, t("assignedToast"))
            }
            placeholder={tCommon("unassigned")}
            searchPlaceholder={tTasks("filter.assigneeSearch")}
            emptyText={tTasks("filter.assigneeEmpty")}
            aria-label={t("assignee")}
            clearable
            clearLabel={tCommon("clearSelection")}
          />
        </div>
      ) : null}

      {canEdit && !isDone ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            void run(() => updateTask(task.id, { status: "done" }).then(() => undefined), t("completedToast"))
          }
          leftIcon={<CircleCheckBig aria-hidden="true" className="size-4" />}
        >
          {tTasks("action.complete")}
        </Button>
      ) : null}

      {canDelete ? (
        <>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
            leftIcon={<Trash2 aria-hidden="true" className="size-4" />}
          >
            {tTasks("action.delete")}
          </Button>

          {/*
            ⚠ `ConfirmDialog` do component CHA giữ, dạng controlled — KHÔNG lồng nó vào một
            `DropdownMenuItem`. Radix đóng menu và THÁO nó khỏi DOM ngay khi một mục được chọn, và
            chuyện đó xảy ra TRƯỚC khi `AlertDialog` bên trong kịp mở: hộp xác nhận biến mất theo
            menu chứ không hiện ra. Cùng khuôn với `../task-table.tsx`.
          */}
          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            variant="destructive"
            title={tTasks("delete.title", { code: task.code })}
            description={tTasks("delete.description", { title: task.title })}
            confirmLabel={tTasks("action.delete")}
            cancelLabel={tCommon("cancel")}
            onConfirm={async () => {
              try {
                await deleteTask(task.id);
                toast(t("deletedToast", { code: task.code }), { variant: "success" });
                /*
                 * `replace`, không `push`: bản ghi không còn, nên để nó lại trong lịch sử nghĩa là
                 * nút Back của trình duyệt dẫn thẳng vào một trang 404.
                 */
                router.replace("/tasks");
              } catch (error) {
                toast(errorMessage(toErrorLike(error)), { variant: "destructive" });
              }
            }}
          />
        </>
      ) : null}
    </div>
  );
}
