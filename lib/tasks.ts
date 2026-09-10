import "server-only";
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { memberDirectory, requireMemberDirectory } from "@/lib/account/directory";
import { notify, recordActivity } from "@/lib/activities";
import type { AccountSession } from "@/lib/contracts/account";
import type { ActivityKind, ProjectTaskBreakdown, TaskPriority, TaskStatus, TaskView } from "@/lib/contracts/task";
import { ApiError, ERROR_CODES } from "@/lib/core/api-error";
import { attachmentObjectKey, checkAttachment, safeAttachmentName, sniffImageType } from "@/lib/core/attachment";
import { isOverdue, parseIsoDate } from "@/lib/core/iso-date";
import { resolveNotifyDelivery } from "@/lib/core/notify-channels";
import { isOpenStatus } from "@/lib/core/project-progress";
import { nextTaskCode } from "@/lib/core/task-code";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/core/task-input";
import { APPROVAL_FLOWS, NOTIFY_CHANNELS } from "@/lib/core/task-input";
import { env } from "@/lib/env";
import { formatIsoDateFor } from "@/lib/format";
import { mailTemplates, sendMail, toMailLocale } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { deleteObject, putPrivateObject, storageEnabled, toDisplayUrls } from "@/lib/storage";
import { clearTaskDraft } from "@/lib/task-drafts";
import { todayIso } from "@/lib/today";

/**
 * Công việc: phép ĐỌC và phép GHI — dùng chung giữa Server Component, route handler và mọi đường
 * chạy không có người dùng đứng sau (`pnpm seed`, một job nền, một webhook).
 *
 * ── VÌ SAO PHẢI LÀ MỘT FILE RIÊNG, KHÔNG NẰM TRONG `route.ts` ─────────────────────────────
 * Next chỉ cho một `route.ts` export `GET`/`POST`/… — không có chỗ cho một hàm dùng chung. Nếu để
 * phép đọc trong đó thì `page.tsx` buộc phải `fetch("/api/tasks")` từ chính máy chủ của mình: thêm
 * một vòng mạng, thêm một lần xác thực lại cookie, và thêm một chỗ để hai đường trả về hai hình
 * dạng khác nhau.
 *
 * Vì vậy: **Server Component đọc `lib/`, KHÔNG tự gọi API của chính nó.**
 *
 * ── VÀ VÌ SAO PHÉP GHI CŨNG Ở ĐÂY, KHÔNG Ở `route.ts` ────────────────────────────────────
 * Cùng một lý do, chỉ khác chiều. `docs/kien-truc-ung-dung.md` §3 vẽ rìa B bốn bước và bước cuối
 * là `return apiOk(await createTask(session, input))` — nhưng trong một thời gian dài `createTask`
 * KHÔNG tồn tại: toàn bộ nghiệp vụ tạo việc nằm trong `app/api/tasks/route.ts`, và tài liệu mô tả
 * một hàm không có thật.
 *
 * Cái giá của việc để nó ở đó không phải là thẩm mỹ: nghiệp vụ nằm trong `route.ts` **không gọi
 * lại được**. `pnpm seed` không gọi được, một Server Action không gọi được, một job nhập liệu hàng
 * loạt không gọi được — cả ba đều sẽ cần, và cách duy nhất còn lại là chép nghiệp vụ ra lần thứ
 * hai. Route handler giữ đúng bốn việc của rìa B: phiên → quyền → hình dạng dữ liệu → gọi tầng D.
 *
 * ── HAI VIỆC MÀ TẦNG NÀY LÀM, VÀ GIAO DIỆN KHÔNG PHẢI LÀM ────────────────────────────────
 *   1. **Gắn tên người** từ danh bạ Comitor.Account (`lib/account/directory.ts`). Database của
 *      module chỉ giữ `assignee_user_id`; tên thì thuộc Account.
 *   2. **Ký URL tệp đính kèm.** Cột lưu KHOÁ, giao diện cần URL đã ký có hạn.
 *
 * Cả hai đều là phép ghép N-1, và làm chúng ở tầng này nghĩa là làm MỘT LẦN cho cả trang thay vì
 * một lần cho mỗi dòng.
 */

/**
 * Hình dạng bản ghi Prisma mà `toTaskView` cần. Khai tường minh thay vì dùng kiểu Prisma sinh ra:
 * kiểu đó đổi theo lược đồ và kéo cả quan hệ lồng nhau vào chữ ký hàm.
 */
interface TaskRow {
  id: string;
  code: string;
  title: string;
  summary: string;
  projectId: string;
  assigneeUserId: string | null;
  status: string;
  priority: string;
  dueDate: Date;
  updatedAt: Date;
  estimateMinutes: number;
  attachmentKey: string | null;
  attachmentName: string | null;
  project: { name: string };
}

/**
 * `@db.Date` của Prisma vẫn về dưới dạng `Date` với giờ 00:00 **UTC** — nên cắt phần ngày phải cắt
 * theo UTC. `toISOString().slice(0, 10)` là đúng ở ĐÂY và chỉ ở đây, vì giá trị vốn dĩ đã là UTC
 * thuần. (Đừng bê khuôn này sang chỗ khác — xem `lib/today.ts`.)
 */
function toIsoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Trạng thái "quá hạn" là SUY RA, không phải một giá trị lưu trong cột.
 *
 * ⚠ Đây là quyết định đáng nhớ. Lưu `"overdue"` vào cột `status` nghĩa là phải có một tiến trình
 * nào đó chạy hằng đêm để đổi nó — và mọi bản ghi sẽ SAI trong khoảng thời gian giữa lúc quá hạn
 * và lúc tiến trình chạy, kể cả khi tiến trình đó chưa bao giờ được viết. Suy tại chỗ đọc thì con
 * số luôn đúng và không có gì phải bảo trì.
 *
 * Đổi lại: KHÔNG lọc/sắp xếp được theo "overdue" ở tầng SQL. Với một module ở quy mô này thì đó là
 * cái giá đúng; khi bảng lên hàng trăm nghìn dòng thì phép lọc phải chuyển thành điều kiện
 * `due_date < :today AND status <> 'done'` ngay trong truy vấn.
 */
