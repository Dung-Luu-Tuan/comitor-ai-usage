/**
 * Dữ liệu phát triển.
 *
 * Chạy: `pnpm seed`.
 *
 * ⚠ **BA ĐIỀU KIỆN, KHÔNG PHẢI MỘT.** Postgres đang chạy · migration đã áp · **và Comitor.Account
 * phục vụ được, với `COMITOR_SEED_WORKSPACE_SLUG` trỏ vào một workspace CÓ THẬT bên đó**. Điều
 * kiện thứ ba hay bị bỏ sót vì nó không hiển nhiên từ tên lệnh: script này HỎI Account để lấy
 * `workspace_id` (`/api/entitlements/{slug}`) và id người thật (danh bạ) — nó không tự bịa id, vì
 * lược đồ ở đây cố ý KHÔNG có bảng người dùng nào để mà seed.
 *
 * ⚠ Điều kiện thứ ba KHÔNG có nghĩa là "phải chạy Account tại chỗ". Mặc định của repo là bản dev
 * ONLINE (`https://account.dev.comitor.ai`) đã seed sẵn, và slug của nó là `thienminh`; một
 * Account chạy tại chỗ theo seed mặc định thì là `acme`. Trỏ sang bản này mà để slug của bản kia
 * là seed dừng ở `404 Không tìm thấy không gian làm việc` — thông điệp đúng, nhưng nó nói về slug
 * chứ không nói rằng bạn vừa đổi Account.
 *
 * ⚠ Lệnh mang `--conditions=react-server`. `lib/` phía máy chủ có `import "server-only"`, và gói đó
 * NÉM LỖI khi được nạp thiếu điều kiện resolution ấy — với một thông điệp ("This module cannot be
 * imported from a Client Component module") không liên quan gì tới nguyên nhân thật.
 *
 * ── MỌI MỐC THỜI GIAN ĐƯỢC DỜI THEO NGÀY CHẠY ─────────────────────────────────────────────
 * Dữ liệu mẫu dưới đây viết theo một mốc CỐ ĐỊNH (`BASE_TODAY`), rồi cả bộ được dời đi đúng bằng
 * khoảng cách từ mốc đó tới hôm nay. Nhờ vậy quan hệ giữa các mốc được giữ nguyên — việc quá hạn
 * vẫn quá hạn, việc sắp tới hạn vẫn sắp tới hạn — trong khi con số tuyệt đối luôn hợp lý với ngày
 * đang xem.
 *
 * Vì sao đáng làm: bản chỉ-giao-diện trước đây phải khai một hằng `DATASET_NOW` và ràng buộc "mọi
 * mốc phải nằm TRƯỚC nó", vì `<RelativeTime>` đo từ đồng hồ THẬT và một mốc lỡ nằm ở tương lai in
 * ra "2 giờ nữa" — câu vô nghĩa mà `tsc` lẫn Biome đều thấy hợp lệ. Dời cả bộ theo ngày chạy làm
 * ràng buộc đó biến mất: không còn hằng nào để lệch, và bản mẫu không cũ dần theo tháng.
 */

import { PrismaClient } from "@prisma/client";
import { fetchMembers } from "../lib/account/directory";
import { getWorkspaceEntitlements } from "../lib/account/entitlements";
import { PERMISSION_RULES, WORKSPACE_ROLES } from "../lib/catalog/permissions";
import { buildPermissionMatrix } from "../lib/core/permissions";

const prisma = new PrismaClient();

/** Mốc mà mọi ngày bên dưới được viết theo. Đổi nó là dời cả bộ dữ liệu. */
const BASE_TODAY = "2026-08-24";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Khoảng dời, tính bằng NGÀY, từ `BASE_TODAY` tới hôm nay. */
function shiftDays(): number {
  const [y = 0, m = 0, d = 0] = BASE_TODAY.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - base) / MS_PER_DAY);
}

const SHIFT = shiftDays();

