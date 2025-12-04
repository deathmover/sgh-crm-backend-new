/**
 * Delete incorrectly created import entries
 *
 * Usage: npx ts-node scripts/delete-import-entries.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteImportEntries() {
  console.log('🗑️  Deleting import entries...');

  const result = await prisma.entry.deleteMany({
    where: {
      notes: 'Initial credit from master data import',
    },
  });

  console.log(`✅ Deleted ${result.count} import entries`);

  await prisma.$disconnect();
}

deleteImportEntries()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  });
