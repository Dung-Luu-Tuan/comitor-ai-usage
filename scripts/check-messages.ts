/**
 * Đối chiếu các file trong `messages/` với nhau.
 *
 * VÌ SAO CẦN: kiểu của `next-intl` (xem `i18n/types.d.ts`) dựng từ ĐÚNG MỘT file — `vi.json`. Nó
 * bắt được khoá sai chính tả ở nơi GỌI, nhưng hoàn toàn không thấy `en.json` thiếu khoá nào: bản
 * thiếu chỉ lộ ra lúc chạy, dưới dạng một chuỗi khoá thô (`tasks.table.emptyFiltered`) hiện giữa
 * màn hình, và chỉ với người dùng đang xem đúng ngôn ngữ đó. Trên máy lập trình viên — mặc định
 * tiếng Việt — nó không bao giờ lộ ra.
 *
 * ⚠ Và **`next-intl` KHÔNG ném** ở bất kỳ ca nào trong bốn ca dưới đây (đã đo trên `use-intl`
 * 4.14.1, cả bundle dev lẫn production). Không có gì đỏ ở đâu cả — script này là CỔNG DUY NHẤT.
 * `i18n/request.ts` bọc chuỗi hỏng thành `⟦namespace.key⟧` cho nhìn thấy được, nhưng đó là lưới,
 * không phải cổng.
 *
 * Kiểm CHÍN thứ, mỗi thứ là một cách hỏng đã lường trước:
 *   1. **Khoá thiếu** ở bản dịch → chuỗi khoá thô hiện lên màn hình.
 *   2. **Khoá thừa** ở bản dịch → chuỗi chết, thường là dấu vết của một lần đổi tên chưa dọn.
 *   3. **Khoá chứa dấu chấm** → `next-intl` từ chối CẢ bộ chuỗi, mọi trang hỏng (xem dưới).
 *   4. **Tham số ICU lệch** (`{count}` ở bản này, `{total}` ở bản kia) → `next-intl` KHÔNG ném:
 *      nó `console.error` một `FORMATTING_ERROR` rồi trả về chính tên khoá. Tức chuỗi hỏng đi
 *      thẳng ra màn hình, chỉ ở ngôn ngữ có tham số lệch.
 *   5. **Khoá SUY RA từ mã** — mọi `ERROR_CODES.*` và mọi quyền trong `lib/catalog/permissions.ts`
 *      phải có khoá tương ứng trong `messages/`.
 *   6. **Markdown trong chuỗi** — `next-intl` chỉ hiểu THẺ ICU; `**đậm**` hiện ra là hai dấu sao.
 *   7. **`t("…")` thiếu cặp `{}` trong JSX** — nó in ra bảy ký tự `t("x")` giữa màn hình.
 *   8. **`<RelativeTime>` thiếu `locale`** — gói mặc định tiếng Việt, nên "18 phút trước" hiện
 *      giữa giao diện tiếng Anh.
 *   9. **Khoá quyền MỒ CÔI** — chuỗi của một quyền đã bị gỡ khỏi `PERMISSION_RULES`.
 *
 * ⚠ Phép kiểm thứ năm là phép kiểm DUY NHẤT ở đây đọc MÃ NGUỒN, và nó bắt một lớp lỗi mà bốn phép
 * kia mù hoàn toàn: bốn phép trên chỉ so hai file JSON VỚI NHAU, nên một khoá thiếu ở CẢ HAI bản
 * đi qua sạch sẽ. Đó đúng là hình dạng của lỗi khi ai đó thêm một mã lỗi mới hoặc một quyền mới và
 * quên phần dịch — và triệu chứng là `⟦errors.CAI_GI_DO⟧` hiện ra ở đúng lúc có sự cố, tức lúc tệ
 * nhất để phát hiện một khoá sót.
 *
 * ⚠ Mã quyền chứa DẤU CHẤM (`task.view`) nên KHÔNG dùng thẳng làm khoá được — `next-intl` hiểu dấu
 * chấm là phân cấp namespace. `toPermissionMessageKey()` làm phép đổi, và phép kiểm này gọi đúng
 * hàm đó chứ không tự dựng lại quy tắc: hai bản quy tắc thì có ngày lệch, và ngày đó cổng sẽ báo
 * xanh cho một khoá không tra tới được.
 *
 * Chạy: `pnpm i18n:check`
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { PERMISSION_GROUPS, PERMISSION_RULES, toPermissionMessageKey } from "../lib/catalog/permissions";
import { APP_DATA_PREFS, NOTIFICATION_PREFS } from "../lib/catalog/settings";
import { ERROR_CODES } from "../lib/core/api-error";
import { LOCALES } from "../lib/i18n/config";
import { stripComments } from "./strip-comments";

type Tree = { [key: string]: Tree | string };

const problems: string[] = [];

function flatten(locale: string, tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    /*
     * ⚠ `next-intl` dùng dấu CHẤM làm dấu phân cấp namespace, nên một khoá CHỨA dấu chấm là lỗi
     * một khoá KHÔNG BAO GIỜ TRA TỚI ĐƯỢC: `t("perms.task.view")` đi tìm ở `perms → task → view`
     * và không thấy. Không có `INVALID_KEY` nào được ném (đã đo) — nó chỉ im lặng hỏng.
     *
     * Đây không phải lỗi lý thuyết: mã quyền của module có dạng `task.view`, `app.permissions` —
     * dùng thẳng chúng làm khoá là cách tự nhiên nhất, và cũng là cách làm hỏng cả app. Vì vậy
     * `messages/*.json` giữ tên đã thay dấu chấm bằng gạch dưới (`task_view`), và
     * `toPermissionMessageKey()` ở `lib/catalog/permissions.ts` làm phép đổi.
     */
    if (key.includes(".")) problems.push(`[${locale}] khoá chứa dấu chấm (next-intl sẽ từ chối): ${prefix}${key}`);

    if (typeof value === "string") out.set(prefix + key, value);
    else for (const [k, v] of flatten(locale, value, `${prefix}${key}.`)) out.set(k, v);
  }
  return out;
}

