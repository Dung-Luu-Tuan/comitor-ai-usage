/**
 * Chặn một truy vấn chọn hàng mà không lọc theo `workspaceId`.
 *
 * ── VÌ SAO ĐÂY LÀ CỔNG QUAN TRỌNG NHẤT TRONG REPO ─────────────────────────────────────────
 * Vì nó canh lớp lỗi DUY NHẤT mà hậu quả không sửa được sau: dữ liệu của khách hàng A đã hiện
 * trên màn hình khách hàng B. Mọi lỗi khác đều vá được bằng một bản phát hành; lỗi này thì không
 * — thông tin đã ra khỏi tay rồi.
 *
 * Dòng đầu `prisma/schema.prisma` đã phát biểu luật: *"Mọi bảng đều có `workspaceId`… thiếu cột đó
 * ở một bảng là dữ liệu của khách hàng này rò sang khách hàng khác."* Và cho tới cổng này, luật đó
 * **không có gì canh**. Hôm nay mọi truy vấn đều đúng — nhưng đổi một dòng ở `lib/tasks.ts` từ
 * `findFirst({ where: { workspaceId, id } })` sang `findUnique({ where: { id } })` thì `tsc`,
 * Biome, `pnpm test` và `pnpm build` đều xanh.
 *
 * ⚠ Và module thứ hai **không chép** `lib/tasks.ts` — nó VIẾT LẠI theo mô hình của mình. Thứ duy
 * nhất nó thừa hưởng là một câu trong tài liệu, mà một câu trong tài liệu không chặn được gì. Cổng
 * này thì đi theo.
 *
 * ── HAI PHÉP KIỂM, VÀ PHÉP THỨ NHẤT MỚI LÀ PHÉP QUAN TRỌNG ────────────────────────────────
 *  1. **Lược đồ**: mọi model trong `schema.prisma` phải hoặc CÓ `workspaceId`, hoặc nằm trong
 *     `UNSCOPED_MODELS` bên dưới kèm lý do. Một bảng mới thiếu cột đó là lỗ hổng ở dạng gốc nhất —
 *     bắt ở đây thì không truy vấn nào có cơ hội sai.
 *  2. **Truy vấn**: mọi lời gọi Prisma CHỌN HÀNG trên một model có `workspaceId` phải nhắc tới
 *     `workspaceId` trong đối số.
 *
 * Danh sách model suy từ **DMMF** (`Prisma.dmmf.datamodel.models`), không viết tay. Viết tay thì
 * bảng thứ tám của module sau không có trong danh sách, và cổng im lặng bỏ qua đúng bảng mới nhất
 * — kiểu hỏng tệ nhất một cổng có thể mắc.
 *
 * ── PHÉP KIỂM PHẢI CHẤP NHẬN BA HÌNH DẠNG ĐANG DÙNG THẬT ──────────────────────────────────
 * Nếu không thì nó báo đỏ mã đang ĐÚNG, và một cổng báo đỏ nhầm là một cổng sẽ bị gỡ:
 *
 *     where: { workspaceId }                                   lib/tasks.ts
 *     where: { workspaceId_userId: { workspaceId, userId } }    lib/task-drafts.ts — khoá kép lồng
 *     where: { task: { workspaceId: WORKSPACE_ID } }            scripts/seed.ts — lọc qua quan hệ
 *
 * Vì vậy phép kiểm là "chuỗi `workspaceId` có xuất hiện trong đối số của lời gọi không", chứ không
 * phải một phép so khớp cấu trúc. Thô, nhưng đúng hướng: nó không bao giờ báo đỏ mã đúng, và nó
 * bắt được đúng ca đã nêu ở trên.
 *
 * ── VÌ SAO KHÔNG DÙNG PRISMA CLIENT EXTENSION ─────────────────────────────────────────────
 * Một extension kiểm `where.workspaceId` lúc chạy nghe chặt hơn, nhưng nó nằm TRÊN ĐƯỜNG CHẠY
 * THẬT và sẽ ném nhầm ở đúng ba hình dạng vừa kể (khoá kép lồng và lọc qua quan hệ đều không có
 * `where.workspaceId` ở tầng một). Một lưới chắn ném nhầm trong production là một lưới chắn sẽ bị
 * gỡ trong hoảng loạn. Kiểm tĩnh không có rủi ro đó.
 *
 * ── VÌ SAO `create`/`createMany` NẰM NGOÀI PHẠM VI ────────────────────────────────────────
 * Chúng không có `where` nên không CHỌN hàng nào — chúng không rò được gì. Ghi sai `workspaceId`
 * lúc tạo là một lỗi khác (ghi nhầm nhà), hiếm hơn nhiều vì giá trị luôn đến từ phiên, và bắt nó
 * bằng phép kiểm văn bản thì báo đỏ nhầm ngay: `createMany({ data: rows })` ở
 * `lib/permissions.ts` dựng `rows` ở trên, đúng và không thể đọc bằng regex.
 *
 * Chạy: `pnpm tenant:check`
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { stripComments } from "./strip-comments";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_DIRS = ["lib", "app", "scripts"];

/**
 * Model KHÔNG có `workspaceId`, và vì sao điều đó đúng.
 *
 * ⚠ Đây là chỗ DUY NHẤT trong repo được phép nói "bảng này không cần `workspaceId`". Thêm một
 * dòng vào đây là một quyết định, không phải một thao tác dọn dẹp — hãy viết lý do như thể người
 * đọc nó là người sẽ phải bảo vệ quyết định đó trước một sự cố rò dữ liệu.
 */
