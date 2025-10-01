/**
 * SommOS AI Response Cache Demo
 * Demonstrates the enhanced AI response caching functionality
 */

const { AIResponseCache } = require('../core/ai_response_cache');
const PairingEngine = require('../core/pairing_engine');

class AICacheDemo {
  constructor() {
    this.cache = new AIResponseCache({
      maxSize: 100,
      maxMemorySize: 50 * 1024 * 1024, // 50MB
      defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
      strategy: 'hybrid',
      prefix: 'demo_cache'
    });

    this.pairingEngine = new PairingEngine(
      null, // No database for demo
      null, // No learning engine for demo
      null, // No explainability service for demo
      {
        maxSize: 50,
        defaultTtl: 12 * 60 * 60 * 1000, // 12 hours
        strategy: 'hybrid'
      }
    );
  }

  async demonstrateBasicCaching() {
    console.log('\n=== Basic Caching Demo ===');
    
    const dish = 'grilled salmon';
    const context = { occasion: 'dinner', season: 'summer' };
    const preferences = { wine_type: 'white', budget: 'premium' };

    // First request - cache miss
    console.log('First request (cache miss):');
    const start1 = Date.now();
    const result1 = await this.simulatePairingRequest(dish, context, preferences);
    const time1 = Date.now() - start1;
    console.log(`Time: ${time1}ms, Cached: ${result1.cached}`);

    // Second request - cache hit
    console.log('\nSecond request (cache hit):');
    const start2 = Date.now();
    const result2 = await this.simulatePairingRequest(dish, context, preferences);
    const time2 = Date.now() - start2;
    console.log(`Time: ${time2}ms, Cached: ${result2.cached}`);

    console.log(`\nPerformance improvement: ${Math.round((time1 - time2) / time1 * 100)}% faster`);
  }

  async demonstrateCacheStrategies() {
    console.log('\n=== Cache Strategies Demo ===');
    
    const strategies = ['ttl', 'lru', 'lfu', 'hybrid'];
    
    for (const strategy of strategies) {
      console.log(`\nTesting ${strategy.toUpperCase()} strategy:`);
      
      const cache = new AIResponseCache({
        maxSize: 5,
        strategy: strategy,
        defaultTtl: 1000 // 1 second for demo
      });

      // Fill cache
      for (let i = 0; i < 7; i++) {
        await cache.set(`key${i}`, { data: `value${i}` });
      }

      const stats = cache.getStats();
      console.log(`Entries: ${stats.entries}, Strategy: ${stats.strategy}`);
      
      cache.destroy();
    }
  }

  async demonstrateTTLBehavior() {
    console.log('\n=== TTL Behavior Demo ===');
    
    const cache = new AIResponseCache({
      defaultTtl: 2000 // 2 seconds
    });

    // Store data
    await cache.set('short-lived', { data: 'expires in 2 seconds' }, 1000);
    await cache.set('long-lived', { data: 'expires in 5 seconds' }, 5000);

    // Check immediately
    console.log('Immediate check:');
    console.log('short-lived:', await cache.get('short-lived') ? 'found' : 'not found');
    console.log('long-lived:', await cache.get('long-lived') ? 'found' : 'not found');

    // Wait for first to expire
    console.log('\nAfter 1.5 seconds:');
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('short-lived:', await cache.get('short-lived') ? 'found' : 'not found');
    console.log('long-lived:', await cache.get('long-lived') ? 'found' : 'not found');

    // Wait for second to expire
    console.log('\nAfter 5.5 seconds:');
    await new Promise(resolve => setTimeout(resolve, 4000));
    console.log('short-lived:', await cache.get('short-lived') ? 'found' : 'not found');
    console.log('long-lived:', await cache.get('long-lived') ? 'found' : 'not found');

    cache.destroy();
  }

  async demonstrateCacheMetrics() {
    console.log('\n=== Cache Metrics Demo ===');
    
    const cache = new AIResponseCache({
      maxSize: 10
    });

    // Generate some traffic
    for (let i = 0; i < 20; i++) {
      const key = `key${i % 5}`; // Reuse keys to generate hits
      const cached = await cache.get(key);
      
      if (!cached) {
        await cache.set(key, { data: `value${i}`, timestamp: Date.now() });
      }
    }

    const stats = cache.getStats();
    console.log('Cache Statistics:');
    console.log(`Hits: ${stats.hits}`);
    console.log(`Misses: ${stats.misses}`);
    console.log(`Hit Rate: ${Math.round(stats.hitRate * 100)}%`);
    console.log(`Miss Rate: ${Math.round(stats.missRate * 100)}%`);
    console.log(`Total Requests: ${stats.totalRequests}`);
    console.log(`Entries: ${stats.entries}`);
    console.log(`Memory Usage: ${Math.round(stats.totalSize / 1024)}KB`);

    cache.destroy();
  }

  async demonstrateCacheInvalidation() {
    console.log('\n=== Cache Invalidation Demo ===');
    
    const cache = new AIResponseCache({
      prefix: 'invalidation_demo'
    });

    // Populate cache
    await cache.set('pairing_cache:salmon:abc123', { data: 'salmon pairing 1' });
    await cache.set('pairing_cache:salmon:def456', { data: 'salmon pairing 2' });
    await cache.set('pairing_cache:beef:ghi789', { data: 'beef pairing' });
    await cache.set('other_cache:jkl012', { data: 'other data' });

    console.log('Before invalidation:');
    console.log('salmon 1:', await cache.get('pairing_cache:salmon:abc123') ? 'found' : 'not found');
    console.log('salmon 2:', await cache.get('pairing_cache:salmon:def456') ? 'found' : 'not found');
    console.log('beef:', await cache.get('pairing_cache:beef:ghi789') ? 'found' : 'not found');
    console.log('other:', await cache.get('other_cache:jkl012') ? 'found' : 'not found');

    // Invalidate by pattern
    const count = await cache.invalidatePattern('pairing_cache:salmon:.*');
    console.log(`\nInvalidated ${count} salmon entries`);

    console.log('\nAfter invalidation:');
    console.log('salmon 1:', await cache.get('pairing_cache:salmon:abc123') ? 'found' : 'not found');
    console.log('salmon 2:', await cache.get('pairing_cache:salmon:def456') ? 'found' : 'not found');
    console.log('beef:', await cache.get('pairing_cache:beef:ghi789') ? 'found' : 'not found');
    console.log('other:', await cache.get('other_cache:jkl012') ? 'found' : 'not found');

    cache.destroy();
  }

  async demonstrateCacheWarmup() {
    console.log('\n=== Cache Warmup Demo ===');
    
    const cache = new AIResponseCache();

    const commonPairings = [
      {
        dish: 'grilled salmon',
        context: { occasion: 'dinner' },
        preferences: { wine_type: 'white' },
        data: { recommendations: ['Chardonnay', 'Sauvignon Blanc'] },
        ttl: 10000
      },
      {
        dish: 'roasted beef',
        context: { occasion: 'dinner' },
        preferences: { wine_type: 'red' },
        data: { recommendations: ['Cabernet Sauvignon', 'Merlot'] },
        ttl: 10000
      }
    ];

    console.log('Warming up cache with common pairings...');
    await cache.warmup(commonPairings);

    const stats = cache.getStats();
    console.log(`Cache warmed up with ${stats.entries} entries`);

    // Test retrieval
    const key1 = cache.generateCacheKey('grilled salmon', { occasion: 'dinner' }, { wine_type: 'white' });
    const key2 = cache.generateCacheKey('roasted beef', { occasion: 'dinner' }, { wine_type: 'red' });

    console.log('Salmon pairing:', await cache.get(key1) ? 'found' : 'not found');
    console.log('Beef pairing:', await cache.get(key2) ? 'found' : 'not found');

    cache.destroy();
  }

  async demonstrateCacheExportImport() {
    console.log('\n=== Cache Export/Import Demo ===');
    
    const cache1 = new AIResponseCache({ prefix: 'export_demo' });
    
    // Populate first cache
    await cache1.set('key1', { data: 'value1' });
    await cache1.set('key2', { data: 'value2' });

    // Export data
    const exportData = await cache1.export();
    console.log(`Exported ${exportData.entries.length} entries`);

    // Create new cache and import
    const cache2 = new AIResponseCache({ prefix: 'import_demo' });
    await cache2.import(exportData);

    // Verify import
    console.log('key1 in new cache:', await cache2.get('key1') ? 'found' : 'not found');
    console.log('key2 in new cache:', await cache2.get('key2') ? 'found' : 'not found');

    cache1.destroy();
    cache2.destroy();
  }

  async simulatePairingRequest(dish, context, preferences) {
    const cacheKey = this.cache.generateCacheKey(dish, context, preferences);
    
    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate mock response
    const response = {
      recommendations: [
        { wine: { name: 'Chardonnay', producer: 'Test Winery' }, score: 0.95 },
        { wine: { name: 'Sauvignon Blanc', producer: 'Test Winery' }, score: 0.88 }
      ],
      explanation: {
        summary: `Excellent pairing for ${dish}`,
        factors: ['flavor harmony', 'texture balance']
      },
      cached: false,
      generatedAt: new Date().toISOString()
    };

    // Cache the response
    await this.cache.set(cacheKey, response, 60000); // 1 minute TTL for demo

    return response;
  }

  async runDemo() {
    console.log('🍷 SommOS AI Response Cache Demo');
    console.log('=====================================');

    try {
      await this.demonstrateBasicCaching();
      await this.demonstrateCacheStrategies();
      await this.demonstrateTTLBehavior();
      await this.demonstrateCacheMetrics();
      await this.demonstrateCacheInvalidation();
      await this.demonstrateCacheWarmup();
      await this.demonstrateCacheExportImport();

      console.log('\n✅ Demo completed successfully!');
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
    } finally {
      this.cache.destroy();
    }
  }
}

// Run demo if called directly
if (require.main === module) {
  const demo = new AICacheDemo();
  demo.runDemo().catch(console.error);
}

module.exports = AICacheDemo;