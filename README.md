# comitor-ai-usage

**Sản phẩm Comitor: quản lý sử dụng AI** (key hãng, mã nội bộ, nhật ký token). Sao từ
`comitor-starter`, đổi danh tính `APP_ID=ai-usage`, cổng app **3050**.

## Bạn cần làm (Account) — không làm được từ repo này

Đăng nhập app mới **chưa chạy** cho đến khi Comitor.Account có app `ai-usage`. Nhờ người có
`isPlatformAdmin` (quản trị nền tảng Account, không phải owner workspace) khai:

1. App catalog: `appKey` = **`ai-usage`** (khớp `lib/core/app-identity.ts`).
2. Client web confidential + PKCE S256 → điền `COMITOR_CLIENT_ID` / `COMITOR_CLIENT_SECRET` vào `.env` của repo này (đừng dùng client của Starter).
3. `redirect_uris` = `http://localhost:3050/api/auth/callback` (từng ký tự).
4. `post_logout_redirect_uris` = `http://localhost:3050/signed-out`.
5. Bật app + cấp chỗ ngồi cho workspace (ví dụ `comitor-ai-usage`) tại
   https://account.dev.comitor.ai/w/comitor-ai-usage/apps
6. (Tuỳ chọn) webhook / back-channel: `http://localhost:3050/api/comitor/webhook` — Account online không gọi được localhost.

Chép mẫu: `../comitor-account/scripts/seed.ts` (client `tasks-web` là khuôn).

## Chạy trên máy này

Hồ sơ RDS: trong `.env` dùng `?schema=ai-usage` (schema riêng, không dùng `schema=starter`).

Key hãng, mã `sk-team-…` và nhật ký nằm ở **PostgreSQL** (ba bảng `ai_vendor_secrets` / `ai_team_users` / `ai_usage_logs`) — cùng `DATABASE_URL` với phiên đăng nhập. Mỗi hãng một hàng `(workspace, vendor)`. Deploy: đưa biến đó cho cả app 3050 và cổng 3100.

```bat
cd D:\develop\elines-source\comitor-ai-usage
pnpm install
pnpm exec prisma migrate deploy
pnpm dev
```

Mở http://localhost:3050 — chuyển vào `/ai-usage`.

Cổng LLM: trong `ai-gateway` chạy `pnpm start` (cổng **3100**). Chỉ một tiến trình gateway. Nó đọc `DATABASE_URL` từ `../.env` nếu `ai-gateway/.env` không có dòng đó. Chat: `/v1/chat/completions` và `/v1/messages`. Ảnh: `POST /v1/images/generations`. Video: `POST /v1/videos`. Danh sách model: `GET /v1/models`. USD trên nhật ký tra từ bản chụp LiteLLM — cron tuần (`.github/workflows/catalog-prices.yml`) hoặc `pnpm job:catalog-prices`.

Owner/admin của workspace đã bật app mới mới vào được trang quản lý.

---

# comitor-starter (khung gốc, giữ để tra)

**Bản khởi tạo đầy đủ** cho mọi sản phẩm SaaS mới của Comitor (Tasks, Chat, CRM, HR…). Sao repo này
về, đổi tên, thay dữ liệu mẫu — phần khung đã đúng chuẩn hệ sinh thái từ dòng đầu tiên, và những
quyết định đắt nhất (ranh giới với Comitor.Account, đa ngôn ngữ, ranh giới server/client, phân
quyền, kho ảnh, email) đã được trả giá một lần ở đây thay vì trả lại ở mỗi sản phẩm.

Module mẫu là **Công việc**: dự án, công việc, nhật ký hoạt động, thông báo, cài đặt và phân quyền.

