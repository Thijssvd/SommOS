/**
 * Enhanced Performance Monitor with Real User Monitoring (RUM)
 * Comprehensive frontend performance tracking and analytics
 */

// Import web-vitals library
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

class PerformanceMonitor {
    constructor(options = {}) {
        this.config = {
            // Core Web Vitals thresholds
            thresholds: {
                LCP: 2500,  // Largest Contentful Paint
                FID: 100,   // First Input Delay
                CLS: 0.1,   // Cumulative Layout Shift
                FCP: 1800,  // First Contentful Paint
                TTFB: 800   // Time to First Byte
            },
            
            // Sampling and reporting
            sampleRate: options.sampleRate || 1.0,
            reportInterval: options.reportInterval || 30000, // 30 seconds
            maxRetries: options.maxRetries || 3,
            
            // Data collection
            enableUserTiming: options.enableUserTiming !== false,
            enableResourceTiming: options.enableResourceTiming !== false,
            enableNavigationTiming: options.enableNavigationTiming !== false,
            enableErrorTracking: options.enableErrorTracking !== false,
            enableCustomMetrics: options.enableCustomMetrics !== false,
            
            // Reporting endpoint
            endpoint: options.endpoint || '/api/performance/rum',
            
            // API client for resilient requests
            api: options.api || null, // SommOSAPI instance
            
            // Debug mode
            debug: options.debug || false
        };
        
        // Data storage
        this.metrics = {
            webVitals: new Map(),
            customMetrics: new Map(),
            userInteractions: [],
            errors: [],
            resources: [],
            navigation: null
        };
        
        // Performance observers
        this.observers = new Map();
        
        // Session data
        this.sessionId = this.generateSessionId();
        this.userId = options.userId || this.generateUserId();
        this.startTime = performance.now();
        
        // Initialize monitoring
        this.init();
    }
    
    /**
     * Initialize performance monitoring
     */
    init() {
        if (this.shouldSample()) {
            this.log('Initializing Performance Monitor');
            
            // Track Core Web Vitals
            this.trackCoreWebVitals();
            
            // Track navigation timing
            if (this.config.enableNavigationTiming) {
                this.trackNavigationTiming();
            }
            
            // Track resource timing
            if (this.config.enableResourceTiming) {
                this.trackResourceTiming();
            }
            
            // Track user interactions
            this.trackUserInteractions();
            
            // Track errors
            if (this.config.enableErrorTracking) {
                this.trackErrors();
            }
            
            // Track custom metrics
            if (this.config.enableCustomMetrics) {
                this.trackCustomMetrics();
            }
            
            // Start periodic reporting
            this.startReporting();
            
            // Track page visibility changes
            this.trackVisibilityChanges();
        }
    }
    
