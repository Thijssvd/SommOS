/**
 * SommOS Performance Monitoring
 * Tracks Web Vitals (LCP, FID, CLS) and custom performance metrics
 */

import { onLCP, onFID, onCLS, onFCP, onTTFB } from 'web-vitals';

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            lcp: null,
            fid: null,
            cls: null,
            fcp: null,
            ttfb: null,
            custom: new Map()
        };
        
        this.thresholds = {
            lcp: { good: 2500, needsImprovement: 4000 },
            fid: { good: 100, needsImprovement: 300 },
            cls: { good: 0.1, needsImprovement: 0.25 },
            fcp: { good: 1800, needsImprovement: 3000 },
            ttfb: { good: 800, needsImprovement: 1800 }
        };
        
        this.enabled = true;
        this.reportEndpoint = '/api/performance/metrics';
        this.batchQueue = [];
        this.batchTimeout = null;
        this.batchDelay = 10000; // 10 seconds
    }

    /**
     * Initialize Web Vitals tracking
     */
    init() {
        if (!this.enabled) return;

        console.log('[Performance] Initializing Web Vitals tracking...');

        // Track Core Web Vitals
        onLCP((metric) => this.handleMetric('lcp', metric));
        onFID((metric) => this.handleMetric('fid', metric));
        onCLS((metric) => this.handleMetric('cls', metric));
        onFCP((metric) => this.handleMetric('fcp', metric));
        onTTFB((metric) => this.handleMetric('ttfb', metric));

        // Track custom metrics
        this.trackNavigationTiming();
        this.trackResourceTiming();
        
        console.log('[Performance] Web Vitals tracking initialized');
    }

    /**
     * Handle incoming metric
     */
    handleMetric(name, metric) {
        const value = metric.value;
        const rating = this.getRating(name, value);

        this.metrics[name] = {
            value,
            rating,
            delta: metric.delta,
            id: metric.id,
            timestamp: Date.now()
        };

        console.log(`[Performance] ${name.toUpperCase()}: ${value.toFixed(2)}ms (${rating})`);

        // Queue for batch reporting
        this.queueMetric({
            name,
            value,
            rating,
            timestamp: Date.now(),
            url: window.location.pathname
        });

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('sommos:performance-metric', {
            detail: { name, ...this.metrics[name] }
        }));
    }

    /**
     * Get rating for a metric value
     */
    getRating(metricName, value) {
        const threshold = this.thresholds[metricName];
        if (!threshold) return 'unknown';

        if (value <= threshold.good) return 'good';
        if (value <= threshold.needsImprovement) return 'needs-improvement';
        return 'poor';
    }

    /**
     * Track Navigation Timing
     */
    trackNavigationTiming() {
        if (!window.performance || !window.performance.timing) return;

        window.addEventListener('load', () => {
            const timing = window.performance.timing;
            const metrics = {
                'dns-lookup': timing.domainLookupEnd - timing.domainLookupStart,
                'tcp-connection': timing.connectEnd - timing.connectStart,
                'request-response': timing.responseEnd - timing.requestStart,
                'dom-processing': timing.domComplete - timing.domLoading,
                'dom-interactive': timing.domInteractive - timing.navigationStart,
                'page-load': timing.loadEventEnd - timing.navigationStart
            };

            Object.entries(metrics).forEach(([name, value]) => {
                if (value >= 0) {
                    this.trackCustomMetric(name, value);
                }
            });
        });
    }

    /**
     * Track Resource Timing
     */
    trackResourceTiming() {
        if (!window.performance || !window.performance.getEntriesByType) return;

        window.addEventListener('load', () => {
            const resources = window.performance.getEntriesByType('resource');
            
            const summary = {
                totalResources: resources.length,
                totalTransferSize: 0,
                avgDuration: 0,
                byType: {}
            };

            resources.forEach(resource => {
                summary.totalTransferSize += resource.transferSize || 0;
                summary.avgDuration += resource.duration;

                const type = resource.initiatorType || 'other';
                if (!summary.byType[type]) {
                    summary.byType[type] = { count: 0, size: 0, duration: 0 };
                }
                summary.byType[type].count++;
                summary.byType[type].size += resource.transferSize || 0;
                summary.byType[type].duration += resource.duration;
            });

            summary.avgDuration = summary.avgDuration / resources.length;

            console.log('[Performance] Resource timing:', summary);
            
            this.trackCustomMetric('resource-count', summary.totalResources);
            this.trackCustomMetric('resource-size', summary.totalTransferSize);
        });
    }

    /**
     * Track custom performance metric
     */
    trackCustomMetric(name, value, metadata = {}) {
        this.metrics.custom.set(name, {
            value,
            metadata,
            timestamp: Date.now()
        });

        this.queueMetric({
            name: `custom:${name}`,
            value,
            metadata,
            timestamp: Date.now(),
            url: window.location.pathname
        });

        console.log(`[Performance] Custom metric ${name}: ${value}`);
    }

    /**
     * Mark performance milestone
     */
    mark(name) {
        if (!window.performance || !window.performance.mark) return;
        window.performance.mark(name);
    }

    /**
     * Measure performance between marks
     */
    measure(name, startMark, endMark) {
        if (!window.performance || !window.performance.measure) return;
        
        try {
            window.performance.measure(name, startMark, endMark);
            const measure = window.performance.getEntriesByName(name)[0];
            this.trackCustomMetric(name, measure.duration);
            return measure.duration;
        } catch (error) {
            console.warn(`[Performance] Failed to measure ${name}:`, error);
            return null;
        }
    }

    /**
     * Queue metric for batch reporting
     */
    queueMetric(metric) {
        this.batchQueue.push(metric);

        // Clear existing timeout
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        // Schedule batch send
        this.batchTimeout = setTimeout(() => {
            this.sendBatch();
        }, this.batchDelay);

        // Send immediately if queue is large
        if (this.batchQueue.length >= 20) {
            clearTimeout(this.batchTimeout);
            this.sendBatch();
        }
    }

    /**
     * Send batched metrics to server
     */
    async sendBatch() {
        if (this.batchQueue.length === 0) return;

        const batch = [...this.batchQueue];
        this.batchQueue = [];

        try {
            await fetch(this.reportEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    metrics: batch,
                    userAgent: navigator.userAgent,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    connection: this.getConnectionInfo()
                })
            });
            console.log(`[Performance] Sent ${batch.length} metrics to server`);
        } catch (error) {
            console.warn('[Performance] Failed to send metrics:', error);
            // Re-queue on failure
            this.batchQueue.push(...batch);
        }
    }

    /**
     * Get connection information
     */
    getConnectionInfo() {
        if (!navigator.connection) return null;
        
        return {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt,
            saveData: navigator.connection.saveData
        };
    }

    /**
     * Get all metrics
     */
    getMetrics() {
        return {
            webVitals: {
                lcp: this.metrics.lcp,
                fid: this.metrics.fid,
                cls: this.metrics.cls,
                fcp: this.metrics.fcp,
                ttfb: this.metrics.ttfb
            },
            custom: Object.fromEntries(this.metrics.custom)
        };
    }

    /**
     * Get performance summary
     */
    getSummary() {
        const webVitals = [
            this.metrics.lcp,
            this.metrics.fid,
            this.metrics.cls,
            this.metrics.fcp,
            this.metrics.ttfb
        ].filter(m => m !== null);

        const goodCount = webVitals.filter(m => m.rating === 'good').length;
        const poorCount = webVitals.filter(m => m.rating === 'poor').length;

        return {
            totalMetrics: webVitals.length,
            goodCount,
            poorCount,
            score: webVitals.length > 0 ? (goodCount / webVitals.length) * 100 : 0,
            metrics: this.getMetrics()
        };
    }

    /**
     * Disable performance tracking
     */
    disable() {
        this.enabled = false;
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
    }

    /**
     * Enable performance tracking
     */
    enable() {
        this.enabled = true;
    }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
