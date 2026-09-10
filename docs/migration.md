# Đổi lược đồ database

Tài liệu này chỉ ghi những gì **không suy được từ mã**. Cách chạy Prisma thì đọc tài liệu của
Prisma; cái ở đây là những quyết định đã được chốt cho mọi module Comitor, và những chỗ đã hỏng
thật.

> **Đọc kèm:** khối chú thích đầu [`../prisma/schema.prisma`](../prisma/schema.prisma) (ranh giới
> Account / app, và luật `workspaceId`), và [`kien-truc-ung-dung.md`](kien-truc-ung-dung.md) §2
> hàng D.

---

## 1. Ba lệnh, và chỉ một trong ba dùng được ở production

| Lệnh | Ở đâu | Làm gì |
|---|---|---|
| `pnpm db:migrate` | **CHỈ máy phát triển** | `prisma migrate dev` — sinh file migration mới từ chênh lệch giữa `schema.prisma` và thư mục `migrations/`, rồi áp nó |
| `pnpm db:deploy` | **Production, staging, CI** | `prisma migrate deploy` — áp những migration CHƯA áp, không sinh gì, không hỏi gì |
| `pnpm db:check` | CI | Không đụng dữ liệu: hỏi *"`schema.prisma` có đi trước thư mục `migrations/` không?"* |

⚠ **`pnpm db:migrate` KHÔNG tự reset database** — bản trước của mục này nói ngược lại, và cái sai
đó dạy người đọc sợ nhầm lệnh. Đã đo trên Prisma 6.19.3, trên một database vứt đi: khi lịch sử
migration trên đĩa lệch với lịch sử đã áp, `prisma migrate dev` in ra chênh lệch, nói *"You may use
`prisma migrate reset` to drop the development database"*, rồi **thoát 130** — 11 bảng còn nguyên
11 bảng. Không có prompt y/N nào để lỡ tay bấm: chuỗi `Do you want to continue` xuất hiện **0 lần**
trong CLI.

Nguy hiểm nằm ở lệnh nó GỢI Ý — `prisma migrate reset` — và `pnpm db:migrate` không chạy lệnh đó.
Hai lệnh vẫn có hai tên khác nhau chứ không phải một lệnh với một cờ, nhưng vì lý do khác: `migrate
dev` SINH migration nên cần một shadow database (và cần quyền tạo database), còn `migrate deploy`
chỉ ÁP những gì đã có, không sinh gì, không hỏi gì.

⚠ Và từ khi `.env` trỏ được vào **RDS dev DÙNG CHUNG**, "database vứt đi được" không còn là mặc
định của máy phát triển. Đọc `DATABASE_URL` TRƯỚC khi gõ `prisma migrate reset`: schema bạn sắp
dựng lại có thể là của cả đội.

---

## 2. `pnpm db:check` — cổng cho lỗi "quên commit migration"

Sửa `schema.prisma`, chạy `pnpm db:migrate`, rồi commit mà **quên `prisma/migrations/`** là một lỗi
đi qua MỌI cổng khác:

- `prisma generate` chỉ đọc `schema.prisma` → client sinh ra đúng;
- `tsc`, lint, test, `next build` đều xanh;
- và trên máy người sửa thì ứng dụng chạy, vì `migrate dev` đã áp thay đổi vào database local rồi.

Nó nổ ở **máy đồng đội**, dạng `column "…" does not exist`, cách nguyên nhân vài ngày.

```bash
SHADOW_DATABASE_URL="postgresql://…/comitor_shadow" pnpm db:check
```

Lệnh dựng lại lược đồ từ thư mục `migrations/` vào một **shadow database**, so nó với
`schema.prisma`, và thoát khác 0 nếu có chênh lệch — kèm danh sách cột thiếu.

⚠ **Cố ý KHÔNG nằm trong `pnpm check`.** Nó cần một database, mà `pnpm check` chạy được **không cần
Docker** là một tính chất đáng giữ: cổng nào đòi hạ tầng thì cổng đó bị bỏ qua. `db:check` chạy ở
job CI thứ hai, job có `services: postgres` — xem [`../.github/workflows/check.yml`](../.github/workflows/check.yml).

