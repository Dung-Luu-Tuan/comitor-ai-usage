import "server-only";
import { AccountError, type AccountTokens, requireWorkspaceAccess } from "@comitor/account-sdk";
import { headers } from "next/headers";
import { cache } from "react";
import { accountConfig, accountConfigured } from "@/lib/account/config";
import { readSessionCookie } from "@/lib/account/session-cookie";
import { freshTokens, readSession } from "@/lib/account/session-store";
import type { AccountSession, AppTile, AppTileState, WorkspaceRoleId } from "@/lib/contracts/account";
import { ApiError, ERROR_CODES } from "@/lib/core/api-error";
import { PATHNAME_HEADER, toSafeInternalPath } from "@/lib/core/return-path";
import { isTimeZone } from "@/lib/core/time-zone";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/config";

/**
 * Phiên của request hiện tại — **cửa DUY NHẤT** mà mọi trang, route handler và Server Action đi qua.
 *
 * Bản trước của file này trả về một phiên GIẢ cố định vì `@comitor/account-sdk` chưa publish. Nay
 * nó gọi Comitor.Account thật, và **không file nào khác phải sửa** — đó chính là thứ mà việc gom
 * mọi chỗ đọc phiên về một hàm đã mua được.
 *
 * ── BỐN VIỆC HÀM NÀY LÀM, THEO ĐÚNG THỨ TỰ ────────────────────────────────────────────────
 *   1. đọc định danh phiên từ cookie, rồi lấy bộ token ở **database** của module
 *      (`lib/account/session-cookie.ts` giữ cookie, `lib/account/session-store.ts` giữ hàng);
 *   2. XOAY token nếu hết hạn, và **ghi lại bộ mới** — Account bật rotation nên refresh token cũ
 *      mất hiệu lực NGAY; không lưu là lần sau người dùng bị đăng xuất không rõ lý do;
 *   3. hỏi Account "người này thuộc workspace nào, có bật app này chưa, có chỗ ngồi chưa";
 *   4. đổi hình dạng của SDK sang `AccountSession` — hợp đồng nội bộ ở `lib/contracts/account.ts`.
 *
 * Bước 4 không thừa: nó giữ cho phần còn lại của module không phụ thuộc vào hình dạng của SDK, nên
 * một bản SDK sau đổi tên trường thì chỉ file này đỏ.
 */

/**
 * ⚠ WORKSPACE ĐẾN TỪ ĐÂU — QUYẾT ĐỊNH CÓ ĐÁNH ĐỔI, ĐỌC TRƯỚC KHI SAO CHÉP.
 *
 * Comitor.Account cố ý **KHÔNG đặt workspace vào token** (quyết định D1): access token chỉ mang
 * `sub`, và app tự giữ ngữ cảnh workspace. Cách Account khuyến nghị là đặt nó vào **URL**
 * (`/w/{slug}/…`), vì chỉ có URL mới cho phép mở hai workspace ở hai tab.
 *
 * Module này giữ nó trong **cookie phiên**, và đó là một đánh đổi có ý thức:
 *
 *   ✔ được: đường dẫn phẳng (`/tasks`), khớp bản đồ route đã công bố trong README, và không phải
 *     nhét `slug` vào mọi `<Link>`;
 *   ✘ mất: **hai tab = hai workspace là KHÔNG làm được** — đổi workspace ở tab này đổi luôn tab
 *     kia, vì cookie là của cả trình duyệt chứ không của một tab.
 *
 * Module nào cần hai tab hai workspace thì phải chuyển sang `/w/[slug]/…`. Việc đó chạm mọi route
 * và mọi liên kết, nên hãy quyết định NGAY TỪ ĐẦU, đừng để tới lúc có khách hàng thật hỏi.
 *
 * ── NỬA THỨ HAI CỦA CÁI MẤT, VÀ NÓ LỚN HƠN NỬA TRÊN ──────────────────────────────────────
 * Workspace nằm trong phiên **RIÊNG của từng module**. Nghĩa là:
 *
 *   người dùng đổi sang "Công ty B" trong Tasks  →  bấm sang Chat  →  Chat vẫn mở "Công ty A"
 *
 * Không có gì báo, không có gì sai ở mã của bên nào, và người dùng thao tác nhầm không gian làm
 * việc. Với MỘT module thì đánh đổi ở trên là hợp lý; với NĂM module dùng chung một thanh app thì
 * nó là một lỗi sản phẩm.
 *
 * ── HỢP ĐỒNG CHO CẢ HỆ, CHỐT Ở ĐÂY VÌ KHÔNG SỬA ĐƯỢC SAU ────────────────────────────────
 * **Mọi liên kết chéo app mang `?w={slug}`**, và mọi module nhận `?w=` như một chỉ thị đổi
 * workspace một lần: kiểm slug có thuộc danh sách của chính người đó → ghi vào phiên → chuyển
 * hướng bỏ query (để nó không nằm lại trong lịch sử và trong nút chia sẻ).
 *
 * ⚠ Đây là thứ **không sửa được sau khi có năm module** — không vì kỹ thuật khó, mà vì phải đổi
 * năm repo CÙNG LÚC, và nếu không cùng lúc thì việc sửa vô nghĩa: một app gửi `?w=` cho một app
 * không đọc nó thì vẫn mở nhầm workspace.
 *
 * Hôm nay `lib/catalog/apps.ts` cho app anh em những URL **trần, không mang slug** — trong khi
 * `lib/account/links.ts` sang Account thì CÓ mang. Chỗ sửa: một hàm `appUrl(appId, slug, path?)`
 * ở `links.ts`, và không chỗ nào ghép chuỗi tay. Việc nhận `?w=` ở đầu này đi cùng bộ đổi
 * workspace (chưa dựng — `shell-frame.tsx` hiện dựng tay một mảng một phần tử).
 *
 * ⚠ Nếu hệ quyết định NGƯỢC LẠI — mỗi app tự nhớ workspace của mình — thì **cũng phải ghi ra**,
 * vì hôm nay không ai đọc mã mà biết đó là cố ý hay là chưa làm.
 *
 * Chưa chọn thì lấy workspace ĐẦU TIÊN mà app này đã bật — không phải workspace đầu tiên trong
 * danh sách: một người thuộc năm workspace mà chỉ một cái bật Công việc thì cái đó mới là câu trả
 * lời đúng, và lấy nhầm sẽ đẩy họ vào màn "chưa bật ứng dụng" ngay lần mở đầu tiên.
 */
