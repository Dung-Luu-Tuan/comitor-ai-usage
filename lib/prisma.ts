import "server-only";
import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

/**
 * Một client Prisma cho cả tiến trình.
 *
 * ── VÌ SAO PHẢI GIỮ Ở `globalThis` ─────────────────────────────────────────────────────────
 * `next dev` nạp lại module ở mỗi lần sửa file (HMR). Mỗi lần nạp lại mà tạo một `PrismaClient`
 * mới là mở thêm một pool kết nối, và pool cũ KHÔNG được đóng — sau vài chục lần sửa file thì
 * Postgres từ chối kết nối với `too many clients already`. Triệu chứng đánh lừa: nó xuất hiện giữa
 * một buổi làm việc bình thường, không liên quan gì tới đoạn mã vừa sửa, và biến mất sau khi khởi
 * động lại dev server — nên rất dễ bị coi là "máy bị gì đó".
 *
 * Ở production thì module chỉ nạp một lần và biến toàn cục không có tác dụng gì — vô hại, và giữ
 * cùng một đường chạy cho cả hai môi trường vẫn hơn là thêm một nhánh `if`.
 *
 * ⚠ `env.databaseUrl` được đọc ở đây CHỈ để `lib/env.ts` chạy và ném lỗi sớm khi thiếu biến. Prisma
 * tự đọc `DATABASE_URL` từ `datasource` trong schema — hai đường đọc cùng một biến, cố ý: nếu chỉ
 * để Prisma đọc thì thiếu biến sẽ hỏng ở truy vấn ĐẦU TIÊN, tức giữa một request của người dùng.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

void env.databaseUrl;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
