// SommOS API Routes
// Express.js routes for the SommOS yacht wine management system

const express = require('express');
const path = require('path');
const router = express.Router();
const PairingEngine = require('../core/pairing_engine');
const InventoryManager = require('../core/inventory_manager');
const ProcurementEngine = require('../core/procurement_engine');
const LearningEngine = require('../core/learning_engine');
const EnhancedLearningEngine = require('../core/enhanced_learning_engine');
const FeatureEngineeringService = require('../core/feature_engineering_service');
const DataValidationService = require('../core/data_validation_service');
const CollaborativeFilteringEngine = require('../core/collaborative_filtering_engine');
const AdvancedWeightingEngine = require('../core/advanced_weighting_engine');
const MLModelManager = require('../core/ml_model_manager');
const EnsembleEngine = require('../core/ensemble_engine');
const VintageIntelligenceService = require('../core/vintage_intelligence');
const wineGuidanceService = require('../core/wine_guidance_service');
const ExplainabilityService = require('../core/explainability_service');
const Database = require('../database/connection');
const { validate, validators } = require('../middleware/validate');
const { authService, requireAuth, requireRole } = require('../middleware/auth');
const {
    serializeUser,
    serializeInventoryItem,
    serializeInventoryItems,
    serializeInventoryLocations,
    serializeInventoryAction,
    serializeIntakeSummary,
    serializeIntakeReceive,
    serializeIntakeStatus,
    serializePairings,
    serializePairingResult,
    serializeProcurementRecommendations,
    serializeProcurementAnalysis,
    serializePurchaseOrder,
    serializeWineList,
    serializeWineDetail,
    serializeVintage,
    serializeLedger,
    serializeSyncRows,
    serializeVintageEnrichmentList,
    serializeVintageProcurementRecommendations,
} = require('../utils/serialize');
const authRouter = require('./auth');
const enhancedLearningRouter = require('./enhanced_learning_routes');
const mlRouter = require('./ml_routes');
const performanceRouter = require('./performance_routes');
const rumRouter = require('./rum_routes');

let servicesPromise = null;

const SYNC_CHANGE_TABLES = [
    { table: 'Wines', key: 'wines' },
    { table: 'Vintages', key: 'vintages' },
    { table: 'Stock', key: 'stock' },
    { table: 'Suppliers', key: 'suppliers' },
    { table: 'PriceBook', key: 'price_book' },
    { table: 'InventoryIntakeOrders', key: 'inventory_intake_orders' },
    { table: 'InventoryIntakeItems', key: 'inventory_intake_items' }
];

async function createServices() {
    const db = Database.getInstance();
    const learningEngine = new LearningEngine(db);
    const enhancedLearningEngine = new EnhancedLearningEngine(db);
    const featureService = new FeatureEngineeringService(db);
    const validationService = new DataValidationService();
    const collaborativeFiltering = new CollaborativeFilteringEngine(db);
    const advancedWeighting = new AdvancedWeightingEngine(db);
    const modelManager = new MLModelManager(db);
    const ensembleEngine = new EnsembleEngine(db);

    try {
        await learningEngine.initialize();
        await enhancedLearningEngine.initialize();
    } catch (error) {
        console.warn('Learning engine initialization failed:', error.message);
    }

    const explainabilityService = new ExplainabilityService(db);

    return {
        db,
        learningEngine,
        enhancedLearningEngine,
        featureService,
        validationService,
        collaborativeFiltering,
        advancedWeighting,
        modelManager,
        ensembleEngine,
        pairingEngine: new PairingEngine(db, enhancedLearningEngine, explainabilityService),
        inventoryManager: new InventoryManager(db, enhancedLearningEngine),
        procurementEngine: new ProcurementEngine(db, enhancedLearningEngine),
        vintageIntelligenceService: new VintageIntelligenceService(db),
        explainabilityService
    };
}

async function getServices() {
    if (!servicesPromise) {
        servicesPromise = createServices();
    }

    try {
        return await servicesPromise;
    } catch (error) {
        servicesPromise = null;
        throw error;
    }
}

const sendError = (res, status, code, message, details) => {
    const payload = {
        success: false,
        error: {
            code,
            message
        }
    };

    if (typeof details !== 'undefined') {
        payload.error.details = details;
    }

    return res.status(status).json(payload);
};

const withServices = (handler, { onError } = {}) => async (req, res, next) => {
    let services;

    try {
        services = await getServices();
    } catch (error) {
        if (typeof onError === 'function') {
            onError(error, req, res, next);
        } else if (!res.headersSent) {
            sendError(
                res,
                error.status || 500,
                error.code || 'SERVICE_INITIALIZATION_FAILED',
                error.message || 'Failed to initialize services.'
            );
        }
        return;
    }

    return handler(services, req, res, next);
};

// Middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.use('/auth', authRouter);
router.use('/learning', enhancedLearningRouter);
router.use('/ml', mlRouter);
router.use('/performance', performanceRouter);
router.use('/performance', rumRouter);

const requireAuthAndRole = (...roles) => [requireAuth(), requireRole(...roles)];

