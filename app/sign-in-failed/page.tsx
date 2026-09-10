import { Alert, AlertDescription, AlertTitle, Button, EmptyState } from "@comitor/ui";
import { ExternalLink, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { accountProfileUrl } from "@/lib/account/links";

/**
 * "Không đăng nhập được" — đích của `/api/auth/callback` khi luồng OIDC hỏng.
 *
 * ── VÌ SAO TRANG NÀY PHẢI TỒN TẠI (một lỗi đã đo được, không phải phòng xa) ───────────────
 * Bản trước cho callback chuyển hướng về `/?auth=failed`, và cờ đó **hỏng theo hai tầng**:
 *
 *   1. **Không ai đọc nó.** `grep "auth=failed"` toàn repo ra đúng một kết quả: dòng ghi nó ra.
 *      Không component nào, không khoá `messages/` nào. Một tham số truy vấn không có người đọc thì
 *      không phải là thông báo lỗi — nó là rác trên thanh địa chỉ.
 *   2. **Kể cả có người đọc thì cũng không kịp render.** `/` nằm trong `(shell)` nên nó gọi
 *      `requireSession()`; mà tình huống duy nhất sinh ra cờ này là tình huống KHÔNG CÓ PHIÊN. Nên
 *      `/` đẩy thẳng sang `/api/auth/sign-in` trước khi có gì hiện ra.
 *
 * Tầng 2 còn dựng lại đúng cái vòng lặp mà chú thích trong `callback/route.ts` nói là muốn tránh:
 * callback hỏng → `/` → `sign-in` → Account → callback hỏng → … Vòng đó chỉ dừng nhờ MAY MẮN, tức
 * nhờ lần đăng nhập lại tình cờ thành công. Khi nguyên nhân là thứ đăng nhập lại không chữa được
 * (`redirect_uri` lệch, đồng hồ máy chủ sai, cookie bị chặn), nó quay mãi.
 *
 * Đo được 2026-09-01 trên luồng thật: một authorization code bị gửi hai lần → lần thứ hai nhận
 * `invalid_grant: invalid code` → `/?auth=failed` → `sign-in` → đăng nhập lại thành công. Người
 * dùng **không thấy gì cả**, và dấu vết duy nhất là một dòng `[auth] ĐĂNG NHẬP HỎNG Ở CALLBACK`
 * trong log máy chủ. Đăng nhập hỏng một nhịp mà không ai biết là một lỗi tự che — cùng một họ với
 * hai lỗi đã sửa hôm nay (đăng xuất vô hình, và cuộc đua xoay token).
 *
 * ── HAI ĐIỀU KIỆN CỦA MỘT TRANG BIÊN XÁC THỰC, ĐỪNG PHÁ ──────────────────────────────────
 *   · **Nằm NGOÀI `(shell)`** — nó phải hiển thị được khi KHÔNG có phiên. Đưa vào `(shell)` là
 *     dựng lại đúng lỗi trên, và triệu chứng sẽ là "trang báo lỗi không bao giờ hiện".
 *   · **KHÔNG tự chuyển hướng.** Nút "Thử đăng nhập lại" phải do người dùng bấm. Một
 *     `redirect()` hay `<meta refresh>` ở đây biến trang này thành một mắt xích của cùng vòng lặp,
 *     chỉ chậm hơn.
 *
 * ── VÌ SAO CHỈ MỘT THÔNG ĐIỆP CHO CẢ BỐN NGUYÊN NHÂN ─────────────────────────────────────
 * Bốn nguyên nhân đổ vào `catch` của callback (từ chối đồng ý · `state` không khớp · code đã dùng ·
 * `redirect_uri` bị từ chối) có **cùng một cách sửa của người dùng: đăng nhập lại**. Tách bốn câu
 * chữ là bắt họ đọc bốn đoạn để rồi bấm cùng một cái nút, và ba trong bốn câu chỉ có nghĩa với lập
 * trình viên. Nguyên nhân thật nằm trong log máy chủ, nơi người sửa được nó đang đứng.
 *
 * ⚠ Cũng vì vậy: **đừng đưa `error.message` lên trang này**. Nó là chuỗi tiếng Anh cho lập trình
 * viên, không dịch được, và ở luồng xác thực nó tiết lộ chi tiết cấu hình cho một người chưa chứng
 * minh được mình là ai.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signInFailed");
  return { title: t("title") };
}

export default async function SignInFailedPage() {
  const t = await getTranslations("signInFailed");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-6 px-4 py-10">
      <EmptyState
        icon={ShieldAlert}
        title={t("title")}
        description={t("description")}
        action={
          <Button asChild>
            {/*
             * Thẻ `<a>` thật, KHÔNG phải `<Link>` của Next: đích là một ROUTE HANDLER trả 307 sang
             * Comitor.Account. Điều hướng phía client của Next sẽ cố lấy payload RSC của một đường
             * không hề render React — nó không hỏng ngay, nhưng nó đi một vòng thừa rồi mới rơi về
             * điều hướng thật.
             */}
            <a href="/api/auth/sign-in">{t("tryAgain")}</a>
          </Button>
        }
      />

      <Alert variant="warning" className="w-full">
        <AlertTitle>{t("stillFailing")}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{t("stillFailingHint")}</p>
          <Button variant="outline" size="sm" asChild>
            {/* Đường sang Account gom ở `lib/account/links.ts` — đừng viết chuỗi URL thẳng vào đây. */}
            <a href={accountProfileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden="true" />
              {t("openAccount")}
            </a>
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  );
}
