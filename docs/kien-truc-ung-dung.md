# Kiến trúc ứng dụng — Humble Pattern cho một module Comitor

> Tài liệu này là **chuẩn tổ chức mã** của mọi web app trong hệ sinh thái Comitor, viết lại cho một
> **module nghiệp vụ** (Tasks, Chat, CRM, HR…). Bản gốc, viết cho `comitor-account`, ở
> `../comitor-account/docs/kien-truc-ung-dung.md`; những chỗ hai bản khác nhau được đánh dấu rõ ở
> §9 — và khác biệt lớn nhất là: **Account LÀ máy chủ xác thực, module thì KHÔNG.**

Đọc [AGENTS.md](../AGENTS.md) trước để biết quy ước bắt buộc và cạm bẫy. Tài liệu này trả lời câu
hỏi khác: **mỗi dòng mã thuộc về đâu, và vì sao.**

---

## 1. Nguyên tắc: mỗi dòng mã thuộc đúng một trong hai loại

> **Quy tắc nghiệp vụ** — trả lời một câu hỏi đúng/sai, được/không được, xếp hạng, đếm.
> **Nối dây** — lấy dữ liệu chỗ này đưa sang chỗ kia, và vẽ nó ra.

Quy tắc nghiệp vụ nằm trong **hàm thuần ở `lib/core/`**: không React, không Next, không Prisma,
không `@comitor/ui`, không `next-intl`, và **không trả về chuỗi hiển thị**. Mọi thứ còn lại — trang,
component, store, hook, route handler — là vỏ nối dây.

Vì sao đáng làm, nói bằng mã có thật trong repo này:

| Quy tắc | Nếu nó nằm trong `.tsx` | Vì nó ở `lib/core/` |
|---|---|---|
| "Chủ sở hữu luôn có mọi quyền" | Chỉ đúng ở chỗ nào có người nhớ viết `if` | `permissionLock` áp cho cả tầng đọc lẫn tầng ghi, và có test đối chứng cho ca khách + quyền ĐỌC |
| "Mã việc kế tiếp đếm từ mã lớn nhất" | Sinh mã trùng ngay lần đầu có người xoá một việc | `nextTaskCode` có test cho ca "dãy mã có lỗ" |
| "Quá hạn là hạn chót trước hôm nay" | Sai một ngày với mọi người dùng ngoài GMT+7 | `isOverdue` + `parseIsoDate`, test cả ca múi giờ âm |
| "Bộ lọc rỗng nghĩa là KHÔNG lọc" | Bảng đầy dữ liệu thành bảng rỗng ngay lần mở bộ lọc đầu tiên | `matchesTask` có test đối chứng |

Bốn dòng trên đều là lỗi đã xảy ra thật ở đâu đó trong hệ, và cả bốn đều là loại lỗi mà **đọc mã
không bắt được nhưng một unit test bắt được trong một giây**.

---

## 2. Sáu tầng và ba rìa — bảng tra nhanh

Đọc bảng theo cột **CẤM**: đó là cột duy nhất kiểm được trong review mà không cần tranh luận về
khẩu vị.

| # | Tầng | Thư mục | Vai trò | **CẤM import** | Kiểm bằng |
|---|---|---|---|---|---|
| 0 | **Hợp đồng** | `lib/contracts/` | Kiểu đi qua ranh giới client ⇄ server và qua JSON | mọi thứ có mã chạy được | `tsc` |
| 1 | **Lõi thuần** | `lib/core/` | Toàn bộ quy tắc nghiệp vụ | `react`, `next/*`, `@prisma/*`, `@comitor/ui`, `next-intl`, `server-only`, **và mọi chuỗi hiển thị** | `vitest` + `pnpm core:check` |
| 2 | **Cổng API** | `lib/api-client/` | Cửa DUY NHẤT giao diện gọi ra ngoài | `react`, `@prisma/*`, mọi `lib/` phía máy chủ | `tsc` + đi thật |
| 3 | **Store** | `stores/` *(chưa tồn tại)* | State phía trình duyệt sống lâu hơn một component | `react` (JSX), `next/*`, mọi mã máy chủ | unit test |
| 4 | **Hook cầu nối** | `hooks/` | Nối store → lõi → component | `@prisma/*`, `lib/` máy chủ, **logic nghiệp vụ** | — |
| 5 | **Component** | `components/`, cạnh route | Nhận dữ liệu, trả JSX | **mọi phép tính nghiệp vụ**, `fetch()` trực tiếp | đi thật |
| A | *rìa* **Server Component** | `app/**/{page,layout}.tsx` | Lấy dữ liệu, truyền prop | `stores/`, `hooks/`, `"use client"` | đi thật |
| B | *rìa* **Route handler** | `app/api/**/route.ts` | Xác thực → gọi lõi → trả JSON | `stores/`, `hooks/`, `components/` | đi thật |
| B′ | *rìa* **Server Action** | `"use server"` | CHỈ ghi cookie/preference giao diện | **database**, mọi thứ cần quyền; `stores/`, `hooks/` | — (xem §3 rìa B′) |
| C | **Hình dạng phản hồi** | `lib/api/` | `withApiErrors`, `apiOk`, `apiError` — hợp đồng JSON của rìa B | `stores/`, `hooks/`, `components/` | — |
| D | **Truy cập dữ liệu** | `lib/*.ts` (`tasks`, `projects`, `settings`, `permissions`, `activities`, `storage`, `mail`) | Prisma và mọi lần chạm hạ tầng | `@comitor/ui`; **import TĨNH** `next/navigation`·`next/link`·`next/image`; `stores/`, `hooks/`, `components/`; và **KHÔNG truy vấn nào chọn hàng mà thiếu `workspaceId`** | `pnpm tenant:check` + Biome + `import "server-only"` |

