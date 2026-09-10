/**
 * BỐN TRỤC HIỂN THỊ — tập giá trị hợp lệ, khoá `localStorage`, và bộ lọc.
 *
 * ── ⚠ VÌ SAO FILE NÀY LÀ MỘT PHÉP KIỂM BẢO MẬT, KHÔNG PHẢI MỘT TIỆN ÍCH ─────────────────
 * Giá trị đi qua đây có nguồn là **cookie**, và cookie thì client sửa được. Đích của nó là một
 * `<script>` nội tuyến do app dựng, **mang nonce CSP** — tức một script mà trình duyệt tin tuyệt
 * đối. Nối thẳng nội dung cookie vào đó là tự tay mở đúng cái cửa mà cả `proxy.ts` dựng CSP để
 * đóng: kẻ tấn công đặt được cookie là chạy được mã trong ngữ cảnh trang, và nonce khiến CSP không
 * chặn gì cả.
 *
 * Nên luật ở đây là: **KHÔNG BAO GIỜ để một chuỗi từ ngoài đi vào script.** `parseDisplayPrefs`
 * chỉ trả về những giá trị KHỚP ĐÚNG một phần tử trong tập đóng bên dưới — thứ đi vào script luôn
 * là hằng của chính repo này, không phải thứ người dùng gửi lên.
 *
 * ── VÌ SAO TẬP GIÁ TRỊ ĐƯỢC CHÉP, KHÔNG `import` TỪ `@comitor/ui` ──────────────────────
 * `lib/core/` là tầng 1: hàm thuần, có test, **không phụ thuộc React**. Kéo gói giao diện vào đây
 * để lấy bốn mảng chuỗi là phá đúng ranh giới mà tầng này tồn tại để giữ.
 *
 * Cái giá: gói thêm một mức cỡ chữ thì bảng này phải sửa theo. Chấp nhận được vì bốn tập này là
 * hợp đồng hiển thị đã chốt — thêm một mức là đổi cả thang khoảng cách của design system, không
 * phải chuyện xảy ra âm thầm. Và hỏng theo hướng AN TOÀN: một giá trị mới mà bảng này chưa biết bị
 * LOẠI, tức người dùng rơi về mặc định — chứ không phải một chuỗi lạ lọt vào script.
 */

export const DISPLAY_PREF_VALUES = {
  /** ⚠ `system` là lựa chọn THẬT ("đi theo hệ điều hành"), không phải "chưa chọn". */
  theme: ["light", "dark", "system"],
  contrast: ["normal", "high"],
  density: ["comfortable", "compact"],
  fontSize: ["sm", "md", "lg"]
} as const satisfies Record<string, readonly string[]>;

export type DisplayPrefKey = keyof typeof DISPLAY_PREF_VALUES;

/** Chỉ những trục THẬT SỰ có giá trị hợp lệ. Trục vắng mặt = không gieo gì cho trục đó. */
export type DisplayPrefs = Partial<Record<DisplayPrefKey, string>>;

export const DISPLAY_PREF_KEYS = Object.keys(DISPLAY_PREF_VALUES) as DisplayPrefKey[];

/**
 * Khoá `localStorage` của từng trục — **phải khớp TỪNG KÝ TỰ với `@comitor/ui`**.
 *
 * ⚠ Lệch một khoá thì không có gì đỏ ở đâu cả: script gieo vào một khoá không ai đọc, gói đọc một
 * khoá không ai ghi, và triệu chứng là "mặc định không bao giờ áp" — thứ trông y hệt một tính năng
 * chưa làm xong. Ba khoá dưới lấy từ `display-axis-constants.ts` / `contrast-constants.ts` của gói;
 * `comitor-theme` là `storageKey` mặc định mà `<ThemeProvider>` truyền cho `next-themes`.
 */
export const DISPLAY_PREF_STORAGE_KEYS: Record<DisplayPrefKey, string> = {
  theme: "comitor-theme",
  contrast: "comitor-contrast",
  density: "comitor-density",
  fontSize: "comitor-font-size"
};

function isKey(value: string): value is DisplayPrefKey {
  return Object.hasOwn(DISPLAY_PREF_VALUES, value);
}

/**
 * Lọc một object THÔ (đã `JSON.parse` từ cookie) xuống chỉ những trục và giá trị hợp lệ.
 *
 * Không ném với dữ liệu rác — rác là trạng thái BÌNH THƯỜNG ở đây (cookie cũ, cookie bị sửa, một
 * bản gói sau đổi tập giá trị). Trả về object RỖNG nghĩa là "không gieo gì cả", và đó luôn là một
 * kết cục dùng được: người dùng giữ nguyên lựa chọn tại chỗ, hoặc rơi về mặc định của gói.
 *
 * ⚠ Giá trị trả về **được lấy từ mảng hằng ở trên**, không phải từ chuỗi đi vào — nên kể cả khi
 * hai chuỗi bằng nhau, thứ đi tiếp là hằng của repo này. Đó là điều làm phép so này an toàn để
 * đưa vào một `<script>`.
 */
export function parseDisplayPrefs(raw: unknown): DisplayPrefs {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};

  const input = raw as Record<string, unknown>;
  const out: DisplayPrefs = {};

  for (const key of Object.keys(input)) {
    if (!isKey(key)) continue;

    const value = input[key];
    if (typeof value !== "string") continue;

    const allowed = DISPLAY_PREF_VALUES[key].find((candidate) => candidate === value);
    if (allowed) out[key] = allowed;
  }

  return out;
}

/**
 * Đọc chuỗi cookie → `DisplayPrefs`. Bọc `JSON.parse` vì cookie hỏng không được làm chết trang.
 *
 * Cookie mang JSON đã `encodeURIComponent`: dấu `{`, `}`, `"` và `,` đều không hợp lệ trong giá trị
 * cookie theo RFC 6265, và một cookie sai cú pháp bị trình duyệt bỏ qua **trong im lặng**.
 */
export function decodeDisplayPrefs(cookieValue: string | undefined): DisplayPrefs {
  if (!cookieValue) return {};
  try {
    return parseDisplayPrefs(JSON.parse(decodeURIComponent(cookieValue)));
  } catch {
    return {};
  }
}
