/**
 * Parallel Processing Engine
 * Handles parallel computation for similarity calculations and other CPU-intensive tasks
 */

const EventEmitter = require('events');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const path = require('path');

class ParallelProcessingEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.maxWorkers = options.maxWorkers || os.cpus().length;
        this.taskTimeout = options.taskTimeout || 5 * 60 * 1000; // 5 minutes
        this.workerTimeout = options.workerTimeout || 10 * 60 * 1000; // 10 minutes
        
        // Worker management
        this.workers = new Map();
        this.availableWorkers = [];
        this.busyWorkers = new Set();
        this.workerTasks = new Map();
        
        // Task queue
        this.taskQueue = [];
        this.runningTasks = new Map();
        this.completedTasks = new Map();
        this.failedTasks = new Map();
        
        // Metrics
        this.metrics = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            activeTasks: 0,
            averageTaskTime: 0,
            taskTimes: [],
            workerUtilization: 0
        };
        
        this.initializeWorkers();
        this.startTaskProcessor();
    }

    /**
     * Initialize worker pool
     */
    initializeWorkers() {
        for (let i = 0; i < this.maxWorkers; i++) {
            this.createWorker();
        }
    }

    /**
     * Create new worker
     */
    createWorker() {
        const worker = new Worker(path.join(__dirname, 'parallel_worker.js'));
        const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        worker.on('message', (result) => {
            this.handleWorkerMessage(workerId, result);
        });
        
        worker.on('error', (error) => {
            this.handleWorkerError(workerId, error);
        });
        
        worker.on('exit', (code) => {
            this.handleWorkerExit(workerId, code);
        });
        
        this.workers.set(workerId, worker);
        this.availableWorkers.push(workerId);
        
        this.emit('workerCreated', workerId);
        return workerId;
    }

    /**
     * Execute task in parallel
     */
    async executeTask(taskType, data, options = {}) {
        const taskId = this.generateTaskId();
        const task = {
            id: taskId,
            type: taskType,
            data,
            options: {
                timeout: options.timeout || this.taskTimeout,
                priority: options.priority || 0,
                ...options
            },
            status: 'queued',
            createdAt: new Date()
        };

        this.taskQueue.push(task);
        this.metrics.totalTasks++;

        this.emit('taskQueued', task);
        return taskId;
    }

    /**
     * Execute multiple tasks in parallel
     */
    async executeTasks(tasks) {
        const taskPromises = tasks.map(task => 
            this.executeTask(task.type, task.data, task.options)
        );

        const taskIds = await Promise.all(taskPromises);
        
        // Wait for all tasks to complete
        const results = await Promise.all(
            taskIds.map(taskId => this.waitForTask(taskId))
        );

        return results;
    }

    /**
     * Wait for task completion
     */
    async waitForTask(taskId, timeout = null) {
        return new Promise((resolve, reject) => {
            const checkTask = () => {
                if (this.completedTasks.has(taskId)) {
                    const task = this.completedTasks.get(taskId);
                    resolve(task.result);
                } else if (this.failedTasks.has(taskId)) {
                    const task = this.failedTasks.get(taskId);
                    reject(new Error(task.error));
                } else {
                    setTimeout(checkTask, 100);
                }
            };

            if (timeout) {
                setTimeout(() => {
                    reject(new Error(`Task ${taskId} timed out`));
                }, timeout);
            }

            checkTask();
        });
    }

    /**
     * Start task processor
     */
    startTaskProcessor() {
        setInterval(() => {
            this.processNextTask();
        }, 50); // Check every 50ms
    }

    /**
     * Process next task in queue
     */
    async processNextTask() {
        if (this.availableWorkers.length === 0 || this.taskQueue.length === 0) {
            return;
        }

        // Sort tasks by priority
        this.taskQueue.sort((a, b) => b.options.priority - a.options.priority);

        const task = this.taskQueue.shift();
        const workerId = this.availableWorkers.shift();
        const worker = this.workers.get(workerId);

        this.busyWorkers.add(workerId);
        this.runningTasks.set(task.id, { task, workerId, startTime: Date.now() });
        this.metrics.activeTasks = this.runningTasks.size;

        task.status = 'running';
        task.startedAt = new Date();

        this.emit('taskStarted', task);

        // Set up timeout
        const timeoutId = setTimeout(() => {
            this.handleTaskTimeout(task.id);
        }, task.options.timeout);

        this.workerTasks.set(task.id, { workerId, timeoutId });

        // Send task to worker
        worker.postMessage({
            taskId: task.id,
            taskType: task.type,
            data: task.data,
            options: task.options
        });
    }

    /**
     * Handle worker message
     */
    handleWorkerMessage(workerId, result) {
        const { taskId, success, data, error } = result;
        
        if (this.workerTasks.has(taskId)) {
            const taskInfo = this.workerTasks.get(taskId);
            clearTimeout(taskInfo.timeoutId);
            this.workerTasks.delete(taskId);
            
            this.releaseWorker(workerId);
            
            const runningTask = this.runningTasks.get(taskId);
            if (runningTask) {
                const task = runningTask.task;
                const processingTime = Date.now() - runningTask.startTime;
                
                this.updateTaskTimeMetrics(processingTime);
                
                this.runningTasks.delete(taskId);
                this.metrics.activeTasks = this.runningTasks.size;
                
                if (success) {
                    task.status = 'completed';
                    task.completedAt = new Date();
                    task.result = data;
                    task.processingTime = processingTime;
                    
                    this.completedTasks.set(taskId, task);
                    this.metrics.completedTasks++;
                    
                    this.emit('taskCompleted', task);
                } else {
                    task.status = 'failed';
                    task.failedAt = new Date();
                    task.error = error;
                    task.processingTime = processingTime;
                    
                    this.failedTasks.set(taskId, task);
                    this.metrics.failedTasks++;
                    
                    this.emit('taskFailed', task);
                }
            }
        }
    }

    /**
     * Handle worker error
     */
    handleWorkerError(workerId, error) {
        // Only log in non-test environments to avoid Jest warnings
        if (process.env.NODE_ENV !== 'test') {
            console.error(`Worker ${workerId} error:`, error);
        }
        this.releaseWorker(workerId);
        this.emit('workerError', workerId, error);
    }

    /**
     * Handle worker exit
     */
    handleWorkerExit(workerId, code) {
        // Only log in non-test environments to avoid Jest warnings
        if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
            console.log(`Worker ${workerId} exited with code ${code}`);
        }
        
        // Clean up worker
        this.workers.delete(workerId);
        this.busyWorkers.delete(workerId);
        
        const index = this.availableWorkers.indexOf(workerId);
        if (index !== -1) {
            this.availableWorkers.splice(index, 1);
        }
        
        // Create new worker to maintain pool size
        if (this.workers.size < this.maxWorkers) {
            this.createWorker();
        }
        
        this.emit('workerExited', workerId, code);
    }

    /**
     * Handle task timeout
     */
    handleTaskTimeout(taskId) {
        const runningTask = this.runningTasks.get(taskId);
        if (runningTask) {
            const task = runningTask.task;
            task.status = 'timeout';
            task.failedAt = new Date();
            task.error = 'Task timed out';
            
            this.runningTasks.delete(taskId);
            this.failedTasks.set(taskId, task);
            this.metrics.activeTasks = this.runningTasks.size;
            this.metrics.failedTasks++;
            
            this.emit('taskTimeout', task);
        }
    }

    /**
     * Release worker back to pool
     */
    releaseWorker(workerId) {
        this.busyWorkers.delete(workerId);
        this.availableWorkers.push(workerId);
        this.updateWorkerUtilization();
    }

    /**
     * Update worker utilization metrics
     */
    updateWorkerUtilization() {
        this.metrics.workerUtilization = this.busyWorkers.size / this.workers.size;
    }

    /**
     * Update task time metrics
     */
    updateTaskTimeMetrics(processingTime) {
        this.metrics.taskTimes.push(processingTime);
        
        if (this.metrics.taskTimes.length > 100) {
            this.metrics.taskTimes.shift();
        }
        
        const sum = this.metrics.taskTimes.reduce((a, b) => a + b, 0);
        this.metrics.averageTaskTime = sum / this.metrics.taskTimes.length;
    }

    /**
     * Get task status
     */
    getTaskStatus(taskId) {
        if (this.runningTasks.has(taskId)) {
            return this.runningTasks.get(taskId).task;
        }
        if (this.completedTasks.has(taskId)) {
            return this.completedTasks.get(taskId);
        }
        if (this.failedTasks.has(taskId)) {
            return this.failedTasks.get(taskId);
        }
        return null;
    }

    /**
     * Cancel task
     */
    cancelTask(taskId) {
        // Remove from queue
        const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
        if (queueIndex !== -1) {
            const task = this.taskQueue.splice(queueIndex, 1)[0];
            task.status = 'cancelled';
            this.emit('taskCancelled', task);
            return true;
        }

        // Cancel running task
        if (this.runningTasks.has(taskId)) {
            const runningTask = this.runningTasks.get(taskId);
            const task = runningTask.task;
            
            task.status = 'cancelled';
            this.runningTasks.delete(taskId);
            this.metrics.activeTasks = this.runningTasks.size;
            
            // Clear timeout if exists
            if (this.workerTasks.has(taskId)) {
                const taskInfo = this.workerTasks.get(taskId);
                clearTimeout(taskInfo.timeoutId);
                this.workerTasks.delete(taskId);
            }
            
            this.releaseWorker(runningTask.workerId);
            this.emit('taskCancelled', task);
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
            queueSize: this.taskQueue.length,
            activeTasks: this.runningTasks.size,
            completedTasks: this.completedTasks.size,
            failedTasks: this.failedTasks.size,
            totalWorkers: this.workers.size,
            availableWorkers: this.availableWorkers.length,
            busyWorkers: this.busyWorkers.size
        };
    }

    /**
     * Clear completed tasks
     */
    clearCompletedTasks(olderThan = 24 * 60 * 60 * 1000) { // 24 hours
        const cutoff = new Date(Date.now() - olderThan);
        let cleared = 0;

        for (const [taskId, task] of this.completedTasks) {
            if (task.completedAt < cutoff) {
                this.completedTasks.delete(taskId);
                cleared++;
            }
        }

        for (const [taskId, task] of this.failedTasks) {
            if (task.failedAt < cutoff) {
                this.failedTasks.delete(taskId);
                cleared++;
            }
        }

        this.emit('tasksCleared', cleared);
        return cleared;
    }

    /**
     * Generate unique task ID
     */
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Shutdown gracefully
     */
    async shutdown() {
        this.emit('shutdownStarted');
        
        // Wait for running tasks to complete
        while (this.runningTasks.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Terminate all workers
        for (const [workerId, worker] of this.workers) {
            worker.terminate();
        }
        
        this.workers.clear();
        this.availableWorkers = [];
        this.busyWorkers.clear();
        this.workerTasks.clear();
        
        this.emit('shutdownCompleted');
    }
}