    /**
     * Track Core Web Vitals using the web-vitals library
     */
    trackCoreWebVitals() {
        // Track Largest Contentful Paint (LCP)
        getLCP((metric) => {
            this.recordWebVital('LCP', metric.value, {
                element: metric.element?.tagName,
                url: metric.url,
                size: metric.size,
                id: metric.id,
                delta: metric.delta,
                entries: metric.entries
            });
        });
        
        // Track First Input Delay (FID)
        getFID((metric) => {
            this.recordWebVital('FID', metric.value, {
                eventType: metric.name,
                target: metric.target?.tagName,
                startTime: metric.startTime,
                processingStart: metric.processingStart,
                processingEnd: metric.processingEnd,
                id: metric.id,
                delta: metric.delta,
                entries: metric.entries
            });
        });
        
        // Track Cumulative Layout Shift (CLS)
        getCLS((metric) => {
            this.recordWebVital('CLS', metric.value, {
                id: metric.id,
                delta: metric.delta,
                entries: metric.entries,
                sources: metric.entries.map(entry => ({
                    element: entry.sources?.[0]?.element?.tagName,
                    previousRect: entry.sources?.[0]?.previousRect,
                    currentRect: entry.sources?.[0]?.currentRect
                }))
            });
        });
        
        // Track First Contentful Paint (FCP)
        getFCP((metric) => {
            this.recordWebVital('FCP', metric.value, {
                url: metric.url,
                size: metric.size,
                id: metric.id,
                delta: metric.delta,
                entries: metric.entries
            });
        });
        
        // Track Time to First Byte (TTFB)
        getTTFB((metric) => {
            this.recordWebVital('TTFB', metric.value, {
                id: metric.id,
                delta: metric.delta,
                entries: metric.entries,
                navigationEntry: metric.entries[0]
            });
        });
    }
    
    
    /**
     * Track navigation timing
     */
    trackNavigationTiming() {
        if (!('performance' in window) || !performance.timing) return;
        
        const timing = performance.timing;
        const navigation = {
            timestamp: Date.now(),
            sessionId: this.sessionId,
            userId: this.userId,
            url: window.location.href,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            connection: this.getConnectionInfo(),
            timing: {
                // Navigation timing
                navigationStart: timing.navigationStart,
                unloadEventStart: timing.unloadEventStart,
                unloadEventEnd: timing.unloadEventEnd,
                redirectStart: timing.redirectStart,
                redirectEnd: timing.redirectEnd,
                fetchStart: timing.fetchStart,
                domainLookupStart: timing.domainLookupStart,
                domainLookupEnd: timing.domainLookupEnd,
                connectStart: timing.connectStart,
                connectEnd: timing.connectEnd,
                secureConnectionStart: timing.secureConnectionStart,
                requestStart: timing.requestStart,
                responseStart: timing.responseStart,
                responseEnd: timing.responseEnd,
                domLoading: timing.domLoading,
                domInteractive: timing.domInteractive,
                domContentLoadedEventStart: timing.domContentLoadedEventStart,
                domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
                domComplete: timing.domComplete,
                loadEventStart: timing.loadEventStart,
                loadEventEnd: timing.loadEventEnd
            },
            calculated: {
                dns: timing.domainLookupEnd - timing.domainLookupStart,
                tcp: timing.connectEnd - timing.connectStart,
                ssl: timing.secureConnectionStart > 0 ? timing.connectEnd - timing.secureConnectionStart : 0,
                ttfb: timing.responseStart - timing.navigationStart,
                download: timing.responseEnd - timing.responseStart,
                domProcessing: timing.domComplete - timing.domLoading,
                domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                loadComplete: timing.loadEventEnd - timing.navigationStart
            }
        };
        
        this.metrics.navigation = navigation;
        this.log('Navigation timing recorded:', navigation);
    }
    
