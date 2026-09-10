import { PageContainer, PageHeader, Skeleton } from "@comitor/ui";
import { getTranslations } from "next-intl/server";

/**
 * Khung chờ của khu Công việc (`/tasks`) — header, thanh lọc, rồi khối bảng.
 *
 * Khung chung của nhóm `(shell)` là hình TỔNG QUAN (hàng thẻ chỉ số + thẻ biểu đồ + lưới 2/1),
 * sai hẳn hình dạng ở đây, nên khu này cần file riêng.
 *
 * `width="full"` để khớp `PageContainer` của trang thật: khung chờ hẹp hơn trang rồi bảng rộng đổ
 * vào là bố cục giật ngang một nhịp, đúng thứ khung chờ sinh ra để tránh.
 *
 * ── VÌ SAO DÙNG `<PageHeader>` THẬT ─────────────────────────────────────────────────────
 * `page.tsx` render `PageHeader` NGOÀI `PageContainer`; bỏ nó khỏi khung chờ thì lúc nội dung
 * thật đổ vào sẽ mọc thêm cả một header dính đỉnh và đẩy bảng xuống. Mượn component của gói thì
 * hình học luôn khớp trang thật, kể cả khi gói đổi padding — chép tay bộ class sang đây là dựng
 * bản sao thứ hai và nó lệch im lặng. `sticky` giữ đúng hành vi của header thật.
 *
 * ⚠ KHÔNG mô phỏng dòng MÔ TẢ dưới tiêu đề, dù header thật có một dòng. Lý do là ràng buộc DOM,
 * không phải quên: `PageHeader` render `description` vào một `<p>`, mà `<Skeleton>` của gói là
 * một `<div>` — `<div>` trong `<p>` bị trình duyệt tự đóng thẻ và React 19 báo lỗi hydrate ở mọi
 * lần render. Cái giá là header chờ thấp hơn header thật ~16px (375px) / ~20px (md), tức vẫn còn
 * một nhịp giật nhỏ. Cách chữa ĐÚNG nằm ở gói, không ở đây: cho `Skeleton` nhận `asChild` (để
 * render thành `<span>`), hoặc gói xuất luôn một `PageHeaderSkeleton`. Đừng vá bằng một `<span>`
 * chép lại bộ class của `Skeleton` — đó là bản sao thứ hai của một component đã có.
 */
export default async function TasksLoading() {
  const t = await getTranslations("edges");

  return (
    <>
      <PageHeader
        aria-hidden="true"
        sticky
        title={<Skeleton className="h-7 w-40 md:h-8" />}
        actions={<Skeleton className="h-9 w-32 rounded-md" />}
      />

      <PageContainer width="full" aria-busy="true">
        {/* `sr-only` đặt NGOÀI khối `space-y-4` bên dưới: `space-y-*` bỏ qua phần tử đầu và gắn
            `margin-top` cho mọi phần tử sau, nên một câu thông báo đứng làm con đầu tiên sẽ đẩy
            cả trang xuống. Nó `position: absolute` nên ở đây nó không chiếm chỗ nào. */}
        <span className="sr-only">{t("loading.tasks")}</span>

        {/* Các ô xám không mang nghĩa gì với trình đọc màn hình → ẩn khỏi cây trợ năng. */}
        <div aria-hidden="true" className="space-y-4">
          {/* Thanh lọc: ô tìm kiếm co giãn + hai bộ lọc. */}
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 min-w-56 flex-1 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>

          <Skeleton className="h-[28rem] rounded-xl" />
        </div>
      </PageContainer>
    </>
  );
}
