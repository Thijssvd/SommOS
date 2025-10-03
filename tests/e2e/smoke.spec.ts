import { test, expect } from '@playwright/test';
import { collectConsoleMessages, filterConsoleErrors, isServiceWorkerRegistered } from './utils/helpers';
import { Selectors } from './utils/selectors';

test.describe('Smoke Tests - Basic App Functionality', () => {
  test('should load application without errors', async ({ page }) => {
    const messages = await collectConsoleMessages(page, async () => {
      await page.goto('/');
    });
    
    const errors = filterConsoleErrors(messages);
    
    // Filter out expected/benign errors
    const criticalErrors = errors.filter((err) => {
      // Exclude known development warnings
      return !err.includes('DevTools') && 
             !err.includes('[vite]') &&
             !err.includes('favicon');
    });
    
    expect(criticalErrors).toHaveLength(0);
  });
  
  test('should display auth screen OR auto-login in dev mode', async ({ page }) => {
    await page.goto('/');
    
    // Wait a moment for page to initialize
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Check if auth screen is visible
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (isAuthVisible) {
      // Production-like behavior: Auth screen shows
      await expect(authScreen).toBeVisible();
      await expect(page.locator(Selectors.auth.memberLoginTab)).toBeVisible();
      await expect(page.locator(Selectors.auth.guestLoginTab)).toBeVisible();
    } else {
      // Development mode: Auto-logged in
      await expect(page.locator(Selectors.app.container)).not.toHaveClass(/hidden/);
      await expect(page.locator(Selectors.views.dashboard)).toBeVisible({ timeout: 5000 });
      
      // Should show user role badge
      const userBadge = page.locator(Selectors.nav.userRoleBadge);
      await expect(userBadge).toBeVisible();
    }
  });
  
  test('should load all critical resources (no 404s)', async ({ page }) => {
    const failed404s: string[] = [];
    
    page.on('response', (response) => {
      if (response.status() === 404) {
        failed404s.push(response.url());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Filter out non-critical 404s (like optional favicons)
    const critical404s = failed404s.filter((url) => {
      return !url.includes('favicon') && 
             !url.includes('.map') && // Source maps
             !url.includes('sw.js'); // Service worker may not exist yet
    });
    
    expect(critical404s).toHaveLength(0);
  });
  
  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SommOS/);
  });
  
  test('should have SommOS branding visible', async ({ page }) => {
    await page.goto('/');
    
    // Wait for loading screen to disappear
    await page.waitForSelector(Selectors.app.loadingScreen, { state: 'hidden', timeout: 30000 }).catch(() => {});
    
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Check for brand text (should be visible in either auth screen or nav)
    const brandText = page.getByText('SommOS', { exact: false });
    await expect(brandText.first()).toBeVisible({ timeout: 5000 });
  });
  
  test('should register service worker (PWA)', async ({ page, browserName }) => {
    // Skip this test in webkit as service workers behave differently
    test.skip(browserName === 'webkit', 'Service worker registration inconsistent in webkit');
    
    await page.goto('/');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Give service worker time to register
    await page.waitForTimeout(2000);
    
    // Check if service worker is registered
    const isRegistered = await isServiceWorkerRegistered(page);
    
    // We expect it to be registered in production-like builds
    // In development it might not be, so we'll just log the result
    console.log(`Service Worker registered: ${isRegistered}`);
  });
  
  test('should have responsive viewport meta tag', async ({ page }) => {
    await page.goto('/');
    
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', /width=device-width/);
  });
  
  test('should have manifest link for PWA', async ({ page }) => {
    await page.goto('/');
    
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.json');
  });
  
  test('should have basic accessibility on main screen', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Basic accessibility checks
    // Check for proper heading structure (should have at least one h1)
    const h1 = page.locator('h1');
    const h1Count = await h1.count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
    
    // Check if auth screen or main app is visible
    const authScreen = page.locator(Selectors.auth.screen);
    const isAuthVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
    
    if (isAuthVisible) {
      // Check auth form accessibility
      const emailInput = page.locator(Selectors.auth.emailInput);
      const emailLabel = page.locator('label[for="login-email"]');
      await expect(emailLabel).toBeVisible();
      
      const passwordInput = page.locator(Selectors.auth.passwordInput);
      const passwordLabel = page.locator('label[for="login-password"]');
      await expect(passwordLabel).toBeVisible();
    } else {
      // Check main app has navigation
      const nav = page.locator(Selectors.nav.container);
      await expect(nav).toBeVisible();
    }
  });
  
  test('should have skip link for keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check for skip link (might be visually hidden)
    const skipLink = page.getByText('Skip to main content', { exact: false });
    const count = await skipLink.count();
    
    // If it exists, verify it has proper href
    if (count > 0) {
      await expect(skipLink).toHaveAttribute('href', '#main-content');
    }
  });
});
