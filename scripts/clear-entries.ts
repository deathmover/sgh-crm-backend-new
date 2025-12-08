import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearEntries() {
  try {


    // Delete all entries
    const deletedEntries = await prisma.entry.deleteMany({});



  } catch (error) {
    console.error('❌ Error clearing entries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearEntries();