function deriveStatus(status: string, dueDate: string, today: string): TaskStatus {
  const value = status as TaskStatus;
  if (value !== "done" && isOverdue(dueDate, today)) return "overdue";
  return value;
}

async function toTaskViews(rows: TaskRow[], workspaceId: string, timeZone: string): Promise<TaskView[]> {
  const [directory, attachmentUrls] = await Promise.all([
    memberDirectory(workspaceId),
    toDisplayUrls(rows.map((row) => row.attachmentKey))
  ]);
  /*
   * ⚠ `timeZone` là THAM SỐ BẮT BUỘC, không phải giá trị mặc định — và đó là chủ ý.
   *
   * `deriveStatus` quyết định một việc có "quá hạn" hay không, và từ 05.09.2026 câu đó được trả lời
   * theo lịch của NGƯỜI XEM (xem `lib/i18n/config.ts`). Một tham số có mặc định sẽ để mọi chỗ gọi
   * quên nó mà vẫn biên dịch sạch, và cái quên ấy hiện ra dưới dạng một cột "quá hạn" sai lệch tối
   * đa một ngày — thứ không ai truy ngược về một múi giờ.
   *
   * ⚠ Và KHÔNG đọc phiên ở đây. `lib/*.ts` phải gọi được từ script và job nền, nơi không có
   * `cookies()` lẫn `getSession()`; kéo phiên vào đây là mở một cửa thứ ba cho bản ghi đi vào app.
   * Múi giờ đi xuống bằng tham số, từ hai cửa hợp lệ: `page.tsx` và route handler.
   */
  const today = todayIso(timeZone);

  return rows.map((row, index) => {
    const dueDate = toIsoDay(row.dueDate);
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      summary: row.summary,
      projectId: row.projectId,
      projectName: row.project.name,
      assigneeUserId: row.assigneeUserId,
      assigneeName: row.assigneeUserId ? (directory.get(row.assigneeUserId)?.name ?? null) : null,
      assigneeAvatarUrl: row.assigneeUserId ? (directory.get(row.assigneeUserId)?.avatarUrl ?? null) : null,
      /* Có chủ nhưng tra không ra tên — KHÁC hẳn chưa giao. Xem `TaskView.assigneeUnknown`. */
      assigneeUnknown: row.assigneeUserId !== null && !directory.has(row.assigneeUserId),
      status: deriveStatus(row.status, dueDate, today),
      priority: row.priority as TaskPriority,
      dueDate,
      updatedAt: row.updatedAt.toISOString(),
      estimateMinutes: row.estimateMinutes,
      attachmentUrl: attachmentUrls[index] ?? null,
      attachmentName: row.attachmentName
    };
  });
}

const TASK_SELECT = {
  id: true,
  code: true,
  title: true,
  summary: true,
  projectId: true,
  assigneeUserId: true,
  status: true,
  priority: true,
  dueDate: true,
  updatedAt: true,
  estimateMinutes: true,
  attachmentKey: true,
  attachmentName: true,
  project: { select: { name: true } }
} as const;

/**
 * MỌI công việc của một không gian làm việc.
 *
 * ⚠ Cố ý KHÔNG phân trang ở tầng SQL. Bảng `/tasks` lọc, sắp xếp và phân trang **ở trình duyệt**
 * (`lib/core/task-filter.ts`) để mọi thao tác đó tức thì và không tốn một vòng mạng nào — đúng cho
 * quy mô một không gian làm việc (vài trăm việc). Ghi ra đây vì đó là ngưỡng phải theo dõi: khi
 * một khách hàng vượt vài nghìn việc, phép lọc phải chuyển xuống SQL, và lúc đó `TaskFilter` là
 * thứ dịch được thẳng thành `where` — nó vốn đã là dữ liệu thuần chứ không phải mã.
 */
/**
 * ⚠ Bọc `cache()` của React — nó gộp mọi lời gọi CÙNG MỘT lượt render thành một truy vấn.
 *
 * Không có nó thì `/` chạy `listTasks` HAI lần mỗi lượt: một lần ở `app/(shell)/layout.tsx` (dựng
 * dữ liệu cho ⌘K) và một lần ở `page.tsx`. Layout của một route group chạy TRƯỚC mọi page trong
 * nhóm đó, nên chi phí ấy trả ở mọi trang chứ không riêng trang chủ.
 *
 * ⚠ `cache()` chỉ có nghĩa TRONG một request. Mã chạy ngoài request (job nền, `pnpm seed`) gọi nó
 * vẫn đúng, chỉ là không gộp được gì — xem ghi chú ở `lib/account/directory.ts`.
 */
export const listTasks = cache(async (workspaceId: string, timeZone: string): Promise<TaskView[]> => {
  const rows = await prisma.task.findMany({
    where: { workspaceId },
    select: TASK_SELECT,
    orderBy: { code: "asc" }
  });
  return toTaskViews(rows, workspaceId, timeZone);
});

export async function getTask(workspaceId: string, id: string, timeZone: string): Promise<TaskView | null> {
  const row = await prisma.task.findFirst({ where: { workspaceId, id }, select: TASK_SELECT });
  if (!row) return null;
  const [view] = await toTaskViews([row], workspaceId, timeZone);
  return view ?? null;
}

