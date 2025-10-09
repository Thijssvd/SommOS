# Enhanced Learning Engine Documentation

## Overview

The Enhanced Learning Engine is a significant upgrade to SommOS's machine learning capabilities, providing advanced features for wine pairing recommendations, user preference modeling, and data-driven insights.

## Key Features

### 1. Granular Feedback Collection

- **Multi-dimensional ratings**: Overall, flavor harmony, texture balance, acidity match, tannin balance, body match, regional tradition
- **Contextual data**: Occasion, guest count, time of day, season, weather context
- **Behavioral tracking**: Selection patterns, time to select, viewing duration
- **Additional feedback**: Notes, recommendation likelihood, price satisfaction

### 2. Advanced Feature Engineering

- **Wine feature vectors**: Structured extraction of wine characteristics
- **Dish feature vectors**: Parsed dish descriptions with semantic analysis
- **Temporal features**: Season, time of day, day of week patterns
- **Interaction features**: Cross-features between wine and dish characteristics

### 3. Machine Learning Enhancements

- **Advanced weighting algorithms**: Confidence-based weighting with temporal decay
- **User preference profiles**: Individual user modeling and adaptation
- **Feature interactions**: Tracking successful wine-dish combinations
- **Learning metrics**: Performance tracking and quality analysis

### 4. Data Quality Assurance

- **Comprehensive validation**: Input validation with detailed error reporting
- **Data sanitization**: Automatic cleaning and normalization
- **Quality analysis**: Feedback quality scoring and issue detection
- **Outlier detection**: Identification of anomalous patterns

## API Endpoints

### Enhanced Feedback Collection

#### POST `/api/learning/feedback/enhanced`

Record detailed pairing feedback with granular ratings.

**Request Body:**

```json
{
  "recommendation_id": "rec-123",
  "user_id": "user-456",
  "session_id": "session-789",
  "ratings": {
    "overall": 4,
    "flavor_harmony": 5,
    "texture_balance": 3,
    "acidity_match": 4,
    "tannin_balance": 3,
    "body_match": 4,
    "regional_tradition": 5
  },
  "context": {
    "occasion": "dinner",
    "guest_count": 4,
    "time_of_day": "evening",
    "season": "autumn",
    "weather_context": "indoor"
  },
  "behavioral_data": {
    "selected": true,
    "time_to_select": 45,
    "viewed_duration": 120
  },
  "additional_feedback": {
    "notes": "Excellent pairing with the main course",
    "would_recommend": true,
    "price_satisfaction": 4
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Enhanced feedback recorded successfully",
  "data": {
    "recommendation_id": "rec-123",
    "recorded_at": "2024-01-15T10:30:00Z"
  }
}
```

### Feature Engineering

#### POST `/api/learning/features/wine/extract`

Extract structured features from wine data.

**Request Body:**

```json
{
  "wine_id": 123
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "wine_id": 123,
    "features": {
      "wineType": 1,
      "region": 45,
      "bodyScore": 4.2,
      "acidityScore": 3.8,
      "tanninScore": 4.5,
      "complexityScore": 4.1
    },
    "extracted_at": "2024-01-15T10:30:00Z"
  }
}
```

#### POST `/api/learning/features/dish/extract`

Extract structured features from dish descriptions.

**Request Body:**

```json
{
  "dish_description": "Grilled ribeye steak with roasted vegetables"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "dish_description": "Grilled ribeye steak with roasted vegetables",
    "features": {
      "cuisineType": "american",
      "preparationMethod": "grilled",
      "proteinType": "beef",
      "richnessScore": 4.3,
      "complexityScore": 3.7
    },
    "extracted_at": "2024-01-15T10:30:00Z"
  }
}
```

### Learning Analytics

#### GET `/api/learning/weights/enhanced`

Get current enhanced pairing weights.

**Response:**

```json
{
  "success": true,
  "data": {
    "weights": {
      "style_match": 0.20,
      "flavor_harmony": 0.25,
      "texture_balance": 0.15,
      "regional_tradition": 0.12,
      "seasonal_appropriateness": 0.08,
      "acidity_match": 0.10,
      "tannin_balance": 0.05,
      "body_match": 0.05
    },
    "generated_at": "2024-01-15T10:30:00Z",
    "version": "enhanced_v1"
  }
}
```

