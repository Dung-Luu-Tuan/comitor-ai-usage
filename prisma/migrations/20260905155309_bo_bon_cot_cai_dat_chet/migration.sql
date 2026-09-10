-- Bỏ bốn cột cài đặt CHẾT — bước "thu hẹp" của công thức mở rộng → backfill → thu hẹp.
--
-- ⚠ ĐÂY LÀ MIGRATION KHÔNG LÙI ĐƯỢC, và nó chỉ an toàn vì một đợt phát hành TRƯỚC đã dọn đường.
-- Prisma không có `migrate down`; rollback thật là khôi phục từ sao lưu.
--
-- ── ĐIỀU KIỆN ĐÃ PHẢI THOẢ TRƯỚC KHI CHẠY DÒNG NÀY ─────────────────────────────────────
-- Mã ở v0.7.0 đã thôi gọi tên bốn cột này ở CẢ BA chỗ mà Prisma sinh SQL, không phải hai:
--   1. `SETTINGS_COLUMNS` giới hạn `SELECT` của `getAppSettings`;
--   2. `columns` giới hạn danh sách cột của INSERT và UPDATE;
--   3. `select: { workspaceId: true }` giới hạn **`RETURNING`** của `upsert` — chỗ dễ sót nhất,
--      vì `upsert` TRẢ VỀ bản ghi nên mặc định Prisma liệt kê mọi cột vô hướng, và một câu GHI vẫn
--      gọi tên cột đã bỏ thì vẫn đổ dù đường ĐỌC đã sạch.
-- Thiếu bất kỳ chỗ nào trong ba, `migrate deploy` (chạy TRƯỚC khi mã mới lên) sẽ để một khoảng mà
-- mã CŨ hỏi những cột vừa biến mất — tức hỏng cả đường LÙI, không chỉ mất dữ liệu.
--
-- ── DỮ LIỆU MẤT GÌ ─────────────────────────────────────────────────────────────────────
-- Chỉ workspace đã từng bấm Lưu mới có hàng. Với những hàng đó, bốn giá trị bị xoá — và KHÔNG giá
-- trị nào trong đó từng được đọc bởi bất kỳ đường mã nào, nên không hành vi nào đổi.
--
-- ⚠ `allow_attachment_download` là ca đáng nói riêng: nhãn của nó hứa "chỉ xem, không tải xuống"
-- trong khi `lib/storage.ts` luôn ký presigned GET cho mọi tệp. Quản trị viên nào từng tắt công tắc
-- ấy đã tin vào một cánh cửa chưa bao giờ đóng. Xoá cột là xoá lời hứa đó, không phải xoá một tính
-- năng — xem CHANGELOG v0.7.0.
--
-- `DROP COLUMN` trên PostgreSQL chỉ sửa catalog và đánh dấu cột là đã bỏ; không viết lại bảng.
ALTER TABLE "app_settings" DROP COLUMN "allow_attachment_download",
DROP COLUMN "notify_mentioned",
DROP COLUMN "notify_project_update",
DROP COLUMN "week_start";