/**
 * Mã sẽ cấp cho công việc kế tiếp.
 *
 * ⚠ Đếm từ mã LỚN NHẤT, không phải từ `COUNT(*)`: dãy mã thật luôn có lỗ (việc bị xoá), mà số bản
 * ghi thì không biết điều đó — dùng `COUNT(*)` là sinh ra một mã TRÙNG với một việc đang tồn tại,
 * và ràng buộc `@@unique([workspaceId, code])` sẽ từ chối ghi ở đúng lúc người dùng bấm Gửi.
 *
 * ⚠ Và đây vẫn KHÔNG phải một bộ cấp mã an toàn dưới ĐUA: hai người bấm Gửi cùng lúc đều đọc ra
 * `CV-026`. Ràng buộc `unique` bắt được ca đó (một người nhận lỗi thay vì hai việc trùng mã), và
 * `createTask` bắt lỗi đó rồi thử lại. Cách chữa tận gốc là một `sequence` của Postgres — đáng làm
 * khi module có lưu lượng thật, không đáng làm ở bản khởi tạo.
 */
export async function nextCodeFor(workspaceId: string): Promise<string> {
  const rows = await prisma.task.findMany({ where: { workspaceId }, select: { code: true } });
  return nextTaskCode(rows.map((row) => row.code));
}

/** Số việc ĐANG MỞ — cùng nguồn với badge thanh bên và thẻ chỉ số ở trang Tổng quan. */
export const countOpenTasks = cache(async (workspaceId: string): Promise<number> => {
  /*
   * ĐẾM Ở DATABASE, không kéo mọi hàng về rồi đếm trong bộ nhớ. Bản trước đọc CẢ bảng chỉ để lấy
   * độ dài một mảng — với 25 việc thì không ai thấy, với 25 nghìn thì đó là vài trăm KB đi qua
   * mạng ở MỌI trang, vì con số này nằm trên huy hiệu của thanh bên.
   *
   * ⚠ Danh sách trạng thái SUY từ `isOpenStatus`, không viết chuỗi `"done"` tại chỗ: hai nguồn sự
   * thật cho cùng một câu hỏi thì sớm muộn nói khác nhau, và chỗ lệch sẽ là một con số trên huy
   * hiệu không khớp với số dòng trong bảng.
   */
  return prisma.task.count({ where: { workspaceId, status: { in: [...OPEN_STATUSES] } } });
});

/** Trạng thái coi là "đang mở" — SUY từ `isOpenStatus` để không có nguồn sự thật thứ hai. */
const OPEN_STATUSES: readonly TaskStatus[] = (
  ["todo", "in-progress", "in-review", "done", "overdue"] satisfies TaskStatus[]
).filter((status) => isOpenStatus(status));

/**
 * Việc theo dự án, tách "đang mở" và "hoàn thành" — dữ liệu của biểu đồ ở trang Tổng quan.
 *
 * SUY từ chính bảng `tasks`, không phải một bảng thống kê riêng: cột ở biểu đồ cộng lại phải đúng
 * bằng số dòng người dùng đếm được ở `/tasks`. Một biểu đồ nói một đằng và một bảng nói một nẻo là
 * thứ không ai có cách nào biết bên nào đúng.
 */
