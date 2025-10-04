-- Events Entity Migration
-- Migration: 005_events_entity.sql
-- Purpose: Add Events table to explicitly model charter trips, special occasions, and yacht events
-- Author: SommOS Development Team
-- Date: 2025-10-03
--
-- This migration introduces event-based grouping for pairing sessions, feedback, and consumption
-- data, enabling better analytics and collaborative filtering across similar events.
--
-- Changes:
-- 1. Creates Events table with event type, date range, guest count, and event metadata
-- 2. Adds event_id foreign key to learning and consumption tables
-- 3. Creates indexes for event-based queries
-- 4. Creates analytical views for event consumption, pairing success, and wine preferences
--
-- SQLite Limitations:
-- - ALTER TABLE does not support IF NOT EXISTS for columns
-- - Migration runner handles duplicate column errors gracefully
--

-- ============================================================================
-- SECTION 1: Events Table Creation
-- ============================================================================

-- Events table: Core event tracking for charters, special occasions, and regular service
CREATE TABLE IF NOT EXISTS Events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Event classification
    event_type TEXT NOT NULL CHECK (event_type IN (
        'charter',           -- Charter trip with external guests
        'private_use',       -- Yacht owner's private use
        'special_occasion',  -- Birthday, anniversary, celebration
        'regular_service'    -- Standard yacht operations
    )),
    
    -- Event identification and timing
    event_name TEXT,                           -- Descriptive name (e.g., "Smith Family Charter Week")
    start_date DATETIME NOT NULL,              -- Event start timestamp
    end_date DATETIME,                         -- Event end timestamp (null if ongoing)
    
    -- Event details
    guest_count INTEGER CHECK (guest_count >= 0),  -- Number of guests on board
    charter_company TEXT,                      -- Charter company name (for charter events)
    primary_contact TEXT,                      -- Primary contact person for the event
    location TEXT,                             -- Location/itinerary information
    notes TEXT,                                -- Additional event details and special requests
    
    -- Audit fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    created_by TEXT DEFAULT 'system'
);

-- ============================================================================
-- SECTION 2: Foreign Key Additions to Existing Tables
-- ============================================================================

-- Add event_id to LearningPairingSessions
-- Links pairing sessions to specific events for event-based recommendation analysis
ALTER TABLE LearningPairingSessions 
ADD COLUMN event_id INTEGER REFERENCES Events(id) ON DELETE SET NULL;

-- Add event_id to LearningPairingSessionsEnhanced
-- Links enhanced pairing sessions (with ML features) to events
ALTER TABLE LearningPairingSessionsEnhanced 
ADD COLUMN event_id INTEGER REFERENCES Events(id) ON DELETE SET NULL;

-- Add event_id to LearningPairingFeedback
-- Associates basic feedback with events for event-specific learning
ALTER TABLE LearningPairingFeedback 
ADD COLUMN event_id INTEGER REFERENCES Events(id) ON DELETE SET NULL;

-- Add event_id to LearningPairingFeedbackEnhanced
-- Associates granular feedback (flavor harmony, texture balance, etc.) with events
ALTER TABLE LearningPairingFeedbackEnhanced 
ADD COLUMN event_id INTEGER REFERENCES Events(id) ON DELETE SET NULL;

-- Add event_id to LearningConsumptionEvents
-- Tracks which wines were consumed during specific events
ALTER TABLE LearningConsumptionEvents 
ADD COLUMN event_id INTEGER REFERENCES Events(id) ON DELETE SET NULL;

-- Add event_id to ExperimentEvents
-- Links A/B testing events to yacht events for contextual experiment analysis
ALTER TABLE ExperimentEvents 
ADD COLUMN event_id INTEGER REFERENCES Events(id) ON DELETE SET NULL;

-- ============================================================================
-- SECTION 3: Performance Indexes
-- ============================================================================

-- Index on Events table
CREATE INDEX IF NOT EXISTS idx_events_type ON Events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_dates ON Events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_created ON Events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_guest_count ON Events(guest_count);

