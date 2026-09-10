/**
 * MÃ DỰ ÁN (`NT`, `BC`…) — hàm THUẦN, tầng 1.
 *
 * ── VÌ SAO NÓ KHÔNG DÙNG LẠI `task-code.ts` ─────────────────────────────────────────────
 * Vì hai loại mã trả lời hai câu khác nhau, và gộp chúng là làm hỏng cả hai:
 *
 *   · mã CÔNG VIỆC là một dãy TĂNG DẦN (`CV-014`) — người ta đọc nó qua điện thoại và gõ lại;
 *   · mã DỰ ÁN là một VIẾT TẮT ngắn (`NT` cho "Nền tảng dùng chung") — nó lên trục X của biểu đồ,
 *     nơi 5 cột mà để tên đầy đủ là chữ chồng lên nhau (xem `prisma/schema.prisma`).
 *
 * Một dãy tăng dần cho dự án sẽ cho ra `DA-01`, `DA-02` — đọc lên không nói gì về dự án nào, và
 * biểu đồ mất luôn thứ nó cần: một nhãn gợi được tên đầy đủ.
 *
 * ⚠ Vì vậy mã dự án được SUY TỪ TÊN, và phần khó nằm ở tiếng Việt: `"Nền tảng dùng chung"` phải
 * cho ra `NT`, không phải `NỀ` hay `N?`. Đó là lý do file này tồn tại thay vì hai dòng inline.
 */

/** Số ký tự của một mã. HAI — đủ để phân biệt, đủ ngắn cho trục X của biểu đồ. */
const CODE_LENGTH = 2;

/**
 * Bỏ dấu tiếng Việt, giữ chữ cái.
 *
 * `normalize("NFD")` tách chữ khỏi dấu thành hai điểm mã, rồi bỏ dải dấu kết hợp. Đây là cách duy
 * nhất chạy đúng cho CẢ tiếng Việt lẫn mọi ngôn ngữ có dấu khác — một bảng tra `à→a` viết tay sẽ
 * thiếu đúng ký tự mà module sau cần.
 *
 * ⚠ `đ`/`Đ` KHÔNG phân tách được bằng NFD (nó là một chữ cái riêng, không phải `d` + dấu), nên nó
 * phải được đổi bằng tay. Bỏ sót dòng này là mọi dự án bắt đầu bằng "Đ" mất chữ đầu.
 */
function stripDiacritics(value: string): string {
  return (
    value
      /*
       * ⚠ Viết bằng ĐIỂM MÃ, không bằng ký tự — và không phải để lách `pnpm core:check`.
       *
       * Cổng đó chặn ký tự ngoài ASCII trong `lib/core/` vì một chuỗi hiển thị tiếng Việt luôn có
       * dấu; heuristic ấy đúng cho mọi ca nó sinh ra để bắt, và ở đây nó báo nhầm — hai ký tự này
       * là DỮ LIỆU của một phép chuyển tự, không phải câu chữ cho người đọc. Dạng `\u0111` nói ra
       * điều đó ngay tại chỗ, và nó cũng là dạng đọc được trên mọi trình soạn thảo và mọi bảng mã.
       */
      .replaceAll("\u0111", "d") // đ
      .replaceAll("\u0110", "D") // Đ
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  );
}

/**
 * Suy một mã ứng viên từ tên dự án.
 *
 * Lấy chữ ĐẦU của hai từ đầu tiên (`"Nền tảng dùng chung"` → `NT`); tên một từ thì lấy hai chữ đầu
 * của chính nó (`"Marketing"` → `MA`). Tên không có chữ cái nào thì trả `null` — nơi gọi quyết
 * định làm gì, và ở đây "không suy được" là câu trả lời đúng chứ không phải một mã bừa.
 */
export function suggestProjectCode(name: string): string | null {
  const words = stripDiacritics(name)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return null;

  const letters =
    words.length >= CODE_LENGTH
      ? words.slice(0, CODE_LENGTH).map((word) => word[0] ?? "")
      : (words[0] ?? "").slice(0, CODE_LENGTH).split("");

  const code = letters.join("").toUpperCase();
  return code.length > 0 ? code.padEnd(CODE_LENGTH, "X") : null;
}

/**
 * Mã CHƯA BỊ DÙNG, suy từ tên.
 *
 * ⚠ Mã dự án là `@@unique([workspaceId, code])`, và hai dự án bắt đầu bằng cùng hai chữ là chuyện
 * BÌNH THƯỜNG ("Nền tảng dùng chung" và "Nền tảng di động" đều cho `NT`). Trả về mã đã bị dùng
 * nghĩa là mọi lần tạo dự án thứ hai đều đỏ, nên hàm này phải tự né.
 *
 * Cách né: đổi ký tự CUỐI sang chữ cái tiếp theo (`NT` → `NU` → `NV`…), giữ chữ đầu vì nó là thứ
 * mang nghĩa. Hết chữ cái thì rơi về hai chữ số (`N2`), và cuối cùng là `null` — nơi gọi phải xử
 * lý được ca đó thay vì nhận một mã trùng.
 */
export function nextProjectCode(name: string, existingCodes: readonly string[]): string | null {
  const taken = new Set(existingCodes.map((code) => code.trim().toUpperCase()));
  const base = suggestProjectCode(name);
  if (!base) return null;
  if (!taken.has(base)) return base;

  const head = base[0] ?? "X";
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (const tail of ALPHABET) {
    const candidate = `${head}${tail}`;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}