/**
 * Ngày chỉ-có-ngày, đã dời. Trả về `Date` ở nửa đêm **UTC** — đúng thứ cột `@db.Date` cần.
 *
 * ⚠ `new Date(iso)` ở đây là AN TOÀN vì ta lập tức chỉ dùng nó qua các hàm `getUTC*`: chuỗi
 * chỉ-có-ngày được ECMAScript hiểu là mốc UTC, và ta cũng đọc lại bằng UTC. Đừng bê khuôn này sang
 * chỗ nào đọc bằng `getDate()` — xem `lib/core/iso-date.ts`.
 */
function day(iso: string): Date {
  return new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + SHIFT * MS_PER_DAY);
}

/** Mốc đầy đủ, đã dời. */
function at(iso: string): Date {
  return new Date(new Date(iso).getTime() + SHIFT * MS_PER_DAY);
}

/**
 * Slug của không gian làm việc mẫu bên Comitor.Account.
 *
 * ⚠ Seed KHÔNG tự bịa `workspace_id` và `user_id` nữa. Chúng phải là **id THẬT do Account cấp**,
 * nếu không thì mọi tên người hiện ra trống (danh bạ tra không thấy id) và `requireWorkspaceAccess`
 * trả về một workspace khác với workspace mà dữ liệu đang khoá theo — bảng rỗng, không lỗi nào.
 *
 * Vì vậy seed HỎI Account: `/api/entitlements/{slug}` cho id workspace, danh bạ cho id người.
 */
const WORKSPACE_SLUG = process.env.COMITOR_SEED_WORKSPACE_SLUG ?? "acme";

const PROJECTS = [
  {
    id: "p-nen-tang",
    code: "NT",
    name: "Nền tảng dùng chung",
    ownerUserId: "u-anh",
    status: "active",
    dueDate: "2026-10-15"
  },
  {
    id: "p-di-dong",
    code: "DD",
    name: "Ứng dụng di động",
    ownerUserId: "u-bao",
    status: "active",
    dueDate: "2026-11-30"
  },
  {
    id: "p-bao-cao",
    code: "BC",
    name: "Bộ báo cáo & thống kê",
    ownerUserId: "u-nam",
    status: "active",
    dueDate: "2026-12-20"
  },
  {
    id: "p-khoi-tao",
    code: "KT",
    name: "Trải nghiệm khởi tạo",
    ownerUserId: "u-ha",
    status: "on-hold",
    dueDate: "2027-01-31"
  },
  {
    id: "p-ha-tang",
    code: "HT",
    name: "Hạ tầng & vận hành",
    ownerUserId: "u-dung",
    status: "completed",
    dueDate: "2026-08-10"
  }
];

/**
 * 25 công việc — đủ để `<DataTable>` + `<TablePagination>` chạy qua nhiều trang với cỡ trang mặc
 * định (20), và đủ đa dạng để thử sắp xếp, lọc theo trạng thái / độ ưu tiên / người phụ trách.
 *
 * ⚠ KHÔNG có bản ghi nào mang `status: "overdue"`. Trạng thái đó được SUY RA lúc đọc từ `dueDate`
 * so với hôm nay (`lib/tasks.ts`), nên ghi nó vào database là dựng một nguồn sự thật thứ hai sẽ
 * lệch ngay hôm sau. Hai việc dưới đây có hạn ĐÃ QUA và trạng thái chưa `done` — chúng sẽ hiện ra
 * "Quá hạn" mà không cần ai ghi chữ đó.
 */
