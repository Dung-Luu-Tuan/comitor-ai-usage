import { PageContainer, PageHeader, Skeleton } from "@comitor/ui";
import { getTranslations } from "next-intl/server";

/**
 * Khung chờ của trang Tổng quan (`/`) — VÀ là khung mặc định cho route nào chưa có `loading.tsx`
 * riêng.
 *
 * ⚠ Nó mô phỏng hình dạng của TRANG TỔNG QUAN (header, hàng thẻ chỉ số, thẻ biểu đồ, rồi lưới
 * 2/1), nên nó chỉ đúng cho trang đó. Khu nào có bố cục khác thì phải có `loading.tsx` của riêng
 * khu ấy — xem `tasks/loading.tsx`, `settings/loading.tsx`. `loading.tsx` ở thư mục cha tự phủ
 * mọi route con, nên KHÔNG cần một file cho mỗi route: đặt ở mức khu là đủ.
 *
 * Next tự bọc nội dung của nhóm route này bằng `<Suspense>` và hiện file này trong lúc trang
 * đang dựng ở server. Nhờ đặt ở tầng nhóm, THANH BÊN VÀ HEADER CỦA SHELL VẪN ĐỨNG YÊN — chỉ vùng
 * nội dung đổi sang khung xám. Đó là điều tách biệt một app chuyển trang mượt với một app chớp
 * trắng cả màn hình.
 *
 * ── VÌ SAO DÙNG `<PageHeader>` THẬT CHỨ KHÔNG TỰ VẼ MỘT DẢI XÁM ──────────────────────────
 * `page.tsx` render `PageHeader` NGOÀI `PageContainer`, nên vùng chờ cũng phải có đúng khối đó,
 * nếu không lúc nội dung thật đổ vào sẽ mọc thêm một header và đẩy cả trang xuống. Mượn thẳng
 * component của gói (tiêu đề và nút là `ReactNode` nên nhét `<Skeleton>` vào được) thì hình học
 * — padding, breakpoint, chiều cao dòng tiêu đề — luôn khớp trang thật, kể cả khi gói đổi. Chép
 * tay bộ class `px-4 pt-4 md:px-6` sang đây là dựng bản sao thứ hai, và nó lệch im lặng.
 *
 * `borderless` + KHÔNG có `description`: đúng như header thật của trang Tổng quan (xem chú thích
 * trong `page.tsx` — trang này cố ý không có mô tả và không có đường kẻ dưới).
 *
 * `aria-hidden` cho cả header: người dùng trình đọc màn hình chỉ cần nghe một câu "đang tải" ở
 * dưới, còn một `<h1>` rỗng thì bị đọc thành một tiêu đề không có tên.
 */
export default async function ShellLoading() {
  const t = await getTranslations("edges");

  return (
    <>
      <PageHeader
        aria-hidden="true"
        borderless
        title={<Skeleton className="h-7 w-40 md:h-8" />}
        actions={<Skeleton className="h-9 w-36 rounded-md" />}
      />

      {/* `width="lg"` khớp `PageContainer` của trang thật — khung chờ hẹp hơn trang rồi nội dung
          rộng đổ vào là bố cục giật ngang một nhịp. */}
      <PageContainer width="lg" aria-busy="true">
        {/* `sr-only` đặt NGOÀI khối `space-y-6` bên dưới: `space-y-*` bỏ qua phần tử đầu và gắn
            `margin-top` cho mọi phần tử sau, nên một câu thông báo đứng làm con đầu tiên sẽ đẩy
            cả trang xuống 24px — đúng thứ khung chờ sinh ra để tránh. Nó `position: absolute`
            nên ở đây nó không chiếm chỗ nào. */}
        <span className="sr-only">{t("loading.overview")}</span>

        {/* Các ô xám không mang nghĩa gì với trình đọc màn hình → ẩn khỏi cây trợ năng. */}
        <div aria-hidden="true" className="space-y-6">
          {/* Hàng chỉ số — bốn thẻ, cùng lưới với trang thật. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>

          {/* Thẻ biểu đồ "Việc theo dự án". */}
          <Skeleton className="h-80 rounded-xl" />

          {/* Lưới 2/1: nhật ký hoạt động bên trái, hai thẻ chồng nhau bên phải. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 rounded-xl lg:col-span-2" />
            <div className="space-y-6">
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-36 rounded-xl" />
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
