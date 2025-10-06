/**
 * Prometheus Metrics Exporter
 * Exposes application and business metrics in Prometheus format
 */

const aiMetrics = require('./ai_metrics_tracker');

class PrometheusExporter {
    constructor() {
        this.metrics = {
            http_requests_total: { type: 'counter', help: 'Total HTTP requests', labels: ['method', 'path', 'status'], value: {} },
            http_request_duration_seconds: { type: 'histogram', help: 'HTTP request duration', labels: ['method', 'path'], value: {} },
            active_connections: { type: 'gauge', help: 'Active WebSocket connections', value: 0 },
            cache_operations: { type: 'counter', help: 'Cache operations', labels: ['operation', 'result'], value: {} },
            ai_requests_total: { type: 'counter', help: 'Total AI requests', labels: ['provider', 'status'], value: {} },
            ai_response_time_seconds: { type: 'histogram', help: 'AI response time', labels: ['provider'], value: {} },
            ai_confidence_score: { type: 'histogram', help: 'AI confidence scores', value: {} },
            database_queries_total: { type: 'counter', help: 'Total database queries', labels: ['operation'], value: {} },
            database_query_duration_seconds: { type: 'histogram', help: 'Database query duration', labels: ['operation'], value: {} },
            wine_inventory_total: { type: 'gauge', help: 'Total wine bottles in inventory', value: 0 },
            unique_wines_count: { type: 'gauge', help: 'Number of unique wines', value: 0 },
            active_users: { type: 'gauge', help: 'Number of active users', value: 0 }
        };
        
        this.startTime = Date.now();
    }

    /**
     * Record HTTP request
     */
    recordHttpRequest(method, path, statusCode, durationMs) {
        const key = `${method}:${path}:${statusCode}`;
        this.metrics.http_requests_total.value[key] = 
            (this.metrics.http_requests_total.value[key] || 0) + 1;
        
        const durationKey = `${method}:${path}`;
        if (!this.metrics.http_request_duration_seconds.value[durationKey]) {
            this.metrics.http_request_duration_seconds.value[durationKey] = [];
        }
        this.metrics.http_request_duration_seconds.value[durationKey].push(durationMs / 1000);
    }

    /**
     * Record active connections
     */
    setActiveConnections(count) {
        this.metrics.active_connections.value = count;
    }

    /**
     * Record cache operation
     */
    recordCacheOperation(operation, result) {
        const key = `${operation}:${result}`;
        this.metrics.cache_operations.value[key] = 
            (this.metrics.cache_operations.value[key] || 0) + 1;
    }

    /**
     * Record AI request
     */
    recordAIRequest(provider, status, responseTimeMs) {
        const key = `${provider}:${status}`;
        this.metrics.ai_requests_total.value[key] = 
            (this.metrics.ai_requests_total.value[key] || 0) + 1;
        
        if (!this.metrics.ai_response_time_seconds.value[provider]) {
            this.metrics.ai_response_time_seconds.value[provider] = [];
        }
        this.metrics.ai_response_time_seconds.value[provider].push(responseTimeMs / 1000);
    }

    /**
     * Record AI confidence score
     */
    recordAIConfidence(score) {
        if (!Array.isArray(this.metrics.ai_confidence_score.value)) {
            this.metrics.ai_confidence_score.value = [];
        }
        this.metrics.ai_confidence_score.value.push(score);
    }

    /**
     * Record database query
     */
    recordDatabaseQuery(operation, durationMs) {
        const key = operation;
        this.metrics.database_queries_total.value[key] = 
            (this.metrics.database_queries_total.value[key] || 0) + 1;
        
        if (!this.metrics.database_query_duration_seconds.value[key]) {
            this.metrics.database_query_duration_seconds.value[key] = [];
        }
        this.metrics.database_query_duration_seconds.value[key].push(durationMs / 1000);
    }

    /**
     * Update inventory metrics
     */
    updateInventoryMetrics(totalBottles, uniqueWines) {
        this.metrics.wine_inventory_total.value = totalBottles;
        this.metrics.unique_wines_count.value = uniqueWines;
    }

    /**
     * Update active users
     */
    setActiveUsers(count) {
        this.metrics.active_users.value = count;
    }

    /**
     * Format histogram data for Prometheus
     */
    formatHistogram(values, name, labels = '') {
        if (!values || values.length === 0) {
            return `# No data for ${name}\n`;
        }
        
        const sorted = [...values].sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((a, b) => a + b, 0);
        
        // Calculate quantiles
        const quantiles = {
            '0.5': sorted[Math.floor(count * 0.5)],
            '0.9': sorted[Math.floor(count * 0.9)],
            '0.95': sorted[Math.floor(count * 0.95)],
            '0.99': sorted[Math.floor(count * 0.99)]
        };
        
        let output = '';
        Object.entries(quantiles).forEach(([q, value]) => {
            output += `${name}{${labels}${labels ? ',' : ''}quantile="${q}"} ${value.toFixed(4)}\n`;
        });
        
        output += `${name}_sum{${labels}} ${sum.toFixed(4)}\n`;
        output += `${name}_count{${labels}} ${count}\n`;
        
        return output;
    }

