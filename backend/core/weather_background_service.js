/**
 * SommOS Weather Background Processing Service
 * Handles scheduled weather data collection and maintenance
 */

const WeatherIntelligence = require('./weather_intelligence');
const Database = require('../database/connection');
const { getConfig } = require('../config/env');

class WeatherBackgroundService {
    constructor(database, options = {}) {
        this.db = database || Database.getInstance();
        this.config = getConfig();
        
        // Initialize weather intelligence
        this.weatherIntelligence = new WeatherIntelligence(this.db, {
            backgroundProcessing: true,
            maxConcurrentRequests: options.maxConcurrentRequests || 3,
            batchSize: options.batchSize || 5,
            prefetchDelay: options.prefetchDelay || 2000,
            cacheEnabled: true,
            ...options
        });

        // Background job configuration
        this.jobs = new Map();
        this.isRunning = false;
        this.jobStats = {
            totalExecuted: 0,
            successful: 0,
            failed: 0,
            lastExecution: null,
            averageExecutionTime: 0
        };

        // Schedule configuration
        this.schedules = {
            dailyPrefetch: {
                hour: 2, // 2 AM
                minute: 0,
                enabled: true,
                description: 'Daily weather data prefetch for major regions'
            },
            weeklyFullPrefetch: {
                dayOfWeek: 0, // Sunday
                hour: 1, // 1 AM
                minute: 0,
                enabled: true,
                description: 'Weekly full prefetch for all regions'
            },
            cacheCleanup: {
                hour: 3, // 3 AM
                minute: 30,
                enabled: true,
                description: 'Daily cache cleanup and optimization'
            },
            healthCheck: {
                interval: 30 * 60 * 1000, // 30 minutes
                enabled: true,
                description: 'Health check and monitoring'
            }
        };

        // Priority regions for daily prefetch
        this.priorityRegions = [
            'bordeaux', 'burgundy', 'champagne', 'tuscany', 'piedmont', 
            'napa valley', 'rhône', 'rioja', 'sonoma county', 'barossa valley'
        ];

        // Start the service
        this.start();
    }

    /**
     * Start the background service
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Weather background service already running');
            return;
        }

        console.log('🚀 Starting weather background processing service');
        this.isRunning = true;

        // Schedule daily jobs
        this.scheduleDailyJobs();
        
        // Schedule weekly jobs
        this.scheduleWeeklyJobs();
        
        // Schedule interval jobs
        this.scheduleIntervalJobs();

        console.log('✅ Weather background service started');
    }

    /**
     * Stop the background service
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️  Weather background service not running');
            return;
        }

        console.log('🛑 Stopping weather background processing service');
        this.isRunning = false;

        // Clear all scheduled jobs
        this.jobs.forEach(job => {
            if (job.interval) {
                clearInterval(job.interval);
            }
            if (job.timeout) {
                clearTimeout(job.timeout);
            }
        });
        this.jobs.clear();

        // Stop weather intelligence background processing
        this.weatherIntelligence.stopBackgroundProcessing();

        console.log('✅ Weather background service stopped');
    }

    /**
     * Schedule daily jobs
     */
    scheduleDailyJobs() {
        // Daily prefetch job
        if (this.schedules.dailyPrefetch.enabled) {
            this.scheduleJob('dailyPrefetch', () => {
                this.executeDailyPrefetch();
            }, this.schedules.dailyPrefetch);
        }

        // Cache cleanup job
        if (this.schedules.cacheCleanup.enabled) {
            this.scheduleJob('cacheCleanup', () => {
                this.executeCacheCleanup();
            }, this.schedules.cacheCleanup);
        }
    }

    /**
     * Schedule weekly jobs
     */
    scheduleWeeklyJobs() {
        if (this.schedules.weeklyFullPrefetch.enabled) {
            this.scheduleJob('weeklyFullPrefetch', () => {
                this.executeWeeklyFullPrefetch();
            }, this.schedules.weeklyFullPrefetch);
        }
    }

