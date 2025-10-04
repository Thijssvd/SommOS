/**
 * Performance Integration Example
 * Demonstrates how to integrate the enhanced PerformanceMonitor with the application
 */

import PerformanceMonitor from './performance-monitor.js';
import PerformanceDashboard from './performance-dashboard.js';

class PerformanceIntegration {
    constructor(api = null) {
        this.api = api; // SommOSAPI instance
        this.monitor = null;
        this.dashboard = null;
        this.isInitialized = false;
    }
    
    /**
     * Initialize performance monitoring
     */
    init(options = {}) {
        if (this.isInitialized) {
            console.warn('Performance monitoring already initialized');
            return;
        }
        
        try {
            // Initialize the performance monitor
            this.monitor = new PerformanceMonitor({
                sampleRate: options.sampleRate || 1.0,
                reportInterval: options.reportInterval || 30000,
                endpoint: options.endpoint || '/api/performance/rum',
                debug: options.debug || false,
                api: this.api, // Pass API client to monitor
                enableUserTiming: options.enableUserTiming !== false,
                enableResourceTiming: options.enableResourceTiming !== false,
                enableNavigationTiming: options.enableNavigationTiming !== false,
                enableErrorTracking: options.enableErrorTracking !== false,
                enableCustomMetrics: options.enableCustomMetrics !== false,
                ...options
            });
            
            // Set up real-time monitoring
            this.setupRealTimeMonitoring();
            
            // Set up custom metrics tracking
            this.setupCustomMetrics();
            
            // Set up performance alerts
            this.setupPerformanceAlerts();
            
            this.isInitialized = true;
            console.log('Performance monitoring initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize performance monitoring:', error);
        }
    }
    
    /**
     * Initialize performance dashboard
     */
    initDashboard(containerId, options = {}) {
        try {
            this.dashboard = new PerformanceDashboard(containerId, {
                apiEndpoint: options.apiEndpoint || '/api/performance/rum',
                refreshInterval: options.refreshInterval || 30000,
                charts: options.charts || ['webVitals', 'errors', 'sessions'],
                theme: options.theme || 'light',
                api: this.api, // Pass API client to dashboard
                ...options
            });
            
            console.log('Performance dashboard initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize performance dashboard:', error);
        }
    }
    
    /**
     * Set up real-time monitoring
     */
    setupRealTimeMonitoring() {
        // Listen for metric events
        window.addEventListener('rum-metric', (event) => {
            const { type, data } = event.detail;
            
            switch (type) {
                case 'webVital':
                    this.handleWebVitalMetric(data);
                    break;
                case 'custom':
                    this.handleCustomMetric(data);
                    break;
                case 'error':
                    this.handleErrorMetric(data);
                    break;
            }
        });
    }
    
    /**
     * Handle Web Vital metrics
     */
    handleWebVitalMetric(metric) {
        // Log critical Web Vitals issues
        if (!metric.passed) {
            console.warn(`Web Vital ${metric.name} failed threshold:`, {
                value: metric.value,
                threshold: metric.threshold,
                metadata: metric.metadata
            });
            
            // Send alert to monitoring system
            this.sendAlert('webVital', {
                metric: metric.name,
                value: metric.value,
                threshold: metric.threshold,
                severity: this.getSeverity(metric.name, metric.value, metric.threshold)
            });
        }
        
        // Update UI indicators if available
        this.updateWebVitalsIndicator(metric);
    }
    
    /**
     * Handle custom metrics
     */
    handleCustomMetric(metric) {
        // Log performance issues
        if (metric.name === 'longTask' && metric.data.duration > 50) {
            console.warn('Long task detected:', metric.data);
            
            this.sendAlert('longTask', {
                duration: metric.data.duration,
                severity: 'warning'
            });
        }
        
        if (metric.name === 'fps' && metric.data.fps < 30) {
            console.warn('Low frame rate detected:', metric.data.fps);
            
            this.sendAlert('lowFps', {
                fps: metric.data.fps,
                severity: 'warning'
            });
        }
        
        if (metric.name === 'memory' && metric.data.usedJSHeapSize > metric.data.jsHeapSizeLimit * 0.8) {
            console.warn('High memory usage detected:', metric.data);
            
            this.sendAlert('highMemory', {
                usage: metric.data.usedJSHeapSize,
                limit: metric.data.jsHeapSizeLimit,
                severity: 'error'
            });
        }
    }
    
