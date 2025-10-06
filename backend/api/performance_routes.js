/**
 * Performance Routes
 * API endpoints for performance monitoring and optimization features
 */

const express = require('express');
const router = express.Router();

// Import performance engines
const { AdvancedCacheManager, CacheFactory } = require('../core/advanced_cache_manager');
const { AsyncProcessingEngine } = require('../core/async_processing_engine');
const { BatchProcessingEngine } = require('../core/batch_processing_engine');
const { ParallelProcessingEngine } = require('../core/parallel_processing_engine');
const { MemoryOptimizationEngine } = require('../core/memory_optimization_engine');
const PerformanceMonitoringEngine = require('../core/performance_monitoring_engine');

// Initialize performance engines
const cacheManager = new AdvancedCacheManager({
    maxSize: 10000,
    defaultTTL: 60 * 60 * 1000, // 1 hour
    enableMetrics: true
});

const asyncEngine = new AsyncProcessingEngine({
    maxConcurrentJobs: 10,
    jobTimeout: 30 * 60 * 1000, // 30 minutes
    retryAttempts: 3
});

const batchEngine = new BatchProcessingEngine({
    batchSize: 1000,
    maxConcurrency: 5
});

const parallelEngine = new ParallelProcessingEngine({
    maxWorkers: require('os').cpus().length,
    taskTimeout: 5 * 60 * 1000 // 5 minutes
});

const memoryEngine = new MemoryOptimizationEngine({
    memoryLimit: 100 * 1024 * 1024, // 100MB
    compressionEnabled: true
});

const monitoringEngine = new PerformanceMonitoringEngine({
    monitoringInterval: 5000,
    alertThresholds: {
        cpu: 80,
        memory: 85,
        responseTime: 5000,
        errorRate: 5
    }
});

// Register job handlers
asyncEngine.registerJobHandler('similarity_calculation', async (data) => {
    const { entities, algorithm, options } = data;
    
    // Simulate similarity calculation
    const similarities = [];
    for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
            const similarity = Math.random();
            if (similarity > 0.1) {
                similarities.push({
                    entity1: entities[i].id,
                    entity2: entities[j].id,
                    similarity
                });
            }
        }
    }
    
    return similarities;
});

asyncEngine.registerJobHandler('model_training', async (data) => {
    const { modelType, trainingData, parameters } = data;
    
    // Simulate model training
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        model: {
            type: modelType,
            parameters,
            trainedAt: new Date().toISOString()
        },
        performance: {
            accuracy: 0.85 + Math.random() * 0.1,
            precision: 0.83 + Math.random() * 0.1,
            recall: 0.81 + Math.random() * 0.1,
            f1_score: 0.82 + Math.random() * 0.1
        }
    };
});

// Performance Metrics Collection

/**
 * POST /api/performance/metrics
 * Collect Web Vitals and custom performance metrics from frontend
 */
