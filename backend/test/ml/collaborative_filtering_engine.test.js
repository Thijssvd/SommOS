/**
 * Collaborative Filtering Engine Tests
 * Tests for user-based and item-based recommendations with cold-start handling
 */

const { TestRunner, generateTestData, MockDatabase } = require('./test_utils');
const CollaborativeFilteringEngine = require('../../core/collaborative_filtering_engine');

async function runTests() {
    const runner = new TestRunner('Collaborative Filtering Engine Tests');
    
    // Test 1: User-Based Recommendations for Active Users
    runner.test('Should generate user-based recommendations for active users', async () => {
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 200 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        // Get recommendations for first user (engine works directly with DB)
        const userId = testData.users[0].id;
        const recommendations = await engine.getUserBasedRecommendations(userId, null, { limit: 10 });
        
        if (!Array.isArray(recommendations)) {
            throw new Error('Recommendations should be an array');
        }
        if (recommendations.length === 0) {
            throw new Error('Should return at least some recommendations');
        }
        
        // Check recommendation structure
        const firstRec = recommendations[0];
        if (!firstRec.wine_id) throw new Error('Missing wine_id in recommendation');
        if (typeof firstRec.predicted_rating !== 'number') {
            throw new Error('Missing predicted_rating');
        }
        if (typeof firstRec.confidence !== 'number') {
            throw new Error('Missing confidence score');
        }
        if (firstRec.predicted_rating < 1 || firstRec.predicted_rating > 5) {
            throw new Error(`Predicted rating out of range: ${firstRec.predicted_rating}`);
        }
    });
    
    // Test 2: Item-Based Recommendations
    runner.test('Should generate item-based recommendations', async () => {
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 200 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        const userId = testData.users[0].id;
        const recommendations = await engine.getItemBasedRecommendations(userId, 10);
        
        if (!Array.isArray(recommendations)) {
            throw new Error('Recommendations should be an array');
        }
        if (recommendations.length === 0) {
            throw new Error('Should return at least some recommendations');
        }
        
        // Check recommendation structure
        const firstRec = recommendations[0];
        if (!firstRec.wine_id) throw new Error('Missing wine_id');
        if (typeof firstRec.predicted_rating !== 'number') {
            throw new Error('Missing predicted_rating');
        }
        if (typeof firstRec.confidence !== 'number') {
            throw new Error('Missing confidence');
        }
    });
    
    // Test 3: Cold-Start User (Zero Ratings)
    runner.test('Should handle cold-start users with popularity-based recommendations', async () => {
        const testData = generateTestData({ numUsers: 15, numWines: 25, numRatings: 150 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        // Request recommendations for new user
        const newUserId = 'brand_new_user';
        const recommendations = await engine.getUserBasedRecommendations(newUserId, 10);
        
        if (!Array.isArray(recommendations)) {
            throw new Error('Should return array for cold-start user');
        }
        if (recommendations.length === 0) {
            throw new Error('Should return popularity-based recommendations');
        }
        
        // Should be popularity-based
        const firstRec = recommendations[0];
        if (firstRec.confidence > 0.5) {
            throw new Error('Cold-start confidence should be low');
        }
    });
    
    // Test 4: Semi-Cold-Start User (Few Ratings)
    runner.test('Should handle semi-cold-start users with blended recommendations', async () => {
        const testData = generateTestData({ 
            numUsers: 15, 
            numWines: 25, 
            numRatings: 150,
            sparsityFactor: 0.8 // Make ratings sparse
        });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        // Find a user with only 1-2 ratings
        let semiColdUser = null;
        for (const user of testData.users) {
            const userRatings = testData.ratings.filter(r => r.user_id === user.id);
            if (userRatings.length >= 1 && userRatings.length <= 2) {
                semiColdUser = user.id;
                break;
            }
        }
        
        if (semiColdUser) {
            const recommendations = await engine.getUserBasedRecommendations(semiColdUser, 10);
            
            if (!Array.isArray(recommendations)) {
                throw new Error('Should return array for semi-cold-start user');
            }
            if (recommendations.length === 0) {
                throw new Error('Should return recommendations');
            }
            
            // Confidence should be moderate
            const avgConfidence = recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length;
            if (avgConfidence > 0.7) {
                throw new Error('Semi-cold-start confidence should be moderate');
            }
        }
    });
    
    // Test 5: Similar User Finding
    runner.test('Should find similar users based on rating patterns', async () => {
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 200 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        const userId = testData.users[0].id;
        const similarUsers = await engine.findSimilarUsers(userId, 5);
        
        if (!Array.isArray(similarUsers)) {
            throw new Error('Similar users should be an array');
        }
        
        // Each similar user should have similarity score
        for (const sim of similarUsers) {
            if (!sim.user_id) throw new Error('Missing user_id in similar user');
            if (typeof sim.similarity !== 'number') {
                throw new Error('Missing similarity score');
            }
            if (sim.similarity < -1 || sim.similarity > 1) {
                throw new Error(`Similarity out of range: ${sim.similarity}`);
            }
        }
    });
    
    // Test 6: Similar Items Finding
    runner.test('Should find similar items based on co-rating patterns', async () => {
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 200 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        const wineId = testData.wines[0].id;
        const similarItems = await engine.findSimilarItems(wineId, 5);
        
        if (!Array.isArray(similarItems)) {
            throw new Error('Similar items should be an array');
        }
        
        for (const sim of similarItems) {
            if (!sim.wine_id) throw new Error('Missing wine_id in similar item');
            if (typeof sim.similarity !== 'number') {
                throw new Error('Missing similarity score');
            }
        }
    });
    
    // Test 7: Prediction for Specific User-Item Pair
    runner.test('Should predict rating for specific user-item pair', async () => {
        const testData = generateTestData({ numUsers: 15, numWines: 20, numRatings: 120 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        const userId = testData.users[0].id;
        const wineId = testData.wines[5].id;
        
        const prediction = await engine.predictRating(userId, wineId);
        
        if (typeof prediction !== 'number') {
            throw new Error('Prediction should be a number');
        }
        if (prediction < 1 || prediction > 5) {
            throw new Error(`Prediction out of range: ${prediction}`);
        }
    });
    
    // Test 8: Confidence Score Calculation
    runner.test('Should calculate appropriate confidence scores', async () => {
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 200 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        // Get recommendations
        const userId = testData.users[0].id;
        const recommendations = await engine.getUserBasedRecommendations(userId, 10);
        
        // All recommendations should have confidence between 0 and 1
        for (const rec of recommendations) {
            if (rec.confidence < 0 || rec.confidence > 1) {
                throw new Error(`Confidence out of range: ${rec.confidence}`);
            }
        }
    });
    
    // Test 9: Popularity-Based Recommendations
    runner.test('Should generate popularity-based recommendations', async () => {
        const testData = generateTestData({ numUsers: 15, numWines: 25, numRatings: 150 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        const recommendations = await engine.getPopularityBasedRecommendations('new_user', 10);
        
        if (!Array.isArray(recommendations)) {
            throw new Error('Should return array');
        }
        if (recommendations.length === 0) {
            throw new Error('Should return popular items');
        }
        
        // Should be sorted by popularity score (descending)
        for (let i = 0; i < recommendations.length - 1; i++) {
            const current = recommendations[i].predicted_rating;
            const next = recommendations[i + 1].predicted_rating;
            if (current < next) {
                throw new Error('Recommendations should be sorted by score descending');
            }
        }
    });
    
    // Test 10: Content-Based Similar Wines
    runner.test('Should find content-based similar wines', async () => {
        const testData = generateTestData({ numUsers: 10, numWines: 20, numRatings: 80 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        const wineId = testData.wines[0].id;
        const similarWines = await engine.getContentBasedSimilarWines(wineId, 5);
        
        if (!Array.isArray(similarWines)) {
            throw new Error('Should return array');
        }
        
        for (const sim of similarWines) {
            if (!sim.wine_id) throw new Error('Missing wine_id');
            if (typeof sim.similarity !== 'number') {
                throw new Error('Missing similarity score');
            }
            if (sim.similarity < 0 || sim.similarity > 1) {
                throw new Error(`Similarity out of range: ${sim.similarity}`);
            }
        }
    });
    
    // Test 11: Filtering Already Rated Items
    runner.test('Should not recommend already rated items', async () => {
        const testData = generateTestData({ numUsers: 15, numWines: 25, numRatings: 100 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        const userId = testData.users[0].id;
        const userRatings = testData.ratings.filter(r => r.user_id === userId);
        const ratedWineIds = new Set(userRatings.map(r => r.wine_id));
        
        const recommendations = await engine.getUserBasedRecommendations(userId, 10);
        
        // No recommendation should be an already rated item
        for (const rec of recommendations) {
            if (ratedWineIds.has(rec.wine_id)) {
                throw new Error(`Recommended already rated wine: ${rec.wine_id}`);
            }
        }
    });
    
    // Test 12: Handling Empty Ratings
    runner.test('Should handle initialization with no ratings gracefully', async () => {
        const db = new MockDatabase({ users: [], wines: [], ratings: [] });
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize([]);
        
        const recommendations = await engine.getUserBasedRecommendations('any_user', 10);
        
        // Should return empty or minimal recommendations
        if (!Array.isArray(recommendations)) {
            throw new Error('Should return array even with no data');
        }
    });
    
    // Test 13: Stock Availability Impact
    runner.test('Should prioritize wines with stock availability', async () => {
        const testData = generateTestData({ numUsers: 15, numWines: 25, numRatings: 120 });
        
        // Mark some wines as out of stock
        for (let i = 0; i < 5; i++) {
            testData.wines[i].stock_quantity = 0;
        }
        
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        const userId = testData.users[0].id;
        const recommendations = await engine.getUserBasedRecommendations(userId, 10);
        
        // Count in-stock recommendations
        let inStockCount = 0;
        for (const rec of recommendations) {
            const wine = testData.wines.find(w => w.id === rec.wine_id);
            if (wine && wine.stock_quantity > 0) {
                inStockCount++;
            }
        }
        
        // Should prefer in-stock items
        const inStockRatio = inStockCount / recommendations.length;
        if (inStockRatio < 0.6) {
            throw new Error('Should prioritize in-stock wines more');
        }
    });
    
    // Test 14: Minimum Similarity Threshold
    runner.test('Should respect minimum similarity threshold', async () => {
        const testData = generateTestData({ numUsers: 20, numWines: 30, numRatings: 150 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        // Set high similarity threshold
        await engine.initialize(testData.ratings, { minSimilarity: 0.7 });
        
        const userId = testData.users[0].id;
        const similarUsers = await engine.findSimilarUsers(userId, 10);
        
        // All similar users should have similarity >= threshold
        for (const sim of similarUsers) {
            if (sim.similarity < 0.7 - 0.01) { // Allow small floating point error
                throw new Error(`Similarity ${sim.similarity} below threshold 0.7`);
            }
        }
    });
    
    // Test 15: Update with New Ratings
    runner.test('Should update model with new ratings', async () => {
        const testData = generateTestData({ numUsers: 10, numWines: 15, numRatings: 60 });
        const db = new MockDatabase(testData);
        const engine = new CollaborativeFilteringEngine(db);
        
        await engine.initialize(testData.ratings);
        
        // Get initial recommendations
        const userId = testData.users[0].id;
        const initialRecs = await engine.getUserBasedRecommendations(userId, 5);
        
        // Add new ratings
        const newRatings = [
            { user_id: userId, wine_id: testData.wines[10].id, rating: 5, timestamp: Date.now() }
        ];
        
        await engine.updateWithNewRatings(newRatings);
        
        // Get updated recommendations
        const updatedRecs = await engine.getUserBasedRecommendations(userId, 5);
        
        // Recommendations should potentially change
        if (JSON.stringify(initialRecs) === JSON.stringify(updatedRecs)) {
            // It's okay if they're the same, but engine should have processed the update
            // Check that new rating is stored
            const userProfile = engine.userProfiles[userId];
            if (!userProfile) {
                throw new Error('User profile should exist after update');
            }
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
