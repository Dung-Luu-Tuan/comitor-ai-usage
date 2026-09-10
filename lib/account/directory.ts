import "server-only";
import { AccountM2mClient } from "@comitor/account-sdk";
import { cache } from "react";
import type { AccountMember, WorkspaceRoleId } from "@/lib/contracts/account";
import { ApiError, ERROR_CODES } from "@/lib/core/api-error";
import { env } from "@/lib/env";

/**
 * DANH BẠ người trong không gian làm việc — module **ĐỌC**, không sở hữu.
 *
 * Module cần tên và chức vụ để hiện "người phụ trách", để lọc theo người, để vẽ avatar. Nhưng mời,
 * gỡ, đổi vai trò, đổi hồ sơ đều diễn ra ở Comitor.Account. Đó là lý do
 * `prisma/schema.prisma` KHÔNG có bảng `users`: một bản sao ở đây sẽ CŨ DẦN mà không ai biết —
 * người dùng đổi tên ở Account, mọi app trong hệ đổi theo, trừ app đã chép.
 *
 * ── VÌ SAO M2M CHỨ KHÔNG DÙNG ACCESS TOKEN CỦA NGƯỜI ĐANG ĐĂNG NHẬP ──────────────────────
 * Vì danh bạ được đọc ở những chỗ KHÔNG có người dùng đứng sau: một cron nhắc hạn, một hàng đợi
 * gửi thư, `pnpm seed`. Dựng nó trên token của người đang xem thì ba đường đó không chạy được, và
 * lúc phát hiện thì đã muộn.
 *
 * ⚠ Client M2M dùng **resource RIÊNG** (`…/account/directory`) và scope hẹp
 * (`account.directory.read`). Đó không phải sự cầu kỳ: scope chỉ thực sự hẹp khi đúng cả hai tầng
 * — `client_credentials_scopes` của client VÀ `allowedScopes` của resource, mà Account lấy GIAO
 * của hai tập. Dùng chung resource với `openid/profile/email` là làm ranh giới scope vô nghĩa.
 * SDK đã đặt sẵn cả hai; đừng ghi đè.
 */

/**
 * Client dựng LƯỜI và giữ lại.
 *
 * Nó cache access token M2M và tự xoay. Quan trọng hơn: nhiều lời gọi đồng thời lúc token vừa hết
 * hạn dùng chung **một** lần xin token — không có điều đó thì mười request cùng đấm vào
 * `/oauth2/token` và tự chạm rate limit của chính nó.
 *
 * Dựng ở scope module thì mọi request dùng chung một cache; dựng trong hàm thì cache chết theo mỗi
 * lời gọi và ta mất đúng thứ vừa nói.
 */
let client: AccountM2mClient | null = null;

/**
 * Đường máy-tới-máy đã được cấu hình chưa.
 *
 * ── VÌ SAO CỜ NÀY PHẢI TỒN TẠI VÀ PHẢI ĐI LÊN TỚI GIAO DIỆN ───────────────────────────────
 * Vì thiếu `COMITOR_M2M_*` là ca hỏng có triệu chứng NÓI SAI NGUYÊN NHÂN, và nó xảy ra ở đúng ngày
 * đầu tiên của mọi người:
 *
 *   danh bạ rỗng  →  ô "Người phụ trách" ở `/tasks/new` không có ai
 *                 →  gửi biểu mẫu thì máy chủ trả 422 `ASSIGNEE_NOT_IN_WORKSPACE`
 *                 →  người dùng đọc thành "người này không thuộc workspace", đi tìm ở Account,
 *                    và không tìm thấy gì sai ở đó cả.
 *
 * Đối chứng ngay trong repo: cùng cặp biến này ở `lib/account/entitlements.ts` thì NÉM kèm chỉ
 * dẫn. Ở đây nó trả mảng rỗng và im lặng — hai chính sách khác nhau cho cùng một cấu hình thiếu.
 * `fetchMembers` fail-open là ĐÚNG (Account chập chờn không nên làm trắng cả trang), nhưng
 * "fail-open" và "im lặng" là hai chuyện khác nhau.
 */
