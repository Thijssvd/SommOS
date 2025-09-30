/**
 * Async Processing Engine
 * Handles background tasks, job queues, and event-driven processing
 */

const EventEmitter = require('events');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');

class AsyncProcessingEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.maxConcurrentJobs = options.maxConcurrentJobs || 5;
        this.jobTimeout = options.jobTimeout || 30 * 60 * 1000; // 30 minutes
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000; // 1 second
        
        // Job queues
        this.jobQueue = [];
        this.runningJobs = new Map();
        this.completedJobs = new Map();
        this.failedJobs = new Map();
        
        // Job types and handlers
        this.jobHandlers = new Map();
        this.workerPool = new Map();
        
        // Metrics
        this.metrics = {
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            activeJobs: 0,
            queueSize: 0,
            averageProcessingTime: 0,
            processingTimes: []
        };
        
        // Start job processor
        this.startJobProcessor();
    }

    /**
     * Register job handler
     */
    registerJobHandler(jobType, handler) {
        this.jobHandlers.set(jobType, handler);
        this.emit('handlerRegistered', jobType);
    }

    /**
     * Add job to queue
     */
    async addJob(jobType, data, options = {}) {
        const job = {
            id: this.generateJobId(),
            type: jobType,
            data,
            options: {
                priority: options.priority || 0,
                timeout: options.timeout || this.jobTimeout,
                retries: options.retries || this.retryAttempts,
                delay: options.delay || 0,
                ...options
            },
            status: 'queued',
            createdAt: new Date(),
            attempts: 0,
            maxAttempts: options.retries || this.retryAttempts
        };

        // Add delay if specified
        if (job.options.delay > 0) {
            setTimeout(() => {
                this.queueJob(job);
            }, job.options.delay);
        } else {
            this.queueJob(job);
        }

        this.emit('jobQueued', job);
        return job.id;
    }

    /**
     * Queue job with priority
     */
    queueJob(job) {
        // Insert job based on priority (higher priority first)
        let insertIndex = this.jobQueue.length;
        for (let i = 0; i < this.jobQueue.length; i++) {
            if (this.jobQueue[i].options.priority < job.options.priority) {
                insertIndex = i;
                break;
            }
        }
        
        this.jobQueue.splice(insertIndex, 0, job);
        this.metrics.queueSize = this.jobQueue.length;
        this.metrics.totalJobs++;
    }

    /**
     * Start job processor
     */
    startJobProcessor() {
        setInterval(() => {
            this.processNextJob();
        }, 100); // Check every 100ms
    }

    /**
     * Process next job in queue
     */
    async processNextJob() {
        if (this.runningJobs.size >= this.maxConcurrentJobs || this.jobQueue.length === 0) {
            return;
        }

        const job = this.jobQueue.shift();
        if (!job) return;

        this.metrics.queueSize = this.jobQueue.length;
        this.runningJobs.set(job.id, job);
        this.metrics.activeJobs = this.runningJobs.size;

        try {
            await this.executeJob(job);
        } catch (error) {
            console.error(`Job ${job.id} failed:`, error.message);
            await this.handleJobFailure(job, error);
        }
    }

    /**
     * Execute job
     */
    async executeJob(job) {
        const startTime = Date.now();
        job.status = 'running';
        job.startedAt = new Date();
        job.attempts++;

        this.emit('jobStarted', job);

        // Check if job type has a handler
        const handler = this.jobHandlers.get(job.type);
        if (!handler) {
            throw new Error(`No handler registered for job type: ${job.type}`);
        }

        // Set up timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Job ${job.id} timed out after ${job.options.timeout}ms`));
            }, job.options.timeout);
        });

        // Execute job with timeout
        const result = await Promise.race([
            handler(job.data, job),
            timeoutPromise
        ]);

        const processingTime = Date.now() - startTime;
        this.updateProcessingTimeMetrics(processingTime);

        job.status = 'completed';
        job.completedAt = new Date();
        job.result = result;
        job.processingTime = processingTime;

        this.runningJobs.delete(job.id);
        this.completedJobs.set(job.id, job);
        this.metrics.activeJobs = this.runningJobs.size;
        this.metrics.completedJobs++;

        this.emit('jobCompleted', job);
    }

    /**
     * Handle job failure
     */
    async handleJobFailure(job, error) {
        job.status = 'failed';
        job.error = error.message;
        job.failedAt = new Date();

        this.runningJobs.delete(job.id);
        this.metrics.activeJobs = this.runningJobs.size;

        // Check if we should retry
        if (job.attempts < job.maxAttempts) {
            // Retry with exponential backoff
            const delay = this.retryDelay * Math.pow(2, job.attempts - 1);
            setTimeout(() => {
                this.queueJob(job);
            }, delay);
            
            this.emit('jobRetry', job, delay);
        } else {
            // Max retries exceeded
            this.failedJobs.set(job.id, job);
            this.metrics.failedJobs++;
            this.emit('jobFailed', job);
        }
    }

    /**
     * Get job status
     */
    getJobStatus(jobId) {
        if (this.runningJobs.has(jobId)) {
            return this.runningJobs.get(jobId);
        }
        if (this.completedJobs.has(jobId)) {
            return this.completedJobs.get(jobId);
        }
        if (this.failedJobs.has(jobId)) {
            return this.failedJobs.get(jobId);
        }
        return null;
    }

    /**
     * Cancel job
     */
    cancelJob(jobId) {
        // Remove from queue
        const queueIndex = this.jobQueue.findIndex(job => job.id === jobId);
        if (queueIndex !== -1) {
            const job = this.jobQueue.splice(queueIndex, 1)[0];
            job.status = 'cancelled';
            this.emit('jobCancelled', job);
            return true;
        }

        // Cancel running job (if possible)
        if (this.runningJobs.has(jobId)) {
            const job = this.runningJobs.get(jobId);
            job.status = 'cancelled';
            this.runningJobs.delete(jobId);
            this.metrics.activeJobs = this.runningJobs.size;
            this.emit('jobCancelled', job);
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
            queueSize: this.jobQueue.length,
            activeJobs: this.runningJobs.size,
            completedJobs: this.completedJobs.size,
            failedJobs: this.failedJobs.size
        };
    }

    /**
     * Clear completed jobs (cleanup)
     */
    clearCompletedJobs(olderThan = 24 * 60 * 60 * 1000) { // 24 hours
        const cutoff = new Date(Date.now() - olderThan);
        let cleared = 0;

        for (const [jobId, job] of this.completedJobs) {
            if (job.completedAt < cutoff) {
                this.completedJobs.delete(jobId);
                cleared++;
            }
        }

        for (const [jobId, job] of this.failedJobs) {
            if (job.failedAt < cutoff) {
                this.failedJobs.delete(jobId);
                cleared++;
            }
        }

        this.emit('jobsCleared', cleared);
        return cleared;
    }

    /**
     * Update processing time metrics
     */
    updateProcessingTimeMetrics(processingTime) {
        this.metrics.processingTimes.push(processingTime);
        
        // Keep only last 100 processing times
        if (this.metrics.processingTimes.length > 100) {
            this.metrics.processingTimes.shift();
        }
        
        // Calculate average
        const sum = this.metrics.processingTimes.reduce((a, b) => a + b, 0);
        this.metrics.averageProcessingTime = sum / this.metrics.processingTimes.length;
    }

    /**
     * Generate unique job ID
     */
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Shutdown gracefully
     */
    async shutdown() {
        this.emit('shutdownStarted');
        
        // Wait for running jobs to complete
        while (this.runningJobs.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.emit('shutdownCompleted');
    }
}

