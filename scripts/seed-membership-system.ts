import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMembershipSystem() {


  // 1. Create system settings for feature flags


  await prisma.systemSetting.upsert({
    where: { key: 'membership_enabled' },
    update: { value: 'false' }, // DISABLED by default
    create: {
      key: 'membership_enabled',
      value: 'false', // DISABLED by default - you can enable it later
      category: 'membership',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'membership_auto_deduct' },
    update: { value: 'true' },
    create: {
      key: 'membership_auto_deduct',
      value: 'true', // Auto-deduct hours when creating entries
      category: 'membership',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'membership_warn_hours_threshold' },
    update: { value: '2' },
    create: {
      key: 'membership_warn_hours_threshold',
      value: '2', // Warn when less than 2 hours remaining
      category: 'membership',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'membership_warn_days_threshold' },
    update: { value: '7' },
    create: {
      key: 'membership_warn_days_threshold',
      value: '7', // Warn when less than 7 days until expiry
      category: 'membership',
    },
  });



  // 2. Create membership plans for Mid Pro PCs


  const plan1 = await prisma.membershipPlan.upsert({
    where: { id: 'monthly-22hrs' },
    update: {
      name: 'Monthly 22 Hours',
      description: '22 Hours validity for 30 days on Mid Pro PCs',
      price: 999,
      hours: 22,
      validityDays: 30,
      pricePerHour: 45.41, // 999/22
      machineType: 'mid_pro',
      isActive: true,
      displayOrder: 1,
    },
    create: {
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
  });

  const plan2 = await prisma.membershipPlan.upsert({
    where: { id: 'monthly-50hrs' },
    update: {
      name: 'Monthly 50 Hours',
      description: '50 Hours validity for 30 days on Mid Pro PCs',
      price: 1999,
      hours: 50,
      validityDays: 30,
      pricePerHour: 39.98, // 1999/50
      machineType: 'mid_pro',
      isActive: true,
      displayOrder: 2,
    },
    create: {
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
  });

  const plan3 = await prisma.membershipPlan.upsert({
    where: { id: 'quarterly-100hrs' },
    update: {
      name: 'Quarterly 100 Hours',
      description: '100 Hours validity for 90 days on Mid Pro PCs',
      price: 3499,
      hours: 100,
      validityDays: 90,
      pricePerHour: 34.99, // 3499/100
      machineType: 'mid_pro',
      isActive: true,
      displayOrder: 3,
    },
    create: {
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
  });





  await prisma.$disconnect();
}

seedMembershipSystem()
  .catch((e) => {
    console.error('❌ Error seeding membership system:', e);
    prisma.$disconnect();
    process.exit(1);
  });
