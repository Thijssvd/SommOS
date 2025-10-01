/**
 * Tests for Weather Background Service
 */

const WeatherBackgroundService = require('../../backend/core/weather_background_service');
const WeatherIntelligence = require('../../backend/core/weather_intelligence');

// Mock dependencies
jest.mock('../../backend/core/weather_intelligence');

describe('Weather Background Service', () => {
  let backgroundService;
  let mockWeatherIntelligence;
  let mockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockDatabase = {
      run: jest.fn(),
      get: jest.fn(),
      query: jest.fn()
    };

    mockWeatherIntelligence = {
      prefetchAllRegions: jest.fn(),
      prefetchRegionData: jest.fn(),
      getPrefetchStats: jest.fn(),
      clearPrefetchQueue: jest.fn(),
      destroy: jest.fn()
    };

    WeatherIntelligence.mockImplementation(() => mockWeatherIntelligence);

    backgroundService = new WeatherBackgroundService(mockDatabase, {
      enabled: true,
      interval: 1000,
      maxConcurrentTasks: 2
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (backgroundService) {
      backgroundService.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(backgroundService.config.enabled).toBe(true);
      expect(backgroundService.config.interval).toBe(1000);
      expect(backgroundService.config.maxConcurrentTasks).toBe(2);
      expect(backgroundService.config.retryAttempts).toBe(3);
      expect(backgroundService.config.retryDelay).toBe(5000);
    });

    test('should initialize weather intelligence service', () => {
      expect(WeatherIntelligence).toHaveBeenCalledWith(mockDatabase, {
        backgroundProcessing: true,
        maxConcurrentRequests: 2,
        batchSize: 3
      });
    });

    test('should initialize task queue and statistics', () => {
      expect(backgroundService.taskQueue).toBeDefined();
      expect(backgroundService.statistics).toBeDefined();
      expect(backgroundService.statistics.totalTasks).toBe(0);
      expect(backgroundService.statistics.successfulTasks).toBe(0);
      expect(backgroundService.statistics.failedTasks).toBe(0);
    });
  });

  describe('Task Scheduling', () => {
    test('should schedule prefetch task', () => {
      const task = {
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020, 2021],
        priority: 1
      };

      backgroundService.scheduleTask(task);

      expect(backgroundService.taskQueue.size).toBe(1);
      const queuedTask = Array.from(backgroundService.taskQueue.values())[0];
      expect(queuedTask.type).toBe('prefetch');
      expect(queuedTask.region).toBe('bordeaux');
      expect(queuedTask.priority).toBe(1);
    });

    test('should schedule analysis task', () => {
      const task = {
        type: 'analysis',
        region: 'burgundy',
        year: 2020,
        priority: 2
      };

      backgroundService.scheduleTask(task);

      expect(backgroundService.taskQueue.size).toBe(1);
      const queuedTask = Array.from(backgroundService.taskQueue.values())[0];
      expect(queuedTask.type).toBe('analysis');
      expect(queuedTask.region).toBe('burgundy');
    });

    test('should not schedule duplicate tasks', () => {
      const task = {
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020, 2021],
        priority: 1
      };

      backgroundService.scheduleTask(task);
      backgroundService.scheduleTask(task);

      expect(backgroundService.taskQueue.size).toBe(1);
    });

    test('should prioritize tasks correctly', () => {
      const task1 = {
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020],
        priority: 2
      };

      const task2 = {
        type: 'prefetch',
        region: 'burgundy',
        years: [2020],
        priority: 1
      };

      backgroundService.scheduleTask(task1);
      backgroundService.scheduleTask(task2);

      const tasks = Array.from(backgroundService.taskQueue.values());
      expect(tasks[0].priority).toBe(1); // Higher priority first
      expect(tasks[1].priority).toBe(2);
    });
  });

  describe('Task Processing', () => {
    test('should process prefetch task successfully', async () => {
      const task = {
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020, 2021],
        priority: 1
      };

      mockWeatherIntelligence.prefetchRegionData.mockResolvedValue({
        success: true,
        processed: 2,
        cached: 2,
        failed: 0
      });

      backgroundService.scheduleTask(task);
      await backgroundService.processNextTask();

      expect(mockWeatherIntelligence.prefetchRegionData).toHaveBeenCalledWith('bordeaux', {
        years: [2020, 2021],
        forceRefresh: false
      });
      expect(backgroundService.statistics.successfulTasks).toBe(1);
    });

    test('should process analysis task successfully', async () => {
      const task = {
        type: 'analysis',
        region: 'burgundy',
        year: 2020,
        priority: 1
      };

      mockWeatherIntelligence.prefetchRegionData.mockResolvedValue({
        success: true,
        processed: 1,
        cached: 1,
        failed: 0
      });

      backgroundService.scheduleTask(task);
      await backgroundService.processNextTask();

      expect(mockWeatherIntelligence.prefetchRegionData).toHaveBeenCalledWith('burgundy', {
        years: [2020],
        forceRefresh: false
      });
    });

    test('should handle task processing errors', async () => {
      const task = {
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020],
        priority: 1
      };

      mockWeatherIntelligence.prefetchRegionData.mockRejectedValue(new Error('Processing failed'));

      backgroundService.scheduleTask(task);
      await backgroundService.processNextTask();

      expect(backgroundService.statistics.failedTasks).toBe(1);
      expect(backgroundService.statistics.successfulTasks).toBe(0);
    });

    test('should retry failed tasks', async () => {
      const task = {
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020],
        priority: 1
      };

      mockWeatherIntelligence.prefetchRegionData
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          success: true,
          processed: 1,
          cached: 1,
          failed: 0
        });

      backgroundService.scheduleTask(task);
      await backgroundService.processNextTask();

      // Task should be retried
      expect(backgroundService.taskQueue.size).toBe(1);
      expect(backgroundService.statistics.failedTasks).toBe(0);

      // Process retry
      await backgroundService.processNextTask();

      expect(backgroundService.statistics.successfulTasks).toBe(1);
      expect(backgroundService.taskQueue.size).toBe(0);
    });

    test('should not retry tasks that exceed max attempts', async () => {
      const task = {
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020],
        priority: 1
      };

      mockWeatherIntelligence.prefetchRegionData.mockRejectedValue(new Error('Persistent failure'));

      backgroundService.scheduleTask(task);

      // Process task multiple times to exceed retry limit
      for (let i = 0; i < 4; i++) {
        await backgroundService.processNextTask();
      }

      expect(backgroundService.statistics.failedTasks).toBe(1);
      expect(backgroundService.taskQueue.size).toBe(0);
    });
  });

  describe('Service Control', () => {
    test('should start service', () => {
      const startSpy = jest.spyOn(backgroundService, 'startProcessing');
      
      backgroundService.start();

      expect(startSpy).toHaveBeenCalled();
    });

    test('should stop service', () => {
      const stopSpy = jest.spyOn(backgroundService, 'stopProcessing');
      
      backgroundService.stop();

      expect(stopSpy).toHaveBeenCalled();
    });

    test('should pause service', () => {
      backgroundService.pause();

      expect(backgroundService.isPaused).toBe(true);
    });

    test('should resume service', () => {
      backgroundService.pause();
      backgroundService.resume();

      expect(backgroundService.isPaused).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide service statistics', () => {
      const stats = backgroundService.getStatistics();

      expect(stats.totalTasks).toBe(0);
      expect(stats.successfulTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
      expect(stats.queueSize).toBe(0);
      expect(stats.isRunning).toBe(false);
      expect(stats.isPaused).toBe(false);
    });

    test('should update statistics after task processing', async () => {
      const task = {
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020],
        priority: 1
      };

      mockWeatherIntelligence.prefetchRegionData.mockResolvedValue({
        success: true,
        processed: 1,
        cached: 1,
        failed: 0
      });

      backgroundService.scheduleTask(task);
      await backgroundService.processNextTask();

      const stats = backgroundService.getStatistics();
      expect(stats.totalTasks).toBe(1);
      expect(stats.successfulTasks).toBe(1);
      expect(stats.failedTasks).toBe(0);
    });

    test('should provide weather intelligence statistics', () => {
      const mockStats = {
        cache: { hitRate: 0.85 },
        processing: { queueSize: 5 },
        regions: { total: 10 },
        years: { total: 5 }
      };

      mockWeatherIntelligence.getPrefetchStats.mockReturnValue(mockStats);

      const stats = backgroundService.getWeatherIntelligenceStats();

      expect(stats).toEqual(mockStats);
      expect(mockWeatherIntelligence.getPrefetchStats).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle weather intelligence service errors', async () => {
      const task = {
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020],
        priority: 1
      };

      mockWeatherIntelligence.prefetchRegionData.mockRejectedValue(new Error('Service error'));

      backgroundService.scheduleTask(task);
      await backgroundService.processNextTask();

      expect(backgroundService.statistics.failedTasks).toBe(1);
    });

    test('should handle invalid task types', async () => {
      const task = {
        type: 'invalid',
        region: 'bordeaux',
        priority: 1
      };

      backgroundService.scheduleTask(task);
      await backgroundService.processNextTask();

      expect(backgroundService.statistics.failedTasks).toBe(1);
    });

    test('should handle missing task data', async () => {
      const task = {
        type: 'prefetch',
        priority: 1
      };

      backgroundService.scheduleTask(task);
      await backgroundService.processNextTask();

      expect(backgroundService.statistics.failedTasks).toBe(1);
    });
  });

  describe('Resource Cleanup', () => {
    test('should destroy weather intelligence service on cleanup', () => {
      backgroundService.destroy();

      expect(mockWeatherIntelligence.destroy).toHaveBeenCalled();
    });

    test('should clear task queue on cleanup', () => {
      const task = {
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020],
        priority: 1
      };

      backgroundService.scheduleTask(task);
      expect(backgroundService.taskQueue.size).toBe(1);

      backgroundService.destroy();

      expect(backgroundService.taskQueue.size).toBe(0);
    });
  });
});