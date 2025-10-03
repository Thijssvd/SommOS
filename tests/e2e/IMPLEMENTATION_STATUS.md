# Playwright E2E Testing Implementation Status

**Date**: 2025-10-03  
**Project**: SommOS - Yacht Wine Management PWA  
**Objective**: Comprehensive E2E testing infrastructure with Playwright + TypeScript

---

## ✅ Completed (Phase 1)

### 1. Environment & Tooling
- [x] **Installed Dependencies**
  - `@axe-core/playwright` for accessibility testing
  - `@types/node` for TypeScript Node.js API support
  - Already had `@playwright/test@^1.55.1`

- [x] **Created `playwright.config.ts`**
  - BaseURL: `http://localhost:3000` (configurable via `BASE_URL` env var)
  - Timeout: 30s global, 10s per action
  - Retries: 2 on CI, 0 locally
  - Workers: 50% on CI, 3 locally
  - Reporters: HTML, JSON, List
  - Trace/Video/Screenshot on failure
  - Projects configured:
    - Desktop: Chromium, Firefox, WebKit
    - Mobile: iPhone 14, Pixel 7
    - Tablet: iPad Pro
  - **Auto-start web servers**: Backend (port 3001) + Frontend (port 3000)

### 2. Test Infrastructure Files

#### Authentication Fixtures (`tests/e2e/fixtures/auth.ts`)
- `TEST_USERS` constant with admin/crew/guest credentials
- `GUEST_EVENT_CODES` for guest access testing
- `loginAsMember()` - Member login helper
- `loginAsGuest()` - Guest login with event codes
- `clearSession()` - Clean logout and storage clear
- `verifyUserRole()` - Assert role badge
- **Extended Playwright fixtures**:
  - `authenticatedAsAdmin` - Pre-logged-in admin state
  - `authenticatedAsCrew` - Pre-logged-in crew state
  - `authenticatedAsGuest` - Pre-logged-in guest state

#### Selectors (`tests/e2e/utils/selectors.ts`)
- Centralized selector constants organized by feature
- Auth, Navigation, Views, Dashboard, Inventory, Pairing, Modals, Forms, Notifications, Tables
- Helper functions: `testId()`, `ariaLabel()`, `role()`
- Priority: `data-testid` > `aria-label` > `role` > `id` > `class`

#### Helpers (`tests/e2e/utils/helpers.ts`)
- `waitForToast()` - Toast notification assertions
- `waitForAPIResponse()` - Intercept and validate API calls
- `isHiddenByRole()` - Check role-based visibility
- `waitForNetworkIdle()` - Wait for network stabilization
- `collectConsoleMessages()` & `filterConsoleErrors()` - Console monitoring
- `navigateToView()` - Navigate to app views
- `fillField()` - Form filling with validation
- `waitForModal()` & `closeModal()` - Modal interactions
- `getTableRowCount()` - Table assertions
- `isServiceWorkerRegistered()` - PWA checks
- `goOffline()` & `goOnline()` - Network simulation
- `getLocalStorage()` & `setLocalStorage()` - Storage manipulation
- `waitForAnimation()` - Animation completion

#### Test Data Factories (`tests/e2e/fixtures/test-data.ts`)
- `TEST_WINES` - Predefined wine inventory (Bordeaux, Burgundy, Champagne, Barolo, Chardonnay, Port)
- `TEST_PAIRINGS` - Common pairing scenarios (steak, seafood, celebration, dessert)
- `WINE_LOCATIONS` & `WINE_TYPES` - Domain constants
- `generateRandomWine()` - Random wine generation
- `generateTestWineList()` - Bulk test data
- `SeededRandom` - Deterministic randomness for stable tests
- `generateDeterministicWine()` - Reproducible wine data

### 3. Test Suites Created

#### Smoke Tests (`tests/e2e/smoke.spec.ts`)
- ✅ Application loads without console errors
- ✅ Auth screen displays on first visit
- ✅ All critical resources load (no 404s)
- ✅ Correct page title
- ✅ SommOS branding visible
- ✅ Service worker registration (PWA)
- ✅ Responsive viewport meta tag
- ✅ PWA manifest link
- ✅ Basic accessibility (labels, heading structure)
- ✅ Skip link for keyboard navigation

---

## 🚧 In Progress / To Do

### Next Immediate Steps

#### 1. Create Test Seed Script (`scripts/seed-test-data.js`)
```bash
# Purpose: Reset DB to deterministic state for E2E tests
# What it should do:
- Drop/recreate test database
- Seed test users (admin@test.com, crew@test.com, guest@test.com)
- Create 10-15 wines with known IDs
- Generate guest event codes (YACHT2024, GUEST2024 with PIN 123456)
- Make idempotent (can run multiple times)
```

