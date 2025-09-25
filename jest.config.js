module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'backend/**/*.js',
    'frontend/js/**/*.js',
    '!backend/node_modules/**',
    '!**/test*.js'
  ],
  
  // Test setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // Test timeout (increased for performance tests)
  testTimeout: 30000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Test projects for different test types
  projects: [
    {
      displayName: 'Backend API Tests',
      testMatch: ['**/tests/backend/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'Frontend Unit Tests',
      testMatch: ['**/tests/frontend/**/*.test.js'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js', '<rootDir>/tests/frontend-setup.js']
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['**/tests/integration/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['**/tests/performance/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'Browser Compatibility',
      testMatch: ['**/tests/browser/**/*.test.js'],
      testEnvironment: 'jsdom'
    }
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};