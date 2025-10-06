-- Backend Performance Optimization Indexes
-- Migration 009: Additional indexes for frequently-accessed queries in pairing_engine.js and procurement_engine.js
-- Created by Backend Specialist Worker Agent

-- Pairing Engine optimization: getAvailableWines() query
-- Query joins Stock -> Vintages -> Wines with WHERE clause on Stock.quantity and Stock.reserved_quantity
CREATE INDEX IF NOT EXISTS idx_stock_quantity_reserved ON Stock(quantity, reserved_quantity) 
    WHERE quantity > reserved_quantity;

-- Vintages quality_score ordering optimization
CREATE INDEX IF NOT EXISTS idx_vintages_quality_desc ON Vintages(quality_score DESC, id);

-- Procurement Engine optimization: identifyLowStock() query
-- Composite index for Stock aggregation with vintage_id grouping
CREATE INDEX IF NOT EXISTS idx_stock_vintage_available ON Stock(vintage_id, quantity, reserved_quantity);

-- Procurement opportunities query optimization
-- PriceBook filtering by availability_status and joining with Vintages
CREATE INDEX IF NOT EXISTS idx_pricebook_availability_vintage ON PriceBook(availability_status, vintage_id, supplier_id);

-- Vintages quality_score filtering for procurement
CREATE INDEX IF NOT EXISTS idx_vintages_quality_filter ON Vintages(quality_score, wine_id, id);

-- Suppliers active filtering
CREATE INDEX IF NOT EXISTS idx_suppliers_active_name ON Suppliers(active, name, id);

-- Ledger query optimization for system activity and recent transactions
CREATE INDEX IF NOT EXISTS idx_ledger_created_desc ON Ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_vintage_location_type ON Ledger(vintage_id, location, transaction_type);

-- Optimize sync queries with updated_at timestamp filtering
CREATE INDEX IF NOT EXISTS idx_wines_updated ON Wines(updated_at);
CREATE INDEX IF NOT EXISTS idx_vintages_updated ON Vintages(updated_at);
CREATE INDEX IF NOT EXISTS idx_stock_updated ON Stock(updated_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_updated ON Suppliers(updated_at);
CREATE INDEX IF NOT EXISTS idx_pricebook_updated ON PriceBook(updated_at);

-- Composite index for wine search by type and producer (frequently used in pairing)
CREATE INDEX IF NOT EXISTS idx_wines_type_producer_region ON Wines(wine_type, producer, region);

-- Index for vintage year lookups
CREATE INDEX IF NOT EXISTS idx_vintages_year ON Vintages(year, wine_id);

-- Performance monitoring: Count queries on key tables
CREATE INDEX IF NOT EXISTS idx_wines_id_count ON Wines(id);
CREATE INDEX IF NOT EXISTS idx_vintages_id_count ON Vintages(id);

-- Optimize JOIN operations between core tables
CREATE INDEX IF NOT EXISTS idx_vintages_wine_id_year ON Vintages(wine_id, year, quality_score);

-- PriceBook last_updated for market price tracking
CREATE INDEX IF NOT EXISTS idx_pricebook_updated_vintage ON PriceBook(last_updated DESC, vintage_id, supplier_id);
