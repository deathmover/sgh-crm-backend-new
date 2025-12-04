-- AlterTable - Add columns if they don't exist
ALTER TABLE "public"."entries"
ADD COLUMN IF NOT EXISTS "autoEnded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "cashAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "creditAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "onlineAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'not_paid';

-- Alter paymentType default
DO $$
BEGIN
    ALTER TABLE "public"."entries" ALTER COLUMN "paymentType" SET DEFAULT 'cash';
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- CreateIndex - Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS "entries_paymentStatus_idx" ON "public"."entries"("paymentStatus");