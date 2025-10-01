/**
 * SommOS Weather Intelligence Service
 * Enhanced weather data prefetching and background processing for wine regions
 */

const WeatherAnalysisService = require('./weather_analysis');
const OpenMeteoService = require('./open_meteo_service');
const Database = require('../database/connection');
const { AIResponseCache } = require('./ai_response_cache');

class WeatherIntelligence {
    constructor(database, options = {}) {
        this.db = database || Database.getInstance();
        this.weatherAnalysis = new WeatherAnalysisService(this.db);
        this.openMeteo = new OpenMeteoService();
        
        // Configuration
        this.config = {
            maxConcurrentRequests: options.maxConcurrentRequests || 5,
            batchSize: options.batchSize || 10,
            prefetchDelay: options.prefetchDelay || 1000, // 1 second between batches
            cacheEnabled: options.cacheEnabled !== false,
            backgroundProcessing: options.backgroundProcessing !== false,
            ...options
        };

        // Cache for weather data
        this.weatherCache = new AIResponseCache({
            maxSize: options.cacheMaxSize || 2000,
            maxMemorySize: options.cacheMaxMemory || 200 * 1024 * 1024, // 200MB
            defaultTtl: options.cacheDefaultTtl || 7 * 24 * 60 * 60 * 1000, // 7 days
            strategy: options.cacheStrategy || 'hybrid',
            prefix: 'weather_intelligence'
        });

        // Background processing state
        this.prefetchQueue = new Set();
        this.processingQueue = new Map();
        this.isProcessing = false;
        this.processingStats = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            lastProcessed: null,
            averageProcessingTime: 0
        };

        // Wine regions and vintage years
        this.majorWineRegions = this.initializeWineRegions();
        this.recentVintageYears = this.getRecentVintageYears();
        