/**
 * Phiên, hoặc `null` khi chưa đăng nhập.
 *
 * `cache()` của React gộp mọi lời gọi trong CÙNG một request thành một. Với bản giả trước đây điều
 * đó chỉ là gọn; nay nó thật sự đáng tiền — mỗi lời gọi có thể là một vòng mạng sang Account, và
 * một trang hỏi phiên ở layout, ở page, rồi ở route handler.
 */
export const getSession = cache(async (): Promise<AccountSession | null> => {
  if (!accountConfigured) return null;

  const secret = await readSessionCookie();
  if (!secret) return null;

  const stored = await readSession(secret);
  if (!stored) return null;

  /*
   * Xoay token khi hết hạn. Phép ghi đi vào DATABASE, không vào cookie — và đó là toàn bộ lý do
   * `lib/account/session-store.ts` tồn tại.
   *
   * ⚠ Bản trước gọi `ensureFreshTokens` với một `onRotate` ghi cookie, và nó hỏng ở đúng dòng đó:
   * Next cấm ghi cookie giữa lúc render trang, mà hàm này chạy từ `page.tsx`. Account thì đã xoay
   * xong — tức refresh token cũ đã chết — nên phiên không cứu được nữa. Số liệu đo được và cả
   * chuỗi log ở đầu `session-store.ts`; đừng đưa một phép ghi cookie nào trở lại đường này.
   *
   * `freshTokens` khoá hàng phiên trong một transaction, nên hai request đồng thời — kể cả ở hai
   * instance khác nhau — chỉ có một cái gọi Account.
   */
  let tokens: AccountTokens;
  try {
    tokens = await freshTokens(secret, stored.tokens);
  } catch (error) {
    /*
     * Refresh token đã bị thu hồi hoặc hết hạn → coi như chưa đăng nhập, đừng làm trang trắng.
     *
     * ⚠ NHƯNG PHẢI LOG. Bản trước là `catch { return null }` trống trơn, và chính sự im lặng đó
     * che mất cuộc đua khi xoay token suốt một buổi: người dùng bị đá về đăng nhập, SSO đưa họ
     * quay lại trong dưới một giây, và không có một dòng nào ở đâu nói rằng vừa có chuyện gì.
     *
     * Chuỗi `[auth] KHÔNG XOAY ĐƯỢC TOKEN` viết hoa và cố định để còn grep/alert được.
     */
    console.warn("[auth] KHÔNG XOAY ĐƯỢC TOKEN", error instanceof Error ? error.message : error);
    return null;
  }

  const slug = stored.workspaceSlug ?? (await firstEntitledSlug(tokens.accessToken));
  if (!slug) {
    throw new AccountError(
      403,
      "NOT_A_MEMBER",
      "Tài khoản này chưa thuộc không gian làm việc nào có bật ứng dụng Công việc."
    );
  }

  /*
   * BỐN LỚP GUARD, và SDK ném BỐN mã khác nhau — `NOT_A_MEMBER`, `APP_NOT_ENABLED`,
   * `APP_SUSPENDED`, `NO_SEAT`. `app/(shell)/layout.tsx` bắt chúng và hiện bốn màn hình khác
   * nhau, vì bốn tình huống đó dẫn tới bốn hành động khác nhau của người dùng. Gộp thành "bạn
   * không có quyền" là bắt họ tự đoán phải đi hỏi ai.
   *
   * ⚠ Bắt ở đây chỉ để GẮN TÊN workspace vào lỗi, rồi ném lại NGUYÊN mã. Ba trong bốn câu của màn
   * chặn có tham số `{workspace}`, và `AccountError` của SDK không mang tên ở dạng đọc được —
   * không gắn thì câu hiện ra thiếu chủ ngữ ("… đã bật ứng dụng Công việc"), một lỗi chỉ lộ ra khi
   * đi thật vào đúng nhánh đó.
   */
  let context: Awaited<ReturnType<typeof requireWorkspaceAccess>>;
  try {
    context = await withAccountTimeout(
      "requireWorkspaceAccess",
      requireWorkspaceAccess(accountConfig, tokens.accessToken, slug)
    );
  } catch (error) {
    throw await withWorkspaceName(error, tokens.accessToken, slug);
  }

  return {
    /* `image` của SDK → `avatarUrl` của module: một tên duy nhất cho cả `ShellUser.avatarUrl` và
       `AvatarGroupItem.src` của gói. Chuỗi rỗng thành `null` — xem `lib/account/directory.ts`. */
    user: {
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
      avatarUrl: context.user.image?.trim() ? context.user.image : null,
      /*
       * ⚠ HAI TRƯỜNG NÀY VỐN ĐÃ NẰM TRÊN ĐƯỜNG DÂY, VÀ BẢN TRƯỚC VỨT CHÚNG ĐI.
       *
       * `AccountUser` của SDK khai sẵn `locale` và `timezone` từ 0.1.1, và `requireWorkspaceAccess()`
       * dù sao cũng đã lấy trọn `GET /api/workspaces/me` về để tìm workspace đang mở. Nên nhặt
       * chúng lên **không tốn thêm một vòng mạng nào** — trong khi bản trước để module tự nuôi một
       * cookie ngôn ngữ song song và một hằng múi giờ, tức đúng cái "hai cửa vào cùng một dữ liệu"
       * mà ranh giới Account/app dựng ra để tránh.
       *
       * ── ⚠ HAI TRƯỜNG, HAI CÁCH XỬ LÝ KHÁC NHAU — VÀ SỰ KHÁC NHAU ẤY LÀ CÓ LÝ DO ─────────
       *
       * `timezone` được **CHUẨN HOÁ NGAY TẠI ĐÂY**; `locale` thì truyền THÔ. Không phải thiếu nhất
       * quán:
       *
       *   · `timezone` đi thẳng vào `Intl.DateTimeFormat` ở `todayIso()`, nơi một chuỗi lạ **NÉM
       *     `RangeError`** và làm trắng cả trang. Và giá trị ấy KHÔNG đáng tin: Account khai cột
       *     này là `input: true` **không kèm phép kiểm nào** (`lib/auth.ts`, `additionalFields`),
       *     nên `POST /api/auth/update-user` nhận bất kỳ chuỗi gì người dùng gửi. Một hồ sơ mang
       *     `timezone: "abc"` sẽ làm chết mọi trang công việc của MỌI module đọc nó. Chặn ở biên —
       *     chỗ giá trị ngoài lần đầu đi vào module — là chỗ duy nhất chặn được đúng một lần.
       *
       *   · `locale` thì KHÔNG được rơi về mặc định ở đây, vì "Account nói một ngôn ngữ module này
       *     chưa dịch" và "người dùng chọn tiếng Việt" là HAI CHUYỆN KHÁC NHAU. Chuẩn hoá `"fr"`
       *     thành `"vi"` ngay đây là biến câu thứ nhất thành câu thứ hai, và hậu quả là gieo tiếng
       *     Việt đè lên một trình duyệt đang xin tiếng Anh. Để thô thì `isLocale()` ở
       *     `lib/i18n/adopt.ts` từ chối gieo, và `Accept-Language` thắng — đúng như mong muốn.
       *
       * Nói gọn: rơi về mặc định khi giá trị sai là ĐÚNG cho một thứ luôn phải có; KHÔNG gieo gì cả
       * là đúng cho một thứ có đường dự phòng tốt hơn ở phía sau.
       */
      locale: context.user.locale,
      timezone: isTimeZone(context.user.timezone) ? context.user.timezone : DEFAULT_TIME_ZONE,
      /*
       * ⚠ `?? null` GỘP HAI TRẠNG THÁI, và việc gộp là đúng ở đây.
       *
       * SDK khai bốn trường này optional: `undefined` nghĩa là **bản Account đang chạy không gửi
       * chúng** (SDK mới hơn máy chủ), còn `null` nghĩa là **người dùng chưa từng chọn**. Hai
       * chuyện khác nhau về NGUYÊN NHÂN nhưng dẫn tới cùng một hành động — đừng gieo gì cho trục
       * đó — nên phần còn lại của module chỉ cần một trạng thái, và giữ cả hai chỉ tạo ra một nhánh
       * mà không ai biết phải xử lý khác đi thế nào.
       *
       * KHÔNG kiểm giá trị ở đây: chỗ kiểm là `lib/core/display-prefs.ts`, ngay trước khi chuỗi đi
       * vào một `<script>` mang nonce. Kiểm hai chỗ là hai luật sẽ lệch — và luật ở chỗ kia mới là
       * luật có hậu quả bảo mật.
       */
      displayPrefs: {
        theme: context.user.theme ?? null,
        contrast: context.user.contrast ?? null,
        density: context.user.density ?? null,
        fontSize: context.user.fontSize ?? null
      }
    },
    workspace: {
      id: context.workspace.id,
      name: context.workspace.name,
      slug: context.workspace.slug,
      /*
       * `plan` đến từ QUYỀN DÙNG APP, không phải từ workspace: một workspace có thể dùng Công việc
       * gói Pro và CRM gói Free cùng lúc. Lấy nhầm chỗ là hiện sai gói ở menu.
       */
      plan: context.app?.plan ?? "",
      // Account không trả con số này ở `/api/workspaces/me` — xem `lib/contracts/account.ts`.
      memberCount: null,
      /* `logo` của SDK → `logoUrl`, khớp tên với `Workspace.logoUrl` của gói. */
      logoUrl: context.workspace.logo?.trim() ? context.workspace.logo : null
    },
    role: context.workspace.role as WorkspaceRoleId,
    /*
     * Hai phép đọc SONG SONG: chúng không phụ thuộc nhau, và cả hai đều rẻ — `getAccountContext`
     * vừa được `requireWorkspaceAccess()` gọi xong nên nó về từ cache 30 giây của SDK, còn danh
     * mục có cache riêng 300 giây.
     */
    ...(await (async () => {
      const [workspaces, apps] = await Promise.all([
        listWorkspaces(tokens.accessToken),
        listAppTiles(tokens.accessToken, context.workspace.slug, context.workspace.apps)
      ]);
      return { workspaces, apps };
    })())
  };
});