/**
 * Similarity Calculation Engine
 * Specialized for parallel similarity calculations
 */
class SimilarityCalculationEngine extends ParallelProcessingEngine {
    constructor(options = {}) {
        super(options);
        
        this.similarityCache = new Map();
        this.cacheExpiry = options.cacheExpiry || 60 * 60 * 1000; // 1 hour
    }

    /**
     * Calculate similarities in parallel
     */
    async calculateSimilarities(entities, algorithm, options = {}) {
        const { batchSize = 100, minSimilarity = 0.1 } = options;
        
        // Check cache first
        const cacheKey = this.generateCacheKey(entities, algorithm);
        const cached = this.similarityCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        // Split entities into batches for parallel processing
        const batches = this.createBatches(entities, batchSize);
        
        // Create tasks for each batch
        const tasks = batches.map((batch, index) => ({
            type: 'similarity_calculation',
            data: {
                entities: batch,
                algorithm,
                batchIndex: index,
                totalBatches: batches.length
            },
            options: {
                priority: 1
            }
        }));

        // Execute tasks in parallel
        const results = await this.executeTasks(tasks);
        
        // Combine results
        const similarities = this.combineSimilarityResults(results, minSimilarity);
        
        // Cache results
        this.similarityCache.set(cacheKey, {
            data: similarities,
            timestamp: Date.now()
        });

        return similarities;
    }

