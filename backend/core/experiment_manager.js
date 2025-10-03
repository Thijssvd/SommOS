/**
 * Experiment Manager
 * Manages A/B test lifecycle: creation, variant assignment, metrics tracking, and analysis
 */

const crypto = require('crypto');
const Database = require('../database/connection');

class ExperimentManager {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.assignmentCache = new Map(); // Cache user assignments
        this.cacheExpiry = 60 * 60 * 1000; // 1 hour
    }

    /**
     * Create a new experiment
     */
    async createExperiment(config) {
        const {
            name,
            description,
            hypothesis,
            startDate,
            endDate,
            targetMetric,
            trafficAllocation = 1.0,
            minimumSampleSize = 1000,
            significanceLevel = 0.05,
            variants,
            guardrails = [],
            tags = [],
            createdBy
        } = config;

        // Validate experiment config
        this.validateExperimentConfig(config);

        try {
            // Start transaction
            await this.db.run('BEGIN TRANSACTION');

            // Create experiment
            const experimentResult = await this.db.run(`
                INSERT INTO Experiments (
                    name, description, hypothesis, start_date, end_date,
                    status, target_metric, traffic_allocation,
                    minimum_sample_size, significance_level, tags, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                name,
                description,
                hypothesis,
                startDate,
                endDate,
                'draft',
                targetMetric,
                trafficAllocation,
                minimumSampleSize,
                significanceLevel,
                JSON.stringify(tags),
                createdBy
            ]);

            const experimentId = experimentResult.lastID;

            // Create variants
            for (const variant of variants) {
                await this.createVariant(experimentId, variant);
            }

            // Create guardrails if specified
            for (const guardrail of guardrails) {
                await this.createGuardrail(experimentId, guardrail);
            }

            // Commit transaction
            await this.db.run('COMMIT');

            console.log(`✅ Experiment created: ${name} (ID: ${experimentId})`);

            return await this.getExperiment(experimentId);

        } catch (error) {
            await this.db.run('ROLLBACK');
            console.error('Failed to create experiment:', error);
            throw error;
        }
    }

    /**
     * Create a variant for an experiment
     */
    async createVariant(experimentId, variantConfig) {
        const {
            name,
            description,
            allocationPercentage,
            isControl = false,
            config = {}
        } = variantConfig;

        const result = await this.db.run(`
            INSERT INTO ExperimentVariants (
                experiment_id, name, description,
                allocation_percentage, is_control, config
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            experimentId,
            name,
            description,
            allocationPercentage,
            isControl ? 1 : 0,
            JSON.stringify(config)
        ]);

        return result.lastID;
    }

    /**
     * Create a guardrail metric
     */
    async createGuardrail(experimentId, guardrail) {
        const { metricName, thresholdType, thresholdValue } = guardrail;

        await this.db.run(`
            INSERT INTO ExperimentGuardrails (
                experiment_id, metric_name, threshold_type, threshold_value
            ) VALUES (?, ?, ?, ?)
        `, [experimentId, metricName, thresholdType, thresholdValue]);
    }

    /**
     * Get experiment by ID with all details
     */
    async getExperiment(experimentId) {
        const experiment = await this.db.get(`
            SELECT * FROM Experiments WHERE id = ?
        `, [experimentId]);

        if (!experiment) {
            throw new Error(`Experiment ${experimentId} not found`);
        }

        // Parse JSON fields
        experiment.tags = JSON.parse(experiment.tags || '[]');

        // Get variants
        experiment.variants = await this.getExperimentVariants(experimentId);

        // Get guardrails
        experiment.guardrails = await this.getExperimentGuardrails(experimentId);

        // Get stats
        experiment.stats = await this.getExperimentStats(experimentId);

        return experiment;
    }

    /**
     * Get variants for an experiment
     */
    async getExperimentVariants(experimentId) {
        const variants = await this.db.all(`
            SELECT * FROM ExperimentVariants
            WHERE experiment_id = ?
            ORDER BY is_control DESC, name ASC
        `, [experimentId]);

        return variants.map(v => ({
            ...v,
            config: JSON.parse(v.config || '{}'),
            is_control: Boolean(v.is_control)
        }));
    }

    /**
     * Get guardrails for an experiment
     */
    async getExperimentGuardrails(experimentId) {
        return await this.db.all(`
            SELECT * FROM ExperimentGuardrails
            WHERE experiment_id = ?
        `, [experimentId]);
    }

    /**
     * Get experiment statistics
     */
    async getExperimentStats(experimentId) {
        const stats = await this.db.get(`
            SELECT
                COUNT(DISTINCT ua.user_id) as total_users,
                COUNT(DISTINCT ee.id) as total_events,
                COUNT(DISTINCT CASE WHEN ee.event_type = 'impression' THEN ee.id END) as impressions,
                COUNT(DISTINCT CASE WHEN ee.event_type = 'conversion' THEN ee.id END) as conversions
            FROM Experiments e
            LEFT JOIN UserVariantAssignments ua ON e.id = ua.experiment_id
            LEFT JOIN ExperimentEvents ee ON e.id = ee.experiment_id
            WHERE e.id = ?
        `, [experimentId]);

        return stats || {
            total_users: 0,
            total_events: 0,
            impressions: 0,
            conversions: 0
        };
    }

    /**
     * Start an experiment (change status to running)
     */
    async startExperiment(experimentId) {
        const experiment = await this.getExperiment(experimentId);

        if (experiment.status !== 'draft' && experiment.status !== 'paused') {
            throw new Error(`Cannot start experiment in ${experiment.status} status`);
        }

        // Validate variants
        const totalAllocation = experiment.variants.reduce((sum, v) => sum + v.allocation_percentage, 0);
        if (Math.abs(totalAllocation - 100) > 0.01) {
            throw new Error(`Variant allocations must sum to 100% (currently ${totalAllocation}%)`);
        }

        await this.db.run(`
            UPDATE Experiments
            SET status = 'running', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [experimentId]);

        console.log(`🚀 Experiment started: ${experiment.name} (ID: ${experimentId})`);

        return await this.getExperiment(experimentId);
    }

    /**
     * Pause an experiment
     */
    async pauseExperiment(experimentId) {
        await this.db.run(`
            UPDATE Experiments
            SET status = 'paused', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [experimentId]);

        console.log(`⏸️  Experiment paused: ${experimentId}`);
    }

    /**
     * Complete an experiment
     */
    async completeExperiment(experimentId, winner = null) {
        const updates = {
            status: 'completed',
            completed_at: new Date().toISOString()
        };

        if (winner) {
            updates.winner_variant = winner;
        }

        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), experimentId];

        await this.db.run(`
            UPDATE Experiments
            SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, values);

        console.log(`✅ Experiment completed: ${experimentId}${winner ? ` (Winner: ${winner})` : ''}`);
    }

    /**
     * Assign user to a variant (deterministic and sticky)
     */
    async assignUserToVariant(userId, experimentId) {
        // Check cache first
        const cacheKey = `${experimentId}:${userId}`;
        const cached = this.assignmentCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.variant;
        }

        // Check if user already assigned
        const existing = await this.db.get(`
            SELECT * FROM UserVariantAssignments
            WHERE experiment_id = ? AND user_id = ?
        `, [experimentId, userId]);

        if (existing) {
            const variant = await this.db.get(
                'SELECT * FROM ExperimentVariants WHERE id = ?',
                [existing.variant_id]
            );
            
            // Cache the assignment
            this.assignmentCache.set(cacheKey, {
                variant,
                timestamp: Date.now()
            });
            
            return variant;
        }

        // Get experiment and check if running
        const experiment = await this.db.get(
            'SELECT * FROM Experiments WHERE id = ? AND status = ?',
            [experimentId, 'running']
        );

        if (!experiment) {
            throw new Error(`Experiment ${experimentId} is not running`);
        }

        // Check traffic allocation
        if (Math.random() > experiment.traffic_allocation) {
            console.log(`User ${userId} excluded from experiment (traffic allocation)`);
            return null;
        }

        // Get variants
        const variants = await this.getExperimentVariants(experimentId);

        // Deterministic assignment based on hash
        const variant = this.selectVariantDeterministic(userId, experimentId, variants);

        // Record assignment
        const assignmentHash = this.generateAssignmentHash(userId, experimentId);
        
        await this.db.run(`
            INSERT INTO UserVariantAssignments (
                experiment_id, variant_id, user_id, assignment_hash
            ) VALUES (?, ?, ?, ?)
        `, [experimentId, variant.id, userId, assignmentHash]);

        // Cache the assignment
        this.assignmentCache.set(cacheKey, {
            variant,
            timestamp: Date.now()
        });

        console.log(`👤 User ${userId} assigned to variant ${variant.name} in experiment ${experimentId}`);

        return variant;
    }

    /**
     * Deterministic variant selection using consistent hashing
     */
    selectVariantDeterministic(userId, experimentId, variants) {
        // Generate hash from user ID and experiment ID
        const hash = crypto.createHash('md5')
            .update(`${userId}:${experimentId}`)
            .digest('hex');

        // Convert first 8 characters of hash to number [0, 1)
        const hashValue = parseInt(hash.substring(0, 8), 16) / 0xffffffff;

        // Select variant based on allocation percentages
        let cumulative = 0;
        for (const variant of variants) {
            cumulative += variant.allocation_percentage / 100;
            if (hashValue <= cumulative) {
                return variant;
            }
        }

        // Fallback to last variant (shouldn't happen if allocations sum to 100%)
        return variants[variants.length - 1];
    }

    /**
     * Generate deterministic assignment hash
     */
    generateAssignmentHash(userId, experimentId) {
        return crypto.createHash('sha256')
            .update(`${userId}:${experimentId}:${Date.now()}`)
            .digest('hex');
    }

    /**
     * Validate experiment configuration
     */
    validateExperimentConfig(config) {
        const required = ['name', 'startDate', 'targetMetric', 'variants'];
        
        for (const field of required) {
            if (!config[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!Array.isArray(config.variants) || config.variants.length < 2) {
            throw new Error('Experiment must have at least 2 variants');
        }

        // Check that exactly one variant is control
        const controlCount = config.variants.filter(v => v.isControl).length;
        if (controlCount !== 1) {
            throw new Error('Experiment must have exactly one control variant');
        }

        // Validate allocation percentages
        const totalAllocation = config.variants.reduce(
            (sum, v) => sum + (v.allocationPercentage || 0), 0
        );
        
        if (Math.abs(totalAllocation - 100) > 0.01) {
            throw new Error(`Variant allocations must sum to 100% (currently ${totalAllocation}%)`);
        }

        // Validate dates
        const start = new Date(config.startDate);
        if (config.endDate) {
            const end = new Date(config.endDate);
            if (end <= start) {
                throw new Error('End date must be after start date');
            }
        }

        return true;
    }

    /**
     * List all experiments with optional filters
     */
    async listExperiments(filters = {}) {
        const { status, limit = 50, offset = 0 } = filters;

        let query = 'SELECT * FROM Experiments WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const experiments = await this.db.all(query, params);

        // Parse JSON fields
        return experiments.map(exp => ({
            ...exp,
            tags: JSON.parse(exp.tags || '[]')
        }));
    }

    /**
     * Get active experiments for a user
     */
    async getActiveExperimentsForUser(userId) {
        const experiments = await this.db.all(`
            SELECT e.*, v.name as variant_name, v.config as variant_config
            FROM Experiments e
            INNER JOIN UserVariantAssignments ua ON e.id = ua.experiment_id
            INNER JOIN ExperimentVariants v ON ua.variant_id = v.id
            WHERE ua.user_id = ? AND e.status = 'running'
        `, [userId]);

        return experiments.map(exp => ({
            ...exp,
            tags: JSON.parse(exp.tags || '[]'),
            variant_config: JSON.parse(exp.variant_config || '{}')
        }));
    }
}

module.exports = ExperimentManager;
