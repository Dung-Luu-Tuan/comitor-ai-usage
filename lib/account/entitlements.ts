import "server-only";
import { AccountM2mClient } from "@comitor/account-sdk";
import { env } from "@/lib/env";

/**
 * Quyền dùng ứng dụng của một không gian làm việc — đọc bằng đường MÁY-TỚI-MÁY.
 *
 * ── VÌ SAO MODULE CẦN ENDPOINT NÀY KHI `requireWorkspaceAccess` ĐÃ TRẢ LỜI ĐỦ ────────────
 * Vì `requireWorkspaceAccess` cần **access token của một người đang đăng nhập**, và có những chỗ
 * không có ai đứng sau: `pnpm seed`, một cron nhắc hạn, một hàng đợi gửi thư. Ba đường đó vẫn phải
 * biết `workspaceId` để lọc dữ liệu.
 *
 * ⚠ Đây cũng là chỗ chứng minh ranh giới resource hoạt động: token M2M xin với
 * `resource=…/account/directory` ĐỌC ĐƯỢC endpoint này, nhưng bị Account từ chối với
 * `WRONG_AUDIENCE` khi gọi `/api/workspaces/{slug}`. Scope hẹp chỉ thực sự hẹp khi đúng cả hai
 * tầng — client và resource — và SDK đã đặt sẵn cả hai.
 */

let client: AccountM2mClient | null = null;

function m2m(): AccountM2mClient {
  if (!env.account.m2mClientId || !env.account.m2mClientSecret) {
    throw new Error(
      "Thiếu COMITOR_M2M_CLIENT_ID / COMITOR_M2M_CLIENT_SECRET. Lấy từ client khoá `directory` " +
        "(hiển thị `Comitor M2M Sample`) của bản Comitor.Account mà NEXT_PUBLIC_COMITOR_ACCOUNT_URL " +
        "đang trỏ tới — xin người quản trị Account, hoặc đọc " +
        "comitor-account/scripts/seed-output*.json nếu bạn có source của nó."
    );
  }
  client ??= new AccountM2mClient({
    accountUrl: env.accountUrl,
    clientId: env.account.m2mClientId,
    clientSecret: env.account.m2mClientSecret
  });
  return client;
}

interface EntitlementsResponse {
  workspaceId: string;
  slug: string;
  apps: { key: string; plan: string; status: string; seats?: { userId: string }[] }[];
}

/**
 * Đổi **slug** (thứ người dùng gõ và thứ nằm trong URL) thành **id** (thứ nằm ở cột
 * `workspace_id` của mọi bảng trong `prisma/schema.prisma`).
 *
 * ⚠ Hai giá trị này KHÁC NHAU và không suy được từ nhau. Slug đổi được — người quản trị đổi địa
 * chỉ rút gọn của workspace là mọi dòng dữ liệu khoá theo slug thành mồ côi. Vì vậy module lưu
 * **id**, và slug chỉ sống ở tầng đường dẫn.
 */
export async function getWorkspaceEntitlements(slug: string): Promise<EntitlementsResponse> {
  const response = await m2m().fetch(`/api/entitlements/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`Không đọc được entitlements của "${slug}": HTTP ${response.status}`);
  }
  return (await response.json()) as EntitlementsResponse;
}
