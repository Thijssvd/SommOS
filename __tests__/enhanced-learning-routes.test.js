/**
 * Enhanced Learning API Routes Test Suite
 * Tests for advanced learning features including enhanced feedback,
 * weights, user profiles, feature extraction, and analytics
 */

const request = require('supertest');
const express = require('express');

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock services
const mockLearningEngine = {
    recordEnhancedPairingFeedback: jest.fn(),
    getEnhancedPairingWeights: jest.fn(),
    getUserPreferenceProfile: jest.fn(),
    getFeatureInteractions: jest.fn()
};

const mockFeatureService = {
    extractWineFeatures: jest.fn(),
    extractDishFeatures: jest.fn(),
    getWineFeatures: jest.fn(),
    getDishFeatures: jest.fn(),
    batchExtractWineFeatures: jest.fn()
};

const mockValidationService = {
    validateEnhancedFeedback: jest.fn()
};

// Mock middleware
jest.mock('../backend/middleware/auth', () => ({
    requireRole: (...roles) => (req, res, next) => next()
}));

jest.mock('../backend/middleware/validate', () => ({
    validate: (schema) => (req, res, next) => next()
}));

jest.mock('../backend/utils/asyncHandler', () => ({
    asyncHandler: (fn) => async (req, res, next) => {
        try {
            await fn(
                {
                    learningEngine: mockLearningEngine,
                    featureService: mockFeatureService,
                    validationService: mockValidationService
                },
                req,
                res,
                next
            );
        } catch (error) {
            next(error);
        }
    }
}));

// Import routes after mocking
const enhancedLearningRoutes = require('../backend/api/enhanced_learning_routes');
app.use('/api/learning', enhancedLearningRoutes);

