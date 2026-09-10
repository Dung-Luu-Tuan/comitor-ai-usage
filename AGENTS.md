# AGENTS.md — quy ước cho agent làm việc trong repo comitor-starter

**comitor-starter** là **bản khởi tạo đầy đủ** cho mọi sản phẩm SaaS mới của Comitor (Tasks, Chat,
CRM, HR…): Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + Prisma/PostgreSQL, giao
diện lấy từ gói dùng chung **`@comitor/ui`**, đa ngôn ngữ bằng `next-intl`, xác thực đi qua
**Comitor.Account**.

Đọc [README.md](README.md) để biết app này *là gì* và *chạy thế nào*;
[docs/kien-truc-ung-dung.md](docs/kien-truc-ung-dung.md) để biết **mỗi dòng mã thuộc về đâu**. File
này chỉ ghi những điểm **KHÔNG hiển nhiên từ code** và những quy ước phải giữ. Cái gì sửa ở đây cũng
sẽ được nhân bản sang mọi module sau — đây là hình mẫu, không phải bản nháp.

> ⚠ **Đừng nhầm với `comitor-starter-v0`.** Đó là một repo KHÁC: bàn dựng prototype giao diện, cố ý
> chỉ có giao diện và dữ liệu tĩnh, chạy ở cổng 3001. Hai repo tách nhau từ 2026-08-31 và **không
> còn đồng bộ**. Chiều chép đúng là từ v0 SANG đây (kèm rút chuỗi ra `messages/` và nối cổng API),
> không bao giờ ngược lại.

## Xác thực — ĐÃ NỐI qua `@comitor/account-sdk`

Luồng OIDC authorization code + PKCE. Phiên nằm ở **database của module** (bảng `account_sessions`,
token niêm AES-256-GCM); cookie chỉ mang một định danh mờ.

**Bốn file trong `lib/account/` giữ nội tạng phiên:** `config.ts` · `session-store.ts` ·
`session-cookie.ts` · `session.ts`. Ngoài chúng, chỉ những chỗ sau được import thẳng
`session-store`/`session-cookie`, mỗi chỗ vì một lý do không đi qua `requireSession()` được:
· ba route ở `app/api/auth/` — `sign-in` mở luồng OIDC, `callback` tạo phiên và GHI cookie,
  `sign-out` huỷ phiên và XOÁ cookie;
· `app/api/workspace/route.ts` — đổi không gian làm việc là GHI HÀNG phiên (`updateSession`); nó
  chỉ ĐỌC cookie chứ không ghi, nên luật "cookie phiên chỉ ghi ở `callback`, xoá ở `sign-out`" bên
  dưới vẫn nguyên;
· `app/api/comitor/webhook/route.ts` — THU HỒI phiên theo lệnh Account (`revokeSessionsForUser`),
  và đường này KHÔNG có phiên người dùng nào;
· `app/signed-out/page.tsx` — đọc CỜ đăng xuất toàn cục (`readGlobalSignOut`), một cookie RIÊNG
  chứ không phải cookie phiên; nó không chạm hàng phiên.

**Mọi trang khác chỉ gọi `requireSession()`; mọi route handler khác cần phiên gọi
`requireApiSession()`** — hai hàm chứ không một, vì `requireSession()` kết thúc bằng `redirect()`,
mà ở rìa B `withApiErrors` bắt nó rồi trả **500**. Lý do đầy đủ ở §"Quy ước bắt buộc giữ",
gạch đầu dòng "Nghiệp vụ nằm ở `lib/*.ts`".

⚠ Bản trước ghi "Bốn file + **ba route**", rồi chốt bằng "mọi trang và route handler khác chỉ gọi
`requireSession()`" — SAI cả hai vế: danh sách thiếu ba chỗ, và `app/api/` không có lấy một lời gọi
`requireSession()` nào. Đừng đếm bằng mắt:
`grep -rl 'account/session-store"\|account/session-cookie"' app lib components hooks`

Sáu điều phải giữ:

- **Đừng import `better-auth/*`.** Không app nào ngoài `comitor-account` được phép. SDK là lớp cách
  ly nuốt bảy hành vi ngầm của tầng OIDC, và là thứ cho phép đổi thư viện sau này mà không sửa app.
- **Token KHÔNG được quay về cookie.** Bản trước cất cả bộ token trong cookie, và nó hỏng ở lần
  xoay đầu tiên: **Next cấm ghi cookie trong lúc render trang**, mà `getSession()` chạy từ
  `page.tsx`. Account xoay xong là token cũ chết, còn bộ mới thì không lưu được — phiên rơi mỗi
  ~15 phút và Account xoá cả họ token vì phát hiện tái sử dụng. Đo được 2026-09-01; log ở đầu
  `lib/account/session-store.ts`. Cookie phiên chỉ được ghi ở `callback` và xoá ở `sign-out`.
- **`onRotate` không phải tuỳ chọn.** Account bật rotation: xoay token là bản cũ chết NGAY. Không
  lưu bộ mới thì người dùng bị đăng xuất sau ~15 phút, với một triệu chứng không gợi gì tới nguyên
  nhân.
- **Sàn phiên bản SDK là `0.2.0`, đừng hạ.** `ensureFreshTokens` của 0.1.0 để hai request đồng thời
  cùng xoay MỘT refresh token; Account xoay xong là bản cũ chết, nên request thua nhận 401 và phiên
  rơi. Đã đo trên luồng thật ở repo này. ⚠ Nó **tự che**: người dùng bị đá về đăng nhập rồi SSO đưa
  họ quay lại trong dưới một giây, nên không ai báo lỗi — dấu vết duy nhất là dòng
  `[auth] KHÔNG XOAY ĐƯỢC TOKEN` trong log máy chủ.
  Sàn nâng lên `0.2.0` vì `AccountUser` từ bản đó mới mang bốn trục hiển thị; ở `0.1.1` chúng
  KHÔNG tồn tại, nên `lib/account/session.ts` sẽ không biên dịch.
- **Bốn mã guard → bốn màn hình.** `NOT_A_MEMBER` · `APP_NOT_ENABLED` · `NO_SEAT` ·
  `APP_SUSPENDED`. Gộp lại là bắt người dùng tự đoán phải đi hỏi ai.
- **Thiếu cấu hình thì KHÔNG ai vào được**, không phải ai cũng vào được. `accountConfigured` là
  fail-closed; đừng thêm một "phiên dự phòng" nào.

⚠ **Hai hợp đồng liên module đã chốt, và cả hai KHÔNG sửa được sau khi có năm module** — không vì
kỹ thuật khó, mà vì phải đổi năm repo cùng lúc và nếu không cùng thì việc sửa vô nghĩa:

1. **Mọi liên kết chéo app mang `?w={slug}`.** Workspace nằm trong phiên RIÊNG của từng module, nên
   người đổi sang "Công ty B" ở Tasks rồi bấm sang Chat sẽ thấy Chat vẫn mở "Công ty A" — không gì
   báo, và họ thao tác nhầm không gian làm việc.
   ⚠ **Đã chốt nhưng CHƯA DỰNG, ở CẢ HAI ĐẦU** — đó là chỗ khác duy nhất với hợp đồng #2 bên dưới,
   thứ đã cài đủ. Đầu GỬI (`appUrlFor()` của SDK, gọi từ `lib/account/session.ts`) hôm nay cho app
   anh em URL trần `{baseUrl}/w/{slug}`; đầu NHẬN chưa có
   route nào đọc `w`. Đừng đọc câu trên như mô tả mã hôm nay, đếm lại:
   `grep -rn '?w=' app lib components hooks --include='*.ts' --include='*.tsx'` — hôm nay mọi kết
   quả đều là CHÚ THÍCH, không một dòng mã.
   **Lý do đầy đủ VÀ chỗ sửa ở `lib/account/session.ts`** — một bản duy nhất, đừng chép sang đây.
2. **Tuỳ chọn hiển thị: Account giữ MẶC ĐỊNH, thiết bị giữ giá trị CÓ HIỆU LỰC.** SÁU trục, và tất
   cả đều là của HỒ SƠ Account: ngôn ngữ, múi giờ (`AccountUser.locale` / `.timezone`, có từ SDK
   0.1.1) cùng sáng/tối, tương phản, mật độ, cỡ chữ (`AccountUser.theme` / `.contrast` / `.density`
   / `.fontSize`, có từ SDK **0.2.0**). Module sao chép chúng xuống thiết bị **chỉ ở route callback
   OIDC**, theo luật CÓ DẤU: *đi theo Account, trừ khi người dùng đã tự đổi trên thiết bị này*. Và
   **không module nào ghi ngược lên Account** — `assertSessionActor` bên Account ném 403 cho mọi
   actor không phải phiên người dùng, nên mọi "cái này quản ở Account" vĩnh viễn là ĐỌC + LIÊN KẾT.

   ⚠ **HAI ĐÍCH KHÁC NHAU, VÀ SỰ KHÁC NHAU ẤY KHÔNG PHẢI TUỲ HỨNG:**
   · **ngôn ngữ + múi giờ → COOKIE** (`lib/i18n/adopt.ts`), vì **máy chủ** phải đọc chúng để render
     HTML đầu tiên đúng thứ tiếng và đúng múi giờ;
   · **bốn trục hiển thị → `localStorage`** (`components/display-prefs-seed.tsx`), vì máy chủ KHÔNG
     bao giờ đọc chúng — chúng phải áp **trước lượt sơn đầu tiên**, và chỉ một script đồng bộ đọc
     `localStorage` làm được điều đó.

   ⚠ **Đường prop KHÔNG dùng được, đã đo trên `dist` của gói.** `AxisScript` chỉ nhận `storageKey`
   và `nonce`; chuỗi script nó dựng đóng gói `config.defaultValue` — HẰNG của gói — nên prop
   `defaultValue` chỉ tới được `useState` và một `useEffect`, tức SAU lượt sơn. `ContrastScript` còn
   hẹp hơn: chỉ áp đúng chuỗi `"high"`. Truyền mặc định qua prop = **nháy giao diện**, tệ nhất ở hai
   trục trợ năng. Vì vậy script gieo của app phải là **con ĐẦU TIÊN của `<body>`**, trên mọi
   provider — thứ tự trong tài liệu là thứ tự chạy.

   ⚠ **Script ấy mang nonce CSP, nên nó là một bề mặt tấn công.** Giá trị đi vào nó có nguồn là
   cookie, mà cookie thì client sửa được — và nonce khiến CSP KHÔNG chặn thứ chèn vào đó. Luật:
   **chỉ hằng của repo được đi vào chuỗi script**. `lib/core/display-prefs.ts` lọc qua tập đóng và
   trả về phần tử của chính mảng hằng; nó có test cho cả ca `</script>`, `";alert(1)//` và
   `__proto__`. Ai thấy mình `${}` một biến không phải hằng vào đó thì dừng lại.

   ⚠ **HAI ĐƯỜNG ĐỌC, HAI ĐỘ TƯƠI — và phải biết cái nào có thẩm quyền ở đâu.** Cùng một giá trị
   "múi giờ người xem" tới hai chỗ bằng hai đường, và đó là CỐ Ý chứ không phải thiếu sót:
   · **cookie** (`comitor-tz`) nuôi `i18n/request.ts`, thứ chạy TRƯỚC và NGOÀI mọi phiên — kể cả ở
     bốn màn hình chặn và `/sign-in-failed`, nơi không gọi được sang Account. Nó đông cứng ở lần
     đăng nhập gần nhất;
   · **`session.user.timezone`** nuôi nghiệp vụ ("hôm nay", "quá hạn") ở `page.tsx`. Nó tươi trong
     vòng `contextCacheSeconds` (30 giây).
   Khi người dùng đổi múi giờ ở Account, nghiệp vụ bắt kịp sau ≤30 giây còn phần định dạng của
   `next-intl` bắt kịp ở lần đăng nhập sau. Chấp nhận được vì cả hai đều là "múi giờ của chính người
   đang xem" — chỉ khác độ tươi, không khác ngữ nghĩa. **Đừng "sửa" bằng cách cho
   `i18n/request.ts` đọc phiên**: đó chính là thứ làm mất chữ khỏi màn hình báo Account không với
   tới được.