router.post(
    '/guest/session',
    validate(validators.guestSession),
    asyncHandler(async (req, res) => {
        const { event_code: eventCode, invite_token: inviteToken, pin } = req.body;
        const token = eventCode || inviteToken;

        try {
            const { user, tokens } = await authService.createGuestSession({ token, pin });
            authService.attachTokensToResponse(res, tokens);

            return res.status(201).json({
                success: true,
                data: serializeUser(user),
                meta: {
                    access_token_expires_in: Math.floor(tokens.accessTtlMs / 1000),
                    refresh_token_expires_in: Math.floor(tokens.refreshTtlMs / 1000),
                },
            });
        } catch (error) {
            if (['PIN_REQUIRED', 'INVALID_PIN'].includes(error.message)) {
                const status = error.message === 'PIN_REQUIRED' ? 400 : 401;
                return sendError(
                    res,
                    status,
                    error.message,
                    error.message === 'PIN_REQUIRED'
                        ? 'A PIN is required to start this guest session.'
                        : 'The supplied PIN is incorrect.'
                );
            }

            if (['INVALID_GUEST_CODE', 'INVALID_INVITE'].includes(error.message)) {
                return sendError(
                    res,
                    404,
                    'INVALID_GUEST_CODE',
                    'Guest event code is invalid or has expired.'
                );
            }

            if (error.message === 'GUEST_CODE_REQUIRED') {
                return sendError(
                    res,
                    400,
                    'GUEST_CODE_REQUIRED',
                    'An event code is required to start a guest session.'
                );
            }

            if (error.message === 'INVALID_GUEST_PROFILE') {
                return sendError(
                    res,
                    409,
                    'INVALID_GUEST_PROFILE',
                    'Guest profile is no longer eligible for read-only access.'
                );
            }

            console.error('Guest session error:', error);

            return sendError(
                res,
                500,
                'GUEST_SESSION_FAILED',
                'Unable to start a guest session at this time.'
            );
        }
    })
);

function formatInventoryItemByRole(item, role) {
    const normalizedRole = role === 'admin' || role === 'crew' ? role : 'guest';
    return serializeInventoryItem(item, {
        role: normalizedRole,
        guidance: wineGuidanceService.getGuidance(item),
    });
}

// ============================================================================
// PAIRING ENDPOINTS
// ============================================================================

// POST /api/pairing/recommend
// Generate wine pairing recommendations
router.post('/pairing/recommend', requireRole('admin', 'crew'), validate(validators.pairingRecommend), asyncHandler(withServices(async ({ pairingEngine }, req, res) => {
    const { dish, context, guestPreferences, options } = req.body;

    if (!dish) {
        return sendError(res, 400, 'MISSING_DISH', 'Dish information is required.');
    }

    try {
        const pairingResult = await pairingEngine.generatePairings(
            dish,
            context || {},
            guestPreferences || {},
            options || {}
        );

        const sanitized = serializePairingResult(pairingResult);
        const responsePayload = {
            success: true,
            data: sanitized
        };

        const sessionId = sanitized?.recommendations?.[0]?.learning_session_id;
        if (sessionId) {
            responsePayload.meta = { learning_session_id: sessionId };
        }

        res.json(responsePayload);
    } catch (error) {
        sendError(res, 500, 'PAIRING_RECOMMENDATION_FAILED', error.message || 'Failed to generate recommendations.');
    }
}))); 

// POST /api/pairing/quick
// Quick pairing for immediate service
router.post('/pairing/quick', requireRole('admin', 'crew'), validate(validators.pairingQuick), asyncHandler(withServices(async ({ pairingEngine }, req, res) => {
    const { dish, context, ownerLikes } = req.body;

    try {
        const quickPairings = await pairingEngine.quickPairing(dish, context, ownerLikes);

        res.json({
            success: true,
            data: serializePairings(quickPairings)
        });
    } catch (error) {
        sendError(res, 500, 'PAIRING_QUICK_FAILED', error.message || 'Failed to generate quick pairing.');
    }
}))); 

// POST /api/pairing/feedback
// Capture owner feedback to improve future pairings
router.post('/pairing/feedback', requireRole('admin', 'crew'), validate(validators.pairingFeedback), asyncHandler(withServices(async ({ learningEngine }, req, res) => {
    const { recommendation_id, rating, notes, selected = true } = req.body || {};

    if (!recommendation_id || !rating) {
        return sendError(res, 400, 'MISSING_FEEDBACK_FIELDS', 'recommendation_id and rating are required.');
    }

    try {
        await learningEngine.recordPairingFeedback(recommendation_id, rating, notes, selected);

        res.json({
            success: true,
            message: 'Feedback recorded'
        });
    } catch (error) {
        sendError(res, 500, 'PAIRING_FEEDBACK_FAILED', error.message || 'Failed to record feedback.');
    }
})));

// GET /api/explanations/:entity_type/:entity_id
// Retrieve explainability records linked to recommendations in a guest-safe format
router.get(
    '/explanations/:entity_type/:entity_id',
    requireRole('admin', 'crew', 'guest'),
    validate(validators.explanationsByEntity),
    asyncHandler(withServices(async ({ explainabilityService }, req, res) => {
        const { entity_type: entityType, entity_id: entityId } = req.params;
        const { limit } = req.query;

        try {
            const explanations = await explainabilityService.listExplanations({
                entityType,
                entityId,
                limit,
                role: req.user?.role || 'guest'
            });

            res.json({
                success: true,
                data: explanations
            });
        } catch (error) {
            console.error('Failed to fetch explanations:', error);
            sendError(res, 500, 'EXPLANATIONS_FETCH_FAILED', 'Unable to load explanations at this time.');
        }
    }))
);

// POST /api/explanations
// Create a new explanation entry for a recommendation (crew only)
router.post(
    '/explanations',
    requireRole('admin', 'crew'),
    validate(validators.explainabilityCreate),
    asyncHandler(withServices(async ({ explainabilityService }, req, res) => {
        const { entity_type: entityType, entity_id: entityId, summary, factors, generated_at: generatedAt } = req.body;

        try {
            const explanation = await explainabilityService.createExplanation({
                entityType,
                entityId,
                summary,
                factors,
                generatedAt
            });

            res.status(201).json({
                success: true,
                data: explanation
            });
        } catch (error) {
            console.error('Failed to create explanation:', error);
            sendError(res, 500, 'EXPLANATION_CREATE_FAILED', 'Unable to save explanation at this time.');
        }
    }))
);