const UNSCOPED_MODELS: Record<string, string> = {
  TaskWatcher:
    "Hàng chỉ tới được QUA `Task`, và `Task` thì có `workspaceId`. Không truy vấn nào lấy watcher " +
    "mà không đi qua một công việc đã được lọc — xem khối chú thích trên model trong schema.prisma.",
  AccountSession:
    "Không phải dữ liệu khách hàng mà là trạng thái xác thực của MỘT người, và hàng ra đời TRƯỚC " +
    "khi biết người đó sẽ mở không gian làm việc nào. Workspace đang chọn nằm trong `payload`.",
  WebhookEvent:
    "Dấu vết của một lần GIAO NHẬN giữa Account và module, không phải dữ liệu khách hàng. Một sự " +
    "kiện có thể nói về nhiều workspace, hoặc không về workspace nào (`user.deleted`). Khoá chính " +
    "là `payload.id` do Account cấp — nó chính là thứ chống trùng."
};

/** Thao tác CHỌN HÀNG. `create`/`createMany` cố ý không có ở đây — xem khối chú thích đầu file. */
const SELECTING_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
  "count",
  "aggregate",
  "groupBy"
]);

/** Miễn trừ cho MỘT lời gọi, ghi ngay trên nó. Lý do rỗng không được tính. */
const SCOPE_DIRECTIVE = /@tenant-scope:\s*\S/;

/** `prisma.task.findMany(` và `tx.task.findMany(` — giao dịch tương tác dùng `tx`. */
const CALL = /\b(?:prisma|tx)\.(\w+)\.(\w+)\(/g;

/** Cắt lấy đối số của lời gọi bắt đầu ở `open` (chỉ số của dấu `(`), khớp ngoặc và bỏ qua chuỗi. */
function callArguments(source: string, open: number): string {
  let depth = 0;
  let quote: string | null = null;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index] ?? "";

    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ")" || char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  return source.slice(open);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/* ── Phép kiểm 1 · Lược đồ ─────────────────────────────────────────────────────────────── */

const problems: string[] = [];
/** Tên thuộc tính trên client (`task`) → tên model (`Task`), chỉ cho model CÓ `workspaceId`. */
const scopedModels = new Map<string, string>();

/**
 * ⚠ `Prisma.dmmf` chỉ có sau `prisma generate`. Trên một bản sao mới, `pnpm install` chạy generate
 * qua postinstall của Prisma — nhưng nếu vì lý do nào đó nó chưa chạy thì lỗi mặc định của Prisma
 * nói về "client did not initialize", một câu không gợi gì tới cổng này.
 */
const models = Prisma.dmmf?.datamodel?.models;
if (!models) {
  console.error("✗ Chưa có Prisma Client. Chạy `pnpm db:generate` rồi thử lại.\n");
  process.exit(1);
}

for (const model of models) {
  const property = model.name[0]?.toLowerCase() + model.name.slice(1);
  if (model.fields.some((field) => field.name === "workspaceId")) {
    scopedModels.set(property, model.name);
    continue;
  }
  if (!UNSCOPED_MODELS[model.name]) {
    problems.push(`prisma/schema.prisma — model ${model.name} không có workspaceId và không có lý do nào được ghi`);
  }
}

/** Lý do cho một model đã bị xoá là một lời giải thích cho thứ không tồn tại. */
const modelNames = new Set(models.map((model) => model.name));
for (const name of Object.keys(UNSCOPED_MODELS)) {
  if (!modelNames.has(name)) {
    problems.push(`scripts/check-tenant-scope.ts — UNSCOPED_MODELS còn ${name}, model đó không còn trong lược đồ`);
  }
}

/* ── Phép kiểm 2 · Truy vấn ────────────────────────────────────────────────────────────── */

const exempted: string[] = [];
let scanned = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const raw = readFileSync(file, "utf8");
    if (!raw.includes("prisma.") && !raw.includes("tx.")) continue;

    const source = stripComments(raw);
    const rawLines = raw.split("\n");

    for (const match of source.matchAll(CALL)) {
      const [full, property = "", operation = ""] = match;
      const model = scopedModels.get(property);
      if (!model || !SELECTING_OPS.has(operation)) continue;

      scanned += 1;
      const open = (match.index ?? 0) + full.length - 1;
      if (callArguments(source, open).includes("workspaceId")) continue;

      const line = source.slice(0, match.index).split("\n").length;
      const where = `${relative(ROOT, file)}:${line}`;
      const before = rawLines.slice(Math.max(0, line - 6), line).join("\n");

      if (SCOPE_DIRECTIVE.test(before)) {
        exempted.push(`${where} — ${property}.${operation}()`);
        continue;
      }
      problems.push(`${where} — ${property}.${operation}() không lọc theo workspaceId`);
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} chỗ phá bất biến workspaceId:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\n  Mọi truy vấn CHỌN HÀNG phải lọc theo workspaceId — kể cả update/delete/upsert/count.\n" +
      "  Một chỗ sót là dữ liệu của khách hàng này rò sang khách hàng khác, và hạng lỗi đó\n" +
      "  KHÔNG sửa được sau. Bản ghi của workspace khác trả 404, không trả 403.\n" +
      "  Bảng thật sự không thuộc về một không gian làm việc thì ghi lý do vào UNSCOPED_MODELS\n" +
      "  ở scripts/check-tenant-scope.ts; một lời gọi lẻ thì ghi `// @tenant-scope: <lý do>`\n" +
      "  ngay trên nó.\n" +
      "  Xem prisma/schema.prisma (khối đầu file) và docs/kien-truc-ung-dung.md §2.\n"
  );
  process.exit(1);
}

const summary = `✓ ${scanned} truy vấn chọn hàng trên ${scopedModels.size} bảng có workspaceId, tất cả đều lọc đúng.`;
console.info(exempted.length === 0 ? summary : `${summary} ${exempted.length} lời gọi được miễn trừ:`);
for (const note of exempted) console.info(`  · ${note}`);
