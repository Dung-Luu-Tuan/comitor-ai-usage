# Nhật ký thay đổi

Mỗi mục ghi **hai** thứ, và thứ hai mới là thứ có giá trị:

- **Khung đổi gì** — file nào trong phần mọi module chép nguyên đã thay đổi;
- **Module đã sinh ra phải làm gì** — hành động cụ thể cho một đội đang bảo trì module của họ.

Một mục không có mục thứ hai là một mục chỉ hữu ích cho người viết nó. Xem
[CONTRIBUTING.md](CONTRIBUTING.md) §"Thay đổi chạm FILE KHUNG".

> **Vì sao repo này cần CHANGELOG trong khi phần lớn repo nội bộ thì không:** starter được SAO CHÉP,
> nên câu hỏi sống còn không phải "chép thế nào" mà **"bản sửa đi ngược thế nào"**. Không có nhật ký
> và không có tag thì sau sáu tháng sẽ có N bản khung khác nhau, và bản đúng là bản không ai đang
> chạy.

---

## v0.1.0 — 2026-09-10

PATCH: tách **Comitor AI Usage** thành module riêng (`APP_ID=ai-usage`, cổng 3050).

### Khung đổi gì

Không. Đây là bản sao đã đổi danh tính, không phải bản phát hành khung starter.

### Module đã sinh ra phải làm gì

Không áp dụng — đây là sản phẩm mới.

---

## v0.11.0 — 2026-09-07

MINOR: **màu app TỰ SUY theo khoá** — `@comitor/ui` 1.10.0 vẽ ô icon của bệ phóng bằng
`IconAvatar`. Ba prop màu của `AppDescriptor` thành deprecated.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `package.json` | `@comitor/ui` ^1.8.3 → **^1.10.0** |
| `lib/catalog/apps.ts` | **Gỡ** `AppAccent`, `APP_ACCENTS`, `appAccentFor()` |
| `app/(shell)/shell-frame.tsx` | `AppDescriptor` truyền `tone` thay cho ba prop `accent*` |

### Module đã sinh ra phải làm gì

1. **Nâng `@comitor/ui` lên `^1.10.0`, rồi khởi động lại dev server** (Tailwind quét
   `node_modules` một lần lúc khởi động).

2. **Bỏ `accent`/`accentInk`/`accentForeground` khỏi `AppDescriptor`.** Chúng vẫn nằm trong kiểu
   nên `tsc` KHÔNG báo gì — nhưng `AppLauncher` không còn đọc, tức truyền vào là vô tác dụng. Đây
   là lớp hỏng im lặng: mã biên dịch sạch, màu thì do gói quyết.

3. **Gỡ bảng màu app ghi cứng của bạn.** Màu nay suy từ `id` (khoá app) bằng bảng 8 tone dùng
   chung với `LetterAvatar`, nên sản phẩm mới có màu ngay. Muốn chọn tay thì truyền `tone` — một
   tên trong `AVATAR_TONE_NAMES`.

⚠ **Màu app SẼ ĐỔI so với bản trước, kể cả khi bạn không sửa gì.** Đó là chủ ý. Chỗ nào cần giữ
nguyên sắc cũ thì đặt `tone` đúng tên sắc đó.

⚠ **Hạt giống phải là KHOÁ, không phải tên.** Gói đo được **4/6 app đổi màu** khi chuyển vi ⇄ en
nếu băm theo tên hiển thị. `AppDescriptor.id` đã là khoá, nên chỉ cần đừng truyền tên vào đó.

⚠ **8 tone thì danh mục 6+ app sẽ có trùng** — đo được 5/6 sắc khác nhau. Nghịch lý ngày sinh,
không chữa được bằng hàm băm khác; `tone` là đường ra.

---

## v0.10.2 — 2026-09-07

PATCH: nâng `@comitor/ui` lấy nốt ca icon lộ vệt nối ở sidebar THU GỌN.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `package.json` | `@comitor/ui` ^1.8.2 → **^1.8.3** |

### Module đã sinh ra phải làm gì

**Nâng lên `^1.8.3`, và soát lại mã của mình theo VẾ THỨ HAI của luật icon.**

v0.10.1 đã dặn "đừng tô icon bằng màu có alpha", và câu đó khiến người ta đi tìm màu trên chính
`<svg>`. Nhưng icon lấy màu qua `currentColor`, nên **một thẻ CHA mang màu có alpha cũng đầu độc nó
y hệt** — và ca đó KHÔNG có chuỗi nào nằm cạnh `size-4` để lệnh grep ở v0.10.1 bắt được.

Chính gói đã trả giá đúng một bản phát hành cho chỗ này: 1.8.2 chữa `iconClass`, còn ô sidebar thu
gọn vẫn hỏng tới 1.8.3. Đo trên bản deploy sau khi 1.8.2 đã lên: thanh bên **mở rộng 0/4** icon còn
alpha, **thu gọn 4/4** ở `0.7`.

Nên phép soát có hai vế — vế thứ hai cho nhiều kết quả giả và phải đọc bằng mắt, nhưng nó là vế duy
nhất thấy được ca kế thừa:

```bash
grep -rnoE "text-[a-z-]+/[0-9]+" app lib components hooks --include='*.tsx'
```

Rồi với mỗi kết quả, hỏi: thẻ mang class này có bọc một `<Icon>` không có màu riêng không?

---

## v0.10.1 — 2026-09-07

PATCH: nâng `@comitor/ui` để lấy bản vá icon lộ vệt nối. Không đổi API nào của khung.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `package.json` | `@comitor/ui` ^1.8.1 → **^1.8.2** |
| `AGENTS.md` | Thêm luật "đừng tô icon bằng màu có ALPHA" vào mục "Cạm bẫy › `@comitor/ui`" |

### Module đã sinh ra phải làm gì

1. **Nâng `@comitor/ui` lên `^1.8.2`**, rồi **khởi động lại dev server** — Tailwind quét
   `node_modules/@comitor/ui/dist` MỘT LẦN lúc khởi động, nên không restart thì class mới của gói
   không có rule và hỏng IM LẶNG.

2. **Soát mã của CHÍNH app: đừng tô `<svg>` icon bằng màu có alpha.** Icon `lucide-react` là nhiều
   phần tử vẽ bằng NÉT và nhiều icon có nét CẮT NHAU; nét bán trong suốt chồng nhau thì chỗ giao bị
   tô hai lần và icon lộ vệt nối. Đo được: hai nét cắt nhau, `color: rgba(0,0,0,.55)` cho chỗ giao
   **52** so với **115** ở một nét.

   ⚠ **`opacity-*` thì AN TOÀN** — nó tạo stacking context nên cả icon hợp thành MỘT lần rồi mới
   pha (`115/115`). Đừng "dọn" nó đi; hai cơ chế khác nhau và chỉ một cái sai.

   ⚠ **Không cổng nào bắt được lớp lỗi này.** Ca thật ở gói đã ĐI QUA cổng tương phản và ĐƯỢC
   DUYỆT — thứ sai không phải tương phản mà là cách HỢP THÀNH. `pnpm color:check` cũng chỉ chặn mã
   màu viết thẳng. Bắt bằng grep, đừng bằng mắt — lệnh ở `AGENTS.md`, số đo đầy đủ ở
   `docs/hop-dong-mau.md` §7b của gói.

---

## v0.10.0 — 2026-09-07

MINOR: **bệ phóng ứng dụng thôi là bảng ghi cứng** — nó nay đọc danh mục THẬT của Comitor.Account,
kèm ba trạng thái chỗ ngồi. Đi cùng là một lỗi màu im lặng làm MỌI icon ứng dụng mất sắc nhận diện,
và đường quay lại sau đăng nhập được siết thêm một luật.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `package.json` | `@comitor/account-sdk` 0.3.0 → **^0.4.0** — SÀN MỚI, xem bên dưới |
| `lib/contracts/account.ts` | Thêm `AppTile` + `AppTileState`; `AccountSession` thêm `apps` |
| `lib/account/session.ts` | Thêm `listAppTiles()` — ghép danh mục với quyền dùng, fail-open trả mảng rỗng |
| `lib/account/links.ts` | Thêm `accountCreateWorkspaceUrl` (`/workspaces?new=1`) |
| `lib/core/return-path.ts` | `toSafeInternalPath` loại thêm mọi đoạn `..` |
| `lib/catalog/apps.ts` | Bỏ `APPS`, `DEV_LOCKED_APP_IDS`, `appOrigin()`; còn hai bảng tra ĐÓNG (tên icon → component, token màu → biến CSS) |
| `.env.example` | **Gỡ** `NEXT_PUBLIC_COMITOR_APPS_ORIGIN` — không còn chỗ nào đọc |
| `messages/{vi,en}.json` | Bỏ `apps.*` — tên và mô tả sản phẩm nay do Account trả, đã chọn ngôn ngữ |

### Module đã sinh ra phải làm gì

1. **Nâng SDK lên `^0.4.0`.** Sàn này bắt buộc nếu bạn lấy bệ phóng: `listAppCatalogue()`,
   `appUrlFor()` và kiểu `AppCatalogueEntry` chỉ có từ bản đó. Bản cũ vẫn biên dịch, nhưng bệ phóng
   sẽ không có nửa "khám phá thêm".

2. **⚠ ĐỔI `var(--color-x)` THÀNH `var(--x)` ở MỌI CHỖ dựng màu app.** Đây là lỗi đáng chép sang
   module nhất trong bản này, vì nó hỏng **im lặng tuyệt đối**: `styles.css` của gói khai `--teal`
   thẳng ở `:root` (luôn có) rồi khai thêm `--color-teal: var(--teal)` bên trong khối `@theme` của
   Tailwind — mà biến `@theme` chỉ được xuất ra khi trình quét thấy chuỗi đó trong VĂN BẢN nguồn.
   Ghép tên bằng template (`var(--color-${token})`) là trình quét không thấy gì và cắt sạch. Hậu
   quả: `--app-accent` thành giá trị không hợp lệ, `bg-app-accent` cho ra nền TRONG SUỐT, và thuộc
   tính `style` vẫn nằm nguyên trong DOM nên soi HTML thì thấy đủ màu.
   Kiểm bằng một dòng, đừng nhìn bằng mắt:
   `getComputedStyle(document.documentElement).getPropertyValue("--color-teal")` — rỗng là hỏng.
   ⚠ Và trình quét đọc CẢ COMMENT: một biến có thể sống chỉ vì một comment nhắc tên nó. Đó là lý do
   thứ hai để bám `--x`.

3. **Nếu bạn có màn đăng nhập riêng, thêm luật `..` vào bộ lọc đường quay lại.**
   `/..//trang-khac.vn` giữ NGUYÊN origin nội bộ khi phân giải (nên một phép so origin cho qua)
   nhưng chuẩn hoá RA thành `//trang-khac.vn`. Bản của starter không chuẩn hoá nên chưa từng thành
   open redirect thật — luật này bịt cái bẫy đặt sẵn cho người thêm bước chuẩn hoá sau này.

4. **Gỡ `NEXT_PUBLIC_COMITOR_APPS_ORIGIN` khỏi `.env` và mọi bảng cấu hình.** Địa chỉ sản phẩm anh
   em nay là `baseUrl` do Account trả, theo đúng môi trường đang chạy. Biến cũ đoán URL theo khuôn
   `https://{app}.…`, và cái giá đã được ghi lại ngay trong JSDoc của nó: bản dev ném người dùng
   sang **production** của app anh em, mang theo phiên của họ, không có gì báo.

5. **Nếu bạn giữ `messages/apps.*`, xoá đi.** Tên sản phẩm là DỮ LIỆU của Account và đã được chọn
   ngôn ngữ theo hồ sơ người hỏi; giữ bản dịch riêng là dựng nguồn sự thật thứ hai sẽ lệch.