⚠ **Thư mục `stores/` KHÔNG tồn tại trên đĩa, và đó là câu trả lời đúng.** Hàng 3 mô tả một tầng
đã được thiết kế nhưng chưa có màn hình nào cần tới — bốn điều kiện để dựng nó ở §3 tầng 3. Bản
trước của README/AGENTS nói về `stores/` như một thư mục đang có; tạo một thư mục rỗng chỉ để câu
đó đúng là làm ngược: git không theo dõi thư mục rỗng, nên nó sẽ biến mất ở lần clone đầu tiên.

⚠ **Hàng C (`lib/api/`) cũng thiếu trong mọi bản trước** — kể cả trong chính đoạn mã mẫu dùng
`withApiErrors` ở §3, đoạn đó còn thiếu luôn dòng `import`. Đó không phải một hàng phụ: `withApiErrors`
là hàng rào chặn `error.message` của Prisma (tên bảng, tên cột, đôi khi cả câu truy vấn) rò ra ngoài.

⚠ **Hàng D thiếu trong mọi bản trước của bảng này**, và chỗ thiếu không vô hại: nó là tầng DUY
NHẤT chạm dữ liệu khách hàng, nên nó là tầng duy nhất mà cột CẤM thật sự bảo vệ được thứ gì. Luật
`workspaceId` được phát biểu ở dòng đầu `prisma/schema.prisma` từ đầu, nhưng nó không xuất hiện
trong bảng tầng nào — tức người đọc bảng này để biết "mình được phép làm gì ở đâu" không bao giờ
gặp nó.

Những điều bảng trên nói mà dễ đọc lướt qua:

- **Tầng 1 cấm cả `next-intl`.** Lõi thuần không biết ngôn ngữ nào tồn tại. Đó là lý do
  `lib/core/accept-language.ts` trả về danh sách mã ngôn ngữ đã xếp hạng chứ không tự chọn — việc
  chọn là của `lib/i18n/config.ts`, nơi biết `LOCALES`.
- **Tầng 5 cấm `fetch()` trực tiếp.** Đó là toàn bộ lý do tầng 2 có mặt.
  ⚠ **Ngoại lệ, và hôm nay chỉ có một**: `onLogout` ở `app/(shell)/shell-frame.tsx` gọi thẳng
  `fetch("/api/auth/sign-out", { method: "POST", redirect: "manual" })`. Cổng không bán được gì cho
  đường này: sản phẩm của tầng 2 là đổi CẢ lỗi HTTP lẫn lỗi MẠNG thành một `ApiError` mang `code`
  (xem đầu `lib/api-client/http.ts`), mà chỗ gọi này `.finally()` rồi `window.location.assign`
  **bất kể thành bại**. Thêm nữa `redirect: "manual"` không nằm trong `RequestInput` của `callApi`,
  và nó là phần BẮT BUỘC. Lý do `POST` (chứ không phải điều hướng) và lý do mã chuyển hướng ghi tại
  chỗ gọi và ở `app/api/auth/sign-out/route.ts` — đọc ở đó, đừng chép số sang đây.
  Đếm lại, đừng đếm bằng mắt:
  `grep -rn 'fetch(' app components hooks --include='*.tsx' --include='*.ts' | grep -v lib/api-client | grep -vE '^[^:]+:[0-9]+: *\*'`
- **Cả ba rìa không được biết đến `stores/` và `hooks/`.** Chúng chạy ở máy chủ; import một store
  là kéo mã chỉ-chạy-ở-trình-duyệt vào chỗ không có trình duyệt.
- **Tầng D cấm `@comitor/ui` VÀ import tĩnh `next/navigation`, cùng một lý do.** Cả hai kéo theo
  runtime client của React, và khi đó `lib/` không nạp được bằng `tsx` nữa — `pnpm seed`, một job
  nền và mọi script bảo trì chết theo. `next/headers` và `next/server` thì KHÔNG bị cấm: chúng chỉ
  chạy ở máy chủ.
  Cần một helper của Next trong tầng D thì dùng **`import()` ĐỘNG trong chính hàm cần nó** —
  `requireReadPermission()` và `requireSession()` làm đúng vậy, kèm một `biome-ignore` mang lý do
  (Biome không phân biệt được import tĩnh với động, nên escape hatch phải tường minh).
  ⚠ Ngoại lệ duy nhất: `lib/api/response.ts` — nó LÀ rìa B, không phải tầng D.
- **Tầng D cấm `@comitor/ui`, và lý do không phải là gu kiến trúc.** `lib/catalog/settings.ts`
  import `DEFAULT_PAGE_SIZE_OPTIONS` từ gói, nên một file tầng D import nó là kéo cả React vào tầng
  dữ liệu. `next build` không phàn nàn — nó gói theo route — nhưng `tsx` thì nổ ngay:
  *"SyntaxError: The requested module 'react' does not provide an export named 'useLayoutEffect'"*.
  Tức `createTask()` không gọi được từ `pnpm seed`, từ một job nền, hay từ một script, và đó chính
  là ba đường mà việc tách nghiệp vụ ra khỏi `route.ts` sinh ra để phục vụ. Hằng dùng chung giữa
  giao diện và máy chủ thì để ở `lib/core/` (`APPROVAL_FLOWS`, `NOTIFY_CHANNELS` đã chuyển về đó).
- **Tầng D cấm một thứ không phải là `import`.** Mọi hàng khác trong bảng cấm một phụ thuộc; hàng
  này cấm một HÌNH DẠNG TRUY VẤN. Đó là chủ ý: `findUnique({ where: { id } })` không import gì sai,
  không vi phạm tầng nào, và vẫn là cách rò dữ liệu khách hàng sang nhau. Database có một lưới cuối
  cho quan hệ `tasks` → `projects` (khoá ngoại KÉP, xem `prisma/schema.prisma`), nhưng nó chỉ phủ
  được quan hệ đó — phần còn lại do `pnpm tenant:check` canh.

Còn một tầng nữa, riêng của module này và không có ở tài liệu gốc:

| ★ | **Bảng khai** | `lib/catalog/` | Hằng GIAO DIỆN: thứ tự, tone màu, icon, id | `@prisma/*`, `server-only`, mọi `lib/` phía máy chủ | `tsc` |