⚠ **HỢP ĐỒNG #2 CŨ ĐÃ BỊ THAY, 05.09.2026 — và bản cũ nói NGƯỢC LẠI bản trên.** Nó viết: *"Quá hạn"
tính theo múi giờ của KHÔNG GIAN LÀM VIỆC, không theo người xem*, với lý lẽ hạn chót là cam kết của
cả nhóm. Quyết định mới: **mọi mốc lưu UTC, hiển thị theo múi giờ NGƯỜI XEM; không có "múi giờ của
không gian làm việc" ở bất cứ tầng nào.** Comitor.Account KHÔNG mọc cột `organizations.time_zone`.

Cái giá đã được nêu ra trước khi chọn, và nó có thật: `dueDate` là một NGÀY LỊCH chứ không phải một
mốc, nên hai đồng nghiệp ở hai múi giờ **sẽ** thấy hai con số "quá hạn" khác nhau trong khoảng lệch
giữa họ. Đổi lại: bỏ hẳn một khái niệm không sản phẩm nào đang cần, và không phải thêm cột vào một
dịch vụ danh tính dùng chung. Lý do đầy đủ ở `lib/i18n/config.ts`; ai định "nối
`WORKSPACE_TIME_ZONE` vào Account cho xong" thì việc đó đã được xét và bác bỏ, không phải bỏ quên.

Và **tên header lần vết là `x-request-id`** — chốt trước khi có module thứ hai, nay đã cài đặt;
ba chỗ chạm nó và ràng buộc kèm theo ở §"Cạm bẫy › Bảo mật và hạ tầng" bên dưới.

⚠ **Workspace nằm trong COOKIE, không trong URL** — đánh đổi có ý thức, và cái mất là hai tab không
mở được hai workspace. Lý do đầy đủ ở đầu `lib/account/session.ts`; đọc trước khi sao chép khuôn
này sang module khác.

⚠ **`pnpm seed` phụ thuộc Account ĐANG PHỤC VỤ**: nó hỏi `/api/entitlements/{slug}` để lấy
`workspace_id` và hỏi danh bạ để lấy id người thật. **Mặc định đó là bản dev ONLINE**
(`https://account.dev.comitor.ai`, đã seed sẵn) — repo `comitor-account` là repo riêng mà phần lớn
người làm module không đọc được, nên "chạy Account ở local rồi seed bên đó" không phải một bước họ
làm được. `COMITOR_SEED_WORKSPACE_SLUG` phải là workspace CÓ THẬT ở bản đang trỏ tới: `thienminh`
online, `acme` ở một Account chạy tại chỗ. Chạy Account tại chỗ thì seed bên đó TRƯỚC.

⚠ **Account online + máy local = đường ĐI RA có, đường ĐI VÀO không.** Đăng nhập, danh bạ và
entitlement chạy đủ (máy bạn gọi sang Account). Nhưng Account online không gọi được vào `localhost`
của bạn, nên **webhook và back-channel logout im lặng không tới**: "đăng xuất khỏi mọi thiết bị"
không giết phiên module, và thu hồi chỗ ngồi phải chờ hết 30 giây `contextCacheSeconds`. Cả hai
KHÔNG có thông báo lỗi nào — đó là lý do nó phải nằm ở đây chứ không ở chỗ nào khác.

## Kiến trúc

Cấu trúc **phẳng**, không có `src/`. Sáu tầng + BA rìa, đầy đủ ở
[docs/kien-truc-ung-dung.md](docs/kien-truc-ung-dung.md) §2 — bảng tra nhanh:

```
lib/contracts/   tầng 0 — CHỈ kiểu, không một dòng mã chạy được
lib/core/        tầng 1 — quy tắc nghiệp vụ THUẦN, có test, KHÔNG chuỗi hiển thị
lib/catalog/     ★      — bảng khai giao diện: thứ tự, tone, icon, id (KHÔNG nhãn)
lib/api-client/  tầng 2 — cửa DUY NHẤT giao diện gọi ra ngoài
(không có stores/) tầng 3 — chưa màn hình nào thoả bốn điều kiện, và đó là câu trả lời đúng
hooks/           tầng 4 — hook cầu nối
components/      tầng 5 — cụm dùng ở NHIỀU route hoặc là mảnh của khung app
app/**/page.tsx  rìa A  — Server Component: lấy dữ liệu, truyền prop
app/api/**       rìa B  — route handler: xác thực → quyền → kiểm dữ liệu → làm việc
lib/i18n/actions rìa B′ — Server Action. Đúng MỘT file, và nó ghi cookie giao diện.
                          Mọi đường ghi khác đi rìa B — xem "Đường GHI đi route handler"
lib/*.ts         phía máy chủ: tasks, task-drafts, projects, settings, permissions,
                 activities, reminders, storage, mail, prisma, env
                 (đều mang `import "server-only"`; `format.ts` và `today.ts` thì KHÔNG,
                 cố ý — `format.ts` ghi lý do ngay đầu file: nó phải chạy được cả hai
                 phía. Đừng "sửa" hai file đó cho khớp bảng)
```

⚠ Danh sách trên đã đi sau mã một lần (thiếu `task-drafts`, `reminders`). Soát lại tập ngoại lệ —
ngắn hơn và ổn định hơn danh sách chính — đừng đếm bằng mắt:
`grep -L 'import "server-only"' lib/*.ts`

`app/(shell)/` là **route group**: dấu ngoặc khiến tên thư mục không đi vào URL, nên mọi trang trong
đó có khung app (`AppShell`) mà đường dẫn vẫn sạch. Trang không cần khung đặt ngoài nhóm — như
`app/not-found.tsx` và `app/error.tsx` đang làm.

Những thứ **cố ý không có**, đừng thêm vào: `react-hook-form` (xem dưới), `tailwind.config.ts` (Tailwind v4 khai bằng CSS),
`transpilePackages` trong `next.config.ts` (gói đã publish ESM đã biên dịch, giữ nguyên `"use
client"` theo từng file — bắt bundler dịch lại là có nguy cơ mất ranh giới server/client của gói),
thư mục `styles/` hay `theme/` (màu thuộc về gói), một thư viện UI thứ hai, và **bất kỳ store nào**
(xem `docs/kien-truc-ung-dung.md` §3 tầng 3 — bốn điều kiện; hôm nay không màn hình nào thoả).

## Lệnh

```bash
docker compose up -d                 # Postgres 5436 + MinIO 9110/9111 + Mailpit 1026/8026
                                     # ⚠ CHỈ hồ sơ "docker" cần bước này. Hồ sơ RDS (RDS dùng chung
                                     # + S3 + SES) KHÔNG cần container nào — bảng so sánh hai hồ sơ
                                     # và cạm bẫy `.env.local` ở README §"Hai hồ sơ hạ tầng".
pnpm install
pnpm setup:env                       # dựng .env + sinh COMITOR_SESSION_SECRET (đừng `cp` trần)
                                     # rồi ĐIỀN TAY COMITOR_CLIENT_* và COMITOR_M2M_*
pnpm exec prisma migrate deploy      # lần đầu; sau này `pnpm db:migrate` khi đổi schema
pnpm seed                            # ⚠ CẦN Account phục vụ được — mặc định là bản dev ONLINE
pnpm dev                             # http://localhost:3000

pnpm check                           # cổng đầy đủ: lint + typecheck + i18n:check + core:check + tenant:check + api:check + color:check + version:check + test + build
pnpm i18n:check                      # đối chiếu messages/vi.json với messages/en.json
pnpm core:check                      # chặn chuỗi hiển thị lọt vào lib/core/
pnpm tenant:check                    # chặn truy vấn chọn hàng mà không lọc theo workspaceId
pnpm api:check                       # chặn route handler GHI thiếu requirePermission()
pnpm color:check                     # chặn mã màu viết thẳng vào mã của app
pnpm version:check                   # chặn package.json trôi khỏi CHANGELOG.md
pnpm test                            # vitest — CHỈ lib/core/, ngưỡng coverage 90%
```

**Mọi cổng đó chạy tự động** trên mọi PR và mọi lần đẩy lên `main`, ở
`.github/workflows/check.yml`. Hai điều đã đo được và đã ghi thành comment trong chính file YAML,
vì cả hai đều hỏng theo kiểu không gợi gì tới nguyên nhân: job **không cần Postgres** (`next build`
không prerender trang nào đọc database), và khối `env:` phải mang **giá trị THẬT** — `lib/env.ts`
từ chối placeholder của `.env.example`, nên chép nó vào CI là đỏ ngay với một thông điệp không nói
gì về CI.

`.claude/launch.json` khai server tên `comitor-starter` chạy đúng `pnpm dev` ở **cổng 3000** — cùng
cổng với lệnh chạy tay, cố ý. Đổi cổng thì phải đổi **cả hai chỗ**.

**Cổng hạ tầng lệch chuẩn CÓ Ý** (5436 / 9110 / 1026), và lệch cả với `comitor-account` (5435 /
9100 / 1025): một module Comitor gần như luôn được phát triển CÙNG LÚC với Account. Trùng cổng thì
container thứ hai không lên được — hoặc tệ hơn, app nối nhầm vào database của dự án khác và không có
gì báo. Chi tiết ở đầu `docker-compose.yml`.

## Ranh giới Account / app — luật thứ hai của repo, sau luật màu

**Comitor.Account trả lời đúng BA câu, và chỉ ba câu đó:** *bạn là ai* (danh tính, hồ sơ, 2FA,
phiên) · *bạn thuộc không gian làm việc nào với **vai trò thô** gì* (`owner`/`admin`/`member`/
`guest`, kèm thành viên, lời mời, nhóm) · *không gian làm việc đó được dùng app nào* (gói, chỗ
ngồi). **Mọi câu khác là của module**, và dữ liệu nằm ở database của chính module đó.

Hệ quả cụ thể, và chúng đã được viết thành lược đồ:

- **`prisma/schema.prisma` KHÔNG có bảng `User`, `Workspace`, `Member` hay `Role`.** Module chỉ giữ
  ĐỊNH DANH (`workspace_id`, `assignee_user_id`). Tên người đọc từ `lib/account/directory.ts`.
  ⚠ Cám dỗ "thêm cột `assignee_name` cho khỏi phải gọi API" sẽ xuất hiện, và nó luôn nghe hợp lý ở
  đúng cái ngày người ta thêm nó. Cái giá trả sau: người dùng đổi tên ở Account, mọi app trong hệ
  đổi theo, trừ app này.
- **Không dựng lại màn hình của Account.** Không trang thành viên, không lời mời, không hồ sơ cá
  nhân, không đổi mật khẩu, không cài đặt không gian làm việc, không quản lý gói/chỗ ngồi. Một
  module dựng lại những màn đó là dựng **cửa thứ hai vào cùng một dữ liệu**, và hai cửa thì sớm muộn
  nói khác nhau.
- **Đường sang Account gom ở `lib/account/links.ts`**, không rải chuỗi URL vào từng chỗ gọi.
- **`/settings` là cài đặt của RIÊNG module.** Bốn tab: Chung, Thông báo, **Phân quyền**, Nâng cao.
  Trường mới nào không trả lời được câu *"nó đổi cách ỨNG DỤNG NÀY làm việc à?"* thì chỗ của nó là
  Account. Vùng nguy hiểm của module xoá được **dữ liệu của module**, không xoá được không gian làm
  việc.
- **Phân quyền chi tiết là của module** (`lib/catalog/permissions.ts` + bảng `role_permissions`):
  module ánh xạ bốn vai trò thô sang quyền theo chức năng của chính nó. **Đừng thêm vai trò thô thứ
  năm** — cần một "vai trò" mới nghĩa là cần một TẬP QUYỀN mới trong bảng của module.
