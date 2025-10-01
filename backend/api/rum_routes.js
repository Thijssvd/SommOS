/**
 * Real User Monitoring (RUM) Routes
 * API endpoints for collecting and processing frontend performance data
 */

const express = require('express');
const router = express.Router();

// In-memory storage for RUM data (in production, use a proper database)
const rumData = {
    sessions: new Map(),
    metrics: new Map(),
    errors: new Map(),
    reports: []
};

// RUM data retention (24 hours)
const DATA_RETENTION = 24 * 60 * 60 * 1000;

/**
 * POST /api/performance/rum
 * Collect RUM metrics from frontend
 */
router.post('/rum', async (req, res) => {
    try {
        const {
            sessionId,
            userId,
            timestamp,
            url,
            userAgent,
            connection,
            metrics,
            isUnload
        } = req.body;

        // Validate required fields
        if (!sessionId || !userId || !timestamp) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: sessionId, userId, timestamp'
            });
        }

        // Store session data
        const sessionData = {
            sessionId,
            userId,
            timestamp,
            url,
            userAgent,
            connection,
            isUnload,
            receivedAt: Date.now()
        };

        rumData.sessions.set(sessionId, sessionData);

        // Process and store metrics
        if (metrics) {
            await processMetrics(sessionId, metrics);
        }

        // Clean up old data
        cleanupOldData();

        res.json({
            success: true,
            message: 'RUM data received successfully',
            sessionId
        });

    } catch (error) {
        console.error('RUM data processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process RUM data'
        });
    }
});

/**
 * Process and store metrics data
 */
async function processMetrics(sessionId, metrics) {
    const timestamp = Date.now();

    // Process Web Vitals
    if (metrics.webVitals && Array.isArray(metrics.webVitals)) {
        metrics.webVitals.forEach(vital => {
            const key = `${sessionId}_${vital.name}_${vital.timestamp}`;
            rumData.metrics.set(key, {
                ...vital,
                sessionId,
                processedAt: timestamp,
                type: 'webVital'
            });
        });
    }

    // Process custom metrics
    if (metrics.customMetrics && Array.isArray(metrics.customMetrics)) {
        metrics.customMetrics.forEach(metric => {
            const key = `${sessionId}_custom_${metric.name}_${metric.timestamp}`;
            rumData.metrics.set(key, {
                ...metric,
                sessionId,
                processedAt: timestamp,
                type: 'custom'
            });
        });
    }

    // Process user interactions
    if (metrics.userInteractions && Array.isArray(metrics.userInteractions)) {
        metrics.userInteractions.forEach(interaction => {
            const key = `${sessionId}_interaction_${interaction.timestamp}`;
            rumData.metrics.set(key, {
                ...interaction,
                sessionId,
                processedAt: timestamp,
                type: 'interaction'
            });
        });
    }

    // Process errors
    if (metrics.errors && Array.isArray(metrics.errors)) {
        metrics.errors.forEach(error => {
            const key = `${sessionId}_error_${error.timestamp}`;
            rumData.errors.set(key, {
                ...error,
                sessionId,
                processedAt: timestamp,
                type: 'error'
            });
        });
    }

    // Process resources
    if (metrics.resources && Array.isArray(metrics.resources)) {
        metrics.resources.forEach(resource => {
            const key = `${sessionId}_resource_${resource.timestamp}`;
            rumData.metrics.set(key, {
                ...resource,
                sessionId,
                processedAt: timestamp,
                type: 'resource'
            });
        });
    }

    // Process navigation timing
    if (metrics.navigation) {
        const key = `${sessionId}_navigation`;
        rumData.metrics.set(key, {
            ...metrics.navigation,
            sessionId,
            processedAt: timestamp,
            type: 'navigation'
        });
    }
}

/**
 * GET /api/performance/rum/sessions
 * Get RUM session data
 */
