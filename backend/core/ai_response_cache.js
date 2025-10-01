/**
 * SommOS AI Response Cache
 * Advanced caching system for AI pairing responses with multiple strategies
 */

const crypto = require('crypto');

class CacheEntry {
  constructor(data, ttl = 24 * 60 * 60 * 1000) {
    this.data = data;
    this.timestamp = Date.now();
    this.ttl = ttl;
    this.accessCount = 0;
    this.lastAccessed = Date.now();
    this.size = this.calculateSize(data);
  }

  isExpired() {
    return Date.now() - this.timestamp > this.ttl;
  }

  isStale(maxAge = 60 * 60 * 1000) { // 1 hour default
    return Date.now() - this.timestamp > maxAge;
  }

  access() {
    this.accessCount++;
    this.lastAccessed = Date.now();
  }

  calculateSize(data) {
    try {
      return JSON.stringify(data).length;
    } catch (error) {
      return 0;
    }
  }

  getAge() {
    return Date.now() - this.timestamp;
  }

  getTimeSinceLastAccess() {
    return Date.now() - this.lastAccessed;
  }
}

class CacheStrategy {
  constructor(name) {
    this.name = name;
  }

  shouldEvict(entry, context) {
    throw new Error('shouldEvict must be implemented by subclass');
  }

  getEvictionPriority(entry, context) {
    throw new Error('getEvictionPriority must be implemented by subclass');
  }
}

class TTLStrategy extends CacheStrategy {
  constructor() {
    super('TTL');
  }

  shouldEvict(entry, context) {
    return entry.isExpired();
  }

  getEvictionPriority(entry, context) {
    // Higher priority for eviction = more likely to be evicted
    return entry.getAge();
  }
}

class LRUStrategy extends CacheStrategy {
  constructor() {
    super('LRU');
  }

  shouldEvict(entry, context) {
    return false; // LRU doesn't evict based on time
  }

  getEvictionPriority(entry, context) {
    // Higher priority for eviction = more likely to be evicted
    return entry.getTimeSinceLastAccess();
  }
}

class LFUStrategy extends CacheStrategy {
  constructor() {
    super('LFU');
  }

  shouldEvict(entry, context) {
    return false; // LFU doesn't evict based on time
  }

  getEvictionPriority(entry, context) {
    // Higher priority for eviction = more likely to be evicted
    // Lower access count = higher eviction priority
    return -entry.accessCount;
  }
}

class HybridStrategy extends CacheStrategy {
  constructor() {
    super('Hybrid');
  }

  shouldEvict(entry, context) {
    return entry.isExpired();
  }

  getEvictionPriority(entry, context) {
    // Combine LRU and LFU with recency bias
    const recencyScore = entry.getTimeSinceLastAccess();
    const frequencyScore = -entry.accessCount;
    const ageScore = entry.getAge();
    
    // Weight: 40% recency, 30% frequency, 30% age
    return (recencyScore * 0.4) + (frequencyScore * 0.3) + (ageScore * 0.3);
  }
}

class CacheMetrics {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.totalRequests = 0;
    this.totalSize = 0;
    this.entries = 0;
    this.startTime = Date.now();
  }

  recordHit() {
    this.hits++;
    this.totalRequests++;
  }

  recordMiss() {
    this.misses++;
    this.totalRequests++;
  }

  recordEviction() {
    this.evictions++;
  }

  updateSize(sizeChange) {
    this.totalSize += sizeChange;
  }

  updateEntries(entryChange) {
    this.entries += entryChange;
  }

  getHitRate() {
    return this.totalRequests > 0 ? this.hits / this.totalRequests : 0;
  }

  getMissRate() {
    return this.totalRequests > 0 ? this.misses / this.totalRequests : 0;
  }

  getAverageSize() {
    return this.entries > 0 ? this.totalSize / this.entries : 0;
  }

  getUptime() {
    return Date.now() - this.startTime;
  }

  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      totalRequests: this.totalRequests,
      hitRate: this.getHitRate(),
      missRate: this.getMissRate(),
      totalSize: this.totalSize,
      entries: this.entries,
      averageSize: this.getAverageSize(),
      uptime: this.getUptime()
    };
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.totalRequests = 0;
    this.totalSize = 0;
    this.entries = 0;
    this.startTime = Date.now();
  }
}

class AIResponseCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000; // Maximum number of entries
    this.maxMemorySize = options.maxMemorySize || 100 * 1024 * 1024; // 100MB
    this.defaultTtl = options.defaultTtl || 24 * 60 * 60 * 1000; // 24 hours
    this.cleanupInterval = options.cleanupInterval || 60 * 60 * 1000; // 1 hour
    this.strategy = this.createStrategy(options.strategy || 'hybrid');
    this.metrics = new CacheMetrics();
    this.compressionEnabled = options.compressionEnabled || false;
    this.prefix = options.prefix || 'ai_cache';
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    // Bind methods
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.delete = this.delete.bind(this);
    this.clear = this.clear.bind(this);
  }

  createStrategy(strategyName) {
    switch (strategyName.toLowerCase()) {
      case 'ttl':
        return new TTLStrategy();
      case 'lru':
        return new LRUStrategy();
      case 'lfu':
        return new LFUStrategy();
      case 'hybrid':
      default:
        return new HybridStrategy();
    }
  }

  generateCacheKey(dish, context, preferences = {}) {
    // Create a deterministic key from the input parameters
    const keyData = {
      dish: typeof dish === 'string' ? dish : JSON.stringify(dish),
      context: context || {},
      preferences: preferences || {}
    };

    // Sort keys to ensure consistent hashing
    const sortedKey = JSON.stringify(keyData, Object.keys(keyData).sort());
    
    // Generate hash
    const hash = crypto.createHash('sha256').update(sortedKey).digest('hex');
    return `${this.prefix}:${hash}`;
  }

  async get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.recordMiss();
      return null;
    }

    // Check if expired
    if (this.strategy.shouldEvict(entry, { cache: this.cache })) {
      this.cache.delete(key);
      this.metrics.recordEviction();
      this.metrics.updateSize(-entry.size);
      this.metrics.updateEntries(-1);
      this.metrics.recordMiss();
      return null;
    }

    // Record access
    entry.access();
    this.metrics.recordHit();
    
    return entry.data;
  }

  async set(key, data, ttl = null) {
    const entryTtl = ttl || this.defaultTtl;
    const entry = new CacheEntry(data, entryTtl);
    
    // Check if we need to evict entries
    await this.ensureCapacity(entry.size);
    
    // Store the entry
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.metrics.updateSize(-existingEntry.size);
    } else {
      this.metrics.updateEntries(1);
    }
    
    this.cache.set(key, entry);
    this.metrics.updateSize(entry.size);
    
    return true;
  }

  async delete(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.metrics.updateSize(-entry.size);
      this.metrics.updateEntries(-1);
      return true;
    }
    return false;
  }

  async clear() {
    this.cache.clear();
    this.metrics.reset();
  }

  async ensureCapacity(newEntrySize) {
    // Check memory size limit
    if (this.metrics.totalSize + newEntrySize > this.maxMemorySize) {
      await this.evictByMemorySize(newEntrySize);
    }
    
    // Check entry count limit
    if (this.cache.size >= this.maxSize) {
      await this.evictByCount();
    }
  }

  async evictByMemorySize(requiredSpace) {
    const entries = Array.from(this.cache.entries());
    const sortedEntries = entries.sort((a, b) => 
      this.strategy.getEvictionPriority(b[1], { cache: this.cache }) - 
      this.strategy.getEvictionPriority(a[1], { cache: this.cache })
    );

    let freedSpace = 0;
    for (const [key, entry] of sortedEntries) {
      this.cache.delete(key);
      this.metrics.updateSize(-entry.size);
      this.metrics.updateEntries(-1);
      this.metrics.recordEviction();
      freedSpace += entry.size;
      
      if (freedSpace >= requiredSpace) {
        break;
      }
    }
  }

  async evictByCount() {
    const entries = Array.from(this.cache.entries());
    const sortedEntries = entries.sort((a, b) => 
      this.strategy.getEvictionPriority(b[1], { cache: this.cache }) - 
      this.strategy.getEvictionPriority(a[1], { cache: this.cache })
    );

    // Evict 10% of entries or at least 1
    const evictCount = Math.max(1, Math.floor(this.cache.size * 0.1));
    
    for (let i = 0; i < evictCount && i < sortedEntries.length; i++) {
      const [key, entry] = sortedEntries[i];
      this.cache.delete(key);
      this.metrics.updateSize(-entry.size);
      this.metrics.updateEntries(-1);
      this.metrics.recordEviction();
    }
  }

  startCleanupInterval() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  stopCleanupInterval() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  async cleanup() {
    const expiredKeys = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.strategy.shouldEvict(entry, { cache: this.cache })) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      const entry = this.cache.get(key);
      this.cache.delete(key);
      this.metrics.updateSize(-entry.size);
      this.metrics.updateEntries(-1);
      this.metrics.recordEviction();
    }
    
    if (expiredKeys.length > 0) {
      console.log(`AI Cache: Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  getStats() {
    return {
      ...this.metrics.getStats(),
      strategy: this.strategy.name,
      maxSize: this.maxSize,
      maxMemorySize: this.maxMemorySize,
      currentSize: this.cache.size,
      currentMemorySize: this.metrics.totalSize
    };
  }

  async invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      await this.delete(key);
    }
    
    return keysToDelete.length;
  }

  async invalidateByDish(dishPattern) {
    // Invalidate all entries that match a dish pattern
    const dishKey = this.generateCacheKey(dishPattern, {}, {});
    const pattern = dishKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return await this.invalidatePattern(pattern);
  }

  async invalidateByContext(contextPattern) {
    // Invalidate all entries that match a context pattern
    const contextKey = this.generateCacheKey('', contextPattern, {});
    const pattern = contextKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return await this.invalidatePattern(pattern);
  }

  async warmup(entries) {
    // Pre-populate cache with known good entries
    for (const entry of entries) {
      const key = this.generateCacheKey(entry.dish, entry.context, entry.preferences);
      await this.set(key, entry.data, entry.ttl);
    }
  }

  async export() {
    // Export cache data for persistence
    const exportData = {
      entries: [],
      metadata: {
        strategy: this.strategy.name,
        timestamp: Date.now(),
        version: '1.0'
      }
    };
    
    for (const [key, entry] of this.cache.entries()) {
      if (!entry.isExpired()) {
        exportData.entries.push({
          key,
          data: entry.data,
          ttl: entry.ttl,
          timestamp: entry.timestamp
        });
      }
    }
    
    return exportData;
  }

  async import(importData) {
    // Import cache data from persistence
    if (!importData || !importData.entries) {
      throw new Error('Invalid import data');
    }
    
    for (const entry of importData.entries) {
      await this.set(entry.key, entry.data, entry.ttl);
    }
  }

  destroy() {
    this.stopCleanupInterval();
    this.clear();
  }
}

module.exports = {
  AIResponseCache,
  CacheEntry,
  CacheStrategy,
  TTLStrategy,
  LRUStrategy,
  LFUStrategy,
  HybridStrategy,
  CacheMetrics
};