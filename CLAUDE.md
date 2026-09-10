@AGENTS.md

# CLAUDE.md — hướng dẫn cho Claude khi làm việc trong repo comitor-starter

Dòng `@AGENTS.md` ở trên nạp [AGENTS.md](AGENTS.md) — **kiến trúc, lệnh, quy ước bắt buộc giữ và
cạm bẫy nằm hết ở đó, đọc trước**. Kèm theo nó là
[docs/kien-truc-ung-dung.md](docs/kien-truc-ung-dung.md): sáu tầng, bảng CẤM import của từng tầng,
và checklist dán vào đầu mỗi lần viết mã.

File này chỉ ghi phần riêng của Claude Code: cách xem thử, cách tra API của gói, và giới hạn khi sửa.

Vì sao tách ba file: **AGENTS.md là hợp đồng chung** (agent nào cũng đọc được, và `next dev` tự ghi
khối `nextjs-agent-rules` vào đó), **docs/kien-truc-ung-dung.md là chuẩn tổ chức mã** (dài, đọc một
lần rồi tra lại), **CLAUDE.md là thao tác riêng**. Đừng chép quy ước từ hai file kia sang đây — hai
bản sao của cùng một quy tắc thì bản sai luôn là bản người khác đang đọc.

## ⚠ Trước khi chạy bất cứ thứ gì

