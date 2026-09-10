"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Checkbox,
  FormSection,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@comitor/ui";
import { Building2, Check, ExternalLink, Lock, Minus, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, type ReactNode, useCallback, useRef } from "react";
import { useSettingsDraft } from "@/hooks/use-settings-draft";
import { savePermissions } from "@/lib/api-client/settings";
import {
  PERMISSION_GROUPS,
  PERMISSION_RULES,
  toPermissionMessageKey,
  WORKSPACE_ROLES
} from "@/lib/catalog/permissions";
import type { WorkspaceRoleId } from "@/lib/contracts/account";
import type { AppPermissionId, PermissionMatrix } from "@/lib/contracts/settings";
import { type PermissionLock, permissionLock } from "@/lib/core/permissions";
import { HelpTip, SettingsSaveBar } from "../settings-form-chrome";

/**
 * Nửa TƯƠNG TÁC của tab "Phân quyền" (`/settings/permissions`) — ma trận **vai trò × chức năng**.
 *
 * VÌ SAO CỤM NÀY TỒN TẠI: gói có `DataTable` cho dữ liệu (sắp xếp, lọc, phân trang, chọn dòng),
 * nhưng đây không phải danh sách bản ghi — nó là một lưới ô bật/tắt có nhóm dòng, cột là hằng khai
 * của module. Vì vậy nó dựng trên primitive `Table` của gói, và không có component tự viết nào:
 * `Table`, `Checkbox`, `Tooltip`, `Alert`, `Badge`, `FormSection` đều là của `@comitor/ui`.
 *
 * File này KHÔNG đọc bản ghi nào: ma trận đã lưu, vị từ `canEdit`, vai trò của người đang đăng nhập,
 * tên không gian làm việc và đường sang Account đều đi vào bằng prop từ `page.tsx`. Thứ nó `import`
 * thẳng là BẢNG KHAI (`WORKSPACE_ROLES`, `PERMISSION_RULES`) và một hàm THUẦN (`permissionLock`).
 *
 * ⚠ `permissionLock` được gọi từ file `"use client"` này, và điều đó KHÔNG vi phạm luật "vị từ phải
 * tính trên state": luật đó nhắm vào những hàm tra BẢN GHI — chúng trả lời theo ảnh chụp trước mọi
 * thay đổi người dùng vừa làm trong phiên. `permissionLock` chỉ đọc hai hằng đúng của module, không
 * có state nào để lệch. Ngược lại, số quyền đã cấp ở đầu mỗi cột PHẢI đếm trên `draft` — đếm trên
 * `savedMatrix` thì bỏ tick một ô xong con số vẫn đứng yên, và người dùng không có cách nào biết
 * bên nào đúng.
 */

export interface PermissionMatrixFormProps {
  savedMatrix: PermissionMatrix;
  /**
   * Thẻ phiên bản của `savedMatrix`, tính ở máy chủ. Gửi lại nguyên văn khi lưu để máy chủ phát
   * hiện được "có người khác đã lưu trong lúc trang này mở".
   */
  savedVersion: string;
  /** Tính ở máy chủ từ chính ma trận này (`app.permissions`). `false` → bảng chỉ đọc. */
  canEdit: boolean;
  /** Vai trò thô của người đang đăng nhập — Account cấp, dùng để đánh dấu cột "của bạn". */
  currentRoleId: WorkspaceRoleId;
  workspaceName: string;
  /** Trang quản lý thành viên bên Comitor.Account — nơi vai trò thô thật sự được cấp. */
  membersUrl: string;
}

