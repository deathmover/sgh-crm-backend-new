# Membership System Documentation

## Overview
The membership system allows customers to purchase prepaid gaming hours at discounted rates. It's designed to be **completely toggleable** - you can enable or disable it without affecting your existing system.

## Current Status
🔴 **DISABLED** (by default for safety)

To enable: `npx ts-node scripts/toggle-membership.ts enable`

## Membership Plans (Pre-configured)

### For Mid Pro PCs:
1. **Monthly 22 Hours** - ₹999 (₹45.41/hr) - 30 days validity
2. **Monthly 50 Hours** - ₹1999 (₹39.98/hr) - 30 days validity
3. **Quarterly 100 Hours** - ₹3499 (₹34.99/hr) - 90 days validity

## How It Works

### Customer Journey:
1. **Purchase**: Customer buys a membership plan (e.g., ₹999 for 22 hours)
2. **Storage**: System records: Plan, Hours remaining, Purchase date, Expiry date
3. **Usage**: When creating an entry with predefined duration:
   - If customer has active membership for that machine type
   - Hours are automatically deducted
   - Entry marked as "paid" (₹0 charge)
4. **Expiry**: Membership expires after validity period OR when hours run out

### Validation (Automatic):
- ✅ Machine type must match membership plan
- ✅ Sufficient hours remaining
- ✅ Not expired
- ✅ Membership status is "active"
- ✅ Belongs to the correct customer

## Database Structure

### Tables Created:
1. **membership_plans** - Stores available plans
2. **customer_memberships** - Tracks purchased memberships
3. **system_settings** - Feature flags and configuration

### Entry Table Changes:
- Added `membershipId` (optional) - Links entry to membership
- Added `membershipHours` (optional) - Hours deducted

## API Endpoints

### Membership Plans:
- `GET /memberships/plans` - List all plans
- `POST /memberships/plans` - Create new plan
- `PUT /memberships/plans/:id` - Update plan
- `DELETE /memberships/plans/:id` - Delete plan (if no active memberships)

### Customer Memberships:
- `POST /memberships/purchase` - Purchase membership for customer
- `GET /memberships/customer/:customerId` - Get customer's memberships
- `GET /memberships/customer/:customerId/active` - Get active membership
- `POST /memberships/:id/cancel` - Cancel membership

### System:
- `GET /memberships/enabled` - Check if membership system is enabled
- `GET /memberships/stats/overview` - Membership statistics

## Entry Creation with Membership

### Request Body (NEW field):
```json
{
  "customerId": "...",
  "machineId": "...",
  "startTime": "2025-10-06T10:00:00Z",
  "predefinedDuration": 120,
  "useMembershipId": "clxxx...membership-id"  // ← NEW: Optional
}
```

### Behavior:
- If `useMembershipId` provided:
  - Validates membership
  - Deducts hours (120 min = 2 hours)
  - Sets `finalAmount = 0`
  - Sets `paymentStatus = 'paid'`
  - Links entry to membership

- If NOT provided:
  - Works exactly as before (normal payment flow)

## Toggle Script

### Check Status:
```bash
npx ts-node scripts/toggle-membership.ts status
```

### Enable:
```bash
npx ts-node scripts/toggle-membership.ts enable
```

### Disable:
```bash
npx ts-node scripts/toggle-membership.ts disable
```

**Important**: Disabling does NOT delete data - it just hides membership features in UI.

## Safety Features

1. **Feature Flag**: System disabled by default
2. **Data Preservation**: Disabling keeps all membership data intact
3. **Backward Compatible**: Existing entry creation works unchanged
4. **Validation**: Extensive checks prevent misuse
5. **No Forced Usage**: Membership is optional - customers can still pay normally

## What's Complete (Backend)

✅ Database schema with all models
✅ Feature flag system
✅ Full REST API for plans and memberships
✅ Entry creation integration
✅ Automatic hour deduction
✅ Validation and error handling
✅ Toggle script for enable/disable
✅ Seed script with your 3 plans

## What's Pending (Frontend)

⏳ Membership plans management page
⏳ Customer membership display in details page
⏳ Membership purchase dialog/flow
⏳ Entry creation dialog - membership selection
⏳ Dashboard statistics for memberships

## Testing (When Ready)

1. Enable system: `npx ts-node scripts/toggle-membership.ts enable`
2. Purchase membership via API or frontend
3. Create entry with `useMembershipId`
4. Verify hours deducted
5. Check membership status updated

If anything doesn't work:
```bash
npx ts-node scripts/toggle-membership.ts disable
```

Your system will work exactly as before!

## Future Enhancements (Ideas)

- Auto-renew memberships
- Membership gifting
- Family/group memberships
- Loyalty points
- Email/SMS notifications for expiry
- Usage analytics per membership