    /**
     * Create batches for parallel processing
     */
    createBatches(entities, batchSize) {
        const batches = [];
        
        for (let i = 0; i < entities.length; i += batchSize) {
            batches.push(entities.slice(i, i + batchSize));
        }
        
        return batches;
    }

    /**
     * Combine similarity results from multiple batches
     */
    combineSimilarityResults(results, minSimilarity) {
        const similarities = [];
        
        for (const result of results) {
            if (result && Array.isArray(result)) {
                for (const similarity of result) {
                    if (similarity.similarity >= minSimilarity) {
                        similarities.push(similarity);
                    }
                }
            }
        }
        
        // Sort by similarity score
        similarities.sort((a, b) => b.similarity - a.similarity);
        
        return similarities;
    }

    /**
     * Generate cache key
     */
    generateCacheKey(entities, algorithm) {
        const entityIds = entities.map(e => e.id).sort().join(',');
        return `${algorithm}_${entityIds}`;
    }

    /**
     * Clear similarity cache
     */
    clearSimilarityCache() {
        this.similarityCache.clear();
    }
}

/**
 * Matrix Processing Engine
 * Specialized for parallel matrix operations
 */
class MatrixProcessingEngine extends ParallelProcessingEngine {
    constructor(options = {}) {
        super(options);
    }

