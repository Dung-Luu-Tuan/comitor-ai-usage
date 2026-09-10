/**
 * Bỏ comment khỏi mã nguồn, GIỮ NGUYÊN chuỗi — dùng chung cho các script kiểm trong `scripts/`.
 *
 * ── VÌ SAO VIẾT TAY MỘT MÁY TRẠNG THÁI THAY VÌ REGEX ──────────────────────────────────────
 * Một regex "xoá comment" sẽ nuốt luôn `//` nằm TRONG một chuỗi (`"https://…"`), và khi đó nó vừa
 * bỏ sót vừa cắt nhầm — hai lỗi cùng lúc, im lặng.
 *
 * ── VÌ SAO MỌI CỔNG ĐỀU CẦN NÓ ────────────────────────────────────────────────────────────
 * Quy ước của repo là **comment viết bằng tiếng Việt và nhắc tên hàm rất nhiều**. Nên một cổng tìm
 * chuỗi hay tìm lời gọi hàm mà không bỏ comment ra trước thì sai theo CẢ HAI chiều: `core:check`
 * báo đỏ ở mọi file (comment nào cũng có dấu), còn `api:check` báo XANH cho một route chỉ *nhắc
 * tới* `requirePermission()` trong một dòng giải thích mà không hề gọi nó — tức đúng ca nó sinh ra
 * để bắt.
 *
 * ⚠ Đây KHÔNG phải trình phân tích cú pháp. Nó không hiểu regex literal (`/"/`) hay chuỗi lồng
 * template. Với các cổng ở đây thì đủ, vì chúng chỉ hỏi "chuỗi này có xuất hiện không"; đừng dùng
 * nó cho việc cần độ chính xác của một parser thật.
 */
export function stripComments(source: string): string {
  let out = "";
  let index = 0;
  let quote: string | null = null;

  while (index < source.length) {
    const char = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (quote) {
      out += char;
      if (char === "\\") {
        out += next;
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      out += char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      const start = index;
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index += 2;

      /*
       * Một dấu cách để hai token không dính vào nhau, RỒI đúng bằng số xuống dòng mà khối comment
       * vừa chiếm.
       *
       * ⚠ Phần xuống dòng không phải chi tiết làm đẹp. Mọi cổng gọi hàm này đều tính số dòng bằng
       * cách đếm `\n` trong chuỗi ĐÃ BỎ COMMENT, nên nuốt mất chúng là mọi số dòng báo ra đều
       * lệch — và lệch nhiều nhất ở chính repo này, nơi mỗi hàm quan trọng có một khối JSDoc vài
       * chục dòng phía trên. Người đọc được dẫn tới một dòng không liên quan, kết luận là cổng
       * hỏng, rồi thôi không tin nó nữa.
       */
      const removed = source.slice(start, index);
      out += ` ${"\n".repeat(removed.split("\n").length - 1)}`;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}