Shadow database là một database **RIÊNG cho từng module**, và **bạn tạo nó TAY một lần** —
`db:check` chỉ NỐI vào, không tạo gì:

```bash
# hồ sơ docker
docker compose exec postgres psql -U comitor -d postgres -c 'CREATE DATABASE comitor_shadow;'
# hồ sơ RDS dùng chung — tên PHẢI mang slug của module
psql "postgresql://…@…rds.amazonaws.com:5433/postgres?sslmode=require" \
  -c 'CREATE DATABASE comitor_shadow_starter;'
```

⚠ **Bản trước của mục này viết *"Prisma tạo và xoá nó"* — SAI ở cả hai vế**, và câu đó còn tự mâu
thuẫn với vế "tạo tay một lần" đứng ngay sau nó. Đã đo trên Prisma 6.19.3, hồ sơ RDS: trỏ
`--shadow-database-url` vào một database chưa tồn tại thì `migrate diff` thoát với
`P1003 Database … does not exist` **kể cả khi role có `CREATEDB`**; và chạy xong thì shadow còn
nguyên mọi bảng vừa dựng. Cái Prisma CÓ làm là **dọn sạch shadow ở ĐẦU mỗi lần chạy**. Đừng tin
dòng này, tự đo lại:

```bash
SHADOW="$(node --env-file=.env -p 'process.env.SHADOW_DATABASE_URL')"
psql "$SHADOW" -c 'CREATE TABLE zzz_probe (id int);'
pnpm db:check; psql "$SHADOW" -c '\dt'   # zzz_probe biến mất, bảng của migrations/ còn nguyên
```

Nên tàn dư của lần trước KHÔNG sinh ra diff giả — luật "riêng từng module" đứng vì một lý do khác:
hai lần `db:check` chạy đồng thời trên cùng một shadow sẽ **wipe nhau giữa chừng**. Ràng buộc còn
lại của chuỗi kết nối (vì sao nó không mang `?schema=`, và cái diff GIẢ mà `?schema=` sinh ra) nằm
cạnh chính biến `SHADOW_DATABASE_URL` ở [`.env.example`](../.env.example) — đừng chép sang đây.

⚠ **Quyền `CREATEDB` không phải yêu cầu của `db:check`**; nó chỉ cần đúng một lần, cho người gõ
`CREATE DATABASE` ở trên. Chỗ Prisma thật sự đòi nó là `prisma migrate dev` (§1):
`prisma/schema.prisma` không khai `shadowDatabaseUrl`, nên `migrate dev` **tự dựng** một database
tạm của riêng nó, và nó KHÔNG đọc `SHADOW_DATABASE_URL`.

---

## 3. Luật: mọi migration phải tương thích ngược MỘT bản

**Prisma không có `migrate down`.** Không có lệnh hoàn tác, và sẽ không có. Rollback trong thực tế
là *khôi phục từ bản sao lưu*, tức là chấp nhận mất dữ liệu ghi trong khoảng thời gian đó.

Hệ quả là một luật về cách VIẾT lược đồ, không phải một luật về cách deploy:

> Mã bản **N** và mã bản **N+1** phải cùng chạy được trên lược đồ của bản **N+1**.

Vì sao bắt buộc, kể cả với một module chỉ có một instance: `prisma migrate deploy` chạy **trước**
khi mã mới lên (xem §5), nên luôn có một khoảng — vài giây tới vài phút — mà **mã cũ đang chạy trên
lược đồ mới**. Nếu migration vừa xoá một cột mà mã cũ còn **gọi tên** (đường ĐỌC hay đường GHI đều
tính — xem §4 bước 3), khoảng đó là một sự cố.

Ba việc **không bao giờ** làm trong một migration:

| Đừng | Vì |
|---|---|
| `DROP COLUMN` / `DROP TABLE` cùng lúc với bản phát hành thôi dùng nó | Mã cũ còn sống trong lúc rollout |
| `ALTER COLUMN … SET NOT NULL` mà không có `DEFAULT` và không backfill trước | Mọi `INSERT` của mã cũ hỏng ngay |
| Đổi tên cột bằng `RENAME` | Đó là DROP + ADD dưới mắt mã cũ |

---

## 4. Công thức: mở rộng → backfill → thu hẹp

Bốn bản phát hành, ba migration. Ví dụ dưới đây là **minh hoạ, chưa áp vào repo này** — nó dựng lại
một thay đổi có thật mà mọi module sẽ gặp: đổi tên `tasks.summary` thành `tasks.description`.

> Vì sao không để lại một migration mẫu ĐÃ ÁP cho ví dụ NÀY: nó sẽ là một cột không ai dùng, và
> starter đã có luật *"con số nào suy được thì suy, đừng thêm cột"*. Ba khối SQL dưới đây chép
> được nguyên văn, đó là phần có giá trị.
>
> **Nhưng bước 3 thì ĐÃ CÓ BẢN THẬT trong repo**, và nó mang được thứ SQL không dạy nổi:
> [`prisma/migrations/20260905155309_bo_bon_cot_cai_dat_chet/migration.sql`](../prisma/migrations/20260905155309_bo_bon_cot_cai_dat_chet/migration.sql)
> (v0.8.1) bỏ bốn cột `app_settings` đã chết từ v0.7.0. Đọc **header** của nó: nó liệt kê đủ những
> chỗ mã cũ phải thôi gọi tên cột TRƯỚC khi chạy, và dữ liệu mất gì. Còn *vì sao nó tách khỏi bản
> phát hành trước chứ không gộp* thì ở mục `v0.8.1` của [CHANGELOG.md](../CHANGELOG.md).

### Bước 1 · Mở rộng — thêm cái mới, giữ cái cũ

```sql
-- migrations/2026xxxxxxxxxx_task_description_expand/migration.sql
ALTER TABLE "tasks" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
```

Trong bản phát hành này, mã **ghi cả hai cột** và **đọc cột cũ**. Không cột nào bị xoá, không ràng
buộc nào chặt hơn, nên mã cũ vẫn chạy nguyên.

### Bước 2 · Backfill — chép dữ liệu, vẫn chưa xoá gì

```sql
-- migrations/2026xxxxxxxxxx_task_description_backfill/migration.sql
UPDATE "tasks" SET "description" = "summary" WHERE "description" = '';
```

⚠ Bảng lớn thì chia lô (`WHERE id IN (SELECT id … LIMIT 10000)`, lặp lại): một `UPDATE` quét toàn
bảng giữ khoá ghi đủ lâu để làm treo cả ứng dụng, và đó là kiểu sự cố chỉ xảy ra ở production vì
chỉ ở đó bảng mới đủ lớn.

Bản phát hành này **đọc cột mới**, vẫn ghi cả hai.

### Bước 2b · Thôi ghi cột cũ — KHÔNG có migration

Bản phát hành này chỉ đọc và ghi cột **mới**, và không đụng lược đồ. Nó không có SQL nào nên rất dễ
bị gộp vào bước 3 cho gọn — đừng: `db:deploy` chạy TRƯỚC khi mã mới lên (§5), nên bỏ bản này thì
lúc `DROP COLUMN` chạy, mã đang sống vẫn là mã bước 2, tức mã còn ghi cột cũ.

### Bước 3 · Thu hẹp — xoá cái cũ

```sql
-- migrations/2026xxxxxxxxxx_task_description_contract/migration.sql
ALTER TABLE "tasks" DROP COLUMN "summary";
```

Chỉ chạy khi **không phiên bản nào đang chạy còn GỌI TÊN cột cũ trong bất kỳ câu SQL nào Prisma
sinh ra** — đường GHI cũng tính, không riêng đường ĐỌC. Với một module có nhiều instance thì "không
còn" nghĩa là rollout của bước 2b đã xong hoàn toàn, không phải "đã bắt đầu".