// GET /api/memories
// Retrieve operational memories for wines, vintages, guests, or events
router.get(
    '/memories',
    requireRole('admin', 'crew', 'guest'),
    validate(validators.memoriesList),
    asyncHandler(withServices(async ({ explainabilityService }, req, res) => {
        const { subject_type: subjectType, subject_id: subjectId, limit } = req.query;

        try {
            const memories = await explainabilityService.listMemories({
                subjectType,
                subjectId,
                limit,
                role: req.user?.role || 'guest'
            });

            res.json({
                success: true,
                data: memories
            });
        } catch (error) {
            console.error('Failed to fetch memories:', error);
            sendError(res, 500, 'MEMORIES_FETCH_FAILED', 'Unable to load memories at this time.');
        }
    }))
);

// POST /api/memories
// Record a new operational memory note (crew only)
router.post(
    '/memories',
    requireRole('admin', 'crew'),
    validate(validators.memoriesCreate),
    asyncHandler(withServices(async ({ explainabilityService }, req, res) => {
        const { subject_type: subjectType, subject_id: subjectId, note, tags } = req.body;

        try {
            const memory = await explainabilityService.createMemory({
                subjectType,
                subjectId,
                authorId: req.user?.id || null,
                note,
                tags
            });

            res.status(201).json({
                success: true,
                data: memory
            });
        } catch (error) {
            console.error('Failed to create memory:', error);
            sendError(res, 500, 'MEMORY_CREATE_FAILED', 'Unable to save memory at this time.');
        }
    }))
);

// ============================================================================
// INVENTORY ENDPOINTS
// ============================================================================

// GET /api/inventory
// Paginated inventory list
router.get(
    '/inventory',
    ...requireAuthAndRole('admin', 'crew', 'guest'),
    validate(validators.inventoryList),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        const { location, wine_type, region, available_only, limit, offset } = req.query;
        const availableOnlyFlag = typeof available_only === 'string'
            ? available_only === 'true'
            : Boolean(available_only);

        const result = await inventoryManager.getInventoryList(
            {
                location,
                wine_type,
                region,
                available_only: availableOnlyFlag
            },
            { limit, offset }
        );

        const role = req.user?.role || 'guest';

        const data = result.items.map((item) => formatInventoryItemByRole(item, role));

        res.json({
            success: true,
            data,
            meta: {
                total: result.total,
                limit: result.limit,
                offset: result.offset
            }
        });
    }))
);

// GET /api/inventory/stock
// Get current stock levels
router.get(
    '/inventory/stock',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.inventoryStock),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        const { location, wine_type, region, available_only } = req.query;
        const availableOnlyFlag = typeof available_only === 'string'
            ? available_only === 'true'
            : Boolean(available_only);

        try {
            const stock = await inventoryManager.getCurrentStock({
                location,
                wine_type,
                region,
                available_only: availableOnlyFlag
            });

            const role = req.user?.role === 'admin' ? 'admin' : 'crew';
            const data = serializeInventoryItems(stock, role, {
                guidanceResolver: (item) => wineGuidanceService.getGuidance(item),
            });

            res.json({
                success: true,
                data
            });
    } catch (error) {
        sendError(res, 500, 'INVENTORY_STOCK_ERROR', error.message || 'Failed to retrieve inventory stock.');
    }
    }))
);

// GET /api/inventory/:id
// Retrieve a specific stock item by identifier
router.get(
    '/inventory/:id',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.inventoryById),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        const { id } = req.params;

        const stockItem = await inventoryManager.getStockItemById(id);

        if (!stockItem) {
            return sendError(res, 404, 'INVENTORY_NOT_FOUND', 'Inventory item not found.');
        }

        res.json({
            success: true,
            data: serializeInventoryItem(stockItem, {
                role: 'crew',
                guidance: wineGuidanceService.getGuidance(stockItem),
            })
        });
    }))
);

// GET /api/locations
// List available storage locations
router.get('/locations', requireRole('admin', 'crew', 'guest'), validate(), asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
    const locations = await inventoryManager.listLocations();

    res.json({
        success: true,
        data: serializeInventoryLocations(locations)
    });
})));

// POST /api/inventory/consume
// Record wine consumption
router.post(
    '/inventory/consume',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.inventoryConsume),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        const { vintage_id, location, quantity, notes, created_by } = req.body;

        if (!vintage_id || !location || !quantity) {
            return sendError(
                res,
                400,
                'INVENTORY_CONSUME_VALIDATION',
                'vintage_id, location, and quantity are required.'
            );
        }

        try {
            const result = await inventoryManager.consumeWine(
                vintage_id,
                location,
                quantity,
                notes,
                created_by,
                req.body.sync || {}
            );

            res.json({
                success: true,
                data: serializeInventoryAction(result)
            });
        } catch (error) {
            console.error('Inventory consume error:', error);
            const conflict = typeof InventoryManager.isConflictError === 'function'
                && InventoryManager.isConflictError(error);
            if (conflict) {
                return sendError(res, 409, 'INVENTORY_CONFLICT', error.message || 'Inventory change conflicts with current stock.');
            }
            sendError(res, 500, 'INVENTORY_CONSUME_FAILED', error.message || 'Failed to record consumption.');
        }
    }))
);

// POST /api/inventory/receive
// Record wine receipt/delivery
router.post(
    '/inventory/receive',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.inventoryReceive),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        const { vintage_id, location, quantity, unit_cost, reference_id, notes, created_by } = req.body;

        if (!vintage_id || !location || !quantity) {
            return sendError(
                res,
                400,
                'INVENTORY_RECEIVE_VALIDATION',
                'vintage_id, location, and quantity are required.'
            );
        }

        try {
            const result = await inventoryManager.receiveWine(
                vintage_id,
                location,
                quantity,
                unit_cost,
                reference_id,
                notes,
                created_by,
                req.body.sync || {}
            );

            res.json({
                success: true,
                data: serializeInventoryAction(result)
            });
        } catch (error) {
            sendError(res, 500, 'INVENTORY_RECEIVE_FAILED', error.message || 'Failed to record receipt.');
        }
    }))
);

