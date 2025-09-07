-- CreateTable
CREATE TABLE "public"."class_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cefrLevel" TEXT NOT NULL,
    "vocabulary" TEXT[],
    "grammar" TEXT[],
    "prompt" TEXT,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModified" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_profiles_pkey" PRIMARY KEY ("id")
);