        // Start background processing if enabled
        if (this.config.backgroundProcessing) {
            this.startBackgroundProcessing();
        }
    }

    /**
     * Initialize major wine regions with priority levels
     */
    initializeWineRegions() {
        return {
            // Tier 1: Premium regions (highest priority)
            'bordeaux': { priority: 1, coordinates: { latitude: 44.8378, longitude: -0.5792 } },
            'burgundy': { priority: 1, coordinates: { latitude: 47.0379, longitude: 4.8656 } },
            'champagne': { priority: 1, coordinates: { latitude: 49.0421, longitude: 4.0142 } },
            'tuscany': { priority: 1, coordinates: { latitude: 43.4637, longitude: 11.8796 } },
            'piedmont': { priority: 1, coordinates: { latitude: 44.7644, longitude: 7.7400 } },
            'napa valley': { priority: 1, coordinates: { latitude: 38.5025, longitude: -122.2654 } },
            
            // Tier 2: Important regions
            'rhône': { priority: 2, coordinates: { latitude: 44.1869, longitude: 4.8088 } },
            'rioja': { priority: 2, coordinates: { latitude: 42.4627, longitude: -2.4496 } },
            'sonoma county': { priority: 2, coordinates: { latitude: 38.5780, longitude: -122.8735 } },
            'barossa valley': { priority: 2, coordinates: { latitude: -34.5598, longitude: 138.9156 } },
            'marlborough': { priority: 2, coordinates: { latitude: -41.5122, longitude: 173.9554 } },
            
            // Tier 3: Regional specialties
            'loire': { priority: 3, coordinates: { latitude: 47.2184, longitude: 0.0792 } },
            'alsace': { priority: 3, coordinates: { latitude: 48.2737, longitude: 7.4281 } },
            'mosel': { priority: 3, coordinates: { latitude: 49.8803, longitude: 6.7355 } },
            'douro': { priority: 3, coordinates: { latitude: 41.2033, longitude: -7.6500 } },
            'willamette valley': { priority: 3, coordinates: { latitude: 45.3311, longitude: -123.1351 } },
            'hunter valley': { priority: 3, coordinates: { latitude: -32.8820, longitude: 151.2916 } },
            'central otago': { priority: 3, coordinates: { latitude: -45.0302, longitude: 169.1645 } }
        };
    }

    /**
     * Get recent vintage years for prefetching
     */
    getRecentVintageYears() {
        const currentYear = new Date().getFullYear();
        const years = [];
        
        // Last 10 years + current year
        for (let i = 0; i <= 10; i++) {
            years.push(currentYear - i);
        }
        
        // Add some notable vintages
        const notableVintages = [2015, 2016, 2018, 2019, 2020, 2021];
        notableVintages.forEach(year => {
            if (!years.includes(year)) {
                years.push(year);
            }
        });
        
        return years.sort((a, b) => b - a); // Most recent first
    }

    /**
     * Prefetch weather data for a specific region
     */
    async prefetchRegionData(region, options = {}) {
        const regionKey = region.toLowerCase().trim();
        const regionInfo = this.majorWineRegions[regionKey];
        
        if (!regionInfo) {
            console.warn(`Unknown wine region: ${region}`);
            return { success: false, error: 'Unknown region' };
        }

        const years = options.years || this.recentVintageYears;
        const priority = options.priority || regionInfo.priority;
        const forceRefresh = options.forceRefresh || false;
        
        console.log(`🌤️  Prefetching weather data for ${region} (${years.length} vintages, priority ${priority})`);

        // Add to prefetch queue
        const prefetchKey = `${regionKey}:${years.join(',')}`;
        if (this.prefetchQueue.has(prefetchKey) && !forceRefresh) {
            console.log(`⏳ Prefetch already queued for ${region}`);
            return { success: true, message: 'Already queued' };
        }

        this.prefetchQueue.add(prefetchKey);

        try {
            // Process in background if not forced
            if (!forceRefresh && this.config.backgroundProcessing) {
                this.schedulePrefetch(region, years, priority);
                return { success: true, message: 'Scheduled for background processing' };
            }

            // Process immediately
            const results = await this.processRegionPrefetch(region, years, priority, forceRefresh);
            this.prefetchQueue.delete(prefetchKey);
            
            return {
                success: true,
                processed: results.processed,
                cached: results.cached,
                failed: results.failed,
                errors: results.errors,
                processingTime: results.processingTime
            };

        } catch (error) {
            this.prefetchQueue.delete(prefetchKey);
            console.error(`❌ Prefetch failed for ${region}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Schedule prefetch for background processing
     */
    schedulePrefetch(region, years, priority) {
        const prefetchTask = {
            region,
            years,
            priority,
            scheduledAt: Date.now(),
            attempts: 0,
            maxAttempts: 3
        };

        this.processingQueue.set(`${region}:${years.join(',')}`, prefetchTask);
        
        // Trigger background processing if not already running
        if (!this.isProcessing) {
            setImmediate(() => this.processBackgroundQueue());
        }
    }

    /**
     * Process region prefetch
     */
    async processRegionPrefetch(region, years, priority, forceRefresh = false) {
        const startTime = Date.now();
        const results = {
            processed: 0,
            cached: 0,
            failed: 0,
            errors: []
        };

        // Process years in batches to avoid overwhelming the API
        const batches = this.createBatches(years, this.config.batchSize);
        
        for (const batch of batches) {
            const promises = batch.map(year => 
                this.prefetchYearData(region, year, forceRefresh)
                    .then(result => {
                        results.processed++;
                        if (result.cached) results.cached++;
                        if (result.error) {
                            results.failed++;
                            results.errors.push(`${year}: ${result.error}`);
                        }
                        return result;
                    })
                    .catch(error => {
                        results.failed++;
                        results.errors.push(`${year}: ${error.message}`);
                        return { error: error.message };
                    })
            );

            await Promise.allSettled(promises);
            
            // Delay between batches to respect rate limits
            if (batches.indexOf(batch) < batches.length - 1) {
                await this.delay(this.config.prefetchDelay);
            }
        }

        const processingTime = Date.now() - startTime;
        results.processingTime = processingTime;

        console.log(`✅ Prefetch completed for ${region}: ${results.cached} cached, ${results.failed} failed (${processingTime}ms)`);
        
        return results;
    }

    /**
     * Prefetch weather data for a specific year
     */
    async prefetchYearData(region, year, forceRefresh = false) {
        const cacheKey = this.weatherCache.generateCacheKey(region, { year });
        
        // Check cache first
        if (!forceRefresh) {
            const cached = await this.weatherCache.get(cacheKey);
            if (cached) {
                return { cached: true, year, region };
            }
        }

        try {
            // Get weather data from Open-Meteo
            const weatherData = await this.openMeteo.getVintageWeatherData(region, year, {
                forceRefresh,
                cacheTtlMs: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            if (weatherData) {
                // Cache the result
                await this.weatherCache.set(cacheKey, weatherData, 7 * 24 * 60 * 60 * 1000);
                
                // Also cache in weather analysis service
                await this.weatherAnalysis.cacheWeatherAnalysis(weatherData);
                
                return { cached: false, year, region, data: weatherData };
            } else {
                return { error: 'No weather data available', year, region };
            }

        } catch (error) {
            console.warn(`Failed to prefetch ${region} ${year}:`, error.message);
            return { error: error.message, year, region };
        }
    }

    /**
     * Background processing queue
     */
    async processBackgroundQueue() {
        if (this.isProcessing || this.processingQueue.size === 0) {
            return;
        }

        this.isProcessing = true;
        console.log(`🔄 Processing background weather prefetch queue (${this.processingQueue.size} tasks)`);

        try {
            // Sort by priority and schedule time
            const sortedTasks = Array.from(this.processingQueue.values())
                .sort((a, b) => {
                    if (a.priority !== b.priority) {
                        return a.priority - b.priority; // Lower number = higher priority
                    }
                    return a.scheduledAt - b.scheduledAt; // Earlier scheduled first
                });

            // Process tasks with concurrency limit
            const concurrentLimit = this.config.maxConcurrentRequests;
            const chunks = this.createBatches(sortedTasks, concurrentLimit);

            for (const chunk of chunks) {
                const promises = chunk.map(task => this.processBackgroundTask(task));
                await Promise.allSettled(promises);
                
                // Delay between chunks
                if (chunks.indexOf(chunk) < chunks.length - 1) {
                    await this.delay(this.config.prefetchDelay * 2);
                }
            }

        } catch (error) {
            console.error('Background processing error:', error.message);
        } finally {
            this.isProcessing = false;
            
            // Schedule next processing cycle if there are more tasks
            if (this.processingQueue.size > 0) {
                setTimeout(() => this.processBackgroundQueue(), 5000);
            }
        }
    }

    /**
     * Process individual background task
     */
    async processBackgroundTask(task) {
        const taskKey = `${task.region}:${task.years.join(',')}`;
        const startTime = Date.now();

        try {
            task.attempts++;
            
            const results = await this.processRegionPrefetch(
                task.region, 
                task.years, 
                task.priority, 
                false
            );

            // Update processing stats
            this.updateProcessingStats(results, Date.now() - startTime);
            
            // Remove from queue on success
            this.processingQueue.delete(taskKey);
            
            console.log(`✅ Background task completed: ${task.region} (${results.cached} cached)`);

        } catch (error) {
            console.error(`❌ Background task failed: ${task.region}`, error.message);
            
            // Retry or remove from queue
            if (task.attempts >= task.maxAttempts) {
                this.processingQueue.delete(taskKey);
                console.log(`🚫 Task removed after ${task.maxAttempts} attempts: ${task.region}`);
            }
        }
    }

    /**
     * Start background processing
     */
    startBackgroundProcessing() {
        console.log('🚀 Starting weather intelligence background processing');
        
        // Process queue every 30 seconds
        this.backgroundInterval = setInterval(() => {
            if (this.processingQueue.size > 0) {
                this.processBackgroundQueue();
            }
        }, 30000);

        // Cleanup expired cache entries every hour
        this.cacheCleanupInterval = setInterval(() => {
            this.weatherCache.cleanup();
        }, 60 * 60 * 1000);
    }

    /**
     * Stop background processing
     */
    stopBackgroundProcessing() {
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
            this.backgroundInterval = null;
        }
        
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
            this.cacheCleanupInterval = null;
        }
        
        console.log('🛑 Weather intelligence background processing stopped');
    }

    /**
     * Prefetch all major wine regions
     */
    async prefetchAllRegions(options = {}) {
        const regions = Object.keys(this.majorWineRegions);
        const years = options.years || this.recentVintageYears.slice(0, 5); // Last 5 years
        const priority = options.priority || 1;
        
        console.log(`🌍 Prefetching weather data for ${regions.length} major wine regions`);

        const results = {
            total: regions.length,
            successful: 0,
            failed: 0,
            details: []
        };

        // Process regions in batches
        const batches = this.createBatches(regions, this.config.maxConcurrentRequests);
        
        for (const batch of batches) {
            const promises = batch.map(region => 
                this.prefetchRegionData(region, { years, priority })
                    .then(result => {
                        if (result.success) {
                            results.successful++;
                        } else {
                            results.failed++;
                        }
                        results.details.push({ region, ...result });
                        return result;
                    })
            );

            await Promise.allSettled(promises);
            
            // Delay between batches
            if (batches.indexOf(batch) < batches.length - 1) {
                await this.delay(this.config.prefetchDelay * 3);
            }
        }

        console.log(`✅ Prefetch completed: ${results.successful}/${results.total} regions successful`);
        return results;
    }

    /**
     * Get weather data with intelligent prefetching
     */
    async getWeatherData(region, year, options = {}) {
        const cacheKey = this.weatherCache.generateCacheKey(region, { year });
        
        // Check cache first
        const cached = await this.weatherCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // If not cached, trigger prefetch for related data
        if (this.config.backgroundProcessing && !options.skipPrefetch) {
            this.scheduleRelatedPrefetch(region, year);
        }

        // Get data immediately
        try {
            const weatherData = await this.weatherAnalysis.analyzeVintage(region, year);
            
            // Cache the result
            if (weatherData) {
                await this.weatherCache.set(cacheKey, weatherData, 7 * 24 * 60 * 60 * 1000);
            }
            
            return weatherData;
        } catch (error) {
            console.error(`Failed to get weather data for ${region} ${year}:`, error.message);
            throw error;
        }
    }

    /**
     * Schedule prefetch for related data
     */
    scheduleRelatedPrefetch(region, year) {
        const regionKey = region.toLowerCase().trim();
        const regionInfo = this.majorWineRegions[regionKey];
        
        if (!regionInfo) return;

        // Prefetch nearby years
        const nearbyYears = [year - 1, year + 1].filter(y => y > 2000 && y <= new Date().getFullYear());
        
        if (nearbyYears.length > 0) {
            this.schedulePrefetch(region, nearbyYears, regionInfo.priority + 1);
        }

        // Prefetch same year for nearby regions (same priority tier)
        const sameTierRegions = Object.entries(this.majorWineRegions)
            .filter(([name, info]) => info.priority === regionInfo.priority && name !== regionKey)
            .map(([name]) => name)
            .slice(0, 3); // Limit to 3 nearby regions

        if (sameTierRegions.length > 0) {
            sameTierRegions.forEach(nearbyRegion => {
                this.schedulePrefetch(nearbyRegion, [year], regionInfo.priority + 2);
            });
        }
    }

    /**
     * Get prefetch statistics
     */
    getPrefetchStats() {
        const cacheStats = this.weatherCache.getStats();
        
        return {
            cache: cacheStats,
            processing: {
                ...this.processingStats,
                queueSize: this.processingQueue.size,
                isProcessing: this.isProcessing
            },
            regions: {
                total: Object.keys(this.majorWineRegions).length,
                queued: this.prefetchQueue.size
            },
            years: {
                recent: this.recentVintageYears.length,
                range: {
                    oldest: Math.min(...this.recentVintageYears),
                    newest: Math.max(...this.recentVintageYears)
                }
            }
        };
    }

    /**
     * Clear prefetch queue
     */
    clearPrefetchQueue() {
        this.prefetchQueue.clear();
        this.processingQueue.clear();
        console.log('🧹 Prefetch queue cleared');
    }

    /**
     * Update processing statistics
     */
    updateProcessingStats(results, processingTime) {
        this.processingStats.totalProcessed += results.processed;
        this.processingStats.successful += results.cached;
        this.processingStats.failed += results.failed;
        this.processingStats.lastProcessed = new Date().toISOString();
        
        // Update average processing time
        const totalTime = this.processingStats.averageProcessingTime * (this.processingStats.totalProcessed - results.processed) + processingTime;
        this.processingStats.averageProcessingTime = totalTime / this.processingStats.totalProcessed;
    }

    /**
     * Create batches from array
     */
    createBatches(array, batchSize) {
        const batches = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stopBackgroundProcessing();
        this.weatherCache.destroy();
        console.log('🧹 Weather intelligence service destroyed');
    }
}

module.exports = WeatherIntelligence;