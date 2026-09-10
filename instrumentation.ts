/**
 * Móc quan sát ở cấp RUNTIME của Next.
 *
 * ── VÌ SAO CẦN, KHI ROUTE HANDLER ĐÃ CÓ `withApiErrors` ────────────────────────────────────
 * `withApiErrors` (`lib/api/response.ts`) chỉ bọc route handler. Nó KHÔNG thấy:
 *   · lỗi ném lúc render Server Component — mọi `page.tsx` ở đây đọc Prisma trực tiếp;
 *   · lỗi trong Server Action — hôm nay repo có ĐÚNG MỘT (`lib/i18n/actions.ts`, đổi ngôn ngữ),
 *     và luật ở AGENTS.md giữ nó ở đó: mọi thao tác ghi chạm database đi route handler;
 *   · lỗi ở `generateMetadata`.
 *
 * Những lỗi đó rơi vào `app/error.tsx` — người dùng thấy một trang lỗi, còn máy chủ chỉ có một dấu
 * vết do Next tự in, không kèm ngữ cảnh nào của ta. `onRequestError` là móc DUY NHẤT bắt được cả ba.
 *
 * ── VÌ SAO KHÔNG NỐI MỘT DỊCH VỤ SAAS Ở ĐÂY ───────────────────────────────────────────────
 * File này in ra `stdout` theo khuôn JSON một dòng — đúng thứ mọi bộ gom log (journald →
 * CloudWatch, hay bất kỳ agent nào) truy vấn được, và không thêm phụ thuộc nào vào đường phục vụ.
 * Gửi stack trace của một app nghiệp vụ sang một dịch vụ bên thứ ba là một quyết định về DỮ LIỆU,
 * không phải một tiện ích: nó phải được quyết riêng, không nhét kèm vào một starter.
 */

export async function register(): Promise<void> {
  /*
   * Cố ý để TRỐNG. File `instrumentation.ts` phải TỒN TẠI và export `register` thì Next mới gọi
   * `onRequestError` — không có nó thì móc bên dưới im lặng không bao giờ chạy.
   *
   * Đây cũng là chỗ đặt `registerOTel(...)` nếu có ngày cần tracing.
   */
}

/**
 * Ghi mọi lỗi phía máy chủ mà Next bắt được.
 *
 * ⚠ KHÔNG ném từ trong đây. Móc này chạy TRÊN đường xử lý lỗi; một lỗi ở đây che mất lỗi gốc và để
 * lại một dấu vết nói về hệ thống ghi log chứ không về sự cố thật.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routeType: string }
): Promise<void> {
  try {
    console.error(
      JSON.stringify({
        level: "error",
        source: "onRequestError",
        /*
         * `path` KHÔNG kèm query string. Tham số truy vấn của module mang bộ lọc, từ khoá tìm
         * kiếm, và — khi nối Comitor.Account — cả mã uỷ quyền OIDC. Không thứ nào trong đó nên
         * nằm trong log dài hạn.
         */
        path: request.path.split("?")[0],
        method: request.method,
        routerKind: context.routerKind,
        routeType: context.routeType,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    );
  } catch {
    // Ngay cả `JSON.stringify` cũng hỏng được (tham chiếu vòng). Thà mất một dòng log còn hơn mất lỗi gốc.
  }
}
