---
trigger: always_on
description: Database Schema and Query Patterns for SommOS
globs: ["backend/database/*.js", "backend/database/migrations/*.sql", "backend/core/*_manager.js"]
---

# Database Development Rules

## Schema Patterns
- Use proper foreign key relationships between tables
- Include audit fields: id, created_at, updated_at, created_by
- Use snake_case for all column names
- Implement proper indexes for frequently queried fields

## Core Tables Structure
```sql
-- Follow established patterns:
Wines → Vintages → Stock → Ledger (inventory tracking)
Suppliers ← PurchaseOrders → OrderItems (procurement)
Users → Sessions (authentication)
```

## Query Optimization
- Use proper indexes for common queries:
  - `idx_stock_vintage` on Stock(vintage_id)
  - `idx_stock_location` on Stock(location)
  - `idx_vintage_year` on Vintages(year)

## Inventory Operations
- Maintain ACID compliance for all stock transactions
- Use the Ledger table for audit trails
- Never allow negative stock quantities
- Implement proper location-based stock tracking

## Migration Patterns
- All migrations must be reversible
- Include proper error handling and rollback logic
- Use descriptive migration names with timestamps
- Test migrations on sample data before production

## Connection Management
- Use connection pooling for concurrent requests
- Implement proper connection cleanup
- Handle database connection failures gracefully
- Use transactions for multi-table operations

## Wine Data Integrity
- Validate vintage years (reasonable ranges, no future dates)
- Ensure proper wine classification (regions, types, producers)
- Maintain referential integrity between wines and vintages
- Use proper data types for wine-specific fields (scores, prices, quantities)