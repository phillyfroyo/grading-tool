-- CreateTable
CREATE TABLE "public"."saved_grading_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeTab" TEXT NOT NULL,
    "sessionData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_grading_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_grading_sessions_userId_key" ON "public"."saved_grading_sessions"("userId");

-- AddForeignKey
ALTER TABLE "public"."saved_grading_sessions" ADD CONSTRAINT "saved_grading_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
