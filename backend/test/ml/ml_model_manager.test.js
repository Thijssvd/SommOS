/**
 * ML Model Manager Tests
 * Tests for model training, evaluation, versioning, and A/B testing
 */

const { TestRunner, generateTestData, MockDatabase } = require('./test_utils');
const MLModelManager = require('../../core/ml_model_manager');

async function runTests() {
    const runner = new TestRunner('ML Model Manager Tests');
    
    // Test 1: Model Training with Sample Dataset
    runner.test('Should train collaborative filtering model with real data', async () => {
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 150 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        const model = await manager.trainCollaborativeFilteringModel(
            'pearson_cf',
            { minSimilarity: 0.3, minCommonItems: 2 },
            testData.ratings
        );
        
        if (!model) throw new Error('Model training returned null');
        if (model.type !== 'collaborative_filtering') throw new Error('Wrong model type');
        if (!model.similarityMatrix) throw new Error('No similarity matrix');
        if (!model.userProfiles) throw new Error('No user profiles');
        if (!model.itemProfiles) throw new Error('No item profiles');
        if (!model.statistics) throw new Error('No statistics');
        
        // Check statistics
        if (model.statistics.totalUsers !== 20) {
            throw new Error(`Expected 20 users, got ${model.statistics.totalUsers}`);
        }
    });
    
    // Test 2: Content-Based Model Training
    runner.test('Should train content-based model', async () => {
        const testData = generateTestData({ numUsers: 10, numWines: 20, numRatings: 80 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        const model = await manager.trainContentBasedModel(
            'content_cf',
            {},
            testData.ratings
        );
        
        if (!model) throw new Error('Model training returned null');
        if (model.type !== 'content_based') throw new Error('Wrong model type');
        if (!model.featureWeights) throw new Error('No feature weights');
        if (!model.itemFeatures) throw new Error('No item features');
    });
    
    // Test 3: Model Versioning
    runner.test('Should create model with proper versioning', async () => {
        const testData = generateTestData({ numUsers: 10, numWines: 15, numRatings: 60 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        const result = await manager.createModel({
            name: 'test_model',
            type: 'collaborative_filtering',
            algorithm: 'pearson_cf',
            parameters: {},
            trainingData: testData.ratings,
            metadata: {}
        });
        
        if (!result.modelId) throw new Error('No model ID generated');
        if (!result.version) throw new Error('No version generated');
        if (!result.performance) throw new Error('No performance metrics');
    });
    
    // Test 4: Model Evaluation
    runner.test('Should evaluate model with real metrics', async () => {
        const testData = generateTestData({ numUsers: 15, numWines: 25, numRatings: 100 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        // Train model
        const model = await manager.trainCollaborativeFilteringModel(
            'pearson_cf',
            {},
            testData.ratings.slice(0, 80)
        );
        
        // Evaluate on test set
        const metrics = await manager.evaluateModel(model, testData.ratings.slice(80));
        
        if (!metrics) throw new Error('Evaluation returned null');
        if (typeof metrics.accuracy !== 'number') throw new Error('No accuracy metric');
        if (typeof metrics.rmse !== 'number') throw new Error('No RMSE metric');
        if (typeof metrics.mae !== 'number') throw new Error('No MAE metric');
        if (typeof metrics.precision !== 'number') throw new Error('No precision metric');
        if (typeof metrics.recall !== 'number') throw new Error('No recall metric');
        if (typeof metrics.f1_score !== 'number') throw new Error('No F1 score');
        
        // Metrics should be in valid ranges
        if (metrics.accuracy < 0 || metrics.accuracy > 1) {
            throw new Error(`Accuracy out of range: ${metrics.accuracy}`);
        }
    });
    
    // Test 5: Pearson Correlation Calculation
    runner.test('Should calculate Pearson correlation correctly', async () => {
        const db = new MockDatabase();
        const manager = new MLModelManager(db);
        
        // Test with known values
        const x = [1, 2, 3, 4, 5];
        const y = [2, 4, 6, 8, 10]; // Perfect positive correlation
        
        const correlation = manager.pearsonCorrelation(x, y);
        
        if (Math.abs(correlation - 1.0) > 0.01) {
            throw new Error(`Expected correlation ~1.0, got ${correlation}`);
        }
        
        // Test with negative correlation
        const z = [5, 4, 3, 2, 1];
        const negCorr = manager.pearsonCorrelation(x, z);
        
        if (Math.abs(negCorr - (-1.0)) > 0.01) {
            throw new Error(`Expected correlation ~-1.0, got ${negCorr}`);
        }
    });
    
    // Test 6: A/B Testing
    runner.test('Should perform A/B test with real predictions', async () => {
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 150 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        // Train two models
        const model1 = await manager.trainCollaborativeFilteringModel('cf1', {}, testData.ratings.slice(0, 100));
        const model2 = await manager.trainCollaborativeFilteringModel('cf2', {}, testData.ratings.slice(0, 100));
        
        // Run A/B test
        const result = await manager.runABTestPredictions(
            model1,
            model2,
            testData.ratings.slice(100),
            0.5
        );
        
        if (!result.model1Results) throw new Error('No model 1 results');
        if (!result.model2Results) throw new Error('No model 2 results');
        if (typeof result.statisticalSignificance !== 'number') {
            throw new Error('No statistical significance');
        }
        if (!result.significanceLevel) throw new Error('No significance level');
    });
    
    // Test 7: Prediction with Cold-Start User
    runner.test('Should handle predictions for cold-start scenarios', async () => {
        const testData = generateTestData({ numUsers: 10, numWines: 20, numRatings: 60 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        const model = await manager.trainCollaborativeFilteringModel('cf', {}, testData.ratings);
        
        // Predict for new user
        const prediction = await manager.predictRating(model, {
            user_id: 'new_user',
            wine_id: 1
        });
        
        // Should return item average or default
        if (prediction === null) throw new Error('Prediction returned null for cold-start');
        if (prediction < 1 || prediction > 5) {
            throw new Error(`Prediction out of range: ${prediction}`);
        }
    });
    
    // Test 8: Similarity Matrix Construction
    runner.test('Should build non-empty similarity matrices', async () => {
        const testData = generateTestData({ numUsers: 15, numWines: 25, numRatings: 100 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        const matrices = await manager.buildSimilarityMatrix(testData.ratings, 0.3, 2);
        
        if (!matrices) throw new Error('Similarity matrix is null');
        if (!matrices.users || !matrices.items) {
            throw new Error('Missing users or items in similarity matrix');
        }
        
        const userCount = Object.keys(matrices.users).length;
        const itemCount = Object.keys(matrices.items).length;
        
        if (userCount === 0 && itemCount === 0) {
            throw new Error('Both similarity matrices are empty');
        }
    });
    
    // Test 9: User and Item Profiles
    runner.test('Should build user and item profiles correctly', async () => {
        const testData = generateTestData({ numUsers: 10, numWines: 15, numRatings: 60 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        const userProfiles = await manager.buildUserProfiles(testData.ratings);
        const itemProfiles = await manager.buildItemProfiles(testData.ratings);
        
        if (Object.keys(userProfiles).length === 0) {
            throw new Error('No user profiles created');
        }
        if (Object.keys(itemProfiles).length === 0) {
            throw new Error('No item profiles created');
        }
        
        // Check profile structure
        const firstUser = Object.values(userProfiles)[0];
        if (!firstUser.ratings) throw new Error('User profile missing ratings');
        if (typeof firstUser.avgRating !== 'number') throw new Error('User profile missing avgRating');
        if (!firstUser.items) throw new Error('User profile missing items');
        
        const firstItem = Object.values(itemProfiles)[0];
        if (!firstItem.ratings) throw new Error('Item profile missing ratings');
        if (typeof firstItem.avgRating !== 'number') throw new Error('Item profile missing avgRating');
        if (typeof firstItem.popularity !== 'number') throw new Error('Item profile missing popularity');
    });
    
    // Test 10: Statistical Significance Calculation
    runner.test('Should calculate statistical significance correctly', async () => {
        const db = new MockDatabase();
        const manager = new MLModelManager(db);
        
        // Test with clear winner
        const highSignificance = manager.calculateStatisticalSignificance(0.85, 1000, 0.75, 1000);
        if (highSignificance < 0.95) {
            throw new Error(`Expected high significance (>0.95), got ${highSignificance}`);
        }
        
        // Test with similar results
        const lowSignificance = manager.calculateStatisticalSignificance(0.80, 100, 0.79, 100);
        if (lowSignificance > 0.80) {
            throw new Error(`Expected low significance (<0.80), got ${lowSignificance}`);
        }
    });
    
    const success = await runner.run();
    return success ? 0 : 1;
}

// Run tests if executed directly
if (require.main === module) {
    runTests().then(exitCode => {
        process.exit(exitCode);
    }).catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = { runTests };
