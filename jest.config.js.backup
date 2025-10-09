module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Automatic test retries for flakiness mitigation
  // Retries failed tests up to 2 times in CI environment to reduce false negatives
  // Note: This helps with genuine flakiness but won't mask real failures
  ...(process.env.CI && {
    retryTimes: 2,
    retryImmediately: false // Wait before retry to let async operations settle
  }),
  
  // Test file patterns - comprehensive discovery
  // Exclude backend/test/ml/ as they use custom TestRunner
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/backend/test/ml/',  // Custom test runner, not Jest compatible
    '/tests/e2e/',         // Playwright tests, not Jest
    '/frontend/',          // Static files, not tests
    '/data/',              // Data files
    '/coverage/',          // Coverage output
    '\\.archived$'         // Archived files
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
    },
    {
      displayName: 'ML Algorithm Tests',
      testMatch: ['**/__tests__/**/*.test.js'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/setup-env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
    },
  ],
  
  // Coverage thresholds - progressive improvement targets
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 35,
      lines: 40,
      statements: 40
    },
    // Per-module targets for well-tested modules
    './backend/core/inventory_manager.js': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './backend/core/procurement_engine.js': {
      branches: 65,
      functions: 70,
      lines: 70,
      statements: 70
    },
    './backend/core/pairing_engine.js': {
      branches: 60,
      functions: 65,
      lines: 65,
      statements: 65
    },
    './backend/middleware/*.js': {
      branches: 60,
      functions: 65,
      lines: 70,
      statements: 70
    }
  }
};
