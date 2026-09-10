import { Button, EmptyState } from "@comitor/ui";
import { FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Trang 404 — Next dùng file này cho MỌI URL không khớp route nào.
 *
 * Nằm ở `app/` chứ không trong `(shell)`: URL không khớp thì Next chưa biết nó thuộc nhóm nào,
 * nên chỉ `app/layout.tsx` (html + font + bốn provider hiển thị + `NextIntlClientProvider`) được
 * áp — không có thanh bên, không có header. Đó cũng là lý do trang này tự dựng khung căn giữa
 * thay vì dùng `PageContainer`.
 *
 * KHÔNG bỏ file này đi: thiếu nó Next rơi về trang mặc định của framework — một thứ tiếng duy
 * nhất, không theo brand, không có đường quay lại. Biên lỗi là một phần của khung app, không
 * phải phần thêm.
 *
 * ⚠ `generateMetadata` chứ không phải một hằng `metadata`: tiêu đề tab nay nằm trong
 * `messages/*.json`, mà một hằng ở scope module thì được đánh giá TRƯỚC khi có request nào — tức
 * trước khi biết người dùng đọc ngôn ngữ gì. Cùng lý do với `app/layout.tsx`.
 *
 * Next CÓ đọc metadata của `not-found.tsx` (nó gom qua nhánh `errorConvention` trong bộ giải
 * metadata, cùng đường với `layout`/`page`), nên khai ở đây là có tác dụng thật. Chỉ đưa TÊN
 * TRANG: `template` ở root layout tự nối tên sản phẩm vào.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("edges");
  return { title: t("notFound.title") };
}

export default async function NotFound() {
  const t = await getTranslations("edges");

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState
        icon={FileQuestion}
        title={t("notFound.title")}
        description={t("notFound.description")}
        action={
          <Button asChild>
            <Link href="/">{t("backHome")}</Link>
          </Button>
        }
      />
    </main>
  );
}
