# SommOS ML Test Suite

Comprehensive test suite for the SommOS Machine Learning recommendation system.

## Overview

This test suite provides thorough coverage of all ML components including:
- **ML Model Manager**: Model training, evaluation, versioning, and A/B testing
- **Collaborative Filtering Engine**: User-based and item-based recommendations with cold-start handling
- **Content-Based Engine**: Feature extraction, similarity calculation, and content-based recommendations
- **Integration Tests**: Complete ML workflow including training, blending, and fallback mechanisms

## Directory Structure

```
test/ml/
├── README.md                                    # This file
├── test_utils.js                                # Shared test utilities and mock data generation
├── ml_model_manager.test.js                     # ML Model Manager tests (10 tests)
├── collaborative_filtering_engine.test.js       # Collaborative Filtering tests (15 tests)
├── content_based_engine.test.js                 # Content-Based Engine tests (20 tests)
├── integration.test.js                          # Integration tests (10 tests)
└── run_all_tests.js                             # Master test runner
```

## Running Tests

### Run All Tests
```bash
cd backend/test/ml
node run_all_tests.js
```

### Run Individual Test Suites
```bash
# ML Model Manager tests
node ml_model_manager.test.js

# Collaborative Filtering tests
node collaborative_filtering_engine.test.js

# Content-Based Engine tests
node content_based_engine.test.js

# Integration tests
node integration.test.js
```

## Test Coverage

### ML Model Manager Tests (10 tests)
1. Model training with sample dataset
2. Content-based model training
3. Model versioning
4. Model evaluation with real metrics
5. Pearson correlation calculation
6. A/B testing with real predictions
7. Prediction with cold-start user
8. Similarity matrix construction
9. User and item profiles
10. Statistical significance calculation

### Collaborative Filtering Engine Tests (15 tests)
1. User-based recommendations for active users
2. Item-based recommendations
3. Cold-start user handling (zero ratings)
4. Semi-cold-start user handling (few ratings)
5. Similar user finding
6. Similar items finding
7. Prediction for specific user-item pair
8. Confidence score calculation
9. Popularity-based recommendations
10. Content-based similar wines
11. Filtering already rated items
12. Handling empty ratings
13. Stock availability impact
14. Minimum similarity threshold
15. Update with new ratings

### Content-Based Engine Tests (20 tests)
1. Feature extraction from wine attributes
2. Wine-to-wine similarity calculation
3. Recommendations based on user profile
4. Similar wines based on specific wine
5. Feature weight learning from ratings
6. User profile building
7. Cosine similarity calculation
8. Cold-start user handling
9. Type-based similarity
10. Region-based similarity
11. Grape variety similarity
12. Price range similarity
13. Vintage year impact
14. Quality score integration
15. Filtering already rated wines
16. Diversity in recommendations
17. Handling missing features
18. Update feature vectors
19. TF-IDF for text features
20. Performance with large wine catalog

### Integration Tests (10 tests)
1. End-to-end recommendation flow
2. Hybrid recommendation blending
3. Cold-start user handling across engines
4. Model training and evaluation pipeline
5. Adaptive weight calculation based on user type
6. Fallback mechanism when one engine fails
7. Real-time update with new ratings
8. Cross-validation for model selection
9. Diversity in blended recommendations
10. Performance comparison between engines

## Test Utilities

### generateTestData(options)
Generates realistic test data for wines, users, and ratings.

**Options:**
- `numUsers`: Number of users to generate (default: 50)
- `numWines`: Number of wines to generate (default: 100)
- `numRatings`: Number of ratings to generate (default: 500)
- `sparsityFactor`: Controls rating distribution sparsity (0-1, default: 0.7)

**Returns:**
```javascript
{
    users: [...],    // Array of user objects
    wines: [...],    // Array of wine objects
    ratings: [...]   // Array of rating objects
}
```

### MockDatabase
A lightweight mock database for testing that implements the necessary query interfaces.

**Usage:**
```javascript
const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 150 });
const db = new MockDatabase(testData);
```

### TestRunner
Simple test runner class with assertion helpers.

**Usage:**
```javascript
const runner = new TestRunner('My Test Suite');

runner.test('Should do something', async () => {
    // Test code here
    if (condition) throw new Error('Test failed');
});

const success = await runner.run();
```

## Test Data Characteristics

### Users
- Realistic user IDs and names
- Preference tags (red, white, sparkling, sweet, dry, etc.)
- Geographic locations
- Activity levels vary (cold-start to very active)

### Wines
- Multiple wine types (red, white, rosé, sparkling)
- Various regions (Bordeaux, Burgundy, Tuscany, Napa Valley, etc.)
- Grape varieties (Cabernet Sauvignon, Pinot Noir, Chardonnay, etc.)
- Price ranges ($10-$200)
- Quality scores (3.0-5.0)
- Vintage years (2015-2024)
- Stock quantities (0-100 bottles)

### Ratings
- Scale of 1-5 stars
- Realistic timestamp distribution
- Configurable sparsity to simulate real-world conditions
- Biased towards higher ratings (realistic user behavior)

## Expected Behavior

### Cold-Start Scenarios
- **Zero ratings**: System falls back to popularity-based recommendations
- **1-2 ratings**: Blended approach with low confidence
- **3-5 ratings**: Increasing collaborative filtering weight
- **5+ ratings**: Full collaborative filtering with high confidence

### Similarity Thresholds
- Minimum similarity: 0.3 (configurable)
- Minimum common items: 2 (configurable)
- Minimum similar users: 3 (configurable)

### Performance Expectations
- Model initialization: < 5 seconds for 200 wines
- Recommendation generation: < 2 seconds
- Model training: < 10 seconds for 250 ratings
- Evaluation: < 5 seconds

## Continuous Integration

To integrate with CI/CD pipelines:

```bash
# Add to package.json scripts
"test:ml": "node backend/test/ml/run_all_tests.js",
"test:ml:unit": "node backend/test/ml/ml_model_manager.test.js && node backend/test/ml/collaborative_filtering_engine.test.js && node backend/test/ml/content_based_engine.test.js",
"test:ml:integration": "node backend/test/ml/integration.test.js"
```

Then run:
```bash
npm run test:ml
```

## Debugging Tests

To debug individual tests:

1. Add console.log statements in test functions
2. Run individual test files instead of the full suite
3. Use Node.js debugger:
   ```bash
   node --inspect-brk ml_model_manager.test.js
   ```

## Future Enhancements

Potential test additions:
- [ ] Performance benchmarking tests
- [ ] Stress tests with very large datasets (1000+ users, 5000+ wines)
- [ ] Recommendation quality tests (human evaluation simulation)
- [ ] Edge case tests (invalid data, network failures, etc.)
- [ ] Load tests for concurrent recommendations
- [ ] Memory usage profiling
- [ ] ML model drift detection tests
- [ ] Explainability tests (reasoning validation)

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use descriptive test names
3. Include appropriate assertions
4. Test both success and failure cases
5. Document expected behavior
6. Update this README with new test descriptions

## License

Part of the SommOS project.
