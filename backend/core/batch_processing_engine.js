/**
 * Batch Processing Engine
 * Handles large-scale data processing with streaming and chunking
 */

const EventEmitter = require('events');
const { Transform, Readable, Writable } = require('stream');

class BatchProcessingEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.batchSize = options.batchSize || 1000;
        this.maxConcurrency = options.maxConcurrency || 5;
        this.chunkSize = options.chunkSize || 10000;
        this.processingTimeout = options.processingTimeout || 30 * 60 * 1000; // 30 minutes
        
        // Processing state
        this.activeBatches = new Map();
        this.processingQueue = [];
        this.completedBatches = new Map();
        this.failedBatches = new Map();
        
        // Metrics
        this.metrics = {
            totalBatches: 0,
            completedBatches: 0,
            failedBatches: 0,
            activeBatches: 0,
            totalItems: 0,
            processedItems: 0,
            averageProcessingTime: 0,
            processingTimes: []
        };
        
        // Start batch processor
        this.startBatchProcessor();
    }

    /**
     * Process data in batches
     */
    async processBatch(data, processor, options = {}) {
        const batchId = this.generateBatchId();
        const batchOptions = {
            batchSize: options.batchSize || this.batchSize,
            maxConcurrency: options.maxConcurrency || this.maxConcurrency,
            timeout: options.timeout || this.processingTimeout,
            ...options
        };

        const batch = {
            id: batchId,
            data,
            processor,
            options: batchOptions,
            status: 'queued',
            createdAt: new Date(),
            chunks: [],
            results: [],
            errors: []
        };

        // Split data into chunks
        batch.chunks = this.createChunks(data, batchOptions.batchSize);
        batch.totalChunks = batch.chunks.length;
        batch.totalItems = data.length;

        this.processingQueue.push(batch);
        this.metrics.totalBatches++;
        this.metrics.totalItems += data.length;

        this.emit('batchQueued', batch);
        return batchId;
    }

    /**
     * Process data as stream
     */
    createProcessingStream(processor, options = {}) {
        const batchOptions = {
            batchSize: options.batchSize || this.batchSize,
            maxConcurrency: options.maxConcurrency || this.maxConcurrency,
            ...options
        };

        let batchBuffer = [];
        let batchId = 0;

        return new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                batchBuffer.push(chunk);

                if (batchBuffer.length >= batchOptions.batchSize) {
                    this.processChunk(batchBuffer, processor, batchId++, batchOptions)
                        .then(result => {
                            callback(null, result);
                        })
                        .catch(error => {
                            callback(error);
                        });
                    
                    batchBuffer = [];
                } else {
                    callback();
                }
            },
            flush(callback) {
                if (batchBuffer.length > 0) {
                    this.processChunk(batchBuffer, processor, batchId++, batchOptions)
                        .then(result => {
                            callback(null, result);
                        })
                        .catch(error => {
                            callback(error);
                        });
                } else {
                    callback();
                }
            }
        });
    }

    /**
     * Process chunk of data
     */
    async processChunk(chunk, processor, chunkId, options) {
        const startTime = Date.now();
        
        try {
            const result = await processor(chunk, { chunkId, ...options });
            const processingTime = Date.now() - startTime;
            
            this.updateProcessingTimeMetrics(processingTime);
            
            return {
                chunkId,
                items: chunk.length,
                result,
                processingTime,
                status: 'completed'
            };
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            return {
                chunkId,
                items: chunk.length,
                error: error.message,
                processingTime,
                status: 'failed'
            };
        }
    }

    /**
     * Create chunks from data
     */
    createChunks(data, chunkSize) {
        const chunks = [];
        
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
        }
        
        return chunks;
    }

    /**
     * Start batch processor
     */
    startBatchProcessor() {
        setInterval(() => {
            this.processNextBatch();
        }, 100); // Check every 100ms
    }

    /**
     * Process next batch in queue
     */
    async processNextBatch() {
        if (this.activeBatches.size >= this.maxConcurrency || this.processingQueue.length === 0) {
            return;
        }

        const batch = this.processingQueue.shift();
        if (!batch) return;

        this.activeBatches.set(batch.id, batch);
        this.metrics.activeBatches = this.activeBatches.size;

        try {
            await this.executeBatch(batch);
        } catch (error) {
            console.error(`Batch ${batch.id} failed:`, error.message);
            await this.handleBatchFailure(batch, error);
        }
    }

    /**
     * Execute batch processing
     */
    async executeBatch(batch) {
        const startTime = Date.now();
        batch.status = 'processing';
        batch.startedAt = new Date();

        this.emit('batchStarted', batch);

        // Process chunks in parallel
        const chunkPromises = batch.chunks.map((chunk, index) => 
            this.processChunk(chunk, batch.processor, index, batch.options)
        );

        const chunkResults = await Promise.allSettled(chunkPromises);

        // Process results
        for (const result of chunkResults) {
            if (result.status === 'fulfilled') {
                batch.results.push(result.value);
                if (result.value.status === 'failed') {
                    batch.errors.push(result.value.error);
                }
            } else {
                batch.errors.push(result.reason.message);
            }
        }

        const processingTime = Date.now() - startTime;
        this.updateProcessingTimeMetrics(processingTime);

        batch.status = 'completed';
        batch.completedAt = new Date();
        batch.processingTime = processingTime;
        batch.processedItems = batch.results.reduce((sum, result) => sum + result.items, 0);

        this.activeBatches.delete(batch.id);
        this.completedBatches.set(batch.id, batch);
        this.metrics.activeBatches = this.activeBatches.size;
        this.metrics.completedBatches++;
        this.metrics.processedItems += batch.processedItems;

        this.emit('batchCompleted', batch);
    }

    /**
     * Handle batch failure
     */
    async handleBatchFailure(batch, error) {
        batch.status = 'failed';
        batch.failedAt = new Date();
        batch.error = error.message;

        this.activeBatches.delete(batch.id);
        this.failedBatches.set(batch.id, batch);
        this.metrics.activeBatches = this.activeBatches.size;
        this.metrics.failedBatches++;

        this.emit('batchFailed', batch);
    }

    /**
     * Get batch status
     */
    getBatchStatus(batchId) {
        if (this.activeBatches.has(batchId)) {
            return this.activeBatches.get(batchId);
        }
        if (this.completedBatches.has(batchId)) {
            return this.completedBatches.get(batchId);
        }
        if (this.failedBatches.has(batchId)) {
            return this.failedBatches.get(batchId);
        }
        return null;
    }

    /**
     * Cancel batch
     */
    cancelBatch(batchId) {
        // Remove from queue
        const queueIndex = this.processingQueue.findIndex(batch => batch.id === batchId);
        if (queueIndex !== -1) {
            const batch = this.processingQueue.splice(queueIndex, 1)[0];
            batch.status = 'cancelled';
            this.emit('batchCancelled', batch);
            return true;
        }

        // Cancel active batch
        if (this.activeBatches.has(batchId)) {
            const batch = this.activeBatches.get(batchId);
            batch.status = 'cancelled';
            this.activeBatches.delete(batchId);
            this.metrics.activeBatches = this.activeBatches.size;
            this.emit('batchCancelled', batch);
            return true;
        }

        return false;
    }

    /**
     * Get processing metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            queueSize: this.processingQueue.length,
            activeBatches: this.activeBatches.size,
            completedBatches: this.completedBatches.size,
            failedBatches: this.failedBatches.size
        };
    }

    /**
     * Clear completed batches
     */
    clearCompletedBatches(olderThan = 24 * 60 * 60 * 1000) { // 24 hours
        const cutoff = new Date(Date.now() - olderThan);
        let cleared = 0;

        for (const [batchId, batch] of this.completedBatches) {
            if (batch.completedAt < cutoff) {
                this.completedBatches.delete(batchId);
                cleared++;
            }
        }

        for (const [batchId, batch] of this.failedBatches) {
            if (batch.failedAt < cutoff) {
                this.failedBatches.delete(batchId);
                cleared++;
            }
        }

        this.emit('batchesCleared', cleared);
        return cleared;
    }

    /**
     * Update processing time metrics
     */
    updateProcessingTimeMetrics(processingTime) {
        this.metrics.processingTimes.push(processingTime);
        
        if (this.metrics.processingTimes.length > 100) {
            this.metrics.processingTimes.shift();
        }
        
        const sum = this.metrics.processingTimes.reduce((a, b) => a + b, 0);
        this.metrics.averageProcessingTime = sum / this.metrics.processingTimes.length;
    }

    /**
     * Generate unique batch ID
     */
    generateBatchId() {
        return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Streaming Data Processor
 * Processes large datasets using streams
 */
class StreamingDataProcessor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.bufferSize = options.bufferSize || 10000;
        this.flushInterval = options.flushInterval || 1000; // 1 second
        this.maxBufferSize = options.maxBufferSize || 100000;
        
        this.buffer = [];
        this.flushTimer = null;
        this.processing = false;
        
        this.startFlushTimer();
    }

    /**
     * Add data to buffer
     */
    addData(data) {
        this.buffer.push(data);
        
        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }
        
        if (this.buffer.length >= this.maxBufferSize) {
            this.emit('bufferOverflow', this.buffer.length);
        }
    }

    /**
     * Start flush timer
     */
    startFlushTimer() {
        this.flushTimer = setInterval(() => {
            if (this.buffer.length > 0) {
                this.flush();
            }
        }, this.flushInterval);
    }

    /**
     * Flush buffer
     */
    flush() {
        if (this.processing || this.buffer.length === 0) {
            return;
        }
        
        const data = this.buffer.splice(0, this.bufferSize);
        this.emit('data', data);
    }

    /**
     * Stop processor
     */
    stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        
        if (this.buffer.length > 0) {
            this.flush();
        }
    }
}

