# Data Test ID Reference Guide

**Last Updated**: October 3, 2025  
**Purpose**: Comprehensive reference for all `data-testid` attributes used in SommOS E2E tests

---

## Overview

This document provides a complete reference of all `data-testid` attributes added to the SommOS frontend. These IDs provide stable, semantic selectors for E2E tests that won't break when CSS classes or DOM structure changes.

**Convention**: `{component}-{element}-{name}` or `{component}-{action}-{name}`

---

## Authentication Screen

### Member Login Tab

| Element | Test ID | Selector | Description |
|---------|---------|----------|-------------|
| Member Tab Button | `auth-tab-member` | `[data-testid="auth-tab-member"]` | Member login tab button |
| Guest Tab Button | `auth-tab-guest` | `[data-testid="auth-tab-guest"]` | Guest access tab button |

### Member Login Form

| Element | Test ID | Selector | Description |
|---------|---------|----------|-------------|
| Login Form | `auth-form-member` | `[data-testid="auth-form-member"]` | Member login form container |
| Email Input | `auth-input-email` | `[data-testid="auth-input-email"]` | Email/username input field |
| Password Input | `auth-input-password` | `[data-testid="auth-input-password"]` | Password input field |
| Login Button | `auth-button-login` | `[data-testid="auth-button-login"]` | Submit login button |

### Guest Login Form

| Element | Test ID | Selector | Description |
|---------|---------|----------|-------------|
| Event Code Input | `auth-input-guest-code` | `[data-testid="auth-input-guest-code"]` | Guest event code input |
| PIN Input | `auth-input-guest-pin` | `[data-testid="auth-input-guest-pin"]` | Guest PIN input (conditional) |
| PIN Toggle Checkbox | `auth-checkbox-guest-pin-toggle` | `[data-testid="auth-checkbox-guest-pin-toggle"]` | Toggle to show PIN field |
| Guest Login Button | `auth-button-guest-login` | `[data-testid="auth-button-guest-login"]` | Submit guest login |

---

## Main Navigation

### Navigation Menu Items

| Element | Test ID | Selector | Description |
|---------|---------|----------|-------------|
| Dashboard Nav | `nav-dashboard` | `[data-testid="nav-dashboard"]` | Navigate to Dashboard view |
| Pairing Nav | `nav-pairing` | `[data-testid="nav-pairing"]` | Navigate to Wine Pairing view |
| Inventory Nav | `nav-inventory` | `[data-testid="nav-inventory"]` | Navigate to Inventory view |
| Procurement Nav | `nav-procurement` | `[data-testid="nav-procurement"]` | Navigate to Procurement view (admin/crew) |
| Catalog Nav | `nav-catalog` | `[data-testid="nav-catalog"]` | Navigate to Wine Catalog view |
| Glossary Nav | `nav-glossary` | `[data-testid="nav-glossary"]` | Navigate to Glossary view |

### Navigation Actions

| Element | Test ID | Selector | Description |
|---------|---------|----------|-------------|
| Help Button | `nav-action-help` | `[data-testid="nav-action-help"]` | Open help/glossary modal |
| Sync Button | `nav-action-sync` | `[data-testid="nav-action-sync"]` | Trigger data sync (admin/crew) |
| Settings Button | `nav-action-settings` | `[data-testid="nav-action-settings"]` | Open settings modal |
| Logout Button | `nav-action-logout` | `[data-testid="nav-action-logout"]` | Sign out of application |

---

## Dashboard View

### Quick Actions

| Element | Test ID | Selector | Description |
|---------|---------|----------|-------------|
| Quick Pairing Action | `dashboard-action-pairing` | `[data-testid="dashboard-action-pairing"]` | Quick wine pairing action card |
| Record Service Action | `dashboard-action-record` | `[data-testid="dashboard-action-record"]` | Record wine consumption (admin/crew) |

---

## Usage in Tests

### TypeScript Example

```typescript
import { test, expect } from '@playwright/test';

test('should login with valid credentials', async ({ page }) => {
  await page.goto('/');
  
  // Click member login tab
  await page.click('[data-testid="auth-tab-member"]');
  
  // Fill credentials
  await page.fill('[data-testid="auth-input-email"]', 'admin@sommos.local');
  await page.fill('[data-testid="auth-input-password"]', 'admin123');
  
  // Submit
  await page.click('[data-testid="auth-button-login"]');
  
  // Verify navigation visible
  await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
});
```

### Using Selectors Utility

```typescript
import { Selectors, testId } from './utils/selectors';

// Use centralized selectors
await page.click(Selectors.auth.memberLoginTab);

// Or use testId helper
await page.click(testId('auth-button-login'));
```

---

## Best Practices

### DO ✅

- Use semantic, descriptive test IDs
- Follow the naming convention: `{component}-{type}-{name}`
- Keep test IDs stable across refactors
- Document new test IDs in this file
- Use test IDs as primary selectors in E2E tests

