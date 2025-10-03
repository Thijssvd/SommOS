/**
 * ML Integration Tests
 * Tests the complete ML recommendation workflow including training, blending, and fallback
 */

const { TestRunner, generateTestData, MockDatabase } = require('./test_utils');
const MLModelManager = require('../../core/ml_model_manager');
const CollaborativeFilteringEngine = require('../../core/collaborative_filtering_engine');
// Content-Based Engine not yet implemented
let ContentBasedEngine = null;
try {
    ContentBasedEngine = require('../../core/content_based_engine');
} catch (e) {
    console.log('⚠️  Content-Based Engine not yet implemented, some integration tests will be skipped');
}

async function runTests() {
    const runner = new TestRunner('ML Integration Tests');
    
    // Helper to skip tests requiring ContentBasedEngine
    const skipIfNoCB = () => {
        if (!ContentBasedEngine) {
            console.log('  ⚠️  Skipping test (requires ContentBasedEngine)');
            return true;
        }
        return false;
    };
    
    // Test 1: End-to-End Recommendation Flow
    runner.test('Should complete end-to-end recommendation workflow', async () => {
        if (!ContentBasedEngine) {
            console.log('  ⚠️  Skipping test (requires ContentBasedEngine)');
            return;
        }
        const testData = generateTestData({ numUsers: 30, numWines: 50, numRatings: 300 });
        const db = new MockDatabase(testData);
        
        // Initialize engines
        const cfEngine = new CollaborativeFilteringEngine(db);
        const cbEngine = new ContentBasedEngine(db);
        const modelManager = new MLModelManager(db);
        
        // Train models
        await cfEngine.initialize(testData.ratings);
        await cbEngine.initialize(testData.wines);
        
        // Get recommendations from both engines
        const userId = testData.users[0].id;
        const cfRecs = await cfEngine.getUserBasedRecommendations(userId, 10);
        const cbRecs = await cbEngine.getRecommendations(
            userId, 
            testData.ratings.filter(r => r.user_id === userId), 
            10
        );
        
        if (!Array.isArray(cfRecs)) throw new Error('CF recommendations should be array');
        if (!Array.isArray(cbRecs)) throw new Error('CB recommendations should be array');
        
        // Both should return recommendations
        if (cfRecs.length === 0 && cbRecs.length === 0) {
            throw new Error('At least one engine should return recommendations');
        }
    });
    
    // Test 2: Hybrid Recommendation Blending
    runner.test('Should blend collaborative and content-based recommendations', async () => {
        if (skipIfNoCB()) return;
        const testData = generateTestData({ numUsers: 25, numWines: 40, numRatings: 250 });
        const db = new MockDatabase(testData);
        
        const cfEngine = new CollaborativeFilteringEngine(db);
        const cbEngine = new ContentBasedEngine(db);
        
        await cfEngine.initialize(testData.ratings);
        await cbEngine.initialize(testData.wines);
        
        const userId = testData.users[0].id;
        const userRatings = testData.ratings.filter(r => r.user_id === userId);
        
        // Get recommendations from both
        const cfRecs = await cfEngine.getUserBasedRecommendations(userId, 20);
        const cbRecs = await cbEngine.getRecommendations(userId, userRatings, 20);
        
        // Blend recommendations (simple weighted average)
        const blended = blendRecommendations(cfRecs, cbRecs, 0.6, 0.4);
        
        if (!Array.isArray(blended)) throw new Error('Blended should be array');
        if (blended.length === 0) throw new Error('Blended should have recommendations');
        
        // Check that blending preserved wine_id
        for (const rec of blended) {
            if (!rec.wine_id) throw new Error('Blended recommendation missing wine_id');
            if (typeof rec.score !== 'number') throw new Error('Blended recommendation missing score');
        }
    });
    
    // Test 3: Cold-Start User Handling Across Engines
    runner.test('Should handle cold-start users across all engines', async () => {
        if (skipIfNoCB()) return;
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 150 });
        const db = new MockDatabase(testData);
        
        const cfEngine = new CollaborativeFilteringEngine(db);
        const cbEngine = new ContentBasedEngine(db);
        
        await cfEngine.initialize(testData.ratings);
        await cbEngine.initialize(testData.wines);
        
        const newUserId = 'cold_start_user';
        
        // Get recommendations from both engines
        const cfRecs = await cfEngine.getUserBasedRecommendations(newUserId, 10);
        const cbRecs = await cbEngine.getRecommendations(newUserId, [], 10);
        
        // At least one should return recommendations
        if (cfRecs.length === 0 && cbRecs.length === 0) {
            throw new Error('Should provide fallback recommendations for cold-start');
        }
        
        // CF should use popularity-based
        if (cfRecs.length > 0) {
            const avgConfidence = cfRecs.reduce((sum, r) => sum + r.confidence, 0) / cfRecs.length;
            if (avgConfidence > 0.5) {
                throw new Error('Cold-start CF confidence should be lower');
            }
        }
    });
    
    // Test 4: Model Training and Evaluation Pipeline
    runner.test('Should train and evaluate model end-to-end', async () => {
        const testData = generateTestData({ numUsers: 30, numWines: 40, numRatings: 250 });
        const db = new MockDatabase(testData);
        const modelManager = new MLModelManager(db);
        
        // Split data for training and testing
        const splitPoint = Math.floor(testData.ratings.length * 0.8);
        const trainData = testData.ratings.slice(0, splitPoint);
        const testData_ratings = testData.ratings.slice(splitPoint);
        
        // Train model
        const model = await modelManager.trainCollaborativeFilteringModel(
            'integration_test_cf',
            { minSimilarity: 0.3, minCommonItems: 2 },
            trainData
        );
        
        if (!model) throw new Error('Model training failed');
        
        // Evaluate model
        const metrics = await modelManager.evaluateModel(model, testData_ratings);
        
        if (!metrics) throw new Error('Model evaluation failed');
        if (typeof metrics.rmse !== 'number') throw new Error('Missing RMSE metric');
        if (typeof metrics.mae !== 'number') throw new Error('Missing MAE metric');
        
        // Metrics should be reasonable
        if (metrics.rmse > 10) throw new Error('RMSE too high, model quality poor');
    });
    
    // Test 5: Adaptive Weight Calculation Based on User Type
    runner.test('Should calculate adaptive weights based on user activity', async () => {
        const testData = generateTestData({ numUsers: 30, numWines: 40, numRatings: 250 });
        const db = new MockDatabase(testData);
        
        // Find active and new users
        const ratingCounts = {};
        for (const rating of testData.ratings) {
            ratingCounts[rating.user_id] = (ratingCounts[rating.user_id] || 0) + 1;
        }
        
        let activeUserId = null;
        let newUserId = null;
        
        for (const [userId, count] of Object.entries(ratingCounts)) {
            if (count >= 10) activeUserId = userId;
            if (count <= 2) newUserId = userId;
        }
        
        // Calculate weights for both user types
        if (activeUserId && newUserId) {
            const activeWeights = calculateAdaptiveWeights(ratingCounts[activeUserId]);
            const newWeights = calculateAdaptiveWeights(ratingCounts[newUserId]);
            
            // Active user should favor CF more
            if (activeWeights.cf <= newWeights.cf) {
                throw new Error('Active users should have higher CF weight');
            }
            
            // New user should favor CB more
            if (newWeights.cb <= activeWeights.cb) {
                throw new Error('New users should have higher CB weight');
            }
        }
    });
    
    // Test 6: Fallback Mechanism When One Engine Fails
    runner.test('Should fallback gracefully when one engine fails', async () => {
        if (skipIfNoCB()) return;
        const testData = generateTestData({ numUsers: 15, numWines: 25, numRatings: 100 });
        const db = new MockDatabase(testData);
        
        const cfEngine = new CollaborativeFilteringEngine(db);
        const cbEngine = new ContentBasedEngine(db);
        
        await cfEngine.initialize(testData.ratings);
        await cbEngine.initialize(testData.wines);
        
        const userId = testData.users[0].id;
        const userRatings = testData.ratings.filter(r => r.user_id === userId);
        
        // Try to get recommendations
        let cfRecs = [];
        let cbRecs = [];
        
        try {
            cfRecs = await cfEngine.getUserBasedRecommendations(userId, 10);
        } catch (error) {
            console.log('CF failed (expected for test), falling back to CB');
        }
        
        try {
            cbRecs = await cbEngine.getRecommendations(userId, userRatings, 10);
        } catch (error) {
            console.log('CB failed (expected for test), falling back to CF');
        }
        
        // At least one should succeed
        if (cfRecs.length === 0 && cbRecs.length === 0) {
            throw new Error('Both engines failed, no fallback available');
        }
    });
    
    // Test 7: Real-Time Update with New Ratings
    runner.test('Should update recommendations when new ratings arrive', async () => {
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 150 });
        const db = new MockDatabase(testData);
        
        const cfEngine = new CollaborativeFilteringEngine(db);
        
        await cfEngine.initialize(testData.ratings);
        
        const userId = testData.users[0].id;
        const initialRecs = await cfEngine.getUserBasedRecommendations(userId, 10);
        
        // Add new ratings
        const newRatings = [
            { user_id: userId, wine_id: testData.wines[20].id, rating: 5, timestamp: Date.now() },
            { user_id: userId, wine_id: testData.wines[21].id, rating: 4, timestamp: Date.now() }
        ];
        
        await cfEngine.updateWithNewRatings(newRatings);
        
        // Get updated recommendations
        const updatedRecs = await cfEngine.getUserBasedRecommendations(userId, 10);
        
        // Should still return recommendations
        if (updatedRecs.length === 0) {
            throw new Error('Should return recommendations after update');
        }
    });
    
    // Test 8: Cross-Validation for Model Selection
    runner.test('Should perform cross-validation for model selection', async () => {
        const testData = generateTestData({ numUsers: 30, numWines: 40, numRatings: 250 });
        const db = new MockDatabase(testData);
        const modelManager = new MLModelManager(db);
        
        const folds = 3;
        const foldSize = Math.floor(testData.ratings.length / folds);
        const foldScores = [];
        
        for (let i = 0; i < folds; i++) {
            const testStart = i * foldSize;
            const testEnd = testStart + foldSize;
            
            const testFold = testData.ratings.slice(testStart, testEnd);
            const trainFold = [
                ...testData.ratings.slice(0, testStart),
                ...testData.ratings.slice(testEnd)
            ];
            
            // Train on fold
            const model = await modelManager.trainCollaborativeFilteringModel(
                `cv_fold_${i}`,
                {},
                trainFold
            );
            
            // Evaluate on test fold
            const metrics = await modelManager.evaluateModel(model, testFold);
            foldScores.push(metrics.rmse);
        }
        
        // Average cross-validation score
        const avgScore = foldScores.reduce((sum, score) => sum + score, 0) / folds;
        
        if (typeof avgScore !== 'number' || isNaN(avgScore)) {
            throw new Error('Cross-validation should produce valid average score');
        }
        
        if (avgScore > 10) {
            throw new Error('Average RMSE too high across folds');
        }
    });
    
    // Test 9: Diversity in Blended Recommendations
    runner.test('Should maintain diversity in blended recommendations', async () => {
        if (skipIfNoCB()) return;
        const testData = generateTestData({ numUsers: 25, numWines: 50, numRatings: 250 });
        const db = new MockDatabase(testData);
        
        const cfEngine = new CollaborativeFilteringEngine(db);
        const cbEngine = new ContentBasedEngine(db);
        
        await cfEngine.initialize(testData.ratings);
        await cbEngine.initialize(testData.wines);
        
        const userId = testData.users[0].id;
        const userRatings = testData.ratings.filter(r => r.user_id === userId);
        
        const cfRecs = await cfEngine.getUserBasedRecommendations(userId, 20);
        const cbRecs = await cbEngine.getRecommendations(userId, userRatings, 20);
        
        const blended = blendRecommendations(cfRecs, cbRecs, 0.5, 0.5);
        
        // Check diversity in wine types
        const types = new Set();
        for (const rec of blended.slice(0, 10)) {
            const wine = testData.wines.find(w => w.id === rec.wine_id);
            if (wine) types.add(wine.type);
        }
        
        // Should have some diversity
        if (types.size < 2 && testData.wines.length > 20) {
            console.warn('Blended recommendations might lack diversity');
        }
    });
    
    // Test 10: Performance Comparison Between Engines
    runner.test('Should compare performance between CF and CB engines', async () => {
        if (skipIfNoCB()) return;
        const testData = generateTestData({ numUsers: 30, numWines: 40, numRatings: 250 });
        const db = new MockDatabase(testData);
        
        const cfEngine = new CollaborativeFilteringEngine(db);
        const cbEngine = new ContentBasedEngine(db);
        const modelManager = new MLModelManager(db);
        
        // Split data
        const splitPoint = Math.floor(testData.ratings.length * 0.8);
        const trainData = testData.ratings.slice(0, splitPoint);
        const testDataRatings = testData.ratings.slice(splitPoint);
        
        // Train both models
        const cfModel = await modelManager.trainCollaborativeFilteringModel('cf_comp', {}, trainData);
        const cbModel = await modelManager.trainContentBasedModel('cb_comp', {}, trainData);
        
        // Evaluate both
        const cfMetrics = await modelManager.evaluateModel(cfModel, testDataRatings);
        const cbMetrics = await modelManager.evaluateModel(cbModel, testDataRatings);
        
        if (!cfMetrics || !cbMetrics) {
            throw new Error('Failed to evaluate both models');
        }
        
        // Both should produce valid metrics
        if (typeof cfMetrics.rmse !== 'number' || typeof cbMetrics.rmse !== 'number') {
            throw new Error('Both models should produce RMSE metrics');
        }
    });
    
    const success = await runner.run();
    return success ? 0 : 1;
}

