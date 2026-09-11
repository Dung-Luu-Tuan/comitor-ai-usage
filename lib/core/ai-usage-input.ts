import { z } from "zod";

export const createAiUsageUserSchema = z.object({
  name: z.string().trim().min(1).max(80),
  maxBudget: z.number().finite().min(0)
});

export const setAiUsageBudgetSchema = z.object({
  maxBudget: z.number().finite().min(0)
});

/** Id hãng hợp lệ nằm ở catalog; tầng này chỉ nhận object chuỗi → chuỗi. */
export const setAiUsageVendorsSchema = z.record(z.string(), z.string().optional());

export const setAiUsageBlockedSchema = z.object({
  blocked: z.boolean()
});

export type CreateAiUsageUserInput = z.infer<typeof createAiUsageUserSchema>;
export type SetAiUsageBudgetInput = z.infer<typeof setAiUsageBudgetSchema>;
export type SetAiUsageVendorsInput = z.infer<typeof setAiUsageVendorsSchema>;
export type SetAiUsageBlockedInput = z.infer<typeof setAiUsageBlockedSchema>;
