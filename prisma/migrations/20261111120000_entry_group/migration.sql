-- Entries started together for a group of players (one customer, several PCs)
ALTER TABLE "entries" ADD COLUMN "groupId" TEXT;
CREATE INDEX "entries_groupId_idx" ON "entries"("groupId");
