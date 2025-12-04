# SGH Gaming Hub CRM - Backend

A comprehensive NestJS-based backend for **Shaukeens Gaming Hub** CRM system to manage customers, gaming sessions, billing, and analytics.

## Features

- **Authentication**: JWT-based authentication for Super Admin
- **Customer Management**: CRUD operations with search and pagination
- **Machine Management**: Predefined gaming machines with availability tracking
- **Entry/Daily Sheet**: Session tracking with automatic cost calculation
- **Analytics**: Revenue reports, machine usage stats, and customer insights
- **Business Logic**: Automatic duration rounding and cost calculation
- **Swagger Documentation**: Interactive API documentation

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma 6
- **Authentication**: JWT (Passport)
- **Validation**: class-validator & class-transformer
- **Documentation**: Swagger/OpenAPI

## Project Structure

```
src/
├── common/                 # Shared utilities
│   ├── decorators/        # Custom decorators (@CurrentUser, @Public)
│   ├── filters/           # Global exception filters
│   └── interceptors/      # Logging & transform interceptors
├── config/                # Configuration files
│   └── database.config.ts # Prisma service
├── modules/               # Feature modules
│   ├── auth/             # Authentication & JWT
│   ├── customers/        # Customer management
│   ├── machines/         # Machine management
│   ├── entries/          # Entry/daily sheet
│   └── analytics/        # Analytics & reporting
└── main.ts               # Application entry point
```

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sgh-crm-backend
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your database credentials:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/sgh_crm?schema=public"
   JWT_SECRET="your-super-secret-jwt-key"
   JWT_EXPIRES_IN="7d"
   PORT=3000
   SUPER_ADMIN_USERNAME="admin"
   SUPER_ADMIN_PASSWORD="Admin@123"
   ```

4. **Generate Prisma Client**
   ```bash
   yarn prisma:generate
   ```

5. **Run database migrations**
   ```bash
   yarn prisma:migrate
   ```

6. **Seed the database** (creates admin user and machines)
   ```bash
   yarn prisma:seed
   ```

## Running the Application

```bash
# Development mode with hot reload
yarn start:dev

# Production mode
yarn build
yarn start:prod
```

The server will start at `http://localhost:3000`

## API Documentation

Once the application is running, access the interactive API documentation:

**Swagger UI**: http://localhost:3000/api/docs

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login with username/password
- `GET /api/v1/auth/profile` - Get current user profile

### Customers
- `POST /api/v1/customers` - Create customer
- `GET /api/v1/customers` - List customers (with search & pagination)
- `GET /api/v1/customers/:id` - Get customer details
- `GET /api/v1/customers/:id/stats` - Get customer statistics
- `PATCH /api/v1/customers/:id` - Update customer
- `DELETE /api/v1/customers/:id` - Delete customer

### Machines
- `GET /api/v1/machines` - List all machines
- `GET /api/v1/machines/available` - Get available machines
- `GET /api/v1/machines/:id` - Get machine details
- `GET /api/v1/machines/:id/stats` - Get machine statistics

### Entries / Daily Sheet
- `POST /api/v1/entries` - Create entry (start session)
- `PATCH /api/v1/entries/:id/end` - End entry (stop session)
- `GET /api/v1/entries` - List entries (with filters)
- `GET /api/v1/entries/active` - Get active sessions
- `GET /api/v1/entries/daily-sheet?date=YYYY-MM-DD` - Get daily sheet
- `GET /api/v1/entries/:id` - Get entry details
- `DELETE /api/v1/entries/:id` - Delete entry

### Analytics
- `GET /api/v1/analytics/dashboard?date=YYYY-MM-DD` - Dashboard stats
- `GET /api/v1/analytics/machine-usage` - Machine usage statistics
- `GET /api/v1/analytics/weekly-revenue` - Weekly revenue trend
- `GET /api/v1/analytics/payment-breakdown` - Payment type breakdown
- `GET /api/v1/analytics/top-customers?limit=10` - Top customers
- `GET /api/v1/analytics/revenue-report` - Comprehensive revenue report

## Database Schema

### Models
- **User**: Super admin authentication
- **Customer**: Customer information
- **Machine**: Gaming machines with pricing
- **Entry**: Session entries with billing

See [prisma/schema.prisma](prisma/schema.prisma) for full schema details.

## Business Logic

### Duration Rounding
- `< 15 minutes` → Round down to nearest 30 min
- `≥ 15 minutes` → Round up to nearest 30 min

### Cost Calculation
1. Check for package rates (3hr, 5hr, 12hr)
2. Apply half-hourly rate if ≤ 30 minutes
3. Default to hourly rate calculation

### Payment Types
- **Cash**: Included in daily revenue
- **Online**: Included in daily revenue
- **Credit**: Tracked separately as pending

## Development Tools

```bash
# Format code
yarn format

# Lint code
yarn lint

# Run tests
yarn test

# Prisma Studio (Database GUI)
yarn prisma:studio
```

## Default Credentials

**Super Admin**
- Username: `admin`
- Password: `Admin@123`

⚠️ **Change these credentials in production!**

## Machines Seeded

1. **Mid Pro PC** (11 units) - ₹30/30min, ₹50/hr
2. **High End PC** (2 units) - ₹35/30min, ₹60/hr
3. **Ultra PC** (1 unit) - ₹70/hr
4. **PS5 (4 controllers)** (4 units) - ₹70/hr per controller
5. **Racing Simulator** (1 unit) - ₹100/30min, ₹150/hr

## Architecture Highlights

✅ **Modular Architecture**: Separate modules for each feature
✅ **Global Guards**: JWT authentication on all routes (except login)
✅ **Global Filters**: Centralized exception handling
✅ **Global Interceptors**: Request logging
✅ **Validation**: DTO validation with class-validator
✅ **Database Indexing**: Optimized queries with Prisma indexes
✅ **API Documentation**: Auto-generated Swagger docs
✅ **Type Safety**: Full TypeScript coverage
✅ **Scalable**: Clean code with separation of concerns

## 📖 Documentation

For detailed documentation, see the [docs](./docs) folder:
- **[Features](./docs/features/)** - Feature documentation and implementation guides
- **[Guides](./docs/guides/)** - Setup and usage guides
- **[Archived](./docs/archived/)** - Historical documentation

## License

UNLICENSED
