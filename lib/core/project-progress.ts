/**
 * Phép ĐẾM và phép SUY của dự án — hàm THUẦN, tầng 1 (xem `docs/kien-truc-ung-dung.md` §4).
 *
 * ── VÌ SAO `progress` VÀ `taskCount` KHÔNG PHẢI CỘT TRONG DATABASE ─────────────────────────
 * Vì một cột đếm sẵn là một cột SẼ LỆCH. Nó chỉ đúng chừng nào MỌI đường ghi đều đi qua đúng chỗ
 * tăng/giảm bộ đếm — và đường ghi thì luôn nhiều hơn ta nhớ: một `DELETE` dọn dẹp chạy tay, một
 * `prisma studio` sửa nhanh một trạng thái, một seed script, một migration gộp dự án, một lần khôi
 * phục từ bản sao lưu cũ hơn bảng đếm. Lần đầu tiên có ai xoá một việc bằng đường không đi qua chỗ
 * tăng giảm bộ đếm là lần cột đó bắt đầu nói dối, và nó nói dối YÊN LẶNG: không lỗi, không cảnh
 * báo, chỉ một thanh tiến độ 80% trên một dự án đã xong.
 *
 * Chữa một cột đếm lệch còn tốn hơn: phải viết script đối soát, mà script đối soát thì… đếm lại từ
 * bảng công việc. Nếu đằng nào cũng phải đếm được, thì đếm là NGUỒN, không phải là phép chữa.
 *
 * ⚠ Đây là quyết định về NGUỒN SỰ THẬT, không phải về hiệu năng. Khi bảng công việc lớn tới mức
 * `COUNT(*)` thành nút cổ chai, cách đi là cache có hạn ở tầng đọc (rìa B) — một bản sao BIẾT MÌNH
 * LÀ BẢN SAO và hết hạn được. Không phải một cột trong `Project` mà cả hệ tin là sự thật.
 *
 * Ba hàm ở đây là toàn bộ phần "quyết định" của tính năng đó, nên chúng thuần và test được: một dự
 * án 0 công việc, một dự án có `doneCount > taskCount` vì dữ liệu hỏng, một danh sách rỗng — ba
 * nhánh mà chạy thật gần như không bao giờ đi qua, và cũng là ba nhánh hay hỏng nhất.
 */

import type { TaskStatus } from "@/lib/contracts/task";

/**
 * "Đang mở" = MỌI việc CHƯA hoàn thành. Chỉ `done` là đóng.
 *
 * ⚠ `in-review` và `overdue` ĐỀU đang mở. Chúng trông như trạng thái cuối nên hay bị đếm nhầm sang
 * phía đóng: một việc chờ duyệt là việc chưa xong (người duyệt có thể trả lại), một việc quá hạn
 * thì càng chưa xong — bỏ nó khỏi số "đang mở" là giấu đúng thứ cần nhìn nhất.
 *
 * ── VÌ SAO VIẾT DẠNG PHỦ ĐỊNH (`!== "done"`) CHỨ KHÔNG LIỆT KÊ BỐN TRẠNG THÁI MỞ ───────────
 * Vì danh sách trắng sẽ lệch khi thêm trạng thái. Ngày ai đó thêm `"blocked"` vào `TaskStatus`,
 * bản liệt kê vẫn biên dịch xanh và âm thầm coi việc bị chặn là ĐÃ XONG — trong khi bảng vẫn hiện
 * nó. Dạng phủ định thì trạng thái mới mặc định là "đang mở", tức là an toàn: một việc mới toanh
 * chưa ai định nghĩa xong ngữ nghĩa thì đếm là chưa xong, không phải đã xong.
 *
 * ⚠ Định nghĩa này được dùng ở BA chỗ — thẻ chỉ số ở trang Tổng quan, badge trên thanh bên, và bộ
 * lọc của bảng công việc. Ba chỗ đó PHẢI nói cùng một con số; ai cũng thấy ngay khi thanh bên ghi
 * 12 mà bảng lọc ra 9, và không có cách nào biết bên nào đúng. Vì vậy KHÔNG viết lại phép so này
 * tại chỗ gọi (`task.status !== "done"` rải rác) — gọi hàm này, một định nghĩa, một chỗ sửa.
 */
export function isOpenStatus(status: TaskStatus): boolean {
  return status !== "done";
}