- **Bất biến `workspaceId` là CẤU TRÚC, không phải kỷ luật.** Mọi truy vấn CHỌN HÀNG phải lọc theo
  nó — kể cả `update`/`delete`/`upsert`/`count`, không chỉ `findMany`. Hai lưới canh điều đó:
  `pnpm tenant:check` (kiểm tĩnh, và nó cũng chặn một BẢNG MỚI thiếu cột đó), và **khoá ngoại kép**
  `tasks(workspace_id, project_id) → projects(workspace_id, id)` ở tầng database.
  ⚠ Bản ghi của workspace khác trả **404, không phải 403** — 403 xác nhận rằng bản ghi đó tồn tại.
  Bảng thật sự không thuộc về một không gian làm việc thì ghi lý do vào `UNSCOPED_MODELS` ở
  `scripts/check-tenant-scope.ts` (hôm nay có đúng ba: `TaskWatcher`, `AccountSession`, `WebhookEvent`).
- **"id tra không ra tên" là TRẠNG THÁI THỨ BA, không được gộp vào "không có".** Module giữ ĐỊNH
  DANH và đọc tên từ `lib/account/directory.ts`, nên "chưa giao" (`assigneeUserId === null`) và
  "có chủ nhưng danh bạ không tra ra" là hai chuyện khác nhau — và ba đường dẫn tới cái thứ hai đều
  xảy ra thật: Account gián đoạn, M2M chưa cấu hình, người bị gỡ khỏi workspace. Gộp chúng là in
  "Chưa giao" cho một việc đã có chủ, tức một LỜI MỜI người khác nhận việc. Xem
  `TaskView.assigneeUnknown` và nhãn `common.formerMember`.
  ⚠ Và **đường ĐỌC fail-open, đường GHI thì KHÔNG**: `memberDirectory()` trả `Map` rỗng khi Account
  chập chờn (đúng — thiếu vài cái tên còn hơn trắng cả trang), nhưng `requireMemberDirectory()` ném
  `503 SERVICE_UNAVAILABLE`. Một danh bạ rỗng trả lời "không phải thành viên" cho MỌI người, nên
  dùng nó ở đường ghi là báo cáo một sự cố hạ tầng thành một lời khẳng định sai về dữ liệu.
- **Hai hằng đúng của ma trận quyền, đừng nới**: chủ sở hữu luôn có mọi quyền (bỏ đi là tự khoá mình
  ra ngoài), và khách không bao giờ có quyền GHI. Cả hai nằm trong `permissionLock`, một chỗ, và
  `applyPermissionLocks` áp đè chúng **ở tầng ĐỌC** — vì dữ liệu trong database không được tin.
- ⚠ **Ẩn một nút không phải là phân quyền.** Chốt THẬT là `requirePermission()` trong
  `lib/permissions.ts`, và mọi route handler làm việc GHI phải gọi nó. Nó đọc CÙNG bảng mà giao diện
  đọc — một phép kiểm viết riêng ở máy chủ là nguồn sự thật thứ hai.
- ⚠ **Ẩn thanh Lưu chưa đủ — control còn bấm được thì giao diện vẫn NÓI DỐI.** Đã đo: người
  chỉ-đọc mở `/settings/notifications`, bấm một công tắc, công tắc LẬT — và vì thanh lưu không
  render nên không có gì nói rằng thay đổi ấy không đi đâu cả. Họ rời trang và tin là đã đổi.
  Cách chữa là `<ReadOnlyFieldset canEdit>` (`app/(shell)/settings/settings-form-chrome.tsx`), tức
  `<fieldset disabled className="contents">`: nó vô hiệu MỌI control hậu duệ theo đặc tả HTML — kể
  cả cái người sau vừa thêm vào, thứ mà `disabled` rải từng control chắc chắn sẽ bỏ sót — và
  `display: contents` giữ nguyên lưới 12 cột.
  ⚠ **Đừng bọc cả trang**: nhóm Giao diện ở tab Chung (sáng/tối, tương phản, mật độ, cỡ chữ, ngôn
  ngữ) là tuỳ chọn của RIÊNG người đang xem trên RIÊNG máy này, nên `app.settings` không nói gì về
  chúng. Khoá chúng là lấy mất của người chỉ-đọc thứ vốn là của họ.
  **`pnpm api:check` canh luật này** (`scripts/check-api-guards.ts`): route `app/api/**/route.ts`
  nào export `POST`/`PUT`/`PATCH`/`DELETE` thì phải gọi `requirePermission(` và phải bọc
  `withApiErrors`. Route mà **không có quyền nào để mà hỏi** ghi một dòng `// @api-guard: <lý do>`
  vào chính file đó — chỗ ghi lý do là file được miễn trừ, KHÔNG phải một danh sách đường dẫn ở nơi
  khác, kể cả ở đây. Hai họ lý do hợp lệ, và cả hai đều là "không có quyền nào để hỏi" chứ không
  phải "quyền này bỏ qua được":
  · (a) **không có phiên người dùng** — webhook của Account (tự xác thực bằng chữ ký), cùng
    `health`/`ready`;
  · (b) **thao tác chỉ chạm CHÍNH phiên hoặc dữ liệu của người gọi**, với định danh lấy từ phiên chứ
    không từ thân request — đăng xuất, đổi không gian làm việc, đánh dấu thông báo đã đọc. Đòi một
    quyền ở đây là hỏng theo chiều ngược: người vừa bị gỡ khỏi workspace sẽ không đăng xuất được, và
    một vai trò hạn chế mang huy hiệu "chưa đọc" vĩnh viễn.
  ⚠ Bản trước chỉ nêu họ (a), và nêu kèm "back-channel logout" — một route KHÔNG tồn tại trong repo.
  Phần lớn route đang được miễn thuộc họ (b), không phải (a). Muốn biết hôm nay ai được miễn thì
  chạy `pnpm api:check`: nó in đủ route kèm nguyên văn lý do từng cái — đừng chép roster vào đây.

### Giới hạn tần suất: ở HẠ TẦNG, không ở module

**Bộ giới hạn thuộc lớp vào (ingress: CDN / gateway / reverse proxy), không thuộc mã module.** Đây
là quyết định vận hành, chốt một lần cho cả hệ để năm module không tự đoán năm kiểu.

Vì sao không đặt trong module — ba lý do, và lý do thứ ba là lý do quyết định:

- **`proxy.ts` không làm được.** Nó chạy ở runtime riêng của Next, không nạp được `lib/env.ts`,
  không có Prisma. Muốn đếm thì phải thêm một kho đếm mà chính nó cũng cần cấu hình — tức thêm một
  thứ phải cài, phải theo dõi, và phải nhớ khi sao chép; đúng lý do đã bác cron dọn
  `account_sessions`.
- **Đếm trong tiến trình là đếm sai.** N instance là N bộ đếm, và N đổi theo mức tự động co giãn —
  cùng cạm bẫy đã ghi cho job nền.
- **Đường cần chặn nhất lại là đường KHÔNG có phiên**, nên module không có gì để đếm theo:
  `GET /api/auth/sign-in`, `GET /api/auth/callback`, `POST /api/comitor/webhook`. Một limiter đặt
  sau `requireApiSession()` bảo vệ đúng những đường ít cần bảo vệ nhất.

Hệ quả cho module — hai điều, và cả hai đã cài đặt:

1. **Module KHÔNG tự sinh 429.** `ApiError.rateLimited()` tồn tại chỉ để **chuyển tiếp** 429 nhận
   từ Comitor.Account (`requireApiSession`, kiểm `AccountError.status`). Nếu bạn thấy mình gọi nó ở
   chỗ khác, bạn đang dựng một limiter trong module — dừng lại và đọc lại mục này.
2. **Nhận 429 từ Account thì trả 429, đừng nuốt và đừng đổi thành 500.** Giao diện đã có đường
   riêng: `hooks/use-error-message.ts` kiểm `status === 429` TRƯỚC khi tra `code`, vì limiter
   thường trả 429 trần không kèm `code`.

⚠ **Miễn trừ khi cấu hình ở ingress: `/api/health` và `/api/ready`.** Bộ thăm dò của trình điều
phối gọi chúng vài giây một lần; chặn chúng là làm container bị khai tử vì "không khoẻ" trong khi
nó hoàn toàn khoẻ. Chi tiết vận hành ở [docs/trien-khai.md](docs/trien-khai.md).

⚠ **Đây KHÔNG phải hợp đồng liên module thứ ba.** Hai hợp đồng ở trên không sửa được sau khi có năm
module vì phải đổi năm repo CÙNG LÚC. Chỗ đặt limiter thì không: chuyển nó từ ingress vào module
sau này không buộc repo nào khác phải đổi theo. Nó là một quyết định vận hành, và nó nằm ở đây để
có MỘT câu trả lời, không phải vì nó bất biến.

Áp lực "cho cái quyền này sang Account cho tiện" sẽ xuất hiện liên tục. Mỗi lần nhượng bộ là một
bước biến Account thành kho quyền của mọi app — đúng thứ ranh giới này tránh.

## Quy ước bắt buộc giữ

- **App KHÔNG sở hữu màu — quy tắc số 1, không có ngoại lệ vì tiện.** Không hex, không khai token
  màu, không lớp tiện ích màu tự chế: không trong CSS, không trong `style={{…}}`, không trong
  `metadata`, không trong SVG. `app/globals.css` **chỉ có đúng hai dòng `@import`** (Tailwind trước,
  `@comitor/ui/styles.css` sau) và phải giữ nguyên như vậy.
  **Bốn trục hiển thị, cũng của gói**: sáng/tối, bảng màu (tương phản cao), mật độ, cỡ chữ. App chỉ
  **bọc bốn provider** ở root layout và đặt toggle vào trang cài đặt.
  **Thiếu token thì sửa ở gói**: thêm token vào `../comitor-ui` → bump version → publish → nâng
  version trong `package.json` ở đây. TUYỆT ĐỐI không sửa file trong `node_modules/@comitor/ui`.
  Ngoại lệ **duy nhất** của repo là `app/icon.svg` — favicon do trình duyệt vẽ ngoài trang nên không
  đọc được `var(--color-*)`; vector và mã màu chép nguyên từ `<ComitorLogo>` của gói.
  Kiểm nhanh — nhớ loại đúng file ngoại lệ đó ra:
  `grep -rE "#[0-9A-Fa-f]{3,8}" app lib components hooks --exclude=icon.svg` phải ra **rỗng**.
  **`pnpm color:check` chạy đúng phép kiểm đó** (`scripts/check-colors.ts`) và nằm trong
  `pnpm check`. Nó CỐ Ý không kiểm vai trò màu: phép kiểm ấy phải viết bằng regex, mà
  `text-destructive-foreground`, `border-input` và class đi qua `cn()` đều làm nó báo nhầm — vai
  trò màu vẫn được kiểm bằng MẮT, ở cả hai theme.
- **Mỗi màu có ba vai trò: `--x` (nền) · `--x-foreground` (chữ trên nền đó) · `--x-ink` (chính màu
  đó khi đi lên nền trang).** Chữ lỗi là `text-destructive-ink`, không phải `text-destructive`; viền
  ô nhập là `border-input`, không phải `border-border`. Chọn sai vai trò không có gì báo đỏ —
  Tailwind vẫn sinh class như thường, chỉ tương phản là hỏng.
- **Tiếng Anh cho MỌI thứ máy đọc; chuỗi người dùng đọc thì nằm trong `messages/`.** Comitor là sản
  phẩm quốc tế, đa ngôn ngữ.

  | Thứ | Ngôn ngữ | Ví dụ |
  |---|---|---|
  | Biến, hàm, type, trường dữ liệu | **Anh** | `openTaskCount`, `requirePermission` |
  | Tên file, tên thư mục | **Anh** | `task-table.tsx`, `catalog/permissions.ts` |
  | **Đường dẫn URL** | **Anh** | `/tasks`, `/tasks/new`, `/settings/advanced` |
  | Giá trị union / enum | **Anh** | `"in-progress"`, `"urgent"`, `"on-hold"` |
  | `id` / `htmlFor` trong DOM | **Anh** | `FIELD_IDS` ở `task-request-form.tsx` |
  | **Comment và tài liệu** | **Việt** | chính file này |
  | Chuỗi hiển thị, kể cả `aria-label` · `title` · `placeholder` | **`messages/{vi,en}.json`** | `t("tasks.empty.title")` |

  ⚠ **Đường dẫn URL KHÔNG phải ngoại lệ.** URL là **hợp đồng máy** — nó vào router, vào liên kết
  trong email, vào deep link của app di động, vào phân tích truy cập, và nó KHÔNG dịch được theo
  ngôn ngữ người dùng. Với module Comitor còn một lý do nặng hơn: **Comitor.Account chuyển hướng tới
  đường dẫn của từng sản phẩm**, nên đường dẫn là API công khai của module.
