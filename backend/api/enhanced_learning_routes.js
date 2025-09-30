/**
 * Enhanced Learning Engine API Routes
 * Provides endpoints for advanced learning features
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/asyncHandler');

// Validation schemas
const enhancedFeedbackSchema = {
    type: 'object',
    required: ['recommendation_id', 'ratings'],
    properties: {
        recommendation_id: { type: 'string' },
        user_id: { type: 'string' },
        session_id: { type: 'string' },
        ratings: {
            type: 'object',
            required: ['overall'],
            properties: {
                overall: { type: 'integer', minimum: 1, maximum: 5 },
                flavor_harmony: { type: 'integer', minimum: 1, maximum: 5 },
                texture_balance: { type: 'integer', minimum: 1, maximum: 5 },
                acidity_match: { type: 'integer', minimum: 1, maximum: 5 },
                tannin_balance: { type: 'integer', minimum: 1, maximum: 5 },
                body_match: { type: 'integer', minimum: 1, maximum: 5 },
                regional_tradition: { type: 'integer', minimum: 1, maximum: 5 }
            }
        },
        context: {
            type: 'object',
            properties: {
                occasion: { type: 'string' },
                guest_count: { type: 'integer', minimum: 1, maximum: 50 },
                time_of_day: { type: 'string' },
                season: { type: 'string' },
                weather_context: { type: 'string' }
            }
        },
        behavioral_data: {
            type: 'object',
            properties: {
                selected: { type: 'boolean' },
                time_to_select: { type: 'integer', minimum: 0, maximum: 3600 },
                viewed_duration: { type: 'integer', minimum: 0, maximum: 1800 }
            }
        },
        additional_feedback: {
            type: 'object',
            properties: {
                notes: { type: 'string', maxLength: 1000 },
                would_recommend: { type: 'boolean' },
                price_satisfaction: { type: 'integer', minimum: 1, maximum: 5 }
            }
        }
    }
};

const wineFeatureExtractionSchema = {
    type: 'object',
    required: ['wine_id'],
    properties: {
        wine_id: { type: 'integer' }
    }
};

const dishFeatureExtractionSchema = {
    type: 'object',
    required: ['dish_description'],
    properties: {
        dish_description: { type: 'string', minLength: 3, maxLength: 500 }
    }
};

// POST /api/learning/feedback/enhanced
// Record enhanced pairing feedback with granular ratings
router.post('/feedback/enhanced', 
    requireRole('admin', 'crew'), 
    validate(enhancedFeedbackSchema), 
    asyncHandler(async ({ learningEngine }, req, res) => {
        const feedbackData = req.body;

        try {
            await learningEngine.recordEnhancedPairingFeedback(feedbackData);

            res.json({
                success: true,
                message: 'Enhanced feedback recorded successfully',
                data: {
                    recommendation_id: feedbackData.recommendation_id,
                    recorded_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Enhanced feedback recording failed:', error.message);
            res.status(400).json({
                success: false,
                error: 'Failed to record enhanced feedback',
                details: error.message
            });
        }
    })
);

// GET /api/learning/weights/enhanced
// Get enhanced pairing weights
router.get('/weights/enhanced', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ learningEngine }, req, res) => {
        try {
            const weights = await learningEngine.getEnhancedPairingWeights();

            res.json({
                success: true,
                data: {
                    weights,
                    generated_at: new Date().toISOString(),
                    version: 'enhanced_v1'
                }
            });
        } catch (error) {
            console.error('Failed to get enhanced weights:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve enhanced weights',
                details: error.message
            });
        }
    })
);

// GET /api/learning/user-profile/:userId
// Get user preference profile
router.get('/user-profile/:userId', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ learningEngine }, req, res) => {
        const { userId } = req.params;

        try {
            const profile = await learningEngine.getUserPreferenceProfile(userId);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'User profile not found'
                });
            }

            res.json({
                success: true,
                data: profile
            });
        } catch (error) {
            console.error('Failed to get user profile:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user profile',
                details: error.message
            });
        }
    })
);

// POST /api/learning/features/wine/extract
// Extract wine features for machine learning
router.post('/features/wine/extract', 
    requireRole('admin', 'crew'), 
    validate(wineFeatureExtractionSchema), 
    asyncHandler(async ({ featureService }, req, res) => {
        const { wine_id } = req.body;

        try {
            const features = await featureService.extractWineFeatures(wine_id);

            res.json({
                success: true,
                data: {
                    wine_id,
                    features,
                    extracted_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Wine feature extraction failed:', error.message);
            res.status(400).json({
                success: false,
                error: 'Failed to extract wine features',
                details: error.message
            });
        }
    })
);

// POST /api/learning/features/dish/extract
// Extract dish features for machine learning
router.post('/features/dish/extract', 
    requireRole('admin', 'crew'), 
    validate(dishFeatureExtractionSchema), 
    asyncHandler(async ({ featureService }, req, res) => {
        const { dish_description } = req.body;

        try {
            const features = await featureService.extractDishFeatures(dish_description);

            res.json({
                success: true,
                data: {
                    dish_description,
                    features,
                    extracted_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Dish feature extraction failed:', error.message);
            res.status(400).json({
                success: false,
                error: 'Failed to extract dish features',
                details: error.message
            });
        }
    })
);

// GET /api/learning/features/wine/:wineId
// Get wine features
router.get('/features/wine/:wineId', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ featureService }, req, res) => {
        const { wineId } = req.params;

        try {
            const features = await featureService.getWineFeatures(parseInt(wineId));

            if (!features) {
                return res.status(404).json({
                    success: false,
                    error: 'Wine features not found'
                });
            }

            res.json({
                success: true,
                data: features
            });
        } catch (error) {
            console.error('Failed to get wine features:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve wine features',
                details: error.message
            });
        }
    })
);

// GET /api/learning/features/dish
// Get dish features by description
router.get('/features/dish', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ featureService }, req, res) => {
        const { description } = req.query;

        if (!description) {
            return res.status(400).json({
                success: false,
                error: 'Dish description is required'
            });
        }

        try {
            const features = await featureService.getDishFeatures(description);

            if (!features) {
                return res.status(404).json({
                    success: false,
                    error: 'Dish features not found'
                });
            }

            res.json({
                success: true,
                data: features
            });
        } catch (error) {
            console.error('Failed to get dish features:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve dish features',
                details: error.message
            });
        }
    })
);

// GET /api/learning/interactions/:wineId/:dishDescription
// Get feature interactions between wine and dish
router.get('/interactions/:wineId/:dishDescription', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ learningEngine }, req, res) => {
        const { wineId, dishDescription } = req.params;

        try {
            const interactions = await learningEngine.getFeatureInteractions(
                parseInt(wineId), 
                decodeURIComponent(dishDescription)
            );

            res.json({
                success: true,
                data: {
                    wine_id: parseInt(wineId),
                    dish_description: decodeURIComponent(dishDescription),
                    interactions: interactions || []
                }
            });
        } catch (error) {
            console.error('Failed to get feature interactions:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve feature interactions',
                details: error.message
            });
        }
    })
);

// GET /api/learning/metrics
// Get learning metrics and performance data
router.get('/metrics', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ learningEngine }, req, res) => {
        const { period = 'daily', limit = 30 } = req.query;

        try {
            // This would typically query the LearningMetrics table
            // For now, return mock data structure
            const metrics = {
                pairing_accuracy: 0.85,
                user_satisfaction: 0.82,
                feature_extraction_success_rate: 0.98,
                feedback_quality_score: 0.91,
                model_performance: {
                    precision: 0.87,
                    recall: 0.83,
                    f1_score: 0.85
                },
                data_quality: {
                    total_feedback_count: 1250,
                    high_quality_feedback: 1100,
                    user_consistency_score: 0.78
                }
            };

            res.json({
                success: true,
                data: {
                    metrics,
                    period,
                    generated_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Failed to get learning metrics:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve learning metrics',
                details: error.message
            });
        }
    })
);

// POST /api/learning/validate/feedback
// Validate feedback data quality
router.post('/validate/feedback', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ validationService }, req, res) => {
        const feedbackData = req.body;

        try {
            const validation = validationService.validateEnhancedFeedback(feedbackData);

            res.json({
                success: true,
                data: {
                    validation,
                    validated_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Feedback validation failed:', error.message);
            res.status(400).json({
                success: false,
                error: 'Failed to validate feedback data',
                details: error.message
            });
        }
    })
);

// POST /api/learning/batch/features/wine
// Batch extract wine features
router.post('/batch/features/wine', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ featureService }, req, res) => {
        const { wine_ids } = req.body;

        if (!Array.isArray(wine_ids) || wine_ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'wine_ids must be a non-empty array'
            });
        }

        if (wine_ids.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Batch size cannot exceed 100 wines'
            });
        }

        try {
            const results = await featureService.batchExtractWineFeatures(wine_ids);

            res.json({
                success: true,
                data: {
                    processed_count: results.length,
                    total_requested: wine_ids.length,
                    results,
                    processed_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Batch wine feature extraction failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to extract wine features in batch',
                details: error.message
            });
        }
    })
);

// GET /api/learning/analytics/feedback-quality
// Analyze feedback data quality
router.get('/analytics/feedback-quality', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ validationService }, req, res) => {
        const { limit = 1000 } = req.query;

        try {
            // This would typically query the database for feedback data
            // For now, return mock analysis
            const analysis = {
                total_feedback_count: 1250,
                quality_issues: [
                    {
                        type: 'low_variance',
                        severity: 'warning',
                        message: 'Very low variance in ratings - may indicate bias',
                        count: 45
                    },
                    {
                        type: 'temporal_clustering',
                        severity: 'info',
                        message: 'Feedback appears to be clustered in time',
                        count: 12
                    }
                ],
                recommendations: [
                    'Encourage more diverse feedback collection',
                    'Implement feedback quality scoring',
                    'Add temporal distribution analysis'
                ],
                quality_score: 0.91
            };

            res.json({
                success: true,
                data: {
                    analysis,
                    analyzed_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Failed to analyze feedback quality:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to analyze feedback quality',
                details: error.message
            });
        }
    })
);

module.exports = router;