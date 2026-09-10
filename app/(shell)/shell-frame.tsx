"use client";

import { toast } from "@comitor/ui";
import type { AppDescriptor, NavGroup, NavItem, ShellUser, Workspace } from "@comitor/ui/shell";
import { AppShell, ComitorLockup, SonnerToaster } from "@comitor/ui/shell";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useMemo } from "react";
import { CommandPaletteSlot, type CommandTask } from "@/components/command-palette-slot";
import { NotificationsSlot } from "@/components/notifications-slot";
import { useErrorMessage } from "@/hooks/use-error-message";
import { accountCreateWorkspaceUrl, accountWorkspaceUrl } from "@/lib/account/links";
import { switchWorkspace } from "@/lib/api-client/workspace";
import { appIconFor, CURRENT_APP_ID } from "@/lib/catalog/apps";
import { NAV_ITEMS, type NavItemSpec } from "@/lib/catalog/navigation";
import type { AccountSession, AccountUser, AccountWorkspace, AppTile, WorkspaceRoleId } from "@/lib/contracts/account";
import type { AppPermissionId } from "@/lib/contracts/settings";
import type { NotificationView } from "@/lib/contracts/task";
import { isLocale } from "@/lib/i18n/config";
import { SHELL_LABELS } from "@/lib/i18n/ui-labels";

/**
 * Khung app — nửa CLIENT của layout.
 *
 * ── VÌ SAO FILE NÀY PHẢI LÀ `"use client"` ────────────────────────────────────────────────
 * Hai lý do độc lập, mỗi lý do một mình đã đủ:
 *   1. `AppShell` nhận hàng loạt CALLBACK (`onWorkspaceChange`, `onAppSelect`, `onUpsell`…), mà
 *      hàm thì không tuần tự hoá được qua ranh giới server → client.
 *   2. `NAV_ITEMS` mang **ICON** — tức component React, cũng không tuần tự hoá được. (Bệ phóng
 *      ứng dụng thì ngược lại: Account gửi TÊN icon, và `appIconFor()` đổi tên thành component
 *      ngay tại đây — xem `lib/catalog/apps.ts`.)
 *      Chúng buộc phải được `import` từ bên trong một file `"use client"`.
 *
 * ── VÀ VÌ SAO NÓ KHÔNG `import` MỘT BẢN GHI NÀO ──────────────────────────────────────────
 * Mọi dữ liệu vào đây qua PROP, từ `layout.tsx` bên cạnh (Server Component). Nhờ vậy khi nối
 * `@comitor/account-sdk`, chỉ file kia đổi — file này không phải sửa một dòng. Thứ duy nhất nó
 * `import` là BẢNG KHAI (`lib/catalog/`), thứ không đến từ máy chủ và không có gì để nối lại.
 *
 * Hai trục điều hướng, vuông góc nhau:
 *   · **workspace** (`WorkspaceSwitcher`) — đổi NGỮ CẢNH DỮ LIỆU;
 *   · **app** (`AppLauncher`) — đổi SẢN PHẨM trong cùng workspace.
 */

export interface ShellFrameProps {
  user: AccountUser;
  role: WorkspaceRoleId;
  workspace: AccountWorkspace;
  notifications: NotificationView[];
  openTaskCount: number;
  /** Mã quyền mà vai trò hiện tại CÓ — dạng thuần, đã tính ở server. Xem `grantedPermissions`. */
  permissions: readonly AppPermissionId[];
  /** MỌI không gian làm việc của người này — nguồn của bộ đổi workspace. */
  allWorkspaces: AccountSession["workspaces"];
  commandTasks: CommandTask[];
  /**
   * Bệ phóng ứng dụng — đã ghép danh mục toàn hệ với quyền dùng của workspace ở `layout.tsx`.
   * Rỗng khi Account không trả lời được; xem `listAppTiles()` ở `lib/account/session.ts`.
   */
  appTiles: readonly AppTile[];
  children: ReactNode;
}

