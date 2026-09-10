import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { memberDirectory } from "@/lib/account/directory";
import { requireSession } from "@/lib/account/session";
import { can } from "@/lib/core/permissions";
import { getPermissionMatrix, requireReadPermission } from "@/lib/permissions";
import { listProjects } from "@/lib/projects";
import { getAppSettings } from "@/lib/settings";
import { listTasks } from "@/lib/tasks";
import { TaskTable } from "./task-table";

/**
 * Trang Công việc — màn hình danh sách chuẩn của hệ sinh thái: tìm kiếm, lọc, sắp xếp, phân
 * trang, chọn nhiều dòng.
 *
 * KHÔNG có `"use client"`: trang là React Server Component, và nó lo đúng ba việc — metadata,
 * khung trang (`PageHeader`/`PageContainer`, tĩnh nên render thẳng ở server), và **chuẩn bị dữ
 * liệu**. Toàn bộ phần có state nằm trong đúng một hòn đảo client (`./task-table`).
 *
 * ── CỬA DỮ LIỆU: `lib/`, KHÔNG PHẢI API CỦA CHÍNH MÌNH ────────────────────────────────────
 * Trang đọc thẳng qua `lib/tasks.ts`, `lib/projects.ts`, `lib/settings.ts`, `lib/permissions.ts`
 * — không `fetch("/api/tasks")`. Tự gọi API của mình từ Server Component là thêm một vòng mạng,
 * thêm một lần xác thực lại cookie, và thêm một chỗ để hai đường trả về hai hình dạng khác nhau.
 *
 * Năm lời gọi chạy SONG SONG: chúng độc lập nhau, xếp hàng chúng là cộng dồn năm lần chờ vào thời
 * gian hiện ra của trang.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tasks");
  return { title: t("title") };
}

export default async function TasksPage() {
  const session = await requireSession();
  const workspaceId = session.workspace.id;

  /*
   * ⚠ CHỐT QUYỀN ĐỌC, trước mọi truy vấn. `task.view` là một trong năm quyền từng khai trong ma
   * trận mà KHÔNG AI ĐỌC: quản trị viên tắt "Xem công việc" của khách, bấm lưu, thấy toast xanh —
   * và không gì đổi. Đó là giao diện NÓI DỐI, đúng cái tội mà AGENTS.md dùng để cấm một
   * `Progress` sai tỉ lệ.
   *
   * `notFound()` chứ không phải một màn "bạn không có quyền" — xem `requireReadPermission`.
   */
  await requireReadPermission(workspaceId, session.role, "task.view");

  const [tasks, projects, directory, settings, matrix] = await Promise.all([
    listTasks(workspaceId, session.user.timezone),
    listProjects(workspaceId),
    memberDirectory(workspaceId),
    getAppSettings(workspaceId),
    getPermissionMatrix(workspaceId)
  ]);

  /*
   * ⚠ VỊ TỪ QUYỀN TÍNH Ở ĐÂY — TẦNG SERVER — RỒI MỚI TRUYỀN XUỐNG.
   *
   * File `"use client"` bên cạnh KHÔNG được tự gọi `can()`: nó sẽ phải nhận một ma trận từ đâu đó,
   * và một ma trận đi qua ranh giới server → client là một ma trận có thể bị sửa trước khi được
   * hỏi. Truyền BOOLEAN thì thứ đi xuống trình duyệt là câu trả lời, không phải cơ sở để tự trả
   * lời lại.
   *
   * ⚠ Và **ẩn một nút KHÔNG phải là phân quyền.** Mấy cờ này chỉ quyết định giao diện hiện gì —
   * chúng giúp người dùng không bấm vào chỗ họ sẽ bị từ chối. Chốt THẬT nằm ở máy chủ
   * (`requirePermission()` trong `lib/permissions.ts`) và đọc CÙNG ma trận này; ngày các thao tác
   * dưới bảng có endpoint, mỗi endpoint phải tự gọi chốt đó chứ không tin cờ ở đây.
   */
  const canCreate = can(matrix, session.role, "task.create");
  const canEdit = can(matrix, session.role, "task.edit");
  const canAssign = can(matrix, session.role, "task.assign");
  const canDelete = can(matrix, session.role, "task.delete");
  const canExport = can(matrix, session.role, "report.export");

  /*
   * Lựa chọn của bộ lọc dựng sẵn ở server, và chỉ mang dữ liệu THUẦN (`id` + tên) — `ComboboxOption`
   * còn nhận `icon`, nhưng icon là *component*, không tuần tự hoá được qua ranh giới server → client.
   *
   * Dùng `listProjects` chứ không `listOpenProjectOptions`: bộ lọc phải liệt kê CẢ dự án đã đóng,
   * vì việc cũ vẫn thuộc về chúng. (Biểu mẫu tạo việc thì ngược lại — dự án đóng không nhận việc
   * mới, nên nó dùng danh sách rút gọn kia.)
   */
  const projectOptions = projects.map((project) => ({ id: project.id, name: project.name }));

  /*
   * Danh bạ là câu trả lời của **Comitor.Account**, không phải bảng của module — module chỉ lưu
   * `assignee_user_id`. Xem `lib/account/directory.ts`.
   */
  const memberOptions = [...directory.values()].map((member) => ({ id: member.id, name: member.name }));

  return (
    /*
     * ⚠ KHUNG TRANG (`PageHeader` + `PageContainer`) NẰM TRONG `TaskTable`, KHÔNG Ở ĐÂY.
     *
     * Không phải tuỳ tiện: nút "Xuất danh sách" trong `actions` phải xuất ĐÚNG TẬP ĐANG LỌC, mà
     * `filter`/`sort` là `useState` bên trong đảo client. Server Component không đọc được chúng,
     * và một đảo client anh em cũng không — nó chỉ thấy `tasks` gốc. Lý do đầy đủ ghi ở chỗ
     * `return` của `task-table.tsx`; luật ở AGENTS.md §"Thêm một trang mới" bước 2.
     *
     * ⚠ Và ĐỪNG "tiện tay" gắn `"use client"` lên chính file này để gom lại: chỉ thị đó theo FILE,
     * nên nó sẽ nuốt luôn `generateMetadata()` ở trên (Next cấm hai thứ cùng file) và đẩy cả phần
     * lấy dữ liệu sang bundle trình duyệt.
     */
    <TaskTable
      tasks={tasks}
      projects={projectOptions}
      members={memberOptions}
      defaultPageSize={settings.defaultPageSize}
      canCreate={canCreate}
      canEdit={canEdit}
      canAssign={canAssign}
      canDelete={canDelete}
      canExport={canExport}
    />
  );
}
