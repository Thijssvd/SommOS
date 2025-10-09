# SommOS E2E Testing Guide

Comprehensive end-to-end testing suite for the SommOS PWA using Playwright.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Debugging](#debugging)
- [Writing Tests](#writing-tests)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Both backend and frontend running (or let Playwright start them)

### Installation

```bash
# Install dependencies (if not already done)
npm install

# Install Playwright browsers
npm exec playwright install --with-deps
```

### Run All Tests

```bash
# Run all E2E tests (starts servers automatically)
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

## 📁 Test Structure

```
tests/e2e/
├── smoke.spec.ts                 # Smoke tests (app loads, basic functionality)
├── inventory-crud.spec.ts        # Inventory CRUD operations
├── offline-pwa.spec.ts           # PWA and offline functionality
├── a11y.spec.ts                  # Accessibility tests
├── auth/
│   ├── member-login.spec.ts      # Member authentication
│   └── guest-login.spec.ts       # Guest authentication
├── fixtures/
│   ├── auth.ts                   # Auth fixtures and helpers
│   └── test-data.ts              # Test data factories
└── utils/
    ├── selectors.ts              # Centralized selectors
    └── helpers.ts                # Common test helpers
```

## 🏃 Running Tests

### Run Specific Tests

```bash
# Run single file
npm exec playwright test tests/e2e/smoke.spec.ts

# Run tests matching pattern
npm exec playwright test -g "inventory"

# Run specific project (browser)
npm exec playwright test --project=chromium
npm exec playwright test --project=firefox
npm exec playwright test --project=webkit

# Run on mobile devices
npm exec playwright test --project="Mobile Safari"
npm exec playwright test --project="Mobile Chrome"
```

### Environment Variables

```bash
# Custom base URL
BASE_URL=http://localhost:5173 npm run test:e2e

# Skip auth (if backend configured)
SOMMOS_AUTH_TEST_BYPASS=true npm run test:e2e

# Production mode
NODE_ENV=production npm run test:e2e
```

## 🐛 Debugging

### View Test Report

```bash
# Open HTML report after tests
npm run test:e2e:report

# Or manually
npm exec playwright show-report
```

### Debug Failed Tests

```bash
# Show trace for failed test
npm exec playwright show-trace path/to/trace.zip

# Debug specific test
npm exec playwright test --debug tests/e2e/inventory-crud.spec.ts
```

### Interactive UI Mode

```bash
# Best for development - see tests run in real-time
npm run test:e2e:ui
```

### Screenshots and Videos

Failed tests automatically capture:

- Screenshots: `test-results/[test-name]/[retry]/screenshot.png`
- Videos: `test-results/[test-name]/[retry]/video.webm`
- Traces: `test-results/[test-name]/[retry]/trace.zip`

## ✍️ Writing Tests

### Using Fixtures

```typescript
import { test, expect } from './fixtures/auth';

// Auto-login as admin
test('my test', async ({ authenticatedAsAdmin: page }) => {
  // Page is already logged in as admin
  await expect(page.locator('#user-role-badge')).toHaveText('ADMIN');
});

// Auto-login as crew
test('my test', async ({ authenticatedAsCrew: page }) => {
  // ...
});

// Auto-login as guest
test('my test', async ({ authenticatedAsGuest: page }) => {
  // ...
});
```

### Using Selectors

Always prefer `data-testid` over CSS selectors:

```typescript
import { Selectors } from './utils/selectors';

// ✅ Good - stable
await page.locator(Selectors.inventory.searchInputTestId).fill('wine');

// ❌ Bad - brittle
await page.locator('#search-box').fill('wine');
```

### Using Helpers

```typescript
import { waitForToast, navigateToView, waitForNetworkIdle } from './utils/helpers';

// Navigate to view
await navigateToView(page, 'inventory');

// Wait for toast notification
await waitForToast(page, 'Success', 'success');

// Wait for network activity to finish
await waitForNetworkIdle(page);
```

### Test Best Practices

1. **Use descriptive test names**

   ```typescript
   test('should filter wines by type and location', async ({ page }) => {
     // ...
   });
   ```

2. **Keep tests atomic and independent**
   - Each test should be runnable in isolation
   - Don't depend on execution order

3. **Use appropriate timeouts**

   ```typescript
   // Short timeout for fast operations
   await expect(element).toBeVisible({ timeout: 2000 });
   
   // Longer timeout for API calls
   await waitForNetworkIdle(page, 10000);
   ```

4. **Handle flakiness**

   ```typescript
   // Use auto-waiting
   await page.locator('[data-testid="button"]').click();
   
   // Add retries for external dependencies
   await expect(async () => {
     const data = await fetchData();
     expect(data).toBeTruthy();
   }).toPass({ timeout: 5000 });
   ```

5. **Clean up after tests**

   ```typescript
   test.afterEach(async ({ page }) => {
     // Clear state if needed
     await page.evaluate(() => localStorage.clear());
   });
   ```

## 🎯 Test Categories

### Smoke Tests (`smoke.spec.ts`)

- App loads without errors
- Basic UI elements visible
- Service worker registration
- PWA meta tags present

### Inventory Tests (`inventory-crud.spec.ts`)

- List, search, filter, sort
- View wine details
- Permission-based access
- Keyboard navigation
- Responsive behavior

### Offline/PWA Tests (`offline-pwa.spec.ts`)

- Service worker caching
- Offline indicators
- Data sync when reconnected
- PWA manifest validation
- Background sync

### Accessibility Tests (`a11y.spec.ts`)

- Axe-core audits (no critical violations)
- Keyboard navigation
- Screen reader support
- Color contrast
- Touch target sizes
- Focus management

### Auth Tests (`auth/*.spec.ts`)

- Member login (admin, crew)
- Guest access (event codes)
- Invalid credentials
- Session persistence
- Logout

## 🔧 Configuration

### `playwright.config.ts`

Key settings:

- **baseURL**: `http://localhost:3000` (frontend) - Change with `BASE_URL` env var
- **Retries**: 2 on CI, 0 locally
- **Workers**: 50% of CPU cores on CI, 3 locally
- **Timeout**: 30 seconds per test
- **Projects**: Chromium, Firefox, WebKit, Mobile Safari, Mobile Chrome, iPad Pro

### Browsers

```bash
# Test on specific browser
npm exec playwright test --project=chromium
npm exec playwright test --project=firefox
npm exec playwright test --project=webkit

# Test on mobile
npm exec playwright test --project="Mobile Safari"
npm exec playwright test --project="Mobile Chrome"

# Test all
npm run test:e2e
```

## 🔄 CI/CD

Tests run automatically on:

- Push to `main` branch
- Pull requests
- Manual workflow dispatch

See `.github/workflows/e2e.yml` for CI configuration.

### CI Artifacts

After CI runs, download:

- HTML test report
- Screenshots of failures
- Video recordings
- Playwright traces

## 🐛 Troubleshooting

### Tests Fail Locally But Pass on CI

1. **Check Node/npm versions**

   ```bash
   node --version  # Should be >= 16
   npm --version   # Should be >= 8
   ```

2. **Clear caches**

   ```bash
   rm -rf node_modules
   rm -f package-lock.json
   npm install
   npm exec playwright install --with-deps
   ```

3. **Database state**

   ```bash
   # Reset database
   npm run setup:db:clean
   ```

### Tests Timeout

1. **Increase timeout** in test or config
2. **Check if servers are running**

   ```bash
   # Backend
   curl http://localhost:3001/api/system/health
   
   # Frontend
   curl http://localhost:3000
   ```

3. **Network issues** - Check firewall or VPN

### Flaky Tests

1. **Add explicit waits**

   ```typescript
   await page.waitForLoadState('networkidle');
   await expect(element).toBeVisible({ timeout: 5000 });
   ```

2. **Disable parallelism**

   ```bash
   npm exec playwright test --workers=1
   ```

3. **Check for race conditions** in application code

### Browser Not Found

```bash
# Reinstall browsers
npm exec playwright install --with-deps
```

### Permission Denied

```bash
# On Linux/Mac
chmod +x node_modules/.bin/playwright
```

## 📊 Coverage Mapping

| Feature | Test File | Status |
|---------|-----------|--------|
| Authentication | `auth/*.spec.ts` | ✅ Complete |
| Smoke/Basic | `smoke.spec.ts` | ✅ Complete |
| Inventory CRUD | `inventory-crud.spec.ts` | ✅ Complete |
| PWA/Offline | `offline-pwa.spec.ts` | ✅ Complete |
| Accessibility | `a11y.spec.ts` | ✅ Complete |
| Wine Pairing | `pairing.spec.ts` | ⏳ TODO |
| Procurement | `procurement.spec.ts` | ⏳ TODO |
| Settings | `settings.spec.ts` | ⏳ TODO |

## 🔗 Resources

- [Playwright Documentation](https://playwright.dev)
- [Axe Accessibility](https://www.deque.com/axe/)
- [SommOS Project Documentation](../README.md)
- [API Documentation](../PROJECT_WORKFLOW.md)

## 💡 Tips

1. **Use test.describe.serial** for tests that must run in order:

   ```typescript
   test.describe.serial('ordered tests', () => {
     // These run in sequence
   });
   ```

2. **Use test.skip** for conditional tests:

   ```typescript
   test('my test', async ({ browserName }) => {
     test.skip(browserName === 'webkit', 'Not supported on Safari');
     // ...
   });
   ```

3. **Use test.fixme** for known failures:

   ```typescript
   test.fixme('this test needs fixing', async ({ page }) => {
     // Will be marked as "fixme" in report
   });
   ```

4. **Generate code** with Playwright:

   ```bash
   npm exec playwright codegen http://localhost:3000
   ```

5. **Take screenshots** during tests:

   ```typescript
   await page.screenshot({ path: 'debug.png' });
   ```

## 🎉 Happy Testing

For questions or issues, check:

- [GitHub Issues](https://github.com/your-repo/issues)
- [Project Wiki](https://github.com/your-repo/wiki)
- Team Slack channel
