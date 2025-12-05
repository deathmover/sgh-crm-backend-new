const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function checkStatus() {
  try {
    console.log('🔍 Checking Membership System Status on Production...\n');

    // Check system setting
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'membership_enabled' },
    });

    console.log('System Setting:');
    console.log(`  Key: ${setting?.key}`);
    console.log(`  Value: ${setting?.value}`);
    console.log(`  Status: ${setting?.value === 'true' ? '✅ ENABLED' : '❌ DISABLED'}`);

    // Check plans
    const plans = await prisma.membershipPlan.findMany({
      where: { isActive: true },
    });

    console.log(`\nMembership Plans: ${plans.length} active`);
    plans.forEach(plan => {
      console.log(`  - ${plan.name}: ₹${plan.price} (${plan.hours} hrs, ${plan.validityDays} days)`);
    });

    // Check memberships
    const [active, total] = await Promise.all([
      prisma.customerMembership.count({ where: { status: 'active' } }),
      prisma.customerMembership.count(),
    ]);

    console.log(`\nCustomer Memberships:`);
    console.log(`  Active: ${active}`);
    console.log(`  Total: ${total}`);

    // Final status
    console.log('\n' + '='.repeat(50));
    if (setting?.value === 'true') {
      console.log('✅ Membership System is ENABLED');
    } else {
      console.log('❌ Membership System is DISABLED');
    }
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
