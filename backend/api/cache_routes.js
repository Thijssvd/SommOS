/**
 * SommOS Cache Management API Routes
 * Provides endpoints for managing AI response cache
 */

const express = require('express');
const router = express.Router();

// Middleware to get pairing engine instance
const getPairingEngine = (req, res, next) => {
    if (!req.app.locals.pairingEngine) {
        return res.status(503).json({
            success: false,
            error: {
                message: 'Pairing engine not available',
                code: 'SERVICE_UNAVAILABLE'
            }
        });
    }
    req.pairingEngine = req.app.locals.pairingEngine;
    next();
};

/**
 * GET /api/cache/stats
 * Get cache statistics
 */
router.get('/stats', getPairingEngine, async (req, res) => {
    try {
        const stats = req.pairingEngine.getCacheStats();
        
        res.json({
            success: true,
            data: {
                ...stats,
                hitRatePercentage: Math.round(stats.hitRate * 100),
                missRatePercentage: Math.round(stats.missRate * 100),
                memoryUsageMB: Math.round(stats.totalSize / (1024 * 1024) * 100) / 100,
                averageEntrySizeKB: Math.round(stats.averageSize / 1024 * 100) / 100
            }
        });
    } catch (error) {
        console.error('Error getting cache stats:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get cache statistics',
                code: 'CACHE_STATS_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * DELETE /api/cache/clear
 * Clear all cache entries
 */
router.delete('/clear', getPairingEngine, async (req, res) => {
    try {
        await req.pairingEngine.clearCache();
        
        res.json({
            success: true,
            message: 'Cache cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to clear cache',
                code: 'CACHE_CLEAR_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * DELETE /api/cache/invalidate
 * Invalidate cache entries by pattern
 */
router.delete('/invalidate', getPairingEngine, async (req, res) => {
    try {
        const { pattern, dish, context } = req.body;
        
        let count = 0;
        
        if (pattern) {
            count = await req.pairingEngine.invalidateCache(pattern);
        } else if (dish) {
            count = await req.pairingEngine.invalidateCacheByDish(dish);
        } else if (context) {
            count = await req.pairingEngine.invalidateCacheByContext(context);
        } else {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Must provide pattern, dish, or context to invalidate',
                    code: 'INVALID_INVALIDATION_REQUEST'
                }
            });
        }
        
        res.json({
            success: true,
            message: `Invalidated ${count} cache entries`,
            data: { invalidatedCount: count }
        });
    } catch (error) {
        console.error('Error invalidating cache:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to invalidate cache',
                code: 'CACHE_INVALIDATION_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/cache/warmup
 * Warm up cache with common pairings
 */
router.post('/warmup', getPairingEngine, async (req, res) => {
    try {
        const { pairings } = req.body;
        
        if (!Array.isArray(pairings)) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Pairings must be an array',
                    code: 'INVALID_WARMUP_DATA'
                }
            });
        }
        
        await req.pairingEngine.warmupCache(pairings);
        
        res.json({
            success: true,
            message: `Warmed up cache with ${pairings.length} pairings`,
            data: { warmedUpCount: pairings.length }
        });
    } catch (error) {
        console.error('Error warming up cache:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to warm up cache',
                code: 'CACHE_WARMUP_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/cache/export
 * Export cache data
 */
router.get('/export', getPairingEngine, async (req, res) => {
    try {
        const cacheData = await req.pairingEngine.exportCache();
        
        res.json({
            success: true,
            data: cacheData
        });
    } catch (error) {
        console.error('Error exporting cache:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to export cache',
                code: 'CACHE_EXPORT_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/cache/import
 * Import cache data
 */
router.post('/import', getPairingEngine, async (req, res) => {
    try {
        const { cacheData } = req.body;
        
        if (!cacheData || !cacheData.entries) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Invalid cache data format',
                    code: 'INVALID_CACHE_DATA'
                }
            });
        }
        
        await req.pairingEngine.importCache(cacheData);
        
        res.json({
            success: true,
            message: 'Cache imported successfully',
            data: { importedCount: cacheData.entries.length }
        });
    } catch (error) {
        console.error('Error importing cache:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to import cache',
                code: 'CACHE_IMPORT_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/cache/cleanup
 * Clean up expired cache entries
 */
router.post('/cleanup', getPairingEngine, async (req, res) => {
    try {
        await req.pairingEngine.cleanupCache();
        
        res.json({
            success: true,
            message: 'Cache cleanup completed'
        });
    } catch (error) {
        console.error('Error cleaning up cache:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to cleanup cache',
                code: 'CACHE_CLEANUP_ERROR',
                details: error.message
            }
        });
    }
});

/**
 * GET /api/cache/health
 * Check cache health
 */
router.get('/health', getPairingEngine, async (req, res) => {
    try {
        const stats = req.pairingEngine.getCacheStats();
        
        // Determine health based on hit rate and memory usage
        const isHealthy = stats.hitRate > 0.3 && stats.totalSize < 100 * 1024 * 1024; // 100MB limit
        
        res.json({
            success: true,
            data: {
                healthy: isHealthy,
                hitRate: stats.hitRate,
                memoryUsage: stats.totalSize,
                entries: stats.entries,
                uptime: stats.uptime,
                strategy: stats.strategy
            }
        });
    } catch (error) {
        console.error('Error checking cache health:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to check cache health',
                code: 'CACHE_HEALTH_ERROR',
                details: error.message
            }
        });
    }
});

module.exports = router;