/**
 * Reset all customer pending credits to 0
 *
 * Usage: npx ts-node scripts/reset-credits.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetCredits() {


  const result = await prisma.customer.updateMany({
    data: {
      pendingCredit: 0,
    },
  });



  await prisma.$disconnect();
}

resetCredits()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  });
