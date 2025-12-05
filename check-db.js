const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function checkDB() {
  try {
    console.log('🔍 Checking database...\n');
    
    const users = await prisma.user.findMany();
    console.log(`📊 Total users: ${users.length}`);
    
    if (users.length > 0) {
      console.log('\n👥 Users in database:');
      users.forEach(user => {
        console.log(`  - ${user.username} (${user.role}) - ID: ${user.id}`);
      });
    } else {
      console.log('\n❌ No users found in database!');
    }
    
    const machines = await prisma.machine.findMany();
    console.log(`\n🎮 Total machines: ${machines.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDB();
