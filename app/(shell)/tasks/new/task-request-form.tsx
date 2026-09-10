"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  AvatarGroup,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Combobox,
  type ComboboxOption,
  DatePicker,
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FormField,
  FormSection,
  fromSelectValue,
  Input,
  LetterAvatar,
  MultiCombobox,
  RadioGroup,
  RadioGroupItem,
  RelativeTime,
  SELECT_EMPTY_VALUE,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusPill,
  Switch,
  Textarea,
  toast,
  toSelectValue
} from "@comitor/ui";
import { BellRing, ClipboardList, History, Paperclip, Plus, Save, TriangleAlert, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useMemo, useState } from "react";
import { useTaskPriorityConfigs } from "@/hooks/use-catalog";
import { useErrorMessage } from "@/hooks/use-error-message";
import { saveTaskDraft } from "@/lib/api-client/task-drafts";
import { createTask } from "@/lib/api-client/tasks";
import { REQUEST_TYPES } from "@/lib/catalog/task";
import type { TaskPriority } from "@/lib/contracts/task";
import { isOverdue, parseIsoDate, toIsoDate } from "@/lib/core/iso-date";
import { DELIVERABLE_NOTIFY_CHANNELS } from "@/lib/core/notify-channels";
import {
  EMPTY_TASK_DRAFT,
  ESTIMATE_MAX_MINUTES,
  ESTIMATE_MIN_MINUTES,
  type TaskDraftData
} from "@/lib/core/task-draft";
import { APPROVAL_FLOWS, NOTIFY_CHANNELS } from "@/lib/core/task-input";
import { formatIsoDateFor } from "@/lib/format";
import { isLocale } from "@/lib/i18n/config";
import { DATE_FNS_LOCALES, DATE_PICKER_LABELS } from "@/lib/i18n/ui-labels";

/**
 * Đảo CLIENT của trang "tạo công việc".
 *
 * ── STATE CỦA BIỂU MẪU LÀ ĐÚNG KIỂU CỦA BẢN NHÁP ─────────────────────────────────────────
 * `TaskDraftData` (`lib/core/task-draft.ts`) vừa là hình dạng lưu trong cột `task_drafts.data`,
 * vừa là state ở đây. Một kiểu cho cả hai, cố ý: "lưu nháp" trở thành gửi thẳng state đi, "khôi
 * phục nháp" trở thành gán thẳng vào state. Hai hình dạng gần-giống-nhau là chỗ để một trường bị
 * quên ở đúng một chiều, và chiều bị quên luôn là chiều ít người thử.
 *
 * Hệ quả đáng chú ý: `dueDate` ở state là **chuỗi ISO chỉ-có-ngày**, không phải `Date`. Phép đổi
 * sang `Date` chỉ xảy ra ở đúng ranh giới `<DatePicker>` (`isoToDate`/`dateToIso` bên dưới), và cả
 * hai đi qua `lib/core/iso-date.ts` chứ không qua `new Date("YYYY-MM-DD")` — chuỗi đó được JS hiểu
 * là mốc UTC, nên máy ở múi giờ âm đọc ra ngày HÔM TRƯỚC.
 *
 * ── FILE NÀY KHÔNG BIẾT DỮ LIỆU ĐẾN TỪ ĐÂU ───────────────────────────────────────────────
 * Mọi bản ghi vào đây qua PROP, từ `page.tsx` bên cạnh. Thứ duy nhất nó `import` là BẢNG KHAI
 * (`lib/catalog/`) và HÀM THUẦN (`lib/core/`) — không có bản ghi nào để mà nối lại. Đường ra ngoài
 * đi qua CỔNG API (`lib/api-client/`), không có `fetch()` nào ở đây.
 */

/** Tiêu đề ngắn hơn mức này thì đồng đội đọc xong vẫn không biết phải làm gì. */
const TITLE_MIN_LENGTH = 8;

/** Trần ước lượng nói bằng GIỜ để hợp với ô nhập; nguồn sự thật vẫn là hằng tính bằng phút. */
const ESTIMATE_MIN_HOURS = ESTIMATE_MIN_MINUTES / 60;
const ESTIMATE_MAX_HOURS = ESTIMATE_MAX_MINUTES / 60;

/** Các trường có thể báo lỗi — dùng chung cho bảng lỗi và thứ tự đưa con trỏ về ô sai. */
type ErrorField =
  | "title"
  | "projectId"
  | "assigneeUserId"
  | "dueDate"
  | "estimateHours"
  | "approvalFlowId"
  | "notifyChannels";

type FormErrors = Partial<Record<ErrorField, string>>;

/** Thứ tự ĐỌC của biểu mẫu — quyết định ô nào được focus khi bấm Gửi mà còn lỗi. */
const ERROR_FIELD_ORDER: readonly ErrorField[] = [
  "title",
  "projectId",
  "assigneeUserId",
  "dueDate",
  "estimateHours",
  "approvalFlowId",
  "notifyChannels"
];