// POST /api/inventory/intake
// Create a new intake order from external sources
router.post(
    '/inventory/intake',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.inventoryIntake),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        try {
            const result = await inventoryManager.createInventoryIntake(req.body || {});
            res.json({
                success: true,
                data: serializeIntakeSummary(result)
            });
        } catch (error) {
            const clientSide = /required|Unable|not found|extract/i.test(error.message || '');
            const statusCode = clientSide ? 400 : 500;
            const code = clientSide ? 'INVENTORY_INTAKE_INVALID' : 'INVENTORY_INTAKE_FAILED';
            sendError(res, statusCode, code, error.message || 'Failed to create inventory intake.');
        }
    }))
);

// POST /api/inventory/intake/:intakeId/receive
// Mark bottles as received against an intake order
router.post(
    '/inventory/intake/:intakeId/receive',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.inventoryIntakeReceive),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        const intakeId = parseInt(req.params.intakeId, 10);
        const { receipts, created_by, notes } = req.body || {};

        if (!Array.isArray(receipts) || receipts.length === 0) {
            return sendError(
                res,
                400,
                'INVENTORY_INTAKE_RECEIPTS_REQUIRED',
                'receipts array with at least one entry is required.'
            );
        }

        try {
            const result = await inventoryManager.receiveInventoryIntake(
                intakeId,
                receipts,
                { created_by, notes, sync: req.body.sync }
            );

            res.json({
                success: true,
                data: serializeIntakeReceive(result)
            });
        } catch (error) {
            const clientSide = /required|Unable|not found/i.test(error.message || '');
            const statusCode = clientSide ? 400 : 500;
            const code = clientSide ? 'INVENTORY_INTAKE_RECEIVE_INVALID' : 'INVENTORY_INTAKE_RECEIVE_FAILED';
            sendError(res, statusCode, code, error.message || 'Failed to receive inventory intake.');
        }
    }))
);

// GET /api/inventory/intake/:intakeId/status
// Verify whether all bottles from an intake have been received
router.get(
    '/inventory/intake/:intakeId/status',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.inventoryIntakeStatus),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        const intakeId = parseInt(req.params.intakeId, 10);

        try {
            const result = await inventoryManager.getInventoryIntakeStatus(intakeId);
            res.json({
                success: true,
                data: serializeIntakeStatus(result)
            });
        } catch (error) {
            const notFound = /required|not found/i.test(error.message || '');
            const statusCode = notFound ? 404 : 500;
            const code = notFound ? 'INVENTORY_INTAKE_STATUS_NOT_FOUND' : 'INVENTORY_INTAKE_STATUS_FAILED';
            sendError(res, statusCode, code, error.message || 'Failed to retrieve inventory intake status.');
        }
    }))
);

// POST /api/inventory/move
// Move wine between locations
router.post(
    '/inventory/move',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.inventoryMove),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        const { vintage_id, from_location, to_location, quantity, notes, created_by } = req.body;

        if (!vintage_id || !from_location || !to_location || !quantity) {
            return sendError(
                res,
                400,
                'INVENTORY_MOVE_VALIDATION',
                'vintage_id, from_location, to_location, and quantity are required.'
            );
        }

        try {
            const result = await inventoryManager.moveWine(
                vintage_id,
                from_location,
                to_location,
                quantity,
                notes,
                created_by,
                req.body.sync || {}
            );

            res.json({
                success: true,
                data: serializeInventoryAction(result)
            });
        } catch (error) {
            const conflict = typeof InventoryManager.isConflictError === 'function'
                && InventoryManager.isConflictError(error);
            if (conflict) {
                return sendError(res, 409, 'INVENTORY_CONFLICT', error.message || 'Inventory change conflicts with current stock.');
            }
            sendError(res, 500, 'INVENTORY_MOVE_FAILED', error.message || 'Failed to move inventory.');
        }
    }))
);

// POST /api/inventory/reserve
// Reserve wine for future service
router.post(
    '/inventory/reserve',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.inventoryReserve),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        const { vintage_id, location, quantity, notes, created_by } = req.body;

        if (!vintage_id || !location || !quantity) {
            return sendError(
                res,
                400,
                'INVENTORY_RESERVE_VALIDATION',
                'vintage_id, location, and quantity are required.'
            );
        }

        try {
            const result = await inventoryManager.reserveWine(
                vintage_id,
                location,
                quantity,
                notes,
                created_by,
                req.body.sync || {}
            );

            res.json({
                success: true,
                data: serializeInventoryAction(result)
            });
        } catch (error) {
            const conflict = typeof InventoryManager.isConflictError === 'function'
                && InventoryManager.isConflictError(error);
            if (conflict) {
                return sendError(res, 409, 'INVENTORY_CONFLICT', error.message || 'Inventory change conflicts with current stock.');
            }
            sendError(res, 500, 'INVENTORY_RESERVE_FAILED', error.message || 'Failed to reserve inventory.');
        }
    }))
);

// GET /api/inventory/ledger/:vintage_id
// Get transaction history for a vintage
router.get(
    '/inventory/ledger/:vintage_id',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.inventoryLedger),
    asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
        const { vintage_id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        try {
            const ledger = await inventoryManager.getLedgerHistory(
                vintage_id,
                parseInt(limit, 10),
                parseInt(offset, 10)
            );

            res.json({
                success: true,
                data: serializeLedger(ledger)
            });
        } catch (error) {
            sendError(res, 500, 'INVENTORY_LEDGER_FAILED', error.message || 'Failed to retrieve inventory ledger.');
        }
    }))
);

// ============================================================================
// PROCUREMENT ENDPOINTS
// ============================================================================

// GET /api/procurement/opportunities
// Get procurement opportunities
router.get(
    '/procurement/opportunities',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.procurementOpportunities),
    asyncHandler(withServices(async ({ procurementEngine }, req, res) => {
        const { region, regions, wine_type, wine_types, max_price, min_score, budget } = req.query;

        try {
            const opportunities = await procurementEngine.analyzeProcurementOpportunities({
                region,
                regions,
                wine_type,
                wine_types,
                max_price: max_price ? parseFloat(max_price) : undefined,
                budget: budget ? parseFloat(budget) : undefined,
                min_score: min_score ? parseInt(min_score, 10) : undefined
            });

            res.json({
                success: true,
                data: serializeProcurementRecommendations(opportunities)
            });
        } catch (error) {
            sendError(res, 500, 'PROCUREMENT_ANALYSIS_FAILED', error.message || 'Failed to analyze procurement decision.');
        }
    }))
);

