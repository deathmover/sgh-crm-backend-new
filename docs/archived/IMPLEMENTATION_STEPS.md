# Split Payment & Auto-End Implementation Steps

## Backend Setup Commands

Run these commands in the backend directory:

```bash
cd /Users/roxiler-systems/work/sgh-crm-backend

# 1. Install required package
npm install @nestjs/schedule

# 2. Run the database migration
npx prisma migrate dev --name add_split_payment_support

# 3. Generate Prisma client
npx prisma generate

# 4. Restart the backend server
npm run start:dev
```

## What's Been Implemented

### Backend Changes:
- ✅ Updated Prisma schema with split payment fields
- ✅ Added `paymentStatus` (not_paid, partial, paid)
- ✅ Added `cashAmount`, `onlineAmount`, `creditAmount` fields
- ✅ Added `autoEnded` flag
- ✅ Updated `endEntry()` method to support split payments
- ✅ Added `updatePayment()` method for updating payments after session ends
- ✅ Added `autoEndExpiredSessions()` method
- ✅ Added cron job that runs every minute to auto-end expired sessions
- ✅ Added `/entries/:id/payment` PATCH endpoint
- ✅ Added `/entries/auto-end-expired` POST endpoint

### Migration File Created:
- `/prisma/migrations/add_split_payment_support/migration.sql`

## Next Steps (Frontend)

After backend is running, implement these frontend changes:

1. Update Entry type interface in `lib/api/services.ts`
2. Add `useUpdatePayment` hook
3. Create `PaymentDialog` component
4. Update `end-entry-dialog` for split payments
5. Update daily sheet to show payment status with clickable payment column

## Testing

1. Create a new entry with expected duration
2. Wait for the expected end time - session should auto-end
3. Payment status should be "not_paid"
4. Click on payment status to update split payments
5. Test partial payments and full payments
