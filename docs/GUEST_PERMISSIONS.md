# SommOS Guest Permissions System

## Overview

This document describes the role-based access control (RBAC) system for guest users in SommOS, the yacht wine management application. Guest users have read-only access to browse the wine collection without the ability to modify inventory, make reservations, or perform administrative tasks.

---

## Guest Permissions Matrix

### ✅ Guest Can Access (Read-Only)

| Feature | Description | Notes |
|---------|-------------|-------|
| **Dashboard** | View wine inventory overview and statistics | Full access to dashboard view |
| **Wine Pairing** | Request AI-powered wine recommendations | Can describe dishes and get pairing suggestions |
| **Inventory Browse** | View wine collection details | Cannot see prices or exact storage locations |
| **Catalog** | Browse complete wine catalog | Read-only access to wine database |
| **Search & Filter** | Search and filter wines | All search functionality available |

### ❌ Guest Cannot Access (Restricted)

| Feature | Restriction Type | Implementation |
|---------|------------------|----------------|
| **Procurement** | Navigation hidden | Nav button has `data-role-allow="admin,crew"` |
| **Sync Data** | Button hidden | Sync button has `data-role-allow="admin,crew"` |
| **Settings** | Button hidden | Settings button has `data-role-allow="admin,crew"` |
| **Wine Reservation** | Function blocked | `reserveWineModal()` calls `ensureCrewAccess()` |
| **Wine Consumption** | Function blocked | `consumeWineModal()` calls `ensureCrewAccess()` |
| **Record Service** | Dashboard card hidden | Has `data-role-allow="admin,crew"` attribute |
| **Purchase Orders** | All procurement functions | Functions check `ensureCrewAccess()` |
| **Price Information** | Hidden in wine cards | Conditionally rendered based on `isGuest` |
| **Storage Locations** | Obscured | Shows "🔒 Location hidden" for guests |

---

## Implementation Details

### 1. HTML Role Restrictions

Elements are restricted using data attributes:

```html
<!-- Hide element for guests (show only to admin/crew) -->
<button data-role-allow="admin,crew">Admin Action</button>

<!-- Show element only to guests -->
<div data-role-allow="guest">Guest Notice</div>

<!-- Explicitly deny guests -->
<button data-role-deny="guest">Crew Action</button>
```

Applied by `applyRoleVisibility()` function on login.

### 2. JavaScript Function Guards

Functions check permissions before executing:

```javascript
async reserveWineModal(vintageId, wineName) {
  if (!this.ensureCrewAccess('Crew or admin access required to reserve wines.')) {
    return;
  }
  // Function logic...
}
```

Helper functions:
- `isGuestUser()` - Returns true if current user role is 'guest'
- `canManageInventory()` - Returns true for crew/admin
- `ensureCrewAccess(message)` - Shows toast and returns false for guests

### 3. Template Conditional Rendering

Wine card templates check guest status:

```javascript
const isGuest = this.isGuestUser();
const actionSection = isGuest
  ? `<div class="guest-readonly">🔒 Guest access is read-only</div>`
  : `<button onclick="app.reserveWineModal()">Reserve</button>`;
```

### 4. Backend API Protection

All API routes are protected with middleware:

```javascript
router.post('/inventory/reserve',
  requireAuth(),
  requireRole('crew', 'admin'),
  asyncHandler(reserveHandler)
);
```

This provides defense-in-depth - even if frontend restrictions are bypassed, the backend enforces permissions.

---

## Testing

### Running Automated Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/guest-permissions.spec.js

# Debug mode (step through tests)
npm run test:e2e:debug
```

### Test Coverage

#### Navigation Tests (`guest-permissions.spec.js`)
- ✓ Procurement nav button is hidden for guests
- ✓ Dashboard, pairing, inventory, catalog are accessible
- ✓ Sync button is hidden for guests
- ✓ Settings button is hidden for guests
- ✓ Guest notice is displayed
- ✓ "Record Service" dashboard action is hidden

#### Inventory Tests (`guest-inventory-tests.spec.js`)
- ✓ Guest can navigate to inventory view
- ✓ Read-only messages are displayed in wine cards
- ✓ Location details show "🔒 Location hidden"
- ✓ Prices are hidden from guests
- ✓ Reserve and Consume buttons are not rendered
- ✓ Direct function calls show warning toasts
- ✓ `isGuestUser()` returns true for guests
- ✓ `ensureCrewAccess()` returns false for guests

#### Session Tests (planned in `guest-session.spec.js`)
- Valid event code login
- Invalid event code handling
- PIN-protected event codes
- Guest session banner display
- Session expiry notifications

### Test Credentials

Guest test accounts are defined in `tests/e2e/fixtures/test-credentials.json`:

- **Simple guest**: Event code `YACHT2025` (no PIN)
- **PIN-protected guest**: Event code `VIP2025`, PIN `123456`

**Note**: These test accounts must be created in the database before running tests.

---

## Creating Guest Event Codes

To create a guest event code for testing or production use:

```bash
# Using the backend API
curl -X POST http://localhost:3001/api/auth/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "guest@event.com",
    "role": "guest",
    "expires_in_hours": 4,
    "pin": "123456"
  }'