export const directoryConfigured = Boolean(env.account.m2mClientId && env.account.m2mClientSecret);

/** In một lần cho mỗi tiến trình, không phải mỗi lời gọi — nếu không thì log dev không đọc được. */
let warnedAboutMissingM2m = false;

function m2m(): AccountM2mClient | null {
  if (!directoryConfigured) {
    if (!warnedAboutMissingM2m) {
      warnedAboutMissingM2m = true;
      /*
       * Viết HOA và có tiền tố `[account]` để grep được, và cố ý KHÁC HẲN dòng lỗi mạng bên dưới
       * ("không đọc được danh bạ") — hai câu giống nhau cho hai nguyên nhân khác nhau là thứ làm
       * người trực đi sai hướng lúc 2 giờ sáng.
       */
      console.warn(
        "[account] CHƯA CẤU HÌNH M2M, DANH BẠ RỖNG — điền COMITOR_M2M_CLIENT_ID và " +
          "COMITOR_M2M_CLIENT_SECRET (client khoá `directory`, hiển thị `Comitor M2M Sample`, của " +
          "bản Comitor.Account mà NEXT_PUBLIC_COMITOR_ACCOUNT_URL đang trỏ tới; xin người quản trị " +
          "Account, hoặc đọc comitor-account/scripts/seed-output*.json nếu bạn có source của nó). " +
          "Không có chúng thì mọi tên người hiện là chỗ trống và tạo việc trả 422 ASSIGNEE_NOT_IN_WORKSPACE."
      );
    }
    return null;
  }
  client ??= new AccountM2mClient({
    accountUrl: env.accountUrl,
    clientId: env.account.m2mClientId,
    clientSecret: env.account.m2mClientSecret
  });
  return client;
}

/** Bốn vai trò thô Account phát ra. Kiểm ở đây vì phản hồi API là dữ liệu ngoài, không đáng tin. */
function isRole(value: unknown): value is WorkspaceRoleId {
  return value === "owner" || value === "admin" || value === "member" || value === "guest";
}

/** Hình dạng một dòng trong phản hồi danh bạ của Account. Khai tay vì SDK trả `any` ở đây. */
interface DirectoryRow {
  userId?: string;
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  position?: string;
  /** Ảnh đại diện — Account gọi nó là `image`; module đổi tên thành `avatarUrl` ở ngay dưới. */
  image?: string | null;
}

/**
 * Danh bạ của một không gian làm việc.
 *
 * ⚠ `cache()` của React chỉ gộp trong MỘT request — nó không thay được cache theo thời gian. Với
 * một module có lưu lượng thật, thêm một lớp cache 30–60 giây ở đây, và **bù độ trễ bằng webhook**
 * (`member.removed`, `seat.revoked`) chứ đừng hạ TTL xuống 0.
 *
 * Gọi hỏng thì trả về danh sách RỖNG, không ném: một sự cố mạng sang Account không được phép làm
 * trắng bảng công việc. Hậu quả nhìn thấy được là cột "Người phụ trách" hiện chỗ trống — xấu, chấp
 * nhận được, và sửa được bằng một lần tải lại.
 */
/**
 * Bản KHÔNG bọc `cache()` — dành cho mã chạy NGOÀI một request Next (`pnpm seed`, cron, hàng đợi).
 *
 * ⚠ `cache()` của React gắn với vòng đời một request. Gọi một hàm đã bọc nó từ một script Node
 * trần là dựa vào hành vi không được đảm bảo; tách ra hai hàm thì cả hai đường đều rõ ràng, và chỗ
 * gọi tự chọn đúng bản theo ngữ cảnh của nó.
 */
