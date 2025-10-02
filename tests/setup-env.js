// Jest setup executed before the test framework is installed
process.env.OPEN_METEO_BASE = process.env.OPEN_METEO_BASE
    || 'https://archive-api.open-meteo.com/v1/archive';

// Set required environment variables for tests
// Prefer DEEPSEEK_API_KEY (primary), fallback OPENAI_API_KEY for legacy
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || 'test-deepseek-api-key-for-testing-only';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-ci-and-local-testing-only-not-for-production-use';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-key-for-ci-and-local-testing-only-not-for-production-use';
process.env.DATABASE_PATH = process.env.DATABASE_PATH || './tests/data/test.db';

// Set test-specific configuration
process.env.NODE_ENV = 'test';
process.env.SOMMOS_AUTH_TEST_BYPASS = 'true';