    /**
     * Export metrics in Prometheus format
     */
    export() {
        let output = '';
        
        // Process uptime
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        output += `# HELP process_uptime_seconds Process uptime in seconds\n`;
        output += `# TYPE process_uptime_seconds gauge\n`;
        output += `process_uptime_seconds ${uptimeSeconds}\n\n`;
        
        // Process each metric
        Object.entries(this.metrics).forEach(([name, metric]) => {
            output += `# HELP ${name} ${metric.help}\n`;
            output += `# TYPE ${name} ${metric.type}\n`;
            
            if (metric.type === 'counter' || metric.type === 'gauge') {
                if (typeof metric.value === 'number') {
                    output += `${name} ${metric.value}\n`;
                } else if (typeof metric.value === 'object') {
                    Object.entries(metric.value).forEach(([key, value]) => {
                        const labels = key.split(':').map((v, i) => `${metric.labels[i]}="${v}"`).join(',');
                        output += `${name}{${labels}} ${value}\n`;
                    });
                }
            } else if (metric.type === 'histogram') {
                if (Array.isArray(metric.value)) {
                    output += this.formatHistogram(metric.value, name);
                } else if (typeof metric.value === 'object') {
                    Object.entries(metric.value).forEach(([key, values]) => {
                        const labels = key.split(':').map((v, i) => `${metric.labels[i]}="${v}"`).join(',');
                        output += this.formatHistogram(values, name, labels);
                    });
                }
            }
            
            output += '\n';
        });
        
        // Add AI metrics from tracker
        if (aiMetrics) {
            try {
                const aiSummary = aiMetrics.getSummary();
                
                output += `# HELP ai_total_requests Total AI requests made\n`;
                output += `# TYPE ai_total_requests counter\n`;
                output += `ai_total_requests ${aiSummary.requests.total}\n\n`;
                
                output += `# HELP ai_success_rate AI request success rate (0-100)\n`;
                output += `# TYPE ai_success_rate gauge\n`;
                output += `ai_success_rate ${aiSummary.requests.success_rate}\n\n`;
                
                output += `# HELP ai_cache_hit_rate AI cache hit rate (0-100)\n`;
                output += `# TYPE ai_cache_hit_rate gauge\n`;
                output += `ai_cache_hit_rate ${aiSummary.cache.hit_rate}\n\n`;
                
                output += `# HELP ai_avg_response_time_ms Average AI response time in milliseconds\n`;
                output += `# TYPE ai_avg_response_time_ms gauge\n`;
                output += `ai_avg_response_time_ms ${aiSummary.performance.avg_response_time_ms}\n\n`;
                
                output += `# HELP ai_avg_confidence Average AI confidence score (0-1)\n`;
                output += `# TYPE ai_avg_confidence gauge\n`;
                output += `ai_avg_confidence ${aiSummary.performance.avg_confidence}\n\n`;
            } catch (error) {
                console.error('[Prometheus] Error adding AI metrics:', error);
            }
        }
        
        // Add Node.js process metrics
        const memUsage = process.memoryUsage();
        output += `# HELP nodejs_heap_used_bytes Node.js heap memory used\n`;
        output += `# TYPE nodejs_heap_used_bytes gauge\n`;
        output += `nodejs_heap_used_bytes ${memUsage.heapUsed}\n\n`;
        
        output += `# HELP nodejs_heap_total_bytes Node.js heap memory total\n`;
        output += `# TYPE nodejs_heap_total_bytes gauge\n`;
        output += `nodejs_heap_total_bytes ${memUsage.heapTotal}\n\n`;
        
        output += `# HELP nodejs_external_memory_bytes Node.js external memory\n`;
        output += `# TYPE nodejs_external_memory_bytes gauge\n`;
        output += `nodejs_external_memory_bytes ${memUsage.external}\n\n`;
        
        const cpuUsage = process.cpuUsage();
        output += `# HELP nodejs_cpu_user_seconds_total Node.js CPU user time\n`;
        output += `# TYPE nodejs_cpu_user_seconds_total counter\n`;
        output += `nodejs_cpu_user_seconds_total ${cpuUsage.user / 1000000}\n\n`;
        
        output += `# HELP nodejs_cpu_system_seconds_total Node.js CPU system time\n`;
        output += `# TYPE nodejs_cpu_system_seconds_total counter\n`;
        output += `nodejs_cpu_system_seconds_total ${cpuUsage.system / 1000000}\n\n`;
        
        return output;
    }

    /**
     * Reset all metrics
     */
    reset() {
        Object.keys(this.metrics).forEach(key => {
            if (typeof this.metrics[key].value === 'number') {
                this.metrics[key].value = 0;
            } else if (Array.isArray(this.metrics[key].value)) {
                this.metrics[key].value = [];
            } else {
                this.metrics[key].value = {};
            }
        });
        this.startTime = Date.now();
    }
}

// Export singleton
module.exports = new PrometheusExporter();
