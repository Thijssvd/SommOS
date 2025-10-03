/**
 * Basic ML Test Runner
 * Tests the core ML functionality that's currently implemented
 */

const { TestRunner, generateTestData, MockDatabase } = require('./test_utils');
const MLModelManager = require('../../core/ml_model_manager');

async function runBasicTests() {
    const runner = new TestRunner('Basic ML Tests');
    
    // Test 1: Model Training
    runner.test('Should train collaborative filtering model', async () => {
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 150 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        const model = await manager.trainCollaborativeFilteringModel(
            'test_cf',
            { minSimilarity: 0.3, minCommonItems: 2 },
            testData.ratings
        );
        
        if (!model) throw new Error('Model training returned null');
        if (model.type !== 'collaborative_filtering') throw new Error('Wrong model type');
    });
    
    // Test 2: Model Evaluation
    runner.test('Should evaluate model with metrics', async () => {
        const testData = generateTestData({ numUsers: 15, numWines: 25, numRatings: 100 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        // Split data
        const splitPoint = Math.floor(testData.ratings.length * 0.8);
        const trainData = testData.ratings.slice(0, splitPoint);
        const testDataRatings = testData.ratings.slice(splitPoint);
        
        // Train and evaluate
        const model = await manager.trainCollaborativeFilteringModel('eval_test', {}, trainData);
        const metrics = await manager.evaluateModel(model, testDataRatings);
        
        if (!metrics) throw new Error('Evaluation returned null');
        if (typeof metrics.rmse !== 'number') throw new Error('No RMSE metric');
        if (typeof metrics.mae !== 'number') throw new Error('No MAE metric');
    });
    
    // Test 3: User and Item Profiles
    runner.test('Should build user and item profiles', async () => {
        const testData = generateTestData({ numUsers: 10, numWines: 15, numRatings: 60 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
        const userProfiles = await manager.buildUserProfiles(testData.ratings);
        const itemProfiles = await manager.buildItemProfiles(testData.ratings);
        
        if (Object.keys(userProfiles).length === 0) throw new Error('No user profiles');
        if (Object.keys(itemProfiles).length === 0) throw new Error('No item profiles');
    });
    
    // Test 4: Pearson Correlation
    runner.test('Should calculate Pearson correlation', async () => {
        const db = new MockDatabase();
        const manager = new MLModelManager(db);
        
        const x = [1, 2, 3, 4, 5];
        const y = [2, 4, 6, 8, 10];
        
        const correlation = manager.pearsonCorrelation(x, y);
        
        if (Math.abs(correlation - 1.0) > 0.01) {
            throw new Error(`Expected correlation ~1.0, got ${correlation}`);
        }
    });
    
    // Test 5: Statistical Significance
    runner.test('Should calculate statistical significance', async () => {
        const db = new MockDatabase();
        const manager = new MLModelManager(db);
        
        const highSignificance = manager.calculateStatisticalSignificance(0.85, 1000, 0.75, 1000);
        if (highSignificance < 0.95) {
            throw new Error(`Expected high significance, got ${highSignificance}`);
        }
    });
    
    // Test 6: Cross-Validation
    runner.test('Should perform cross-validation', async () => {
        const testData = generateTestData({ numUsers: 30, numWines: 40, numRatings: 250 });
        const db = new MockDatabase(testData);
        const manager = new MLModelManager(db);
        
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
            
            const model = await manager.trainCollaborativeFilteringModel(`cv_${i}`, {}, trainFold);
            const metrics = await manager.evaluateModel(model, testFold);
            foldScores.push(metrics.rmse);
        }
        
        const avgScore = foldScores.reduce((sum, score) => sum + score, 0) / folds;
        
        if (typeof avgScore !== 'number' || isNaN(avgScore)) {
            throw new Error('Cross-validation produced invalid score');
        }
    });
    
    const success = await runner.run();
    return success ? 0 : 1;
}

// Run tests
if (require.main === module) {
    console.log('\n🧪 Running Basic ML Tests...\n');
    runBasicTests().then(exitCode => {
        console.log('\n✅ Basic tests completed!\n');
        process.exit(exitCode);
    }).catch(error => {
        console.error('\n❌ Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = { runBasicTests };
