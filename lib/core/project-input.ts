import { z } from "zod";
import { isIsoDate } from "./iso-date";

/**
 * Hợp đồng dữ liệu của lệnh TẠO DỰ ÁN — cùng khuôn `task-input.ts`, cùng lý do ở tầng 1.
 *
 * ⚠ `code` KHÔNG có mặt: nó được SUY từ tên (`lib/core/project-code.ts`) và né mã đã dùng. Cho
 * chỗ gọi chọn mã là mời hai người chọn trùng nhau và nhận một lỗi ràng buộc thay vì một cái tên.
 *
 * ⚠ `status` cũng không: dự án mới LUÔN `active`. Cho tạo thẳng một dự án `completed` là mở một
 * đường ghi bỏ qua toàn bộ dòng đời của nó.
 */
export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** id người phụ trách — do Account cấp, kiểm lại với danh bạ ở `lib/projects.ts`. */
  ownerUserId: z.string().min(1).max(64),
  /** ISO chỉ-có-ngày. Cùng lý do `@db.Date` ở lược đồ: hạn chót là một NGÀY. */
  dueDate: z.string().refine(isIsoDate)
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