/** Tên tham số ICU trong một chuỗi: `{count}`, `{name}`… Bỏ qua phần sau dấu phẩy của `{n, plural, …}`. */
function icuParams(message: string): Set<string> {
  const names = new Set<string>();
  for (const match of message.matchAll(/\{\s*([A-Za-z0-9_]+)\s*[,}]/g)) {
    const name = match[1];
    if (name) names.add(name);
  }
  return names;
}

function load(locale: string): Map<string, string> {
  const url = new URL(`../messages/${locale}.json`, import.meta.url);
  return flatten(locale, JSON.parse(readFileSync(url, "utf8")) as Tree);
}

const [base, ...others] = LOCALES;
const baseMessages = load(base);

for (const locale of others) {
  const messages = load(locale);

  for (const key of baseMessages.keys()) {
    if (!messages.has(key)) problems.push(`[${locale}] THIẾU khoá: ${key}`);
  }
  for (const key of messages.keys()) {
    if (!baseMessages.has(key)) problems.push(`[${locale}] khoá THỪA (không có ở ${base}): ${key}`);
  }
  for (const [key, message] of messages) {
    const expected = baseMessages.get(key);
    if (expected === undefined) continue;
    const wanted = icuParams(expected);
    const got = icuParams(message);
    for (const name of wanted) {
      if (!got.has(name)) problems.push(`[${locale}] ${key}: thiếu tham số {${name}}`);
    }
    for (const name of got) {
      if (!wanted.has(name)) problems.push(`[${locale}] ${key}: tham số lạ {${name}}`);
    }
  }
}

/* ── 5. Khoá SUY RA từ mã ─────────────────────────────────────────────────────────────────── */

const derivedKeys = [
  ...Object.values(ERROR_CODES).map((code) => `errors.${code}`),
  ...PERMISSION_RULES.flatMap((rule) => {
    const key = `settings.permissions.item.${toPermissionMessageKey(rule.id)}`;
    return [`${key}.label`, `${key}.description`];
  }),
  ...PERMISSION_GROUPS.map((group) => `settings.permissions.group.${group}`),
  /*
   * Hai bảng khai của trang Cài đặt cũng dựng khoá lúc CHẠY (`t(\`pref.${id}.label\`)`), y hệt bảng
   * quyền — nên chúng có đúng cùng một lỗ hổng và đáng đúng cùng một cổng. Thêm một mục vào
   * `NOTIFICATION_PREFS` mà quên phần dịch thì `tsc` im lặng (khoá chỉ tồn tại lúc chạy) và bốn
   * phép kiểm đầu cũng im lặng (chúng chỉ so hai file JSON với nhau).
   */
  ...NOTIFICATION_PREFS.flatMap((id) => [
    `settings.notifications.pref.${id}.label`,
    `settings.notifications.pref.${id}.description`
  ]),
  ...APP_DATA_PREFS.flatMap((id) => [`settings.advanced.data.${id}.label`, `settings.advanced.data.${id}.description`])
];

for (const locale of LOCALES) {
  const messages = load(locale);
  for (const key of derivedKeys) {
    if (!messages.has(key)) problems.push(`[${locale}] THIẾU khoá suy từ mã: ${key}`);
  }
}

/* ── 6. MARKDOWN trong chuỗi hiển thị ─────────────────────────────────────────────────────── */