    /**
     * Schedule interval jobs
     */
    scheduleIntervalJobs() {
        // Health check job
        if (this.schedules.healthCheck.enabled) {
            const interval = setInterval(() => {
                this.executeHealthCheck();
            }, this.schedules.healthCheck.interval);
            
            this.jobs.set('healthCheck', {
                interval,
                type: 'interval',
                schedule: this.schedules.healthCheck
            });
        }
    }

    /**
     * Schedule a job
     */
    scheduleJob(jobName, jobFunction, schedule) {
        const now = new Date();
        let nextExecution;

        if (schedule.dayOfWeek !== undefined) {
            // Weekly job
            nextExecution = this.getNextWeeklyExecution(now, schedule.dayOfWeek, schedule.hour, schedule.minute);
        } else {
            // Daily job
            nextExecution = this.getNextDailyExecution(now, schedule.hour, schedule.minute);
        }

        const delay = nextExecution.getTime() - now.getTime();
        
        const timeout = setTimeout(() => {
            this.executeJob(jobName, jobFunction, schedule);
        }, delay);

        this.jobs.set(jobName, {
            timeout,
            type: 'scheduled',
            schedule,
            nextExecution: nextExecution.toISOString()
        });

        console.log(`📅 Scheduled ${jobName}: ${nextExecution.toISOString()}`);
    }

    /**
     * Execute a job
     */
    async executeJob(jobName, jobFunction, schedule) {
        const startTime = Date.now();
        console.log(`🔄 Executing job: ${jobName}`);

        try {
            await jobFunction();
            
            const executionTime = Date.now() - startTime;
            this.updateJobStats(true, executionTime);
            
            console.log(`✅ Job completed: ${jobName} (${executionTime}ms)`);

            // Reschedule if it's a recurring job
            if (schedule.dayOfWeek !== undefined || schedule.hour !== undefined) {
                this.scheduleJob(jobName, jobFunction, schedule);
            }

        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.updateJobStats(false, executionTime);
            
            console.error(`❌ Job failed: ${jobName}`, error.message);
            
            // Reschedule even on failure for recurring jobs
            if (schedule.dayOfWeek !== undefined || schedule.hour !== undefined) {
                this.scheduleJob(jobName, jobFunction, schedule);
            }
        }
    }

    /**
     * Execute daily prefetch job
     */
    async executeDailyPrefetch() {
        console.log('🌤️  Executing daily weather prefetch');
        
        const currentYear = new Date().getFullYear();
        const recentYears = [currentYear, currentYear - 1, currentYear - 2];
        
        const results = await this.weatherIntelligence.prefetchAllRegions({
            regions: this.priorityRegions,
            years: recentYears,
            priority: 1
        });

        console.log(`📊 Daily prefetch results: ${results.successful}/${results.total} regions successful`);
        
        // Log detailed results
        results.details.forEach(detail => {
            if (detail.success) {
                console.log(`  ✅ ${detail.region}: ${detail.message}`);
            } else {
                console.log(`  ❌ ${detail.region}: ${detail.error}`);
            }
        });

        return results;
    }

    /**
     * Execute weekly full prefetch job
     */
    async executeWeeklyFullPrefetch() {
        console.log('🌍 Executing weekly full weather prefetch');
        
        const currentYear = new Date().getFullYear();
        const extendedYears = [];
        
        // Last 10 years
        for (let i = 0; i < 10; i++) {
            extendedYears.push(currentYear - i);
        }

        const results = await this.weatherIntelligence.prefetchAllRegions({
            years: extendedYears,
            priority: 2
        });

        console.log(`📊 Weekly prefetch results: ${results.successful}/${results.total} regions successful`);
        return results;
    }