**Việc ĐẦU TIÊN: xem `.env` đang là hồ sơ nào.** Repo có hai hồ sơ hạ tầng, và chúng đòi những thứ
khác nhau — bảng đầy đủ ở [README §"Hai hồ sơ hạ tầng"](README.md#hai-hồ-sơ-hạ-tầng-chọn-một):

```bash
grep -E '^(DATABASE_URL|COMITOR_S3_ENDPOINT|COMITOR_MAIL_TRANSPORT)=' .env
```

- `localhost:5436` + `COMITOR_S3_ENDPOINT="http://localhost:9110"` → **hồ sơ docker**, và nó cần
  container: `docker compose up -d && docker compose ps` (ba dịch vụ phải "healthy"). Không có
  chúng thì `pnpm dev` lên được nhưng mọi trang đổ ở truy vấn đầu tiên, và
  `Can't reach database server at localhost:5436` là thứ dễ thấy nhất — đừng tìm nguyên nhân ở chỗ khác.
- `…rds.amazonaws.com:5433` + `COMITOR_S3_ENDPOINT=""` + `COMITOR_MAIL_TRANSPORT="ses"` → **hồ sơ
  RDS**, **KHÔNG cần container nào**. Đừng chạy `docker compose up -d` ở hồ sơ này: nó dựng một
  Postgres mà không ai nối vào, rồi làm người đọc tin là app đang chạy trên đó.

Đổi hồ sơ là GHI ĐÈ `.env`, nên **lưu trước rồi mới chép**: `cp .env .env.docker` (đặt tên theo hồ
sơ đang dùng) rồi `cp .env.rds .env`. `.env` không có lệnh nào sinh lại được — nó mang client
secret dán tay và `COMITOR_SESSION_SECRET` mà xoay là đăng xuất mọi người.
⚠ **Đừng bao giờ tạo file tên `.env.local`** — Next nạp nó ĐÈ LÊN `.env` còn Prisma và
`tsx --env-file=.env` thì không, nên `pnpm dev` chạy một database còn `db:deploy`/`seed` GHI vào
database khác, im lặng. Kiểm bằng banner `- Environments: …` của `next dev`: chỉ được thấy `.env`.

Chưa có `.env` thì `pnpm setup:env` (đừng `cp` trần — xem `scripts/setup-env.ts`; nó cho ra hồ sơ
**docker**). Chưa migrate thì `pnpm exec prisma migrate deploy`. Database trống thì `pnpm seed` —
giao diện vẫn chạy nhưng mọi bảng rỗng, và đó là một trạng thái dễ bị hiểu nhầm thành lỗi.

⚠ **Ở hồ sơ RDS, ba lệnh trên không còn vô hại**: database là của CẢ ĐỘI. `pnpm seed` chạy bảy lệnh
`deleteMany` trên workspace đang seed (kể cả ma trận phân quyền), và `prisma migrate reset` xoá
schema thật. Đọc `DATABASE_URL` trước khi gõ. Và **thư đi ra là thư THẬT** — thử đường gửi bằng
`success@simulator.amazonses.com` (hộp mô phỏng của SES, không tới người thật) rồi đọc log tìm
`[mail] KHÔNG GỬI ĐƯỢC`, vì `sendMail()` nuốt lỗi gửi.

**Xác thực KHÔNG cần dịch vụ chạy tại chỗ.** Mặc định repo trỏ vào bản dev online
`https://account.dev.comitor.ai`; `comitor-account` là repo riêng mà phần lớn người làm module
không đọc được. Cái mất là đường ĐI VÀO: Account online không gọi được `localhost`. Với **webhook**
— route có thật (`app/api/comitor/webhook/route.ts`) — điều đó nghĩa là đừng đi tìm lỗi ở mã, gói
tin chỉ đơn giản không tới. **Back-channel logout thì không tới vì một lý do khác hẳn: repo CHƯA có
route đó**, nên chạy Account tại chỗ hay mở một đường hầm cũng chỉ dẫn tới 404; lý do và điều kiện
dựng lại ghi ở comment của model `AccountSession` trong `prisma/schema.prisma`. Chi tiết ở
[README §"Chuẩn bị ở máy phát triển"](README.md#chuẩn-bị-ở-máy-phát-triển).

## Xem thử thay đổi (Claude Preview)

`.claude/launch.json` khai sẵn một server tên **`comitor-starter`**: chạy `pnpm dev`, cổng **3000** —
**cùng cổng** với lệnh chạy tay trong README. Đừng thêm cờ `--port` chỉ ở một chỗ; lệch cổng là kiểu
lỗi im lặng nhất của repo này (agent chụp màn hình một server, người đọc README mở một server khác,
không ai thấy có gì sai).

⚠ `comitor-starter-v0` — repo prototype, một repo KHÁC — chạy ở **3001**, và `comitor-account` (khi
có ai chạy nó tại chỗ) ở **3200**. Trước khi chụp màn hình, kiểm lại đang nhìn đúng server.

⚠ **Đừng đổi cổng dev sang số khác.** `http://localhost:3000/api/auth/callback` là chuỗi đã đăng ký
bên Account cho client khoá `tasks-web` (hiển thị **Comitor Starter**); đổi cổng là đăng nhập chết
với `invalid_redirect_uri`, và sửa được nó là việc của người quản trị Account chứ không phải một
cờ `--port` ở đây.

Vòng làm việc cho thay đổi giao diện:

1. `pnpm lint:fix` để dọn phần sửa được tự động — nó là CÔNG CỤ, không phải cổng (`biome check
   --write`, KHÔNG có `--error-on-warnings`; xem AGENTS.md §"Warning LÀ lỗi"). Cổng thật là
   **`pnpm check`**, và nó chạy nhiều hơn hẳn tập lệnh người ta hay gõ tay — bản trước của dòng này
   liệt kê năm lệnh và sót đúng một nửa. Cần biết nó gồm gì thì ĐỌC, đừng tin danh sách chép tay:
   `node -p "require('./package.json').scripts.check"`
   ⚠ Hai cổng trong đó là cổng của chính mục này và hay bị bỏ nhất khi sửa giao diện: `color:check`
   (bước 5 dưới đây chỉ là phần MẮT của nó) và `i18n:check` (bước 3).
2. Bật preview, đi mọi route trong **[bản đồ route ở README](README.md#bản-đồ-route)** — `pnpm build` in ra bảng route thật ở cuối, đối chiếu hai cái là biết bản đồ có lệch không.
3. Đi lại vòng đó ở **tiếng Anh**. Đổi nhanh nhất:
   `document.cookie = "comitor-locale=en; path=/"` rồi tải lại — hoặc dùng bộ chọn ngôn ngữ ở
   `/settings` → Chung → Giao diện.
   ⚠ **Đây là bước hay bị bỏ qua nhất, và nó bắt được loại lỗi không có công cụ nào bắt được**: một
   khoá i18n bị sót hiện ra dưới dạng chuỗi khoá thô giữa màn hình, và chỉ hiện với người xem đúng
   ngôn ngữ đó. `pnpm i18n:check` bắt được khoá THIẾU trong file, không bắt được khoá bạn QUÊN GỌI.
4. Chụp màn hình ở **cả hai theme** và **hai bề rộng** (1280px và 375px). Đổi theme nhanh nhất bằng
   `⌘/Ctrl + K` → mục đổi chế độ, hoặc `ThemeToggle` trong `/settings`.
   Có **hai bảng màu** (mặc định = bản duyệt comitor-ds, và bản tương phản cao): thay đổi nào đụng
   tới màu thì xem **cả hai** — bật ở `/settings` → Chung → Giao diện → "Tương phản cao", hoặc
   `localStorage.setItem("comitor-contrast","high")` rồi tải lại.
5. Nghi ngờ màu thì **đo, đừng nhìn**: eval computed style của phần tử và đối chiếu với token của
   gói. Màu sai vai trò (`--x` dùng làm chữ) trông vẫn "đẹp" ở light mode.

Sáu thứ đáng thử tay vì không có test nào bắt được: phím `⌘K` (mở **một lần**, không mở-rồi-đóng),
bấm một app đang khoá trong `AppLauncher` (phải hiện toast nâng cấp), cuộn ngang bảng ở `/tasks`
(cột ghim phải đục, không trong suốt), cuộn ngang **bảng phân quyền** ở `/settings/permissions` ở
375px, **tạo một công việc thật** (rồi kiểm nó xuất hiện ở `/tasks` và ở nhật ký trang chủ), và
**đính kèm một ảnh** (rồi kiểm ảnh hiện được — tức URL đã ký hoạt động).

Thử luồng email — hai đường, theo hồ sơ đang dùng. `console` in ra terminal nhưng **không chạy một
dòng nào** của transport SMTP hay SES, nên nó không chứng minh được gì về đường gửi thật.

- **Hồ sơ docker**: đổi `.env` sang `COMITOR_MAIL_TRANSPORT=smtp` + cổng `1026` rồi mở
  <http://localhost:8026>.
- **Hồ sơ RDS**: đã là `ses`, tức **thư đi ra là thư THẬT** từ tên miền đã xác minh DKIM của
  Comitor. Gửi thử vào hộp **mô phỏng** của chính SES — `success@simulator.amazonses.com`, hoặc
  `bounce@simulator.amazonses.com` cho bounce cứng — nó chạy cả khi tài khoản còn trong sandbox và
  KHÔNG tới người thật.

⚠ Ở cả hai đường, `sendMail()` **nuốt** lỗi gửi và chỉ để lại dòng `[mail] KHÔNG GỬI ĐƯỢC`. Nên
phép thử là **đọc log**, không phải xem lệnh có ném hay không.

## Tra API của `@comitor/ui`

- Tài liệu: `../comitor-ui/README.md` — §3 bảng entry, §5 bảng component, **§6 màu và token** (hợp
  đồng ba vai trò của màu nằm ở đó; **bảng token đầy đủ thì §6 TRỎ RA NGOÀI** — nguồn token là
  `node_modules/@comitor/ui/styles.css`, ĐỌC chứ đừng sửa, còn mọi số đo ở trang foundations/colors
  của design system. §6 KHÔNG có mục con).
  Quy ước nội bộ của gói: `../comitor-ui/CLAUDE.md`.
- Mã nguồn: `../comitor-ui/src/**` — nhanh hơn đọc `.d.ts` khi cần biết một prop thực sự làm gì.
- **Không sửa `node_modules/@comitor/ui`.** Sửa ở `../comitor-ui` → bump version → publish → nâng
  version trong `package.json` ở đây. Sửa trong `node_modules` là mất trắng ở lần `pnpm install`
  sau, và tệ hơn: kết quả trông đúng trên máy bạn nên không ai phát hiện gói vẫn còn thiếu.
- Trước khi tự viết bất cứ thứ gì trông giống component (nút, thẻ, badge, ô nhập, bảng, hộp thoại),
  **tra bảng component ở README §5 của gói trước**. Tầng composite là chỗ hay bị bỏ sót nhất
  (`DataTable`, `PageHeader`, `FormField`, `StatusPill`, `Combobox`, `EmptyState`…).
  ⚠ **Tầng KHÔNG phải entry, và không đoán được entry từ tên.** `ImageUploadField` có trong gói
  nhưng KHÔNG xuất từ `@comitor/ui` — bản trước của dòng này xếp nó vào tầng composite, và lấy nó
  từ entry gốc là một lỗi biên dịch *"has no exported member"*. Thấy tên trong §5 rồi thì tra tiếp
  **§3 (bảng entry)** để biết import từ đâu và nó kéo theo peer optional nào; §3 là chỗ DUY NHẤT
  giữ cặp entry ↔ peer, đừng chép nó xuống đây.

## Tra hợp đồng với Comitor.Account

- `../comitor-account/packages/account-sdk/README.md` — **bảy hành vi ngầm** mà SDK nuốt hộ, và
  §"Bốn lớp guard, bốn thông điệp khác nhau". Đọc trước khi viết bất cứ thứ gì chạm xác thực.
  ⚠ Tiêu đề ấy ghi "**Ba** lớp guard" cho tới 2026-09-05 trong khi bảng ngay dưới nó luôn có BỐN
  hàng — sai từ commit sinh ra nó, và bản trước của dòng này đã chép nguyên cái sai. Đó là lý do
  đáng nhớ: một con số trong TIÊU ĐỀ tài liệu SDK được module chép mà không ai đếm bảng. Số có
  thẩm quyền cho phía này nằm trong mã ở đây: `grep -n GUARD_CODES lib/account/session.ts`.
  Bốn mã và bốn màn hình ở AGENTS.md §"Xác thực".
- `../comitor-account/README.md` §"Hợp đồng API" — bảng endpoint của Account.
- `../comitor-account/CLAUDE.md` §"Ranh giới TOKEN" — access token của app **đọc** được ngữ cảnh
  nhưng KHÔNG quản trị được gì.
- ⚠ **Không app nào ngoài `comitor-account` được import `better-auth/*`.**

## Giới hạn khi sửa

- **Không tự tạo nhánh, không tự `git commit`/`git add`** trừ khi được yêu cầu rõ ràng.
- Khi được giao sửa một tập file cụ thể thì **chỉ sửa đúng những file đó** — repo này hay được nhiều
  phiên làm song song.
- **Đổi lược đồ database là thay đổi có hệ quả**: `pnpm db:migrate` sinh một migration, và migration
  **phải được commit**. Đừng sửa file migration đã áp; sinh một cái mới.
- Đổi phiên bản `@comitor/ui` trong `package.json` là thay đổi có hệ quả: chạy lại `pnpm install`,
  **khởi động lại dev server** (Tailwind quét `node_modules` một lần lúc khởi động), `pnpm build`, và
  xem lại giao diện. Rồi soát lại mục "Cạm bẫy" ở AGENTS.md — một cạm bẫy đã hết hiệu lực còn tệ hơn
  không ghi.
- **Đừng nới kiến trúc để cho qua một lỗi**: không `as any`, không tắt luật lint, không gỡ
  `import "server-only"`, không đưa `fetch()` vào component, không thêm cột đếm để khỏi phải `JOIN`.
  Mỗi khoản trong danh sách đó là một hàng rào đã có người dựng vì một lý do ghi ngay cạnh nó.
- Tài liệu trong repo này (README.md / AGENTS.md / docs/ / file này) phải **khớp với code có thật**:
  tên file, tên route, tên entry, cổng, số phép kiểm. Sửa code mà bỏ tài liệu lệch lại là cách hình
  mẫu bắt đầu nói dối — và bản mẫu nói dối thì mọi sản phẩm sinh ra từ nó chép nguyên cái nói dối đó.
