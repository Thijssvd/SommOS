import { test, expect } from '@playwright/test';
import { clearSession, GUEST_EVENT_CODES, verifyUserRole } from '../fixtures/auth';
import { Selectors } from '../utils/selectors';

test.describe('Guest Login - Event Code Access', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await clearSession(page);
    await page.goto('/');
    
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  });
  
  test('should login with valid event code (no PIN)', async ({ page }) => {
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      // In dev mode, try to logout first
      const logoutBtn = page.locator(Selectors.auth.logoutButton);
      if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click();
        await page.waitForSelector(Selectors.auth.screen, { state: 'visible', timeout: 5000 });
      } else {
        test.skip();
        return;
      }
    }
    
    // Click on guest login tab
    const guestTab = page.locator(Selectors.auth.guestLoginTab);
    await guestTab.click();
    await page.waitForSelector(Selectors.auth.guestPanel, { state: 'visible', timeout: 3000 });
    
    // Fill in event code (no PIN)
    await page.fill(Selectors.auth.guestCodeInput, GUEST_EVENT_CODES.basic.eventCode);
    
    // Ensure PIN toggle is NOT checked
    const pinToggle = page.locator(Selectors.auth.guestPinToggle);
    const isChecked = await pinToggle.isChecked();
    if (isChecked) {
      await pinToggle.uncheck();
    }
    
    // Submit guest login
    await page.click(Selectors.auth.guestLoginButton);
    
    // Wait for dashboard to load
    await expect(page.locator(Selectors.views.dashboard)).toBeVisible({ timeout: 15000 });
    
    // Verify guest role is displayed
    await verifyUserRole(page, 'GUEST');
    
    // Verify guest banner/notice is visible
    const guestNotice = page.locator(Selectors.nav.guestNotice);
    await expect(guestNotice).toBeVisible({ timeout: 5000 });
  });
  
  test('should login with valid event code and PIN', async ({ page }) => {
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      const logoutBtn = page.locator(Selectors.auth.logoutButton);
      if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click();
        await page.waitForSelector(Selectors.auth.screen, { state: 'visible', timeout: 5000 });
      } else {
        test.skip();
        return;
      }
    }
    
    // Click on guest login tab
    const guestTab = page.locator(Selectors.auth.guestLoginTab);
    await guestTab.click();
    await page.waitForSelector(Selectors.auth.guestPanel, { state: 'visible', timeout: 3000 });
    
    // Fill in event code
    await page.fill(Selectors.auth.guestCodeInput, GUEST_EVENT_CODES.withPin.eventCode);
    
    // Check PIN toggle
    const pinToggle = page.locator(Selectors.auth.guestPinToggle);
    await pinToggle.check();
    
    // Wait for PIN input to appear
    await page.waitForSelector(Selectors.auth.guestPinGroup, { state: 'visible', timeout: 3000 });
    
    // Fill in PIN
    await page.fill(Selectors.auth.guestPinInput, GUEST_EVENT_CODES.withPin.pin);
    
    // Submit guest login
    await page.click(Selectors.auth.guestLoginButton);
    
    // Wait for dashboard to load
    await expect(page.locator(Selectors.views.dashboard)).toBeVisible({ timeout: 15000 });
    
    // Verify guest role is displayed
    await verifyUserRole(page, 'GUEST');
  });
  
  test('should show error for invalid event code', async ({ page }) => {
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      test.skip();
      return;
    }
    
    // Click on guest login tab
    const guestTab = page.locator(Selectors.auth.guestLoginTab);
    await guestTab.click();
    
    // Fill in invalid event code
    await page.fill(Selectors.auth.guestCodeInput, 'INVALID123');
    
    // Submit guest login
    await page.click(Selectors.auth.guestLoginButton);
    
    // Should show error message
    const errorMsg = page.locator(Selectors.auth.guestError);
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    await expect(errorMsg).toContainText(/invalid|not found|incorrect/i);
    
    // Should still be on auth screen
    await expect(authScreen).not.toHaveClass(/hidden/);
  });
  
  test('should show error for wrong PIN', async ({ page }) => {
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      test.skip();
      return;
    }
    
    // Click on guest login tab
    const guestTab = page.locator(Selectors.auth.guestLoginTab);
    await guestTab.click();
    
    // Fill in valid event code with PIN
    await page.fill(Selectors.auth.guestCodeInput, GUEST_EVENT_CODES.withPin.eventCode);
    
    // Check PIN toggle
    await page.locator(Selectors.auth.guestPinToggle).check();
    await page.waitForSelector(Selectors.auth.guestPinGroup, { state: 'visible', timeout: 3000 });
    
    // Fill in WRONG PIN
    await page.fill(Selectors.auth.guestPinInput, '000000');
    
    // Submit guest login
    await page.click(Selectors.auth.guestLoginButton);
    
    // Should show error message
    const errorMsg = page.locator(Selectors.auth.guestError);
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    
    // Should still be on auth screen
    await expect(authScreen).not.toHaveClass(/hidden/);
  });
  
  test('should validate required event code field', async ({ page }) => {
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      test.skip();
      return;
    }
    
    // Click on guest login tab
    const guestTab = page.locator(Selectors.auth.guestLoginTab);
    await guestTab.click();
    
    // Try to submit without filling event code
    await page.click(Selectors.auth.guestLoginButton);
    
    // Should show validation error or stay on page
    const errorMsg = page.locator(Selectors.auth.guestError);
    const isErrorVisible = await errorMsg.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isErrorVisible) {
      await expect(errorMsg).toContainText(/required|empty/i);
    }
    
    // Should still be on auth screen
    await expect(authScreen).not.toHaveClass(/hidden/);
  });
});

test.describe('Guest Login - Session Behavior', () => {
  test('should show guest notice when logged in as guest', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      // Already logged in, check if we're guest
      const roleBadge = page.locator(Selectors.nav.userRoleBadge);
      const roleText = await roleBadge.textContent();
      
      if (roleText?.includes('GUEST')) {
        const guestNotice = page.locator(Selectors.nav.guestNotice);
        await expect(guestNotice).toBeVisible();
        await expect(guestNotice).toContainText(/read-only|guest/i);
      }
      return;
    }
    
    // Login as guest
    await page.click(Selectors.auth.guestLoginTab);
    await page.fill(Selectors.auth.guestCodeInput, GUEST_EVENT_CODES.basic.eventCode);
    await page.click(Selectors.auth.guestLoginButton);
    
    // Wait for dashboard
    await expect(page.locator(Selectors.views.dashboard)).toBeVisible({ timeout: 15000 });
    
    // Check guest notice
    const guestNotice = page.locator(Selectors.nav.guestNotice);
    await expect(guestNotice).toBeVisible();
  });
  
  test('should allow guest to navigate to allowed views', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Ensure we're logged in as guest
    const roleBadge = page.locator(Selectors.nav.userRoleBadge);
    const roleText = await roleBadge.textContent().catch(() => '');
    
    if (!roleText?.includes('GUEST')) {
      // Not logged in as guest, skip
      test.skip();
      return;
    }
    
    // Navigate to dashboard
    await page.click(Selectors.nav.dashboard);
    await expect(page.locator(Selectors.views.dashboard)).toBeVisible();
    
    // Navigate to pairing
    await page.click(Selectors.nav.pairing);
    await expect(page.locator(Selectors.views.pairing)).toBeVisible({ timeout: 10000 });
    
    // Navigate to inventory
    await page.click(Selectors.nav.inventory);
    await expect(page.locator(Selectors.views.inventory)).toBeVisible({ timeout: 10000 });
    
    // Navigate to catalog
    await page.click(Selectors.nav.catalog);
    await expect(page.locator(Selectors.views.catalog)).toBeVisible({ timeout: 10000 });
  });
});