`lib/catalog/` khác `lib/core/` ở đúng một chỗ: nó **được phép** biết tới `@comitor/ui` và mang
icon (component React), vì nó được `import` thẳng từ file `"use client"`. Nó khác `lib/contracts/`
ở chỗ nó có giá trị chạy được, không chỉ kiểu. Và nó **không mang nhãn** — nhãn ở
`messages/*.json`, ghép lại ở `hooks/use-catalog.ts` (client) hoặc `lib/i18n/catalog-server.ts`
(server).

### Dòng chảy dữ liệu, viết thành một hình

```
                              lib/core/  (quy tắc, có test)
                                  ▲                ▲
route handler ────────────────────┘                │
   (app/api/**/route.ts)                           │
        │                                          │
        ├── lib/permissions.ts  (chốt quyền THẬT)  │
        └── lib/{tasks,projects,settings}.ts ──────┤
                     │  Prisma                     │
                     ▼                             │
            Server Component  ──── prop ────►  Component
            (app/**/page.tsx)                      ▲
                                                   │ hook
                                         lib/api-client/  (ghi)
```

Đọc hình theo hai chiều:

- **Đọc** đi từ dưới lên: Server Component gọi `lib/*.ts` (Prisma trực tiếp) rồi truyền prop THUẦN
  xuống. Nó **không** `fetch("/api/…")` của chính mình — đó là thêm một vòng mạng và một lần xác
  thực lại cookie cho không.
- **Ghi** đi từ trên xuống: component gọi `lib/api-client/` → route handler → `lib/*.ts` → Prisma.
  Route handler là chỗ DUY NHẤT có `requirePermission()`.

---

## 3. Từng tầng — luật, và mã thật trong repo này

### Tầng 0 · Hợp đồng — `lib/contracts/`

Chỉ `interface` và `type`. Không một dòng mã chạy được, kể cả một hằng.

Vì sao khắt khe thế: một `const` ở đây là mã, và mã thì kéo theo module. Một Client Component
`import type { TaskView }` không tốn gì; `import { TASK_LIMIT }` từ cùng file thì kéo cả file vào
bundle — và nếu file đó lỡ import một thứ chỉ-chạy-ở-server, build hỏng với một thông điệp không
nói gì về nguyên nhân.

Bốn file: `account.ts` (hợp đồng với Comitor.Account), `task.ts`, `settings.ts`, `error.ts`.

⚠ **`TaskView` KHÔNG phải kiểu Prisma sinh ra.** Kiểu của Prisma mang `Date`, `Decimal` và quan hệ
lồng nhau — cả ba đều không tuần tự hoá được qua ranh giới server → client, hoặc tuần tự hoá thành
thứ khác với cái đọc ra. Mọi mốc thời gian ở tầng 0 là **chuỗi ISO**.

### Tầng 1 · Lõi thuần — `lib/core/`

`vitest.config.ts` khoá ngưỡng coverage ở 90%. Không mock, không jsdom, không setup file — vì tầng
này bị cấm import những thứ cần mock.

⚠ **Không phải module nào cũng có file `.test.ts` RIÊNG**, và câu ở bản trước nói vậy là sai. Hôm
nay ba module chưa có: `app-identity.ts`, `project-input.ts`, `task-input.ts` — chúng được phủ gián
tiếp qua chỗ gọi, nên ngưỡng 90% vẫn đạt. Ngưỡng đo ĐỘ PHỦ, không đo "có file test hay không";
đừng đọc cổng xanh thành lời bảo đảm rằng mọi hàm ở đây đã được viết test riêng.

> **Ngày nào một test ở đây cần mock là ngày một quy tắc nghiệp vụ đã rò ra khỏi tầng thuần.**
> Sửa chỗ rò, đừng thêm mock.

Hai cổng canh tầng này, và chúng bắt hai thứ khác nhau:

- `biome.json` (`overrides` → `noRestrictedImports`) chặn **import sai tầng**;
- `pnpm core:check` chặn **chuỗi hiển thị lọt vào**, thứ mà không lint nào bắt được.

Cổng thứ hai đáng nói riêng. Một hàm trả về `label: "Quá yếu"` thì: không nằm trong `messages/` nên
`i18n:check` không thấy; không nằm trong JSX nên đọc lướt không thấy; và **chạy đúng ở tiếng Việt**
nên không ai báo lỗi — cho tới khi có người mở giao diện tiếng Anh. Đó là lỗi đã xảy ra thật ở
`comitor-account`.

### Tầng ★ · Bảng khai — `lib/catalog/`

`task.ts` (trạng thái, độ ưu tiên, tone, badge), `permissions.ts` (11 quyền), `settings.ts` (tuỳ
chọn của bốn tab), `navigation.ts` (menu), `apps.ts` (dải sản phẩm).

Luật: **id và thứ tự ở đây, nhãn ở `messages/`**. Một `label: "Đang làm"` trong bảng khai là một
chuỗi hiển thị nằm ngoài tầm của `i18n:check`.

### Tầng 2 · Cổng API — `lib/api-client/`

`http.ts` giữ phần chung (`callApi`), và **không được tái xuất từ `index.ts`**. Mỗi nhóm endpoint
một file, mỗi endpoint một phương thức, **kiểu trả về viết tay**.

⚠ Vì sao KHÔNG có một `request<T>(path)` công khai: nó bắt mỗi chỗ gọi tự khai `T`, và `tsc` không
còn bắt được sai hình dạng nữa — nó chỉ tin những gì chỗ gọi khai. Cái được của một helper generic
là gõ ít hơn; cái mất là toàn bộ khả năng kiểm kiểu ở ranh giới nguy hiểm nhất.

Cái mà cổng thật sự mua được: **nhánh lỗi MẠNG**. `fetch()` trần bắt mỗi chỗ gọi tự đọc
`error.code` ra khỏi thân phản hồi, và ai cũng làm thiếu ở đúng nhánh đó — khi đứt mạng thì `catch`
nhận một `TypeError` không có `code`, và giao diện hiện "lỗi không xác định" cho mọi sự cố mạng.
Cổng đổi cả hai loại thành `ApiError` mang `code`, nên một nhánh `catch` phục vụ được cả hai và
`useErrorMessage()` tra được `errors.*`.

