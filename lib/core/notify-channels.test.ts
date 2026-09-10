import { describe, expect, it } from "vitest";
import { DELIVERABLE_NOTIFY_CHANNELS, resolveNotifyDelivery } from "./notify-channels";
import { NOTIFY_CHANNELS } from "./task-input";

const ALLOW = { workspaceAllows: true };

describe("resolveNotifyDelivery", () => {
  it("chọn cả hai kênh thì gửi cả hai", () => {
    expect(resolveNotifyDelivery({ ...ALLOW, channels: ["in-app", "email"] })).toEqual({
      inApp: true,
      email: true
    });
  });

  /**
   * ⚠ Phép kiểm QUAN TRỌNG NHẤT của file — nó là chính cái lỗi đã đo được ngày 04/09/2026:
   * người dùng bỏ tích "Email", và thư vẫn tới hộp thư thật.
   */
  it("bỏ tích Email thì KHÔNG gửi thư, nhưng vẫn báo trong ứng dụng", () => {
    expect(resolveNotifyDelivery({ ...ALLOW, channels: ["in-app"] })).toEqual({
      inApp: true,
      email: false
    });
  });

  it("chỉ chọn Email thì gửi thư mà không ghi thông báo trong ứng dụng", () => {
    expect(resolveNotifyDelivery({ ...ALLOW, channels: ["email"] })).toEqual({
      inApp: false,
      email: true
    });
  });

  /**
   * Công tắc cấp không gian làm việc đứng TRƯỚC: tắt là tắt hết, bất kể từng việc chọn gì. Đây
   * chính là thứ mà lá thư trỏ người dùng tới khi họ muốn thôi nhận.
   */
  it("công tắc của không gian làm việc tắt thì không gì đi ra, dù việc chọn đủ kênh", () => {
    expect(resolveNotifyDelivery({ workspaceAllows: false, channels: ["in-app", "email"] })).toEqual({
      inApp: false,
      email: false
    });
  });

  /**
   * ⚠ Rỗng là IM LẶNG, không phải "coi như tất cả". Fail-open ở đây là làm lại đúng cái sai vừa
   * chữa — xem chú thích ở `notify-channels.ts`.
   */
  it("danh sách rỗng thì im lặng, không rơi về mặc định gửi hết", () => {
    expect(resolveNotifyDelivery({ ...ALLOW, channels: [] })).toEqual({ inApp: false, email: false });
  });

  /**
   * `chat` và `sms` là giá trị HỢP LỆ của biểu mẫu nhưng module chưa giao được. Chọn mỗi chúng
   * thì không có gì đi ra — và đó là lý do biểu mẫu phải nói ra điều này, chứ không phải lý do
   * để lặng lẽ gửi email thay thế.
   */
  it("chỉ chọn chat/sms thì không kênh nào chạy — chúng chưa giao được", () => {
    expect(resolveNotifyDelivery({ ...ALLOW, channels: ["chat", "sms"] })).toEqual({
      inApp: false,
      email: false
    });
  });

  it("giá trị lạ bị bỏ qua chứ không làm bật kênh nào", () => {
    expect(resolveNotifyDelivery({ ...ALLOW, channels: ["carrier-pigeon", "EMAIL", " email"] })).toEqual({
      inApp: false,
      email: false
    });
  });
});

describe("DELIVERABLE_NOTIFY_CHANNELS", () => {
  /**
   * Lưới chống TRÔI: biểu mẫu cho chọn `NOTIFY_CHANNELS`, còn `resolveNotifyDelivery` chỉ giao
   * được `DELIVERABLE_NOTIFY_CHANNELS`. Thêm một kênh vào danh sách giao được mà quên thêm nhánh
   * trong `resolveNotifyDelivery` là một kênh bật lên rồi không đi tới đâu — đúng hạng lỗi file
   * này sinh ra để chặn.
   */
  it("là tập con của NOTIFY_CHANNELS", () => {
    for (const channel of DELIVERABLE_NOTIFY_CHANNELS) {
      expect(NOTIFY_CHANNELS).toContain(channel);
    }
  });

  it("mỗi kênh giao được đều thật sự bật một đường trong resolveNotifyDelivery", () => {
    for (const channel of DELIVERABLE_NOTIFY_CHANNELS) {
      const delivery = resolveNotifyDelivery({ ...ALLOW, channels: [channel] });
      expect(delivery.inApp || delivery.email).toBe(true);
    }
  });
});