-- Indexes on foreign key columns for efficient joins
CREATE INDEX IF NOT EXISTS idx_learning_pairing_sessions_event 
ON LearningPairingSessions(event_id);

CREATE INDEX IF NOT EXISTS idx_learning_pairing_sessions_enhanced_event 
ON LearningPairingSessionsEnhanced(event_id);

CREATE INDEX IF NOT EXISTS idx_learning_pairing_feedback_event 
ON LearningPairingFeedback(event_id);

CREATE INDEX IF NOT EXISTS idx_learning_pairing_feedback_enhanced_event 
ON LearningPairingFeedbackEnhanced(event_id);

CREATE INDEX IF NOT EXISTS idx_learning_consumption_events_event 
ON LearningConsumptionEvents(event_id);

CREATE INDEX IF NOT EXISTS idx_experiment_events_event 
ON ExperimentEvents(event_id);

-- ============================================================================
-- SECTION 4: Analytical Views
-- ============================================================================

-- EventConsumptionSummary View
-- Aggregates wine consumption statistics by event for inventory planning and analysis
CREATE VIEW IF NOT EXISTS EventConsumptionSummary AS
SELECT 
    e.id as event_id,
    e.event_name,
    e.event_type,
    e.start_date,
    e.end_date,
    e.guest_count,
    COUNT(DISTINCT lce.id) as total_consumption_events,
    COUNT(DISTINCT lce.vintage_id) as unique_wines_consumed,
    SUM(CASE WHEN lce.event_type = 'consume' THEN lce.quantity ELSE 0 END) as total_bottles_consumed,
    SUM(CASE WHEN lce.event_type = 'receive' THEN lce.quantity ELSE 0 END) as total_bottles_received,
    GROUP_CONCAT(DISTINCT lce.location) as locations_used,
    GROUP_CONCAT(DISTINCT lce.wine_type) as wine_types_consumed
FROM Events e
LEFT JOIN LearningConsumptionEvents lce ON e.id = lce.event_id
GROUP BY e.id, e.event_name, e.event_type, e.start_date, e.end_date, e.guest_count;

-- EventPairingSuccessRates View
-- Calculates pairing success metrics and AI vs traditional comparison by event
CREATE VIEW IF NOT EXISTS EventPairingSuccessRates AS
SELECT 
    e.id as event_id,
    e.event_name,
    e.event_type,
    e.start_date,
    e.end_date,
    COUNT(DISTINCT lps.id) as total_pairing_sessions,
    COUNT(DISTINCT lpf.id) as total_feedback_entries,
    AVG(lpf.rating) as avg_rating,
    COUNT(CASE WHEN lps.generated_by_ai = 1 THEN 1 END) as ai_generated_sessions,
    COUNT(CASE WHEN lps.generated_by_ai = 0 THEN 1 END) as traditional_sessions,
    AVG(CASE WHEN lps.generated_by_ai = 1 THEN lpf.rating END) as ai_avg_rating,
    AVG(CASE WHEN lps.generated_by_ai = 0 THEN lpf.rating END) as traditional_avg_rating,
    COUNT(CASE WHEN lpf.selected = 1 THEN 1 END) as selected_recommendations,
    CAST(COUNT(CASE WHEN lpf.selected = 1 THEN 1 END) AS REAL) / 
        NULLIF(COUNT(lpf.id), 0) as selection_rate
FROM Events e
LEFT JOIN LearningPairingSessions lps ON e.id = lps.event_id
LEFT JOIN LearningPairingFeedback lpf ON lps.id = lpf.recommendation_id
GROUP BY e.id, e.event_name, e.event_type, e.start_date, e.end_date;

-- EventWinePreferences View
-- Identifies wine preferences by event type for collaborative filtering and recommendations
CREATE VIEW IF NOT EXISTS EventWinePreferences AS
SELECT 
    e.event_type,
    e.event_name,
    lce.wine_type,
    w.region,
    w.country,
    COUNT(DISTINCT lce.id) as consumption_count,
    SUM(lce.quantity) as total_bottles,
    AVG(lpf.rating) as avg_feedback_rating,
    COUNT(DISTINCT e.id) as events_with_wine,
    CAST(SUM(lce.quantity) AS REAL) / NULLIF(COUNT(DISTINCT e.id), 0) as avg_bottles_per_event