    /**
     * Multiply matrices in parallel
     */
    async multiplyMatrices(matrixA, matrixB, options = {}) {
        const { chunkSize = 1000 } = options;
        
        const rowsA = matrixA.length;
        const colsB = matrixB[0].length;
        
        // Create row chunks for parallel processing
        const rowChunks = [];
        for (let i = 0; i < rowsA; i += chunkSize) {
            rowChunks.push({
                startRow: i,
                endRow: Math.min(i + chunkSize, rowsA),
                matrixA: matrixA.slice(i, Math.min(i + chunkSize, rowsA)),
                matrixB
            });
        }
        
        // Create tasks for each chunk
        const tasks = rowChunks.map((chunk, index) => ({
            type: 'matrix_multiplication',
            data: chunk,
            options: {
                priority: 1
            }
        }));

        // Execute tasks in parallel
        const results = await this.executeTasks(tasks);
        
        // Combine results
        const result = Array(rowsA).fill().map(() => Array(colsB).fill(0));
        
        for (const chunkResult of results) {
            if (chunkResult && Array.isArray(chunkResult)) {
                for (let i = 0; i < chunkResult.length; i++) {
                    const rowIndex = rowChunks[results.indexOf(chunkResult)].startRow + i;
                    result[rowIndex] = chunkResult[i];
                }
            }
        }
        
        return result;
    }

    /**
     * Calculate matrix similarity in parallel
     */
    async calculateMatrixSimilarity(matrix, algorithm, options = {}) {
        const { batchSize = 100 } = options;
        
        // Create batches of rows for parallel processing
        const batches = [];
        for (let i = 0; i < matrix.length; i += batchSize) {
            batches.push({
                matrix: matrix.slice(i, i + batchSize),
                startIndex: i,
                algorithm
            });
        }
        
        // Create tasks for each batch
        const tasks = batches.map((batch, index) => ({
            type: 'matrix_similarity',
            data: batch,
            options: {
                priority: 1
            }
        }));

        // Execute tasks in parallel
        const results = await this.executeTasks(tasks);
        
        // Combine results
        const similarities = [];
        for (const result of results) {
            if (result && Array.isArray(result)) {
                similarities.push(...result);
            }
        }
        
        return similarities;
    }
}

module.exports = {
    ParallelProcessingEngine,
    SimilarityCalculationEngine,
    MatrixProcessingEngine
};