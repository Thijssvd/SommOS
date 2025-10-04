/**
 * Real User Monitoring (RUM) Routes
 * API endpoints for collecting and processing frontend performance data
 */

const express = require('express');
const router = express.Router();
const Database = require('../database/connection');

// In-memory storage for RUM data (fast access cache)
const rumData = {
    sessions: new Map(),
    metrics: new Map(),
    errors: new Map(),
    reports: []
};

// RUM data retention policies
const MEMORY_RETENTION = 24 * 60 * 60 * 1000; // 24 hours in memory
const DATA_RETENTION = 90 * 24 * 60 * 60 * 1000; // 90 days in database
const BATCH_SIZE = 100; // Maximum metrics per batch insert

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

        // Persist session to database (non-blocking)
        persistSessionToDatabase(sessionData).catch(err => {
            console.error('Failed to persist RUM session to database:', err);
        });

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
    const metricsToStore = [];
    const errorsToStore = [];

    // Process Web Vitals
    if (metrics.webVitals && Array.isArray(metrics.webVitals)) {
        metrics.webVitals.forEach(vital => {
            const key = `${sessionId}_${vital.name}_${vital.timestamp}`;
            const metricData = {
                ...vital,
                sessionId,
                processedAt: timestamp,
                type: 'webVital'
            };
            rumData.metrics.set(key, metricData);
            metricsToStore.push(metricData);
        });
    }

    // Process custom metrics
    if (metrics.customMetrics && Array.isArray(metrics.customMetrics)) {
        metrics.customMetrics.forEach(metric => {
            const key = `${sessionId}_custom_${metric.name}_${metric.timestamp}`;
            const metricData = {
                ...metric,
                sessionId,
                processedAt: timestamp,
                type: 'custom'
            };
            rumData.metrics.set(key, metricData);
            metricsToStore.push(metricData);
        });
    }

    // Process user interactions
    if (metrics.userInteractions && Array.isArray(metrics.userInteractions)) {
        metrics.userInteractions.forEach(interaction => {
            const key = `${sessionId}_interaction_${interaction.timestamp}`;
            const metricData = {
                ...interaction,
                sessionId,
                processedAt: timestamp,
                type: 'interaction'
            };
            rumData.metrics.set(key, metricData);
            metricsToStore.push(metricData);
        });
    }

    // Process errors
    if (metrics.errors && Array.isArray(metrics.errors)) {
        metrics.errors.forEach(error => {
            const key = `${sessionId}_error_${error.timestamp}`;
            const errorData = {
                ...error,
                sessionId,
                processedAt: timestamp,
                type: 'error'
            };
            rumData.errors.set(key, errorData);
            errorsToStore.push(errorData);
        });
    }

    // Process resources
    if (metrics.resources && Array.isArray(metrics.resources)) {
        metrics.resources.forEach(resource => {
            const key = `${sessionId}_resource_${resource.timestamp}`;
            const metricData = {
                ...resource,
                sessionId,
                processedAt: timestamp,
                type: 'resource'
            };
            rumData.metrics.set(key, metricData);
            metricsToStore.push(metricData);
        });
    }

    // Process navigation timing
    if (metrics.navigation) {
        const key = `${sessionId}_navigation`;
        const metricData = {
            ...metrics.navigation,
            sessionId,
            processedAt: timestamp,
            type: 'navigation'
        };
        rumData.metrics.set(key, metricData);
        metricsToStore.push(metricData);
    }

    // Persist to database (non-blocking)
    if (metricsToStore.length > 0) {
        persistMetricsToDatabase(metricsToStore).catch(err => {
            console.error('Failed to persist RUM metrics to database:', err);
        });
    }

    if (errorsToStore.length > 0) {
        persistErrorsToDatabase(errorsToStore).catch(err => {
            console.error('Failed to persist RUM errors to database:', err);
        });
    }
}

/**
 * GET /api/performance/rum/sessions
 * Get RUM session data with hybrid read strategy
 */
