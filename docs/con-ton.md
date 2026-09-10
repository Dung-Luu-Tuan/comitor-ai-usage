# Còn tồn — cái CHƯA làm, và điều kiện để biết khi nào phải làm

Tài liệu này khác [mục "Không làm" ở README](../README.md): ở đó là những thứ đã quyết định **không
bao giờ** thêm vào starter. Ở đây là những thứ **sẽ phải làm**, chỉ là chưa phải bây giờ.

**Mỗi mục bắt buộc có một điều kiện kiểm được bằng một LỆNH.** Không có nó thì câu "đợi tới khi có
module thật" sẽ được trả lời bằng cảm tính ở lần hỏi sau, và cuộc điều tra sinh ra danh sách này
phải chạy lại từ đầu.

---

## 1. Nhật ký thay đổi quyền & cài đặt (`AuditEvent`)

**Câu chưa trả lời được:** *"Ai bật quyền `task.delete` cho `member`, lúc nào?"* — hôm nay không trả
lời được kể cả bằng SQL, vì `savePermissionMatrix` lưu bằng `deleteMany` + `createMany`.

**Vì sao chưa làm.** Một module đặt phân quyền một lần lúc khởi tạo thì bảng ấy **rỗng vĩnh viễn** ở
cả năm repo — đúng lý do đã bác `audit_logs` chung. Nặng hơn: sổ bắt đầu RỖNG và không backfill
được, nên quản trị viên đọc "chưa ai đổi gì" trong khi sự thật là "chưa ai đổi gì KỂ TỪ KHI có sổ".
Một giao diện nói dối mua được sự tự tin còn tệ hơn không có tính năng.

**Bốn đặc tính khiến nó KHÔNG gộp được vào `activities`** — ghi lại vì đây là phần đắt nhất của
cuộc điều tra, và là thứ người làm sau cần:

| | `activities` | `audit_events` |
|---|---|---|
| Lỗi khi ghi | NUỐT (`recordActivity` bọc try/catch — mất một dòng nhật ký không đáng làm hỏng một lần tạo việc) | **NỔ** — mất một dòng audit là mất bằng chứng |
| Ranh giới giao dịch | NGOÀI | **TRONG** — audit và thay đổi phải cùng sống hoặc cùng chết |
| Ai đọc được | mọi thành viên | **chỉ người có `app.permissions`** |
| Vòng đời | theo `archiveAfter` | **giữ lâu hơn, thường theo luật** |

**Làm khi:** có một khách hàng B2B hỏi thật, HOẶC `savePermissionMatrix` được gọi quá 12 lần trong
30 ngày ở một workspace bất kỳ — tức phân quyền đã thành thứ người ta SỬA chứ không phải thứ đặt một
lần. Đếm bằng cách bật một dòng log ở `savePermissionMatrix` rồi:

```bash
grep -c "\[perms\] ĐÃ LƯU MA TRẬN" /var/log/comitor-tasks/*.log
```

---

## 2. Xoá dữ liệu cá nhân và vòng đời workspace

**Còn thiếu gì.** `user.deleted` từ Account hiện **thu hồi phiên** nhưng KHÔNG dọn dữ liệu, trong
khi danh mục sự kiện của Account ghi nguyên văn *"app PHẢI dọn dữ liệu cá nhân (nghĩa vụ pháp lý)"*.
Và không bảng nào có khoá ngoại tới workspace, nên xoá workspace ở Account không kéo theo gì.

**Vì sao chưa làm.** Vùng nguy hiểm ở `/settings/advanced` là **chỗ duy nhất trong khu cài đặt chưa
nối máy chủ, và cố ý** — lý do ghi ngay trong file: *"một endpoint xoá sạch dữ liệu của cả không
gian làm việc không phải thứ nên có mặt sẵn trong một bản khởi tạo"*. Ba rủi ro nặng nhất đều KHÔNG
kiểm được bằng máy: phép xoá là I/O nên không xuống `lib/core/` được (không test nào phủ thứ tự bảy
bước xoá), một `if (reason === "deleted")` sai là xoá sạch dữ liệu của khách chậm thanh toán, và
quên bước `SELECT attachment_key` TRƯỚC khi xoá hàng là mất khoá object **vĩnh viễn** — khoá không
mang `workspace_id` nên không dò ngược được.

