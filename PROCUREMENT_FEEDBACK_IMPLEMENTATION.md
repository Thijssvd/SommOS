# Procurement Feedback System - Implementation Guide

## Overview

This document describes the implementation of **Phase 1: Lightweight Procurement Feedback** for SommOS. This feature allows the system to learn from procurement decisions by tracking which recommendations are followed, recording outcomes, and adjusting scoring weights accordingly.

## Architecture

### Design Philosophy

The implementation leverages existing infrastructure rather than creating new tables:

- ✅ Uses existing `Explainability` table for storing recommendations
- ✅ Extends `InventoryIntakeOrders` with minimal fields for tracking
- ✅ Follows established patterns from pairing feedback system
- ✅ Minimal disruption to existing codebase

### Data Flow

```
1. User requests procurement recommendations
   ↓
2. ProcurementEngine generates recommendations
   ↓
3. Recommendation stored in Explainability table (returns recommendation_id)
   ↓
4. User places order (optional: links order to recommendation_id)
   ↓
5. User provides feedback via POST /api/procurement/feedback
   ↓
6. System updates Explainability.feedback_rating and InventoryIntakeOrders
   ↓
7. LearningEngine analyzes feedback and adjusts procurement_weights
   ↓
8. Future recommendations use updated weights
```

## Database Changes

### Migration: `006_procurement_feedback.sql`

**Location**: `/backend/database/migrations/006_procurement_feedback.sql`

```sql
-- Add recommendation tracking columns
ALTER TABLE InventoryIntakeOrders ADD COLUMN recommendation_id INTEGER;
ALTER TABLE InventoryIntakeOrders ADD COLUMN followed_recommendation INTEGER DEFAULT 0 CHECK (followed_recommendation IN (0, 1));
ALTER TABLE InventoryIntakeOrders ADD COLUMN procurement_notes TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_intake_orders_recommendation_id ON InventoryIntakeOrders(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_intake_orders_followed ON InventoryIntakeOrders(followed_recommendation);
```

**New Fields**:
- `recommendation_id` - Links order to Explainability recommendation
- `followed_recommendation` - Boolean: was this based on a recommendation?
- `procurement_notes` - Additional feedback notes

### Applying the Migration

```bash
# Apply migration
npm run migrate

# Verify migration status
npm run migrate:status
```

## Code Changes

### 1. ProcurementEngine (`/backend/core/procurement_engine.js`)

**Added**:
- Import `ExplainabilityService`
- Store recommendations in `Explainability` table
- Return `recommendation_id` with opportunities
- New method: `getRecommendationById()`

**Key Changes**:
```javascript
// Constructor now includes ExplainabilityService
constructor(database, learningEngine = null) {
    this.db = database || Database.getInstance();
    this.learningEngine = learningEngine;
    this.explainabilityService = new ExplainabilityService(this.db);
    // ...
}

// Stores recommendation and returns ID
async generateProcurementRecommendations(criteria = {}) {
    // ... generate recommendations
    
    // Store in Explainability table
    const explanation = await this.explainabilityService.createExplanation({
        entityType: 'procurement',
        entityId: `session_${Date.now()}`,
        summary: `Procurement recommendations based on ${ranked.length} opportunities`,
        factors: JSON.stringify({ criteria, learning_context, top_opportunities })
    });
    
    return {
        // ... existing data
        recommendation_id: explanation.id
    };
}
```

### 2. LearningEngine (`/backend/core/learning_engine.js`)

**Added**:
- `updateProcurementWeightsFromFeedback()` - Analyzes feedback and updates weights
- `calculateProcurementWeightAdjustments()` - Calculates weight adjustments

**Learning Algorithm**:
1. Query recent feedback (last 90 days) from Explainability table
2. Calculate acceptance rate (% of recommendations followed)
3. Extract factors from successful recommendations (rating ≥ 4)
4. Calculate weight adjustments based on success patterns
5. Blend with defaults (70% default, 30% feedback-based)
6. Normalize and store updated weights

### 3. ExplainabilityService (`/backend/core/explainability_service.js`)

**Added**:
- `updateFeedback(explainabilityId, feedbackData)` - Updates feedback fields

### 4. API Routes (`/backend/api/routes.js`)

**New Endpoint**: `POST /api/procurement/feedback`

