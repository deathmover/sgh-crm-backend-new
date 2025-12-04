-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'super_admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."machines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "hourlyRate" INTEGER NOT NULL,
    "halfHourlyRate" INTEGER,
    "packageRates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."entries" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "roundedDuration" INTEGER,
    "cost" INTEGER,
    "finalAmount" INTEGER NOT NULL,
    "paymentType" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "public"."customers"("phone");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "public"."customers"("phone");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "public"."customers"("name");

-- CreateIndex
CREATE INDEX "machines_type_idx" ON "public"."machines"("type");

-- CreateIndex
CREATE INDEX "entries_customerId_idx" ON "public"."entries"("customerId");

-- CreateIndex
CREATE INDEX "entries_machineId_idx" ON "public"."entries"("machineId");

-- CreateIndex
CREATE INDEX "entries_createdAt_idx" ON "public"."entries"("createdAt");

-- CreateIndex
CREATE INDEX "entries_paymentType_idx" ON "public"."entries"("paymentType");

-- AddForeignKey
ALTER TABLE "public"."entries" ADD CONSTRAINT "entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."entries" ADD CONSTRAINT "entries_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "public"."machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
