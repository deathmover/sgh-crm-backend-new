-- Per-controller pricing (each café sets its own table)
ALTER TABLE "machines" ADD COLUMN "controllerRates" JSONB;