export async function tasksByProject(workspaceId: string): Promise<ProjectTaskBreakdown[]> {
  const projects = await prisma.project.findMany({
    where: { workspaceId },
    select: { code: true, name: true, tasks: { select: { status: true } } },
    orderBy: { code: "asc" }
  });

  return projects.map((project) => ({
    project: project.code,
    projectName: project.name,
    open: project.tasks.filter((task) => isOpenStatus(task.status as TaskStatus)).length,
    done: project.tasks.filter((task) => !isOpenStatus(task.status as TaskStatus)).length
  }));
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * PHÉP GHI
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Số lần thử cấp mã. HAI, không hơn.
 *
 * `nextCodeFor` đọc mã lớn nhất rồi cộng một — hai người bấm Gửi cùng lúc đều đọc ra `CV-026`, và
 * ràng buộc `@@unique([workspaceId, code])` từ chối người thứ hai. Đọc lại một lần là đủ cho cuộc
 * đua giữa HAI người, tức gần như toàn bộ các ca thật.
 *
 * ⚠ Vòng lặp vô hạn ở đây sẽ là một cách rất tốn kém để hỏng: dưới tải cao nó biến một xung đột
 * thành một request quay vòng giữ kết nối database. Hết lượt thì trả `TASK_CODE_TAKEN` — giao diện
 * mời người dùng bấm lại, và lần bấm đó gần như chắc chắn thành công. Chữa tận gốc là một
 * `sequence` của Postgres; xem ghi chú ở `nextCodeFor`.
 */
const MAX_CODE_ATTEMPTS = 2;

/**
 * Lỗi Prisma "vi phạm ràng buộc duy nhất" — nhận diện bằng MÃ, không bằng `instanceof`.
 *
 * `PrismaClientKnownRequestError` là một lớp nằm trong client SINH RA lúc `prisma generate`, nên
 * `instanceof` với nó phụ thuộc vào việc lớp được nạp từ đúng bản build đó. Ở đây ta chỉ cần trả
 * lời một câu hỏi rất hẹp, và mã lỗi `P2002` là hợp đồng công khai, ổn định qua các bản Prisma.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * Tạo một công việc, kèm mọi luật nghiệp vụ và mọi tác dụng phụ của nó.
 *
 * Tham số `session` mang những gì rìa B đã xác lập (người thao tác, không gian làm việc); `input`
 * là dữ liệu ĐÃ QUA `createTaskSchema`. Hàm này KHÔNG kiểm quyền — đó là việc của rìa B, và
 * `pnpm api:check` canh nó.
 *
 * ── THỨ TỰ CÁC BƯỚC LÀ MỘT PHẦN CỦA HỢP ĐỒNG ──────────────────────────────────────────────
 *   1. luật nghiệp vụ (dự án còn mở? người phụ trách còn trong workspace?)
 *   2. ghi — trong MỘT giao dịch
 *   3. tác dụng phụ NUỐT LỖI (xoá nháp, nhật ký, thông báo, thư)
 *
 * Bước 3 đứng sau cùng và không được phép làm hỏng bước 2: công việc ĐÃ được tạo, nên một lá thư
 * không gửi được mà làm cả request đỏ sẽ khiến người dùng bấm Gửi lần nữa và ra hai bản ghi.
 */
export async function createTask(session: AccountSession, input: CreateTaskInput): Promise<TaskView> {
  const workspaceId = session.workspace.id;

  const [settings, directory] = await Promise.all([getAppSettings(workspaceId), requireMemberDirectory(workspaceId)]);

  /*
   * ── LUẬT NGHIỆP VỤ, KIỂM TRƯỚC KHI GHI ────────────────────────────────────────────────────
   * Bốn phép kiểm dưới đây đều có thể diễn đạt bằng khoá ngoại hoặc trigger, và cố ý KHÔNG làm vậy:
   * một `Restrict` của Prisma trả về một lỗi nói về TÊN CỘT, còn ở đây mỗi ca có một mã riêng để
   * giao diện nói được đúng một câu người dùng làm được gì với nó.
   */
  const project = await prisma.project.findFirst({
    where: { workspaceId, id: input.projectId },
    select: { status: true }
  });
  if (!project) throw ApiError.notFound(ERROR_CODES.PROJECT_NOT_FOUND, "Project not found in this workspace.");
  if (project.status === "completed") {
    throw new ApiError(409, ERROR_CODES.PROJECT_CLOSED, "Project is closed and does not accept new tasks.");
  }

  if (input.assigneeUserId !== null && !directory.has(input.assigneeUserId)) {
    throw new ApiError(422, ERROR_CODES.ASSIGNEE_NOT_IN_WORKSPACE, "Assignee is not a member of this workspace.");
  }

  /*
   * Người theo dõi được LỌC, không bị từ chối: một người vừa rời không gian làm việc giữa lúc biểu
   * mẫu đang mở không đáng để cả lần tạo việc thất bại — họ chỉ là người nhận thông báo. Người phụ
   * trách thì ngược lại: giao việc cho người không còn ở đây là tạo một công việc không ai làm.
   */
  const watcherUserIds = [...new Set(input.watcherUserIds)].filter((userId) => directory.has(userId));

  /*
   * "Chuyển cho đối tác" đưa việc ra NGOÀI không gian làm việc, nên nó bị khoá sau cài đặt
   * `allow_public_link`. Biểu mẫu đã làm mờ mục đó kèm lý do; đây là chốt thật.
   */
  if (input.requestType === "external" && !settings.data["public-link"]) {
    throw ApiError.validation("External hand-off is disabled for this workspace.", { fields: ["requestType"] });
  }

  const needsApproval = input.needsApproval;
  const approvalFlowId = needsApproval ? input.approvalFlowId : null;
  if (needsApproval && (approvalFlowId === null || !APPROVAL_FLOWS.includes(approvalFlowId))) {
    throw ApiError.validation("Unknown approval flow.", { fields: ["approvalFlowId"] });
  }

  const notifyChannels = [...new Set(input.notifyChannels)].filter((channel) => NOTIFY_CHANNELS.includes(channel));

  /*
   * ISO chỉ-có-ngày → `Date` ở nửa đêm **UTC**, vì cột là `@db.Date` và `lib/tasks.ts` đọc ngược ra
   * bằng `toISOString().slice(0, 10)`. Đi qua `parseIsoDate` chứ không `new Date("YYYY-MM-DD")`:
   * chuỗi đó tình cờ cũng cho UTC, nhưng dùng nó ở đây là dạy khuôn sai cho chỗ tiếp theo, nơi giá
   * trị sẽ được đọc lại bằng `getFullYear()` theo giờ ĐỊA PHƯƠNG và lùi một ngày.
   */
  const dueParts = parseIsoDate(input.dueDate);
  if (!dueParts) throw ApiError.validation("Due date is not a valid calendar date.", { fields: ["dueDate"] });
  const dueDate = new Date(Date.UTC(dueParts.year, dueParts.month - 1, dueParts.day));

  /*
   * ── RANH GIỚI GIAO DỊCH ───────────────────────────────────────────────────────────────────
   * Luật để quyết cái gì vào trong `$transaction` và cái gì ở ngoài, viết một lần cho cả repo:
   *
   *   TRONG giao dịch  = thứ mà một nửa là DỮ LIỆU SAI.
   *   NGOÀI giao dịch  = thứ mà một nửa là CHẤP NHẬN ĐƯỢC.
   *
   * Công việc và danh sách người theo dõi của nó là một: một công việc tồn tại mà không ai theo
   * dõi nó là một bản ghi sai — người phụ trách sẽ không nhận được gì ở mọi thay đổi sau này, và
   * không có gì trên màn hình cho thấy điều đó. Chúng vào TRONG.
   *
   * Nhật ký, thông báo, lá thư thì ở NGOÀI: việc đã được tạo, và một lá thư không gửi được không
   * làm bản ghi sai đi. Nếu chúng ở trong, một SMTP chậm sẽ giữ khoá ghi của hai bảng, và một SMTP
   * hỏng sẽ ROLLBACK một công việc mà người dùng vừa thấy nút "Gửi" quay xong.
   *
   * ⚠ Vòng thử lại mã nằm NGOÀI giao dịch, cố ý. Bên trong một giao dịch, `P2002` làm cả giao dịch
   * hỏng — thử lại bên trong là thử lại trên một giao dịch đã chết.
   */
  let created: { id: string; code: string } | null = null;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = await nextCodeFor(workspaceId);
    try {
      created = await prisma.$transaction(async (tx) => {
        const row = await tx.task.create({
          data: {
            workspaceId,
            code,
            title: input.title,
            summary: input.summary,
            projectId: input.projectId,
            assigneeUserId: input.assigneeUserId,
            requesterUserId: session.user.id,
            /*
             * Việc mới LUÔN ở `todo`. Trạng thái không nằm trong thân request, và đó là chủ ý: cho
             * chỗ gọi chọn `done` ngay lúc tạo là mở một đường ghi bỏ qua toàn bộ dòng đời công việc
             * — và bỏ qua cả nhật ký hoạt động, thứ đáng ra phải ghi lại từng bước chuyển.
             * (`overdue` thì càng không: nó được SUY ra lúc đọc, không lưu — xem phần đầu file.)
             */
            status: "todo",
            priority: input.priority,
            dueDate,
            estimateMinutes: input.estimateMinutes,
            requestType: input.requestType,
            needsApproval,
            approvalFlowId,
            notifyChannels,
            remindBeforeDue: input.remindBeforeDue,
            syncWithCalendar: input.syncWithCalendar
          },
          select: { id: true, code: true }
        });

        if (watcherUserIds.length > 0) {
          await tx.taskWatcher.createMany({
            data: watcherUserIds.map((userId) => ({ taskId: row.id, userId }))
          });
        }

        return row;
      });
      break;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (attempt === MAX_CODE_ATTEMPTS - 1) {
        throw new ApiError(409, ERROR_CODES.TASK_CODE_TAKEN, "Task code was taken by a concurrent request.");
      }
    }
  }
  if (!created) throw new ApiError(409, ERROR_CODES.TASK_CODE_TAKEN, "Could not allocate a task code.");
  /*
   * Gán sang `const` sau phép kiểm: TypeScript BỎ phép thu hẹp kiểu của một biến `let` khi biến đó
   * được đọc bên trong một closure (`map` ngay dưới), vì nó không chứng minh được biến chưa bị gán
   * lại. Đây là cách gọn nhất để giữ `strictNullChecks` mà không phải dùng `!`.
   */
  const task = created;

  /*
   * Bản nháp đã hoàn thành nhiệm vụ của nó. Giữ lại thì lần mở `/tasks/new` kế tiếp biểu mẫu tự
   * điền lại đúng công việc VỪA TẠO, và người dùng rất dễ bấm Gửi thêm một lần.
   *
   * NUỐT LỖI: đây là dọn dẹp đi kèm, không phải thao tác chính. Cùng chính sách với `recordActivity`
   * và `sendMail` bên dưới, và cùng một lý do.
   */
  try {
    await clearTaskDraft(workspaceId, session.user.id);
  } catch (error) {
    console.error("[task-draft] KHONG XOA DUOC sau khi tao viec", error);
  }

  /*
   * Nhật ký chỉ ghi khi không gian làm việc bật nó. Phép kiểm nằm ở NƠI GỌI chứ không trong
   * `recordActivity`, để hàm đó không phải đọc cài đặt ở mọi thao tác ghi — xem `lib/activities.ts`.
   */
  if (settings.data["activity-log"]) {
    await recordActivity({
      workspaceId,
      kind: "created",
      actorUserId: session.user.id,
      targetCode: task.code,
      targetTitle: input.title
    });
  }

  /*
   * ── BÁO CHO NGƯỜI PHỤ TRÁCH ───────────────────────────────────────────────────────────────
   * KHÔNG báo khi người phụ trách chính là người tạo. Với cài đặt `autoAssignToMe` bật thì MỌI việc
   * đều tự giao cho chính mình, nên bỏ nhánh này đi là mỗi lần tạo việc lại tự gửi cho mình một
   * thông báo và một lá thư về thứ mình vừa gõ xong — cách nhanh nhất khiến người dùng tắt hết
   * thông báo, kể cả những cái họ cần.
   */
  const assigneeUserId = input.assigneeUserId;
  const assignee = assigneeUserId === null ? undefined : directory.get(assigneeUserId);

  /*
   * ── KÊNH NGƯỜI DÙNG CHỌN, KHÔNG PHẢI "GỬI HẾT" ────────────────────────────────────────────
   * Bản trước gác cả hai đường bằng MỘT điều kiện `settings.notifications.assigned` và không hề
   * đọc `notifyChannels` — nên bỏ tích ô "Email" ở biểu mẫu thì thư VẪN gửi. Đo được trên đường
   * thật ngày 04/09/2026. Luật và lý do đầy đủ ở `lib/core/notify-channels.ts`.
   */
  const delivery = resolveNotifyDelivery({
    channels: notifyChannels,
    workspaceAllows: settings.notifications.assigned
  });

  if (assignee && assigneeUserId !== session.user.id) {
    if (delivery.inApp) {
      await notify({
        workspaceId,
        userId: assignee.id,
        kind: "assignment",
        actorUserId: session.user.id,
        taskCode: task.code,
        taskTitle: input.title
      });
    }

    if (delivery.email) {
      /*
       * ⚠ Ngôn ngữ của lá thư là ngôn ngữ của NGƯỜI NHẬN, không phải của người đang bấm nút — xem
       * `lib/mail.ts`. Hôm nay Comitor.Account chưa trả về `locale` của từng thành viên nên
       * `toMailLocale(undefined)` rơi về mặc định; **đây là dòng phải sửa** khi
       * `AccountMember` có thêm trường đó, và không có dòng nào khác phải sửa theo.
       */
      const mailLocale = toMailLocale(undefined);
      await sendMail({
        to: assignee.email,
        ...mailTemplates.taskAssigned(mailLocale, {
          actorName: session.user.name,
          taskCode: task.code,
          taskTitle: input.title,
          dueDate: formatIsoDateFor(mailLocale, input.dueDate),
          /*
           * Link ghép từ `env.appUrl` — một chỗ, đã kiểm https và đã cắt dấu `/` cuối. Ghép tay ở đây
           * là bắt đầu một bộ sưu tập URL gốc rải rác, và bản sai sẽ là bản nằm trong thư đã gửi đi.
           *
           * ⚠ Trỏ tới ĐÚNG VIỆC, không trỏ vào danh sách. Câu ngay trên link là "Mở công việc:", nên
           * một liên kết dẫn tới bảng 27 dòng là bắt người nhận đi tìm lại đúng thứ lá thư vừa nói
           * tên. `lib/reminders.ts` đã ghép đúng kiểu này từ đầu; bản trước ở đây thiếu id và lệch
           * với nó — hai lá thư của cùng một app dẫn tới hai nơi khác nhau cho cùng một việc.
           */
          url: `${env.appUrl}/tasks/${encodeURIComponent(task.id)}`
        })
      });
    }
  }

  /*
   * Đọc lại qua `getTask` thay vì dựng `TaskView` từ `input`: hình dạng trả về phải giống HỆT thứ
   * `/tasks` đang đọc — cùng phép suy trạng thái quá hạn, cùng phép gắn tên người, cùng phép ký URL
   * tệp đính kèm. Dựng tay ở đây là nuôi một bản `TaskView` thứ hai sẽ lệch ở lần đầu tiên ai đó
   * thêm một trường.
   */
  const view = await getTask(workspaceId, task.id, session.user.timezone);
  if (!view) throw ApiError.notFound(ERROR_CODES.TASK_NOT_FOUND, "Task disappeared right after it was created.");

  return view;
}

