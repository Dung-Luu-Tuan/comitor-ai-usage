/**
 * Ma trận phân quyền theo CHỨC NĂNG của module — hàm THUẦN, tầng 1.
 *
 * ── NỬA CÒN LẠI CỦA RANH GIỚI ACCOUNT / MODULE ─────────────────────────────────────────────
 * Comitor.Account chỉ phát BỐN vai trò thô (`owner` / `admin` / `member` / `guest`) và nó không
 * biết — không được phép biết — module này có những chức năng gì. Nên câu *"ai được xoá công
 * việc"* là câu hỏi CỦA MODULE, và file này là chỗ trả lời: nó ÁNH XẠ bốn vai trò thô sang tập
 * quyền của chính module.
 *
 * Áp lực "cho quyền này sang Account cho tiện" sẽ quay lại đều đặn. Cái giá của nó chỉ hiện ra khi
 * đã có sản phẩm thứ ba: quyền chi tiết nằm ở Account nghĩa là mỗi lần MỘT module thêm một tính
 * năng, Account phải đổi lược đồ và ra bản theo — Account thành nút cổ chai của cả hệ sinh thái,
 * đúng thứ ranh giới này sinh ra để tránh.
 *
 * ── VÌ SAO Ở TẦNG THUẦN, KHÔNG PHẢI CẠNH DATABASE ──────────────────────────────────────────
 * Vì đây là tầng DUY NHẤT kiểm được một ma trận MÂU THUẪN mà không cần dựng database: một dòng
 * `guest` × `task.delete = true` phải bị áp đè, và `permissions.test.ts` khoá đúng nhánh đó. Chạy
 * thật thì không bao giờ đi qua được nhánh ấy — vì muốn đi qua, phải có sẵn dữ liệu hỏng.
 *
 * ⚠ Ẩn một nút KHÔNG phải là phân quyền. Ma trận này quyết định GIAO DIỆN hiện gì; chốt thật nằm ở
 * route handler, và nó phải đọc CÙNG ma trận này qua `can()`. Hai bảng quyền — một cho giao diện,
 * một cho máy chủ — thì sớm muộn nói khác nhau, và bên nói lỏng hơn mới là bên có hiệu lực.
 *
 * ⚠ Ở đây CHỈ có dữ liệu máy: id, cờ, vai trò. Nhãn hiển thị của từng quyền nằm ở
 * `lib/catalog/permissions.ts` + `messages/*.json` — `pnpm core:check` chặn mọi chuỗi có dấu lọt
 * vào tầng này.
 */

import type { WorkspaceRoleId } from "@/lib/contracts/account";
import type { AppPermissionId, PermissionMatrix } from "@/lib/contracts/settings";

/** Ô bị KHOÁ theo hướng nào. `undefined` = ô bật/tắt được bình thường. */
export type PermissionLock = "always" | "never";

/**
 * Một quyền, ở dạng MÁY ĐỌC ĐƯỢC — không nhãn, không mô tả, không nhóm hiển thị.
 *
 * Tách khỏi bảng khai đầy đủ ở `lib/catalog/permissions.ts` vì hai tập người dùng khác nhau: hàm
 * trong file này chỉ cần biết một quyền có phải thao tác GHI không và ai được bật SẴN; trang cài
 * đặt mới cần nhãn, mô tả và thứ tự nhóm. Trộn hai thứ là kéo chuỗi hiển thị vào tầng thuần.
 */
export interface PermissionRule {
  id: AppPermissionId;
  /**
   * Thao tác GHI (tạo / sửa / xoá / đổi cấu hình). Đây là cờ quyết định hằng đúng `"never"` bên
   * dưới, nên nó là dữ liệu máy chứ không phải chú thích cho người đọc.
   *
   * ⚠ XUẤT DỮ LIỆU KHÔNG phải thao tác ghi. Nó chỉ đọc, và có không gian làm việc thật sự muốn cho
   * khách xuất báo cáo được chia sẻ — nên nó vẫn là một ô bật/tắt bình thường ở cột Khách. Đánh
   * `write: true` cho nó là khoá cứng một lựa chọn hợp lệ, và không ai mở lại được từ giao diện.
   */
  write: boolean;
  /** Vai trò được bật SẴN khi module vừa cài. Hai hằng đúng bên dưới vẫn ĐÈ lên danh sách này. */
  defaultRoles: readonly WorkspaceRoleId[];
}

