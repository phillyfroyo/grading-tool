/*
  Migration to add userId to class_profiles and assign existing profiles to philipwooleryprice@gmail.com
*/

-- Step 1: Add userId column as nullable first
ALTER TABLE "public"."class_profiles" ADD COLUMN "userId" TEXT;

-- Step 2: Update existing rows to use the user ID for philipwooleryprice@gmail.com
UPDATE "public"."class_profiles"
SET "userId" = (
  SELECT "id" FROM "public"."users"
  WHERE "email" = 'philipwooleryprice@gmail.com'
  LIMIT 1
);

-- Step 3: Make userId NOT NULL after setting values
ALTER TABLE "public"."class_profiles" ALTER COLUMN "userId" SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE "public"."class_profiles" ADD CONSTRAINT "class_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
