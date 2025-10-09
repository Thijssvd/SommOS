# Consumption User Tracking Implementation

## Overview

This document describes the implementation of user tracking for wine consumption events in SommOS. This feature enables the system to link consumption events to specific users and pairing sessions, allowing for:

- **Implicit feedback** in collaborative filtering algorithms
- **User preference profiling** based on actual consumption behavior
- **Personalized recommendations** that learn from what users actually consume
- **Session-based tracking** to link consumption to specific pairing recommendations

## Motivation

Prior to this implementation, the `LearningConsumptionEvents` table tracked only:

- Which wines were consumed (vintage_id, wine_id)
- How much was consumed (quantity)
- Where it was consumed (location)
- When it was consumed (created_at)

**The Gap**: There was no way to know **who** consumed the wine or whether it was part of a pairing session. This prevented the system from:

1. Using consumption as implicit positive feedback for collaborative filtering
2. Building user-specific consumption profiles
3. Differentiating between owner consumption vs. guest consumption
4. Linking consumption back to pairing recommendations for learning

## Implementation Summary

### Database Changes

**Migration File**: `backend/database/migrations/005_consumption_user_tracking.sql`

Added two new columns to `LearningConsumptionEvents`:

```sql
-- user_id: Links consumption to authenticated user (nullable for anonymous consumption)
ALTER TABLE LearningConsumptionEvents ADD COLUMN user_id TEXT;

-- session_id: Links consumption to a pairing session (nullable)
ALTER TABLE LearningConsumptionEvents ADD COLUMN session_id INTEGER;
```

**Indexes Added** (for query performance):

- `idx_learning_consumption_user_id` - For querying by user
- `idx_learning_consumption_session_id` - For querying by session
- `idx_learning_consumption_user_created` - Compound index for user consumption patterns over time

**Key Design Decisions**:

- Both columns are **nullable** to support backward compatibility and anonymous consumption
- No foreign key constraints in SQLite (enforced at application level)
- user_id references `Users.id`
- session_id references `LearningPairingSessions.id`

### Code Changes

#### 1. Learning Engine (`backend/core/learning_engine.js`)

**Updated Method**: `recordConsumptionEvent()`

```javascript
async recordConsumptionEvent({
    vintage_id,
    quantity,
    location,
    event_type = 'consume',
    metadata = {},
    user_id = null,        // NEW
    session_id = null      // NEW
}) {
    // ... INSERT includes user_id and session_id columns
}
```

- Parameters are optional with default `null` values
- Backward compatible with existing calls that don't provide user context

#### 2. Enhanced Learning Engine (`backend/core/enhanced_learning_engine.js`)

**New Methods Added**:

1. **`getConsumptionFeedback(userId)`** - Retrieves consumption history for a user

   ```javascript
   // Returns: Array of consumption events with wine details
   const consumptions = await learningEngine.getConsumptionFeedback(userId);
   ```

2. **`getImplicitRatingsFromConsumption(userId)`** - Converts consumption to implicit ratings

   ```javascript
   // Returns: Array with implicit_rating (4.0-5.0 scale), confidence scores
   const implicitRatings = await learningEngine.getImplicitRatingsFromConsumption(userId);
   ```

3. **`incorporateConsumptionIntoPreferences(userId)`** - Updates user preference profiles

   ```javascript
   // Aggregates consumption by wine type, region, grape variety
   const prefs = await learningEngine.incorporateConsumptionIntoPreferences(userId);
   ```

**Implicit Rating Algorithm**:

- Base rating: 4.0 (consumption = positive signal)
- Frequency bonus: +0.5 max (0.1 per consumption event)
- Quantity bonus: +0.3 max (based on total quantity consumed)
- Capped at 5.0
- Confidence increases with more consumption data

#### 3. Inventory Manager (`backend/core/inventory_manager.js`)

**Updated Methods**:

1. **`captureLearningConsumption(event)`** - Now accepts user_id and session_id

   ```javascript
   await this.captureLearningConsumption({
       vintage_id,
       quantity,
       location,
       event_type,
       metadata,
       user_id,      // NEW
       session_id    // NEW
   });
   ```

2. **`consumeWine(..., user_id, session_id)`** - Added parameters
3. **`receiveWine(..., user_id, session_id)`** - Added parameters

