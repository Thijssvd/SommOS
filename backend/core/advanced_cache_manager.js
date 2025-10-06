/**
 * Advanced Cache Manager
 * Implements sophisticated caching with LRU eviction, TTL, and distributed caching
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class AdvancedCacheManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.maxSize = options.maxSize || 1000;
        this.defaultTTL = options.defaultTTL || 60 * 60 * 1000; // 1 hour
        this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes
        this.enableMetrics = options.enableMetrics !== false;
        
        // Cache storage
        this.cache = new Map();
        this.accessOrder = new Map(); // For LRU tracking
        this.expirationTimes = new Map();
        
        // Metrics
        this.metrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            sets: 0,
            deletes: 0,
            size: 0,
            memoryUsage: 0
        };
        
        // Start cleanup interval
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
        
        // Memory monitoring
        if (this.enableMetrics) {
            this.memoryMonitorTimer = setInterval(() => {
                this.updateMemoryMetrics();
            }, 10000); // Every 10 seconds
        }
    }

    /**
     * Get value from cache
     */
    get(key) {
        const cacheKey = this.generateKey(key);
        
        if (!this.cache.has(cacheKey)) {
            this.metrics.misses++;
            this.emit('miss', key);
            // Report to Prometheus if available
            if (global.prometheusExporter) {
                global.prometheusExporter.recordCacheOperation('get', 'miss');
            }
            return null;
        }
        
        // Check expiration
        if (this.isExpired(cacheKey)) {
            this.delete(cacheKey);
            this.metrics.misses++;
            this.emit('miss', key);
            if (global.prometheusExporter) {
                global.prometheusExporter.recordCacheOperation('get', 'miss');
            }
            return null;
        }
        
        // Update access order for LRU
        this.updateAccessOrder(cacheKey);
        
        this.metrics.hits++;
        this.emit('hit', key, this.cache.get(cacheKey));
        
        // Report to Prometheus if available
        if (global.prometheusExporter) {
            global.prometheusExporter.recordCacheOperation('get', 'hit');
        }
        
        return this.cache.get(cacheKey);
    }

    /**
     * Set value in cache
     */
    set(key, value, ttl = null) {
        const cacheKey = this.generateKey(key);
        const expirationTime = ttl ? Date.now() + ttl : Date.now() + this.defaultTTL;
        
        // Check if we need to evict
        if (this.cache.size >= this.maxSize && !this.cache.has(cacheKey)) {
            this.evictLRU();
        }
        
        // Store value
        this.cache.set(cacheKey, value);
        this.expirationTimes.set(cacheKey, expirationTime);
        this.updateAccessOrder(cacheKey);
        
        this.metrics.sets++;
        this.metrics.size = this.cache.size;
        this.emit('set', key, value, expirationTime);
        
        // Report to Prometheus if available
        if (global.prometheusExporter) {
            global.prometheusExporter.recordCacheOperation('set', 'success');
        }
        
        return true;
    }

    /**
     * Delete value from cache
     */
    delete(key) {
        const cacheKey = this.generateKey(key);
        
        const existed = this.cache.has(cacheKey);
        if (existed) {
            this.cache.delete(cacheKey);
            this.accessOrder.delete(cacheKey);
            this.expirationTimes.delete(cacheKey);
            
            this.metrics.deletes++;
            this.metrics.size = this.cache.size;
            this.emit('delete', key);
        }
        
        return existed;
    }

    /**
     * Check if key exists in cache
     */
    has(key) {
        const cacheKey = this.generateKey(key);
        
        if (!this.cache.has(cacheKey)) {
            return false;
        }
        
        if (this.isExpired(cacheKey)) {
            this.delete(cacheKey);
            return false;
        }
        
        return true;
    }

    /**
     * Get or set pattern
     */
    async getOrSet(key, fetchFunction, ttl = null) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }
        
        try {
            const value = await fetchFunction();
            this.set(key, value, ttl);
            return value;
        } catch (error) {
            this.emit('error', error, key);
            throw error;
        }
    }

    /**
     * Batch get operation
     */
    getMany(keys) {
        const results = {};
        const missing = [];
        
        for (const key of keys) {
            const value = this.get(key);
            if (value !== null) {
                results[key] = value;
            } else {
                missing.push(key);
            }
        }
        
        return { results, missing };
    }

    /**
     * Batch set operation
     */
    setMany(keyValuePairs, ttl = null) {
        const results = {};
        
        for (const [key, value] of Object.entries(keyValuePairs)) {
            results[key] = this.set(key, value, ttl);
        }
        
        return results;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.accessOrder.clear();
        this.expirationTimes.clear();
        
        this.metrics.size = 0;
        this.emit('clear', size);
        
        return size;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.metrics.hits + this.metrics.misses > 0 
            ? this.metrics.hits / (this.metrics.hits + this.metrics.misses) 
            : 0;
        
        return {
            ...this.metrics,
            hitRate: Math.round(hitRate * 100) / 100,
            maxSize: this.maxSize,
            utilization: Math.round((this.metrics.size / this.maxSize) * 100) / 100
        };
    }

    /**
     * Get cache keys
     */
    keys() {
        return Array.from(this.cache.keys());
    }

    /**
     * Get cache size
     */
    size() {
        return this.cache.size;
    }

    /**
     * Warm cache with frequently accessed data
     */
    async warmCache(warmupFunction) {
        try {
            const data = await warmupFunction();
            for (const [key, value] of Object.entries(data)) {
                this.set(key, value);
            }
            this.emit('warmed', Object.keys(data).length);
        } catch (error) {
            this.emit('warmupError', error);
            throw error;
        }
    }

    /**
     * Evict least recently used item
     */
    evictLRU() {
        if (this.accessOrder.size === 0) return;
        
        // Find least recently used key
        let oldestKey = null;
        let oldestTime = Infinity;
        
        for (const [key, time] of this.accessOrder) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.delete(oldestKey);
            this.metrics.evictions++;
            this.emit('eviction', oldestKey);
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, expirationTime] of this.expirationTimes) {
            if (now > expirationTime) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            this.delete(key);
        }
        
        if (expiredKeys.length > 0) {
            this.emit('cleanup', expiredKeys.length);
        }
    }

    /**
     * Update access order for LRU
     */
    updateAccessOrder(key) {
        this.accessOrder.set(key, Date.now());
    }

    /**
     * Check if key is expired
     */
    isExpired(key) {
        const expirationTime = this.expirationTimes.get(key);
        return expirationTime && Date.now() > expirationTime;
    }

    /**
     * Generate cache key
     */
    generateKey(key) {
        if (typeof key === 'string') {
            return key;
        }
        
        // For complex keys, create a hash
        return crypto.createHash('md5').update(JSON.stringify(key)).digest('hex');
    }

    /**
     * Update memory metrics
     */
    updateMemoryMetrics() {
        if (process.memoryUsage) {
            const memUsage = process.memoryUsage();
            this.metrics.memoryUsage = memUsage.heapUsed;
        }
    }

    /**
     * Destroy cache and cleanup
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        if (this.memoryMonitorTimer) {
            clearInterval(this.memoryMonitorTimer);
        }
        
        this.clear();
        this.removeAllListeners();
    }
}

/**
 * Distributed Cache Manager
 * Extends basic cache with distributed capabilities
 */