### DON'T ❌

- Use generated or random IDs (e.g., `button-12345`)
- Change test IDs without updating tests
- Duplicate test IDs across different elements
- Use test IDs for styling (use classes instead)
- Over-nest identifiers (keep them flat and readable)

---

## Adding New Test IDs

### Process

1. **Identify the element**: Determine which UI element needs a test ID
2. **Choose a name**: Follow the naming convention
3. **Add the attribute**: `data-testid="component-type-name"`
4. **Update this document**: Add to the appropriate section
5. **Update selectors.ts**: Add to centralized selectors if widely used
6. **Write tests**: Use the new test ID in your E2E tests

### Example

```html
<!-- Before -->
<button id="add-bottle" class="btn primary">Add Bottle</button>

<!-- After -->
<button id="add-bottle" class="btn primary" data-testid="inventory-button-add">
  Add Bottle
</button>
```

### Update Docs

```markdown
## Inventory View

### Actions
| Element | Test ID | Selector | Description |
|---------|---------|----------|-------------|
| Add Bottle Button | `inventory-button-add` | `[data-testid="inventory-button-add"]` | Open add bottle form |
```

---

## To Be Added

### High Priority

- [ ] **Inventory View**
  - `inventory-search-input` - Search wine inventory
  - `inventory-filter-type` - Filter by wine type
  - `inventory-filter-location` - Filter by cellar location
  - `inventory-button-add` - Add new bottle button
  - `inventory-table` - Main inventory table
  - `inventory-row-{id}` - Individual wine rows
  - `inventory-button-edit-{id}` - Edit bottle button
  - `inventory-button-delete-{id}` - Delete bottle button

- [ ] **Pairing View**
  - `pairing-input-dish` - Dish description textarea
  - `pairing-select-occasion` - Occasion dropdown
  - `pairing-input-guests` - Guest count input
  - `pairing-button-submit` - Get pairing recommendations
  - `pairing-card-recommendation` - Wine recommendation cards
  - `pairing-button-thumbs-up` - Positive feedback
  - `pairing-button-thumbs-down` - Negative feedback

- [ ] **Modals/Dialogs**
  - `modal-overlay` - Modal backdrop
  - `modal-container` - Modal content container
  - `modal-button-close` - Close modal button
  - `modal-button-confirm` - Confirm action button
  - `modal-button-cancel` - Cancel action button

- [ ] **Forms (General)**
  - `form-input-{field}` - Generic form inputs
  - `form-select-{field}` - Dropdown selects
  - `form-textarea-{field}` - Text areas
  - `form-error-{field}` - Field error messages
  - `form-button-submit` - Submit button
  - `form-button-cancel` - Cancel button

### Medium Priority

- [ ] **Procurement View** (admin/crew only)
- [ ] **Catalog View**
- [ ] **Settings Modal**
- [ ] **Glossary Modal**
- [ ] **Toast Notifications**

### Low Priority

- [ ] **Loading States**
- [ ] **Empty States**
- [ ] **Error Boundaries**

---

## Selector Priority

When writing E2E tests, use selectors in this priority order:

1. **`data-testid`** - Primary (most stable) ✅

   ```typescript
   page.locator('[data-testid="auth-button-login"]')
   ```

2. **`aria-label`** - Secondary (semantic)

   ```typescript
   page.locator('[aria-label="Navigate to Dashboard"]')
   ```

3. **`role`** - Tertiary (accessibility)

   ```typescript
   page.locator('button[role="menuitem"]')
   ```

4. **`id`** - Fallback (functional IDs)

   ```typescript
   page.locator('#login-submit')
   ```

5. **`class`** - Last resort (fragile) ⚠️

   ```typescript
   page.locator('.btn.primary') // Avoid if possible
   ```

---

## Migration Status

### Completed ✅

- [x] Authentication forms (member & guest)
- [x] Navigation menu (all items)
- [x] Navigation actions (help, sync, settings, logout)
- [x] Dashboard quick actions

### In Progress 🚧

- [ ] Inventory view components
- [ ] Pairing view components
- [ ] Modal dialogs

### Not Started ❌

- [ ] Procurement view
- [ ] Catalog view
- [ ] Settings modal
- [ ] Glossary modal

---

## Related Documentation

- **Test Selectors**: `tests/e2e/utils/selectors.ts` - Centralized selector constants
- **Test Helpers**: `tests/e2e/utils/helpers.ts` - Helper functions for common operations
- **Test Fixtures**: `tests/e2e/fixtures/auth.ts` - Authentication state fixtures
- **Implementation Status**: `tests/e2e/IMPLEMENTATION_STATUS.md` - Overall test implementation status

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-10-03 | Initial test IDs added (auth, nav, dashboard) | Development Team |

---

**Need to add a new test ID?** Follow the naming convention and update this document!