router.get('/rum/sessions', async (req, res) => {
    try {
        const { startTime, endTime, userId } = req.query;
        
        // Get from memory first
        let sessions = Array.from(rumData.sessions.values());
        
        // If querying historical data, also fetch from database
        const memoryCutoff = Date.now() - MEMORY_RETENTION;
        const needsDatabase = !startTime || parseInt(startTime) < memoryCutoff;
        
        if (needsDatabase) {
            const dbSessions = await getSessionsFromDatabase({ startTime, endTime, userId });
            
            // Merge with memory data, avoiding duplicates
            const sessionIds = new Set(sessions.map(s => s.sessionId));
            dbSessions.forEach(dbSession => {
                if (!sessionIds.has(dbSession.sessionId)) {
                    sessions.push(dbSession);
                }
            });
        }

        // Filter by time range
        let filteredSessions = sessions;
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
 * Get RUM metrics data with hybrid read strategy
 */
router.get('/rum/metrics', async (req, res) => {
    try {
        const { 
            sessionId, 
            type, 
            startTime, 
            endTime,
            metricName 
        } = req.query;

        // Get from memory first
        let metrics = Array.from(rumData.metrics.values());
        
        // If querying historical data, also fetch from database
        const memoryCutoff = Date.now() - MEMORY_RETENTION;
        const needsDatabase = !startTime || parseInt(startTime) < memoryCutoff;
        
        if (needsDatabase) {
            const dbMetrics = await getMetricsFromDatabase({ 
                sessionId, 
                type, 
                startTime, 
                endTime, 
                metricName 
            });
            
            // Add database metrics (memory takes precedence for recent data)
            metrics = [...metrics, ...dbMetrics];
        }

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
 * Get RUM error data with hybrid read strategy
 */
router.get('/rum/errors', async (req, res) => {
    try {
        const { 
            sessionId, 
            type, 
            startTime, 
            endTime 
        } = req.query;

        // Get from memory first
        let errors = Array.from(rumData.errors.values());
        
        // If querying historical data, also fetch from database
        const memoryCutoff = Date.now() - MEMORY_RETENTION;
        const needsDatabase = !startTime || parseInt(startTime) < memoryCutoff;
        
        if (needsDatabase) {
            const dbErrors = await getErrorsFromDatabase({ 
                sessionId, 
                type, 
                startTime, 
                endTime 
            });
            
            // Add database errors (memory takes precedence for recent data)
            errors = [...errors, ...dbErrors];
        }

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
 * Get sessions from database
 */
async function getSessionsFromDatabase({ startTime, endTime, userId }) {
    try {
        const db = Database.getInstance();
        await db.ensureInitialized();
        
        let query = 'SELECT * FROM RumSessions WHERE 1=1';
        const params = [];
        
        if (startTime) {
            query += ' AND timestamp >= ?';
            params.push(parseInt(startTime));
        }
        
        if (endTime) {
            query += ' AND timestamp <= ?';
            params.push(parseInt(endTime));
        }
        
        if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
        }
        
        const rows = await db.all(query, params);
        
        // Transform database rows to match memory format
        return rows.map(row => ({
            sessionId: row.session_id,
            userId: row.user_id,
            timestamp: row.timestamp,
            url: row.url,
            userAgent: row.user_agent,
            connection: row.connection ? JSON.parse(row.connection) : null,
            isUnload: row.is_unload === 1,
            receivedAt: row.received_at
        }));
    } catch (error) {
        console.error('Database error in getSessionsFromDatabase:', error);
        return [];
    }
}

/**
 * Get metrics from database
 */
async function getMetricsFromDatabase({ sessionId, type, startTime, endTime, metricName }) {
    try {
        const db = Database.getInstance();
        await db.ensureInitialized();
        
        let query = 'SELECT * FROM RumMetrics WHERE 1=1';
        const params = [];
        
        if (sessionId) {
            query += ' AND session_id = ?';
            params.push(sessionId);
        }
        
        if (type) {
            query += ' AND metric_type = ?';
            params.push(type);
        }
        
        if (metricName) {
            query += ' AND metric_name = ?';
            params.push(metricName);
        }
        
        if (startTime) {
            query += ' AND timestamp >= ?';
            params.push(parseInt(startTime));
        }
        
        if (endTime) {
            query += ' AND timestamp <= ?';
            params.push(parseInt(endTime));
        }
        
        const rows = await db.all(query, params);
        
        // Transform database rows to match memory format
        return rows.map(row => {
            const metricData = row.metric_data ? JSON.parse(row.metric_data) : {};
            return {
                ...metricData,
                sessionId: row.session_id,
                type: row.metric_type,
                name: row.metric_name,
                value: row.metric_value,
                timestamp: row.timestamp,
                processedAt: row.processed_at
            };
        });
    } catch (error) {
        console.error('Database error in getMetricsFromDatabase:', error);
        return [];
    }
}

/**
 * Get errors from database
 */
async function getErrorsFromDatabase({ sessionId, type, startTime, endTime }) {
    try {
        const db = Database.getInstance();
        await db.ensureInitialized();
        
        let query = 'SELECT * FROM RumErrors WHERE 1=1';
        const params = [];
        
        if (sessionId) {
            query += ' AND session_id = ?';
            params.push(sessionId);
        }
        
        if (type) {
            query += ' AND error_type = ?';
            params.push(type);
        }
        
        if (startTime) {
            query += ' AND timestamp >= ?';
            params.push(parseInt(startTime));
        }
        
        if (endTime) {
            query += ' AND timestamp <= ?';
            params.push(parseInt(endTime));
        }
        
        const rows = await db.all(query, params);
        
        // Transform database rows to match memory format
        return rows.map(row => {
            const errorData = row.error_data ? JSON.parse(row.error_data) : {};
            return {
                ...errorData,
                sessionId: row.session_id,
                type: row.error_type,
                message: row.error_message,
                stack: row.error_stack,
                timestamp: row.timestamp,
                processedAt: row.processed_at
            };
        });
    } catch (error) {
        console.error('Database error in getErrorsFromDatabase:', error);
        return [];
    }
}

/**
 * Persist session to database
 */
async function persistSessionToDatabase(sessionData) {
    try {
        const db = Database.getInstance();
        await db.ensureInitialized();

        await db.run(
            `INSERT OR REPLACE INTO RumSessions 
             (session_id, user_id, timestamp, url, user_agent, connection, is_unload, received_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                sessionData.sessionId,
                sessionData.userId,
                sessionData.timestamp,
                sessionData.url,
                sessionData.userAgent,
                JSON.stringify(sessionData.connection),
                sessionData.isUnload ? 1 : 0,
                sessionData.receivedAt
            ]
        );
    } catch (error) {
        console.error('Database error in persistSessionToDatabase:', error);
        throw error;
    }
}

/**
 * Persist metrics to database in batches
 */
async function persistMetricsToDatabase(metrics) {
    if (!metrics || metrics.length === 0) return;

    try {
        const db = Database.getInstance();
        await db.ensureInitialized();

        // Process in batches
        for (let i = 0; i < metrics.length; i += BATCH_SIZE) {
            const batch = metrics.slice(i, i + BATCH_SIZE);
            
            await db.run('BEGIN TRANSACTION');
            
            try {
                for (const metric of batch) {
                    await db.run(
                        `INSERT INTO RumMetrics 
                         (session_id, metric_type, metric_name, metric_value, metric_data, timestamp, processed_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            metric.sessionId,
                            metric.type,
                            metric.name || null,
                            metric.value || null,
                            JSON.stringify(metric),
                            metric.timestamp,
                            metric.processedAt
                        ]
                    );
                }
                
                await db.run('COMMIT');
            } catch (error) {
                await db.run('ROLLBACK');
                throw error;
            }
        }
    } catch (error) {
        console.error('Database error in persistMetricsToDatabase:', error);
        throw error;
    }
}

/**
 * Persist errors to database in batches
 */
async function persistErrorsToDatabase(errors) {
    if (!errors || errors.length === 0) return;

    try {
        const db = Database.getInstance();
        await db.ensureInitialized();

        // Process in batches
        for (let i = 0; i < errors.length; i += BATCH_SIZE) {
            const batch = errors.slice(i, i + BATCH_SIZE);
            
            await db.run('BEGIN TRANSACTION');
            
            try {
                for (const error of batch) {
                    await db.run(
                        `INSERT INTO RumErrors 
                         (session_id, error_type, error_message, error_stack, error_data, timestamp, processed_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            error.sessionId,
                            error.type,
                            error.message || null,
                            error.stack || null,
                            JSON.stringify(error),
                            error.timestamp,
                            error.processedAt
                        ]
                    );
                }
                
                await db.run('COMMIT');
            } catch (error) {
                await db.run('ROLLBACK');
                throw error;
            }
        }
    } catch (error) {
        console.error('Database error in persistErrorsToDatabase:', error);
        throw error;
    }
}

/**
 * Clean up old data from memory and database
 */
function cleanupOldData() {
    const memoryCutoff = Date.now() - MEMORY_RETENTION;
    const dbCutoff = Date.now() - DATA_RETENTION;
    
    // Clean up old sessions from memory (24 hours)
    for (const [key, session] of rumData.sessions) {
        if (session.timestamp < memoryCutoff) {
            rumData.sessions.delete(key);
        }
    }
    
    // Clean up old metrics from memory (24 hours)
    for (const [key, metric] of rumData.metrics) {
        if (metric.timestamp < memoryCutoff) {
            rumData.metrics.delete(key);
        }
    }
    
    // Clean up old errors from memory (24 hours)
    for (const [key, error] of rumData.errors) {
        if (error.timestamp < memoryCutoff) {
            rumData.errors.delete(key);
        }
    }
    
    // Clean up old data from database (90 days) - non-blocking
    cleanupDatabaseData(dbCutoff).catch(err => {
        console.error('Failed to cleanup old RUM data from database:', err);
    });
}

/**
 * Clean up old data from database
 */
async function cleanupDatabaseData(cutoff) {
    try {
        const db = Database.getInstance();
        await db.ensureInitialized();
        
        const startTime = Date.now();
        
        // Delete old sessions (cascade will handle metrics and errors)
        const sessionsResult = await db.run(
            'DELETE FROM RumSessions WHERE created_at < ?',
            [cutoff]
        );
        
        // Explicitly delete orphaned metrics and errors (if any)
        const metricsResult = await db.run(
            'DELETE FROM RumMetrics WHERE created_at < ?',
            [cutoff]
        );
        
        const errorsResult = await db.run(
            'DELETE FROM RumErrors WHERE created_at < ?',
            [cutoff]
        );
        
        const duration = Date.now() - startTime;
        
        if (sessionsResult.changes > 0 || metricsResult.changes > 0 || errorsResult.changes > 0) {
            console.log(`RUM cleanup: Deleted ${sessionsResult.changes} sessions, ${metricsResult.changes} metrics, ${errorsResult.changes} errors in ${duration}ms`);
        }
    } catch (error) {
        console.error('Database error in cleanupDatabaseData:', error);
        throw error;
    }
}

module.exports = router;