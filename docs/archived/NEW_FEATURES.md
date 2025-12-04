# New Entry Management Features

## Overview

Added comprehensive entry management features including predefined duration, edit functionality, and soft delete capabilities.

---

## 1. Predefined Duration

### Feature Description
Admins can now set an expected duration when creating an entry. This will be used for:
- 5-minute warning notifications (to be implemented)
- Better session planning
- Expected vs actual duration tracking

### Backend Changes

**Database Schema** (`prisma/schema.prisma`):
```prisma
model Entry {
  ...
  predefinedDuration Int?  // Optional: Expected duration in minutes
  ...
}
```

**API Changes**:
- `POST /api/v1/entries` - Now accepts optional `predefinedDuration` field
- Returns predefinedDuration in response

### Frontend Changes

**Create Entry Dialog**:
- Added "Expected Duration" field (optional)
- Input accepts duration in minutes
- Shows helper text: "Set expected duration for 5-min warning notification"

**Usage**:
1. Open Create Entry dialog
2. Fill customer, machine, start time
3. Optionally enter expected duration (e.g., 60 for 1 hour)
4. Create entry

---

## 2. Edit Entry Functionality

### Feature Description
Admins can now update active (not ended) entries to:
- Change customer
- Change machine
- Update start time
- Modify predefined duration
- Update notes

### Backend Changes

**New DTO** (`dto/update-entry.dto.ts`):
```typescript
class UpdateEntryDto {
  customerId?: string;
  machineId?: string;
  startTime?: string;
  predefinedDuration?: number;
  notes?: string;
}
```

**New API Endpoint**:
- `PATCH /api/v1/entries/:id` - Update an active entry
- **Restriction**: Cannot update entries that have already ended

### Frontend Changes

**New Hooks**:
```typescript
useUpdateEntry() // Hook for updating entries
```

**API Service**:
```typescript
entryApi.update(id, data)
```

**Usage**:
- Update entry before it ends
- Useful for correcting mistakes (wrong customer, wrong machine, etc.)

---

## 3. Soft Delete System

### Feature Description
Instead of permanently deleting entries, they are now "soft deleted":
- Entry marked as deleted (`isDeleted: true`)
- Timestamp recorded (`deletedAt`)
- Entry hidden from normal views
- Can be restored if needed
- Provides audit trail

### Backend Changes

**Database Schema**:
```prisma
model Entry {
  ...
  isDeleted  Boolean   @default(false) // Soft delete flag
  deletedAt  DateTime? // When it was deleted
  ...
  @@index([isDeleted])
}
```

**New API Endpoints**:

1. **Soft Delete Entry**
   - `DELETE /api/v1/entries/:id/soft`
   - Marks entry as deleted without removing from database

2. **Get Deleted Entries**
   - `GET /api/v1/entries/deleted`
   - Returns paginated list of deleted entries
   - Query params: `page`, `limit`

3. **Restore Entry**
   - `POST /api/v1/entries/:id/restore`
   - Restores a soft-deleted entry

4. **Permanent Delete** (admin only)
   - `DELETE /api/v1/entries/:id`
   - Actually removes entry from database

### Frontend Changes

**New Hooks**:
```typescript
useSoftDeleteEntry()   // Soft delete an entry
useDeletedEntries()    // Get list of deleted entries
useRestoreEntry()      // Restore a deleted entry
```

**API Services**:
```typescript
entryApi.softDelete(id)
entryApi.getDeleted(params)
entryApi.restore(id)
```

---

## 4. Updated Query Filters

### Backend Changes

All entry queries now automatically exclude deleted entries:
- `findAll()` - Only returns `isDeleted: false`
- `getActive()` - Only returns non-deleted active sessions
- `getDailySheet()` - Excludes deleted entries
- Machine availability checks ignore deleted entries

**To see deleted entries**: Use dedicated `/entries/deleted` endpoint

---

## Migration

### Database Migration Created
```
20250930124626_add_predefined_duration_and_soft_delete
```

