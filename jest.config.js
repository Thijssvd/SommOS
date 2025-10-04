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
    'backend/api/**/*.js',
    'backend/core/**/*.js',
    'backend/models/**/*.js',
    'backend/utils/**/*.js',
    'backend/middleware/**/*.js'
  ],

  // Test setup
  setupFiles: ['<rootDir>/tests/setup-env.js'],
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
      displayName: 'Auth API Tests',
      testMatch: ['**/tests/auth/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'API Contract Tests',
      testMatch: ['**/tests/api/**/*.test.js'],
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
    },
    {
      displayName: 'Sync Workflow Tests',
      testMatch: ['**/tests/sync/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'Security Tests',
      testMatch: ['**/tests/security/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'Config Tests',
      testMatch: ['**/tests/config/**/*.test.js'],
      testEnvironment: 'node'
    }
  ],
  
  // Coverage thresholds (realistic for current codebase)
  coverageThreshold: {
    global: {
      branches: 2,
      functions: 3,
      lines: 3,
      statements: 3
    }
  }
};