### Tầng 3 · Store — `stores/`

**Repo này KHÔNG có store nào, và đó là câu trả lời đúng.**

Dựng store khi thoả **ít nhất một** trong bốn điều:

1. state sống lâu hơn component tạo ra nó (giữ khi điều hướng đi rồi quay lại);
2. hai nhánh cây React xa nhau cùng đọc và cùng ghi nó;
3. có một chuỗi thao tác bất đồng bộ cần điều phối (optimistic update, rollback, huỷ);
4. cần kiểm được logic đó bằng unit test mà không dựng React.

Bảng công việc lọc bằng `useState`; trang cài đặt giữ nháp bằng `useState`; ma trận quyền cũng vậy.
Không cái nào thoả một điều trong bốn. Thêm một store cho chúng là thêm một tầng để đọc và một chỗ
nữa để state lệch nhau.

> Mặc định của một màn hình là **Server Component lấy dữ liệu rồi truyền prop**. Không store, không
> hook, không `useEffect`. Đó không phải sự tối giản — đó là hình dạng rẻ nhất mà vẫn đúng.

### Tầng 4 · Hook cầu nối — `hooks/`

`use-catalog.ts` (ghép bảng khai với nhãn), `use-error-message.ts` (mã lỗi → câu chữ),
`use-settings-draft.ts` (nháp/lưu dùng chung bốn tab).

Hook được phép biết `react` và `next-intl`. Hook **không** được chứa quyết định nghiệp vụ — nếu bạn
đang viết một `if` trả lời một câu hỏi đúng/sai trong `hooks/`, nó thuộc `lib/core/`.

### Tầng 5 · Component

Nhận dữ liệu, trả JSX. Chỗ đặt file quyết định bởi **phạm vi dùng**, chỉ có hai chỗ:

- phục vụ đúng MỘT route → **đặt cạnh route đó**;
- dùng ở NHIỀU route, hoặc là mảnh của khung app → `components/`.

Và **ghi ngay đầu file vì sao nó tồn tại** (gói thiếu gì, hoặc nó chỉ *nối* component nào của gói).
Không có ghi chú đó thì lần review sau không ai biết nên gỡ bỏ hay nên đẩy ngược lên `@comitor/ui`.

### Rìa A · Server Component

Lấy dữ liệu qua `lib/*.ts`, truyền prop THUẦN xuống. **Không tự gọi API của chính mình.**

> **Rìa A chốt quyền ĐỌC; rìa B chốt quyền GHI.** Hai rìa, hai hàm, hai cách nói "không được phép":
> `requireReadPermission()` gọi `notFound()` (một màn hình cho con người), còn `requirePermission()`
> ném `ApiError` 403 (một mã cho client đọc JSON). Ném `ApiError` từ Server Component chỉ cho ra
> `app/error.tsx` với câu "đã có lỗi xảy ra" — sai hoàn toàn: không có lỗi nào cả.
>
> ⚠ **Giấu và chặn phải đi CÙNG NHAU.** `lib/catalog/navigation.ts` mang trường `permission` để
> giấu mục khỏi thanh bên và khỏi ⌘K; `requireReadPermission()` ở `page.tsx` là phần chặn. Giấu mà
> không chặn thì gõ tay đường dẫn là vào được; chặn mà không giấu thì người dùng bấm một mục trong
> thanh bên rồi nhận 404 — và họ sẽ báo đó là lỗi.

Ranh giới này là lý do `app/(shell)/layout.tsx` tách làm hai file: phần server đọc phiên và dữ liệu,
phần `shell-frame.tsx` mang `"use client"` vì `AppShell` nhận callback và vì `NAV_ITEMS`/`APPS` mang
**icon** — component React thì không tuần tự hoá được qua ranh giới.

### Rìa B · Route handler

Bốn bước, đúng thứ tự, không đảo:

```ts
import { requireApiSession } from "@/lib/account/session";
import { apiOk, withApiErrors } from "@/lib/api/response";
import { ApiError } from "@/lib/core/api-error";
import { createTaskSchema } from "@/lib/core/task-input";
import { requirePermission } from "@/lib/permissions";
import { createTask } from "@/lib/tasks";

export const POST = withApiErrors(async (request: Request) => {
  const session = await requireApiSession();                                  // 1. ai gọi
  await requirePermission(session.workspace.id, session.role, "task.create");  // 2. có được phép không

  // 3. dữ liệu có hợp lệ không — HAI phép kiểm, không phải một
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw ApiError.validation("Request body is not valid JSON.");
  }
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join("."));
    throw ApiError.validation("Task payload failed validation.", { fields });
  }

  return apiOk(await createTask(session, parsed.data), { status: 201 });       // 4. làm việc
});
```

⚠ Bước 3 là **hai** phép kiểm chứ không phải một `.parse()`, và cả hai đều cần thiết: `request.json()`
ném `SyntaxError` cho một thân không phải JSON — một lỗi KHÁC hẳn "JSON hợp lệ nhưng sai hình dạng",
và gộp chúng là trả cùng một thông điệp cho hai nguyên nhân khác nhau. `safeParse` chứ không `parse`
để lấy được DANH SÁCH TRƯỜNG sai đưa vào `metadata` — thông điệp của zod là chuỗi tiếng Anh của một
thư viện, giao diện không in nó (nó tra `errors.*` theo `code`).

Đây là `app/api/tasks/route.ts` thật, không phải mã minh hoạ — kể cả khối `import`, vì `withApiErrors`
là hàng rào chặn `error.message` của Prisma rò lược đồ ra ngoài, và một ví dụ thiếu dòng import nó
là một ví dụ dạy sai.