router.post('/metrics', (req, res) => {
    try {
        const { metrics, userAgent, viewport, connection } = req.body;
        
        if (!metrics || !Array.isArray(metrics)) {
            return res.status(400).json({
                success: false,
                error: 'Metrics array is required'
            });
        }
        
        // Log metrics for monitoring (in production, store in database or monitoring service)
        console.log('[Performance Metrics]', {
            count: metrics.length,
            userAgent,
            viewport,
            connection,
            timestamp: new Date().toISOString()
        });
        
        // Process each metric
        metrics.forEach(metric => {
            const { name, value, rating, url } = metric;
            
            // Track Web Vitals
            if (['lcp', 'fid', 'cls', 'fcp', 'ttfb'].includes(name)) {
                console.log(`[Web Vital] ${name.toUpperCase()}: ${value}ms (${rating}) on ${url}`);
            }
            
            // Track custom metrics
            if (name.startsWith('custom:')) {
                const customName = name.replace('custom:', '');
                console.log(`[Custom Metric] ${customName}: ${value}`);
            }
        });
        
        res.json({
            success: true,
            message: `Received ${metrics.length} metrics`,
            processed: metrics.length
        });
        
    } catch (error) {
        console.error('[Performance Metrics] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Cache Management Routes

/**
 * GET /api/performance/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', (req, res) => {
    try {
        const stats = cacheManager.getStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/performance/cache/set
 * Set cache value
 */
router.post('/cache/set', (req, res) => {
    try {
        const { key, value, ttl } = req.body;
        
        if (!key || value === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Key and value are required'
            });
        }
        
        cacheManager.set(key, value, ttl);
        
        res.json({
            success: true,
            message: 'Value cached successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/cache/get/:key
 * Get cache value
 */
router.get('/cache/get/:key', (req, res) => {
    try {
        const { key } = req.params;
        const value = cacheManager.get(key);
        
        if (value === null) {
            return res.status(404).json({
                success: false,
                error: 'Key not found in cache'
            });
        }
        
        res.json({
            success: true,
            data: value
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/performance/cache/clear
 * Clear all cache
 */
router.delete('/cache/clear', (req, res) => {
    try {
        const clearedCount = cacheManager.clear();
        
        res.json({
            success: true,
            message: `Cleared ${clearedCount} cache entries`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Async Processing Routes

/**
 * POST /api/performance/async/job
 * Submit async job
 */
router.post('/async/job', async (req, res) => {
    try {
        const { jobType, data, options } = req.body;
        
        if (!jobType || !data) {
            return res.status(400).json({
                success: false,
                error: 'Job type and data are required'
            });
        }
        
        const jobId = await asyncEngine.addJob(jobType, data, options);
        
        res.json({
            success: true,
            data: {
                jobId,
                status: 'queued'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/async/job/:jobId
 * Get job status
 */
router.get('/async/job/:jobId', (req, res) => {
    try {
        const { jobId } = req.params;
        const status = asyncEngine.getJobStatus(jobId);
        
        if (!status) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/performance/async/job/:jobId
 * Cancel job
 */
router.delete('/async/job/:jobId', (req, res) => {
    try {
        const { jobId } = req.params;
        const cancelled = asyncEngine.cancelJob(jobId);
        
        if (!cancelled) {
            return res.status(404).json({
                success: false,
                error: 'Job not found or cannot be cancelled'
            });
        }
        
        res.json({
            success: true,
            message: 'Job cancelled successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/async/metrics
 * Get async processing metrics
 */
router.get('/async/metrics', (req, res) => {
    try {
        const metrics = asyncEngine.getMetrics();
        
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Batch Processing Routes

/**
 * POST /api/performance/batch/process
 * Process data in batches
 */
router.post('/batch/process', async (req, res) => {
    try {
        const { data, processor, options } = req.body;
        
        if (!data || !Array.isArray(data)) {
            return res.status(400).json({
                success: false,
                error: 'Data array is required'
            });
        }
        
        const batchProcessor = async (chunk) => {
            // Default processor if none provided
            if (!processor) {
                return chunk.map(item => ({ ...item, processed: true }));
            }
            
            // Use provided processor function
            return processor(chunk);
        };
        
        const batchId = await batchEngine.processBatch(data, batchProcessor, options);
        
        res.json({
            success: true,
            data: {
                batchId,
                status: 'queued',
                totalItems: data.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/batch/:batchId
 * Get batch status
 */
router.get('/batch/:batchId', (req, res) => {
    try {
        const { batchId } = req.params;
        const status = batchEngine.getBatchStatus(batchId);
        
        if (!status) {
            return res.status(404).json({
                success: false,
                error: 'Batch not found'
            });
        }
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/batch/metrics
 * Get batch processing metrics
 */
router.get('/batch/metrics', (req, res) => {
    try {
        const metrics = batchEngine.getMetrics();
        
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Parallel Processing Routes

/**
 * POST /api/performance/parallel/task
 * Execute parallel task
 */
router.post('/parallel/task', async (req, res) => {
    try {
        const { taskType, data, options } = req.body;
        
        if (!taskType || !data) {
            return res.status(400).json({
                success: false,
                error: 'Task type and data are required'
            });
        }
        
        const taskId = await parallelEngine.executeTask(taskType, data, options);
        
        res.json({
            success: true,
            data: {
                taskId,
                status: 'queued'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/parallel/task/:taskId
 * Get task status
 */
router.get('/parallel/task/:taskId', (req, res) => {
    try {
        const { taskId } = req.params;
        const status = parallelEngine.getTaskStatus(taskId);
        
        if (!status) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/parallel/metrics
 * Get parallel processing metrics
 */
router.get('/parallel/metrics', (req, res) => {
    try {
        const metrics = parallelEngine.getMetrics();
        
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Memory Optimization Routes

/**
 * GET /api/performance/memory/stats
 * Get memory statistics
 */
router.get('/memory/stats', (req, res) => {
    try {
        const stats = memoryEngine.getMemoryStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/performance/memory/allocate
 * Allocate memory
 */
router.post('/memory/allocate', (req, res) => {
    try {
        const { size, type } = req.body;
        
        if (!size || size <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid size is required'
            });
        }
        
        const allocation = memoryEngine.allocate(size, type);
        
        res.json({
            success: true,
            data: allocation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/performance/memory/compress
 * Compress data
 */
router.post('/memory/compress', (req, res) => {
    try {
        const { data, algorithm } = req.body;
        
        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'Data is required'
            });
        }
        
        const compressed = memoryEngine.compress(data, algorithm);
        
        res.json({
            success: true,
            data: {
                originalSize: JSON.stringify(data).length,
                compressedSize: compressed.length,
                compressionRatio: compressed.length / JSON.stringify(data).length,
                compressed
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/performance/memory/decompress
 * Decompress data
 */
router.post('/memory/decompress', (req, res) => {
    try {
        const { compressedData, algorithm } = req.body;
        
        if (!compressedData) {
            return res.status(400).json({
                success: false,
                error: 'Compressed data is required'
            });
        }
        
        const decompressed = memoryEngine.decompress(compressedData, algorithm);
        
        res.json({
            success: true,
            data: decompressed
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Performance Monitoring Routes

/**
 * GET /api/performance/monitoring/summary
 * Get performance summary
 */
router.get('/monitoring/summary', (req, res) => {
    try {
        const summary = monitoringEngine.getPerformanceSummary();
        
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/monitoring/metrics
 * Get detailed metrics
 */
router.get('/monitoring/metrics', (req, res) => {
    try {
        const { category, startTime, endTime } = req.query;
        
        if (category) {
            const metrics = monitoringEngine.getMetricsForRange(
                category,
                parseInt(startTime) || 0,
                parseInt(endTime) || Date.now()
            );
            
            res.json({
                success: true,
                data: metrics
            });
        } else {
            const metrics = monitoringEngine.getCurrentMetrics();
            
            res.json({
                success: true,
                data: metrics
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/monitoring/alerts
 * Get active alerts
 */
router.get('/monitoring/alerts', (req, res) => {
    try {
        const alerts = monitoringEngine.alerts.filter(alert => !alert.resolved);
        
        res.json({
            success: true,
            data: alerts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/performance/monitoring/alert/:alertId/resolve
 * Resolve alert
 */
router.post('/monitoring/alert/:alertId/resolve', (req, res) => {
    try {
        const { alertId } = req.params;
        monitoringEngine.resolveAlert(alertId);
        
        res.json({
            success: true,
            message: 'Alert resolved successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/monitoring/export
 * Export metrics
 */
router.get('/monitoring/export', (req, res) => {
    try {
        const { format } = req.query;
        const exportData = monitoringEngine.exportMetrics(format || 'json');
        
        res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
        res.send(exportData);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Performance Testing Routes

/**
 * POST /api/performance/test/load
 * Run load test
 */
router.post('/test/load', async (req, res) => {
    try {
        const { requests, concurrency, endpoint } = req.body;
        
        if (!requests || !concurrency || !endpoint) {
            return res.status(400).json({
                success: false,
                error: 'Requests, concurrency, and endpoint are required'
            });
        }
        
        const startTime = Date.now();
        const results = [];
        
        // Simulate load test
        const promises = [];
        for (let i = 0; i < concurrency; i++) {
            promises.push(
                new Promise(async (resolve) => {
                    const batchSize = Math.ceil(requests / concurrency);
                    const batchResults = [];
                    
                    for (let j = 0; j < batchSize; j++) {
                        const requestStart = Date.now();
                        
                        // Simulate request
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                        
                        const requestEnd = Date.now();
                        batchResults.push({
                            responseTime: requestEnd - requestStart,
                            success: Math.random() > 0.1 // 90% success rate
                        });
                    }
                    
                    resolve(batchResults);
                })
            );
        }
        
        const allResults = await Promise.all(promises);
        const endTime = Date.now();
        
        // Calculate statistics
        const flatResults = allResults.flat();
        const totalRequests = flatResults.length;
        const successfulRequests = flatResults.filter(r => r.success).length;
        const averageResponseTime = flatResults.reduce((sum, r) => sum + r.responseTime, 0) / totalRequests;
        const maxResponseTime = Math.max(...flatResults.map(r => r.responseTime));
        const minResponseTime = Math.min(...flatResults.map(r => r.responseTime));
        
        res.json({
            success: true,
            data: {
                totalRequests,
                successfulRequests,
                failedRequests: totalRequests - successfulRequests,
                successRate: (successfulRequests / totalRequests) * 100,
                averageResponseTime,
                maxResponseTime,
                minResponseTime,
                totalTime: endTime - startTime,
                requestsPerSecond: totalRequests / ((endTime - startTime) / 1000)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/performance/test/memory
 * Run memory test
 */
router.post('/test/memory', async (req, res) => {
    try {
        const { iterations, dataSize } = req.body;
        
        const startMemory = process.memoryUsage();
        const startTime = Date.now();
        
        // Simulate memory-intensive operations
        const data = [];
        for (let i = 0; i < iterations; i++) {
            data.push({
                id: i,
                data: 'x'.repeat(dataSize || 1000),
                timestamp: Date.now()
            });
        }
        
        const endMemory = process.memoryUsage();
        const endTime = Date.now();
        
        res.json({
            success: true,
            data: {
                iterations,
                dataSize: dataSize || 1000,
                startMemory: startMemory.heapUsed,
                endMemory: endMemory.heapUsed,
                memoryIncrease: endMemory.heapUsed - startMemory.heapUsed,
                executionTime: endTime - startTime,
                memoryPerIteration: (endMemory.heapUsed - startMemory.heapUsed) / iterations
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;