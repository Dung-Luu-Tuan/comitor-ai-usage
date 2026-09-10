"use client";

import { Button, EmptyState } from "@comitor/ui";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

/**
 * Biên lỗi của toàn app — Next hiển thị file này khi một trang (hoặc layout con) ném lỗi lúc
 * render.
 *
 * BẮT BUỘC `"use client"`: biên lỗi phải chạy được ở trình duyệt để bắt cả lỗi lúc hydrate và
 * để nút "Thử lại" gọi được `reset()`.
 *
 * `reset()` render lại đúng cây vừa hỏng — dùng cho lỗi nhất thời (mạng chập chờn, một lời gọi
 * lỗi). Lỗi do dữ liệu sai thì bấm bao nhiêu lần cũng thế, nên vẫn phải chừa đường quay về.
 *
 * ── VÌ SAO `useTranslations` CHẠY ĐƯỢC Ở ĐÂY ─────────────────────────────────────────────
 * Biên lỗi này bọc phần `children` của ROOT LAYOUT, tức nó render BÊN TRONG
 * `<NextIntlClientProvider>` mà `app/layout.tsx` dựng. Root layout vẫn còn nguyên khi trang con
 * hỏng, nên context i18n vẫn có mặt và hook đọc được bộ chuỗi như mọi Client Component khác.
 *
 * ── VÌ SAO KHÔNG CÓ `app/global-error.tsx` ───────────────────────────────────────────────
 * `global-error.tsx` chỉ chạy khi CHÍNH ROOT LAYOUT hỏng, và nó thay thế cả `<html>`/`<body>` —
 * nghĩa là ở đó KHÔNG có `<NextIntlClientProvider>`, không có `<ThemeProvider>`, không có font,
 * không có một provider nào. Mọi chuỗi trong file đó buộc phải là HẰNG TIẾNG ANH viết thẳng vào
 * JSX; đó là NGOẠI LỆ DUY NHẤT của quy tắc "mọi chuỗi hiển thị đều đi qua i18n".
 * Module này cố ý không có file đó (root layout không đọc dữ liệu nên gần như không có gì để
 * hỏng). Ngày nào phải viết nó, viết đúng như vậy — đừng gọi `useTranslations` trong đó.
 *
 * ⚠ Thông điệp cho người dùng KHÔNG in `error.message`: nội dung đó là của lập trình viên (tên
 * bảng, câu truy vấn, đường dẫn nội bộ) và ở production Next đã thay bằng chuỗi rỗng cùng một
 * `digest`. Thứ DUY NHẤT nối được sự cố người dùng đang gặp với dòng log phía server là
 * `error.digest`, nên đó là thứ hiện ra — để họ đọc cho bộ phận hỗ trợ. Chi tiết đi vào log.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("edges");
  const tCommon = useTranslations("common");

  useEffect(() => {
    // App thật: đẩy sang dịch vụ theo dõi lỗi kèm `error.digest` để nối được với log phía
    // server. Ở đây chỉ ghi ra console.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState
        icon={TriangleAlert}
        title={t("error.title")}
        description={
          <>
            {t("error.description")}
            {/*
             * `digest` chỉ có ở bản production build (dev thì Next trả lỗi nguyên vẹn và bỏ
             * trống trường này), nên phải render có điều kiện — in "Mã sự cố: undefined" còn tệ
             * hơn không in gì. `<span className="block">` chứ không `<div>`: `EmptyDescription`
             * của gói là một `<div>`, nhưng giữ phần tử con ở mức phrasing thì đoạn mô tả vẫn
             * là một khối chữ liền mạch.
             */}
            {error.digest ? (
              <span className="mt-2 block font-mono text-xs text-muted-foreground">
                {t("error.digest", { digest: error.digest })}
              </span>
            ) : null}
          </>
        }
        action={
          <>
            <Button onClick={reset}>{tCommon("retry")}</Button>
            {/*
             * `<a>` thô chứ không `next/link`: state phía client vừa hỏng nên nạp lại cả trang
             * là cách chắc chắn nhất để về được trạng thái sạch.
             */}
            <Button variant="outline" asChild>
              <a href="/">{t("backHome")}</a>
            </Button>
          </>
        }
      />
    </main>
  );
}