⚠ **`requireApiSession()`, KHÔNG phải `requireSession()`.** Bản kia kết thúc bằng `redirect()`, mà
`redirect()` của Next hoạt động bằng cách NÉM một lỗi điều khiển luồng — `withApiErrors` bắt nó và
trả **500** cho một chuyện bình thường (access token sống 15 phút). Đã đo trên luồng thật: `PUT
/api/task-drafts` không phiên trả `500 INTERNAL_ERROR` kèm `[api] LỖI KHÔNG XỬ LÝ Error:
NEXT_REDIRECT` trong log; nay trả `401 UNAUTHORIZED`.

### Rìa B′ · Server Action — đường ghi THỨ HAI, và nó có luật riêng

Server Action là idiom mặc định của Next 16, nên người mới sẽ với tay lấy nó theo phản xạ. Đi đường
đó là **mất sạch bốn hàng rào** của rìa B cùng lúc: không `withApiErrors` (lỗi Prisma rò ra ngoài),
không `ApiError` (client không phân biệt được 401/403/409), không hợp đồng `lib/api-client/`, và
**không gì nhắc `requirePermission()`** — `pnpm api:check` chỉ quét `app/api/**/route.ts`.

> **Luật:** Server Action CHỈ dùng cho thao tác **không chạm dữ liệu nghiệp vụ và không cần quyền**.
> Hôm nay đúng một trường hợp: ghi cookie giao diện (`lib/i18n/actions.ts` — đổi ngôn ngữ).
> Mọi thao tác GHI chạm database đi **route handler + `lib/api-client/`**.

Ngày cần một action ghi database thật, nó phải có `withActionErrors` song sinh và phải gọi
`requirePermission()` — và `pnpm api:check` phải được mở rộng để quét cả `"use server"`. Đừng làm
nửa đầu mà quên nửa sau.

| | Rìa B (route handler) | Rìa B′ (Server Action) |
|---|---|---|
| Dùng khi | Mọi thao tác ghi chạm database | Ghi cookie/preference giao diện |
| CẤM | `stores/`, `hooks/`, `components/` | **chạm database**, mọi thứ cần quyền |
| Bắt buộc | `withApiErrors` + `requirePermission()` | — (vì nó không được làm gì cần hai thứ đó) |
| Cổng | `pnpm api:check` | *chưa có* — đó là lý do luật trên phải hẹp |

