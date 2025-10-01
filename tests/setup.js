// Jest setup file for SommOS tests
// This file runs before all tests

// Polyfills for Node.js environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Extend Jest matchers
expect.extend({
  toBeOneOf(received, validOptions) {
    const pass = validOptions.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${validOptions.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${validOptions.join(', ')}`,
        pass: false,
      };
    }
  },
});

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.PORT = '0';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.OPEN_METEO_BASE = 'https://archive-api.open-meteo.com/v1/archive';

const { refreshConfig } = require('../backend/config/env');
refreshConfig();

// Mock OpenAI API for tests
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([
                {
                  wine: {
                    name: 'Mock Bordeaux 2020',
                    producer: 'Mock Château',
                    wine_type: 'Red',
                    region: 'Bordeaux',
                    vintage_id: 'mock-vintage-1',
                    quantity: 5,
                    location: 'main-cellar'
                  },
                  score: { total: 0.85, confidence: 0.9 },
                  reasoning: 'Mock pairing reasoning for testing'
                }
              ])
            }
          }]
        })
      }
    }
  }));
});

// Mock axios for external API calls
jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ 
    data: { 
      hourly: {
        temperature_2m: [20, 22, 24],
        precipitation: [0, 0, 0],
        weather_code: [0, 0, 0]
      }
    } 
  })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  create: jest.fn(() => ({
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} }))
  }))
}));

// Mock parallel processing engine to prevent worker logging issues
jest.mock('../backend/core/parallel_processing_engine', () => {
  return jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    executeTask: jest.fn(() => Promise.resolve({ success: true, result: 'mocked' })),
    getMetrics: jest.fn(() => ({ activeWorkers: 0, completedTasks: 0, failedTasks: 0 })),
    on: jest.fn(),
    emit: jest.fn()
  }));
});

// Console mocking for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Global test timeout
jest.setTimeout(30000);

// Clean up after tests
afterEach(() => {
  jest.clearAllMocks();
});

// Reset database instance between test suites
afterEach(async () => {
  const Database = require('../backend/database/connection');
  await Database.resetInstance();
});

// Global cleanup for parallel processing engines
afterAll(async () => {
  // Clean up any remaining parallel processing engines
  const ParallelProcessingEngine = require('../backend/core/parallel_processing_engine');
  if (global.parallelProcessingEngines) {
    for (const engine of global.parallelProcessingEngines) {
      try {
        await engine.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      }
    }
    global.parallelProcessingEngines = [];
  }
});

// Test utilities
global.testUtils = {
  // Mock wine data generator
  generateMockWine: (overrides = {}) => ({
    id: 1,
    vintage_id: 'vintage-1',
    name: 'Test Bordeaux',
    producer: 'Test Château',
    year: 2020,
    wine_type: 'Red',
    region: 'Bordeaux',
    country: 'France',
    quantity: 12,
    location: 'main-cellar',
    cost_per_bottle: 35.50,
    ...overrides
  }),

  // Mock pairing data
  generateMockPairing: (overrides = {}) => ({
    wine: {
      name: 'Test Wine',
      producer: 'Test Producer',
      wine_type: 'Red',
      region: 'Test Region',
      vintage_id: 'vintage-1',
      quantity: 5,
      location: 'main-cellar'
    },
    score: { total: 0.85, confidence: 0.9 },
    reasoning: 'Test pairing reasoning',
    ...overrides
  }),

  // Wait utility for async tests
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock API response
  mockApiResponse: (data, success = true) => ({
    success,
    data,
    timestamp: new Date().toISOString()
  }),

  // Mock error response
  mockErrorResponse: (error, code = 'TEST_ERROR') => ({
    success: false,
    error,
    code,
    timestamp: new Date().toISOString()
  })
};