/*
 * `next-intl` KHÔNG hiểu markdown. Nó hiểu **thẻ ICU** (`<strong>…</strong>`, nối vào một hàm qua
 * `t.rich`), và mọi thứ khác đi thẳng ra màn hình y nguyên. Nên `**đậm**` viết trong `messages/`
 * hiện ra là hai dấu sao — với NGƯỜI DÙNG, ở đúng ngôn ngữ đó.
 *
 * Đã xảy ra thật: `settings.notYetActive` viết `**chưa có gì đọc nó**` cùng `` `scripts/jobs/` ``
 * trong khi component gọi `t.rich` với thẻ `strong`. Không cổng nào bắt được — khoá có mặt ở cả
 * hai ngôn ngữ, tham số ICU khớp, `tsc` không nhìn vào nội dung chuỗi. Chỗ duy nhất thấy được là
 * MẮT người đi thử, và chuỗi đó nằm ở tab thứ tư của `/settings`.
 *
 * Dấu `*` ĐƠN không bị chặn: nó là dấu đánh trường bắt buộc ("Tiêu đề*") và xuất hiện hợp lệ.
 */

const MARKDOWN_RULES: Array<{ pattern: RegExp; what: string }> = [
  { pattern: /\*\*[^*]+\*\*/, what: "**đậm** — dùng thẻ <strong> + t.rich" },
  { pattern: /`[^`]+`/, what: "`mã` — bỏ dấu huyền, hoặc đưa đường dẫn file vào COMMENT" },
  { pattern: /\[[^\]]+\]\([^)]+\)/, what: "[chữ](liên kết) — dùng thẻ ICU + t.rich" }
];

for (const locale of LOCALES) {
  for (const [key, message] of load(locale)) {
    for (const rule of MARKDOWN_RULES) {
      if (rule.pattern.test(message)) problems.push(`[${locale}] ${key}: markdown không render — ${rule.what}`);
    }
  }
}

/* ── 7. `t("…")` viết TRẦN ở vị trí văn bản của JSX ───────────────────────────────────────── */

/*
 * `<>{t("x")}</>` in ra chuỗi đã dịch; `<>t("x")</>` in ra bảy ký tự `t("x")`. Thiếu đúng một cặp
 * ngoặc nhọn, và **không có gì báo**: TypeScript thấy một chuỗi hợp lệ, Biome thấy văn bản JSX
 * hợp lệ, `i18n:check` thấy khoá có mặt trong `messages/`. Đã lọt vào `/settings/advanced` và
 * chỉ bị bắt khi có người đọc chữ trên màn hình.
 *
 * Dấu hiệu: một lời gọi `t…("…")` mà ký tự không-trắng ngay trước nó là `>` KẾT của một thẻ JSX.
 * `=>` bị loại ra — đó là hàm mũi tên trả về chuỗi dịch, cách viết đúng và phổ biến (prop nhãn
 * của `@comitor/ui` nhận hàm). Đã đo trên toàn repo: luật này bắt đúng 1, báo nhầm 0.
 */

const BARE_T_IN_JSX = /(?<!=)>\s*\bt[A-Za-z]*\(\s*["'`]/g;

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsx(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

for (const dir of ["app", "components", "hooks"]) {
  for (const file of walkTsx(join(ROOT, dir))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(BARE_T_IN_JSX)) {
      const line = source.slice(0, match.index).split("\n").length;
      problems.push(`${relative(ROOT, file)}:${line}: t("…") thiếu cặp {} — sẽ hiện NGUYÊN VĂN ra màn hình`);
    }
  }
}

/* ── 8. `<RelativeTime>` thiếu `locale` ───────────────────────────────────────────────────── */

/*
 * `@comitor/ui` mặc định TIẾNG VIỆT cho ngày giờ tương đối, nên `<RelativeTime value={x} />` in
 * ra "18 phút trước" — kể cả giữa giao diện tiếng Anh. Cùng họ với các prop `…Label` mặc định
 * tiếng Việt đã ghi ở AGENTS.md, nhưng KÍN HƠN một bậc: `locale` là prop optional nên `tsc` hài
 * lòng, chuỗi nằm trong gói nên bốn phép kiểm trên không thấy, và trên máy lập trình viên — mặc
 * định tiếng Việt — nó trông hoàn toàn đúng.
 *
 * Đã lọt vào `/tasks/[taskId]` ở Đợt 1 và chỉ bị bắt khi có người NHÌN ảnh chụp màn hình tiếng
 * Anh. Ba chỗ dùng khác trong repo đều truyền `locale` — tức đây là lỗi bỏ sót một chỗ, đúng hình
 * dạng mà một cổng chặn được còn con người thì không.
 *
 * Và có một hình dạng thứ hai, tệ hơn: đặt `<RelativeTime>` vào một Server Component rồi truyền
 * `locale` vào cho đúng — `Locale` của date-fns là object CHỨA HÀM, hàm không qua được ranh giới
 * server → client, nên Next ném *"Functions cannot be passed directly to Client Components"* và
 * cả trang rơi vào `error.tsx`. Đã đo. Vì vậy phép kiểm này báo NGUYÊN NHÂN GỐC trước: mốc thời
 * gian tương đối thuộc về một hòn đảo client, xem `app/(shell)/tasks/[taskId]/updated-at.tsx`.
 *
 * Gỡ comment TRƯỚC khi tìm: repo này giải thích `<RelativeTime>` trong bốn khối comment, và một
 * phép kiểm báo nhầm ở khối giải thích chính nó là phép kiểm sẽ bị tắt.
 */