**Request Body**:
```json
{
  "recommendation_id": 123,
  "action_taken": "accepted" | "rejected" | "modified",
  "intake_order_id": 456,  // optional
  "outcome_rating": 5,      // optional, 1-5
  "feedback_notes": "Excellent recommendation, wine sold quickly"  // optional
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
      "adjustments": {
        "stock_urgency": 0.28,
        "value_proposition": 0.25,
        "quality_score": 0.18,
        "supplier_reliability": 0.12,
        "seasonal_relevance": 0.09,
        "budget_alignment": 0.08
      },
      "feedback_count": 47,
      "acceptance_rate": 0.72
    }
  }
}
```

### 5. Validation (`/backend/middleware/validate.js`)

**Added Schema**: `procurementFeedback`
- Validates all input fields
- Ensures `action_taken` is one of: accepted, rejected, modified
- Validates `outcome_rating` range (1-5)

## Usage Examples

### Example 1: Get Recommendations and Provide Feedback

```javascript
// 1. Get procurement recommendations
const response = await fetch('/api/procurement/opportunities?budget=5000&wine_type=Red');
const { data } = await response.json();
const recommendationId = data.recommendation_id;

// 2. User reviews recommendations and places order
const order = await createInventoryIntake({
  supplier_id: 5,
  items: [{ vintage_id: 123, quantity: 12, unit_cost: 45.00 }]
});
const intakeOrderId = order.intake_id;

// 3. Submit feedback linking order to recommendation
await fetch('/api/procurement/feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recommendation_id: recommendationId,
    action_taken: 'accepted',
    intake_order_id: intakeOrderId,
    outcome_rating: 5,
    feedback_notes: 'Great recommendation, high-quality wine at good price'
  })
});
```

### Example 2: Reject Recommendation

```javascript
// User decides not to follow recommendation
await fetch('/api/procurement/feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recommendation_id: recommendationId,
    action_taken: 'rejected',
    feedback_notes: 'Budget constraints, will revisit next quarter'
  })
});
```

### Example 3: Modified Recommendation

```javascript
// User followed recommendation but with modifications
await fetch('/api/procurement/feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recommendation_id: recommendationId,
    action_taken: 'modified',
    intake_order_id: intakeOrderId,
    outcome_rating: 4,
    feedback_notes: 'Ordered different vintage year than recommended'
  })
});
```

## Testing

### Manual Testing Steps

1. **Apply Migration**:
   ```bash
   npm run migrate
   ```

2. **Get Recommendations**:
   ```bash
   curl -X GET "http://localhost:3001/api/procurement/opportunities?budget=5000" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Submit Feedback**:
   ```bash
   curl -X POST "http://localhost:3001/api/procurement/feedback" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "recommendation_id": 1,
       "action_taken": "accepted",
       "outcome_rating": 5,
       "feedback_notes": "Excellent recommendation"
     }'
   ```

4. **Verify Weight Updates**:
   ```bash
   # Check LearningParameters table
   sqlite3 backend/database/sommos.db \
     "SELECT * FROM LearningParameters WHERE parameter_name = 'procurement_weights';"
   ```

### Automated Testing

Test file location: `/tests/backend/procurement-feedback.test.js`

Run tests:
```bash
npm test -- --testNamePattern="Procurement Feedback"
```

## Monitoring & Analytics

### Queries for Analysis

**Check Feedback Summary**:
```sql
SELECT 
    COUNT(*) as total_recommendations,
    SUM(CASE WHEN io.followed_recommendation = 1 THEN 1 ELSE 0 END) as accepted,
    AVG(e.feedback_rating) as avg_rating
FROM Explainability e
LEFT JOIN InventoryIntakeOrders io ON io.recommendation_id = e.id
WHERE e.request_type = 'procurement'
  AND e.created_at > datetime('now', '-30 days');
```

**Most Successful Recommendation Factors**:
```sql
SELECT 
    e.input_data,
    e.feedback_rating,
    io.followed_recommendation
FROM Explainability e
LEFT JOIN InventoryIntakeOrders io ON io.recommendation_id = e.id
WHERE e.request_type = 'procurement'
  AND io.followed_recommendation = 1
  AND e.feedback_rating >= 4