- **Không có chuỗi hiển thị nào nằm ngoài `messages/`** — bốn chỗ chứa chuỗi và lý do của từng chỗ ở
  [docs/kien-truc-ung-dung.md](docs/kien-truc-ung-dung.md) §5. Bốn cái bẫy đã gặp thật cũng ở đó;
  đọc chúng TRƯỚC khi viết chuỗi đầu tiên.
- **Đổi chuỗi của gói bằng prop `labels`, không fork component.** `labels` nhận `Partial<>` nên
  override từng khoá; khoá có số/đơn vị chèn vào là **hàm**, không phải chuỗi có placeholder (trật
  tự từ mỗi ngôn ngữ một khác). Bảng ở `lib/i18n/ui-labels.tsx`, và `vi` trả `undefined` = dùng mặc
  định của gói — chép lại nguyên bộ chuỗi tiếng Việt vào app là dựng một bản sao thứ hai sẽ lệch.
- **`react-hook-form` cố ý KHÔNG có, dù `@comitor/ui/form` nhận nó.** Nó từng nằm trong
  `dependencies` mà không một dòng mã nào import — một phụ thuộc khai mà không dùng gửi tín hiệu
  sai thẳng vào mặt người đọc ("chắc biểu mẫu ở đây dùng nó"), và nó là peer TUỲ CHỌN của gói nên
  bỏ ra không mất gì. `task-request-form.tsx` tự quản `errors`/`showErrors`/tự focus, và khuôn đó
  đã chạy đúng qua nhiều vòng.
  Ngày một module thật cần `Controller` + `zodResolver`: cài lại `react-hook-form`, dùng
  `@comitor/ui/form`, và tách lược đồ zod xuống `lib/core/` để CẢ hai phía dùng chung — khuôn có
  sẵn ở `lib/core/task-input.ts`.
- **Chỗ đặt cụm tự viết theo phạm vi dùng, chỉ hai chỗ**: phục vụ đúng một route → **cạnh route đó**;
  dùng ở nhiều route hoặc là mảnh của khung app → `components/`. Và **ghi ngay đầu file vì sao nó
  tồn tại** (gói thiếu gì, hoặc nó chỉ *nối* component nào của gói).
- **Không chép mã nguồn component từ `node_modules/@comitor/ui` vào repo.** Cần biến thể chưa có thì
  sửa ở gói. Nếu bạn đang viết một cái nút, một cái thẻ, một cái badge — dừng lại, gói có sẵn.
- **BẢN GHI đi vào app ở đúng HAI cửa: `page.tsx` của từng route, và `app/(shell)/layout.tsx` cho
  khung app.** Các file `"use client"` bên dưới nhận dữ liệu **thuần** qua prop và không biết nguồn
  ở đâu. Giữ đúng ranh giới này thì đổi tầng dữ liệu không phải sửa giao diện.
  Ngoại lệ có lý do: **bảng khai tĩnh** (`lib/catalog/**`) thì file client `import` thẳng — chúng là
  hằng giao diện chứ không phải dữ liệu từ server, và nhiều bảng mang **icon** (một component React)
  nên chúng KHÔNG tuần tự hoá được qua ranh giới server → client. Đó cũng chính là lý do khung app
  tách làm hai file (`layout.tsx` server + `shell-frame.tsx` client).
- **`lib/catalog/navigation.ts` là nguồn sự thật DUY NHẤT của điều hướng.** Thanh bên, menu
  off-canvas và bảng lệnh ⌘K đều đọc từ đó (bảng lệnh lấy `nav` qua `useShell()`, không có danh sách
  thứ hai). `href` chỉ là chuỗi — `tsc` và Biome không bắt được link chết, chỉ người dùng bấm vào
  mới thấy 404.
  ⚠ **Luật này từng bị vi phạm đúng một chỗ, và cách trả nợ là khuôn đáng chép**: `SETTINGS_TABS`
  (`lib/catalog/settings.ts`) khai LẠI bốn `href` con của Cài đặt, nên đổi một đường dẫn mà quên chỗ
  kia thì thanh bên đi đúng còn dải tab trỏ vào 404 — và **không cổng nào bắt được**, vì `href` chỉ
  là chuỗi. Nay nó SUY từ `children` của mục `settings`. Hai thứ thu được ngoài việc hết trùng, và
  đó mới là phần đáng chép sang chỗ khác: `id` của tab nay là `NavItemId` chứ không phải `string`,
  nên quên khoá dịch là **lỗi biên dịch** (một hàm ghép khoá lúc chạy đã biến mất cùng lệnh ép kiểu
  cuối cùng của họ `as Parameters<typeof tNav>[0]`); và phép kiểm bất biến NÉM lúc nạp module, mà
  module ấy nằm trong nhánh render của `/settings`, nên `pnpm build` là cổng — chỗ trước đó không
  có cổng nào. Đếm chỗ khai `href`, đừng đếm bằng mắt: `grep -rn 'href: "/' lib/catalog/*.ts` —
  chỉ được thấy `navigation.ts` và `apps.ts` (bệ phóng sang sản phẩm khác); một đường dẫn lạ hiện
  thêm là một danh sách thứ hai vừa ra đời.
- **Con số nào suy được thì suy, đừng chép tay và đừng thêm cột đếm.** `progress`/`taskCount` của
  dự án ĐẾM từ `tasks`; mã việc kế tiếp đếm từ mã lớn nhất; `overdue` SUY RA từ `dueDate` so với hôm
  nay. Một cột đếm sẵn là một cột sẽ lệch, ngay lần đầu tiên có ai xoá một bản ghi bằng đường không
  đi qua chỗ tăng giảm bộ đếm. Ngoại lệ đúng đắn: `memberCount` của workspace — module KHÔNG giữ
  bảng thành viên nên nó không có nguồn nào để suy.
- **Thử nghiệm trong `app/` đặt dưới `_scratch/`.** Next bỏ qua mọi thư mục bắt đầu bằng `_` nên nó
  KHÔNG sinh route, và `.gitignore` chặn sẵn `app/**/_scratch/`. Cách kiểm KHÔNG phụ thuộc tên:
  `pnpm build` in ra bảng route ở cuối — đối chiếu nó với **bản đồ route trong README**.
- **Đường GHI đi route handler, KHÔNG đi Server Action.** Server Action là idiom mặc định của Next
  16 nên nó sẽ được với tay lấy theo phản xạ — và đi đường đó là mất sạch bốn hàng rào cùng lúc:
  không `withApiErrors`, không `ApiError`, không hợp đồng `lib/api-client/`, và **không gì nhắc
  `requirePermission()`** (`pnpm api:check` chỉ quét `app/api/**/route.ts`).
  **Server Action chỉ dùng cho thao tác không chạm dữ liệu nghiệp vụ và không cần quyền** — hôm nay
  đúng một trường hợp: ghi cookie giao diện ở `lib/i18n/actions.ts`. Bảng so sánh ở
  [docs/kien-truc-ung-dung.md](docs/kien-truc-ung-dung.md) §3 rìa B′.
- **Nghiệp vụ nằm ở `lib/*.ts`, không nằm trong `route.ts`.** Rìa B làm đúng bốn việc: phiên →
  quyền → hình dạng dữ liệu → gọi tầng D. Cái giá của việc để nghiệp vụ trong route handler không
  phải thẩm mỹ mà là **không gọi lại được**: `pnpm seed`, một Server Action, một job nền đều không
  gọi được, và cách duy nhất còn lại là chép nghiệp vụ ra lần thứ hai.
  ⚠ **Rìa B dùng `requireApiSession()`, KHÔNG dùng `requireSession()`.** Bản kia kết thúc bằng
  `redirect()`, mà `redirect()` NÉM một lỗi điều khiển luồng — `withApiErrors` bắt nó và trả **500**
  cho một chuyện bình thường (access token sống 15 phút). Đã đo: `PUT /api/task-drafts` không phiên
  trả `500 INTERNAL_ERROR` + `[api] LỖI KHÔNG XỬ LÝ Error: NEXT_REDIRECT`; nay trả `401`.
- **Ranh giới `$transaction`: trong = thứ mà một nửa là DỮ LIỆU SAI; ngoài = thứ mà một nửa là CHẤP
  NHẬN ĐƯỢC.** Công việc và người theo dõi của nó vào trong (một việc không ai theo dõi là bản ghi
  sai, và không gì trên màn hình cho thấy điều đó); nhật ký, thông báo, lá thư ở ngoài. Để chúng ở
  trong thì một SMTP chậm giữ khoá ghi hai bảng, còn một SMTP hỏng ROLLBACK một công việc mà người
  dùng vừa thấy nút Gửi quay xong. Vòng thử lại mã cũng ở NGOÀI: bên trong giao dịch, `P2002` làm
  cả giao dịch hỏng nên thử lại là thử lại trên một giao dịch đã chết.
- **Đường ghi gửi CẢ giá trị phải mang THẺ PHIÊN BẢN; đường ghi gửi ĐÚNG PHẦN ĐỔI thì không.**
  Một `PUT` ghi đè toàn bộ là một lệnh nói *"hãy để tài nguyên này thành đúng thế này"*, và nó chỉ
  đúng nếu người gửi đang nói về cùng cái bản mà máy chủ đang giữ. Không có thẻ thì hai người cùng
  sửa là người lưu sau ghi đè người lưu trước bằng một ảnh chụp cũ — **im lặng**, và với
  `/api/permissions` thứ vừa mất là một quyết định bảo mật. Giao dịch KHÔNG cứu được: nó bảo đảm
  không ai ĐỌC được trạng thái nửa vời, chứ không nói gì về việc lệnh sau đè lệnh trước.

  Hình dạng: phép ĐỌC nuôi một biểu mẫu ghi-đè trả `{ value, version }`; client gửi `version` về
  NGUYÊN VĂN trong **thân** JSON; máy chủ tính lại thẻ từ bản ĐANG LƯU **bên trong cùng giao dịch
  ghi** và trả `409 STALE_WRITE` khi lệch. Khuôn ở `lib/permissions.ts` +
  `app/api/permissions/route.ts`.

  Bốn điều dễ làm sai, cả bốn đã đo:
  · **Thiếu `version` là 400, không phải "bỏ qua phép so".** Một phép kiểm chỉ chạy khi client chịu
    gửi tham số là một phép kiểm không tồn tại.
  · **So BÊN TRONG giao dịch.** Đọc lại rồi so ở ngoài chỉ HẸP cửa sổ đua chứ không đóng nó — mà
    một phép kiểm hẹp cửa sổ trông y hệt một phép kiểm đóng cửa sổ.
  · **Tính thẻ từ bản ĐANG LƯU, không phải từ payload.** Tính từ payload thì nó luôn khớp với chính
    nó: bảo vệ bằng KHÔNG, trông như một phép kiểm thật.
  · **Thẻ là BĂM NỘI DUNG, không phải `updatedAt`, không phải cột đếm** (`lib/core/version-token.ts`
    giải thích cả ba lý do; ngắn gọn: không cần migration, không có đồng hồ để lệch, không có bộ
    đếm để lệch).

  `PATCH` gửi từng trường thì **miễn** — hai người sửa hai trường khác nhau không xoá của nhau, và
  `PATCH /api/tasks/{taskId}` là đường đó. Cũng chính vì vậy `watcherUserIds` **không** nằm trong
  `updateTaskSchema` (`lib/core/task-input.ts`): ghi đè cả mảng người theo dõi là đúng lớp lỗi nói
  trên. ⚠ Ngày cần sửa danh sách ấy thì nó phải là một lệnh thêm/bớt từng người — **và lệnh đó CHƯA
  DỰNG**, đừng đi tìm khuôn để chép. Trong mã app hôm nay người theo dõi chỉ được ghi đúng một chỗ,
  bên trong giao dịch của `createTask` (`lib/tasks.ts`), và biến mất theo `onDelete: Cascade` khi
  việc bị xoá; nên chưa có ca ghi-đè đồng thời nào để bảo vệ. Kiểm:
  `grep -rn "taskWatcher" app lib --include='*.ts'`
  ⚠ **`PUT /api/settings` hôm nay CHƯA có thẻ**, cố ý: mất một ô cài đặt thì nhìn thấy được và đặt
  lại được, mất một ô phân quyền thì không ai biết cho tới khi có sự cố. Làm khi `AppSetting` có
  người thứ hai sửa thật, hoặc khi có module báo ca này.
