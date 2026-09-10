import { Alert, AlertDescription, AlertTitle, Button, EmptyState } from "@comitor/ui";
import { DoorOpen, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { accountSecurityUrl } from "@/lib/account/links";
import { readGlobalSignOut } from "@/lib/account/session-cookie";

/**
 * "Bạn đã thoát khỏi Công việc" — đích của `/api/auth/sign-out`.
 *
 * ── VÌ SAO TRANG NÀY PHẢI TỒN TẠI (một lỗi đã đo được, không phải phòng xa) ───────────────
 * Bản trước cho `/api/auth/sign-out` chuyển hướng về `/`. Đo trên luồng thật: đăng xuất CÓ chạy —
 * refresh token bị thu hồi đúng lúc — nhưng `/` đòi phiên, nên nó lập tức đẩy sang
 * `/api/auth/sign-in`; phiên tại Comitor.Account vẫn còn và client bật `skip_consent`, nên Account
 * trả người dùng về ngay. **Cả vòng mất 38 mili-giây.**
 *
 * Kết quả nhìn từ phía người dùng: bấm "Đăng xuất" và **không có gì xảy ra**. Mã thì đúng, hành vi
 * thì sai — và không log nào ở đâu báo động, vì mọi bước đều thành công.
 *
 * Đó là hệ quả trực tiếp của việc đăng xuất có HAI MỨC. Mức "riêng module" chỉ có nghĩa khi có một
 * chỗ để đứng lại mà không cần phiên — trang này là chỗ đó, và nó nằm NGOÀI `(shell)` nên không đi
 * qua `requireSession()`.
 *
 * Trang cũng là nơi duy nhất chào mời mức thứ hai: thoát khỏi MỌI sản phẩm Comitor. Không có nó
 * thì người dùng trên máy dùng chung không có cách nào thoát thật sự — và họ sẽ không đoán ra rằng
 * phải vào tận Comitor.Account để làm việc đó.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signedOut");
  return { title: t("title") };
}

export default async function SignedOutPage() {
  const t = await getTranslations("signedOut");

  /*
   * HAI lối vào, hai sự thật trái ngược về phiên ở Account — xem `markGlobalSignOut`. Bản trước in
   * một câu cho cả hai, nên với người vừa đăng xuất TOÀN HỆ nó khẳng định ngược lại điều họ vừa
   * làm. Đo được 2026-09-03: bấm "Thoát khỏi mọi sản phẩm", hạ cánh đúng trang này, và đọc được
   * "Bạn vẫn đang đăng nhập ở Comitor.Account".
   *
   * ⚠ CHỈ ĐỌC ở đây. Next cấm ghi cookie trong lúc render trang; chỗ đặt và xoá cờ nằm ở
   * `app/api/auth/sign-out/route.ts`.
   */
  const everywhere = await readGlobalSignOut();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-6 px-4 py-10">
      <EmptyState
        icon={DoorOpen}
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
            <a href="/api/auth/sign-in">{t("signInAgain")}</a>
          </Button>
        }
      />

      <Alert className="w-full">
        <AlertTitle>{everywhere ? t("everywhereTitle") : t("stillSignedIn")}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{everywhere ? t("everywhereHint") : t("stillSignedInHint")}</p>
          {/*
            ⚠ MỘT LIÊN KẾT SANG ACCOUNT, KHÔNG PHẢI NÚT GỌI `?everywhere=1` — và đây là chỗ đã hỏng
            IM LẶNG suốt một thời gian.

            Bản trước đặt ở đây một `<form method="post" action="/api/auth/sign-out?everywhere=1">`.
            Nó KHÔNG BAO GIỜ chạy được, vì lý do thuộc về cấu trúc chứ không phải một lỗi gõ nhầm:
            muốn tới được trang này thì `/api/auth/sign-out` đã phải chạy xong, tức `closeSession()`
            đã xoá hàng phiên và `clearSessionCookie()` đã xoá cookie. Đăng xuất toàn hệ là
            RP-initiated logout và nó cần `id_token_hint` — thứ nằm trong hàng phiên vừa bị xoá. Nên
            nhánh `everywhere` trong route không vào được, và nút chuyển hướng về ĐÚNG trang này.

            Đo được 2026-09-03: `POST /api/auth/sign-out?everywhere=1` không cookie → `307 →
            /signed-out`. Người dùng bấm, trang tải lại, phiên ở Account còn nguyên, không gì báo.

            Nút làm được việc đó nay nằm ở MENU NGƯỜI DÙNG trong app, nơi phiên còn sống
            (`app/(shell)/shell-frame.tsx`). Ở đây — sau khi phiên đã mất — thứ trung thực duy nhất
            là dẫn người dùng sang chính Account, nơi họ thấy mọi phiên đang mở và tự đóng.
          */}
          {/*
            Lối vào TOÀN HỆ không cần nút này: phiên ở Account vừa đóng xong, nên mời người dùng
            sang đó "quản lý phiên" là mời họ đi kiểm một việc vừa làm xong — và với một người
            KHÔNG còn phiên, liên kết đó chỉ dẫn tới màn đăng nhập.
          */}
          {!everywhere && (
            <Button variant="outline" size="sm" asChild>
              <a href={accountSecurityUrl}>
                <ExternalLink className="size-4" aria-hidden="true" />
                {t("signOutEverywhere")}
              </a>
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </main>
  );
}
