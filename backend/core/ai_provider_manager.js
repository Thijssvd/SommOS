/**
 * AI Provider Manager
 * Manages multiple AI providers with automatic fallback
 */

const OpenAI = require('openai');
const { getConfig } = require('../config/env');
const aiMetricsTracker = require('./ai_metrics_tracker');

class AIProviderManager {
    constructor() {
        this.providers = new Map();
        this.fallbackChain = [];
        this.config = getConfig();
        this.initialized = false;
        
        this.providerStats = {
            deepseek: { calls: 0, failures: 0, lastFailure: null },
            openai: { calls: 0, failures: 0, lastFailure: null }
        };
        
        // Thresholds for fallback
        this.thresholds = {
            maxTimeout: 10000, // 10 seconds
            maxConsecutiveFailures: 3,
            failureRateThreshold: 0.5, // 50% failure rate triggers fallback
            cooldownPeriod: 60000 // 1 minute cooldown after failures
        };
    }

    /**
     * Initialize AI providers
     */
    initialize() {
        if (this.initialized) {
            return;
        }

        // Initialize DeepSeek (primary)
        if (this.config.deepSeek && this.config.deepSeek.apiKey) {
            try {
                this.providers.set('deepseek', new OpenAI({
                    apiKey: this.config.deepSeek.apiKey,
                    baseURL: 'https://api.deepseek.com/v1',
                    timeout: this.thresholds.maxTimeout
                }));
                this.fallbackChain.push('deepseek');
                console.log('✅ DeepSeek provider initialized (primary)');
            } catch (error) {
                console.error('Failed to initialize DeepSeek provider:', error.message);
            }
        }

        // Initialize OpenAI (fallback)
        if (this.config.openai && this.config.openai.apiKey) {
            try {
                this.providers.set('openai', new OpenAI({
                    apiKey: this.config.openai.apiKey,
                    timeout: this.thresholds.maxTimeout
                }));
                this.fallbackChain.push('openai');
                console.log('✅ OpenAI provider initialized (fallback)');
            } catch (error) {
                console.error('Failed to initialize OpenAI provider:', error.message);
            }
        }

        this.initialized = true;
        console.log(`🔄 AI Provider fallback chain: ${this.fallbackChain.join(' -> ')}`);
    }

    /**
     * Check if a provider is available
     */
    isProviderAvailable(providerName) {
        if (!this.providers.has(providerName)) {
            return false;
        }

        const stats = this.providerStats[providerName];
        if (!stats) {
            return true;
        }

        // Check if in cooldown period
        if (stats.lastFailure) {
            const timeSinceFailure = Date.now() - stats.lastFailure;
            if (timeSinceFailure < this.thresholds.cooldownPeriod) {
                return false;
            }
        }

        // Check failure rate
        if (stats.calls > 10) {
            const failureRate = stats.failures / stats.calls;
            if (failureRate > this.thresholds.failureRateThreshold) {
                return false;
            }
        }

        return true;
    }

    /**
     * Record provider success
     */
    recordSuccess(providerName) {
        if (this.providerStats[providerName]) {
            this.providerStats[providerName].calls++;
            // Reset consecutive failures on success
            this.providerStats[providerName].consecutiveFailures = 0;
        }
    }

    /**
     * Record provider failure
     */
    recordFailure(providerName, error) {
        if (this.providerStats[providerName]) {
            this.providerStats[providerName].calls++;
            this.providerStats[providerName].failures++;
            this.providerStats[providerName].lastFailure = Date.now();
            this.providerStats[providerName].consecutiveFailures = 
                (this.providerStats[providerName].consecutiveFailures || 0) + 1;
        }
        
        console.warn(`⚠️  ${providerName} provider failure:`, error.message);
    }