const TASKS = [
  [
    "CV-001",
    "Chuẩn hoá bộ token màu cho toàn hệ sinh thái",
    "p-nen-tang",
    "u-ha",
    "done",
    "high",
    "2026-08-12",
    "2026-08-12T09:20:00+07:00",
    960
  ],
  [
    "CV-002",
    "Dựng khung ứng dụng dùng chung cho sản phẩm mới",
    "p-nen-tang",
    "u-bao",
    "in-progress",
    "urgent",
    "2026-08-28",
    "2026-08-24T08:05:00+07:00",
    1440
  ],
  [
    "CV-003",
    "Viết hướng dẫn đóng góp cho đội sản phẩm",
    "p-nen-tang",
    "u-hang",
    "in-review",
    "medium",
    "2026-08-26",
    "2026-08-23T16:40:00+07:00",
    360
  ],
  [
    "CV-004",
    "Rà soát tương phản màu ở chế độ tối",
    "p-nen-tang",
    "u-ha",
    "in-progress",
    "high",
    "2026-08-29",
    "2026-08-24T07:10:00+07:00",
    480
  ],
  [
    "CV-005",
    "Bổ sung phím tắt cho bảng lệnh nhanh",
    "p-nen-tang",
    "u-bao",
    "todo",
    "low",
    "2026-09-10",
    "2026-08-20T11:25:00+07:00",
    240
  ],
  [
    "CV-006",
    "Thống nhất thông báo lỗi trên toàn bộ biểu mẫu",
    "p-nen-tang",
    "u-hang",
    "todo",
    "high",
    "2026-08-18",
    "2026-08-19T14:00:00+07:00",
    600
  ],
  [
    "CV-007",
    "Tách gói giao diện thành nhiều điểm nhập",
    "p-nen-tang",
    "u-bao",
    "done",
    "medium",
    "2026-08-05",
    "2026-08-06T10:15:00+07:00",
    720
  ],
  [
    "CV-008",
    "Kiểm thử điều hướng bằng bàn phím ở thanh bên",
    "p-nen-tang",
    "u-khanh",
    "in-progress",
    "medium",
    "2026-09-02",
    "2026-08-22T15:30:00+07:00",
    360
  ],
  [
    "CV-009",
    "Gộp bảng màu avatar về một nguồn duy nhất",
    "p-nen-tang",
    "u-ha",
    "todo",
    "low",
    "2026-09-18",
    "2026-08-18T09:00:00+07:00",
    300
  ],
  [
    "CV-010",
    "Thiết kế màn hình danh sách cho bản di động",
    "p-di-dong",
    "u-ha",
    "in-progress",
    "high",
    "2026-09-05",
    "2026-08-23T13:45:00+07:00",
    840
  ],
  [
    "CV-011",
    "Đồng bộ dữ liệu khi thiết bị mất kết nối",
    "p-di-dong",
    "u-dung",
    "todo",
    "urgent",
    "2026-09-12",
    "2026-08-21T17:20:00+07:00",
    1920
  ],
  [
    "CV-012",
    "Tối ưu thời gian mở ứng dụng lần đầu",
    "p-di-dong",
    "u-bao",
    "todo",
    "medium",
    "2026-09-25",
    "2026-08-17T08:50:00+07:00",
    1080
  ],
  [
    "CV-013",
    "Xử lý thông báo đẩy cho việc được giao",
    "p-di-dong",
    "u-dung",
    "todo",
    "high",
    "2026-08-15",
    "2026-08-16T10:05:00+07:00",
    720
  ],
  [
    "CV-014",
    "Kiểm thử trên máy màn hình nhỏ",
    "p-di-dong",
    "u-khanh",
    "todo",
    "low",
    "2026-10-02",
    "2026-08-15T14:35:00+07:00",
    480
  ],
  [
    "CV-015",
    "Chụp ảnh màn hình cho trang giới thiệu",
    "p-di-dong",
    "u-lan",
    "done",
    "low",
    "2026-08-08",
    "2026-08-08T16:10:00+07:00",
    180
  ],
  [
    "CV-016",
    "Dựng biểu đồ tiến độ theo tuần",
    "p-bao-cao",
    "u-nam",
    "in-progress",
    "high",
    "2026-09-08",
    "2026-08-24T09:55:00+07:00",
    1200
  ],
  [
    "CV-017",
    "Xuất báo cáo ra bảng tính",
    "p-bao-cao",
    "u-nam",
    "todo",
    "medium",
    "2026-09-22",
    "2026-08-19T11:40:00+07:00",
    600
  ],
  [
    "CV-018",
    "Định nghĩa chỉ số theo dõi cho từng nhóm",
    "p-bao-cao",
    "u-hang",
    "in-review",
    "medium",
    "2026-08-30",
    "2026-08-22T09:15:00+07:00",
    420
  ],
  [
    "CV-019",
    "Bộ lọc theo khoảng thời gian tuỳ chọn",
    "p-bao-cao",
    "u-bao",
    "todo",
    "low",
    "2026-10-06",
    "2026-08-14T15:05:00+07:00",
    540
  ],
  [
    "CV-020",
    "So khớp số liệu với bản ghi gốc",
    "p-bao-cao",
    "u-nam",
    "in-progress",
    "urgent",
    "2026-08-27",
    "2026-08-24T06:30:00+07:00",
    660
  ],
  [
    "CV-021",
    "Viết kịch bản hướng dẫn cho người dùng mới",
    "p-khoi-tao",
    "u-lan",
    "todo",
    "medium",
    "2026-10-12",
    "2026-08-13T10:45:00+07:00",
    480
  ],
  [
    "CV-022",
    "Rút gọn bước tạo không gian làm việc",
    "p-khoi-tao",
    "u-ha",
    "todo",
    "high",
    "2026-10-20",
    "2026-08-12T13:20:00+07:00",
    780
  ],
  [
    "CV-023",
    "Mẫu thư mời thành viên vào không gian làm việc",
    "p-khoi-tao",
    "u-lan",
    "in-review",
    "low",
    "2026-09-01",
    "2026-08-21T08:25:00+07:00",
    240
  ],
  [
    "CV-024",
    "Chuyển quy trình dựng bản phát hành sang máy chủ mới",
    "p-ha-tang",
    "u-dung",
    "done",
    "high",
    "2026-08-10",
    "2026-08-10T18:00:00+07:00",
    1320
  ],
  [
    "CV-025",
    "Giám sát thời gian phản hồi của dịch vụ nền",
    "p-ha-tang",
    "u-dung",
    "done",
    "medium",
    "2026-08-09",
    "2026-08-09T12:30:00+07:00",
    540
  ]
] as const;