const RELATIVE_TIME = /<RelativeTime\b[^>]*>/g;

for (const dir of ["app", "components", "hooks"]) {
  for (const file of walkTsx(join(ROOT, dir))) {
    const source = readFileSync(file, "utf8");
    const code = stripComments(source);
    const isClient = /^\s*["']use client["']/.test(code);
    for (const match of code.matchAll(RELATIVE_TIME)) {
      const line = code.slice(0, match.index).split("\n").length;
      const where = `${relative(ROOT, file)}:${line}`;

      /*
       * Thứ tự hai nhánh có ý: file KHÔNG phải client thì báo nguyên nhân GỐC. Bảo họ "thiếu
       * locale" ở đó là chỉ họ đi thẳng vào lỗi thứ hai — truyền vào rồi trang mới đổ.
       */
      if (!isClient) {
        problems.push(`${where}: <RelativeTime> trong file KHÔNG "use client" — Locale của date-fns chứa HÀM`);
      } else if (!match[0].includes("locale=")) {
        problems.push(`${where}: <RelativeTime> thiếu locale — gói mặc định TIẾNG VIỆT`);
      }
    }
  }
}

/* ── 9. Khoá quyền MỒ CÔI ─────────────────────────────────────────────────────────────────── */

/*
 * Phép kiểm 5 hỏi "mọi quyền trong mã có chuỗi chưa?". Phép kiểm này hỏi chiều NGƯỢC LẠI: "chuỗi
 * nào còn đó mà quyền đã bị gỡ?".
 *
 * Vì sao chiều ngược cũng đáng một cổng: gỡ một quyền khỏi `PERMISSION_RULES` không làm gì đỏ cả —
 * `tsc` không nhìn vào JSON, và bốn phép kiểm đầu chỉ so hai file JSON VỚI NHAU nên một khoá thừa ở
 * CẢ HAI bản đi qua sạch sẽ. Chuỗi mồ côi không hiện ra màn hình, nên nó không bao giờ bị phát
 * hiện bằng cách đi thử; nó chỉ nằm đó, được dịch, được review, và dạy người đọc rằng quyền đó còn
 * tồn tại. Đã xảy ra thật với `project.archive`.
 */

/*
 * ⚠ BA BẢNG KHAI, KHÔNG CÒN MỘT. Ngày 05.09.2026, ba ô cài đặt chết bị gỡ khỏi
 * `NOTIFICATION_PREFS` và `APP_DATA_PREFS` — và **không có gì đỏ**: chuỗi của chúng nằm cân xứng ở
 * cả `vi.json` lẫn `en.json` nên bốn phép kiểm đầu đi qua sạch, còn `tsc` thì không nhìn vào JSON.
 * Chính xác cùng một lớp lỗi mà `project.archive` đã dạy cho bảng quyền, ở hai bảng khai chưa được
 * canh. Nên phép kiểm này nay chạy cho cả ba, từ một bảng dữ liệu thay vì ba khối chép tay.
 */
const orphanScopes: { prefix: string; known: Set<string>; source: string }[] = [
  {
    prefix: "settings.permissions.item.",
    known: new Set(PERMISSION_RULES.map((rule) => toPermissionMessageKey(rule.id))),
    source: "PERMISSION_RULES"
  },
  {
    prefix: "settings.notifications.pref.",
    known: new Set<string>(NOTIFICATION_PREFS),
    source: "NOTIFICATION_PREFS"
  },
  { prefix: "settings.advanced.data.", known: new Set<string>(APP_DATA_PREFS), source: "APP_DATA_PREFS" }
];

for (const locale of LOCALES) {
  for (const key of load(locale).keys()) {
    for (const scope of orphanScopes) {
      if (!key.startsWith(scope.prefix)) continue;
      const name = key.slice(scope.prefix.length).split(".")[0];
      if (name && !scope.known.has(name)) {
        problems.push(`[${locale}] khoá MỒ CÔI (không còn trong ${scope.source}): ${key}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} vấn đề trong messages/:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.info(
  `✓ ${LOCALES.length} ngôn ngữ, ${baseMessages.size} khoá, khớp nhau hoàn toàn ` +
    `(${derivedKeys.length} khoá suy từ mã đều có mặt).`
);
