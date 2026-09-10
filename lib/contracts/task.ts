/**
 * Hợp đồng dữ liệu của CÔNG VIỆC và DỰ ÁN — TẦNG 0: chỉ KIỂU, không mã chạy được.
 *
 * ── VÌ SAO TẦNG NÀY TỒN TẠI ────────────────────────────────────────────────────────────────
 * Đây là hình dạng đi qua ranh giới Server Component → Client Component, và qua JSON của API. Nó
 * KHÔNG phải kiểu Prisma sinh ra: kiểu của Prisma mang `Date`, `Decimal` và quan hệ lồng nhau —
 * ba thứ không tuần tự hoá được, hoặc tuần tự hoá thành thứ khác với cái đọc ra.
 *
 * Vì tầng này không có mã chạy được, `import type` từ đây an toàn ở CẢ hai phía: nó không kéo
 * `server-only`, Prisma hay `next/*` vào bundle trình duyệt.
 */

/** Giá trị union là chuỗi MÁY, tiếng Anh — chúng đi vào cột `status` và vào JSON của API. */
export type TaskStatus = "todo" | "in-progress" | "in-review" | "done" | "overdue";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type ProjectStatus = "active" | "on-hold" | "completed";

/** Loại yêu cầu — quyết định quy trình xử lý phía sau. */
export type RequestType = "task" | "incident" | "improvement" | "external";

/**
 * Một công việc, ở dạng đã sẵn sàng cho giao diện.
 *
 * ⚠ Mọi mốc thời gian là **chuỗi ISO**, không phải `Date`. Hai lý do, cả hai đều cứng:
 *   1. `Date` không tuần tự hoá qua ranh giới server → client (Next chuyển nó thành chuỗi rồi
 *      client nhận một `string` mà kiểu vẫn nói là `Date` — sai kiểu ÂM THẦM);
 *   2. JSON của API vốn dĩ chỉ có chuỗi, nên dùng chuỗi ở đây là dùng CÙNG một hình dạng cho cả
 *      hai đường vào, và giao diện không phải biết dữ liệu đến từ đâu.
 *
 * `dueDate` là ISO **chỉ-có-ngày** (`YYYY-MM-DD`); `updatedAt` là mốc đầy đủ. Xem
 * `lib/core/iso-date.ts` về lý do không được `new Date("YYYY-MM-DD")`.
 */
export interface TaskView {
  id: string;
  /** Mã hiển thị cho người dùng, vd `CV-014`. */
  code: string;
  title: string;
  summary: string;
  projectId: string;
  /** Tên dự án, ghép sẵn ở tầng đọc để giao diện không phải tra ngược. */
  projectName: string;
  /** `null` = chưa giao. Trạng thái HỢP LỆ, không phải dữ liệu thiếu. */
  assigneeUserId: string | null;
  /** Tên người phụ trách, lấy từ danh bạ Account. `null` khi chưa giao HOẶC khi tra không ra. */
  assigneeName: string | null;
  /**
   * Ảnh đại diện của người phụ trách. `null` khi chưa giao, khi tra không ra, HOẶC khi người đó
   * chưa đặt ảnh — ba ca khác nhau nhưng cùng một cách hiển thị: rơi về avatar chữ cái.
   *
   * ⚠ **URL đã ký, có hạn.** Nó đi cùng lượt đọc này và không được cất lại ở đâu — xem
   * `AccountMember.avatarUrl`. Đó cũng là lý do nó KHÔNG có mặt trong `CommandTaskRow`: bảng lệnh
   * ⌘K không vẽ ảnh, và thêm một URL sẽ hết hạn vào một hình dạng "sáu trường, không hơn" là mở
   * đúng cái cửa mà chú thích ở đó dựng lên để đóng.
   */
  assigneeAvatarUrl: string | null;
  /**
   * `true` khi công việc CÓ người phụ trách nhưng danh bạ không tra ra tên.
   *
   * ── VÌ SAO ĐÂY LÀ TRẠNG THÁI THỨ BA, KHÔNG PHẢI MỘT DẠNG CỦA "CHƯA GIAO" ───────────────
   * Gộp hai thứ vào cùng một `null` là để giao diện in ra "Chưa giao" cho một việc ĐÃ CÓ CHỦ. Ba
   * đường dẫn tới đó, và cả ba đều xảy ra thật:
   *
   *   · Comitor.Account gián đoạn 5 giây  → MỌI việc hiện "Chưa giao";
   *   · `COMITOR_M2M_*` chưa cấu hình      → như trên, nhưng vĩnh viễn;
   *   · một người bị gỡ khỏi workspace     → việc của họ hiện "Chưa giao" trong khi database vẫn
   *     giữ nguyên `assignee_user_id`.
   *
   * "Chưa giao" là một LỜI MỜI người khác nhận việc. Nói câu đó về một việc đã có chủ là làm hai
   * người cùng nhận, hoặc làm việc đó rơi. Ở CRM/HR cùng khuôn này thì nó thành "chưa ai duyệt".
   *
   * ⚠ `activity-feed.tsx` và `notifications-slot.tsx` đã phân biệt đúng từ đầu (`?? formerMember`).
   * Chỉ bảng công việc là không — và đó là màn hình người ta nhìn nhiều nhất.
   */
  assigneeUnknown: boolean;
  status: TaskStatus;
  priority: TaskPriority;
  /** ISO `YYYY-MM-DD`. */
  dueDate: string;
  /** ISO đầy đủ — hợp với `<RelativeTime>`. */
  updatedAt: string;
  estimateMinutes: number;
  /**
   * URL ĐÃ KÝ, CÓ HẠN của tệp đính kèm — `null` khi không có tệp hoặc khi kho ảnh chưa cấu hình.
   *
   * ⚠ **KHÔNG lưu lại giá trị này ở đâu cả**: nó hết hạn. Database giữ KHOÁ object; URL được ký
   * lại ở mỗi lần đọc. Xem `lib/storage.ts`.
   */
  attachmentUrl: string | null;
  attachmentName: string | null;
}