/**
 * Nhật ký — chỉ `kind` và định danh, KHÔNG có câu chữ.
 *
 * Xem `lib/activities.ts` về lý do: một `verb: "đã hoàn thành"` nằm trong dữ liệu là một chuỗi
 * hiển thị không dịch được và không sửa được.
 */
const ACTIVITIES = [
  ["updated", "u-nam", null, "CV-016", "Dựng biểu đồ tiến độ theo tuần", "2026-08-24T07:20:00+07:00"],
  ["updated", "u-bao", null, "CV-002", "Dựng khung ứng dụng dùng chung cho sản phẩm mới", "2026-08-24T06:45:00+07:00"],
  ["updated", "u-ha", null, "CV-004", "Rà soát tương phản màu ở chế độ tối", "2026-08-23T17:35:00+07:00"],
  [
    "review-requested",
    "u-hang",
    null,
    "CV-003",
    "Viết hướng dẫn đóng góp cho đội sản phẩm",
    "2026-08-23T16:40:00+07:00"
  ],
  ["assigned", "u-hang", "u-nam", "CV-020", "So khớp số liệu với bản ghi gốc", "2026-08-23T16:10:00+07:00"],
  ["created", "u-khanh", null, "CV-008", "Kiểm thử điều hướng bằng bàn phím ở thanh bên", "2026-08-22T15:30:00+07:00"],
  ["overdue", "u-hang", null, "CV-006", "Thống nhất thông báo lỗi trên toàn bộ biểu mẫu", "2026-08-19T14:00:00+07:00"],
  ["completed", "u-ha", null, "CV-001", "Chuẩn hoá bộ token màu cho toàn hệ sinh thái", "2026-08-12T09:20:00+07:00"]
] as const;

/** Thông báo — của RIÊNG người đang đăng nhập ở bản dev. */
const NOTIFICATIONS = [
  ["mention", "u-nam", "CV-016", "Dựng biểu đồ tiến độ theo tuần", null, "2026-08-24T09:12:00+07:00"],
  ["assignment", "u-hang", "CV-004", "Rà soát tương phản màu ở chế độ tối", null, "2026-08-24T08:05:00+07:00"],
  ["deadline", null, "CV-011", "Đồng bộ dữ liệu khi thiết bị mất kết nối", null, "2026-08-23T17:40:00+07:00"],
  ["system", null, null, null, "read", "2026-08-22T10:30:00+07:00"],
  ["mention", "u-ha", "CV-002", "Dựng khung ứng dụng dùng chung cho sản phẩm mới", "read", "2026-08-21T15:20:00+07:00"]
] as const;

/**
 * Ánh xạ id NHÂN VẬT trong dữ liệu mẫu (`u-anh`, `u-bao`…) sang id NGƯỜI THẬT của Comitor.Account.
 *
 * Dữ liệu mẫu viết theo tám nhân vật, còn một không gian làm việc thật có bao nhiêu người thì tuỳ.
 * Chia vòng tròn theo danh sách thật: bộ dữ liệu luôn tự nhất quán (mọi `assignee_user_id` đều tra
 * được ra một cái tên) mà không cần seed biết trước Account có mấy tài khoản.
 *
 * ⚠ Trải đều là CỐ Ý, không phải cho đẹp: dồn hết việc cho một người thì bộ lọc "theo người phụ
 * trách" ở `/tasks` chỉ có một mục, và cái bộ lọc đó coi như chưa bao giờ được thử.
 */
const FIXTURE_PEOPLE = ["u-anh", "u-bao", "u-ha", "u-dung", "u-hang", "u-khanh", "u-lan", "u-nam"] as const;

function mapPeople(realIds: readonly string[]): Record<string, string> {
  const table: Record<string, string> = {};
  FIXTURE_PEOPLE.forEach((fixtureId, index) => {
    const real = realIds[index % realIds.length];
    if (real) table[fixtureId] = real;
  });
  return table;
}

async function main(): Promise<void> {
  /*
   * HỎI ACCOUNT TRƯỚC KHI GHI GÌ. Hai giá trị dưới đây là hợp đồng với Comitor.Account, không phải
   * hằng của module — xem `WORKSPACE_SLUG` ở trên.
   */
  const [entitlements, members] = await Promise.all([
    getWorkspaceEntitlements(WORKSPACE_SLUG),
    fetchMembers(WORKSPACE_SLUG)
  ]);

  const WORKSPACE_ID = entitlements.workspaceId;
  if (members.length === 0) {
    throw new Error(
      `Không gian làm việc "${WORKSPACE_SLUG}" không có thành viên nào (hoặc client M2M thiếu quyền). ` +
        "Chạy `pnpm seed` bên comitor-account trước."
    );
  }

  const person = mapPeople(members.map((member) => member.id));
  /* Người TẠO mọi việc mẫu: chủ sở hữu nếu có, không thì người đầu tiên. */
  const requesterId = members.find((member) => member.role === "owner")?.id ?? members[0]?.id;
  if (!requesterId) throw new Error("Danh bạ rỗng.");

  const idOf = (fixtureId: string): string => person[fixtureId] ?? requesterId;

  console.info(
    `Seed workspace "${WORKSPACE_SLUG}" (${WORKSPACE_ID}) · ${members.length} người · ` +
      `dời ${SHIFT >= 0 ? "+" : ""}${SHIFT} ngày so với ${BASE_TODAY}`
  );

  /*
   * XOÁ TRƯỚC, theo đúng thứ tự phụ thuộc.
   *
   * `deleteMany` lọc theo `workspaceId` chứ không xoá cả bảng: seed phải chạy được trên một
   * database đã có dữ liệu của workspace khác mà không đụng tới chúng. Đây là thói quen đáng giữ
   * ngay từ bản mẫu — một script seed xoá cả bảng là một script sẽ có ngày được chạy nhầm chỗ.
   */
  await prisma.taskWatcher.deleteMany({ where: { task: { workspaceId: WORKSPACE_ID } } });
  await prisma.task.deleteMany({ where: { workspaceId: WORKSPACE_ID } });
  await prisma.project.deleteMany({ where: { workspaceId: WORKSPACE_ID } });
  await prisma.activity.deleteMany({ where: { workspaceId: WORKSPACE_ID } });
  await prisma.notification.deleteMany({ where: { workspaceId: WORKSPACE_ID } });
  await prisma.taskDraft.deleteMany({ where: { workspaceId: WORKSPACE_ID } });

  /*
   * ⚠ KHÔNG đặt `id` cố định cho dự án — để Prisma sinh `cuid()`.
   *
   * Bản trước ghi thẳng `id: "p-nen-tang"`, và nó hỏng ngay lần đầu tiên ai đó đổi
   * `COMITOR_SEED_WORKSPACE_SLUG`: phép xoá ở trên lọc theo `workspace_id`, nên dòng cũ của
   * workspace CŨ vẫn còn, và `createMany` đụng khoá chính với `P2002` — một thông điệp chẳng gợi
   * gì tới nguyên nhân thật.
   *
   * Id cố định trong dữ liệu mẫu luôn là một quả bom hẹn giờ: nó biến "chạy lại seed" thành một
   * thao tác chỉ an toàn khi mọi thứ khác không đổi. Sinh id rồi tra ngược theo `code` thì seed
   * chạy lại được ở bất kỳ workspace nào, bao nhiêu lần cũng được.
   */
  await prisma.project.createMany({
    data: PROJECTS.map((project) => ({
      workspaceId: WORKSPACE_ID,
      code: project.code,
      name: project.name,
      ownerUserId: idOf(project.ownerUserId),
      status: project.status,
      dueDate: day(project.dueDate)
    }))
  });

  /* `code` là khoá nghiệp vụ ổn định của dự án (`@@unique([workspaceId, code])`) — tra ngược qua nó. */
  const projectIdByFixture = new Map(
    (await prisma.project.findMany({ where: { workspaceId: WORKSPACE_ID }, select: { id: true, code: true } })).map(
      (row) => [row.code, row.id]
    )
  );
  const projectIdOf = (fixtureId: string): string => {
    const code = PROJECTS.find((project) => project.id === fixtureId)?.code;
    const id = code ? projectIdByFixture.get(code) : undefined;
    if (!id) throw new Error(`Không tra được dự án cho "${fixtureId}" — dữ liệu mẫu không nhất quán.`);
    return id;
  };

  await prisma.task.createMany({
    data: TASKS.map(([code, title, projectId, assignee, status, priority, dueDate, updatedAt, minutes]) => ({
      workspaceId: WORKSPACE_ID,
      code,
      title,
      summary: "",
      projectId: projectIdOf(projectId),
      assigneeUserId: idOf(assignee),
      requesterUserId: requesterId,
      status,
      priority,
      dueDate: day(dueDate),
      updatedAt: at(updatedAt),
      estimateMinutes: minutes,
      requestType: "task",
      notifyChannels: ["in-app"]
    }))
  });

  /**
   * Người theo dõi — bảng `task_watchers`.
   *
   * ⚠ Trước đây seed XOÁ bảng này nhưng không bao giờ ghi vào nó, nên nó rỗng ở mọi máy phát
   * triển. Một bảng luôn rỗng là một bảng không ai từng thấy chạy: chưa ai kiểm `onDelete: Cascade`
   * có thật sự dọn theo khi xoá công việc không, và chưa ai kiểm truy vấn "việc tôi theo dõi" lọc
   * đúng không. Dữ liệu mẫu tồn tại để những thứ đó lộ ra TRƯỚC khi có khách hàng.
   *
   * Quy tắc gán: người phụ trách luôn theo dõi việc của mình, cộng người yêu cầu. `skipDuplicates`
   * vì hai vai đó trùng nhau ở một số việc, và khoá chính là `(taskId, userId)`.
   */
  const seededTasks = await prisma.task.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: { id: true, assigneeUserId: true, requesterUserId: true }
  });

  const { count: watcherCount } = await prisma.taskWatcher.createMany({
    data: seededTasks.flatMap((task) =>
      [task.assigneeUserId, task.requesterUserId]
        .filter((userId): userId is string => Boolean(userId))
        .map((userId) => ({ taskId: task.id, userId }))
    ),
    skipDuplicates: true
  });

  await prisma.activity.createMany({
    data: ACTIVITIES.map(([kind, actor, target, code, title, createdAt]) => ({
      workspaceId: WORKSPACE_ID,
      kind,
      actorUserId: idOf(actor),
      targetUserId: target ? idOf(target) : null,
      targetCode: code,
      targetTitle: title,
      createdAt: at(createdAt)
    }))
  });

  await prisma.notification.createMany({
    data: NOTIFICATIONS.map(([kind, actor, code, title, read, createdAt]) => ({
      workspaceId: WORKSPACE_ID,
      userId: requesterId,
      kind,
      /* `actor` là `null` với thông báo hệ thống — không có ai gây ra nó. */
      actorUserId: actor === null ? null : idOf(actor),
      taskCode: code,
      taskTitle: title,
      readAt: read ? at(createdAt) : null,
      createdAt: at(createdAt)
    }))
  });

  /*
   * Cài đặt: KHÔNG ghi gì cả, cố ý.
   *
   * `getAppSettings()` trả về `DEFAULT_SETTINGS` khi chưa có dòng nào, và đó là đường mà MỌI khách
   * hàng mới đi qua. Seed ghi sẵn một dòng thì đường đó không bao giờ được chạy ở máy phát triển —
   * tức nhánh phổ biến nhất là nhánh chưa ai thử.
   */

  /*
   * Phân quyền: ghi ĐỦ ma trận mặc định.
   *
   * Ở đây thì ngược lại với cài đặt: ghi sẵn là ĐÚNG, vì trang `/settings/permissions` phải mở ra ở
   * trạng thái "đã lưu" để người dùng thấy được sự khác biệt giữa bản đã lưu và bản nháp. Và vì nó
   * cho ta một bộ 48 dòng thật để đối chiếu với `applyPermissionLocks` lúc đọc.
   */
  const matrix = buildPermissionMatrix(PERMISSION_RULES, WORKSPACE_ROLES);
  await prisma.rolePermission.deleteMany({ where: { workspaceId: WORKSPACE_ID } });
  await prisma.rolePermission.createMany({
    data: WORKSPACE_ROLES.flatMap((roleId) =>
      PERMISSION_RULES.map((rule) => ({
        workspaceId: WORKSPACE_ID,
        roleId,
        permissionId: rule.id,
        granted: matrix[roleId][rule.id] === true
      }))
    )
  });

  const counts = {
    projects: PROJECTS.length,
    tasks: TASKS.length,
    watchers: watcherCount,
    activities: ACTIVITIES.length,
    notifications: NOTIFICATIONS.length,
    permissions: WORKSPACE_ROLES.length * PERMISSION_RULES.length
  };
  console.info("✓ Seed xong:", counts);
}

main()
  .catch((error) => {
    console.error("✗ Seed hỏng:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
