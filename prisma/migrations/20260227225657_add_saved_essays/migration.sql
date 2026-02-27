-- CreateTable
CREATE TABLE "public"."saved_essays" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classProfileId" TEXT,
    "studentName" TEXT NOT NULL,
    "renderedHTML" TEXT NOT NULL,
    "essayData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_essays_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."saved_essays" ADD CONSTRAINT "saved_essays_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
