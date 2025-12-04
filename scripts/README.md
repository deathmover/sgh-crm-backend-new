# Backend Scripts

Utility scripts for database operations and system management.

## Active Scripts

### Membership System
- **`seed-membership-system.ts`** - Seed membership plans and system settings
  ```bash
  npx ts-node scripts/seed-membership-system.ts
  ```

- **`toggle-membership.ts`** - Enable/disable membership system
  ```bash
  npx ts-node scripts/toggle-membership.ts enable
  npx ts-node scripts/toggle-membership.ts disable
  npx ts-node scripts/toggle-membership.ts status
  ```

### Data Management
- **`clear-entries.ts`** - Delete all entries (keeps customers)
  ```bash
  npx ts-node scripts/clear-entries.ts
  ```

- **`clear-all-except-customers.ts`** - Clear all data except customers
  ```bash
  npx ts-node scripts/clear-all-except-customers.ts
  ```

### Import/Export
- **`import-customers.ts`** - Import customers from CSV
  ```bash
  npx ts-node scripts/import-customers.ts path/to/file.csv
  ```

- **`customers-template.csv`** - Template for customer CSV import

## Archived Scripts

Old scripts moved to `archived/` folder:
- `delete-import-entries.ts` - One-time deletion script
- `fix-credits-mapping.ts` - CSV credit mapping fix
- `reset-credits.ts` - Credit reset utility
- `import-from-csv.ts` - Legacy import script

## Usage Tips

1. Always backup your database before running destructive scripts
2. Run scripts from the backend root directory
3. Check script output for confirmation messages
4. Scripts use environment variables from `.env` file