    /**
     * Handle error metrics
     */
    handleErrorMetric(error) {
        console.error('Error tracked:', error);
        
        // Send critical errors to monitoring system
        if (error.type === 'javascript' || error.type === 'promise') {
            this.sendAlert('error', {
                type: error.type,
                message: error.data.message || error.data.reason,
                stack: error.data.stack,
                severity: 'error'
            });
        }
    }
    
    /**
     * Set up custom metrics tracking
     */
    setupCustomMetrics() {
        // Track page load performance
        this.trackPageLoad();
        
        // Track user interactions
        this.trackUserInteractions();
        
        // Track API calls
        this.trackAPICalls();
        
        // Track component render times
        this.trackComponentRenders();
    }
    
    /**
     * Track page load performance
     */
    trackPageLoad() {
        window.addEventListener('load', () => {
            const loadTime = performance.now();
            
            this.monitor.recordCustomMetric('pageLoad', {
                loadTime,
                domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
                firstPaint: this.getFirstPaint(),
                firstContentfulPaint: this.getFirstContentfulPaint()
            });
        });
    }
    
    /**
     * Track user interactions
     */
    trackUserInteractions() {
        // Track button clicks
        document.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON' || event.target.classList.contains('btn')) {
                this.monitor.recordCustomMetric('buttonClick', {
                    buttonText: event.target.textContent,
                    buttonId: event.target.id,
                    buttonClass: event.target.className,
                    clickTime: performance.now()
                });
            }
        });
        
        // Track form submissions
        document.addEventListener('submit', (event) => {
            this.monitor.recordCustomMetric('formSubmit', {
                formId: event.target.id,
                formAction: event.target.action,
                formMethod: event.target.method,
                fieldCount: event.target.elements.length
            });
        });
        
        // Track navigation
        window.addEventListener('popstate', () => {
            this.monitor.recordCustomMetric('navigation', {
                url: window.location.href,
                referrer: document.referrer,
                navigationTime: performance.now()
            });
        });
    }
    
    /**
     * Track API calls
     */
    trackAPICalls() {
        // Override fetch to track API calls
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const startTime = performance.now();
            const url = args[0];
            
            try {
                const response = await originalFetch(...args);
                const endTime = performance.now();
                
                this.monitor.recordCustomMetric('apiCall', {
                    url: url.toString(),
                    method: args[1]?.method || 'GET',
                    status: response.status,
                    responseTime: endTime - startTime,
                    success: response.ok
                });
                
                return response;
            } catch (error) {
                const endTime = performance.now();
                
                this.monitor.recordCustomMetric('apiCall', {
                    url: url.toString(),
                    method: args[1]?.method || 'GET',
                    status: 0,
                    responseTime: endTime - startTime,
                    success: false,
                    error: error.message
                });
                
                throw error;
            }
        };
    }
    
    /**
     * Track component render times
     */
    trackComponentRenders() {
        // This would be implemented based on your framework
        // For example, with React:
        /*
        const originalRender = React.Component.prototype.render;
        React.Component.prototype.render = function() {
            const startTime = performance.now();
            const result = originalRender.call(this);
            const endTime = performance.now();
            
            this.monitor.recordCustomMetric('componentRender', {
                componentName: this.constructor.name,
                renderTime: endTime - startTime,
                props: Object.keys(this.props).length
            });
            
            return result;
        };
        */
    }
    
    /**
     * Set up performance alerts
     */
    setupPerformanceAlerts() {
        // Set up Web Vitals alerts
        this.setupWebVitalsAlerts();
        
        // Set up custom performance alerts
        this.setupCustomAlerts();
    }
    
    /**
     * Set up Web Vitals alerts
     */
    setupWebVitalsAlerts() {
        const thresholds = {
            LCP: 2500,
            FID: 100,
            CLS: 0.1,
            FCP: 1800,
            TTFB: 800
        };
        
        // Check Web Vitals periodically
        setInterval(() => {
            const summary = this.monitor.getWebVitalsSummary();
            
            Object.entries(summary).forEach(([name, vital]) => {
                if (vital.value > thresholds[name]) {
                    this.sendAlert('webVitalThreshold', {
                        metric: name,
                        value: vital.value,
                        threshold: thresholds[name],
                        severity: 'warning'
                    });
                }
            });
        }, 60000); // Check every minute
    }
    
    /**
     * Set up custom alerts
     */
    setupCustomAlerts() {
        // Monitor memory usage
        setInterval(() => {
            if ('memory' in performance) {
                const memory = performance.memory;
                const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
                
                if (usagePercent > 80) {
                    this.sendAlert('highMemoryUsage', {
                        usage: memory.usedJSHeapSize,
                        limit: memory.jsHeapSizeLimit,
                        usagePercent,
                        severity: 'error'
                    });
                }
            }
        }, 30000); // Check every 30 seconds
    }
    
    /**
     * Send alert to monitoring system
     */
    sendAlert(type, data) {
        // Use API client if available
        if (this.api && typeof this.api.sendPerformanceAlert === 'function') {
            this.api.sendPerformanceAlert(type, data).catch(error => {
                console.error('Failed to send alert via API:', error.message || error);
            });
        } else {
            // Fallback to direct fetch
            fetch('/api/performance/alerts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type,
                    data,
                    timestamp: Date.now(),
                    url: window.location.href,
                    userAgent: navigator.userAgent
                })
            }).catch(error => {
                console.error('Failed to send alert:', error);
            });
        }
        
        // Also emit local event
        window.dispatchEvent(new CustomEvent('performance-alert', {
            detail: { type, data }
        }));
    }
    
    /**
     * Get severity level for Web Vital
     */
    getSeverity(metricName, value, threshold) {
        const ratio = value / threshold;
        
        if (ratio > 2) return 'critical';
        if (ratio > 1.5) return 'error';
        if (ratio > 1) return 'warning';
        return 'info';
    }
    
    /**
     * Update Web Vitals indicator in UI
     */
    updateWebVitalsIndicator(metric) {
        // Find or create Web Vitals indicator
        let indicator = document.getElementById('web-vitals-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'web-vitals-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 10px;
                font-size: 12px;
                z-index: 10000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            document.body.appendChild(indicator);
        }
        
        // Update indicator content
        const summary = this.monitor.getWebVitalsSummary();
        const passing = Object.values(summary).filter(v => v.passed).length;
        const total = Object.keys(summary).length;
        
        indicator.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">Web Vitals</div>
            <div>Score: ${Math.round((passing / total) * 100)}%</div>
            <div style="font-size: 10px; color: #666;">
                ${Object.entries(summary).map(([name, vital]) => 
                    `${name}: ${vital.passed ? '✓' : '✗'}`
                ).join(' ')}
            </div>
        `;
    }
    
    /**
     * Get first paint time
     */
    getFirstPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : null;
    }
    
    /**
     * Get first contentful paint time
     */
    getFirstContentfulPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return firstContentfulPaint ? firstContentfulPaint.startTime : null;
    }
    
    /**
     * Get performance summary
     */
    getPerformanceSummary() {
        return this.monitor ? this.monitor.getMetricsSummary() : null;
    }
    
    /**
     * Get Web Vitals summary
     */
    getWebVitalsSummary() {
        return this.monitor ? this.monitor.getWebVitalsSummary() : null;
    }
    
    /**
     * Check if Web Vitals are passing
     */
    areWebVitalsPassing() {
        return this.monitor ? this.monitor.areWebVitalsPassing() : false;
    }
    
    /**
     * Destroy performance monitoring
     */
    destroy() {
        if (this.monitor) {
            this.monitor.destroy();
            this.monitor = null;
        }
        
        if (this.dashboard) {
            this.dashboard.destroy();
            this.dashboard = null;
        }
        
        this.isInitialized = false;
    }
}

// Create global instance
const performanceIntegration = new PerformanceIntegration();

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    // Initialize with default options
    performanceIntegration.init({
        debug: process.env.NODE_ENV === 'development'
    });
    
    // Make available globally
    window.performanceIntegration = performanceIntegration;
}

// Export for module usage
export default performanceIntegration;