| | |
|---|---|
| Khung | **Next.js 16** App Router · **React 19** · **TypeScript** (`strict` + `noUncheckedIndexedAccess`) |
| Giao diện | **Tailwind v4** khai bằng CSS · **[`@comitor/ui`](https://www.npmjs.com/package/@comitor/ui)** — design system dùng chung |
| Dữ liệu | **Prisma 6** + **PostgreSQL** — database của RIÊNG module |
| Đa ngôn ngữ | **`next-intl` 4** — `vi` (mặc định) + `en`, **không có tiền tố ngôn ngữ trong URL** |
| Danh tính | **Comitor.Account** qua [`@comitor/account-sdk`](https://www.npmjs.com/package/@comitor/account-sdk) — OIDC + PKCE, đã nối |
| Kho tệp | S3 / MinIO — MỘT bucket **riêng tư** dùng chung cho mọi app Comitor |
| Email | `console` · SMTP · Amazon SES |
| Kiểm thử | **Vitest** trên `lib/core/` — ngưỡng coverage 90%, `pnpm test` in ra số phép kiểm |
| Lint | **Biome** · pnpm |

> **Đọc bắt buộc trước khi sửa gì:** [AGENTS.md](AGENTS.md) (quy ước + cạm bẫy đã gặp thật) và
> [docs/kien-truc-ung-dung.md](docs/kien-truc-ung-dung.md) (mỗi dòng mã thuộc về đâu).
> Gửi thay đổi: [CONTRIBUTING.md](CONTRIBUTING.md). Đổi lược đồ: [docs/migration.md](docs/migration.md).
> Nâng từ một bản starter cũ hơn: [CHANGELOG.md](CHANGELOG.md).

---

## Xác thực qua Comitor.Account

Module **không tự giữ danh tính**. Người dùng đăng nhập một lần ở Comitor.Account rồi quay lại qua
luồng **OIDC authorization code + PKCE**; module phát cookie phiên của RIÊNG nó.

```
/  ──► requireSession() ──► chưa có phiên
                              └─► /api/auth/sign-in  ──► Account (đăng nhập)
                                                          └─► /api/auth/callback
                                                                └─► phiên vào DATABASE, cookie
                                                                    chỉ mang định danh mờ
                                                                      └─► requireWorkspaceAccess()
```

**Bốn file + NĂM route** nhập thẳng phần bên trong của phiên — và chỉ chúng:

| File | Việc |
|---|---|
| `lib/account/config.ts` | Cấu hình SDK — khai ĐÚNG MỘT chỗ |
| `lib/account/session-store.ts` | Phiên trong **database**: token niêm AES-256-GCM, xoay có khoá hàng |
| `lib/account/session-cookie.ts` | Ba cookie: định danh phiên (mờ) · đích quay lại (ngắn hạn) · cờ đăng xuất toàn hệ — để `/signed-out` không nói ngược về phiên ở Account |
| `lib/account/session.ts` | `requireSession()` — cửa DUY NHẤT mọi trang đi qua |
| `app/api/auth/{sign-in,callback,sign-out}/route.ts` | Ba route của luồng đăng nhập |
| `app/api/workspace/route.ts` | NGOẠI LỆ 1 — đổi không gian làm việc là **GHI** phiên của CHÍNH người gọi (`readSessionCookie` → `readSession` → `updateSession`), mà `requireSession()` chỉ ĐỌC |
| `app/api/comitor/webhook/route.ts` | NGOẠI LỆ 2 — `revokeSessionsForUser()`: giết phiên của NGƯỜI KHÁC, từ một request KHÔNG có phiên nào (tự xác thực bằng chữ ký HMAC) |

⚠ **Bản trước của dòng trên ghi "ba route", và nó SAI** — hai ngoại lệ đã tồn tại sẵn lúc câu ấy
được viết. Chúng KHÁC LOẠI, đừng gộp: một cái sửa phiên của người ĐANG GỌI, một cái xoá phiên của
người KHÁC. Cần thêm một route "sửa gì đó trong phiên" thì khuôn là `workspace/route.ts` — kể cả
phép kiểm "giá trị phải nằm trong danh sách Account trả về CHO CHÍNH NGƯỜI NÀY", vì
`requireWorkspaceAccess()` lẫn `pnpm tenant:check` đều KHÔNG cứu được sau khi phiên đã bị ghi sai.

⚠ `app/signed-out/page.tsx` cũng `import` từ `session-cookie.ts` nhưng KHÔNG thuộc danh sách trên:
`readGlobalSignOut()` chỉ đọc cờ `comitor-signed-out-everywhere`, không đọc `comitor-session` và
không chạm bảng `account_sessions`. Ghi ra đây vì lệnh đếm dưới CÓ trả về nó, và người đếm lại sẽ
tưởng mình vừa tìm ra một chỗ bị sót. Đếm lại, đừng đếm bằng mắt:
`grep -rln "account/session-store\|account/session-cookie" app --include='*.ts' --include='*.tsx'`

⚠ **Token nằm ở database, KHÔNG ở cookie** — và đó không phải sở thích kiến trúc mà là điều kiện để
xoay token chạy được: **Next cấm ghi cookie trong lúc render trang**, mà `getSession()` chạy từ
`page.tsx`. Toàn bộ câu chuyện, kèm log đo được, ở đầu `lib/account/session-store.ts`.

**Bốn lớp guard, bốn màn hình khác nhau.** `requireWorkspaceAccess()` phân biệt `NOT_A_MEMBER` ·
`APP_NOT_ENABLED` · `NO_SEAT` · `APP_SUSPENDED`, và `components/access-denied.tsx` hiện bốn câu với
bốn nút khác nhau — vì bốn tình huống đó dẫn tới bốn hành động khác nhau. Gộp thành "bạn không có
quyền" là bắt người dùng tự đoán phải đi hỏi ai.

**Ba trong BẢY điều SDK nuốt hộ** (bảng đủ ở `../comitor-account/packages/account-sdk/README.md` §"Bảy hành vi ngầm"), và nếu tự viết luồng thì phải nhớ cả bảy: luôn gửi `resource=` (thiếu nó
access token là chuỗi opaque, verify qua JWKS không được), luôn xin `offline_access` (thiếu nó
back-channel logout **không bao giờ** gọi tới app — log rỗng, không lỗi), và PKCE S256 bắt buộc kể
cả với confidential client.

⚠ **Đăng xuất có HAI mức, cố ý.** `/api/auth/sign-out` thoát khỏi riêng module (phiên ở Account còn
nguyên, các sản phẩm khác không bị ảnh hưởng); `?everywhere=1` thoát khỏi toàn hệ. Gộp một mức là
sai theo cả hai hướng.

### Chuẩn bị ở máy phát triển

**Không cần chạy comitor-account.** `.env.example` trỏ sẵn vào bản dev online:

```
NEXT_PUBLIC_COMITOR_ACCOUNT_URL="https://account.dev.comitor.ai"
```

Đó là mặc định **có chủ đích**, không phải tiện tay: `comitor-account` là một repo RIÊNG mà phần
lớn người làm module không có quyền đọc, nên "chạy Account ở local" không phải một bước họ làm
được. Bản dev online đã seed sẵn workspace, người dùng và OAuth client, và client khoá `tasks-web`
(hiển thị là **Comitor Starter**) bên đó **đã đăng ký `http://localhost:3000/api/auth/callback`** —
máy bạn chạy `pnpm dev` ở cổng 3000 là đăng nhập được ngay.

Ba biến còn phải điền tay:

| Biến | Lấy từ |
|---|---|
| `COMITOR_CLIENT_ID` / `COMITOR_CLIENT_SECRET` | client khoá `tasks-web`, hiển thị **Comitor Starter** — **xin người quản trị Comitor.Account** |
| `COMITOR_M2M_CLIENT_ID` / `COMITOR_M2M_CLIENT_SECRET` | client khoá `directory`, hiển thị **Comitor M2M Sample** — cùng chỗ |
| `COMITOR_SESSION_SECRET` | `pnpm setup:env` sinh sẵn; hoặc `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |

Hai cặp client là **bí mật**, nên chúng không nằm trong `.env.example` và cũng không nằm trong repo
này. Người có source của Account đọc chúng ở `comitor-account/scripts/seed-output-dev-remote.json`.

⚠ **Client id/secret gắn với TỪNG bản Account.** Đổi `NEXT_PUBLIC_COMITOR_ACCOUNT_URL` mà quên đổi
hai cặp kia thì Account trả `invalid_client` — thông điệp nói "sai client", không nói "bạn đang
cầm chìa của một ổ khoá khác". Cùng họ với bẫy `redirect_uri` ngay dưới đây.

⚠ `redirect_uri` đã đăng ký bên Account phải khớp **từng ký tự** với
`http://localhost:3000/api/auth/callback`. Cả bản online lẫn `comitor-account/scripts/seed.ts` đều
đăng ký đúng chuỗi đó — nên **đừng đổi cổng dev sang số khác**: đổi cổng là phải đăng ký lại bên
Account, và đó là việc của người quản trị Account, không phải một cờ `--port`. Lệch một ký tự thì
Account từ chối bằng `invalid_redirect_uri` — một thông điệp KHÔNG nói bên nào sai.

⚠ **Dùng Account online ở máy local thì đường ĐI VÀO không có.** Đường đi ra chạy đủ (đăng nhập,
danh bạ, entitlement — máy bạn gọi sang Account), nhưng Account online **không gọi được vào
`localhost` của bạn**: webhook (`/api/comitor/webhook`) và back-channel logout im lặng không tới.
Hậu quả thật, và cả hai đều KHÔNG có thông báo lỗi nào: "đăng xuất khỏi mọi thiết bị" bên Account
không giết phiên module ở máy bạn, và thu hồi chỗ ngồi phải chờ hết 30 giây cache
(`contextCacheSeconds` ở `lib/account/config.ts`). Cần thử đúng hai luồng đó thì phải chạy Account
tại chỗ, hoặc mở một đường hầm vào máy bạn.

⚠ **`pnpm seed` của module HỎI Account** để lấy `workspace_id` và id người thật; nó không tự bịa id.
Không có bảng người dùng nào ở đây để mà seed. Vì vậy `COMITOR_SEED_WORKSPACE_SLUG` phải là một
workspace **có thật ở bản Account đang trỏ tới** — `thienminh` trên bản dev online, `acme` trên một
Account chạy tại chỗ theo seed mặc định. Sai slug thì seed dừng ở `✗ Seed hỏng: Error: Không đọc
được entitlements của "<slug>": HTTP 404` — phần grep được là `Không đọc được entitlements`.

⚠ **Bản trước trích câu `404 Không tìm thấy không gian làm việc`, và chuỗi đó KHÔNG BAO GIỜ ra
terminal.** Nó là thân phản hồi 404 của chính Account, còn `getWorkspaceEntitlements` chỉ đọc
`response.status`. Muốn thông điệp nói rõ hơn thì việc phải làm là đọc thân phản hồi ở
`lib/account/entitlements.ts`, không phải chép câu của Account vào tài liệu.

<details>
<summary>Chạy Account tại chỗ thay vì bản online</summary>

Cần source của `comitor-account`. Chạy nó ở `:3200`, `pnpm seed` bên đó, rồi ở repo này đổi **ba
thứ cùng lúc** — đổi thiếu một là hỏng theo một thông điệp không chỉ về nguyên nhân:

```dotenv
NEXT_PUBLIC_COMITOR_ACCOUNT_URL="http://localhost:3200"
COMITOR_CLIENT_ID / COMITOR_CLIENT_SECRET          # seed-output.json khoá `tasks-web` → Comitor Starter
COMITOR_M2M_CLIENT_ID / COMITOR_M2M_CLIENT_SECRET  # seed-output.json khoá `directory` → Comitor M2M Sample
COMITOR_SEED_WORKSPACE_SLUG="acme"
```

Đổi xong phải **khởi động lại `pnpm dev`**: `NEXT_PUBLIC_*` được thay bằng phép thay thế VĂN BẢN,
nên giá trị cũ còn nằm trong bundle cho tới lần build lại.

</details>

### Một đánh đổi phải biết trước

Workspace đang mở được giữ trong **phiên**, không phải trong URL. Đường dẫn vì thế phẳng
(`/tasks`), nhưng **hai tab không mở được hai workspace** — đổi ở tab này đổi luôn tab kia. Module
nào cần điều đó phải chuyển sang `/w/[slug]/…`, và việc đó chạm mọi route nên hãy quyết định ngay
từ đầu. Lý do đầy đủ ở đầu `lib/account/session.ts`.

---

## Hai repo, đừng nhầm

| | `comitor-starter` (repo này) | `comitor-starter-v0` |
|---|---|---|
| Dùng để | **Khởi tạo sản phẩm thật** | Dựng **prototype** giao diện bằng v0 / Claude |
| Có gì | Xác thực, database, i18n, kho ảnh, email, test | Chỉ giao diện + dữ liệu tĩnh |
| Chuỗi hiển thị | `messages/{vi,en}.json` | viết thẳng tiếng Việt trong JSX |
| Cổng dev | **3000** | 3001 |

Hai repo tách nhau từ **2026-08-31** và **không còn đồng bộ**. Chiều chép đúng là **từ v0 sang đây**
(kèm rút chuỗi ra `messages/` và nối cổng API), không bao giờ ngược lại. Thứ duy nhất nên đi chung
nhịp là phiên bản `@comitor/ui`.

---

## Bắt đầu

Cần: **Node 24** (`.nvmrc`), **pnpm 11**. Docker (OrbStack hoặc Docker Desktop) thì **tuỳ hồ sơ** —
xem ngay dưới.

### Hai hồ sơ hạ tầng, chọn một

|  | **RDS dùng chung** | **Docker ở local** |
|---|---|---|
| Database | RDS dev dùng chung với Comitor.Account | Postgres trong container, cổng 5436 |
| Kho ảnh | S3 thật, bucket `comitor-dev`, tiền tố `starter/` | MinIO, cổng 9110 |
| Thư | Amazon SES — ⚠ **thư đi ra là thư THẬT** | Mailpit, đọc ở <http://localhost:8026> |
| Docker | **không cần container nào** | ba dịch vụ phải "healthy" |
| Chọn khi | máy yếu, hoặc không muốn nuôi hạ tầng ở local | cần chạy offline, hoặc cần thử thư mà không gửi ra ngoài |

Hai hồ sơ là **hai file `.env` khác nhau**, và đổi hồ sơ là **ghi đè `.env`** — nên **lưu trước
rồi mới chép**, vì `.env` đang chạy không có lệnh nào sinh lại được (nó mang client secret bạn dán
tay và `COMITOR_SESSION_SECRET` mà xoay là đăng xuất mọi người):

```bash
cp .env .env.docker    # ← LƯU hồ sơ hiện tại TRƯỚC (đổi tên cho đúng hồ sơ đang dùng)
cp .env.rds .env       # rồi mới đổi sang RDS + S3 + SES — không cần docker
```

Cả `.env.rds` và `.env.docker` đều **gitignored**, nên bản clone mới KHÔNG có chúng — bạn tự dựng:
`pnpm setup:env` cho ra đúng hồ sơ **docker** (đó là những gì `.env.example` khai), còn hồ sơ RDS
thì xin chuỗi kết nối và khoá AWS ở người quản trị hạ tầng rồi lưu lại thành `.env.rds`.

⚠ **TUYỆT ĐỐI không đặt tên file nào là `.env.local`.** Next nạp `.env.local` **ĐÈ LÊN** `.env`
(thứ tự `.env.<mode>.local` → `.env.local` → `.env.<mode>` → `.env`, gặp khoá đầu tiên là dừng),
trong khi **Prisma CLI và `tsx --env-file=.env`** (`pnpm seed`, `pnpm job:due-soon`) **chỉ đọc
`.env`**. Có cả hai file thì `pnpm dev` chạy MỘT database còn `pnpm db:deploy` / `pnpm seed` **GHI
vào database KHÁC** — và không một dòng lỗi nào. Tên `.env.rds` / `.env.docker` thì Next không bao
giờ tự nạp, nên chúng nằm cạnh nhau an toàn.
Kiểm nhanh: banner khởi động của `next dev` in `- Environments: …` — chỉ được thấy `.env`.

<details>
<summary>Hồ sơ RDS — năm điều phải biết khi database là của CẢ ĐỘI</summary>

**Một role dùng chung cho mọi module.** `comitor_module` có `CREATEDB` + `CREATE ON DATABASE`, và
hai quyền đó là đủ để một module MỚI tốn **0 thao tác trên RDS**: đổi `?schema=<slug>` trong `.env`
rồi `pnpm db:deploy` — Prisma tự tạo schema. `CREATEDB` là thứ làm `pnpm db:migrate` chạy được;
thiếu nó là `P3014 permission denied to create database`.
Mỗi module MỘT schema vì Prisma đặt `_prisma_migrations` theo schema trong chuỗi kết nối — hai
module cùng `schema=public` là dùng chung một bảng lịch sử migration.
⚠ Role đó **không có `USAGE` trên schema `account`**: module không đọc được dữ liệu danh tính của
IdP, và ranh giới ấy do database thi hành chứ không do kỷ luật.

**⚠ `pnpm seed` XOÁ dữ liệu của workspace đang seed.** Nó chạy bảy lệnh `deleteMany`, trong đó có
`rolePermission.deleteMany` — đặt lại toàn bộ ma trận phân quyền về mặc định. Trên RDS dùng chung,
hai người seed cùng một `COMITOR_SEED_WORKSPACE_SLUG` là xoá dữ liệu của nhau, và cái mất về phân
quyền thì không ai thấy cho tới lúc có sự cố. Thống nhất mỗi người một workspace, hoặc báo trước.

**⚠ `prisma migrate reset` không còn là lệnh vô hại.** Câu quen thuộc "reset thì hợp lý ở máy phát
triển" hết đúng khi "máy phát triển" là database của cả đội. Đọc lại `DATABASE_URL` **TRƯỚC** khi
gõ, đừng đọc sau. (`pnpm db:migrate` thì không tự reset — nó thoát 130 và gợi ý lệnh đó.)

**⚠ Thư đi ra là thư THẬT.** Giao một việc cho `owner@comitor.ai` là gửi vào hộp thư có thật, từ
tên miền đã xác minh DKIM của Comitor. Thử đường gửi mà không làm phiền ai thì dùng hộp **mô phỏng**
của chính SES: `success@simulator.amazonses.com` (và `bounce@…` cho bounce cứng) — chạy được cả khi
tài khoản còn trong sandbox. Và `sendMail()` **nuốt** lỗi gửi, nên phép thử là **đọc log** tìm dòng
`[mail] KHÔNG GỬI ĐƯỢC`, không phải xem lệnh có ném hay không.

**Module mới còn một bước nữa, ở phía Account.** `APP_ID` được gửi sang làm `appKey`, và guard
`APP_NOT_ENABLED` là fail-closed — workspace chưa bật app thì KHÔNG ai đăng nhập được. App chỉ có ở
dev **không đi vào `scripts/seed.ts` của Account** (seed dựng môi trường thật); thêm nó ở màn
**quản trị nền tảng** của Account — `/admin/apps` để đưa sản phẩm vào danh mục, rồi khối "Không gian
làm việc dùng app này" trên trang chi tiết để bật cho workspace và cấp chỗ ngồi. Cần tài khoản có
`isPlatformAdmin`.
⚠ `scripts/dev-register-app.ts` ĐÃ XOÁ (07.09.2026) — đừng đi tìm. Nó ghi thẳng database, tức không
qua chốt quyền và không để lại dấu vết nào.

</details>

```bash
# 1. Hạ tầng — CHỈ hồ sơ "Docker ở local" cần bước này; hồ sơ RDS thì BỎ QUA cả bước 1.
#    Postgres + MinIO + Mailpit. Một lệnh, không cần nhớ cờ nào.
#    Postgres 5436 · MinIO 9110 (API) / 9111 (bảng điều khiển) · Mailpit 1026 (SMTP) / 8026 (hộp thư)
#    Cổng lệch chuẩn CÓ Ý, và lệch cả với comitor-account — xem ghi chú đầu docker-compose.yml.
#    Bucket `comitor` được tạo sẵn, RIÊNG TƯ.
docker compose up -d

# 2. Biến môi trường. Dựng `.env` từ `.env.example` và sinh sẵn COMITOR_SESSION_SECRET.
#    ⚠ ĐỪNG dùng `cp .env.example .env` trần: `.env.example` cố ý ghi placeholder dạng hướng dẫn,
#    mà `lib/env.ts` thì TỪ CHỐI mọi placeholder. Bước 5 sẽ nổ với một thông điệp nói về
#    COMITOR_SESSION_SECRET chứ không nói "bạn quên một bước".
pnpm install
pnpm setup:env
cp .env .env.docker     # giữ ngay một bản của hồ sơ docker — bước 3 sẽ điền bí mật vào .env,
                        # và từ đó .env không sinh lại được nữa

# 3. Điền HAI cặp bí mật do Comitor.Account cấp — XIN người quản trị Account, rồi dán vào `.env`:
#      COMITOR_CLIENT_ID / COMITOR_CLIENT_SECRET          ← khoá `tasks-web` → Comitor Starter
#      COMITOR_M2M_CLIENT_ID / COMITOR_M2M_CLIENT_SECRET  ← khoá `directory` → Comitor M2M Sample
#    ⚠ KHÔNG cần chạy comitor-account: `.env.example` trỏ sẵn vào bản dev online
#      https://account.dev.comitor.ai, và client bên đó đã đăng ký callback ở cổng 3000.
#    Thiếu cặp thứ nhất: KHÔNG AI đăng nhập được (fail-closed, cố ý).
#    Thiếu cặp thứ hai: danh bạ RỖNG. Đường ĐỌC fail-open (thiếu vài tên, trang vẫn chạy); đường
#    GHI thì KHÔNG — requireMemberDirectory() ném 503 SERVICE_UNAVAILABLE, nên MỌI lệnh tạo/sửa
#    việc và tạo dự án hỏng, KỂ CẢ khi không giao cho ai (phép kiểm chạy trước, lib/tasks.ts).
#    Cố ý KHÔNG phải 422 ASSIGNEE_NOT_IN_WORKSPACE — bản trước ghi vậy, và nó SAI: một sự cố hạ
#    tầng không được báo thành lời khẳng định sai về dữ liệu.
#    Giao diện /tasks/new nay cảnh báo thẳng ca này.

# 4. Lược đồ database
#    Hồ sơ RDS: schema được tạo TỰ ĐỘNG từ `?schema=<slug>` trong DATABASE_URL — đã đo.
pnpm exec prisma migrate deploy     # lần đầu; sau này `pnpm db:migrate` khi đổi schema

# 5. Dữ liệu phát triển
#    ⚠ Seed HỎI Account để lấy workspace_id và id người thật — không có bảng người dùng nào ở đây
#    để mà seed. Với bản dev online thì không phải dựng gì; chỉ cần COMITOR_SEED_WORKSPACE_SLUG
#    là một workspace CÓ THẬT bên đó (`thienminh`). Sai slug → 404, và seed dừng ngay.
pnpm seed

# 6. Chạy
pnpm dev            # http://localhost:3000
```

> **Thứ tự trên không tuỳ ý.** Bước 5 (`pnpm seed`) đi qua `lib/account/directory.ts` →
> `lib/env.ts`, nên nó cần `.env` đã có giá trị THẬT. Bản trước của README đặt `pnpm seed` trước
> bước điền `.env` và vì vậy **nổ chắc chắn** ở mọi lần cài mới.

<details>
<summary>Lệnh Docker hay dùng (chỉ hồ sơ "Docker ở local")</summary>

```bash
docker compose ps          # trạng thái ba dịch vụ
docker compose logs -f     # log
docker compose stop        # dừng, GIỮ dữ liệu
docker compose down        # xoá container, GIỮ dữ liệu (volume có tên)
docker compose down -v     # xoá cả dữ liệu — dựng lại từ đầu thì phải migrate + seed lại
```

Bảng điều khiển MinIO: <http://localhost:9111> (`comitor` / `comitor-dev-secret`).
Hộp thư Mailpit: <http://localhost:8026>.

</details>

> **Không dựng Docker cũng chạy được — trừ một thứ.** Thiếu Postgres thì không có gì chạy. Thiếu
> MinIO thì mọi thứ vẫn chạy, chỉ riêng chức năng đính kèm ảnh tự tắt và giao diện nói rõ — xem
> `storageEnabled` trong `lib/env.ts`.

> **Dữ liệu seed tự dời theo ngày chạy.** Mọi mốc thời gian được viết theo một mốc cố định rồi dời
> đi đúng bằng khoảng cách tới hôm nay, nên quan hệ giữa chúng được giữ nguyên (việc quá hạn vẫn quá
> hạn) trong khi con số tuyệt đối luôn hợp lý. Nhờ vậy bản mẫu **không cũ dần theo tháng**, và
> `<RelativeTime>` đo từ đồng hồ thật là đúng.

### Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Máy chủ phát triển (Turbopack), cổng **3000** |
| `pnpm build` | `prisma generate` rồi `next build` |
| `pnpm check` | **Cổng đầy đủ** — lint + typecheck + i18n:check + core:check + tenant:check + api:check + color:check + version:check + test + build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | Biome (format + lint + sắp xếp import) |
| `pnpm test` | Vitest — **chỉ** `lib/core/`, kèm ngưỡng coverage 90% |
| `pnpm i18n:check` | Đối chiếu `messages/vi.json` với `messages/en.json` |
| `pnpm core:check` | Chặn chuỗi hiển thị lọt vào `lib/core/` |
| `pnpm tenant:check` | Chặn truy vấn chọn hàng mà không lọc theo `workspaceId` |
| `pnpm api:check` | Chặn route handler GHI thiếu `requirePermission()` |
| `pnpm color:check` | Chặn mã màu viết thẳng vào mã của app |
| `pnpm catalog:prices` / `pnpm job:catalog-prices` | Tải bảng giá LiteLLM, ghi bản chụp. Cron tuần: [`.github/workflows/catalog-prices.yml`](.github/workflows/catalog-prices.yml) (thứ Hai 10:00 ICT, mở PR nếu đổi). Hạ tầng tự vận hành thì hẹn `pnpm job:catalog-prices`, không `setInterval` trong Next |
| `pnpm db:migrate` | `prisma migrate dev` — ⚠ **CHỈ máy phát triển**; lịch sử lệch thì nó DỪNG (thoát 130), KHÔNG tự reset |
| `pnpm db:deploy` | `prisma migrate deploy` — lệnh dùng ở production/CI |
| `pnpm db:check` | `schema.prisma` có đi trước `migrations/` không. Cần `SHADOW_DATABASE_URL` — nó đọc biến đó từ `.env` qua `node --env-file`, KHÔNG qua shell (pnpm không nạp `.env` vào shell) |
| `pnpm setup:env` | Dựng `.env` từ `.env.example` + sinh `COMITOR_SESSION_SECRET`. Cho ra hồ sơ **docker**; hồ sơ RDS thì xem [Hai hồ sơ hạ tầng](#hai-hồ-sơ-hạ-tầng-chọn-một) |
| `pnpm seed` | Dữ liệu phát triển — **cần Account PHỤC VỤ ĐƯỢC**, mặc định là bản dev ONLINE (không phải chạy tại chỗ) |
| `pnpm job:due-soon` | Job nền mẫu: nhắc trước hạn. Ở production hẹn giờ bằng cron của **hạ tầng** |

Mọi cổng trong `pnpm check` chạy tự động trên mọi PR và mọi lần đẩy lên `main` —
[`.github/workflows/check.yml`](.github/workflows/check.yml), ở job `check`. Job đó **không cần
Postgres**, và file YAML ghi rõ vì sao. Hai phép kiểm CẦN database — `pnpm db:deploy` và
`pnpm db:check`, cố ý nằm NGOÀI `pnpm check` — chạy ở **job thứ hai**, khoá `database` (hiện trong
Actions dưới tên **migration**), job duy nhất có `services: postgres`.

Triển khai lên máy thật thì đọc [docs/trien-khai.md](docs/trien-khai.md): thứ tự ba bước, hai
endpoint health check và vì sao chúng tách nhau, và vì sao **một ảnh cho mỗi môi trường**.

Đổi lược đồ database thì đọc [docs/migration.md](docs/migration.md) trước: ba lệnh và chỉ một
trong ba dùng được ở production, công thức mở rộng → backfill → thu hẹp, và vì sao
`prisma migrate deploy` **không được** nằm trong `CMD` của container.

⚠ `pnpm lint` chạy với `--error-on-warnings`: **ở repo này warning LÀ lỗi**. Không có cờ đó thì
`as any` và import thừa đi qua cổng với mã thoát 0 — một cổng báo xanh cho đúng thứ nó được dựng
để chặn.

---

## Ba quy tắc lớn

### 1. App KHÔNG sở hữu màu

App **không được khai token màu và không được viết hex ở bất kỳ đâu** — không trong CSS, không trong
`style={{…}}`, không trong `metadata`, không trong SVG tự vẽ. Chỉ dùng class/biến của `@comitor/ui`.

**Thiếu màu thì sửa ở gói**: thêm token vào `@comitor/ui` → bump → publish → nâng version ở đây. Mất
5 phút và cả hệ sinh thái được lợi. Vá tại chỗ thì nhanh hơn, nhưng đổi lại là app của bạn lệch màu
với mọi app khác, hỏng chế độ tối, và không ai đo lại tương phản.

Mỗi màu có **ba vai trò**: `--x` tô NỀN · `--x-foreground` là chữ TRÊN nền đặc đó · `--x-ink` là
chính màu đó khi đi lên NỀN TRANG. Ba lỗi hay gặp nhất:

| Viết sai | Viết đúng |
|---|---|
| `text-red-600`, `#D64545`, `text-destructive` cho dòng lỗi | `text-destructive-ink` |
| `text-success` / `text-info` cho chữ hoặc icon trạng thái | `text-success-ink` / `text-info-ink` |
| `border-border` cho viền ô nhập, công tắc, checkbox | `border-input` |

Hệ quả trực tiếp: **`app/globals.css` chỉ có đúng hai dòng `@import`**. Ngoại lệ duy nhất trong repo
là `app/icon.svg` (favicon do trình duyệt vẽ ngoài trang nên không đọc được `var(--color-*)`).
Kiểm: `grep -rE "#[0-9A-Fa-f]{3,8}" app lib components hooks --exclude=icon.svg` phải ra **rỗng**.

### 2. Chuỗi hiển thị nằm trong `messages/`, không nằm trong mã

Mọi thứ người dùng đọc — kể cả `aria-label`, `placeholder`, `title`, nội dung `toast` — đi qua
`next-intl`. Tên biến, hàm, type, tên file, **đường dẫn URL** và giá trị union thì bằng **tiếng
Anh**; comment và tài liệu bằng **tiếng Việt**.

⚠ **Đường dẫn URL KHÔNG phải ngoại lệ.** URL là hợp đồng máy — nó vào router, vào liên kết trong
email, vào deep link của app di động, vào phân tích truy cập, và nó không dịch được. Với module
Comitor còn một lý do nặng hơn: **Comitor.Account chuyển hướng tới đường dẫn của từng sản phẩm**,
nên đường dẫn là API công khai của module.

Bốn chỗ chứa chuỗi, không trộn — và bốn cái bẫy đã gặp thật — ở
[docs/kien-truc-ung-dung.md](docs/kien-truc-ung-dung.md) §5.

### 3. Quy tắc nghiệp vụ ở `lib/core/`, không ở `.tsx`

> Hàm thuần, có test, **không trả về chuỗi hiển thị**. Component chỉ nối dây.

Đây là quy tắc mua được nhiều nhất trong ba quy tắc, vì nó đổi một loại lỗi **chỉ lộ ra sau khi
deploy** lấy một test chạy trong một giây:

| Quy tắc | Nếu nó nằm trong `.tsx` |
|---|---|
| "Quá hạn là hạn chót trước hôm nay" | Sai một ngày với mọi người dùng ngoài GMT+7 |
| "Mã việc kế tiếp đếm từ mã lớn nhất" | Sinh mã trùng ngay lần đầu có người xoá một việc |
| "Bộ lọc rỗng nghĩa là KHÔNG lọc" | Bảng đầy dữ liệu thành bảng rỗng ngay lần mở bộ lọc đầu |
| "Chủ sở hữu luôn có mọi quyền" | Chỉ đúng ở chỗ nào có người nhớ viết `if` |

Hai cổng canh tầng này: `biome.json` chặn **import sai tầng**, `pnpm core:check` chặn **chuỗi hiển
thị lọt vào** — thứ mà không lint nào bắt được.

---

## Bản đồ mã nguồn

```
app/
  layout.tsx                 Root: font Inter, 4 provider hiển thị (nonce), NextIntlClientProvider
  globals.css                Đúng 2 dòng @import — xem quy tắc số 1
  icon.svg                   Favicon — ngoại lệ hex duy nhất của repo
  error.tsx  not-found.tsx   Trang biên — nằm NGOÀI (shell), xem ghi chú trong file
  signed-out/                /signed-out       ┐ hai trang biên của luồng xác thực, cũng NGOÀI
  sign-in-failed/            /sign-in-failed   ┘ (shell): chúng phải hiện được KHI KHÔNG CÓ PHIÊN
  (shell)/                   Khu có khung app
    layout.tsx               Server Component — CỬA DỮ LIỆU của khung app
    shell-frame.tsx          "use client" — AppShell; KHÔNG import bản ghi nào
    page.tsx                 /              Tổng quan
    tasks/                   /tasks, /tasks/new, /tasks/[taskId]
    projects/                /projects — thực thể THỨ HAI, khuôn cho "thực thể cha" của module bạn
    settings/                /settings + 3 tab con
  api/
    auth/                    sign-in · callback · sign-out — luồng OIDC
    tasks/                   POST tạo việc · [taskId] PATCH/DELETE
                             [taskId]/attachment POST/DELETE tệp đính kèm
    projects/                POST tạo dự án
    notifications/           PATCH đánh dấu đã đọc (userId lấy từ PHIÊN, không từ thân)
    workspace/               PUT đổi không gian làm việc (slug phải thuộc danh sách của chính họ)
    task-drafts/             PUT nháp biểu mẫu — một bản cho mỗi người, mỗi workspace
    settings/  permissions/  PUT — đều đi qua requirePermission()
    health/  ready/          GET — thăm dò của hạ tầng; KHÔNG có phiên (xem docs/trien-khai.md)
  api/comitor/
    webhook/                 POST — Account đẩy sự kiện sang; tự xác thực bằng chữ ký HMAC

lib/
  contracts/                 TẦNG 0 — chỉ KIỂU, không một dòng mã chạy được
  core/                      TẦNG 1 — quy tắc nghiệp vụ THUẦN, có test (ngưỡng + ngoại lệ ở §Kiểm thử)
  catalog/                   Bảng khai giao diện: thứ tự, tone, icon, id — KHÔNG nhãn
  api-client/                TẦNG 2 — cửa DUY NHẤT giao diện gọi ra ngoài
  account/                   Ranh giới với Comitor.Account: config · session · session-store ·
                             session-cookie · directory (M2M) · entitlements · links ·
                             prefs-seed (cookie trung chuyển bốn trục hiển thị)
  i18n/                      config · resolve locale + múi giờ · Server Action đổi ngôn ngữ ·
                             adopt (gieo locale/timezone từ hồ sơ Account) · nhãn @comitor/ui ·
                             dựng chuỗi ở server · nhãn vai trò · gộp bảng khai
  api/                       Hình dạng phản hồi JSON: withApiErrors · apiOk · apiError
  tasks.ts                   Đọc VÀ ghi (createTask) — dùng chung giữa Server Component,
                             route handler, và mã chạy ngoài request (seed, job nền)
  projects.ts                Đọc VÀ ghi (createProject) — thực thể THỨ HAI, cùng khuôn rìa B
                             với tasks.ts (app/api/projects/route.ts)
  task-drafts.ts             Nháp biểu mẫu: một bản cho mỗi người, mỗi workspace
  settings.ts permissions.ts   ⚠ permissions.ts giữ CHỐT QUYỀN THẬT (requirePermission)
  activities.ts              Nhật ký + thông báo — giữ GIÁ TRỊ, không giữ câu chữ
  storage.ts  mail.ts        Kho tệp riêng tư · ba transport email
  env.ts                     Chỗ DUY NHẤT đọc process.env — nổ lúc KHỞI ĐỘNG khi thiếu
  reminders.ts               Nghiệp vụ job nhắc hạn — gọi được từ job nền, route và test
  prisma.ts  today.ts  format.ts

(không có stores/)           TẦNG 3 — chưa màn hình nào thoả bốn điều kiện ở docs §3
hooks/                       TẦNG 4 — use-catalog · use-error-message · use-settings-draft
components/                  TẦNG 5 — cụm dùng ở nhiều route: bảng lệnh ⌘K, chuông, bộ chọn ngôn ngữ
messages/                    vi.json · en.json — MỌI chuỗi hiển thị
i18n/                        request.ts (khai trong next.config.ts) · types.d.ts (kiểm khoá lúc build)
prisma/                      schema.prisma + migrations (CÓ commit)
scripts/                     seed · setup-env · jobs/ · và sáu cổng: check-messages ·
                             check-core-strings · check-tenant-scope · check-api-guards ·
                             check-colors · check-version
proxy.ts                     CSP + nonce mỗi request  ⚠ tên là proxy.ts, không phải middleware.ts
instrumentation.ts           onRequestError — móc DUY NHẤT bắt được lỗi RSC / Server Action
docs/kien-truc-ung-dung.md   Sáu tầng, bảng CẤM import, checklist trước khi mở PR
```

### Bản đồ route

| Route | Trang |
|---|---|
| `/` | Chuyển thẳng vào `/ai-usage` |
| `/tasks` | Công việc — bảng dữ liệu (lọc, sắp xếp, phân trang, chọn nhiều dòng, ẩn/hiện cột, xuất CSV) |
| `/tasks/new` | Tạo công việc — biểu mẫu dài, nhiều nhóm trường |
| `/tasks/[taskId]` | Chi tiết một công việc — **TRANG động duy nhất** của repo (khuôn `await params` ở tầng trang) |
| `/projects` | Dự án — thực thể THỨ HAI, khuôn cho "thực thể cha" của module bạn |
| `/ai-usage` | Trang chính — key hãng, mã nội bộ, nhật ký (cần `app.settings`) |
| `/settings` | Cài đặt của module — tab "Chung" (index của nhóm) |
| `/settings/notifications` | Thông báo về sự kiện của module |
| `/settings/permissions` | **Phân quyền theo chức năng** — ma trận vai trò thô × quyền của module |
| `/settings/advanced` | Nâng cao — chính sách dữ liệu + vùng nguy hiểm |

Ba tab con là **route thật**, không phải `?tab=`. Bảng trên là **toàn bộ** phần giao diện có
khung app.

Thêm **hai trang biên của luồng xác thực**, nằm ngoài `(shell)` vì cả hai chỉ có nghĩa khi KHÔNG có
phiên — đưa chúng vào trong khung là chúng sẽ bị `requireSession()` đẩy sang màn đăng nhập trước khi
kịp hiện, tức là đúng cái lỗi mà chúng sinh ra để chữa:

| Route | Trang |
|---|---|
| `/signed-out` | Đã thoát khỏi module — kèm lối thoát mức hai (`?everywhere=1`) |
| `/sign-in-failed` | Đăng nhập hỏng ở callback — một câu, một nút thử lại, KHÔNG tự chuyển hướng |

⚠ **Không có trang thành viên, và đó là ranh giới chứ không phải chỗ còn thiếu** — xem mục kế tiếp.

Ngoài mười trang đó, `app/api/` có bốn nhóm route handler — ranh giới giữa nhóm hai và nhóm ba là
chốt quyền, nên đừng đọc lướt:

· **Luồng OIDC** — `auth/sign-in` · `auth/callback` (`GET`, nằm ngoài phạm vi `pnpm api:check`) và
  `auth/sign-out`.
· **Đường GHI có chốt quyền**, đều gọi `requirePermission()` — `tasks` · `tasks/[taskId]` ·
  `tasks/[taskId]/attachment` · `projects` · `task-drafts` · `settings` · `permissions` ·
  `ai-usage/vendors` · `ai-usage/users` · `ai-usage/users/[id]` · `ai-usage/users/[id]/block`.
· **Đường GHI trên CHÍNH phiên / dữ liệu của người gọi** — `workspace` (PUT) · `notifications`
  (PATCH). Không có quyền nào để hỏi: `userId` và danh sách workspace đều lấy từ PHIÊN, không từ
  thân request.
· **Không có phiên người dùng nào để hỏi** — `comitor/webhook` (chữ ký HMAC) · `health` · `ready`
  (xem [docs/trien-khai.md](docs/trien-khai.md)).

⚠ **`// @api-guard: <lý do>` KHÔNG phải nhãn của nhóm ba.** `scripts/check-api-guards.ts` đòi nó ở
mọi route export `POST`/`PUT`/`PATCH`/`DELETE` mà không gọi `requirePermission()` — nên
`auth/sign-out` cũng mang, còn `health`/`ready` (chỉ `GET`) mang nó chỉ để ghi lý do. Chỗ ghi lý do
là chính file được miễn trừ, không phải danh sách này. Đếm lại, đừng đếm bằng mắt:
`find app/api -name route.ts | sort`

`pnpm build` in ra bảng route ở cuối; đối chiếu nó với bảng này. Route lạ trong đó là một trang thăm
dò bị bỏ quên.

---

## Ranh giới Account / module

**Comitor.Account trả lời đúng ba câu:** *bạn là ai* · *bạn thuộc không gian làm việc nào với vai
trò thô gì* (`owner`/`admin`/`member`/`guest`) · *không gian làm việc đó được dùng app nào*.
**Mọi câu khác là của module**, và dữ liệu nằm ở database của module.

Ranh giới đó được viết thẳng vào lược đồ: **`prisma/schema.prisma` KHÔNG có bảng `User`,
`Workspace`, `Member` hay `Role`.** Module chỉ giữ định danh (`workspace_id`, `assignee_user_id`);
tên người đọc từ `lib/account/directory.ts`.

Vì sao không để Account giữ luôn bảng quyền chi tiết cho mọi app: Comitor là SaaS nhiều sản phẩm,
mỗi app ở một repo và ra bản theo nhịp riêng. Quyền chi tiết nằm tập trung thì mỗi lần một app thêm
tính năng, Account lại phải đổi lược đồ và phát hành theo — Account thành nút cổ chai của cả hệ.

Nửa còn lại nằm ở module: `lib/catalog/permissions.ts` khai 11 quyền theo chức năng, bảng
`role_permissions` lưu ma trận 4 × 11, và `/settings/permissions` là giao diện sửa nó.

⚠ **Ẩn một nút không phải là phân quyền.** Chốt thật là `requirePermission()` ở
`lib/permissions.ts`, và nó đọc **cùng bảng** mà giao diện đọc — một phép kiểm viết riêng ở máy chủ
là nguồn sự thật thứ hai, và hai nguồn thì sớm muộn nói khác nhau.

---

## Đa ngôn ngữ

`vi` (mặc định) và `en`. **Không có tiền tố ngôn ngữ trong URL** — `/tasks` vẫn là `/tasks` cho mọi
người dùng; ngôn ngữ lấy theo thứ tự: cookie `comitor-locale` → header `Accept-Language` → `vi`.

Cookie đó được **gieo từ hồ sơ Comitor.Account** (`AccountUser.locale`) ở route callback sau mỗi
lần đăng nhập, theo luật có-dấu ở `lib/i18n/adopt.ts`: *đi theo Account, trừ khi bạn đã tự đổi trên
thiết bị này*. Múi giờ HIỂN THỊ đi cùng đường, qua cookie `comitor-tz`. Hai giá trị này đã nằm sẵn
trong ngữ cảnh mà `requireWorkspaceAccess()` dù sao cũng lấy về, nên chúng **không tốn thêm một
vòng mạng nào** — và module **không bao giờ ghi ngược** lên Account (`assertSessionActor` ném 403).

Lý do nặng nhất: **Comitor.Account chuyển hướng người dùng tới đường dẫn của module** sau khi đăng
nhập, và nó không biết ngôn ngữ của người đó. Một tiền tố ngôn ngữ biến mỗi `redirect_uri` đã đăng
ký thành N đường. Đánh đổi phải chấp nhận: chia sẻ một liên kết không mang theo ngôn ngữ.

Thêm một ngôn ngữ — hai chỗ làm tay, phần còn lại TypeScript tự chỉ:

1. `LOCALES` + `LOCALE_LABELS` trong `lib/i18n/config.ts`;
2. `messages/<mã>.json`;
3. rồi `pnpm typecheck`: MỌI bảng `Record<Locale, …>` trong `lib/` **báo đỏ** cho tới khi điền
   xong. Đếm lại, đừng đếm bằng mắt:
   `grep -rln "Record<Locale" lib --include='*.ts' --include='*.tsx'`

⚠ **Bản trước ghi "đúng ba chỗ… chỗ thứ tư và thứ năm" và chỉ kể `ui-labels.tsx` + `mail.ts` — nó
ĐẾM THIẾU.** Hôm nay còn `lib/i18n/messages.ts` và `lib/format.ts`, và chúng KHÔNG cùng loại hậu
quả, nên đừng bỏ qua cái nào vì tưởng chúng giống nhau:
· `lib/i18n/messages.ts` (`LOADERS`) — `loadMessages()` gọi thẳng `LOADERS[locale]()`, nên thiếu
  khoá là gọi một hàm `undefined`: mọi trang ở ngôn ngữ mới NỔ, không phải "nửa Việt nửa Anh";
· `lib/i18n/ui-labels.tsx` — giao diện vẫn CHẠY, chỉ là nửa Việt nửa Anh;
· `lib/mail.ts` · `lib/format.ts` — chuỗi email và khuôn ngày/mã BCP-47 của ngôn ngữ mới.

Rồi `pnpm i18n:check && pnpm typecheck`.

⚠ **Đi một vòng chỉ bằng `vi` thì không bao giờ thấy khoá nào bị bỏ sót.** Đổi nhanh:
`document.cookie = "comitor-locale=en; path=/"` rồi tải lại.

---

## Kho tệp và email

> **Đính kèm tệp: đã nối đủ.** `POST` / `DELETE /api/tasks/{taskId}/attachment`, ô tải lên ở
> `/tasks/{taskId}`. Ba quyết định bảo mật, cả ba đều ở chỗ dễ làm sai:
> **(1)** từ chối theo `Content-Length` **TRƯỚC** `request.formData()` — kiểm sau lời gọi đó nghĩa
> là một tệp 500 MB vẫn được nuốt trọn vào bộ nhớ rồi mới bị từ chối;
> **(2)** kiểu tệp đọc từ **byte đầu** (`sniffImageType`), không từ `file.type` do trình duyệt
> khai — và kiểu ghi vào object là kiểu ĐO ĐƯỢC, vì trình duyệt sẽ render nội dung đó từ tên miền
> của ứng dụng khi mở URL đã ký;
> **(3)** `taskId` đến từ URL nên nó phải chứng minh công việc thuộc đúng không gian làm việc —
> 404, không phải 403.
> Đã chạy thật: một tệp HTML khai `image/png` bị chặn ở `422 ATTACHMENT_TYPE_INVALID`, và bucket
> không còn object mồ côi nào sau khi thay tệp / gỡ tệp / xoá việc.

**Kho tệp**: MỘT bucket **riêng tư** dùng chung cho mọi app Comitor. Không object nào đọc được ẩn
danh. Ba luật, cả ba đều có lý do đã trả giá:

- **Database lưu KHOÁ object, không lưu URL.** URL hiển thị được là URL **đã ký, có hạn**, sinh lại
  ở mỗi lần đọc — lưu nó vào cột là lưu một giá trị sẽ hết hạn ngay trong database.
- **Khoá mang tiền tố `{app}/{tính-năng}`** (`starter/attachment/…`): chung bucket mà không có tiền tố
  là hai app ghi đè lên nhau, và không giới hạn được quyền theo từng app.
- **Ký theo cửa sổ 15 phút.** Không làm tròn thì mỗi lần render ra một URL khác nhau cho cùng tấm
  ảnh, mà trình duyệt và CDN cache theo URL.

MinIO và S3 dùng **cùng một mã**: khác biệt duy nhất là `COMITOR_S3_ENDPOINT`.

**Email**: ba transport cho ba hoàn cảnh — `console` (terminal, mặc định khi phát triển), `smtp`
(giao thức chung, dùng với Mailpit ở local), `ses` (đường của production, lấy credential từ IAM
instance role).

⚠ `console` **không chạy một dòng nào** của transport SMTP, nên nó không chứng minh được gì về
đường gửi thật. Đi đường thật ở local:

```bash
# trong .env
COMITOR_MAIL_TRANSPORT="smtp"
COMITOR_SMTP_HOST="localhost"
COMITOR_SMTP_PORT="1026"
# rồi mở http://localhost:8026 để xem thư
```

---

## Kiểm thử

| Tầng | Công cụ | Phủ |
|---|---|---|
| Lõi thuần | `pnpm test` (Vitest) | `lib/core/**` — không mock, không jsdom, ngưỡng coverage 90%. ⚠ Ba module chưa có test riêng (`app-identity`, `project-input`, `task-input`) — chúng được phủ gián tiếp qua chỗ gọi |
| Ranh giới chuỗi | `pnpm core:check` | chặn chuỗi hiển thị lọt vào `lib/core/` |
| Bộ chuỗi | `pnpm i18n:check` | **chín** phép kiểm — khoá thiếu/thừa, tham số ICU lệch, khoá chứa dấu chấm, khoá SUY RA từ mã, markdown trong chuỗi, `t("…")` thiếu `{}` trong JSX, `<RelativeTime>` thiếu `locale`, khoá MỒ CÔI ở ba bảng khai |
| Biên dịch + bảng route | `pnpm build` | cả repo |

**Vì sao chỉ `lib/core/`.** Tầng đó bị cấm import `react`, `next/*`, `@prisma/*` — nên test chạy
trong `node` trần, không mock, không setup file. **Ngày nào một test ở đây cần mock là ngày một quy
tắc nghiệp vụ đã rò ra khỏi tầng thuần**; sửa chỗ rò, đừng thêm mock.

**Vì sao không unit-test route handler.** Mock Prisma thì test sẽ xanh với những giả định mà
database thật không chia sẻ — và một bộ test xanh sai còn tệ hơn không có test, vì nó mua được sự tự
tin mà không mua được sự đúng. Tầng đó kiểm bằng cách chạy thật.

Playwright thì **chưa dựng**, có chủ đích: bàn giao một bộ e2e chưa ai chạy là bàn giao một thứ sẽ
đỏ vì lý do không liên quan rồi bị tắt. Hình dạng nên có ở
[docs/kien-truc-ung-dung.md](docs/kien-truc-ung-dung.md) §6.

---

## Sao repo này về — và nhận bản sửa khung sau đó

Đây là câu hỏi sống còn của mô hình "chép bản mẫu", và nó **không phải** câu "chép thế nào". Chép
thì dễ. Câu khó là: sáu tháng sau, starter sửa một lỗi trong `lib/account/`, thì năm module đã sinh
ra nhận bản sửa đó bằng cách nào?

```bash
git clone <starter> comitor-crm && cd comitor-crm
git remote rename origin upstream          # starter vẫn ở đó, đổi tên cho khỏi nhầm
git remote add origin <repo mới của bạn>
git push -u origin main
```

**GIỮ lịch sử, đừng `degit`.** Một bản sao không có lịch sử thì không merge ngược được, và khi đó
cách duy nhất để nhận một bản vá là đọc diff rồi gõ tay — tức là nó sẽ không xảy ra.

Sau đó, mỗi lần starter ra tag mới:

```bash
git fetch upstream --tags
git log --oneline main..upstream/v0.3.0    # đọc CHANGELOG trước khi merge
git merge upstream/v0.3.0
```

Hai điều kiện để đường này còn sống, và cả hai đều dễ vi phạm mà không nhận ra:

- **Đừng reformat file khung.** Một lần chạy formatter với cấu hình khác trên `lib/account/` biến
  mọi lần merge sau này thành xung đột toàn file. Đây là cách nhanh nhất để tự cắt mình khỏi hệ.
- **Đừng sửa file khung tại chỗ.** Cần một hành vi khác thì sửa **ở starter** rồi kéo về — nếu
  không, module của bạn và starter phân kỳ ở đúng những file mà bản vá bảo mật sẽ đi qua.
  Danh sách "file khung" ở mục ngay dưới đây.

⚠ Vì sao điều này không phải lo xa: **5 commit liên tiếp trước Đợt 0 đều là `fix(auth)`**, chạm
đúng `lib/account/session-store.ts`, `session.ts` và `app/api/auth/**` — tức đúng những file mọi
module chép nguyên và không bao giờ mở ra. Và lỗi mà chúng sửa **tự che**: người dùng bị đá về đăng
nhập rồi SSO đưa họ quay lại trong dưới một giây, nên không ai báo lỗi. Dấu vết duy nhất là một
dòng log máy chủ.

Xem [CHANGELOG.md](CHANGELOG.md) — mỗi mục ghi rõ *module đã sinh ra phải làm gì*.

---

## Ranh giới: cái gì giữ, cái gì thay, cái gì xoá

Câu hỏi này quyết định một tuần đầu của mọi module, và cho tới nay repo trả lời nó bằng **một
câu**. Hậu quả có thể đoán trước: đội CRM hoặc giữ nguyên `/tasks` sáu tháng vì không dám động,
hoặc xoá theo cảm tính và mất `lib/core/csv.ts` cùng với nó.

Ba nhóm, theo **quy tắc** chứ không theo danh sách từng file — một danh sách từng file sẽ lệch sau
ba commit:

| Nhóm | Nhận ra bằng | Làm gì |
|---|---|---|
| **Khung — giữ nguyên** | Không nhắc tới `task`/`project` ở tên hay ở kiểu | Đừng sửa. Sửa ở đây là tách khỏi starter và mất đường nhận bản vá. `lib/account/`, `lib/api/`, `lib/env.ts`, `lib/prisma.ts`, `lib/storage.ts`, `lib/mail.ts`, `lib/permissions.ts`, `lib/settings.ts`, `lib/i18n/`, `proxy.ts`, `instrumentation.ts`, `app/api/auth/`, `app/(shell)/settings/`, `components/`, và trong `lib/core/`: `csp`, `csv`, `iso-date`, `url`, `accept-language`, `return-path`, `api-error`, `permissions`, `app-identity` |
| **Khung — giữ, thay nội dung** | Là bảng khai hoặc bảng dữ liệu mà *hình dạng* thuộc về khung | `lib/catalog/*`, `Activity`/`Notification`/`TaskDraft` trong schema, `messages/*.json`, `lib/contracts/settings.ts` |
| **Mẫu — thay hết** | Có `task`/`project` trong tên | `app/(shell)/tasks/`, `app/api/tasks/`, `lib/tasks.ts`, `lib/projects.ts`, `lib/task-drafts.ts`, `Project`/`Task`/`TaskWatcher` trong schema, và trong `lib/core/`: `task-*`, `project-progress`, `attachment` |

⚠ **`lib/core/` trộn cả hai nhóm đầu và nhóm cuối**, và `lib/contracts/` cũng vậy. Đó là chỗ dễ xoá
nhầm nhất — đọc cột "Nhận ra bằng" trước khi xoá một file ở đó.

---

## Bắt đầu một module mới từ starter này

Thứ tự có lý do: đổi danh tính trước thì mọi ảnh chụp màn hình và mọi lần thử sau đó đã là sản phẩm
của bạn, không phải bản mẫu đội lốt.

**1. Danh tính** — mười chỗ, và ba trong số đó hỏng ÂM THẦM nếu quên

- **`lib/core/app-identity.ts` → `APP_ID`.** Sửa file này TRƯỚC. Nó là nguồn duy nhất của: tiền tố
  khoá object trong bucket dùng chung, `appKey` gửi cho Comitor.Account, và `id` của app trong
  `lib/catalog/apps.ts`.
  ⚠ Quên nó thì module của bạn ghi tệp khách hàng vào tiền tố `starter/` — **nằm ngoài phạm vi IAM
  được cấp cho app của bạn**, và không có gì báo. Cái sai nằm trong dữ liệu, không trong mã.
  ⚠ `APP_ID` nằm trong dữ liệu đã ghi, nên đổi nó SAU khi có dữ liệu thật là một lần di trú.
- **`lib/mail.ts` → `PRODUCT_NAME`.** Tên ở chân **mọi email**. Quên nó thì thư của Comitor CRM ký
  tên "Comitor Bản mẫu" — thứ người nhận thấy trước đội phát triển.
- **`docker-compose.yml`**: bốn `container_name`, `POSTGRES_DB`, và **năm cặp cổng** theo bảng cấp
  phát ở đầu file (module thứ N: app `3000+10N`, Postgres `5436+10N`, …). Hai module cùng cổng thì
  module lên sau **nối vào database của module kia**.
- **`.claude/launch.json`**: cổng phải khớp `docker-compose.yml`. Lệch cổng là kiểu lỗi im lặng
  nhất của repo này — agent chụp màn hình một server, người đọc README mở một server khác.
- `package.json`: `name`, `description`.
- `messages/{vi,en}.json` → `app.name`, `app.description`. (Root layout đọc từ đó — **đừng** viết
  tên sản phẩm vào `layout.tsx`.)
- `messages/**` → `shell.slogan` (chân thanh bên đang ghi "Starter").
- `app/icon.svg`: biểu tượng sản phẩm, lấy từ brand kit.
- `lib/catalog/apps.ts`: app của bạn để **đầu danh sách** (`id` đã tự khớp qua `APP_ID`).
- `.env.example` và `.env`: `DATABASE_URL`, `COMITOR_APP_URL`, `COMITOR_S3_BUCKET` nếu bucket khác.

Kiểm nhanh xem còn sót chỗ nào:

```bash
grep -rn "starter\|comitor_starter" --exclude-dir=node_modules --exclude-dir=.git --exclude=*.md .
```

**2. Lược đồ và nghiệp vụ**

- `prisma/schema.prisma` có **10 model**, chia ba nhóm — đừng xoá nhầm nhóm:

  | Nhóm | Model | Làm gì với chúng |
  |---|---|---|
  | **Hạ tầng — giữ nguyên** | `AccountSession` | ⚠ **Xoá là hỏng đăng nhập.** Phiên OIDC nằm ở đây. |
  | **Hạ tầng — giữ nguyên** | `AppSetting`, `RolePermission` | Cài đặt và ma trận quyền của mọi module |
  | **Hạ tầng — giữ nguyên** | `WebhookEvent` | Khử trùng webhook của Account (khoá chính = `payload.id`). Xoá là mọi lần Account thử lại — 5 lần, giãn tới 2 giờ — bị xử lý HAI lần; `member.added` hai lần thì không vô hại. **Không có `workspace_id`**, cố ý. |
  | **Khung — giữ, đổi nội dung** | `Activity`, `Notification` | Giữ `kind` + định danh; đổi tập `kind` theo miền của bạn |
  | **Khung — giữ, đổi nội dung** | `TaskDraft` | Đổi tên theo biểu mẫu của bạn; cột `Json` giữ nguyên hình dạng |
  | **Mẫu — thay hết** | `Project`, `Task`, `TaskWatcher` | Mô hình của module mẫu |

  ⚠ Giữ `workspace_id` ở mọi bảng mang DỮ LIỆU KHÁCH HÀNG (`pnpm tenant:check` canh), và **đừng
  thêm bảng người dùng**. Ba ngoại lệ đã ghi lý do trong `UNSCOPED_MODELS` ở
  `scripts/check-tenant-scope.ts` — `TaskWatcher`, `AccountSession`, `WebhookEvent`; thêm cái thứ
  tư là một quyết định, viết lý do vào đó.
- `lib/catalog/permissions.ts`: thay 11 quyền bằng quyền của module bạn. Phần còn lại
  (`lib/core/permissions.ts`, trang `/settings/permissions`) không phải sửa dòng nào.
- Quy tắc nghiệp vụ mới → **hàm thuần trong `lib/core/` kèm test TRƯỚC**, rồi mới viết giao diện.

**3. Điều hướng và route**

- Viết lại `lib/catalog/navigation.ts` + khoá nhãn ở `messages/**` mục `nav.*`, rồi tạo thư mục
  tương ứng trong `app/(shell)/`. Route nào không có trang thì đừng để trong nav.
- Xoá các route mẫu khi không còn dùng — xoá cả thư mục, kể cả file `"use client"` bên trong.

**4. Đăng ký module ở Comitor.Account.** Xác thực đã nối sẵn trong starter (`@comitor/account-sdk`),
nên việc còn lại nằm **bên Account**, không nằm trong repo này. Sáu thứ phải khai — và cả sáu đều
hỏng IM LẶNG khi sai, nên hãy đối chiếu từng dòng với `../comitor-account/scripts/seed.ts`, file đó
là bản mẫu chép được:

| Khai gì | Giá trị | Sai thì triệu chứng là |
|---|---|---|
| Client web, **confidential**, PKCE **S256** | → `COMITOR_CLIENT_ID` / `_SECRET` | `invalid_client` |
| `redirect_uris` | `["{COMITOR_APP_URL}/api/auth/callback"]`, khớp **từng ký tự** | `invalid_redirect_uri` — và nó KHÔNG nói bên nào sai |
| Scope, **kèm `offline_access`** | SDK tự thêm; đừng ghi đè | Không có refresh token → phiên rơi sau ~15 phút |
| `appKey` khớp key app của bạn | `CURRENT_APP_ID` ở `lib/catalog/apps.ts` | `requireWorkspaceAccess()` NỔ (đúng ý — xem `lib/account/config.ts`) |
| Client **M2M riêng**, scope `account.directory.read` + `account.entitlements.read` | → `COMITOR_M2M_*` | Danh bạ rỗng; mọi đường GHI ném 503 `SERVICE_UNAVAILABLE` — cố ý KHÔNG phải 422 `ASSIGNEE_NOT_IN_WORKSPACE` |
| **Đích nhận webhook** + `COMITOR_WEBHOOK_SECRET` | `{COMITOR_APP_URL}/api/comitor/webhook` (⚠ **không** có `/` cuối) | Gỡ thành viên ở Account không đóng được phiên ở module |
| `backchannel_logout_uri` + `enable_end_session` | `{COMITOR_APP_URL}/api/comitor/backchannel-logout` | Phiên module KHÔNG chết khi người dùng đăng xuất toàn hệ ở Account — và hỏng với LOG RỖNG |

⚠ Ở máy phát triển, một số mục phải ghi thẳng vào database của Account: API của nó từ chối host
`localhost`. `../comitor-account/scripts/seed.ts` đã làm sẵn cho client khoá `tasks-web` (hiển thị
**Comitor Starter**).

✅ **`backchannel-logout` đã dựng** (2026-09-07) — `app/api/comitor/backchannel-logout/route.ts`.
Nó xác minh `logout_token` bằng `verifyLogoutToken` của `@comitor/account-sdk` (từ `0.3.0`;
ES256 qua JWKS, zero-dependency) rồi gọi `closeSessionsBySid()`. `sid` được lưu lúc đăng nhập vào
cột `account_sessions.sid`.

⚠ **Người chạy module ở `localhost` KHÔNG nhận được back-channel logout**, dù đăng ký đúng: đây là
fetch đi RA từ máy chủ Account, và bản Account online không gọi vào máy sau NAT được. Thứ vẫn hoạt
động là `/oauth2/end-session` (RP-initiated logout, chạy ở TRÌNH DUYỆT). Xem khối cảnh báo ở
`.env.example`.

⚠ **`workspace.suspended` thì KHÔNG thu hồi phiên**, nó chỉ bỏ cache ngữ cảnh: người dùng giữ
nguyên phiên và gặp màn chặn `APP_SUSPENDED` ở lần render kế tiếp. Đó là hành vi đúng — tạm ngừng
vì thanh toán không phải là thu hồi quyền truy cập — nhưng đừng trông đợi nó đóng phiên.
(Bản trước của dòng này gọi sự kiện đó là `app.suspended`, một tên **Account không hề bắn ra**;
tên thật ở `comitor-account/lib/workspace-hooks.ts`.)

**5. Trước khi gửi review**

```bash
pnpm check
```

Rồi mở thử ở **cả hai ngôn ngữ**, **cả hai theme**, bề rộng **1280px và 375px**. Bốn chỗ lỗi luôn lộ
ra mà một vòng "tiếng Việt / laptop sáng" không thấy: khoá i18n bị sót (chỉ hiện ở `en`), màu sai
vai trò (chỉ hiện ở dark), tràn ngang (chỉ hiện ở 375px), và chuỗi tiếng Anh dài hơn tiếng Việt làm
vỡ bố cục nút.

---

## Đọc thêm

- [AGENTS.md](AGENTS.md) — quy ước bắt buộc giữ + cạm bẫy đã gặp thật (cho cả người và agent).
- [docs/kien-truc-ung-dung.md](docs/kien-truc-ung-dung.md) — sáu tầng, bảng CẤM import, checklist.
- [docs/con-ton.md](docs/con-ton.md) — cái CHƯA làm, mỗi mục kèm một điều kiện kiểm được bằng
  một lệnh (khác mục "Không làm": đó là thứ không bao giờ thêm).
- [docs/them-mot-thuc-the.md](docs/them-mot-thuc-the.md) — 23 bước cho một thực thể mới, kèm cột
  **cổng nào bắt được nếu quên** (và những ô không cổng nào bắt được).
- [CLAUDE.md](CLAUDE.md) — phần riêng cho Claude Code: preview, vòng kiểm chứng.
- README của `@comitor/ui` — bảng entry (§3), bảng component (§5), màu và token (§6).
- `../comitor-account/README.md` — Account làm gì và KHÔNG làm gì; hợp đồng API.