#### GET `/api/learning/metrics`

Get learning performance metrics.

**Response:**

```json
{
  "success": true,
  "data": {
    "metrics": {
      "pairing_accuracy": 0.85,
      "user_satisfaction": 0.82,
      "feature_extraction_success_rate": 0.98,
      "feedback_quality_score": 0.91,
      "model_performance": {
        "precision": 0.87,
        "recall": 0.83,
        "f1_score": 0.85
      }
    },
    "period": "daily",
    "generated_at": "2024-01-15T10:30:00Z"
  }
}
```

### Data Validation

#### POST `/api/learning/validate/feedback`

Validate feedback data quality.

**Request Body:**

```json
{
  "recommendation_id": "rec-123",
  "ratings": {
    "overall": 4,
    "flavor_harmony": 5
  },
  "context": {
    "occasion": "dinner",
    "guest_count": 4
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "validation": {
      "isValid": true,
      "errors": [],
      "warnings": [],
      "sanitizedData": {
        "recommendation_id": "rec-123",
        "ratings": {
          "overall": 4,
          "flavor_harmony": 5
        },
        "context": {
          "occasion": "dinner",
          "guest_count": 4
        }
      }
    },
    "validated_at": "2024-01-15T10:30:00Z"
  }
}
```

## Database Schema

### Enhanced Feedback Table

```sql
CREATE TABLE LearningPairingFeedbackEnhanced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recommendation_id INTEGER NOT NULL,
    user_id TEXT,
    session_id INTEGER,
    
    -- Granular ratings (1-5 scale)
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    flavor_harmony_rating INTEGER CHECK (flavor_harmony_rating >= 1 AND flavor_harmony_rating <= 5),
    texture_balance_rating INTEGER CHECK (texture_balance_rating >= 1 AND texture_balance_rating <= 5),
    acidity_match_rating INTEGER CHECK (acidity_match_rating >= 1 AND acidity_match_rating <= 5),
    tannin_balance_rating INTEGER CHECK (tannin_balance_rating >= 1 AND tannin_balance_rating <= 5),
    body_match_rating INTEGER CHECK (body_match_rating >= 1 AND body_match_rating <= 5),
    regional_tradition_rating INTEGER CHECK (regional_tradition_rating >= 1 AND regional_tradition_rating <= 5),
    
    -- Contextual information
    occasion TEXT,
    guest_count INTEGER,
    time_of_day TEXT,
    season TEXT,
    weather_context TEXT,
    
    -- Behavioral data
    selected BOOLEAN DEFAULT 1,
    time_to_select INTEGER,
    viewed_duration INTEGER,
    
    -- Additional feedback
    notes TEXT,
    would_recommend BOOLEAN,
    price_satisfaction INTEGER CHECK (price_satisfaction >= 1 AND price_satisfaction <= 5),
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Feature Engineering Tables

```sql
CREATE TABLE WineFeatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wine_id INTEGER NOT NULL,
    grape_varieties TEXT,
    region_encoded TEXT,
    country_encoded TEXT,
    vintage_year INTEGER,
    alcohol_content REAL,
    price_tier TEXT,
    style_encoded TEXT,
    body_score REAL,
    acidity_score REAL,
    tannin_score REAL,
    sweetness_score REAL,
    complexity_score REAL,
    critic_score INTEGER,
    quality_score INTEGER,
    weather_score INTEGER,
    feature_vector TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE DishFeatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dish_description TEXT NOT NULL,
    dish_hash TEXT NOT NULL,
    cuisine_type TEXT,
    preparation_method TEXT,
    protein_type TEXT,
    cooking_style TEXT,
    flavor_intensity TEXT,
    texture_profile TEXT,
    spice_level TEXT,
    dominant_ingredients TEXT,
    flavor_notes TEXT,
    cooking_techniques TEXT,
    richness_score REAL,
    complexity_score REAL,
    acidity_level REAL,
    fat_content REAL,
    feature_vector TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Usage Examples

### 1. Recording Enhanced Feedback