export function PermissionMatrixForm({
  savedMatrix,
  savedVersion,
  canEdit,
  currentRoleId,
  workspaceName,
  membersUrl
}: PermissionMatrixFormProps) {
  const t = useTranslations("settings.permissions");
  const tRoles = useTranslations("roles");

  /*
   * ⚠ THẺ PHIÊN BẢN NẰM NGOÀI `draft`, trong một ref — cố ý.
   *
   * `useSettingsDraft` tính `isDirty` bằng cách so `draft` với `saved`. Nhét `version` vào giá trị
   * ấy thì mỗi lần lưu xong máy chủ trả về một thẻ MỚI, `saved` đổi, và `isDirty` bật lại ngay —
   * thanh Lưu không bao giờ tắt, và người dùng không bao giờ biết mình đã lưu xong. Hook đó dùng
   * chung cho BỐN tab, nên đây là chỗ đắt nhất nếu làm sai.
   *
   * Ref thì đúng ngữ nghĩa: thẻ không phải thứ người dùng sửa, nó là siêu dữ liệu của lần đọc gần
   * nhất, và nó chỉ đổi ở đúng một chỗ — sau một lần lưu thành công.
   */
  const versionRef = useRef(savedVersion);

  const persist = useCallback(async (matrix: PermissionMatrix) => {
    const result = await savePermissions(matrix, versionRef.current);
    versionRef.current = result.version;
    return result.matrix;
  }, []);

  const { draft, setDraft, isDirty, isSaving, save, reset } = useSettingsDraft(savedMatrix, persist, {
    canEdit
  });

  const toggle = (roleId: WorkspaceRoleId, permissionId: AppPermissionId, granted: boolean) =>
    setDraft({ ...draft, [roleId]: { ...draft[roleId], [permissionId]: granted } });

  /** Đếm TRÊN BẢN NHÁP — xem chú thích đầu file. */
  const grantedCount = (roleId: WorkspaceRoleId) => PERMISSION_RULES.filter((rule) => draft[roleId][rule.id]).length;

  return (
    <div className="space-y-5">
      {/*
       * `bg-muted` + tone TRUNG TÍNH, KHÔNG phải `variant="warning"`.
       *
       * Khối này chỉ NÓI dữ liệu đến từ đâu — không có gì hỏng, không có gì cần chú ý. Nhưng nó
       * cũng không nên trông y hệt các card cài đặt bên dưới, nên nền tint là cách tách nó ra mà
       * không mượn tông cảnh báo.
       *
       * ⚠ Đã thử `variant="warning"` và ĐO ĐƯỢC cái giá: variant đó KHÔNG đổi nền, nó chỉ đổi màu
       * CHỮ sang `--warning-ink`. Mà trang này đã có một alert `warning` — thông báo "bạn chỉ xem
       * được bảng này" khi thiếu quyền `app.permissions`. Dựng cảnh người chỉ-đọc thì hai alert
       * xếp chồng, CÙNG ĐÚNG một màu `rgb(122,88,0)`, và cái thật sự cần chú ý lẫn vào cái ghi
       * chú. Tông cảnh báo chỉ đáng giá khi nó hiếm.
       *
       * `bg-muted` là TOKEN của gói, không phải màu app tự chế — luật số 1 cấm app SỞ HỮU màu,
       * không cấm chọn một bậc có sẵn.
       */}
      <Alert className="bg-muted">
        {/*
         * `Building2`, KHÔNG phải `ShieldCheck`. Hai lý do:
         *
         * · `ShieldCheck` đã là icon của `<FormSection>` ngay bên dưới ("Phân quyền theo chức
         *   năng"), nên dùng lại ở đây là hai khối liền nhau mang cùng một hình — mắt đọc ra
         *   "cùng một thứ", trong khi chúng nói hai chuyện khác hẳn.
         * · Khối này nói về KHÔNG GIAN LÀM VIỆC ("bốn vai trò thuộc về workspace X, do
         *   Comitor.Account cấp"), và `Building2` chính là icon mà `<WorkspaceSwitcher>` của gói
         *   dùng cho workspace. Cùng khái niệm thì cùng hình — đó là nhất quán, không phải trùng.
         */}
        <Building2 aria-hidden="true" />
        <AlertTitle>{t("accountTitle")}</AlertTitle>
        <AlertDescription>
          <p>
            {t.rich("accountBody", {
              workspace: workspaceName,
              strong: (chunks) => <strong className="font-medium">{chunks}</strong>
            })}
          </p>
          <ExternalAccountLink href={membersUrl} newTabHint={t("newTab")}>
            {t("membersLink")}
          </ExternalAccountLink>
        </AlertDescription>
      </Alert>

      {/*
       * Nói ra VÌ SAO bảng không bấm được. Một lưới ô xám không lời giải thích khiến người dùng nghĩ
       * giao diện hỏng; giao diện có nghĩa vụ nói lý do, không chỉ nói "không được".
       */}
      {!canEdit && (
        <Alert variant="warning">
          <Lock aria-hidden="true" />
          <AlertTitle>{t("readOnlyTitle")}</AlertTitle>
          <AlertDescription>{t("readOnlyDescription")}</AlertDescription>
        </Alert>
      )}

      <FormSection
        title={t("sectionTitle")}
        description={t("sectionDescription")}
        icon={ShieldCheck}
        actions={<HelpTip label={t("helpLabel")}>{t("help")}</HelpTip>}
        contentClassName="gap-0 p-0 md:gap-0 md:p-0"
      >
        {/*
         * Bảng là THÂN của card, không phải một card thứ hai đặt bên trong.
         *
         * `Table` của gói tự vẽ `rounded-xl border border-border`, nên đặt nó vào `FormSection`
         * (cũng `rounded-xl border`) là hai khung lồng nhau — và cái giá không chỉ là rối mắt.
         * Đo ở 375px: `p-4` của thân card + hai lớp viền ăn mất **34px**, mà chỗ hẹp nhất của
         * trang này lại là chỗ đắt nhất — cột đầu GHIM chiếm hơn nửa bề ngang, nên 34px đó là
         * gần nửa một cột vai trò. Trước: 1,78 cột vai trò nhìn thấy được. Sau: 2,87.
         *
         * Cách chữa gồm ba mảnh, cả ba đều cần:
         * · `contentClassName="p-0"` — bỏ padding thân card (padding trả lại cho `<dl>` bên dưới);
         * · biến thể `[&>[data-slot=table-container]]` — gỡ viền và bo góc của khung cuộn mà gói
         *   vẽ sẵn. `data-slot` là móc CSS mà gói đặt trên MỌI phần tử, tức API công khai, không
         *   phải nội thất chọc vào được nhờ may mắn. Bộ chọn hậu duệ có độ đặc hiệu 0,2,0 nên nó
         *   thắng lớp `border` (0,1,0) của gói bất kể thứ tự trong file CSS;
         * · viền ngăn thì đã có sẵn: header của `FormSection` mang `border-b`, `<dl>` mang
         *   `border-t`. Không thêm đường kẻ nào.
         *
         * ⚠ ĐỪNG bọc lại bằng `border`/`rounded` ở đây. Card ngoài đã có cả hai; thêm lần nữa là
         * quay về đúng thứ vừa gỡ.
         */}
        <div className="col-span-12 [&>[data-slot=table-container]]:rounded-none [&>[data-slot=table-container]]:border-0">
          {/*
           * `min-w-*` để bảng giữ đủ bề rộng đọc được rồi CUỘN NGANG ở màn hình hẹp — `Table` của
           * gói đã bọc sẵn khung `overflow-auto`, nên phần cuộn nằm trong bảng chứ không đẩy cả
           * trang trôi ngang.
           *
           * Con số `26rem` là ĐO, không phải ước: dưới `sm` các cột khai `w-36` + 4×`w-16` = 25rem,
           * nên mọi rem thừa bị chia đều cho năm cột và cột nào cũng phình. `30rem` của bản trước
           * thổi cột đầu từ 144px lên 172px — tức bề ngang quý nhất của trang đem cho cột ĐÃ ghim.
           * `26rem` để lại đúng 8px dư: vừa đủ cho cột thứ ba BỊ CẮT trông thấy được ở mép phải
           * (người dùng biết còn cột nữa mà cuộn), trong khi ô đánh dấu của nó nằm giữa cột nên
           * vẫn hiện đủ. `25rem` khít quá — mép cắt rơi đúng ranh giới cột và bảng trông như đã
           * hết cột.
           *
           * Cột đầu GHIM (`sticky left-0`): cuộn sang phải mà mất tên chức năng thì cả bảng thành
           * một lưới ô vô nghĩa. Nền của ô ghim lấy bằng `bg-inherit` từ chính `<tr>` — đặt một lớp
           * nền có alpha ở đây là ô ghim hoá trong suốt và để lộ nội dung đang cuộn bên dưới.
           */}
          <Table className="min-w-[26rem] bg-card">
            <TableHeader className="bg-transparent">
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="sticky left-0 z-20 w-36 min-w-36 border-r border-border bg-inherit sm:w-64 sm:min-w-64">
                  {t("featureColumn")}
                </TableHead>
                {WORKSPACE_ROLES.map((roleId) => (
                  <TableHead
                    key={roleId}
                    /* `max-sm:tracking-normal`: giãn chữ 0,08em của gói làm "CHỦ SỞ HỮU" vỡ
                       thành BA dòng trong cột 16 (đo: header cao 67px). Bỏ giãn ở màn hẹp thì
                       nó về hai dòng, header còn 51px — 16px trả lại cho nội dung. Từ `sm` cột
                       rộng 20 nên giãn chữ của gói giữ nguyên. */
                    className="w-16 min-w-16 whitespace-normal px-2 text-center max-sm:tracking-normal sm:w-20 sm:min-w-20"
                  >
                    {tRoles(`${roleId}.short`)}
                    <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal tabular-nums">
                      {t("grantedCount", { granted: grantedCount(roleId), total: PERMISSION_RULES.length })}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {PERMISSION_GROUPS.map((groupId) => (
                <Fragment key={groupId}>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead scope="colgroup" colSpan={WORKSPACE_ROLES.length + 1} className="text-foreground/80">
                      {/*
                       * Ô này trải hết bề ngang bảng nên KHÔNG ghim được như ô đầu dòng — ghim chính
                       * nó thì chẳng có gì để ghim. Ghim phần CHỮ bên trong: nó trượt trong lòng ô,
                       * nên nhãn nhóm còn đọc được ở mọi vị trí cuộn ngang.
                       *
                       * `left-4` khớp đúng `px-4` của `TableHead`: ở vị trí cuộn 0, ngưỡng ghim
                       * trùng chỗ chữ vốn đứng nên không có cú nhảy khi bắt đầu cuộn.
                       */}
                      <span className="sticky left-4 inline-block">{t(`group.${groupId}`)}</span>
                    </TableHead>
                  </TableRow>

                  {PERMISSION_RULES.filter((rule) => rule.groupId === groupId).map((rule) => {
                    const messageKey = toPermissionMessageKey(rule.id);

                    return (
                      <TableRow key={rule.id} className="bg-card">
                        <TableHead
                          scope="row"
                          className="sticky left-0 z-10 w-36 min-w-36 whitespace-normal border-r border-border bg-inherit py-3 normal-case tracking-normal sm:w-64 sm:min-w-64"
                        >
                          <span className="block text-sm font-medium text-foreground">
                            {t(`item.${messageKey}.label` as Parameters<typeof t>[0])}
                          </span>
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {t(`item.${messageKey}.description` as Parameters<typeof t>[0])}
                          </span>
                        </TableHead>

                        {WORKSPACE_ROLES.map((roleId) => (
                          <TableCell key={roleId} className="px-2 text-center">
                            <PermissionCell
                              lock={permissionLock(roleId, rule.write)}
                              granted={draft[roleId][rule.id]}
                              canEdit={canEdit}
                              onChange={(granted) => toggle(roleId, rule.id, granted)}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>

        {/*
         * Chú giải bốn vai trò. Đặt DƯỚI bảng chứ không nhét vào đầu cột: cột chỉ rộng 5rem, và một
         * tooltip trên tiêu đề cột thì người dùng bàn phím không mở được.
         */}
        <dl className="col-span-12 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border p-4 sm:grid-cols-2 md:p-5">
          {WORKSPACE_ROLES.map((roleId) => (
            <div key={roleId}>
              <dt className="flex items-center gap-2 text-sm font-medium text-foreground">
                {tRoles(`${roleId}.label`)}
                {roleId === currentRoleId && (
                  <Badge variant="outline" size="sm">
                    {t("yourRole")}
                  </Badge>
                )}
              </dt>
              <dd className="mt-0.5 text-xs text-muted-foreground">{tRoles(`${roleId}.description`)}</dd>
            </div>
          ))}
        </dl>
      </FormSection>

      {/* Không có gì để lưu thì không có thanh lưu — một nút vĩnh viễn xám chỉ tạo cảm giác hỏng. */}
      {canEdit && <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} onReset={reset} onSave={save} />}
    </div>
  );
}

/**
 * Một ô của ma trận. Ba hình dạng, và chúng nói ba chuyện khác nhau:
 *
 *   · **khoá** — dấu ✓ hoặc ổ khoá, kèm câu giải thích vì sao ô này không đổi được;
 *   · **chỉ đọc** — dấu ✓ hoặc gạch ngang, cho người không có quyền `app.permissions`;
 *   · **sửa được** — ô đánh dấu bình thường.
 *
 * Ô khoá KHÔNG dựng bằng `<Checkbox disabled>`: ô vô hiệu của Radix không nhận focus nên tooltip
 * không mở được bằng bàn phím, và một ô mờ không nói được nó mờ vì "luôn có quyền" hay vì "không
 * cấp được" — hai chuyện ngược hẳn nhau. Vì vậy mỗi trạng thái mang một ICON riêng, và theo đúng
 * luật trợ năng của repo: tooltip cho người NHÌN, còn `role="img"` + `aria-label` trên cùng phần tử
 * bọc mới là tên gọi mà trình đọc màn hình nghe được.
 *
 * Tên đầy đủ của ô do CHÍNH BẢNG cấp: `<th scope="row">` ở đầu dòng và `<th>` ở đầu cột, nên
 * `aria-label` ở đây chỉ cần nói TRẠNG THÁI — nhồi cả tên chức năng lẫn tên vai trò vào là mỗi ô
 * đọc lên ba lần cùng một chuyện.
 */
function PermissionCell({
  lock,
  granted,
  canEdit,
  onChange
}: {
  lock: PermissionLock | undefined;
  granted: boolean;
  canEdit: boolean;
  onChange: (granted: boolean) => void;
}) {
  const t = useTranslations("settings.permissions");

  if (lock) {
    const LockIcon = lock === "always" ? Check : Lock;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span role="img" aria-label={t(`lock.${lock}.label`)} className="inline-flex text-muted-foreground">
            <LockIcon className="size-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64">
          {t(`lock.${lock}.reason`)}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!canEdit) {
    const StateIcon = granted ? Check : Minus;

    return (
      <span
        role="img"
        aria-label={granted ? t("granted") : t("notGranted")}
        className="inline-flex text-muted-foreground"
      >
        <StateIcon className="size-4" />
      </span>
    );
  }

  return (
    <Checkbox
      checked={granted}
      onCheckedChange={(checked) => onChange(checked === true)}
      aria-label={granted ? t("granted") : t("notGranted")}
    />
  );
}

/**
 * Liên kết sang Comitor.Account — mở TAB MỚI, có chủ ý.
 *
 * Account là một sản phẩm riêng ở một tên miền riêng. Mở đè lên tab hiện tại là kéo người dùng ra
 * khỏi việc họ đang làm dở giữa trang cài đặt; `target="_blank"` giữ cả hai. Kèm theo đó là hai thứ
 * bắt buộc: `rel="noreferrer"` và một câu chỉ trình đọc màn hình nghe thấy — biểu tượng mũi tên
 * chéo là tín hiệu chỉ dành cho người nhìn.
 */
function ExternalAccountLink({
  href,
  newTabHint,
  children
}: {
  href: string;
  newTabHint: string;
  children: ReactNode;
}) {
  /*
   * MỘT icon, ở CUỐI. Bản trước còn một icon chủ đề (`UsersRound`) dẫn đầu, và hai icon kẹp hai
   * đầu một liên kết hai dòng thì cái bên trái neo ở dòng thứ nhất còn cái bên phải rơi xuống
   * dòng cuối — hai điểm nhấn lệch nhau theo chiều dọc, trong khi chỉ một cái mang thông tin.
   * Mũi tên chéo là thứ nói "liên kết này rời khỏi ứng dụng"; icon chủ đề chỉ nhắc lại điều mà
   * chính câu chữ đã nói.
   *
   * Vì thế đây là dòng chữ THUẦN, không phải hàng flex: mũi tên đi liền chữ cuối và xuống dòng
   * cùng nó. ⚠ Đừng dựng lại `inline-flex` để "canh cho thẳng" — đã đo ở bản flex: chữ và mũi
   * tên thành hai item, chữ xuống dòng là hộp của nó chiếm trọn bề rộng còn lại và mũi tên bị
   * đẩy ra sau, đứng lơ lửng cách chữ 141px ở mép phải.
   */
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-foreground underline underline-offset-2"
    >
      {children}
      {/* `inline-block` để mũi tên không bị tách khỏi chữ cuối khi dòng gãy. */}
      <ExternalLink className="ml-1 inline-block size-3.5 align-text-bottom" aria-hidden="true" />
      <span className="sr-only">{newTabHint}</span>
    </a>
  );
}