```

Or use the admin UI (when implemented) to create guest invite codes.

---

## Security Considerations

### Multi-Layer Protection

1. **UI Layer**: Elements hidden using CSS and `aria-hidden`
2. **JavaScript Layer**: Functions check permissions before executing
3. **API Layer**: Backend middleware enforces role-based access
4. **Token Layer**: JWT tokens contain role information

### Attack Resistance

| Attack Vector | Mitigation |
|---------------|------------|
| DevTools element unhiding | Backend enforces permissions regardless of UI state |
| Console function calls | Functions check `ensureCrewAccess()` before executing |
| Direct API calls | All routes protected with `requireAuth()` and `requireRole()` |
| Token manipulation | JWTs are signed and validated server-side |
| LocalStorage tampering | Session validated via secure HTTP-only cookies |

### Known Limitations

- Guest can see overall inventory counts and wine names
- Guest can access pairing recommendations (intentional - read-only feature)
- UI restrictions can be bypassed via DevTools, but API will reject requests

---

## Audit Findings Summary

### Completed Security Checks ✓

1. **HTML Elements**: All admin/crew buttons have proper `data-role-allow` attributes
2. **JavaScript Functions**: All data-modifying functions check permissions
3. **Template Rendering**: Wine cards conditionally render based on guest status
4. **Backend Routes**: API endpoints protected with role middleware

### Applied Fixes

1. **Settings Button**: Added `data-role-allow="admin,crew"` to hide from guests
2. **Sync Button**: Already had restriction, confirmed working
3. **Procurement View**: Entire view restricted at container level
4. **Dashboard Actions**: "Record Service" card hidden for guests
5. **Inventory Actions**: Reserve/Consume buttons not rendered for guests

### Low-Risk Items (Acceptable As-Is)

- Dish builder buttons (read-only utility functions)
- Catalog view filters (search/filter is read-only)
- Price elements in some views (already conditionally hidden)

---

## Maintenance

### Adding New Restricted Features

When adding new admin/crew-only features:

1. **HTML Elements**: Add `data-role-allow="admin,crew"` attribute
2. **JavaScript Functions**: Add `ensureCrewAccess()` check at start
3. **Templates**: Check `isGuestUser()` and conditionally render
4. **Backend**: Use `requireRole('crew', 'admin')` middleware
5. **Tests**: Add Playwright test to verify restriction

### Modifying Guest Permissions

To grant guests access to a new feature:

1. Remove or modify `data-role-allow` attributes
2. Update `ensureCrewAccess()` checks if applicable
3. Update this documentation
4. Update test expectations

---

## Troubleshooting

### Guest Cannot Login

**Issue**: "Invalid event code" error
**Solution**: Verify event code exists in database and hasn't expired

**Issue**: "PIN required" error  
**Solution**: Check if event code requires PIN, enable PIN toggle in guest login form

### Guest Sees Restricted Elements

**Issue**: Admin buttons visible to guests
**Solution**: Verify `applyRoleVisibility()` is called after login. Check browser console for errors.

### Tests Failing

**Issue**: "Cannot find test credentials"
**Solution**: Ensure test guest accounts are created in database with matching event codes

**Issue**: "Timeout waiting for element"
**Solution**: Check that backend is running and responsive. Increase timeout in test if needed.

---

## References

- [Playwright Documentation](https://playwright.dev/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-10-03 | Initial guest permission system implementation | AI Assistant |
| 2025-10-03 | Added Playwright testing framework | AI Assistant |
| 2025-10-03 | Completed security audit and applied fixes | AI Assistant |
| 2025-10-03 | Created comprehensive documentation | AI Assistant |

---

*For questions or issues related to guest permissions, refer to the audit findings in `tests/e2e/AUDIT_FINDINGS.md`*