/**
 * Sửa một công việc. Chỉ những trường có mặt trong `input` được ghi.
 *
 * ⚠ **`id` ĐẾN TỪ URL**, khác hẳn hai đường ghi đã có (`POST` tạo mới và `PUT` ghi đè singleton,
 * cả hai lấy `workspaceId` từ phiên và không nhận id nào từ ngoài). Đây là hình dạng sinh ra IDOR,
 * và luật của repo cho nó là:
 *
 *   · truy vấn LUÔN là `findFirst({ where: { workspaceId, id } })`, không bao giờ `findUnique({ id })`;
 *   · bản ghi của workspace khác trả **404, KHÔNG phải 403** — 403 xác nhận rằng bản ghi đó tồn
 *     tại, và với một id đoán được thì đó là một đường liệt kê dữ liệu của khách hàng khác.
 *
 * `pnpm tenant:check` canh vế thứ nhất. Vế thứ hai không cổng nào canh được — nó là một quyết định
 * về MÃ LỖI, và chỗ duy nhất nó sống là dòng này cùng checklist ở `docs/kien-truc-ung-dung.md` §7.
 */
export async function updateTask(session: AccountSession, taskId: string, input: UpdateTaskInput): Promise<TaskView> {
  const workspaceId = session.workspace.id;

  const current = await prisma.task.findFirst({
    where: { workspaceId, id: taskId },
    select: { id: true, code: true, title: true, status: true, assigneeUserId: true }
  });
  if (!current) throw ApiError.notFound(ERROR_CODES.TASK_NOT_FOUND, "Task not found in this workspace.");

  const [settings, directory] = await Promise.all([getAppSettings(workspaceId), requireMemberDirectory(workspaceId)]);

  /* Cùng bốn luật nghiệp vụ của đường tạo — chúng thuộc về TÀI NGUYÊN, không thuộc về một lệnh. */
  if (input.projectId !== undefined) {
    const project = await prisma.project.findFirst({
      where: { workspaceId, id: input.projectId },
      select: { status: true }
    });
    if (!project) throw ApiError.notFound(ERROR_CODES.PROJECT_NOT_FOUND, "Project not found in this workspace.");
    if (project.status === "completed") {
      throw new ApiError(409, ERROR_CODES.PROJECT_CLOSED, "Project is closed and does not accept tasks.");
    }
  }

  if (input.assigneeUserId !== undefined && input.assigneeUserId !== null && !directory.has(input.assigneeUserId)) {
    throw new ApiError(422, ERROR_CODES.ASSIGNEE_NOT_IN_WORKSPACE, "Assignee is not a member of this workspace.");
  }

  let dueDate: Date | undefined;
  if (input.dueDate !== undefined) {
    const parts = parseIsoDate(input.dueDate);
    if (!parts) throw ApiError.validation("Due date is not a valid calendar date.", { fields: ["dueDate"] });
    dueDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  }

  await prisma.task.update({
    where: { workspaceId_code: { workspaceId, code: current.code } },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(input.estimateMinutes !== undefined ? { estimateMinutes: input.estimateMinutes } : {})
    }
  });

  /*
   * NGOÀI giao dịch, cùng luật với đường tạo: nhật ký là thứ mà một nửa vẫn chấp nhận được. Và
   * `kind` được chọn theo Ý NGHĨA của thay đổi, không theo "có gì đổi" — một nhật ký toàn dòng
   * "đã cập nhật" thì không ai đọc.
   */
  if (settings.data["activity-log"]) {
    const kind: ActivityKind =
      input.status === "done"
        ? "completed"
        : input.status === "in-review"
          ? "review-requested"
          : input.assigneeUserId !== undefined && input.assigneeUserId !== current.assigneeUserId
            ? "assigned"
            : "updated";
    await recordActivity({
      workspaceId,
      kind,
      actorUserId: session.user.id,
      targetCode: current.code,
      targetTitle: input.title ?? current.title,
      /*
       * ⚠ `targetUserId` là ĐỊNH DANH, không phải tên. `activities` giữ giá trị cho những thứ sẽ
       * biến mất (mã việc, tiêu đề lúc đó) nhưng giữ ID cho người — vì người thì KHÔNG biến mất,
       * họ chỉ đổi tên, và một cái tên chép vào đây sẽ cũ dần. Câu "đã giao việc cho {target}"
       * được ghép ở tầng hiển thị từ danh bạ.
       */
      ...(kind === "assigned" ? { targetUserId: input.assigneeUserId ?? null } : {})
    });
  }

  const view = await getTask(workspaceId, taskId, session.user.timezone);
  if (!view) throw ApiError.notFound(ERROR_CODES.TASK_NOT_FOUND, "Task disappeared while it was being updated.");
  return view;
}

