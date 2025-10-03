/**
 * A/B Testing & Experiment API Routes
 * Provides endpoints for experiment management, variant assignment, metrics tracking, and statistical analysis
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/asyncHandler');
const ExperimentManager = require('../core/experiment_manager');
const ExperimentMetricsTracker = require('../core/experiment_metrics_tracker');
const ExperimentStatisticalAnalyzer = require('../core/experiment_statistical_analyzer');
const Database = require('../database/connection');
const { z } = require('zod');

// Validation Schemas
const experimentCreateSchema = {
    body: z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        hypothesis: z.string().optional(),
        variants: z.array(z.object({
            name: z.string().min(1).max(100),
            description: z.string().optional(),
            config: z.record(z.any()).optional(),
            is_control: z.boolean().optional(),
            allocation_percentage: z.number().min(0).max(100)
        })).min(2),
        target_metric: z.string().min(1),
        guardrail_metrics: z.array(z.string()).optional(),
        allocation_unit: z.enum(['user', 'session']).optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        metadata: z.record(z.any()).optional()
    })
};

const experimentUpdateSchema = {
    params: z.object({
        experimentId: z.string().min(1)
    }),
    body: z.object({
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        hypothesis: z.string().optional(),
        end_date: z.string().optional(),
        metadata: z.record(z.any()).optional()
    })
};

const variantAssignmentSchema = {
    params: z.object({
        experimentId: z.string().min(1)
    }),
    body: z.object({
        user_id: z.string().min(1),
        attributes: z.record(z.any()).optional()
    })
};

const eventTrackingSchema = {
    body: z.object({
        experiment_id: z.string().min(1),
        variant_id: z.string().min(1),
        user_id: z.string().min(1),
        event_type: z.enum(['impression', 'click', 'conversion', 'rating']),
        event_value: z.number().optional(),
        event_data: z.record(z.any()).optional(),
        timestamp: z.string().optional()
    })
};

const batchEventsSchema = {
    body: z.object({
        events: z.array(z.object({
            experiment_id: z.string().min(1),
            variant_id: z.string().min(1),
            user_id: z.string().min(1),
            event_type: z.enum(['impression', 'click', 'conversion', 'rating']),
            event_value: z.number().optional(),
            event_data: z.record(z.any()).optional(),
            timestamp: z.string().optional()
        })).min(1).max(100)
    })
};

const analysisRequestSchema = {
    params: z.object({
        experimentId: z.string().min(1)
    }),
    body: z.object({
        metric_name: z.string().min(1).optional(),
        analysis_type: z.enum(['frequentist', 'bayesian', 'both']).optional(),
        confidence_level: z.number().min(0).max(1).optional(),
        minimum_sample_size: z.number().int().positive().optional()
    })
};

// Initialize services (lazy-loaded singleton pattern)
let servicesInstance = null;

async function getServices() {
    if (!servicesInstance) {
        const db = Database.getInstance();
        servicesInstance = {
            db,
            experimentManager: new ExperimentManager(db),
            metricsTracker: new ExperimentMetricsTracker(db),
            statisticalAnalyzer: new ExperimentStatisticalAnalyzer(db)
        };
    }
    return servicesInstance;
}

// Inject services into request for asyncHandler
const withServices = (handler) => async (req, res, next) => {
    try {
        const services = await getServices();
        req.dependencies = services;
        return handler(services, req, res);
    } catch (error) {
        return next(error);
    }
};

// ==================== EXPERIMENT MANAGEMENT ====================

/**
 * POST /api/experiments
 * Create a new A/B test experiment
 */
router.post('/', 
    requireRole('admin'), 
    validate(experimentCreateSchema), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const experimentData = req.body;

        const experiment = await experimentManager.createExperiment(experimentData);

        res.status(201).json({
            success: true,
            data: {
                experiment_id: experiment.id,
                name: experiment.name,
                status: experiment.status,
                variants: experiment.variants,
                created_at: experiment.created_at
            },
            message: 'Experiment created successfully'
        });
    }))
);

/**
 * GET /api/experiments
 * List all experiments with optional filtering
 */
router.get('/', 
    requireRole('admin', 'crew'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const { status, limit = 50, offset = 0 } = req.query;

        const experiments = await experimentManager.listExperiments({ 
            status, 
            limit: parseInt(limit), 
            offset: parseInt(offset) 
        });

        res.json({
            success: true,
            data: experiments,
            meta: {
                count: experiments.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    }))
);

/**
 * GET /api/experiments/:experimentId
 * Get experiment details by ID
 */
router.get('/:experimentId', 
    requireRole('admin', 'crew'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const { experimentId } = req.params;

        const experiment = await experimentManager.getExperiment(experimentId);

        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'EXPERIMENT_NOT_FOUND',
                    message: `Experiment ${experimentId} not found`
                }
            });
        }

        res.json({
            success: true,
            data: experiment
        });
    }))
);