/**
 * id của control trong DOM, để `document.getElementById(...).focus()` tìm đúng ô.
 *
 * Đây là CHUỖI MÁY (id trong DOM), không phải chuỗi người dùng đọc — nên nó theo luật của định
 * danh: tiếng Anh, không dịch. Cùng luật với `htmlFor` của những ô không bao giờ báo lỗi bên dưới.
 */
const FIELD_IDS: Record<ErrorField, string> = {
  title: "task-title",
  projectId: "task-project",
  assigneeUserId: "task-assignee",
  dueDate: "task-due-date",
  estimateHours: "task-estimate",
  approvalFlowId: "task-approval-flow",
  notifyChannels: "task-notify-channels"
};

/**
 * "Hôm nay" ở mốc 0 giờ, kèm sẵn dạng ISO — hai cách nói cùng một ngày, dựng MỘT lần.
 *
 * ⚠ **Nhận ISO từ MÁY CHỦ, không đọc đồng hồ trình duyệt.** Máy chủ tính "hôm nay" theo múi giờ
 * trong hồ sơ Account của người xem (`todayIso(session.user.timezone)`); trình duyệt thì theo múi
 * giờ của HỆ ĐIỀU HÀNH, và hai cái đó khác nhau bất cứ khi nào người dùng đang ở nơi khác với múi
 * giờ họ đã đặt — người ở GMT-5 lúc 21:00 đã sang ngày hôm sau theo lịch của chính họ.
 *
 * Hậu quả nếu đọc đồng hồ trình duyệt: `minDate` cho phép chọn một ngày mà máy chủ lập tức coi là
 * QUÁ HẠN, nên người dùng tạo xong một việc đã trễ ngay lúc sinh ra — không có gì báo, và không ai
 * truy ngược một chuyện như thế về một múi giờ.
 *
 * `Date` vẫn phải dựng ở nửa đêm ĐỊA PHƯƠNG: `<DatePicker>` làm việc bằng `Date` địa phương, và
 * `new Date("YYYY-MM-DD")` thì JS hiểu là mốc UTC — xem `isoToDate` ngay bên dưới.
 */
function startOfToday(todayIso: string): { date: Date; iso: string } {
  const parts = parseIsoDate(todayIso);
  if (!parts) {
    /* Máy chủ luôn gửi chuỗi hợp lệ; nhánh này chỉ để không phải `!` một giá trị có thể `undefined`. */
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { date, iso: toIsoDate({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }) };
  }
  return { date: new Date(parts.year, parts.month - 1, parts.day), iso: todayIso };
}

/**
 * ISO chỉ-có-ngày → `Date` ở nửa đêm ĐỊA PHƯƠNG, đúng thứ `<DatePicker>` làm việc cùng.
 *
 * Địa phương chứ không UTC ở đây, và đó không mâu thuẫn với route handler (nơi dựng UTC): lịch của
 * gói đọc `getFullYear()/getMonth()/getDate()` theo giờ máy, nên nạp một mốc UTC vào nó sẽ hiện sai
 * một ngày ở mọi múi giờ âm. Phép đổi ngược (`dateToIso`) cũng đọc theo giờ máy, nên vòng
 * ISO → Date → ISO là bất biến.
 */
function isoToDate(iso: string | null): Date | null {
  if (!iso) return null;
  const parts = parseIsoDate(iso);
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null;
}

function dateToIso(value: Date | null): string | null {
  if (!value) return null;
  return toIsoDate({ year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() });
}

/**
 * Chuỗi người dùng gõ → số giờ, hoặc `null` khi không đọc được.
 *
 * Nhận dấu phẩy thập phân (`"7,5"`): bàn phím tiếng Việt gõ dấu phẩy, và từ chối nó là bắt người
 * dùng học một quy ước của máy. Chỉ đổi ở ĐÂY và ở phép kiểm — state vẫn giữ nguyên chuỗi đang gõ.
 */