✅ **Phần "thiếu một dấu" ĐÃ TRẢ.** Vùng nguy hiểm nay mang `<NotWiredUp />`
(`app/(shell)/settings/advanced/advanced-settings-form.tsx`) — cố ý KHÁC `<NotYetActive />`: cái sau
nói *"giá trị được lưu, chưa có gì đọc"*, đúng cho một ô cài đặt và sai cho một cái NÚT, thứ không
lưu giá trị nào. Phần còn nợ chỉ là chính đường xoá dữ liệu.

**Làm khi:** module thật có khách hàng thật — cụ thể là khi Account bắt đầu gửi `user.deleted` cho
một người dùng có dữ liệu trong module này. Kiểm:

```bash
grep "user.deleted" /var/log/comitor-tasks/*.log | head
```

---

## 3. Cổng `server:check`

**Lỗ đã thừa nhận.** `docs/kien-truc-ung-dung.md` §4 ghi rằng `import "server-only"` bắt được đường
bắc cầu nhưng **không bắt được "file quên khai nó"**.

**Vì sao chưa làm — đã đo, không phải phỏng đoán:** 25 file trong `lib/` mang dấu, **0 vi phạm** —
hai file trong tầm quét mà KHÔNG mang dấu là `lib/format.ts` và `lib/today.ts`, và đó là CỐ Ý (lý do
ngay trên khối lệnh dưới), nên đoạn văn này và lệnh kia nói cùng một chuyện.
⚠ Con số này TRÔI theo mỗi lần thêm file; đếm lại bằng
`grep -rl 'import "server-only"' lib --include='*.ts' | wc -l` chứ đừng tin dòng này.
File duy nhất chạm bề mặt máy chủ mà không mang dấu là `lib/i18n/actions.ts`, và nó mở đầu bằng
`"use server"` — ngoại lệ nội tại. Lỗ này còn bị bịt gián tiếp: một file `lib/` mới gần như luôn
import `lib/env.ts` hoặc `lib/prisma.ts`, cả hai ĐÃ mang dấu, nên chuỗi bắc cầu vẫn nổ ở
`pnpm build`; phần dư — một file `lib/` đọc thẳng `process.env` — đã bị luật *"`lib/env.ts` là chỗ
DUY NHẤT đọc `process.env` cho CẤU HÌNH"* cấm sẵn.

**Làm khi** lệnh dưới đây ra **khác 0**:

⚠ `lib/format.ts` và `lib/today.ts` bị loại TƯỜNG MINH trong chính lệnh, và cả hai là dương tính giả
CỐ ĐỊNH chứ không phải vi phạm: chúng là hàm THUẦN, không chạm bề mặt máy chủ nào (không Prisma,
không `process.env`, không bí mật). `lib/format.ts` còn được import từ ba file `"use client"` —
`tasks/task-table.tsx`, `tasks/new/task-request-form.tsx`, `projects/project-list.tsx` — mà
`server-only` NÉM khi bị nạp vào đồ thị client, nên thêm dấu vào là **vỡ build**. `lib/today.ts` hôm
nay chỉ có người gọi phía máy chủ nên thêm dấu vào sẽ *chạy được*, nhưng đừng: nó là cặp sinh đôi của
`format.ts` và sẽ khoá đường dùng `todayIso()` ở đảo client đầu tiên cần tới.

⚠ **Bản trước KHÔNG loại hai file đó, nên lệnh LUÔN in ra đúng hai dòng ấy** — đã đo, và nó in hai
dòng ngay từ commit viết ra mục này (`a873f21`). Tức điều kiện kích hoạt đã được thoả từ ngày đầu:
một "điều kiện kiểm được bằng lệnh" không bao giờ đổi trạng thái thì không phải một điều kiện, và
người sau chạy nó sẽ đi dựng cổng cho một lỗ mà đoạn văn ngay trên nói là 0 vi phạm.

⚠ Thấy mình sắp thêm tên thứ BA vào `grep -v` này thì DỪNG: hoặc file đó thật sự client-safe (thì
thêm, kèm lý do ngay tại đây), hoặc nó chính là cái vi phạm mà lệnh được dựng để bắt. Nới danh sách
cho lệnh xanh trở lại là gỡ cầu chì.

