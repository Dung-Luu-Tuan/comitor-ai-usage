-- CreateTable
CREATE TABLE "ai_vendor_secrets" (
    "workspace_id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "secret" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_vendor_secrets_pkey" PRIMARY KEY ("workspace_id","vendor")
);

-- CreateIndex
CREATE INDEX "ai_vendor_secrets_workspace_id_idx" ON "ai_vendor_secrets"("workspace_id");

-- Backfill from wide table if it exists
INSERT INTO "ai_vendor_secrets" ("workspace_id", "vendor", "secret", "updated_at")
SELECT "workspace_id", 'claude', "claude", "updated_at" FROM "ai_vendor_keys"
ON CONFLICT ("workspace_id", "vendor") DO NOTHING;

INSERT INTO "ai_vendor_secrets" ("workspace_id", "vendor", "secret", "updated_at")
SELECT "workspace_id", 'grok', "grok", "updated_at" FROM "ai_vendor_keys"
ON CONFLICT ("workspace_id", "vendor") DO NOTHING;

INSERT INTO "ai_vendor_secrets" ("workspace_id", "vendor", "secret", "updated_at")
SELECT "workspace_id", 'gemini', "gemini", "updated_at" FROM "ai_vendor_keys"
ON CONFLICT ("workspace_id", "vendor") DO NOTHING;

-- DropTable
DROP TABLE "ai_vendor_keys";
