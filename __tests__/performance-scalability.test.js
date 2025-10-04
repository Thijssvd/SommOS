/**
 * Performance and Scalability Tests
 * Comprehensive tests for Priority 3 performance improvements
 */

const Database = require('../backend/database/connection');
const { AdvancedCacheManager, DistributedCacheManager, CacheFactory } = require('../backend/core/advanced_cache_manager');
const { AsyncProcessingEngine, WorkerPoolManager, EventDrivenProcessor } = require('../backend/core/async_processing_engine');
const { BatchProcessingEngine, StreamingDataProcessor, ParallelBatchProcessor, MemoryEfficientBatchProcessor } = require('../backend/core/batch_processing_engine');
const { ParallelProcessingEngine, SimilarityCalculationEngine, MatrixProcessingEngine } = require('../backend/core/parallel_processing_engine');
const { MemoryOptimizationEngine, SparseMatrix, CircularBuffer, LRUCache, BloomFilter, CompressedArray } = require('../backend/core/memory_optimization_engine');
const PerformanceMonitoringEngine = require('../backend/core/performance_monitoring_engine');
const path = require('path');
const fs = require('fs');

// Mock the database
jest.mock('../backend/database/connection');

describe('Priority 3: Performance & Scalability Tests', () => {
    let db;
    let dbPath;

    beforeAll(async () => {
        dbPath = path.join(__dirname, 'test_performance.db');
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
        
        // Create mock database with required methods
        db = {
            connect: jest.fn().mockResolvedValue(true),
            close: jest.fn().mockResolvedValue(true),
            all: jest.fn().mockResolvedValue([]),
            get: jest.fn().mockResolvedValue(null),
            run: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
            prepare: jest.fn().mockReturnValue({
                bind: jest.fn().mockReturnThis(),
                run: jest.fn(),
                finalize: jest.fn()
            })
        };
        
        Database.getInstance = jest.fn().mockReturnValue(db);
        await db.connect();
    });

    afterAll(async () => {
        await db.close();
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    });

    describe('Advanced Cache Manager', () => {
        let cache;

        beforeEach(() => {
            cache = new AdvancedCacheManager({
                maxSize: 100,
                defaultTTL: 1000,
                enableMetrics: true
            });
        });

        afterEach(() => {
            cache.destroy();
        });

        test('should handle high-frequency cache operations', async () => {
            const startTime = Date.now();
            const operations = 10000;

            // Perform many cache operations
            for (let i = 0; i < operations; i++) {
                cache.set(`key_${i}`, { data: `value_${i}`, index: i });
            }

            // Verify cache performance
            const endTime = Date.now();
            const duration = endTime - startTime;
            const opsPerSecond = operations / (duration / 1000);

            expect(opsPerSecond).toBeGreaterThan(1000); // Should handle >1000 ops/sec
            expect(cache.size()).toBeLessThanOrEqual(100); // Should respect max size
        });

        test('should maintain high hit rate with LRU eviction', async () => {
            // Fill cache to capacity
            for (let i = 0; i < 100; i++) {
                cache.set(`key_${i}`, `value_${i}`);
            }

            // Access some keys multiple times
            for (let i = 0; i < 10; i++) {
                for (let j = 0; j < 5; j++) {
                    cache.get(`key_${i}`);
                }
            }

            // Add new keys to trigger eviction
            for (let i = 100; i < 150; i++) {
                cache.set(`key_${i}`, `value_${i}`);
            }

            // Check that frequently accessed keys are still in cache
            for (let i = 0; i < 10; i++) {
                expect(cache.get(`key_${i}`)).toBe(`value_${i}`);
            }

            const stats = cache.getStats();
            expect(stats.hitRate).toBeGreaterThan(0.5); // Should have good hit rate
        });

        test('should handle TTL expiration efficiently', async () => {
            // Set items with short TTL
            for (let i = 0; i < 50; i++) {
                cache.set(`key_${i}`, `value_${i}`, 100); // 100ms TTL
            }

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 150));

            // Check that items are expired
            for (let i = 0; i < 50; i++) {
                expect(cache.get(`key_${i}`)).toBeNull();
            }

            const stats = cache.getStats();
            expect(stats.size).toBe(0);
        });

        test('should handle batch operations efficiently', async () => {
            const startTime = Date.now();
            const batchSize = 1000;

            // Batch set operation
            const keyValuePairs = {};
            for (let i = 0; i < batchSize; i++) {
                keyValuePairs[`key_${i}`] = `value_${i}`;
            }

            cache.setMany(keyValuePairs);

            // Batch get operation
            const keys = Object.keys(keyValuePairs);
            const { results, missing } = cache.getMany(keys);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(Object.keys(results).length).toBe(batchSize);
            expect(missing.length).toBe(0);
            expect(duration).toBeLessThan(100); // Should complete in <100ms
        });
    });

    describe('Async Processing Engine', () => {
        let asyncEngine;

        beforeEach(() => {
            asyncEngine = new AsyncProcessingEngine({
                maxConcurrentJobs: 5,
                jobTimeout: 5000,
                retryAttempts: 2
            });
        });

        afterEach(async () => {
            await asyncEngine.shutdown();
        });

        test('should handle concurrent job processing', async () => {
            // Register job handler
            asyncEngine.registerJobHandler('test_job', async (data) => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return { processed: data.value * 2 };
            });

            const startTime = Date.now();
            const jobCount = 20;

            // Submit multiple jobs
            const jobIds = [];
            for (let i = 0; i < jobCount; i++) {
                const jobId = await asyncEngine.addJob('test_job', { value: i });
                jobIds.push(jobId);
            }

            // Wait for all jobs to complete
            const results = await Promise.all(
                jobIds.map(jobId => asyncEngine.waitForTask(jobId))
            );

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(results).toHaveLength(jobCount);
            expect(duration).toBeLessThan(1000); // Should complete in <1s with concurrency
            expect(results[0].processed).toBe(0);
            expect(results[19].processed).toBe(38);
        });

        test('should handle job failures and retries', async () => {
            let attemptCount = 0;
            
            asyncEngine.registerJobHandler('failing_job', async (data) => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Simulated failure');
                }
                return { success: true, attempts: attemptCount };
            });

            const jobId = await asyncEngine.addJob('failing_job', { test: true });
            const result = await asyncEngine.waitForTask(jobId);

            expect(result.success).toBe(true);
            expect(result.attempts).toBe(3);
        });

        test('should handle job priorities correctly', async () => {
            const results = [];
            
            asyncEngine.registerJobHandler('priority_job', async (data) => {
                results.push(data.priority);
                return { priority: data.priority };
            });

            // Submit jobs with different priorities
            await asyncEngine.addJob('priority_job', { priority: 1 }, { priority: 1 });
            await asyncEngine.addJob('priority_job', { priority: 3 }, { priority: 3 });
            await asyncEngine.addJob('priority_job', { priority: 2 }, { priority: 2 });

            // Wait for completion
            await new Promise(resolve => setTimeout(resolve, 500));

            // Higher priority jobs should be processed first
            expect(results[0]).toBe(3);
            expect(results[1]).toBe(2);
            expect(results[2]).toBe(1);
        });
    });

    describe('Batch Processing Engine', () => {
        let batchEngine;

        beforeEach(() => {
            batchEngine = new BatchProcessingEngine({
                batchSize: 100,
                maxConcurrency: 3
            });
        });

        test('should process large datasets efficiently', async () => {
            const dataSize = 10000;
            const testData = Array.from({ length: dataSize }, (_, i) => ({
                id: i,
                value: Math.random() * 100
            }));

            const processor = async (chunk) => {
                return chunk.map(item => ({
                    ...item,
                    processed: true,
                    doubled: item.value * 2
                }));
            };

            const startTime = Date.now();
            const batchId = await batchEngine.processBatch(testData, processor);
            
            // Wait for completion
            let batchStatus;
            do {
                batchStatus = batchEngine.getBatchStatus(batchId);
                await new Promise(resolve => setTimeout(resolve, 100));
            } while (batchStatus.status === 'processing');

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(batchStatus.status).toBe('completed');
            expect(batchStatus.processedItems).toBe(dataSize);
            expect(duration).toBeLessThan(5000); // Should complete in <5s
        });

        test('should handle streaming data processing', async () => {
            const stream = batchEngine.createProcessingStream(async (chunk) => {
                return chunk.map(item => ({ ...item, processed: true }));
            });

            const results = [];
            stream.on('data', (data) => {
                results.push(data);
            });

            // Simulate streaming data
            for (let i = 0; i < 1000; i++) {
                stream.write({ id: i, value: i * 2 });
            }
            stream.end();

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 1000));

            expect(results.length).toBeGreaterThan(0);
            expect(results[0].processed).toBe(true);
        });
    });

    describe('Parallel Processing Engine', () => {
        let parallelEngine;

        beforeEach(() => {
            parallelEngine = new ParallelProcessingEngine({
                maxWorkers: 2,
                taskTimeout: 5000
            });
        });

        afterEach(async () => {
            await parallelEngine.shutdown();
        });

        test('should process tasks in parallel efficiently', async () => {
            const taskCount = 10;
            const tasks = [];

            for (let i = 0; i < taskCount; i++) {
                tasks.push({
                    type: 'data_processing',
                    data: { items: Array.from({ length: 100 }, (_, j) => ({ id: j, value: j * i })) },
                    options: { priority: 1 }
                });
            }

            const startTime = Date.now();
            const results = await parallelEngine.executeTasks(tasks);
            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(results).toHaveLength(taskCount);
            expect(duration).toBeLessThan(2000); // Should complete in <2s with parallel processing
        });

        test('should handle similarity calculations efficiently', async () => {
            const similarityEngine = new SimilarityCalculationEngine({
                maxWorkers: 2
            });

            const entities = Array.from({ length: 100 }, (_, i) => ({
                id: i,
                ratings: Array.from({ length: 50 }, (_, j) => ({
                    item_id: j,
                    rating: Math.random() * 5
                }))
            }));

            const startTime = Date.now();
            const similarities = await similarityEngine.calculateSimilarities(entities, 'pearson', {
                batchSize: 20,
                minSimilarity: 0.1
            });
            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(similarities.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(3000); // Should complete in <3s

            await similarityEngine.shutdown();
        });
    });

    describe('Memory Optimization Engine', () => {
        let memoryEngine;

        beforeEach(() => {
            memoryEngine = new MemoryOptimizationEngine({
                memoryLimit: 50 * 1024 * 1024, // 50MB
                compressionEnabled: true
            });
        });

        test('should handle memory-efficient data structures', () => {
            const sparseMatrix = new SparseMatrix({ rows: 1000, cols: 1000 });
            
            // Set some values
            for (let i = 0; i < 100; i++) {
                sparseMatrix.set(i, i, i * 2);
            }

            expect(sparseMatrix.getSize()).toBe(100);
            expect(sparseMatrix.getMemoryUsage()).toBeLessThan(10000); // Should be memory efficient

            // Test circular buffer
            const circularBuffer = new CircularBuffer({ capacity: 1000 });
            
            for (let i = 0; i < 2000; i++) {
                circularBuffer.push(i);
            }

            expect(circularBuffer.getSize()).toBe(1000);
            expect(circularBuffer.peek()).toBe(1000); // Should have overwritten old values
        });

        test('should handle LRU cache efficiently', () => {
            const lruCache = new LRUCache({ capacity: 100, maxMemory: 1024 * 1024 });

            // Fill cache
            for (let i = 0; i < 150; i++) {
                lruCache.set(`key_${i}`, { data: `value_${i}`, index: i });
            }

            expect(lruCache.getSize()).toBeLessThanOrEqual(100);

            // Access some keys to make them recently used
            for (let i = 0; i < 10; i++) {
                lruCache.get(`key_${i}`);
            }

            // Add more items
            for (let i = 150; i < 200; i++) {
                lruCache.set(`key_${i}`, { data: `value_${i}`, index: i });
            }

            // Recently accessed keys should still be in cache
            for (let i = 0; i < 10; i++) {
                expect(lruCache.get(`key_${i}`)).toBeDefined();
            }
        });

        test('should handle Bloom filter efficiently', () => {
            const bloomFilter = new BloomFilter({ size: 10000, hashCount: 3 });

            // Add items
            for (let i = 0; i < 1000; i++) {
                bloomFilter.add(`item_${i}`);
            }

            // Test membership
            expect(bloomFilter.contains('item_0')).toBe(true);
            expect(bloomFilter.contains('item_999')).toBe(true);
            expect(bloomFilter.contains('item_2000')).toBe(false); // Should not be in filter

            expect(bloomFilter.getMemoryUsage()).toBeLessThan(2000); // Should be memory efficient
        });

        test('should handle compression efficiently', () => {
            const testData = {
                largeArray: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `test_${i}` })),
                repeatedData: Array.from({ length: 100 }, () => 'repeated_value')
            };

            const compressed = memoryEngine.compress(testData, 'gzip');
            const decompressed = memoryEngine.decompress(compressed, 'gzip');

            expect(compressed.length).toBeLessThan(JSON.stringify(testData).length);
            expect(decompressed).toEqual(testData);
        });
    });

    describe('Performance Monitoring Engine', () => {
        let monitoringEngine;

        beforeEach(() => {
            monitoringEngine = new PerformanceMonitoringEngine({
                monitoringInterval: 1000,
                alertThresholds: {
                    cpu: 80,
                    memory: 85,
                    responseTime: 1000,
                    errorRate: 5
                }
            });
        });

        test('should collect comprehensive metrics', async () => {
            // Simulate some activity
            for (let i = 0; i < 100; i++) {
                const requestId = monitoringEngine.recordRequest('/api/test', 'GET', Date.now());
                monitoringEngine.recordResponse(requestId, 200, Date.now(), 1024);
            }

            // Record some errors
            for (let i = 0; i < 5; i++) {
                monitoringEngine.recordError('TEST_ERROR', 'Test error message');
            }

            // Record cache operations
            for (let i = 0; i < 50; i++) {
                monitoringEngine.recordCacheOperation('get', `key_${i}`, i % 2 === 0);
            }

            // Wait for metrics collection
            await new Promise(resolve => setTimeout(resolve, 1500));

            const summary = monitoringEngine.getPerformanceSummary();
            
            expect(summary.application.requests).toBe(100);
            expect(summary.application.responses).toBe(100);
            expect(summary.application.errors).toBe(5);
            expect(summary.cache.hits).toBe(25);
            expect(summary.cache.misses).toBe(25);
        });

        test('should trigger alerts when thresholds are exceeded', async () => {
            let alertTriggered = false;
            
            monitoringEngine.on('alertTriggered', (alert) => {
                if (alert.type === 'HIGH_ERROR_RATE') {
                    alertTriggered = true;
                }
            });

            // Simulate high error rate
            for (let i = 0; i < 100; i++) {
                const requestId = monitoringEngine.recordRequest('/api/test', 'GET', Date.now());
                monitoringEngine.recordResponse(requestId, 200, Date.now(), 1024);
            }

            for (let i = 0; i < 10; i++) {
                monitoringEngine.recordError('TEST_ERROR', 'Test error message');
            }

            // Wait for alert check
            await new Promise(resolve => setTimeout(resolve, 1500));

            expect(alertTriggered).toBe(true);
        });

        test('should export metrics in different formats', () => {
            const jsonExport = monitoringEngine.exportMetrics('json');
            const data = JSON.parse(jsonExport);
            
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('metrics');
            expect(data).toHaveProperty('summary');
            expect(data).toHaveProperty('alerts');
        });
    });

    describe('Integration Performance Tests', () => {
        test('should handle end-to-end performance scenario', async () => {
            const cache = new AdvancedCacheManager({ maxSize: 1000 });
            const asyncEngine = new AsyncProcessingEngine({ maxConcurrentJobs: 5 });
            const batchEngine = new BatchProcessingEngine({ batchSize: 100 });
            const parallelEngine = new ParallelProcessingEngine({ maxWorkers: 2 });
            const monitoringEngine = new PerformanceMonitoringEngine();

            // Register job handler
            asyncEngine.registerJobHandler('process_data', async (data) => {
                // Simulate data processing
                await new Promise(resolve => setTimeout(resolve, 50));
                return { processed: data.items.length, timestamp: Date.now() };
            });

            const startTime = Date.now();

            // Simulate complex workflow
            const data = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: Math.random() }));

            // Cache some data
            cache.set('test_data', data);

            // Process in batches
            const batchId = await batchEngine.processBatch(data, async (chunk) => {
                return chunk.map(item => ({ ...item, processed: true }));
            });

            // Submit async jobs
            const jobIds = [];
            for (let i = 0; i < 20; i++) {
                const jobId = await asyncEngine.addJob('process_data', { items: data.slice(i * 50, (i + 1) * 50) });
                jobIds.push(jobId);
            }

            // Wait for completion
            await Promise.all(jobIds.map(jobId => asyncEngine.waitForTask(jobId)));

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Performance assertions
            expect(duration).toBeLessThan(10000); // Should complete in <10s
            expect(cache.get('test_data')).toEqual(data);
            expect(batchEngine.getBatchStatus(batchId).status).toBe('completed');

            // Cleanup
            cache.destroy();
            await asyncEngine.shutdown();
            await parallelEngine.shutdown();
        });

        test('should handle memory pressure gracefully', async () => {
            const memoryEngine = new MemoryOptimizationEngine({
                memoryLimit: 10 * 1024 * 1024 // 10MB limit
            });

            let memoryLimitExceeded = false;
            memoryEngine.on('memoryLimitExceeded', () => {
                memoryLimitExceeded = true;
            });

            // Create large data structures
            const largeData = Array.from({ length: 10000 }, (_, i) => ({
                id: i,
                data: 'x'.repeat(1000) // 1KB per item
            }));

            // This should trigger memory limit
            try {
                memoryEngine.allocate(largeData.length * 1000, 'test_data');
            } catch (error) {
                // Expected to fail or trigger GC
            }

            expect(memoryLimitExceeded).toBe(true);
        });
    });
});