/**
 * Parallel Batch Processor
 * Processes multiple batches in parallel
 */
class ParallelBatchProcessor extends BatchProcessingEngine {
    constructor(options = {}) {
        super(options);
        
        this.workerPool = options.workerPool;
        this.useWorkers = options.useWorkers !== false;
    }

    /**
     * Execute batch with parallel processing
     */
    async executeBatch(batch) {
        const startTime = Date.now();
        batch.status = 'processing';
        batch.startedAt = new Date();

        this.emit('batchStarted', batch);

        if (this.useWorkers && this.workerPool) {
            // Use worker pool for CPU-intensive tasks
            const chunkPromises = batch.chunks.map((chunk, index) => 
                this.processChunkWithWorker(chunk, batch.processor, index, batch.options)
            );

            const chunkResults = await Promise.allSettled(chunkPromises);
            this.processChunkResults(batch, chunkResults);
        } else {
            // Use regular parallel processing
            await super.executeBatch(batch);
        }

        const processingTime = Date.now() - startTime;
        this.updateProcessingTimeMetrics(processingTime);

        batch.status = 'completed';
        batch.completedAt = new Date();
        batch.processingTime = processingTime;

        this.activeBatches.delete(batch.id);
        this.completedBatches.set(batch.id, batch);
        this.metrics.activeBatches = this.activeBatches.size;
        this.metrics.completedBatches++;

        this.emit('batchCompleted', batch);
    }

