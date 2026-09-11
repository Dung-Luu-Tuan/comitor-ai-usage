-- Allow usage rows with no USD when LiteLLM has no rate for that model id.
ALTER TABLE "ai_usage_logs" ALTER COLUMN "usd" DROP NOT NULL;