/**
 * Ô nào KHOÁ, và khoá theo hướng nào — HAI HẰNG ĐÚNG của module, không phải lựa chọn của người
 * dùng. Trả `undefined` khi ô bật/tắt được bình thường.
 *
 * - `"always"` — **CHỦ SỞ HỮU luôn có mọi quyền.** Cho bỏ tick ở cột này là mở đường cho một quản
 *   trị viên tự khoá cả chủ sở hữu ra ngoài ứng dụng: sau cú lưu đó không còn ai bật lại được, vì
 *   chính quyền `app.permissions` cũng đã mất. Trạng thái ấy không có đường thoát nào trong sản
 *   phẩm — chỉ có đường sửa tay trong database.
 * - `"never"` — **KHÁCH không bao giờ có quyền GHI.** Khách là người NGOÀI tổ chức. Nới chỗ này thì
 *   một lời mời khách — thứ vẫn được phát đi nhẹ tay vì "chỉ để họ xem" — trở thành một đường ghi
 *   vào dữ liệu thật.
 *
 * Nhận cờ `write` chứ không nhận cả `PermissionRule` là cố ý: hàm chỉ cần đúng một bit, và nhận
 * đúng một bit thì nơi gọi không phải dựng một `PermissionRule` giả chỉ để hỏi một câu.
 */
export function permissionLock(roleId: WorkspaceRoleId, write: boolean): PermissionLock | undefined {
  if (roleId === "owner") return "always";
  if (roleId === "guest" && write) return "never";
  return undefined;
}

/**
 * Đọc MỘT ô của ma trận.
 *
 * ⚠ MẶC ĐỊNH CỦA MỘT PHÉP KIỂM QUYỀN LUÔN PHẢI LÀ TỪ CHỐI. Ô khuyết → `false`, không phải `true`.
 * Ô khuyết xảy ra thật: ma trận đọc từ database bằng một `JSON.parse`, một vai trò mới thêm chưa
 * có hàng, một quyền mới thêm chưa có cột trong bản ghi cũ. Nếu khuyết mà cho qua thì mỗi lần
 * thêm một quyền, MỌI vai trò tự động có nó cho tới lần lưu tiếp theo — đúng chiều sai.
 *
 * ⚠ Và `noUncheckedIndexedAccess` KHÔNG cứu được ca này: `PermissionMatrix` là
 * `Record<WorkspaceRoleId, …>`, tức một mapped type trên union hữu hạn chứ không phải index
 * signature, nên TypeScript coi nó là ĐỦ HÀNG ĐỦ CỘT và `matrix[roleId]` có kiểu không-`undefined`.
 * Kiểu nói đủ, runtime thì không. Vì vậy phép phòng vệ dưới đây phải viết TAY, và đừng "dọn" nó đi
 * vì trình biên dịch bảo là thừa.
 */
export function can(matrix: PermissionMatrix, roleId: WorkspaceRoleId, permissionId: AppPermissionId): boolean {
  return matrix[roleId]?.[permissionId] === true;
}

/**
 * Bộ khung chung của hai hàm xuất bên dưới: đi hết lưới `roles × rules`, hỏi `proposed` giá trị đề
 * xuất cho từng ô, rồi ÁP ĐÈ `permissionLock` lên trên.
 *
 * Vì sao một chỗ duy nhất: `buildPermissionMatrix` và `applyPermissionLocks` khác nhau ĐÚNG ở nguồn
 * giá trị đề xuất (bảng khai / database). Viết hai vòng lặp riêng là hai bản áp đè, và bản quên
 * cập nhật sẽ là bản chạy trên dữ liệu thật.
 */
function resolveMatrix(
  rules: readonly PermissionRule[],
  roles: readonly WorkspaceRoleId[],
  proposed: (roleId: WorkspaceRoleId, rule: PermissionRule) => boolean
): PermissionMatrix {
  const rows = roles.map((roleId) => {
    const cells = rules.map((rule) => {
      const lock = permissionLock(roleId, rule.write);
      return [rule.id, lock ? lock === "always" : proposed(roleId, rule)] as const;
    });

    return [roleId, Object.fromEntries(cells) as Record<AppPermissionId, boolean>] as const;
  });

  return Object.fromEntries(rows) as PermissionMatrix;
}