⚠ **Prisma không sinh `SELECT *`: mặc định nó liệt kê TỪNG cột vô hướng của model** — ở mọi truy vấn
không có `select`, kể cả truy vấn GHI, vì `create`/`update`/`delete`/`upsert` TRẢ VỀ bản ghi nên
chúng mang một `RETURNING` liệt kê đủ. Nên "thôi ĐỌC cột" chưa đủ: chừng nào còn một lời gọi Prisma
chạm model đó mà không thu hẹp bằng `select`, câu SQL vẫn nêu tên cột đã bỏ và vẫn đổ. Đừng soát
bằng mắt, hãy ĐO — bật log query rồi đi hết những đường chạm model đó:

```ts
const prisma = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
prisma.$on("query", (e) => console.log("SQL>", e.query));
```

Ca đã gặp thật ở repo này cũng là ca dễ sót nhất: `saveAppSettings` có `create`/`update` chỉ nêu
những cột thực sự ghi nên INSERT và UPDATE đã sạch, nhưng `upsert` trả về bản ghi — bỏ
`select: { workspaceId: true }` đi thì `RETURNING` vẫn gọi tên bốn cột mồ côi, và
`PUT /api/settings` đổ ngay sau migration dù đường ĐỌC đã được chặn. Xem `lib/settings.ts`, mục
`v0.8.1` của [CHANGELOG.md](../CHANGELOG.md), và header của
`20260905155309_bo_bon_cot_cai_dat_chet`.

**Prisma sinh ra bước 1 và bước 3 cho bạn** (`pnpm db:migrate` sau khi sửa `schema.prisma`). Bước 2
phải viết tay: sinh một migration rỗng rồi tự điền SQL —

```bash
pnpm exec prisma migrate dev --create-only --name task_description_backfill
```

---

## 5. Ở production

```
1. pnpm db:deploy        ← BƯỚC RIÊNG, chạy MỘT lần, TRƯỚC khi rollout mã mới
2. rollout mã mới
```

⚠ **Tuyệt đối không đặt `prisma migrate deploy` vào `CMD` của container.** N instance khởi động
song song là N tiến trình cùng áp cùng một migration; Prisma có khoá tư vấn nhưng các instance thua
sẽ chờ, rồi health check hết giờ, rồi orchestrator giết chúng — một vòng lặp khởi động mà nguyên
nhân không hiện ra ở bất kỳ log nào của ứng dụng. Migration là một **job**, không phải một bước
khởi động.

⚠ **Mỗi module một schema, hoặc một database riêng.** Prisma đặt bảng lịch sử `_prisma_migrations`
theo schema trong connection string. Hai module Comitor cùng trỏ vào `?schema=public` của một
database sẽ **dùng chung một bảng lịch sử** — và khi đó `migrate deploy` của module này thấy
migration của module kia là "chưa áp". Ở máy phát triển thì mỗi module có Postgres riêng theo
[bảng cấp phát cổng](../docker-compose.yml) nên chuyện này không xảy ra — **nhưng CHỈ ở hồ sơ
docker**. Ở hồ sơ RDS dùng chung (xem [README §Hai hồ sơ hạ tầng](../README.md#hai-hồ-sơ-hạ-tầng-chọn-một))
mọi module dùng CHUNG một RDS dev và tách nhau chỉ bằng `?schema=<slug>`, nên tình huống này xảy ra
ngay ở máy phát triển. Ở production thì phải khai tường minh.

---

## 6. Sao lưu

Migration thu hẹp (bước 3) là điểm không quay lại được. Trước khi chạy nó ở production:

- sao lưu **database**, và
- sao lưu **bucket** — module lưu KHOÁ object trong database chứ không lưu tệp. Khôi phục database
  về một mốc cũ mà không khôi phục bucket theo để lại `attachment_key` trỏ vào những object không
  còn, và ngược lại để lại object mồ côi không ai xoá. Hai kho phải được chụp cùng một mốc.
