"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from "@comitor/ui/chart";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ProjectTaskBreakdown } from "@/lib/contracts/task";

/**
 * Biểu đồ "Việc theo dự án" — hòn đảo client của trang Tổng quan.
 *
 * VÌ SAO LÀ MỘT FILE `"use client"` RIÊNG: `recharts` đo kích thước bằng DOM nên mọi biểu đồ đều
 * phải chạy ở trình duyệt. Trang Tổng quan vẫn là Server Component; chỉ khối này vượt ranh giới.
 * Dữ liệu vào đây qua PROP dưới dạng thuần (`ProjectTaskBreakdown[]` — chỉ chuỗi và số), nên file
 * này không `import` một bản ghi nào và không biết dữ liệu đến từ đâu.
 *
 * VÌ SAO DÙNG TẦNG PRIMITIVE (`ChartContainer` + recharts) CHỨ KHÔNG DÙNG `<ComitorBarChart>`:
 * KHÔNG phải vì thiếu một prop. Bản lắp nhanh của gói thiếu BỐN thứ mà khối này cần, và cái nặng
 * nhất không phải prop mà là một TRƯỜNG trong kiểu:
 *   · `labelFormatter` hai tham số của tooltip — để đổi MÃ dự án ở trục X thành TÊN đầy đủ;
 *   · `ComitorChartPayloadItem` không có `payload`, trong khi bản song sinh ở tầng primitive
 *     (`ChartPayloadItem`) thì có — nên không lần được từ một điểm tooltip về bản ghi gốc;
 *   · `role` + `aria-label` không được truyền xuống phần tử gốc;
 *   · `maxBarSize` và `allowDecimals`.
 *
 * ⚠ Và ĐỪNG đẩy đủ bốn thứ đó lên gói: `<ComitorBarChart>` khi ấy thành một `<BarChart>` thứ hai
 * với ít prop hơn — tức dựng đúng cái "bộ biểu đồ THỨ HAI" mà việc dùng gói sinh ra để tránh, chỉ
 * là dựng ở gói. Ranh giới đúng: bản lắp nhanh cho biểu đồ lắp nhanh, tầng primitive cho biểu đồ
 * cần điều khiển từng mark — như khối này.
 *
 * ⚠ Lý do CŨ đã hết hiệu lực, ghi lại để không ai chép nó đi tiếp: trước đây file này giải thích
 * rằng `<ComitorBarChart>` không cho truyền `isAnimationActive`. Từ `@comitor/ui` `0.2.2` thì có —
 * và mặc định đã là `false`. Nhưng ở tầng primitive thì cờ đó vẫn PHẢI tự ghi lên TỪNG mark: với
 * recharts 2.15.4 + React 19.2, hiệu ứng vẽ dần không bao giờ chạy tới khung hình cuối, mà
 * `Rectangle` của recharts trả `null` khi chiều cao bằng 0 — biểu đồ đủ trục, đủ lưới, đủ chú giải
 * và KHÔNG có cột nào. Container không đặt hộ được vì mark là children do app viết.
 *
 * Màu lấy từ `--chart-1…5` của gói qua `config` → biến `--color-<key>` do `ChartContainer` sinh
 * ra. App không khai màu nào của riêng mình, và biểu đồ tự đúng ở cả hai theme.
 */
export function ProjectTaskChart({ data }: { data: ProjectTaskBreakdown[] }) {
  const t = useTranslations("overview.chart");

  /**
   * Nhãn series đến từ `messages/*.json`, nên `config` phải dựng TRONG component (nó phụ thuộc
   * ngôn ngữ đang xem) chứ không còn là hằng ở scope module như bản chỉ-giao-diện trước đây.
   *
   * `useMemo` không phải để tiết kiệm phép dựng object: `ChartContainer` đưa `config` vào context
   * và sinh ra một thẻ `<style>` cho các biến `--color-<key>`. Một tham chiếu mới ở mỗi lần render
   * là một lần context đổi giá trị, tức mọi thứ đọc `useChart()` vẽ lại theo.
   */
  const chartConfig = useMemo(
    () =>
      ({
        open: { label: t("open"), color: "var(--chart-1)" },
        done: { label: t("done"), color: "var(--chart-4)" }
      }) satisfies ChartConfig,
    [t]
  );

  return (
    /*
     * `aspect-auto` để huỷ tỉ lệ `aspect-video` mặc định của `ChartContainer`, rồi tự đặt chiều cao.
     *
     * `role="img"` + `aria-label` là CẶP, không tách được: `aria-label` đặt trần lên một `<div>`
     * không có role thì trình đọc màn hình bỏ qua. Có role thì ruột SVG bị ẩn khỏi cây trợ năng —
     * đúng ý ở đây, vì hàng trăm node `<path>` của recharts không nói được gì cho người không nhìn
     * thấy, còn một câu mô tả hai trục thì có.
     */
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full" role="img" aria-label={t("ariaLabel")}>
      {/* `maxBarSize`: với vài dự án thì cột giãn ra hơn 140px và đọc như một mảng màu, không còn
          ra hình cột. Giới hạn bề rộng là cách duy nhất giữ hình dạng khi số cột ít. */}
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} maxBarSize={64}>
        {/* Lưới chỉ kẻ NGANG: vạch dọc trong biểu đồ cột chỉ lặp lại thông tin của trục X. */}
        <CartesianGrid vertical={false} />
        <XAxis dataKey="project" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        {/* `labelFormatter` đổi tiêu đề tooltip từ mã ("NT") sang tên đầy đủ của dự án. Trục X vẫn
            giữ mã vì vài tên đầy đủ là chồng chữ; tooltip là chỗ giải nghĩa cái mã đó.
            `payload` là dòng dữ liệu đang hover — đọc `projectName` từ đó, và có nhánh dự phòng vì
            recharts gọi hàm này cả khi payload còn rỗng. */}
        <ChartTooltip
          content={
            <ChartTooltipContent labelFormatter={(label, payload) => payload?.[0]?.payload?.projectName ?? label} />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {/* `stackId` giống nhau = hai phần của cùng một cột: chiều cao cột là TỔNG số việc của dự
            án, đọc được ngay tỉ lệ đã xong / còn mở. */}
        <Bar dataKey="open" stackId="tasks" fill="var(--color-open)" isAnimationActive={false} />
        <Bar dataKey="done" stackId="tasks" fill="var(--color-done)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