- **Mọi migration phải tương thích ngược MỘT bản.** Mã bản N và mã bản N+1 phải cùng chạy được
  trên lược đồ N+1 — vì `prisma migrate deploy` chạy TRƯỚC khi mã mới lên, nên luôn có một khoảng
  mà **mã cũ đang chạy trên lược đồ mới**. Đổi tên cột, `DROP COLUMN`, hay `SET NOT NULL` không
  backfill đều làm khoảng đó thành sự cố. Công thức ba bước (mở rộng → backfill → thu hẹp) và ví
  dụ SQL chép được ở [docs/migration.md](docs/migration.md).
  ⚠ **Prisma KHÔNG có `migrate down`.** Rollback trong thực tế là khôi phục từ sao lưu — tức chấp
  nhận mất dữ liệu. Đó là lý do luật trên không phải lời khuyên.
  ⚠ `pnpm db:migrate` là lệnh **chỉ dùng ở máy phát triển**; production dùng `pnpm db:deploy`.
  Nhưng lý do KHÔNG phải "nó có thể reset database" — bản trước của dòng này nói vậy và nó SAI.
  Đã đo trên Prisma 6.19.3: lịch sử lệch thì `migrate dev` IN ra chênh lệch, bảo bạn tự chạy
  `prisma migrate reset`, rồi **thoát 130**. Nó không xoá gì, và không có prompt y/N nào để lỡ tay
  bấm — chuỗi `Do you want to continue` xuất hiện **0 lần** trong CLI. Lệnh nguy hiểm là
  `prisma migrate reset`, và `pnpm db:migrate` KHÔNG chạy nó.
  ⚠ Chỗ này nặng hơn từ khi `.env` trỏ được vào **RDS dev DÙNG CHUNG**: câu quen thuộc "reset thì
  hợp lý ở máy phát triển" hết đúng khi "máy phát triển" là database của cả đội. Đọc lại
  `DATABASE_URL` TRƯỚC khi gõ `migrate reset`, đừng đọc sau.
  `pnpm db:check` bắt được ca "quên commit migration" — ca đi qua MỌI cổng khác, và nổ ở máy đồng
  đội vài ngày sau.
  ⚠ **`SHADOW_DATABASE_URL` đọc theo thứ tự: BIẾN MÔI TRƯỜNG trước, `.env` sau, thiếu cả hai thì
  NỔ có thông điệp.** Cả ba nhánh đều cần thiết, và repo đã trả giá cho việc thiếu một nhánh —
  hai lần, ngược chiều nhau:
  · chỉ đọc `$SHADOW_DATABASE_URL`: pnpm KHÔNG nạp `.env` vào shell, nên ở máy phát triển nó nở
    thành RỖNG;
  · chỉ đọc `.env` (bản sửa cho ca trên): **CI không có file đó** — `.env` bị gitignore — nên
    `node --env-file=.env` gãy, `$(...)` lại nở thành RỖNG, và job `migration` ĐỎ ở MỌI run từ
    `14334f4` (02.09) tới `f32d358` (05.09). Không ai thấy vì starter chưa deploy đi đâu, nên
    chưa ai có lý do mở trang Actions.
  Rỗng thì Prisma chỉ in bảng trợ giúp và thoát 0 — nên nhánh thứ ba (nổ có thông điệp) mới là
  thứ biến chỗ này thành một cổng thật; một cổng báo "hỏng" mà không ai đọc là một cổng không
  tồn tại.
- **Job nền: `scripts/jobs/<tên>.ts`, mỏng, và nghiệp vụ ở `lib/`.** Khuôn có sẵn ở
  `scripts/jobs/due-soon-reminders.ts` + `lib/reminders.ts` + `lib/core/due-soon.ts` (quy tắc
  thuần, có test). Ba luật:
  · **`--conditions=react-server`** trong lệnh chạy, nếu không `server-only` NÉM với một thông
    điệp không liên quan gì tới nguyên nhân;
  · **cron của HẠ TẦNG, không `setInterval` trong tiến trình Next** — N instance là N lần chạy,
    và N đổi theo mức tự động co giãn nên triệu chứng là "thỉnh thoảng khách hàng nhận thư trùng";
  · **một workspace hỏng không được làm chết cả vòng chạy** — với job chạy mỗi ngày một lần, dừng
    ở workspace thứ hai nghĩa là tám cái còn lại không được xử lý, và không ai biết.
  ⚠ Và **một cài đặt không làm gì tệ hơn một cài đặt còn thiếu**: nếu chưa nối được thì đánh dấu
  bằng `<NotYetActive />` chứ đừng để giao diện nói dối. Bốn ô ở `/settings` đã từng như vậy.
- **Chỉ nói về Comitor.** Không tên công ty, sản phẩm, thương hiệu nào khác trong code, comment, tài
  liệu hay dữ liệu mẫu. Ngoại lệ là những phụ thuộc CÓ THẬT của repo (Next, React, Prisma, Radix,
  Tailwind, Biome, Uppy), vì không gọi tên chúng thì không viết nổi tài liệu.
- **Warning LÀ lỗi.** `pnpm lint` chạy `biome check --error-on-warnings`. Ba luật đang ở mức
  `warn` (`noExplicitAny`, `noUnusedImports`, `noUnusedVariables`) và chúng KHÔNG phải góp ý: mức
  `warn` chỉ để `lint:fix` sửa được phần sửa tự động mà không chặn vòng lặp lúc đang viết. Không có
  cờ đó thì `biome check .` thoát 0 khi có `as any` — đã đo — và cổng lint báo xanh cho đúng thứ nó
  được dựng để chặn.
- **Biome quyết định format** (2 space, 120 cột, nháy kép, không dấu phẩy cuối, import tự sắp xếp).
  Chạy `pnpm lint:fix`, đừng format tay và đừng sửa `biome.json` cho vừa một file. ⚠ `biome.json`
  **KHÔNG nhận comment `//`** — đuôi `.json` ở đây là nghĩa đen, không phải JSONC.
- **⚠ Spread có điều kiện LỌT phép kiểm thuộc tính thừa của TypeScript.** Đây là chỗ `tsc` trông
  như đang kiểm mà không kiểm, và repo dùng khuôn `...(cond ? { x } : {})` ở rất nhiều đường ghi:

  ```ts
  f({ a: "x", KHONG_CO_THAT: 1 });                      // TS2353 — đỏ, đúng như mong đợi
  f({ a: "x", ...(cond ? { KHONG_CO_THAT: 1 } : {}) }); // XANH. Thuộc tính bị bỏ qua trong im lặng
  ```

  Đã đo (`tsc --strict`). Hậu quả thật đã gặp: một lời gọi `recordActivity` truyền `targetName`
  trong khi hàm nhận `targetUserId` — biên dịch sạch, và dòng nhật ký "đã giao việc cho {target}"
  ra đời thiếu chủ ngữ. Khi dùng khuôn này, **đọc lại chữ ký hàm bằng mắt**; đừng tin màu xanh.
- **`strict` + `noUncheckedIndexedAccess`**: `arr[i]` và `obj[key]` cho ra `T | undefined`. Đừng chữa
  bằng `!` hay `as` — xử lý nhánh `undefined`. Một hàm trả `undefined` vì luật này là **tính năng**:
  nó vừa tìm ra một ca biên chưa xử lý.

## Thêm một trang mới

> Thêm cả một THỰC THỂ (lược đồ → quy tắc → đường ghi → giao diện → chuỗi) thì mục này mới chỉ là
> phần MÀN HÌNH của việc đó: nó không nói gì về lược đồ, migration, hợp đồng kiểu, `lib/api-client/`
> và ma trận quyền. Danh sách đầy đủ, kèm cột **cổng nào bắt được nếu quên**, ở
> [docs/them-mot-thuc-the.md](docs/them-mot-thuc-the.md).
> ⚠ Bản trước ghi "mục này chỉ là **bước 11–13**", còn file kia ghi "bước 10–13" — hai con số gõ tay
> cho cùng một thứ, lệch nhau ngay từ commit sinh ra chúng. Và không khoảng LIỀN MẠCH nào đúng cả:
> bảy bước dưới đây chạm cả `lib/core/`, `lib/<entity>.ts`, route handler lẫn `navigation.ts` +
> `nav.*`, tức rời rạc. Vì vậy chỗ này không ghim số nữa; khoảng bước thuộc về file sở hữu bảng.

1. Tạo `app/(shell)/<duong-dan>/page.tsx` — Server Component, có `export async function
   generateMetadata()` (không phải hằng `metadata`: tiêu đề phải dịch được).
2. Phần cần state/sự kiện tách sang một file `"use client"` **cùng thư mục**, tên tiếng Anh.
   ⚠ Nếu nút chính trong `actions` của `PageHeader` cần state DÙNG CHUNG với thân trang thì kéo luôn
   `PageHeader` vào file `"use client"` đó — dựng một đảo client THỨ HAI chỉ để mở hộp thoại là có
   hai bản state độc lập.
3. Thêm mục vào `lib/catalog/navigation.ts` **và** khoá nhãn vào `messages/{vi,en}.json` mục `nav.*`.
4. Quy tắc nghiệp vụ mới → **viết hàm thuần trong `lib/core/` TRƯỚC, kèm test**, rồi mới viết giao diện.
5. Dữ liệu lấy từ `lib/*.ts` (Prisma) ngay trong `page.tsx`, ghép sẵn rồi truyền xuống.
6. Thao tác GHI → route handler trong `app/api/`, và nó PHẢI gọi `requirePermission()`.
7. `pnpm check`, rồi xem thử ở **cả hai ngôn ngữ**, **cả hai theme**, bề rộng 1280px và 375px.

## Cạm bẫy

### Next.js và ranh giới server/client

- **⚠ KHÔNG ghi được cookie trong lúc render trang.** `cookies().set()` chỉ hợp lệ ở **Server
  Action, Route Handler và `proxy.ts`**; gọi từ một Server Component thì Next ném *"Cookies can only
  be modified in a Server Action or Route Handler"*. Cái bẫy nằm ở chỗ nó **không hỏng lúc build,
  không hỏng lúc đăng nhập, và chỉ nổ ở lần đầu tiên có thứ gì cần ghi lại** — với repo này là lần
  xoay token thứ nhất, tức 15 phút sau khi vào. Trạng thái nào phải cập nhật giữa lượt render thì
  chỗ của nó là **database**, không phải cookie. Xem `lib/account/session-store.ts`.
- **`"use client"` là chỉ thị theo FILE.** Đặt nó lên `page.tsx` là mất `generateMetadata` (Next cấm
  hai thứ cùng file) và đẩy cả khung trang lẫn dữ liệu sang bundle trình duyệt. Đúng cách: page ở
  server, một đảo client bên cạnh.
- **`searchParams` và `params` là `Promise` ở Next 16** — phải `await`. Giá trị của một khoá có thể
  là **mảng** khi query bị lặp (`?tab=a&tab=b`), nên luôn chuẩn hoá trước khi dùng: lấy phần tử
  **ĐẦU** nếu là mảng, và coi thiếu / mảng rỗng / chuỗi rỗng-sau-`trim` đều là "không có".
