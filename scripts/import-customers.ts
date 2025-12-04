/**
 * Customer Import Script
 *
 * Usage:
 * 1. Create a CSV file named 'customers.csv' in the same directory with columns:
 *    name,phone,email,creditAmount,notes
 *
 * 2. Run: npx ts-node scripts/import-customers.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CustomerImport {
  name: string;
  phone: string;
  email?: string;
  creditAmount?: number;
  notes?: string;
}

async function importCustomers() {
  const csvPath = path.join(__dirname, 'customers.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('❌ customers.csv not found!');
    console.log('📝 Create a CSV file with format:');
    console.log('   name,phone,email,creditAmount,notes');
    console.log('   John Doe,9876543210,john@example.com,500,VIP customer');
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());

  // Skip header
  const header = lines[0].split(',');
  const dataLines = lines.slice(1);

  console.log(`📊 Found ${dataLines.length} customers to import`);

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const line of dataLines) {
    const values = line.split(',').map(v => v.trim());

    if (values.length < 2) {
      errors.push(`Invalid line: ${line}`);
      failed++;
      continue;
    }

    const customerData: CustomerImport = {
      name: values[0],
      phone: values[1],
      email: values[2] || undefined,
      creditAmount: values[3] ? parseFloat(values[3]) : undefined,
      notes: values[4] || undefined,
    };

    try {
      // Check if exists
      const existing = await prisma.customer.findFirst({
        where: { phone: customerData.phone },
      });

      if (existing) {
        errors.push(`Customer ${customerData.name} (${customerData.phone}) already exists`);
        failed++;
        continue;
      }

      // Create customer
      const customer = await prisma.customer.create({
        data: {
          name: customerData.name,
          phone: customerData.phone,
          email: customerData.email,
          notes: customerData.notes,
        },
      });

      console.log(`✅ Created: ${customer.name} (${customer.phone})`);

      // Create credit entry if needed
      if (customerData.creditAmount && customerData.creditAmount > 0) {
        const machine = await prisma.machine.findFirst({
          where: { isActive: true },
        });

        if (machine) {
          await prisma.entry.create({
            data: {
              customerId: customer.id,
              machineId: machine.id,
              startTime: new Date(),
              endTime: new Date(),
              predefinedDuration: 0,
              duration: 0,
              cost: customerData.creditAmount,
              finalAmount: customerData.creditAmount,
              paymentType: 'credit',
              creditAmount: customerData.creditAmount,
              cashAmount: 0,
              onlineAmount: 0,
              paymentStatus: 'unpaid',
              notes: 'Initial credit from import',
            },
          });
          console.log(`   💳 Added credit: ₹${customerData.creditAmount}`);
        }
      }

      success++;
    } catch (error: any) {
      errors.push(`Failed to import ${customerData.name}: ${error.message}`);
      failed++;
    }
  }

  console.log('\n📈 Import Summary:');
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(err => console.log(`   - ${err}`));
  }

  await prisma.$disconnect();
}

importCustomers()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  });
