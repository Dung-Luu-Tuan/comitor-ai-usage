/**
 * Hợp đồng dữ liệu với **Comitor.Account** — TẦNG 0: chỉ KIỂU, không một dòng mã chạy được.
 *
 * Nhờ vậy cả Server Component lẫn Client Component đều `import type` được mà không kéo theo
 * `server-only`, Prisma hay SDK vào bundle trình duyệt.
 *
 * ⚠ Hình dạng ở đây là hợp đồng với MỘT SẢN PHẨM KHÁC, không phải kiểu nội bộ. Đổi nó là đổi
 * hợp đồng — đối chiếu với `@comitor/account-sdk` trước khi sửa.
 */

/**
 * BỐN VAI TRÒ THÔ mà Account phát ở phạm vi không gian làm việc. Module này chỉ ĐỌC.
 *
 * ⚠ **Đừng thêm vai trò thứ năm.** Câu hỏi "ai được xoá công việc" là câu hỏi CỦA MODULE, và nó
 * được trả lời bằng bảng quyền theo chức năng (`lib/catalog/permissions.ts` + bảng
 * `role_permissions`), không bằng một vai trò mới ở Account. Cần một "vai trò" mới nghĩa là cần
 * một TẬP QUYỀN mới trong bảng của module.
 *
 * Giá trị là chuỗi MÁY, khớp đúng chuỗi Account trả về. Đổi chúng ở đây là đổi hợp đồng.
 */
export type WorkspaceRoleId = "owner" | "admin" | "member" | "guest";

/** Không gian làm việc, như Account mô tả nó. */
export interface AccountWorkspace {
  id: string;
  name: string;
  /** Địa chỉ rút gọn — DUY NHẤT TOÀN HỆ, và nó đi vào URL của mọi sản phẩm Comitor. */
  slug: string;
  /** Tên gói, chuỗi hiển thị sẵn do Account cấp. */
  plan: string;
  /**
   * Số thành viên — `null` khi chưa biết.
   *
   * ⚠ Module KHÔNG giữ bảng thành viên nên nó không có nguồn nào để SUY RA con số này; đó là kết
   * quả đúng của ranh giới Account/app, không phải một chỗ chép tay bị bỏ sót.
   *
   * Và vì sao `null` chứ không phải một con số: `GET /api/workspaces/me` của Account **không trả
   * về** nó (xem `WorkspaceMembership` trong `@comitor/account-sdk`). Nguồn duy nhất là API danh
   * bạ, tức một vòng gọi M2M — trả một vòng mạng ở MỌI lần render chỉ để hiện một con số trong menu
   * là cái giá sai. `memberCount` của `@comitor/ui` là optional, nên bỏ trống là hành vi đúng: menu
   * không hiện dòng đó, thay vì hiện "0 thành viên" — một lời nói dối.
   */
  memberCount: number | null;

  /**
   * Logo của không gian làm việc, hoặc `null`.
   *
   * ⚠ Account gọi trường này là `logo`; đổi tên ở biên (`lib/account/session.ts`) là cố ý, để khớp
   * `Workspace.logoUrl` của `@comitor/ui`. Cùng ràng buộc với `AccountUser.avatarUrl`: **URL đã ký,
   * có hạn** — đọc lại mỗi lần render, không cất vào database.
   */
  logoUrl: string | null;
}

/** Người đang đăng nhập. */
export interface AccountUser {
  id: string;
  name: string;
  email: string;
  /**
   * Ảnh đại diện, hoặc `null` khi người dùng chưa đặt.
   *
   * ⚠ **URL ĐÃ KÝ, CÓ HẠN** (Account ký với `X-Amz-Expires=3600`), không phải một địa chỉ vĩnh
   * viễn. Vì vậy: đọc lại ở mỗi lần render và **đừng bao giờ cất nó vào database hay vào một cache
   * sống lâu hơn chữ ký** — cùng luật đã áp cho ảnh đính kèm của chính module
   * (`lib/storage.ts`: "database lưu KHOÁ, không lưu URL").
   *
   * `null` là trạng thái HỢP LỆ và phổ biến; mọi chỗ hiển thị phải rơi về avatar chữ cái
   * (`LetterAvatar` tự làm việc đó khi `src` rỗng).
   */
  avatarUrl: string | null;

  /**
   * Ngôn ngữ ưa dùng, theo hồ sơ Comitor.Account — mã ngôn ngữ THÔ, chưa kiểm.
   *
   * ⚠ **Đây KHÔNG phải ngôn ngữ đang hiển thị.** Ngôn ngữ đang hiển thị đọc từ cookie
   * `comitor-locale` (xem `lib/i18n/server.ts`), và cố ý như vậy: `resolveRequestLocale()` chạy ở
   * MỌI request có render, kể cả những trang KHÔNG có phiên nào — bốn màn hình chặn, `/signed-out`,
   * `/sign-in-failed`, `error.tsx`. Bắt ngôn ngữ phụ thuộc một lời gọi sang Account là lột mất chữ
   * khỏi đúng cái màn hình có nhiệm vụ nói "không gọi được sang Account".
   *
   * Trường này chỉ để **gieo** cookie ấy một lần ở route callback. Kiểu là `string` chứ không phải
   * `Locale`: Account biết những ngôn ngữ mà module này chưa chắc có bản dịch, nên phải qua
   * `isLocale()` trước khi dùng.
   */
  locale: string;

  /**
   * Múi giờ ưa dùng, theo hồ sơ Account — **đã chuẩn hoá**, luôn là một vùng mà `Intl` chấp nhận.
   *
   * ⚠ Phép chuẩn hoá nằm ở `lib/account/session.ts` và nó **không phải tuỳ chọn**: Account khai cột
   * này `input: true` không kèm phép kiểm nào, nên `POST /api/auth/update-user` nhận bất kỳ chuỗi
   * gì — và giá trị ấy đi thẳng vào `Intl.DateTimeFormat`, nơi một chuỗi lạ NÉM `RangeError`. Gỡ
   * phép kiểm ở biên là mở đường cho một hồ sơ làm trắng mọi trang công việc.
   *
   * Đây là múi giờ để **IN RA** một mốc thời gian, và nó đi theo NGƯỜI XEM. Kể từ 05.09.2026 đây
   * là múi giờ DUY NHẤT trong hệ: khái niệm "múi giờ của không gian làm việc" đã bị bỏ, mọi mốc
   * lưu UTC và hiển thị theo người xem — xem `lib/i18n/config.ts` và AGENTS.md.
   */
  timezone: string;

  /**
   * MẶC ĐỊNH bốn trục hiển thị, theo hồ sơ Account — `null` = **chưa từng chọn**.
   *
   * ⚠ **KHÔNG phải giá trị đang có hiệu lực.** Giá trị có hiệu lực nằm ở `localStorage` của thiết
   * bị, vì bốn trục này phải áp **trước lượt sơn đầu tiên** — thứ chỉ script chống nháy đọc
   * `localStorage` làm được. Một giá trị đi từ máy chủ xuống prop luôn tới SAU lượt sơn ấy, tức
   * vẫn nháy; đó là lý do không có đường nào khác ngoài việc GIEO.
   *
   * ⚠ SDK khai bốn trường này là **optional** vì một bản Account cũ không gửi chúng. Ở biên
   * (`lib/account/session.ts`) `undefined` được gộp về `null`: hai ca ấy dẫn tới cùng một hành
   * động — **đừng gieo gì cho trục đó** — nên phần còn lại của module chỉ cần biết một trạng thái.
   *
   * ⚠ Gieo một giá trị mặc định thay cho `null` là ghi đè lựa chọn tại chỗ của người dùng bằng một
   * thứ chưa ai chọn bao giờ. Cột bên Account cố ý không có `@default` để giữ được sự phân biệt đó.
   *
   * Kiểu là `string` chứ không phải union hẹp: hàng cũ có thể mang giá trị mà bản gói hiện tại
   * không còn biết. Chỗ lọc là `lib/core/display-prefs.ts`, và nó lọc ở đúng một chỗ.
   */
  displayPrefs: {
    theme: string | null;
    contrast: string | null;
    density: string | null;
    fontSize: string | null;
  };
}

/** Một người trong danh bạ của không gian làm việc — module ĐỌC, không sở hữu. */
export interface AccountMember {
  id: string;
  name: string;
  email: string;
  /**
   * Vai trò THÔ ở workspace — `null` khi Account không trả về.
   *
   * ⚠ Đây là MÃ (`"admin"`), không phải nhãn. Bản trước của trường này tên `position` và mang một
   * chuỗi hiển thị sẵn ("Trưởng nhóm sản phẩm") — một chuỗi hiển thị nằm trong tầng dữ liệu, tức
   * đúng thứ `pnpm i18n:check` không thấy và giao diện tiếng Anh sẽ hiện ra tiếng Việt. Nhãn tra
   * từ `roles.*` ở tầng hiển thị.
   *
   * Và Account KHÔNG có trường "chức vụ": mã nhân viên, phòng ban, chức danh là hồ sơ NHÂN SỰ,
   * thuộc app HR — không thuộc danh tính. Xem AGENTS.md §"Ranh giới Account / app".
   */
  role: WorkspaceRoleId | null;

  /**
   * Ảnh đại diện, hoặc `null`. Cùng ràng buộc với `AccountUser.avatarUrl`: **URL đã ký, có hạn** —
   * đọc lại mỗi lần render, không cất vào database.
   *
   * ⚠ Account trả trường này dưới tên `image`; đổi tên ở biên (`lib/account/directory.ts`) là cố ý,
   * để tầng hiển thị dùng đúng một tên với `ShellUser.avatarUrl` và `AvatarGroupItem.src` của gói.
   */
  avatarUrl: string | null;
}

/**
 * Kết quả của một lần hỏi Account "ai đang mở app, ở workspace nào, với vai trò gì".
 *
 * Ba mảnh đúng bằng ba câu Account trả lời được. Không thêm gì vào đây mà không hỏi: *nó có phải
 * một trong ba câu đó không?*
 */
export interface AccountSession {
  user: AccountUser;
  workspace: AccountWorkspace;
  role: WorkspaceRoleId;
  /**
   * MỌI không gian làm việc mà người này thuộc về, đã đọc sẵn từ ngữ cảnh Account.
   *
   * ⚠ Nó KHÔNG tốn thêm một vòng mạng nào: `requireWorkspaceAccess()` đã lấy trọn danh sách này
   * để tìm ra workspace đang mở. Trước khi có trường này, `shell-frame.tsx` dựng TAY một mảng một
   * phần tử — nên bộ đổi workspace chỉ có đúng một dòng, và `onWorkspaceChange` hiện một toast
   * "thành công" cho một việc KHÔNG XẢY RA. Dữ liệu vẫn nằm sẵn trong tay, chỉ là bị vứt đi.
   */
  workspaces: readonly AccountWorkspaceSummary[];
  /**
   * Bệ phóng ứng dụng — dữ liệu THẬT từ Account, không phải bảng khai của module.
   *
   * ⚠ Trước trường này, `lib/catalog/apps.ts` ghi cứng cả danh sách app, cả URL (đoán theo khuôn
   * `https://{key}.comitor.ai`) lẫn cờ mở khoá (`DEV_LOCKED_APP_IDS`). Ba thứ đó đều là câu trả
   * lời của Account — câu số 3 trong ba câu nó trả lời — và ghi cứng chúng có hai cái giá đã
   * hiện ra: hệ thêm sản phẩm mới thì mọi module phải sửa tay, và bản dev ném người dùng sang
   * PRODUCTION của app anh em, mang theo phiên của họ, không có gì báo.
   *
   * Rỗng khi không đọc được danh mục — bệ phóng thu lại còn app hiện tại, không phải trang trắng.
   */
  apps: readonly AppTile[];
}

/**
 * MỘT Ô trong bệ phóng ứng dụng — đã ghép DANH MỤC toàn hệ với QUYỀN DÙNG của workspace.
 *
 * ⚠ **BA trạng thái, không phải hai.** SDK nói thẳng điều này và nó không phải chuyện thẩm mỹ:
 * mỗi trạng thái dẫn tới một hành động khác nhau của người dùng, nên gộp lại là bắt họ tự đoán
 * phải đi hỏi ai.
 *   · `unlocked` — workspace đã bật app VÀ người này có chỗ ngồi → mở được;
 *   · `no-seat`  — đã bật nhưng người này CHƯA có chỗ → xin quản trị viên cấp chỗ;
 *   · `locked`   — workspace chưa bật app → quản trị viên vào Account bật.
 *
 * `AppDescriptor` của `@comitor/ui` chỉ có `entitled?: boolean`, tức HAI trạng thái. Ta ánh xạ
 * `entitled = state === "unlocked"` và giữ `state` ở đây để `onUpsell` nói đúng câu — xem
 * `shell-frame.tsx`. Đừng vứt `state` đi chỉ vì primitive không nhận nó.
 */
export type AppTileState = "unlocked" | "no-seat" | "locked";

export interface AppTile {
  /** Khoá app của Comitor — `"starter"`, `"chat"`, `"crm"`… */
  key: string;
  /** ĐÃ chọn ngôn ngữ Ở ACCOUNT theo hồ sơ người dùng. Module KHÔNG dịch lại. */
  name: string;
  description: string | null;
  /**
   * Tên icon `lucide-react` PascalCase từ Account, hoặc `null`.
   *
   * ⚠ Là TÊN, không phải component — nó đi qua HTTP. `lib/catalog/apps.ts` tra tên ấy trong một
   * bảng ĐÓNG; tên lạ rơi về icon mặc định chứ không làm hỏng render.
   */
  icon: string | null;
  /**
   * Tên MỘT token màu của `@comitor/ui` (`"teal"`, `"navy"`…), hoặc `null`.
   *
   * ⚠ Tập ĐÓNG, và phải được đối xử như vậy: giá trị này đi vào thuộc tính `style`, nên nối thẳng
   * một chuỗi từ API vào CSS là một đường tiêm. Lọc ở `lib/catalog/apps.ts`.
   */
  iconColor: string | null;
  /** Địa chỉ mở app cho workspace ĐANG XEM — `{baseUrl}/w/{slug}`, do SDK ghép. */
  href: string;
  state: AppTileState;
  /** Gói mà workspace đang dùng ở app này, hoặc `null` khi chưa bật. */
  plan: string | null;
}

/** Một dòng trong bộ đổi workspace — đủ để vẽ, không hơn. */
export interface AccountWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRoleId;
  /** Logo, hoặc `null` — cùng ràng buộc "URL đã ký, có hạn" với `AccountWorkspace.logoUrl`. */
  logoUrl: string | null;
  /** `true` khi workspace đó đã bật ứng dụng này — nơi chưa bật thì đổi sang là vào màn chặn. */
  hasThisApp: boolean;
}