/**
 * Bệ phóng ứng dụng — ghép DANH MỤC toàn hệ với QUYỀN DÙNG của workspace đang xem.
 *
 * ── VÌ SAO CẦN CẢ HAI NGUỒN ──────────────────────────────────────────────────────────────
 * `workspace.apps` chỉ chứa app workspace ĐÃ BẬT. Dựng bệ phóng chỉ từ nó thì người dùng không
 * bao giờ biết Comitor còn có sản phẩm gì — và mất luôn đường nâng cấp gói, thứ duy nhất biến dải
 * này từ một danh sách thành một lối đi. Danh mục (`listAppCatalogue`) bù đúng phần đó.
 *
 * ⚠ **Đây là chỗ thay cho bảng ghi cứng cũ.** `lib/catalog/apps.ts` từng khai tay danh sách app,
 * URL (đoán theo khuôn `https://{key}.comitor.ai`) và cờ mở khoá (`DEV_LOCKED_APP_IDS`). Cả ba là
 * câu trả lời của Account. Cái giá của việc ghi cứng đã hiện ra hai lần trong chính JSDoc của file
 * đó: hệ thêm sản phẩm thì năm module phải sửa tay, và bản dev ném người dùng sang PRODUCTION của
 * app anh em, mang theo phiên của họ, không có gì báo.
 *
 * Nuốt lỗi và trả MẢNG RỖNG: Account chập chờn thì bệ phóng thu lại (`shell-frame.tsx` rơi về một
 * ô cho app hiện tại), chứ không làm trắng cả khung app vì một dải điều hướng phụ. Cùng luật
 * fail-open với `listWorkspaces()` ngay dưới, và cùng lý do.
 */
async function listAppTiles(
  accessToken: string,
  slug: string,
  enabled: Awaited<ReturnType<typeof requireWorkspaceAccess>>["workspace"]["apps"]
): Promise<AppTile[]> {
  try {
    const { appUrlFor, listAppCatalogue } = await import("@comitor/account-sdk");
    const catalogue = await listAppCatalogue(accountConfig, accessToken);
    const enabledByKey = new Map(enabled.map((app) => [app.key, app]));

    return catalogue.map((entry): AppTile => {
      const active = enabledByKey.get(entry.key);
      /*
       * BA trạng thái, giữ nguyên ba — xem `AppTile` ở `lib/contracts/account.ts`. Gộp `no-seat`
       * vào `locked` là bảo một người "workspace chưa mua app này" trong khi thứ họ thiếu là một
       * chỗ ngồi mà quản trị viên cấp trong mười giây.
       */
      const state: AppTileState = !active ? "locked" : active.hasSeat ? "unlocked" : "no-seat";
      return {
        key: entry.key,
        name: entry.name,
        description: entry.description,
        icon: entry.icon,
        iconColor: entry.iconColor,
        /*
         * App ĐANG mở dùng đường dẫn NỘI BỘ. Đi vòng qua `{baseUrl}/w/{slug}` là một chuyến đi
         * mạng đầy đủ để quay lại chính trang này — và ở máy phát triển thì `baseUrl` trỏ ra bản
         * đã deploy, tức bấm vào ô "Bản mẫu" là rời khỏi localhost.
         */
        href: entry.key === accountConfig.appKey ? "/" : appUrlFor(entry, slug),
        state,
        plan: active?.plan ?? null
      };
    });
  } catch (error) {
    console.warn("[auth] không đọc được danh mục ứng dụng:", error);
    return [];
  }
}

/**
 * Mọi không gian làm việc của người đang đăng nhập.
 *
 * ── VÌ SAO ĐỌC LẠI NGỮ CẢNH Ở ĐÂY LÀ RẺ ─────────────────────────────────────────────────
 * `getAccountContext` có cache 30 giây trong SDK, và `requireWorkspaceAccess()` vừa gọi nó xong ở
 * ngay trên — nên đây là một lần đọc từ bộ nhớ, không phải một vòng mạng nữa.
 *
 * ⚠ `requireWorkspaceAccess()` chỉ trả về MỘT workspace (`WorkspaceContext.workspace`), nên danh
 * sách đầy đủ phải lấy từ `AccountContext`. Trước hàm này, `shell-frame.tsx` dựng TAY một mảng một
 * phần tử — nên bộ đổi workspace chỉ có một dòng, và `onWorkspaceChange` hiện một toast "thành
 * công" cho một việc không xảy ra. Dữ liệu vẫn nằm sẵn trong tay, chỉ là bị vứt đi.
 *
 * Nuốt lỗi: không đọc được danh sách thì bộ đổi chỉ hiện workspace đang mở — xấu, chấp nhận được,
 * và chắc chắn tốt hơn một trang trắng.
 */
async function listWorkspaces(accessToken: string): Promise<AccountSession["workspaces"]> {
  try {
    const { getAccountContext } = await import("@comitor/account-sdk");
    const context = await getAccountContext(accountConfig, accessToken);
    return context.workspaces.map((entry) => ({
      id: entry.id,
      name: entry.name,
      slug: entry.slug,
      role: entry.role as WorkspaceRoleId,
      logoUrl: entry.logo?.trim() ? entry.logo : null,
      hasThisApp: (entry.apps ?? []).some((app) => app.key === accountConfig.appKey)
    }));
  } catch (error) {
    console.warn("[auth] không đọc được danh sách workspace:", error);
    return [];
  }
}

