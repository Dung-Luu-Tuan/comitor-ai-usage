"use client";

import { toast } from "@comitor/ui";
import { ImageUploadField } from "@comitor/ui/uploader";
import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { clearTaskAttachment } from "@/lib/api-client/tasks";
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from "@/lib/core/attachment";

/**
 * Ô đính kèm của trang chi tiết.
 *
 * ── VÌ SAO TẢI LÊN KHÔNG ĐI QUA `lib/api-client/` ───────────────────────────────────────
 * Vì nó không đi qua `fetch` của app: `ImageUploadField` chạy Uppy (headless) để có hàng đợi, tiến
 * độ theo byte, thử lại và huỷ — bốn thứ mà một lời gọi `fetch` trần không có. Gói POST một
 * `multipart/form-data` thẳng tới `endpoint`, nên hợp đồng ở đây là **đường dẫn + tên trường**,
 * không phải một hàm của tầng 2.
 *
 * Đó là một ngoại lệ có ranh giới rõ: đường GỠ (`clearTaskAttachment`) vẫn đi `lib/api-client/`
 * như mọi thao tác ghi khác, vì nó là một lời gọi JSON bình thường.
 *
 * ⚠ `maxFileSize` và `allowedFileTypes` lấy từ `lib/core/attachment.ts` — CÙNG hằng mà máy chủ
 * dùng. Chép tay hai con số ở hai phía là để chúng lệch, và chỗ lệch có hình dạng khó chịu nhất:
 * trình duyệt cho qua thứ máy chủ từ chối, nên người dùng chờ hết một lần tải rồi mới nhận lỗi.
 * Đây KHÔNG phải phân quyền hay bảo mật — nó là phép lọc rẻ ở phía gần người dùng; chốt thật vẫn
 * ở rìa B (`sniffImageType` đọc byte thật).
 */

export interface TaskAttachmentFieldProps {
  taskId: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  canEdit: boolean;
  storageEnabled: boolean;
}

export function TaskAttachmentField({
  taskId,
  attachmentUrl,
  attachmentName,
  canEdit,
  storageEnabled
}: TaskAttachmentFieldProps) {
  const t = useTranslations("taskDetail");
  const tErrors = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!storageEnabled) {
    return <p className="text-sm text-muted-foreground">{tErrors("STORAGE_NOT_CONFIGURED")}</p>;
  }

  return (
    <ImageUploadField
      endpoint={`/api/tasks/${encodeURIComponent(taskId)}/attachment`}
      maxFileSize={MAX_ATTACHMENT_BYTES}
      allowedFileTypes={[...ALLOWED_ATTACHMENT_TYPES]}
      hasImage={attachmentUrl !== null}
      editable={canEdit}
      busy={busy}
      preview={
        attachmentUrl ? (
          /*
           * `<img>` chứ không `next/image`: `attachmentUrl` là URL ĐÃ KÝ, CÓ HẠN và đổi ở mỗi lần
           * đọc. Đưa nó qua bộ tối ưu ảnh của Next là tạo một bản cache theo một URL sắp hết hạn,
           * và bộ tối ưu đó cũng cần host nằm trong `images.remotePatterns` — tức một danh sách
           * host thứ hai phải giữ đồng bộ với cấu hình S3.
           */
          // biome-ignore lint/performance/noImgElement: URL đã ký, có hạn — xem chú thích ngay trên.
          <img
            src={attachmentUrl}
            alt={attachmentName ?? t("attachment")}
            className="size-16 rounded-md border border-border object-cover"
          />
        ) : (
          <span
            role="img"
            aria-label={t("attachment")}
            className="flex size-16 items-center justify-center rounded-md border border-border text-muted-foreground"
          >
            <Paperclip aria-hidden="true" className="size-5" />
          </span>
        )
      }
      labels={{
        choose: t("attachmentChoose"),
        uploading: t("attachmentUploading"),
        remove: t("attachmentRemove"),
        hint: t("attachmentHint"),
        dropPrompt: t("attachmentDrop"),
        uploadFailed: t("attachmentFailed")
      }}
      onUploaded={() => {
        toast(t("attachmentSaved"), { variant: "success" });
        router.refresh();
      }}
      onError={(error) => toast(errorMessage(error), { variant: "destructive" })}
      onRemove={() => {
        setBusy(true);
        void clearTaskAttachment(taskId)
          .then(() => {
            toast(t("attachmentRemoved"), { variant: "success" });
            router.refresh();
          })
          .catch((error: unknown) => {
            const like =
              error && typeof error === "object" && "code" in error
                ? (error as { code?: string; status?: number })
                : null;
            toast(errorMessage(like), { variant: "destructive" });
          })
          .finally(() => setBusy(false));
      }}
    />
  );
}
