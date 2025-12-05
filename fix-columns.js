const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function fixColumns() {
  try {
    console.log('🔧 Adding missing columns to entries table...\n');
    
    // Add cashAmount
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "public"."entries"
      ADD COLUMN IF NOT EXISTS "cashAmount" INTEGER NOT NULL DEFAULT 0
    `);
    console.log('✅ Added cashAmount column');
    
    // Add onlineAmount
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "public"."entries"
      ADD COLUMN IF NOT EXISTS "onlineAmount" INTEGER NOT NULL DEFAULT 0
    `);
    console.log('✅ Added onlineAmount column');
    
    // Add creditAmount
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "public"."entries"
      ADD COLUMN IF NOT EXISTS "creditAmount" INTEGER NOT NULL DEFAULT 0
    `);
    console.log('✅ Added creditAmount column');
    
    // Add autoEnded
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "public"."entries"
      ADD COLUMN IF NOT EXISTS "autoEnded" BOOLEAN NOT NULL DEFAULT false
    `);
    console.log('✅ Added autoEnded column');
    
    // Create index on paymentStatus
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "entries_paymentStatus_idx" ON "public"."entries"("paymentStatus")
    `);
    console.log('✅ Created index on paymentStatus');
    
    console.log('\n🎉 All missing columns added successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixColumns();