- **`proxy.ts`, KHÔNG phải `middleware.ts`** — Next 16 đã đổi quy ước, và **tên FILE phải đi cùng
  cặp với tên HÀM export**. Đặt sai tên KHÔNG im lặng: `middleware.ts` vẫn được nạp và chạy đủ
  (deprecated), chỉ kèm `The "middleware" file convention is deprecated` ở cả `next dev` lẫn
  `next build`; lệch cặp tên file/tên hàm theo **bất kỳ chiều nào** thì build ĐỎ
  (`… is missing expected function export name`); có CẢ hai file thì Next NÉM (E900). Phép kiểm
  DƯƠNG: `pnpm build` in `ƒ Proxy (Middleware)` ở cuối bảng route — có dòng đó nghĩa là file đã được
  nạp thật. Đã đo trên Next 16.3.2.
  ⚠ Bản trước ghi "đặt sai tên thì file không được nạp và KHÔNG có gì báo … không có CSP và không có
  nonce". SAI: cái mất khi đi sai không phải CSP mà là một cổng build đỏ, cộng một quy ước sẽ bị gỡ
  ở bản Next sau. Vế "mất CSP và nonce" chỉ đúng cho ca KHÔNG có file nào cả — ca đó mới thật sự im
  lặng, vì không có gì để Next phát hiện.
- **Thanh bên tô active theo ĐƯỜNG DẪN, không theo `?query`** — `usePathname()` không bao giờ chứa
  query. Muốn tô đúng từng tab thì phải truyền `searchParams` cho `<AppShell>`, và **cái giá không
  nhỏ**: `useSearchParams()` trong layout làm `pnpm build` ĐỎ và kéo mọi trang dưới layout ra khỏi
  prerender. Cần chính xác từng tab thì đổi tab thành **route thật** — khớp bằng `pathname` là đủ và
  không tốn gì. Đó là lý do bốn tab của `/settings` là bốn route.
- **`Decimal` của Prisma KHÔNG tuần tự hoá được** qua ranh giới Server → Client Component: Next ném
  *"Only plain objects can be passed to Client Components"* ở lúc chạy, tại một chỗ cách nguyên nhân
  rất xa. Đó là lý do `estimate_minutes` là `Int` chứ không phải "số giờ" kiểu `Decimal`.
- **`Date` cũng không**: Next chuyển nó thành chuỗi còn kiểu vẫn nói là `Date` — sai kiểu ÂM THẦM.
  Tầng 0 (`lib/contracts/`) vì thế dùng **chuỗi ISO** cho mọi mốc thời gian.

### Đa ngôn ngữ

- **⚠ KHOÁ CHỨA DẤU CHẤM KHÔNG BAO GIỜ TRA TỚI ĐƯỢC.** `next-intl` dùng dấu chấm làm dấu phân cấp
  namespace, nên `"task.view"` viết thẳng vào `messages/` tạo ra một khoá mà `t("perms.task.view")`
  đi tìm ở `perms → task → view` và không thấy. `toPermissionMessageKey()` làm phép đổi;
  `pnpm i18n:check` chặn khoá kiểu này.
  ⚠ **Bản trước của mục này viết rằng nó ném `INVALID_KEY` lúc NẠP và làm hỏng mọi trang. SAI** —
  đã đo trên `use-intl` 4.14.1, cả bundle dev lẫn production: bộ chuỗi nạp bình thường, không ném
  gì. Hậu quả thật nhẹ hơn nhưng KÍN HƠN: đúng một chuỗi hỏng, ở đúng một chỗ.
- **⚠ `t()` KHÔNG NÉM LỖI, và đó mới là vấn đề.** Ba cách hỏng — khoá thiếu, khoá chứa dấu chấm,
  tham số ICU lệch — đều **trả về chính tên khoá** và chỉ `console.error` một dòng. `t.has()` trả
  `false`, cũng không ném. `pnpm build` xanh, và khoá sót đi thẳng ra production dưới dạng một
  chuỗi trông như nhãn kỹ thuật, chỉ hiện với người dùng đúng ngôn ngữ đó.
  **Lưới của repo** (`i18n/request.ts`): `getMessageFallback` bọc chuỗi hỏng thành `⟦namespace.key⟧`
  — không lẫn vào đâu được trong vòng đi thử tiếng Anh — và `onError` in `[i18n] KHOÁ HỎNG` để
  grep được ở production. **Cổng thật vẫn là `pnpm i18n:check`**; lưới chỉ làm cái sót nhìn thấy
  được, nó không chặn.
  Khoá **động** (mã lỗi, mã quyền) vẫn phải đi qua `t.has()` — không phải để tránh ném, mà để nơi
  gọi tự chọn được câu dự phòng thay vì in `⟦…⟧` cho người dùng.
- **⚠ `<>t("x")</>` in ra NGUYÊN VĂN `t("x")`.** Thiếu đúng một cặp `{}` trong JSX, và **không có
  gì báo**: `tsc` thấy văn bản JSX hợp lệ, Biome thấy văn bản JSX hợp lệ, `i18n:check` thấy khoá có
  mặt trong `messages/`. Đã lọt vào `/settings/advanced` và chỉ bị bắt khi có người ĐỌC CHỮ trên
  màn hình. `pnpm i18n:check` nay chặn: một `t…("…")` mà ký tự không-trắng ngay trước là `>` kết
  của thẻ JSX (`=>` được loại ra — hàm mũi tên trả chuỗi dịch là cách viết đúng).
- **⚠ `next-intl` KHÔNG hiểu markdown, chỉ hiểu THẺ ICU.** `"**đậm**"` viết trong `messages/` hiện
  ra là hai dấu sao, giữa màn hình, với người dùng. Muốn in đậm thì viết `<strong>…</strong>` rồi
  nối vào một hàm qua `t.rich`. Đã xảy ra ở `settings.notYetActive` — kèm cả `` `scripts/jobs/` ``,
  tức tài liệu cho lập trình viên lọt vào chuỗi cho người dùng cuối. `pnpm i18n:check` nay chặn
  `**đậm**`, `` `mã` `` và `[chữ](liên kết)` trong mọi chuỗi. Dấu `*` ĐƠN không bị chặn — nó là dấu
  đánh trường bắt buộc.
- **`app/global-error.tsx` (nếu có ngày phải viết) KHÔNG có provider nào** — nó thay thế cả `<html>`
  khi chính root layout hỏng. Chuỗi ở đó phải là hằng tiếng Anh trần. Ngoại lệ DUY NHẤT.
- **Đi một vòng chỉ bằng `vi` thì không bao giờ thấy khoá nào bị bỏ sót.** Đổi nhanh:
  `document.cookie = "comitor-locale=en; path=/"` rồi tải lại.

### Dữ liệu và thời gian

- **Ngày ISO chỉ-có-ngày phải CẮT CHUỖI, không `new Date("YYYY-MM-DD")`**: JS hiểu chuỗi đó là mốc
  **UTC** nên máy ở múi giờ âm in ra ngày hôm trước. Lỗi này không lộ ra ở GMT+7 — nó chỉ xuất hiện
  sau khi deploy. Dùng `lib/core/iso-date.ts` (có test) và `formatIsoDateFor` ở `lib/format.ts`.
- **"Hôm nay" đọc bằng `todayIso()` (`lib/today.ts`), không bằng `toISOString().slice(0,10)`**: cái
  sau luôn trả về UTC, nên bảy tiếng đầu mỗi ngày ở GMT+7 nó trả về ngày HÔM QUA.
  ⚠ **Và luôn TRUYỀN `timeZone` tường minh ở đường request** — `session.user.timezone`, tức múi giờ
  của người xem. Tham số mặc định (`DEFAULT_TIME_ZONE`) chỉ là lưới đỡ cho chỗ chưa biết người xem
  là ai; để nó rơi vào mặc định ở một trang là hiện một cột "quá hạn" lệch tối đa một ngày, và
  không ai truy ngược một con số như thế về một múi giờ. Vì vậy `toTaskViews`/`listTasks`/`getTask`/
  `listCommandTasks` nhận `timeZone` **bắt buộc**, không có mặc định — xem `lib/tasks.ts`.
  ⚠ Và **đừng cho `lib/*.ts` tự đọc phiên** để lấy giá trị đó: chúng phải gọi được từ script và job
  nền, nơi không có `cookies()` lẫn `getSession()`. Múi giờ đi xuống bằng tham số, từ hai cửa hợp lệ
  (`page.tsx` và route handler).
- **Job nền không có "người xem", nên nó là ca RIÊNG.** `lib/reminders.ts` truyền `DEFAULT_TIME_ZONE`
  tường minh và ghi rõ vì sao: đúng ra phải theo múi giờ NGƯỜI NHẬN, nhưng danh bạ không mang trường
  đó — `AccountMember` chỉ có `id`/`name`/`email`/`role`/`avatarUrl`, còn `timezone` nằm trên
  `AccountUser`, tức người ĐANG HỎI. Làm đúng cần Account trả thêm trường ấy ở API danh bạ.
- **Tầng dữ liệu giữ GIÁ TRỊ, không giữ chuỗi đã định dạng.** Bảng `activities` và `notifications`
  chỉ có `kind` + định danh; câu chữ dựng ở tầng hiển thị. Một trường `verb: "đã hoàn thành"` trong
  database nói mãi một thứ tiếng, kể cả với người đang đọc giao diện tiếng Anh — và không sửa ngược
  được.
- **`<RelativeTime>` đo từ đồng hồ THẬT.** Ở repo này điều đó ĐÚNG vì `pnpm seed` dời cả bộ dữ liệu
  theo ngày chạy. Đừng thêm lại prop `now` — nó chỉ cần khi dữ liệu đứng yên.
- **Xuất CSV phải có BOM.** Thiếu nó thì phần mềm bảng tính trên Windows đọc theo bảng mã hệ thống
  và mọi dấu tiếng Việt thành ký tự lạ — không lộ ra trên máy lập trình viên. Và ô bắt đầu bằng
  `=`, `+`, `-`, `@` phải được vô hiệu hoá: Excel hiểu chúng là CÔNG THỨC (CSV injection). Cả hai
  đã xử lý trong `lib/core/csv.ts`; xuất đúng tập ĐANG LỌC, không phải toàn bộ dữ liệu.

### `@comitor/ui`

- **`<CommandPalette>` dùng trong `<AppShell>` phải có `registerShortcut={false}`.** Shell đã gắn
  listener ⌘K của riêng nó; để mặc định là hai listener cùng lật một cờ trong một lần bấm — bảng
  lệnh mở rồi đóng ngay, trông y như phím tắt hỏng. Và **phải truyền `commandPaletteSlot`**: không
  có nó thì ô tìm kiếm trên header cùng phím ⌘K thành control chết.
- **`<SonnerToaster />` đặt NGOÀI `<AppShell>`**, một lần cho cả app: khung của shell là
  `h-dvh overflow-hidden`, để toast bên trong là bị cắt.
- **Root layout bọc BỐN provider hiển thị** — sáng/tối, bảng màu, mật độ, cỡ chữ — và cả bốn nhận
  `nonce`. Bỏ `nonce` đi thì hậu quả không phải trang vỡ mà là **nháy giao diện**: provider vẫn đặt
  thuộc tính qua `useEffect`, nhưng SAU lượt sơn đầu tiên. `@comitor/ui` ≥ 1.1.0 là bắt buộc vì lý
  do đó. `<html>` phải có `suppressHydrationWarning`.
- **`DataTable` là controlled hoàn toàn** — gói không giữ dữ liệu, không tự lọc, không tự phân
  trang. `visibleColumnIds` phải liệt kê **cả những cột không ẩn được**: gói lọc theo đúng tập hợp
  đó chứ không nhìn cờ `hideable`.
- **Đánh dấu dòng đang mở bằng `outline`, không bằng nền.** Mọi lớp nền trạng thái của `DataTable`
  đều có alpha; đi qua `cn()` cùng `bg-card` thì tailwind-merge **bỏ** `bg-card`, và ô cột ghim
  (`bg-inherit`) trở nên gần như trong suốt.
