# Đóng góp vào comitor-starter

Repo này là **bản mẫu**, không phải một sản phẩm. Mỗi thay đổi ở đây sẽ được nhân bản vào mọi
module Comitor sinh ra sau nó — kể cả những thay đổi trông như dọn dẹp. Vì vậy quy trình ở đây
nghiêm hơn một repo bình thường một chút, và chỗ nghiêm hơn nằm ở **lý do**, không ở thủ tục.

> **Đọc trước:** [AGENTS.md](AGENTS.md) — quy ước bắt buộc giữ và những cạm bẫy đã gặp thật.
> [docs/kien-truc-ung-dung.md](docs/kien-truc-ung-dung.md) — mỗi dòng mã thuộc về đâu.

---

## Trước khi gửi

```bash
pnpm check
```

Tất cả phải xanh. Chúng cũng chạy tự động trên mọi PR
([`.github/workflows/check.yml`](.github/workflows/check.yml)), nhưng chạy ở máy thì vòng phản hồi
ngắn hơn nhiều.

Nếu là thay đổi giao diện thì chạy thêm một vòng đi thật: mọi route trong **[bản đồ route ở README](README.md#bản-đồ-route)** — `pnpm build` in ra bảng route thật ở cuối, đối chiếu hai cái là biết bản đồ có lệch không, ở **cả `vi` và `en`**, **cả sáng và tối**, ở **1280px và
375px**. Bốn lớp lỗi chỉ lộ ra ở đó và không cổng nào bắt được — chi tiết ở AGENTS.md
§"Kiểm chứng thay đổi".

Sáu ô checklist trước-PR nằm sẵn trong [`.github/pull_request_template.md`](.github/pull_request_template.md).

---

## Khuôn commit

`type(scope): mô tả bằng tiếng Việt` — **quy ước này đã được giữ ở 100% commit từ đầu repo**, và
cho tới file này thì nó không được ghi ở đâu cả.

| Phần | Ngôn ngữ | Ghi chú |
|---|---|---|
| `type` | Anh | `feat` · `fix` · `refactor` · `docs` · `chore` |
| `scope` | Anh | Tuỳ chọn. Đã dùng thật: `auth`, `api`, `db`, `ci`, `dx`, `i18n`, `arch`, `module`, `deps` |
| Mô tả | **Việt** | Câu thường, không viết hoa đầu, không dấu chấm cuối |
| Thân | **Việt** | Bắt buộc khi thay đổi chạm file khung — xem dưới |

Thêm `!` sau scope cho thay đổi phá vỡ (`refactor!:`, `feat!:`).

**Thân commit trả lời "vì sao", không trả lời "cái gì"** — phần "cái gì" đã nằm trong diff. Với một
repo mẫu, phần đắt nhất của một thay đổi là **lý do** của nó: người đọc nó sáu tháng sau là người
đang cân nhắc có nên đảo ngược nó không, ở một module khác, mà không có mặt lúc quyết định.

Khi thay đổi dựa trên một phép đo, **ghi con số vào thân commit**. Ví dụ có thật trong lịch sử:
`PUT /api/task-drafts` không phiên trả `500 INTERNAL_ERROR` kèm `[api] LỖI KHÔNG XỬ LÝ Error:
NEXT_REDIRECT`. Không có con số đó thì bản sửa trông như một sở thích kiến trúc.

## Khuôn tên nhánh

`type/mo-ta-khong-dau` — `fix/xoay-token-dua`, `feat/route-dong-tasks`. Không dấu tiếng Việt trong
tên nhánh: nó đi vào URL, vào tên thư mục worktree, và vào tên ảnh CI.

---

> Thêm một THỰC THỂ mới vào module thì đi theo
> [docs/them-mot-thuc-the.md](docs/them-mot-thuc-the.md) — 23 bước, và cột cuối nói bước nào
> **không cổng nào bắt được** nếu bạn quên.

## Thay đổi chạm FILE KHUNG

"File khung" = thứ mọi module chép nguyên và không sửa: `lib/account/`, `lib/api/`, `lib/env.ts`,
`lib/prisma.ts`, `lib/storage.ts`, `lib/mail.ts`, `lib/permissions.ts`, `lib/i18n/`, `proxy.ts`,
`instrumentation.ts`, `app/api/auth/`, `.github/`, `scripts/check-*`, và phần hạ tầng của
`lib/core/`. Danh sách đầy đủ theo quy tắc nhận biết ở [README §"Ranh giới: cái gì giữ, cái gì
thay, cái gì xoá"](README.md#ranh-giới-cái-gì-giữ-cái-gì-thay-cái-gì-xoá).

Ba việc thêm, và cả ba đều rẻ:

1. **Thêm một mục vào [CHANGELOG.md](CHANGELOG.md)**, ghi rõ *file khung nào đổi* và *module đã
   sinh ra phải làm gì*. Mục thứ hai mới là mục có giá trị — nó là thứ duy nhất một đội đang bảo
   trì module của họ đọc.
2. **Đặt tag** khi bản sửa đáng để các module kéo về: `git tag v0.x.0`. Không tag thì không có gì
   để so, và "bản khung nào đang chạy ở module nào" trở thành một câu không ai trả lời được.
   ⚠ **`version` trong `package.json` phải đổi trong CÙNG commit** — nó không phải siêu dữ liệu:
   `next.config.ts` bơm nó vào `NEXT_PUBLIC_APP_VERSION` và chân thanh bên in nó ra. Repo này đã
   trôi đúng chỗ đó ở lần phát hành thứ hai (tag `v0.2.0`, `package.json` còn `0.1.0`), và triệu
   chứng là thứ tệ nhất một con số phiên bản có thể gây ra: **báo lỗi kèm phiên bản sai** đưa người
   trực đi soi một bản không chứa lỗi. `pnpm version:check` nay chặn việc đó.
3. **Đừng reformat những file đó** trong cùng một PR. Một lần chạy formatter trên file khung biến
   mọi lần merge ngược sau này của mọi module thành một xung đột — đây là cách nhanh nhất để cắt
   đứt đường nhận bản vá của cả hệ.

⚠ Vì sao ba việc trên không phải thủ tục: **5 commit liên tiếp gần nhất trước khi có file này đều
là `fix(auth)`**, chạm đúng `lib/account/session-store.ts`, `session.ts`, `app/api/auth/**` — tức
đúng những file mọi module chép nguyên và không bao giờ mở ra. Và lỗi mà chúng sửa (đua khi xoay
refresh token) **tự che**: người dùng bị đá ra rồi SSO đưa lại trong dưới một giây, nên không ai
báo lỗi. Dấu vết duy nhất là một dòng log máy chủ. Một module chạy bản khung cũ sẽ mang lỗi đó
hàng tháng mà không ai biết.
