const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function checkColumns() {
  try {
    console.log('🔍 Checking entries table columns...\n');
    
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'entries'
      ORDER BY ordinal_position
    `;
    
    console.log(`📊 Total columns in entries table: ${columns.length}\n`);
    console.log('Columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    const missingColumns = ['cashAmount', 'onlineAmount', 'creditAmount', 'paymentStatus', 'autoEnded', 'pcNumber', 'beverages', 'beveragesAmount'];
    const existingColumns = columns.map(c => c.column_name);
    
    console.log('\n❌ Missing columns:');
    missingColumns.forEach(col => {
      if (!existingColumns.includes(col)) {
        console.log(`  - ${col}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();
