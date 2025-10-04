/**
 * Mock ParallelProcessingEngine for testing
 */

const EventEmitter = require('events');

class ParallelProcessingEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        this.maxWorkers = options.maxWorkers || 4;
        this.taskTimeout = options.taskTimeout || 5 * 60 * 1000;
        this.tasks = new Map();
        this.metrics = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            activeTasks: 0
        };
    }

    async executeTask(taskType, data, options = {}) {
        const taskId = `task_${Date.now()}_${Math.random()}`;
        this.tasks.set(taskId, { type: taskType, data, status: 'completed', result: data });
        this.metrics.totalTasks++;
        this.metrics.completedTasks++;
        return taskId;
    }

    async executeTasks(tasks) {
        return Promise.all(tasks.map(task => this.executeTask(task.type, task.data, task.options)));
    }

    async waitForTask(taskId) {
        const task = this.tasks.get(taskId);
        return task ? task.result : null;
    }

    getMetrics() {
        return this.metrics;
    }

    async shutdown() {
        this.tasks.clear();
    }
}

class SimilarityCalculationEngine extends ParallelProcessingEngine {
    constructor(options = {}) {
        super(options);
    }

    async calculateSimilarities(entities, algorithm, options = {}) {
        const similarities = [];
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                similarities.push({
                    entity1: entities[i],
                    entity2: entities[j],
                    similarity: 0.5
                });
            }
        }
        return similarities;
    }
}

class MatrixProcessingEngine extends ParallelProcessingEngine {
    constructor(options = {}) {
        super(options);
    }

    async multiplyMatrices(matrixA, matrixB, options = {}) {
        return [[1, 0], [0, 1]]; // Identity matrix mock
    }
}

module.exports = {
    ParallelProcessingEngine,
    SimilarityCalculationEngine,
    MatrixProcessingEngine
};
