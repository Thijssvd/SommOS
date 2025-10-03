/**
 * Experiment Metrics Tracker
 * Tracks and aggregates metrics for A/B testing experiments
 */

const Database = require('../database/connection');

class ExperimentMetricsTracker {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.metricsBuffer = []; // Buffer for batch processing
        this.bufferSize = 100;
        this.flushInterval = 5000; // 5 seconds
        this.startAutoFlush();
    }

    /**
     * Track an event for an experiment
     */
    async trackEvent(experimentId, variantId, userId, eventType, options = {}) {
        const {
            eventValue = null,
            eventMetadata = {},
            sessionId = null,
            recommendationId = null,
            wineId = null
        } = options;

        const event = {
            experiment_id: experimentId,
            variant_id: variantId,
            user_id: userId,
            event_type: eventType,
            event_value: eventValue,
            event_metadata: JSON.stringify(eventMetadata),
            session_id: sessionId,
            recommendation_id: recommendationId,
            wine_id: wineId,
            event_timestamp: new Date().toISOString()
        };

        // Add to buffer for batch processing
        this.metricsBuffer.push(event);

        // Flush if buffer is full
        if (this.metricsBuffer.length >= this.bufferSize) {
            await this.flushMetrics();
        }

        return event;
    }

    /**
     * Track impression (user saw recommendation)
     */
    async trackImpression(experimentId, variantId, userId, options = {}) {
        return await this.trackEvent(experimentId, variantId, userId, 'impression', options);
    }

    /**
     * Track click (user clicked recommendation)
     */
    async trackClick(experimentId, variantId, userId, options = {}) {
        return await this.trackEvent(experimentId, variantId, userId, 'click', options);
    }

    /**
     * Track conversion (user completed desired action)
     */
    async trackConversion(experimentId, variantId, userId, options = {}) {
        return await this.trackEvent(experimentId, variantId, userId, 'conversion', options);
    }

    /**
     * Track rating (user rated a wine)
     */
    async trackRating(experimentId, variantId, userId, rating, options = {}) {
        return await this.trackEvent(experimentId, variantId, userId, 'rating', {
            ...options,
            eventValue: rating
        });
    }

    /**
     * Track custom event
     */
    async trackCustomEvent(experimentId, variantId, userId, eventName, options = {}) {
        return await this.trackEvent(experimentId, variantId, userId, eventName, options);
    }

    /**
     * Flush buffered metrics to database
     */
    async flushMetrics() {
        if (this.metricsBuffer.length === 0) {
            return;
        }

        const events = [...this.metricsBuffer];
        this.metricsBuffer = [];

        try {
            await this.db.run('BEGIN TRANSACTION');

            for (const event of events) {
                await this.db.run(`
                    INSERT INTO ExperimentEvents (
                        experiment_id, variant_id, user_id, event_type,
                        event_value, event_metadata, session_id,
                        recommendation_id, wine_id, event_timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    event.experiment_id,
                    event.variant_id,
                    event.user_id,
                    event.event_type,
                    event.event_value,
                    event.event_metadata,
                    event.session_id,
                    event.recommendation_id,
                    event.wine_id,
                    event.event_timestamp
                ]);
            }

            await this.db.run('COMMIT');
            console.log(`📊 Flushed ${events.length} events to database`);

        } catch (error) {
            await this.db.run('ROLLBACK');
            console.error('Failed to flush metrics:', error);
            // Re-add events to buffer for retry
            this.metricsBuffer.unshift(...events);
            throw error;
        }
    }

    /**
     * Start auto-flush timer
     */
    startAutoFlush() {
        this.flushTimer = setInterval(async () => {
            try {
                await this.flushMetrics();
            } catch (error) {
                console.error('Auto-flush failed:', error);
            }
        }, this.flushInterval);
    }

    /**
     * Stop auto-flush timer
     */
    stopAutoFlush() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }

    /**
     * Calculate and store aggregated metrics for a variant
     */
    async calculateVariantMetrics(experimentId, variantId, startDate = null, endDate = null) {
        const metrics = {};

        // Build date filter
        let dateFilter = '';
        const params = [experimentId, variantId];
        
        if (startDate) {
            dateFilter += ' AND event_timestamp >= ?';
            params.push(startDate);
        }
        if (endDate) {
            dateFilter += ' AND event_timestamp <= ?';
            params.push(endDate);
        }

        // Get event counts
        const events = await this.db.get(`
            SELECT
                COUNT(*) as total_events,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT CASE WHEN event_type = 'impression' THEN id END) as impressions,
                COUNT(DISTINCT CASE WHEN event_type = 'click' THEN id END) as clicks,
                COUNT(DISTINCT CASE WHEN event_type = 'conversion' THEN id END) as conversions,
                COUNT(DISTINCT CASE WHEN event_type = 'rating' THEN id END) as ratings_count,
                AVG(CASE WHEN event_type = 'rating' THEN event_value END) as avg_rating
            FROM ExperimentEvents
            WHERE experiment_id = ? AND variant_id = ?${dateFilter}
        `, params);

        metrics.total_events = events.total_events || 0;
        metrics.unique_users = events.unique_users || 0;
        metrics.impressions = events.impressions || 0;
        metrics.clicks = events.clicks || 0;
        metrics.conversions = events.conversions || 0;
        metrics.ratings_count = events.ratings_count || 0;
        metrics.avg_rating = events.avg_rating || 0;

        // Calculate derived metrics
        metrics.ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0;
        metrics.conversion_rate = metrics.impressions > 0 ? metrics.conversions / metrics.impressions : 0;
        metrics.click_to_conversion = metrics.clicks > 0 ? metrics.conversions / metrics.clicks : 0;

        // Store calculated metrics
        await this.storeMetrics(experimentId, variantId, metrics, startDate, endDate);

        return metrics;
    }

    /**
     * Store calculated metrics in database
     */
    async storeMetrics(experimentId, variantId, metrics, startDate, endDate) {
        const metricNames = [
            'total_events', 'unique_users', 'impressions', 'clicks', 
            'conversions', 'ratings_count', 'avg_rating',
            'ctr', 'conversion_rate', 'click_to_conversion'
        ];

        for (const metricName of metricNames) {
            if (metrics[metricName] !== undefined) {
                await this.db.run(`
                    INSERT INTO ExperimentMetrics (
                        experiment_id, variant_id, metric_name,
                        metric_value, metric_count, calculated_at,
                        start_date, end_date
                    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
                `, [
                    experimentId,
                    variantId,
                    metricName,
                    metrics[metricName],
                    metrics.unique_users,
                    startDate,
                    endDate
                ]);
            }
        }
    }

    /**
     * Get metrics for all variants in an experiment
     */
    async getExperimentMetrics(experimentId, startDate = null, endDate = null) {
        // Get all variants
        const variants = await this.db.all(`
            SELECT id, name, is_control FROM ExperimentVariants
            WHERE experiment_id = ?
        `, [experimentId]);

        const metricsPerVariant = {};

        for (const variant of variants) {
            metricsPerVariant[variant.name] = await this.calculateVariantMetrics(
                experimentId,
                variant.id,
                startDate,
                endDate
            );
            metricsPerVariant[variant.name].variant_id = variant.id;
            metricsPerVariant[variant.name].is_control = Boolean(variant.is_control);
        }

        return metricsPerVariant;
    }

    /**
     * Get time series data for a metric
     */
    async getMetricTimeSeries(experimentId, variantId, metricName, granularity = 'day') {
        let timeFormat;
        switch (granularity) {
            case 'hour':
                timeFormat = '%Y-%m-%d %H:00:00';
                break;
            case 'day':
                timeFormat = '%Y-%m-%d';
                break;
            case 'week':
                timeFormat = '%Y-W%W';
                break;
            default:
                timeFormat = '%Y-%m-%d';
        }

        const timeSeries = await this.db.all(`
            SELECT
                strftime(?, event_timestamp) as time_bucket,
                COUNT(*) as event_count,
                AVG(CASE WHEN event_type = ? THEN event_value END) as metric_value
            FROM ExperimentEvents
            WHERE experiment_id = ? AND variant_id = ?
            AND event_type IN ('impression', 'click', 'conversion', 'rating', ?)
            GROUP BY time_bucket
            ORDER BY time_bucket
        `, [timeFormat, metricName, experimentId, variantId, metricName]);

        return timeSeries;
    }

    /**
     * Get funnel analysis for an experiment
     */
    async getFunnelAnalysis(experimentId, variantId, steps = ['impression', 'click', 'conversion']) {
        const funnel = [];

        for (const step of steps) {
            const count = await this.db.get(`
                SELECT COUNT(DISTINCT user_id) as count
                FROM ExperimentEvents
                WHERE experiment_id = ? AND variant_id = ? AND event_type = ?
            `, [experimentId, variantId, step]);

            funnel.push({
                step,
                count: count.count || 0
            });
        }

        // Calculate drop-off rates
        for (let i = 1; i < funnel.length; i++) {
            const prev = funnel[i - 1].count;
            const curr = funnel[i].count;
            funnel[i].conversion_rate = prev > 0 ? curr / prev : 0;
            funnel[i].drop_off_rate = prev > 0 ? (prev - curr) / prev : 0;
        }

        return funnel;
    }

    /**
     * Get user journey for debugging
     */
    async getUserJourney(experimentId, userId) {
        const events = await this.db.all(`
            SELECT
                ee.*,
                v.name as variant_name
            FROM ExperimentEvents ee
            JOIN ExperimentVariants v ON ee.variant_id = v.id
            WHERE ee.experiment_id = ? AND ee.user_id = ?
            ORDER BY ee.event_timestamp
        `, [experimentId, userId]);

        return events.map(e => ({
            ...e,
            event_metadata: JSON.parse(e.event_metadata || '{}')
        }));
    }

    /**
     * Check guardrail metrics
     */
    async checkGuardrails(experimentId) {
        const guardrails = await this.db.all(`
            SELECT * FROM ExperimentGuardrails
            WHERE experiment_id = ?
        `, [experimentId]);

        const violations = [];

        for (const guardrail of guardrails) {
            // Calculate current value for this metric
            const metrics = await this.getExperimentMetrics(experimentId);
            
            for (const [variantName, variantMetrics] of Object.entries(metrics)) {
                const currentValue = variantMetrics[guardrail.metric_name];
                
                if (currentValue !== undefined) {
                    let isViolated = false;
                    
                    if (guardrail.threshold_type === 'min' && currentValue < guardrail.threshold_value) {
                        isViolated = true;
                    } else if (guardrail.threshold_type === 'max' && currentValue > guardrail.threshold_value) {
                        isViolated = true;
                    }
                    
                    if (isViolated) {
                        violations.push({
                            variant: variantName,
                            metric: guardrail.metric_name,
                            current_value: currentValue,
                            threshold: guardrail.threshold_value,
                            threshold_type: guardrail.threshold_type
                        });
                    }
                    
                    // Update guardrail status
                    await this.db.run(`
                        UPDATE ExperimentGuardrails
                        SET current_value = ?, is_violated = ?, checked_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [currentValue, isViolated ? 1 : 0, guardrail.id]);
                }
            }
        }

        return violations;
    }

    /**
     * Get variant comparison
     */
    async getVariantComparison(experimentId) {
        const metrics = await this.getExperimentMetrics(experimentId);
        
        // Find control variant
        let control = null;
        const variants = [];
        
        for (const [name, data] of Object.entries(metrics)) {
            if (data.is_control) {
                control = { name, ...data };
            } else {
                variants.push({ name, ...data });
            }
        }
        
        if (!control) {
            return { error: 'No control variant found' };
        }
        
        // Calculate relative differences
        const comparison = variants.map(variant => {
            const comparison = {
                variant_name: variant.name,
                metrics: {}
            };
            
            const metricKeys = ['ctr', 'conversion_rate', 'avg_rating', 'click_to_conversion'];
            
            for (const key of metricKeys) {
                const controlValue = control[key] || 0;
                const variantValue = variant[key] || 0;
                const difference = variantValue - controlValue;
                const percentChange = controlValue > 0 ? (difference / controlValue) * 100 : 0;
                
                comparison.metrics[key] = {
                    control: controlValue,
                    variant: variantValue,
                    difference,
                    percent_change: percentChange
                };
            }
            
            return comparison;
        });
        
        return {
            control: control.name,
            comparisons: comparison
        };
    }

    /**
     * Cleanup old events (data retention)
     */
    async cleanupOldEvents(daysToKeep = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const result = await this.db.run(`
            DELETE FROM ExperimentEvents
            WHERE event_timestamp < ?
        `, [cutoffDate.toISOString()]);
        
        console.log(`🗑️  Cleaned up ${result.changes} old events`);
        return result.changes;
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        this.stopAutoFlush();
        await this.flushMetrics();
        console.log('📊 Metrics tracker shutdown complete');
    }
}

module.exports = ExperimentMetricsTracker;