/**
 * Tên workspace, dùng cho câu chữ của màn chặn — `null` khi không tra được.
 *
 * Đọc lại ngữ cảnh là RẺ ở đây: `getAccountContext` có cache 30 giây và `requireWorkspaceAccess`
 * vừa gọi nó xong, nên đây là một lần đọc từ bộ nhớ chứ không phải một vòng mạng nữa.
 *
 * Nuốt lỗi: đây là đường ĐANG XỬ LÝ MỘT LỖI. Một lỗi thứ hai ở đây sẽ che mất lỗi gốc và để người
 * dùng nhận một trang trắng thay vì màn hình giải thích.
 */
async function withWorkspaceName(error: unknown, accessToken: string, slug: string): Promise<unknown> {
  if (!(error instanceof AccountError)) return error;
  try {
    const { getAccountContext } = await import("@comitor/account-sdk");
    const context = await getAccountContext(accountConfig, accessToken);
    const name = context.workspaces.find((workspace) => workspace.slug === slug)?.name;
    if (name) (error as AccountError & { workspaceName?: string }).workspaceName = name;
    /*
     * ⚠ Gắn CẢ `slug`, không chỉ tên. `components/access-denied.tsx` có một nhánh dựng liên kết
     * thẳng tới đúng trang cần đến ở Account (`/w/{slug}/apps`) — và nhánh đó là MÃ CHẾT cho tới
     * commit này, vì không chỗ nào truyền `workspaceSlug` xuống. Hậu quả: ba trong bốn màn chặn
     * đổ người dùng về danh sách workspace chung, bắt họ tự tìm lại chỗ vừa bị từ chối.
     *
     * `slug` LUÔN biết được ở đây — nó là tham số của chính hàm này.
     */
    (error as AccountError & { workspaceSlug?: string }).workspaceSlug = slug;
  } catch {
    // Không tra được tên thì màn chặn vẫn hiện, chỉ thiếu một cái tên.
  }
  return error;
}

/** Workspace đầu tiên mà app này đã bật VÀ người dùng có chỗ ngồi. Xem ghi chú ở đầu file. */
async function firstEntitledSlug(accessToken: string): Promise<string | null> {
  const { getAccountContext } = await import("@comitor/account-sdk");
  const context = await getAccountContext(accountConfig, accessToken);

  const entitled = context.workspaces.find((workspace) =>
    workspace.apps.some((app) => app.key === accountConfig.appKey && app.hasSeat)
  );
  // Không có chỗ ngồi ở đâu cả thì vẫn trả về workspace có app — để guard nói đúng "chưa có chỗ
  // ngồi" thay vì "không thuộc workspace nào".
  const enabled = context.workspaces.find((workspace) =>
    workspace.apps.some((app) => app.key === accountConfig.appKey)
  );
  return entitled?.slug ?? enabled?.slug ?? context.workspaces[0]?.slug ?? null;
}

/**
 * Phiên, hoặc CHUYỂN HƯỚNG sang màn đăng nhập — **kèm theo đích đang mở**.
 *
 * ⚠ `redirect()` của Next hoạt động bằng cách NÉM một lỗi đặc biệt, nên đừng bọc lời gọi này trong
 * `try/catch` bắt mọi thứ — làm vậy là nuốt luôn lệnh chuyển hướng và trang sẽ render tiếp với một
 * phiên `undefined`.
 *
 * ── VÌ SAO PHẢI ĐÍNH `?next=` ────────────────────────────────────────────────────────────
 * Phiên rơi giữa chừng là chuyện BÌNH THƯỜNG, không phải sự cố: access token sống 15 phút, và một
 * người mở tab rồi đi pha cà phê sẽ quay lại đúng vào lúc nó vừa hết hạn. Không giữ đích thì mỗi
 * lần như vậy họ bị ném về `/` — mất chỗ đang đứng, mất bộ lọc đang đặt, và không hiểu vì sao.
 * Đo được 2026-09-01: mở `/tasks`, kết thúc ở `/`.
 *
 * Đường dẫn đến từ header do `proxy.ts` đặt, và đi qua `toSafeInternalPath` TRƯỚC khi được dùng.
 * Phép lọc đó không phải thủ tục: một `?next=` không kiểm là một **open redirect**, tức tên miền
 * của chính mình đứng ra bảo lãnh cho một trang lừa đảo. Xem `lib/core/return-path.ts`.
 */
