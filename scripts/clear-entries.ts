import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearEntries() {
  try {
    console.log('🗑️  Clearing all entries data...\n');

    // Delete all entries
    const deletedEntries = await prisma.entry.deleteMany({});
    console.log(`✅ Deleted ${deletedEntries.count} entries`);

    console.log('\n✅ All entries cleared successfully!');
    console.log('📝 Customers data is preserved.');
  } catch (error) {
    console.error('❌ Error clearing entries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearEntries();
