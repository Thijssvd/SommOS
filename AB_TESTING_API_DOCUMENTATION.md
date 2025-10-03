# A/B Testing API Documentation

Complete REST API for managing experiments, tracking events, and analyzing results in the SommOS ML infrastructure.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [Endpoints](#endpoints)
   - [Experiment Management](#experiment-management)
   - [Variant Assignment](#variant-assignment)
   - [Event Tracking](#event-tracking)
   - [Metrics & Analysis](#metrics--analysis)
   - [Dashboard & Reporting](#dashboard--reporting)
5. [Usage Examples](#usage-examples)
6. [Response Formats](#response-formats)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## Overview

The A/B Testing API provides comprehensive endpoints for:
- Creating and managing experiments
- Assigning users to variants (with sticky assignments)
- Tracking experiment events (impressions, clicks, conversions, ratings)
- Running statistical analysis (frequentist & Bayesian)
- Monitoring guardrail metrics
- Real-time dashboards and reporting

---

## Authentication

All endpoints require authentication via JWT tokens. Include the token in the request header:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Or via cookies:
```
Cookie: sommos_access_token=YOUR_ACCESS_TOKEN
```

### Role Requirements

- **Admin**: Full access to all endpoints
- **Crew**: Read access to experiments, can track events
- **Guest**: Can be assigned to variants and track events

---

## Base URL

```
/api/experiments
```

---

## Endpoints

### Experiment Management

#### 1. Create Experiment

**POST** `/api/experiments`

Creates a new A/B test experiment.

**Permissions**: Admin only

**Request Body**:
```json
{
  "name": "New Algorithm Test",
  "description": "Testing collaborative filtering vs. content-based",
  "hypothesis": "Collaborative filtering will increase conversion rate by 10%",
  "variants": [
    {
      "name": "control",
      "description": "Current content-based algorithm",
      "is_control": true,
      "allocation_percentage": 50,
      "config": {
        "algorithm": "content_based"
      }
    },
    {
      "name": "treatment",
      "description": "New collaborative filtering algorithm",
      "is_control": false,
      "allocation_percentage": 50,
      "config": {
        "algorithm": "collaborative_filtering"
      }
    }
  ],
  "target_metric": "conversion_rate",
  "guardrail_metrics": ["avg_rating", "bounce_rate"],
  "allocation_unit": "user",
  "start_date": "2025-10-05T00:00:00Z",
  "end_date": "2025-10-20T00:00:00Z",
  "metadata": {
    "owner": "data_team",
    "priority": "high"
  }
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "experiment_id": "exp_1234567890",
    "name": "New Algorithm Test",
    "status": "draft",
    "variants": [...],
    "created_at": "2025-10-03T17:00:00Z"
  },
  "message": "Experiment created successfully"
}
```

---

#### 2. List Experiments

**GET** `/api/experiments`

Get all experiments with optional filtering.

**Permissions**: Admin, Crew

**Query Parameters**:
- `status` (optional): Filter by status (`draft`, `running`, `paused`, `completed`)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Example**:
```
GET /api/experiments?status=running&limit=20
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "exp_1234567890",
      "name": "New Algorithm Test",
      "status": "running",
      "target_metric": "conversion_rate",
      "started_at": "2025-10-05T00:00:00Z"
    }
  ],
  "meta": {
    "count": 1,
    "limit": 20,
    "offset": 0
  }
}
```

---

#### 3. Get Experiment Details

**GET** `/api/experiments/:experimentId`

Get detailed information about a specific experiment.

**Permissions**: Admin, Crew

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "exp_1234567890",
    "name": "New Algorithm Test",
    "description": "Testing collaborative filtering vs. content-based",
    "status": "running",
    "variants": [
      {
        "id": "var_123",
        "name": "control",
        "is_control": true,
        "allocation_percentage": 50
      },
      {
        "id": "var_456",
        "name": "treatment",
        "is_control": false,
        "allocation_percentage": 50
      }
    ],
    "target_metric": "conversion_rate",
    "guardrail_metrics": ["avg_rating", "bounce_rate"],
    "created_at": "2025-10-03T17:00:00Z",
    "started_at": "2025-10-05T00:00:00Z"
  }
}
```

---

#### 4. Update Experiment

**PATCH** `/api/experiments/:experimentId`

Update experiment details (only draft/paused experiments).

**Permissions**: Admin only

**Request Body**:
```json
{
  "name": "Updated Experiment Name",
  "description": "Updated description",
  "end_date": "2025-10-25T00:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "exp_1234567890",
    "name": "Updated Experiment Name",
    ...
  },
  "message": "Experiment updated successfully"
}
```

---

#### 5. Start Experiment

**POST** `/api/experiments/:experimentId/start`

Start a draft experiment.

**Permissions**: Admin only

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "exp_1234567890",
    "status": "running",
    "started_at": "2025-10-05T00:00:00Z"
  },
  "message": "Experiment started successfully"
}
```

---

#### 6. Pause Experiment

**POST** `/api/experiments/:experimentId/pause`

Pause a running experiment.

**Permissions**: Admin only

---

#### 7. Resume Experiment

**POST** `/api/experiments/:experimentId/resume`

Resume a paused experiment.

**Permissions**: Admin only

---

#### 8. Complete Experiment

**POST** `/api/experiments/:experimentId/complete`

Complete/stop an experiment and declare a winner.

**Permissions**: Admin only

**Request Body**:
```json
{
  "winner_variant_id": "var_456",
  "conclusion": "Treatment variant shows 12% lift in conversion rate with statistical significance (p < 0.01)"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "exp_1234567890",
    "status": "completed",
    "winner_variant_id": "var_456",
    "completed_at": "2025-10-20T00:00:00Z"
  },
  "message": "Experiment completed successfully"
}
```

---

#### 9. Archive Experiment

**DELETE** `/api/experiments/:experimentId`

Archive an experiment (soft delete).

**Permissions**: Admin only

---

### Variant Assignment

#### 10. Assign User to Variant

**POST** `/api/experiments/:experimentId/assign`

Assign a user to a variant (sticky assignment - user will always get the same variant).

**Permissions**: Admin, Crew, Guest

**Request Body**:
```json
{
  "user_id": "user_abc123",
  "attributes": {
    "device": "mobile",
    "location": "US"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "experiment_id": "exp_1234567890",
    "user_id": "user_abc123",
    "variant": {
      "id": "var_456",
      "name": "treatment",
      "config": {
        "algorithm": "collaborative_filtering"
      }
    },
    "assigned_at": "2025-10-05T12:30:00Z"
  }
}
```

---

#### 11. Get User Assignment

**GET** `/api/experiments/:experimentId/assignments/:userId`

Get a user's current variant assignment.

**Permissions**: Admin, Crew, Guest

**Response**:
```json
{
  "success": true,
  "data": {
    "user_id": "user_abc123",
    "variant_id": "var_456",
    "variant_name": "treatment",
    "assigned_at": "2025-10-05T12:30:00Z"
  }
}
```

---

#### 12. List All Assignments

**GET** `/api/experiments/:experimentId/assignments`

Get all user assignments for an experiment.

**Permissions**: Admin only

**Query Parameters**:
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

---

### Event Tracking

#### 13. Track Single Event

**POST** `/api/experiments/events`

Track a single experiment event.

**Permissions**: Admin, Crew, Guest

**Request Body**:
```json
{
  "experiment_id": "exp_1234567890",
  "variant_id": "var_456",
  "user_id": "user_abc123",
  "event_type": "conversion",
  "event_value": 49.99,
  "event_data": {
    "wine_id": 789,
    "source": "recommendation"
  },
  "timestamp": "2025-10-05T14:30:00Z"
}
```

**Event Types**:
- `impression`: User saw the recommendation
- `click`: User clicked on a recommendation
- `conversion`: User completed the desired action (purchase, rating, etc.)
- `rating`: User rated a wine (event_value = rating score)

**Response** (202 Accepted):
```json
{
  "success": true,
  "message": "Event tracked successfully"
}
```

---

#### 14. Track Batch Events

**POST** `/api/experiments/events/batch`

Track multiple events in a single request (up to 100 events).

**Permissions**: Admin, Crew, Guest

**Request Body**:
```json
{
  "events": [
    {
      "experiment_id": "exp_1234567890",
      "variant_id": "var_456",
      "user_id": "user_abc123",
      "event_type": "impression"
    },
    {
      "experiment_id": "exp_1234567890",
      "variant_id": "var_456",
      "user_id": "user_abc123",
      "event_type": "click"
    }
  ]
}
```

**Response** (202 Accepted):
```json
{
  "success": true,
  "message": "2 events tracked successfully",
  "meta": {
    "events_count": 2
  }
}
```

---

#### 15. Track Impression (Convenience)

**POST** `/api/experiments/:experimentId/events/impression`

Convenience endpoint for tracking impressions.

**Permissions**: Admin, Crew, Guest

**Request Body**:
```json
{
  "user_id": "user_abc123",
  "variant_id": "var_456"
}
```

---

#### 16. Track Conversion (Convenience)

**POST** `/api/experiments/:experimentId/events/conversion`

Convenience endpoint for tracking conversions.

**Permissions**: Admin, Crew, Guest

**Request Body**:
```json
{
  "user_id": "user_abc123",
  "variant_id": "var_456",
  "value": 49.99
}
```

---

### Metrics & Analysis

#### 17. Get Experiment Metrics

**GET** `/api/experiments/:experimentId/metrics`

Get aggregated metrics for all variants in an experiment.

**Permissions**: Admin, Crew

**Response**:
```json
{
  "success": true,
  "data": {
    "experiment_id": "exp_1234567890",
    "variants": [
      {
        "variant_id": "var_123",
        "variant_name": "control",
        "users": 1500,
        "impressions": 4500,
        "clicks": 900,
        "conversions": 180,
        "click_rate": 0.20,
        "conversion_rate": 0.04,
        "avg_rating": 4.2,
        "total_revenue": 8982.00
      },
      {
        "variant_id": "var_456",
        "variant_name": "treatment",
        "users": 1500,
        "impressions": 4500,
        "clicks": 1125,
        "conversions": 225,
        "click_rate": 0.25,
        "conversion_rate": 0.05,
        "avg_rating": 4.4,
        "total_revenue": 11242.50
      }
    ],
    "updated_at": "2025-10-15T10:00:00Z"
  }
}
```

---

#### 18. Get Variant Metrics

**GET** `/api/experiments/:experimentId/metrics/:variantId`

Get metrics for a specific variant.

**Permissions**: Admin, Crew

---

#### 19. Get Funnel Analysis

**GET** `/api/experiments/:experimentId/funnel`

Get funnel analysis showing progression from impression → click → conversion.

**Permissions**: Admin, Crew

**Response**:
```json
{
  "success": true,
  "data": {
    "experiment_id": "exp_1234567890",
    "funnel": [
      {
        "variant_name": "control",
        "impression_to_click": 0.20,
        "click_to_conversion": 0.20,
        "impression_to_conversion": 0.04
      },
      {
        "variant_name": "treatment",
        "impression_to_click": 0.25,
        "click_to_conversion": 0.20,
        "impression_to_conversion": 0.05
      }
    ]
  }
}
```

---

#### 20. Run Statistical Analysis

**POST** `/api/experiments/:experimentId/analyze`

Run statistical analysis on experiment results.

**Permissions**: Admin, Crew

**Request Body**:
```json
{
  "metric_name": "conversion_rate",
  "analysis_type": "both",
  "confidence_level": 0.95,
  "minimum_sample_size": 100
}
```

**Parameters**:
- `metric_name` (optional): Specific metric to analyze (defaults to target metric)
- `analysis_type`: `frequentist`, `bayesian`, or `both` (default: `both`)
- `confidence_level`: Confidence level for analysis (default: 0.95)
- `minimum_sample_size`: Minimum sample size required (default: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "experiment_id": "exp_1234567890",
    "metric_name": "conversion_rate",
    "control_variant": {
      "id": "var_123",
      "name": "control",
      "mean": 0.04,
      "std_dev": 0.02,
      "sample_size": 1500
    },
    "test_variant": {
      "id": "var_456",
      "name": "treatment",
      "mean": 0.05,
      "std_dev": 0.021,
      "sample_size": 1500
    },
    "frequentist_analysis": {
      "p_value": 0.003,
      "is_significant": true,
      "confidence_level": 0.95,
      "confidence_interval": [0.005, 0.015]
    },
    "bayesian_analysis": {
      "probability_better": 0.98,
      "expected_loss": 0.001,
      "credible_interval": [0.006, 0.014]
    },
    "effect_size": 0.25,
    "relative_lift": 0.25,
    "absolute_lift": 0.01,
    "recommendation": "LAUNCH",
    "recommendation_confidence": "high"
  },
  "meta": {
    "analyzed_at": "2025-10-15T10:30:00Z"
  }
}
```

---

#### 21. Get Stored Analysis

**GET** `/api/experiments/:experimentId/analysis`

Get previously stored analysis results.

**Permissions**: Admin, Crew

**Query Parameters**:
- `latest` (optional): Get only the latest analysis (default: true)

---

#### 22. Check Guardrail Metrics

**GET** `/api/experiments/:experimentId/guardrails`

Check if any guardrail metrics have been violated.

**Permissions**: Admin, Crew

**Response**:
```json
{
  "success": true,
  "data": {
    "experiment_id": "exp_1234567890",
    "guardrails": [
      {
        "metric_name": "avg_rating",
        "threshold": 4.0,
        "control_value": 4.2,
        "test_value": 4.4,
        "is_violated": false
      },
      {
        "metric_name": "bounce_rate",
        "threshold": 0.3,
        "control_value": 0.25,
        "test_value": 0.28,
        "is_violated": false
      }
    ],
    "has_violations": false,
    "checked_at": "2025-10-15T10:30:00Z"
  }
}
```

---

#### 23. Get Recommendation

**GET** `/api/experiments/:experimentId/recommendation`

Get automated recommendation for experiment decision.

**Permissions**: Admin, Crew

**Response**:
```json
{
  "success": true,
  "data": {
    "recommendation": "LAUNCH",
    "confidence": "high",
    "reasoning": [
      "Treatment variant shows 25% relative lift in conversion rate",
      "Statistical significance achieved (p < 0.01)",
      "Bayesian probability of improvement: 98%",
      "No guardrail violations detected",
      "Sufficient sample size collected (n=3000)"
    ],
    "metrics_summary": {
      "conversion_rate_lift": 0.25,
      "p_value": 0.003,
      "bayesian_probability": 0.98
    }
  }
}
```

**Recommendation Types**:
- `LAUNCH`: High confidence to launch treatment variant
- `CONTINUE`: Continue running the experiment
- `STOP`: Stop the experiment (no significant difference or negative results)
- `INVESTIGATE`: Results are inconclusive or guardrails violated

---

### Dashboard & Reporting

#### 24. Get Dashboard Summary

**GET** `/api/experiments/dashboard/summary`

Get a summary of all experiments for dashboard display.

**Permissions**: Admin, Crew

**Response**:
```json
{
  "success": true,
  "data": {
    "total_experiments": 15,
    "running_experiments": 3,
    "draft_experiments": 2,
    "completed_experiments": 9,
    "paused_experiments": 1
  }
}
```

---

#### 25. Get Real-time Stats

**GET** `/api/experiments/:experimentId/realtime`

Get real-time statistics for an experiment (optimized for dashboards).

**Permissions**: Admin, Crew

**Response**:
```json
{
  "success": true,
  "data": {
    "experiment": {
      "id": "exp_1234567890",
      "name": "New Algorithm Test",
      "status": "running",
      "target_metric": "conversion_rate"
    },
    "variants": [
      {
        "id": "var_123",
        "name": "control",
        "is_control": true,
        "allocation_percentage": 50,
        "users_assigned": 1500,
        "impressions": 4500,
        "clicks": 900,
        "conversions": 180,
        "avg_rating": 4.2,
        "click_rate": 0.20,
        "conversion_rate": 0.04
      },
      {
        "id": "var_456",
        "name": "treatment",
        "is_control": false,
        "allocation_percentage": 50,
        "users_assigned": 1500,
        "impressions": 4500,
        "clicks": 1125,
        "conversions": 225,
        "avg_rating": 4.4,
        "click_rate": 0.25,
        "conversion_rate": 0.05
      }
    ],
    "metrics": {
      ...aggregated metrics...
    },
    "timestamp": "2025-10-15T10:30:00Z"
  }
}
```

---

## Usage Examples

### Complete A/B Test Workflow

```javascript
// 1. Create experiment
const createResponse = await fetch('/api/experiments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "Algorithm Comparison Test",
    variants: [
      { name: "control", is_control: true, allocation_percentage: 50 },
      { name: "treatment", is_control: false, allocation_percentage: 50 }
    ],
    target_metric: "conversion_rate"
  })
});
const { data: experiment } = await createResponse.json();

// 2. Start experiment
await fetch(`/api/experiments/${experiment.experiment_id}/start`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. Assign user to variant
const assignResponse = await fetch(`/api/experiments/${experiment.experiment_id}/assign`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ user_id: 'user_123' })
});
const { data: assignment } = await assignResponse.json();

