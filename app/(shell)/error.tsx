"use client";

import { Button, EmptyState, PageContainer } from "@comitor/ui";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

/**
 * Biên lỗi CỦA KHU `(shell)` — khác `app/error.tsx` ở đúng một chỗ, và chỗ đó quyết định tất cả.
 *
 * ── VÌ SAO PHẢI CÓ HAI BIÊN LỖI ─────────────────────────────────────────────────────────
 * `app/error.tsx` thay thế **toàn bộ trang**: thanh bên, header, ⌘K, chuông thông báo — tất cả
 * biến mất. Với một lỗi ở MỘT trang (`/settings/advanced` chẳng hạn) thì điều người dùng thấy là
 * "ứng dụng đã sập", và phản ứng đúng của họ là đóng tab.
 *
 * File này bắt lỗi ở TRONG khung: khung app còn nguyên, người dùng bấm sang trang khác được, và
 * thứ hỏng chỉ là một trang. Đó là khác biệt giữa "một chỗ hỏng" và "cả sản phẩm hỏng".
 *
 * ⚠ Đối chiếu: `loading.tsx` đã được làm ĐÚNG theo khu từ đầu (ba file, và `(shell)/loading.tsx`
 * giải thích rõ vì sao). Biên lỗi thì không được hưởng cùng sự chăm sóc — một sự bất đối xứng
 * không có lý do, chỉ là chưa ai làm.
 *
 * ⚠ `error.tsx` BẮT BUỘC là `"use client"` (hợp đồng của Next), nên nó KHÔNG dùng được
 * `getTranslations` — `useTranslations` thì được, vì provider nằm ở root layout, phía TRÊN biên
 * này. Đó cũng là lý do `app/global-error.tsx` (nếu có ngày phải viết) không có provider nào và
 * phải dùng hằng tiếng Anh trần.
 */
export default function ShellError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors.boundary");

  useEffect(() => {
    /*
     * `digest` là thứ DUY NHẤT nối màn hình này với một dòng log ở máy chủ: Next không gửi thông
     * điệp lỗi thật ra trình duyệt ở production (đúng — nó mang tên bảng, tên cột). Không in nó ra
     * thì người dùng báo "trang lỗi" và không ai tra được lỗi nào.
     */
    console.error("[shell] LỖI Ở MỘT TRANG", { digest: error.digest });
  }, [error.digest]);

  return (
    <PageContainer width="lg">
      <EmptyState
        icon={TriangleAlert}
        title={t("title")}
        description={error.digest ? t("descriptionWithDigest", { digest: error.digest }) : t("description")}
        action={
          <Button onClick={reset} leftIcon={<RotateCcw className="size-4" />}>
            {t("retry")}
          </Button>
        }
      />
    </PageContainer>
  );
}
