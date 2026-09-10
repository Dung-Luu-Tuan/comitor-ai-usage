-- Thu hồi phiên theo NGƯỜI, và chống trùng webhook.
--
-- ⚠ ĐÂY LÀ BƯỚC "MỞ RỘNG" của công thức ba bước (docs/migration.md §4), và nó tương thích ngược
-- một bản theo đúng nghĩa:
--   · `user_id` NULLABLE — migration chạy TRƯỚC khi mã mới lên, nên trong khoảng đó mã CŨ còn tạo
--     phiên mà không điền cột này. `NOT NULL` ở đây là làm mọi lần đăng nhập trong khoảng đó hỏng.
--   · KHÔNG backfill: phiên tự hết hạn sau 30 ngày, nên cột tự đầy. Không có bước "thu hẹp" nào
--     cần chạy sau — cột này sống nullable vĩnh viễn, vì một phiên tạo bởi bản cũ là hợp lệ.
--   · `webhook_events` là bảng mới, không đụng gì đang có.

-- AlterTable
ALTER TABLE "account_sessions" ADD COLUMN     "user_id" TEXT;

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events"("received_at");

-- CreateIndex: thu hồi theo người — thiếu nó thì mỗi lần thu hồi là một lần quét bảng.
CREATE INDEX "account_sessions_user_id_idx" ON "account_sessions"("user_id");
