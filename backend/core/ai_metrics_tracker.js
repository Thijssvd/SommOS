/**
 * AI Metrics Tracker
 * Monitors AI performance, confidence scores, cache hit rates, and quality metrics
 */

class AIMetricsTracker {
    constructor() {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            responseTimes: [],
            confidenceScores: [],
            errors: [],
            providers: {
                deepseek: { requests: 0, successes: 0, failures: 0, avgResponseTime: 0 },
                openai: { requests: 0, successes: 0, failures: 0, avgResponseTime: 0 },
                traditional: { requests: 0, successes: 0 }
            }
        };
        
        this.thresholds = {
            minConfidence: 0.3,
            maxResponseTime: 5000, // 5 seconds
            maxErrorRate: 0.1 // 10%
        };
        
        this.windowSize = 100; // Keep last 100 metrics
    }

    /**
     * Record AI request start
     */
    startRequest(provider = 'deepseek') {
        this.metrics.totalRequests++;
        this.metrics.providers[provider].requests++;
        
        return {
            provider,
            startTime: Date.now()
        };
    }

    /**
     * Record successful AI response
     */
    recordSuccess(requestContext, recommendations) {
        const responseTime = Date.now() - requestContext.startTime;
        
        this.metrics.successfulRequests++;
        this.metrics.providers[requestContext.provider].successes++;
        
        // Track response time
        this.metrics.responseTimes.push(responseTime);
        if (this.metrics.responseTimes.length > this.windowSize) {
            this.metrics.responseTimes.shift();
        }
        
        // Update provider average response time
        const provider = this.metrics.providers[requestContext.provider];
        provider.avgResponseTime = 
            (provider.avgResponseTime * (provider.successes - 1) + responseTime) / provider.successes;
        
        // Track confidence scores
        if (Array.isArray(recommendations)) {
            recommendations.forEach(rec => {
                if (rec.confidence_score) {
                    this.metrics.confidenceScores.push(rec.confidence_score);
                    if (this.metrics.confidenceScores.length > this.windowSize) {
                        this.metrics.confidenceScores.shift();
                    }
                }
            });
        }
        
        return {
            responseTime,
            success: true
        };
    }

    /**
     * Record failed AI request
     */
    recordFailure(requestContext, error) {
        this.metrics.failedRequests++;
        this.metrics.providers[requestContext.provider].failures++;
        
        // Track error
        this.metrics.errors.push({
            provider: requestContext.provider,
            message: error.message,
            timestamp: Date.now()
        });
        
        // Keep only recent errors
        if (this.metrics.errors.length > this.windowSize) {
            this.metrics.errors.shift();
        }
        
        return {
            success: false,
            error: error.message
        };
    }

    /**
     * Record cache hit
     */
    recordCacheHit() {
        this.metrics.cacheHits++;
    }

    /**
     * Record cache miss
     */
    recordCacheMiss() {
        this.metrics.cacheMisses++;
    }

    /**
     * Get average response time
     */
    getAverageResponseTime() {
        if (this.metrics.responseTimes.length === 0) return 0;
        
        const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.metrics.responseTimes.length);
    }

    /**
     * Calculate percentile from sorted array
     */
    calculatePercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;
        
        const index = (percentile / 100) * (sortedArray.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        
        if (lower === upper) {
            return sortedArray[lower];
        }
        
        return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
    }

    /**
     * Get response time percentiles (p50, p95, p99)
     */
    getResponseTimePercentiles() {
        if (this.metrics.responseTimes.length === 0) {
            return { p50: 0, p95: 0, p99: 0 };
        }
        
        const sorted = [...this.metrics.responseTimes].sort((a, b) => a - b);
        
        return {
            p50: Math.round(this.calculatePercentile(sorted, 50)),
            p95: Math.round(this.calculatePercentile(sorted, 95)),
            p99: Math.round(this.calculatePercentile(sorted, 99))
        };
    }

    /**
     * Get average confidence score
     */
    getAverageConfidence() {
        if (this.metrics.confidenceScores.length === 0) return 0;
        
        const sum = this.metrics.confidenceScores.reduce((a, b) => a + b, 0);
        return sum / this.metrics.confidenceScores.length;
    }

    /**
     * Get success rate
     */
    getSuccessRate() {
        if (this.metrics.totalRequests === 0) return 1;
        return this.metrics.successfulRequests / this.metrics.totalRequests;
    }

    /**
     * Get cache hit rate
     */
    getCacheHitRate() {
        const totalCacheChecks = this.metrics.cacheHits + this.metrics.cacheMisses;
        if (totalCacheChecks === 0) return 0;
        return this.metrics.cacheHits / totalCacheChecks;
    }

    /**
     * Get confidence distribution
     */
    getConfidenceDistribution() {
        if (this.metrics.confidenceScores.length === 0) {
            return { high: 0, medium: 0, low: 0 };
        }
        
        const distribution = { high: 0, medium: 0, low: 0 };
        
        this.metrics.confidenceScores.forEach(score => {
            if (score >= 0.7) distribution.high++;
            else if (score >= 0.4) distribution.medium++;
            else distribution.low++;
        });
        
        const total = this.metrics.confidenceScores.length;
        return {
            high: Math.round((distribution.high / total) * 100),
            medium: Math.round((distribution.medium / total) * 100),
            low: Math.round((distribution.low / total) * 100)
        };
    }

    /**
     * Get performance summary
     */
    getSummary() {
        return {
            requests: {
                total: this.metrics.totalRequests,
                successful: this.metrics.successfulRequests,
                failed: this.metrics.failedRequests,
                success_rate: Math.round(this.getSuccessRate() * 100)
            },
            cache: {
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses,
                hit_rate: Math.round(this.getCacheHitRate() * 100)
            },
            performance: {
                avg_response_time_ms: this.getAverageResponseTime(),
                avg_confidence: Math.round(this.getAverageConfidence() * 100) / 100,
                response_time_percentiles: this.getResponseTimePercentiles()
            },
            confidence_distribution: this.getConfidenceDistribution(),
            providers: {
                deepseek: {
                    requests: this.metrics.providers.deepseek.requests,
                    success_rate: this.metrics.providers.deepseek.requests > 0 ?
                        Math.round((this.metrics.providers.deepseek.successes / 
                                   this.metrics.providers.deepseek.requests) * 100) : 0,
                    avg_response_time_ms: Math.round(this.metrics.providers.deepseek.avgResponseTime)
                },
                openai: {
                    requests: this.metrics.providers.openai.requests,
                    success_rate: this.metrics.providers.openai.requests > 0 ?
                        Math.round((this.metrics.providers.openai.successes / 
                                   this.metrics.providers.openai.requests) * 100) : 0,
                    avg_response_time_ms: Math.round(this.metrics.providers.openai.avgResponseTime)
                },
                traditional: {
                    requests: this.metrics.providers.traditional.requests
                }
            },
            health: this.getHealthStatus()
        };
    }

    /**
     * Get health status based on thresholds
     */
    getHealthStatus() {
        const successRate = this.getSuccessRate();
        const avgResponseTime = this.getAverageResponseTime();
        const avgConfidence = this.getAverageConfidence();
        
        const issues = [];
        
        if (successRate < (1 - this.thresholds.maxErrorRate)) {
            issues.push('High error rate');
        }
        
        if (avgResponseTime > this.thresholds.maxResponseTime) {
            issues.push('Slow response times');
        }
        
        if (avgConfidence < this.thresholds.minConfidence) {
            issues.push('Low confidence scores');
        }
        
        if (issues.length === 0) {
            return { status: 'healthy', issues: [] };
        } else if (issues.length === 1) {
            return { status: 'degraded', issues };
        } else {
            return { status: 'unhealthy', issues };
        }
    }

    /**
     * Get recent errors
     */
    getRecentErrors(count = 10) {
        return this.metrics.errors.slice(-count);
    }

    /**
     * Reset metrics
     */
    reset() {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            responseTimes: [],
            confidenceScores: [],
            errors: [],
            providers: {
                deepseek: { requests: 0, successes: 0, failures: 0, avgResponseTime: 0 },
                openai: { requests: 0, successes: 0, failures: 0, avgResponseTime: 0 },
                traditional: { requests: 0, successes: 0 }
            }
        };
    }

    /**
     * Export metrics to JSON
     */
    export() {
        return {
            timestamp: new Date().toISOString(),
            summary: this.getSummary(),
            raw_metrics: this.metrics
        };
    }
}

// Export singleton instance
module.exports = new AIMetricsTracker();
