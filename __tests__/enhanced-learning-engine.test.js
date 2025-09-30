const EnhancedLearningEngine = require('../backend/core/enhanced_learning_engine');
const FeatureEngineeringService = require('../backend/core/feature_engineering_service');
const DataValidationService = require('../backend/core/data_validation_service');
const Database = require('../backend/database/connection');

// Mock database for testing
jest.mock('../backend/database/connection');

describe('Enhanced Learning Engine', () => {
    let db;
    let learningEngine;
    let featureService;
    let validationService;

    beforeEach(() => {
        db = Database.getInstance();
        db.reset();
        learningEngine = new EnhancedLearningEngine(db);
        featureService = new FeatureEngineeringService(db);
        validationService = new DataValidationService();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (db) {
            db.reset();
        }
    });

    describe('Enhanced Feedback Collection', () => {
        test('should record enhanced pairing feedback with granular ratings', async () => {
            const feedbackData = {
                recommendation_id: 'rec-123',
                user_id: 'user-456',
                session_id: 'session-789',
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

            await learningEngine.recordEnhancedPairingFeedback(feedbackData);

            const storedFeedback = db.data.learningPairingFeedbackEnhanced[0];
            expect(storedFeedback).toBeDefined();
            expect(storedFeedback.recommendation_id).toBe('rec-123');
            expect(storedFeedback.overall_rating).toBe(4);
            expect(storedFeedback.flavor_harmony_rating).toBe(5);
            expect(storedFeedback.occasion).toBe('dinner');
            expect(storedFeedback.selected).toBe(true);
        });

        test('should validate feedback data before recording', async () => {
            const invalidFeedbackData = {
                recommendation_id: 'rec-123',
                ratings: {
                    overall: 6, // Invalid rating
                    flavor_harmony: 'excellent' // Invalid type
                },
                context: {
                    occasion: 'invalid_occasion',
                    guest_count: -1 // Invalid count
                }
            };

            await expect(learningEngine.recordEnhancedPairingFeedback(invalidFeedbackData))
                .rejects.toThrow();
        });

        test('should update user preference profiles', async () => {
            const feedbackData = {
                recommendation_id: 'rec-123',
                user_id: 'user-456',
                ratings: { overall: 4 },
                context: { occasion: 'dinner', season: 'autumn' },
                behavioral_data: { selected: true }
            };

            await learningEngine.recordEnhancedPairingFeedback(feedbackData);

            const userProfile = await learningEngine.getUserPreferenceProfile('user-456');
            expect(userProfile).toBeDefined();
            expect(userProfile.userId).toBe('user-456');
            expect(userProfile.totalFeedbackCount).toBe(1);
        });
    });

    describe('Feature Engineering', () => {
        test('should extract wine features correctly', async () => {
            const wineData = {
                id: 1,
                name: 'Test Cabernet',
                wine_type: 'Red',
                region: 'Napa Valley',
                country: 'USA',
                grape_varieties: '["Cabernet Sauvignon", "Merlot"]',
                alcohol_content: 14.5,
                style: 'Full-bodied',
                tasting_notes: 'Rich, complex wine with firm tannins and dark fruit flavors',
                critic_score: 92,
                quality_score: 90,
                weather_score: 88,
                year: 2018,
                avg_price: 150
            };

            const features = await featureService.extractWineFeatures(1);
            
            expect(features).toBeDefined();
            expect(features.wineType).toBe(1); // Red
            expect(features.bodyScore).toBeGreaterThan(3); // Full-bodied
            expect(features.tanninScore).toBeGreaterThan(3); // Firm tannins
            expect(features.complexityScore).toBeGreaterThan(3); // Complex
        });

        test('should extract dish features correctly', async () => {
            const dishDescription = 'Grilled ribeye steak with roasted vegetables and red wine reduction';

            const features = await featureService.extractDishFeatures(dishDescription);
            
            expect(features).toBeDefined();
            expect(features.cuisineType).toBe('american');
            expect(features.preparationMethod).toBe('grilled');
            expect(features.proteinType).toBe('beef');
            expect(features.richnessScore).toBeGreaterThan(3); // Rich dish
        });

        test('should create normalized feature vectors', async () => {
            const wineData = {
                id: 1,
                name: 'Test Wine',
                wine_type: 'Red',
                region: 'Bordeaux',
                country: 'France',
                grape_varieties: '["Cabernet Sauvignon"]',
                alcohol_content: 13.5,
                style: 'Medium-bodied',
                year: 2019,
                avg_price: 75
            };

            const features = await featureService.extractWineFeatures(1);
            const featureVector = JSON.parse(db.data.wineFeatures[0].feature_vector);
            
            expect(featureVector).toBeDefined();
            expect(featureVector.length).toBeGreaterThan(0);
            expect(featureVector.every(val => val >= 0 && val <= 1)).toBe(true);
        });
    });

    describe('Data Validation', () => {
        test('should validate enhanced feedback data', () => {
            const validFeedback = {
                recommendation_id: 'rec-123',
                ratings: {
                    overall: 4,
                    flavor_harmony: 5,
                    texture_balance: 3
                },
                context: {
                    occasion: 'dinner',
                    guest_count: 4,
                    time_of_day: 'evening',
                    season: 'autumn'
                },
                behavioral_data: {
                    selected: true,
                    time_to_select: 45,
                    viewed_duration: 120
                }
            };

            const validation = validationService.validateEnhancedFeedback(validFeedback);
            
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should catch validation errors', () => {
            const invalidFeedback = {
                recommendation_id: 'rec-123',
                ratings: {
                    overall: 6, // Invalid rating
                    flavor_harmony: 'excellent' // Invalid type
                },
                context: {
                    occasion: 'invalid_occasion',
                    guest_count: -1 // Invalid count
                }
            };

            const validation = validationService.validateEnhancedFeedback(invalidFeedback);
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        test('should sanitize feedback data', () => {
            const feedbackWithIssues = {
                recommendation_id: 'rec-123',
                ratings: {
                    overall: 4.7, // Should be rounded to 5
                    flavor_harmony: 3.2 // Should be rounded to 3
                },
                context: {
                    occasion: 'DINNER', // Should be lowercase
                    guest_count: 4.5, // Should be integer
                    time_of_day: 'invalid_time' // Should be filtered out
                },
                additional_feedback: {
                    notes: '   Great wine!   ', // Should be trimmed
                    price_satisfaction: 4.8 // Should be rounded to 5
                }
            };

            const validation = validationService.validateEnhancedFeedback(feedbackWithIssues);
            const sanitized = validation.sanitizedData;
            
            expect(sanitized.ratings.overall).toBe(5);
            expect(sanitized.ratings.flavor_harmony).toBe(3);
            expect(sanitized.context.occasion).toBe('dinner');
            expect(sanitized.context.guest_count).toBe(4);
            expect(sanitized.context.time_of_day).toBeUndefined();
            expect(sanitized.additional_feedback.notes).toBe('Great wine!');
            expect(sanitized.additional_feedback.price_satisfaction).toBe(5);
        });
    });

    describe('Advanced Weight Calculation', () => {
        test('should calculate advanced pairing weights', async () => {
            // Mock feedback data
            const feedbackData = [
                {
                    wine_id: 1,
                    overall_rating: 5,
                    flavor_harmony_rating: 5,
                    texture_balance_rating: 4,
                    acidity_match_rating: 5,
                    tannin_balance_rating: 4,
                    body_match_rating: 5,
                    regional_tradition_rating: 4,
                    occasion: 'dinner',
                    season: 'autumn',
                    selected: true,
                    time_to_select: 30,
                    created_at: new Date().toISOString()
                },
                {
                    wine_id: 2,
                    overall_rating: 3,
                    flavor_harmony_rating: 3,
                    texture_balance_rating: 2,
                    acidity_match_rating: 3,
                    tannin_balance_rating: 2,
                    body_match_rating: 3,
                    regional_tradition_rating: 3,
                    occasion: 'lunch',
                    season: 'summer',
                    selected: false,
                    time_to_select: 120,
                    created_at: new Date().toISOString()
                }
            ];

            // Mock database response
            db.data.learningPairingRecommendations = feedbackData.map((f, index) => ({
                id: index + 1,
                wine_id: f.wine_id,
                score_breakdown: JSON.stringify({
                    style_match: 0.8,
                    flavor_harmony: 0.9,
                    texture_balance: 0.7
                })
            }));

            db.data.learningPairingFeedbackEnhanced = feedbackData.map((f, index) => ({
                id: index + 1,
                recommendation_id: index + 1,
                ...f
            }));

            await learningEngine.updateAdvancedPairingWeights();

            const weights = await learningEngine.getEnhancedPairingWeights();
            expect(weights).toBeDefined();
            expect(weights.flavor_harmony).toBeGreaterThan(0);
            expect(weights.texture_balance).toBeGreaterThan(0);
        });

        test('should apply confidence weighting', async () => {
            const feedbackData = [
                {
                    overall_rating: 5,
                    created_at: new Date().toISOString(),
                    selected: true,
                    time_to_select: 30
                },
                {
                    overall_rating: 4,
                    created_at: new Date().toISOString(),
                    selected: true,
                    time_to_select: 45
                }
            ];

            db.data.learningPairingFeedbackEnhanced = feedbackData;

            const weights = await learningEngine.calculateAdvancedWeights(feedbackData);
            const confidenceWeights = learningEngine.applyConfidenceWeighting(weights, feedbackData);

            expect(confidenceWeights).toBeDefined();
            expect(Object.keys(confidenceWeights).length).toBeGreaterThan(0);
        });
    });

    describe('User Preference Profiles', () => {
        test('should create and update user preference profiles', async () => {
            const feedbackData = {
                recommendation_id: 'rec-123',
                user_id: 'user-456',
                ratings: { overall: 4 },
                context: { occasion: 'dinner', season: 'autumn' },
                behavioral_data: { selected: true }
            };

            await learningEngine.recordEnhancedPairingFeedback(feedbackData);

            const profile = await learningEngine.getUserPreferenceProfile('user-456');
            expect(profile).toBeDefined();
            expect(profile.userId).toBe('user-456');
            expect(profile.totalFeedbackCount).toBe(1);
        });

        test('should handle multiple feedback entries for same user', async () => {
            const feedbackData1 = {
                recommendation_id: 'rec-123',
                user_id: 'user-456',
                ratings: { overall: 4 },
                context: { occasion: 'dinner', season: 'autumn' },
                behavioral_data: { selected: true }
            };

            const feedbackData2 = {
                recommendation_id: 'rec-124',
                user_id: 'user-456',
                ratings: { overall: 5 },
                context: { occasion: 'lunch', season: 'summer' },
                behavioral_data: { selected: true }
            };

            await learningEngine.recordEnhancedPairingFeedback(feedbackData1);
            await learningEngine.recordEnhancedPairingFeedback(feedbackData2);

            const profile = await learningEngine.getUserPreferenceProfile('user-456');
            expect(profile.totalFeedbackCount).toBe(2);
        });
    });

    describe('Feature Interactions', () => {
        test('should track feature interactions', async () => {
            // Mock wine and dish features
            db.data.wineFeatures = [{
                id: 1,
                wine_id: 1,
                feature_vector: JSON.stringify([0.8, 0.6, 0.7])
            }];

            db.data.dishFeatures = [{
                id: 1,
                dish_hash: 'test-hash',
                feature_vector: JSON.stringify([0.7, 0.5, 0.8])
            }];

            const feedbackData = {
                recommendation_id: 'rec-123',
                ratings: { overall: 4 },
                context: { occasion: 'dinner' },
                behavioral_data: { selected: true }
            };

            // Mock recommendation data
            db.data.learningPairingRecommendations = [{
                id: 123,
                wine_id: 1,
                session_id: 1
            }];

            db.data.learningPairingSessions = [{
                id: 1,
                dish_description: 'Grilled steak'
            }];

            await learningEngine.updateFeatureInteractions('rec-123', feedbackData);

            const interactions = db.data.featureInteractions;
            expect(interactions).toBeDefined();
            expect(interactions.length).toBeGreaterThan(0);
        });
    });

    describe('Learning Metrics', () => {
        test('should record learning metrics', async () => {
            const feedbackData = [
                { overall_rating: 5, selected: true, created_at: new Date().toISOString() },
                { overall_rating: 4, selected: true, created_at: new Date().toISOString() },
                { overall_rating: 3, selected: false, created_at: new Date().toISOString() }
            ];

            db.data.learningPairingFeedbackEnhanced = feedbackData;

            await learningEngine.recordLearningMetrics('test_metric', 0.85, { context: 'test' });

            const metrics = db.data.learningMetrics;
            expect(metrics).toBeDefined();
            expect(metrics.length).toBeGreaterThan(0);
            expect(metrics[0].metric_name).toBe('test_metric');
            expect(metrics[0].metric_value).toBe(0.85);
        });

        test('should calculate pairing accuracy', () => {
            const feedbackData = [
                { overall_rating: 5 },
                { overall_rating: 4 },
                { overall_rating: 3 },
                { overall_rating: 2 },
                { overall_rating: 1 }
            ];

            const accuracy = learningEngine.calculatePairingAccuracy(feedbackData);
            expect(accuracy).toBe(0.4); // 2 out of 5 ratings >= 4
        });

        test('should calculate user satisfaction', () => {
            const feedbackData = [
                { overall_rating: 5 },
                { overall_rating: 4 },
                { overall_rating: 3 }
            ];

            const satisfaction = learningEngine.calculateUserSatisfaction(feedbackData);
            expect(satisfaction).toBe(0.8); // (5+4+3)/3/5 = 0.8
        });
    });

    describe('Backward Compatibility', () => {
        test('should support legacy feedback format', async () => {
            await learningEngine.recordPairingFeedback('rec-123', 4, 'Great wine!', true);

            const storedFeedback = db.data.learningPairingFeedbackEnhanced[0];
            expect(storedFeedback).toBeDefined();
            expect(storedFeedback.overall_rating).toBe(4);
            expect(storedFeedback.notes).toBe('Great wine!');
            expect(storedFeedback.selected).toBe(true);
        });

        test('should return enhanced weights for legacy calls', async () => {
            const weights = await learningEngine.getPairingWeights();
            expect(weights).toBeDefined();
            expect(Object.keys(weights).length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            // Mock database error
            db.run = jest.fn().mockRejectedValue(new Error('Database error'));

            const feedbackData = {
                recommendation_id: 'rec-123',
                ratings: { overall: 4 },
                context: {},
                behavioral_data: { selected: true }
            };

            await expect(learningEngine.recordEnhancedPairingFeedback(feedbackData))
                .rejects.toThrow('Database error');
        });

        test('should handle missing feature data', async () => {
            // Mock missing wine features
            db.get = jest.fn().mockResolvedValue(null);

            const feedbackData = {
                recommendation_id: 'rec-123',
                ratings: { overall: 4 },
                context: {},
                behavioral_data: { selected: true }
            };

            // Should not throw error, just skip feature interaction update
            await expect(learningEngine.recordEnhancedPairingFeedback(feedbackData))
                .resolves.toBe(true);
        });
    });
});