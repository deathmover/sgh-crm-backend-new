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

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });