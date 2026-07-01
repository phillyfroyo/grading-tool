-- CreateTable
CREATE TABLE "public"."grading_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "classProfileId" TEXT,
    "studentNickname" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "latencyMs" INTEGER,

    CONSTRAINT "grading_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grading_events_createdAt_idx" ON "public"."grading_events"("createdAt");

-- CreateIndex
CREATE INDEX "grading_events_userId_idx" ON "public"."grading_events"("userId");

-- CreateIndex
CREATE INDEX "grading_events_status_idx" ON "public"."grading_events"("status");