⚠ **Bước 2 đọc CÙNG bảng mà giao diện đọc.** Một phép kiểm quyền viết riêng ở máy chủ ("chỉ admin
mới được xoá") là nguồn sự thật THỨ HAI, và hai nguồn thì sớm muộn nói khác nhau: quản trị viên tắt
một ô trong bảng, giao diện ẩn nút, mà API vẫn cho qua.

---

## 4. Ranh giới máy chủ ⇄ trình duyệt — chỗ hỏng im lặng nhất

Đây là hạng lỗi đặc trưng của App Router: **nó không báo gì cả cho tới khi nổ.** Một Client
Component import nhầm một file có `import { prisma }` thì hoặc build hỏng với thông điệp không nói
gì về nguyên nhân, hoặc — tệ hơn — nó chạy, và một khoá bí mật đi vào bundle.

Ba cơ chế canh, và cần **cả ba** vì mỗi cái thấy một phần:

| Cơ chế | Bắt được | Không thấy |
|---|---|---|
| `biome.json` overrides | `import` sai tầng, viết thẳng trong file — nhưng CHỈ trong ba override | đường bắc cầu (A → B → prisma); mọi cây ngoài ba override — `app/`, `components/` |
| `import "server-only"` | đường bắc cầu, ở lúc build | file không có nó |
| `import "client-only"` | Server Component import cổng API | — |

Biome đọc **một** file mỗi lần, nên nó bắt được `import { prisma }` viết thẳng, nhưng không bắt được
`component → lib/tasks.ts → lib/prisma.ts`. Chuỗi bắc cầu đó chỉ bundler thấy — đó là việc của
`server-only`.

⚠ **Biome KHÔNG phủ được cây `app/`**, và đừng cố. `app/` chứa **cả** Server Component, route
handler (được phép import `prisma`) **lẫn** Client Component (không được phép), mà Biome khớp theo
đường dẫn chứ không đọc được `"use client"`. Một luật cho `app/**` sẽ hoặc chặn nhầm route handler,
hoặc chừa cửa cho client. Cây `app/` do `server-only` canh.

⚠ **`components/` cũng KHÔNG được Biome canh — nhưng vì CHƯA dựng, không phải vì không dựng được.**
`noRestrictedImports` chỉ có ở ba override — chúng phủ `lib/core|lib/contracts`,
`stores|hooks|lib/api-client|lib/catalog`, và `lib/**` trừ vài thư mục — cộng một luật toàn cục
chặn đúng `better-auth/*`. Nên một file `"use client"` trong `components/` import thẳng
`@/lib/prisma` đi qua `biome check` sạch. Khác `app/` ở chỗ quyết định: ở đây KHÔNG file nào —
server hay client — được phép chạm tầng D, nên một override `components/**` là **viết được**. Cái
giá là allowlist phải rộng hơn của `hooks/` đúng những khoản đang dùng thật
(`@/lib/account/links`, `@/lib/i18n/actions`, `@/lib/i18n/ui-labels`), và nó sẽ chặn nhầm ngày có
một Server Component trong `components/` cần một module máy chủ — hôm nay
`display-prefs-seed.tsx` và `access-denied.tsx` là hai file server nằm cạnh ba file `"use client"`.
Cây này cũng do `server-only` canh. Đếm lại các override, đừng đếm bằng mắt:
`node -e "require('./biome.json').overrides.forEach((o,i)=>console.log(i,JSON.stringify(o.includes)))"`

⚠ **Viết dạng `patterns` + glob, KHÔNG viết dạng `paths` liệt kê.** `options.paths` là khớp chuỗi
CHÍNH XÁC, không có ký tự đại diện — liệt kê `"@/lib/prisma"`, `"@/lib/env"` là **cho phép theo mặc
định**, và mọi module máy chủ thêm sau đều lọt. `options.patterns[].group` nhận glob kiểu gitignore
kể cả phủ định `!`, nên `["@/lib/**", "!@/lib/core/**", …]` là **cấm theo mặc định**: ai thêm
`lib/billing.ts` quý sau sẽ bị chặn ngay lần import đầu tiên từ phía client, không cần ai nhớ đi sửa
`biome.json`.

Với một AI agent thì khác biệt này là quyết định: agent thêm một module mới **không** quay lại đọc
`biome.json`.

⚠ `biome.json` **KHÔNG nhận comment `//`**. Đuôi `.json` ở đây là nghĩa đen, không phải JSONC —
muốn ghi chú thì ghi ở tài liệu này.

---

## 5. Đa ngôn ngữ cắt ngang mọi tầng

Bốn chỗ chứa chuỗi, không trộn:

| Loại chuỗi | Ở đâu | Vì sao |
|---|---|---|
| Giao diện | `messages/{vi,en}.json` | `pnpm i18n:check` đối chiếu được |
| Nhãn của `@comitor/ui` | `lib/i18n/ui-labels.tsx` | vài nhãn là **hàm** (`range(start,end,total,unit)`), JSON không diễn đạt được; và chúng đi kèm phiên bản gói, không phải nội dung của app |
| Nội dung email | `lib/mail.ts`, `Record<Locale, …>` | ngôn ngữ ở đó là của **người nhận**, không phải của request; và email gửi được từ ngoài vòng đời request |
| `message` của lỗi API | tiếng Anh, ngay trong `lib/core/api-error.ts` | **bản dự phòng cho MÁY** — log, `curl`, client chưa có bảng dịch. Giao diện đọc `code` rồi tra `errors.*` |

Những cái bẫy sau đều đã gặp thật trong hệ Comitor:

- **⚠ KHOÁ CHỨA DẤU CHẤM KHÔNG BAO GIỜ TRA TỚI ĐƯỢC.** `next-intl` dùng dấu chấm làm dấu phân cấp
  namespace, nên `"task.view"` viết thẳng vào `messages/` tạo ra một khoá mà `t("perms.task.view")`
  đi tìm ở `perms → task → view` và không thấy. `messages/` giữ tên đã thay dấu chấm bằng gạch dưới;
  `toPermissionMessageKey()` làm phép đổi. `pnpm i18n:check` chặn khoá kiểu này.
  ⚠ Bản trước viết rằng nó ném `INVALID_KEY` lúc NẠP và làm hỏng mọi trang — **sai**, đã đo trên
  `use-intl` 4.14.1 ở cả hai bundle.
- **⚠ `t()` KHÔNG NÉM LỖI — và đó mới là vấn đề.** Đo được, cả dev lẫn production:

  | Cách hỏng | `t()` trả về | Có ném không |
  |---|---|---|
  | Khoá thiếu | chính tên khoá | không, chỉ `console.error` |
  | Khoá chứa dấu chấm | chính tên khoá | không |
  | Tham số ICU lệch (`{count}` ↔ `{total}`) | chính tên khoá | không |

  Nghĩa là **`pnpm build` xanh và khoá sót đi thẳng ra production**, hiện dưới dạng một chuỗi trông
  như nhãn kỹ thuật, chỉ với người dùng đang xem đúng ngôn ngữ đó. Lưới ở `i18n/request.ts` bọc nó
  thành `⟦namespace.key⟧` cho nhìn thấy được và in `[i18n] KHOÁ HỎNG` cho grep được — nhưng **cổng
  thật là `pnpm i18n:check`**, lưới không chặn.
  Khoá **động** (mã lỗi, mã quyền) vẫn phải đi qua `t.has()`: không phải để tránh ném, mà để nơi
  gọi tự chọn câu dự phòng thay vì in `⟦…⟧` cho người dùng. Chỗ làm mẫu là `useErrorMessage()`.
- **Hàm thuần trả chuỗi hiển thị là chỗ rò rỉ ngôn ngữ kín nhất** — xem §3 tầng 1.
- **`app/global-error.tsx` KHÔNG có provider nào** (nó thay thế cả `<html>` khi chính root layout
  hỏng). Chuỗi ở đó phải là hằng tiếng Anh trần. Đó là ngoại lệ DUY NHẤT của quy tắc "mọi chuỗi hiển
  thị đều qua i18n".
- **Markdown trong `messages/`** — `next-intl` chỉ hiểu THẺ ICU, nên `**đậm**` hiện ra là hai dấu
  sao giữa màn hình. Đã xảy ra ở `settings.notYetActive`; muốn in đậm thì viết `<strong>…</strong>`
  rồi nối vào một hàm qua `t.rich`. `pnpm i18n:check` chặn.
- **`<>t("x")</>` thiếu cặp `{}`** — in ra NGUYÊN VĂN `t("x")`, và `tsc`, Biome lẫn phép so hai file
  JSON đều thấy hợp lệ. Đã lọt vào `/settings/advanced`, chỉ bị bắt khi có người ĐỌC CHỮ trên màn
  hình. `pnpm i18n:check` chặn.
- **`<RelativeTime>` thiếu `locale`** — gói mặc định TIẾNG VIỆT, nên mốc thời gian nói tiếng Việt
  giữa giao diện tiếng Anh. Đo ở `/tasks/[taskId]`; khuôn đúng ở
  `app/(shell)/tasks/[taskId]/updated-at.tsx`. `pnpm i18n:check` chặn.

⚠ Đừng đọc danh sách trên như một danh sách ĐÓNG: phần có cổng canh được khai ở khối comment đầu
`scripts/check-messages.ts`, mỗi phép kiểm ở đó là một cách hỏng đã lường trước, và số phép kiểm
đếm được bằng `grep -c '^ \*   [0-9]\.' scripts/check-messages.ts`. Hai cái ở trên KHÔNG có cổng
nào canh: hàm thuần trả chuỗi (chỉ phần nằm trong `lib/core/` mới do `pnpm core:check` bắt) và
`app/global-error.tsx`.

**Thêm một ngôn ngữ — hai chỗ làm bằng tay**, rồi TypeScript tự liệt kê phần còn lại:

1. `LOCALES` + `LOCALE_LABELS` trong `lib/i18n/config.ts`;
2. `messages/<mã>.json`.

Sau đó **danh sách lỗi của `pnpm typecheck` CHÍNH LÀ danh sách việc còn lại**: mọi bảng
`Record<Locale, …>` trong repo báo đỏ cho tới khi điền xong. Đừng ghim danh sách file vào tài liệu
này rồi tin nó — đếm lại:
`grep -rl "Record<Locale" lib app components hooks --include='*.ts' --include='*.tsx'`

⚠ Bản trước ghi "đúng ba chỗ, rồi TypeScript tự chỉ chỗ thứ tư và thứ năm" và chỉ kể
`lib/i18n/ui-labels.tsx` với `lib/mail.ts`. Đếm thiếu, và ba nhóm bên dưới hỏng ba kiểu khác nhau —
đáng biết TRƯỚC khi `tsc` chỉ:

· `lib/i18n/ui-labels.tsx` + `lib/mail.ts` — thiếu thì giao diện vẫn CHẠY, chỉ là nửa Việt nửa Anh,
  và email đi ra sai thứ tiếng. Đó là chủ ý.
· `lib/i18n/messages.ts` (`LOADERS`) — thiếu thì `messages/<mã>.json` vừa tạo ở bước 2 **không bao
  giờ được nạp**.
· `lib/format.ts` (`DATE_FORMAT_OPTIONS`, `INTL_LOCALES`) — thiếu thì ngày tháng và mã BCP-47 không
  có khuôn cho ngôn ngữ mới.

Rồi `pnpm i18n:check && pnpm typecheck`.

---

## 6. Kiểm thử — bốn tầng, và chúng không thay thế nhau

| Tầng | Công cụ | Phủ | Trạng thái |
|---|---|---|---|
| Lõi thuần | `vitest` | `lib/core/**` | **đã có** — ngưỡng coverage 90%. Ngưỡng đo ĐỘ PHỦ, không đo "mỗi module một file test" — xem §3 tầng 1 |
| Ranh giới chuỗi | `pnpm core:check` | `lib/core/**` | **đã có** |
| Bộ chuỗi | `pnpm i18n:check` | KHÔNG chỉ `messages/**`: có phép QUÉT `.tsx` dưới `app/`, `components/`, `hooks/`, và phép SUY khoá từ các bảng khai. Danh sách đầy đủ ở đầu `scripts/check-messages.ts` | **đã có** |
| Biên dịch + route | `pnpm build` | cả repo | **đã có** |
| Giao diện đầu-cuối | Playwright | luồng người dùng | **chưa** — xem dưới |

⚠ **Bản trước ghi Phủ của `pnpm i18n:check` là `messages/**`, và sai theo hướng đắt.** Có phép kiểm
ĐỌC MÃ NGUỒN, nên sửa một file `.tsx` LÀM ĐỎ được cổng này. Tin bản cũ là bỏ qua đúng hai phép kiểm
dựng ra để bắt lỗi trong `.tsx`: `t("…")` thiếu `{}` và `<RelativeTime>` thiếu `locale` — xem §5.

**Vì sao chưa có Playwright, và khi nào nên thêm.** Bàn giao một bộ e2e chưa ai chạy là bàn giao một
thứ sẽ đỏ vì lý do không liên quan rồi bị tắt. Khi module có luồng ghi thật đầu tiên mà người dùng
phụ thuộc vào (ở đây: tạo công việc), đó là lúc viết test đầu tiên — và viết đúng một cái: *tạo một
việc, thấy nó trong bảng*. Hình dạng đầy đủ ở tài liệu gốc §10.

**Vì sao KHÔNG viết unit test cho route handler và component.** Mock Prisma thì test sẽ XANH với
những giả định mà database thật không chia sẻ — và một bộ test xanh sai còn tệ hơn không có test, vì
nó mua được sự tự tin mà không mua được sự đúng.

**Đối chứng âm tính là luật của repo này, áp cho cả test.** Một bộ kiểm không từ chối được thứ cần
từ chối thì chưa chứng minh gì cả. Ví dụ có thật ở đây: `csp.test.ts` kiểm rằng `style-src` **không**
mang nonce; `permissions.test.ts` kiểm rằng một ma trận mâu thuẫn **bị sửa lại**.

---

## 7. Checklist — dán vào đầu mỗi lần viết mã

**Trước khi viết một màn hình mới:**

1. Màn này cần **phản ứng theo thời gian thực / tương tác** không?
   → Không: Server Component lấy dữ liệu, truyền prop, **dừng ở đây**. Không store, không hook.
2. Có **quyết định nghiệp vụ** nào không (đúng/sai, được/không, xếp hạng, định dạng)?
   → Có: viết **hàm thuần trong `lib/core/` trước**, kèm unit test, **rồi** mới viết giao diện.
3. State có thoả **một trong bốn điều** ở §3 tầng 3 không?
   → Không: `useState` hoặc `searchParams`. Có: dựng store, và ghi rõ điều nào trong PR.
4. Có gọi ra ngoài không? → **luôn** qua `lib/api-client/`, không bao giờ `fetch()` trong component.
5. Đã có đủ **bốn trạng thái** chưa: đang tải · rỗng · lỗi · có dữ liệu?
   → Và **hai câu rỗng, không phải một**: "chưa có dữ liệu nào" khác "lọc không ra kết quả".
6. Thao tác GHI đã đi qua `requirePermission()` ở route handler chưa?
7. Route có nhận **định danh TỪ URL** không?
   → Có: truy vấn phải là `findFirst({ where: { workspaceId, id } })`, và bản ghi của workspace
   khác trả **404, KHÔNG phải 403**. `pnpm tenant:check` canh vế đầu; vế sau là một quyết định về
   MÃ LỖI mà không cổng nào canh được — 403 xác nhận rằng bản ghi đó tồn tại, và với id đoán được
   thì đó là một đường liệt kê dữ liệu của khách hàng khác. Bản mẫu ở
   `app/api/tasks/[taskId]/route.ts`.
   → `pnpm api:check` canh câu này, nhưng nó chỉ hỏi "có gọi không", không hỏi "có gọi ĐÚNG quyền
   không". Phần thứ hai vẫn là việc của người viết.

**Trước khi mở PR — sáu câu, trả lời được hết mới gửi.** Sáu ô này cũng nằm trong
`.github/pull_request_template.md` nên chúng tự hiện ra lúc mở PR; sửa một chỗ thì sửa cả hai.

```
[ ] Không có phép tính nghiệp vụ nào trong file .tsx
[ ] Không có chuỗi hiển thị nào ngoài messages/*.json
[ ] Không có hàm nào trong lib/core/ trả về chuỗi hiển thị
[ ] Nhánh hỏng có test, không chỉ nhánh thành công
[ ] Đã đi thật một vòng ở CẢ vi và en, ở CẢ hai theme, ở 1280px và 375px
[ ] Thao tác ghi mới đã có chốt quyền ở máy chủ, không chỉ ẩn nút
```

```bash
pnpm check   # lint + typecheck + i18n:check + core:check + tenant:check + api:check + color:check + version:check + test + build
```

---

## 8. Cạm bẫy của chính kiến trúc này

- **Server Component `import` một hook là lỗi lúc CHẠY, không phải lúc build.** Thông điệp nói về
  "hooks can only be called inside a function component" và không nói gì về file nào.
- **`cache()` của React chỉ gộp trong MỘT request.** Nó không thay được cache theo thời gian. Khi
  `lib/account/directory.ts` gọi Comitor.Account thật, `cache()` cứu được việc gọi bốn lần trong một
  trang, nhưng không cứu được việc gọi ở mọi trang — chỗ đó cần cache 30–60 giây, và cần webhook để
  bù độ trễ.
- **Một hàm thuần trả `undefined` vì `noUncheckedIndexedAccess` là tính năng, không phải phiền
  phức.** Chữa bằng `!` là bỏ đi đúng cái phép kiểm vừa tìm ra một ca biên chưa xử lý.
- **Tầng 2 gọi đường dẫn TƯƠNG ĐỐI (`/api/…`)**, nên nó vô nghĩa ở phía máy chủ. `client-only` biến
  việc import nhầm thành lỗi biên dịch — đừng gỡ nó ra "cho tiện" khi viết một script.

---

## 9. Bản này khác `comitor-account` ở đâu

| | `comitor-account` | Module này |
|---|---|---|
| Sáu tầng, bảng CẤM ở §2 | ✔ | ✔ giống hệt |
| Lõi thuần không trả chuỗi hiển thị | ✔ | ✔ giống hệt |
| Quy ước đặt tên, đa ngôn ngữ | ✔ | ✔ giống hệt |
| `lib/catalog/` | không có | **có** — module nhiều bảng khai giao diện hơn |
| `lib/auth.ts`, `better-auth/*` | có | **tuyệt đối không** — đi qua `@comitor/account-sdk` |
| `verify/kc*.ts` | có (kiểm chứng OIDC) | không áp dụng |
| Bộ chọn API + API giả | tài liệu gốc §8 | **chưa dựng** — xem dưới |
| Store | 2 store | **0 store**, và đó là câu trả lời đúng |

### Điều quan trọng nhất

> ⚠ **Không app nào ngoài `comitor-account` được import `better-auth/*`.** App khách đi qua
> `@comitor/account-sdk`. Đó là lớp cách ly nuốt mọi hành vi ngầm của tầng OIDC, và cũng là thứ cho
> phép đổi sang thư viện OIDC khác sau này mà không sửa app nào.

Ranh giới nghiệp vụ thì không đổi và không thương lượng: Account trả lời **ba câu** — *bạn là ai*,
*bạn thuộc workspace nào với vai trò thô gì*, *workspace đó dùng app nào*. Mọi câu khác là của
module, và dữ liệu nằm ở database của module.

### Bộ chọn API và API giả — chưa dựng, và vì sao

Tài liệu gốc §8 mô tả một cơ chế đổi giữa API thật và một bản giả chạy trên `localStorage`, bật bằng
`NEXT_PUBLIC_ENABLE_FAKE_API` + cookie `comitor-api-mode`. Nó đáng giá ở `comitor-account` vì ở đó
việc dựng trạng thái hiếm rất đắt (workspace hết chỗ ngồi, gói quá hạn, chủ sở hữu cuối cùng).

Module này **chưa dựng nó**, có chủ đích: `pnpm seed` chạy trong một giây và dựng lại được mọi
trạng thái mà giao diện cần. Cái giá của một tầng giả — hai bản cài đặt cho một hợp đồng, cộng ba
chốt để nó không bao giờ chạm production — chưa được mua bởi lợi ích nào.

Khi nào thì đáng dựng: khi module có một trạng thái mà seed **không** dựng được rẻ (một luồng nhiều
bước dở dang, một cuộc đua), hoặc khi cần chạy giao diện mà không có Postgres. Lúc đó đọc tài liệu
gốc §8 và làm đủ **ba chốt** ở §8.6 — đặc biệt là chốt số 1, và **phải kiểm nó bằng `grep` trên
`.next/` một lần**: "dynamic import ⇒ chắc chắn bị loại khỏi bundle" là một giả định, không phải một
bảo đảm.

---

## Tài liệu liên quan

| File | Nội dung |
|---|---|
| [../AGENTS.md](../AGENTS.md) | Quy ước bắt buộc giữ + cạm bẫy đã gặp thật |
| [../README.md](../README.md) | App này là gì, chạy thế nào, bản đồ route |
| [../CLAUDE.md](../CLAUDE.md) | Phần riêng cho Claude Code: preview, vòng kiểm chứng |
| `../comitor-account/docs/kien-truc-ung-dung.md` | Bản gốc, đầy đủ hơn (§8 API giả, §10 Playwright) |
| `../comitor-account/packages/account-sdk/README.md` | Tích hợp xác thực — bảy hành vi ngầm SDK nuốt hộ |
