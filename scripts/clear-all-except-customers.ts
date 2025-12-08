import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllExceptCustomers() {
  try {


    // Delete in order of dependencies (child tables first)

    // 1. Delete all entries (references memberships and customers)
    const deletedEntries = await prisma.entry.deleteMany({});


    // 2. Delete all customer memberships (references membership plans and customers)
    const deletedCustomerMemberships = await prisma.customerMembership.deleteMany({});


    // 3. Delete all membership plans
    const deletedMembershipPlans = await prisma.membershipPlan.deleteMany({});


    // 4. Delete all expenses
    const deletedExpenses = await prisma.expense.deleteMany({});


    // 5. Delete system settings (optional - will be recreated if needed)
    const deletedSettings = await prisma.systemSetting.deleteMany({});



  } catch (error) {
    console.error('❌ Error clearing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllExceptCustomers();