// POST /api/procurement/analyze
// Analyze specific procurement decision
router.post(
    '/procurement/analyze',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.procurementAnalyze),
    asyncHandler(withServices(async ({ procurementEngine }, req, res) => {
        const { vintage_id, supplier_id, quantity, context } = req.body;

        if (!vintage_id || !supplier_id) {
            return sendError(res, 400, 'PROCUREMENT_ANALYZE_VALIDATION', 'vintage_id and supplier_id are required.');
        }

        try {
            const analysis = await procurementEngine.analyzePurchaseDecision(
                vintage_id,
                supplier_id,
                quantity || 12,
                context || {}
            );

            res.json({
                success: true,
                data: serializeProcurementAnalysis(analysis)
            });
        } catch (error) {
            sendError(res, 500, 'PROCUREMENT_ANALYSIS_FAILED', error.message || 'Failed to analyze procurement decision.');
        }
    }))
);

// POST /api/procurement/order
// Generate purchase order
router.post(
    '/procurement/order',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.procurementOrder),
    asyncHandler(withServices(async ({ procurementEngine }, req, res) => {
        const { items, supplier_id, delivery_date, notes } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return sendError(res, 400, 'PROCUREMENT_ORDER_ITEMS_REQUIRED', 'Items array is required.');
        }

        if (!supplier_id) {
            return sendError(res, 400, 'PROCUREMENT_ORDER_SUPPLIER_REQUIRED', 'supplier_id is required.');
        }

        try {
            const order = await procurementEngine.generatePurchaseOrder(
                items,
                supplier_id,
                delivery_date,
                notes
            );

            res.json({
                success: true,
                data: serializePurchaseOrder(order)
            });
        } catch (error) {
            sendError(res, 500, 'PROCUREMENT_ORDER_FAILED', error.message || 'Failed to generate purchase order.');
        }
    }))
);

// ============================================================================
// WINE CATALOG ENDPOINTS
// ============================================================================

// GET /api/wines
// Get wine catalog
router.get('/wines', requireRole('admin', 'crew', 'guest'), validate(validators.winesList), asyncHandler(withServices(async ({ db }, req, res) => {
    const { region, wine_type, producer, search, limit = 50, offset = 0 } = req.query;

    try {
        let query = `
            SELECT w.*, v.year, v.quality_score, v.weather_score, v.critic_score,
                   v.peak_drinking_start, v.peak_drinking_end,
                   COALESCE(SUM(s.quantity), 0) as total_stock,
                   ROUND(AVG(COALESCE(s.cost_per_bottle, s.current_value)), 2) as avg_cost_per_bottle,
                   COALESCE(SUM(s.quantity * COALESCE(s.current_value, s.cost_per_bottle, 0)), 0) as total_value
            FROM Wines w
            LEFT JOIN Vintages v ON w.id = v.wine_id
            LEFT JOIN Stock s ON v.id = s.vintage_id
            WHERE 1=1
        `;

        const params = [];

        if (region) {
            query += ' AND w.region LIKE ?';
            params.push(`%${region}%`);
        }

        if (wine_type) {
            query += ' AND w.wine_type = ?';
            params.push(wine_type);
        }

        if (producer) {
            query += ' AND w.producer LIKE ?';
            params.push(`%${producer}%`);
        }

        if (search) {
            query += ' AND (w.name LIKE ? OR w.producer LIKE ? OR w.region LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' GROUP BY w.id, v.id ORDER BY w.name LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const wines = await db.all(query, params);
        const data = serializeWineList(
            wines,
            (wine) => wineGuidanceService.getGuidance(wine),
            ['year', 'total_stock', 'avg_cost_per_bottle', 'total_value', 'peak_drinking_start', 'peak_drinking_end']
        );

        res.json({
            success: true,
            data
        });
    } catch (error) {
        sendError(res, 500, 'WINES_LIST_FAILED', error.message || 'Failed to retrieve wines.');
    }
}))); 

// POST /api/wines
// Add new wine to inventory with vintage intelligence
router.post('/wines', requireRole('admin', 'crew'), validate(validators.winesCreate), asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
    const { wine, vintage, stock } = req.body;

    if (!wine || !vintage || !stock) {
        return sendError(res, 400, 'WINES_CREATE_VALIDATION', 'Wine, vintage, and stock information are required.');
    }

    try {
        const result = await inventoryManager.addWineToInventory(wine, vintage, stock, {
            sync: req.body.sync,
            updated_by: stock?.created_by || req.body?.sync?.updated_by,
            origin: req.body?.sync?.origin || 'inventory.wine.create'
        });

        const responseData = {
            success: Boolean(result?.success),
            wine: result?.wine
                ? serializeWine(result.wine, {
                    guidance: wineGuidanceService.getGuidance(result.wine),
                    extraFields: ['year'],
                })
                : null,
            vintage: result?.vintage ? serializeVintage(result.vintage) : null,
        };

        if (result?.enrichmentError) {
            responseData.enrichment_error = result.enrichmentError;
        }

        res.status(201).json({
            success: true,
            data: responseData,
            message: 'Wine added to inventory with vintage intelligence analysis'
        });
    } catch (error) {
        sendError(res, 500, 'WINES_CREATE_FAILED', error.message || 'Failed to add wine to inventory.');
    }
}))); 