FROM Events e
LEFT JOIN LearningConsumptionEvents lce ON e.id = lce.event_id
LEFT JOIN Vintages v ON lce.vintage_id = v.id
LEFT JOIN Wines w ON v.wine_id = w.id
LEFT JOIN LearningPairingRecommendations lpr ON w.id = lpr.wine_id
LEFT JOIN LearningPairingFeedback lpf ON lpr.id = lpf.recommendation_id
WHERE lce.event_type = 'consume'
GROUP BY e.event_type, e.event_name, lce.wine_type, w.region, w.country
HAVING consumption_count > 0
ORDER BY e.event_type, consumption_count DESC;

-- EventOverview View
-- Comprehensive event summary combining consumption, pairings, and feedback
CREATE VIEW IF NOT EXISTS EventOverview AS
SELECT 
    e.id as event_id,
    e.event_type,
    e.event_name,
    e.start_date,
    e.end_date,
    e.guest_count,
    e.location,
    e.charter_company,
    -- Consumption metrics
    COALESCE(ecs.total_bottles_consumed, 0) as bottles_consumed,
    COALESCE(ecs.unique_wines_consumed, 0) as unique_wines,
    -- Pairing metrics
    COALESCE(eps.total_pairing_sessions, 0) as pairing_sessions,
    COALESCE(eps.avg_rating, 0) as avg_pairing_rating,
    COALESCE(eps.selection_rate, 0) as recommendation_selection_rate,
    -- Timing
    JULIANDAY(COALESCE(e.end_date, CURRENT_TIMESTAMP)) - JULIANDAY(e.start_date) as duration_days,
    -- Derived metrics
    CASE 
        WHEN e.guest_count > 0 AND COALESCE(ecs.total_bottles_consumed, 0) > 0 
        THEN CAST(ecs.total_bottles_consumed AS REAL) / e.guest_count 
        ELSE 0 
    END as bottles_per_guest,
    e.created_at,
    e.updated_at
FROM Events e
LEFT JOIN EventConsumptionSummary ecs ON e.id = ecs.event_id
LEFT JOIN EventPairingSuccessRates eps ON e.id = eps.event_id;

-- ============================================================================
-- SECTION 5: Rollback Instructions (Commented for Safety)
-- ============================================================================
--
-- To rollback this migration, execute the following statements:
--
-- DROP VIEW IF EXISTS EventOverview;
-- DROP VIEW IF EXISTS EventWinePreferences;
-- DROP VIEW IF EXISTS EventPairingSuccessRates;
-- DROP VIEW IF EXISTS EventConsumptionSummary;
--
-- DROP INDEX IF EXISTS idx_experiment_events_event;
-- DROP INDEX IF EXISTS idx_learning_consumption_events_event;
-- DROP INDEX IF EXISTS idx_learning_pairing_feedback_enhanced_event;
-- DROP INDEX IF EXISTS idx_learning_pairing_feedback_event;
-- DROP INDEX IF EXISTS idx_learning_pairing_sessions_enhanced_event;
-- DROP INDEX IF EXISTS idx_learning_pairing_sessions_event;
-- DROP INDEX IF EXISTS idx_events_guest_count;
-- DROP INDEX IF EXISTS idx_events_created;
-- DROP INDEX IF EXISTS idx_events_dates;
-- DROP INDEX IF EXISTS idx_events_type;
--
-- Note: SQLite does not support DROP COLUMN, so event_id columns cannot be easily removed.
-- Consider using a database recreation strategy if full rollback is required.
--
-- DROP TABLE IF EXISTS Events;
--
-- DELETE FROM migrations WHERE filename = '005_events_entity.sql';
--
-- ============================================================================
