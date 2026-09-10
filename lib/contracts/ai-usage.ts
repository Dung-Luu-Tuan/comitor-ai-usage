/**
 * Hợp đồng của trang quản lý AI nội bộ — TẦNG 0: chỉ KIỂU.
 *
 * Dữ liệu nằm ở file JSON của cổng `ai-gateway`, không phải Prisma: đây không phải dữ liệu khách
 * hàng theo không gian làm việc, mà là key hãng + mã nội bộ của đội dùng chung một máy.
 */

export type AiVendorName = "claude" | "grok" | "gemini";

export interface AiUsageVendorStatus {
  claude: boolean;
  grok: boolean;
  gemini: boolean;
}

export interface AiUsageVendorPreview {
  claude: string;
  grok: string;
  gemini: string;
}

export interface AiUsageUserView {
  id: string;
  name: string;
  keyPreview: string;
  maxBudgetUsd: number;
  spendUsd: number;
  blocked: boolean;
  createdAt: string;
}

export interface AiUsageLogView {
  at: string;
  name: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  usd: number;
  ok: boolean;
  error: string | null;
}

export interface AiUsageSnapshot {
  gatewayOrigin: string;
  vendorKeys: AiUsageVendorStatus;
  vendorPreview: AiUsageVendorPreview;
  users: AiUsageUserView[];
  logs: AiUsageLogView[];
}

export interface CreatedAiUsageUser {
  user: AiUsageUserView;
  key: string;
}
