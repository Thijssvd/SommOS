/**
 * Tests for Weather Routes
 */

const request = require('supertest');
const express = require('express');
const weatherRoutes = require('../../backend/api/weather_routes');

// Mock dependencies
jest.mock('../../backend/core/weather_intelligence');
jest.mock('../../backend/core/weather_background_service');

const WeatherIntelligence = require('../../backend/core/weather_intelligence');
const WeatherBackgroundService = require('../../backend/core/weather_background_service');

describe('Weather Routes', () => {
  let app;
  let mockWeatherIntelligence;
  let mockBackgroundService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWeatherIntelligence = {
      prefetchRegionData: jest.fn(),
      prefetchAllRegions: jest.fn(),
      getWeatherData: jest.fn(),
      getPrefetchStats: jest.fn(),
      clearPrefetchQueue: jest.fn(),
      destroy: jest.fn()
    };

    mockBackgroundService = {
      scheduleTask: jest.fn(),
      getStatistics: jest.fn(),
      getWeatherIntelligenceStats: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      destroy: jest.fn()
    };

    WeatherIntelligence.mockImplementation(() => mockWeatherIntelligence);
    WeatherBackgroundService.mockImplementation(() => mockBackgroundService);

    app = express();
    app.use(express.json());
    app.use('/api/weather', weatherRoutes);
  });

  describe('POST /api/weather/prefetch', () => {
    test('should trigger region prefetch successfully', async () => {
      mockWeatherIntelligence.prefetchRegionData.mockResolvedValue({
        success: true,
        processed: 2,
        cached: 2,
        failed: 0
      });

      const response = await request(app)
        .post('/api/weather/prefetch')
        .send({
          region: 'bordeaux',
          years: [2020, 2021],
          forceRefresh: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.processed).toBe(2);
      expect(mockWeatherIntelligence.prefetchRegionData).toHaveBeenCalledWith('bordeaux', {
        years: [2020, 2021],
        forceRefresh: true
      });
    });

    test('should handle prefetch errors', async () => {
      mockWeatherIntelligence.prefetchRegionData.mockRejectedValue(new Error('Prefetch failed'));

      const response = await request(app)
        .post('/api/weather/prefetch')
        .send({
          region: 'bordeaux',
          years: [2020]
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Prefetch failed');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/weather/prefetch')
        .send({
          years: [2020]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Region is required');
    });

    test('should validate years array', async () => {
      const response = await request(app)
        .post('/api/weather/prefetch')
        .send({
          region: 'bordeaux',
          years: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Years must be an array');
    });
  });

  describe('POST /api/weather/prefetch-all', () => {
    test('should trigger all regions prefetch successfully', async () => {
      mockWeatherIntelligence.prefetchAllRegions.mockResolvedValue({
        successful: 5,
        total: 5,
        details: []
      });

      const response = await request(app)
        .post('/api/weather/prefetch-all')
        .send({
          years: [2020, 2021],
          priority: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.successful).toBe(5);
      expect(mockWeatherIntelligence.prefetchAllRegions).toHaveBeenCalledWith({
        years: [2020, 2021],
        priority: 1
      });
    });

    test('should handle prefetch all errors', async () => {
      mockWeatherIntelligence.prefetchAllRegions.mockRejectedValue(new Error('Prefetch all failed'));

      const response = await request(app)
        .post('/api/weather/prefetch-all')
        .send({
          years: [2020]
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Prefetch all failed');
    });
  });

  describe('GET /api/weather/data/:region/:year', () => {
    test('should get weather data successfully', async () => {
      const mockWeatherData = {
        region: 'bordeaux',
        year: 2020,
        gdd: 1450,
        totalRainfall: 520,
        overallScore: 85
      };

      mockWeatherIntelligence.getWeatherData.mockResolvedValue(mockWeatherData);

      const response = await request(app)
        .get('/api/weather/data/bordeaux/2020');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockWeatherData);
      expect(mockWeatherIntelligence.getWeatherData).toHaveBeenCalledWith('bordeaux', 2020);
    });

    test('should handle weather data errors', async () => {
      mockWeatherIntelligence.getWeatherData.mockRejectedValue(new Error('Data not found'));

      const response = await request(app)
        .get('/api/weather/data/bordeaux/2020');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Data not found');
    });

    test('should validate year parameter', async () => {
      const response = await request(app)
        .get('/api/weather/data/bordeaux/invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid year');
    });
  });

  describe('GET /api/weather/stats', () => {
    test('should get weather intelligence statistics', async () => {
      const mockStats = {
        cache: { hitRate: 0.85 },
        processing: { queueSize: 5 },
        regions: { total: 10 },
        years: { total: 5 }
      };

      mockWeatherIntelligence.getPrefetchStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/weather/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toEqual(mockStats);
    });

    test('should handle statistics errors', async () => {
      mockWeatherIntelligence.getPrefetchStats.mockImplementation(() => {
        throw new Error('Stats error');
      });

      const response = await request(app)
        .get('/api/weather/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Stats error');
    });
  });

  describe('POST /api/weather/background/schedule', () => {
    test('should schedule background task successfully', async () => {
      mockBackgroundService.scheduleTask.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/weather/background/schedule')
        .send({
          type: 'prefetch',
          region: 'bordeaux',
          years: [2020, 2021],
          priority: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockBackgroundService.scheduleTask).toHaveBeenCalledWith({
        type: 'prefetch',
        region: 'bordeaux',
        years: [2020, 2021],
        priority: 1
      });
    });

    test('should handle background task scheduling errors', async () => {
      mockBackgroundService.scheduleTask.mockRejectedValue(new Error('Scheduling failed'));

      const response = await request(app)
        .post('/api/weather/background/schedule')
        .send({
          type: 'prefetch',
          region: 'bordeaux',
          years: [2020]
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Scheduling failed');
    });

    test('should validate task type', async () => {
      const response = await request(app)
        .post('/api/weather/background/schedule')
        .send({
          type: 'invalid',
          region: 'bordeaux',
          years: [2020]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid task type');
    });
  });

  describe('GET /api/weather/background/stats', () => {
    test('should get background service statistics', async () => {
      const mockStats = {
        totalTasks: 10,
        successfulTasks: 8,
        failedTasks: 2,
        queueSize: 3,
        isRunning: true,
        isPaused: false
      };

      mockBackgroundService.getStatistics.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/weather/background/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toEqual(mockStats);
    });

    test('should handle background statistics errors', async () => {
      mockBackgroundService.getStatistics.mockImplementation(() => {
        throw new Error('Background stats error');
      });

      const response = await request(app)
        .get('/api/weather/background/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Background stats error');
    });
  });

  describe('POST /api/weather/background/control', () => {
    test('should start background service', async () => {
      mockBackgroundService.start.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/weather/background/control')
        .send({
          action: 'start'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockBackgroundService.start).toHaveBeenCalled();
    });

    test('should stop background service', async () => {
      mockBackgroundService.stop.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/weather/background/control')
        .send({
          action: 'stop'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockBackgroundService.stop).toHaveBeenCalled();
    });

    test('should pause background service', async () => {
      mockBackgroundService.pause.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/weather/background/control')
        .send({
          action: 'pause'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockBackgroundService.pause).toHaveBeenCalled();
    });

    test('should resume background service', async () => {
      mockBackgroundService.resume.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/weather/background/control')
        .send({
          action: 'resume'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockBackgroundService.resume).toHaveBeenCalled();
    });

    test('should handle invalid action', async () => {
      const response = await request(app)
        .post('/api/weather/background/control')
        .send({
          action: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid action');
    });

    test('should handle control errors', async () => {
      mockBackgroundService.start.mockRejectedValue(new Error('Control failed'));

      const response = await request(app)
        .post('/api/weather/background/control')
        .send({
          action: 'start'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Control failed');
    });
  });

  describe('DELETE /api/weather/clear', () => {
    test('should clear prefetch queue successfully', async () => {
      mockWeatherIntelligence.clearPrefetchQueue.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/weather/clear');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockWeatherIntelligence.clearPrefetchQueue).toHaveBeenCalled();
    });

    test('should handle clear errors', async () => {
      mockWeatherIntelligence.clearPrefetchQueue.mockRejectedValue(new Error('Clear failed'));

      const response = await request(app)
        .delete('/api/weather/clear');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Clear failed');
    });
  });

  describe('GET /api/weather/health', () => {
    test('should check weather service health', async () => {
      const mockStats = {
        cache: { hitRate: 0.85 },
        processing: { queueSize: 5 }
      };

      mockWeatherIntelligence.getPrefetchStats.mockReturnValue(mockStats);
      mockBackgroundService.getStatistics.mockReturnValue({
        isRunning: true,
        queueSize: 5
      });

      const response = await request(app)
        .get('/api/weather/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.health.status).toBe('healthy');
      expect(response.body.health.services).toBeDefined();
    });

    test('should report unhealthy status', async () => {
      mockWeatherIntelligence.getPrefetchStats.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get('/api/weather/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.health.status).toBe('unhealthy');
    });
  });
});