// GET /api/wines/:id
// Get specific wine details
router.get('/wines/:id', requireRole('admin', 'crew', 'guest'), validate(validators.winesById), asyncHandler(withServices(async ({ db }, req, res) => {
    const { id } = req.params;

    try {
        // Get wine details
        const wineRecord = await db.get('SELECT * FROM Wines WHERE id = ?', [id]);
        if (!wineRecord) {
            return sendError(res, 404, 'WINE_NOT_FOUND', 'Wine not found.');
        }

        const guidance = wineGuidanceService.getGuidance(wineRecord);

        // Get vintages
        const vintages = await db.all(`
            SELECT v.*,
                   COALESCE(SUM(s.quantity), 0) as total_stock,
                   ROUND(AVG(COALESCE(s.cost_per_bottle, s.current_value)), 2) as avg_cost_per_bottle,
                   COALESCE(SUM(s.quantity * COALESCE(s.current_value, s.cost_per_bottle, 0)), 0) as total_value
            FROM Vintages v
            LEFT JOIN Stock s ON v.id = s.vintage_id
            WHERE v.wine_id = ?
            GROUP BY v.id
            ORDER BY v.year DESC
        `, [id]);

        // Get aliases
        const aliases = await db.all('SELECT * FROM Aliases WHERE wine_id = ?', [id]);

        const primaryVintage = vintages[0] || {};
        const totalStock = vintages.reduce((sum, vintage) => sum + (vintage.total_stock || 0), 0);
        const totalValue = vintages.reduce((sum, vintage) => sum + (vintage.total_value || 0), 0);
        const averageCost = totalStock > 0 ? Number((totalValue / totalStock).toFixed(2)) : null;
        const normalizedWine = {
            ...wineRecord,
            quality_score: wineRecord.quality_score ?? primaryVintage.quality_score ?? null,
            weather_score: wineRecord.weather_score ?? primaryVintage.weather_score ?? null,
            critic_score: wineRecord.critic_score ?? primaryVintage.critic_score ?? null,
            peak_drinking_start: wineRecord.peak_drinking_start ?? primaryVintage.peak_drinking_start ?? null,
            peak_drinking_end: wineRecord.peak_drinking_end ?? primaryVintage.peak_drinking_end ?? null,
            year: primaryVintage.year ?? wineRecord.year ?? null,
        };

        const data = serializeWineDetail({
            wine: normalizedWine,
            vintages,
            aliases,
            aggregates: {
                total_stock: totalStock,
                total_value: Number(totalValue.toFixed(2)),
                avg_cost_per_bottle: averageCost,
            },
            guidance,
        });

        res.json({
            success: true,
            data
        });
    } catch (error) {
        sendError(res, 500, 'WINE_DETAILS_FAILED', error.message || 'Failed to retrieve wine details.');
    }
}))); 

// ============================================================================
// VINTAGE INTELLIGENCE ENDPOINTS
// ============================================================================

// GET /api/vintage/analysis/:wine_id
// Get vintage analysis for specific wine
router.get('/vintage/analysis/:wine_id', requireRole('admin', 'crew', 'guest'), validate(validators.vintageAnalysis), asyncHandler(withServices(async ({ db, vintageIntelligenceService }, req, res) => {
    const { wine_id } = req.params;

    try {
        // Get wine and vintage details
        const wine = await db.get(`
            SELECT w.*, v.*
            FROM Wines w
            JOIN Vintages v ON w.id = v.wine_id
            WHERE w.id = ?
        `, [wine_id]);

        if (!wine) {
            return sendError(res, 404, 'WINE_NOT_FOUND', 'Wine not found.');
        }

        // Get weather context for this wine
        const weatherAnalysis = await vintageIntelligenceService.getWeatherContextForPairing(wine);

        // Parse production notes if available
        let vintageSummary = null;
        let procurementRec = null;

        if (wine.production_notes) {
            try {
                // Check if it's valid JSON first
                if (typeof wine.production_notes === 'string' && wine.production_notes.trim().startsWith('{')) {
                    const notes = JSON.parse(wine.production_notes);
                    vintageSummary = notes.vintageSummary;
                    procurementRec = notes.procurementRec;
                } else {
                    // Treat as plain text
                    vintageSummary = wine.production_notes;
                }
            } catch (parseError) {
                // Fallback to treating as plain text
                vintageSummary = wine.production_notes;
                console.warn('Production notes treated as plain text:', parseError.message);
            }
        }

        res.json({
            success: true,
            data: {
                wine: {
                    name: wine.name,
                    producer: wine.producer,
                    region: wine.region,
                    year: wine.year,
                    wine_type: wine.wine_type
                },
                weatherAnalysis,
                vintageSummary,
                procurementRec,
                qualityScore: wine.quality_score,
                weatherScore: wine.weather_score
            }
        });
    } catch (error) {
        sendError(res, 500, 'VINTAGE_ANALYSIS_FAILED', error.message || 'Failed to retrieve vintage analysis.');
    }
}))); 

// POST /api/vintage/enrich
// Manually trigger vintage enrichment for a specific wine
router.post(
    '/vintage/enrich',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.vintageEnrich),
    asyncHandler(withServices(async ({ db, vintageIntelligenceService }, req, res) => {
        const { wine_id } = req.body;

        if (!wine_id) {
            return sendError(res, 400, 'VINTAGE_ENRICH_VALIDATION', 'wine_id is required.');
        }

        try {
            // Get wine details
            const wine = await db.get(`
                SELECT w.*, v.*
                FROM Wines w
                LEFT JOIN Vintages v ON w.id = v.wine_id
                WHERE w.id = ?
            `, [wine_id]);

            if (!wine) {
                return sendError(res, 404, 'WINE_NOT_FOUND', 'Wine not found.');
            }

            // Enrich the wine data
            const enrichedData = await vintageIntelligenceService.enrichWineData(wine);
            const [sanitized] = serializeVintageEnrichmentList([enrichedData]);

            res.json({
                success: true,
                data: sanitized,
                message: 'Wine enriched with vintage intelligence'
            });
        } catch (error) {
            sendError(res, 500, 'VINTAGE_ENRICH_FAILED', error.message || 'Failed to enrich wine data.');
        }
    }))
);

