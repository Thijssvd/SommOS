# Test Specialist Agent - Initialization Brief

**Agent ID**: Test Specialist  
**Mission**: Comprehensive testing strategy, coverage improvement, and quality assurance for SommOS  
**Status**: ✅ Initialized  
**Date**: 2025-10-06

---

## Mission Overview

Ensure SommOS has robust, maintainable, and comprehensive test coverage across unit, integration, e2e, and performance testing layers. Identify gaps, fix flaky tests, and establish testing best practices.

## Current Test Infrastructure

### Test Frameworks
- **Jest 30.2.0**: Unit & integration tests
- **Playwright 1.55.1**: E2E tests (Chromium, Firefox, Webkit, Mobile)
- **Supertest 7.1.4**: API testing
- **fast-check 4.3.0**: Property-based testing
- **axe-core/playwright**: Accessibility testing

### Test Organization (11 Projects)
```
tests/
├── backend/        # Backend API & core logic (Backend API Tests project)
├── auth/           # Authentication & authorization (Auth API Tests project)
├── api/            # API contracts & validation (API Contract Tests project)
├── frontend/       # Frontend unit tests (Frontend Unit Tests project - jsdom)
├── integration/    # Full-stack integration (Integration Tests project)
├── performance/    # Performance & load tests (Performance Tests project)
├── browser/        # Browser compatibility (Browser Compatibility project - jsdom)
├── sync/           # Sync workflow tests (Sync Workflow Tests project)
├── security/       # Security tests (Security Tests project)
├── config/         # Config tests (Config Tests project)
└── e2e/            # Playwright end-to-end tests
    ├── auth/           # Login & guest access
    ├── inventory-crud.spec.ts
    ├── pairing-recommendations-ui.spec.ts
    ├── procurement-workflow.spec.ts
    ├── offline-pwa.spec.ts
    ├── smoke.spec.ts
    ├── a11y.spec.ts
    └── diagnostic*.spec.ts

__tests__/          # ML algorithm tests (ML Algorithm Tests project)
```

### Current Test Status

**Latest Run** (2025-10-06):
```
Test Suites: 8 failed, 31 passed, 39 total
Tests:       39 failed, 3 skipped, 656 passed, 698 total
Time:        42.524 s
```

**Coverage Thresholds** (jest.config.js):
- Global: 40% lines, 30% branches, 35% functions, 40% statements
- Per-module targets:
  - `inventory_manager.js`: 80%
  - `procurement_engine.js`: 70%
  - `pairing_engine.js`: 65%
  - `middleware/*.js`: 60-70%

### Test Setup Files

**tests/setup-env.js**: Pre-framework env vars
- Sets `NODE_ENV=test`
- Mock AI keys (DEEPSEEK, OPENAI)
- Test database path `:memory:`
- Auth test bypass mode

**tests/setup.js**: Jest setup
- TextEncoder/TextDecoder polyfills
- Custom matchers (`toBeOneOf`)
- OpenAI & axios mocks
- Parallel processing engine mocks
- Console mocking for clean output
- Global test utilities (`testUtils.generateMockWine()`, etc.)
- 30s global timeout

**playwright.config.ts**: E2E configuration
- 6 browser projects (Chrome, Firefox, Safari, Mobile Safari, Mobile Chrome, iPad Pro)
- Parallel execution (3 workers locally, 50% in CI)
- 2 retries in CI, 0 locally
- Screenshots/videos on failure
- Trace on first retry
- Auto-starts backend (3001) and frontend (3000) servers

### Known Issues Fixed

1. ✅ **Syntax error in pairing_engine.js**: Removed 700+ lines of orphaned duplicate code
2. ✅ **Missing sw-registration-core.cjs**: Fixed import to use `.js` extension

### Remaining Test Failures (39)

Analysis needed for:
- API error handling tests
- Pairing engine tests
- Explainability tests
- Inventory tests
- Integration tests
- Security tests

---

## Test Specialist Mission Tasks

### ✅ Phase 1: Initial Analysis (COMPLETED)
- [x] Analyze test infrastructure and configuration
- [x] Run full test suite and document current state
- [x] Fix critical blocking issues (pairing_engine.js syntax error, pwa.test.js import)

### 🎯 Phase 2: Test Fixes & Coverage (CURRENT)
- [ ] Investigate and fix remaining 39 test failures
- [ ] Run tests with full coverage report
- [ ] Identify modules below coverage thresholds
- [ ] Add missing tests for recent features:
  - Prometheus metrics export
  - Cache manager Prometheus integration
  - Service worker v3 caching strategies
  - Web Vitals tracking
  - AI metrics tracker
  - Multi-stage Docker health checks

### 🎯 Phase 3: Test Utilities & Infrastructure
- [ ] Create reusable test helpers:
  - Database setup/teardown utilities
  - API request factories
  - JWT token generators
  - WebSocket mock clients
  - Test data factories (wines, vintages, pairings)
- [ ] Add property-based testing with fast-check:
  - Wine data validation
  - Inventory operations
  - Vintage intelligence calculations
- [ ] Create test database seeders with known fixtures

### 🎯 Phase 4: Performance & Quality
- [ ] Add performance benchmarks:
  - API response time budgets
  - Cache hit rate targets
  - Database query performance
  - AI pairing latency
- [ ] Implement flaky test detection strategy
- [ ] Add load testing scenarios
- [ ] Verify Prometheus metrics in tests

