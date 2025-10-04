import { test, expect } from '@playwright/test';
import { clearSession, TEST_USERS, verifyUserRole, fillLoginForm, submitLoginForm } from '../fixtures/auth';
import { Selectors } from '../utils/selectors';
import { waitForToast } from '../utils/helpers';

test.describe('Member Login - Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await clearSession(page);
    await page.goto('/');
    
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  });
  
  test('should successfully login as admin with valid credentials', async ({ page }) => {
    // Check if auth screen is visible or if we're auto-logged in
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      // In dev mode with auth bypass, logout first
      const logoutBtn = page.locator(Selectors.auth.logoutButton);
      if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click();
        await page.waitForSelector(Selectors.auth.screen, { state: 'visible', timeout: 5000 });
      } else {
        // Skip test if we can't access auth screen
        test.skip();
        return;
      }
    }
    
    // Ensure we're on member login tab
    const memberTab = page.locator(Selectors.auth.memberLoginTab);
    await memberTab.click();
    await page.waitForSelector(Selectors.auth.memberPanel, { state: 'visible', timeout: 3000 });
    
    // Fill in admin credentials
    await fillLoginForm(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    
    // Submit login
    await submitLoginForm(page);
    
    // Wait for dashboard to load
    await expect(page.locator(Selectors.views.dashboard)).toBeVisible({ timeout: 15000 });
    
    // Verify admin role is displayed
    await verifyUserRole(page, 'ADMIN');
    
    // Verify auth screen is hidden
    await expect(authScreen).toHaveClass(/hidden/);
  });
  
  test('should successfully login as crew with valid credentials', async ({ page }) => {
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
    
    // Ensure we're on member login tab
    const memberTab = page.locator(Selectors.auth.memberLoginTab);
    await memberTab.click();
    
    // Fill in crew credentials
    await fillLoginForm(page, TEST_USERS.crew.email, TEST_USERS.crew.password);
    
    // Submit login
    await submitLoginForm(page);
    
    // Wait for dashboard to load
    await expect(page.locator(Selectors.views.dashboard)).toBeVisible({ timeout: 15000 });
    
    // Verify crew role is displayed
    await verifyUserRole(page, 'CREW');
  });
  
  test('should show error message for invalid email', async ({ page }) => {
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      test.skip();
      return;
    }
    
    // Fill in invalid credentials
    await fillLoginForm(page, 'invalid@example.com', 'wrongpassword');
    
    // Submit login
    await submitLoginForm(page);
    
    // Should show error message
    const errorMsg = page.locator(Selectors.auth.loginError);
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    await expect(errorMsg).toContainText(/invalid|incorrect|failed/i);
    
    // Should still be on auth screen
    await expect(authScreen).not.toHaveClass(/hidden/);
  });
  
  test('should show error message for incorrect password', async ({ page }) => {
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      test.skip();
      return;
    }
    
    // Fill in valid email but wrong password
    await fillLoginForm(page, TEST_USERS.admin.email, 'wrongpassword123');
    
    // Submit login
    await submitLoginForm(page);
    
    // Should show error message
    const errorMsg = page.locator(Selectors.auth.loginError);
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    
    // Should still be on auth screen
    await expect(authScreen).not.toHaveClass(/hidden/);
  });
  
  test('should validate required fields', async ({ page }) => {
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      test.skip();
      return;
    }
    
    // Try to submit without filling fields
    await submitLoginForm(page);
    
    // Should show validation error
    const errorMsg = page.locator(Selectors.auth.loginError);
    const isErrorVisible = await errorMsg.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isErrorVisible) {
      await expect(errorMsg).toContainText(/required/i);
    }
    
    // Should still be on auth screen
    await expect(authScreen).not.toHaveClass(/hidden/);
  });
  
  test('should maintain session after page reload', async ({ page }) => {
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isAuthVisible) {
      // Already logged in, verify session persists after reload
      await page.reload();
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Should still be logged in
      await expect(page.locator(Selectors.app.container)).not.toHaveClass(/hidden/);
      await expect(page.locator(Selectors.nav.userRoleBadge)).toBeVisible();
      return;
    }
    
    // Login as admin
    await fillLoginForm(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    await submitLoginForm(page);
    
    // Wait for dashboard
    await expect(page.locator(Selectors.views.dashboard)).toBeVisible({ timeout: 15000 });
    await verifyUserRole(page, 'ADMIN');
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Should still be logged in
    await expect(page.locator(Selectors.app.container)).not.toHaveClass(/hidden/);
    await verifyUserRole(page, 'ADMIN');
  });
});

test.describe('Member Login - Logout Flow', () => {
  test('should successfully logout', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Check if we're logged in
    const appContainer = page.locator(Selectors.app.container);
    const isLoggedIn = await appContainer.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (!isLoggedIn) {
      // Need to login first
      const authScreen = page.locator(Selectors.auth.screen);
      const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
      
      if (isAuthVisible) {
        await fillLoginForm(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
        await submitLoginForm(page);
        await expect(page.locator(Selectors.views.dashboard)).toBeVisible({ timeout: 15000 });
      }
    }
    
    // Now logout
    const logoutBtn = page.locator(Selectors.auth.logoutButton);
    await logoutBtn.click();
    
    // Should return to auth screen
    const authScreen = page.locator(Selectors.auth.screen);
    await expect(authScreen).not.toHaveClass(/hidden/, { timeout: 5000 });
    
    // App container should be hidden
    await expect(appContainer).toHaveClass(/hidden/);
  });
});
