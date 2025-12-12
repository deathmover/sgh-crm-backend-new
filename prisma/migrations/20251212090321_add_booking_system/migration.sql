-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."bookings" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "pcNumber" TEXT,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "advancePayment" BOOLEAN NOT NULL DEFAULT false,
    "cashAmount" INTEGER NOT NULL DEFAULT 0,
    "onlineAmount" INTEGER NOT NULL DEFAULT 0,
    "creditAmount" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "entryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_entryId_key" ON "public"."bookings"("entryId");

-- CreateIndex
CREATE INDEX "bookings_customerId_idx" ON "public"."bookings"("customerId");

-- CreateIndex
CREATE INDEX "bookings_machineId_idx" ON "public"."bookings"("machineId");

-- CreateIndex
CREATE INDEX "bookings_bookingDate_idx" ON "public"."bookings"("bookingDate");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "public"."bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_startTime_idx" ON "public"."bookings"("startTime");

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "public"."machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