describe('Enhanced Learning API Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Enhanced Feedback', () => {
        describe('POST /api/learning/feedback/enhanced', () => {
            test('should record enhanced feedback', async () => {
                mockLearningEngine.recordEnhancedPairingFeedback.mockResolvedValue();

                const response = await request(app)
                    .post('/api/learning/feedback/enhanced')
                    .send({
                        recommendation_id: 'rec_123',
                        user_id: 'user_456',
                        ratings: {
                            overall: 5,
                            flavor_harmony: 5,
                            texture_balance: 4,
                            acidity_match: 5
                        },
                        context: {
                            occasion: 'dinner',
                            guest_count: 4,
                            season: 'summer'
                        }
                    })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.recommendation_id).toBe('rec_123');
                expect(mockLearningEngine.recordEnhancedPairingFeedback).toHaveBeenCalled();
            });

            test('should handle feedback recording errors', async () => {
                mockLearningEngine.recordEnhancedPairingFeedback.mockRejectedValue(
                    new Error('Database error')
                );

                const response = await request(app)
                    .post('/api/learning/feedback/enhanced')
                    .send({
                        recommendation_id: 'rec_123',
                        ratings: { overall: 5 }
                    })
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('Failed to record enhanced feedback');
            });
        });
    });

    describe('Pairing Weights', () => {
        describe('GET /api/learning/weights/enhanced', () => {
            test('should get enhanced pairing weights', async () => {
                const mockWeights = {
                    flavor_harmony: 0.35,
                    texture_balance: 0.25,
                    acidity_match: 0.20,
                    tannin_balance: 0.15,
                    body_match: 0.05
                };

                mockLearningEngine.getEnhancedPairingWeights.mockResolvedValue(mockWeights);

                const response = await request(app)
                    .get('/api/learning/weights/enhanced')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.weights).toEqual(mockWeights);
                expect(response.body.data.version).toBe('enhanced_v1');
            });

            test('should handle weight retrieval errors', async () => {
                mockLearningEngine.getEnhancedPairingWeights.mockRejectedValue(
                    new Error('No weights found')
                );

                const response = await request(app)
                    .get('/api/learning/weights/enhanced')
                    .expect(500);

                expect(response.body.success).toBe(false);
            });
        });
    });

    describe('User Profiles', () => {
        describe('GET /api/learning/user-profile/:userId', () => {
            test('should get user preference profile', async () => {
                const mockProfile = {
                    user_id: 'user_456',
                    preferences: {
                        wine_types: ['red', 'white'],
                        occasions: ['dinner', 'party'],
                        taste_preferences: { sweetness: 'dry', body: 'full' }
                    },
                    feedback_count: 25,
                    consistency_score: 0.85
                };

                mockLearningEngine.getUserPreferenceProfile.mockResolvedValue(mockProfile);

                const response = await request(app)
                    .get('/api/learning/user-profile/user_456')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toEqual(mockProfile);
            });

            test('should return 404 for non-existent user', async () => {
                mockLearningEngine.getUserPreferenceProfile.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/learning/user-profile/nonexistent')
                    .expect(404);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('User profile not found');
            });

            test('should handle profile retrieval errors', async () => {
                mockLearningEngine.getUserPreferenceProfile.mockRejectedValue(
                    new Error('Database error')
                );

                const response = await request(app)
                    .get('/api/learning/user-profile/user_456')
                    .expect(500);

                expect(response.body.success).toBe(false);
            });
        });
    });

    describe('Feature Extraction', () => {
        describe('POST /api/learning/features/wine/extract', () => {
            test('should extract wine features', async () => {
                const mockFeatures = {
                    acidity: 0.75,
                    tannins: 0.60,
                    body: 0.80,
                    sweetness: 0.10,
                    alcohol: 13.5
                };

                mockFeatureService.extractWineFeatures.mockResolvedValue(mockFeatures);

                const response = await request(app)
                    .post('/api/learning/features/wine/extract')
                    .send({ wine_id: 123 })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.wine_id).toBe(123);
                expect(response.body.data.features).toEqual(mockFeatures);
            });

            test('should handle feature extraction errors', async () => {
                mockFeatureService.extractWineFeatures.mockRejectedValue(
                    new Error('Wine not found')
                );

                const response = await request(app)
                    .post('/api/learning/features/wine/extract')
                    .send({ wine_id: 999 })
                    .expect(400);

                expect(response.body.success).toBe(false);
            });
        });

        describe('POST /api/learning/features/dish/extract', () => {
            test('should extract dish features', async () => {
                const mockFeatures = {
                    intensity: 'medium',
                    richness: 0.70,
                    spiciness: 0.30,
                    primary_flavors: ['savory', 'umami'],
                    texture: 'creamy'
                };

                mockFeatureService.extractDishFeatures.mockResolvedValue(mockFeatures);

                const response = await request(app)
                    .post('/api/learning/features/dish/extract')
                    .send({ dish_description: 'Creamy mushroom risotto' })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.dish_description).toBe('Creamy mushroom risotto');
                expect(response.body.data.features).toEqual(mockFeatures);
            });
        });

        describe('GET /api/learning/features/wine/:wineId', () => {
            test('should get wine features', async () => {
                const mockFeatures = {
                    wine_id: 123,
                    features: { acidity: 0.75, tannins: 0.60 }
                };

                mockFeatureService.getWineFeatures.mockResolvedValue(mockFeatures);

                const response = await request(app)
                    .get('/api/learning/features/wine/123')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toEqual(mockFeatures);
            });

            test('should return 404 for non-existent wine', async () => {
                mockFeatureService.getWineFeatures.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/learning/features/wine/999')
                    .expect(404);

                expect(response.body.success).toBe(false);
            });
        });

        describe('GET /api/learning/features/dish', () => {
            test('should get dish features', async () => {
                const mockFeatures = {
                    description: 'risotto',
                    features: { intensity: 'medium' }
                };

                mockFeatureService.getDishFeatures.mockResolvedValue(mockFeatures);

                const response = await request(app)
                    .get('/api/learning/features/dish')
                    .query({ description: 'risotto' })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data).toEqual(mockFeatures);
            });

            test('should require description', async () => {
                const response = await request(app)
                    .get('/api/learning/features/dish')
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('description is required');
            });

            test('should return 404 for non-existent dish', async () => {
                mockFeatureService.getDishFeatures.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/learning/features/dish')
                    .query({ description: 'unknown' })
                    .expect(404);

                expect(response.body.success).toBe(false);
            });
        });

        describe('POST /api/learning/batch/features/wine', () => {
            test('should batch extract wine features', async () => {
                const mockResults = [
                    { wine_id: 1, features: { acidity: 0.75 } },
                    { wine_id: 2, features: { acidity: 0.80 } }
                ];

                mockFeatureService.batchExtractWineFeatures.mockResolvedValue(mockResults);

                const response = await request(app)
                    .post('/api/learning/batch/features/wine')
                    .send({ wine_ids: [1, 2] })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.processed_count).toBe(2);
                expect(response.body.data.total_requested).toBe(2);
            });

            test('should require wine_ids array', async () => {
                const response = await request(app)
                    .post('/api/learning/batch/features/wine')
                    .send({})
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('wine_ids must be a non-empty array');
            });

            test('should reject batches over 100 wines', async () => {
                const wineIds = Array.from({ length: 101 }, (_, i) => i + 1);

                const response = await request(app)
                    .post('/api/learning/batch/features/wine')
                    .send({ wine_ids: wineIds })
                    .expect(400);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('cannot exceed 100 wines');
            });
        });
    });

    describe('Feature Interactions', () => {
        describe('GET /api/learning/interactions/:wineId/:dishDescription', () => {
            test('should get feature interactions', async () => {
                const mockInteractions = [
                    { feature: 'acidity', score: 0.9, impact: 'high' },
                    { feature: 'tannins', score: 0.7, impact: 'medium' }
                ];

                mockLearningEngine.getFeatureInteractions.mockResolvedValue(mockInteractions);

                const response = await request(app)
                    .get('/api/learning/interactions/123/pasta%20carbonara')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.wine_id).toBe(123);
                expect(response.body.data.dish_description).toBe('pasta carbonara');
                expect(response.body.data.interactions).toEqual(mockInteractions);
            });

            test('should handle empty interactions', async () => {
                mockLearningEngine.getFeatureInteractions.mockResolvedValue(null);

                const response = await request(app)
                    .get('/api/learning/interactions/123/test')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.interactions).toEqual([]);
            });
        });
    });

    describe('Learning Metrics', () => {
        describe('GET /api/learning/metrics', () => {
            test('should get learning metrics', async () => {
                const response = await request(app)
                    .get('/api/learning/metrics')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.metrics).toBeDefined();
                expect(response.body.data.metrics.pairing_accuracy).toBeDefined();
                expect(response.body.data.metrics.model_performance).toBeDefined();
            });

            test('should support period and limit parameters', async () => {
                const response = await request(app)
                    .get('/api/learning/metrics')
                    .query({ period: 'weekly', limit: 50 })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.period).toBe('weekly');
            });
        });
    });

    describe('Feedback Validation', () => {
        describe('POST /api/learning/validate/feedback', () => {
            test('should validate feedback data', async () => {
                const mockValidation = {
                    valid: true,
                    score: 0.95,
                    issues: []
                };

                mockValidationService.validateEnhancedFeedback.mockReturnValue(mockValidation);

                const response = await request(app)
                    .post('/api/learning/validate/feedback')
                    .send({
                        recommendation_id: 'rec_123',
                        ratings: { overall: 5 }
                    })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.validation).toEqual(mockValidation);
            });

            test('should handle validation errors', async () => {
                mockValidationService.validateEnhancedFeedback.mockImplementation(() => {
                    throw new Error('Invalid feedback format');
                });

                const response = await request(app)
                    .post('/api/learning/validate/feedback')
                    .send({ invalid: 'data' })
                    .expect(400);

                expect(response.body.success).toBe(false);
            });
        });
    });

    describe('Analytics', () => {
        describe('GET /api/learning/analytics/feedback-quality', () => {
            test('should analyze feedback quality', async () => {
                const response = await request(app)
                    .get('/api/learning/analytics/feedback-quality')
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.analysis).toBeDefined();
                expect(response.body.data.analysis.total_feedback_count).toBeDefined();
                expect(response.body.data.analysis.quality_issues).toBeDefined();
                expect(response.body.data.analysis.recommendations).toBeDefined();
            });

            test('should support limit parameter', async () => {
                const response = await request(app)
                    .get('/api/learning/analytics/feedback-quality')
                    .query({ limit: 500 })
                    .expect(200);

                expect(response.body.success).toBe(true);
            });
        });
    });
});
