import { z } from "zod";

export const createAiUsageUserSchema = z.object({
  name: z.string().trim().min(1).max(80),
  maxBudget: z.number().finite().min(0)
});

export const setAiUsageBudgetSchema = z.object({
  maxBudget: z.number().finite().min(0)
});

export const setAiUsageVendorsSchema = z.object({
  claude: z.string().optional(),
  grok: z.string().optional(),
  gemini: z.string().optional()
});

export const setAiUsageBlockedSchema = z.object({
  blocked: z.boolean()
});

export type CreateAiUsageUserInput = z.infer<typeof createAiUsageUserSchema>;
export type SetAiUsageBudgetInput = z.infer<typeof setAiUsageBudgetSchema>;
export type SetAiUsageVendorsInput = z.infer<typeof setAiUsageVendorsSchema>;
export type SetAiUsageBlockedInput = z.infer<typeof setAiUsageBlockedSchema>;
