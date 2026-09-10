<!--
  Sáu ô dưới đây được chép nguyên văn từ docs/kien-truc-ung-dung.md §7.
  Trước file này chúng là văn bản chết: chúng nằm trong một tài liệu 416 dòng mà không ai mở ra
  lúc đang mở PR. Ở đây thì chúng tự hiện ra đúng lúc cần.

  Xoá một ô KHÔNG áp dụng thì ghi luôn vì sao — dòng đó là thứ người review đọc kỹ nhất.
-->

## Thay đổi gì

<!-- Một đoạn. Người review cần biết VÌ SAO trước khi đọc mã. -->

## Trước khi gửi

- [ ] Không có phép tính nghiệp vụ nào trong file `.tsx`
- [ ] Không có chuỗi hiển thị nào ngoài `messages/*.json`
- [ ] Không có hàm nào trong `lib/core/` trả về chuỗi hiển thị
- [ ] Nhánh hỏng có test, không chỉ nhánh thành công
- [ ] Đã đi thật một vòng ở CẢ `vi` và `en`, ở CẢ hai theme, ở 1280px và 375px
- [ ] Thao tác ghi mới đã có chốt quyền ở máy chủ, không chỉ ẩn nút

## Nếu có chạm tới

- [ ] **Lược đồ database** → đã chạy `pnpm db:migrate` và **migration đã được commit**
- [ ] **`lib/core/`** → đã sửa test trong cùng lần này
- [ ] **Phiên bản `@comitor/ui`** → đã `pnpm install`, **khởi động lại dev server**, và soát lại mục "Cạm bẫy" ở AGENTS.md
- [ ] **Tài liệu** (README / AGENTS.md / docs/) → vẫn khớp với mã có thật: tên file, tên route, cổng, số phép kiểm