    /**
     * Execute cache cleanup job
     */
    async executeCacheCleanup() {
        console.log('🧹 Executing cache cleanup');
        
        try {
            // Cleanup weather cache
            await this.weatherIntelligence.weatherCache.cleanup();
            
            // Cleanup old weather analysis cache
            await this.cleanupOldWeatherAnalysis();
            
            // Get cache statistics
            const stats = this.weatherIntelligence.getPrefetchStats();
            
            console.log(`📊 Cache cleanup completed:`);
            console.log(`  - Weather cache entries: ${stats.cache.entries}`);
            console.log(`  - Memory usage: ${Math.round(stats.cache.totalSize / 1024 / 1024)}MB`);
            console.log(`  - Hit rate: ${Math.round(stats.cache.hitRate * 100)}%`);
            
            return stats;
        } catch (error) {
            console.error('❌ Cache cleanup failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute health check job
     */
    async executeHealthCheck() {
        console.log('🏥 Executing health check');
        
        try {
            const stats = this.weatherIntelligence.getPrefetchStats();
            const isHealthy = this.assessHealth(stats);
            
            if (!isHealthy.healthy) {
                console.warn('⚠️  Weather service health issues detected:', isHealthy.issues);
                
                // Attempt to fix common issues
                await this.attemptHealthRecovery(isHealthy.issues);
            } else {
                console.log('✅ Weather service health check passed');
            }
            
            return { healthy: isHealthy.healthy, issues: isHealthy.issues, stats };
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            return { healthy: false, issues: ['Health check execution failed'], error: error.message };
        }
    }

    /**
     * Assess service health
     */
    assessHealth(stats) {
        const issues = [];
        
        // Check cache hit rate
        if (stats.cache.hitRate < 0.3) {
            issues.push('Low cache hit rate');
        }
        
        // Check memory usage
        const memoryUsageMB = stats.cache.totalSize / 1024 / 1024;
        if (memoryUsageMB > 500) { // 500MB threshold
            issues.push('High memory usage');
        }
        
        // Check processing queue
        if (stats.processing.queueSize > 50) {
            issues.push('Large processing queue');
        }
        
        // Check failure rate
        const failureRate = stats.processing.failed / Math.max(stats.processing.totalProcessed, 1);
        if (failureRate > 0.2) { // 20% failure rate threshold
            issues.push('High failure rate');
        }
        
        return {
            healthy: issues.length === 0,
            issues
        };
    }

    /**
     * Attempt to recover from health issues
     */
    async attemptHealthRecovery(issues) {
        console.log('🔧 Attempting health recovery');
        
        for (const issue of issues) {
            try {
                switch (issue) {
                    case 'Low cache hit rate':
                        console.log('  - Clearing old cache entries');
                        await this.weatherIntelligence.weatherCache.cleanup();
                        break;
                        
                    case 'High memory usage':
                        console.log('  - Reducing cache size');
                        await this.weatherIntelligence.weatherCache.evictByMemorySize(100 * 1024 * 1024); // Free 100MB
                        break;
                        
                    case 'Large processing queue':
                        console.log('  - Clearing processing queue');
                        this.weatherIntelligence.clearPrefetchQueue();
                        break;
                        
                    case 'High failure rate':
                        console.log('  - Resetting processing stats');
                        this.weatherIntelligence.processingStats = {
                            totalProcessed: 0,
                            successful: 0,
                            failed: 0,
                            lastProcessed: null,
                            averageProcessingTime: 0
                        };
                        break;
                }
            } catch (error) {
                console.error(`  ❌ Recovery failed for ${issue}:`, error.message);
            }
        }
    }

    /**
     * Cleanup old weather analysis data
     */
    async cleanupOldWeatherAnalysis() {
        try {
            // Remove weather analysis older than 1 year
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            
            const result = await this.db.run(`
                DELETE FROM WeatherVintage 
                WHERE created_at < ?
            `, [oneYearAgo.toISOString()]);
            
            if (result.changes > 0) {
                console.log(`  - Removed ${result.changes} old weather analysis records`);
            }
        } catch (error) {
            console.error('Failed to cleanup old weather analysis:', error.message);
        }
    }

    /**
     * Get next daily execution time
     */
    getNextDailyExecution(now, hour, minute) {
        const next = new Date(now);
        next.setHours(hour, minute, 0, 0);
        
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        
        return next;
    }

    /**
     * Get next weekly execution time
     */
    getNextWeeklyExecution(now, dayOfWeek, hour, minute) {
        const next = new Date(now);
        next.setHours(hour, minute, 0, 0);
        
        // Find next occurrence of the specified day of week
        const daysUntilTarget = (dayOfWeek - next.getDay() + 7) % 7;
        next.setDate(next.getDate() + daysUntilTarget);
        
        if (next <= now) {
            next.setDate(next.getDate() + 7);
        }
        
        return next;
    }

    /**
     * Update job statistics
     */
    updateJobStats(success, executionTime) {
        this.jobStats.totalExecuted++;
        if (success) {
            this.jobStats.successful++;
        } else {
            this.jobStats.failed++;
        }
        this.jobStats.lastExecution = new Date().toISOString();
        
        // Update average execution time
        const totalTime = this.jobStats.averageExecutionTime * (this.jobStats.totalExecuted - 1) + executionTime;
        this.jobStats.averageExecutionTime = totalTime / this.jobStats.totalExecuted;
    }

    /**
     * Get service status
     */
    getStatus() {
        const weatherStats = this.weatherIntelligence.getPrefetchStats();
        
        return {
            running: this.isRunning,
            jobs: {
                scheduled: this.jobs.size,
                stats: this.jobStats
            },
            weather: weatherStats,
            schedules: Object.entries(this.schedules).map(([name, schedule]) => ({
                name,
                enabled: schedule.enabled,
                description: schedule.description,
                nextExecution: this.jobs.get(name)?.nextExecution || null
            }))
        };
    }

    /**
     * Manually trigger a job
     */
    async triggerJob(jobName) {
        if (!this.isRunning) {
            throw new Error('Background service not running');
        }

        const job = this.jobs.get(jobName);
        if (!job) {
            throw new Error(`Job not found: ${jobName}`);
        }

        console.log(`🔧 Manually triggering job: ${jobName}`);
        
        switch (jobName) {
            case 'dailyPrefetch':
                return await this.executeDailyPrefetch();
            case 'weeklyFullPrefetch':
                return await this.executeWeeklyFullPrefetch();
            case 'cacheCleanup':
                return await this.executeCacheCleanup();
            case 'healthCheck':
                return await this.executeHealthCheck();
            default:
                throw new Error(`Unknown job: ${jobName}`);
        }
    }

    /**
     * Update schedule configuration
     */
    updateSchedule(jobName, newSchedule) {
        if (!this.schedules[jobName]) {
            throw new Error(`Unknown schedule: ${jobName}`);
        }

        this.schedules[jobName] = { ...this.schedules[jobName], ...newSchedule };
        
        // Reschedule if job exists
        if (this.jobs.has(jobName)) {
            const job = this.jobs.get(jobName);
            if (job.timeout) {
                clearTimeout(job.timeout);
            }
            this.jobs.delete(jobName);
            
            if (this.schedules[jobName].enabled) {
                this.scheduleJob(jobName, this.getJobFunction(jobName), this.schedules[jobName]);
            }
        }
        
        console.log(`📅 Updated schedule for ${jobName}`);
    }

    /**
     * Get job function by name
     */
    getJobFunction(jobName) {
        switch (jobName) {
            case 'dailyPrefetch':
                return () => this.executeDailyPrefetch();
            case 'weeklyFullPrefetch':
                return () => this.executeWeeklyFullPrefetch();
            case 'cacheCleanup':
                return () => this.executeCacheCleanup();
            case 'healthCheck':
                return () => this.executeHealthCheck();
            default:
                throw new Error(`Unknown job: ${jobName}`);
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stop();
        this.weatherIntelligence.destroy();
        console.log('🧹 Weather background service destroyed');
    }
}

module.exports = WeatherBackgroundService;