/**
 * Xoá một công việc — **XOÁ CỨNG**, có chủ đích.
 *
 * ── VÌ SAO KHÔNG XOÁ MỀM (`deletedAt`) ────────────────────────────────────────────────────
 * Xoá mềm nghe an toàn hơn, và với repo này nó ĐẮT hơn nhiều so với vẻ ngoài:
 *
 *  1. Nó thêm một bất biến THỨ HAI vào mọi truy vấn (`deletedAt IS NULL`), song song với
 *     `workspaceId`. `pnpm tenant:check` canh cái thứ nhất; không cổng nào canh cái thứ hai, và
 *     quên nó thì bản ghi đã xoá HIỆN LẠI — một lỗi tệ hơn cái nó định tránh.
 *  2. Ràng buộc `@@unique([workspaceId, code])` chặn ngay: xoá `CV-014` rồi tạo việc mới sẽ đụng
 *     mã của bản ghi đã xoá. Chữa nó nghĩa là đưa `deletedAt` vào khoá duy nhất — và khi đó xoá
 *     mềm hai lần trong cùng một mili-giây lại đụng nhau.
 *  3. Nó KHÔNG giải quyết đúng vấn đề mà người ta tưởng: câu hỏi thật là *"ai đã xoá, lúc nào"*,
 *     và câu đó được trả lời bằng `activities` — thứ SỐNG SÓT sau khi bản ghi biến mất, vì bảng đó
 *     giữ giá trị chứ không giữ khoá ngoại.
 *
 * Đường nâng cấp khi một module thật cần "thùng rác": thêm `deletedAt` **và** một cột `code` phụ
 * được giải phóng lúc xoá, **và** một phép kiểm tĩnh song sinh với `tenant:check`. Ba thứ, không
 * phải một cột — hãy quyết định như vậy chứ đừng trượt vào nó.
 *
 * ⚠ Tệp đính kèm phải bị xoá THEO. Bucket không biết gì về bảng này: bỏ sót là để lại một object
 * trả tiền lưu trữ vĩnh viễn mà không truy vấn nào tìm ra nữa.
 */
