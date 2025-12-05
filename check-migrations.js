const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function checkMigrations() {
  try {
    console.log('🔍 Checking migration status...\n');
    
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, applied_steps_count 
      FROM _prisma_migrations 
      ORDER BY finished_at DESC
    `;
    
    console.log(`📊 Total migrations applied: ${migrations.length}\n`);
    
    if (migrations.length > 0) {
      console.log('✅ Applied migrations:');
      migrations.forEach(m => {
        console.log(`  - ${m.migration_name} (${m.applied_steps_count} steps) - ${m.finished_at}`);
      });
    } else {
      console.log('❌ No migrations have been applied!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrations();