function parseEstimateHours(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export interface TaskRequestFormProps {
  /** Dự án chọn được — đã ghép sẵn ở `page.tsx`, dự án đã đóng không có mặt. */
  projectOptions: ComboboxOption[];
  /** Thành viên chọn được, dùng cho cả người phụ trách lẫn người theo dõi. */
  memberOptions: ComboboxOption[];
  /**
   * Ảnh đại diện theo id người dùng — CHỈ những người có ảnh.
   *
   * Đi riêng vì `ComboboxOption` của gói không có trường nào mang được URL ảnh (`icon` là một
   * component). Xem chú thích ở `app/(shell)/tasks/new/page.tsx`.
   */
  memberAvatarUrls: Record<string, string>;
  /** Mã hệ thống SẼ cấp — chỉ để xem trước. Mã thật do máy chủ cấp lúc ghi. */
  nextTaskCode: string;
  defaultPriority: TaskPriority;
  autoAssignToMe: boolean;
  /**
   * "Hôm nay" theo lịch của NGƯỜI XEM, do máy chủ tính — sàn của ô chọn hạn chót.
   *
   * Truyền xuống thay vì để biểu mẫu đọc `new Date()`: máy chủ đọc múi giờ từ hồ sơ Account, trình
   * duyệt đọc từ hệ điều hành, và khi hai cái lệch nhau thì biểu mẫu nhận một ngày mà máy chủ coi
   * là đã quá hạn.
   */
  todayIso: string;
  /** Cài đặt `allow_public_link` của workspace — quyết định mục "Chuyển cho đối tác" có bật không. */
  allowExternalRequest: boolean;
  currentUserId: string;
  /** Kho ảnh đã cấu hình chưa — quyết định câu nói về tệp đính kèm. */
  storageEnabled: boolean;
  /** Bản nháp đã lưu, hoặc `null`. Đã được kiểm ở tầng đọc; hỏng thì tới đây đã là `null`. */
  draft: TaskDraftData | null;
  /** Mốc ISO đầy đủ của bản nháp — `null` khi chưa có nháp. */
  draftSavedAt: string | null;
}

export function TaskRequestForm({
  projectOptions,
  memberOptions,
  memberAvatarUrls,
  nextTaskCode,
  defaultPriority,
  autoAssignToMe,
  todayIso,
  allowExternalRequest,
  currentUserId,
  storageEnabled,
  draft,
  draftSavedAt
}: TaskRequestFormProps) {
  const router = useRouter();
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : "vi";

  const t = useTranslations("taskNew");
  const tCommon = useTranslations("common");
  const tField = useTranslations("task.field");
  const tRequestType = useTranslations("task.requestType");
  const tTask = useTranslations("task");
  const tErrors = useTranslations("errors");
  const errorMessage = useErrorMessage();

  const priorityConfigs = useTaskPriorityConfigs();

  /**
   * Bản nháp thắng bộ mặc định — người dùng đang quay lại một biểu mẫu dở dang, và ghi đè lên nó
   * bằng cài đặt của workspace là xoá mất chính thứ họ quay lại để lấy.
   *
   * Biểu mẫu TRỐNG thì mang hai giá trị của cài đặt: mức ưu tiên mặc định, và tự nhận việc. Chúng
   * trả lời câu *"không gian làm việc này thường làm thế nào"*, nên chúng ở ĐÂY — không ở
   * `EMPTY_TASK_DRAFT`, thứ là mặc định của LƯỢC ĐỒ và phải giống nhau ở mọi workspace.
   */
  const [form, setForm] = useState<TaskDraftData>(
    () =>
      draft ?? {
        ...EMPTY_TASK_DRAFT,
        priority: defaultPriority,
        assigneeUserId: autoAssignToMe ? currentUserId : null
      }
  );

  /**
   * Bản nháp khôi phục ĐÃ được kiểm ngay khi mở, nên lỗi hiện sẵn từ lần vẽ đầu tiên — người dùng
   * quay lại một biểu mẫu dở dang cần biết ngay còn thiếu gì.
   *
   * Biểu mẫu TRẮNG thì ngược lại: `false`, và chỉ bật khi bấm Gửi. Vừa mở form đã thấy một loạt
   * chữ đỏ là cách nhanh nhất khiến người dùng bỏ đi.
   */
  const [showErrors, setShowErrors] = useState(draft !== null);

  /** Có thay đổi nào chưa lưu không — quyết định nút "Lưu nháp" bật hay vô hiệu. */
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  /** Mốc lưu nháp MỚI NHẤT. Máy chủ trả về sau mỗi lần lưu — không đoán bằng đồng hồ trình duyệt. */
  const [savedAt, setSavedAt] = useState<string | null>(draftSavedAt);

  // Tính một lần cho cả vòng đời biểu mẫu: mốc "hôm nay" không được nhảy giữa hai lần vẽ.
  const [today] = useState(() => startOfToday(todayIso));

  /**
   * Toàn bộ luật hợp lệ ở MỘT chỗ, và nó tra câu chữ qua `t` — nên không có chuỗi hiển thị nào
   * nằm ngoài `messages/*.json`.
   *
   * ⚠ Ba luật ở đây (`TITLE_MIN_LENGTH`, khoảng ước lượng, hạn chót không được ở quá khứ) phải
   * khớp với `app/api/tasks/route.ts`. Khoảng ước lượng dùng CHUNG một hằng nên nó không lệch được;
   * hai luật kia là quy ước của MÀN HÌNH này — máy chủ cố ý nới hơn, xem ghi chú ở lược đồ zod.
   */
  /**
   * Quy trình duyệt đang chọn, SAU khi đối chiếu với bảng khai — `null` khi id không còn tồn tại.
   *
   * ⚠ Đây không phải phòng xa: một bản nháp lưu tháng trước có thể mang một quy trình đã bị gỡ khỏi
   * `APPROVAL_FLOWS`. Đưa thẳng id đó vào `t(\`flow.\${id}.label\`)` thì `next-intl` NÉM LỖI vì khoá
   * không tồn tại — và một lỗi lúc render làm trắng CẢ trang, chứ không chỉ hỏng một dòng chữ.
   * Lọc ở đây một lần, rồi mọi chỗ đọc `selectedFlowId` thay vì `form.approvalFlowId`.
   */
  const selectedFlowId =
    form.approvalFlowId !== null && APPROVAL_FLOWS.includes(form.approvalFlowId) ? form.approvalFlowId : null;

  const errors = useMemo<FormErrors>(() => {
    const next: FormErrors = {};

    const title = form.title.trim();
    if (title.length === 0) next.title = t("errorTitleRequired");
    else if (title.length < TITLE_MIN_LENGTH) next.title = t("errorTitleShort", { min: TITLE_MIN_LENGTH });

    if (!form.projectId) next.projectId = t("errorProjectRequired");
    if (!form.assigneeUserId) next.assigneeUserId = t("errorAssigneeRequired");

    if (!form.dueDate) next.dueDate = t("errorDueDateRequired");
    else if (isOverdue(form.dueDate, today.iso)) next.dueDate = t("errorDueDatePast");

    const hours = parseEstimateHours(form.estimateHours);
    if (form.estimateHours.trim().length === 0) next.estimateHours = t("errorEstimateRequired");
    else if (hours === null || hours < ESTIMATE_MIN_HOURS || hours > ESTIMATE_MAX_HOURS) {
      next.estimateHours = t("errorEstimateRange", { min: ESTIMATE_MIN_HOURS, max: ESTIMATE_MAX_HOURS });
    }

    // `selectedFlowId` chứ không `form.approvalFlowId`: một quy trình đã bị gỡ cũng là "chưa chọn".
    if (form.needsApproval && selectedFlowId === null) next.approvalFlowId = t("errorApprovalFlowRequired");
    if (form.notifyChannels.length === 0) next.notifyChannels = t("errorChannelsRequired");

    return next;
  }, [form, selectedFlowId, today, t]);

  const errorCount = Object.keys(errors).length;

  /** Chỉ hiện lỗi khi đã kiểm — mọi ô đọc lỗi qua đây, không đọc thẳng `errors`. */
  const errorOf = (field: ErrorField): string | undefined => (showErrors ? errors[field] : undefined);

  function update<K extends keyof TaskDraftData>(key: K, value: TaskDraftData[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  }

  function toggleChannel(channelId: string, checked: boolean) {
    update(
      "notifyChannels",
      checked ? [...form.notifyChannels, channelId] : form.notifyChannels.filter((id) => id !== channelId)
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);

    const firstErrorField = ERROR_FIELD_ORDER.find((field) => errors[field]);
    if (firstErrorField) {
      // Bấm Gửi mà chỉ hiện chữ đỏ ở cuối trang thì người dùng không biết phải sửa ở đâu — đưa con
      // trỏ về ô sai ĐẦU TIÊN là phần bắt buộc của một biểu mẫu dùng được.
      document.getElementById(FIELD_IDS[firstErrorField])?.focus();
      return;
    }

    /*
     * Đọc lại ba giá trị vào biến cục bộ thay vì dùng `!` hay `as`: `errors` đã chặn cả ba ca
     * `null`, nhưng `tsc` không suy được điều đó qua một `useMemo`. Nhánh `return` này là chỗ giữ
     * cho phép suy kiểu đúng mà không phải nói dối trình biên dịch.
     */
    const projectId = form.projectId;
    const dueDate = form.dueDate;
    const hours = parseEstimateHours(form.estimateHours);
    if (!projectId || !dueDate || hours === null) return;

    setSubmitting(true);
    try {
      const created = await createTask({
        title: form.title.trim(),
        summary: form.summary.trim(),
        projectId,
        assigneeUserId: form.assigneeUserId,
        watcherUserIds: form.watcherUserIds,
        priority: form.priority,
        dueDate,
        // Đơn vị lưu là PHÚT (số nguyên) — xem `estimateMinutes` trong `prisma/schema.prisma`.
        estimateMinutes: Math.round(hours * 60),
        requestType: form.requestType,
        needsApproval: form.needsApproval,
        approvalFlowId: form.needsApproval ? selectedFlowId : null,
        notifyChannels: form.notifyChannels,
        remindBeforeDue: form.remindBeforeDue,
        syncWithCalendar: form.syncWithCalendar
      });

      /*
       * Mã trong toast lấy từ BẢN GHI MÁY CHỦ TRẢ VỀ, không lấy từ `nextTaskCode`: mã đó được đoán
       * lúc mở trang, và nó sai mỗi khi có người khác tạo việc xen vào giữa.
       */
      toast(t("createdTitle"), {
        variant: "success",
        description: t("createdDescription", { code: created.code, title: created.title })
      });

      setDirty(false);
      router.push("/tasks");
      /*
       * `refresh()` sau `push()`: bảng `/tasks`, badge số việc đang mở ở thanh bên và bảng lệnh ⌘K
       * đều được render ở server. Không làm mới thì người dùng vừa tạo việc xong lại nhìn một danh
       * sách chưa có nó — và họ sẽ tạo lại.
       */
      router.refresh();
    } catch (error) {
      toast(errorMessage(error as { code?: string; status?: number }), { variant: "destructive" });
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      const result = await saveTaskDraft(form);
      setSavedAt(result.savedAt);
      setDirty(false);
      toast(t("draftSavedTitle"), { variant: "success", description: t("draftSavedDescription") });
    } catch (error) {
      toast(errorMessage(error as { code?: string; status?: number }), { variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  }

  function handleRestoreDraft() {
    if (!draft) return;
    setForm(draft);
    setShowErrors(true);
    setDirty(false);
    toast(t("draftRestoredTitle"), { variant: "info", description: t("draftRestoredDescription") });
  }

  /*
   * Thẻ "Tóm tắt" đọc lại từ chính hai mảng lựa chọn, không tra ngược sang một bảng dữ liệu khác:
   * mỗi `ComboboxOption` đã mang sẵn nhãn (`label`) và dòng phụ (`description`) mà thẻ cần in.
   */
  const selectedProject = projectOptions.find((option) => option.value === form.projectId);
  const selectedAssignee = memberOptions.find((option) => option.value === form.assigneeUserId);
  const estimateHours = parseEstimateHours(form.estimateHours);

  const dateFnsLocale = DATE_FNS_LOCALES[locale];

  return (
    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
      {/* `noValidate`: luật hợp lệ nằm ở `errors` để thông báo đúng ngôn ngữ người đang xem và đồng
          nhất với luật của máy chủ, thay vì để trình duyệt tự bung bong bóng theo ngôn ngữ hệ điều hành. */}
      <form noValidate onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-5">
        {/*
         * Mốc lưu nói bằng `<RelativeTime>`, KHÔNG bằng một chuỗi tuyệt đối: "3 phút trước" trả lời
         * đúng câu người dùng đang hỏi ("bản này còn mới không?"), còn `29/08/2026 09:12` bắt họ tự
         * trừ. Và KHÔNG truyền `now` — mốc này đến từ database, nên đồng hồ thật mới là đúng.
         */}
        {savedAt !== null && (
          <Alert>
            <History aria-hidden="true" />
            <AlertTitle>{t("draftTitle")}</AlertTitle>
            <AlertDescription>
              <p>
                {t.rich("draftSavedAgo", {
                  when: () => <RelativeTime value={savedAt} locale={dateFnsLocale} />
                })}
              </p>
              {draft !== null && <p>{t("draftFilledIn")}</p>}
            </AlertDescription>
          </Alert>
        )}

        {showErrors && errorCount > 0 && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{t("errorSummaryTitle", { count: errorCount })}</AlertTitle>
            <AlertDescription>
              <p>{t("errorSummaryHint")}</p>
            </AlertDescription>
          </Alert>
        )}

        <FormSection
          title={t("sectionContentTitle")}
          description={t("sectionContentDescription")}
          icon={ClipboardList}
          accent="primary"
        >
          <FormField label={tField("code")} htmlFor="task-code" description={t("codeDescription")} colSpan={3}>
            {(control) => <Input {...control} value={nextTaskCode} readOnly disabled />}
          </FormField>

          <FormField
            label={tField("title")}
            htmlFor={FIELD_IDS.title}
            required
            description={t("titleDescription")}
            error={errorOf("title")}
            colSpan={9}
          >
            {/* `Input` có sẵn prop `label`/`error`/`hint`, nhưng trong `FormField` thì KHÔNG dùng:
                nhãn và chữ báo lỗi đã do `FormField` vẽ, truyền thêm là hai chỗ cùng vẽ một thứ.
                Trạng thái lỗi đi qua `aria-invalid` trong cụm `control`. */}
            {(control) => (
              <Input
                {...control}
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder={t("titlePlaceholder")}
              />
            )}
          </FormField>

          <FormField
            label={tField("summary")}
            htmlFor="task-summary"
            description={t("summaryDescription")}
            colSpan={12}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={4}
                value={form.summary}
                onChange={(event) => update("summary", event.target.value)}
                placeholder={t("summaryPlaceholder")}
              />
            )}
          </FormField>

          <FormField label={t("requestTypeLabel")} required description={t("requestTypeDescription")} colSpan={12}>
            {/* Radio dựng bằng `Field` + `FieldLabel` + `FieldDescription` thay vì prop `label` của
                control: mục bị khoá cần `data-disabled` trên `Field` thì nhãn mới mờ theo, nếu không
                sẽ ra một ô xám đi kèm dòng chữ đậm như thường — trông như lỗi giao diện. */}
            <RadioGroup
              value={form.requestType}
              onValueChange={(value) =>
                update("requestType", REQUEST_TYPES.find((option) => option === value) ?? form.requestType)
              }
              className="grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {REQUEST_TYPES.map((option) => {
                // Mọi mục bị vô hiệu PHẢI kèm lý do: một ô xám không lời giải thích khiến người dùng
                // nghĩ giao diện hỏng. Giao diện có nghĩa vụ nói VÌ SAO, không chỉ nói "không được".
                const disabled = option === "external" && !allowExternalRequest;
                return (
                  <Field key={option} orientation="horizontal" data-disabled={disabled ? "true" : undefined}>
                    <RadioGroupItem id={`task-type-${option}`} value={option} disabled={disabled} />
                    <FieldContent>
                      <FieldLabel htmlFor={`task-type-${option}`} className="text-sm">
                        {tRequestType(`${option}.label` as Parameters<typeof tRequestType>[0])}
                      </FieldLabel>
                      <FieldDescription className="text-xs">
                        {disabled
                          ? t("externalDisabledReason")
                          : tRequestType(`${option}.description` as Parameters<typeof tRequestType>[0])}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                );
              })}
            </RadioGroup>
          </FormField>

          {/*
           * ── TỆP ĐÍNH KÈM: MỘT DÒNG NÓI RÕ, KHÔNG PHẢI MỘT Ô TẢI LÊN NỬA VỜI ─────────────────
           * `ImageUploadField` của gói tải tệp lên NGAY khi người dùng chọn, tới một `endpoint` gắn
           * với một bản ghi đã tồn tại — mà ở bước này công việc còn chưa có `id`, nên chưa có
           * endpoint nào để trỏ tới (`attachmentObjectKey` dựng khoá quanh `taskId`).
           *
           * Đường còn lại là giữ tệp trong state rồi gửi kèm `FormData` của lệnh tạo. Đã cân nhắc
           * và BỎ, vì nó nhét một tác dụng phụ CÓ THỂ HỎNG vào giữa một request đã ghi xong bản
           * ghi: kho ảnh lỗi sau khi `INSERT` thành công thì hoặc request đỏ (người dùng bấm lại →
           * hai công việc trùng nội dung), hoặc ta nuốt lỗi (người dùng mất tệp mà không ai nói).
           * Đính kèm ở một bước RIÊNG, trên một công việc đã có, thì thử lại được và không kéo theo
           * gì cả — cùng lý do `sendMail` được nuốt lỗi thay vì làm hỏng lệnh tạo.
           */}
          <FormField colSpan={12}>
            <Alert variant={storageEnabled ? undefined : "warning"}>
              <Paperclip aria-hidden="true" />
              <AlertTitle>{tField("attachment")}</AlertTitle>
              <AlertDescription>
                <p>{storageEnabled ? t("attachmentAfterCreate") : tErrors("STORAGE_NOT_CONFIGURED")}</p>
              </AlertDescription>
            </Alert>
          </FormField>
        </FormSection>

        <FormSection
          title={t("sectionAssignmentTitle")}
          description={t("sectionAssignmentDescription")}
          icon={UsersRound}
        >
          <FormField
            label={tField("project")}
            htmlFor={FIELD_IDS.projectId}
            required
            description={t("projectDescription")}
            error={errorOf("projectId")}
            colSpan={6}
          >
            {(control) => (
              <Combobox
                {...control}
                options={projectOptions}
                value={form.projectId}
                onValueChange={(value) => update("projectId", value)}
                placeholder={t("projectPlaceholder")}
                searchPlaceholder={t("projectSearchPlaceholder")}
                emptyText={t("projectEmpty")}
                clearable
                clearLabel={tCommon("clearSelection")}
              />
            )}
          </FormField>

          <FormField
            label={tField("assignee")}
            htmlFor={FIELD_IDS.assigneeUserId}
            required
            description={t("assigneeDescription")}
            error={errorOf("assigneeUserId")}
            colSpan={6}
          >
            {(control) => (
              <Combobox
                {...control}
                options={memberOptions}
                value={form.assigneeUserId}
                onValueChange={(value) => update("assigneeUserId", value)}
                placeholder={t("assigneePlaceholder")}
                searchPlaceholder={t("memberSearchPlaceholder")}
                emptyText={t("memberEmpty")}
                clearable
                clearLabel={tCommon("clearSelection")}
              />
            )}
          </FormField>

          <FormField
            label={tField("watchers")}
            htmlFor="task-watchers"
            description={t("watchersDescription")}
            colSpan={6}
          >
            {(control) => (
              <MultiCombobox
                {...control}
                options={memberOptions}
                value={form.watcherUserIds}
                onValueChange={(value) => update("watcherUserIds", value)}
                placeholder={t("watchersPlaceholder")}
                searchPlaceholder={t("memberSearchPlaceholder")}
                emptyText={t("memberEmpty")}
                maxSelected={5}
                selectedCountLabel={(selected, max) => t("watchersSelected", { selected, max })}
                clearLabel={tCommon("clearAllSelections")}
              />
            )}
          </FormField>

          <FormField
            label={tField("priority")}
            htmlFor="task-priority"
            description={t("priorityDescription")}
            colSpan={6}
          >
            {(control) => (
              <Select
                value={form.priority}
                onValueChange={(value) =>
                  update("priority", priorityConfigs.find((item) => item.value === value)?.value ?? form.priority)
                }
              >
                {/* `SelectTrigger` mặc định `w-fit` → trong lưới biểu mẫu luôn phải thêm `w-full`. */}
                <SelectTrigger {...control} className="w-full">
                  <SelectValue placeholder={t("priorityPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {priorityConfigs.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label={tField("dueDate")}
            htmlFor={FIELD_IDS.dueDate}
            required
            description={t("dueDateDescription")}
            error={errorOf("dueDate")}
            colSpan={6}
          >
            {/* `locale` và `labels` PHẢI truyền cả hai: `locale` mang thứ tự ngày/tháng và tên thứ
                trong lịch, `labels` mang chuỗi giao diện. Thiếu cái nào thì giao diện tiếng Anh vẫn
                lộ ra một nửa tiếng Việt. */}
            {(control) => (
              <DatePicker
                {...control}
                value={isoToDate(form.dueDate)}
                onValueChange={(value) => update("dueDate", dateToIso(value))}
                minDate={today.date}
                locale={dateFnsLocale}
                labels={DATE_PICKER_LABELS[locale]}
              />
            )}
          </FormField>

          <FormField
            label={tField("estimate")}
            htmlFor={FIELD_IDS.estimateHours}
            required
            description={t("estimateDescription", { max: ESTIMATE_MAX_HOURS })}
            error={errorOf("estimateHours")}
            colSpan={6}
          >
            {(control) => (
              <Input
                {...control}
                value={form.estimateHours}
                onChange={(event) => update("estimateHours", event.target.value)}
                inputMode="decimal"
                placeholder="8"
                rightAddon={<span className="text-xs">{tTask("hourUnit")}</span>}
              />
            )}
          </FormField>
        </FormSection>

        <FormSection
          title={t("sectionApprovalTitle")}
          description={t("sectionApprovalDescription")}
          icon={BellRing}
          collapsible
          defaultOpen
        >
          {/* Không có nhãn ở cấp `FormField`: `Switch` tự mang nhãn và mô tả của nó, `FormField` ở
              đây chỉ làm nhiệm vụ đặt ô vào lưới 12 cột. */}
          <FormField colSpan={6}>
            <Switch
              checked={form.needsApproval}
              onCheckedChange={(checked) => update("needsApproval", checked)}
              label={t("approvalToggleLabel")}
              description={t("approvalToggleDescription")}
            />
          </FormField>

          <FormField
            label={t("approvalFlowLabel")}
            htmlFor={FIELD_IDS.approvalFlowId}
            required={form.needsApproval}
            description={
              form.needsApproval
                ? selectedFlowId
                  ? t(`flow.${selectedFlowId}.steps` as Parameters<typeof t>[0])
                  : t("approvalFlowHint")
                : t("approvalFlowDisabledHint")
            }
            error={errorOf("approvalFlowId")}
            colSpan={6}
          >
            {/* Vô hiệu PHỤ THUỘC vào công tắc bên cạnh, không phải vô hiệu vĩnh viễn: mô tả của
                trường đổi theo để nói rõ cần làm gì mới mở khoá được. */}
            {(control) => (
              <Select
                value={toSelectValue(selectedFlowId)}
                /* `fromSelectValue` trả `""` cho mục rỗng; state giữ `null` để khớp cột nullable —
                   một chuỗi rỗng lọt xuống database là một giá trị thứ ba nghĩa là "chưa chọn". */
                onValueChange={(value) => update("approvalFlowId", fromSelectValue(value) || null)}
                disabled={!form.needsApproval}
              >
                <SelectTrigger {...control} className="w-full">
                  <SelectValue placeholder={t("approvalFlowPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {/* Radix cấm `value=""` → mục "chưa chọn" dùng sentinel dùng chung của gói. */}
                  <SelectItem value={SELECT_EMPTY_VALUE}>{t("approvalFlowNone")}</SelectItem>
                  {APPROVAL_FLOWS.map((flowId) => (
                    <SelectItem key={flowId} value={flowId}>
                      {t(`flow.${flowId}.label` as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField
            label={t("channelsLabel")}
            htmlFor={FIELD_IDS.notifyChannels}
            required
            description={t("channelsDescription")}
            error={errorOf("notifyChannels")}
            colSpan={12}
          >
            <div id={FIELD_IDS.notifyChannels} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {NOTIFY_CHANNELS.map((channelId) => (
                <Field key={channelId} orientation="horizontal">
                  <Checkbox
                    id={`task-channel-${channelId}`}
                    checked={form.notifyChannels.includes(channelId)}
                    onCheckedChange={(checked) => toggleChannel(channelId, checked === true)}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={`task-channel-${channelId}`} className="text-sm">
                      {t(`channel.${channelId}.label` as Parameters<typeof t>[0])}
                    </FieldLabel>
                    <FieldDescription className="text-xs">
                      {t(`channel.${channelId}.description` as Parameters<typeof t>[0])}
                    </FieldDescription>
                    {/*
                     * Kênh LƯU được nhưng chưa GIAO được thì phải nói ra — nếu không ta vừa chữa
                     * một lời nói dối (ô "Email" không gác gì) vừa dựng lời nói dối tiếp theo.
                     * Cùng câu chữ với `<NotYetActive />` ở /settings, viết tại chỗ vì component
                     * kia thuộc route settings và namespace `settings`.
                     * `shrink-0` + `items-start`: không có nó thì icon bị nén ngang khi dòng chật.
                     */}
                    {DELIVERABLE_NOTIFY_CHANNELS.includes(channelId) ? null : (
                      <span className="mt-1 flex items-start gap-1.5 text-xs text-warning-ink">
                        <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                        <span>{t("channelNotDeliveredYet")}</span>
                      </span>
                    )}
                  </FieldContent>
                </Field>
              ))}
            </div>
          </FormField>

          <FormField colSpan={6}>
            <Switch
              checked={form.remindBeforeDue}
              onCheckedChange={(checked) => update("remindBeforeDue", checked)}
              label={t("remindLabel")}
              description={t("remindDescription")}
            />
          </FormField>

          <FormField colSpan={6}>
            <Switch
              checked={form.syncWithCalendar}
              onCheckedChange={(checked) => update("syncWithCalendar", checked)}
              label={t("calendarLabel")}
              description={t("calendarDescription")}
            />
          </FormField>
        </FormSection>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {t("draftHint")}{" "}
            {draft !== null && (
              /*
               * `<Button variant="link">` chứ KHÔNG phải một thẻ <button> tự tô class: gói đã có sẵn
               * biến thể này, và tự viết là mất vòng `focus-visible` của gói cùng màu link của
               * design system.
               *
               * `className` ở đây chỉ ghi đè KÍCH THƯỚC, không đụng màu: `variant="link"` khai
               * `p-0 h-auto`, nhưng cva xếp lớp của `size` SAU lớp của `variant` nên `h-9 px-4` của
               * size mặc định thắng ở tailwind-merge và nút cao 36px giữa một dòng chữ nhỏ.
               */
              <Button
                type="button"
                variant="link"
                onClick={handleRestoreDraft}
                className="h-auto p-0 align-baseline text-xs"
              >
                {t("restoreDraft")}
              </Button>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/tasks">{tCommon("cancel")}</Link>
            </Button>
            {/* Vô hiệu vì KHÔNG CÓ GÌ ĐỂ LƯU — trạng thái thật của dữ liệu, không phải để trưng bày.
                Sửa bất kỳ ô nào là nút bật lại. */}
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || savingDraft}
              onClick={handleSaveDraft}
              leftIcon={<Save aria-hidden="true" className="size-4" />}
            >
              {savingDraft ? t("savingDraft") : t("saveDraft")}
            </Button>
            <Button type="submit" disabled={submitting} leftIcon={<Plus aria-hidden="true" className="size-4" />}>
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </div>
        </div>
      </form>

      <Card className="lg:sticky lg:top-4" padding="none">
        <CardHeader className="p-5 pb-3">
          <CardTitle>{t("summaryTitle")}</CardTitle>
          <CardDescription>{t("summaryDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{tField("project")}</dt>
              <dd className="text-foreground">{selectedProject?.label ?? <EmptyValue label={t("empty")} />}</dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{tField("assignee")}</dt>
              <dd>
                {selectedAssignee ? (
                  <span className="flex items-center gap-2">
                    <LetterAvatar name={selectedAssignee.label} size="sm" />
                    <span className="min-w-0 truncate text-foreground">{selectedAssignee.label}</span>
                  </span>
                ) : (
                  <EmptyValue label={t("empty")} />
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{tField("watchers")}</dt>
              <dd>
                {form.watcherUserIds.length > 0 ? (
                  /* `label` đặt tên cho CẢ NHÓM, `overflowLabel` đặt tên cho riêng ô "+k" — dịch mỗi
                     `label` thì nhóm mang tên tiếng Anh mà nút cuối vẫn xưng tiếng Việt. */
                  <AvatarGroup
                    size="sm"
                    label={tField("watchers")}
                    overflowLabel={(count) => t("watchersOverflow", { count })}
                    items={form.watcherUserIds.map((id) => {
                      const option = memberOptions.find((item) => item.value === id);
                      /* `?? null` chứ không để `undefined`: `AvatarGroupItem.src` nhận
                         `string | null`, và `LetterAvatar` chỉ rơi về initials khi src nullish. */
                      return {
                        id,
                        name: option?.label ?? id,
                        src: memberAvatarUrls[id] ?? null,
                        caption: option?.description
                      };
                    })}
                  />
                ) : (
                  <EmptyValue label={t("empty")} />
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{tField("priority")}</dt>
              <dd>
                <StatusPill configs={priorityConfigs} value={form.priority} />
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{tField("dueDate")}</dt>
              <dd className="text-foreground tabular-nums">
                {form.dueDate ? formatIsoDateFor(locale, form.dueDate) : <EmptyValue label={t("empty")} />}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{tField("estimate")}</dt>
              <dd className="text-foreground tabular-nums">
                {estimateHours === null ? (
                  <EmptyValue label={t("empty")} />
                ) : (
                  t("estimateValue", { hours: estimateHours, unit: tTask("hourUnit") })
                )}
              </dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{t("approvalSummaryLabel")}</dt>
              <dd className="text-foreground">
                {form.needsApproval ? (
                  selectedFlowId ? (
                    t(`flow.${selectedFlowId}.label` as Parameters<typeof t>[0])
                  ) : (
                    <EmptyValue label={t("empty")} />
                  )
                ) : (
                  t("approvalNotNeeded")
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

/** Giá trị chưa có — chữ mờ, không phải ô trống, để người đọc biết là "chưa điền" chứ không phải lỗi. */
function EmptyValue({ label }: { label: string }) {
  return <span className="text-muted-foreground">{label}</span>;
}