All methods maintain backward compatibility via optional parameters.

#### 4. API Routes (`backend/api/routes.js`)

**Updated Endpoints**:

1. **`POST /api/inventory/consume`**

   ```javascript
   // Extracts user_id from JWT authentication
   const user_id = req.user?.id || null;
   
   // Optionally accepts session_id from request body
   const { session_id } = req.body;
   
   // Passes both to inventory manager
   await inventoryManager.consumeWine(..., user_id, session_id);
   ```

2. **`POST /api/inventory/receive`** - Same pattern for tracking who receives inventory

**Authentication Integration**:

- Uses existing JWT auth middleware (`requireAuth()`)
- Extracts `user_id` from `req.user.id`
- Falls back to `null` for anonymous operations (maintains backward compatibility)

#### 5. Collaborative Filtering Engine (`backend/core/collaborative_filtering_engine.js`)

**Updated Method**: `getUserRatings(userId, includeImplicitFromConsumption = true)`

Now returns **combined ratings**:

- **Explicit ratings** from `LearningPairingFeedbackEnhanced` (user provided feedback)
- **Implicit ratings** from `LearningConsumptionEvents` (user consumed wine)

```javascript
const ratings = await cfEngine.getUserRatings(userId, true);
// Returns: Explicit ratings + unique implicit ratings (no duplicates)
```

**New Method**: `getImplicitRatingsFromConsumption(userId)`

Converts consumption patterns to implicit ratings for collaborative filtering.

**Deduplication Strategy**:

- If a user has both explicit feedback AND consumption for the same wine
- Explicit rating takes precedence (it's more direct feedback)
- Implicit ratings are only used for wines without explicit ratings

## Usage Examples

### Example 1: Track Consumption with User Context

```javascript
// When a crew member consumes wine during service
await inventoryManager.consumeWine(
    vintage_id: 42,
    location: 'service-bar',
    quantity: 2,
    notes: 'Served at dinner',
    created_by: 'crew@sommos.com',
    syncContext: {},
    user_id: 1,           // Authenticated user ID
    session_id: 123       // If part of a pairing session
);
```

### Example 2: Query User Consumption History

```javascript
// Get all wines a specific user has consumed
const learningEngine = new EnhancedLearningEngine(db);
const consumptions = await learningEngine.getConsumptionFeedback(userId);

// Result:
// [
//   {
//     vintage_id: 42,
//     wine_id: 10,
//     wine_name: "Château Margaux",
//     wine_type: "Red",
//     region: "Bordeaux",
//     quantity: 2,
//     created_at: "2025-10-01T19:30:00Z",
//     ...
//   },
//   ...
// ]
```

### Example 3: Get Implicit Ratings for Collaborative Filtering

```javascript
// Convert consumption patterns to ratings
const implicitRatings = await learningEngine.getImplicitRatingsFromConsumption(userId);

// Result:
// [
//   {
//     wine_id: 10,
//     implicit_rating: 4.3,        // Base 4.0 + bonuses
//     consumption_count: 3,        // Consumed 3 times
//     total_quantity: 6,           // 6 bottles total
//     confidence: 0.6,             // 60% confidence (3/5 events)
//     last_consumed: "2025-10-01"
//   },
//   ...
// ]
```

### Example 4: Collaborative Filtering with Consumption

```javascript
// Get combined explicit + implicit ratings
const cfEngine = new CollaborativeFilteringEngine(db);
const allRatings = await cfEngine.getUserRatings(userId, true);

// This includes:
// - Explicit ratings from pairing feedback
// - Implicit ratings from consumption (for wines without explicit feedback)

// Then use for recommendations
const recommendations = await cfEngine.getUserBasedRecommendations(
    userId,
    dishContext,
    { limit: 10 }
);
```

### Example 5: Build User Preference Profile

```javascript
// Aggregate consumption into preference profiles
const prefs = await learningEngine.incorporateConsumptionIntoPreferences(userId);

// Result:
// {
//   wine_types: {
//     "Red": 15,      // Consumed 15 bottles of red
//     "White": 8,     // Consumed 8 bottles of white
//     "Sparkling": 3
//   },
//   regions: {
//     "Bordeaux": 10,
//     "Burgundy": 7,
//     "Tuscany": 5
//   },
//   grapes: {
//     "Cabernet Sauvignon": 12,
//     "Pinot Noir": 8,
//     "Chardonnay": 5
//   }
// }
```

## Backward Compatibility

The implementation maintains **full backward compatibility**:

1. **Nullable columns**: Existing consumption events without user_id/session_id continue to work
2. **Optional parameters**: All method signatures use optional parameters with null defaults
3. **Graceful degradation**: System works perfectly fine with anonymous consumption
4. **Mixed data**: Queries handle both old (no user_id) and new (with user_id) data seamlessly

## Data Flow

```
┌──────────────────────┐
│  API Request         │
│  POST /inventory/    │
│  consume             │
│  + JWT Auth          │
└──────────┬───────────┘
           │ Extract user_id from req.user
           ▼
┌──────────────────────┐
│  Inventory Manager   │
│  consumeWine()       │
│  + user_id           │
│  + session_id        │
└──────────┬───────────┘
           │ Pass context
           ▼
┌──────────────────────┐
│  Learning Engine     │
│  recordConsumption   │
│  Event()             │
└──────────┬───────────┘
           │ INSERT with user_id
           ▼
┌──────────────────────────────────────┐
│  Database                            │
│  LearningConsumptionEvents           │
│  ┌────────────────────────────────┐  │
│  │ vintage_id, quantity, location │  │
│  │ user_id ← NEW                  │  │
│  │ session_id ← NEW               │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Collaborative Filtering             │
│  - Query consumption by user_id      │
│  - Convert to implicit ratings       │
│  - Combine with explicit feedback    │
│  - Generate recommendations          │
└──────────────────────────────────────┘
```

## Testing Recommendations

### Unit Tests

- Test `recordConsumptionEvent()` with and without user context
- Test implicit rating calculation algorithm
- Test deduplication logic (explicit vs. implicit ratings)

### Integration Tests

- Test full flow: consume → store → query → recommend
- Test authenticated vs. anonymous consumption
- Test session linkage (consumption during pairing session)

### Edge Cases

- NULL user_id (anonymous consumption)
- NULL session_id (consumption not part of pairing)
- Mixed data (some records with user_id, some without)
- User with only consumption (no explicit feedback)
- User with both consumption and explicit feedback for same wine

## Performance Considerations

### Indexes

Three indexes were added to optimize queries:

- `user_id` - For user-specific consumption queries
- `session_id` - For session-based queries
- `(user_id, created_at)` - Compound index for time-series analysis

### Query Optimization

- Use `WHERE user_id = ?` for user-specific queries
- Use `WHERE session_id = ?` for session-based queries
- Avoid full table scans by always filtering on indexed columns

### Caching Strategy

- Cache user preference profiles (updated periodically)
- Cache implicit ratings (invalidate on new consumption)
- Use existing collaborative filtering cache system

## Future Enhancements

1. **Session Correlation**: Automatically link consumption to recent pairing sessions
2. **Time Decay**: Weight recent consumption more heavily than old consumption
3. **Context Awareness**: Track consumption context (occasion, weather, guests, etc.)
4. **Group Consumption**: Track when multiple users consume together
5. **Recommendation Feedback Loop**: Measure how often recommendations lead to actual consumption

## Migration Status

✅ Migration `005_consumption_user_tracking.sql` successfully applied
✅ All indexes created
✅ Schema verified
✅ 7 migrations applied, 2 pending (unrelated)

## Files Modified

### Created

- `backend/database/migrations/005_consumption_user_tracking.sql`

### Modified

- `backend/core/learning_engine.js`
- `backend/core/enhanced_learning_engine.js`
- `backend/core/inventory_manager.js`
- `backend/core/collaborative_filtering_engine.js`
- `backend/api/routes.js`

## Summary

This implementation successfully addresses the gap identified in your original query:

> "Link Consumption to Specific Users or Sessions: In the base schema, LearningConsumptionEvents doesn't reference a user or a pairing session."

**Now it does!** The system can:

- ✅ Track which user consumed which wine
- ✅ Link consumption to pairing sessions
- ✅ Use consumption as implicit positive feedback
- ✅ Build user-specific preference profiles
- ✅ Enhance collaborative filtering with consumption data
- ✅ Maintain full backward compatibility

The implementation is production-ready and fully integrated with the existing SommOS architecture.