export async function requireSession(): Promise<AccountSession> {
  const session = await getSession();
  if (session) return session;

  const next = toSafeInternalPath((await headers()).get(PATHNAME_HEADER));
  /*
   * Route handler KHÔNG có header này (`proxy.ts` bỏ qua `/api/**`), nên `next` là `null` và
   * đường dẫn về đúng dạng cũ. Đó là hành vi đúng: một `POST /api/tasks` không phải chỗ để quay
   * lại sau khi đăng nhập.
   */
  /*
   * ⚠ `import()` ĐỘNG. `next/navigation` kéo theo runtime client của React, và một import tĩnh ở
   * đây làm CẢ file này không nạp được bằng `tsx` — kéo theo `getSession()` và
   * `requireApiSession()`, hai hàm mà một job nền hay một script bảo trì hoàn toàn có thể cần.
   * Hoãn lại thì chỉ `requireSession()` (hàm của rìa A) mới cần Next, và điều đó đúng.
   * `pnpm lint` canh luật này — xem `biome.json`, override `lib/**`.
   */
  // biome-ignore lint/style/noRestrictedImports: import() ĐỘNG là CÁCH CHỮA mà luật này chỉ tới, không phải vi phạm — nó giữ file nạp được bằng tsx.
  const { redirect } = await import("next/navigation");
  redirect(next ? `/api/auth/sign-in?next=${encodeURIComponent(next)}` : "/api/auth/sign-in");

  /*
   * Không bao giờ tới đây: `redirect()` NÉM. Nhưng qua `import()` động, TypeScript mất kiểu `never`
   * của nó và đòi một đường trả về — nên dòng này là thứ giữ `tsc` yên, và nó cũng là dòng sẽ nổ
   * ầm ĩ nếu một bản Next sau đổi `redirect()` thành không-ném.
   */
  throw new Error("redirect() did not throw");
}

/**
 * Bốn mã guard của SDK — cùng danh sách mà `app/(shell)/layout.tsx` dùng cho rìa A.
 *
 * ⚠ Viết TƯỜNG MINH, không phải `error instanceof AccountError` chung chung: SDK còn ném
 * `AccountError` cho mạng hỏng và token không verify được, và những thứ đó là 500 chứ không phải
 * "bạn không có quyền vào không gian làm việc này".
 */
/**
 * Trần thời gian cho một lời gọi sang Comitor.Account.
 *
 * ── VÌ SAO CON SỐ NÀY QUAN TRỌNG HƠN VẺ NGOÀI ────────────────────────────────────────────
 * `getSession()` gọi Account ở **mọi request**, và `fetch` của Node **không có timeout tổng**.
 * Account chết hẳn thì lỗi tới nhanh (kết nối bị từ chối). Account **CHẬM** mới là ca nguy hiểm:
 * mỗi request giữ một kết nối và một lượt render, và `freshTokens` còn giữ thêm một kết nối
 * database trong lúc chờ mạng. Với năm module cùng phụ thuộc một Account, đó là single point of
 * failure duy nhất của cả hệ.
 *
 * 5 giây: đủ rộng để một lần gọi bình thường (vài chục ms) không bao giờ chạm tới, đủ hẹp để một
 * Account treo không kéo cả module theo.
 */
const ACCOUNT_TIMEOUT_MS = 5_000;

/**
 * Bọc một lời gọi SDK bằng trần thời gian.
 *
 * ⚠ **Đây là bản vá tạm, và giới hạn của nó phải được nói ra.** `Promise.race` giải phóng LƯỢT
 * RENDER, nhưng nó KHÔNG huỷ được socket bên dưới — kết nối vẫn treo cho tới khi tầng mạng bỏ nó.
 * Muốn huỷ thật thì cần một `AbortSignal` đi tới `fetch`, tức cần `requestTimeoutMs` trong
 * `AccountClientConfig` của SDK. `grep AbortSignal|timeout|signal` trên SDK 0.1.1 → RỖNG.
 *
 * Chỗ chữa đúng là SDK: nó là một hằng của cả hệ, khai cạnh `contextCacheSeconds`, và năm module
 * cần cùng một giá trị. Khi SDK có, xoá hàm này và truyền tuỳ chọn — không chỗ nào khác phải sửa.
 */
async function withAccountTimeout<T>(what: string, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          /*
           * Chuỗi viết HOA, grep được, và KHÁC HẲN dòng lỗi mạng — một Account chậm và một Account
           * chết cần hai phản ứng khác nhau, nên chúng không được nói giống nhau trong log.
           */
          console.error("[auth] ACCOUNT QUÁ CHẬM", { what, timeoutMs: ACCOUNT_TIMEOUT_MS });
          reject(new Error(`Comitor.Account did not answer within ${ACCOUNT_TIMEOUT_MS}ms (${what}).`));
        }, ACCOUNT_TIMEOUT_MS);
      })
    ]);
  } finally {
    /* Dọn timer ở CẢ hai nhánh: bỏ sót là giữ tiến trình sống thêm 5 giây sau mỗi request. */
    if (timer) clearTimeout(timer);
  }
}

