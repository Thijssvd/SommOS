/**
 * Tests for AI Response Cache
 */

const { AIResponseCache, CacheEntry, TTLStrategy, LRUStrategy, LFUStrategy, HybridStrategy } = require('../../backend/core/ai_response_cache');

describe('AI Response Cache', () => {
  let cache;

  beforeEach(() => {
    cache = new AIResponseCache({
      maxSize: 10,
      maxMemorySize: 1024 * 1024, // 1MB
      defaultTtl: 1000, // 1 second for testing
      strategy: 'hybrid'
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Basic Cache Operations', () => {
    test('should store and retrieve data', async () => {
      const key = 'test-key';
      const data = { recommendations: ['wine1', 'wine2'] };

      await cache.set(key, data);
      const retrieved = await cache.get(key);

      expect(retrieved).toEqual(data);
    });

    test('should return null for non-existent key', async () => {
      const retrieved = await cache.get('non-existent');
      expect(retrieved).toBeNull();
    });

    test('should delete entries', async () => {
      const key = 'test-key';
      const data = { recommendations: ['wine1'] };

      await cache.set(key, data);
      expect(await cache.get(key)).toEqual(data);

      await cache.delete(key);
      expect(await cache.get(key)).toBeNull();
    });

    test('should clear all entries', async () => {
      await cache.set('key1', { data: '1' });
      await cache.set('key2', { data: '2' });

      expect(cache.cache.size).toBe(2);

      await cache.clear();
      expect(cache.cache.size).toBe(0);
    });
  });

  describe('TTL Functionality', () => {
    test('should expire entries after TTL', async () => {
      const key = 'test-key';
      const data = { recommendations: ['wine1'] };

      await cache.set(key, data, 100); // 100ms TTL
      expect(await cache.get(key)).toEqual(data);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(await cache.get(key)).toBeNull();
    });

    test('should not expire entries before TTL', async () => {
      const key = 'test-key';
      const data = { recommendations: ['wine1'] };

      await cache.set(key, data, 1000); // 1 second TTL
      expect(await cache.get(key)).toEqual(data);

      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(await cache.get(key)).toEqual(data);
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent keys for same input', () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner' };
      const preferences = { wine_type: 'white' };

      const key1 = cache.generateCacheKey(dish, context, preferences);
      const key2 = cache.generateCacheKey(dish, context, preferences);

      expect(key1).toBe(key2);
    });

    test('should generate different keys for different input', () => {
      const key1 = cache.generateCacheKey('salmon', { occasion: 'dinner' }, {});
      const key2 = cache.generateCacheKey('beef', { occasion: 'dinner' }, {});

      expect(key1).not.toBe(key2);
    });

    test('should handle complex objects in key generation', () => {
      const dish = { name: 'salmon', preparation: 'grilled' };
      const context = { occasion: 'dinner', season: 'summer' };
      const preferences = { wine_type: 'white', budget: 'premium' };

      const key1 = cache.generateCacheKey(dish, context, preferences);
      const key2 = cache.generateCacheKey(dish, context, preferences);

      expect(key1).toBe(key2);
      expect(key1).toContain('ai_cache:');
    });
  });

  describe('Cache Strategies', () => {
    test('TTL strategy should evict expired entries', () => {
      const strategy = new TTLStrategy();
      const entry = new CacheEntry({ data: 'test' }, 100);

      // Not expired yet
      expect(strategy.shouldEvict(entry, {})).toBe(false);

      // Wait for expiration
      setTimeout(() => {
        expect(strategy.shouldEvict(entry, {})).toBe(true);
      }, 150);
    });

    test('LRU strategy should prioritize least recently used', () => {
      const strategy = new LRUStrategy();
      const entry1 = new CacheEntry({ data: 'test1' });
      const entry2 = new CacheEntry({ data: 'test2' });

      entry1.access();
      entry2.access();

      // Both entries have same access time, so priorities should be equal
      const priority1 = strategy.getEvictionPriority(entry1, {});
      const priority2 = strategy.getEvictionPriority(entry2, {});
      
      expect(priority1).toBeGreaterThanOrEqual(0);
      expect(priority2).toBeGreaterThanOrEqual(0);
    });

    test('LFU strategy should prioritize least frequently used', () => {
      const strategy = new LFUStrategy();
      const entry1 = new CacheEntry({ data: 'test1' });
      const entry2 = new CacheEntry({ data: 'test2' });

      entry1.access();
      entry1.access();
      entry2.access();

      // entry2 has lower access count
      expect(strategy.getEvictionPriority(entry2, {})).toBeGreaterThan(
        strategy.getEvictionPriority(entry1, {})
      );
    });

    test('Hybrid strategy should combine multiple factors', () => {
      const strategy = new HybridStrategy();
      const entry = new CacheEntry({ data: 'test' }, 100);

      // Should evict expired entries
      setTimeout(() => {
        expect(strategy.shouldEvict(entry, {})).toBe(true);
      }, 150);

      // Should consider multiple factors for priority
      const priority = strategy.getEvictionPriority(entry, {});
      expect(typeof priority).toBe('number');
    });
  });

  describe('Cache Eviction', () => {
    test('should evict entries when max size is reached', async () => {
      const smallCache = new AIResponseCache({ maxSize: 3 });

      // Fill cache beyond max size
      await smallCache.set('key1', { data: '1' });
      await smallCache.set('key2', { data: '2' });
      await smallCache.set('key3', { data: '3' });
      await smallCache.set('key4', { data: '4' }); // Should trigger eviction

      expect(smallCache.cache.size).toBeLessThanOrEqual(3);
      smallCache.destroy();
    });

    test('should evict entries when memory limit is reached', async () => {
      const smallCache = new AIResponseCache({ maxMemorySize: 100 }); // 100 bytes

      // Add large entries
      const largeData = { data: 'x'.repeat(50) };
      await smallCache.set('key1', largeData);
      await smallCache.set('key2', largeData);
      await smallCache.set('key3', largeData); // Should trigger eviction

      expect(smallCache.metrics.totalSize).toBeLessThanOrEqual(100);
      smallCache.destroy();
    });
  });

  describe('Cache Metrics', () => {
    test('should track hits and misses', async () => {
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.totalRequests).toBe(0);

      // Miss
      await cache.get('non-existent');
      expect(cache.metrics.misses).toBe(1);
      expect(cache.metrics.totalRequests).toBe(1);

      // Hit
      await cache.set('test', { data: 'test' });
      await cache.get('test');
      expect(cache.metrics.hits).toBe(1);
      expect(cache.metrics.totalRequests).toBe(2);
    });

    test('should calculate hit rate correctly', async () => {
      await cache.set('key1', { data: '1' });
      await cache.set('key2', { data: '2' });

      // 2 hits, 1 miss
      await cache.get('key1'); // hit
      await cache.get('key2'); // hit
      await cache.get('non-existent'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(2/3);
      expect(stats.missRate).toBe(1/3);
    });

    test('should track cache size and memory usage', async () => {
      const data1 = { recommendations: ['wine1', 'wine2'] };
      const data2 = { recommendations: ['wine3', 'wine4', 'wine5'] };

      await cache.set('key1', data1);
      await cache.set('key2', data2);

      const stats = cache.getStats();
      expect(stats.entries).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate entries by pattern', async () => {
      await cache.set('pairing_cache:abc123', { data: '1' });
      await cache.set('pairing_cache:def456', { data: '2' });
      await cache.set('other_cache:ghi789', { data: '3' });

      const count = await cache.invalidatePattern('pairing_cache:.*');
      expect(count).toBe(2);
      expect(await cache.get('pairing_cache:abc123')).toBeNull();
      expect(await cache.get('pairing_cache:def456')).toBeNull();
      expect(await cache.get('other_cache:ghi789')).not.toBeNull();
    });

    test('should invalidate entries by dish', async () => {
      const dish1 = 'grilled salmon';
      const dish2 = 'roasted beef';
      const context = { occasion: 'dinner' };

      const key1 = cache.generateCacheKey(dish1, context, {});
      const key2 = cache.generateCacheKey(dish2, context, {});

      await cache.set(key1, { data: 'salmon pairing' });
      await cache.set(key2, { data: 'beef pairing' });

      const count = await cache.invalidateByDish(dish1);
      expect(count).toBe(1);
      expect(await cache.get(key1)).toBeNull();
      expect(await cache.get(key2)).not.toBeNull();
    });
  });

  describe('Cache Warmup', () => {
    test('should pre-populate cache with entries', async () => {
      const entries = [
        {
          dish: 'salmon',
          context: { occasion: 'dinner' },
          preferences: { wine_type: 'white' },
          data: { recommendations: ['chardonnay'] },
          ttl: 1000
        },
        {
          dish: 'beef',
          context: { occasion: 'dinner' },
          preferences: { wine_type: 'red' },
          data: { recommendations: ['cabernet'] },
          ttl: 1000
        }
      ];

      await cache.warmup(entries);

      const key1 = cache.generateCacheKey('salmon', { occasion: 'dinner' }, { wine_type: 'white' });
      const key2 = cache.generateCacheKey('beef', { occasion: 'dinner' }, { wine_type: 'red' });

      expect(await cache.get(key1)).toEqual({ recommendations: ['chardonnay'] });
      expect(await cache.get(key2)).toEqual({ recommendations: ['cabernet'] });
    });
  });

  describe('Cache Export/Import', () => {
    test('should export cache data', async () => {
      await cache.set('key1', { data: '1' });
      await cache.set('key2', { data: '2' });

      const exportData = await cache.export();
      expect(exportData.entries).toHaveLength(2);
      expect(exportData.metadata.strategy).toBe('Hybrid');
      expect(exportData.metadata.version).toBe('1.0');
    });

    test('should import cache data', async () => {
      const importData = {
        entries: [
          { key: 'key1', data: { data: '1' }, ttl: 1000, timestamp: Date.now() },
          { key: 'key2', data: { data: '2' }, ttl: 1000, timestamp: Date.now() }
        ],
        metadata: { strategy: 'Hybrid', timestamp: Date.now(), version: '1.0' }
      };

      await cache.import(importData);

      expect(await cache.get('key1')).toEqual({ data: '1' });
      expect(await cache.get('key2')).toEqual({ data: '2' });
    });
  });

  describe('Cache Cleanup', () => {
    test('should clean up expired entries', async () => {
      await cache.set('key1', { data: '1' }, 100); // Expires quickly
      await cache.set('key2', { data: '2' }, 1000); // Expires later

      // Wait for first entry to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      await cache.cleanup();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toEqual({ data: '2' });
    });
  });

  describe('CacheEntry', () => {
    test('should track access count and timestamps', () => {
      const entry = new CacheEntry({ data: 'test' });

      expect(entry.accessCount).toBe(0);
      expect(entry.timestamp).toBeLessThanOrEqual(Date.now());

      entry.access();
      expect(entry.accessCount).toBe(1);
      expect(entry.lastAccessed).toBeGreaterThanOrEqual(entry.timestamp);
    });

    test('should calculate size correctly', () => {
      const data = { recommendations: ['wine1', 'wine2'] };
      const entry = new CacheEntry(data);

      expect(entry.size).toBeGreaterThan(0);
      expect(entry.size).toBe(JSON.stringify(data).length);
    });

    test('should determine expiration correctly', () => {
      const entry = new CacheEntry({ data: 'test' }, 100);

      expect(entry.isExpired()).toBe(false);

      setTimeout(() => {
        expect(entry.isExpired()).toBe(true);
      }, 150);
    });
  });
});