ORDER BY e.feedback_rating DESC
LIMIT 10;
```

**Acceptance Rate Over Time**:
```sql
SELECT 
    DATE(e.created_at) as date,
    COUNT(*) as recommendations,
    SUM(CASE WHEN io.followed_recommendation = 1 THEN 1 ELSE 0 END) as accepted,
    ROUND(100.0 * SUM(CASE WHEN io.followed_recommendation = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as acceptance_rate
FROM Explainability e
LEFT JOIN InventoryIntakeOrders io ON io.recommendation_id = e.id
WHERE e.request_type = 'procurement'
GROUP BY DATE(e.created_at)
ORDER BY date DESC
LIMIT 30;
```

## Performance Considerations

1. **Indexes**: Created on `recommendation_id` and `followed_recommendation` for fast lookups
2. **Query Limit**: Learning engine only analyzes last 90 days of feedback
3. **Async Updates**: Weight updates run asynchronously, don't block feedback submission
4. **Caching**: Consider caching `procurement_weights` parameter to reduce DB reads

## Future Enhancements (Phase 2)

If this lightweight solution proves valuable, consider:

1. **Dedicated Procurement Feedback Tables**: 
   - `LearningProcurementSessions`
   - `LearningProcurementRecommendations`
   - `LearningProcurementFeedback`

2. **Outcome Tracking**:
   - Track wine consumption rate post-purchase
   - Measure actual ROI vs predicted
   - A/B testing of recommendation algorithms

3. **Advanced Analytics**:
   - Machine learning models for recommendation scoring
   - Predictive analytics for procurement timing
   - Supplier performance correlation

4. **User Preferences**:
   - Per-user procurement preferences
   - Team-level buying patterns
   - Seasonal adjustment factors

## Troubleshooting

### Issue: Migration Fails

**Error**: "table InventoryIntakeOrders has no column named recommendation_id"

**Solution**: 
```bash
# Check if migration was applied
npm run migrate:status

# If not applied, run migration
npm run migrate
```

### Issue: Weight Updates Not Working

**Error**: "No feedback data available"

**Cause**: No feedback has been submitted yet

**Solution**: Submit at least 5-10 feedback entries to see weight adjustments

### Issue: Recommendation ID Not Returned

**Error**: Response doesn't include `recommendation_id`

**Solution**: Ensure ProcurementEngine properly stores recommendation:
```bash
# Check Explainability table
sqlite3 backend/database/sommos.db \
  "SELECT * FROM Explainability WHERE request_type = 'procurement' ORDER BY created_at DESC LIMIT 5;"
```

## Security Considerations

1. **Authentication**: Endpoint requires `admin` or `crew` role
2. **Input Validation**: All inputs validated via Zod schemas
3. **SQL Injection**: Uses parameterized queries throughout
4. **Data Integrity**: CHECK constraints on `followed_recommendation` field

## API Documentation Update

Add to `PROJECT_WORKFLOW.md`:

```markdown
### POST /api/procurement/feedback
Submit feedback on procurement recommendations to improve future suggestions.

**Authentication**: Required (Admin or Crew)

**Request Body**:
- `recommendation_id` (number, required): ID of the recommendation
- `action_taken` (string, required): "accepted", "rejected", or "modified"
- `intake_order_id` (number, optional): Link to actual order placed
- `outcome_rating` (number, optional): Rating 1-5
- `feedback_notes` (string, optional): Additional feedback text

**Response**: Feedback confirmation with weight update summary
```

## Deployment Checklist

- [ ] Run migration: `npm run migrate`
- [ ] Verify migration status: `npm run migrate:status`
- [ ] Run tests: `npm test`
- [ ] Update API documentation
- [ ] Brief team on new endpoint usage
- [ ] Monitor initial feedback submissions
- [ ] Review weight adjustments after 2 weeks
- [ ] Consider Phase 2 enhancements based on usage

## Conclusion

This lightweight implementation provides immediate value with minimal code changes. The system can now:

1. ✅ Track which procurement recommendations are followed
2. ✅ Record outcome ratings and notes
3. ✅ Automatically adjust scoring weights based on feedback
4. ✅ Improve recommendation quality over time

**Next Steps**: Monitor usage, gather team feedback, and decide if Phase 2 enhancements are warranted.
