/**
 * SommOS Weather Intelligence API Routes
 * Provides endpoints for managing weather data prefetching and background processing
 */

const express = require('express');
const router = express.Router();

// Middleware to get weather intelligence instance
const getWeatherIntelligence = (req, res, next) => {
    if (!req.app.locals.weatherIntelligence) {
        return res.status(503).json({
            success: false,
            error: {
                message: 'Weather intelligence service not available',
                code: 'SERVICE_UNAVAILABLE'
            }
        });
    }
    req.weatherIntelligence = req.app.locals.weatherIntelligence;
    next();
};

// Middleware to get weather background service instance
const getWeatherBackgroundService = (req, res, next) => {
    if (!req.app.locals.weatherBackgroundService) {
        return res.status(503).json({
            success: false,
            error: {
                message: 'Weather background service not available',
                code: 'SERVICE_UNAVAILABLE'
            }
        });
    }
    req.weatherBackgroundService = req.app.locals.weatherBackgroundService;
    next();
};

/**
 * GET /api/weather/regions
 * Get available wine regions for weather prefetching
 */
router.get('/regions', getWeatherIntelligence, (req, res) => {
    try {
        const regions = Object.entries(req.weatherIntelligence.majorWineRegions)
            .map(([name, info]) => ({
                name,
                priority: info.priority,
                coordinates: info.coordinates
            }))
            .sort((a, b) => a.priority - b.priority);

        res.json({
            success: true,
            data: {
                regions,
                total: regions.length,
                priorityTiers: {
                    tier1: regions.filter(r => r.priority === 1).length,
                    tier2: regions.filter(r => r.priority === 2).length,
                    tier3: regions.filter(r => r.priority === 3).length
                }
            }
        });
    } catch (error) {
        console.error('Error getting wine regions:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get wine regions',
                code: 'REGIONS_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/weather/years
 * Get available vintage years for prefetching
 */
router.get('/years', getWeatherIntelligence, (req, res) => {
    try {
        const years = req.weatherIntelligence.recentVintageYears;
        
        res.json({
            success: true,
            data: {
                years,
                total: years.length,
                range: {
                    oldest: Math.min(...years),
                    newest: Math.max(...years)
                }
            }
        });
    } catch (error) {
        console.error('Error getting vintage years:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get vintage years',
                code: 'YEARS_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/weather/prefetch/region
 * Prefetch weather data for a specific region
 */
router.post('/prefetch/region', getWeatherIntelligence, async (req, res) => {
    try {
        const { region, years, priority, forceRefresh } = req.body;
        
        if (!region) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Region is required',
                    code: 'MISSING_REGION'
                }
            });
        }

        const result = await req.weatherIntelligence.prefetchRegionData(region, {
            years,
            priority,
            forceRefresh: forceRefresh || false
        });

        res.json({
            success: result.success,
            data: result,
            message: result.success ? 'Prefetch completed successfully' : 'Prefetch failed'
        });
    } catch (error) {
        console.error('Error prefetching region data:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to prefetch region data',
                code: 'PREFETCH_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/weather/prefetch/all
 * Prefetch weather data for all major regions
 */
router.post('/prefetch/all', getWeatherIntelligence, async (req, res) => {
    try {
        const { years, priority, maxConcurrent } = req.body;
        
        const result = await req.weatherIntelligence.prefetchAllRegions({
            years,
            priority,
            maxConcurrent
        });

        res.json({
            success: true,
            data: result,
            message: `Prefetch completed: ${result.successful}/${result.total} regions successful`
        });
    } catch (error) {
        console.error('Error prefetching all regions:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to prefetch all regions',
                code: 'PREFETCH_ALL_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/weather/data/:region/:year
 * Get weather data for a specific region and year
 */
router.get('/data/:region/:year', getWeatherIntelligence, async (req, res) => {
    try {
        const { region, year } = req.params;
        const { skipPrefetch } = req.query;
        
        const yearNum = parseInt(year);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear()) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Invalid year',
                    code: 'INVALID_YEAR'
                }
            });
        }

        const weatherData = await req.weatherIntelligence.getWeatherData(region, yearNum, {
            skipPrefetch: skipPrefetch === 'true'
        });

        if (!weatherData) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Weather data not found',
                    code: 'DATA_NOT_FOUND'
                }
            });
        }

        res.json({
            success: true,
            data: weatherData
        });
    } catch (error) {
        console.error('Error getting weather data:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get weather data',
                code: 'WEATHER_DATA_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/weather/stats
 * Get weather intelligence statistics
 */
router.get('/stats', getWeatherIntelligence, (req, res) => {
    try {
        const stats = req.weatherIntelligence.getPrefetchStats();
        
        res.json({
            success: true,
            data: {
                ...stats,
                cache: {
                    ...stats.cache,
                    hitRatePercentage: Math.round(stats.cache.hitRate * 100),
                    missRatePercentage: Math.round(stats.cache.missRate * 100),
                    memoryUsageMB: Math.round(stats.cache.totalSize / (1024 * 1024) * 100) / 100,
                    averageEntrySizeKB: Math.round(stats.cache.averageSize / 1024 * 100) / 100
                }
            }
        });
    } catch (error) {
        console.error('Error getting weather stats:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get weather statistics',
                code: 'STATS_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * DELETE /api/weather/queue
 * Clear the prefetch queue
 */
router.delete('/queue', getWeatherIntelligence, (req, res) => {
    try {
        req.weatherIntelligence.clearPrefetchQueue();
        
        res.json({
            success: true,
            message: 'Prefetch queue cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing prefetch queue:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to clear prefetch queue',
                code: 'CLEAR_QUEUE_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/weather/background/status
 * Get background service status
 */
router.get('/background/status', getWeatherBackgroundService, (req, res) => {
    try {
        const status = req.weatherBackgroundService.getStatus();
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting background service status:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get background service status',
                code: 'BACKGROUND_STATUS_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/weather/background/start
 * Start the background service
 */
router.post('/background/start', getWeatherBackgroundService, (req, res) => {
    try {
        req.weatherBackgroundService.start();
        
        res.json({
            success: true,
            message: 'Background service started successfully'
        });
    } catch (error) {
        console.error('Error starting background service:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to start background service',
                code: 'START_BACKGROUND_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/weather/background/stop
 * Stop the background service
 */
router.post('/background/stop', getWeatherBackgroundService, (req, res) => {
    try {
        req.weatherBackgroundService.stop();
        
        res.json({
            success: true,
            message: 'Background service stopped successfully'
        });
    } catch (error) {
        console.error('Error stopping background service:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to stop background service',
                code: 'STOP_BACKGROUND_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/weather/background/trigger/:jobName
 * Manually trigger a background job
 */
router.post('/background/trigger/:jobName', getWeatherBackgroundService, async (req, res) => {
    try {
        const { jobName } = req.params;
        
        const result = await req.weatherBackgroundService.triggerJob(jobName);
        
        res.json({
            success: true,
            data: result,
            message: `Job ${jobName} executed successfully`
        });
    } catch (error) {
        console.error(`Error triggering job ${req.params.jobName}:`, error);
        res.status(500).json({
            success: false,
            error: {
                message: `Failed to trigger job ${req.params.jobName}`,
                code: 'TRIGGER_JOB_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * PUT /api/weather/background/schedule/:jobName
 * Update schedule configuration for a job
 */
router.put('/background/schedule/:jobName', getWeatherBackgroundService, (req, res) => {
    try {
        const { jobName } = req.params;
        const { schedule } = req.body;
        
        if (!schedule) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Schedule configuration is required',
                    code: 'MISSING_SCHEDULE'
                }
            });
        }

        req.weatherBackgroundService.updateSchedule(jobName, schedule);
        
        res.json({
            success: true,
            message: `Schedule updated for job ${jobName}`
        });
    } catch (error) {
        console.error(`Error updating schedule for ${req.params.jobName}:`, error);
        res.status(500).json({
            success: false,
            error: {
                message: `Failed to update schedule for job ${req.params.jobName}`,
                code: 'UPDATE_SCHEDULE_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/weather/health
 * Get weather service health status
 */
router.get('/health', getWeatherIntelligence, getWeatherBackgroundService, async (req, res) => {
    try {
        const weatherStats = req.weatherIntelligence.getPrefetchStats();
        const backgroundStatus = req.weatherBackgroundService.getStatus();
        
        // Assess overall health
        const isHealthy = weatherStats.cache.hitRate > 0.3 && 
                         backgroundStatus.running && 
                         weatherStats.processing.queueSize < 50;
        
        res.json({
            success: true,
            data: {
                healthy: isHealthy,
                weather: {
                    cacheHitRate: Math.round(weatherStats.cache.hitRate * 100),
                    memoryUsageMB: Math.round(weatherStats.cache.totalSize / (1024 * 1024) * 100) / 100,
                    queueSize: weatherStats.processing.queueSize,
                    isProcessing: weatherStats.processing.isProcessing
                },
                background: {
                    running: backgroundStatus.running,
                    jobsScheduled: backgroundStatus.jobs.scheduled,
                    lastExecution: backgroundStatus.jobs.stats.lastExecution
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error getting weather health status:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get weather health status',
                code: 'HEALTH_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/weather/test-connection
 * Test weather service connection
 */
router.get('/test-connection', getWeatherIntelligence, async (req, res) => {
    try {
        // Test with a known good region and year
        const testData = await req.weatherIntelligence.getWeatherData('Bordeaux', 2018);
        
        if (testData) {
            res.json({
                success: true,
                data: {
                    region: 'Bordeaux',
                    year: 2018,
                    gdd: testData.gdd,
                    totalRainfall: testData.totalRainfall,
                    overallScore: testData.overallScore,
                    confidenceLevel: testData.confidenceLevel
                },
                message: 'Weather service connection successful'
            });
        } else {
            res.status(503).json({
                success: false,
                error: {
                    message: 'Weather service connection failed - no data returned',
                    code: 'CONNECTION_FAILED'
                }
            });
        }
    } catch (error) {
        console.error('Error testing weather connection:', error);
        res.status(503).json({
            success: false,
            error: {
                message: 'Weather service connection failed',
                code: 'CONNECTION_ERROR',
                details: error.message
            }
        });
    }
});

module.exports = router;