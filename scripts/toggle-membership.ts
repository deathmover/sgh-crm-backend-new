import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function toggleMembership() {
  const args = process.argv.slice(2);
  const action = args[0]; // 'enable' or 'disable' or 'status'

  if (!['enable', 'disable', 'status'].includes(action)) {
    console.log('❌ Invalid action. Use: enable, disable, or status');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/toggle-membership.ts enable   # Enable membership system');
    console.log('  npx ts-node scripts/toggle-membership.ts disable  # Disable membership system');
    console.log('  npx ts-node scripts/toggle-membership.ts status   # Check current status');
    process.exit(1);
  }

  // Get current status
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'membership_enabled' },
  });

  const currentStatus = setting?.value === 'true';

  if (action === 'status') {
    console.log('\n🔍 Membership System Status:');
    console.log(`   Current Status: ${currentStatus ? '✅ ENABLED' : '❌ DISABLED'}`);

    if (currentStatus) {
      // Show stats
      const [activeMemberships, totalPlans] = await Promise.all([
        prisma.customerMembership.count({ where: { status: 'active' } }),
        prisma.membershipPlan.count({ where: { isActive: true } }),
      ]);
      console.log(`   Active Memberships: ${activeMemberships}`);
      console.log(`   Available Plans: ${totalPlans}`);
    }

    await prisma.$disconnect();
    return;
  }

  if (action === 'enable') {
    if (currentStatus) {
      console.log('ℹ️  Membership system is already ENABLED');
    } else {
      await prisma.systemSetting.update({
        where: { key: 'membership_enabled' },
        data: { value: 'true' },
      });
      console.log('✅ Membership system ENABLED successfully!');
      console.log('\n📝 Next steps:');
      console.log('   1. Frontend UI will now show membership options');
      console.log('   2. You can purchase memberships for customers');
      console.log('   3. Entry creation will check for active memberships');
    }
  }

  if (action === 'disable') {
    if (!currentStatus) {
      console.log('ℹ️  Membership system is already DISABLED');
    } else {
      await prisma.systemSetting.update({
        where: { key: 'membership_enabled' },
        data: { value: 'false' },
      });
      console.log('✅ Membership system DISABLED successfully!');
      console.log('\n📝 Note:');
      console.log('   - Existing memberships are NOT deleted');
      console.log('   - Membership features will be hidden in UI');
      console.log('   - You can re-enable anytime without data loss');
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
