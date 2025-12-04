-- AlterTable
ALTER TABLE "public"."entries" ADD COLUMN     "beverages" JSONB,
ADD COLUMN     "beveragesAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pcNumber" TEXT,
ALTER COLUMN "paymentStatus" DROP NOT NULL,
ALTER COLUMN "paymentStatus" DROP DEFAULT;
