const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function checkStatus() {
  try {


    // Check system setting
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'membership_enabled' },
    });



    // Check plans
    const plans = await prisma.membershipPlan.findMany({
      where: { isActive: true },
    });


    plans.forEach(plan => {

    });

    // Check memberships
    const [active, total] = await Promise.all([
      prisma.customerMembership.count({ where: { status: 'active' } }),
      prisma.customerMembership.count(),
    ]);



    // Final status

    if (setting?.value === 'true') {

    } else {

    }


  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