// 4. Track events
await fetch('/api/experiments/events', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    experiment_id: experiment.experiment_id,
    variant_id: assignment.variant.id,
    user_id: 'user_123',
    event_type: 'impression'
  })
});

await fetch('/api/experiments/events', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    experiment_id: experiment.experiment_id,
    variant_id: assignment.variant.id,
    user_id: 'user_123',
    event_type: 'conversion',
    event_value: 49.99
  })
});

// 5. Run analysis (after collecting data)
const analysisResponse = await fetch(`/api/experiments/${experiment.experiment_id}/analyze`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    analysis_type: 'both',
    confidence_level: 0.95
  })
});
const { data: analysis } = await analysisResponse.json();

// 6. Get recommendation
const recResponse = await fetch(`/api/experiments/${experiment.experiment_id}/recommendation`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data: recommendation } = await recResponse.json();

// 7. Complete experiment if recommendation is to launch
if (recommendation.recommendation === 'LAUNCH') {
  await fetch(`/api/experiments/${experiment.experiment_id}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      winner_variant_id: analysis.test_variant.id,
      conclusion: recommendation.reasoning.join('. ')
    })
  });
}
```

---

## Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "timestamp": "2025-10-15T10:30:00Z"
  }
}
```

---

## Error Handling

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required or failed |
| `FORBIDDEN` | 403 | User doesn't have permission |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `EXPERIMENT_NOT_FOUND` | 404 | Experiment doesn't exist |
| `ASSIGNMENT_NOT_FOUND` | 404 | User assignment doesn't exist |
| `METRICS_NOT_FOUND` | 404 | No metrics available |
| `ANALYSIS_NOT_FOUND` | 404 | No analysis results available |
| `INVALID_STATE` | 400 | Operation not allowed in current state |

### Example Error Handling

```javascript
try {
  const response = await fetch('/api/experiments', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(experimentData)
  });
  
  const result = await response.json();
  
  if (!result.success) {
    console.error(`Error: ${result.error.code} - ${result.error.message}`);
    // Handle error
  }
} catch (error) {
  console.error('Request failed:', error);
}
```

---

## Best Practices

### 1. Experiment Design

- **Clear Hypothesis**: Always define a clear hypothesis before creating an experiment
- **Sufficient Sample Size**: Calculate required sample size before starting
- **Single Metric Focus**: Focus on one primary metric (target_metric)
- **Guardrail Metrics**: Always define guardrail metrics to protect user experience

### 2. Variant Assignment

- **Sticky Assignments**: Always use the same user_id for a user (assignments are deterministic)
- **Check Before Tracking**: Always assign user before tracking events
- **Cache Assignments**: Cache variant assignments client-side to reduce API calls

### 3. Event Tracking

- **Batch Events**: Use batch endpoint when tracking multiple events
- **Track Immediately**: Track impressions immediately when showing recommendations
- **Include Context**: Add relevant event_data for debugging
- **Handle Async**: Event tracking returns 202 (Accepted) - don't block UI

### 4. Analysis

- **Wait for Data**: Don't analyze too early (wait for minimum_sample_size)
- **Check Guardrails**: Always check guardrails before making decisions
- **Use Both Methods**: Run both frequentist and Bayesian analysis
- **Regular Monitoring**: Check real-time stats regularly

### 5. Decision Making

- **Follow Recommendations**: The automated recommendation considers multiple factors
- **Document Decisions**: Always provide a conclusion when completing experiments
- **Learn from Results**: Review completed experiments to improve future tests

### 6. Performance

- **Use Real-time Endpoint**: For dashboards, use `/realtime` endpoint (optimized)
- **Pagination**: Use limit/offset for large datasets
- **Caching**: Cache experiment details client-side
- **Rate Limiting**: Respect rate limits on event tracking

---

## Testing Checklist

Before deploying to production, test:

- ✅ Create experiment with 2+ variants
- ✅ Start/pause/resume/complete lifecycle
- ✅ User assignment returns same variant consistently
- ✅ Event tracking (all event types)
- ✅ Batch event tracking
- ✅ Metrics calculation accuracy
- ✅ Statistical analysis with sufficient data
- ✅ Guardrail violation detection
- ✅ Recommendation generation
- ✅ Real-time dashboard updates
- ✅ Error handling for all edge cases
- ✅ Authentication and authorization

---

## Support

For issues or questions:
- Check error codes and messages
- Review the statistical analyzer logs
- Verify sample sizes meet minimum requirements
- Ensure experiments are in correct state for operations

---

**API Version**: 1.0  
**Last Updated**: October 2025  
**Status**: Production Ready ✅