    /**
     * Generate completion with automatic fallback
     */
    async generateCompletion(options) {
        if (!this.initialized) {
            this.initialize();
        }

        if (this.providers.size === 0) {
            throw new Error('No AI providers available');
        }

        const errors = [];
        
        // Try each provider in the fallback chain
        for (const providerName of this.fallbackChain) {
            if (!this.isProviderAvailable(providerName)) {
                console.log(`⏭️  Skipping ${providerName} (unavailable)`);
                continue;
            }

            const provider = this.providers.get(providerName);
            const requestContext = aiMetricsTracker.startRequest(providerName);

            try {
                console.log(`🤖 Attempting completion with ${providerName}...`);
                
                const startTime = Date.now();
                const response = await provider.chat.completions.create({
                    model: this.getModelForProvider(providerName),
                    messages: options.messages,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.max_tokens || 2000,
                    ...options.additionalParams
                });
                
                const responseTime = Date.now() - startTime;
                
                // Record success
                this.recordSuccess(providerName);
                aiMetricsTracker.recordSuccess(requestContext, [{ 
                    confidence_score: this.extractConfidence(response) 
                }]);
                
                console.log(`✅ ${providerName} completed successfully in ${responseTime}ms`);
                
                return {
                    provider: providerName,
                    response,
                    responseTime,
                    isFallback: this.fallbackChain.indexOf(providerName) > 0
                };
                
            } catch (error) {
                const errorMessage = error.message || 'Unknown error';
                errors.push({ provider: providerName, error: errorMessage });
                
                this.recordFailure(providerName, error);
                aiMetricsTracker.recordFailure(requestContext, error);
                
                console.error(`❌ ${providerName} failed:`, errorMessage);
                
                // If this is not the last provider, try the next one
                if (this.fallbackChain.indexOf(providerName) < this.fallbackChain.length - 1) {
                    console.log(`🔄 Falling back to next provider...`);
                    continue;
                }
            }
        }

        // All providers failed
        const errorSummary = errors.map(e => `${e.provider}: ${e.error}`).join('; ');
        throw new Error(`All AI providers failed: ${errorSummary}`);
    }

    /**
     * Get the appropriate model for each provider
     */
    getModelForProvider(providerName) {
        const models = {
            deepseek: 'deepseek-chat',
            openai: 'gpt-4-turbo-preview'
        };
        
        return models[providerName] || models.openai;
    }

    /**
     * Extract confidence score from response (heuristic)
     */
    extractConfidence(response) {
        // Try to extract confidence from response content
        try {
            const content = response.choices[0]?.message?.content || '';
            
            // Look for confidence patterns in the response
            const confidenceMatch = content.match(/confidence[:\s]+(\d+\.?\d*)%?/i);
            if (confidenceMatch) {
                return parseFloat(confidenceMatch[1]) / 100;
            }
            
            // Default to moderate confidence if not explicitly stated
            return 0.7;
        } catch (error) {
            return 0.5;
        }
    }

    /**
     * Get provider statistics
     */
    getStats() {
        return {
            providers: Object.keys(this.providerStats).map(name => ({
                name,
                available: this.isProviderAvailable(name),
                stats: this.providerStats[name]
            })),
            fallbackChain: this.fallbackChain,
            initialized: this.initialized
        };
    }

    /**
     * Reset provider stats
     */
    resetStats(providerName = null) {
        if (providerName) {
            if (this.providerStats[providerName]) {
                this.providerStats[providerName] = {
                    calls: 0,
                    failures: 0,
                    lastFailure: null,
                    consecutiveFailures: 0
                };
            }
        } else {
            // Reset all
            for (const name of Object.keys(this.providerStats)) {
                this.providerStats[name] = {
                    calls: 0,
                    failures: 0,
                    lastFailure: null,
                    consecutiveFailures: 0
                };
            }
        }
    }

    /**
     * Force use of specific provider (for testing)
     */
    forceProvider(providerName) {
        if (!this.providers.has(providerName)) {
            throw new Error(`Provider ${providerName} not available`);
        }
        
        this.fallbackChain = [providerName];
        console.log(`🔒 Forced provider: ${providerName}`);
    }

    /**
     * Restore default fallback chain
     */
    restoreDefaultFallback() {
        this.fallbackChain = [];
        
        if (this.providers.has('deepseek')) {
            this.fallbackChain.push('deepseek');
        }
        if (this.providers.has('openai')) {
            this.fallbackChain.push('openai');
        }
        
        console.log(`🔄 Restored fallback chain: ${this.fallbackChain.join(' -> ')}`);
    }
}

// Export singleton instance
module.exports = new AIProviderManager();