export async function deleteTask(session: AccountSession, taskId: string): Promise<void> {
  const workspaceId = session.workspace.id;

  const task = await prisma.task.findFirst({
    where: { workspaceId, id: taskId },
    select: { id: true, code: true, title: true, attachmentKey: true }
  });
  if (!task) throw ApiError.notFound(ERROR_CODES.TASK_NOT_FOUND, "Task not found in this workspace.");

  /*
   * `TaskWatcher` đi theo nhờ `onDelete: Cascade` ở tầng database — đã kiểm thật, không phải suy
   * từ lược đồ. Vì vậy KHÔNG cần `$transaction` ở đây: đúng một câu lệnh ghi.
   */
  await prisma.task.delete({ where: { workspaceId_code: { workspaceId, code: task.code } } });

  const settings = await getAppSettings(workspaceId);
  if (settings.data["activity-log"]) {
    await recordActivity({
      workspaceId,
      kind: "deleted",
      actorUserId: session.user.id,
      targetCode: task.code,
      targetTitle: task.title
    });
  }

  /*
   * SAU khi hàng đã mất, và NUỐT LỖI: một object mồ côi là chuyện dọn được sau, còn một request đỏ
   * sau khi bản ghi đã biến mất thì bắt người dùng bấm Xoá lần nữa cho một thứ không còn ở đó.
   */
  try {
    await deleteObject(task.attachmentKey);
  } catch (error) {
    console.error("[storage] KHÔNG XOÁ ĐƯỢC tệp đính kèm của việc đã xoá", { code: task.code }, error);
  }
}

/**
 * Gắn (hoặc thay) tệp đính kèm của một công việc.
 *
 * ⚠ Nhận **byte đã đọc xong**, không nhận `Request`. Việc quyết định có đọc thân request hay không
 * là của rìa B (nó xem `Content-Length` trước), còn tầng này chỉ làm việc với nội dung đã có —
 * nhờ vậy nó gọi lại được từ một job nhập liệu hàng loạt, và test được mà không cần dựng HTTP.
 */
