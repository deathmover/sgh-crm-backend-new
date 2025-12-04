import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllExceptCustomers() {
  try {
    console.log('🗑️  Clearing all data except customers...\n');

    // Delete in order of dependencies (child tables first)

    // 1. Delete all entries (references memberships and customers)
    const deletedEntries = await prisma.entry.deleteMany({});
    console.log(`✅ Deleted ${deletedEntries.count} entries`);

    // 2. Delete all customer memberships (references membership plans and customers)
    const deletedCustomerMemberships = await prisma.customerMembership.deleteMany({});
    console.log(`✅ Deleted ${deletedCustomerMemberships.count} customer memberships`);

    // 3. Delete all membership plans
    const deletedMembershipPlans = await prisma.membershipPlan.deleteMany({});
    console.log(`✅ Deleted ${deletedMembershipPlans.count} membership plans`);

    // 4. Delete all expenses
    const deletedExpenses = await prisma.expense.deleteMany({});
    console.log(`✅ Deleted ${deletedExpenses.count} expenses`);

    // 5. Delete system settings (optional - will be recreated if needed)
    const deletedSettings = await prisma.systemSetting.deleteMany({});
    console.log(`✅ Deleted ${deletedSettings.count} system settings`);

    console.log('\n✅ All data cleared successfully!');
    console.log('📝 Customers data is preserved.');
    console.log('\n💡 You may want to:');
    console.log('   1. Run seed script to recreate membership plans: npx ts-node scripts/seed-membership-system.ts');
    console.log('   2. Enable membership system: npx ts-node scripts/toggle-membership.ts enable');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllExceptCustomers();