// GET /api/vintage/:id/refresh-weather
// Refresh cached weather analysis for a specific vintage
router.get(
    '/vintage/:id/refresh-weather',
    ...requireAuthAndRole('admin', 'crew'),
    validate(validators.vintageRefreshWeather),
    asyncHandler(withServices(async ({ db, vintageIntelligenceService }, req, res) => {
        const { id } = req.params;
        const { force: forceParam = false } = req.query;
        const forceRefresh = Boolean(forceParam);

        try {
            const vintage = await db.get(`
                SELECT v.id, v.year, v.wine_id,
                       w.name AS wine_name,
                       w.producer AS wine_producer,
                       w.region AS wine_region,
                       w.country AS wine_country
                FROM Vintages v
                JOIN Wines w ON v.wine_id = w.id
                WHERE v.id = ?
            `, [id]);

            if (!vintage) {
                return sendError(res, 404, 'VINTAGE_NOT_FOUND', 'Vintage not found.');
            }

            const aliasRow = await db.get(`
                SELECT alias_name
                FROM Aliases
                WHERE wine_id = ?
                ORDER BY created_at ASC
                LIMIT 1
            `, [vintage.wine_id]);

            const aliasName = aliasRow ? aliasRow.alias_name : null;

            const weatherData = await vintageIntelligenceService.refreshVintageWeather(
                { ...vintage, alias_name: aliasName },
                {
                    forceRefresh,
                    vineyardAlias: aliasName
                }
            );

            if (!weatherData) {
                return sendError(res, 503, 'WEATHER_REFRESH_UNAVAILABLE', 'Unable to refresh weather data at this time.');
            }

            res.json({
                success: true,
                data: {
                    weatherAnalysis: weatherData,
                    metadata: {
                        forceRefresh,
                        vineyardAlias: aliasName
                    }
                }
            });
        } catch (error) {
            sendError(res, 500, 'WEATHER_REFRESH_FAILED', error.message || 'Failed to refresh weather data.');
        }
    }))
);

// GET /api/vintage/procurement-recommendations
// Get procurement recommendations for current inventory
router.get('/vintage/procurement-recommendations', requireRole('admin', 'crew', 'guest'), validate(), asyncHandler(withServices(async ({ vintageIntelligenceService }, req, res) => {
    try {
        const recommendations = await vintageIntelligenceService.getInventoryProcurementRecommendations();

        res.json({
            success: true,
            data: serializeVintageProcurementRecommendations(recommendations)
        });
    } catch (error) {
        sendError(res, 500, 'VINTAGE_PROCUREMENT_RECOMMENDATIONS_FAILED', error.message || 'Failed to retrieve procurement recommendations.');
    }
}))); 

// POST /api/vintage/batch-enrich
// Batch enrich multiple wines with vintage intelligence
router.post('/vintage/batch-enrich', requireRole('admin', 'crew'), validate(validators.vintageBatchEnrich), asyncHandler(withServices(async ({ db, vintageIntelligenceService }, req, res) => {
    const { filters = {}, limit = 50 } = req.body;

    try {
        // Build query with filters
        let query = `
            SELECT w.*, v.*
            FROM Wines w
            LEFT JOIN Vintages v ON w.id = v.wine_id
            WHERE 1=1
        `;

        const params = [];

        if (filters.region) {
            query += ' AND w.region LIKE ?';
            params.push(`%${filters.region}%`);
        }

        if (filters.wine_type) {
            query += ' AND w.wine_type = ?';
            params.push(filters.wine_type);
        }

        if (filters.year_from) {
            query += ' AND v.year >= ?';
            params.push(filters.year_from);
        }

        if (filters.year_to) {
            query += ' AND v.year <= ?';
            params.push(filters.year_to);
        }

        query += ' ORDER BY w.name LIMIT ?';
        params.push(limit);

        const wines = await db.all(query, params);

        if (wines.length === 0) {
            return res.json({
                success: true,
                data: [],
                message: 'No wines found matching criteria'
            });
        }

        // Process wines in batches
        const results = await vintageIntelligenceService.batchEnrichWines(wines);
        const sanitized = serializeVintageEnrichmentList(results);

        res.json({
            success: true,
            data: sanitized,
            message: `Processed ${sanitized.length} wines for vintage intelligence`
        });
    } catch (error) {
        sendError(res, 500, 'VINTAGE_BATCH_ENRICH_FAILED', error.message || 'Failed to batch enrich wines.');
    }
}))); 

// GET /api/vintage/pairing-insight
// Get weather-based pairing insights for a wine and dish context
router.post('/vintage/pairing-insight', requireRole('admin', 'crew'), validate(validators.vintagePairingInsight), asyncHandler(withServices(async ({ db, vintageIntelligenceService }, req, res) => {
    const { wine_id, dish_context } = req.body;

    if (!wine_id || !dish_context) {
        return sendError(res, 400, 'VINTAGE_PAIRING_INSIGHT_VALIDATION', 'wine_id and dish_context are required.');
    }

    try {
        // Get wine details
        const wine = await db.get(`
            SELECT w.*, v.*
            FROM Wines w
            LEFT JOIN Vintages v ON w.id = v.wine_id
            WHERE w.id = ?
        `, [wine_id]);

        if (!wine) {
            return sendError(res, 404, 'WINE_NOT_FOUND', 'Wine not found.');
        }

        // Get weather context
        const weatherAnalysis = await vintageIntelligenceService.getWeatherContextForPairing(wine);

        // Generate pairing insight
        const insight = vintageIntelligenceService.generateWeatherPairingInsight(weatherAnalysis, dish_context);

        res.json({
            success: true,
            data: {
                wine: {
                    name: wine.name,
                    producer: wine.producer,
                    year: wine.year
                },
                weatherAnalysis,
                pairingInsight: insight,
                dishContext: dish_context
            }
        });
    } catch (error) {
        sendError(res, 500, 'VINTAGE_PAIRING_INSIGHT_FAILED', error.message || 'Failed to generate pairing insight.');
    }
}))); 