    /**
     * Process chunk with worker
     */
    async processChunkWithWorker(chunk, processor, chunkId, options) {
        try {
            const result = await this.workerPool.executeTask('data_processing', {
                data: chunk,
                processor: processor.toString(),
                options
            });
            
            return {
                chunkId,
                items: chunk.length,
                result,
                status: 'completed'
            };
        } catch (error) {
            return {
                chunkId,
                items: chunk.length,
                error: error.message,
                status: 'failed'
            };
        }
    }

    /**
     * Process chunk results
     */
    processChunkResults(batch, chunkResults) {
        for (const result of chunkResults) {
            if (result.status === 'fulfilled') {
                batch.results.push(result.value);
                if (result.value.status === 'failed') {
                    batch.errors.push(result.value.error);
                }
            } else {
                batch.errors.push(result.reason.message);
            }
        }
    }
}

/**
 * Memory-Efficient Batch Processor
 * Optimized for large datasets with limited memory
 */
class MemoryEfficientBatchProcessor extends BatchProcessingEngine {
    constructor(options = {}) {
        super(options);
        
        this.memoryLimit = options.memoryLimit || 100 * 1024 * 1024; // 100MB
        this.compressionEnabled = options.compressionEnabled !== false;
        this.diskCacheEnabled = options.diskCacheEnabled !== false;
        
        this.memoryUsage = 0;
        this.diskCache = new Map();
    }

    /**
     * Process batch with memory optimization
     */
    async executeBatch(batch) {
        const startTime = Date.now();
        batch.status = 'processing';
        batch.startedAt = new Date();

        this.emit('batchStarted', batch);

        // Process chunks sequentially to manage memory
        for (let i = 0; i < batch.chunks.length; i++) {
            const chunk = batch.chunks[i];
            
            // Check memory usage
            if (this.memoryUsage > this.memoryLimit) {
                await this.garbageCollect();
            }
            
            const result = await this.processChunk(chunk, batch.processor, i, batch.options);
            batch.results.push(result);
            
            if (result.status === 'failed') {
                batch.errors.push(result.error);
            }
            
            // Clear chunk from memory
            batch.chunks[i] = null;
        }

        const processingTime = Date.now() - startTime;
        this.updateProcessingTimeMetrics(processingTime);

        batch.status = 'completed';
        batch.completedAt = new Date();
        batch.processingTime = processingTime;

        this.activeBatches.delete(batch.id);
        this.completedBatches.set(batch.id, batch);
        this.metrics.activeBatches = this.activeBatches.size;
        this.metrics.completedBatches++;

        this.emit('batchCompleted', batch);
    }

    /**
     * Garbage collection
     */
    async garbageCollect() {
        if (global.gc) {
            global.gc();
        }
        
        // Clear disk cache if enabled
        if (this.diskCacheEnabled) {
            this.diskCache.clear();
        }
        
        this.memoryUsage = process.memoryUsage().heapUsed;
    }
}

module.exports = {
    BatchProcessingEngine,
    StreamingDataProcessor,
    ParallelBatchProcessor,
    MemoryEfficientBatchProcessor
};