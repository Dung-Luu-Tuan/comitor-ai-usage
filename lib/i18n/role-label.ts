import "server-only";
import { getTranslations } from "next-intl/server";
import type { WorkspaceRoleId } from "@/lib/contracts/account";

/**
 * Nhãn vai trò thô, theo ngôn ngữ đang xem — dùng ở Server Component.
 *
 * ── VÌ SAO CÓ HÀM NÀY THAY VÌ MỖI TRANG TỰ `t()` ─────────────────────────────────────────
 * Vì `AccountMember.role` là `WorkspaceRoleId | null`, và mỗi chỗ gọi phải xử lý nhánh `null` cùng
 * phép ép kiểu khoá động. Lặp lại điều đó ở hai trang là hai cơ hội để một chỗ quên nhánh `null`
 * và `t()` trả về **chính tên khoá** thay vì một cái tên vai trò — không ném, không đỏ ở đâu cả,
 * nên nó đi thẳng ra production dưới dạng một chuỗi trông như nhãn kỹ thuật.
 *
 * Trả về chuỗi RỖNG khi không có vai trò: chỗ gọi đưa nó vào `caption`/`description`, và một dòng
 * trống ở đó là đúng — hơn là một chữ "Không rõ" mà người dùng phải tự hiểu.
 */
export async function getRoleLabeller(): Promise<(role: WorkspaceRoleId | null) => string> {
  const t = await getTranslations("roles");
  return (role) => (role ? t(`${role}.label` as Parameters<typeof t>[0]) : "");
}