/**
 * PATCH /api/experiments/:experimentId
 * Update experiment details
 */
router.patch('/:experimentId', 
    requireRole('admin'), 
    validate(experimentUpdateSchema), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const { experimentId } = req.params;
        const updates = req.body;

        const updated = await experimentManager.updateExperiment(experimentId, updates);

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'EXPERIMENT_NOT_FOUND',
                    message: `Experiment ${experimentId} not found`
                }
            });
        }

        res.json({
            success: true,
            data: updated,
            message: 'Experiment updated successfully'
        });
    }))
);

/**
 * POST /api/experiments/:experimentId/start
 * Start a draft experiment
 */
router.post('/:experimentId/start', 
    requireRole('admin'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const { experimentId } = req.params;

        const result = await experimentManager.startExperiment(experimentId);

        res.json({
            success: true,
            data: result,
            message: 'Experiment started successfully'
        });
    }))
);

/**
 * POST /api/experiments/:experimentId/pause
 * Pause a running experiment
 */
router.post('/:experimentId/pause', 
    requireRole('admin'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const { experimentId } = req.params;

        const result = await experimentManager.pauseExperiment(experimentId);

        res.json({
            success: true,
            data: result,
            message: 'Experiment paused successfully'
        });
    }))
);

/**
 * POST /api/experiments/:experimentId/resume
 * Resume a paused experiment
 */
router.post('/:experimentId/resume', 
    requireRole('admin'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const { experimentId } = req.params;

        const result = await experimentManager.resumeExperiment(experimentId);

        res.json({
            success: true,
            data: result,
            message: 'Experiment resumed successfully'
        });
    }))
);

/**
 * POST /api/experiments/:experimentId/complete
 * Complete/stop an experiment
 */
router.post('/:experimentId/complete', 
    requireRole('admin'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const { experimentId } = req.params;
        const { winner_variant_id, conclusion } = req.body;

        const result = await experimentManager.completeExperiment(
            experimentId, 
            winner_variant_id, 
            conclusion
        );

        res.json({
            success: true,
            data: result,
            message: 'Experiment completed successfully'
        });
    }))
);

/**
 * DELETE /api/experiments/:experimentId
 * Archive/delete an experiment
 */
router.delete('/:experimentId', 
    requireRole('admin'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const { experimentId } = req.params;

        await experimentManager.archiveExperiment(experimentId);

        res.json({
            success: true,
            message: 'Experiment archived successfully'
        });
    }))
);

// ==================== VARIANT ASSIGNMENT ====================

/**
 * POST /api/experiments/:experimentId/assign
 * Assign a user to a variant (sticky assignment)
 */
router.post('/:experimentId/assign', 
    requireRole('admin', 'crew', 'guest'), 
    validate(variantAssignmentSchema), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const { experimentId } = req.params;
        const { user_id, attributes } = req.body;

        const assignment = await experimentManager.assignUserToVariant(
            user_id, 
            experimentId, 
            attributes
        );

        res.json({
            success: true,
            data: {
                experiment_id: experimentId,
                user_id,
                variant: assignment,
                assigned_at: new Date().toISOString()
            }
        });
    }))
);

/**
 * GET /api/experiments/:experimentId/assignments/:userId
 * Get user's current variant assignment
 */
router.get('/:experimentId/assignments/:userId', 
    requireRole('admin', 'crew', 'guest'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { experimentManager } = services;
        const { experimentId, userId } = req.params;

        const assignment = await experimentManager.getUserAssignment(userId, experimentId);

        if (!assignment) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ASSIGNMENT_NOT_FOUND',
                    message: `No assignment found for user ${userId} in experiment ${experimentId}`
                }
            });
        }

        res.json({
            success: true,
            data: assignment
        });
    }))
);

/**
 * GET /api/experiments/:experimentId/assignments
 * Get all assignments for an experiment (admin only)
 */