---

## v0.9.0 — 2026-09-07

MINOR: **back-channel logout đã dựng** — nửa còn lại của lỗ hổng mà v0.8.x mới đóng được nửa đầu
bằng webhook. Người dùng bấm "đăng xuất khỏi mọi thiết bị" ở Comitor.Account nay ĐÓNG được phiên ở
module; trước đó phiên sống tiếp tới 30 ngày và không có gì báo.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `package.json` | `@comitor/account-sdk` 0.2.0 → **^0.3.0** |
| `prisma/schema.prisma` | `AccountSession` thêm cột `sid String?` + `@@index([sid])` |
| `prisma/migrations/…_account_session_sid/` | Migration mới: `ADD COLUMN "sid" TEXT` + index. Cộng thêm, không mất dữ liệu |
| `lib/account/session-store.ts` | `StoredSession.sid`; `createSession` ghi cột; thêm `closeSessionsBySid()` |
| `app/api/auth/callback/route.ts` | Lưu `tokens.sid` vào phiên |
| `app/api/comitor/backchannel-logout/route.ts` | **MỚI** — đích nhận `logout_token` |
| `README.md`, `prisma/schema.prisma` | Ba chỗ nói "CHƯA dựng" nay nói ngược lại |

**Verify JWT nằm ở SDK, không ở đây — và đó là quyết định cũ, nay thực thi.** Bản trước của docblock
`AccountSession` đã dặn đúng như vậy: verify là hành vi ngầm của tầng OIDC, cả năm module cần CÙNG
một bản, và repo này là bản được SAO CHÉP nên viết verifier vào đây chính là hành động tạo ra năm
bản. `verifyLogoutToken` của SDK làm trọn §2.6 mà vẫn giữ ZERO dependency, vì Account ký **ES256** —
thứ `crypto.subtle` verify thẳng được.

**⚠ `sid` là cột CHỊU LỰC, không phải siêu dữ liệu.** Account CÓ gửi `sid` trong `id_token` từ
trước, nhưng không nơi nào giải mã nó. Nếu chỉ dựng route mà không lưu `sid`: token được xác thực
hoàn hảo, rồi phép xoá khớp **0 hàng**, trả 200, Account ghi nhận giao thành công — và phiên module
sống trọn 30 ngày. Hỏng IM LẶNG ở cả hai phía. Đó là lý do mục này có cả migration lẫn thay đổi ở
`callback`.

**⚠ Người chạy module ở `localhost` KHÔNG nhận được back-channel logout**, dù đăng ký đúng địa chỉ.
Đây là fetch đi RA từ máy chủ Account, và bản Account online không gọi vào máy sau NAT được —
`.env.example` đã ghi điều này từ trước. Thứ vẫn hoạt động là `/oauth2/end-session` (RP-initiated
logout, chạy ở TRÌNH DUYỆT). Không có cấu hình nào chữa được; cần thử thật thì phải chạy Account tại
chỗ hoặc mở một đường hầm.

### Module đã sinh ra phải làm gì

1. **Nâng `@comitor/account-sdk` lên `^0.3.0`** và chép cột `sid` + migration + ba thay đổi mã
   ở bảng trên. Migration là cộng thêm, chạy được trên database đang có dữ liệu.
2. **Không backfill được `sid`** — nó chỉ có trong `id_token` của lần đăng nhập, không dựng lại từ
   dữ liệu đang lưu. Phiên cũ mang `sid = NULL` và sẽ không nhận được back-channel logout cho tới
   khi người dùng đăng nhập lại. Cửa sổ tự đóng khi phiên cũ hết hạn (30 ngày).
3. **Đăng ký `backchannel_logout_uri` bên Account** ở `/admin/oauth-clients/{client_id}` —
   `{APP_URL}/api/comitor/backchannel-logout`, **không** có dấu `/` cuối. Nút "Sinh đường dẫn" ở màn
   đó điền hộ khi ô đang rỗng. ⚠ Seed của Account CỐ Ý không đặt giá trị này: lúc seed chạy chưa ai
   biết địa chỉ bản deploy. Không đăng ký thì Account **không gửi gì và không ghi log gì** — "chưa
   cấu hình" và "route hỏng" nhìn giống hệt nhau.
4. **Cần `offline_access`** (SDK đã ghim trong `REQUIRED_SCOPES`). Không có nó thì không tồn tại
   `oauth_refresh_tokens` gắn `session_id`, và Account không bao giờ gọi tới route — kể cả khi mọi
   thứ khác đúng. Đây phải là bước gỡ lỗi ĐẦU TIÊN.
5. **⚠ Nếu tự viết hàm xoá theo `sid`: nhận CHUỖI BẮT BUỘC và assert khác rỗng.** Prisma coi
   `undefined` trong `where` là *bỏ điều kiện*, nên `deleteMany({ where: { sid: undefined } })` là
   `where: {}` — **xoá TOÀN BỘ `account_sessions`**, đăng xuất mọi người dùng. TypeScript không bắt
   được, và triệu chứng nhìn y hệt một lần deploy. Ca đó với tới được từ chính đặc tả: §2.6 #4 cho
   phép một token chỉ mang `sub`.

## v0.8.2 — 2026-09-06

PATCH: gom bảy thay đổi hạ tầng đã lên `main` sau v0.8.1 mà chưa mục nào ghi. Hai trong số đó là
**cổng đang hỏng mà không ai nhìn** — một job CI đỏ tám run liên tiếp, và một bản vá bảo mật của
Next không có advisory. Cả hai đã được nhân bản y nguyên sang mọi module sinh ra từ bản này, nên
mục "phải làm gì" bên dưới là phần có giá trị của mục này.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `next.config.ts` | `output` nay là `process.env.VERCEL ? undefined : "standalone"` |
| `docs/trien-khai.md` | §2 ghi điều kiện đó và vì sao không được gỡ |
| `.github/workflows/check.yml` | Job `migration`: thêm bước `CREATE DATABASE ci_shadow`; bỏ chú thích sai "Prisma tạo database này" |
| `package.json` → `db:check` | `SHADOW_DATABASE_URL` đọc **biến môi trường trước, `.env` sau**, thiếu cả hai thì NỔ có thông điệp |
| `lib/catalog/settings.ts` | `SETTINGS_TABS` SUY từ `children` của mục `settings`; `navKeyFor()` biến mất |
| `app/(shell)/settings/settings-tabs-nav.tsx` | `tab.id` nay là `NavItemId`, không còn khoá i18n ghép lúc chạy |
| `package.json` | `next` 16.3.2 → **16.3.4** · `@comitor/ui` 1.8.0 → 1.8.1 · `lucide-react` → 1.41.0 · `date-fns` → 4.4.0 |
| `pnpm-workspace.yaml` | `overrides: deepmerge-ts "^8.0.2"` — vá một HIGH mà đường thường không vá được |

**`output: "standalone"` và Vercel không đi chung được.** Khoá đó khiến `next build` chạy
`writeStandaloneDirectory`, mà bước ấy ĐỌC `.next/next-server.js.nft.json`. Ở máy phát triển
Turbopack tự sinh tệp đó nên `pnpm build` xanh; trên Vercel thì không, vì Vercel dựng bằng adapter
của chính nó (`adapterPath` + `onBuildComplete`) — nó tự lần vết và tự đóng gói thành serverless
function. Kết quả là build gãy bằng `ENOENT … next-server.js.nft.json`, một thông điệp không nói gì
về nguyên nhân. Đường ẢNH CONTAINER (§2 của `docs/trien-khai.md`) KHÔNG đổi; điều kiện chỉ tắt
standalone ở Vercel.

**Job `migration` đỏ ở MỌI run từ 02.09 tới 05.09, và không ai thấy.** Hai lỗi chồng nhau, ngược
chiều nhau: `db:check` từng chỉ đọc `$SHADOW_DATABASE_URL` (rỗng ở máy phát triển, vì pnpm không nạp
`.env` vào shell), rồi bản sửa đổi sang chỉ đọc `.env` — và **CI không có tệp đó** vì `.env` bị
gitignore. Cả hai lần đều nở thành chuỗi RỖNG, mà rỗng thì Prisma chỉ in bảng trợ giúp rồi **thoát
0**: một cổng báo "hỏng" mà không ai đọc là một cổng không tồn tại. Lỗi thứ hai chỉ lộ ra sau khi
sửa lỗi thứ nhất — `ci_shadow` không được tạo ở đâu cả, vì chú thích trong YAML tin rằng Prisma tự
tạo shadow database. Nó KHÔNG tạo, nó chỉ nối vào, và thoát `P1003` kể cả khi role có `CREATEDB`.
Không ai mở trang Actions vì starter mới chỉ chạy ở local — cổng này lẽ ra nổ vào đúng ngày deploy
đầu tiên.

