/**
 * ML Algorithms API Routes
 * Provides endpoints for machine learning features and model management
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/asyncHandler');

// Validation schemas
const collaborativeFilteringSchema = {
    type: 'object',
    required: ['user_id', 'dish_context'],
    properties: {
        user_id: { type: 'string' },
        dish_context: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string' },
                intensity: { type: 'string', enum: ['light', 'medium', 'heavy'] },
                cuisine: { type: 'string' },
                season: { type: 'string', enum: ['spring', 'summer', 'autumn', 'winter'] },
                occasion: { type: 'string' }
            }
        },
        options: {
            type: 'object',
            properties: {
                limit: { type: 'integer', minimum: 1, maximum: 50 },
                min_rating: { type: 'number', minimum: 1, maximum: 5 },
                exclude_wines: { type: 'array', items: { type: 'integer' } }
            }
        }
    }
};

const ensembleRecommendationSchema = {
    type: 'object',
    required: ['dish_context'],
    properties: {
        user_id: { type: 'string' },
        dish_context: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string' },
                intensity: { type: 'string', enum: ['light', 'medium', 'heavy'] },
                cuisine: { type: 'string' },
                season: { type: 'string', enum: ['spring', 'summer', 'autumn', 'winter'] },
                occasion: { type: 'string' }
            }
        },
        options: {
            type: 'object',
            properties: {
                limit: { type: 'integer', minimum: 1, maximum: 50 },
                algorithms: { 
                    type: 'array', 
                    items: { 
                        type: 'string', 
                        enum: ['collaborative_filtering', 'content_based', 'rule_based', 'hybrid_cf'] 
                    } 
                },
                dynamic_weighting: { type: 'boolean' },
                context_aware: { type: 'boolean' }
            }
        }
    }
};

const modelCreationSchema = {
    type: 'object',
    required: ['name', 'type', 'algorithm', 'training_data'],
    properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        type: { type: 'string', enum: ['collaborative_filtering', 'content_based', 'hybrid', 'ensemble'] },
        algorithm: { type: 'string' },
        parameters: { type: 'object' },
        training_data: { type: 'array', minItems: 1 },
        metadata: { type: 'object' }
    }
};

// POST /api/ml/collaborative-filtering/user-based
// Generate user-based collaborative filtering recommendations
router.post('/collaborative-filtering/user-based', 
    requireRole('admin', 'crew'), 
    validate(collaborativeFilteringSchema), 
    asyncHandler(async ({ collaborativeFiltering }, req, res) => {
        const { user_id, dish_context, options = {} } = req.body;

        try {
            const recommendations = await collaborativeFiltering.getUserBasedRecommendations(
                user_id,
                dish_context,
                options
            );

            res.json({
                success: true,
                data: {
                    algorithm: 'user_based_collaborative_filtering',
                    user_id,
                    dish_context,
                    recommendations,
                    generated_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('User-based collaborative filtering failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to generate user-based recommendations',
                details: error.message
            });
        }
    })
);

// POST /api/ml/collaborative-filtering/item-based
// Generate item-based collaborative filtering recommendations
router.post('/collaborative-filtering/item-based', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ collaborativeFiltering }, req, res) => {
        const { wine_id, dish_context, options = {} } = req.body;

        if (!wine_id) {
            return res.status(400).json({
                success: false,
                error: 'wine_id is required for item-based collaborative filtering'
            });
        }

        try {
            const recommendations = await collaborativeFiltering.getItemBasedRecommendations(
                wine_id,
                dish_context,
                options
            );

            res.json({
                success: true,
                data: {
                    algorithm: 'item_based_collaborative_filtering',
                    wine_id,
                    dish_context,
                    recommendations,
                    generated_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Item-based collaborative filtering failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to generate item-based recommendations',
                details: error.message
            });
        }
    })
);

// POST /api/ml/collaborative-filtering/hybrid
// Generate hybrid collaborative filtering recommendations
router.post('/collaborative-filtering/hybrid', 
    requireRole('admin', 'crew'), 
    validate(collaborativeFilteringSchema), 
    asyncHandler(async ({ collaborativeFiltering }, req, res) => {
        const { user_id, dish_context, options = {} } = req.body;

        try {
            const recommendations = await collaborativeFiltering.getHybridRecommendations(
                user_id,
                dish_context,
                options
            );

            res.json({
                success: true,
                data: {
                    algorithm: 'hybrid_collaborative_filtering',
                    user_id,
                    dish_context,
                    recommendations,
                    generated_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Hybrid collaborative filtering failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to generate hybrid recommendations',
                details: error.message
            });
        }
    })
);

// POST /api/ml/ensemble/recommendations
// Generate ensemble recommendations using multiple algorithms
router.post('/ensemble/recommendations', 
    requireRole('admin', 'crew'), 
    validate(ensembleRecommendationSchema), 
    asyncHandler(async ({ ensembleEngine }, req, res) => {
        const { user_id, dish_context, options = {} } = req.body;

        try {
            const recommendations = await ensembleEngine.generateEnsembleRecommendations(
                user_id,
                dish_context,
                options
            );

            res.json({
                success: true,
                data: {
                    algorithm: 'ensemble',
                    user_id,
                    dish_context,
                    recommendations,
                    options_used: options,
                    generated_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Ensemble recommendations failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to generate ensemble recommendations',
                details: error.message
            });
        }
    })
);

// POST /api/ml/weights/calculate
// Calculate advanced weights using different algorithms
router.post('/weights/calculate', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ advancedWeighting }, req, res) => {
        const { feedback_data, algorithm = 'ensemble', options = {} } = req.body;

        if (!feedback_data || !Array.isArray(feedback_data)) {
            return res.status(400).json({
                success: false,
                error: 'feedback_data array is required'
            });
        }

        try {
            const weights = await advancedWeighting.calculateAdvancedWeights(
                feedback_data,
                { algorithm, ...options }
            );

            const stats = advancedWeighting.getWeightStats(weights);

            res.json({
                success: true,
                data: {
                    algorithm,
                    weights,
                    statistics: stats,
                    calculated_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Weight calculation failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to calculate advanced weights',
                details: error.message
            });
        }
    })
);

// POST /api/ml/models/create
// Create a new ML model
router.post('/models/create', 
    requireRole('admin'), 
    validate(modelCreationSchema), 
    asyncHandler(async ({ modelManager }, req, res) => {
        const modelData = req.body;

        try {
            const result = await modelManager.createModel(modelData);

            res.json({
                success: true,
                data: {
                    model_id: result.modelId,
                    version: result.version,
                    performance: result.performance,
                    model_path: result.modelPath,
                    created_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Model creation failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to create model',
                details: error.message
            });
        }
    })
);

// GET /api/ml/models/:modelId/:version?
// Load a model by ID and version
router.get('/models/:modelId/:version?', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ modelManager }, req, res) => {
        const { modelId, version = 'latest' } = req.params;

        try {
            const result = await modelManager.loadModel(modelId, version);

            res.json({
                success: true,
                data: {
                    model_id: modelId,
                    version: version,
                    model: result.model,
                    metadata: result.metadata
                }
            });
        } catch (error) {
            console.error('Model loading failed:', error.message);
            res.status(404).json({
                success: false,
                error: 'Model not found',
                details: error.message
            });
        }
    })
);

// POST /api/ml/models/:modelId/:version/update
// Update a model incrementally
router.post('/models/:modelId/:version/update', 
    requireRole('admin'), 
    asyncHandler(async ({ modelManager }, req, res) => {
        const { modelId, version } = req.params;
        const { new_data, options = {} } = req.body;

        if (!new_data || !Array.isArray(new_data)) {
            return res.status(400).json({
                success: false,
                error: 'new_data array is required'
            });
        }

        try {
            const result = await modelManager.updateModelIncremental(
                modelId,
                version,
                new_data,
                options
            );

            res.json({
                success: true,
                data: {
                    model_id: result.modelId,
                    new_version: result.version,
                    performance: result.performance,
                    updated_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Model update failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to update model',
                details: error.message
            });
        }
    })
);

// GET /api/ml/models/:modelId/compare
// Compare model performance across versions
router.get('/models/:modelId/compare', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ modelManager }, req, res) => {
        const { modelId } = req.params;
        const { versions } = req.query;

        if (!versions) {
            return res.status(400).json({
                success: false,
                error: 'versions query parameter is required'
            });
        }

        const versionList = versions.split(',');

        try {
            const comparisons = await modelManager.compareModels(modelId, versionList);

            res.json({
                success: true,
                data: {
                    model_id: modelId,
                    comparisons,
                    compared_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Model comparison failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to compare models',
                details: error.message
            });
        }
    })
);

// POST /api/ml/models/ab-test
// Run A/B test between two models
router.post('/models/ab-test', 
    requireRole('admin'), 
    asyncHandler(async ({ modelManager }, req, res) => {
        const { 
            model_id1, 
            version1, 
            model_id2, 
            version2, 
            test_data, 
            options = {} 
        } = req.body;

        if (!model_id1 || !version1 || !model_id2 || !version2 || !test_data) {
            return res.status(400).json({
                success: false,
                error: 'model_id1, version1, model_id2, version2, and test_data are required'
            });
        }

        try {
            const result = await modelManager.runABTest(
                model_id1, version1, model_id2, version2, test_data, options
            );

            res.json({
                success: true,
                data: {
                    test_id: result.testId,
                    results: result.results,
                    test_record: result.testRecord,
                    started_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('A/B test failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to run A/B test',
                details: error.message
            });
        }
    })
);

// GET /api/ml/models
// List all models
router.get('/models', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ modelManager }, req, res) => {
        const { type, status = 'active', limit = 50, offset = 0 } = req.query;

        try {
            const models = await modelManager.listModels({
                type,
                status,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                success: true,
                data: {
                    models,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        total: models.length
                    }
                }
            });
        } catch (error) {
            console.error('Model listing failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to list models',
                details: error.message
            });
        }
    })
);

// DELETE /api/ml/models/:modelId/:version
// Delete a model version
router.delete('/models/:modelId/:version', 
    requireRole('admin'), 
    asyncHandler(async ({ modelManager }, req, res) => {
        const { modelId, version } = req.params;

        try {
            await modelManager.deleteModel(modelId, version);

            res.json({
                success: true,
                message: `Model ${modelId} version ${version} deleted successfully`,
                deleted_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Model deletion failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to delete model',
                details: error.message
            });
        }
    })
);

// GET /api/ml/similarity/update
// Update similarity matrices
router.post('/similarity/update', 
    requireRole('admin'), 
    asyncHandler(async ({ collaborativeFiltering }, req, res) => {
        try {
            await collaborativeFiltering.updateSimilarityMatrices();

            res.json({
                success: true,
                message: 'Similarity matrices updated successfully',
                updated_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Similarity matrix update failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to update similarity matrices',
                details: error.message
            });
        }
    })
);

// GET /api/ml/cache/stats
// Get cache statistics
router.get('/cache/stats', 
    requireRole('admin', 'crew'), 
    asyncHandler(async ({ collaborativeFiltering, advancedWeighting, ensembleEngine }, req, res) => {
        try {
            const stats = {
                collaborative_filtering: collaborativeFiltering.getCacheStats(),
                advanced_weighting: {
                    size: advancedWeighting.weightCache.size,
                    keys: Array.from(advancedWeighting.weightCache.keys())
                },
                ensemble_engine: ensembleEngine.getEnsembleStats()
            };

            res.json({
                success: true,
                data: {
                    cache_statistics: stats,
                    generated_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Cache stats retrieval failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve cache statistics',
                details: error.message
            });
        }
    })
);

// POST /api/ml/cache/clear
// Clear all caches
router.post('/cache/clear', 
    requireRole('admin'), 
    asyncHandler(async ({ collaborativeFiltering, advancedWeighting, ensembleEngine }, req, res) => {
        try {
            collaborativeFiltering.clearCache();
            advancedWeighting.clearCache();
            ensembleEngine.clearCache();

            res.json({
                success: true,
                message: 'All caches cleared successfully',
                cleared_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Cache clearing failed:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to clear caches',
                details: error.message
            });
        }
    })
);

module.exports = router;