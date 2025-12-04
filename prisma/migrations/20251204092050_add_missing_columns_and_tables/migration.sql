-- AlterTable
ALTER TABLE "public"."customers" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pendingCredit" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."entries" ADD COLUMN     "membershipHours" DOUBLE PRECISION,
ADD COLUMN     "membershipId" TEXT;

-- AlterTable
ALTER TABLE "public"."machines" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."expenses" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'cash',
    "receipt" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'online',
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bank_transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cash_drawers" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCashIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCashOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "drawerAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_drawers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."membership_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "validityDays" INTEGER NOT NULL,
    "pricePerHour" DOUBLE PRECISION NOT NULL,
    "machineType" TEXT NOT NULL DEFAULT 'mid_pro',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_memberships" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "hoursTotal" DOUBLE PRECISION NOT NULL,
    "hoursRemaining" DOUBLE PRECISION NOT NULL,
    "hoursUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "paymentAmount" DOUBLE PRECISION NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'cash',
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "public"."expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "public"."expenses"("date");

-- CreateIndex
CREATE INDEX "bank_transactions_accountId_idx" ON "public"."bank_transactions"("accountId");

-- CreateIndex
CREATE INDEX "bank_transactions_date_idx" ON "public"."bank_transactions"("date");

-- CreateIndex
CREATE INDEX "bank_transactions_category_idx" ON "public"."bank_transactions"("category");

-- CreateIndex
CREATE INDEX "cash_drawers_date_idx" ON "public"."cash_drawers"("date");

-- CreateIndex
CREATE INDEX "membership_plans_isActive_idx" ON "public"."membership_plans"("isActive");

-- CreateIndex
CREATE INDEX "membership_plans_machineType_idx" ON "public"."membership_plans"("machineType");

-- CreateIndex
CREATE INDEX "customer_memberships_customerId_idx" ON "public"."customer_memberships"("customerId");

-- CreateIndex
CREATE INDEX "customer_memberships_planId_idx" ON "public"."customer_memberships"("planId");

-- CreateIndex
CREATE INDEX "customer_memberships_status_idx" ON "public"."customer_memberships"("status");

-- CreateIndex
CREATE INDEX "customer_memberships_expiryDate_idx" ON "public"."customer_memberships"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "public"."system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "public"."system_settings"("category");

-- CreateIndex
CREATE INDEX "entries_membershipId_idx" ON "public"."entries"("membershipId");

-- AddForeignKey
ALTER TABLE "public"."entries" ADD CONSTRAINT "entries_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."customer_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bank_transactions" ADD CONSTRAINT "bank_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_memberships" ADD CONSTRAINT "customer_memberships_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_memberships" ADD CONSTRAINT "customer_memberships_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
