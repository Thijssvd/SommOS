/**
 * A/B Testing Framework for AI Prompt Variations
 * Enables testing multiple prompt strategies and measuring quality metrics
 */

class ABTestingFramework {
    constructor() {
        this.experiments = new Map();
        this.assignments = new Map(); // userId/sessionId -> variant
        this.results = new Map(); // experimentId -> results
        this.activeExperiments = new Set();
    }

    /**
     * Define a new A/B test experiment
     */
    defineExperiment(config) {
        const {
            id,
            name,
            description,
            variants,
            trafficAllocation = 1.0, // Percentage of users in experiment
            enabled = true
        } = config;

        if (!id || !name || !variants || variants.length < 2) {
            throw new Error('Invalid experiment configuration');
        }

        // Validate traffic allocation for variants
        const totalAllocation = variants.reduce((sum, v) => sum + (v.allocation || 0), 0);
        if (Math.abs(totalAllocation - 1.0) > 0.01) {
            throw new Error('Variant allocations must sum to 1.0');
        }

        this.experiments.set(id, {
            id,
            name,
            description,
            variants,
            trafficAllocation,
            enabled,
            createdAt: Date.now(),
            startedAt: enabled ? Date.now() : null
        });

        if (enabled) {
            this.activeExperiments.add(id);
        }

        console.log(`[A/B Testing] Experiment "${name}" (${id}) defined with ${variants.length} variants`);
    }

    /**
     * Assign a user/session to a variant
     */
    assignVariant(experimentId, userId) {
        const experiment = this.experiments.get(experimentId);
        
        if (!experiment || !experiment.enabled) {
            return null;
        }

        // Check if already assigned
        const assignmentKey = `${experimentId}:${userId}`;
        if (this.assignments.has(assignmentKey)) {
            return this.assignments.get(assignmentKey);
        }

        // Check if user should be in experiment
        const inExperiment = Math.random() < experiment.trafficAllocation;
        if (!inExperiment) {
            return null; // Use control/default
        }

        // Assign to variant based on allocation
        const random = Math.random();
        let cumulative = 0;
        let assignedVariant = null;

        for (const variant of experiment.variants) {
            cumulative += variant.allocation;
            if (random < cumulative) {
                assignedVariant = variant;
                break;
            }
        }

        // Store assignment
        this.assignments.set(assignmentKey, assignedVariant);
        
        console.log(`[A/B Testing] User ${userId} assigned to variant "${assignedVariant.name}" in experiment "${experiment.name}"`);
        
        return assignedVariant;
    }

    /**
     * Get variant for a user (or assign if not already assigned)
     */
    getVariant(experimentId, userId) {
        const assignmentKey = `${experimentId}:${userId}`;
        
        if (this.assignments.has(assignmentKey)) {
            return this.assignments.get(assignmentKey);
        }
        
        return this.assignVariant(experimentId, userId);
    }