- **`ConfirmDialog` KHÔNG được đặt lồng trong `DropdownMenuItem`.** Radix đóng menu và THÁO nó khỏi
  DOM ngay khi một mục được chọn — chuyện đó xảy ra TRƯỚC khi `AlertDialog` bên trong kịp mở. Mục
  menu chỉ `setState`; hộp thoại do component CHA giữ, dạng controlled.
- **Hộp thoại dài: bọc nội dung trong `<DialogBody>`.** Không có nó thì cả hộp thoại cuộn và nút
  đóng `absolute` cuộn theo.
- **`FormField` có hai bản trùng tên, khác entry**: ở `@comitor/ui` là bố cục 12 cột, ở
  `@comitor/ui/form` là wrapper của `Controller`. Nhìn dòng `import` trước khi tra prop.
- **Tông CẢNH BÁO đã là của gói** — `Alert variant="warning"`, `Progress tone="warning"`. Đừng dựng
  lại bằng chuỗi class. ⚠ `Progress tone="warning"` kèm **vạch chéo**, và vạch là phần BẮT BUỘC chứ
  không phải trang trí: brand Comitor là gold còn warning là yellow, nên ở phần lớn bảng màu hai bậc
  ink gần như trùng nhau.
- **⚠ Đặt bề rộng cho `Combobox`/`MultiCombobox` bằng THẺ BỌC NGOÀI, không bằng `className`.**
  Đã đo trên `@comitor/ui` 1.3.4: `className` rơi vào NÚT bên trong, còn cụm icon (xoá + mũi tên)
  được định vị tuyệt đối theo WRAPPER — mà wrapper luôn là `relative w-full`. Truyền `w-56` thì nút
  rộng 224px, wrapper rộng 572px, và hai icon trôi ra **cách nút 350px**, nằm lơ lửng giữa khoảng
  trống. Không có gì báo đỏ; nó chỉ trông như một lỗi thiết kế, nên nó sống sót qua nhiều vòng xem.
  Bọc `<div className="w-56">` bên ngoài thì `w-full` của wrapper bằng đúng bề rộng ta muốn.
- **⚠ `<RelativeTime>` thuộc về một hòn đảo CLIENT, không đặt thẳng vào Server Component.** Nó cần
  `locale` của **date-fns**, mà một `Locale` của date-fns là object CHỨA HÀM (`formatDistance`,
  `localize`…) — hàm không tuần tự hoá được qua ranh giới server → client, nên Next ném *"Functions
  cannot be passed directly to Client Components"* và cả trang rơi vào `error.tsx`. Đã đo trên
  `/tasks/[taskId]`. **Và bỏ `locale` không phải lối thoát**: gói mặc định TIẾNG VIỆT, nên trang
  chạy bình thường với mỗi mốc thời gian nói tiếng Việt giữa giao diện tiếng Anh — cũng đã đo, ở
  đúng trang đó. Khuôn đúng: `app/(shell)/tasks/[taskId]/updated-at.tsx`. `pnpm i18n:check` chặn cả
  hai hình dạng.
- **⚠ Prop nhãn RỜI của gói mặc định là TIẾNG VIỆT** — `cancelLabel`, `clearLabel`,
  `selectedCountLabel`, `placeholder`, `searchPlaceholder`, `emptyText`, `loadingText`. `lib/i18n/ui-labels.tsx`
  chỉ phủ prop dạng object `labels`, nên bốn control đã từng hiện "Hủy" / "Đã chọn 2/8" giữa giao
  diện tiếng Anh. Không cổng nào bắt được lớp lỗi này (prop là optional nên `tsc` hài lòng, và
  chuỗi nằm trong gói nên `i18n:check` không thấy). Bảng tra đầy đủ ở đầu `lib/i18n/ui-labels.tsx`;
  dùng một control mới thì mở `.d.ts` của nó và đọc HẾT prop kết thúc bằng `Label`/`Text`/`Placeholder`.
- **⚠ ĐỪNG TÔ ICON BẰNG MÀU CÓ ALPHA — `opacity-*` thì ĐƯỢC, và khác biệt ấy là cả vấn đề.**
  Icon `lucide-react` là NHIỀU phần tử vẽ bằng NÉT (`stroke="currentColor"`), và nhiều icon có nét
  CẮT NHAU. Nét bán trong suốt chồng nhau thì chỗ giao bị tô **hai lần** — icon lộ ra những vệt nối
  không ai vẽ. Đã đo (hai nét cắt nhau, đọc pixel):
  · `color: rgba(0,0,0,.55)` → một nét **115**, chỗ giao **52** ✗
  · `opacity: .55`           → một nét **115**, chỗ giao **115** ✓
  `opacity` tạo stacking context nên cả icon hợp thành MỘT lần rồi mới pha vào nền; alpha trong
  `color` thì từng nét tô riêng. Cần nhạt hơn thì lấy một **bậc màu ĐẶC** (`text-muted-foreground`),
  đừng thêm `/NN`.
  ⚠ **Nó tái đi tái lại vì gần như không nhìn thấy được**: chỉ lộ ở icon nhiều nét cắt nhau
  (`Boxes` 12 phần tử — rõ; `User` 2 phần tử — không) và chỉ ở trạng thái KHÔNG active (active
  thường tô đặc). Người xem thấy đúng một icon "hơi lạ" giữa mười icon bình thường và cho là icon
  đó vẽ xấu. Vì vậy **bắt bằng grep, đừng bằng mắt**:
  `grep -rnE "size-[0-9.]+[^\"]*text-[a-z-]+/[0-9]|text-[a-z-]+/[0-9][^\"]*size-[0-9.]" app lib components hooks --include='*.tsx'`
  ⚠ Và **cổng màu không cứu được**: ca thật ở `@comitor/ui` (`sidebar-menu-item.tsx`) có sẵn một mục
  miễn trừ tương phản ĐÃ DUYỆT mà vẫn hỏng — thứ sai không phải tương phản, mà là cách HỢP THÀNH.
  `pnpm color:check` ở repo này cũng chỉ chặn mã màu viết thẳng, không chặn alpha trên icon.
  Vá ở gói từ `@comitor/ui` 1.8.2; chi tiết và số đo ở `docs/hop-dong-mau.md` §7b của gói.
- **⚠ Icon truyền làm CHILDREN của `<Button>` không được gói bọc `shrink-0`, và cũng không được
  đặt cỡ.** `<Button leftIcon={…}>` bọc sẵn `<span className="shrink-0">`; viết
  `<Button><Icon aria-hidden="true" /></Button>` thì icon render ở cỡ MẶC ĐỊNH của lucide — 24px,
  gấp rưỡi `size-4` (16px) mà 9 chỗ khác trong repo dùng. Đã đo: hai nút ở `/tasks/[taskId]` là
  hai icon 24px DUY NHẤT trong cả app. Dùng `leftIcon={<Icon className="size-4" />}`.
- **⚠ Lưới đáp ứng PHẢI có `grid-cols-1` ở bậc cơ sở.** `grid gap-6 lg:grid-cols-3` không có
  template nào dưới `lg`, nên cột là một track NGẦM `auto` — mà `auto` lấy **min-content làm sàn**.
  Một phần tử `truncate` bên trong (`truncate` ⇒ `white-space: nowrap`) có min-content bằng TOÀN BỘ
  chuỗi, nên cột phình theo chuỗi dài nhất và card thò ra ngoài màn hình. `grid-cols-1` của Tailwind
  là `repeat(1, minmax(0, 1fr))` — cùng một cột như hiện tại, chỉ bỏ cái sàn ấy đi.
  ⚠ **Triệu chứng KHÔNG lộ ra ở `document.documentElement`**: khung cuộn của app là
  `<main className="… overflow-y-auto">` của `AppShell`, và CSS không cho một trục `auto` còn trục
  kia `visible` — `overflow-x` tự thành `auto`, nên `main` cuộn ngang trong khi tài liệu thì không.
  Đo bằng `main.scrollWidth - main.clientWidth`, đừng đo `documentElement`.
  Đã đo ở `/` 375px: cột lưới 444,7px trong khung 343px, card thò 86px.
- **⚠ `t.rich` trả về một MẢNG node — đặt nó làm con TRỰC TIẾP của flex container là xé câu ra.**
  `["chữ trước ", <strong>…</strong>, " chữ sau"]` thành BA flex item, mỗi item tự xuống dòng
  riêng, nên một câu hiện ra thành ba cột cao thấp khác nhau. Đo được ở `NotYetActive`: 4 item,
  mỗi item 2 dòng. Bọc phần chữ trong MỘT `<span>` là xong. Cùng bẫy với `{a} {b}` — hai mảnh của
  một câu — trong một thẻ có `flex`.
- **⚠ Icon trong flex container phải có `shrink-0`.** Không có nó thì icon bị NÉN NGANG khi dòng
  chật: đo được `11.3 × 14` cho một icon khai `size-3.5` (14×14), tức méo 19% — và không có gì
  báo, nó chỉ trông như icon xấu. Đi kèm: canh `items-start` chứ không `items-center` khi chữ bên
  cạnh có thể nhiều dòng, nếu không icon trôi xuống giữa khối chữ.
- **⚠ `colSpan={6}` chỉ đúng khi hàng đó CÓ trường thứ hai bên cạnh.** Một trường 6 cột đứng một
  mình bỏ trống nửa phải, và mọi câu mô tả trong nó bị ép xuống nhiều dòng vô cớ (đo được: chữ
  457px trong card 976px). Cách chữa là `colSpan={12}` + bọc control bằng thẻ ngoài để giữ bề rộng
  — KHÔNG phải tách câu ra một hàng riêng: `FormField` tiêm `aria-describedby` xuống control, và
  tách ra là cắt mất liên kết đó.
- **Ô/nhãn chỉ có ICON phải mang `role="img"` + `aria-label`.** `aria-label` đặt trần lên `<span>`
  không có role thì bị bỏ qua. Tooltip KHÔNG phải tên gọi trợ năng. Ngược lại, icon TRANG TRÍ đứng
  cạnh chữ thì `aria-hidden="true"` và không nhãn.
- **`accent` của `FormSection` tô CẢ ô icon** (từ 1.4.0), không chỉ vạch trái. `primary` cố ý giữ
  ô trung tính: tint của nó chỉ đạt 1,64:1 ở bảng màu MẶC ĐỊNH vì `--primary-ink` trỏ về chính
  `--primary`. ⚠ Cổng `lint:a11y` của gói (từ `@comitor/ui` 1.6.0) ĐO cả bảng mặc định nhưng **chỉ
  CHẶN ở bảng tương phản cao** — bảng mặc định vào một sổ riêng, in ra mỗi lần chạy, chưa chặn. Nên
  cổng xanh KHÔNG có nghĩa bảng mặc định đạt; đọc khối "BẢNG MÀU MẶC ĐỊNH: N cặp dưới ngưỡng".
  (Trước 1.6.0 nó còn không đo — in ✓ cho một bảng chưa từng nhìn.)
- **⚠ Nâng `@comitor/ui` xong thì PHẢI khởi động lại dev server.** Tailwind quét
  `node_modules/@comitor/ui/dist` **một lần lúc khởi động**; class mới của gói không có rule và
  **hỏng IM LẶNG** — không có lỗi nào ở đâu, và nó trông y hệt một lỗi thiết kế.
- **⚠ `pnpm add @comitor/ui@<bản mới>` có thể IM LẶNG không nâng**: `minimumReleaseAge` trong
  `pnpm-workspace.yaml` chặn gói vừa publish, và lệnh chạy xong với mã 0 mà phiên bản không đổi.
  Kiểm bằng `node -e "console.log(require('./node_modules/@comitor/ui/package.json').version)"`.
  **Cách chữa đã có:** `minimumReleaseAgeExclude` nay liệt kê theo **TÊN GÓI**, không theo phiên
  bản — nên mọi bản mới của `@comitor/ui` và `@comitor/account-sdk` đi thẳng. Bản trước ghi tay 12
  phiên bản và danh sách đó đã có lỗ; nếu bạn thấy ai đó thêm một phiên bản vào danh sách, đó là
  dấu hiệu file đã bị lùi về khuôn cũ.
