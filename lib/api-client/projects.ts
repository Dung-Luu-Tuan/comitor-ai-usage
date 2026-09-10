import type { ProjectView } from "@/lib/contracts/task";
import { callApi } from "./http";

/**
 * CỔNG API của dự án — cùng khuôn `./tasks.ts`: một phương thức cho một endpoint, kiểu trả về viết
 * tay. Xem chú thích đầu file đó cho lý do.
 */

/** Thân của `POST /api/projects`. `code` KHÔNG có mặt — máy chủ suy từ tên và né mã đã dùng. */
export interface CreateProjectInput {
  name: string;
  ownerUserId: string;
  /** ISO chỉ-có-ngày (`YYYY-MM-DD`). */
  dueDate: string;
}

/** Tạo một dự án. Trả về bản ghi đã tạo, kèm `code` mà máy chủ vừa cấp. */
export async function createProject(input: CreateProjectInput): Promise<ProjectView> {
  return callApi<ProjectView>("/api/projects", { method: "POST", json: input });
}