```javascript
const feedbackData = {
    recommendation_id: 'rec-123',
    user_id: 'user-456',
    ratings: {
        overall: 4,
        flavor_harmony: 5,
        texture_balance: 3,
        acidity_match: 4,
        tannin_balance: 3,
        body_match: 4,
        regional_tradition: 5
    },
    context: {
        occasion: 'dinner',
        guest_count: 4,
        time_of_day: 'evening',
        season: 'autumn',
        weather_context: 'indoor'
    },
    behavioral_data: {
        selected: true,
        time_to_select: 45,
        viewed_duration: 120
    },
    additional_feedback: {
        notes: 'Excellent pairing with the main course',
        would_recommend: true,
        price_satisfaction: 4
    }
};

const response = await fetch('/api/learning/feedback/enhanced', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(feedbackData)
});

const result = await response.json();
console.log('Feedback recorded:', result);
```

### 2. Extracting Wine Features

```javascript
const wineId = 123;

const response = await fetch('/api/learning/features/wine/extract', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ wine_id: wineId })
});

const result = await response.json();
console.log('Wine features:', result.data.features);
```

### 3. Getting Learning Metrics

```javascript
const response = await fetch('/api/learning/metrics', {
    headers: {
        'Authorization': 'Bearer ' + token
    }
});

const result = await response.json();
console.log('Learning metrics:', result.data.metrics);
```

## Migration Guide

### 1. Database Migration

Run the database migration to add the new tables:

```bash
cd backend/database
node migrate.js migrate
```

### 2. Update API Integration

Replace the old learning engine with the enhanced version:

```javascript
// Old
const LearningEngine = require('../core/learning_engine');

// New
const EnhancedLearningEngine = require('../core/enhanced_learning_engine');
const FeatureEngineeringService = require('../core/feature_engineering_service');
const DataValidationService = require('../core/data_validation_service');
```

### 3. Update Feedback Collection

Update your feedback collection to use the enhanced format:

```javascript
// Old
await learningEngine.recordPairingFeedback(recommendationId, rating, notes, selected);

// New
await enhancedLearningEngine.recordEnhancedPairingFeedback({
    recommendation_id: recommendationId,
    ratings: { overall: rating },
    context: { occasion: 'dinner' },
    behavioral_data: { selected },
    additional_feedback: { notes }
});
```

## Performance Considerations

### 1. Feature Caching

- Wine features are cached for frequently accessed wines
- Dish features are cached by description hash
- Cache is automatically refreshed when wine data changes

### 2. Batch Processing

- Use batch endpoints for processing multiple items
- Batch size is limited to 100 items per request
- Consider rate limiting for high-volume operations

### 3. Database Optimization

- Indexes are created for frequently queried fields
- Feature vectors are stored as JSON for efficient retrieval
- Consider partitioning for large datasets

## Monitoring and Maintenance

### 1. Learning Metrics

- Monitor pairing accuracy and user satisfaction
- Track feature extraction success rates
- Analyze feedback quality scores

### 2. Data Quality

- Regular validation of feedback data
- Monitor for outliers and anomalies
- Clean up low-quality data

### 3. Performance Monitoring

- Track API response times
- Monitor database query performance
- Set up alerts for system issues

## Troubleshooting

### Common Issues

1. **Feature extraction fails**
   - Check wine data completeness
   - Verify database connectivity
   - Review error logs for specific issues

2. **Validation errors**
   - Ensure all required fields are provided
   - Check data types and ranges
   - Review validation rules

3. **Performance issues**
   - Check database indexes
   - Monitor memory usage
   - Consider batch processing

### Error Codes

- `400`: Invalid request data
- `404`: Resource not found
- `500`: Internal server error
- `503`: Service unavailable

## Future Enhancements

### Planned Features

1. **Machine Learning Models**: Neural networks and collaborative filtering
2. **Real-time Learning**: Online learning algorithms
3. **Advanced Analytics**: Predictive modeling and trend analysis
4. **A/B Testing**: Framework for testing different approaches
5. **Export/Import**: Data portability and backup features

### Contributing

1. Follow the existing code style
2. Add comprehensive tests
3. Update documentation
4. Submit pull requests for review

## Support

For questions or issues:

1. Check the troubleshooting section
2. Review the API documentation
3. Check the test files for examples
4. Contact the development team