**`next` 16.3.3 vá một lỗi CWE-22 mà `npm audit` không biết.** `npm audit` trả rỗng cho cả 16.3.2
lẫn 16.3.3, nên "audit sạch" ở đây chỉ chứng minh cơ sở dữ liệu chưa có mục. Bằng chứng lấy bằng
diff tarball: `getFilePath` thêm một phép kiểm chứa thư mục gốc (`E1468`), và `escape-path-delimiters`
nay escape thêm `\` — một lỗi vá ở hai tầng. Đo tại chỗ: `grep -rl E1468 node_modules/next/dist`
cho **0 tệp trước, 27 tệp sau**, trong đó có `app-page.runtime.prod.js` và
`app-route.runtime.prod.js` — tức nó nằm trong runtime phục vụ request của production.

**`deepmerge-ts` phải vá bằng `overrides`, và phải đặt ĐÚNG CHỖ.** Đường đi là
`@prisma/config ← prisma`, và cả 43 bản `@prisma/config` từng publish đều ghim cứng 7.1.5 — nên
**nâng Prisma không vá được**. ⚠ `overrides` phải nằm trong `pnpm-workspace.yaml`: pnpm 11 bỏ qua
khối đó trong `package.json` **trong im lặng**, cài xong `pnpm audit` vẫn đỏ và không gì nói vì sao.

**`SETTINGS_TABS` từng là danh sách điều hướng THỨ HAI.** Nó khai lại đúng bốn `href` mà
`lib/catalog/navigation.ts` đã có, nên đổi một đường dẫn rồi quên chỗ kia thì thanh bên đi đúng còn
dải tab trỏ 404 — và không cổng nào bắt được, vì `href` chỉ là chuỗi. Nay nó suy từ `children`, và
hai thứ thu được đáng hơn bản thân phép khử trùng: `tab.id` là `NavItemId` nên **quên khoá dịch là
lỗi biên dịch**, và phép kiểm bất biến NÉM lúc nạp module — mà module ấy nằm trong nhánh render của
`/settings`, nên `pnpm build` là cổng.

### Module đã sinh ra phải làm gì

1. **Chép bản vá CI, kể cả khi trang Actions của bạn đang xanh.** Job `migration` trong
   `.github/workflows/check.yml` của bạn mang đúng hai lỗi trên nếu module được sinh ra trước
   06.09.2026. Triệu chứng là **không có triệu chứng**: cổng thoát 0 khi `SHADOW_DATABASE_URL` rỗng.
   ⚠ **Đừng kiểm bằng cách chạy `pnpm db:check` ở máy mình** — `.env` ở máy phát triển luôn cấp sẵn
   biến đó, nên lệnh chạy xanh mà KHÔNG hề chạm nhánh vừa được sửa. Kiểm bằng MÃ:
   `grep -c "CREATE DATABASE ci_shadow" .github/workflows/check.yml` phải ra `1`, và `db:check`
   trong `package.json` phải đọc **biến môi trường trước, `.env` sau, thiếu cả hai thì thoát 1**.
2. **Nâng `next` lên ≥ 16.3.4 và đặt SÀN tường minh trong `package.json`.** Dải `^16.3.2` *cho
   phép* 16.3.4 nhưng không *đòi*, nên một lockfile dựng lại từ đầu vẫn rơi xuống dưới bản vá.
   Kiểm bằng ĐO chứ đừng tin số: `grep -rl E1468 node_modules/next/dist` phải khác 0.
3. **Thêm `overrides: deepmerge-ts "^8.0.2"` vào `pnpm-workspace.yaml`** — KHÔNG phải `package.json`.
   Kèm điều kiện gỡ: `pnpm why deepmerge-ts` cho thấy `@prisma/config` đã đi sang `>=8`.
4. **Deploy lên Vercel thì lấy điều kiện `VERCEL` ở `output`.** Không deploy lên Vercel thì không
   phải làm gì — đường ảnh container không đổi. ⚠ Đừng "dọn" điều kiện ấy thành hằng: gỡ nó ra là
   build trên Vercel gãy ngay, ở một chỗ không liên quan gì tới thứ vừa sửa.
5. **Nâng `@comitor/ui` lên 1.8.1 rồi KHỞI ĐỘNG LẠI dev server** — Tailwind quét
   `node_modules/@comitor/ui/dist` một lần lúc khởi động, nên không restart thì bản vá không có hiệu
   lực và trông y hệt chưa sửa. `lucide-react` nâng cùng lúc với các repo anh em: bốn icon bị vẽ lại
   (`CheckCircle2`, `DoorOpen`, `UserRoundX`, `Trash2`), giữ nguyên nghĩa nhưng lệch nhận diện nếu
   hai sản phẩm chạy hai bản.
6. **Nếu module của bạn có dải tab con ở bất kỳ đâu, chép khuôn `SETTINGS_TABS`**: suy từ `children`
   của `navigation.ts`, đừng khai lại `href`. Kiểm bằng
   `grep -rn 'href: "/' lib/catalog/*.ts` — chỉ được thấy `navigation.ts` và `apps.ts`.

---

## v0.8.1 — 2026-09-05

PATCH: bỏ bốn cột `app_settings` đã chết từ v0.7.0. **Bước THU HẸP** của công thức mở rộng →
backfill → thu hẹp, và là migration **không lùi được** duy nhất của cả loạt.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `prisma/schema.prisma` | Bỏ `weekStart`, `notifyMentioned`, `notifyProjectUpdate`, `allowAttachmentDownload` cùng `@default` của chúng |
| `prisma/migrations/…_bo_bon_cot_cai_dat_chet/` | `ALTER TABLE app_settings DROP COLUMN` × 4 |

**Vì sao tách khỏi v0.7.0 chứ không gộp.** `prisma migrate deploy` chạy **TRƯỚC** khi mã mới lên,
nên luôn có một khoảng mã CŨ chạy trên lược đồ MỚI. Gộp hai việc là bắt bản deploy trước — bản chưa
dọn ba chỗ sinh SQL — đi hỏi những cột vừa biến mất, tức hỏng cả đường LÙI chứ không chỉ mất dữ liệu.

**Ba chỗ v0.7.0 đã phải dọn, và chỗ thứ ba là chỗ dễ sót nhất:**
1. `SETTINGS_COLUMNS` giới hạn `SELECT` của `getAppSettings`;
2. `columns` giới hạn danh sách cột của INSERT và UPDATE;
3. `select: { workspaceId: true }` giới hạn **`RETURNING`** của `upsert` — `upsert` TRẢ VỀ bản ghi
   nên mặc định Prisma liệt kê mọi cột vô hướng, và một câu GHI vẫn gọi tên cột đã bỏ thì vẫn đổ dù
   đường ĐỌC đã sạch.

**Dữ liệu mất gì.** Trên RDS dev dùng chung: **0 hàng** trong `app_settings` lúc chạy, nên không
giá trị nào bị phá huỷ ở môi trường này. Ở một môi trường có dữ liệu, mỗi workspace từng bấm Lưu mất
bốn giá trị — và **không giá trị nào trong đó từng được đọc bởi bất kỳ đường mã nào**, nên không
hành vi nào đổi.

### Module đã sinh ra phải làm gì

1. **Chỉ chạy migration này sau khi mã v0.7.0 (hoặc mới hơn) đã lên và ổn định ở MỌI nơi đang chạy.**
   Rủi ro thật không phải production mà là **đồng đội chạy mã cũ trên RDS dùng chung** — mã trước
   v0.7.0 `SELECT` mọi cột và sẽ đổ ngay khi cột biến mất.
2. **Đọc `DATABASE_URL` trước khi gõ lệnh**, và đừng dùng `prisma migrate reset` — ở hồ sơ RDS nó
   xoá schema của cả đội.
3. Không cần backfill: `null` không tồn tại ở đây, các cột chỉ đơn giản biến mất.

---

## v0.8.0 — 2026-09-05

MINOR: module nay ĐỌC mặc định hiển thị của tài khoản. Đóng nốt vòng bắt đầu từ v0.7.0 — bản đó
nhặt lên `locale` và `timezone` mà Account vốn đã gửi; bản này thêm bốn trục còn lại và giải bài
toán khó nhất của cả loạt: **áp một giá trị từ máy chủ TRƯỚC lượt sơn đầu tiên**.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `package.json` | Sàn `@comitor/account-sdk` **0.1.1 → 0.2.0** |
| `lib/core/display-prefs.ts` (MỚI, 17 test) | Tập đóng + bộ lọc — **gác một đường tiêm mã** |
| `lib/account/prefs-seed.ts` (MỚI) | Cookie trung chuyển sống ngắn, `httpOnly` |
| `components/display-prefs-seed.tsx` (MỚI) | Script gieo, con ĐẦU TIÊN của `<body>` |
| `lib/contracts/account.ts` · `lib/account/session.ts` | `AccountUser.displayPrefs`; gộp `undefined` → `null` ở biên |
| `app/layout.tsx` · `app/api/auth/callback/route.ts` | Đọc cookie → dựng script; ghi cookie ở callback |
| `AGENTS.md` | Hợp đồng #2 nay bao sáu trục, kèm lý do hai đích khác nhau |

**1. Vì sao KHÔNG truyền qua prop — đã đo trên `dist` của gói.** Cách hiển nhiên là đưa giá trị của
Account vào `defaultTheme` / `defaultValue` của bốn provider. Nó **không chạy** với ba trong bốn
trục: `AxisScript` chỉ nhận `storageKey` và `nonce`, còn chuỗi script nó dựng đóng gói
`config.defaultValue` — hằng của GÓI. Prop chỉ tới được `useState` và một `useEffect`, tức SAU lượt
sơn. `ContrastScript` còn hẹp hơn: chỉ áp đúng chuỗi `"high"`.

Hậu quả của đường prop là **nháy giao diện** — đúng thứ bốn script chống nháy tồn tại để ngăn, và
tệ nhất ở hai trục trợ năng, nơi người dùng ít chịu được nhất một khung hình sai.

**2. Nên phải là một script đồng bộ, và nó phải đứng ĐẦU.** Script chạy theo thứ tự xuất hiện trong
tài liệu; đặt sau bất kỳ provider nào là để gói ĐỌC `localStorage` trước khi ta GHI. Đã đo trên HTML
thật: script gieo là thẻ `<script>` số 1 trong `<body>`, trước next-themes và ba script trục.

**3. ⚠ Script ấy mang nonce CSP — tức một bề mặt tấn công, và nó được đóng bằng hai lớp.** Giá trị
đi vào nó có nguồn là cookie, mà cookie thì client sửa được; nonce khiến CSP **không chặn** thứ chèn
vào đó. Lớp một: `parseDisplayPrefs` lọc qua tập đóng. Lớp hai, và đây mới là lớp thật: **chuỗi
script dựng từ hằng của repo** — khoá lấy từ `DISPLAY_PREF_STORAGE_KEYS`, giá trị là phần tử của
mảng hằng, nên không byte nào của người dùng đi vào được. Đã đo bằng curl: `</script><script>`,
`";alert(1);//`, `__proto__` và JSON hỏng đều KHÔNG render script nào.

**4. Luật gieo lại CÓ DẤU, không phải "chỉ gieo khi trống".** Cái sau nghe an toàn và sai ở chỗ quan
trọng nhất: sau lần đăng nhập đầu, `localStorage` luôn có giá trị, nên thay đổi ở Account **không
bao giờ** tới được thiết bị nữa. Nay cạnh mỗi khoá có một khoá `-seeded` giữ giá trị đã gieo lần
trước — *đi theo Account, trừ khi bạn đã tự đổi trên máy này*. Đã đo đủ sáu kịch bản, kể cả ca người
dùng đè lên rồi Account đổi sau (lựa chọn tại chỗ THẮNG).

### Module đã sinh ra phải làm gì

1. **Nâng sàn SDK lên `0.2.0` và KIỂM phiên bản đã cài** — `pnpm add` có thể thoát 0 mà không nâng
   (`minimumReleaseAge`). `node -e "console.log(require('./node_modules/@comitor/account-sdk/package.json').version)"`.
2. **Khởi động lại dev server sau khi nâng gói.** Tailwind quét `node_modules` một lần lúc khởi động.
3. **Script gieo phải là con ĐẦU TIÊN của `<body>`.** Chèn thứ gì lên trước nó là mua lại đúng cái
   nháy mà nó sinh ra để tránh — và triệu chứng chỉ hiện ở lần đăng nhập đầu trên một máy mới, tức
   chỗ khó gặp nhất khi đi thử.
4. **Đừng bao giờ nối một biến không phải hằng của repo vào chuỗi script đó.**

---

## v0.7.0 — 2026-09-05

MINOR: sắp xếp lại ranh giới Cài đặt giữa module và Comitor.Account. Xoá bốn ô cài đặt CHẾT, sửa
bốn nhãn nói dối về phạm vi, và bắt đầu **đọc thứ Account vốn đã gửi**.

⚠ **Đợt này KHÔNG bỏ cột nào.** Bốn cột đã thôi được đọc/ghi nhưng vẫn còn trong lược đồ, có chủ
đích — xem "Module đã sinh ra phải làm gì" bên dưới.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `lib/contracts/settings.ts` · `lib/catalog/settings.ts` | Bỏ `weekStart`, `mentioned`, `project-update`, `attachment-download` |
| `lib/settings.ts` | **`select` TƯỜNG MINH** trong `getAppSettings` — điều kiện để đợt bỏ cột lùi được |
| `lib/contracts/account.ts` · `lib/account/session.ts` | `AccountUser` nhận `locale` + `timezone` — vốn đã trên đường dây, đang bị vứt; `timezone` **chuẩn hoá ở biên** |
| `lib/i18n/adopt.ts` (MỚI) | Gieo ngôn ngữ + múi giờ từ hồ sơ Account xuống cookie, luật CÓ DẤU |
| `lib/core/time-zone.ts` (MỚI, có test) | `isTimeZone()` — gác cả đầu ghi lẫn đầu đọc của cookie múi giờ |
| `lib/i18n/config.ts` | **Bỏ `WORKSPACE_TIME_ZONE`**; `DEFAULT_TIME_ZONE` thành giá trị dự phòng |
| `lib/tasks.ts` | `timeZone` thành tham số **BẮT BUỘC** của `toTaskViews`/`listTasks`/`getTask`/`listCommandTasks` |
| `app/(shell)/tasks/new/*` | Sàn ô chọn hạn chót nhận `todayIso` từ MÁY CHỦ, thôi đọc đồng hồ trình duyệt |
| `app/(shell)/shell-frame.tsx` | `goToAccount` **điều hướng thật**, thôi in URL ra toast — tab mới, rơi về điều hướng top-level khi popup bị chặn |
| `scripts/check-messages.ts` | Cổng khoá mồ côi nay canh CẢ ba bảng khai, không chỉ bảng quyền |
| `package.json` | `@comitor/ui` **1.7.1 → 1.8.0** — `Switch.description` nhận `ReactNode` |

**1. Bốn ô cài đặt không ai đọc.** Grep từng cái: `weekStart`, `notifications.mentioned`,
`notifications.project-update`, `data.attachment-download` chỉ tới được chính công tắc của nó và ba
dòng đổi hình trong `lib/settings.ts`. Xoá chứ không đánh dấu `<NotYetActive />`: cái dấu ấy nói
*"giá trị được lưu, chưa có gì đọc"* — đúng cho `archiveAfter`, sai ở đây, vì **tính năng không tồn
tại** (không có bảng bình luận để nhắc tên, không có cơ chế theo dõi dự án).

⚠ `data.attachment-download` là ca nghiêm trọng nhất và là chỗ DUY NHẤT mà `<NotYetActive />` là
cách chữa SAI. Nhãn hứa *"chỉ xem trong ứng dụng, không tải xuống được"*; `lib/storage.ts` ký một
presigned S3 GET cho mọi tệp, không đọc cờ nào. Quản trị viên tắt công tắc và tin rằng một cánh cửa
vừa khoá lại. Và nó **không cài đặt được như đã hứa**: với presigned URL, URL để xem CHÍNH LÀ URL
để tải.

**2. Bốn nhãn nói dối về PHẠM VI.** `app_settings` khoá theo `workspaceId`, nên **không có chỗ nào
trong lược đồ cho một tuỳ chọn theo từng người** — trong khi "Tự nhận việc mình tạo" và "Thông báo
cho tôi" viết ở ngôi thứ nhất. Chính mã gọi cùng giá trị ấy là `workspaceAllows`; mã đã luôn đúng,
chỉ chữ trên màn hình là sai.

**3. Ngôn ngữ và múi giờ: nhặt lên thứ đã trả tiền.** `AccountUser` của SDK khai `locale` và
`timezone` từ 0.1.1, `requireWorkspaceAccess()` lấy chúng về ở mỗi request, và
`lib/account/session.ts` map bốn trường rồi bỏ hai cái đó — trong khi module tự nuôi một cookie
ngôn ngữ song song và một hằng múi giờ. Nay chúng được gieo xuống cookie ở **route callback**, chỗ
duy nhất hợp lệ để ghi cookie mà lại đã gọi `getAccountContext()` sẵn: **không thêm một vòng mạng
nào**.

**4. ⚠ `timezone` từ Account phải CHUẨN HOÁ Ở BIÊN.** Account khai cột đó là `input: true`
**không kèm phép kiểm nào** (`lib/auth.ts`, `additionalFields`), nên `POST /api/auth/update-user`
nhận bất kỳ chuỗi gì. Giá trị ấy đi thẳng vào `Intl.DateTimeFormat` trong `todayIso()`, nơi một
chuỗi lạ NÉM `RangeError` — tức một hồ sơ mang `timezone: "abc"` làm trắng mọi trang công việc của
MỌI module đọc nó. `lib/account/session.ts` chặn ở biên bằng `isTimeZone()`.

⚠ `locale` thì CỐ Ý **không** chuẩn hoá ở biên: "Account nói một ngôn ngữ module chưa dịch" và
"người dùng chọn tiếng Việt" là hai chuyện khác nhau, và gộp chúng là gieo tiếng Việt đè lên một
trình duyệt đang xin tiếng Anh.

**5. Bỏ khái niệm "múi giờ của không gian làm việc".** Mọi mốc lưu UTC, hiển thị theo múi giờ NGƯỜI
XEM. Điều này **thay hợp đồng liên module #2** trong AGENTS.md, vốn nói ngược lại. Cái giá đã cân
nhắc: `dueDate` là NGÀY LỊCH, nên hai đồng nghiệp ở hai múi giờ sẽ thấy hai con số "quá hạn" khác
nhau. Đổi lại, Comitor.Account không phải mọc cột `organizations.time_zone` và hệ không có thêm một
hợp đồng đóng băng nào về lịch.

**6. Ô chọn hạn chót từng dùng đồng hồ TRÌNH DUYỆT làm sàn.** Máy chủ tính "hôm nay" theo múi giờ
trong hồ sơ Account của người xem; trình duyệt tính theo múi giờ HỆ ĐIỀU HÀNH. Khi hai cái lệch —
người dùng đang đi công tác, hoặc đã đặt múi giờ khác nơi họ ngồi — biểu mẫu cho chọn một ngày mà
máy chủ lập tức coi là quá hạn, tức tạo ra một việc trễ ngay lúc sinh. Nay `todayIso` đi xuống bằng
prop từ `page.tsx`.

**7. ⚠ `window.open` MỘT MÌNH KHÔNG ĐỦ, và chỉ đi thử mới thấy.** Năm lối sang Comitor.Account
(tạo workspace, cài đặt workspace, mời thành viên, mở Account, và mục ⌘K) trước đây chỉ hiện một
toast IN RA chuỗi URL để người dùng tự chép. Đổi sang `window.open(url, "_blank")` là đúng hướng
nhưng chưa đủ: **đo được trong chính repo này, lời gọi trả về `null`** — trình chặn popup, webview
nhúng và khung xem thử đều chặn nó, im lặng. Một nút không làm gì còn tệ hơn cái toast nó thay thế.
Nay khi bị chặn thì rơi về `window.location.assign(url)`, thứ không trình chặn nào can thiệp — cùng
đường mà `/api/auth/sign-in` và nút "thoát khỏi mọi sản phẩm" vẫn dùng để sang tên miền Account.

### Module đã sinh ra phải làm gì

1. **ĐỪNG bỏ bốn cột trong cùng một đợt deploy với bản này.** `prisma migrate deploy` chạy TRƯỚC khi
   mã mới lên, nên luôn có khoảng mã CŨ chạy trên lược đồ MỚI — và Prisma client mặc định `SELECT`
   **mọi** cột vô hướng, nên bản deploy trước sẽ hỏi những cột vừa biến mất. Điều đó biến việc bỏ
   cột từ "mất dữ liệu không ai đọc" thành **"không lùi lại được"**. Trình tự: bản này lên và ổn
   định → **rồi** mới sinh migration bỏ `week_start`, `notify_mentioned`, `notify_project_update`,
   `allow_attachment_download` (và xoá `@default` tương ứng).
   ⚠ Và phải bịt **ba** chỗ, không phải hai: `SELECT` của đường đọc, danh sách cột của INSERT/UPDATE,
   **và `RETURNING` của `upsert`** — `upsert` trả về bản ghi nên mặc định nó cũng liệt kê mọi cột.
   Chỗ thứ ba là chỗ dễ sót nhất, và thiếu nó thì `PUT /api/settings` đổ dù đường đọc đã sạch.
2. **Nếu đã hứa với khách rằng "chặn tải tệp đính kèm" có hiệu lực — nói lại với họ.** Nó chưa bao
   giờ có hiệu lực. Đây là dòng cần một thông báo, không phải một lần ship im lặng.
3. **Mọi chỗ gọi `listTasks`/`getTask`/`listCommandTasks` phải truyền `session.user.timezone`.**
   Tham số là bắt buộc nên `tsc` sẽ chỉ đúng chỗ — theo màu đỏ mà sửa.
4. **Nâng sàn `@comitor/account-sdk` lên `0.1.1`** nếu module còn ở bản thấp hơn: `AccountUser.locale`
   và `.timezone` là hợp đồng mà đợt này dựa vào.
5. **Soát lại `messages/`**: cổng khoá mồ côi nay canh `NOTIFICATION_PREFS` và `APP_DATA_PREFS`, nên
   một module đã tự thêm/bớt mục trong hai bảng đó sẽ thấy `pnpm i18n:check` đỏ ở lần chạy đầu.

---

## v0.6.6 — 2026-09-03

PATCH: bốn lỗi do một đợt rà có đối chứng nghịch tìm ra (25 phát hiện, 19 bị phản biện loại).

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `lib/core/csp.ts` · `.env.example` | `COMITOR_ACCOUNT_ASSETS_ORIGIN` nhận **nhiều gốc**, ngăn bằng khoảng trắng |
| `lib/account/config.ts` | Bỏ câu nói SAI rằng route webhook không tồn tại |
| `app/(shell)/activity-feed.tsx` | Phân biệt "chưa giao" với "có chủ, tra không ra tên" |
| `README.md` | `app.suspended` là sự kiện KHÔNG tồn tại; `workspace.suspended` không thu hồi phiên |

**1. `img-src` một gốc là quá hẹp — lỗ trong chính bản v0.6.0.** `toDisplayUrl()` bên Account
(`lib/storage.ts`) trả **URL tuyệt đối đi thẳng** khi giá trị lưu không phải khoá bucket:

```ts
if (isExternalUrl(stored)) return stored;   // ảnh Google/Facebook lúc đăng nhập social
```

và `organization.logo` nhận **bất kỳ** URL http/https nào người quản trị dán vào (`parseLogo`).
Nên tập nguồn ảnh thật không phải một bucket. Hậu quả: người đăng nhập bằng Google rơi về avatar
chữ cái ở menu, ở bảng công việc, ở nhóm thành viên dự án; workspace dán logo ngoài thì mất logo —
và cả hai **trông y hệt "chưa đặt ảnh"**.

⚠ Vẫn là tập ĐÓNG. Liệt kê từng gốc; đừng bao giờ thay bằng `https:`.

**2. Comment khẳng định `app/api/comitor/webhook/route.ts` "không tồn tại"** trong khi file đó có
thật. Đây là loại tài liệu nguy hiểm nhất của repo: người đọc kế tiếp sẽ dựng đích nhận thứ hai
cạnh cái đang chạy, hoặc chẩn đoán "gỡ thành viên xong vẫn vào được" thành "đúng rồi, chờ 30 giây".
`pnpm check` không đọc văn xuôi trong JSDoc.

**3. Nhật ký in "đã giao việc cho Chưa giao"** cho một việc ĐANG CÓ CHỦ, khi danh bạ tra không ra
tên. Đúng thứ AGENTS.md gọi là "một LỜI MỜI người khác nhận việc". Dòng ngay trên đã làm đúng cho
`actorName`; `targetUserId` nằm sẵn trong prop nên phân biệt được mà không đọc thêm gì.

**4. README** gọi sự kiện là `app.suspended` — Account không hề bắn tên đó — và nói nó thu hồi
phiên. `workspace.suspended` chỉ bỏ cache ngữ cảnh; người dùng giữ phiên và gặp màn `APP_SUSPENDED`.

### Module đã sinh ra phải làm gì

1. **Bổ sung gốc ảnh vào `COMITOR_ACCOUNT_ASSETS_ORIGIN`** nếu môi trường có bật social login
   (`https://lh3.googleusercontent.com`, `https://platform-lookaside.fbsbx.com`) hoặc cho phép dán
   logo ngoài. Thiếu gốc nào thì ảnh của gốc đó hỏng im lặng.
2. **Soát mọi chỗ `?? t("unassigned")`** trong module của bạn: nếu id vẫn còn mà tên không tra ra,
   đó là trạng thái THỨ BA và nó phải nói khác.

---

## v0.6.5 — 2026-09-03

PATCH: cùng một authorization code tới callback HAI LẦN — lần hai không được phép biến một cuộc đua
vô hại thành màn "không đăng nhập được".

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `app/api/auth/callback/route.ts` | Trước khi chuyển sang `/sign-in-failed`, kiểm phiên THẬT trong database; đã có phiên thì cho đi tiếp |

Đo được 2026-09-03 bằng log gắn thẳng vào handler — **hai điều hướng top-level thật**
(`sec-fetch-mode: navigate`, `dest: document`, `site: cross-site`, KHÔNG phải prefetch) tới **cùng
một URL**, cách nhau 392ms:

```
03:20:45.520  vào            code=8lsBm01A
03:20:45.835  đổi code XONG  (315ms)        ← #1 thành công, phiên được tạo
03:20:45.912  vào            code=8lsBm01A  ← #2 bắt đầu khi #1 CÒN ĐANG BAY
03:20:46.042  #1 trả 307 về "/"
              #2 → invalid_grant → /sign-in-failed
```

Người dùng **đang đăng nhập** — cookie phiên đã được đặt bởi #1 — mà màn hình nói họ không đăng
nhập được, và nút trên đó đưa họ đi đăng nhập lại thêm một lần nữa.

⚠ **Đây KHÔNG phải bản sửa gốc, VÀ NÓ KHÔNG CỨU ĐƯỢC CHÍNH CA ĐO Ở TRÊN.** Nhìn lại mốc thời gian:
#2 xuất phát lúc 45.912, còn #1 mãi 46.042 mới trả `Set-Cookie` — cookie mà nhánh này đọc là cookie
của request #2, và lúc nó rời trình duyệt thì phiên chưa tồn tại. Nhánh này chỉ ăn khi lần gọi thứ
hai tới **sau** khi lần thứ nhất đã xong (tải lại trang, bấm Back).

Giữ nó vì ca tuần tự có thật và rẻ để chặn, và vì nó không che lỗi gốc: dòng
`[auth] ĐĂNG NHẬP HỎNG Ở CALLBACK` vẫn ghi nguyên, kèm `…NHƯNG PHIÊN ĐÃ CÓ` để đếm được ở
production.

**Gốc đã tìm ra, nằm ở `comitor-account`:** `redirectPlugin` có sẵn của Better Auth
(`client/fetch-plugins.mjs`) tự chạy `window.location.href = url` ngay khi phản hồi mang
`{redirect: true, url}` — mà `oauthProviderClient` thay thân phản hồi của `signIn.email()` thành
đúng hình dạng đó. Rồi `continueAfterAuth()` điều hướng LẦN THỨ HAI tới cùng url ấy, sau
`await adoptProfileLocale()`. **392ms chính là thời gian của Server Action đó.**

⚠ Kiểm **phiên thật trong database**, không chỉ sự tồn tại của cookie: một cookie trỏ vào hàng đã
bị xoá nghĩa là người dùng KHÔNG đăng nhập, và đưa họ về `/` khi đó là đẩy vào một vòng chuyển
hướng thay vì một câu giải thích.

### Module đã sinh ra phải làm gì

1. **Không có gì phải làm** — bản sửa nằm gọn trong file khung.
2. **Nếu bạn thấy `[auth] …NHƯNG PHIÊN ĐÃ CÓ` trong log**, đó là dấu hiệu tầng đăng nhập đang phát
   hai lần điều hướng, không phải lỗi của module. Đếm nó, đừng bỏ qua.

---

## v0.6.4 — 2026-09-03

PATCH: chuyển hướng đăng xuất phải là **303**, không phải 307 — và đây là bug nặng nhất trong cả
chuỗi này.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `app/api/auth/sign-out/route.ts` | Cả hai `NextResponse.redirect` nay có status **303** |

`NextResponse.redirect` mặc định **307 — giữ nguyên method**. Route này là `POST` (cố ý: đó là thứ
duy nhất ngăn một liên kết trong tin nhắn đăng xuất người dùng), nên trình duyệt **POST xuyên site**
sang `/oauth2/end-session` của Account. Mà cookie phiên của Account là `SameSite=Lax`, và **Lax
không gửi cookie cho POST xuyên site** — chỉ cho điều hướng top-level bằng method an toàn.

Hậu quả KHÔNG phải một lỗi sạch mà là một trạng thái **nửa vời**, đo được 2026-09-03:

· Account nhận request không kèm cookie → `getCurrentBrowserSession()` trả `null` →
  `matchesCurrentSession` sai → **`deleteSessionCookie` không bao giờ chạy**;
· nhưng `id_token_hint` vẫn hợp lệ, nên **hàng phiên VẪN bị xoá** theo `sid`.

Còn lại: database nói "đã đăng xuất", trình duyệt vẫn cầm cookie phiên **và** ảnh chụp
`cookieCache` (60 giây). Trong cửa sổ đó, mọi lần đăng nhập lại đều được `/oauth2/authorize` cấp
code **mà không hỏi mật khẩu**, rồi đổi token thất bại với `invalid_request: session no longer
exists`. Người dùng bấm "Thử đăng nhập lại" và **không đi đâu cả** — 4 vòng liên tiếp trong log,
tự khỏi sau 60 giây khi cache hết hạn.

⚠ Đây là lý do vì sao ba vòng sửa trước đều "đúng mà vẫn hỏng": `/signed-out` hạ cánh đúng, câu chữ
đúng, URI đăng ký đúng — nhưng phiên ở Account chưa bao giờ được đóng SẠCH.

### Module đã sinh ra phải làm gì

1. **Soát mọi `NextResponse.redirect` nằm trong một route handler `POST`.** Mặc định 307 giữ
   nguyên method, và đích thường không mong đợi một POST. Với đích NGOÀI origin, nó còn làm mất
   cookie `SameSite=Lax` — hỏng im lặng, vì máy chủ bên kia vẫn trả 200.
2. Không cổng nào bắt được lớp lỗi này: `tsc` hài lòng, build xanh, và chính Account cũng không
   báo lỗi — nó chỉ làm ít việc hơn ta tưởng.

---

## v0.6.3 — 2026-09-03

PATCH: `/signed-out` nói đúng lối vào nào vừa dẫn tới nó.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `lib/account/session-cookie.ts` | Cờ một lần `comitor-signed-out-everywhere` (đặt / xoá / đọc) |
| `app/api/auth/sign-out/route.ts` | Nhánh toàn hệ ĐẶT cờ; nhánh mức module XOÁ cờ |
| `app/signed-out/page.tsx` | Hai câu chữ cho hai lối vào; lối toàn hệ bỏ nút sang Account |

v0.6.2 đưa đăng xuất toàn hệ hạ cánh đúng `/signed-out` thay vì `/sign-in-failed`. Nhưng trang đó
có **hai lối vào để lại hai sự thật trái ngược**, và nó đang in một câu cho cả hai:

· đăng xuất mức module → phiên tại Account **còn sống**;
· `?everywhere=1` → phiên tại Account **đã chết**.

Đo được 2026-09-03: bấm "Thoát khỏi mọi sản phẩm", hạ cánh đúng trang, và đọc được *"Bạn vẫn đang
đăng nhập ở Comitor.Account"* — khẳng định ngược lại chính việc người dùng vừa làm, ở đúng lúc họ
vừa thực hiện một thao tác bảo mật có chủ đích trên một máy có thể là máy dùng chung.

⚠ **Trang là Server Component nên nó CHỈ ĐỌC cờ.** Next cấm ghi cookie trong lúc render, nên cờ
không tự xoá lúc đọc. Chỗ xoá nằm ở **nhánh mức module của route handler**: mọi lần đăng xuất đều
đi qua đó, nên không có cửa sổ nào để một cờ cũ nói dối cho một lần đăng xuất mới.

### Module đã sinh ra phải làm gì

1. **Nếu module của bạn có trang "đã thoát" riêng**: kiểm xem nó có đang nói một câu cho nhiều lối
   vào không. Đây không phải chuyện chữ nghĩa — nó là một khẳng định về TRẠNG THÁI PHIÊN, và người
   dùng dựa vào đó để quyết định có rời khỏi máy hay không.
2. **Đừng chữa bằng cách cho trang tự xoá cờ.** `cookies().set()`/`delete()` trong Server Component
   ném lỗi ở lúc chạy — cùng cái bẫy đã ghi ở `lib/account/session-store.ts`.

---

## v0.6.2 — 2026-09-03

PATCH: đích của đăng xuất toàn hệ đổi từ `/` sang `/signed-out`.

⚠ **CẦN MỘT BƯỚC BÊN COMITOR.ACCOUNT, VÀ PHẢI LÀM TRƯỚC.** Xem mục cuối.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `lib/account/config.ts` | `postLogoutRedirectUri` → `${env.appUrl}/signed-out` |

Đăng xuất toàn hệ kết thúc bằng việc Account thả người dùng xuống
`post_logout_redirect_uri`. Trỏ về `/` thì trang đó **đòi phiên**, nên nó lập tức đẩy sang
`/api/auth/sign-in` và mở một lượt uỷ quyền MỚI — ngay trong lúc phiên vừa bị giết. Account cấp
một code gắn vào phiên đã chết, và callback trả `invalid_request: session no longer exists`.

Đo được 2026-09-03 trên luồng thật:

```
POST /api/auth/sign-out?everywhere=1   307
GET  /api/auth/sign-in?next=%2F        307
[auth] ĐĂNG NHẬP HỎNG Ở CALLBACK AccountError: session no longer exists
GET  /api/auth/callback?code=QOHV…     307 → /sign-in-failed
```

Người dùng bấm "đăng xuất khỏi mọi thiết bị" và hạ cánh ở màn **"không đăng nhập được"**. Đăng
xuất CHẠY ĐÚNG — phiên chết thật, lần vào sau phải gõ mật khẩu — nhưng màn hình cuối nói ngược
lại. Đây đúng là ca mà `/signed-out` đã được dựng ra để chữa cho đăng xuất mức module; lần này ở
redirect bên kia.

### Module đã sinh ra phải làm gì

1. ⚠ **BÊN ACCOUNT TRƯỚC, BÊN MODULE SAU.** `post_logout_redirect_uri` khớp từng ký tự với danh
   sách đã đăng ký cho client. Đổi module trước là đăng xuất toàn hệ hỏng **HẲN**, chứ không phải
   hạ cánh sai chỗ.

   ```bash
   # trong comitor-account, với DATABASE_URL của môi trường cần sửa
   pnpm exec tsx --conditions=react-server --env-file=.env scripts/sync-oauth-client-uris.ts
   ```

   Vì sao cần script riêng: `pnpm seed` idempotent nhưng **KHÔNG cập nhật** client đã tồn tại — nó
   in "đã có" rồi dùng lại nguyên trạng.
2. **Môi trường dựng MỚI không phải làm gì**: `scripts/seed.ts` bên Account nay đăng ký sẵn cả hai
   URI.
3. `http://localhost:3000/` **vẫn phải nằm lại** trong danh sách: module bản cũ còn gửi nó.

---

## v0.6.1 — 2026-09-03

PATCH: callback hỏng ở NỬA SAU thì log phải nói ra — trước đó nó im lặng và để giao diện nói sai
nguyên nhân.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `app/api/auth/callback/route.ts` | `createSession` + `writeSessionCookie` vào `try`; hỏng thì log một dòng viết HOA rồi mới chuyển hướng |

Luồng callback có hai nửa hỏng theo hai kiểu hoàn toàn khác nhau, và bản trước chỉ bắt nửa đầu:

· **nửa đầu** (`completeSignIn`) — liên kết hết hạn, code đã dùng, `state` lệch. Đã có `catch`, đã
  có dòng `[auth] ĐĂNG NHẬP HỎNG Ở CALLBACK`.
· **nửa sau** (`createSession`) — người dùng ĐÃ đăng nhập xong ở Account và code ĐÃ BỊ TIÊU; chỗ
  hỏng là hạ tầng của chính module. Không có `catch` nào, nên lỗi bay ra thành **500 không kèm một
  dòng log nào của app**.

Đo được 2026-09-03: Postgres dừng → `createSession` ném `Can't reach database server at
localhost:5436` → lần tải lại kế tiếp gặp `invalid_grant` (code đã tiêu) → người dùng rơi vào
`/sign-in-failed`, trang nói *"liên kết đăng nhập đã dùng một lần rồi"*.

⚠ **Câu đó mô tả đúng triệu chứng của request THỨ HAI trong khi nguyên nhân nằm ở request thứ
nhất.** Người đọc nó sẽ đi đăng nhập lại — và thất bại y hệt, mãi mãi, vì database vẫn đang tắt.
Đây là kiểu hỏng đắt nhất: mọi bước đều "thành công", triệu chứng chỉ ra sai chỗ.

### Module đã sinh ra phải làm gì

1. **`grep '\[auth\] KHÔNG TẠO ĐƯỢC PHIÊN'` khi có người báo không đăng nhập được.** Thấy dòng đó
   nghĩa là Account hoàn toàn ổn và vấn đề nằm ở database/hạ tầng của module — đừng đi soi cấu hình
   OAuth.
2. **Nếu module của bạn thêm bước nào SAU `completeSignIn`** (ghi nhật ký, gọi dịch vụ khác): nó
   nằm trong cùng cái `try` đó. Mọi thứ sau khi code bị tiêu đều thuộc nửa sau.

---

## v0.6.0 — 2026-09-03

MINOR: **nối ảnh đại diện và logo không gian làm việc** từ Comitor.Account. Trước đó module đọc
tên nhưng không đọc ảnh, nên đổi ảnh ở Account không hiện ra ở đâu cả — và trông y hệt một lỗi
đồng bộ.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `lib/contracts/account.ts` | `AccountUser.avatarUrl`, `AccountMember.avatarUrl`, `AccountWorkspace.logoUrl`, `AccountWorkspaceSummary.logoUrl` |
| `lib/contracts/task.ts` | `TaskView.assigneeAvatarUrl` |
| `lib/account/{session,directory}.ts` | `image`/`logo` của SDK → `avatarUrl`/`logoUrl`; chuỗi rỗng thành `null` |
| `lib/tasks.ts` | Ghép `assigneeAvatarUrl` ở tầng đọc |
| `lib/core/csp.ts` · `proxy.ts` | `img-src` mang thêm kho ảnh của Account |
| `.env.example` | `COMITOR_ACCOUNT_ASSETS_ORIGIN` |
| Giao diện | Menu người dùng, nhóm thành viên dự án, bảng công việc (2 chỗ), người theo dõi ở biểu mẫu |

Gói đã hỗ trợ sẵn ở cả ba chỗ (`ShellUser.avatarUrl`, `AvatarGroupItem.src`, `LetterAvatar.src` —
"có ảnh thì hiện ảnh, không thì rơi về initials"), nên đây thuần tuý là nối dây, không có component
mới nào.

⚠ **`img-src` là nửa dễ quên, và quên nó thì hỏng IM LẶNG.** Ảnh nằm ở bucket của ACCOUNT, khác
bucket của module — trình duyệt chặn, máy chủ không có lỗi nào, giao diện rơi về avatar chữ cái,
tức trông đúng như "người này chưa đặt ảnh". Cùng họ với lỗi `form-action` ở v0.5.5.

⚠ **URL ảnh là URL ĐÃ KÝ, có hạn** (`X-Amz-Expires=3600`). Nó được đọc lại ở mỗi lượt render và
**không được cất vào database hay vào một cache sống lâu hơn chữ ký** — cùng luật đã áp cho ảnh
đính kèm của module. Đó cũng là lý do `CommandTaskRow` (bảng lệnh ⌘K) KHÔNG nhận trường này.

### Module đã sinh ra phải làm gì

1. **Đặt `COMITOR_ACCOUNT_ASSETS_ORIGIN`** trong `.env` của mọi môi trường, rồi **khởi động lại**
   dev server. Thiếu nó thì avatar không hiện và không có gì báo.
2. **Nếu bạn thêm cache cho danh bạ** (`lib/account/directory.ts` gợi ý 30–60 giây): TTL phải ngắn
   hơn hạn chữ ký, nếu không ảnh chết giữa chừng.
3. **Đừng chép `avatarUrl` vào bảng nào của module.** Nó là URL có hạn, và một cột chứa nó là một
   cột hết hạn ngay trong database.

---

## v0.5.5 — 2026-09-03

PATCH: `form-action 'self'` chặn chính đăng xuất toàn hệ — **trình duyệt chặn, máy chủ không hề
từ chối**.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `lib/core/csp.ts` | `CspOptions.accountOrigin` → `form-action 'self' <gốc Account>` |
| `proxy.ts` | Truyền `NEXT_PUBLIC_COMITOR_ACCOUNT_URL` vào đó (biến thứ ba đọc thẳng ở file này) |
| `lib/core/csp.test.ts` | 4 phép kiểm: có gốc, cắt `/` cuối, để trống, và gốc KHÔNG lọt sang directive khác |
| `AGENTS.md` | Bảng "sáu chỗ đọc `process.env`" — hàng `proxy.ts` nay liệt kê đủ ba biến |

v0.5.4 dời nút "thoát khỏi mọi sản phẩm" về nơi phiên còn sống. Nút chạy đúng tới máy chủ — và
**vẫn không đăng xuất được**, vì một nguyên nhân thứ hai hoàn toàn độc lập.

Đăng xuất toàn hệ submit một `<form method="post">` tới route của chính app, nhưng route trả **307
sang Comitor.Account**. Chrome áp `form-action` cho **cả chuỗi chuyển hướng** mà một lần submit đi
qua, không chỉ cho `action` viết trong thẻ. Nên `form-action 'self'` chặn một form có `action`
same-origin.

Đo được 2026-09-03 trên luồng thật: server NHẬN được POST (`closeSession` chạy, 146–546ms) rồi trả
307, và console in *"Sending form data to 'http://localhost:3000/api/auth/sign-out?everywhere=1'
violates … form-action 'self'"*.

⚠ **Thông điệp gọi tên URL TRƯỚC chuyển hướng**, tức một địa chỉ same-origin hoàn toàn hợp lệ. Đọc
nguyên văn là đi tìm lỗi ở đúng chỗ không có lỗi.

Sau khi sửa, cùng thao tác đó đi tới Account và Account trả `session no longer exists` — tức
end-session đã chạy thật.

### Module đã sinh ra phải làm gì

1. **Nếu module của bạn có bất kỳ `<form>` nào submit tới một route trả redirect ra ngoài origin**
   (đăng xuất toàn hệ, thanh toán, SSO của bên thứ ba): gốc đích đó phải có trong `form-action`.
   Không có cổng nào bắt được — `pnpm build` xanh, máy chủ xanh, chỉ trình duyệt chặn.
2. **Chỉ thêm vào `form-action`.** Đừng tiện tay bỏ gốc Account vào `connect-src` hay `script-src`:
   trình duyệt không gọi thẳng sang Account ở đâu cả. Test thứ tư khoá điều này lại.

---

## v0.5.4 — 2026-09-03

PATCH: **hai nút đăng xuất chết**, cả hai hỏng im lặng, cả hai đã đo.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `app/(shell)/shell-frame.tsx` | Mục "Thoát khỏi mọi sản phẩm" vào menu người dùng — nơi phiên CÒN SỐNG |
| `app/signed-out/page.tsx` | Nút không bao giờ chạy được → liên kết sang trang bảo mật của Account |
| `components/access-denied.tsx` | `<a href>` → `<form method="post">`; bản cũ trả **405** |
| `lib/account/links.ts` | Thêm `accountSecurityUrl` |
| `messages/{vi,en}.json` | `shell.signOutEverywhere`; sửa lời `signedOut.*` cho khớp hành vi mới |

**1. "Thoát khỏi mọi sản phẩm" không bao giờ chạy được, vì lý do CẤU TRÚC.** Nút duy nhất mời gọi
nó nằm ở `/signed-out` — mà muốn tới được trang đó thì `/api/auth/sign-out` đã phải chạy xong, tức
`closeSession()` đã xoá hàng phiên và `clearSessionCookie()` đã xoá cookie. Đăng xuất toàn hệ là
RP-initiated logout: nó cần `id_token_hint`, thứ nằm trong hàng phiên vừa bị xoá. Nên nhánh
`everywhere` không vào được và nút chuyển hướng về đúng trang vừa đứng.

Đo được 2026-09-03: `POST /api/auth/sign-out?everywhere=1` không cookie → `307 → /signed-out`.
Người dùng bấm, trang tải lại, phiên ở Account còn nguyên, **không gì báo**. Route thì viết đúng —
nó chạy thật khi còn phiên; chỗ sai là lối vào duy nhất.

**2. Đường THOÁT của bốn màn guard trả 405.** `components/access-denied.tsx` dùng
`<a href="/api/auth/sign-out">` — một GET tới route chỉ export `POST` (POST là cố ý: với GET, một
liên kết trong tin nhắn đủ để đăng xuất người dùng, và `sameSite=lax` KHÔNG chặn được vì nó có gửi
cookie cho điều hướng top-level). Comment ngay trên nút đó viết: *"Không có nó thì người dùng đăng
nhập nhầm tài khoản sẽ mắc kẹt vĩnh viễn"* — và nó đã mắc kẹt thật.

### Module đã sinh ra phải làm gì

1. **Kiểm hai chỗ này trong module của bạn**, cả hai đều chép nguyên từ khung:
   `grep -rn 'href="/api/auth/sign-out"'` phải RỖNG — route đó chỉ nhận `POST`, và một `<a>` trỏ
   vào nó là một nút chết trả 405 mà không cổng nào bắt được.
2. **Nếu bạn có nút "đăng xuất toàn hệ"**: nó phải đứng ở nơi phiên còn sống. Đặt sau
   `closeSession()` là đặt ở nơi `id_token` đã không còn.
3. **Không đổi `app/api/auth/sign-out/route.ts`** — nó đúng từ đầu.

---

## v0.5.3 — 2026-09-03

PATCH: mặc định của xác thực chuyển từ **Account chạy tại chỗ** sang **bản dev ONLINE**
(`https://account.dev.comitor.ai`).

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `.env.example` | `NEXT_PUBLIC_COMITOR_ACCOUNT_URL` → `https://account.dev.comitor.ai`; `COMITOR_SEED_WORKSPACE_SLUG` → `thienminh` |
| `lib/account/directory.ts`, `lib/account/entitlements.ts` | Thông điệp "thiếu M2M" nay chỉ sang **người quản trị Account**, không chỉ sang một file chỉ người có source đọc được |
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `scripts/seed.ts` | Chuẩn bị máy phát triển không còn bắt đầu bằng "chạy comitor-account ở `:3200`" |

Lý do là một ràng buộc về QUYỀN ĐỌC, không phải sở thích: `comitor-account` là repo riêng mà phần
lớn người làm module không truy cập được, nên bước đầu tiên của README trước đây là một bước họ
**không làm được**. Bản dev online đã seed sẵn workspace, người dùng và OAuth client; client
`tasks-web` bên đó đăng ký `http://localhost:3000/api/auth/callback`, tức cổng dev của repo này —
đã kiểm bằng một lần gọi `/oauth2/authorize` thật (302 sang trang đăng nhập, không
`invalid_redirect_uri`).

Không một dòng mã chạy nào đổi: URL vẫn chỉ đi qua `NEXT_PUBLIC_COMITOR_ACCOUNT_URL`. Mặc định
dự phòng trong `lib/env.ts` vẫn là `https://account.comitor.ai` — một bản build production quên
khai biến phải rơi về production, không rơi về dev.

### Module đã sinh ra phải làm gì

1. **Đổi ba thứ trong `.env` CÙNG LÚC**, không đổi lẻ:
   `NEXT_PUBLIC_COMITOR_ACCOUNT_URL`, hai cặp `COMITOR_CLIENT_*` / `COMITOR_M2M_*`, và
   `COMITOR_SEED_WORKSPACE_SLUG`. Client id/secret gắn với TỪNG bản Account — đổi URL mà giữ cặp
   cũ thì Account trả `invalid_client`, một thông điệp nói "sai client" chứ không nói rằng bạn
   vừa đổi ổ khoá. Sai slug thì `pnpm seed` dừng ở `404`.
2. **Khởi động lại `pnpm dev` sau khi đổi.** `NEXT_PUBLIC_*` được thay bằng phép thay thế VĂN BẢN
   lúc build, nên giá trị cũ còn nằm trong bundle cho tới lần build lại — cùng họ với bẫy Tailwind
   quét `node_modules` một lần lúc khởi động.
3. **Biết trước cái mất, vì cả hai đều KHÔNG có thông báo lỗi nào.** Account online không gọi được
   vào `localhost`, nên **webhook và back-channel logout không tới máy phát triển**: "đăng xuất
   khỏi mọi thiết bị" không giết phiên module, và thu hồi chỗ ngồi phải chờ hết 30 giây
   `contextCacheSeconds`. Cần thử đúng hai luồng đó thì chạy Account tại chỗ — README §"Chuẩn bị ở
   máy phát triển" giữ nguyên hướng dẫn đó trong một khối `<details>`.
4. **Đừng đổi cổng dev.** `redirect_uri` đăng ký bên Account là cổng 3000; đổi cổng là đăng nhập
   chết, và sửa được nó là việc của người quản trị Account.

---

## v0.5.2 — 2026-09-02

PATCH: `@comitor/ui` 1.5.0 → **1.6.0** — cổng tương phản của gói từng in ✓ cho một bảng màu nó chưa
từng nhìn.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `package.json` | `@comitor/ui` **^1.6.0** |
| `AGENTS.md` | Sửa một ghi chú NAY ĐÃ CŨ về cổng `lint:a11y` |

`scripts/a11y/tailwind.mjs` của gói hợp `[data-contrast="high"]` vào cả hai bảng biến rồi chỉ lặp
`["light","dark"]` — tức nó đo bảng **tương phản cao** và dán nhãn "light"/"dark", còn bảng **mặc
định** (thứ mọi app chạy khi chưa bật gì) không có phép đo nào. Bật đo lộ ra 384 cặp dưới ngưỡng,
78% nằm ở ba token. Bảng tương phản cao vẫn chặn; bảng mặc định vào sổ riêng, in mỗi lần chạy.

### Module đã sinh ra phải làm gì

1. **`pnpm add @comitor/ui@^1.6.0`, khởi động lại dev server, và kiểm phiên bản THẬT SỰ cài.**
2. **Nếu bạn chạy cổng của gói trên bảng màu của mình** (`COMITOR_UI_STYLES`/`COMITOR_UI_SRC`): sẽ
   thấy thêm khối "BẢNG MÀU MẶC ĐỊNH: N cặp dưới ngưỡng" — **thông tin, không phải lỗi**; mã thoát
   không đổi.
3. **Soát lại mọi comment của bạn nói "cổng không đo X".** Đây là mục AGENTS.md §"Cạm bẫy" yêu cầu
   làm mỗi lần nâng MINOR của gói, và lần này nó bắt được đúng một ghi chú đã cũ trong repo này.

---

## v0.5.1 — 2026-09-02

PATCH: `@comitor/ui` 1.4.0 → **1.5.0** — ba lỗi biểu đồ. Không một dòng mã nào của starter đổi.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `package.json` | `@comitor/ui` **^1.5.0** |

Ba lỗi được sửa ở gói, cả ba do đợt khảo sát Đợt 2 tìm ra:

- **`<Legend />` trần tô chữ nhãn bằng MÀU CỦA SERIES** — bậc `--x` dùng làm màu chữ, vi phạm hợp
  đồng ba vai trò. Với series tông sáng thì chú giải không đọc được. Nay dùng
  `<ComitorChartLegend>`; đo được 17,4:1 (light) · 17,66:1 (dark), trước đó không đo được vì màu
  đổi theo series.
- **`radius` bo cả những đoạn GIỮA của cột chồng** — mỗi mối nối có một vệt khuyết, cột trông như
  nứt. Nay chỉ đoạn trên cùng được bo.
- **`ComitorChartPayloadItem` thiếu `payload`** — thiếu nó thì tooltip tự viết không lần được về
  hàng gốc, và app phải xuống tầng primitive dựng lại cả biểu đồ.

### Module đã sinh ra phải làm gì

1. **`pnpm add @comitor/ui@^1.5.0`, rồi KHỞI ĐỘNG LẠI dev server.**
   ⚠ Và **kiểm phiên bản THẬT SỰ cài**, đừng tin mã thoát — `pnpm add` có thể thoát 0 mà không nâng
   gì (`minimumReleaseAge`, hoặc registry chưa lan kịp ngay sau khi publish). Chuyện này vừa xảy ra
   với hai trong năm repo ở lần nâng này:
   ```bash
   node -e "console.log(require('./node_modules/@comitor/ui/package.json').version)"
   ```
2. **Nếu bạn dùng `showLegend`**: chú giải đổi vẻ ngoài (chữ đọc được, canh giữa dưới biểu đồ).
3. **Nếu bạn tự viết tooltip ở tầng lắp nhanh**: nay lần được về bản ghi gốc qua `entry.payload`,
   nên có thể bỏ phần dựng lại biểu đồ ở tầng primitive.
   ⚠ Ở `<Legend>` nhãn nằm ở **`value`**; ở `<Tooltip>` `value` là số đo còn nhãn ở `name`. Dùng
   nhầm thì mọi nhãn RỖNG mà không có gì báo.

---

## v0.5.0 — 2026-09-02

MINOR: **Đợt 2** của lộ trình kiểm định — và bốn trong chín hạng mục bị vòng phản biện BÁC BỎ.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `app/api/comitor/webhook/route.ts` | **Lỗi đang sống**: `app.suspended` là mã chết; ba sự kiện Account yêu cầu app phải chặn rơi vào `default:` và nhận 200 |
| `lib/permissions.ts` · `app/api/permissions/route.ts` | **Thẻ phiên bản** — `409 STALE_WRITE` thay vì ghi đè im lặng |
| `lib/core/version-token.ts` · `lib/core/session-envelope.ts` | **MỚI**, kèm 19 test |
| `lib/account/session.ts` · `lib/core/api-error.ts` | 429 của Account nay là 429, không phải 500 |
| `lib/account/session-store.ts` | `open()` từ chối phong bì 4 mảnh, thẻ GCM ngắn, và hình dạng sai |
| `lib/catalog/permissions.ts` | **GỠ `project.archive`** — quyền duy nhất không đường mã nào đọc |
| `scripts/check-messages.ts` | Phép kiểm 9: khoá quyền MỒ CÔI |
| `app/(shell)/settings/` | **MỚI `NotWiredUp`** — vùng nguy hiểm nay nói nó chưa nối |
| Tài liệu | `docs/them-mot-thuc-the.md` và `docs/con-ton.md` **MỚI**; bỏ mọi con số gõ tay |

### Module đã sinh ra phải làm gì

1. **Chép `app/api/comitor/webhook/route.ts` về.** Nếu module bạn có `case "app.suspended"` thì nó
   là mã chết, và ba sự kiện `workspace.suspended` · `workspace.app_disabled` · `user.deleted` đang
   rơi vào `default:` — tức Account nhận 200 và ngừng thử lại.
2. **Soát mọi `PUT` ghi đè cả giá trị của bạn** theo luật mới ở AGENTS.md. Khuôn ở
   `lib/permissions.ts`; bốn chỗ dễ làm sai đều ghi tại chỗ.
3. **Soát quyền của bạn**: mỗi mã trong `PERMISSION_RULES` phải có ít nhất một chỗ đọc. Lệnh đối
   chiếu ở `docs/them-mot-thuc-the.md`.
4. **Chạy `pnpm i18n:check`** — phép kiểm 9 bắt chuỗi mồ côi có sẵn.
5. **Đọc `docs/con-ton.md`** trước khi đề xuất thêm gì: sáu hạng mục ở đó đã bị hoãn CÓ LÝ DO, và
   mỗi cái kèm một lệnh để biết khi nào hết hoãn.

### Không làm, và vì sao

`AuditEvent`, xoá dữ liệu/vòng đời workspace, cổng `server:check`, khuôn integration test — cả bốn
ở `docs/con-ton.md` kèm điều kiện kiểm được bằng lệnh. Ngắn gọn: bảng audit rỗng vĩnh viễn ở phần
lớn module; đường xoá bảy bước không hoàn tác được và không test nào phủ; `server:check` đo được **0
vi phạm** hôm nay; và một bộ integration test không render pixel nào nhưng làm vòng đi tay bị bỏ
dần.

---

## v0.4.0 — 2026-09-02

MINOR: `@comitor/ui` 1.3.4 → **1.4.0**, cùng ba lỗi bố cục mà không cổng nào bắt được.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `package.json` | **`@comitor/ui` ^1.4.0** — `accent` của `FormSection` nay tô cả ô icon (trừ `primary`) |
| `app/(shell)/settings/settings-form-chrome.tsx` | `NotYetActive`: icon `shrink-0`, chữ gom vào MỘT flex item |
| `app/(shell)/settings/{advanced,notifications}/` | Trường có cảnh báo đổi `colSpan={6}` → `12`, ô chọn giữ bề rộng bằng thẻ bọc |
| `app/(shell)/settings/permissions/` | `ExternalAccountLink`: hai icon `shrink-0`, mũi tên gom cùng span với chữ |
| `app/(shell)/tasks/[taskId]/` | Hai nút đổi sang `leftIcon` — icon đang render 24px thay vì 16px |
| `messages/` | `settings.notYetActive` bỏ markdown, dùng thẻ ICU |
| `scripts/check-messages.ts` | Ba phép kiểm mới (6, 7, 8) |

### Module đã sinh ra phải làm gì

1. **`pnpm add @comitor/ui@^1.4.0`, rồi KHỞI ĐỘNG LẠI dev server** — Tailwind quét
   `node_modules` một lần lúc khởi động, class mới của gói hỏng IM LẶNG nếu không restart.
2. **Soát mọi `<FormSection accent=…>` có `icon`**: ô icon nay tô theo accent. `primary` cố ý
   giữ trung tính — tint của nó chỉ đạt 1,64:1 ở bảng màu mặc định.
3. **Chạy `pnpm i18n:check`** — ba phép kiểm mới bắt lỗi có sẵn: markdown trong chuỗi, `t("…")`
   thiếu cặp `{}` trong JSX, và `<RelativeTime>` đặt sai bên ranh giới server/client.
4. **Quét icon của bạn**: `<Icon />` làm children của `<Button>` không được bọc `shrink-0` và
   không được đặt cỡ — nó render 24px. Dùng `leftIcon={<Icon className="size-4" />}`.
5. **Quét `t.rich` của bạn**: nó trả về một MẢNG node, nên là con trực tiếp của flex container
   thì câu bị xé thành nhiều cột.

---

## v0.3.0 — 2026-09-02

**Đợt 1 của lộ trình kiểm định.** Mười một gói: dựng nốt những đường ghi còn thiếu, đóng lỗ hổng
thu hồi phiên, và gỡ những chỗ giao diện hứa thứ mã không làm.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `lib/account/session.ts` | **MỚI**: `AccountSession.workspaces`; trần thời gian 5 giây cho lời gọi Account; `redirect()` đi qua `import()` động |
| `lib/account/session-store.ts` | **MỚI `revokeSessionsForUser()`**; `StoredSession.userId` ghi vào CỘT `user_id` |
| `lib/account/directory.ts` | **MỚI `requireMemberDirectory()`** — ném 503 thay vì trả `Map` rỗng ở đường GHI |
| `lib/permissions.ts` | **MỚI**: `requireReadPermission()` (rìa A), `grantedPermissions()` |
| `lib/tasks.ts` | **MỚI**: `updateTask`, `deleteTask`, `setTaskAttachment`, `clearTaskAttachment`, `listCommandTasks`; `listTasks`/`countOpenTasks` bọc `cache()` |
| `lib/projects.ts` | **MỚI `createProject`**; `listProjects` bọc `cache()` |
| `lib/reminders.ts` · `scripts/jobs/` | **MỚI** — khuôn job nền + một job chạy được |
| `lib/core/` | **MỚI**: `request-id`, `due-soon`, `project-code`, `project-input`, `sniffImageType` |
| `lib/api-client/` | **MỚI**: `projects`, `notifications`, `workspace`, `field-errors` |
| `app/api/` | **MỚI**: `tasks/[taskId]`, `tasks/[taskId]/attachment`, `projects`, `notifications`, `workspace`, `comitor/webhook`, `health`, `ready` |
| `app/(shell)/` | **MỚI**: `error.tsx`, `tasks/[taskId]/`, `projects/`; skip link; nav lọc theo quyền |
| `proxy.ts` | Nhận/sinh `x-request-id`, đặt lên cả request lẫn response |
| `next.config.ts` · `.dockerignore` | `output: "standalone"`; **`.dockerignore` MỚI** |
| `prisma/schema.prisma` | `AccountSession.userId`, bảng `WebhookEvent`. **Một migration mới** |
| `package.json` | **BỎ `react-hook-form`** (dependency chết). **MỚI**: `job:due-soon`, `version:check`. **`version` 0.1.0 → 0.3.0** — nó đi vào `NEXT_PUBLIC_APP_VERSION` và hiện ở chân thanh bên, nên nó đã nói dối từ v0.2.0 |
| `scripts/check-version.ts` · `.github/` | **MỚI** — cổng thứ mười: `package.json` phải khớp mục mới nhất của `CHANGELOG.md` |
| `scripts/check-messages.ts` | **Ba phép kiểm mới**: markdown trong chuỗi (`next-intl` in ra nguyên văn), `t("…")` thiếu cặp `{}` trong JSX, và `<RelativeTime>` đặt sai bên ranh giới server/client |
| `app/(shell)/tasks/[taskId]/` | **MỚI `updated-at.tsx`** — mốc thời gian tương đối tách thành đảo client; trước đó nó nói tiếng Việt giữa giao diện tiếng Anh |
| `app/(shell)/settings/` | **MỚI `ReadOnlyFieldset`** — người chỉ-đọc trước đây LẬT ĐƯỢC công tắc mà không gì được lưu |
| `biome.json` | Cấm import TĨNH `next/navigation`·`link`·`image` ở tầng D |
| Tài liệu | `docs/trien-khai.md` **MỚI** |

### Module đã sinh ra phải làm gì

1. **Áp migration** `20260902020000_webhook_and_session_revocation`. An toàn: cột nullable, không
   backfill, bảng mới.
2. **Đăng ký đích webhook ở Account** và điền `COMITOR_WEBHOOK_SECRET`. Không có nó thì gỡ thành
   viên ở Account **không đóng được phiên** ở module — route trả 503 và log một dòng viết HOA.
3. **Đổi `requireSession()` → `requireApiSession()`** ở mọi `app/api/**/route.ts` nếu chưa làm ở
   v0.2.0.
4. **Chạy `pnpm lint`.** Luật mới cấm import tĩnh `next/navigation` ở `lib/**`; cách chữa là
   `import()` động trong chính hàm cần nó (xem `requireReadPermission`).
5. **Soát lại `/settings` của bạn**: `SettingsSaveBar` nay nhận `canEdit`, và `useSettingsDraft`
   nhận `{ canEdit }` để khoá ⌘S. Không truyền thì mặc định `true` — tức hành vi cũ, nhưng người
   chỉ-đọc vẫn bấm Lưu để nhận 403.
6. **Kiểm `lib/catalog/apps.ts` của bạn**: nếu bạn chép bảng app, gỡ mọi `badge` ghi cứng và đưa
   `href` qua `NEXT_PUBLIC_COMITOR_APPS_ORIGIN`.
7. **Nếu bạn dùng `react-hook-form`**, cài lại nó — starter đã gỡ vì không dùng.
8. **Đặt `version` trong `package.json` của bạn cho khớp `CHANGELOG.md` của bạn**, rồi chép
   `scripts/check-version.ts` về. Đây là lỗi starter tự mắc: repo gắn tag `v0.2.0` trong khi
   `package.json` còn `0.1.0`, nên chân thanh bên hiện `v0.1.0` — và một báo lỗi kèm con số đó
   dẫn người trực tới đúng bản KHÔNG có lỗi họ đang tìm.
9. **Nếu bạn chép `/settings`**: bọc mỗi nhóm cài đặt của KHÔNG GIAN LÀM VIỆC trong
   `<ReadOnlyFieldset canEdit>`. Giữ nhóm Giao diện NGOÀI nó — đó là tuỳ chọn của riêng người xem.
10. **Chạy `pnpm i18n:check` trên `messages/` của bạn.** Hai phép kiểm mới bắt lỗi có sẵn: chuỗi
   nào viết markdown, và chỗ nào gọi `t("…")` thiếu cặp `{}` trong JSX.

### Cạm bẫy đã HẾT hiệu lực

- *"Ẩn nút là đủ cho quyền ĐỌC"* — nay có `requireReadPermission()`, và `NavItemSpec.permission`
  giấu mục khỏi thanh bên lẫn ⌘K. **Giấu và chặn phải đi cùng nhau.**
- *"`GET /api/auth/sign-out` là an toàn vì `sameSite=lax`"* — **sai**: `lax` CÓ gửi cookie cho điều
  hướng top-level. Route nay là `POST`.

---

## v0.2.0 — 2026-09-02

**Đợt 0 của lộ trình kiểm định 2026-09-01.** Mười gói: dựng cổng cho những luật tới nay chỉ sống
trong tài liệu, chốt bốn hợp đồng liên module, và sửa 14 chỗ tài liệu mô tả thứ không tồn tại.

### Khung đổi gì

| Vùng | Đổi gì |
|---|---|
| `.github/` | **MỚI** — CI chạy `pnpm check` trên mọi PR, + job thứ hai có Postgres cho `db:deploy`/`db:check`. PR template. |
| `package.json` | `lint` nay là `biome check --error-on-warnings` (⚠ **warning LÀ lỗi**). Bốn script mới: `tenant:check`, `api:check`, `color:check`, `setup:env`, `db:check`. `pnpm check` từ 6 lên 9 cổng. |
| `scripts/` | **MỚI**: `check-tenant-scope`, `check-api-guards`, `check-colors`, `setup-env`, `strip-comments`. `check-messages` có phép kiểm thứ năm (khoá suy từ mã). |
| `prisma/schema.prisma` | Khoá ngoại KÉP `tasks(workspace_id, project_id) → projects(workspace_id, id)`; `@@unique([workspaceId, id])` trên `Project`; `@@index([userId])` trên `TaskWatcher`. **Một migration mới.** |
| `lib/account/session.ts` | **MỚI `requireApiSession()`** — rìa B không được dùng `requireSession()` nữa. |
| `lib/api/response.ts` | `unstable_rethrow` ở dòng đầu của `catch`. |
| `lib/tasks.ts` | **MỚI `createTask(session, input)`** — nghiệp vụ chuyển từ `app/api/tasks/route.ts` (310 → 54 dòng) sang đây, kèm `$transaction`. |
| `lib/core/` | **MỚI**: `app-identity.ts` (`APP_ID`), `task-input.ts` (lược đồ zod + `APPROVAL_FLOWS`/`NOTIFY_CHANNELS` chuyển từ `lib/catalog/settings.ts`), `api-error.test.ts`. |
| `i18n/request.ts` | `getMessageFallback` → `⟦namespace.key⟧`, `onError` → `[i18n] KHOÁ HỎNG`. |
| `lib/i18n/config.ts` | **MỚI `WORKSPACE_TIME_ZONE`** — ngữ nghĩa "quá hạn", tách khỏi `DEFAULT_TIME_ZONE`. |
| `biome.json` | Cấm `better-auth` ở cả ba phạm vi; cấm `@comitor/ui` ở tầng dữ liệu. |
| `docker-compose.yml` | Ghim ba tag Docker (`latest` → phiên bản cụ thể); bảng cấp phát cổng cho module thứ N. |
| `pnpm-workspace.yaml` | `minimumReleaseAgeExclude` theo TÊN gói thay vì 12 phiên bản gõ tay. |
| `vitest.config.ts` | Ngưỡng coverage 90%; `pnpm test` nay chạy kèm `--coverage`. |
| Tài liệu | `docs/migration.md` **MỚI**; `CONTRIBUTING.md` **MỚI**; README/AGENTS/CLAUDE/docs sửa 14 chỗ nói về thứ không tồn tại. |

### Module đã sinh ra phải làm gì

1. **Chạy `pnpm tenant:check` trước tiên.** Nếu nó đỏ thì bạn đang có một truy vấn chọn hàng không
   lọc `workspaceId` — đó là rò dữ liệu giữa khách hàng, sửa trước mọi thứ khác.
2. **Đổi mọi `requireSession()` trong `app/api/**/route.ts` sang `requireApiSession()`.** Không đổi
   thì route ghi của bạn trả **500** khi phiên hết hạn, không phải 401. `pnpm api:check` không bắt
   được ca này — nó chỉ kiểm `requirePermission`.
3. **Chạy `pnpm lint`.** `--error-on-warnings` sẽ làm đỏ những `as any` và import thừa vốn đang đi
   qua. Đây là lần dọn một lần, không lặp lại.
4. **Áp migration khoá ngoại kép** — hoặc bỏ nó nếu mô hình của bạn không có quan hệ cha-con trong
   cùng workspace. Trước khi deploy lên môi trường có dữ liệu thật, chạy phép đếm trong header của
   file migration.
5. **Kiểm `APP_ID`** (`lib/core/app-identity.ts`) và `PRODUCT_NAME` (`lib/mail.ts`) — hai chỗ mang
   danh tính module mà trước đây nằm ngoài checklist đổi tên. Sai `APP_ID` nghĩa là bạn đang ghi tệp
   vào tiền tố khoá của app khác.
6. **Kiểm cổng của mình theo bảng cấp phát** ở đầu `docker-compose.yml`, và đổi cả
   `.claude/launch.json` cho khớp.
7. **Đi một vòng `en`** sau khi nâng: `⟦…⟧` xuất hiện ở đâu là khoá i18n sót ở đó.

### Cạm bẫy đã HẾT hiệu lực

- *"`t()` và `t.has()` NÉM LỖI khi khoá không tồn tại"* — **sai**, đã đo trên `use-intl` 4.14.1.
  Chúng trả về tên khoá và không ném gì. Nếu tài liệu module của bạn chép câu này, sửa nó.
- *"Khoá chứa dấu chấm ném `INVALID_KEY` lúc NẠP, mọi trang hỏng"* — **sai**. Bộ chuỗi nạp bình
  thường; khoá đó chỉ không bao giờ tra tới được.
- *"`pnpm add @comitor/ui@<bản mới>` im lặng không nâng"* — vẫn đúng về triệu chứng, nhưng nay có
  cách chữa: `minimumReleaseAgeExclude` liệt kê theo tên gói.

---

## v0.1.0 — trước 2026-09-02

Dựng starter: Next.js 16 + React 19 + Prisma + `@comitor/ui`, đa ngôn ngữ `vi`/`en`, xác thực qua
Comitor.Account bằng `@comitor/account-sdk`, kho tệp S3 riêng tư, ba transport email, và sáu cổng
chất lượng. Lịch sử chi tiết trong `git log`.
