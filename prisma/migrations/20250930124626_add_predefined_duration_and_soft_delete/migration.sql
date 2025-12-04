-- AlterTable - Add columns if they don't exist
ALTER TABLE "public"."entries"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "predefinedDuration" INTEGER;

-- CreateIndex - Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS "entries_isDeleted_idx" ON "public"."entries"("isDeleted");
