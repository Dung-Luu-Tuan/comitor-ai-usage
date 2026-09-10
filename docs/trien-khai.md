# Triển khai một module Comitor

Tài liệu này chỉ ghi những gì **không suy được từ mã**. Cách chạy Next thì đọc tài liệu của Next;
cái ở đây là những quyết định đã chốt cho mọi module Comitor, và những chỗ đã hỏng thật.

**Hai đường triển khai, không phải một:** §2 ảnh container tự vận hành, §3 Vercel. §1 đúng cho cả
hai; §3 chỉ ghi bốn chỗ nó khác §2.

> **Đọc kèm:** [migration.md](migration.md) — lược đồ database ở production đi đường riêng, và nó
> phải chạy TRƯỚC bước 2 dưới đây.

---

## 1. Thứ tự, và nó không đổi được

```
1. build ảnh                     ← NEXT_PUBLIC_* bị đóng băng ở bước này
2. pnpm db:deploy                ← JOB RIÊNG, chạy MỘT lần
3. rollout mã mới                ← readiness probe quyết định khi nào instance vào luồng
```

⚠ **`prisma migrate deploy` tuyệt đối không nằm trong `CMD` của container.** N instance khởi động
song song là N tiến trình cùng áp một migration; Prisma có khoá tư vấn nên các instance thua sẽ
CHỜ, rồi health check hết giờ, rồi orchestrator giết chúng — một vòng lặp khởi động mà nguyên nhân
không hiện ra ở bất kỳ log nào của ứng dụng. Migration là một **job**, không phải một bước khởi động.

⚠ **Một ảnh cho MỖI môi trường. Đừng promote ảnh từ staging sang production.**
`NEXT_PUBLIC_*` được Next thay bằng phép thay thế VĂN BẢN **lúc build**, nên
`NEXT_PUBLIC_COMITOR_ACCOUNT_URL` nằm cứng trong JS đã đóng gói. Một ảnh build với URL của staging
sẽ đưa người dùng production sang Account của staging — và biến môi trường lúc chạy không sửa được
điều đó. Biến KHÔNG có tiền tố đó (`DATABASE_URL`, mọi secret) thì ngược lại: chúng đọc lúc chạy,
nên lúc build cứ đưa giá trị vứt đi.

---

## 2. Ảnh container

`next.config.ts` khai `output: "standalone"`, nên `.next/standalone/server.js` đã mang sẵn đúng
phần `node_modules` cần thiết.

⚠ **Khoá đó TẮT khi build trên Vercel** — `output: process.env.VERCEL ? undefined : "standalone"`.
Mục này là đường CÒN LẠI và nó không đổi; hậu quả của việc gỡ điều kiện ấy ở §3.

⚠ **`server.js` KHÔNG tự copy `public/` và `.next/static/`.** Đây là cạm bẫy hỏng ÂM THẦM, và triệu
chứng của nó y hệt cạm bẫy `allowedDevOrigins`: HTML do server render vẫn về đủ nên trang hiện ra
và có cả dữ liệu, nhưng không một chunk JS nào tải được → React không hydrate → mọi thứ cần client
im lặng không chạy. Console trình duyệt sạch.

```dockerfile
# ── build ──
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# ⚠ Giá trị THẬT của môi trường đích — xem §1. Biến không có NEXT_PUBLIC_ thì đưa giá trị vứt đi.
ARG NEXT_PUBLIC_COMITOR_ACCOUNT_URL
# ⚠ KHÔNG có `ARG NEXT_PUBLIC_APP_VERSION`, và sự vắng mặt đó là CỐ Ý: `next.config.ts` khai
#   `env: { NEXT_PUBLIC_APP_VERSION: version }` đọc thẳng từ `package.json`, mà khoá `env` của
#   next.config ĐÈ LÊN biến môi trường cùng tên. Truyền `--build-arg` là truyền vào hư không, và
#   nó hỏng CÂM: build vẫn xanh, ảnh vẫn chạy, chỉ con số ở chân thanh bên không phải con số người
#   vận hành nghĩ mình vừa đóng dấu. Muốn đổi số thì sửa `package.json`.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    COMITOR_SESSION_SECRET=YnVpbGQtdGltZS1wbGFjZWhvbGRlci1ub3QtYS1zZWNyZXQ
RUN pnpm build

# ── chạy ──
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

⚠ **Đo lại được, đừng tin đoạn comment trên:** `NEXT_PUBLIC_APP_VERSION=9.9.9-from-arg pnpm build`
rồi `grep -rl 9.9.9-from-arg .next` → **rỗng**; chuỗi thật nằm trong bundle là `version` của
`package.json`. `pnpm version:check` giữ số đó khớp với mục `## vX.Y.Z` mới nhất của `CHANGELOG.md`.
Bước copy không phải lo: khối build đã có `COPY … package.json ./` rồi `COPY . .`.

