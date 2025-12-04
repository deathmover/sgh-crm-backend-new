-- AlterTable
ALTER TABLE "entries" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'not_paid';
ALTER TABLE "entries" ADD COLUMN "cashAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "entries" ADD COLUMN "onlineAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "entries" ADD COLUMN "creditAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "entries" ADD COLUMN "autoEnded" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "entries_paymentStatus_idx" ON "entries"("paymentStatus");

-- Migrate existing data: calculate split amounts based on paymentType and finalAmount
UPDATE "entries"
SET
  "cashAmount" = CASE WHEN "paymentType" = 'cash' THEN "finalAmount" ELSE 0 END,
  "onlineAmount" = CASE WHEN "paymentType" = 'online' THEN "finalAmount" ELSE 0 END,
  "creditAmount" = CASE WHEN "paymentType" = 'credit' THEN "finalAmount" ELSE 0 END,
  "paymentStatus" = CASE
    WHEN "endTime" IS NULL THEN 'not_paid'
    WHEN "paymentType" = 'credit' THEN 'not_paid'
    ELSE 'paid'
  END
WHERE "endTime" IS NOT NULL;