#### 2. Update `package.json` Scripts
Need to update package.json to have E2E commands (scripts partially exist but may need refinement):
```json
{
  "scripts": {
    "seed:test": "node scripts/seed-test-data.js",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

#### 3. Authentication Test Suites
Create these files:
- `tests/e2e/auth/member-login.spec.ts`
  - Valid login (admin, crew)
  - Invalid credentials
  - Missing fields
  - Rate limiting
  - Session persistence
  - Logout

- `tests/e2e/auth/guest-login.spec.ts`
  - Event code login (no PIN)
  - Event code + PIN
  - Invalid code
  - Expired code
  - Session expiry
  - Guest banner display

#### 4. Inventory Management Tests
- `tests/e2e/inventory/crud.spec.ts` - Create, edit, delete bottles
- `tests/e2e/inventory/search-filter-sort.spec.ts` - Search, filters, sorting
- `tests/e2e/inventory/locations.spec.ts` - Move bottles between locations

#### 5. Pairing Tests
- `tests/e2e/pairing/ai-recommendations.spec.ts` - AI pairing flow

#### 6. Offline/PWA Tests
- `tests/e2e/offline/pwa-functionality.spec.ts` - Service worker, offline mode
- `tests/e2e/offline/sync.spec.ts` - Sync on reconnect

#### 7. Permissions Tests
- `tests/e2e/permissions/guest-restrictions.spec.ts` - Migrate existing JS test
- `tests/e2e/permissions/role-based-access.spec.ts` - Admin/crew/guest permissions

#### 8. Responsive & Accessibility
- `tests/e2e/responsive/mobile.spec.ts` - Test at 360px, 768px, 1024px, 1280px
- `tests/e2e/accessibility/a11y-audit.spec.ts` - Axe-core audits, keyboard nav

#### 9. Visual Regression
- `tests/e2e/visual/snapshots.spec.ts` - Screenshot comparisons

#### 10. UI Enhancements
Add `data-testid` attributes to UI:
- All buttons, forms, inputs
- Navigation items, action cards
- Modals, dialogs
- Table rows/cells
- Convention: `data-testid="component-action"`

Example:
```html
<button id="add-bottle-btn" data-testid="inventory-add-bottle">Add Bottle</button>
<input id="inventory-search" data-testid="inventory-search-input" />
<tr data-wine-id="123" data-testid="inventory-row-123">
```

#### 11. CI/CD Integration
Create `.github/workflows/e2e.yml`:
- Trigger: PR, push to main, manual
- Matrix: chromium, firefox, webkit
- Setup: Node.js 18, cache npm
- Steps:
  1. Install dependencies
  2. Run `npm run seed:test`
  3. Install Playwright browsers
  4. Run tests with `npm run test:e2e`
  5. Upload artifacts (HTML report, traces, videos)

#### 12. Documentation
- `tests/e2e/README.md` - How to run, debug, update snapshots
- `docs/qa/COVERAGE.md` - Feature→test mapping
- `docs/qa/DEBUGGING.md` - Debug strategies, flake prevention

---

## 🎯 Success Criteria

### Test Stability
- [ ] All tests pass 3 consecutive runs without flakes
- [ ] Each test completes in <30 seconds
- [ ] Total suite execution <10 minutes

### Coverage
- [ ] Critical user flows covered (auth, inventory CRUD, pairing, search/filter)
- [ ] Role-based permissions validated (admin, crew, guest)
- [ ] Offline/PWA functionality tested
- [ ] Mobile responsive breakpoints verified

### Quality Gates
- [ ] Lighthouse scores: Performance ≥90, PWA =100, A11y ≥95
- [ ] Axe audit: 0 critical/serious violations
- [ ] No console errors in smoke tests
- [ ] Service worker registers successfully

### CI/CD
- [ ] E2E workflow runs on every PR
- [ ] Artifacts (reports, traces) uploaded
- [ ] Green CI badge required to merge

---

## 📋 Commands Reference

### Run Tests
```bash
# Run all tests
npm run test:e2e

# Run specific test file
npm run test:e2e tests/e2e/smoke.spec.ts

# Run specific test by grep
npm run test:e2e --grep "should load application"

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run in debug mode
npm run test:e2e:debug

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run specific project (browser)
npm run test:e2e --project=chromium
npm run test:e2e --project="Mobile Safari"
```

### Debug Tests
```bash
# Show HTML report
npm run test:e2e:report

# Show trace for failed test
npx playwright show-trace playwright-report/traces/trace-123.zip

# Update snapshots (when visual tests are added)
npm run test:e2e --update-snapshots
```

### Seed Data
```bash
# Seed test data (once created)
npm run seed:test
```

---

## 🔧 Configuration Details

### Base URLs
- **Frontend (Vite dev)**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`
- **Test BaseURL**: `http://localhost:3000` (configured in playwright.config.ts)

