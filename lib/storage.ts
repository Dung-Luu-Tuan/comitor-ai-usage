import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, storageEnabled } from "@/lib/env";

/**
 * Kho đối tượng dùng chung của hệ Comitor. MinIO ở máy phát triển, S3 thật khi triển khai.
 *
 * ── BUCKET LÀ RIÊNG TƯ, VÀ DÙNG CHUNG CHO MỌI APP ──────────────────────────────────────────
 * Không object nào đọc được ẩn danh. Tệp người dùng đính kèm vào một công việc là dữ liệu nội bộ
 * của khách hàng: một URL đoán được hoặc rò ra ngoài là tệp đó xem được **mãi mãi**, bởi bất kỳ
 * ai, không cần đăng nhập — và URL thì rò qua referrer, log, lịch sử trình duyệt. Chỉ website tiếp
 * thị mới dùng một bucket CÔNG KHAI riêng.
 *
 * Hệ quả: giao diện KHÔNG bao giờ nhận một URL vĩnh viễn. Nó nhận **URL đã ký, có hạn** — xem
 * `toDisplayUrl` bên dưới, và `TaskView.attachmentUrl` trong `lib/contracts/task.ts`.
 *
 * ── TIỀN TỐ KHOÁ: `{app}/{tính-năng}/…` ────────────────────────────────────────────────────
 * Vì mọi app dùng chung một bucket, khoá phải mang tên app và tên tính năng —
 * `tasks/attachment/{taskId}/…`. Không có tiền tố thì hai app đặt trùng khoá là ghi đè dữ liệu của
 * nhau, và không ai gỡ được quyền theo từng app khi cần. Phép dựng khoá nằm ở
 * `lib/core/attachment.ts` (hàm thuần, có test).
 *
 * ── HAI KHÁC BIỆT DUY NHẤT GIỮA MINIO VÀ S3 ────────────────────────────────────────────────
 *   1. `endpoint` — MinIO cần trỏ tường minh; S3 để trống cho SDK tự dựng từ `region`.
 *   2. `forcePathStyle` — MinIO phục vụ theo `host/bucket/key`; S3 mặc định virtual-host. Bật
 *      path-style khi và chỉ khi có `endpoint`.
 *
 * Không có nhánh `if (isProduction)` nào ở đây, và đó là chủ ý: đường chạy ở máy phát triển giống
 * hệt đường chạy thật, thứ khác nhau chỉ là `.env`. Một nhánh theo môi trường là cách chắc chắn để
 * có một lỗi chỉ lộ ra sau khi deploy.
 *
 * ── KHOÁ TĨNH HAY VAI TRÒ CỦA MÁY ──────────────────────────────────────────────────────────
 * Khai `credentials` CHỈ khi có khoá tường minh. Bỏ trống thì AWS SDK đi theo chuỗi provider mặc
 * định và lấy được **IAM instance role** — tức không có khoá dài hạn nào tồn tại để mà rò.
 */
const client = storageEnabled
  ? new S3Client({
      region: env.storage.region,
      ...(env.storage.endpoint ? { endpoint: env.storage.endpoint, forcePathStyle: true } : {}),
      ...(env.storage.accessKeyId
        ? { credentials: { accessKeyId: env.storage.accessKeyId, secretAccessKey: env.storage.secretAccessKey } }
        : {})
    })
  : null;

export class StorageNotConfiguredError extends Error {}

function requireClient(): S3Client {
  if (!client) throw new StorageNotConfiguredError("Object storage is not configured.");
  return client;
}

/** URL đã ký sống bao lâu. Phải dài hơn hẳn thời gian một trang được mở và được đọc. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Cửa sổ làm tròn thời điểm ký.
 *
 * ── VÌ SAO PHẢI LÀM TRÒN, VÀ VÌ SAO ĐÂY KHÔNG PHẢI TỐI ƯU VẶT ──────────────────────────────
 * Chữ ký SigV4 phụ thuộc `X-Amz-Date`. Ký bằng `new Date()` thì MỖI LẦN render ra một URL KHÁC
 * NHAU cho cùng một tấm ảnh — mà trình duyệt và CDN đều cache theo URL. Kết quả: mọi ảnh được tải
 * lại từ đầu ở mọi lần chuyển trang, cho mọi người dùng, mãi mãi.
 *
 * Ghim `signingDate` vào đầu cửa sổ 15 phút thì mọi request trong cùng cửa sổ nhận ĐÚNG một URL,
 * nên nó cache được. Cái giá: URL sống ít nhất `TTL − WINDOW` = 45 phút, thay vì đủ 60.
 */
const SIGNING_WINDOW_MS = 15 * 60 * 1000;

function signingWindowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / SIGNING_WINDOW_MS) * SIGNING_WINDOW_MS);
}

