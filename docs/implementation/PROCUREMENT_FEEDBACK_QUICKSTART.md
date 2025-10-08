# Procurement Feedback System - Quick Start Guide

## What Was Implemented

A lightweight feedback system that allows SommOS to learn from procurement decisions and improve future recommendations.

## Files Created/Modified

### New Files
1. **`/backend/database/migrations/006_procurement_feedback.sql`**
   - Adds feedback tracking fields to InventoryIntakeOrders

2. **`/PROCUREMENT_FEEDBACK_IMPLEMENTATION.md`**
   - Complete implementation guide with examples and troubleshooting

### Modified Files
1. **`/backend/middleware/validate.js`**
   - Added `procurementFeedback` validation schema

2. **`/backend/core/procurement_engine.js`**
   - Added ExplainabilityService integration
   - Stores recommendations in Explainability table
   - Added `getRecommendationById()` method

3. **`/backend/core/learning_engine.js`**
   - Added `updateProcurementWeightsFromFeedback()` method
   - Added `calculateProcurementWeightAdjustments()` method

4. **`/backend/core/explainability_service.js`**
   - Added `updateFeedback()` method

5. **`/backend/api/routes.js`**
   - Added `POST /api/procurement/feedback` endpoint

## Quick Start

### 1. Apply the Migration

```bash
cd /Users/thijs/Documents/SommOS
npm run migrate
```

**Expected Output:**
```
Starting database migrations...
Applying migration: 006_procurement_feedback.sql
Migration 006_procurement_feedback.sql applied successfully
Database migrations completed successfully
```

### 2. Verify the Migration

```bash
npm run migrate:status
```

**Expected Output:**
```
Migration Status:
Applied: 6
Available: 6
Pending: 0
```

### 3. Test the New Endpoint

**Get recommendations:**
```bash
curl -X GET "http://localhost:3001/api/procurement/opportunities?budget=5000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response includes `recommendation_id`:**
```json
{
  "success": true,
  "data": {
    "criteria": { ... },
    "summary": { ... },
    "opportunities": [ ... ],
    "recommendation_id": 123
  }
}
```

**Submit feedback:**
```bash
curl -X POST "http://localhost:3001/api/procurement/feedback" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendation_id": 123,
    "action_taken": "accepted",
    "outcome_rating": 5,
    "feedback_notes": "Excellent recommendation"
  }'
```

## Key Features

### 1. Track Recommendation Outcomes
- Records which recommendations were accepted/rejected/modified
- Links orders to recommendations via `intake_order_id`
- Stores outcome ratings (1-5) and feedback notes

### 2. Adaptive Learning
- Analyzes feedback patterns (last 90 days)
- Calculates acceptance rate
- Adjusts procurement scoring weights automatically
- Blends learned weights with defaults (70/30 ratio)

### 3. Minimal Schema Changes
- Only 3 new columns added to `InventoryIntakeOrders`
- Leverages existing `Explainability` table
- Two indexes for performance

## New API Endpoint

### POST /api/procurement/feedback

**Authentication**: Required (Admin or Crew)

**Request Body**:
```json
{
  "recommendation_id": 123,          // required
  "action_taken": "accepted",        // required: accepted|rejected|modified
  "intake_order_id": 456,            // optional: link to actual order
  "outcome_rating": 5,               // optional: 1-5
  "feedback_notes": "text"           // optional: up to 1000 chars
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "feedback_recorded": true,
    "recommendation_id": 123,
    "action_taken": "accepted",
    "weight_update": {
      "updated": true,
      "adjustments": { ... },
      "feedback_count": 47,
      "acceptance_rate": 0.72
    }
  }
}
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Procurement Workflow                      │
└─────────────────────────────────────────────────────────────┘

1. GET /api/procurement/opportunities
   → ProcurementEngine generates recommendations
   → Stores in Explainability table
   → Returns recommendation_id

2. User reviews recommendations
   → Decides to accept, reject, or modify
   → (Optional) Places order via /api/inventory/intake

3. POST /api/procurement/feedback
   → Records feedback in Explainability
   → Links order to recommendation (if provided)
   → Triggers weight adjustment

4. LearningEngine analyzes feedback
   → Calculates acceptance patterns
   → Extracts successful factors
   → Updates procurement_weights

5. Future recommendations use new weights
   → Improved accuracy over time
   → Adapts to team preferences
```

## Database Schema Changes

### InventoryIntakeOrders (New Columns)

| Column                    | Type    | Description                              |
|---------------------------|---------|------------------------------------------|
| `recommendation_id`       | INTEGER | FK to Explainability.id (nullable)       |
| `followed_recommendation` | INTEGER | Boolean: 1 = accepted, 0 = not followed  |
| `procurement_notes`       | TEXT    | Additional feedback notes                |

### Indexes Added

- `idx_intake_orders_recommendation_id` on `recommendation_id`
- `idx_intake_orders_followed` on `followed_recommendation`

## Monitoring Queries

### Check Recent Feedback
```sql
SELECT 
    e.id, 
    e.created_at, 
    e.feedback_rating,
    io.followed_recommendation,
    io.procurement_notes
