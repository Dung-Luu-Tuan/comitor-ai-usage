/**
 * Hợp đồng của trang quản lý AI nội bộ — TẦNG 0: chỉ KIỂU.
 *
 * Dữ liệu nằm ở PostgreSQL (`ai_vendor_secrets` / `ai_team_users` / `ai_usage_logs`).
 * Id hãng hợp lệ do catalog giữ; tầng này chỉ mô tả hình dạng snapshot.
 */

export type AiVendorSection = "chat" | "image" | "video";

export interface AiUsageVendorView {
  id: string;
  section: AiVendorSection;
  ready: boolean;
  preview: string;
  modalities: readonly string[];
}

export interface AiUsageUserView {
  id: string;
  name: string;
  key: string;
  keyPreview: string;
  maxBudgetUsd: number;
  spendUsd: number;
  blocked: boolean;
  createdAt: string;
}

export interface AiUsageLogView {
  id: string;
  at: string;
  userId: string;
  name: string;
  keyPreview: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  usd: number | null;
  ok: boolean;
  error: string | null;
}

/** Một hàng bảng tổng: một người ↔ một mã nội bộ. */
export interface AiUsagePersonSummary {
  userId: string;
  name: string;
  keyPreview: string;
  blocked: boolean;
  maxBudgetUsd: number;
  spendUsd: number;
  callCount: number;
  okCount: number;
  errorCount: number;
  inputTokens: number;
  outputTokens: number;
  logUsd: number;
}

export interface AiUsageSnapshot {
  gatewayOrigin: string;
  vendors: AiUsageVendorView[];
  users: AiUsageUserView[];
  logs: AiUsageLogView[];
}

export interface CreatedAiUsageUser {
  user: AiUsageUserView;
  key: string;
}
