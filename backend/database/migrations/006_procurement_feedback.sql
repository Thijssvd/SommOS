-- Procurement Feedback System Migration
-- Adds support for tracking procurement recommendation outcomes and learning from feedback

-- Add procurement feedback fields to InventoryIntakeOrders
-- Note: SQLite doesn't support adding foreign keys via ALTER TABLE,
-- so we'll add the columns and create indexes separately

-- Add recommendation tracking columns
ALTER TABLE InventoryIntakeOrders ADD COLUMN recommendation_id INTEGER;
ALTER TABLE InventoryIntakeOrders ADD COLUMN followed_recommendation INTEGER DEFAULT 0 CHECK (followed_recommendation IN (0, 1));
ALTER TABLE InventoryIntakeOrders ADD COLUMN procurement_notes TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_intake_orders_recommendation_id ON InventoryIntakeOrders(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_intake_orders_followed ON InventoryIntakeOrders(followed_recommendation);

-- Note: The foreign key relationship to Explainability table is enforced at application level
-- since SQLite doesn't support adding foreign keys to existing tables without recreating the table
