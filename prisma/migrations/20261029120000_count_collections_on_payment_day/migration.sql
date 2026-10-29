-- Credit settled later is tracked per entry instead of being added to its cash/online
ALTER TABLE "entries" ADD COLUMN "creditPaid" INTEGER NOT NULL DEFAULT 0;

-- Existing credit payments were already folded into entry totals; new ones are written with false
ALTER TABLE "credit_payments" ADD COLUMN "addedToEntryTotals" BOOLEAN NOT NULL DEFAULT true;

-- Daily sheet and analytics now group sessions by start time
CREATE INDEX "entries_startTime_idx" ON "entries"("startTime");
