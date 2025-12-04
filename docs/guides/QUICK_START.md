# Quick Start Guide - Split Payment & Auto-End

## 🚀 Run These Commands Now

### Backend (Terminal 1)
```bash
cd /Users/roxiler-systems/work/sgh-crm-backend
npm install @nestjs/schedule
npx prisma migrate dev --name add_split_payment_support
npx prisma generate
npm run start:dev
```

### Frontend (Terminal 2)
```bash
cd /Users/roxiler-systems/work/sgh-crm-frontend
npm run dev
```

## ✅ What's Already Done

### Backend ✅
- [x] Prisma schema updated
- [x] Migration file created
- [x] Split payment logic in endEntry()
- [x] updatePayment() method
- [x] autoEndExpiredSessions() method
- [x] Cron job configured
- [x] New API endpoints added
- [x] DTOs updated

### Frontend ✅
- [x] Entry interface updated
- [x] useUpdatePayment hook created
- [x] PaymentDialog component created
- [x] API service methods added

## 📝 What You Need To Do

### 1. Update Daily Sheet (High Priority)

File: `sgh-crm-frontend/app/(dashboard)/daily-sheet/page.tsx`

**Add these imports:**
```tsx
import { PaymentDialog } from '@/components/entries/payment-dialog';
```

**Add to state:**
```tsx
const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
```

**Add Payment Status column header (after "Payment" column):**
```tsx
<TableHead>Payment Status</TableHead>
```

**Replace the Payment Type cell with Payment Status cell:**
```tsx
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
        <Badge className="bg-green-600 cursor-pointer">
          Paid ({formatCurrency(entry.cashAmount + entry.onlineAmount + entry.creditAmount)})
        </Badge>
      )}
      {entry.paymentStatus === 'partial' && (
        <Badge className="bg-orange-600 cursor-pointer">
          Partial ({formatCurrency(entry.cashAmount + entry.onlineAmount + entry.creditAmount)}/{formatCurrency(entry.finalAmount)})
        </Badge>
      )}
      {entry.paymentStatus === 'not_paid' && (
        <Badge variant="destructive" className="cursor-pointer">
          Not Paid
        </Badge>
      )}
    </button>
  ) : (
    <Badge variant="secondary">Active</Badge>
  )}
</TableCell>
```

**Add PaymentDialog in the dialogs section (after ExtendSessionDialog):**
```tsx
<PaymentDialog
  entry={selectedEntry}
  open={isPaymentDialogOpen}
  onOpenChange={setIsPaymentDialogOpen}
/>
```

### 2. Optional: Update End-Entry Dialog

File: `sgh-crm-frontend/components/entries/end-entry-dialog.tsx`

Add split payment input fields before the "Payment Type" select.

## 🧪 Test It

1. **Test Auto-End:**
   - Create entry with 2-minute duration
   - Wait 2 minutes
   - Entry should auto-end
   - Payment status should be "Not Paid"

2. **Test Split Payment:**
   - Click on "Not Paid" badge
   - Enter: Cash ₹100, Online ₹50
   - Click Update
   - Status should change to "Partial" or "Paid"

3. **Test Payment Update:**
   - Click on payment status again
   - Modify amounts
   - Verify updates save correctly

## 📊 Features Overview

| Feature | Status | Description |
|---------|--------|-------------|
| Auto-End Sessions | ✅ Ready | Sessions end automatically at expected time |
| Split Payments | ✅ Ready | Track cash, online, credit separately |
| Payment Status | ✅ Ready | Shows paid/partial/not_paid |
| Clickable Status | 🔨 To Implement | Click to update payment |
| Payment Dialog | ✅ Ready | Full split payment interface |
| Cron Job | ✅ Ready | Runs every minute |

## 🎯 Expected Behavior

### Scenario 1: New Entry with Duration
```
1. Create entry: Customer A, Machine B, Duration: 60 min
2. Start time: 2:00 PM
3. Expected end: 3:00 PM (auto-calculated)
4. At 3:00 PM: Session auto-ends
5. Payment status: "Not Paid" (red badge)
6. Click badge → Payment dialog opens
7. Enter amounts → Update
8. Status changes based on total
```

### Scenario 2: Split Payment
```
Total Amount: ₹200
Payments:
- Cash: ₹100
- Online: ₹50
- Credit: ₹50 (remaining)

Result: Status = "Partial" (₹150/₹200)
```

### Scenario 3: Full Payment
```
Total Amount: ₹200
Payments:
- Cash: ₹200
- Online: ₹0
- Credit: ₹0

Result: Status = "Paid"
```

## 🐛 Troubleshooting

**Issue: Migration fails**
- Delete `migrations` folder and run again
- Check database connection

**Issue: Cron not working**
- Check console logs for "Running auto-end check..."
- Verify @nestjs/schedule is installed

**Issue: Payment dialog doesn't open**
- Check if selectedEntry is set
- Verify entry has endTime (not active)

**Issue: Payment status not updating**
- Check browser console for errors
- Verify backend endpoint is working: PATCH /entries/:id/payment

## 📞 Support

Check detailed docs:
- `/Users/roxiler-systems/work/SPLIT_PAYMENT_IMPLEMENTATION.md` - Full guide
- `/Users/roxiler-systems/work/sgh-crm-backend/IMPLEMENTATION_STEPS.md` - Backend steps

---

**Ready to go! Run the commands above and start testing!** 🚀