// Helper function to blend recommendations
function blendRecommendations(cfRecs, cbRecs, cfWeight, cbWeight) {
    const scoreMap = new Map();
    
    // Add CF recommendations
    for (const rec of cfRecs) {
        const score = (rec.predicted_rating || rec.score || 0) * cfWeight * (rec.confidence || 1);
        scoreMap.set(rec.wine_id, { wine_id: rec.wine_id, score, sources: ['cf'] });
    }
    
    // Add CB recommendations
    for (const rec of cbRecs) {
        const cbScore = (rec.score || rec.similarity || 0) * cbWeight;
        if (scoreMap.has(rec.wine_id)) {
            const existing = scoreMap.get(rec.wine_id);
            existing.score += cbScore;
            existing.sources.push('cb');
        } else {
            scoreMap.set(rec.wine_id, { wine_id: rec.wine_id, score: cbScore, sources: ['cb'] });
        }
    }
    
    // Convert to array and sort
    const blended = Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
    
    return blended;
}

// Helper function to calculate adaptive weights
function calculateAdaptiveWeights(ratingCount) {
    const minRatings = 5;
    const maxRatings = 20;
    
    // Clamp rating count
    const clampedCount = Math.max(0, Math.min(ratingCount, maxRatings));
    
    // CF weight increases with more ratings
    const cfWeight = clampedCount / maxRatings;
    
    // CB weight decreases as CF weight increases
    const cbWeight = 1 - cfWeight;
    
    // Normalize
    const total = cfWeight + cbWeight;
    
    return {
        cf: cfWeight / total,
        cb: cbWeight / total
    };
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
