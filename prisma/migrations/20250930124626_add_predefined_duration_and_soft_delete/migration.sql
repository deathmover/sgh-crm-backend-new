-- AlterTable
ALTER TABLE "public"."entries" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "predefinedDuration" INTEGER;

-- CreateIndex
CREATE INDEX "entries_isDeleted_idx" ON "public"."entries"("isDeleted");