### 🎯 Phase 5: Documentation & CI/CD
- [ ] Document testing best practices
- [ ] Create test writing guidelines
- [ ] Document CI/CD integration strategy
- [ ] Add pre-commit test hooks recommendations
- [ ] Create test coverage reporting dashboard

---

## Testing Best Practices

### Unit Tests
- **Location**: tests/backend/, tests/frontend/
- **Focus**: Individual functions, classes, modules
- **Mocking**: Mock external dependencies (DB, APIs, AI)
- **Speed**: Fast (<1s per test)
- **Coverage Target**: 70-80% for critical modules

### Integration Tests
- **Location**: tests/integration/
- **Focus**: Multiple components working together
- **Database**: In-memory SQLite (`:memory:`)
- **API**: Real Express routes with mocked external APIs
- **Coverage Target**: Key user flows and API contracts

### E2E Tests
- **Location**: tests/e2e/
- **Focus**: Complete user journeys
- **Browsers**: Multi-browser (Chromium, Firefox, WebKit, Mobile)
- **Database**: Test database with seeded data
- **Coverage Target**: Critical paths, authentication, offline mode

### Performance Tests
- **Location**: tests/performance/
- **Focus**: Response times, load handling, caching efficiency
- **Metrics**: Aligned with Prometheus monitoring
- **Budgets**:
  - API < 200ms (p95)
  - AI pairing < 5s (with timeout fallback)
  - Cache hit rate > 70%
  - DB query < 50ms (p95)

### Property-Based Tests
- **Tool**: fast-check
- **Focus**: Input validation, edge cases, invariants
- **Examples**:
  - Wine year validation (1800-current year)
  - Quantity constraints (>= 0, <= reserved)
  - Price validation (>= 0)
  - Vintage year uniqueness per wine

---

## Test Utilities Available

### Global testUtils (tests/setup.js)
```javascript
// Mock data generators
testUtils.generateMockWine(overrides)
testUtils.generateMockPairing(overrides)

// API response mocks
testUtils.mockApiResponse(data, success)
testUtils.mockErrorResponse(error, code)

// Async helpers
await testUtils.wait(ms)
```

### Mocked Services
- **OpenAI**: Returns mock pairing recommendations
- **axios**: Returns mock weather data
- **ParallelProcessingEngine**: Synchronous mock implementation

---

## Quick Test Commands

```bash
# Run all Jest tests
npm test

# Run specific project
npm test -- --projects="Backend API Tests"

# Run with coverage
npm test -- --coverage

# Run E2E tests
npm run test:e2e

# Run E2E with UI
npm run test:e2e:ui

# Run E2E in headed mode
npm run test:e2e:headed

# Check for flaky tests
npm run test:flaky

# Analyze flakiness
npm run analyze:flakiness

# Clean test artifacts
npm run clean
```

---

## Coverage Reports

Coverage reports generated in `coverage/` directory:
- **HTML**: `coverage/index.html` (visual browser report)
- **LCOV**: `coverage/lcov.info` (CI/CD integration)
- **Text**: Terminal summary

Current coverage command:
```bash
npm test -- --coverage --collectCoverageFrom='backend/**/*.js'
```

---

## Integration with Other Agents

### Backend Specialist
- Tests validate database performance indexes
- Tests verify cache manager integration
- Tests check API endpoint functionality

### Frontend Specialist
- E2E tests verify service worker caching
- Tests validate Web Vitals tracking
- Tests check PWA offline functionality

### AI Integration Specialist
- Tests verify AI pairing cache hits
- Tests check fallback mechanisms
- Tests validate confidence scoring

### DevOps Specialist
- Tests verify Prometheus metrics export
- Tests check Docker health checks
- Tests validate multi-stage build

---

## Success Metrics

### Coverage Targets
- [ ] Global coverage: 40% → 60% (lines)
- [ ] Critical modules: Meet per-module targets
- [ ] New features: 70%+ coverage

### Test Health
- [ ] Zero failing tests on main branch
- [ ] < 5% flaky test rate
- [ ] Test suite < 60s execution time
- [ ] E2E suite < 5 minutes

### Quality Metrics
- [ ] All API endpoints have contract tests
- [ ] All critical flows have E2E tests
- [ ] All security features have dedicated tests
- [ ] Performance budgets established and monitored

---

## Next Actions

1. **Fix remaining 39 test failures**
   - Group failures by type
   - Priority: API tests → Integration → Security
   
2. **Add tests for recent DevOps work**
   - Prometheus `/metrics` endpoint test
   - Cache manager Prometheus integration test
   - Multi-stage Docker build test

3. **Create comprehensive test utilities**
   - Database fixture factories
   - API test helpers
   - Mock data generators

4. **Establish performance baselines**
   - API response time budgets
   - Cache performance targets
   - Database query benchmarks

---

## Agent Coordination

**Test Specialist works with**:
- Backend Specialist: Validates performance optimizations
- Frontend Specialist: E2E tests for PWA features
- AI Integration Specialist: Tests for AI caching and fallbacks
- DevOps Specialist: Validates monitoring and health checks

**Test Specialist provides**:
- Quality gates for new features
- Performance regression detection
- Integration validation
- Documentation of expected behavior

---

**Status**: Ready to fix remaining test failures and improve coverage  
**Priority**: High - Tests are the safety net for all other work  
**Estimated Completion**: 2-3 work sessions for core tasks