/**
 * Phần trăm hoàn thành 0–100, đã làm tròn.
 *
 * ── DỰ ÁN CHƯA CÓ VIỆC NÀO → 0, KHÔNG PHẢI 100, VÀ KHÔNG PHẢI `NaN` ───────────────────────
 * `0 / 0` trong JS là `NaN`, và `NaN` không dừng ở đâu cả: nó đi thẳng vào thuộc tính `style` của
 * thanh tiến độ (trình duyệt bỏ qua, thanh về 0 nhưng con số bên cạnh in ra chữ "NaN%"), và nó
 * làm MỌI phép tổng ở tầng trên thành `NaN` — một dự án rỗng đủ sức xoá trắng con số trung bình
 * của cả trang.
 *
 * Còn 100 thì tệ theo kiểu khác, kiểu nguy hiểm hơn: nó ĐÚNG VỀ TOÁN ("đã làm hết mọi việc được
 * giao") nhưng SAI VỀ NGHĨA. Một dự án chưa có việc nào là dự án chưa bắt đầu, không phải dự án đã
 * xong; hiện 100% là báo hoàn thành cho một thứ chưa ai làm gì, và nó còn kéo trung bình có trọng
 * số lên theo. 0 nói đúng chuyện đang xảy ra: chưa có gì để làm thì chưa làm được gì.
 *
 * ⚠ Điều kiện viết là `!(taskCount > 0)` chứ không phải `taskCount <= 0` — CỐ Ý. Với `NaN`, phép
 * `NaN <= 0` cho `false` nên `NaN` lọt qua cửa và hàm trả về `NaN`, đúng thứ vừa nói ở trên. Dạng
 * phủ định chặn được cả ba: `0`, số âm, và `NaN`. Cùng lý do cho `doneCount`.
 *
 * `doneCount > taskCount` là dữ liệu HỎNG (hai nguồn đếm lệch nhau, hoặc một việc bị đếm hai lần).
 * Kẹp về 100 thay vì trả 150: một thanh tiến độ 150% tràn ra khỏi máng của nó và làm vỡ bố cục,
 * mà cái vỡ đó lại không chỉ ra được nguyên nhân thật. Chỗ để phát hiện dữ liệu lệch là log của
 * tầng đọc, không phải một con số vô nghĩa in giữa giao diện.
 */
export function projectProgress(doneCount: number, taskCount: number): number {
  if (!(taskCount > 0)) return 0;
  if (!(doneCount > 0)) return 0;

  /*
   * `Math.round` làm tròn 0.5 LÊN (`Math.round(12.5) === 13`), đúng thứ ta muốn: 1/8 việc xong thì
   * hiện 13%, không phải 12%. Nhánh `-0.5` của `Math.round` (làm tròn về 0, không phải ra xa) không
   * chạm tới được ở đây vì tỉ lệ đã được chặn dưới bởi hai lần kiểm ở trên.
   */
  return Math.round(Math.min(doneCount / taskCount, 1) * 100);
}

/**
 * Kẹp một giá trị phần trăm về khoảng 0–100, coi `NaN` là 0.
 *
 * Không xuất ra: nó là chi tiết nội bộ của `weightedAverageProgress`. `projectProgress` không dùng
 * nó vì hai hàm chặn ở hai chỗ khác nhau — một cái kẹp TỈ LỆ trước khi nhân, một cái kẹp giá trị
 * ĐÃ TÍNH nhận từ bên ngoài.
 */
function clampPercent(value: number): number {
  if (!(value > 0)) return 0;
  return value > 100 ? 100 : value;
}

/**
 * Trung bình CÓ TRỌNG SỐ theo số việc — con số "tiến độ chung" của trang Tổng quan.
 *
 * ── VÌ SAO KHÔNG PHẢI TRUNG BÌNH CỘNG ─────────────────────────────────────────────────────
 * Vì trung bình cộng coi mọi dự án nặng như nhau, và điều đó sai ngay ở ca thường gặp nhất: một dự
 * án 9 việc không thể đếm ngang một dự án 2 việc. Ví dụ đủ để thấy mức độ:
 *
 *     dự án A: 1 việc, xong 1  → 100%
 *     dự án B: 99 việc, xong 0 →   0%
 *     trung bình cộng   → 50%   ("một nửa chặng đường")
 *     có trọng số       →  1%   (đúng: 1 trên 100 việc đã xong)
 *
 * 50% ở đây không phải sai số, nó là một câu SAI: nó nói với người quản lý rằng nửa khối lượng đã
 * xong trong khi 99% còn nguyên. Trọng số bằng `taskCount` khiến con số này luôn tương đương
 * "tổng việc xong / tổng việc", tức thứ người đọc tưởng mình đang nhìn.
 *
 * ── VÌ SAO NHẬN `progress` THAY VÌ TỰ TÍNH LẠI TỪ `doneCount` ──────────────────────────────
 * Để con số ở đầu trang không bao giờ mâu thuẫn với danh sách bên dưới: nó cộng đúng những giá trị
 * đang hiển thị ở từng dòng. Cái giá là mỗi dòng đã làm tròn một lần nên kết quả có thể lệch tối
 * đa nửa điểm phần trăm so với việc tính thẳng từ số việc — rẻ hơn nhiều so với việc header nói
 * 41% còn các dòng cộng lại ra 42%, kiểu mâu thuẫn không ai giải thích nổi cho người dùng.
 *
 * Tổng trọng số bằng 0 (danh sách rỗng, hoặc mọi dự án đều chưa có việc nào) → 0, cùng lý do với
 * `projectProgress`: chưa có gì để làm thì chưa làm được gì, và `0 / 0` phải bị chặn trước khi nó
 * thành `NaN`.
 */
export function weightedAverageProgress(projects: readonly { progress: number; taskCount: number }[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const project of projects) {
    const weight = project.taskCount;
    // Dự án 0 việc không có tiếng nói trong trung bình này; `!(… > 0)` chặn luôn số âm và `NaN`.
    if (!(weight > 0)) continue;

    /*
     * ⚠ `progress` hỏng thì KẸP về 0 chứ KHÔNG bỏ dòng đó đi. Bỏ dòng là rút nó khỏi mẫu số, tức
     * làm trung bình ĐẸP LÊN — một lỗi dữ liệu không bao giờ được phép khiến con số trông khá hơn
     * thực tế, vì khi đó không ai đi tìm lỗi nữa.
     */
    weightedSum += clampPercent(project.progress) * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}
