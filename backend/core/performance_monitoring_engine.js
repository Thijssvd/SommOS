/**
 * Performance Monitoring Engine
 * Comprehensive performance monitoring and analytics for SommOS
 */

const EventEmitter = require('events');
const os = require('os');

class PerformanceMonitoringEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.monitoringInterval = options.monitoringInterval || 5000; // 5 seconds
        this.metricsRetention = options.metricsRetention || 24 * 60 * 60 * 1000; // 24 hours
        this.alertThresholds = options.alertThresholds || {
            cpu: 80,
            memory: 85,
            responseTime: 5000,
            errorRate: 5
        };
        
        // Metrics storage
        this.metrics = {
            system: new Map(),
            application: new Map(),
            database: new Map(),
            api: new Map(),
            cache: new Map(),
            ml: new Map()
        };
        
        // Performance counters
        this.counters = {
            requests: 0,
            responses: 0,
            errors: 0,
            cacheHits: 0,
            cacheMisses: 0,
            dbQueries: 0,
            mlPredictions: 0
        };
        
        // Response time tracking
        this.responseTimes = [];
        this.errorRates = [];
        
        // Alerts
        this.alerts = [];
        this.alertHistory = [];
        
        // Start monitoring
        this.startMonitoring();
    }

    /**
     * Start performance monitoring
     */
    startMonitoring() {
        setInterval(() => {
            this.collectSystemMetrics();
            this.collectApplicationMetrics();
            this.collectDatabaseMetrics();
            this.collectAPIMetrics();
            this.collectCacheMetrics();
            this.collectMLMetrics();
            this.checkAlerts();
            this.cleanupOldMetrics();
        }, this.monitoringInterval);
    }

    /**
     * Collect system metrics
     */
    collectSystemMetrics() {
        const timestamp = Date.now();
        
        // CPU usage
        const cpuUsage = process.cpuUsage();
        const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
        
        // Memory usage
        const memUsage = process.memoryUsage();
        const systemMem = {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
        };
        
        // Load average
        const loadAvg = os.loadavg();
        
        const systemMetrics = {
            timestamp,
            cpu: {
                usage: cpuPercent,
                loadAverage: loadAvg,
                cores: os.cpus().length
            },
            memory: {
                process: {
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    external: memUsage.external,
                    rss: memUsage.rss
                },
                system: systemMem
            },
            uptime: process.uptime()
        };
        
        this.metrics.system.set(timestamp, systemMetrics);
        this.emit('systemMetrics', systemMetrics);
    }

    /**
     * Collect application metrics
     */
    collectApplicationMetrics() {
        const timestamp = Date.now();
        
        const appMetrics = {
            timestamp,
            requests: this.counters.requests,
            responses: this.counters.responses,
            errors: this.counters.errors,
            errorRate: this.calculateErrorRate(),
            responseTime: this.calculateAverageResponseTime(),
            throughput: this.calculateThroughput(),
            activeConnections: this.getActiveConnections(),
            memoryUsage: process.memoryUsage().heapUsed,
            gc: this.getGCMetrics()
        };
        
        this.metrics.application.set(timestamp, appMetrics);
        this.emit('applicationMetrics', appMetrics);
    }

    /**
     * Collect database metrics
     */
    collectDatabaseMetrics() {
        const timestamp = Date.now();
        
        const dbMetrics = {
            timestamp,
            queries: this.counters.dbQueries,
            queryTime: this.getAverageQueryTime(),
            connections: this.getDBConnections(),
            locks: this.getDBLocks(),
            cacheHitRate: this.getDBCacheHitRate()
        };
        
        this.metrics.database.set(timestamp, dbMetrics);
        this.emit('databaseMetrics', dbMetrics);
    }

    /**
     * Collect API metrics
     */
    collectAPIMetrics() {
        const timestamp = Date.now();
        
        const apiMetrics = {
            timestamp,
            endpoints: this.getEndpointMetrics(),
            responseCodes: this.getResponseCodeMetrics(),
            responseTimes: this.getResponseTimeMetrics(),
            throughput: this.getAPITransferRate()
        };
        
        this.metrics.api.set(timestamp, apiMetrics);
        this.emit('apiMetrics', apiMetrics);
    }

    /**
     * Collect cache metrics
     */
    collectCacheMetrics() {
        const timestamp = Date.now();
        
        const cacheMetrics = {
            timestamp,
            hits: this.counters.cacheHits,
            misses: this.counters.cacheMisses,
            hitRate: this.calculateCacheHitRate(),
            size: this.getCacheSize(),
            memoryUsage: this.getCacheMemoryUsage(),
            evictions: this.getCacheEvictions()
        };
        
        this.metrics.cache.set(timestamp, cacheMetrics);
        this.emit('cacheMetrics', cacheMetrics);
    }

    /**
     * Collect ML metrics
     */
    collectMLMetrics() {
        const timestamp = Date.now();
        
        const mlMetrics = {
            timestamp,
            predictions: this.counters.mlPredictions,
            modelAccuracy: this.getModelAccuracy(),
            trainingTime: this.getAverageTrainingTime(),
            predictionTime: this.getAveragePredictionTime(),
            modelSize: this.getModelSize(),
            featureCount: this.getFeatureCount()
        };
        
        this.metrics.ml.set(timestamp, mlMetrics);
        this.emit('mlMetrics', mlMetrics);
    }

    /**
     * Record request
     */
    recordRequest(endpoint, method, startTime) {
        this.counters.requests++;
        
        const requestId = this.generateRequestId();
        const request = {
            id: requestId,
            endpoint,
            method,
            startTime,
            timestamp: Date.now()
        };
        
        this.emit('requestStarted', request);
        return requestId;
    }

    /**
     * Record response
     */
    recordResponse(requestId, statusCode, endTime, responseSize = 0) {
        this.counters.responses++;
        
        const responseTime = endTime - Date.now();
        this.responseTimes.push(responseTime);
        
        // Keep only last 1000 response times
        if (this.responseTimes.length > 1000) {
            this.responseTimes.shift();
        }
        
        const response = {
            requestId,
            statusCode,
            responseTime,
            responseSize,
            timestamp: Date.now()
        };
        
        this.emit('responseCompleted', response);
        
        if (statusCode >= 400) {
            this.recordError('HTTP_ERROR', statusCode, responseTime);
        }
    }

    /**
     * Record error
     */
    recordError(type, message, context = {}) {
        this.counters.errors++;
        
        const error = {
            type,
            message,
            context,
            timestamp: Date.now(),
            stack: context.stack
        };
        
        this.emit('errorRecorded', error);
    }

    /**
     * Record cache operation
     */
    recordCacheOperation(operation, key, hit = false) {
        if (hit) {
            this.counters.cacheHits++;
        } else {
            this.counters.cacheMisses++;
        }
        
        const cacheOp = {
            operation,
            key,
            hit,
            timestamp: Date.now()
        };
        
        this.emit('cacheOperation', cacheOp);
    }

    /**
     * Record database query
     */
    recordDBQuery(query, executionTime, rowsAffected = 0) {
        this.counters.dbQueries++;
        
        const dbQuery = {
            query,
            executionTime,
            rowsAffected,
            timestamp: Date.now()
        };
        
        this.emit('dbQuery', dbQuery);
    }

    /**
     * Record ML prediction
     */
    recordMLPrediction(modelType, predictionTime, accuracy = null) {
        this.counters.mlPredictions++;
        
        const mlPrediction = {
            modelType,
            predictionTime,
            accuracy,
            timestamp: Date.now()
        };
        
        this.emit('mlPrediction', mlPrediction);
    }

    /**
     * Check for alerts
     */
    checkAlerts() {
        const currentMetrics = this.getCurrentMetrics();
        
        // CPU alert
        if (currentMetrics.system.cpu.usage > this.alertThresholds.cpu) {
            this.triggerAlert('HIGH_CPU', `CPU usage: ${currentMetrics.system.cpu.usage}%`);
        }
        
        // Memory alert
        const memoryPercent = (currentMetrics.system.memory.process.heapUsed / currentMetrics.system.memory.process.heapTotal) * 100;
        if (memoryPercent > this.alertThresholds.memory) {
            this.triggerAlert('HIGH_MEMORY', `Memory usage: ${memoryPercent}%`);
        }
        
        // Response time alert
        if (currentMetrics.application.responseTime > this.alertThresholds.responseTime) {
            this.triggerAlert('HIGH_RESPONSE_TIME', `Response time: ${currentMetrics.application.responseTime}ms`);
        }
        
        // Error rate alert
        if (currentMetrics.application.errorRate > this.alertThresholds.errorRate) {
            this.triggerAlert('HIGH_ERROR_RATE', `Error rate: ${currentMetrics.application.errorRate}%`);
        }
    }

    /**
     * Trigger alert
     */
    triggerAlert(type, message, severity = 'warning') {
        const alert = {
            type,
            message,
            severity,
            timestamp: Date.now(),
            resolved: false
        };
        
        this.alerts.push(alert);
        this.alertHistory.push(alert);
        
        this.emit('alertTriggered', alert);
    }

    /**
     * Resolve alert
     */
    resolveAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
            alert.resolvedAt = Date.now();
            this.emit('alertResolved', alert);
        }
    }

    /**
     * Get current metrics
     */
    getCurrentMetrics() {
        const timestamp = Date.now();
        
        return {
            system: this.metrics.system.get(timestamp) || this.getLatestMetric('system'),
            application: this.metrics.application.get(timestamp) || this.getLatestMetric('application'),
            database: this.metrics.database.get(timestamp) || this.getLatestMetric('database'),
            api: this.metrics.api.get(timestamp) || this.getLatestMetric('api'),
            cache: this.metrics.cache.get(timestamp) || this.getLatestMetric('cache'),
            ml: this.metrics.ml.get(timestamp) || this.getLatestMetric('ml')
        };
    }

    /**
     * Get latest metric for a category
     */
    getLatestMetric(category) {
        const metrics = this.metrics[category];
        if (metrics.size === 0) return null;
        
        const timestamps = Array.from(metrics.keys()).sort((a, b) => b - a);
        return metrics.get(timestamps[0]);
    }

    /**
     * Get metrics for time range
     */
    getMetricsForRange(category, startTime, endTime) {
        const metrics = this.metrics[category];
        const result = [];
        
        for (const [timestamp, data] of metrics) {
            if (timestamp >= startTime && timestamp <= endTime) {
                result.push({ timestamp, data });
            }
        }
        
        return result.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Get performance summary
     */
    getPerformanceSummary() {
        const current = this.getCurrentMetrics();
        
        return {
            timestamp: Date.now(),
            system: {
                cpu: current.system?.cpu?.usage || 0,
                memory: current.system?.memory?.process?.heapUsed || 0,
                uptime: current.system?.uptime || 0
            },
            application: {
                requests: this.counters.requests,
                responses: this.counters.responses,
                errors: this.counters.errors,
                errorRate: this.calculateErrorRate(),
                responseTime: this.calculateAverageResponseTime(),
                throughput: this.calculateThroughput()
            },
            database: {
                queries: this.counters.dbQueries,
                queryTime: this.getAverageQueryTime()
            },
            cache: {
                hits: this.counters.cacheHits,
                misses: this.counters.cacheMisses,
                hitRate: this.calculateCacheHitRate()
            },
            ml: {
                predictions: this.counters.mlPredictions,
                accuracy: this.getModelAccuracy()
            },
            alerts: this.alerts.filter(a => !a.resolved).length
        };
    }

    /**
     * Calculate error rate
     */
    calculateErrorRate() {
        if (this.counters.requests === 0) return 0;
        return (this.counters.errors / this.counters.requests) * 100;
    }

    /**
     * Calculate average response time
     */
    calculateAverageResponseTime() {
        if (this.responseTimes.length === 0) return 0;
        return this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }

    /**
     * Calculate throughput
     */
    calculateThroughput() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        let requestsInLastMinute = 0;
        for (const [timestamp] of this.metrics.application) {
            if (timestamp >= oneMinuteAgo) {
                requestsInLastMinute++;
            }
        }
        
        return requestsInLastMinute;
    }

    /**
     * Calculate cache hit rate
     */
    calculateCacheHitRate() {
        const total = this.counters.cacheHits + this.counters.cacheMisses;
        if (total === 0) return 0;
        return (this.counters.cacheHits / total) * 100;
    }

    /**
     * Get active connections
     */
    getActiveConnections() {
        // This would be implemented based on your connection tracking
        return 0;
    }

    /**
     * Get GC metrics
     */
    getGCMetrics() {
        // This would be implemented based on your GC monitoring
        return {
            major: 0,
            minor: 0,
            time: 0
        };
    }

    /**
     * Get average query time
     */
    getAverageQueryTime() {
        // This would be implemented based on your query tracking
        return 0;
    }

    /**
     * Get DB connections
     */
    getDBConnections() {
        // This would be implemented based on your DB connection tracking
        return {
            active: 0,
            idle: 0,
            total: 0
        };
    }

    /**
     * Get DB locks
     */
    getDBLocks() {
        // This would be implemented based on your DB lock tracking
        return 0;
    }

    /**
     * Get DB cache hit rate
     */
    getDBCacheHitRate() {
        // This would be implemented based on your DB cache tracking
        return 0;
    }

    /**
     * Get endpoint metrics
     */
    getEndpointMetrics() {
        // This would be implemented based on your endpoint tracking
        return {};
    }

    /**
     * Get response code metrics
     */
    getResponseCodeMetrics() {
        // This would be implemented based on your response code tracking
        return {};
    }

    /**
     * Get response time metrics
     */
    getResponseTimeMetrics() {
        // This would be implemented based on your response time tracking
        return {};
    }

    /**
     * Get API transfer rate
     */
    getAPITransferRate() {
        // This would be implemented based on your transfer rate tracking
        return 0;
    }

    /**
     * Get cache size
     */
    getCacheSize() {
        // This would be implemented based on your cache tracking
        return 0;
    }

    /**
     * Get cache memory usage
     */
    getCacheMemoryUsage() {
        // This would be implemented based on your cache tracking
        return 0;
    }

    /**
     * Get cache evictions
     */
    getCacheEvictions() {
        // This would be implemented based on your cache tracking
        return 0;
    }

    /**
     * Get model accuracy
     */
    getModelAccuracy() {
        // This would be implemented based on your ML tracking
        return 0;
    }

    /**
     * Get average training time
     */
    getAverageTrainingTime() {
        // This would be implemented based on your ML tracking
        return 0;
    }

    /**
     * Get average prediction time
     */
    getAveragePredictionTime() {
        // This would be implemented based on your ML tracking
        return 0;
    }

    /**
     * Get model size
     */
    getModelSize() {
        // This would be implemented based on your ML tracking
        return 0;
    }

    /**
     * Get feature count
     */
    getFeatureCount() {
        // This would be implemented based on your ML tracking
        return 0;
    }

    /**
     * Cleanup old metrics
     */
    cleanupOldMetrics() {
        const cutoff = Date.now() - this.metricsRetention;
        
        for (const [category, metrics] of Object.entries(this.metrics)) {
            for (const [timestamp] of metrics) {
                if (timestamp < cutoff) {
                    metrics.delete(timestamp);
                }
            }
        }
    }

    /**
     * Generate request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Export metrics
     */
    exportMetrics(format = 'json') {
        const data = {
            timestamp: Date.now(),
            metrics: this.getCurrentMetrics(),
            summary: this.getPerformanceSummary(),
            alerts: this.alerts.filter(a => !a.resolved)
        };
        
        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.exportToCSV(data);
            default:
                throw new Error(`Unknown export format: ${format}`);
        }
    }

    /**
     * Export to CSV
     */
    exportToCSV(data) {
        // This would implement CSV export
        return 'CSV export not implemented';
    }
}

module.exports = PerformanceMonitoringEngine;