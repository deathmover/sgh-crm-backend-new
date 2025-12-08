import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function parseCredit(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.replace(/[₹,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

async function main() {
  const csvPath = path.join(__dirname, '../../sgh-crm-frontend/expoert.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');

  // First, reset all credits to 0

  await prisma.customer.updateMany({
    data: { pendingCredit: 0 },
  });

  const updates: Array<{ csvName: string; dbName: string; phone: string; credit: number }> = [];
  const notFound: Array<{ csvName: string; phone: string; credit: number }> = [];

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(',');
    const csvName = columns[0]?.trim();
    const phone = columns[1]?.trim();

    if (!csvName) continue;

    // Check both column 4 and 5 for credits (index 3 and 4)
    const credit1 = parseCredit(columns[3]?.trim());
    const credit2 = parseCredit(columns[4]?.trim());
    const creditAmount = credit2 > 0 ? credit2 : credit1; // Prioritize column 5

    if (creditAmount <= 0) continue;

    // Try to find customer by phone first, then by name
    let customer: any = null;

    if (phone) {
      customer = await prisma.customer.findFirst({
        where: { phone },
      });
    }

    if (!customer && csvName) {
      customer = await prisma.customer.findFirst({
        where: { name: { equals: csvName, mode: 'insensitive' } },
      });
    }

    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { pendingCredit: creditAmount },
      });

      updates.push({
        csvName,
        dbName: customer.name,
        phone: phone || 'N/A',
        credit: creditAmount,
      });

      if (csvName.toLowerCase() !== customer.name.toLowerCase()) {

      } else {

      }
    } else {
      notFound.push({ csvName, phone: phone || 'N/A', credit: creditAmount });

    }
  }



  if (notFound.length > 0) {

    notFound.forEach(item => {

    });
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