### Fields Added:
- `predefinedDuration` - INT (nullable)
- `isDeleted` - BOOLEAN (default: false)
- `deletedAt` - TIMESTAMP (nullable)

### Index Added:
- Index on `isDeleted` for faster filtering

---

## API Endpoints Summary

### Entry Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/entries` | Create entry (now with predefinedDuration) |
| GET | `/entries` | Get all entries (excludes deleted) |
| GET | `/entries/active` | Get active sessions (excludes deleted) |
| GET | `/entries/deleted` | Get deleted entries only |
| GET | `/entries/:id` | Get entry details |
| PATCH | `/entries/:id` | Update active entry |
| PATCH | `/entries/:id/end` | End entry session |
| DELETE | `/entries/:id/soft` | Soft delete entry |
| POST | `/entries/:id/restore` | Restore deleted entry |
| DELETE | `/entries/:id` | Permanent delete |

---

## Use Cases

### 1. Predefined Duration
**Scenario**: Customer wants to play for exactly 2 hours
1. Admin creates entry with predefinedDuration: 120
2. System tracks expected end time
3. (Future) System alerts 5 minutes before expected end

### 2. Edit Entry
**Scenario**: Admin selected wrong machine
1. Admin realizes mistake
2. Uses PATCH /entries/:id to update machineId
3. Entry updated without creating new one

### 3. Soft Delete
**Scenario**: Customer leaves immediately due to emergency
1. Admin soft deletes the entry
2. Entry hidden from daily sheet
3. Later admin can restore if customer returns

### 4. Audit Trail
**Scenario**: Need to see why revenue doesn't match
1. Check deleted entries
2. See what was removed and when
3. Restore if deleted by mistake

---

## Next Steps (Not Yet Implemented)

### 5-Minute Warning System

**Requirements**:
1. Background job checking active entries
2. Compare current time with (startTime + predefinedDuration - 5 minutes)
3. Send notification to admin
4. Play audio alert
5. Option to extend session

**Implementation Notes**:
- Need WebSocket or polling mechanism
- Audio file for alert
- Frontend notification component
- "Extend Session" button

**Recommended Approach**:
- Use React Query with 1-minute refetch interval
- Check active entries with predefinedDuration
- Calculate remaining time
- Show notification when <= 5 minutes remaining
- Play audio using HTML5 Audio API

---

## Testing

### Test Predefined Duration:
```bash
curl -X POST http://localhost:3000/api/v1/entries \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "xxx",
    "machineId": "xxx",
    "startTime": "2025-09-30T10:00:00Z",
    "predefinedDuration": 60
  }'
```

### Test Update Entry:
```bash
curl -X PATCH http://localhost:3000/api/v1/entries/ENTRY_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "predefinedDuration": 90,
    "notes": "Extended duration"
  }'
```

### Test Soft Delete:
```bash
curl -X DELETE http://localhost:3000/api/v1/entries/ENTRY_ID/soft \
  -H "Authorization: Bearer TOKEN"
```

### Test Get Deleted:
```bash
curl http://localhost:3000/api/v1/entries/deleted \
  -H "Authorization: Bearer TOKEN"
```

### Test Restore:
```bash
curl -X POST http://localhost:3000/api/v1/entries/ENTRY_ID/restore \
  -H "Authorization: Bearer TOKEN"
```

---

## Breaking Changes

None - All changes are backward compatible:
- Predefined duration is optional
- Existing entries work without it
- Soft delete doesn't affect existing delete behavior
- New fields have defaults

---

## Status

✅ **Backend**: Complete
✅ **Database**: Migrated
✅ **Frontend API Layer**: Complete
✅ **Frontend UI**: Predefined duration added
⏳ **Frontend UI**: Edit dialog (to be created)
⏳ **Frontend UI**: Deleted entries view (to be created)
⏳ **Feature**: 5-minute warning (not yet implemented)

---

**Last Updated**: 2025-09-30
**Version**: 1.1.0