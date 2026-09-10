-- AlterTable
ALTER TABLE "account_sessions" ADD COLUMN     "sid" TEXT;

-- CreateIndex
CREATE INDEX "account_sessions_sid_idx" ON "account_sessions"("sid");