const GUARD_CODES = ["NOT_A_MEMBER", "APP_NOT_ENABLED", "NO_SEAT", "APP_SUSPENDED"] as const;

/**
 * Phiên cho **RÌA B** — ném `ApiError`, KHÔNG chuyển hướng.
 *
 * ── VÌ SAO KHÔNG DÙNG CHUNG `requireSession()` CHO CẢ HAI RÌA ─────────────────────────────
 * Vì `redirect()` của Next hoạt động bằng cách NÉM một lỗi điều khiển luồng, và `withApiErrors`
 * thì bắt MỌI lỗi. Ghép hai thứ đó lại là: phiên hết hạn → `redirect()` ném → wrapper bắt → trả
 * **500 `INTERNAL_ERROR`**.
 *
 * Hậu quả đo được:
 *   · người dùng bấm Lưu sau khi rời máy một lúc nhận "lỗi hệ thống" thay vì "cần đăng nhập lại";
 *   · log máy chủ đầy `[api] LỖI KHÔNG XỬ LÝ` cho một sự kiện HOÀN TOÀN BÌNH THƯỜNG — access token
 *     sống 15 phút, và chính JSDoc của `requireSession()` ở trên đã nói vậy;
 *   · mọi cảnh báo dựng theo tỉ lệ 500 kêu sai.
 *
 * ⚠ Mỉa mai là cảnh báo đã có sẵn ngay trên `requireSession()` ("đừng bọc lời gọi này trong
 * `try/catch` bắt mọi thứ") và `app/(shell)/layout.tsx` áp dụng đúng — chỉ rìa B là không.
 * `ApiError.unauthorized()` cùng bản dịch `errors.UNAUTHORIZED` đã tồn tại từ đầu và **chưa bao
 * giờ được ném**.
 *
 * ── BỐN MÃ GUARD THÀNH 403, GIỮ NGUYÊN MÃ ────────────────────────────────────────────────
 * Cùng danh sách tường minh mà `app/(shell)/layout.tsx` dùng, và cùng lý do: SDK còn ném
 * `AccountError` cho những chuyện khác (mạng hỏng, token không verify được), và ba thứ đó là 500
 * chứ không phải "bạn không có quyền". Mã guard đi tiếp trong `metadata.guard` để chỗ gọi phân
 * biệt được bốn tình huống — cùng bốn màn hình mà `components/access-denied.tsx` hiện.
 */
export async function requireApiSession(): Promise<AccountSession> {
  let session: AccountSession | null;
  try {
    session = await getSession();
  } catch (error) {
    /*
     * 429 CỦA ACCOUNT LÀ 429 CỦA MODULE, không phải 500.
     *
     * Kiểm `status`, không khớp chuỗi: `AccountError` của SDK phơi `readonly status: number`
     * (`@comitor/account-sdk/dist/types.d.ts`), nên đây là hợp đồng chứ không phải suy đoán.
     *
     * Không có nhánh này thì `withApiErrors` gọi 429 là `INTERNAL_ERROR`: người dùng đọc "lỗi hệ
     * thống" cho một chuyện tự hết sau vài giây, log đầy `[api] LỖI KHÔNG XỬ LÝ` cho một sự kiện
     * bình thường, và mọi cảnh báo dựng theo tỉ lệ 500 kêu sai. Cùng HÌNH DẠNG với lỗi
     * `NEXT_REDIRECT` mà `requireApiSession` sinh ra để chữa — chỉ khác nguồn.
     *
     * Giao diện đã sẵn sàng từ trước: `hooks/use-error-message.ts` kiểm `status === 429` TRƯỚC khi
     * tra `code`, và `errors.RATE_LIMITED` có ở cả hai ngôn ngữ. Cho tới bản này, khoá đó chưa bao
     * giờ được đường nào sinh ra.
     */
    if (error instanceof AccountError && error.status === 429) throw ApiError.rateLimited();

    const guard = GUARD_CODES.find((code) => error instanceof AccountError && code === error.code);
    if (!guard) throw error;
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, `Workspace access denied: ${guard}.`, { guard });
  }

  if (!session) throw ApiError.unauthorized();
  return session;
}
