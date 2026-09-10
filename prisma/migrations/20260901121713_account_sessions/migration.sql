-- CreateTable
CREATE TABLE "account_sessions" (
    "id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_sessions_expires_at_idx" ON "account_sessions"("expires_at");