`.dockerignore` **phải có** — Docker không đọc `.gitignore`, nên thiếu nó là `.env` THẬT đi vào một
layer của ảnh, vĩnh viễn, đọc lại được bằng `docker history`.

---

## 3. Vercel — đường thứ hai, khác §2 ở bốn chỗ

`starter.dev.comitor.ai` chạy trên Vercel. Đây KHÔNG phải bản thay thế §2 — ảnh container vẫn là
đường của môi trường tự vận hành, và §1 đúng cho cả hai. Mục này chỉ ghi bốn chỗ hai đường KHÁC
nhau. Cả bốn đã làm hỏng một lần deploy thật (06.09.2026), và **không chỗ nào báo lỗi nói đúng
nguyên nhân** — đó là lý do chúng ở đây.

**1. `output: "standalone"` phải TẮT — `next.config.ts` đã tự lo, đừng "dọn" nó.**
Để nguyên thì build gãy bằng `ENOENT … .next/next-server.js.nft.json`: Vercel tự lần vết và tự
đóng gói bằng adapter của chính nó, nên bảng kê tệp mà bước standalone đi đọc không bao giờ ra
đời. Điều kiện `process.env.VERCEL ? undefined : "standalone"` đã có sẵn; lý do đầy đủ ở comment
của chính khoá `output` — một bản duy nhất, đừng chép sang đây.

**2. Không có chỗ nào chạy bước 2 của §1.**
Vercel không có job runner, nên `pnpm db:deploy` phải chạy **TAY**, từ một máy có `DATABASE_URL`
của môi trường đích, TRƯỚC khi bản deploy mới nhận lưu lượng. Thứ tự ba bước của §1 không đổi —
chỉ là bước giữa không tự chạy, và không có gì nhắc bạn rằng nó chưa chạy.
⚠ Ở hồ sơ RDS dev, `DATABASE_URL` đó là database của **cả đội**. Đọc nó trước khi gõ, đừng đọc sau.

**3. Callback OIDC phải được ĐĂNG KÝ bên Account — đặt `COMITOR_APP_URL` KHÔNG làm việc đó.**
`lib/account/config.ts` dựng hai chuỗi từ `COMITOR_APP_URL`: `…/api/auth/callback` và
`…/signed-out`. Cả hai phải khớp TỪNG KÝ TỰ với URI đã đăng ký cho client bên Account (xem dòng
`COMITOR_APP_URL` ở §5). Chưa đăng ký thì Account chặn ngay ở bước authorize và đá người dùng về
trang chủ của CHÍNH NÓ, trước khi render bất cứ thứ gì:

```
https://account.dev.comitor.ai/?error=invalid_redirect&error_description=invalid+redirect+uri
```

⚠ **Việc đăng ký KHÔNG làm được ở giao diện.** Màn "Ứng dụng kết nối" (`/w/{slug}/oauth-clients`)
bên Account lọc theo `organizationId`, mà client first-party do `seed.ts` tạo có
`organizationId = NULL` — nên nó không hiện ở đó, và người đi tìm sẽ kết luận "Account không có chỗ
cấu hình redirect_uri". **Điều đó đã được sửa 07.09.2026**: Account nay có khu **quản trị nền tảng**,
và nó nhìn thấy MỌI client của cả hệ, kể cả first-party.

Đường đúng, cho tài khoản có `isPlatformAdmin`:

    https://account.dev.comitor.ai/admin/oauth-clients/{client_id}

Sửa `redirect_uris` và `post_logout_redirect_uris` ngay trên màn hình. Không còn script nào cả —
`scripts/sync-oauth-client-uris.ts` đã bị XOÁ cùng lúc khu ấy lên, vì một đường ghi thẳng database
là đường không đi qua chốt quyền, không ghi nhật ký, và không ai thấy khi nó chạy.

⚠ Không có `isPlatformAdmin` thì màn ấy trả về màn từ chối — nhờ người quản trị nền tảng làm hộ,
đừng đi tìm đường vòng qua database.

**4. Preview deployment KHÔNG đăng nhập được, và đó là hệ quả tất yếu của (3).**
Mỗi preview mang một URL băm ngẫu nhiên, mà URI phải đăng ký TRƯỚC và khớp từng ký tự — không có
cách nào đăng ký trước cho một chuỗi chưa tồn tại. Chỉ tên miền cố định đăng nhập được. Đừng đi
tìm lỗi cấu hình khi một preview không vào được; nó đang hoạt động đúng như thiết kế.

