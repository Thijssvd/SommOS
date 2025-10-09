# Events Entity - Charter & Occasion Tracking

## Overview

The Events entity provides explicit modeling of charter trips, special occasions, and yacht service events in SommOS. This enables comprehensive event-based analytics, improved recommendation collaborative filtering, and better consumption pattern analysis.

**Migration**: `007_events_entity.sql`  
**Date Added**: 2025-10-03  
**Status**: ✅ Active

---

## Table Structure

### Events Table

The `Events` table is the core entity for tracking yacht events:

```sql
CREATE TABLE Events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'charter',           -- Charter trip with external guests
        'private_use',       -- Yacht owner's private use
        'special_occasion',  -- Birthday, anniversary, celebration
        'regular_service'    -- Standard yacht operations
    )),
    event_name TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    guest_count INTEGER CHECK (guest_count >= 0),
    charter_company TEXT,
    primary_contact TEXT,
    location TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    created_by TEXT DEFAULT 'system'
);
```

### Foreign Key Relationships

The following tables now include an `event_id` column (nullable):

- **LearningPairingSessions** - Links pairing sessions to events
- **LearningPairingSessionsEnhanced** - Links ML-enhanced sessions to events
- **LearningPairingFeedback** - Associates feedback with events
- **LearningPairingFeedbackEnhanced** - Links granular feedback to events
- **LearningConsumptionEvents** - Tracks consumption during events
- **ExperimentEvents** - Links A/B testing to yacht events

All foreign keys use `ON DELETE SET NULL` to preserve data if an event is deleted.

---

## Analytical Views

### 1. EventConsumptionSummary

Aggregates wine consumption statistics by event:

```sql
SELECT * FROM EventConsumptionSummary WHERE event_id = 1;
```

**Columns**:

- `event_id`, `event_name`, `event_type`, `start_date`, `end_date`, `guest_count`
- `total_consumption_events` - Number of consumption records
- `unique_wines_consumed` - Count of distinct vintages
- `total_bottles_consumed` - Total bottles consumed (event_type='consume')
- `total_bottles_received` - Total bottles received (event_type='receive')
- `locations_used` - Comma-separated list of storage locations used
- `wine_types_consumed` - Comma-separated list of wine types consumed

**Example**:

```sql
-- Get consumption summary for all charter events this year
SELECT 
    event_name,
    guest_count,
    total_bottles_consumed,
    unique_wines_consumed,
    ROUND(CAST(total_bottles_consumed AS REAL) / guest_count, 2) as bottles_per_guest
FROM EventConsumptionSummary
WHERE event_type = 'charter'
  AND start_date >= date('now', 'start of year')
ORDER BY start_date DESC;
```

### 2. EventPairingSuccessRates

Calculates pairing recommendation success metrics:

```sql
SELECT * FROM EventPairingSuccessRates WHERE event_id = 1;
```

**Columns**:

- `event_id`, `event_name`, `event_type`, `start_date`, `end_date`
- `total_pairing_sessions` - Number of pairing sessions
- `total_feedback_entries` - Number of feedback records
- `avg_rating` - Average feedback rating (1-5 scale)
- `ai_generated_sessions` - Count of AI-enhanced pairings
- `traditional_sessions` - Count of traditional sommelier pairings
- `ai_avg_rating` - Average rating for AI pairings
- `traditional_avg_rating` - Average rating for traditional pairings
- `selected_recommendations` - Number of recommendations actually selected
- `selection_rate` - Percentage of recommendations selected

**Example**:

```sql
-- Compare AI vs traditional pairing success by event type
SELECT 
    event_type,
    COUNT(DISTINCT event_id) as event_count,
    AVG(ai_avg_rating) as avg_ai_rating,
    AVG(traditional_avg_rating) as avg_traditional_rating,
    AVG(selection_rate) * 100 as avg_selection_rate_pct
FROM EventPairingSuccessRates
GROUP BY event_type
HAVING event_count > 0;
```

### 3. EventWinePreferences

Identifies wine preferences by event type for collaborative filtering:

```sql
SELECT * FROM EventWinePreferences WHERE event_type = 'charter' LIMIT 10;
```

**Columns**:

- `event_type`, `event_name`, `wine_type`, `region`, `country`
- `consumption_count` - Number of consumption events
- `total_bottles` - Total bottles consumed
- `avg_feedback_rating` - Average pairing feedback rating
- `events_with_wine` - Number of events featuring this wine
- `avg_bottles_per_event` - Average consumption per event

**Example**:

```sql
-- Find top wine preferences for charter events
SELECT 
    wine_type,
    region,
    country,
    SUM(total_bottles) as total_consumed,
    AVG(avg_feedback_rating) as avg_rating,
    COUNT(DISTINCT event_name) as events_count
FROM EventWinePreferences
WHERE event_type = 'charter'
GROUP BY wine_type, region, country
ORDER BY total_consumed DESC
LIMIT 20;
```

### 4. EventOverview

Comprehensive event summary combining all metrics:

```sql
SELECT * FROM EventOverview ORDER BY start_date DESC LIMIT 10;
```

**Columns**: All event details plus:

- `bottles_consumed`, `unique_wines`, `pairing_sessions`
- `avg_pairing_rating`, `recommendation_selection_rate`
- `duration_days`, `bottles_per_guest`

**Example**:

```sql
-- Get overview of recent high-consumption events
SELECT 
    event_name,
    event_type,
    guest_count,
    bottles_consumed,
    bottles_per_guest,
    avg_pairing_rating,
    duration_days
FROM EventOverview
WHERE start_date >= date('now', '-90 days')
  AND bottles_consumed > 0
ORDER BY bottles_consumed DESC;
```

---

## Usage Examples

### 1. Creating a Charter Event

```javascript
// In your API or service layer
async function createCharterEvent(eventData) {
    const db = Database.getInstance();
    
    const result = await db.run(`
        INSERT INTO Events (
            event_type, event_name, start_date, end_date,
            guest_count, charter_company, primary_contact,
            location, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        'charter',
        eventData.name,
        eventData.startDate,
        eventData.endDate,
        eventData.guestCount,
        eventData.charterCompany,
        eventData.contact,
        eventData.itinerary,
        eventData.notes,
        eventData.userId
    ]);
    
    return result.lastID;
}
```

### 2. Linking Consumption to an Event

```javascript
// When recording wine consumption
async function recordConsumption(consumptionData) {
    const db = Database.getInstance();
    
    await db.run(`
        INSERT INTO LearningConsumptionEvents (
            vintage_id, wine_id, wine_type, quantity,
            location, event_type, event_id, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        consumptionData.vintageId,
        consumptionData.wineId,
        consumptionData.wineType,
        consumptionData.quantity,
        consumptionData.location,
        'consume',
        consumptionData.eventId,  // Link to event
        JSON.stringify(consumptionData.metadata)
    ]);
}
```

### 3. Event-Based Collaborative Filtering

```javascript
// Find similar events and recommend wines
async function getRecommendationsFromSimilarEvents(currentEventId) {
    const db = Database.getInstance();
    
    // Get current event details
    const currentEvent = await db.get(
        'SELECT event_type, guest_count FROM Events WHERE id = ?',
        [currentEventId]
    );
    
    // Find wines popular in similar events
    const recommendations = await db.all(`
        SELECT 
            wine_type,
            region,
            country,
            AVG(avg_feedback_rating) as avg_rating,
            SUM(total_bottles) as popularity
        FROM EventWinePreferences
        WHERE event_type = ?
          AND events_with_wine >= 2
        GROUP BY wine_type, region, country
        ORDER BY avg_rating DESC, popularity DESC
        LIMIT 10
    `, [currentEvent.event_type]);
    
    return recommendations;
}
```

### 4. Event Performance Analytics

```javascript
// Analyze charter performance over time
async function getCharterPerformanceReport(startDate, endDate) {
    const db = Database.getInstance();
    
    return await db.all(`
        SELECT 
            strftime('%Y-%m', start_date) as month,
            COUNT(*) as charter_count,
            SUM(guest_count) as total_guests,
            AVG(bottles_per_guest) as avg_bottles_per_guest,
            AVG(avg_pairing_rating) as avg_satisfaction,
            SUM(bottles_consumed) as total_consumed
        FROM EventOverview
        WHERE event_type = 'charter'
          AND start_date BETWEEN ? AND ?
        GROUP BY strftime('%Y-%m', start_date)
        ORDER BY month DESC
    `, [startDate, endDate]);
}
```

### 5. Linking Pairing Sessions to Events

```javascript
// When generating pairings for an event
async function generateEventPairings(eventId, dishDescription, preferences) {
    const pairingEngine = new PairingEngine(db);
    
    // Generate pairings
    const pairings = await pairingEngine.generatePairings(
        dishDescription,
        { ...preferences, eventId },  // Include eventId in context
        preferences
    );
    
    // Update session with event_id
    if (pairings.recommendations?.[0]?.learning_session_id) {
        await db.run(
            'UPDATE LearningPairingSessions SET event_id = ? WHERE id = ?',
            [eventId, pairings.recommendations[0].learning_session_id]
        );
    }
    
    return pairings;
}
```

---

## Database Indexes

Performance indexes are automatically created for common query patterns:

- `idx_events_type` - Filter by event type
- `idx_events_dates` - Date range queries
- `idx_events_created` - Recent events queries
- `idx_events_guest_count` - Guest count filtering
- `idx_learning_*_event` - Foreign key join performance

---

## Migration Compatibility

The migration is **backward compatible**:

- All `event_id` columns are **nullable**
- Existing data is not affected
- Foreign keys use `ON DELETE SET NULL`
- Views handle NULL event_id gracefully

---

## Future Enhancements

Potential future improvements to the Events system:

1. **Event Templates**: Pre-configured event types with default wine selections
2. **Event Budget Tracking**: Link procurement and consumption to event budgets
3. **Guest Profiles**: Individual guest preferences linked to events
4. **Event Series**: Group related events (e.g., "Summer 2025 Charter Season")
5. **Automated Event Detection**: ML-based event boundary detection from consumption patterns
6. **Event Comparison Tool**: Compare similar events for performance benchmarking

---

## API Endpoint Recommendations

Consider adding these API endpoints to expose event functionality:

### Events Management

- `POST /api/events` - Create new event
- `GET /api/events` - List all events (with filters)
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Event Analytics

- `GET /api/events/:id/consumption` - Event consumption summary
- `GET /api/events/:id/pairings` - Event pairing success metrics
- `GET /api/events/:id/preferences` - Event wine preferences
- `GET /api/events/:id/overview` - Comprehensive event overview

### Event-Based Recommendations

- `GET /api/events/:id/recommendations` - Get wine recommendations based on similar events
- `POST /api/events/:id/pairings` - Generate pairings for specific event
- `GET /api/events/analytics/performance` - Charter performance report
- `GET /api/events/analytics/trends` - Event consumption trends

---

## Example Queries

### Query 1: Best Performing Charter Destinations

```sql
SELECT 
    location,
    COUNT(*) as visit_count,
    AVG(avg_pairing_rating) as avg_satisfaction,
    AVG(bottles_per_guest) as avg_consumption,
    SUM(bottles_consumed) as total_bottles
FROM EventOverview
WHERE event_type = 'charter'
  AND location IS NOT NULL
GROUP BY location
HAVING visit_count >= 2
ORDER BY avg_satisfaction DESC, visit_count DESC;
```

### Query 2: Seasonal Wine Preferences

```sql
SELECT 
    CASE strftime('%m', e.start_date)
        WHEN '12' THEN 'Winter'
        WHEN '01' THEN 'Winter'
        WHEN '02' THEN 'Winter'
        WHEN '03' THEN 'Spring'
        WHEN '04' THEN 'Spring'
        WHEN '05' THEN 'Spring'
        WHEN '06' THEN 'Summer'
        WHEN '07' THEN 'Summer'
        WHEN '08' THEN 'Summer'
        WHEN '09' THEN 'Fall'
        WHEN '10' THEN 'Fall'
        WHEN '11' THEN 'Fall'
    END as season,
    ewp.wine_type,
    SUM(ewp.total_bottles) as bottles_consumed,
    AVG(ewp.avg_feedback_rating) as avg_rating
FROM Events e
JOIN EventWinePreferences ewp ON e.event_type = ewp.event_type
WHERE e.event_type = 'charter'
GROUP BY season, ewp.wine_type
ORDER BY season, bottles_consumed DESC;
```

### Query 3: Charter Company Performance

```sql
SELECT 
    charter_company,
    COUNT(*) as charter_count,
    SUM(guest_count) as total_guests,
    AVG(bottles_per_guest) as avg_bottles_per_guest,
    AVG(avg_pairing_rating) as avg_satisfaction,
    AVG(duration_days) as avg_duration
FROM EventOverview
WHERE event_type = 'charter'
  AND charter_company IS NOT NULL
GROUP BY charter_company
HAVING charter_count >= 2
ORDER BY avg_satisfaction DESC, charter_count DESC;
```

---

## Related Files

- Migration: `/backend/database/migrations/007_events_entity.sql`
- Schema: `/backend/database/schema.sql`
- Learning Engine: `/backend/core/learning_engine.js`
- Enhanced Learning: `/backend/core/enhanced_learning_engine.js`
- Pairing Engine: `/backend/core/pairing_engine.js`

---

## Support

For questions or issues with the Events entity feature:

1. Check existing event data: `SELECT * FROM Events LIMIT 10;`
2. Verify views are working: `SELECT * FROM EventOverview LIMIT 5;`
3. Check foreign key relationships are properly linked
4. Review migration status: `npm run migrate:status`

---

**Last Updated**: 2025-10-03  
**Migration Version**: 007_events_entity.sql  
**Database Version**: SQLite 3.x