### Test Accounts
**Member Accounts**:
- Admin: `admin@sommos.local` / `admin123`
- Crew: `crew@sommos.local` / `crew123`
- Guest (member): `guest@sommos.local` / `guest123`

**Guest Event Codes**:
- No PIN: `YACHT2024`
- With PIN: `GUEST2024` (PIN: `123456`)

### Browser Matrix
- **Desktop**: Chromium, Firefox, WebKit
- **Mobile**: iPhone 14, Pixel 7
- **Tablet**: iPad Pro

---

## 📝 Notes & Considerations

### Existing Tests
- Some JS-based E2E tests exist in `tests/e2e/` (e.g., `guest-permissions.spec.js`, `guest-inventory-tests.spec.js`)
- These can be:
  1. Migrated to TypeScript for consistency
  2. Kept as-is if they're comprehensive
  3. Used as reference for new TypeScript tests

### Test Data Strategy
- **Real Backend + Deterministic Seed** (recommended)
  - More realistic, tests actual API integration
  - Requires `seed:test` script to reset DB
  - Slightly slower but catches real issues

- **Mock API** (alternative)
  - Faster, no DB dependency
  - Less realistic, might miss integration bugs

**Current approach**: Real backend + deterministic seed

### Playwright Auto-Start Servers
The `playwright.config.ts` includes `webServer` config that automatically:
1. Starts backend on port 3001
2. Starts frontend on port 3000
3. Waits for health checks
4. Reuses existing servers if already running (local dev)

This means you don't need to manually run `npm run dev` before tests!

### Flake Prevention Best Practices
1. **Use explicit waits**: `await expect(...).toBeVisible()` instead of `waitForTimeout`
2. **Wait for network**: Use `waitForResponse()` for API calls
3. **Robust selectors**: Prefer `data-testid` > `aria-label` > `role` > `id`
4. **Deterministic data**: Use seeded random or fixed test data
5. **Avoid animations**: Wait for animations to complete or disable them
6. **Cleanup**: Clear session/storage between tests

---

## 🎬 Next Action Items

### High Priority (Do First)
1. ✅ Install Playwright browsers: `npx playwright install --with-deps`
2. ⏳ Create `scripts/seed-test-data.js`
3. ⏳ Run smoke tests: `npm run test:e2e tests/e2e/smoke.spec.ts`
4. ⏳ Create auth test suites
5. ⏳ Add `data-testid` attributes to critical UI elements

### Medium Priority
6. ⏳ Create inventory CRUD tests
7. ⏳ Create pairing tests
8. ⏳ Create permissions tests
9. ⏳ Create responsive tests

### Lower Priority
10. ⏳ Create offline/PWA tests
11. ⏳ Create visual regression tests
12. ⏳ Add accessibility audits with Axe
13. ⏳ Create CI/CD workflow

---

## 💡 Tips for Development

### Running Tests During Development
```bash
# Terminal 1: Start servers manually (if not using auto-start)
npm run dev

# Terminal 2: Run tests in watch mode
npm run test:e2e -- --ui
```

### Debugging Failing Tests
1. Run in headed mode: `npm run test:e2e:headed`
2. Use Playwright Inspector: `npm run test:e2e:debug`
3. Check traces: Open `playwright-report/index.html` after failures
4. Add `await page.pause()` in test for manual inspection

### Writing New Tests
1. Import from fixtures: `import { test, expect } from './fixtures/auth';`
2. Use centralized selectors: `import { Selectors } from './utils/selectors';`
3. Use helpers: `import { waitForToast, navigateToView } from './utils/helpers';`
4. Use test data: `import { TEST_WINES, TEST_PAIRINGS } from './fixtures/test-data';`

Example:
```typescript
import { test, expect } from './fixtures/auth';
import { Selectors } from './utils/selectors';
import { navigateToView } from './utils/helpers';

test('admin can access procurement', async ({ authenticatedAsAdmin: page }) => {
  await navigateToView(page, 'procurement');
  await expect(page.locator(Selectors.views.procurement)).toBeVisible();
});
```

---

## ✅ Quick Start Checklist

To get E2E testing up and running:

- [x] Dependencies installed (`@axe-core/playwright`, `@types/node`)
- [x] `playwright.config.ts` created
- [x] Test infrastructure (fixtures, utils, helpers) created
- [x] Smoke test suite created
- [ ] Install Playwright browsers: `npx playwright install --with-deps`
- [ ] Create seed script: `scripts/seed-test-data.js`
- [ ] Run smoke tests: `npm run test:e2e tests/e2e/smoke.spec.ts`
- [ ] Create remaining test suites (auth, inventory, etc.)
- [ ] Add `data-testid` attributes to frontend
- [ ] Create CI/CD workflow
- [ ] Run full suite and fix failures

---

**Status**: Phase 1 Complete ✅  
**Next Phase**: Test Suite Implementation & UI Hardening 🚧