- **Mục "Cạm bẫy" phải được soát lại mỗi lần nâng MINOR của `@comitor/ui`.** Một cạm bẫy đã hết hiệu
  lực còn tệ hơn không ghi: nó dạy người sau đi đường vòng để né một lỗi không còn tồn tại.

### Bảo mật và hạ tầng

- **CSP: TUYỆT ĐỐI KHÔNG thêm nonce vào `style-src`.** CSP3: hễ `style-src` có nonce thì trình duyệt
  **bỏ qua `'unsafe-inline'`** — mà `'unsafe-inline'` ở đây không tránh được, vì React đặt `style=`
  THUỘC TÍNH. Hậu quả đo được ở Comitor.Account: thanh tiến độ hiển thị SAI TỈ LỆ (giao diện NÓI
  DỐI), icon mất màu, phần tử `sr-only` HIỆN RA. **Ví dụ trong tài liệu Next CÓ nonce ở `style-src`
  — chép nguyên là hỏng.**
- **CSP: `script-src` phải đứng TRƯỚC mọi `script-src-*`.** Phép tìm của Next dùng
  `startsWith("script-src")`, nên `script-src-elem` đứng trước sẽ khớp nhầm và nonce biến mất trong
  im lặng. `lib/core/csp.test.ts` khoá thứ tự này lại.
- **Đặt ĐÚNG MỘT tên header CSP.** Next đọc `csp || cspReportOnly`; có cả hai thì bản ép thắng, và
  nếu bản đó không chứa `script-src` thì nonce biến mất. `frame-ancestors` vì thế nằm TRONG chuỗi
  của proxy chứ không ở header riêng.
- **Tên header lần vết là `x-request-id`** — đã cài đặt (`lib/core/request-id.ts`). Giá trị của nó nằm
  HOÀN TOÀN ở chỗ năm module dùng CÙNG một tên: ghép log của module với log của Account chỉ làm
  được nếu hai bên gọi nó giống nhau, và đổi tên sau là sửa năm repo cùng lúc —
  `lib/core/request-id.test.ts` khoá tên ấy lại. `proxy.ts` LẤY header đến hoặc để `toRequestId()`
  sinh mới, rồi đặt lên **cả request lẫn phản hồi** (trả ra trình duyệt để người báo lỗi kèm được
  id); nhánh `/api/` nằm ngoài matcher nên tự sinh trong `withApiErrors`.
  ⚠ **GIỮ NGUYÊN các chuỗi sự kiện viết HOA** (`[auth] KHÔNG XOAY ĐƯỢC TOKEN`,
  `[i18n] KHOÁ HỎNG`…) — chúng là hợp đồng grep/alert đã có lý do ghi ở `lib/account/session.ts`.
  Đưa id vào một trường riêng, đừng trộn vào câu — `withApiErrors` làm đúng vậy.
  ⚠ Giá trị đến từ client phải đi qua `toRequestId()`: nó vào thẳng log, và một ký tự xuống dòng
  cài trong đó bẻ một dòng log thành hai dòng giả, mang đúng khuôn của những chuỗi viết HOA ở trên.
- **`lib/env.ts` là chỗ DUY NHẤT đọc `process.env` cho CẤU HÌNH.** Thiếu biến thì nổ lúc KHỞI
  ĐỘNG, không phải lúc người dùng đầu tiên chạm vào tính năng.
  Những chỗ khác cũng đọc `process.env`, và **mỗi chỗ đều nằm ngoài phạm vi câu trên vì một lý do
  thuộc BA loại** — bảng dưới là danh sách đầy đủ; đừng đếm bằng mắt, chạy lệnh ở cuối mục và đối
  chiếu từng dòng:

  | Chỗ | Biến | Vì sao ngoài phạm vi |
  |---|---|---|
  | `proxy.ts` | `COMITOR_S3_ENDPOINT`, `COMITOR_ACCOUNT_ASSETS_ORIGIN`, `NEXT_PUBLIC_COMITOR_ACCOUNT_URL`, `NODE_ENV` | Chạy ở **runtime riêng** của Next, không nạp được `lib/env.ts` |
  | `scripts/seed.ts` | `COMITOR_SEED_WORKSPACE_SLUG` | **Ngoài app** — script, không phải mã chạy khi phục vụ request |
  | `lib/account/links.ts` | `NEXT_PUBLIC_COMITOR_ACCOUNT_URL` | `NEXT_PUBLIC_*` phải viết **NGUYÊN VĂN**; file này được import từ mã client, mà `lib/env.ts` mang `server-only` |
  | `app/(shell)/shell-frame.tsx` | `NEXT_PUBLIC_APP_VERSION` | Cùng lý do trên |
  | `lib/prisma.ts` | `NODE_ENV` | Do runtime đặt, không phải cấu hình — không có gì để "nổ lúc khởi động" |
  | `lib/i18n/actions.ts` | `NODE_ENV` | Cùng lý do trên |
  | `lib/i18n/adopt.ts` | `NODE_ENV` | Cùng lý do trên — cờ `secure` của cookie, do runtime đặt |
  | `lib/account/prefs-seed.ts` | `NODE_ENV` | Cùng lý do trên — cờ `secure` của cookie GIEO, do runtime đặt |

  ⚠ Bản trước ghi "hai ngoại lệ", rồi "sáu", rồi "tám". Cả BA lần đều ĐẾM THIẾU: lần hai bỏ sót
  `lib/catalog/apps.ts`, lần ba bỏ sót `lib/account/prefs-seed.ts` — một file được thêm ở CHÍNH
  commit đã cập nhật bảng này. Một danh sách ngoại lệ đếm thiếu tệ hơn không có danh sách: nó làm
  người đọc tin rằng chỗ không có tên là vi phạm, rồi họ đi "sửa" một chỗ vốn đúng. Vì vậy câu trên
  KHÔNG còn ghim số nữa — số ghim trong câu là một cột đếm sẵn chồng lên bảng, đúng thứ chính file
  này cấm ở mục "Con số nào suy được thì suy". Bảng là danh sách; phép đếm là lệnh.
  Cách đếm lại, đừng đếm bằng mắt — một dòng mỗi file, đã loại comment và file test:
  `grep -rn "process\.env\." lib app proxy.ts scripts --include='*.ts' --include='*.tsx' | grep -v "^lib/env\.ts:" | grep -vE ':[0-9]+: *(\*|//|/\*)' | cut -d: -f1 | sort -u`
  Số dòng in ra phải bằng số dòng của bảng, và từng đường dẫn phải khớp. ⚠ Lệnh CŨ
  (`grep -v lib/env.ts` trên dòng THÔ, không có dấu `.` sau `env`) trả 16 dòng / 10 file — dính cả
  comment ở `links.ts`, `proxy.ts` và `lib/core/csp.test.ts` — nên không đối chiếu được với bảng, và
  đó là lý do ba lần thiếu trước không ai bắt được.
- **`NEXT_PUBLIC_*` phải viết NGUYÊN VĂN tên biến.** Next thay theo phép thay thế VĂN BẢN; gán tên
  biến vào một hằng rồi tra động thì KHÔNG được thay, và ở trình duyệt giá trị là `undefined`.
  Giá trị cũng bị **đóng băng lúc build** — đổi biến trên một bản đã deploy không có tác dụng.
- **Kho ảnh: database lưu KHOÁ, không lưu URL.** URL hiển thị được là URL **đã ký, có hạn**, sinh
  lại ở mỗi lần đọc. Lưu URL vào cột là lưu một giá trị sẽ hết hạn ngay trong database.
- **Ký theo cửa sổ 15 phút.** Không làm tròn thì mỗi lần render ra một URL khác nhau cho cùng tấm
  ảnh, mà trình duyệt và CDN cache theo URL — ảnh tải lại từ đầu ở mọi lần chuyển trang.
- **⚠ URL đã ký chết theo CREDENTIAL, không chỉ theo `expiresIn`.** Với IAM instance role thì
  credential là tạm thời, nên một URL ký TTL 1 tiếng sẽ 403 GIỮA CHỪNG. `lib/storage.ts` kẹp
  `expiresIn` theo hạn thật của credential.
- **Email: lỗi CẤU HÌNH phải NỔ, lỗi GỬI thì NUỐT — và ranh giới đó là một dòng mã.**
  `resolveTransport()` nằm NGOÀI `try`; đặt nó vào trong thì một `COMITOR_MAIL_TRANSPORT` gõ sai
  cũng bị nuốt, và cả hệ thống chạy êm ru trong khi không lá thư nào đi ra.
- **⚠ SES: `Charset: "UTF-8"` ở CẢ tiêu đề lẫn thân là BẮT BUỘC.** Thiếu nó thì SES mã hoá 7-bit và
  mọi dấu tiếng Việt thành rác. Hỏng ÂM THẦM: API trả 200, thư vẫn tới, chỉ người nhận đọc không ra.
- **`COMITOR_SMTP_USER` rỗng thì BỎ HẲN khối `auth`**, không truyền chuỗi rỗng: nodemailer vẫn thử
  AUTH và Mailpit sẽ từ chối — hỏng đúng ở môi trường phát triển.
- **`console` KHÔNG chứng minh được gì về đường gửi thật.** Dùng Mailpit
  (`COMITOR_MAIL_TRANSPORT=smtp`, cổng 1026, xem thư ở <http://localhost:8026>).

### Môi trường phát triển

- **Xem `pnpm dev` qua tên miền khác `localhost` thì phải khai `allowedDevOrigins`.** Đây là cạm bẫy
  dễ chẩn đoán sai nhất: Next **chặn** mọi request `/_next/*` vì coi là cross-origin. Triệu chứng
  **không** giống lỗi mạng — HTML do server render vẫn về đủ nên trang trông bình thường và có cả dữ
  liệu, nhưng không một chunk JS nào tải được → React không hydrate → mọi thứ cần client im lặng
  không chạy. Console trình duyệt **sạch**; chỗ duy nhất thấy được là cảnh báo trong log dev.
  Phân biệt nhanh: `pnpm build && pnpm start` mà chạy đúng thì code không sai.
- **`prisma generate` không tới được dev server đang chạy.** Đổi `schema.prisma` xong phải khởi động
  lại `pnpm dev`. Cùng họ với bẫy Tailwind quét `node_modules` một lần lúc khởi động.
- **Mọi lệnh `tsx` phải có `--conditions=react-server`** khi nó chạm `lib/` phía máy chủ: gói
  `server-only` NÉM LỖI khi được nạp thiếu điều kiện resolution ấy, với một thông điệp không liên
  quan gì tới nguyên nhân thật. `pnpm seed` đã có sẵn cờ này.
- **`pnpm-workspace.yaml` CÓ COMMIT.** Nó mang `allowBuilds` — thứ quyết định `prisma generate` có
  tải được query engine hay không. Một bản trước của `.gitignore` bỏ qua file này.

## Kiểm chứng thay đổi

```bash
pnpm check   # lint + typecheck + i18n:check + core:check + tenant:check + api:check + color:check + version:check + test + build
```

Tất cả phải xanh; `build` là cổng cuối. Liếc luôn **bảng route** mà `build` in ra — route lạ trong
đó là một trang thăm dò bị bỏ quên; đối chiếu với bản đồ route trong README.

Nếu là thay đổi giao diện, chạy dev rồi xem thật: mọi route trong **[bản đồ route ở README](README.md#bản-đồ-route)** — `pnpm build` in ra bảng route thật ở cuối, đối chiếu hai cái là biết bản đồ có lệch không, ở **cả hai ngôn ngữ**, **cả chế độ sáng và tối**, ở bề rộng 1280px và
375px. Bốn chỗ lỗi luôn lộ ra mà một vòng "tiếng Việt / laptop sáng" không thấy: khoá i18n bị sót
(chỉ hiện ở `en`), màu sai vai trò (chỉ hiện ở dark), tràn ngang (chỉ hiện ở 375px), và chuỗi tiếng
Anh dài hơn tiếng Việt làm vỡ bố cục nút.

Đụng vào lược đồ database → `pnpm db:migrate` và **commit migration**. Đụng vào quy tắc nghiệp vụ →
sửa `lib/core/` **và test của nó** trong cùng một lần.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
