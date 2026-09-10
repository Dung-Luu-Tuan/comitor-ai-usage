-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "project_id" TEXT NOT NULL,
    "assignee_user_id" TEXT,
    "requester_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "estimate_minutes" INTEGER NOT NULL,
    "request_type" TEXT NOT NULL,
    "needs_approval" BOOLEAN NOT NULL DEFAULT false,
    "approval_flow_id" TEXT,
    "notify_channels" TEXT[],
    "remind_before_due" BOOLEAN NOT NULL DEFAULT false,
    "sync_with_calendar" BOOLEAN NOT NULL DEFAULT false,
    "attachment_key" TEXT,
    "attachment_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_watchers" (
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "task_watchers_pkey" PRIMARY KEY ("task_id","user_id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "target_code" TEXT NOT NULL,
    "target_title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "task_code" TEXT,
    "task_title" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "workspace_id" TEXT NOT NULL,
    "default_priority" TEXT NOT NULL DEFAULT 'medium',
    "default_page_size" INTEGER NOT NULL DEFAULT 20,
    "week_start" TEXT NOT NULL DEFAULT 'mon',
    "auto_assign_to_me" BOOLEAN NOT NULL DEFAULT false,
    "notify_assigned" BOOLEAN NOT NULL DEFAULT true,
    "notify_mentioned" BOOLEAN NOT NULL DEFAULT true,
    "notify_due_soon" BOOLEAN NOT NULL DEFAULT true,
    "notify_project_update" BOOLEAN NOT NULL DEFAULT false,
    "notify_email_digest" BOOLEAN NOT NULL DEFAULT true,
    "digest_frequency" TEXT NOT NULL DEFAULT 'daily',
    "allow_public_link" BOOLEAN NOT NULL DEFAULT false,
    "keep_activity_log" BOOLEAN NOT NULL DEFAULT true,
    "allow_attachment_download" BOOLEAN NOT NULL DEFAULT true,
    "archive_after" TEXT NOT NULL DEFAULT '90d',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "workspace_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("workspace_id","role_id","permission_id")
);

-- CreateTable
CREATE TABLE "task_drafts" (
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_drafts_pkey" PRIMARY KEY ("workspace_id","user_id")
);

-- CreateIndex
CREATE INDEX "projects_workspace_id_idx" ON "projects"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_workspace_id_code_key" ON "projects"("workspace_id", "code");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_status_idx" ON "tasks"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_project_id_idx" ON "tasks"("workspace_id", "project_id");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_assignee_user_id_idx" ON "tasks"("workspace_id", "assignee_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_workspace_id_code_key" ON "tasks"("workspace_id", "code");

-- CreateIndex
CREATE INDEX "activities_workspace_id_created_at_idx" ON "activities"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_user_id_created_at_idx" ON "notifications"("workspace_id", "user_id", "created_at");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