    /**
     * Record experiment result
     */
    recordResult(experimentId, userId, metrics) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            console.warn(`[A/B Testing] Unknown experiment: ${experimentId}`);
            return;
        }

        const assignmentKey = `${experimentId}:${userId}`;
        const variant = this.assignments.get(assignmentKey);
        
        if (!variant) {
            console.warn(`[A/B Testing] No variant assignment for user ${userId} in experiment ${experimentId}`);
            return;
        }

        // Initialize results for experiment if needed
        if (!this.results.has(experimentId)) {
            this.results.set(experimentId, {
                variants: new Map(),
                totalResults: 0
            });
        }

        const experimentResults = this.results.get(experimentId);
        
        // Initialize variant results if needed
        if (!experimentResults.variants.has(variant.name)) {
            experimentResults.variants.set(variant.name, {
                count: 0,
                metrics: {
                    confidenceScores: [],
                    responseTimes: [],
                    userSatisfaction: [],
                    coherenceScores: [],
                    customMetrics: []
                }
            });
        }

        const variantResults = experimentResults.variants.get(variant.name);
        variantResults.count++;
        experimentResults.totalResults++;

        // Record metrics
        if (metrics.confidence !== undefined) {
            variantResults.metrics.confidenceScores.push(metrics.confidence);
        }
        if (metrics.responseTime !== undefined) {
            variantResults.metrics.responseTimes.push(metrics.responseTime);
        }
        if (metrics.userSatisfaction !== undefined) {
            variantResults.metrics.userSatisfaction.push(metrics.userSatisfaction);
        }
        if (metrics.coherence !== undefined) {
            variantResults.metrics.coherenceScores.push(metrics.coherence);
        }
        if (metrics.custom) {
            variantResults.metrics.customMetrics.push(metrics.custom);
        }
    }

    /**
     * Calculate average for an array
     */
    calculateAverage(values) {
        if (!values || values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    /**
     * Calculate standard deviation
     */
    calculateStdDev(values) {
        if (!values || values.length === 0) return 0;
        const avg = this.calculateAverage(values);
        const squareDiffs = values.map(v => Math.pow(v - avg, 2));
        return Math.sqrt(this.calculateAverage(squareDiffs));
    }

    /**
     * Get experiment results summary
     */
    getExperimentResults(experimentId) {
        const experiment = this.experiments.get(experimentId);
        const results = this.results.get(experimentId);

        if (!experiment || !results) {
            return null;
        }

        const variantSummaries = [];

        for (const [variantName, variantData] of results.variants) {
            const metrics = variantData.metrics;
            
            variantSummaries.push({
                name: variantName,
                sampleSize: variantData.count,
                metrics: {
                    avgConfidence: this.calculateAverage(metrics.confidenceScores),
                    stdDevConfidence: this.calculateStdDev(metrics.confidenceScores),
                    avgResponseTime: this.calculateAverage(metrics.responseTimes),
                    stdDevResponseTime: this.calculateStdDev(metrics.responseTimes),
                    avgUserSatisfaction: this.calculateAverage(metrics.userSatisfaction),
                    avgCoherence: this.calculateAverage(metrics.coherenceScores)
                }
            });
        }

        // Calculate winner (highest confidence with sufficient sample size)
        let winner = null;
        let highestConfidence = 0;
        const minSampleSize = 30; // Minimum sample size for statistical significance

        for (const summary of variantSummaries) {
            if (summary.sampleSize >= minSampleSize && 
                summary.metrics.avgConfidence > highestConfidence) {
                highestConfidence = summary.metrics.avgConfidence;
                winner = summary.name;
            }
        }

        return {
            experimentId,
            experimentName: experiment.name,
            totalResults: results.totalResults,
            variants: variantSummaries,
            winner,
            winnerConfidence: highestConfidence,
            statisticallySignificant: variantSummaries.every(v => v.sampleSize >= minSampleSize)
        };
    }

    /**
     * Get all active experiments
     */
    getActiveExperiments() {
        return Array.from(this.activeExperiments).map(id => {
            const experiment = this.experiments.get(id);
            const results = this.results.get(id);
            
            return {
                id: experiment.id,
                name: experiment.name,
                description: experiment.description,
                variants: experiment.variants.map(v => v.name),
                totalResults: results ? results.totalResults : 0
            };
        });
    }

    /**
     * Stop an experiment
     */
    stopExperiment(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (experiment) {
            experiment.enabled = false;
            this.activeExperiments.delete(experimentId);
            console.log(`[A/B Testing] Experiment "${experiment.name}" stopped`);
        }
    }

    /**
     * Clear experiment data
     */
    clearExperiment(experimentId) {
        this.experiments.delete(experimentId);
        this.results.delete(experimentId);
        this.activeExperiments.delete(experimentId);
        
        // Clear assignments
        const keysToDelete = [];
        for (const [key, _] of this.assignments) {
            if (key.startsWith(`${experimentId}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.assignments.delete(key));
        
        console.log(`[A/B Testing] Experiment ${experimentId} cleared`);
    }

    /**
     * Export all experiment data
     */
    export() {
        const data = {
            experiments: Array.from(this.experiments.values()),
            results: {}
        };

        for (const [experimentId, results] of this.results) {
            data.results[experimentId] = this.getExperimentResults(experimentId);
        }

        return data;
    }
}

// Export singleton instance
module.exports = new ABTestingFramework();
