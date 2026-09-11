-- CreateTable
CREATE TABLE "ai_vendor_keys" (
    "workspace_id" TEXT NOT NULL,
    "claude" TEXT NOT NULL DEFAULT '',
    "grok" TEXT NOT NULL DEFAULT '',
    "gemini" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_vendor_keys_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateTable
CREATE TABLE "ai_team_users" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "max_budget_usd" DOUBLE PRECISION NOT NULL,
    "spend_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_team_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "usd" DOUBLE PRECISION NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_team_users_key_key" ON "ai_team_users"("key");

-- CreateIndex
CREATE INDEX "ai_team_users_workspace_id_idx" ON "ai_team_users"("workspace_id");

-- CreateIndex
CREATE INDEX "ai_usage_logs_workspace_id_at_idx" ON "ai_usage_logs"("workspace_id", "at");

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ai_team_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
