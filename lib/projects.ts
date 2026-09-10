import "server-only";
import { cache } from "react";
import { memberDirectory, requireMemberDirectory } from "@/lib/account/directory";
import type { AccountSession } from "@/lib/contracts/account";
import type { ProjectStatus, ProjectView, TaskStatus } from "@/lib/contracts/task";
import { ApiError, ERROR_CODES } from "@/lib/core/api-error";
import { parseIsoDate } from "@/lib/core/iso-date";
import { nextProjectCode } from "@/lib/core/project-code";
import type { CreateProjectInput } from "@/lib/core/project-input";
import { isOpenStatus, projectProgress } from "@/lib/core/project-progress";
import { prisma } from "@/lib/prisma";

/**
 * Phép ĐỌC dự án. Cùng vai với `lib/tasks.ts` — dùng chung giữa Server Component và route handler.
 *
 * ⚠ `progress` và `taskCount` KHÔNG phải cột trong database: chúng được ĐẾM ở đây. Một cột đếm sẵn
 * là một cột sẽ lệch — nó chỉ đúng cho tới lần đầu tiên có ai xoá một việc bằng đường không đi qua
 * chỗ tăng giảm bộ đếm, và từ đó về sau không ai biết con số nào đúng.
 *
 * Cái giá: mỗi lần đọc dự án là một lần đọc kèm việc của nó. Với vài chục dự án thì rẻ hơn hẳn chi
 * phí bảo trì một bộ đếm. Khi không còn rẻ, chỗ sửa là một `groupBy` ở đây — KHÔNG phải thêm cột.
 */
/** Bọc `cache()`: `/` và layout cùng cần danh sách này trong một lượt render. */
export const listProjects = cache(async (workspaceId: string): Promise<ProjectView[]> => {
  const [rows, directory] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId },
      select: {
        id: true,
        code: true,
        name: true,
        ownerUserId: true,
        status: true,
        dueDate: true,
        tasks: { select: { status: true } }
      },
      orderBy: { code: "asc" }
    }),
    memberDirectory(workspaceId)
  ]);

  return rows.map((row) => {
    const taskCount = row.tasks.length;
    const doneCount = row.tasks.filter((task) => !isOpenStatus(task.status as TaskStatus)).length;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      ownerUserId: row.ownerUserId,
      ownerName: directory.get(row.ownerUserId)?.name ?? null,
      status: row.status as ProjectStatus,
      dueDate: row.dueDate.toISOString().slice(0, 10),
      taskCount,
      doneCount,
      progress: projectProgress(doneCount, taskCount)
    };
  });
});
/**
 * Danh sách rút gọn cho ô chọn dự án ở biểu mẫu tạo việc.
 *
 * Truy vấn riêng chứ không tái dùng `listProjects()`: biểu mẫu chỉ cần `id` và `name`, còn
 * `listProjects` kéo theo TOÀN BỘ công việc của mọi dự án để đếm. Dùng lại "cho gọn" ở đây là trả
 * giá cho một phép đếm không ai nhìn.
 *
 * Dự án đã ĐÓNG bị loại: nó không nhận việc mới. Giao diện vì thế không cần một mục xám kèm lời
 * giải thích — thứ không tồn tại thì không phải giải thích.
 */
export async function listOpenProjectOptions(workspaceId: string): Promise<{ id: string; name: string }[]> {
  return prisma.project.findMany({
    where: { workspaceId, status: { not: "completed" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
}

/**
 * Tạo một dự án.
 *
 * ── VÌ SAO ĐƯỜNG NÀY PHẢI CÓ TRONG MỘT BẢN MẪU ─────────────────────────────────────────
 * Hai lý do, và lý do thứ hai lớn hơn.
 *
 * **(1) Không có nó thì một không gian làm việc MỚI không dùng được module.** Bật app → không có
 * dự án nào → `/tasks/new` mở ra một combobox rỗng → không tạo nổi công việc đầu tiên. Nguồn dự án
 * duy nhất trước hàm này là `pnpm seed`, tức chỉ máy phát triển mới có.
 *
 * **(2) Module mẫu chỉ dạy vòng đời của MỘT thực thể.** Thực thể thứ hai — có quan hệ 1-N, có
 * trạng thái chặn ghi (`completed` không nhận việc mới), có mã ngắn `@@unique`, và có
 * `progress`/`taskCount` SUY từ bảng khác — không có lấy một dòng mã của đường ghi. Năm module sau
 * đều sẽ có "thực thể cha" của riêng chúng (Chat: kênh, CRM: công ty, HR: phòng ban), và không có
 * gì để chép.
 */
export async function createProject(session: AccountSession, input: CreateProjectInput): Promise<ProjectView> {
  const workspaceId = session.workspace.id;

  const directory = await requireMemberDirectory(workspaceId);
  if (!directory.has(input.ownerUserId)) {
    throw new ApiError(422, ERROR_CODES.ASSIGNEE_NOT_IN_WORKSPACE, "Owner is not a member of this workspace.");
  }

  const parts = parseIsoDate(input.dueDate);
  if (!parts) throw ApiError.validation("Due date is not a valid calendar date.", { fields: ["dueDate"] });

  /*
   * Mã suy từ TÊN và né mã đã dùng — xem `lib/core/project-code.ts`. Đọc toàn bộ mã hiện có của
   * workspace là chấp nhận được vì số dự án của một không gian làm việc đếm bằng chục, không bằng
   * nghìn; nếu một module có hàng nghìn "thực thể cha" thì chỗ đổi là ở đây.
   */
  const existing = await prisma.project.findMany({ where: { workspaceId }, select: { code: true } });
  const code = nextProjectCode(
    input.name,
    existing.map((row) => row.code)
  );
  if (!code) {
    throw ApiError.validation("Could not derive a free project code from that name.", { fields: ["name"] });
  }

  const created = await prisma.project.create({
    data: {
      workspaceId,
      code,
      name: input.name,
      ownerUserId: input.ownerUserId,
      /* Dự án mới LUÔN `active` — xem `createProjectSchema`. */
      status: "active",
      dueDate: new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
    },
    select: { id: true }
  });

  /*
   * Đọc lại qua `listProjects` thay vì dựng `ProjectView` từ `input`: `progress`, `taskCount` và
   * `doneCount` được SUY từ bảng `tasks`, không phải cột. Dựng tay ở đây là nuôi một phép tính thứ
   * hai sẽ lệch ngay lần đầu ai đó đổi công thức.
   */
  const view = (await listProjects(workspaceId)).find((project) => project.id === created.id);
  if (!view) throw ApiError.notFound(ERROR_CODES.PROJECT_NOT_FOUND, "Project disappeared right after it was created.");
  return view;
}
