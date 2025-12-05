const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function enableMembership() {
  try {
    console.log('🔧 Enabling membership system on production...\n');

    // First, seed membership plans if they don't exist
    console.log('1️⃣ Checking membership plans...');
    const plansCount = await prisma.membershipPlan.count();

    if (plansCount === 0) {
      console.log('   📦 Seeding membership plans...');

      await prisma.membershipPlan.createMany({
        data: [
          {
            id: 'monthly-22hrs',
            name: 'Monthly 22 Hours',
            description: '22 Hours validity for 30 days on Mid Pro PCs',
            price: 999,
            hours: 22,
            validityDays: 30,
            pricePerHour: 45.41,
            machineType: 'mid_pro',
            isActive: true,
            displayOrder: 1,
          },
          {
            id: 'monthly-50hrs',
            name: 'Monthly 50 Hours',
            description: '50 Hours validity for 30 days on Mid Pro PCs',
            price: 1999,
            hours: 50,
            validityDays: 30,
            pricePerHour: 39.98,
            machineType: 'mid_pro',
            isActive: true,
            displayOrder: 2,
          },
          {
            id: 'quarterly-100hrs',
            name: 'Quarterly 100 Hours',
            description: '100 Hours validity for 90 days on Mid Pro PCs',
            price: 3499,
            hours: 100,
            validityDays: 90,
            pricePerHour: 34.99,
            machineType: 'mid_pro',
            isActive: true,
            displayOrder: 3,
          },
        ],
        skipDuplicates: true,
      });

      console.log('   ✅ Created 3 membership plans');
    } else {
      console.log(`   ✅ Found ${plansCount} existing plans`);
    }

    // Create system settings if they don't exist
    console.log('\n2️⃣ Setting up system settings...');

    await prisma.systemSetting.upsert({
      where: { key: 'membership_enabled' },
      update: { value: 'true' },
      create: {
        key: 'membership_enabled',
        value: 'true',
        category: 'membership',
      },
    });

    await prisma.systemSetting.upsert({
      where: { key: 'membership_auto_deduct' },
      update: {},
      create: {
        key: 'membership_auto_deduct',
        value: 'true',
        category: 'membership',
      },
    });

    await prisma.systemSetting.upsert({
      where: { key: 'membership_warn_hours_threshold' },
      update: {},
      create: {
        key: 'membership_warn_hours_threshold',
        value: '2',
        category: 'membership',
      },
    });

    await prisma.systemSetting.upsert({
      where: { key: 'membership_warn_days_threshold' },
      update: {},
      create: {
        key: 'membership_warn_days_threshold',
        value: '7',
        category: 'membership',
      },
    });

    console.log('   ✅ System settings configured');

    // Verify status
    console.log('\n3️⃣ Verifying status...');
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'membership_enabled' },
    });

    const [activeMemberships, totalPlans] = await Promise.all([
      prisma.customerMembership.count({ where: { status: 'active' } }),
      prisma.membershipPlan.count({ where: { isActive: true } }),
    ]);

    console.log('\n✅ MEMBERSHIP SYSTEM ENABLED!');
    console.log(`   Status: ${setting?.value === 'true' ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log(`   Active Plans: ${totalPlans}`);
    console.log(`   Active Memberships: ${activeMemberships}`);
    console.log('\n📝 The frontend will now show membership options!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

enableMembership();
