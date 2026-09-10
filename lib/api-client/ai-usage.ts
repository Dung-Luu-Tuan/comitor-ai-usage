import { callApi } from "@/lib/api-client/http";
import type { AiUsageSnapshot, AiUsageUserView, CreatedAiUsageUser } from "@/lib/contracts/ai-usage";
import type {
  CreateAiUsageUserInput,
  SetAiUsageBlockedInput,
  SetAiUsageBudgetInput,
  SetAiUsageVendorsInput
} from "@/lib/core/ai-usage-input";

export function saveAiUsageVendors(input: SetAiUsageVendorsInput): Promise<AiUsageSnapshot> {
  return callApi<AiUsageSnapshot>("/api/ai-usage/vendors", { method: "PUT", json: input });
}

export function createAiUsageUser(input: CreateAiUsageUserInput): Promise<CreatedAiUsageUser> {
  return callApi<CreatedAiUsageUser>("/api/ai-usage/users", { method: "POST", json: input });
}

export function setAiUsageUserBudget(id: string, input: SetAiUsageBudgetInput): Promise<AiUsageUserView> {
  return callApi<AiUsageUserView>(`/api/ai-usage/users/${id}`, { method: "PATCH", json: input });
}

export function setAiUsageUserBlocked(id: string, input: SetAiUsageBlockedInput): Promise<AiUsageUserView> {
  return callApi<AiUsageUserView>(`/api/ai-usage/users/${id}/block`, { method: "POST", json: input });
}
