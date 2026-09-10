# Thêm một THỰC THỂ vào module

Tài liệu này trả lời đúng một câu: *"tôi muốn module của mình có `Invoice` / `Ticket` / `Contact` —
phải chạm những file nào, theo thứ tự nào?"*

Nó **khác** mục ["Thêm một trang mới"](../AGENTS.md#thêm-một-trang-mới) ở AGENTS.md: mục đó nói về
MỘT MÀN HÌNH trên dữ liệu đã có. Đây là cả một thực thể — lược đồ, quy tắc, đường ghi, giao diện,
chuỗi hiển thị. Thêm một trang thì chỉ dùng lại phần **giao diện + điều hướng** của danh sách dưới
đây — `page.tsx`, đảo client, chỗ đặt cụm tự viết, `lib/catalog/navigation.ts`, chuỗi hiển thị và
khoá `nav.*` — cộng phần **đường ghi** (route handler + `lib/api-client/`) nếu trang đó có ghi.

⚠ **Đừng ghim một khoảng số vào câu trên.** Tập bước ấy KHÔNG liền mạch, nên mọi khoảng liền đều
đánh rơi `lib/catalog/navigation.ts` — bước mà quên thì trang chạy hoàn hảo và không ai vào được nó.
Bản trước ghi *"bước 10–13"* trong khi AGENTS.md ghi *"bước 11–13"* cho cùng phép quy chiếu: hai con
số gõ tay ở hai file, cả hai đều thiếu, và chèn thêm một hàng vào bảng là chúng lệch tiếp trong im
lặng. AGENTS.md hôm nay vẫn còn con số ấy — `grep -n "bước 11–13" AGENTS.md`, chạy ở gốc repo — và
chỗ đúng cho nó là bị **xoá**, không phải được chỉnh lại cho khớp.

## Vì sao cần danh sách này

Không phải vì 23 bước là nhiều. Mà vì **kiểu hỏng đặc trưng là bỏ sót đúng những file KHÔNG gây lỗi
biên dịch**: quên khoá `messages/en.json` thì `tsc` xanh, `build` xanh, và lỗi hiện ra dưới dạng một
chuỗi khoá thô — chỉ với người dùng đang xem tiếng Anh. Quên `lib/catalog/navigation.ts` thì trang
chạy hoàn hảo và không ai vào được nó.

Cột **"cổng nào bắt được"** vì thế là cột có giá trị nhất. Ô ghi *"— không cổng nào"* là chỗ **chỉ
con người mới bắt được**, và đó là chỗ phải đọc kỹ.

> Danh sách này được rút ra bằng cách lần theo thực thể `Project` — thực thể thứ hai của repo, thêm
> vào ở Đợt 1, nên dấu vết còn nguyên — rồi đối chiếu với `Task`. Nó không phải lý thuyết.
> ⚠ Và nó đã tự chứng minh: lần thêm `Project` **bỏ sót** bước 22 (bản đồ route ở README), lỗi sống
> qua cả một bản phát hành vì không cổng nào bắt được.

## Danh sách

Thứ tự có phụ thuộc — làm từ trên xuống. `<Entity>` = `Invoice`, `<entity>` = `invoice`.

| # | File | Làm gì | Cổng nào bắt được nếu quên |
|---|---|---|---|
| 1 | `prisma/schema.prisma` | `model <Entity>` — **bắt buộc** có `workspaceId`, và khoá ngoại kép nếu nó thuộc về một thực thể cha | `pnpm tenant:check` bắt được một BẢNG MỚI thiếu `workspace_id` |
| 2 | `prisma/migrations/**` | `pnpm db:migrate`, rồi **commit migration** | `pnpm db:check` (ngoài `pnpm check` — cần shadow DB) |
| 3 | `lib/contracts/<entity>.ts` | `interface <Entity>View` — **CHỈ kiểu**. Mốc thời gian là **chuỗi ISO**, không phải `Date` | `typecheck` bắt sai kiểu; **— không cổng nào** bắt việc lỡ dùng `Date` (Next đổi nó thành chuỗi mà kiểu vẫn nói `Date`) |
| 4 | `lib/core/<entity>-input.ts` | Lược đồ zod dùng CHUNG cho client và server | `typecheck` |
| 5 | `lib/core/<entity>-*.ts` | Quy tắc nghiệp vụ THUẦN | `pnpm core:check` chặn chuỗi hiển thị lọt vào |
| 6 | `lib/core/<entity>-*.test.ts` | Test cho bước 5 — **viết TRƯỚC giao diện** | `pnpm test` (ngưỡng coverage 90%) |
| 7 | `lib/catalog/<entity>.ts` | Bảng khai giao diện: thứ tự, tone, icon, id — **KHÔNG nhãn** | **— không cổng nào** |
| 8 | `lib/<entity>.ts` | Truy cập dữ liệu. `import "server-only"`. Mọi truy vấn lọc `workspaceId` | `pnpm tenant:check` |
| 9 | `app/api/<entity>/route.ts` | Rìa B: phiên → quyền → hình dạng → gọi tầng D | `pnpm api:check` đòi `requirePermission(` + `withApiErrors` |
| 10 | `lib/api-client/<entity>.ts` | Cửa DUY NHẤT giao diện gọi ra ngoài | **— không cổng nào** bắt việc gọi `fetch()` thẳng trong component |
| 11 | `app/(shell)/<entity>/page.tsx` | Server Component + `generateMetadata()` | `build` bắt `metadata` hằng cạnh `"use client"` |
| 12 | `app/(shell)/<entity>/<entity>-list.tsx` | Đảo client, nhận prop THUẦN | **— không cổng nào** cho `Date`/`Decimal`/hàm qua ranh giới. `Decimal` và hàm ném **ở LÚC CHẠY** (cả trang rơi vào `error.tsx`), mà **mọi route của app là `ƒ`** — bảng route ở cuối `pnpm build` chỉ có `/icon.svg` là `○` — nên `build` không render trang nào để lỗi kịp xảy ra. `Date` thì không ném gì: Next đổi nó thành chuỗi còn kiểu vẫn nói `Date`, cùng ca với nửa sau của bước 3. Có cổng cho đúng MỘT hình dạng: `<RelativeTime>` đặt ngoài file `"use client"` — `pnpm i18n:check` §8, **nhánh `!isClient`** ("Locale của date-fns chứa HÀM"), không phải nhánh "thiếu `locale`" (nhánh đó là lỗi ngôn ngữ, không phải lỗi ranh giới) |
| 13 | `components/` **hoặc** cạnh route | Cụm tự viết — quy tắc chỗ đặt ở AGENTS.md | **— không cổng nào** |
| 14 | `lib/catalog/navigation.ts` | Mục điều hướng. **Nguồn sự thật DUY NHẤT** — thanh bên, off-canvas, ⌘K đều đọc từ đây | **— không cổng nào.** `href` chỉ là chuỗi; link chết chỉ lộ khi có người bấm |
| 15 | `messages/vi.json` + `messages/en.json` | Mọi chuỗi hiển thị, kể cả `aria-label`/`title`/`placeholder` | `pnpm i18n:check` bắt khoá lệch giữa hai file, khoá chứa dấu chấm, tham số ICU lệch, markdown, `t("…")` thiếu `{}`, `<RelativeTime>` sai bên ranh giới |
| 16 | `messages/*` mục `nav.*` | Nhãn cho bước 14 | `pnpm i18n:check` |
| 17 | `lib/catalog/permissions.ts` | Quyền theo chức năng của thực thể mới | `pnpm i18n:check` (khoá suy từ mã) |
| 18 | `app/api/permissions/route.ts` | Thêm mã quyền vào lược đồ zod **viết tay** | `typecheck` — cố ý viết tay để nó ĐỎ |
| 19 | `lib/contracts/settings.ts` | Thêm mã quyền vào union | `typecheck` |
| 20 | `lib/i18n/ui-labels.tsx` | Nếu dùng control mới của gói: phủ prop nhãn RỜI | **— không cổng nào.** Prop optional nên `tsc` hài lòng, chuỗi nằm trong gói nên `i18n:check` không thấy |
| 21 | `lib/permissions.ts` · `lib/settings.ts` | Nếu thực thể có cài đặt riêng | `typecheck` |
| 22 | `README.md` §"Bản đồ route" | Thêm route mới vào bảng | **— không cổng nào.** Đây đúng là bước lần thêm `Project` đã quên |
| 23 | `README.md` §"Ranh giới: giữ / thay / xoá" | Xếp file mới vào đúng nhóm | **— không cổng nào** |

## Những ô "không cổng nào" — đọc lại trước khi mở PR

Bước **7, 10, 13, 14, 20, 22, 23**, cộng nửa sau của bước 3 và **nửa `Date` của bước 12**. Tất cả
đều hỏng IM LẶNG, và tất cả
đều được bắt bằng đúng một việc: **đi thật một vòng** qua bản đồ route ở README, ở cả hai ngôn ngữ, cả hai theme, 1280px và
375px. Đó là lý do vòng đi tay chưa bao giờ được thay bằng một cổng.

⚠ Ô cổng của bước 12 từng ghi *"`build` bắt `Date`/`Decimal`/hàm qua ranh giới"*. Nó **SAI**, và sai
theo kiểu nguy hiểm hơn một ô ghi thẳng "không cổng nào": một ô gọi đích danh sai tên cổng dạy người
đọc rằng `pnpm build` xanh là đã kiểm xong ranh giới server → client.

## Cái KHÔNG có, và vì sao

**Không có `scripts/scaffold-entity.ts`.** Một generator sinh 23 file là 23 file người viết không
đọc, và nó đóng băng khuôn đúng vào ngày nó được viết — khuôn đổi thì generator nói dối. Checklist
trước, generator sau, và có thể không bao giờ.