export async function fetchMembers(workspaceIdOrSlug: string): Promise<AccountMember[]> {
  const directory = m2m();
  if (!directory) return [];

  try {
    const payload = (await directory.listMembers(workspaceIdOrSlug)) as { members?: DirectoryRow[] };
    return (payload.members ?? []).flatMap((row) => {
      const id = row.userId ?? row.id;
      if (!id) return [];
      return [
        {
          id,
          name: row.name ?? "",
          email: row.email ?? "",
          /* MÃ vai trò, không phải nhãn — xem `AccountMember.role` ở tầng 0. */
          role: isRole(row.role) ? row.role : null,
          /*
           * ⚠ Chuỗi RỖNG cũng phải thành `null`, không chỉ `undefined`. `src=""` trên một `<img>`
           * làm trình duyệt tải lại CHÍNH TRANG hiện tại rồi vẽ ảnh vỡ; `LetterAvatar` chỉ rơi về
           * initials khi `src` là nullish. Một trường rỗng đến từ API bên ngoài là chuyện thường,
           * nên phép chuẩn hoá này thuộc về biên, không thuộc về chỗ hiển thị.
           */
          avatarUrl: row.image?.trim() ? row.image : null
        }
      ];
    });
  } catch (error) {
    console.warn("[account] không đọc được danh bạ:", error);
    return [];
  }
}

/** Bản dùng TRONG request: `cache()` gộp mọi lời gọi của cùng một lượt render thành một. */
export const listMembers = cache(fetchMembers);

/**
 * Tra nhanh theo id.
 *
 * Trả `Map` chứ không phải một hàm `getMember(id)`: các trang cần gắn tên cho HÀNG CHỤC dòng, và
 * một hàm tra tuyến tính gọi trong vòng lặp là O(n²) ngay từ bản mẫu.
 */
export async function memberDirectory(workspaceIdOrSlug: string): Promise<Map<string, AccountMember>> {
  const members = await listMembers(workspaceIdOrSlug);
  return new Map(members.map((member) => [member.id, member]));
}

/**
 * Danh bạ cho đường GHI — ném khi không đọc được, thay vì trả một `Map` rỗng.
 *
 * ── VÌ SAO ĐƯỜNG ĐỌC VÀ ĐƯỜNG GHI CẦN HAI CHÍNH SÁCH KHÁC NHAU ──────────────────────────
 * `memberDirectory()` fail-open, và đó là ĐÚNG cho đường đọc: Account chập chờn năm giây không
 * đáng để làm trắng cả bảng công việc — thiếu vài cái tên thì xấu, nhưng dữ liệu vẫn ở đó.
 *
 * Đường GHI thì ngược lại. Nó dùng danh bạ để TRẢ LỜI MỘT CÂU — "người này có trong không gian
 * làm việc không?" — và một danh bạ rỗng trả lời "không" cho MỌI người. Hậu quả đã đo được:
 *
 *     M2M chưa cấu hình  →  danh bạ rỗng  →  tạo việc trả 422 ASSIGNEE_NOT_IN_WORKSPACE
 *
 * Tức một sự cố HẠ TẦNG được báo cáo thành một LỜI KHẲNG ĐỊNH VỀ DỮ LIỆU, và người dùng đi tìm
 * lỗi ở Account — nơi không có gì sai cả. `SERVICE_UNAVAILABLE` thì nói đúng chuyện đang xảy ra,
 * và `lib/core/api-error.ts` đã tách sẵn mã đó khỏi `INTERNAL_ERROR` vì đúng lý do này: "chưa cấu
 * hình" cần người vận hành, "hỏng" cần một người trực.
 *
 * @throws ApiError 503 khi danh bạ không đọc được.
 */
export async function requireMemberDirectory(workspaceIdOrSlug: string): Promise<Map<string, AccountMember>> {
  const members = await listMembers(workspaceIdOrSlug);
  if (members.length === 0) {
    throw new ApiError(
      503,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      "The member directory is unavailable, so assignees cannot be validated."
    );
  }
  return new Map(members.map((member) => [member.id, member]));
}
