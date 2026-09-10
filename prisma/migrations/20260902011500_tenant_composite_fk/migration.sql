-- Khoá ngoại KÉP giữa `tasks` và `projects`: lưới cuối của bất biến `workspace_id`.
--
-- Trước migration này, một công việc gắn được vào dự án của KHÁCH HÀNG KHÁC mà database không
-- từ chối — tính toàn vẹn giữa hai không gian làm việc chỉ do một phép kiểm ở tầng ứng dụng giữ.
-- Xem khối chú thích trên quan hệ `Task.project` trong prisma/schema.prisma.
--
-- ⚠ AN TOÀN VỚI DỮ LIỆU ĐANG CÓ, NHƯNG KHÔNG PHẢI VÔ ĐIỀU KIỆN:
--   · chỉ mục duy nhất mới luôn thoả, vì `id` đã là khoá chính nên `(workspace_id, id)` duy nhất;
--   · khoá ngoại mới CHỈ áp được nếu mọi `tasks.workspace_id` đang khớp `projects.workspace_id`
--     của dự án nó trỏ tới. Nếu một môi trường đã có dữ liệu lệch thì lệnh cuối sẽ THẤT BẠI —
--     và đó là hành vi đúng: nó vừa tìm ra một vụ rò dữ liệu đã xảy ra. Chạy phép đếm sau đây
--     TRƯỚC khi deploy lên một môi trường có dữ liệu thật:
--
--       SELECT COUNT(*) FROM tasks t
--       JOIN projects p ON p.id = t.project_id
--       WHERE p.workspace_id <> t.workspace_id;

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_project_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "projects_workspace_id_id_key" ON "projects"("workspace_id", "id");

-- CreateIndex: tra theo NGƯỜI ("tôi đang theo dõi việc nào") — khoá chính chỉ phục vụ chiều ngược.
CREATE INDEX "task_watchers_user_id_idx" ON "task_watchers"("user_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_project_id_fkey" FOREIGN KEY ("workspace_id", "project_id") REFERENCES "projects"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
