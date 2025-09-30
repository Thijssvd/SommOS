const CollaborativeFilteringEngine = require('../backend/core/collaborative_filtering_engine');
const AdvancedWeightingEngine = require('../backend/core/advanced_weighting_engine');
const MLModelManager = require('../backend/core/ml_model_manager');
const EnsembleEngine = require('../backend/core/ensemble_engine');
const Database = require('../backend/database/connection');

// Mock database for testing
jest.mock('../backend/database/connection');

describe('ML Algorithms', () => {
    let db;
    let collaborativeFiltering;
    let advancedWeighting;
    let modelManager;
    let ensembleEngine;

    beforeEach(() => {
        db = Database.getInstance();
        db.reset();
        collaborativeFiltering = new CollaborativeFilteringEngine(db);
        advancedWeighting = new AdvancedWeightingEngine(db);
        modelManager = new MLModelManager(db);
        ensembleEngine = new EnsembleEngine(db);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (db) {
            db.reset();
        }
    });

    describe('Collaborative Filtering Engine', () => {
        test('should find similar users based on rating patterns', async () => {
            // Mock user ratings data
            const userRatings = [
                { wine_id: 1, overall_rating: 4, created_at: new Date().toISOString() },
                { wine_id: 2, overall_rating: 5, created_at: new Date().toISOString() },
                { wine_id: 3, overall_rating: 3, created_at: new Date().toISOString() }
            ];

            // Mock database responses
            db.all = jest.fn()
                .mockResolvedValueOnce([{ user_id: 'user2' }, { user_id: 'user3' }]) // Other users
                .mockResolvedValueOnce([ // User 2 ratings
                    { wine_id: 1, overall_rating: 4, created_at: new Date().toISOString() },
                    { wine_id: 2, overall_rating: 5, created_at: new Date().toISOString() },
                    { wine_id: 4, overall_rating: 4, created_at: new Date().toISOString() }
                ])
                .mockResolvedValueOnce([ // User 3 ratings
                    { wine_id: 1, overall_rating: 3, created_at: new Date().toISOString() },
                    { wine_id: 2, overall_rating: 4, created_at: new Date().toISOString() },
                    { wine_id: 5, overall_rating: 5, created_at: new Date().toISOString() }
                ]);

            const similarUsers = await collaborativeFiltering.findSimilarUsers('user1', userRatings);

            expect(similarUsers).toBeDefined();
            expect(Array.isArray(similarUsers)).toBe(true);
            expect(similarUsers.length).toBeGreaterThan(0);
        });

        test('should calculate user similarity using Pearson correlation', () => {
            const userRatings1 = [
                { wine_id: 1, overall_rating: 4 },
                { wine_id: 2, overall_rating: 5 },
                { wine_id: 3, overall_rating: 3 }
            ];

            const userRatings2 = [
                { wine_id: 1, overall_rating: 4 },
                { wine_id: 2, overall_rating: 5 },
                { wine_id: 4, overall_rating: 4 }
            ];

            const similarity = collaborativeFiltering.calculateUserSimilarity(userRatings1, userRatings2);

            expect(similarity).toBeGreaterThan(0);
            expect(similarity).toBeLessThanOrEqual(1);
        });

        test('should generate user-based recommendations', async () => {
            const userId = 'user1';
            const dishContext = { name: 'Grilled steak', intensity: 'heavy' };

            // Mock database responses
            db.all = jest.fn()
                .mockResolvedValueOnce([ // User ratings
                    { wine_id: 1, overall_rating: 4, created_at: new Date().toISOString() },
                    { wine_id: 2, overall_rating: 5, created_at: new Date().toISOString() }
                ])
                .mockResolvedValueOnce([{ user_id: 'user2' }]) // Similar users
                .mockResolvedValueOnce([ // Similar user ratings
                    { wine_id: 3, overall_rating: 5, created_at: new Date().toISOString() },
                    { wine_id: 4, overall_rating: 4, created_at: new Date().toISOString() }
                ]);

            const recommendations = await collaborativeFiltering.getUserBasedRecommendations(
                userId,
                dishContext,
                { limit: 5 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
        });

        test('should generate item-based recommendations', async () => {
            const wineId = 1;
            const dishContext = { name: 'Grilled steak', intensity: 'heavy' };

            // Mock database responses
            db.all = jest.fn()
                .mockResolvedValueOnce([ // Wine ratings
                    { user_id: 'user1', overall_rating: 4, created_at: new Date().toISOString() },
                    { user_id: 'user2', overall_rating: 5, created_at: new Date().toISOString() }
                ])
                .mockResolvedValueOnce([{ wine_id: 2 }, { wine_id: 3 }]) // Similar wines
                .mockResolvedValueOnce([ // Similar wine 2 ratings
                    { user_id: 'user1', overall_rating: 4, created_at: new Date().toISOString() },
                    { user_id: 'user3', overall_rating: 5, created_at: new Date().toISOString() }
                ])
                .mockResolvedValueOnce([ // Similar wine 3 ratings
                    { user_id: 'user2', overall_rating: 4, created_at: new Date().toISOString() },
                    { user_id: 'user4', overall_rating: 5, created_at: new Date().toISOString() }
                ]);

            const recommendations = await collaborativeFiltering.getItemBasedRecommendations(
                wineId,
                dishContext,
                { limit: 5 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
        });

        test('should generate hybrid recommendations', async () => {
            const userId = 'user1';
            const dishContext = { name: 'Grilled steak', intensity: 'heavy' };

            // Mock the individual recommendation methods
            jest.spyOn(collaborativeFiltering, 'getUserBasedRecommendations')
                .mockResolvedValue([
                    { wine_id: 1, score: 0.8, algorithm: 'user_based_cf' },
                    { wine_id: 2, score: 0.7, algorithm: 'user_based_cf' }
                ]);

            jest.spyOn(collaborativeFiltering, 'getItemBasedRecommendations')
                .mockResolvedValue([
                    { wine_id: 2, score: 0.9, algorithm: 'item_based_cf' },
                    { wine_id: 3, score: 0.6, algorithm: 'item_based_cf' }
                ]);

            const recommendations = await collaborativeFiltering.getHybridRecommendations(
                userId,
                dishContext,
                { limit: 5 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('Advanced Weighting Engine', () => {
        test('should calculate confidence-based weights', async () => {
            const feedbackData = [
                {
                    user_id: 'user1',
                    overall_rating: 4,
                    flavor_harmony_rating: 5,
                    texture_balance_rating: 3,
                    selected: true,
                    time_to_select: 45,
                    created_at: new Date().toISOString()
                },
                {
                    user_id: 'user2',
                    overall_rating: 5,
                    flavor_harmony_rating: 4,
                    texture_balance_rating: 5,
                    selected: true,
                    time_to_select: 30,
                    created_at: new Date().toISOString()
                }
            ];

            // Mock user confidence calculation
            jest.spyOn(advancedWeighting, 'calculateUserConfidence')
                .mockResolvedValueOnce(0.8)
                .mockResolvedValueOnce(0.9);

            const weights = await advancedWeighting.calculateConfidenceBasedWeights(feedbackData);

            expect(weights).toBeDefined();
            expect(typeof weights).toBe('object');
            expect(weights.flavor_harmony).toBeGreaterThan(0);
            expect(weights.texture_balance).toBeGreaterThan(0);
        });

        test('should calculate temporal decay weights', async () => {
            const now = new Date();
            const feedbackData = [
                {
                    overall_rating: 4,
                    flavor_harmony_rating: 5,
                    created_at: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
                },
                {
                    overall_rating: 5,
                    flavor_harmony_rating: 4,
                    created_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
                }
            ];

            const weights = await advancedWeighting.calculateTemporalDecayWeights(feedbackData);

            expect(weights).toBeDefined();
            expect(typeof weights).toBe('object');
            expect(weights.flavor_harmony).toBeGreaterThan(0);
        });

        test('should calculate context-aware weights', async () => {
            const feedbackData = [
                {
                    overall_rating: 4,
                    flavor_harmony_rating: 5,
                    occasion: 'dinner',
                    season: 'autumn'
                },
                {
                    overall_rating: 5,
                    flavor_harmony_rating: 4,
                    occasion: 'lunch',
                    season: 'summer'
                }
            ];

            const weights = await advancedWeighting.calculateContextAwareWeights(feedbackData);

            expect(weights).toBeDefined();
            expect(typeof weights).toBe('object');
            expect(weights.flavor_harmony).toBeGreaterThan(0);
        });

        test('should calculate ensemble weights', async () => {
            const feedbackData = [
                {
                    user_id: 'user1',
                    overall_rating: 4,
                    flavor_harmony_rating: 5,
                    occasion: 'dinner',
                    season: 'autumn',
                    selected: true,
                    time_to_select: 45,
                    created_at: new Date().toISOString()
                }
            ];

            // Mock individual weight calculations
            jest.spyOn(advancedWeighting, 'calculateConfidenceBasedWeights')
                .mockResolvedValue({ flavor_harmony: 0.3, texture_balance: 0.2 });
            jest.spyOn(advancedWeighting, 'calculateTemporalDecayWeights')
                .mockResolvedValue({ flavor_harmony: 0.25, texture_balance: 0.15 });
            jest.spyOn(advancedWeighting, 'calculateContextAwareWeights')
                .mockResolvedValue({ flavor_harmony: 0.35, texture_balance: 0.25 });

            const weights = await advancedWeighting.calculateEnsembleWeights(feedbackData);

            expect(weights).toBeDefined();
            expect(typeof weights).toBe('object');
            expect(weights.flavor_harmony).toBeGreaterThan(0);
        });

        test('should normalize weights correctly', () => {
            const weights = {
                flavor_harmony: 0.3,
                texture_balance: 0.2,
                acidity_match: 0.1
            };

            const normalized = advancedWeighting.normalizeWeights(weights);

            const total = Object.values(normalized).reduce((sum, w) => sum + w, 0);
            expect(total).toBeCloseTo(1.0, 2);
        });
    });

    describe('ML Model Manager', () => {
        test('should create a new model', async () => {
            const modelData = {
                name: 'test_model',
                type: 'collaborative_filtering',
                algorithm: 'user_based',
                parameters: { minCommonItems: 3 },
                trainingData: [
                    { user_id: 'user1', wine_id: 1, rating: 4 },
                    { user_id: 'user2', wine_id: 1, rating: 5 }
                ]
            };

            // Mock file system operations
            const fs = require('fs');
            jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);

            const result = await modelManager.createModel(modelData);

            expect(result).toBeDefined();
            expect(result.modelId).toBeDefined();
            expect(result.version).toBeDefined();
            expect(result.performance).toBeDefined();
        });

        test('should load a model by ID and version', async () => {
            const modelId = 'test_model_123';
            const version = '1';

            // Mock database response
            db.get = jest.fn().mockResolvedValue({
                id: 1,
                model_id: modelId,
                version: version,
                name: 'test_model',
                type: 'collaborative_filtering',
                algorithm: 'user_based',
                model_path: '/path/to/model.json',
                performance: JSON.stringify({ accuracy: 0.85 }),
                metadata: JSON.stringify({})
            });

            // Mock file system operations
            const fs = require('fs');
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ type: 'test_model' }));

            const result = await modelManager.loadModel(modelId, version);

            expect(result).toBeDefined();
            expect(result.model).toBeDefined();
            expect(result.metadata).toBeDefined();
        });

        test('should update model incrementally', async () => {
            const modelId = 'test_model_123';
            const version = '1';
            const newData = [
                { user_id: 'user3', wine_id: 2, rating: 4 }
            ];

            // Mock existing model loading
            jest.spyOn(modelManager, 'loadModel').mockResolvedValue({
                model: { type: 'test_model' },
                metadata: { name: 'test_model', type: 'collaborative_filtering' }
            });

            // Mock file system operations
            const fs = require('fs');
            jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

            const result = await modelManager.updateModelIncremental(modelId, version, newData);

            expect(result).toBeDefined();
            expect(result.modelId).toBe(modelId);
            expect(result.version).toBe('2'); // New version
        });

        test('should compare model performance', async () => {
            const modelId = 'test_model_123';
            const versions = ['1', '2'];

            // Mock database responses
            db.all = jest.fn().mockResolvedValue([
                {
                    version: '1',
                    performance: JSON.stringify({ accuracy: 0.85, f1_score: 0.82 }),
                    created_at: new Date().toISOString(),
                    metadata: JSON.stringify({})
                },
                {
                    version: '2',
                    performance: JSON.stringify({ accuracy: 0.87, f1_score: 0.85 }),
                    created_at: new Date().toISOString(),
                    metadata: JSON.stringify({})
                }
            ]);

            const comparisons = await modelManager.compareModels(modelId, versions);

            expect(comparisons).toBeDefined();
            expect(Array.isArray(comparisons)).toBe(true);
            expect(comparisons.length).toBe(2);
        });

        test('should run A/B test', async () => {
            const modelId1 = 'model1';
            const version1 = '1';
            const modelId2 = 'model2';
            const version2 = '1';
            const testData = [
                { user_id: 'user1', wine_id: 1, rating: 4 }
            ];

            // Mock model loading
            jest.spyOn(modelManager, 'loadModel')
                .mockResolvedValueOnce({ model: { type: 'model1' }, metadata: {} })
                .mockResolvedValueOnce({ model: { type: 'model2' }, metadata: {} });

            const result = await modelManager.runABTest(
                modelId1, version1, modelId2, version2, testData
            );

            expect(result).toBeDefined();
            expect(result.testId).toBeDefined();
            expect(result.results).toBeDefined();
        });
    });

    describe('Ensemble Engine', () => {
        test('should generate ensemble recommendations', async () => {
            const userId = 'user1';
            const dishContext = { name: 'Grilled steak', intensity: 'heavy' };

            // Mock individual algorithm results
            jest.spyOn(ensembleEngine, 'runCollaborativeFiltering')
                .mockResolvedValue([
                    { wine_id: 1, score: 0.8, algorithm: 'collaborative_filtering' }
                ]);

            jest.spyOn(ensembleEngine, 'runContentBased')
                .mockResolvedValue([
                    { wine_id: 2, score: 0.7, algorithm: 'content_based' }
                ]);

            jest.spyOn(ensembleEngine, 'runRuleBased')
                .mockResolvedValue([
                    { wine_id: 1, score: 0.6, algorithm: 'rule_based' }
                ]);

            const recommendations = await ensembleEngine.generateEnsembleRecommendations(
                userId,
                dishContext,
                { limit: 5 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
        });

        test('should calculate dynamic weights', async () => {
            const algorithmResults = {
                collaborative_filtering: [
                    { wine_id: 1, score: 0.8 },
                    { wine_id: 2, score: 0.7 }
                ],
                content_based: [
                    { wine_id: 3, score: 0.6 }
                ],
                rule_based: []
            };

            const dishContext = { occasion: 'dinner' };

            const weights = await ensembleEngine.calculateDynamicWeights(algorithmResults, dishContext);

            expect(weights).toBeDefined();
            expect(typeof weights).toBe('object');
            expect(weights.collaborative_filtering).toBeGreaterThan(0);
            expect(weights.rule_based).toBeLessThan(ensembleEngine.algorithmWeights.rule_based); // Reduced due to no results
        });

        test('should combine recommendations from multiple algorithms', async () => {
            const algorithmResults = {
                collaborative_filtering: [
                    { wine_id: 1, score: 0.8, confidence: 0.9, reasoning: 'CF reasoning' }
                ],
                content_based: [
                    { wine_id: 1, score: 0.6, confidence: 0.7, reasoning: 'Content reasoning' }
                ]
            };

            const weights = {
                collaborative_filtering: 0.6,
                content_based: 0.4
            };

            const combined = await ensembleEngine.combineRecommendations(
                algorithmResults,
                weights,
                { limit: 5 }
            );

            expect(combined).toBeDefined();
            expect(Array.isArray(combined)).toBe(true);
            expect(combined.length).toBeGreaterThan(0);
            expect(combined[0].wine_id).toBe(1);
            expect(combined[0].algorithms).toContain('collaborative_filtering');
            expect(combined[0].algorithms).toContain('content_based');
        });

        test('should calculate cosine similarity', () => {
            const vector1 = [1, 2, 3, 4, 5];
            const vector2 = [1, 2, 3, 4, 5]; // Identical vector
            const vector3 = [5, 4, 3, 2, 1]; // Reversed vector

            const similarity1 = ensembleEngine.calculateCosineSimilarity(vector1, vector2);
            const similarity2 = ensembleEngine.calculateCosineSimilarity(vector1, vector3);

            expect(similarity1).toBeCloseTo(1.0, 2); // Perfect similarity
            expect(similarity2).toBeLessThan(similarity1); // Lower similarity
        });

        test('should calculate rule-based score', async () => {
            const wine = {
                id: 1,
                wine_type: 'Red',
                region: 'Bordeaux',
                style: 'Full-bodied'
            };

            const dishContext = {
                intensity: 'heavy',
                cuisine: 'french',
                season: 'winter',
                occasion: 'dinner'
            };

            const score = await ensembleEngine.calculateRuleBasedScore(wine, dishContext);

            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThanOrEqual(1.0);
        });
    });

    describe('Integration Tests', () => {
        test('should work together for end-to-end recommendation', async () => {
            const userId = 'user1';
            const dishContext = { name: 'Grilled steak', intensity: 'heavy', cuisine: 'french' };

            // Mock database responses for collaborative filtering
            db.all = jest.fn()
                .mockResolvedValueOnce([ // User ratings
                    { wine_id: 1, overall_rating: 4, created_at: new Date().toISOString() }
                ])
                .mockResolvedValueOnce([{ user_id: 'user2' }]) // Similar users
                .mockResolvedValueOnce([ // Similar user ratings
                    { wine_id: 2, overall_rating: 5, created_at: new Date().toISOString() }
                ]);

            // Mock available wines for rule-based
            db.all = jest.fn()
                .mockResolvedValueOnce([ // Available wines
                    { id: 1, wine_type: 'Red', region: 'Bordeaux', style: 'Full-bodied' },
                    { id: 2, wine_type: 'White', region: 'Burgundy', style: 'Light' }
                ]);

            const recommendations = await ensembleEngine.generateEnsembleRecommendations(
                userId,
                dishContext,
                { limit: 3 }
            );

            expect(recommendations).toBeDefined();
            expect(Array.isArray(recommendations)).toBe(true);
        });
    });
});