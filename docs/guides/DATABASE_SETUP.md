# Database Setup & Maintenance Guide

## Overview

The SommOS database should contain exactly **994 unique wines** from `example_cellar.csv` with **2000 entries** (some wines appear in multiple locations).

## Quick Setup

### Clean Database Setup (Recommended for E2E Tests)

```bash
npm run setup:db:clean
```

This command will:
1. **Delete** the existing database (if any)
2. **Create** a fresh database with schema
3. **Run** all migrations
4. **Seed** lookup data, users, and wines from `example_cellar.csv`
5. **Add** guest event codes for E2E tests (`YACHT2025`, `VIP2025`)

### Manual Setup (Step by Step)

```bash
# 1. Remove old database
rm -f ./data/sommos.db

# 2. Create schema
npm run setup:db

# 3. Run migrations
npm run migrate

# 4. Seed data
npm run seed

# 5. Add guest codes for E2E tests
npm run seed:guests
```

## Verification

Check your database has the correct data:

```bash
# Count wines (should be 994)
sqlite3 ./data/sommos.db "SELECT COUNT(*) FROM Wines;"

# Count vintages (should be 994)
sqlite3 ./data/sommos.db "SELECT COUNT(*) FROM Vintages;"

# Count stock records (should be ~1834)
sqlite3 ./data/sommos.db "SELECT COUNT(*) FROM Stock;"

# Check guest codes
sqlite3 ./data/sommos.db "SELECT email, role FROM Invites WHERE role = 'guest';"
```

Expected output:
```
Wines: 994
Vintages: 994
Stock: ~1834
Guest codes: 2 (guest-yacht@sommos.local, guest-vip@sommos.local)
```

## Issue: Duplicate Wines

### Problem

The database had **4,970 wine records** instead of **994** due to:
- Running seed scripts multiple times
- The seed script using `INSERT OR IGNORE` which reuses existing records but doesn't clean old ones
- Different variations of the same wine being inserted with slightly different data

### Solution

Always use `npm run setup:db:clean` to ensure a fresh database. This command:
- ✅ Removes all old data
- ✅ Creates a clean slate
- ✅ Ensures exactly 994 wines from CSV
- ✅ Sets up guest codes for testing

### Prevention

1. **For Testing**: Always run `npm run setup:db:clean` before E2E tests
2. **For Development**: Use `npm run setup:db:clean` when you need to reset the database
3. **Never** run `npm run seed` multiple times without cleaning first
4. **Check** wine count after seeding: `sqlite3 ./data/sommos.db "SELECT COUNT(*) FROM Wines;"`

## Guest Event Codes

The E2E tests require these guest event codes:

| Event Code | PIN | Email | Purpose |
|------------|-----|-------|---------|
| `YACHT2025` | None | guest-yacht@sommos.local | Guest login without PIN |
| `VIP2025` | `123456` | guest-vip@sommos.local | Guest login with PIN |

These are automatically created by:
- `npm run setup:db:clean`
- `npm run seed:guests`

## Database Location

- **Development**: `./data/sommos.db` (relative to project root)
- **Production**: `/opt/sommos/data/sommos.db` (configured in `.env`)
- **Test**: `:memory:` (in-memory database for Jest tests)

## Environment Configuration

Ensure your `.env` file has:

```env
NODE_ENV=development
PORT=3001
DATABASE_PATH=./data/sommos.db
```

**Never use production settings** (`NODE_ENV=production` or production database path) for local development or testing!

## Troubleshooting

### "Too many wines in database"

```bash
# Check count
sqlite3 ./data/sommos.db "SELECT COUNT(*) FROM Wines;"

# If not 994, clean and reset
npm run setup:db:clean
```

### "Guest codes not working"

```bash
# Re-add guest codes
npm run seed:guests

# Verify they exist
sqlite3 ./data/sommos.db "SELECT email FROM Invites WHERE role = 'guest';"
```

### "Database tables missing"

```bash
# Run migrations
npm run migrate

# If still broken, full clean
npm run setup:db:clean
```

## Database Schema

The database includes:
- **Core Tables**: Wines, Vintages, Stock, Ledger
- **Auth Tables**: Users, Roles, RefreshTokens, Invites
- **Learning Tables**: Memories, LearningPairingFeedback, etc.
- **Intelligence Tables**: WeatherVintage, GrapeProfiles, etc.

All tables are created by `setup.js` and enhanced by migrations.
