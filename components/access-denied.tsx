import { Alert, AlertDescription, AlertTitle, Button, EmptyState } from "@comitor/ui";
import type { LucideIcon } from "lucide-react";
import { ExternalLink, Lock, PauseCircle, TicketX, UserX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { accountWorkspacesUrl, accountWorkspaceUrl } from "@/lib/account/links";

/**
 * Màn hình chặn — **BỐN mã, BỐN câu, BỐN đường đi tiếp**.
 *
 * ── VÌ SAO KHÔNG GỘP THÀNH "BẠN KHÔNG CÓ QUYỀN" ──────────────────────────────────────────
 * Vì bốn tình huống này dẫn tới bốn HÀNH ĐỘNG khác nhau của người dùng, và gộp lại là bắt họ tự
 * đoán phải đi hỏi ai:
 *
 *   · `NOT_A_MEMBER`    → xin quản trị viên MỜI vào không gian làm việc;
 *   · `APP_NOT_ENABLED` → xin quản trị viên BẬT ứng dụng trong phần Ứng dụng và gói;
 *   · `NO_SEAT`         → app đã bật, nhưng xin quản trị viên CẤP CHỖ NGỒI;
 *   · `APP_SUSPENDED`   → quá hạn thanh toán, phải CẬP NHẬT THANH TOÁN.
 *
 * Người gặp `NO_SEAT` mà nhận câu "bạn không thuộc workspace này" sẽ đi xin được mời lại vào một
 * nơi họ đã ở trong đó — và quản trị viên sẽ không hiểu họ đang nói gì.
 *
 * ── VÀ VÌ SAO MỌI NÚT ĐỀU DẪN SANG COMITOR.ACCOUNT ───────────────────────────────────────
 * Vì không việc nào trong bốn việc trên module tự làm được: mời người, bật app, cấp chỗ ngồi, sửa
 * thanh toán đều là câu trả lời của Account. Module dựng lại chúng là dựng cửa thứ hai vào cùng
 * một dữ liệu — xem AGENTS.md §"Ranh giới Account / app".
 */

export type AccessDeniedCode = "NOT_A_MEMBER" | "APP_NOT_ENABLED" | "NO_SEAT" | "APP_SUSPENDED";

const ICONS: Record<AccessDeniedCode, LucideIcon> = {
  NOT_A_MEMBER: UserX,
  APP_NOT_ENABLED: Lock,
  NO_SEAT: TicketX,
  APP_SUSPENDED: PauseCircle
};

export interface AccessDeniedProps {
  code: AccessDeniedCode;
  /** Slug workspace, khi biết — quyết định nút dẫn tới đúng khu quản trị nào bên Account. */
  workspaceSlug?: string;
  workspaceName?: string;
}

export async function AccessDenied({ code, workspaceSlug, workspaceName }: AccessDeniedProps) {
  const t = await getTranslations("accessDenied");

  /*
   * `NOT_A_MEMBER` dẫn tới DANH SÁCH workspace (họ chưa ở trong cái nào); ba mã còn lại dẫn tới
   * đúng khu quản trị của workspace đang xét. Dẫn nhầm chỗ là để người dùng đứng trước một trang
   * họ không có quyền mở.
   */
  const href =
    code === "NOT_A_MEMBER" || !workspaceSlug
      ? accountWorkspacesUrl
      : /* Ba mã còn lại đều được xử lý ở cùng một khu: bật app, cấp chỗ ngồi và thanh toán nằm
           chung trang "Ứng dụng và gói" của Account. */
        accountWorkspaceUrl(workspaceSlug, "apps");

  const Icon = ICONS[code];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-6 px-4 py-10">
      {/* `size="sm"` — mặc định của `EmptyState` mang chiều cao tối thiểu lớn, hợp cho một vùng
          trống GIỮA một trang có nội dung. Ở đây nó LÀ cả trang, nên chiều cao đó đẩy khối giải
          thích bên dưới rơi xuống tận đáy khung nhìn. */}
      <EmptyState
        size="sm"
        icon={Icon}
        title={t(`${code}.title` as Parameters<typeof t>[0])}
        description={t(`${code}.description` as Parameters<typeof t>[0], { workspace: workspaceName ?? "" })}
        action={
          <Button asChild>
            {/*
             * `asChild` bỏ qua `leftIcon`/`rightIcon` (Radix Slot chỉ nhận đúng một phần tử con) →
             * icon phải nằm BÊN TRONG thẻ `<a>`.
             *
             * `target="_blank"` cố ý: người dùng đang mắc kẹt ở đây, và họ sẽ quay lại tab này sau
             * khi quản trị viên xử lý xong. Điều hướng đè lên tab hiện tại là bắt họ tự tìm đường
             * về.
             */}
            <a href={href} target="_blank" rel="noreferrer">
              {t(`${code}.action` as Parameters<typeof t>[0])}
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </Button>
        }
      />

      <Alert className="w-full">
        <AlertTitle>{t("whoCanHelp")}</AlertTitle>
        <AlertDescription>{t("whoCanHelpHint")}</AlertDescription>
      </Alert>

      {/*
       * Đường THOÁT. Không có nó thì người dùng đăng nhập nhầm tài khoản sẽ mắc kẹt vĩnh viễn: mọi
       * trang đều dẫn về đây, và không có nút nào đổi được tài khoản.
       *
       * ⚠ `<form method="post">`, KHÔNG phải `<a href>`. `/api/auth/sign-out` chỉ export `POST`
       * (lý do đầy đủ ở JSDoc của route: với `GET`, một liên kết trong tin nhắn là đủ để đăng xuất
       * người dùng, và `sameSite=lax` không chặn được vì nó CÓ gửi cookie cho điều hướng
       * top-level). Bản trước dùng `<a>` nên nút này trả **405** — đo được 2026-09-03 — tức đúng
       * đường thoát duy nhất của bốn màn guard là một nút chết, và người đăng nhập nhầm tài khoản
       * mắc kẹt thật.
       *
       * Trang này là Server Component và không có state, nên một `<form>` thường là đủ: không cần
       * `"use client"`, và nó vẫn chạy khi JS bị chặn.
       */}
      <form method="post" action="/api/auth/sign-out">
        <Button variant="ghost" size="sm" type="submit">
          {t("signOut")}
        </Button>
      </form>
    </main>
  );
}
