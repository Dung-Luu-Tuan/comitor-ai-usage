/**
 * Hằng giao diện của trang quản lý AI nội bộ — không nhãn.
 *
 * URL cổng LLM là hợp đồng máy (Claude Code / Cline khai đúng chuỗi này). Đổi cổng Express thì đổi
 * đúng một chỗ này; nhãn trên màn hình nằm ở `messages/`.
 */

export const AI_GATEWAY_ORIGIN = "http://localhost:3100";

export const AI_VENDOR_NAMES = ["claude", "grok", "gemini"] as const;

export const AI_MODEL_HINTS = [
  { task: "daily", modelId: "claude-sonnet-4-6" },
  { task: "quick", modelId: "gemini-2.5-flash" },
  { task: "grok", modelId: "grok-3" }
] as const;