router.get('/rum/sessions', (req, res) => {
    try {
        const { startTime, endTime, userId } = req.query;
        const sessions = Array.from(rumData.sessions.values());

        let filteredSessions = sessions;

        // Filter by time range
        if (startTime || endTime) {
            filteredSessions = sessions.filter(session => {
                const sessionTime = session.timestamp;
                if (startTime && sessionTime < parseInt(startTime)) return false;
                if (endTime && sessionTime > parseInt(endTime)) return false;
                return true;
            });
        }

        // Filter by user
        if (userId) {
            filteredSessions = filteredSessions.filter(session => 
                session.userId === userId
            );
        }

        res.json({
            success: true,
            data: {
                sessions: filteredSessions,
                total: filteredSessions.length
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/rum/metrics
 * Get RUM metrics data
 */
router.get('/rum/metrics', (req, res) => {
    try {
        const { 
            sessionId, 
            type, 
            startTime, 
            endTime,
            metricName 
        } = req.query;

        const metrics = Array.from(rumData.metrics.values());

        let filteredMetrics = metrics;

        // Filter by session
        if (sessionId) {
            filteredMetrics = filteredMetrics.filter(metric => 
                metric.sessionId === sessionId
            );
        }

        // Filter by type
        if (type) {
            filteredMetrics = filteredMetrics.filter(metric => 
                metric.type === type
            );
        }

        // Filter by metric name
        if (metricName) {
            filteredMetrics = filteredMetrics.filter(metric => 
                metric.name === metricName
            );
        }

        // Filter by time range
        if (startTime || endTime) {
            filteredMetrics = filteredMetrics.filter(metric => {
                const metricTime = metric.timestamp;
                if (startTime && metricTime < parseInt(startTime)) return false;
                if (endTime && metricTime > parseInt(endTime)) return false;
                return true;
            });
        }

        res.json({
            success: true,
            data: {
                metrics: filteredMetrics,
                total: filteredMetrics.length
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/rum/errors
 * Get RUM error data
 */
router.get('/rum/errors', (req, res) => {
    try {
        const { 
            sessionId, 
            type, 
            startTime, 
            endTime 
        } = req.query;

        const errors = Array.from(rumData.errors.values());

        let filteredErrors = errors;

        // Filter by session
        if (sessionId) {
            filteredErrors = filteredErrors.filter(error => 
                error.sessionId === sessionId
            );
        }

        // Filter by type
        if (type) {
            filteredErrors = filteredErrors.filter(error => 
                error.type === type
            );
        }

        // Filter by time range
        if (startTime || endTime) {
            filteredErrors = filteredErrors.filter(error => {
                const errorTime = error.timestamp;
                if (startTime && errorTime < parseInt(startTime)) return false;
                if (endTime && errorTime > parseInt(endTime)) return false;
                return true;
            });
        }

        res.json({
            success: true,
            data: {
                errors: filteredErrors,
                total: filteredErrors.length
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/rum/summary
 * Get RUM performance summary
 */
router.get('/rum/summary', (req, res) => {
    try {
        const { startTime, endTime } = req.query;
        const now = Date.now();
        const defaultStartTime = startTime || (now - 24 * 60 * 60 * 1000); // Last 24 hours
        const defaultEndTime = endTime || now;

        // Get all metrics in time range
        const metrics = Array.from(rumData.metrics.values()).filter(metric => {
            const metricTime = metric.timestamp;
            return metricTime >= defaultStartTime && metricTime <= defaultEndTime;
        });

        // Get all errors in time range
        const errors = Array.from(rumData.errors.values()).filter(error => {
            const errorTime = error.timestamp;
            return errorTime >= defaultStartTime && errorTime <= defaultEndTime;
        });

        // Get all sessions in time range
        const sessions = Array.from(rumData.sessions.values()).filter(session => {
            const sessionTime = session.timestamp;
            return sessionTime >= defaultStartTime && sessionTime <= defaultEndTime;
        });

        // Calculate Web Vitals summary
        const webVitals = {};
        const webVitalMetrics = metrics.filter(m => m.type === 'webVital');
        
        ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].forEach(vital => {
            const vitalMetrics = webVitalMetrics.filter(m => m.name === vital);
            if (vitalMetrics.length > 0) {
                const values = vitalMetrics.map(m => m.value);
                webVitals[vital] = {
                    count: vitalMetrics.length,
                    average: values.reduce((a, b) => a + b, 0) / values.length,
                    min: Math.min(...values),
                    max: Math.max(...values),
                    p75: calculatePercentile(values, 75),
                    p95: calculatePercentile(values, 95),
                    p99: calculatePercentile(values, 99),
                    passing: vitalMetrics.filter(m => m.passed).length,
                    passingRate: vitalMetrics.filter(m => m.passed).length / vitalMetrics.length
                };
            }
        });

        // Calculate error summary
        const errorSummary = {
            total: errors.length,
            byType: {},
            bySession: {}
        };

        errors.forEach(error => {
            errorSummary.byType[error.type] = (errorSummary.byType[error.type] || 0) + 1;
            errorSummary.bySession[error.sessionId] = (errorSummary.bySession[error.sessionId] || 0) + 1;
        });

        // Calculate session summary
        const sessionSummary = {
            total: sessions.length,
            uniqueUsers: new Set(sessions.map(s => s.userId)).size,
            averageSessionDuration: calculateAverageSessionDuration(sessions),
            byUrl: {}
        };

        sessions.forEach(session => {
            sessionSummary.byUrl[session.url] = (sessionSummary.byUrl[session.url] || 0) + 1;
        });

        // Calculate resource summary
        const resourceMetrics = metrics.filter(m => m.type === 'resource');
        const resourceSummary = {
            total: resourceMetrics.length,
            averageSize: resourceMetrics.length > 0 ? 
                resourceMetrics.reduce((sum, r) => sum + (r.transferSize || 0), 0) / resourceMetrics.length : 0,
            averageLoadTime: resourceMetrics.length > 0 ?
                resourceMetrics.reduce((sum, r) => sum + (r.duration || 0), 0) / resourceMetrics.length : 0
        };

        const summary = {
            timeRange: {
                start: defaultStartTime,
                end: defaultEndTime,
                duration: defaultEndTime - defaultStartTime
            },
            webVitals,
            errors: errorSummary,
            sessions: sessionSummary,
            resources: resourceSummary,
            totalMetrics: metrics.length,
            generatedAt: now
        };

        res.json({
            success: true,
            data: summary
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/rum/analytics
 * Get detailed RUM analytics
 */
router.get('/rum/analytics', (req, res) => {
    try {
        const { 
            startTime, 
            endTime, 
            groupBy = 'hour',
            metric = 'LCP'
        } = req.query;

        const now = Date.now();
        const defaultStartTime = startTime || (now - 24 * 60 * 60 * 1000);
        const defaultEndTime = endTime || now;

        // Get metrics for the specified metric type
        const metrics = Array.from(rumData.metrics.values()).filter(m => 
            m.type === 'webVital' && 
            m.name === metric &&
            m.timestamp >= defaultStartTime && 
            m.timestamp <= defaultEndTime
        );

        // Group by time period
        const grouped = groupMetricsByTime(metrics, groupBy);

        // Calculate statistics for each group
        const analytics = Object.keys(grouped).map(timeKey => {
            const groupMetrics = grouped[timeKey];
            const values = groupMetrics.map(m => m.value);
            
            return {
                time: timeKey,
                count: groupMetrics.length,
                average: values.reduce((a, b) => a + b, 0) / values.length,
                min: Math.min(...values),
                max: Math.max(...values),
                p50: calculatePercentile(values, 50),
                p75: calculatePercentile(values, 75),
                p95: calculatePercentile(values, 95),
                p99: calculatePercentile(values, 99),
                passing: groupMetrics.filter(m => m.passed).length,
                passingRate: groupMetrics.filter(m => m.passed).length / groupMetrics.length
            };
        });

        res.json({
            success: true,
            data: {
                metric,
                timeRange: {
                    start: defaultStartTime,
                    end: defaultEndTime
                },
                groupBy,
                analytics: analytics.sort((a, b) => a.time - b.time)
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Helper function to calculate percentile
 */
function calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
}

/**
 * Helper function to group metrics by time period
 */
function groupMetricsByTime(metrics, groupBy) {
    const groups = {};
    
    metrics.forEach(metric => {
        let timeKey;
        const date = new Date(metric.timestamp);
        
        switch (groupBy) {
            case 'minute':
                timeKey = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                    date.getHours(), date.getMinutes()).getTime();
                break;
            case 'hour':
                timeKey = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                    date.getHours()).getTime();
                break;
            case 'day':
                timeKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
                break;
            default:
                timeKey = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                    date.getHours()).getTime();
        }
        
        if (!groups[timeKey]) {
            groups[timeKey] = [];
        }
        groups[timeKey].push(metric);
    });
    
    return groups;
}

/**
 * Helper function to calculate average session duration
 */
function calculateAverageSessionDuration(sessions) {
    if (sessions.length === 0) return 0;
    
    const durations = sessions
        .filter(s => s.isUnload) // Only completed sessions
        .map(s => s.receivedAt - s.timestamp);
    
    if (durations.length === 0) return 0;
    
    return durations.reduce((a, b) => a + b, 0) / durations.length;
}

/**
 * Clean up old data
 */
function cleanupOldData() {
    const cutoff = Date.now() - DATA_RETENTION;
    
    // Clean up old sessions
    for (const [key, session] of rumData.sessions) {
        if (session.timestamp < cutoff) {
            rumData.sessions.delete(key);
        }
    }
    
    // Clean up old metrics
    for (const [key, metric] of rumData.metrics) {
        if (metric.timestamp < cutoff) {
            rumData.metrics.delete(key);
        }
    }
    
    // Clean up old errors
    for (const [key, error] of rumData.errors) {
        if (error.timestamp < cutoff) {
            rumData.errors.delete(key);
        }
    }
}

module.exports = router;