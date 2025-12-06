import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Super Admin
  const hashedPassword = await bcrypt.hash(
    process.env.SUPER_ADMIN_PASSWORD || 'Admin@123',
    10,
  );

  const admin = await prisma.user.upsert({
    where: { username: process.env.SUPER_ADMIN_USERNAME || 'admin' },
    update: {},
    create: {
      username: process.env.SUPER_ADMIN_USERNAME || 'admin',
      password: hashedPassword,
      role: 'super_admin',
    },
  });

  console.log('✅ Super Admin created:', admin.username);

  // Seed Machines
  const machines = [
    {
      name: 'Mid Pro PC',
      type: 'mid_pro',
      units: 11,
      hourlyRate: 50,
      halfHourlyRate: 30,
      packageRates: {
        '3': 130,
        '5': 200,
        '12': 500,
      },
    },
    {
      name: 'High End PC',
      type: 'high_end',
      units: 2,
      hourlyRate: 60,
      halfHourlyRate: 35,
      packageRates: {
        '3': 150,
        '5': 240,
        '12': 600,
      },
    },
    {
      name: 'Ultra PC',
      type: 'ultra',
      units: 1,
      hourlyRate: 70,
      halfHourlyRate: null,
      packageRates: {
        '3': 180,
        '4': 280,
        '12': 700,
      },
    },
    {
      name: 'PS5 (4 controllers)',
      type: 'ps5',
      units: 4,
      hourlyRate: 70, // per controller
      halfHourlyRate: null,
      packageRates: null,
    },
    {
      name: 'Racing Simulator',
      type: 'simulator',
      units: 1,
      hourlyRate: 150,
      halfHourlyRate: 100,
      packageRates: null,
    },
  ];

  for (const machine of machines) {
    const existing = await prisma.machine.findFirst({
      where: { name: machine.name },
    });

    if (!existing) {
      const created = await prisma.machine.create({
        data: machine as any,
      });
      console.log('✅ Machine created:', created.name);
    } else {
      console.log('⏭️  Machine already exists:', machine.name);
    }
  }

  // Seed Membership System
  console.log('🎟️  Seeding Membership System...');

  // 1. Create system settings for feature flags
  await prisma.systemSetting.upsert({
    where: { key: 'membership_enabled' },
    update: { value: 'true' }, // ENABLED for Railway deployment
    create: {
      key: 'membership_enabled',
      value: 'true', // ENABLED by default
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

  console.log('✅ Membership settings created');

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

  console.log('✅ Created 3 membership plans:');
  console.log(`  - ${plan1.name}: ₹${plan1.price} (${plan1.hours} hrs)`);
  console.log(`  - ${plan2.name}: ₹${plan2.price} (${plan2.hours} hrs)`);
  console.log(`  - ${plan3.name}: ₹${plan3.price} (${plan3.hours} hrs)`);

  console.log('🎉 Seeding completed!');
  console.log('✅ Membership system is ENABLED and ready to use!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });