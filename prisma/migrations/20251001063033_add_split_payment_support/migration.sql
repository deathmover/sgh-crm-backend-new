-- AlterTable
ALTER TABLE "public"."entries" ADD COLUMN     "autoEnded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cashAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creditAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onlineAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentStatus" TEXT DEFAULT 'not_paid',
ALTER COLUMN "paymentType" SET DEFAULT 'cash';

-- CreateIndex
CREATE INDEX "entries_paymentStatus_idx" ON "public"."entries"("paymentStatus");