class DistributedCacheManager extends AdvancedCacheManager {
    constructor(options = {}) {
        super(options);
        
        this.nodeId = options.nodeId || this.generateNodeId();
        this.syncInterval = options.syncInterval || 30 * 1000; // 30 seconds
        this.enableSync = options.enableSync !== false;
        
        // Distributed cache state
        this.remoteNodes = new Map();
        this.syncQueue = [];
        
        if (this.enableSync) {
            this.syncTimer = setInterval(() => {
                this.syncWithNodes();
            }, this.syncInterval);
        }
    }

    /**
     * Set value with distributed sync
     */
    set(key, value, ttl = null) {
        const result = super.set(key, value, ttl);
        
        if (result && this.enableSync) {
            this.queueSync('set', key, value, ttl);
        }
        
        return result;
    }

    /**
     * Delete value with distributed sync
     */
    delete(key) {
        const result = super.delete(key);
        
        if (result && this.enableSync) {
            this.queueSync('delete', key);
        }
        
        return result;
    }

    /**
     * Add remote node
     */
    addNode(nodeId, endpoint) {
        this.remoteNodes.set(nodeId, {
            endpoint,
            lastSync: 0,
            status: 'active'
        });
        
        this.emit('nodeAdded', nodeId, endpoint);
    }

    /**
     * Remove remote node
     */
    removeNode(nodeId) {
        this.remoteNodes.delete(nodeId);
        this.emit('nodeRemoved', nodeId);
    }

    /**
     * Queue sync operation
     */
    queueSync(operation, key, value = null, ttl = null) {
        this.syncQueue.push({
            operation,
            key,
            value,
            ttl,
            timestamp: Date.now(),
            nodeId: this.nodeId
        });
    }

    /**
     * Sync with remote nodes
     */
    async syncWithNodes() {
        if (this.syncQueue.length === 0) return;
        
        const operations = this.syncQueue.splice(0, 100); // Batch sync
        
        for (const [nodeId, nodeInfo] of this.remoteNodes) {
            if (nodeInfo.status === 'active') {
                try {
                    await this.sendSyncToNode(nodeId, nodeInfo.endpoint, operations);
                    nodeInfo.lastSync = Date.now();
                } catch (error) {
                    console.error(`Failed to sync with node ${nodeId}:`, error.message);
                    nodeInfo.status = 'error';
                }
            }
        }
    }

    /**
     * Send sync operations to remote node
     */
    async sendSyncToNode(nodeId, endpoint, operations) {
        // This would implement actual network sync
        // For now, just emit an event
        this.emit('syncSent', nodeId, operations.length);
    }

    /**
     * Generate unique node ID
     */
    generateNodeId() {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get distributed cache stats
     */
    getDistributedStats() {
        const baseStats = this.getStats();
        
        return {
            ...baseStats,
            nodeId: this.nodeId,
            remoteNodes: this.remoteNodes.size,
            syncQueueSize: this.syncQueue.length,
            enableSync: this.enableSync
        };
    }
}

/**
 * Cache Factory
 * Creates appropriate cache instance based on configuration
 */
class CacheFactory {
    static createCache(type, options = {}) {
        switch (type) {
            case 'basic':
                return new AdvancedCacheManager(options);
            case 'distributed':
                return new DistributedCacheManager(options);
            default:
                throw new Error(`Unknown cache type: ${type}`);
        }
    }
}

module.exports = {
    AdvancedCacheManager,
    DistributedCacheManager,
    CacheFactory
};