FROM Explainability e
LEFT JOIN InventoryIntakeOrders io ON io.recommendation_id = e.id
WHERE e.request_type = 'procurement'
ORDER BY e.created_at DESC
LIMIT 20;
```

### View Current Procurement Weights
```sql
SELECT parameter_value 
FROM LearningParameters 
WHERE parameter_name = 'procurement_weights';
```

### Calculate Acceptance Rate
```sql
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN io.followed_recommendation = 1 THEN 1 ELSE 0 END) as accepted,
    ROUND(100.0 * SUM(CASE WHEN io.followed_recommendation = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as rate
FROM Explainability e
LEFT JOIN InventoryIntakeOrders io ON io.recommendation_id = e.id
WHERE e.request_type = 'procurement';
```

## Integration Examples

### Frontend Integration (Vanilla JS)

```javascript
// In procurement module
class ProcurementModule {
  async getRecommendations(criteria) {
    const response = await this.api.get('/procurement/opportunities', criteria);
    this.currentRecommendationId = response.data.recommendation_id;
    return response.data;
  }

  async submitFeedback(actionTaken, intakeOrderId = null, rating = null, notes = '') {
    return await this.api.post('/procurement/feedback', {
      recommendation_id: this.currentRecommendationId,
      action_taken: actionTaken,
      intake_order_id: intakeOrderId,
      outcome_rating: rating,
      feedback_notes: notes
    });
  }
}

// Usage example
const procurement = new ProcurementModule();

// Get recommendations
const recommendations = await procurement.getRecommendations({ budget: 5000 });

// User places order
const order = await inventoryModule.createIntake({ ... });

// Submit positive feedback
await procurement.submitFeedback('accepted', order.intake_id, 5, 'Great value');
```

### Testing Pattern

```javascript
// Test feedback submission
describe('Procurement Feedback', () => {
  it('should record accepted recommendation', async () => {
    const recommendations = await getRecommendations();
    const feedback = await submitFeedback({
      recommendation_id: recommendations.recommendation_id,
      action_taken: 'accepted',
      outcome_rating: 5
    });
    
    expect(feedback.success).toBe(true);
    expect(feedback.data.feedback_recorded).toBe(true);
  });
});
```

## Next Steps

### Immediate (This Week)
- [ ] Apply migration to development database
- [ ] Test endpoint manually with curl/Postman
- [ ] Update frontend to capture recommendation IDs
- [ ] Add UI for feedback submission

### Short-term (Next 2 Weeks)
- [ ] Monitor initial feedback submissions
- [ ] Review weight adjustments
- [ ] Gather team feedback on recommendations
- [ ] Document any issues or edge cases

### Long-term (Future)
- [ ] Analyze acceptance rate trends
- [ ] Consider Phase 2 enhancements if valuable
- [ ] A/B test recommendation algorithms
- [ ] Add advanced analytics dashboard

## Troubleshooting

### Migration Issues

**Problem**: Migration fails with "table not found"
**Solution**: Ensure database exists and schema.sql has been applied

```bash
npm run setup:db
npm run migrate
```

### No Recommendation ID Returned

**Problem**: API doesn't return `recommendation_id`
**Solution**: Check if ExplainabilityService is initialized properly

```bash
# Check recent Explainability entries
sqlite3 backend/database/sommos.db \
  "SELECT * FROM Explainability WHERE request_type = 'procurement' ORDER BY id DESC LIMIT 5;"
```

### Weights Not Updating

**Problem**: Feedback submitted but weights unchanged
**Cause**: Need minimum feedback entries (5-10) to see adjustments
**Solution**: Submit more feedback, then check:

```bash
sqlite3 backend/database/sommos.db \
  "SELECT * FROM LearningParameters WHERE parameter_name = 'procurement_weights';"
```

## Documentation

- **Full Guide**: `/PROCUREMENT_FEEDBACK_IMPLEMENTATION.md`
- **API Docs**: Add to `PROJECT_WORKFLOW.md`
- **Database Schema**: `backend/database/schema.sql`
- **Migration**: `backend/database/migrations/006_procurement_feedback.sql`

## Support

For questions or issues:
1. Check `/PROCUREMENT_FEEDBACK_IMPLEMENTATION.md` for detailed explanations
2. Review test cases in `/tests/backend/procurement-feedback.test.js`
3. Check database directly with monitoring queries above

---

**Implementation Complete!** ✅

The procurement feedback system is now ready to use. Start by applying the migration and testing the new endpoint.
