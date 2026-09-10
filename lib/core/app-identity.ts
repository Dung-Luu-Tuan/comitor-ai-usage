/**
 * **DANH TÍNH CỦA MODULE — một chuỗi, một chỗ.**
 *
 * ── VÌ SAO FILE NÀY TỒN TẠI ───────────────────────────────────────────────────────────────
 * Vì `comitor-starter` được SAO CHÉP để tạo module mới, và câu hỏi đầu tiên của mọi lần sao chép
 * là *"đổi tên ở đâu?"*. Trước file này, câu trả lời là "ở nhiều chỗ, và ba trong số đó không nằm
 * trong checklist" — trong đó hai chỗ hỏng ÂM THẦM:
 *
 *   · `attachmentObjectKey()` ghi tiền tố `starter/` vào KHOÁ object. Mọi app Comitor dùng chung một
 *     bucket và chính sách IAM phân quyền theo TIỀN TỐ, nên Comitor CRM quên đổi sẽ ghi tệp khách
 *     hàng vào vùng của app khác. Không có gì báo, và cái sai nằm trong dữ liệu chứ không trong mã.
 *   · chân mọi email ký tên "Comitor Bản mẫu" / "Comitor Starter" — thứ **người nhận** thấy trước
 *     khi đội phát triển kịp thấy.
 *
 * ── VÌ SAO Ở TẦNG 1, KHÔNG Ở `lib/catalog/apps.ts` ───────────────────────────────────────
 * `CURRENT_APP_ID` từng sống ở đó, và chỗ đó không dùng chung được: `lib/catalog/apps.ts` mang
 * icon nên nó `import` `@comitor/ui`, mà `lib/core/**` bị cấm import gói giao diện (đúng luật —
 * xem `docs/kien-truc-ung-dung.md` §2 hàng D). Ở tầng 1 thì cả bốn phía cùng đọc được: lõi thuần,
 * tầng dữ liệu, bảng khai, và mã chạy ở trình duyệt.
 *
 * ⚠ **Đây là file ĐẦU TIÊN một module mới sửa.** Đổi `APP_ID` là đổi tiền tố khoá object, `appKey`
 * gửi cho Comitor.Account, và tên sản phẩm mặc định trong email — cùng một lúc, không sót chỗ nào.
 */

/**
 * Định danh MÁY của module. Chữ thường, không dấu, không khoảng trắng.
 *
 * ⚠ Nó là **hợp đồng với ba hệ thống bên ngoài**, không phải một cái tên tuỳ ý:
 *   · `appKey` mà `requireWorkspaceAccess()` gửi cho Account — phải khớp key app đã đăng ký bên đó;
 *   · tiền tố khoá trong bucket dùng chung — phải khớp chính sách IAM đã cấp;
 *   · và nó nằm trong dữ liệu đã ghi, nên **đổi nó sau khi có dữ liệu thật là một lần di trú**,
 *     không phải một lần đổi tên.
 */
export const APP_ID = "ai-usage";

/**
 * Tên sản phẩm khi KHÔNG có ngữ cảnh ngôn ngữ — dùng cho giá trị mặc định của `COMITOR_MAIL_FROM`.
 *
 * ⚠ Cố ý ASCII và cố ý tiếng Anh: nó đi vào header `From:` của SMTP, nơi ký tự có dấu phải mã hoá
 * theo RFC 2047 và mọi client hiển thị một kiểu. Tên sản phẩm mà NGƯỜI ĐỌC thấy trong thân thư thì
 * theo ngôn ngữ người nhận — xem `PRODUCT_NAME` ở `lib/mail.ts`.
 */
export const PRODUCT_NAME_ASCII = "Comitor AI Usage";