export async function setTaskAttachment(
  session: AccountSession,
  taskId: string,
  file: { bytes: Uint8Array; contentType: string; name: string }
): Promise<TaskView> {
  const workspaceId = session.workspace.id;

  if (!storageEnabled) {
    throw new ApiError(503, ERROR_CODES.STORAGE_NOT_CONFIGURED, "File storage is not configured.");
  }

  const task = await prisma.task.findFirst({
    where: { workspaceId, id: taskId },
    select: { id: true, code: true, attachmentKey: true }
  });
  if (!task) throw ApiError.notFound(ERROR_CODES.TASK_NOT_FOUND, "Task not found in this workspace.");

  /*
   * ── HAI PHÉP KIỂM, VÀ CHÚNG KHÔNG THAY THẾ NHAU ────────────────────────────────────────
   * `checkAttachment` đọc kích thước thật cùng MIME do client KHAI — nó loại sớm những ca hiển
   * nhiên sai. `sniffImageType` đọc BYTE ĐẦU — nó là phép kiểm duy nhất nói được nội dung thật.
   *
   * ⚠ Và kiểu ghi vào object là kiểu ĐO ĐƯỢC, không phải kiểu được khai. Ghi theo lời khai nghĩa
   * là trình duyệt sẽ render nội dung đó từ tên miền của ứng dụng khi người dùng mở URL đã ký —
   * với một tệp HTML cải trang, đó là XSS trên chính origin của mình.
   */
  const declared = checkAttachment({ size: file.bytes.byteLength, type: file.contentType });
  if (declared) throw new ApiError(422, declared, "Attachment rejected.");

  const sniffed = sniffImageType(file.bytes);
  if (!sniffed) {
    throw new ApiError(422, ERROR_CODES.ATTACHMENT_TYPE_INVALID, "File content is not a supported image.");
  }

  const key = attachmentObjectKey({
    taskId: task.id,
    contentType: sniffed,
    /*
     * Phần ngẫu nhiên phải KHÔNG ĐOÁN ĐƯỢC, không chỉ là duy nhất: khoá đoán được cộng với một URL
     * ký nhầm phạm vi là một đường liệt kê tệp của cả không gian làm việc. `randomUUID` dùng nguồn
     * ngẫu nhiên mật mã; `Date.now()` hay một bộ đếm thì không.
     */
    random: randomUUID().replaceAll("-", "")
  });

  await putPrivateObject(key, file.bytes, sniffed);

  const previousKey = task.attachmentKey;
  await prisma.task.update({
    where: { workspaceId_code: { workspaceId, code: task.code } },
    data: { attachmentKey: key, attachmentName: safeAttachmentName(file.name) }
  });

  /*
   * Xoá tệp CŨ sau khi cột đã trỏ sang tệp mới, và nuốt lỗi. Thứ tự này là chủ ý: xoá trước thì
   * một lần ghi database hỏng để lại một công việc trỏ vào object không còn — tức ảnh vỡ trên màn
   * hình. Xoá sau thì ca xấu nhất là một object mồ côi, và đó là chuyện dọn được.
   */
  if (previousKey && previousKey !== key) {
    try {
      await deleteObject(previousKey);
    } catch (error) {
      console.error("[storage] KHÔNG XOÁ ĐƯỢC tệp đính kèm cũ", { code: task.code }, error);
    }
  }

  const view = await getTask(workspaceId, task.id, session.user.timezone);
  if (!view) throw ApiError.notFound(ERROR_CODES.TASK_NOT_FOUND, "Task disappeared during upload.");
  return view;
}

/** Gỡ tệp đính kèm. Không có tệp cũng KHÔNG lỗi — gỡ một thứ không có là kết quả người dùng muốn. */
export async function clearTaskAttachment(session: AccountSession, taskId: string): Promise<TaskView> {
  const workspaceId = session.workspace.id;

  const task = await prisma.task.findFirst({
    where: { workspaceId, id: taskId },
    select: { id: true, code: true, attachmentKey: true }
  });
  if (!task) throw ApiError.notFound(ERROR_CODES.TASK_NOT_FOUND, "Task not found in this workspace.");

  await prisma.task.update({
    where: { workspaceId_code: { workspaceId, code: task.code } },
    data: { attachmentKey: null, attachmentName: null }
  });

  try {
    await deleteObject(task.attachmentKey);
  } catch (error) {
    console.error("[storage] KHÔNG XOÁ ĐƯỢC tệp đính kèm", { code: task.code }, error);
  }

  const view = await getTask(workspaceId, task.id, session.user.timezone);
  if (!view) throw ApiError.notFound(ERROR_CODES.TASK_NOT_FOUND, "Task disappeared.");
  return view;
}

/**
 * Việc cho bảng lệnh ⌘K — cắt ở TẦNG TRUY VẤN, không cắt sau khi đã đọc cả bảng.
 *
 * ── VÌ SAO KHÔNG DÙNG `listTasks(...).slice(0, 50)` ─────────────────────────────────────
 * Vì `listTasks` đi qua `toTaskViews`, và hàm đó **KÝ MỘT URL S3 cho mọi tệp đính kèm** rồi gắn
 * tên người từ danh bạ. Với `slice` ở phía sau, cả hai việc đó được làm cho TOÀN BỘ bảng rồi vứt
 * đi phần thừa — ở MỌI trang, vì layout của `(shell)` chạy trước mọi page.
 *
 * Bảng lệnh cần đúng sáu trường và không cần trường nào trong hai thứ trên.
 *
 * ⚠ Đây vẫn là một danh sách CẮT SẴN, không phải tìm kiếm. Ngưỡng phải theo dõi: với vài nghìn
 * việc, 50 dòng đầu theo mã sẽ không chứa thứ người dùng đang gõ. Đường đi tiếp là một endpoint
 * tìm kiếm mà bảng lệnh gọi khi gõ — và hàm này là chỗ duy nhất phải sửa.
 */
export const listCommandTasks = cache(
  async (workspaceId: string, timeZone: string, limit = 50): Promise<CommandTaskRow[]> => {
    const rows = await prisma.task.findMany({
      where: { workspaceId },
      select: { id: true, code: true, title: true, status: true, dueDate: true, projectId: true, assigneeUserId: true },
      orderBy: { updatedAt: "desc" },
      take: limit
    });

    const [directory, projects] = await Promise.all([
      memberDirectory(workspaceId),
      prisma.project.findMany({ where: { workspaceId }, select: { id: true, name: true } })
    ]);
    const projectName = new Map(projects.map((project) => [project.id, project.name]));
    const today = todayIso(timeZone);

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      projectName: projectName.get(row.projectId) ?? "",
      assigneeName: row.assigneeUserId ? (directory.get(row.assigneeUserId)?.name ?? null) : null,
      status: deriveStatus(row.status, row.dueDate.toISOString().slice(0, 10), today)
    }));
  }
);

/** Hình dạng tối thiểu mà bảng lệnh ⌘K cần — sáu trường, không hơn. */
export interface CommandTaskRow {
  id: string;
  code: string;
  title: string;
  projectName: string;
  assigneeName: string | null;
  status: TaskStatus;
}
