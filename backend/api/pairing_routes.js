// SommOS Wine Pairing API Routes
// Phase 1: Core Infrastructure - Inventory Management API Enhancements

const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate, validators } = require('../middleware/validate');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializePairings, serializePairingResult } = require('../utils/serialize');
const Database = require('../database/connection');
const EnhancedPairingEngine = require('../core/enhanced_pairing_engine');
const LearningEngine = require('../core/learning_engine');

/**
 * Enhanced Wine Pairing API Routes
 *
 * Features:
 * - AI-powered wine pairing recommendations
 * - Traditional fallback pairing logic
 * - Yacht-optimized performance and caching
 * - Comprehensive error handling and validation
 */

// Initialize services (lazy-loaded for modular router)
let servicesInstance = null;

async function getServices() {
    if (!servicesInstance) {
        const db = Database.getInstance();
        servicesInstance = {
            enhancedPairingEngine: new EnhancedPairingEngine(db),
            learningEngine: new LearningEngine(db)
        };
    }
    return servicesInstance;
}

// Inject services into request for async handlers expecting dependencies
const withServices = (handler) => async (req, res, next) => {
    try {
        const services = await getServices();
        req.dependencies = services;
        return handler(services, req, res);
    } catch (error) {
        return next(error);
    }
};

/**
 * POST /api/pairing/recommend
 * Generate AI-powered wine pairing recommendations
 * Body: { dish, preparation?, ingredients?, occasion?, guestCount?, preferences? }
 */
router.post(
    '/recommend',
    requireRole('admin', 'crew'),
    validate(validators.pairingRecommend),
    withServices(asyncHandler(async ({ enhancedPairingEngine }, req, res) => {
        const { dish, context, guestPreferences, options } = req.body;

        const pairingResult = await enhancedPairingEngine.generatePairings(
            dish,
            context || {},
            guestPreferences || {},
            options || {}
        );

        const sanitized = serializePairingResult(pairingResult);
        res.json({
            success: true,
            data: sanitized
        });
    }))
);

/**
 * POST /api/pairing/quick
 * Generate quick wine pairing recommendations (traditional fallback)
 * Body: { dish, preparation?, ingredients? }
 */
router.post(
    '/quick',
    requireRole('admin', 'crew'),
    validate(validators.pairingQuick),
    withServices(asyncHandler(async ({ enhancedPairingEngine }, req, res) => {
        const { dish, context, ownerLikes } = req.body;
        const quickPairings = await enhancedPairingEngine.quickPairing(dish, context, ownerLikes);

        res.json({
            success: true,
            data: serializePairings(quickPairings)
        });
    }))
);

/**
 * GET /api/pairing/health
 * Check the health status of AI pairing providers
 */
router.get(
    '/health',
    requireRole('admin', 'crew'),
    validate(validators.pairingHealth),
    withServices(asyncHandler(async ({ enhancedPairingEngine }, req, res) => {
        const healthStatus = await enhancedPairingEngine.healthCheck();
        const statusCode = healthStatus.overall === 'healthy' ? 200 : (healthStatus.overall === 'degraded' ? 206 : 503);

        res.status(statusCode).json({
            success: true,
            data: {
                status: healthStatus.overall,
                providers: healthStatus.providers,
                checked_at: new Date().toISOString()
            }
        });
    }))
);

/**
 * POST /api/pairing/feedback
 * Record feedback for a pairing recommendation
 */
router.post(
    '/feedback',
    requireRole('admin', 'crew'),
    validate(validators.pairingFeedback),
    withServices(asyncHandler(async ({ learningEngine }, req, res) => {
        const { recommendation_id, rating, notes, selected = true } = req.body || {};

        await learningEngine.recordPairingFeedback(recommendation_id, rating, notes, selected);

        res.json({
            success: true,
            message: 'Feedback recorded'
        });
    }))
);

/**
 * POST /api/pairing/batch
 * Generate pairing recommendations for multiple dishes
 * Body: { dishes: [{ dish, preparation?, ingredients? }, ...] }
 */
// Batch endpoint removed in Phase 1 modularization (can be reintroduced with validators if needed)

/**
 * GET /api/pairing/cache/clear
 * Clear pairing cache (admin only)
 */
router.post(
    '/cache/clear',
    requireRole('admin'),
    validate(validators.pairingCacheClear),
    withServices(asyncHandler(async ({ enhancedPairingEngine }, req, res) => {
        enhancedPairingEngine.clearCache();
        res.json({
            success: true,
            data: {
                cache_cleared: true,
                cleared_at: new Date().toISOString()
            }
        });
    }))
);

module.exports = router;