/**
 * Worker Pool Manager
 * Manages worker threads for CPU-intensive tasks
 */
class WorkerPoolManager {
    constructor(options = {}) {
        this.maxWorkers = options.maxWorkers || require('os').cpus().length;
        this.workerTimeout = options.workerTimeout || 5 * 60 * 1000; // 5 minutes
        
        this.workers = new Map();
        this.availableWorkers = [];
        this.busyWorkers = new Set();
        this.workerTasks = new Map();
        
        this.initializeWorkers();
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
        const worker = new Worker(path.join(__dirname, 'worker_scripts.js'));
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
        
        return workerId;
    }

    /**
     * Execute task in worker
     */
    async executeTask(taskType, data) {
        return new Promise((resolve, reject) => {
            if (this.availableWorkers.length === 0) {
                reject(new Error('No available workers'));
                return;
            }
            
            const workerId = this.availableWorkers.shift();
            const worker = this.workers.get(workerId);
            
            this.busyWorkers.add(workerId);
            
            const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.workerTasks.set(taskId, { workerId, resolve, reject, startTime: Date.now() });
            
            // Set timeout
            setTimeout(() => {
                if (this.workerTasks.has(taskId)) {
                    this.workerTasks.delete(taskId);
                    this.releaseWorker(workerId);
                    reject(new Error(`Task ${taskId} timed out`));
                }
            }, this.workerTimeout);
            
            worker.postMessage({ taskId, taskType, data });
        });
    }

