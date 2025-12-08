/**
 * Import customers from exported CSV
 *
 * Usage: npx ts-node scripts/import-from-csv.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CustomerRow {
  name: string;
  phone: string;
  whatsapp: string;
  creditAmount: number;
}

function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Remove spaces, dashes, and keep only digits
  const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  // Only return if it looks like a valid phone (10 digits)
  return cleaned.length === 10 ? cleaned : '';
}

function parseCredit(creditStr: string): number {
  if (!creditStr || creditStr.trim() === '') return 0;
  const parsed = parseFloat(creditStr.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

async function importCustomers() {
  // Path to the CSV file
  const csvPath = path.join(__dirname, '../../sgh-crm-frontend/expoert.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found at:', csvPath);
    process.exit(1);
  }


  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());



  // Skip header row and empty rows
  const dataLines = lines.slice(2); // Skip first 2 lines (header + empty)

  let success = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];



  for (const line of dataLines) {
    const columns = line.split(',');

    // Extract data
    const name = columns[0]?.trim();
    const phone = cleanPhoneNumber(columns[1]?.trim());
    const whatsapp = columns[2]?.trim();
    // Credit can be in either column 3 or 4 (index 3 or 4) - check both
    const credit1 = parseCredit(columns[3]?.trim());
    const credit2 = parseCredit(columns[4]?.trim());
    const creditAmount = credit1 > 0 ? credit1 : credit2;

    // Skip if no name or invalid data
    if (!name || name === '') {
      skipped++;
      continue;
    }

    // Skip if duplicate names that look like test data
    if (name.includes(',,,,') || name === 'Drinks Ashok') {
      skipped++;
      continue;
    }

    try {
      // Check if customer already exists by phone or name
      let customer;

      if (phone) {
        customer = await prisma.customer.findFirst({
          where: { phone: phone },
        });
      }

      if (!customer) {
        customer = await prisma.customer.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } },
        });
      }

      // If customer exists, update with credit if needed
      if (customer) {
        if (creditAmount > 0 && customer.pendingCredit === 0) {
          // Update customer with pending credit
          await prisma.customer.update({
            where: { id: customer.id },
            data: { pendingCredit: creditAmount },
          });

          success++;
        } else if (creditAmount > 0 && customer.pendingCredit > 0) {

          skipped++;
        } else {

          skipped++;
        }
        continue;
      }

      // Create new customer with credit
      customer = await prisma.customer.create({
        data: {
          name: name,
          phone: phone || undefined,
          email: undefined,
          pendingCredit: creditAmount,
        },
      });


      success++;
    } catch (error: any) {
      const errorMsg = `Failed to import ${name}: ${error.message}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
      failed++;
    }

    // Add small delay to avoid overwhelming database
    await new Promise(resolve => setTimeout(resolve, 10));
  }



  if (errors.length > 0) {

    if (errors.length > 10) {

    }
  }

  // Summary of credit imported
  const totalCredit = await prisma.customer.aggregate({
    _sum: {
      pendingCredit: true,
    },
  });



  await prisma.$disconnect();
}

importCustomers()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  });
