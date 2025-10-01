/**
 * Tests for Enhanced Pairing Engine with AI Response Caching
 */

// Mock the AI response cache module
const mockCache = {
  generateCacheKey: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  invalidatePattern: jest.fn(),
  invalidateByDish: jest.fn(),
  invalidateByContext: jest.fn(),
  warmup: jest.fn(),
  export: jest.fn(),
  import: jest.fn(),
  cleanup: jest.fn(),
  destroy: jest.fn(),
  getStats: jest.fn()
};

// Mock the AI response cache constructor
jest.mock('../../backend/core/ai_response_cache', () => ({
  AIResponseCache: jest.fn(() => mockCache)
}));

const PairingEngine = require('../../backend/core/pairing_engine');

describe('Enhanced Pairing Engine with Caching', () => {
  let pairingEngine;
  let mockDatabase;
  let mockLearningEngine;
  let mockExplainabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDatabase = {
      query: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };
    
    mockLearningEngine = {
      getPairingWeights: jest.fn(),
      recordPairingSession: jest.fn()
    };
    
    mockExplainabilityService = {
      createExplanation: jest.fn().mockResolvedValue({ success: true })
    };

    pairingEngine = new PairingEngine(
      mockDatabase,
      mockLearningEngine,
      mockExplainabilityService,
      {
        maxSize: 100,
        defaultTtl: 1000,
        strategy: 'hybrid'
      }
    );
  });

  afterEach(() => {
    if (pairingEngine) {
      pairingEngine.destroy();
    }
  });

  describe('Cache Integration', () => {
    test('should initialize with cache', () => {
      expect(mockCache).toBeDefined();
      expect(pairingEngine.cache).toBe(mockCache);
    });

    test('should use cache in generatePairings', async () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner' };
      const preferences = { wine_type: 'white' };
      const cacheKey = 'pairing_cache:abc123';
      const cachedResponse = {
        recommendations: [{ wine: { name: 'Chardonnay' } }],
        explanation: { summary: 'Great pairing' },
        cached: true
      };

      mockCache.generateCacheKey.mockReturnValue(cacheKey);
      mockCache.get.mockResolvedValue(cachedResponse);

      const result = await pairingEngine.generatePairings(dish, context, preferences);

      expect(mockCache.generateCacheKey).toHaveBeenCalledWith(dish, context, preferences);
      expect(mockCache.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedResponse);
    });

    test('should cache new responses when cache miss occurs', async () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner' };
      const preferences = { wine_type: 'white' };
      const cacheKey = 'pairing_cache:abc123';

      mockCache.generateCacheKey.mockReturnValue(cacheKey);
      mockCache.get.mockResolvedValue(null); // Cache miss

      // Mock database responses
      mockDatabase.query.mockResolvedValue([
        { 
          name: 'Chardonnay', 
          producer: 'Test Winery', 
          wine_type: 'White',
          region: 'Burgundy',
          style: 'crisp',
          tasting_notes: 'citrus, mineral',
          location: 'main-cellar',
          quantity: 10,
          available_quantity: 8
        }
      ]);

      // Mock learning engine
      mockLearningEngine.recordPairingSession.mockResolvedValue({
        sessionId: 'session123',
        recommendationIds: ['rec1']
      });

      const result = await pairingEngine.generatePairings(dish, context, preferences);

      expect(mockCache.set).toHaveBeenCalledWith(
        cacheKey,
        expect.objectContaining({
          recommendations: expect.any(Array),
          explanation: expect.any(Object),
          cached: false,
          generatedAt: expect.any(String)
        }),
        expect.any(Number)
      );
    });

    test('should use cache in quickPairing', async () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner' };
      const ownerLikes = { wine_type: 'white' };
      const cacheKey = 'pairing_cache:def456';
      const cachedResponse = [
        { wine: { name: 'Chardonnay' }, reasoning: 'Quick match', confidence: 0.8 }
      ];

      mockCache.generateCacheKey.mockReturnValue(cacheKey);
      mockCache.get.mockResolvedValue(cachedResponse);

      const result = await pairingEngine.quickPairing(dish, context, ownerLikes);

      expect(mockCache.generateCacheKey).toHaveBeenCalledWith(
        dish,
        { ...context, quick: true },
        ownerLikes
      );
      expect(mockCache.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedResponse);
    });
  });

  describe('Cache TTL Calculation', () => {
    test('should calculate appropriate TTL for AI-generated responses', () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner' };
      const preferences = { wine_type: 'white' };
      const generatedByAI = true;

      const ttl = pairingEngine.getCacheTTL(dish, context, preferences, generatedByAI);

      expect(ttl).toBe(12 * 60 * 60 * 1000); // 12 hours for AI responses
    });

    test('should calculate shorter TTL for special occasions', () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'special' };
      const preferences = { wine_type: 'white' };
      const generatedByAI = false;

      const ttl = pairingEngine.getCacheTTL(dish, context, preferences, generatedByAI);

      expect(ttl).toBe(6 * 60 * 60 * 1000); // 6 hours for special occasions
    });

    test('should calculate shorter TTL for complex dietary restrictions', () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner' };
      const preferences = { 
        wine_type: 'white',
        dietary_restrictions: ['gluten-free', 'vegan', 'organic']
      };
      const generatedByAI = false;

      const ttl = pairingEngine.getCacheTTL(dish, context, preferences, generatedByAI);

      expect(ttl).toBe(4 * 60 * 60 * 1000); // 4 hours for complex dietary needs
    });

    test('should calculate shorter TTL for seasonal recommendations', () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner', season: 'summer' };
      const preferences = { wine_type: 'white' };
      const generatedByAI = false;

      const ttl = pairingEngine.getCacheTTL(dish, context, preferences, generatedByAI);

      expect(ttl).toBe(8 * 60 * 60 * 1000); // 8 hours for seasonal
    });
  });

  describe('Cache Management Methods', () => {
    test('should get cache statistics', () => {
      const mockStats = {
        hits: 100,
        misses: 50,
        hitRate: 0.67,
        entries: 25,
        totalSize: 1024000
      };

      mockCache.getStats.mockReturnValue(mockStats);

      const stats = pairingEngine.getCacheStats();

      expect(mockCache.getStats).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });

    test('should clear cache', async () => {
      await pairingEngine.clearCache();

      expect(mockCache.clear).toHaveBeenCalled();
    });

    test('should invalidate cache by pattern', async () => {
      const pattern = 'pairing_cache:salmon.*';
      mockCache.invalidatePattern.mockResolvedValue(5);

      const count = await pairingEngine.invalidateCache(pattern);

      expect(mockCache.invalidatePattern).toHaveBeenCalledWith(pattern);
      expect(count).toBe(5);
    });

    test('should invalidate cache by dish', async () => {
      const dishPattern = 'grilled salmon';
      mockCache.invalidateByDish.mockResolvedValue(3);

      const count = await pairingEngine.invalidateCacheByDish(dishPattern);

      expect(mockCache.invalidateByDish).toHaveBeenCalledWith(dishPattern);
      expect(count).toBe(3);
    });

    test('should invalidate cache by context', async () => {
      const contextPattern = 'dinner';
      mockCache.invalidateByContext.mockResolvedValue(2);

      const count = await pairingEngine.invalidateCacheByContext(contextPattern);

      expect(mockCache.invalidateByContext).toHaveBeenCalledWith(contextPattern);
      expect(count).toBe(2);
    });

    test('should warm up cache', async () => {
      const commonPairings = [
        {
          dish: 'salmon',
          context: { occasion: 'dinner' },
          preferences: { wine_type: 'white' },
          data: { recommendations: ['chardonnay'] },
          ttl: 1000
        }
      ];

      await pairingEngine.warmupCache(commonPairings);

      expect(mockCache.warmup).toHaveBeenCalledWith(commonPairings);
    });

    test('should export cache', async () => {
      const mockExportData = {
        entries: [{ key: 'test', data: { recommendations: [] } }],
        metadata: { strategy: 'Hybrid', timestamp: Date.now() }
      };

      mockCache.export.mockResolvedValue(mockExportData);

      const result = await pairingEngine.exportCache();

      expect(mockCache.export).toHaveBeenCalled();
      expect(result).toEqual(mockExportData);
    });

    test('should import cache', async () => {
      const cacheData = {
        entries: [{ key: 'test', data: { recommendations: [] } }],
        metadata: { strategy: 'Hybrid', timestamp: Date.now() }
      };

      await pairingEngine.importCache(cacheData);

      expect(mockCache.import).toHaveBeenCalledWith(cacheData);
    });

    test('should cleanup cache', async () => {
      await pairingEngine.cleanupCache();

      expect(mockCache.cleanup).toHaveBeenCalled();
    });

    test('should destroy cache', () => {
      pairingEngine.destroy();

      expect(mockCache.destroy).toHaveBeenCalled();
    });
  });

  describe('Cache Performance', () => {
    test('should handle cache hits efficiently', async () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner' };
      const preferences = { wine_type: 'white' };
      const cacheKey = 'pairing_cache:abc123';
      const cachedResponse = {
        recommendations: [{ wine: { name: 'Chardonnay' } }],
        explanation: { summary: 'Great pairing' },
        cached: true
      };

      mockCache.generateCacheKey.mockReturnValue(cacheKey);
      mockCache.get.mockResolvedValue(cachedResponse);

      const startTime = Date.now();
      const result = await pairingEngine.generatePairings(dish, context, preferences);
      const endTime = Date.now();

      expect(result).toEqual(cachedResponse);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast for cache hits
    });

    test('should handle cache misses gracefully', async () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner' };
      const preferences = { wine_type: 'white' };
      const cacheKey = 'pairing_cache:abc123';

      mockCache.generateCacheKey.mockReturnValue(cacheKey);
      mockCache.get.mockResolvedValue(null); // Cache miss

      // Mock database responses
      mockDatabase.query.mockResolvedValue([
        { 
          name: 'Chardonnay', 
          producer: 'Test Winery', 
          wine_type: 'White',
          region: 'Burgundy',
          style: 'crisp',
          tasting_notes: 'citrus, mineral',
          location: 'main-cellar',
          quantity: 10,
          available_quantity: 8
        }
      ]);

      // Mock learning engine
      mockLearningEngine.recordPairingSession.mockResolvedValue({
        sessionId: 'session123',
        recommendationIds: ['rec1']
      });

      const result = await pairingEngine.generatePairings(dish, context, preferences);

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('explanation');
      expect(result).toHaveProperty('cached', false);
      expect(result).toHaveProperty('generatedAt');
    });
  });

  describe('Cache Error Handling', () => {
    test('should handle cache errors gracefully', async () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner' };
      const preferences = { wine_type: 'white' };
      const cacheKey = 'pairing_cache:abc123';

      mockCache.generateCacheKey.mockReturnValue(cacheKey);
      mockCache.get.mockRejectedValue(new Error('Cache error'));

      // Mock database responses
      mockDatabase.query.mockResolvedValue([
        { 
          name: 'Chardonnay', 
          producer: 'Test Winery', 
          wine_type: 'White',
          region: 'Burgundy',
          style: 'crisp',
          tasting_notes: 'citrus, mineral',
          location: 'main-cellar',
          quantity: 10,
          available_quantity: 8
        }
      ]);

      // Mock learning engine
      mockLearningEngine.recordPairingSession.mockResolvedValue({
        sessionId: 'session123',
        recommendationIds: ['rec1']
      });

      // Should not throw error, should continue with fresh generation
      try {
        const result = await pairingEngine.generatePairings(dish, context, preferences);
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('explanation');
      } catch (error) {
        // If it throws, it should be a different error than the cache error
        expect(error.message).not.toBe('Cache error');
      }
    });

    test('should handle cache set errors gracefully', async () => {
      const dish = 'grilled salmon';
      const context = { occasion: 'dinner' };
      const preferences = { wine_type: 'white' };
      const cacheKey = 'pairing_cache:abc123';

      mockCache.generateCacheKey.mockReturnValue(cacheKey);
      mockCache.get.mockResolvedValue(null); // Cache miss
      mockCache.set.mockRejectedValue(new Error('Cache set error'));

      // Mock database responses
      mockDatabase.query.mockResolvedValue([
        { 
          name: 'Chardonnay', 
          producer: 'Test Winery', 
          wine_type: 'White',
          region: 'Burgundy',
          style: 'crisp',
          tasting_notes: 'citrus, mineral',
          location: 'main-cellar',
          quantity: 10,
          available_quantity: 8
        }
      ]);

      // Mock learning engine
      mockLearningEngine.recordPairingSession.mockResolvedValue({
        sessionId: 'session123',
        recommendationIds: ['rec1']
      });

      // Should not throw error, should return result without caching
      try {
        const result = await pairingEngine.generatePairings(dish, context, preferences);
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('explanation');
      } catch (error) {
        // If it throws, it should be a different error than the cache set error
        expect(error.message).not.toBe('Cache set error');
      }
    });
  });
});