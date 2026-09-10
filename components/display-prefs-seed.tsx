import { DISPLAY_PREF_KEYS, DISPLAY_PREF_STORAGE_KEYS, type DisplayPrefs } from "@/lib/core/display-prefs";

/**
 * Gieo MẶC ĐỊNH hiển thị của tài khoản vào `localStorage`, **trước lượt sơn đầu tiên**.
 *
 * ── VÌ SAO PHẢI LÀ MỘT SCRIPT NỘI TUYẾN, KHÔNG PHẢI MỘT PROP ────────────────────────────
 * Cách hiển nhiên — truyền giá trị của Account vào `defaultTheme` / `defaultValue` của bốn provider
 * — **KHÔNG CHẠY** với ba trong bốn trục. Đã đọc `dist` của `@comitor/ui`: `AxisScript` chỉ nhận
 * `storageKey` và `nonce`, còn chuỗi script nó dựng đóng gói `config.defaultValue` — HẰNG của gói.
 * Prop `defaultValue` chỉ nuôi `useState` và một `useEffect`, tức tới **SAU** lượt sơn.
 * `ContrastScript` còn hẹp hơn: nó chỉ áp đúng chuỗi `"high"` đọc từ `localStorage`.
 *
 * Kết quả của đường prop: **nháy giao diện** — đúng thứ bốn script chống nháy của gói tồn tại để
 * ngăn, và tệ nhất ở hai trục trợ năng (tương phản, cỡ chữ), nơi người dùng ít chịu được nhất một
 * khung hình sai.
 *
 * Nên đường duy nhất đúng là: ghi thẳng vào `localStorage` **trước khi script của gói đọc nó**.
 * Component này phải là con ĐẦU TIÊN của `<body>`, trên `<ThemeProvider>` — thứ tự trong tài liệu
 * là thứ tự chạy của script đồng bộ.
 *
 * ── ⚠ VÌ SAO KHỐI NÀY LÀ MỘT BỀ MẶT TẤN CÔNG, VÀ NÓ ĐƯỢC ĐÓNG THẾ NÀO ───────────────────
 * `dangerouslySetInnerHTML` + `nonce` = một script mà trình duyệt tin TUYỆT ĐỐI, vì nonce là thứ
 * CSP dùng để phân biệt script của ta với script kẻ khác chèn. Nối một chuỗi từ cookie vào đây là
 * tự tay vô hiệu hoá cả chính sách CSP mà `proxy.ts` dựng.
 *
 * Hai lớp, và lớp thứ hai mới là lớp thật:
 *   1. `readDisplayPrefsSeed()` lọc cookie qua `parseDisplayPrefs` — chỉ giá trị KHỚP ĐÚNG một
 *      phần tử trong tập đóng mới đi tiếp (`lib/core/display-prefs.ts`, có test cho cả ca tiêm mã);
 *   2. **script dựng từ `JSON.stringify` của một object mà CẢ KHOÁ LẪN GIÁ TRỊ đều là hằng của
 *      repo** — khoá lấy từ `DISPLAY_PREF_STORAGE_KEYS`, giá trị lấy từ `prefs[key]` vốn đã là một
 *      phần tử của mảng hằng. Không có đường nào cho một byte của người dùng đi vào chuỗi này.
 *
 * ⚠ Người sửa sau: nếu thấy mình `${}` một biến vào `script` mà biến ấy không phải hằng của repo,
 * dừng lại — đó là lỗ hổng, không phải một dòng tiện tay.
 *
 * ── ⚠ LUẬT GIEO LẠI: CÓ DẤU, KHÔNG PHẢI "CHỈ GIEO KHI TRỐNG" ────────────────────────────
 * "Chỉ gieo khi chưa có gì" nghe an toàn và SAI ở chỗ quan trọng nhất: sau lần đăng nhập đầu,
 * `localStorage` luôn có giá trị, nên một thay đổi ở Account **không bao giờ** tới được thiết bị
 * này nữa. Năm sản phẩm lệch nhau vĩnh viễn sau mỗi cái một lần ghé — tức đúng điều mà việc đưa
 * tuỳ chọn lên Account định chữa.
 *
 * Nên cạnh mỗi khoá có một khoá DẤU giữ *giá trị đã gieo lần trước*, và luật là:
 * **đi theo Account, trừ khi bạn đã tự đổi trên thiết bị này.**
 *
 *   · chưa có giá trị                        → gieo (lần đầu);
 *   · Account đổi, giá trị tại chỗ vẫn bằng   → gieo (người dùng chưa từng đè lên);
 *     cái đã gieo lần trước
 *   · giá trị tại chỗ KHÁC cái đã gieo        → GIỮ NGUYÊN — họ đã tự chọn trên máy này.
 *
 * Dấu luôn được cập nhật, kể cả ở nhánh thứ ba: nếu không, một lần đổi bị bỏ qua sẽ còn bị hỏi lại
 * mãi ở mọi lượt render sau.
 *
 * ⚠ Phép so phải nằm TRONG script này, không ở tầng máy chủ: giá trị đang có hiệu lực nằm ở
 * `localStorage`, thứ máy chủ không đọc được. Đây là lý do cả luật gieo lại phải viết bằng JS thô.
 */
export function DisplayPrefsSeed({ prefs, nonce }: { prefs: DisplayPrefs; nonce: string | undefined }) {
  /*
   * Không có gì để gieo thì KHÔNG render script nào. Một `<script>` rỗng vẫn là một script CSP phải
   * duyệt, và nó làm người đọc `view-source` tưởng có gì đó đang chạy.
   */
  const seed: Record<string, string> = {};
  for (const key of DISPLAY_PREF_KEYS) {
    const value = prefs[key];
    if (value) seed[DISPLAY_PREF_STORAGE_KEYS[key]] = value;
  }
  if (Object.keys(seed).length === 0) return null;

  /*
   * ⚠ `JSON.stringify` ở đây KHÔNG phải để làm sạch — làm sạch đã xong ở `parseDisplayPrefs`. Nó
   * chỉ để dựng cú pháp object hợp lệ. Cả khoá lẫn giá trị đều là hằng của repo (xem JSDoc).
   *
   * `try/catch` bọc TẤT CẢ: `localStorage` NÉM ở chế độ riêng tư của một số trình duyệt và khi
   * người dùng chặn dữ liệu trang. Một ngoại lệ ở script đồng bộ đầu tiên trong `<body>` sẽ chặn
   * mọi script sau nó — kể cả bốn script chống nháy của gói. Nuốt là đúng: mất mặc định thì người
   * dùng vẫn có giao diện dùng được.
   */
  const script =
    `(function(){try{var s=${JSON.stringify(seed)},k,c,m;` +
    `for(k in s){m=k+"-seeded";c=localStorage.getItem(k);` +
    `if(c===null||c===localStorage.getItem(m)){if(c!==s[k])localStorage.setItem(k,s[k]);}` +
    `localStorage.setItem(m,s[k]);}` +
    `}catch(e){}})();`;

  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: script chống nháy PHẢI nội tuyến và đồng bộ; nội dung dựng từ hằng của repo, xem JSDoc.
    <script suppressHydrationWarning nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />
  );
}
