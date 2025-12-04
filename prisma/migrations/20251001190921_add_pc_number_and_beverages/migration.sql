-- Add paymentStatus if it doesn't exist (in case previous migration failed)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'entries'
                   AND column_name = 'paymentStatus') THEN
        ALTER TABLE "public"."entries" ADD COLUMN "paymentStatus" TEXT DEFAULT 'not_paid';
    END IF;
END $$;

-- AlterTable
ALTER TABLE "public"."entries"
ADD COLUMN IF NOT EXISTS "beverages" JSONB,
ADD COLUMN IF NOT EXISTS "beveragesAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "pcNumber" TEXT;

-- Modify paymentStatus to be nullable
ALTER TABLE "public"."entries"
ALTER COLUMN "paymentStatus" DROP NOT NULL,
ALTER COLUMN "paymentStatus" DROP DEFAULT;