router.get('/:experimentId/assignments', 
    requireRole('admin'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { db } = services;
        const { experimentId } = req.params;
        const { limit = 100, offset = 0 } = req.query;

        const assignments = await db.all(`
            SELECT 
                ea.user_id,
                ea.variant_id,
                v.name as variant_name,
                ea.assigned_at,
                ea.assignment_context
            FROM ExperimentAssignments ea
            JOIN ExperimentVariants v ON ea.variant_id = v.id
            WHERE ea.experiment_id = ?
            ORDER BY ea.assigned_at DESC
            LIMIT ? OFFSET ?
        `, [experimentId, parseInt(limit), parseInt(offset)]);

        res.json({
            success: true,
            data: assignments,
            meta: {
                count: assignments.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    }))
);

// ==================== EVENT TRACKING ====================

/**
 * POST /api/experiments/events
 * Track a single experiment event
 */
router.post('/events', 
    requireRole('admin', 'crew', 'guest'), 
    validate(eventTrackingSchema), 
    withServices(asyncHandler(async (services, req, res) => {
        const { metricsTracker } = services;
        const eventData = req.body;

        await metricsTracker.trackEvent(eventData);

        res.status(202).json({
            success: true,
            message: 'Event tracked successfully'
        });
    }))
);

/**
 * POST /api/experiments/events/batch
 * Track multiple experiment events in a batch
 */
router.post('/events/batch', 
    requireRole('admin', 'crew', 'guest'), 
    validate(batchEventsSchema), 
    withServices(asyncHandler(async (services, req, res) => {
        const { metricsTracker } = services;
        const { events } = req.body;

        await metricsTracker.trackBatchEvents(events);

        res.status(202).json({
            success: true,
            message: `${events.length} events tracked successfully`,
            meta: {
                events_count: events.length
            }
        });
    }))
);

/**
 * POST /api/experiments/:experimentId/events/impression
 * Convenience endpoint: Track impression
 */
router.post('/:experimentId/events/impression', 
    requireRole('admin', 'crew', 'guest'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { metricsTracker } = services;
        const { experimentId } = req.params;
        const { user_id, variant_id } = req.body;

        await metricsTracker.trackImpression(experimentId, variant_id, user_id);

        res.status(202).json({
            success: true,
            message: 'Impression tracked successfully'
        });
    }))
);

/**
 * POST /api/experiments/:experimentId/events/conversion
 * Convenience endpoint: Track conversion
 */
router.post('/:experimentId/events/conversion', 
    requireRole('admin', 'crew', 'guest'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { metricsTracker } = services;
        const { experimentId } = req.params;
        const { user_id, variant_id, value } = req.body;

        await metricsTracker.trackConversion(experimentId, variant_id, user_id, value);

        res.status(202).json({
            success: true,
            message: 'Conversion tracked successfully'
        });
    }))
);

// ==================== METRICS & ANALYSIS ====================

/**
 * GET /api/experiments/:experimentId/metrics
 * Get aggregated metrics for an experiment
 */
router.get('/:experimentId/metrics', 
    requireRole('admin', 'crew'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { metricsTracker } = services;
        const { experimentId } = req.params;

        const metrics = await metricsTracker.getExperimentMetrics(experimentId);

        res.json({
            success: true,
            data: metrics
        });
    }))
);

/**
 * GET /api/experiments/:experimentId/metrics/:variantId
 * Get metrics for a specific variant
 */
router.get('/:experimentId/metrics/:variantId', 
    requireRole('admin', 'crew'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { metricsTracker } = services;
        const { experimentId, variantId } = req.params;

        const metrics = await metricsTracker.getVariantMetrics(experimentId, variantId);

        if (!metrics) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'METRICS_NOT_FOUND',
                    message: `No metrics found for variant ${variantId}`
                }
            });
        }

        res.json({
            success: true,
            data: metrics
        });
    }))
);

/**
 * GET /api/experiments/:experimentId/funnel
 * Get funnel analysis for an experiment
 */
router.get('/:experimentId/funnel', 
    requireRole('admin', 'crew'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { metricsTracker } = services;
        const { experimentId } = req.params;

        const funnel = await metricsTracker.getFunnelAnalysis(experimentId);

        res.json({
            success: true,
            data: funnel
        });
    }))
);

/**
 * POST /api/experiments/:experimentId/analyze
 * Run statistical analysis on experiment results
 */
router.post('/:experimentId/analyze', 
    requireRole('admin', 'crew'), 
    validate(analysisRequestSchema), 
    withServices(asyncHandler(async (services, req, res) => {
        const { statisticalAnalyzer } = services;
        const { experimentId } = req.params;
        const { 
            metric_name, 
            analysis_type = 'both', 
            confidence_level = 0.95,
            minimum_sample_size = 100
        } = req.body;

        const analysis = await statisticalAnalyzer.analyzeExperiment(experimentId, {
            metricName: metric_name,
            analysisType: analysis_type,
            confidenceLevel: confidence_level,
            minimumSampleSize: minimum_sample_size
        });

        res.json({
            success: true,
            data: analysis,
            meta: {
                analyzed_at: new Date().toISOString()
            }
        });
    }))
);

/**
 * GET /api/experiments/:experimentId/analysis
 * Get stored analysis results for an experiment
 */