/*
 * ⚠ Hai chỗ `as` ngay trên là chỗ DUY NHẤT trong file, và chúng KHÁC hẳn kiểu `as` mà quy ước của
 * repo cấm (chữa `T | undefined` từ `arr[i]` bằng `as T`). `Object.fromEntries` có kiểu trả về
 * `{ [k: string]: T }` — nó đánh mất tập khoá, không có cách nào diễn đạt lại, và không ai kiểm
 * được điều đó bằng mắt.
 *
 * Hệ quả phải nhận: nếu `roles` hay `rules` truyền vào KHÔNG đủ, ma trận trả về khuyết hàng/cột
 * thật, dù kiểu vẫn nói là đủ. Đó chính là lý do `can()` ở trên tự phòng vệ thay vì tin kiểu.
 */

/**
 * Dựng ma trận từ `defaultRoles` của từng quyền, rồi áp đè hai hằng đúng.
 *
 * Vì sao không gõ tay 48 ô (4 vai trò × 12 quyền): bảng chép tay và bảng khai `defaultRoles` là hai
 * nguồn cùng nói một chuyện, và chỉ cần một lần thêm quyền là chúng lệch nhau. Tệ hơn, ô lệch có
 * thể MÂU THUẪN với chính hằng đúng ở trên — một ô `guest` × thao tác ghi bật sẵn — mà không có gì
 * báo đỏ: `tsc` thấy một `boolean` hợp lệ, Biome thấy một object hợp lệ.
 *
 * Dùng khi khởi tạo một không gian làm việc mới, và trong seed. Sau đó ma trận sống ở database.
 */
export function buildPermissionMatrix(
  rules: readonly PermissionRule[],
  roles: readonly WorkspaceRoleId[]
): PermissionMatrix {
  return resolveMatrix(rules, roles, (roleId, rule) => rule.defaultRoles.includes(roleId));
}

/**
 * Áp đè lại hai hằng đúng lên một ma trận CÓ SẴN — thường là ma trận vừa đọc từ database.
 *
 * ⚠ ĐÂY LÀ HÀM QUAN TRỌNG NHẤT FILE, vì nó nói ra một điều dễ quên: **dữ liệu trong database KHÔNG
 * được tin.** Một dòng `role_permissions` ghi `guest` + `task.delete = true` hoàn toàn có thể tồn
 * tại — do một migration cũ viết trước khi hằng đúng này ra đời, do một người sửa tay bằng `psql`
 * cho kịp việc, do một bug ở đường ghi, do khôi phục một bản sao lưu cũ.
 *
 * ⚠ Và phải áp ở TẦNG ĐỌC, không phải tầng ghi. Áp ở tầng ghi chỉ lọc được những dòng ghi TỪ NAY
 * TRỞ ĐI; mọi dòng đã nằm sẵn trong bảng vẫn thoát, và chúng là đúng những dòng đáng ngờ nhất.
 * Áp ở tầng đọc thì một hàng hỏng chỉ là một hàng vô hại — nó không bao giờ trở thành một câu trả
 * lời `true`. Cái giá là một vòng lặp trên lưới 4 × 12 mỗi lần đọc: không I/O, không đo được.
 *
 * Ba tính chất, cả ba đều có test khoá:
 *
 *   - **Fail closed** — ô khuyết trong `matrix` thành `false` (qua `can`), không phải `true`.
 *   - **Bất động** — chạy lần hai trên kết quả lần một cho đúng kết quả đó.
 *   - **Cắt theo lưới khai báo** — vai trò/quyền không nằm trong `roles`/`rules` bị BỎ. Chúng là
 *     tàn dư của một lược đồ cũ; giữ lại thì giao diện không hiện được chúng mà `can()` vẫn trả
 *     lời theo chúng — tức một quyền không có đường thu hồi.
 */
export function applyPermissionLocks(
  matrix: PermissionMatrix,
  rules: readonly PermissionRule[],
  roles: readonly WorkspaceRoleId[]
): PermissionMatrix {
  return resolveMatrix(rules, roles, (roleId, rule) => can(matrix, roleId, rule.id));
}
