import { test, expect } from '@playwright/test';

test('diagnostic - check initial page state', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  
  // Take screenshot
  await page.screenshot({ path: 'diagnostic-initial.png', fullPage: true });
  
  // Check what's visible
  const authScreenHidden = await page.locator('#auth-screen').evaluate((el) => el.classList.contains('hidden'));
  const appHidden = await page.locator('#app').evaluate((el) => el.classList.contains('hidden'));
  
  console.log('Auth screen hidden:', authScreenHidden);
  console.log('App hidden:', appHidden);
  
  // Check user role badge
  const roleBadge = await page.locator('#user-role-badge').textContent();
  console.log('Role badge:', roleBadge);
  
  // Check if we can see login form
  const emailInput = page.locator('#login-email');
  const emailVisible = await emailInput.isVisible().catch(() => false);
  console.log('Email input visible:', emailVisible);
  
  // Output HTML for debugging
  const authScreenHTML = await page.locator('#auth-screen').innerHTML().catch(() => 'NOT FOUND');
  console.log('Auth screen HTML length:', authScreenHTML.length);
  
  expect(true).toBe(true); // Always pass
});