```bash
comm -23 \
  <(ls lib/*.ts lib/*/*.ts \
      | grep -vE "^lib/(core|contracts|catalog|i18n|api-client)/" \
      | grep -vE "^lib/(format|today)\.ts$" | sort) \
  <(grep -rl 'import "server-only"' lib --include="*.ts" | sort)
```

---

## 4. Khuôn integration test

**Còn thiếu gì.** `pnpm test` chỉ chạy `lib/core/`. Không có khuôn nào trả lời *"integration test ở
Comitor trông thế nào"*.

**Vì sao chưa làm.** Repo đã HAI lần từ chối cùng hình dạng này với cùng lý lẽ: Playwright (*"bàn
giao một bộ e2e chưa ai chạy là bàn giao một thứ sẽ đỏ vì lý do không liên quan rồi bị tắt"*) và
Dockerfile multi-stage. Nặng hơn: một bộ integration test **không render một pixel nào**, nên nó
không chạm bốn lớp lỗi mà chỉ vòng đi tay bắt được — khoá i18n sót, vai trò màu ở dark, tràn ngang ở
375px, chuỗi `en` dài hơn `vi` làm vỡ nút. Mà cảm giác *"đã có test cho đường ghi rồi"* là thứ làm
vòng đi tay bị bỏ DẦN, không bỏ trong một ngày, nên không ai chỉ được lúc nào.

**Làm khi** module có nhiều đường ghi hơn mức đọc bằng mắt được — ngưỡng: **quá 12 route handler
ghi**:

```bash
grep -rlE "export const (POST|PUT|PATCH|DELETE)" app/api --include="route.ts" | wc -l
```

---

## 5. `seal`/`open`: chuyển hẳn xuống `lib/core/`

Phần THUẦN đã xuống (`lib/core/session-envelope.ts`, 13 test). Phần mật mã ở lại tầng D vì
`node:crypto` không chạy ở edge runtime, và `lib/core/request-id.ts` đã cố ý tránh cả `Buffer` vì lý
do đó — thứ duy nhất ngăn người sau import một `lib/core/seal.ts` từ `proxy.ts` sẽ là một COMMENT,
mà repo đã có câu trả lời cho hình dạng ấy: *"bất biến là CẤU TRÚC, không phải kỷ luật"*.

**Làm khi** có người thật sự phải đụng ĐỊNH DẠNG NIÊM (đổi thuật toán, thêm phiên bản định dạng, xoay
khoá theo tiền tố) — đó cũng là ngày một véc-tơ test vàng có người đọc.

Điều kiện ấy đọc được bằng máy, không cần ai phán đoán: ĐỊNH DẠNG NIÊM được ghim bởi đúng NĂM hằng —
tiền tố muối, thuật toán, độ dài IV, độ dài thẻ GCM, số mảnh của phong bì. **Ra khác 5 nghĩa là có
người vừa đụng định dạng.** (`sort -u` là cố ý: hai hằng đầu xuất hiện hai lần, và thêm bớt một lần
xuất hiện thì không phải đổi định dạng.)

```bash
grep -hoE '"comitor-session-v1"|"aes-256-gcm"|IV_LENGTH = 16|TAG_LENGTH = 22|parts\.length !== 3' \
  lib/account/session-store.ts lib/core/session-envelope.ts | sort -u | wc -l
```

⚠ Mục này từng là mục DUY NHẤT trong tài liệu KHÔNG có lệnh — điều kiện của nó là "có người thật sự
phải đụng", tức đúng cái cảm tính mà dòng đầu file dựng ra để cấm. Một tài liệu vi phạm luật của
chính nó thì dạy người sao chép starter rằng luật ấy là tuỳ chọn.

---

## 6. `workspace.slug_changed`

Phiên lưu `workspaceSlug`, nên đổi slug làm mọi phiên đang mở trỏ vào một slug không còn tồn tại và
người dùng nhận `NOT_A_MEMBER` — một câu SAI về nguyên nhân. Không sửa rẻ được: payload phiên được
NIÊM nên không truy theo slug, đổi khoá tra cứu là đổi lược đồ.

**Làm khi** có module báo ca này, HOẶC `account_sessions` mang thêm cột tra cứu được vì một lý do
khác. Dấu vết để tìm:

```bash
grep "\[webhook\] SLUG ĐỔI" /var/log/comitor-tasks/*.log
```