/** Dự án, đã kèm những con số SUY từ công việc của nó. */
export interface ProjectView {
  id: string;
  code: string;
  name: string;
  ownerUserId: string;
  ownerName: string | null;
  status: ProjectStatus;
  /** ISO `YYYY-MM-DD`. */
  dueDate: string;
  /** Tổng số việc — ĐẾM, không phải cột trong database. */
  taskCount: number;
  /** Số việc đã xong — ĐẾM. */
  doneCount: number;
  /** Phần trăm hoàn thành 0–100, SUY từ hai con số trên (`lib/core/project-progress.ts`). */
  progress: number;
}

/** Một dòng của biểu đồ "việc theo dự án". */
export type ProjectTaskBreakdown = {
  /** Mã dự án — nhãn trục X, ngắn để 5 cột không chồng chữ lên nhau. */
  project: string;
  /** Tên đầy đủ — chỉ dùng cho tooltip. Trục X mà để tên đầy đủ là chữ chồng lên nhau, nhưng nếu mã
   *  là thứ DUY NHẤT xuất hiện thì "NT" hay "BC" không có chỗ nào giải nghĩa. */
  projectName: string;
  open: number;
  done: number;
};

/** Loại sự kiện trong nhật ký hoạt động. */
export type ActivityKind =
  | "created"
  | "assigned"
  | "updated"
  | "review-requested"
  | "completed"
  | "overdue"
  /**
   * ⚠ `deleted` là `kind` DUY NHẤT mà bản ghi nó nói tới KHÔNG CÒN TỒN TẠI.
   *
   * Điều đó chạy được vì `activities` giữ GIÁ TRỊ (`targetCode`, `targetTitle`) chứ không
   * giữ khoá ngoại — một quyết định ở đầu `prisma/schema.prisma` mà tới đây mới thu lãi.
   * Nếu nó giữ `taskId` thì xoá một công việc sẽ hoặc xoá luôn dấu vết của việc xoá, hoặc
   * để lại một dòng nhật ký trỏ vào hư không.
   */
  | "deleted";

/**
 * Một dòng nhật ký.
 *
 * ⚠ KHÔNG có trường `verb` hay `body` — không có CÂU CHỮ nào ở tầng dữ liệu. Giao diện dựng câu từ
 * `kind` + các tham số bên dưới, qua `messages/*.json`. Một chuỗi hiển thị nằm trong dữ liệu thì
 * nói mãi một thứ tiếng, kể cả với người đang đọc giao diện tiếng Anh.
 */
export interface ActivityView {
  id: string;
  kind: ActivityKind;
  actorUserId: string;
  actorName: string | null;
  /** Người NHẬN của sự kiện `assigned`; `null` với mọi loại khác. */
  targetUserId: string | null;
  targetUserName: string | null;
  /** Mã + tiêu đề việc TẠI THỜI ĐIỂM xảy ra sự kiện — đóng băng, cố ý. */
  targetCode: string;
  targetTitle: string;
  /** ISO đầy đủ. */
  createdAt: string;
}

/** Loại thông báo — quyết định icon hiển thị. */
export type NotificationKind = "mention" | "assignment" | "deadline" | "system";

/** Một thông báo trong chuông trên header. Cùng nguyên tắc với `ActivityView`: giá trị, không câu chữ. */
export interface NotificationView {
  id: string;
  kind: NotificationKind;
  actorName: string | null;
  taskCode: string | null;
  taskTitle: string | null;
  unread: boolean;
  /** ISO đầy đủ. */
  createdAt: string;
}