    /**
     * Track resource timing
     */
    trackResourceTiming() {
        if (!('PerformanceObserver' in window)) return;
        
        try {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (entry.entryType === 'resource') {
                        this.recordResource(entry);
                    }
                });
            });
            
            observer.observe({ entryTypes: ['resource'] });
            this.observers.set('resources', observer);
        } catch (error) {
            this.log('Resource observer error:', error);
        }
    }
    
    /**
     * Track user interactions
     */
    trackUserInteractions() {
        const interactionTypes = ['click', 'scroll', 'keydown', 'touchstart', 'mousemove'];
        
        interactionTypes.forEach(type => {
            document.addEventListener(type, (event) => {
                this.recordUserInteraction(type, event);
            }, { passive: true });
        });
        
        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.recordUserInteraction('visibilitychange', {
                hidden: document.hidden,
                visibilityState: document.visibilityState
            });
        });
    }
    
    /**
     * Track errors
     */
    trackErrors() {
        // JavaScript errors
        window.addEventListener('error', (event) => {
            this.recordError('javascript', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.recordError('promise', {
                reason: event.reason,
                stack: event.reason?.stack
            });
        });
        
        // Resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.recordError('resource', {
                    tagName: event.target.tagName,
                    src: event.target.src || event.target.href,
                    type: event.target.type
                });
            }
        }, true);
    }
    
    /**
     * Track custom metrics
     */
    trackCustomMetrics() {
        // Track memory usage (if available)
        if ('memory' in performance) {
            setInterval(() => {
                this.recordCustomMetric('memory', {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                });
            }, 10000); // Every 10 seconds
        }
        
        // Track frame rate
        this.trackFrameRate();
        
        // Track long tasks
        this.trackLongTasks();
    }
    
    /**
     * Track frame rate
     */
    trackFrameRate() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const measureFrameRate = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                this.recordCustomMetric('fps', { fps });
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(measureFrameRate);
        };
        
        requestAnimationFrame(measureFrameRate);
    }
    
    /**
     * Track long tasks
     */
    trackLongTasks() {
        if (!('PerformanceObserver' in window)) return;
        
        try {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    this.recordCustomMetric('longTask', {
                        duration: entry.duration,
                        startTime: entry.startTime,
                        name: entry.name
                    });
                });
            });
            
            observer.observe({ entryTypes: ['longtask'] });
            this.observers.set('longTasks', observer);
        } catch (error) {
            this.log('Long task observer error:', error);
        }
    }
    
    /**
     * Track page visibility changes
     */
    trackVisibilityChanges() {
        document.addEventListener('visibilitychange', () => {
            this.recordCustomMetric('visibility', {
                hidden: document.hidden,
                visibilityState: document.visibilityState,
                timestamp: Date.now()
            });
        });
    }
    
    /**
     * Record Web Vital metric
     */
    recordWebVital(name, value, metadata = {}) {
        const metric = {
            name,
            value,
            metadata,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            userId: this.userId,
            url: window.location.href,
            threshold: this.config.thresholds[name],
            passed: value <= this.config.thresholds[name]
        };
        
        this.metrics.webVitals.set(name, metric);
        this.log(`Web Vital ${name}:`, metric);
        
        // Emit custom event for real-time monitoring
        this.emitMetricEvent('webVital', metric);
    }
    
    /**
     * Record custom metric
     */
    recordCustomMetric(name, data) {
        const metric = {
            name,
            data,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            userId: this.userId,
            url: window.location.href
        };
        
        this.metrics.customMetrics.set(name, metric);
        this.log(`Custom metric ${name}:`, metric);
        
        // Emit custom event for real-time monitoring
        this.emitMetricEvent('custom', metric);
    }
    
    /**
     * Record user interaction
     */
    recordUserInteraction(type, event) {
        const interaction = {
            type,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            userId: this.userId,
            url: window.location.href,
            data: {
                target: event.target?.tagName,
                x: event.clientX,
                y: event.clientY,
                key: event.key,
                code: event.code,
                button: event.button,
                touches: event.touches?.length
            }
        };
        
        this.metrics.userInteractions.push(interaction);
        
        // Keep only last 100 interactions
        if (this.metrics.userInteractions.length > 100) {
            this.metrics.userInteractions.shift();
        }
        
        this.log(`User interaction ${type}:`, interaction);
    }
    
    /**
     * Record error
     */
    recordError(type, data) {
        const error = {
            type,
            data,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            userId: this.userId,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.metrics.errors.push(error);
        
        // Keep only last 50 errors
        if (this.metrics.errors.length > 50) {
            this.metrics.errors.shift();
        }
        
        this.log(`Error ${type}:`, error);
        
        // Emit custom event for real-time monitoring
        this.emitMetricEvent('error', error);
    }
    
    /**
     * Record resource
     */
    recordResource(entry) {
        const resource = {
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration,
            initiatorType: entry.initiatorType,
            transferSize: entry.transferSize,
            encodedBodySize: entry.encodedBodySize,
            decodedBodySize: entry.decodedBodySize,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            userId: this.userId,
            url: window.location.href
        };
        
        this.metrics.resources.push(resource);
        
        // Keep only last 200 resources
        if (this.metrics.resources.length > 200) {
            this.metrics.resources.shift();
        }
        
        this.log('Resource loaded:', resource);
    }
    
    /**
     * Start periodic reporting
     */
    startReporting() {
        setInterval(() => {
            this.reportMetrics();
        }, this.config.reportInterval);
        
        // Report on page unload
        window.addEventListener('beforeunload', () => {
            this.reportMetrics(true);
        });
    }
    
    /**
     * Report metrics to server
     */
    async reportMetrics(isUnload = false) {
        try {
            const payload = {
                sessionId: this.sessionId,
                userId: this.userId,
                timestamp: Date.now(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                connection: this.getConnectionInfo(),
                metrics: {
                    webVitals: Array.from(this.metrics.webVitals.values()),
                    customMetrics: Array.from(this.metrics.customMetrics.values()),
                    userInteractions: this.metrics.userInteractions,
                    errors: this.metrics.errors,
                    resources: this.metrics.resources,
                    navigation: this.metrics.navigation
                },
                isUnload
            };
            
            // Use sendBeacon for unload events
            if (isUnload && 'sendBeacon' in navigator) {
                navigator.sendBeacon(
                    this.config.endpoint,
                    JSON.stringify(payload)
                );
                this.log('Metrics sent via sendBeacon');
                return;
            }
            
            // Use API client if available, otherwise fall back to fetch
            if (this.config.api && typeof this.config.api.reportPerformanceMetrics === 'function') {
                try {
                    await this.config.api.reportPerformanceMetrics(payload, false);
                    this.log('Metrics reported successfully via API client');
                } catch (apiError) {
                    // SommOSAPIError or other error - log but don't block
                    this.log('API client metrics reporting failed (non-critical):', apiError.message || apiError);
                }
            } else {
                // Fallback to direct fetch if API client not available
                await fetch(this.config.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                this.log('Metrics reported successfully via fetch');
            }
        } catch (error) {
            // Log error but don't throw - performance monitoring should not break the app
            this.log('Failed to report metrics (non-critical):', error.message || error);
        }
    }
    
    /**
     * Get connection information
     */
    getConnectionInfo() {
        if ('connection' in navigator) {
            const conn = navigator.connection;
            return {
                effectiveType: conn.effectiveType,
                downlink: conn.downlink,
                rtt: conn.rtt,
                saveData: conn.saveData
            };
        }
        return null;
    }
    
    /**
     * Check if should sample this session
     */
    shouldSample() {
        return Math.random() < this.config.sampleRate;
    }
    
    /**
     * Generate session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Generate user ID
     */
    generateUserId() {
        let userId = localStorage.getItem('rum_user_id');
        if (!userId) {
            userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('rum_user_id', userId);
        }
        return userId;
    }
    
    /**
     * Emit metric event for real-time monitoring
     */
    emitMetricEvent(type, data) {
        const event = new CustomEvent('rum-metric', {
            detail: { type, data }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * Get current metrics summary
     */
    getMetricsSummary() {
        return {
            sessionId: this.sessionId,
            userId: this.userId,
            startTime: this.startTime,
            currentTime: performance.now(),
            webVitals: Object.fromEntries(this.metrics.webVitals),
            customMetrics: Object.fromEntries(this.metrics.customMetrics),
            interactionCount: this.metrics.userInteractions.length,
            errorCount: this.metrics.errors.length,
            resourceCount: this.metrics.resources.length,
            hasNavigation: !!this.metrics.navigation
        };
    }
    
    /**
     * Get Web Vitals summary
     */
    getWebVitalsSummary() {
        const summary = {};
        for (const [name, metric] of this.metrics.webVitals) {
            summary[name] = {
                value: metric.value,
                passed: metric.passed,
                threshold: metric.threshold,
                timestamp: metric.timestamp
            };
        }
        return summary;
    }
    
    /**
     * Check if Web Vitals are passing
     */
    areWebVitalsPassing() {
        const vitals = this.getWebVitalsSummary();
        return Object.values(vitals).every(vital => vital.passed);
    }
    
    /**
     * Log message (if debug mode enabled)
     */
    log(...args) {
        if (this.config.debug) {
            console.log('[PerformanceMonitor]', ...args);
        }
    }
    
    /**
     * Cleanup observers
     */
    destroy() {
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers.clear();
        
        // Report final metrics
        this.reportMetrics(true);
    }
}

// Export for use in modules
export default PerformanceMonitor;

// Also make available globally for non-module usage
if (typeof window !== 'undefined') {
    window.PerformanceMonitor = PerformanceMonitor;
}