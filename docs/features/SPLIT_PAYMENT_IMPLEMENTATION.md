# Split Payment & Auto-End Implementation Guide

## ✅ Completed Backend Implementation

### 1. Database Schema Updates
- Added `paymentStatus` field (not_paid | partial | paid)
- Added split payment fields: `cashAmount`, `onlineAmount`, `creditAmount`
- Added `autoEnded` boolean flag
- Migration file created at `/prisma/migrations/add_split_payment_support/migration.sql`

### 2. Backend Services & Controllers
- ✅ Updated `endEntry()` method to support split payments
- ✅ Added `updatePayment()` method for post-session payment updates
- ✅ Added `autoEndExpiredSessions()` method
- ✅ Added cron job (runs every minute) to auto-end expired sessions
- ✅ Added `/entries/:id/payment` PATCH endpoint
- ✅ Added `/entries/auto-end-expired` POST endpoint
- ✅ Integrated `@nestjs/schedule` module

## ✅ Completed Frontend Implementation

### 1. Type Definitions
- ✅ Updated `Entry` interface with new fields
- ✅ Added `updatePayment` API method

### 2. Hooks
- ✅ Created `useUpdatePayment()` hook

### 3. Components
- ✅ Created `PaymentDialog` component with split payment support

## 🔧 Installation Steps

### Backend Setup

```bash
cd /Users/roxiler-systems/work/sgh-crm-backend

# 1. Install required package
npm install @nestjs/schedule

# 2. Run database migration
npx prisma migrate dev --name add_split_payment_support

# 3. Generate Prisma client
npx prisma generate

# 4. Restart backend server
npm run start:dev
```

### Frontend Setup

```bash
cd /Users/roxiler-systems/work/sgh-crm-frontend

# No new packages needed - already using existing dependencies
npm run dev
```

## 📝 Remaining Frontend Tasks

### 1. Update End-Entry Dialog for Split Payments

File: `/components/entries/end-entry-dialog.tsx`

Add split payment fields to the end session form:
- Cash Amount input
- Online Amount input
- Credit Amount input
- Show total and remaining amount

### 2. Update Daily Sheet to Show Payment Status

File: `/app/(dashboard)/daily-sheet/page.tsx`

Changes needed:
1. Add "Payment Status" column
2. Make payment status clickable
3. Open `PaymentDialog` when clicked
4. Show status badges (Paid/Partial/Not Paid)
5. Color code based on status

Example implementation:

```tsx
// Add to state
const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

// In table header
<TableHead>Payment Status</TableHead>

// In table cell (replace Payment cell)
<TableCell>
  {entry.endTime ? (
    <button
      onClick={() => {
        setSelectedEntry(entry);
        setIsPaymentDialogOpen(true);
      }}
      className="hover:opacity-80 transition-opacity"
    >
      {entry.paymentStatus === 'paid' && (
        <Badge className="bg-green-600 cursor-pointer">Paid</Badge>
      )}
      {entry.paymentStatus === 'partial' && (
        <Badge className="bg-orange-600 cursor-pointer">Partial</Badge>
      )}
      {entry.paymentStatus === 'not_paid' && (
        <Badge variant="destructive" className="cursor-pointer">Not Paid</Badge>
      )}
    </button>
  ) : (
    <Badge variant="secondary">Active</Badge>
  )}
</TableCell>

// Add PaymentDialog to dialogs section
{selectedEntry && (
  <PaymentDialog
    entry={selectedEntry}
    open={isPaymentDialogOpen}
    onOpenChange={setIsPaymentDialogOpen}
  />
)}
```

### 3. Update End-Entry Dialog (Optional Enhancement)

Add "Quick Payment" buttons for common scenarios:
- "Full Cash" button
- "Full Online" button
- "Mark as Credit" button
- Manual split entry fields

## 🎯 How It Works

### Auto-End Sessions
1. User creates entry with `predefinedDuration` (e.g., 60 minutes)
2. Expected end time = startTime + predefinedDuration
3. Cron job runs every minute checking for expired sessions
4. When current time >= expected end time:
   - Session automatically ends
   - `autoEnded` flag set to true
   - `paymentStatus` set to 'not_paid'
   - All split amounts set to 0

### Split Payment Workflow
1. Session ends (auto or manual)
2. Initial payment status: "not_paid"
3. User clicks on payment status badge
4. Payment dialog opens
5. User enters split amounts:
   - Cash: ₹100
   - Online: ₹50
   - Credit: ₹0
6. System calculates:
   - Total Paid = ₹150
   - If Total Paid >= Final Amount → Status: "paid"
   - If 0 < Total Paid < Final Amount → Status: "partial"
   - If Total Paid = 0 → Status: "not_paid"

### Payment Status Logic
- **Paid** (Green): Total paid >= final amount
- **Partial** (Orange): Some payment made but not full
- **Not Paid** (Red): No payment recorded

## 🧪 Testing Checklist

### Auto-End Feature
- [ ] Create entry with 2-minute duration
- [ ] Wait 2 minutes
- [ ] Verify session auto-ends at expected time
- [ ] Check `autoEnded` flag is true
- [ ] Verify payment status is "not_paid"

### Split Payment Feature
- [ ] End a session manually
- [ ] Click on payment status
- [ ] Enter split payment (e.g., ₹100 cash, ₹50 online)
- [ ] Verify status changes to "partial" or "paid"
- [ ] Check amounts saved correctly
- [ ] Test full payment scenario
- [ ] Test partial payment scenario
- [ ] Test credit-only scenario

### Daily Sheet Integration
- [ ] Payment status column shows correct badges
- [ ] Badges are clickable for ended sessions
- [ ] Payment dialog opens with correct data
- [ ] Changes reflect immediately after update
- [ ] Active sessions show "Active" badge (not clickable)

## 📊 Database Migration

The migration adds these fields to `entries` table:

```sql
paymentStatus TEXT DEFAULT 'not_paid'
cashAmount INTEGER DEFAULT 0
onlineAmount INTEGER DEFAULT 0
creditAmount INTEGER DEFAULT 0
autoEnded BOOLEAN DEFAULT false
```

Existing data migration:
- Splits existing `finalAmount` into appropriate field based on `paymentType`
- Sets `paymentStatus` based on whether session is ended and payment type

## 🚀 Deployment Notes

1. Run migration in production carefully
2. Test auto-end cron job doesn't overload server
3. Monitor first few auto-ends to ensure correct behavior
4. Consider adding notification when session auto-ends
5. Add admin dashboard to view auto-ended sessions

## 💡 Future Enhancements

1. Add payment history log
2. Send SMS/notification before auto-end
3. Allow configurable grace period before auto-end
4. Add payment receipt generation
5. Track payment method preferences per customer
6. Add bulk payment update feature
7. Payment analytics dashboard

## ⚠️ Important Notes

- The cron job runs every minute - ensure your server can handle this
- Auto-ended sessions have payment status "not_paid" by default
- Users must manually update payment after auto-end
- Split payments are stored as integers (multiply by 100 if using decimal currency)
- Backward compatible with existing single payment type system