router.get('/:experimentId/analysis', 
    requireRole('admin', 'crew'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { db } = services;
        const { experimentId } = req.params;
        const { latest = true } = req.query;

        let query = `
            SELECT 
                id,
                experiment_id,
                analysis_type,
                metric_name,
                control_variant_id,
                test_variant_id,
                control_mean,
                test_mean,
                p_value,
                confidence_level,
                is_significant,
                effect_size,
                relative_lift,
                bayesian_probability,
                recommendation,
                sample_sizes,
                analyzed_at
            FROM ExperimentAnalysis
            WHERE experiment_id = ?
        `;

        if (latest === 'true' || latest === true) {
            query += ' ORDER BY analyzed_at DESC LIMIT 1';
        } else {
            query += ' ORDER BY analyzed_at DESC';
        }

        const results = latest ? 
            await db.get(query, [experimentId]) : 
            await db.all(query, [experimentId]);

        if (!results || (Array.isArray(results) && results.length === 0)) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ANALYSIS_NOT_FOUND',
                    message: `No analysis found for experiment ${experimentId}`
                }
            });
        }

        res.json({
            success: true,
            data: results
        });
    }))
);

/**
 * GET /api/experiments/:experimentId/guardrails
 * Check guardrail metrics for an experiment
 */
router.get('/:experimentId/guardrails', 
    requireRole('admin', 'crew'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { metricsTracker } = services;
        const { experimentId } = req.params;

        const guardrails = await metricsTracker.checkGuardrails(experimentId);

        const hasViolations = guardrails.some(g => g.is_violated);

        res.json({
            success: true,
            data: {
                experiment_id: experimentId,
                guardrails,
                has_violations: hasViolations,
                checked_at: new Date().toISOString()
            }
        });
    }))
);

/**
 * GET /api/experiments/:experimentId/recommendation
 * Get automated recommendation for experiment decision
 */
router.get('/:experimentId/recommendation', 
    requireRole('admin', 'crew'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { statisticalAnalyzer } = services;
        const { experimentId } = req.params;

        const recommendation = await statisticalAnalyzer.getRecommendation(experimentId);

        res.json({
            success: true,
            data: recommendation
        });
    }))
);

// ==================== DASHBOARD & REPORTING ====================

/**
 * GET /api/experiments/dashboard/summary
 * Get dashboard summary of all experiments
 */
router.get('/dashboard/summary', 
    requireRole('admin', 'crew'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { db } = services;

        const summary = await db.get(`
            SELECT 
                COUNT(*) as total_experiments,
                SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_experiments,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_experiments,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_experiments,
                SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused_experiments
            FROM Experiments
            WHERE status != 'archived'
        `);

        res.json({
            success: true,
            data: summary
        });
    }))
);

/**
 * GET /api/experiments/:experimentId/realtime
 * Get real-time experiment stats (for dashboards)
 */
router.get('/:experimentId/realtime', 
    requireRole('admin', 'crew'), 
    withServices(asyncHandler(async (services, req, res) => {
        const { db, metricsTracker } = services;
        const { experimentId } = req.params;

        // Get experiment details
        const experiment = await db.get(
            'SELECT * FROM Experiments WHERE id = ?', 
            [experimentId]
        );

        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'EXPERIMENT_NOT_FOUND',
                    message: `Experiment ${experimentId} not found`
                }
            });
        }

        // Get variant stats
        const variants = await db.all(`
            SELECT 
                v.id,
                v.name,
                v.is_control,
                v.allocation_percentage,
                COUNT(DISTINCT ea.user_id) as users_assigned,
                COUNT(DISTINCT CASE WHEN e.event_type = 'impression' THEN e.user_id END) as impressions,
                COUNT(DISTINCT CASE WHEN e.event_type = 'click' THEN e.user_id END) as clicks,
                COUNT(DISTINCT CASE WHEN e.event_type = 'conversion' THEN e.user_id END) as conversions,
                AVG(CASE WHEN e.event_type = 'rating' THEN e.event_value END) as avg_rating
            FROM ExperimentVariants v
            LEFT JOIN ExperimentAssignments ea ON v.id = ea.variant_id
            LEFT JOIN ExperimentEvents e ON v.id = e.variant_id AND ea.user_id = e.user_id
            WHERE v.experiment_id = ?
            GROUP BY v.id
        `, [experimentId]);

        // Calculate rates
        const variantsWithRates = variants.map(v => ({
            ...v,
            click_rate: v.impressions > 0 ? (v.clicks / v.impressions) : 0,
            conversion_rate: v.impressions > 0 ? (v.conversions / v.impressions) : 0
        }));

        // Get latest metrics
        const metrics = await metricsTracker.getExperimentMetrics(experimentId);

        res.json({
            success: true,
            data: {
                experiment,
                variants: variantsWithRates,
                metrics,
                timestamp: new Date().toISOString()
            }
        });
    }))
);

module.exports = router;
