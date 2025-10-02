'use strict';

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { listTools, callTool } = require('./agent_tools');
const Database = require('../database/connection');
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
const ExplainabilityService = require('../core/explainability_service');

let servicesPromise = null;

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
        console.warn('Learning engine initialization failed (agent):', error.message);
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
        explainabilityService,
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

// GET /api/agent/tools — list available tools
router.get('/tools', requireRole('admin', 'crew', 'guest'), validate(), asyncHandler(async (req, res) => {
    res.json({ success: true, data: listTools() });
}));

// POST /api/agent/tools/call — call a tool by name
router.post('/tools/call', requireRole('admin', 'crew', 'guest'), validate(), asyncHandler(async (req, res) => {
    const { name, params, options } = req.body || {};
    if (!name) {
        return res.status(400).json({ success: false, error: 'Tool name is required' });
    }
    const userRole = req.user?.role || 'guest';
    const services = await getServices();
    try {
        const result = await callTool(name, params || {}, services, userRole, options || {});
        res.json({ success: true, data: result });
    } catch (error) {
        const status = error.status || 500;
        const code = error.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');
        res.status(status).json({ success: false, error: { code, message: error.message } });
    }
}));

module.exports = router;


