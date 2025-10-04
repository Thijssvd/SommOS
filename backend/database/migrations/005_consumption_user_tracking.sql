-- Migration: Add User Tracking to Consumption Events
-- Purpose: Link consumption events to specific users and sessions for collaborative filtering
-- and implicit feedback in recommendation systems

-- Add user_id column to track which user consumed the wine
-- NULL for anonymous consumption (e.g., guest charterers without individual accounts)
ALTER TABLE LearningConsumptionEvents 
ADD COLUMN user_id TEXT;

-- Add session_id column to link consumption to a pairing session
-- NULL for consumption not associated with a pairing session
ALTER TABLE LearningConsumptionEvents 
ADD COLUMN session_id INTEGER;

-- Create indexes for efficient querying by user and session
CREATE INDEX IF NOT EXISTS idx_learning_consumption_user_id 
ON LearningConsumptionEvents(user_id);

CREATE INDEX IF NOT EXISTS idx_learning_consumption_session_id 
ON LearningConsumptionEvents(session_id);

-- Create compound index for user-based consumption patterns over time
CREATE INDEX IF NOT EXISTS idx_learning_consumption_user_created 
ON LearningConsumptionEvents(user_id, created_at DESC);

-- Note: SQLite doesn't support adding foreign key constraints to existing tables
-- Foreign key validation will be handled at the application level:
--   - user_id should reference Users.id (but can be NULL)
--   - session_id should reference LearningPairingSessions.id (but can be NULL)
