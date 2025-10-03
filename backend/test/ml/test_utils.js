/**
 * Test Utilities for ML Module Testing
 * Provides sample data generation and helper functions
 */

function generateTestData(options = {}) {
    const {
        numUsers = 50,
        numWines = 100,
        numRatings = 500,
        sparsity = 0.7
    } = options;
    
    const users = [];
    const wines = [];
    const ratings = [];
    
    for (let i = 1; i <= numUsers; i++) {
        users.push({
            user_id: `test_user_${i}`,
            created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
        });
    }
    
    const wineTypes = ['Red', 'White', 'Rosé', 'Sparkling'];
    const regions = ['Bordeaux', 'Burgundy', 'Napa Valley', 'Tuscany', 'Rioja'];
    
    for (let i = 1; i <= numWines; i++) {
        wines.push({
            id: i,
            name: `Test Wine ${i}`,
            wine_type: wineTypes[Math.floor(Math.random() * wineTypes.length)],
            region: regions[Math.floor(Math.random() * regions.length)],
            quality_score: 70 + Math.random() * 30,
            body_score: 1 + Math.random() * 4,
            acidity_score: 1 + Math.random() * 4,
            tannin_score: 1 + Math.random() * 4,
            complexity_score: 1 + Math.random() * 4
        });
    }
    
    const targetRatings = Math.floor(numRatings * (1 - sparsity));
    const ratingsPerUser = Math.ceil(targetRatings / numUsers);
    
    for (const user of users) {
        const numUserRatings = Math.max(1, Math.floor(ratingsPerUser * (0.5 + Math.random())));
        const ratedWines = new Set();
        
        for (let i = 0; i < numUserRatings; i++) {
            let wineId = Math.floor(Math.random() * numWines) + 1;
            while (ratedWines.has(wineId)) {
                wineId = Math.floor(Math.random() * numWines) + 1;
            }
            ratedWines.add(wineId);
            
            const rand = Math.random();
            let rating;
            if (rand < 0.05) rating = 1;
            else if (rand < 0.15) rating = 2;
            else if (rand < 0.35) rating = 3;
            else if (rand < 0.70) rating = 4;
            else rating = 5;
            
            ratings.push({
                user_id: user.user_id,
                wine_id: wineId,
                item_id: wineId,
                overall_rating: rating,
                rating: rating,
                created_at: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString()
            });
        }
    }
    
    return { users, wines, ratings };
}

function generateSparseMatrix(numUsers = 5, numWines = 10, fillPercent = 0.3) {
    return generateTestData({
        numUsers,
        numWines,
        numRatings: Math.floor(numUsers * numWines * fillPercent),
        sparsity: 1 - fillPercent
    });
}

function generateDenseMatrix(numUsers = 20, numWines = 50, fillPercent = 0.7) {
    return generateTestData({
        numUsers,
        numWines,
        numRatings: Math.floor(numUsers * numWines * fillPercent),
        sparsity: 1 - fillPercent
    });
}

class MockDatabase {
    constructor(testData) {
        this.data = testData || generateTestData();
        this.tables = {
            users: this.data.users,
            wines: this.data.wines,
            ratings: this.data.ratings
        };
    }
    
    async all(query, params = []) {
        if (query.includes('LearningPairingFeedbackEnhanced')) {
            return this.tables.ratings.filter(r => {
                if (params.length > 0 && params[0]) {
                    return r.user_id === params[0] || r.wine_id === params[0];
                }
                return true;
            });
        }
        return [];
    }
    
    async get(query, params = []) {
        const results = await this.all(query, params);
        return results.length > 0 ? results[0] : null;
    }
    
    async run(query, params = []) {
        return { lastID: Math.floor(Math.random() * 10000) };
    }
}

class TestRunner {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }
    
    test(description, testFn) {
        this.tests.push({ description, testFn });
    }
    
    async run() {
        console.log(`\n🧪 Running ${this.name}...\n`);
        
        for (const { description, testFn } of this.tests) {
            try {
                await testFn();
                console.log(`✅ ${description}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${description}`);
                console.log(`   Error: ${error.message}`);
                this.failed++;
            }
        }
        
        console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed\n`);
        return this.failed === 0;
    }
}

module.exports = {
    generateTestData,
    generateSparseMatrix,
    generateDenseMatrix,
    MockDatabase,
    TestRunner
};