export function ShellFrame({
  user,
  role,
  workspace,
  notifications,
  openTaskCount,
  permissions,
  allWorkspaces,
  commandTasks,
  appTiles,
  children
}: ShellFrameProps) {
  const router = useRouter();
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : "vi";
  const t = useTranslations("shell");
  const tNav = useTranslations("nav");
  const tRoles = useTranslations("roles");

  /**
   * Ghép BẢNG KHAI với NHÃN thành `NavGroup[]`.
   *
   * ⚠ Mục "Cài đặt" nhận `isActive: false` TƯỜNG MINH. Nó có `children` nên bấm vào chỉ mở/đóng
   * nhánh; để shell tự suy thì mục cha sáng CÙNG LÚC với mục con "Chung" (hai mục cùng `href`
   * `/settings`) và người dùng thấy hai hàng active chồng nhau.
   */
  const nav = useMemo<NavGroup[]>(() => {
    const toItem = (spec: NavItemSpec): NavItem => ({
      id: spec.id,
      label: tNav(spec.id),
      href: spec.href,
      ...(spec.icon ? { icon: spec.icon } : {}),
      ...(spec.showOpenTaskBadge && openTaskCount > 0 ? { badge: openTaskCount } : {}),
      ...(spec.children ? { isActive: false, children: spec.children.map(toItem) } : {})
    });

    /*
     * Lọc theo quyền TRƯỚC khi dựng, và lọc CẢ mục con: một nhánh cha còn mục con nào thì nó ở
     * lại, hết mục con thì nó cũng biến mất — để lại một mục cha rỗng là để lại đúng thứ ta vừa
     * giấu, chỉ khác là nó không bấm được.
     */
    const allowed = (spec: NavItemSpec): boolean => !spec.permission || permissions.includes(spec.permission);
    const visible = (specs: readonly NavItemSpec[]): NavItemSpec[] =>
      specs.filter(allowed).flatMap((spec) => {
        if (!spec.children) return [spec];
        const children = visible(spec.children);
        return children.length > 0 ? [{ ...spec, children }] : [];
      });

    return [{ id: "main", items: visible(NAV_ITEMS).map(toItem) }];
  }, [tNav, openTaskCount, permissions]);

  /**
   * Bệ phóng ứng dụng — dựng từ DỮ LIỆU THẬT của Account (`session.apps`), không còn từ một bảng
   * khai trong repo. Tên và mô tả đã được Account chọn ngôn ngữ theo hồ sơ người dùng, nên KHÔNG
   * đi qua `messages/` nữa: dịch lại ở đây là dựng bản sao thứ hai của một danh mục do dữ liệu
   * quyết định, và bản sao sẽ thiếu đúng những sản phẩm mới thêm.
   *
   * ⚠ `entitled` của gói chỉ có HAI giá trị, còn Account trả về BA trạng thái. Ánh xạ ở đây là
   * `entitled = state === "unlocked"`, và sự khác nhau giữa hai trạng thái còn lại được giữ lại
   * cho `onUpsell` nói đúng câu — xem handler bên dưới. Gộp chúng ngay tại đây là vứt mất thông
   * tin duy nhất phân biệt "workspace chưa mua app" với "bạn chưa được cấp chỗ ngồi".
   */
  const apps = useMemo<AppDescriptor[]>(
    () =>
      appTiles.map((tile) => ({
        id: tile.key,
        name: tile.name,
        icon: appIconFor(tile.icon),
        href: tile.href,
        ...(tile.description ? { description: tile.description } : {}),
        /*
         * `tone` — MỘT tên tone, không còn ba biến CSS.
         *
         * `@comitor/ui` 1.10.0 vẽ ô icon bằng `IconAvatar` và KHÔNG đọc
         * `accent`/`accentInk`/`accentForeground` nữa. Bỏ trống thì màu TỰ SUY theo `id` (= khoá
         * app), nên một sản phẩm mới có màu ngay mà không ai phải gán tay.
         *
         * ⚠ Hạt giống là KHOÁ chứ không phải tên: tên đổi theo ngôn ngữ giao diện, và gói đo được
         * 4/6 app đổi màu khi chuyển vi ⇄ en nếu băm theo tên.
         */
        ...(tile.iconColor ? { tone: tile.iconColor } : {}),
        ...(tile.state === "unlocked" ? {} : { entitled: false })
      })),
    [appTiles]
  );

  /** Tra nhanh trạng thái thật của một ô — `onUpsell` chỉ nhận `appId`. */
  const tileStateById = useMemo(() => new Map(appTiles.map((tile) => [tile.key, tile])), [appTiles]);

  const errorMessage = useErrorMessage();
  const roleLabelOf = (value: WorkspaceRoleId) => tRoles(`${value}.label` as Parameters<typeof tRoles>[0]);
  const roleLabel = roleLabelOf(role);

  /*
   * Danh sách THẬT từ phiên — `AccountSession.workspaces`, đọc sẵn từ ngữ cảnh Account mà
   * `requireWorkspaceAccess()` dù sao cũng đã lấy. Bản trước dựng TAY một mảng một phần tử, nên
   * bộ đổi workspace chỉ có đúng một dòng và không đổi được gì.
   */
  const workspaces: Workspace[] = allWorkspaces.map((entry) => ({
    id: entry.id,
    name: entry.name,
    slug: entry.slug,
    plan: entry.id === workspace.id ? workspace.plan : "",
    role: entry.id === workspace.id ? roleLabel : roleLabelOf(entry.role),
    /* Thiếu logo thì BỎ HẲN khoá — gói rơi về avatar chữ cái vuông của tên workspace. */
    ...(entry.logoUrl ? { logoUrl: entry.logoUrl } : {}),
    /*
     * `null` thì BỎ HẲN khoá, không truyền 0: `memberCount` của `@comitor/ui` là optional, nên
     * thiếu nó là menu không hiện dòng đó — còn `0` là menu nói "0 thành viên", một lời nói dối.
     * Account không trả con số này ở `/api/workspaces/me`; xem `lib/contracts/account.ts`.
     */
    ...(entry.id === workspace.id && workspace.memberCount !== null ? { memberCount: workspace.memberCount } : {})
  }));

  /* `avatarUrl` rỗng thì gói tự rơi về avatar chữ cái — không cần nhánh `if` ở đây. */
  const shellUser: ShellUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: roleLabel,
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {})
  };

  /**
   * Ba mục cuối trong menu không gian làm việc — tạo workspace, cài đặt workspace, mời thành viên
   * — cùng mục "mở Account" ở menu người dùng đều là việc của **Comitor.Account**, không phải của
   * một module nghiệp vụ.
   *
   * ── VÌ SAO NAY ĐI THẬT, CHỨ KHÔNG CÒN CHỈ NÓI RA ĐÍCH ────────────────────────────────────
   * Bản trước hiện một toast IN RA chuỗi URL để người dùng tự gõ lại, với lý do "một bản mẫu không
   * được tự ném người dùng sang một tên miền mà nó không dựng được". Lý do đó không còn đứng được,
   * vì hai điều đã đúng ngay tại repo này:
   *
   *   · `ACCOUNT_ORIGIN` KHÔNG phải một tên miền đoán bừa — `lib/env.ts` kiểm nó lúc khởi động
   *     (URL tuyệt đối, https ngoài loopback, không dấu `/` cuối), nên đây là địa chỉ đã cấu hình;
   *   · app **đã** đưa người dùng sang tên miền đó rồi, ở đường quan trọng hơn hẳn: đăng nhập
   *     (`/api/auth/sign-in`) và thoát khỏi mọi sản phẩm đều là điều hướng top-level sang Account.
   *
   * Và ranh giới Account/app khiến chuyện này thành BẮT BUỘC chứ không phải tiện nghi: module
   * KHÔNG BAO GIỜ ghi được một trường của Account (`assertSessionActor` ném 403 cho mọi actor không
   * phải phiên người dùng), nên mọi "cái này quản ở Account" vĩnh viễn là **ĐỌC + LIÊN KẾT**. Một
   * liên kết không đi đâu cả thì vế thứ hai không tồn tại, và người dùng bị bỏ lại giữa đường với
   * một chuỗi URL để chép tay.
   *
   * ── ⚠ `window.open` TRẦN, KHÔNG CÓ NHÁNH DỰ PHÒNG — VÌ `noreferrer` LÀM NÓ LUÔN TRẢ `null` ──
   * Tab mới là hành vi mong muốn: người dùng đang dở việc, và đi quản trị bên Account xong thì họ
   * muốn quay lại chỗ cũ. Bản trước làm điều đó bằng một dòng, với ý "bị chặn popup thì rơi về
   * điều hướng top-level":
   *
   *     if (!window.open(url, "_blank", "noreferrer")) window.location.assign(url);
   *
   * Nhánh dự phòng ấy chạy **MỌI LẦN**. Theo đặc tả HTML, `noreferrer` kéo theo `noopener`, và hễ
   * `noopener` bật thì `window.open` trả `null` — KHÔNG phải vì mở hỏng, mà vì tab mới cố ý không
   * được với ngược lại vào tab này, nên không có gì để trả về. Người dùng vì thế nhận CẢ HAI: một
   * tab mới, VÀ tab đang đứng bị kéo sang Account — tức mất đúng cái chỗ làm dở mà tab mới sinh ra
   * để giữ. Sửa đúng vì vậy là **xoá nhánh dự phòng**, không thay cơ chế: lời gọi `window.open`
   * vốn vẫn làm đúng việc của nó.
   *
   * ⚠ Bản trước ghi *"đo được ngay trong repo này: lời gọi trả về `null` và không có gì xảy ra
   * cả"*. Vế ĐO được (`null`) đúng; vế GIẢI THÍCH (bị chặn) sai — và phép đo ấy không phân biệt
   * được hai nguyên nhân, vì nó chạy trong khung xem thử của công cụ phát triển, nơi `window.open`
   * bị chặn thật và bị chặn ở CẢ BA dạng (trần / `noopener` / `noreferrer`). Đã đo lại trong chính
   * khung ấy: cả ba đều trả `null` kể cả khi có `navigator.userActivation.isActive === true`. Trên
   * trình duyệt thật, dạng `noreferrer` MỞ ĐƯỢC tab mà vẫn trả `null` — đó là ca mà phép đo cũ
   * không với tới, và là ca người dùng gặp.
   *
   * ⚠ **Đừng thay bằng thẻ `<a target="_blank">` dựng bằng mã. ĐÃ THỬ, VÀ NÓ MỞ NGAY TẠI TAB CŨ.**
   * Cách ấy nghe hợp lý — không có giá trị trả về để đọc nhầm, và ba đường sang Account khác trong
   * repo (`sign-in-failed`, `components/access-denied.tsx`, dải liên kết ở `/settings/permissions`)
   * đều là thẻ `<a>`. Nhưng ba chỗ đó là thẻ THẬT nằm sẵn trong JSX, còn ở đây `AppShell` chỉ nhận
   * CALLBACK nên thẻ phải dựng rồi gỡ bằng mã — và điều hướng của thẻ `a` là một TÁC VỤ ĐƯỢC XẾP
   * HÀNG, chạy SAU lượt chạy hiện tại. Tới lúc nó chạy thì thẻ đã bị `remove()`, không còn trong
   * tài liệu, nên `target="_blank"` không còn hiệu lực và trình duyệt đi ngay tại chỗ. Đo được ở
   * cả trình duyệt thật lẫn khung xem thử: đúng MỘT lần điều hướng, nhưng ở TAB ĐANG ĐỨNG — hết
   * lỗi cũ, và sinh một lỗi mới cũng tệ ngang thế.
   *
   * `noreferrer` giữ nguyên hai tác dụng: không rò `Referer` chứa đường dẫn nội bộ sang tên miền
   * khác, và ngắt `window.opener` để tab mới không với ngược lại được vào tab này.
   *
   * ⚠ Cái giá còn lại, có ý thức: ngữ cảnh nào chặn `window.open` thật (khung xem thử của công cụ
   * phát triển là một, đã đo) thì bốn mục này **không làm gì cả**. Không có cách nào phát hiện ca
   * đó từ trong mã — giá trị trả về đã bị `noreferrer` chiếm mất — nên mọi "dự phòng" đều là đoán,
   * và bản trước cho thấy đoán sai thì đắt hơn không đoán.
   *
   * ⚠ Không còn tham số `label`. Nó chỉ tồn tại để làm tiêu đề cho cái toast, và ba chuỗi nuôi nó
   * (`shell.createWorkspace` / `workspaceSettings` / `inviteMembers`) là **bản sao thứ hai** của
   * chính ba nhãn mà `AppShell` đã tự vẽ trong menu — `lib/i18n/ui-labels.tsx` đang phủ đúng ba
   * khoá ấy. Hai bộ chuỗi cho cùng ba mục thì sớm muộn gọi chúng bằng hai cái tên khác nhau, nên
   * chúng đã được xoá khỏi `messages/` cùng lúc với tham số này.
   */
  const goToAccount = (url: string) => {
    window.open(url, "_blank", "noreferrer");
  };

  /**
   * Thoát khỏi MỌI sản phẩm Comitor — chuyển tiếp sang `end_session` của Account.
   *
   * ⚠ Một `<form>` dựng tại chỗ rồi submit, KHÔNG phải `fetch`. Route trả **307 sang tên miền của
   * Account**, và một `fetch` không đi được đường đó: `redirect: "manual"` thì phản hồi là
   * `opaqueredirect` nên không đọc được `Location` để tự điều hướng, còn `redirect: "follow"` thì
   * bước tiếp theo thành request CORS tới Account — và kể cả nếu nó qua được, người dùng vẫn ngồi
   * yên tại chỗ vì `fetch` không điều hướng trình duyệt. Chỉ một ĐIỀU HƯỚNG TOP-LEVEL mới đi hết
   * được chuỗi chuyển hướng và thả người dùng ở đúng nơi Account trả họ về.
   *
   * ⚠ Và vẫn phải là `POST`: đó là thứ duy nhất ngăn một liên kết trong tin nhắn đăng xuất người
   * dùng khỏi mọi sản phẩm — `sameSite=lax` KHÔNG chặn ca đó. Form này do chính trang tạo ra sau
   * một cú bấm của người dùng nên nó không phải là bề mặt CSRF; xem `app/api/auth/sign-out/route.ts`.
   */
  const signOutEverywhere = () => {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/api/auth/sign-out?everywhere=1";
    document.body.append(form);
    form.submit();
  };

  const handleAppSelect = (app: AppDescriptor) => {
    // App hiện tại nằm ngay trong module này → điều hướng thật.
    if (app.id === CURRENT_APP_ID) {
      router.push(app.href);
      return;
    }
    toast(t("otherAppTitle", { name: app.name }), {
      variant: "info",
      description: t("otherAppDescription")
    });
  };

  return (
    <>
      {/*
        SKIP LINK — WCAG 2.4.1, mức A.

        ⚠ Một khung app có thanh bên thì mọi trang trong đó bắt người dùng bàn phím Tab qua toàn bộ
        điều hướng trước khi chạm nội dung. Giải MỘT LẦN ở khung là mọi module thừa hưởng; không
        giải thì mọi module thừa hưởng cùng một lỗi mức A và cùng trượt một lần audit.

        ⚠ `sr-only focus:not-sr-only` — nó VÔ HÌNH cho tới khi nhận focus, nên nó không tốn một
        pixel nào của thiết kế. Đó là lý do khuôn này dùng được ở mọi app mà không phải bàn lại.

        Đích đến đúng về lâu dài là sửa ở GÓI (`AppShell` tự render nó, nhãn qua `ShellLabels`) —
        nhưng app không bị kẹt chờ: file này sở hữu cả `children` lẫn cây bao ngoài.
      */}
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        {t("skipToContent")}
      </a>

      <AppShell
        workspaces={workspaces}
        currentWorkspaceId={workspace.id}
        apps={apps}
        currentAppId={CURRENT_APP_ID}
        nav={nav}
        user={shellUser}
        /**
         * Nhãn của CHÍNH GÓI, theo ngôn ngữ đang xem. `vi` trả `undefined` = dùng mặc định của gói
         * — chép lại nguyên bộ chuỗi tiếng Việt vào app là dựng một bản sao thứ hai sẽ lệch ngay
         * lần gói sửa chữ. Xem `lib/i18n/ui-labels.tsx`.
         */
        labels={SHELL_LABELS[locale]}
        onWorkspaceChange={(workspaceId) => {
          const target = allWorkspaces.find((entry) => entry.id === workspaceId);
          if (!target || target.id === workspace.id) return;

          void switchWorkspace(target.slug)
            .then(() => {
              /*
               * ⚠ TẢI LẠI CẢ TRANG, không `router.refresh()`. Đổi workspace là đổi MỌI dữ liệu
               * trên màn hình — kể cả những thứ layout đã đọc (thông báo, số việc mở, tập quyền).
               * `refresh()` dựng lại cây server nhưng GIỮ state của các đảo client, và một bộ lọc
               * còn sót của workspace cũ là một màn hình nói sai.
               */
              window.location.assign("/");
            })
            .catch((error: unknown) => {
              const like =
                error && typeof error === "object" && "code" in error
                  ? (error as { code?: string; status?: number })
                  : null;
              toast(errorMessage(like), { variant: "destructive" });
            });
        }}
        onCreateWorkspace={() => goToAccount(accountCreateWorkspaceUrl)}
        onWorkspaceSettings={() => goToAccount(accountWorkspaceUrl(workspace.slug, "settings"))}
        onInviteMembers={() => goToAccount(accountWorkspaceUrl(workspace.slug, "members"))}
        onAppSelect={handleAppSelect}
        /*
         * App chưa mở khoá trong gói của workspace: `AppLauncher` hiện ổ khoá và gọi đường này thay
         * vì điều hướng. App thật đưa người dùng tới trang nâng cấp gói bên Account.
         */
        /*
         * ⚠ HAI câu, không một. `onUpsell` được gọi cho cả `locked` lẫn `no-seat`, và hai trạng
         * thái ấy dẫn tới hai việc khác nhau: một cái cần quản trị viên BẬT app cho workspace,
         * cái kia cần họ CẤP một chỗ ngồi — thứ mất mười giây. Một câu chung ("workspace chưa có
         * ứng dụng này") là nói sai với nhóm thứ hai, và bỏ họ lại không biết hỏi ai.
         */
        onUpsell={(appId) => {
          const tile = tileStateById.get(appId);
          const name = tile?.name ?? appId;
          /* Khoá dịch phải là HẰNG ở mỗi nhánh: `t()` không nhận một union khoá khi khoá có tham số ICU. */
          if (tile?.state === "no-seat") {
            toast(t("noSeatTitle", { name }), { variant: "warning", description: t("noSeatDescription") });
            return;
          }
          toast(t("upsellTitle", { name }), { variant: "warning", description: t("upsellDescription") });
        }}
        /*
         * ⚠ `POST`, không phải điều hướng — xem lý do ở `app/api/auth/sign-out/route.ts`. Tóm tắt:
         * với `GET`, một liên kết trong tin nhắn đủ để đăng xuất người dùng khỏi mọi sản phẩm
         * Comitor, và `sameSite=lax` không chặn được vì nó CÓ gửi cookie cho điều hướng top-level.
         *
         * `redirect: "manual"` để `fetch` không tự đi theo 307 sang Account; điều hướng THẬT do
         * `window.location` làm — router phía client sẽ cố lấy payload RSC của một route handler
         * và đi một vòng thừa.
         */
        onLogout={() => {
          void fetch("/api/auth/sign-out", { method: "POST", redirect: "manual" }).finally(() => {
            window.location.assign("/signed-out");
          });
        }}
        headerProps={{
          /*
           * Chuông + bảng thông báo do module tự dựng: gói cố ý chỉ xuất ra cái NÚT, vì nội dung
           * thông báo là app-specific. Truyền qua `notificationsSlot` thì `notificationCount` bị bỏ
           * qua — số chưa đọc là của chính slot, đếm từ dữ liệu nó nhận.
           */
          notificationsSlot: <NotificationsSlot notifications={notifications} />,
          userMenuProps: {
            // `showName` KHÔNG tự ẩn theo bề rộng: bật lên thì ở 375px header tràn và tên bị cắt cụt.
            showName: false,
            /*
             * ⚠ "Thoát khỏi mọi sản phẩm" PHẢI đứng ở đây, nơi phiên CÒN SỐNG — và đó là cả lý do
             * mục này tồn tại.
             *
             * Đăng xuất toàn hệ là RP-initiated logout: nó cần `id_token_hint`, mà `id_token` nằm
             * trong hàng phiên. Bản trước chỉ chào mời nó ở `/signed-out` — tức SAU khi
             * `/api/auth/sign-out` đã `closeSession()` và `clearSessionCookie()`. Tới lúc đó
             * `readSessionCookie()` trả `null`, nhánh `everywhere` trong route không vào được, và
             * nút chuyển hướng về ĐÚNG trang vừa đứng. Đo được 2026-09-03:
             * `POST /api/auth/sign-out?everywhere=1` không cookie → `307 → /signed-out`. Người dùng
             * bấm, trang tải lại, phiên ở Account còn nguyên, và KHÔNG có gì báo.
             *
             * Route thì viết đúng — nó chạy thật khi còn phiên. Chỗ sai là lối vào duy nhất.
             */
            items: [
              {
                id: "sign-out-everywhere",
                label: t("signOutEverywhere"),
                icon: LogOut,
                variant: "destructive",
                onSelect: signOutEverywhere
              }
            ],
            /*
             * KHÔNG khai `profileHref`: hồ sơ cá nhân thuộc Comitor.Account (một danh tính dùng
             * chung cho cả hệ sinh thái), module nghiệp vụ không dựng lại nó. Gói chỉ render mục
             * nào app cấp href, nên bỏ khoá này là mục "Hồ sơ" tự biến mất — đúng ý.
             *
             * Luật kiểm được: chỉ khai một `*Href` khi đích của nó có mặt trong
             * `lib/catalog/navigation.ts`. Đường sang Account là URL TUYỆT ĐỐI của một sản phẩm
             * khác nên nó không nằm ở đó, và mục này sẽ điều hướng ĐÈ LÊN tab hiện tại chứ không mở
             * tab mới — vì vậy đường vào Account đi qua bảng lệnh ⌘K và menu không gian làm việc,
             * hai chỗ module kiểm soát được hành vi.
             */
            settingsHref: "/settings"
          }
        }}
        /*
         * Bảng lệnh ⌘K: `AppShell` giữ state mở/đóng và header vẽ sẵn ô tìm kiếm gọi vào state đó,
         * nhưng NỘI DUNG là của app nên gói chỉ chừa slot này. Bỏ trống slot = ô tìm kiếm và phím
         * ⌘K trên header thành control chết.
         *
         * Element được tạo ở đây nhưng RENDER bên trong `ShellProvider`, nên `useShell()` trong
         * `<CommandPaletteSlot>` vẫn đọc được context của shell.
         */
        commandPaletteSlot={
          <CommandPaletteSlot
            tasks={commandTasks}
            onOpenAccount={() => goToAccount(accountWorkspaceUrl(workspace.slug))}
          />
        }
        sidebarProps={{
          footer: (
            <div className="flex items-center justify-between gap-2 px-1">
              <ComitorLockup variant="auto" size="xs" slogan={t("slogan")} />
              {/* Phiên bản khai đúng MỘT chỗ — `version` trong `package.json`, tiêm vào lúc build
                  bằng `env` của `next.config.ts`. Chép tay ở đây thì `pnpm version` là lệch ngay. */}
              <span className="text-xs text-muted-foreground tabular-nums">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
            </div>
          )
        }}
      >
        {/*
          ⚠ Đích của skip link. `tabIndex={-1}` để `#main` nhận được focus khi nhảy tới — không có
          nó thì trình duyệt cuộn tới đây nhưng focus vẫn ở link, và lần Tab kế tiếp quay về thanh
          bên: người dùng bàn phím đi vòng mãi mà không vào được nội dung.
        */}
        <div id="main" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </AppShell>

      {/*
       * Vùng toast đặt MỘT LẦN cho cả app, và đặt NGOÀI `AppShell`: khung của shell là
       * `h-dvh overflow-hidden`, để bên trong là tự chuốc rủi ro bị cắt.
       */}
      <SonnerToaster />
    </>
  );
}
