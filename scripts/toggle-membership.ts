import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function toggleMembership() {
  const args = process.argv.slice(2);
  const action = args[0]; // 'enable' or 'disable' or 'status'

  if (!['enable', 'disable', 'status'].includes(action)) {

    process.exit(1);
  }

  // Get current status
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'membership_enabled' },
  });

  const currentStatus = setting?.value === 'true';

  if (action === 'status') {


    if (currentStatus) {
      // Show stats
      const [activeMemberships, totalPlans] = await Promise.all([
        prisma.customerMembership.count({ where: { status: 'active' } }),
        prisma.membershipPlan.count({ where: { isActive: true } }),
      ]);

    }

    await prisma.$disconnect();
    return;
  }

  if (action === 'enable') {
    if (currentStatus) {

    } else {
      await prisma.systemSetting.update({
        where: { key: 'membership_enabled' },
        data: { value: 'true' },
      });

    }
  }

  if (action === 'disable') {
    if (!currentStatus) {

    } else {
      await prisma.systemSetting.update({
        where: { key: 'membership_enabled' },
        data: { value: 'false' },
      });

    }
  }

  await prisma.$disconnect();
}

toggleMembership()
  .catch((e) => {
    console.error('❌ Error:', e);
    prisma.$disconnect();
    process.exit(1);
  });
