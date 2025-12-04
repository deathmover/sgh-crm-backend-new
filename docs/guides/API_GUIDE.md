# SGH CRM API Usage Guide

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication

All endpoints except `/auth/login` require JWT authentication via Bearer token.

### Login
```bash
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@123"
}

Response:
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clxxx...",
      "username": "admin",
      "role": "super_admin"
    }
  },
  "statusCode": 201,
  "message": "Success"
}
```

Use the `access_token` in subsequent requests:
```
Authorization: Bearer <access_token>
```

---

## Workflow Example

### 1. Customer Arrives

**Search for existing customer:**
```bash
GET /customers?search=John&page=1&limit=20
```

**Or create new customer:**
```bash
POST /customers
{
  "name": "John Doe",
  "phone": "+919876543210",
  "email": "john@example.com"
}
```

### 2. Check Available Machines

```bash
GET /machines/available

Response:
[
  {
    "id": "machine-id-1",
    "name": "Mid Pro PC",
    "type": "mid_pro",
    "units": 11,
    "hourlyRate": 50,
    "halfHourlyRate": 30,
    "availableUnits": 8,
    "isAvailable": true
  }
]
```

### 3. Start Session

```bash
POST /entries
{
  "customerId": "customer-id",
  "machineId": "machine-id",
  "startTime": "2025-09-30T10:00:00Z",
  "notes": "Requested corner seat"
}

Response:
{
  "id": "entry-id",
  "customer": { "name": "John Doe", ... },
  "machine": { "name": "Mid Pro PC", ... },
  "startTime": "2025-09-30T10:00:00Z",
  "endTime": null
}
```

### 4. Check Active Sessions

```bash
GET /entries/active
```

### 5. End Session

```bash
PATCH /entries/:id/end
{
  "endTime": "2025-09-30T12:30:00Z",
  "paymentType": "cash",
  "finalAmount": 130,  // Optional: override calculated amount
  "notes": "Applied 10% discount"
}

Response:
{
  "id": "entry-id",
  "duration": 150,         // actual minutes
  "roundedDuration": 150,  // rounded minutes
  "cost": 150,            // calculated cost
  "finalAmount": 130,     // admin-adjusted
  "paymentType": "cash",
  ...
}
```

---

## Daily Sheet

### Get Today's Daily Sheet

```bash
GET /entries/daily-sheet?date=2025-09-30

Response:
{
  "date": "2025-09-30",
  "entries": [...],
  "summary": {
    "totalEntries": 25,
    "totalRevenue": 5450,
    "totalDuration": 3600
  },
  "paymentBreakdown": {
    "cash": { "count": 15, "amount": 3200 },
    "online": { "count": 8, "amount": 2000 },
    "credit": { "count": 2, "amount": 250 }
  }
}
```

---

## Analytics

### Dashboard Stats

```bash
GET /analytics/dashboard?date=2025-09-30

Response:
{
  "todaysRevenue": 5450,      // Cash + Online only
  "pendingCredit": 1250,       // Total credit pending
  "customersServedToday": 18,
  "totalEntriesToday": 25,
  "activeSessions": 3
}
```

### Machine Usage Stats

```bash
GET /analytics/machine-usage?startDate=2025-09-01&endDate=2025-09-30

Response:
[
  {
    "machineId": "...",
    "machineName": "Mid Pro PC",
    "machineType": "mid_pro",
    "totalSessions": 450,
    "totalRevenue": 22500,
    "totalDuration": 27000
  }
]
```

### Weekly Revenue Trend

```bash
GET /analytics/weekly-revenue

Response:
[
  {
    "date": "2025-09-24",
    "cashRevenue": 3200,
    "onlineRevenue": 1800,
    "creditRevenue": 400,
    "totalRevenue": 5400
  },
  ...
]
```

### Top Customers

```bash
GET /analytics/top-customers?limit=10&startDate=2025-09-01&endDate=2025-09-30

Response:
[
  {
    "customerId": "...",
    "customerName": "John Doe",
    "customerPhone": "+919876543210",
    "totalSessions": 45,
    "totalSpent": 6750
  }
]
```

---

## Business Logic Examples

### Duration Rounding

| Actual Duration | Rounded Duration |
|----------------|------------------|
| 10 minutes     | 0 minutes        |
| 15 minutes     | 30 minutes       |
| 25 minutes     | 30 minutes       |
| 40 minutes     | 60 minutes       |
| 70 minutes     | 90 minutes       |
| 95 minutes     | 120 minutes      |

### Cost Calculation Examples

**Mid Pro PC (150 minutes = 2.5 hours):**
- Check package rates: None match
- Use hourly rate: 3 hours × ₹50 = ₹150

**Mid Pro PC (180 minutes = 3 hours):**
- Check package rates: 3hr = ₹130 ✓
- Use package rate: ₹130

**Ultra PC (25 minutes):**
- Rounded to 30 minutes
- No half-hourly rate available
- Use hourly rate: 1 hour × ₹70 = ₹70

**Racing Simulator (25 minutes):**
- Rounded to 30 minutes
- Half-hourly rate available: ₹100

---

## Error Handling

All errors follow this format:
```json
{
  "statusCode": 400,
  "timestamp": "2025-09-30T10:30:00.000Z",
  "path": "/api/v1/entries",
  "message": "Machine Mid Pro PC is fully occupied"
}
```

Common status codes:
- `200/201`: Success
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing/invalid token)
- `404`: Not Found
- `409`: Conflict (duplicate phone, etc.)
- `500`: Internal Server Error

---

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

### Create Customer
```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","phone":"+919876543210"}'
```

### Start Entry
```bash
curl -X POST http://localhost:3000/api/v1/entries \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId":"CUSTOMER_ID",
    "machineId":"MACHINE_ID",
    "startTime":"2025-09-30T10:00:00Z"
  }'
```

---

## Rate Limits & Best Practices

1. **Always validate customer before creating entry**
2. **Check machine availability before starting session**
3. **Use pagination for large lists** (customers, entries)
4. **Cache machine list** (rarely changes)
5. **Use date filters** for better performance
6. **Handle errors gracefully** on the frontend

---

## Support

For API documentation with interactive testing:
👉 http://localhost:3000/api/docs