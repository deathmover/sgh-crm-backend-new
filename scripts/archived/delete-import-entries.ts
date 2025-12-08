/**
 * Delete incorrectly created import entries
 *
 * Usage: npx ts-node scripts/delete-import-entries.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteImportEntries() {


  const result = await prisma.entry.deleteMany({
    where: {
      notes: 'Initial credit from master data import',
    },
  });



  await prisma.$disconnect();
}

deleteImportEntries()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  });