Ngoài bốn chỗ đó, hai mục dưới đây đọc khác đi một chút: **§4 (health check) là chuyện của
orchestrator**, thứ Vercel không có — hai endpoint vẫn phục vụ, chỉ là không ai thăm dò chúng và
không ai bị giết vì chúng đỏ. **§8 (giới hạn tần suất) không đổi**: quyết định vẫn là "ở ingress,
không ở module", và trên Vercel ingress là lớp của Vercel chứ không phải mã ở đây.

---

## 4. Health check

| Đường dẫn | Trả lời câu | Đỏ thì orchestrator làm gì |
|---|---|---|
| `/api/health` | Tiến trình này còn xử lý được request không? | **Giết và khởi động lại** |
| `/api/ready` | Instance này nhận được lưu lượng chưa? | **Rút khỏi luồng**, không giết |

⚠ **Đừng trỏ liveness probe vào `/api/ready`.** Một sự cố Postgres kéo dài sẽ làm readiness đỏ ở
mọi instance; nếu liveness cũng dùng nó thì orchestrator giết và khởi động lại tất cả — một cơn
bão khởi động chồng lên một database vốn đã quá tải.

⚠ **Đừng trỏ load balancer vào `GET /`.** Nó đi qua `requireSession()` và trả **307** sang trang
đăng nhập TRƯỚC khi chạm database, nên nó "khoẻ" ngay cả khi Postgres đã chết. Đã đo: dừng
Postgres → `/api/ready` 503, `/api/health` 200, `GET /` 307.

`/api/ready` báo cả `storage`, nhưng **không** để nó quyết định 503: thiếu kho tệp thì chỉ chức năng
đính kèm tự tắt, và rút cả instance khỏi luồng vì một tính năng phụ là biến suy giảm thành sự cố.

---