/**
 * Đổi KHOÁ đang lưu trong database thành URL hiển thị được.
 *
 * Cột `tasks.attachment_key` giữ **khoá object**, không giữ URL: URL đã ký có hạn, nên lưu nó là
 * lưu một giá trị sẽ hết hạn ngay trong database. Khoá thì vĩnh viễn, và URL được ký lại ở mỗi
 * lần đọc.
 *
 * Kho ảnh chưa cấu hình → `null`, không ném lỗi: một trang danh sách không được vỡ chỉ vì phần
 * ảnh chưa nối. Giao diện hiện ô trống, và `/settings` nói rõ vì sao.
 */
export async function toDisplayUrl(storedKey: string | null | undefined, now = new Date()): Promise<string | null> {
  if (!storedKey || !client) return null;

  /*
   * ── ⚠ URL ĐÃ KÝ CHẾT THEO CREDENTIAL, KHÔNG CHỈ THEO `expiresIn` ───────────────────────
   * AWS ghi thành văn: một presigned URL hết hạn *"at either its configured expiration time or
   * when its associated credentials expire, whichever occurs first"*.
   *
   * Với khoá TĨNH thì vế sau không bao giờ tới — và đó là lý do đoạn này chạy đúng suốt thời gian
   * dùng MinIO ở local. Với **IAM instance role** thì credential là TẠM THỜI và tự xoay, nên một
   * URL ký TTL 1 tiếng sẽ 403 GIỮA CHỪNG khi credential hết hạn trước. Hỏng ÂM THẦM: ảnh đơn giản
   * là không hiện, và không có lỗi nào ở phía máy chủ.
   *
   * Vì vậy kẹp `expiresIn` theo hạn THẬT của credential, trừ 60 giây phòng lệch đồng hồ. Nếu ngân
   * sách còn lại không đủ thì bỏ luôn phép làm tròn cửa sổ và ký theo thời điểm hiện tại — thà mất
   * khả năng cache còn hơn trả về một URL chết.
   */
  const credentials = await client.config.credentials();
  const windowStart = signingWindowStart(now);
  const budgetSeconds = credentials.expiration
    ? Math.floor((credentials.expiration.getTime() - windowStart.getTime()) / 1000) - 60
    : SIGNED_URL_TTL_SECONDS;

  const useWindow = budgetSeconds > 0;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: env.storage.bucket, Key: storedKey }), {
    expiresIn: useWindow ? Math.min(SIGNED_URL_TTL_SECONDS, budgetSeconds) : SIGNED_URL_TTL_SECONDS,
    ...(useWindow ? { signingDate: windowStart } : {})
  });
}

/**
 * Ký nhiều khoá cùng lúc — dùng ở danh sách (bảng công việc).
 *
 * ⚠ `Promise.all` chứ không phải một vòng `for await`: 25 dòng bảng mà ký tuần tự là 25 lần chờ
 * nối tiếp nhau. Việc ký là phép tính cục bộ (không gọi mạng), nhưng `client.config.credentials()`
 * thì có thể gọi metadata của máy ở chế độ instance-role — và ở đó khác biệt là thật.
 */
export async function toDisplayUrls(
  storedKeys: readonly (string | null | undefined)[],
  now = new Date()
): Promise<(string | null)[]> {
  return Promise.all(storedKeys.map((value) => toDisplayUrl(value, now)));
}

/**
 * Ghi một object riêng tư và trả về KHOÁ của nó (không phải URL — xem `toDisplayUrl`).
 *
 * KHÔNG đặt `CacheControl: immutable`: URL đã ký mang tham số truy vấn và có hạn, nên tầng cache
 * trung gian không nên giữ nó lâu hơn chính chữ ký.
 */
export async function putPrivateObject(key: string, body: Uint8Array, contentType: string): Promise<string> {
  await requireClient().send(
    new PutObjectCommand({ Bucket: env.storage.bucket, Key: key, Body: body, ContentType: contentType })
  );
  return key;
}

/**
 * Xoá một object theo KHOÁ đã lưu.
 *
 * NUỐT LỖI, có chủ đích: đây luôn là dọn dẹp đi kèm một thao tác khác, và cột trong database mới
 * là nguồn sự thật. Một object mồ côi tốn vài KB; một luồng đổi tệp hỏng vì không xoá được tệp CŨ
 * thì người dùng nhìn thấy.
 */
export async function deleteObject(key: string | null | undefined): Promise<void> {
  if (!key || !client) return;
  try {
    await client.send(new DeleteObjectCommand({ Bucket: env.storage.bucket, Key: key }));
  } catch (error) {
    console.warn("[storage] không xoá được object cũ:", key, error);
  }
}

export { storageEnabled };