    /**
     * Handle worker message
     */
    handleWorkerMessage(workerId, result) {
        const { taskId, success, data, error } = result;
        
        if (this.workerTasks.has(taskId)) {
            const task = this.workerTasks.get(taskId);
            this.workerTasks.delete(taskId);
            this.releaseWorker(workerId);
            
            if (success) {
                task.resolve(data);
            } else {
                task.reject(new Error(error));
            }
        }
    }

    /**
     * Handle worker error
     */
    handleWorkerError(workerId, error) {
        console.error(`Worker ${workerId} error:`, error);
        this.releaseWorker(workerId);
    }

    /**
     * Handle worker exit
     */
    handleWorkerExit(workerId, code) {
        console.log(`Worker ${workerId} exited with code ${code}`);
        this.workers.delete(workerId);
        this.busyWorkers.delete(workerId);
        
        // Remove from available workers if present
        const index = this.availableWorkers.indexOf(workerId);
        if (index !== -1) {
            this.availableWorkers.splice(index, 1);
        }
        
        // Create new worker to maintain pool size
        if (this.workers.size < this.maxWorkers) {
            this.createWorker();
        }
    }

    /**
     * Release worker back to pool
     */
    releaseWorker(workerId) {
        this.busyWorkers.delete(workerId);
        this.availableWorkers.push(workerId);
    }

    /**
     * Get pool statistics
     */
    getStats() {
        return {
            totalWorkers: this.workers.size,
            availableWorkers: this.availableWorkers.length,
            busyWorkers: this.busyWorkers.size,
            activeTasks: this.workerTasks.size
        };
    }

    /**
     * Shutdown worker pool
     */
    async shutdown() {
        for (const [workerId, worker] of this.workers) {
            worker.terminate();
        }
        
        this.workers.clear();
        this.availableWorkers = [];
        this.busyWorkers.clear();
        this.workerTasks.clear();
    }
}

/**
 * Event-Driven Processing
 * Handles real-time events and triggers appropriate actions
 */
class EventDrivenProcessor extends EventEmitter {
    constructor() {
        super();
        
        this.eventHandlers = new Map();
        this.eventQueue = [];
        this.processing = false;
        
        this.startEventProcessor();
    }

    /**
     * Register event handler
     */
    onEvent(eventType, handler, options = {}) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        
        this.eventHandlers.get(eventType).push({
            handler,
            priority: options.priority || 0,
            async: options.async !== false
        });
        
        // Sort by priority
        this.eventHandlers.get(eventType).sort((a, b) => b.priority - a.priority);
    }

    /**
     * Emit event
     */
    emitEvent(eventType, data) {
        const event = {
            type: eventType,
            data,
            timestamp: new Date(),
            id: this.generateEventId()
        };
        
        this.eventQueue.push(event);
        this.emit('eventQueued', event);
    }

    /**
     * Start event processor
     */
    startEventProcessor() {
        setInterval(() => {
            this.processEvents();
        }, 10); // Process every 10ms
    }

    /**
     * Process events
     */
    async processEvents() {
        if (this.processing || this.eventQueue.length === 0) {
            return;
        }
        
        this.processing = true;
        
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            await this.processEvent(event);
        }
        
        this.processing = false;
    }

    /**
     * Process single event
     */
    async processEvent(event) {
        const handlers = this.eventHandlers.get(event.type);
        if (!handlers) {
            return;
        }
        
        for (const handlerInfo of handlers) {
            try {
                if (handlerInfo.async) {
                    setImmediate(() => {
                        handlerInfo.handler(event.data, event);
                    });
                } else {
                    await handlerInfo.handler(event.data, event);
                }
            } catch (error) {
                console.error(`Event handler error for ${event.type}:`, error.message);
                this.emit('handlerError', error, event);
            }
        }
        
        this.emit('eventProcessed', event);
    }

    /**
     * Generate event ID
     */
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = {
    AsyncProcessingEngine,
    WorkerPoolManager,
    EventDrivenProcessor
};