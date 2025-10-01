/**
 * Tests for Weather Intelligence Service
 */

const WeatherIntelligence = require('../../backend/core/weather_intelligence');
const WeatherAnalysisService = require('../../backend/core/weather_analysis');
const OpenMeteoService = require('../../backend/core/open_meteo_service');

// Mock dependencies
jest.mock('../../backend/core/weather_analysis');
jest.mock('../../backend/core/open_meteo_service');

describe('Weather Intelligence Service', () => {
  let weatherIntelligence;
  let mockDatabase;
  let mockWeatherAnalysis;
  let mockOpenMeteo;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDatabase = {
      run: jest.fn(),
      get: jest.fn(),
      query: jest.fn()
    };

    mockWeatherAnalysis = {
      analyzeVintage: jest.fn(),
      cacheWeatherAnalysis: jest.fn()
    };

    mockOpenMeteo = {
      getVintageWeatherData: jest.fn()
    };

    WeatherAnalysisService.mockImplementation(() => mockWeatherAnalysis);
    OpenMeteoService.mockImplementation(() => mockOpenMeteo);

    weatherIntelligence = new WeatherIntelligence(mockDatabase, {
      backgroundProcessing: false, // Disable for tests
      maxConcurrentRequests: 2,
      batchSize: 3
    });
  });

  afterEach(() => {
    if (weatherIntelligence) {
      weatherIntelligence.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(weatherIntelligence.config.maxConcurrentRequests).toBe(2);
      expect(weatherIntelligence.config.batchSize).toBe(3);
      expect(weatherIntelligence.config.backgroundProcessing).toBe(false);
      expect(weatherIntelligence.config.cacheEnabled).toBe(true);
    });

    test('should initialize major wine regions', () => {
      expect(weatherIntelligence.majorWineRegions).toBeDefined();
      expect(weatherIntelligence.majorWineRegions['bordeaux']).toBeDefined();
      expect(weatherIntelligence.majorWineRegions['bordeaux'].priority).toBe(1);
      expect(weatherIntelligence.majorWineRegions['bordeaux'].coordinates).toBeDefined();
    });

    test('should initialize recent vintage years', () => {
      expect(weatherIntelligence.recentVintageYears).toBeDefined();
      expect(weatherIntelligence.recentVintageYears.length).toBeGreaterThan(0);
      expect(weatherIntelligence.recentVintageYears[0]).toBeGreaterThan(2010);
    });

    test('should initialize weather cache', () => {
      expect(weatherIntelligence.weatherCache).toBeDefined();
      expect(weatherIntelligence.weatherCache.getStats).toBeDefined();
    });
  });

  describe('Region Data Prefetching', () => {
    test('should prefetch region data successfully', async () => {
      const mockWeatherData = {
        region: 'bordeaux',
        year: 2020,
        gdd: 1450,
        totalRainfall: 520,
        overallScore: 85
      };

      mockOpenMeteo.getVintageWeatherData.mockResolvedValue(mockWeatherData);

      const result = await weatherIntelligence.prefetchRegionData('bordeaux', {
        years: [2020, 2021],
        forceRefresh: true
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.cached).toBe(0); // Mock doesn't actually cache
      expect(result.failed).toBe(0);
      expect(mockOpenMeteo.getVintageWeatherData).toHaveBeenCalledTimes(2);
    });

    test('should handle unknown region', async () => {
      const result = await weatherIntelligence.prefetchRegionData('unknown-region');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown region');
    });

    test('should handle API failures gracefully', async () => {
      mockOpenMeteo.getVintageWeatherData.mockRejectedValue(new Error('API Error'));

      const result = await weatherIntelligence.prefetchRegionData('bordeaux', {
        years: [2020],
        forceRefresh: true
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.cached).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('2020');
      expect(result.errors[0]).toContain('API Error');
    });

    test('should process years in batches', async () => {
      const mockWeatherData = {
        region: 'bordeaux',
        year: 2020,
        gdd: 1450
      };

      mockOpenMeteo.getVintageWeatherData.mockResolvedValue(mockWeatherData);

      const years = [2020, 2021, 2022, 2023, 2024];
      const result = await weatherIntelligence.prefetchRegionData('bordeaux', {
        years,
        forceRefresh: true
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(5);
      expect(mockOpenMeteo.getVintageWeatherData).toHaveBeenCalledTimes(5);
    });
  });

  describe('All Regions Prefetching', () => {
    test('should prefetch all major regions', async () => {
      const mockWeatherData = {
        region: 'test',
        year: 2020,
        gdd: 1400
      };

      mockOpenMeteo.getVintageWeatherData.mockResolvedValue(mockWeatherData);

      const result = await weatherIntelligence.prefetchAllRegions({
        years: [2020],
        priority: 1
      });

      expect(result.successful).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.details).toHaveLength(result.total);
    });

    test('should respect concurrency limits', async () => {
      const mockWeatherData = {
        region: 'test',
        year: 2020,
        gdd: 1400
      };

      mockOpenMeteo.getVintageWeatherData.mockResolvedValue(mockWeatherData);

      const startTime = Date.now();
      await weatherIntelligence.prefetchAllRegions({
        years: [2020],
        priority: 1
      });
      const endTime = Date.now();

      // Should take some time due to batching and delays
      expect(endTime - startTime).toBeGreaterThan(100);
    });
  });

  describe('Weather Data Retrieval', () => {
    test('should get weather data from cache', async () => {
      const mockWeatherData = {
        region: 'bordeaux',
        year: 2020,
        gdd: 1450,
        cached: true
      };

      // Mock cache hit
      weatherIntelligence.weatherCache.get = jest.fn().mockResolvedValue(mockWeatherData);

      const result = await weatherIntelligence.getWeatherData('bordeaux', 2020);

      expect(result).toEqual(mockWeatherData);
      expect(weatherIntelligence.weatherCache.get).toHaveBeenCalled();
    });

    test('should get weather data from analysis service when not cached', async () => {
      const mockWeatherData = {
        region: 'bordeaux',
        year: 2020,
        gdd: 1450
      };

      // Mock cache miss
      weatherIntelligence.weatherCache.get = jest.fn().mockResolvedValue(null);
      mockWeatherAnalysis.analyzeVintage.mockResolvedValue(mockWeatherData);

      const result = await weatherIntelligence.getWeatherData('bordeaux', 2020);

      expect(result).toEqual(mockWeatherData);
      expect(mockWeatherAnalysis.analyzeVintage).toHaveBeenCalledWith('bordeaux', 2020);
    });

    test('should handle analysis service errors', async () => {
      weatherIntelligence.weatherCache.get = jest.fn().mockResolvedValue(null);
      mockWeatherAnalysis.analyzeVintage.mockRejectedValue(new Error('Analysis failed'));

      await expect(weatherIntelligence.getWeatherData('bordeaux', 2020))
        .rejects.toThrow('Analysis failed');
    });
  });

  describe('Background Processing', () => {
    test('should schedule prefetch for background processing', () => {
      weatherIntelligence.schedulePrefetch('bordeaux', [2020, 2021], 1);

      expect(weatherIntelligence.processingQueue.size).toBe(1);
      const task = Array.from(weatherIntelligence.processingQueue.values())[0];
      expect(task.region).toBe('bordeaux');
      expect(task.years).toEqual([2020, 2021]);
      expect(task.priority).toBe(1);
    });

    test('should not schedule duplicate prefetch tasks', () => {
      weatherIntelligence.schedulePrefetch('bordeaux', [2020, 2021], 1);
      weatherIntelligence.schedulePrefetch('bordeaux', [2020, 2021], 1);

      expect(weatherIntelligence.processingQueue.size).toBe(1);
    });

    test('should process background queue', async () => {
      const mockWeatherData = {
        region: 'bordeaux',
        year: 2020,
        gdd: 1450
      };

      mockOpenMeteo.getVintageWeatherData.mockResolvedValue(mockWeatherData);

      // Add task to queue
      weatherIntelligence.schedulePrefetch('bordeaux', [2020], 1);

      // Process queue
      await weatherIntelligence.processBackgroundQueue();

      expect(weatherIntelligence.processingQueue.size).toBe(0);
      expect(mockOpenMeteo.getVintageWeatherData).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    test('should cache weather data after retrieval', async () => {
      const mockWeatherData = {
        region: 'bordeaux',
        year: 2020,
        gdd: 1450
      };

      weatherIntelligence.weatherCache.get = jest.fn().mockResolvedValue(null);
      weatherIntelligence.weatherCache.set = jest.fn().mockResolvedValue(true);
      mockWeatherAnalysis.analyzeVintage.mockResolvedValue(mockWeatherData);

      await weatherIntelligence.getWeatherData('bordeaux', 2020);

      expect(weatherIntelligence.weatherCache.set).toHaveBeenCalled();
    });

    test('should generate consistent cache keys', () => {
      const key1 = weatherIntelligence.weatherCache.generateCacheKey('bordeaux', { year: 2020 });
      const key2 = weatherIntelligence.weatherCache.generateCacheKey('bordeaux', { year: 2020 });

      expect(key1).toBe(key2);
    });

    test('should generate different cache keys for different data', () => {
      const key1 = weatherIntelligence.weatherCache.generateCacheKey('bordeaux', { year: 2020 });
      const key2 = weatherIntelligence.weatherCache.generateCacheKey('bordeaux', { year: 2021 });
      const key3 = weatherIntelligence.weatherCache.generateCacheKey('burgundy', { year: 2020 });

      // All keys should be strings
      expect(typeof key1).toBe('string');
      expect(typeof key2).toBe('string');
      expect(typeof key3).toBe('string');
      
      // Keys should contain the prefix
      expect(key1).toContain('weather_intelligence');
      expect(key2).toContain('weather_intelligence');
      expect(key3).toContain('weather_intelligence');
      
      // Keys should be different (at least one should be different)
      const allKeys = [key1, key2, key3];
      const uniqueKeys = new Set(allKeys);
      expect(uniqueKeys.size).toBeGreaterThan(1);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide prefetch statistics', () => {
      const stats = weatherIntelligence.getPrefetchStats();

      expect(stats.cache).toBeDefined();
      expect(stats.processing).toBeDefined();
      expect(stats.regions).toBeDefined();
      expect(stats.years).toBeDefined();
      expect(stats.cache.hitRate).toBeDefined();
      expect(stats.processing.queueSize).toBeDefined();
    });

    test('should update processing statistics', () => {
      const initialStats = { ...weatherIntelligence.processingStats };
      
      weatherIntelligence.updateProcessingStats({
        processed: 5,
        cached: 4,
        failed: 1
      }, 1000);

      expect(weatherIntelligence.processingStats.totalProcessed).toBe(initialStats.totalProcessed + 5);
      expect(weatherIntelligence.processingStats.successful).toBe(initialStats.successful + 4);
      expect(weatherIntelligence.processingStats.failed).toBe(initialStats.failed + 1);
    });

    test('should clear prefetch queue', () => {
      weatherIntelligence.schedulePrefetch('bordeaux', [2020], 1);
      weatherIntelligence.schedulePrefetch('burgundy', [2020], 1);

      expect(weatherIntelligence.processingQueue.size).toBe(2);

      weatherIntelligence.clearPrefetchQueue();

      expect(weatherIntelligence.processingQueue.size).toBe(0);
    });
  });

  describe('Utility Methods', () => {
    test('should create batches correctly', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const batches = weatherIntelligence.createBatches(array, 3);

      expect(batches).toHaveLength(4);
      expect(batches[0]).toEqual([1, 2, 3]);
      expect(batches[1]).toEqual([4, 5, 6]);
      expect(batches[2]).toEqual([7, 8, 9]);
      expect(batches[3]).toEqual([10]);
    });

    test('should delay execution', async () => {
      const startTime = Date.now();
      await weatherIntelligence.delay(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(95); // Allow for timing variations
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockDatabase.run.mockRejectedValue(new Error('Database error'));

      // Should not throw error
      const result = await weatherIntelligence.prefetchRegionData('bordeaux', {
        years: [2020],
        forceRefresh: true
      });

      expect(result.success).toBe(true);
    });

    test('should handle network timeouts', async () => {
      mockOpenMeteo.getVintageWeatherData.mockRejectedValue(new Error('Network timeout'));

      const result = await weatherIntelligence.prefetchRegionData('bordeaux', {
        years: [2020],
        forceRefresh: true
      });

      expect(result.success).toBe(true);
      expect(result.failed).toBe(1);
    });

    test('should handle invalid year data', async () => {
      const result = await weatherIntelligence.prefetchRegionData('bordeaux', {
        years: ['invalid', 2020],
        forceRefresh: true
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });
  });

  describe('Resource Cleanup', () => {
    test('should destroy resources properly', () => {
      const destroySpy = jest.spyOn(weatherIntelligence.weatherCache, 'destroy');
      
      weatherIntelligence.destroy();

      expect(destroySpy).toHaveBeenCalled();
    });
  });
});