## 5. Biến môi trường

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL` | ✅ | ⚠ Mỗi module một **schema hoặc database riêng** — xem [migration.md](migration.md) §5 |
| `COMITOR_SESSION_SECRET` | ✅ | Mọi instance dùng CÙNG giá trị; lệch nhau là người dùng bị đăng xuất ngẫu nhiên theo load balancer |
| `COMITOR_APP_URL` | ✅ | Phải khớp `redirect_uris` đã đăng ký ở Account, **từng ký tự**. Đăng ký bằng cách nào — và vì sao giao diện của Account không làm được — ở §3 |
| `NEXT_PUBLIC_COMITOR_ACCOUNT_URL` | ✅ | ⚠ Đóng băng LÚC BUILD |
| `COMITOR_CLIENT_*` | ✅ | Thiếu → fail-closed, không ai vào được |
| `COMITOR_M2M_*` | ✅ | Thiếu → danh bạ rỗng. Đường ĐỌC fail-open (thiếu vài tên, trang vẫn chạy); đường GHI ném **503 SERVICE_UNAVAILABLE** — `requireMemberDirectory()` ở `lib/tasks.ts`. Một danh bạ rỗng trả lời "không phải thành viên" cho MỌI người, nên báo nó thành 4xx là biến sự cố hạ tầng thành lời khẳng định sai về dữ liệu |
| `COMITOR_WEBHOOK_SECRET` | nên có | Thiếu → không thu hồi được phiên từ Account (route trả 503 và log) |
| `COMITOR_AWS_AUTH` | tuỳ tôpô — cần khi máy lấy credential bằng **IAM role** | `keys` (mặc định) hay `instance-role`. MỘT công tắc cho CẢ S3 lẫn SES (tôpô đã chốt ở `lib/env.ts`: MinIO + khoá ở máy phát triển · khoá ở preview · **instance role** ở production). Giá trị lạ thì ném lúc khởi động. ⚠ Quên đặt `instance-role` trên máy dùng IAM role thì **hai nửa hỏng ngược nhau**: nửa SES ném NGAY lúc khởi động (`Thiếu biến môi trường COMITOR_SES_ACCESS_KEY`, và chỉ khi `COMITOR_MAIL_TRANSPORT=ses`); nửa S3 KHÔNG ném gì — app lên sạch, khoá tĩnh rỗng ⇒ `storageEnabled` là `false` ⇒ đính kèm tắt hẳn. Triệu chứng thì nhìn thấy được (`/api/ready` báo `storage:false`, giao diện nói "kho ảnh chưa được cấu hình"), nhưng nó trỏ vào `COMITOR_S3_*` chứ không trỏ vào công tắc thật |
| `COMITOR_S3_*` | tuỳ | Thiếu → đính kèm tự tắt, giao diện nói rõ |
| `COMITOR_MAIL_TRANSPORT` | nên có | `console` ở môi trường không phải loopback thì `lib/env.ts` CẢNH BÁO. Chọn `ses` thì `COMITOR_SES_REGION` thành BẮT BUỘC, kèm `COMITOR_SES_ACCESS_KEY`/`_SECRET_KEY` khi `COMITOR_AWS_AUTH=keys` — thiếu là ném lúc khởi động, không âm thầm |

`lib/env.ts` **ném lúc khởi động** với hai ca đã gặp thật: một placeholder của `.env.example` lọt
lên máy thật, và `COMITOR_S3_ENDPOINT` trỏ `localhost` trong khi `COMITOR_APP_URL` là tên miền thật.

---

## 6. Xoay `COMITOR_SESSION_SECRET`

**Xoay nó là đăng xuất mọi người** — phong bì AES-256-GCM của bộ token trong `account_sessions`
không mở được nữa (`open()` ở `lib/account/session-store.ts` trả `null`, tức coi như chưa đăng
nhập). Cookie thì KHÔNG mã hoá: nó chỉ là 32 byte ngẫu nhiên, database giữ SHA-256 của nó. Đó là
hành vi ĐÚNG, và nó là nút "thu hồi mọi phiên" duy nhất module có. Nhưng phải biết trước khi bấm,
và phải làm ngoài giờ cao điểm: mọi người dùng đang mở app sẽ bị đá về Account, rồi SSO đưa họ quay
lại — êm với người còn phiên ở Account, và là một lần đăng nhập lại với người không còn.

⚠ **Bản trước của mục này viết "cookie cũ không giải mã được nữa", và nó SAI.** Cookie chưa bao giờ
được mã hoá bằng bí mật này — toàn repo có ĐÚNG MỘT chỗ dùng nó:
`scryptSync(env.sessionSecret, "comitor-session-v1", 32)` ở `lib/account/session-store.ts`. Câu ấy
sai đúng ở chỗ repo vừa dựng lại cả kiến trúc phiên để tránh: **token đã RỜI KHỎI cookie**. Hậu quả
nêu ra thì đúng, chỉ cơ chế là sai. Hệ quả cho người vận hành: **có HAI đầu vào cùng là nút thu
hồi**, vì đổi chuỗi muối `"comitor-session-v1"` cho hậu quả y hệt đổi bí mật.

Không có cách xoay "mềm". Thêm tiền tố phiên bản để đọc được cả khoá cũ lẫn mới nghe hợp lý, và nó
lấy mất đúng thứ vừa nói: nút thu hồi duy nhất.

---

## 7. Sao lưu

⚠ **Database và bucket phải được chụp CÙNG MỘT MỐC.** Database lưu KHOÁ object, không lưu tệp:

- khôi phục database về mốc cũ mà không khôi phục bucket → `attachment_key` trỏ vào những object
  không còn, và người dùng thấy ảnh vỡ;
- khôi phục bucket mà không khôi phục database → object mồ côi không truy vấn nào tìm ra, trả tiền
  lưu trữ mãi.

Migration "thu hẹp" (bước 3 của công thức ở [migration.md](migration.md) §4) là điểm không quay lại
được — sao lưu cả hai kho ngay trước khi chạy nó.

## 8. Giới hạn tần suất — cấu hình ở ingress

Module **không** mang bộ giới hạn nào; quyết định và lý do ở
[AGENTS.md §"Giới hạn tần suất"](../AGENTS.md#giới-hạn-tần-suất-ở-hạ-tầng-không-ở-module). Phần
việc của người vận hành:

**Chặn theo IP, ở lớp vào.** Ba đường đáng chặn nhất là ba đường **không có phiên**, nên chúng
không tự bảo vệ được:

| Đường | Vì sao |
|---|---|
| `GET /api/auth/sign-in` | Mỗi lần gọi là một vòng OIDC mới ở Account — khuếch đại sang hệ khác |
| `GET /api/auth/callback` | Nhận `code` từ bên ngoài; dò `state` phải tốn kém |
| `POST /api/comitor/webhook` | Nhận từ Internet. Chữ ký HMAC chặn được giả mạo, **không** chặn được lũ request bắt máy chủ đi tính HMAC |

**Miễn trừ, bắt buộc:** `GET /api/health` và `GET /api/ready`. Bộ thăm dò gọi chúng vài giây một
lần; chặn chúng là làm container bị khai tử vì "không khoẻ" trong khi nó khoẻ — và triệu chứng
(container restart theo chu kỳ) không gợi gì tới nguyên nhân là một luật rate-limit.

**Nếu ingress trả 429 cho một đường `/api/`**, giao diện đã xử lý đúng: `useErrorMessage` kiểm
`status === 429` trước khi tra `code`, nên người dùng nhận câu "thao tác quá nhanh" chứ không phải
"lỗi hệ thống" — kể cả khi limiter trả 429 trần không kèm thân JSON.
