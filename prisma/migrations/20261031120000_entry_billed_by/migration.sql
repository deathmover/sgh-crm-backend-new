-- Login that last set the bill (used for discount tracking)
ALTER TABLE "entries" ADD COLUMN "billedBy" TEXT;