// ============================================================================
// SYSTEM ENDPOINTS
// ============================================================================

// GET /api/system/health
// System health check
router.get('/system/health', requireRole('admin', 'crew', 'guest'), validate(), asyncHandler(async (req, res) => {
    try {
        const db = Database.getInstance();

        // Test database connection
        await db.get('SELECT 1');

        // Get basic stats
        const stats = await db.all(`
            SELECT
                (SELECT COUNT(*) FROM Wines) as total_wines,
                (SELECT COUNT(*) FROM Vintages) as total_vintages,
                (SELECT COALESCE(SUM(quantity), 0) FROM Stock) as total_bottles,
                (SELECT COUNT(*) FROM Suppliers WHERE active = 1) as active_suppliers
        `);

        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            data: stats[0]
        });
    } catch (error) {
        sendError(res, 500, 'SYSTEM_HEALTH_FAILED', error.message || 'Failed to retrieve system health.');
    }
}));

// ============================================================================
// SYNC ENDPOINTS
// ============================================================================

// GET /api/sync/changes
// Retrieve delta updates for syncable resources since a Unix timestamp
router.get('/sync/changes', requireRole('admin', 'crew', 'guest'), validate(validators.syncChanges), asyncHandler(withServices(async ({ db }, req, res) => {
    const sinceParam = req.query.since;
    const parsedSince = typeof sinceParam === 'number'
        ? sinceParam
        : Number.parseInt(sinceParam, 10);

    const since = Number.isFinite(parsedSince) && parsedSince > 0 ? parsedSince : 0;
    const payload = {};
    let latest = since;

    for (const { table, key } of SYNC_CHANGE_TABLES) {
        const rows = await db.all(
            `SELECT * FROM ${table} WHERE updated_at > ? ORDER BY updated_at ASC`,
            [since]
        );

        const sanitizedRows = serializeSyncRows(table, rows);
        payload[key] = sanitizedRows;

        for (const row of sanitizedRows) {
            const rowTimestamp = typeof row.updated_at === 'number'
                ? row.updated_at
                : Number.parseInt(row.updated_at, 10);

            if (Number.isFinite(rowTimestamp) && rowTimestamp > latest) {
                latest = rowTimestamp;
            }
        }
    }

    res.json({
        success: true,
        data: payload,
        meta: {
            since,
            latest,
            tables: SYNC_CHANGE_TABLES.map(({ key }) => key)
        }
    });
})));

// GET /api/system/activity
// Recent system activity derived from ledger and intake updates
router.get('/system/activity', requireRole('admin', 'crew', 'guest'), validate(validators.systemActivity), asyncHandler(withServices(async ({ db }, req, res) => {
    const { limit = 10 } = req.query;

    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 10;
    const maxItems = Math.min(Math.max(safeLimit, 1), 50);

    const ledgerActivity = await db.all(`
        SELECT l.id, l.transaction_type, l.quantity, l.location, l.notes, l.created_by, l.created_at,
               l.reference_id,
               w.name AS wine_name,
               w.producer,
               v.year
        FROM Ledger l
        JOIN Vintages v ON l.vintage_id = v.id
        JOIN Wines w ON v.wine_id = w.id
        ORDER BY datetime(l.created_at) DESC
        LIMIT ?
    `, [maxItems]);

    const activity = ledgerActivity.map((entry) => {
        const wineName = entry.wine_name || 'Unknown wine';
        const yearSuffix = entry.year ? ` (${entry.year})` : '';
        const titleBase = `${wineName}${yearSuffix}`;
        const numericQuantity = Number(entry.quantity);
        const quantity = Number.isFinite(numericQuantity) ? Math.abs(numericQuantity) : null;
        const quantityText = quantity !== null
            ? `${quantity} bottle${quantity === 1 ? '' : 's'}`
            : 'Inventory';

        let type = 'inventory_update';
        let actionVerb = 'updated';

        switch ((entry.transaction_type || '').toUpperCase()) {
        case 'OUT':
            type = 'consumption';
            actionVerb = 'served';
            break;
        case 'MOVE':
            type = 'inventory_update';
            actionVerb = 'moved';
            break;
        case 'RESERVE':
            type = 'reservation';
            actionVerb = 'reserved';
            break;
        case 'UNRESERVE':
            type = 'reservation';
            actionVerb = 'released';
            break;
        case 'IN':
        default:
            type = 'inventory_update';
            actionVerb = 'received';
            break;
        }

        const locationText = entry.location ? `Location: ${entry.location}` : null;
        const referenceText = entry.reference_id ? `Reference: ${entry.reference_id}` : null;
        const notesText = entry.notes ? `Notes: ${entry.notes}` : null;

        return {
            id: `ledger-${entry.id}`,
            type,
            title: `${quantityText} ${actionVerb} - ${titleBase}`.trim(),
            details: [
                entry.producer ? `Producer: ${entry.producer}` : null,
                locationText,
                referenceText,
                notesText,
                entry.created_by ? `Recorded by ${entry.created_by}` : null
            ].filter(Boolean).join(' • '),
            timestamp: entry.created_at
        };
    });

    res.json({
        success: true,
        data: activity
    });
})));

// GET /api/system/spec
// Serve the OpenAPI specification
router.get('/system/spec', requireRole('admin', 'crew', 'guest'), validate(), (req, res, next) => {
    const specPath = path.join(__dirname, 'openapi.yaml');

    res.type('application/yaml');
    res.sendFile(specPath, (error) => {
        if (error) {
            next(error);
        }
    });
});

// 404 handler for unmatched API routes
router.use((req, res) => {
    sendError(res, 404, 'NOT_FOUND', 'Endpoint not found.');
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('API Error:', error);

    if (res.headersSent) {
        return next(error);
    }

    const status = error.status || 500;
    const code = error.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');
    const message = error.message || 'Internal server error';

    sendError(res, status, code, message);
});

module.exports = router;
