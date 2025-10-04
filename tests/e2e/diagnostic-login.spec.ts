import { test, expect } from '@playwright/test';

test('diagnostic - manual login flow', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  
  console.log('Step 1: Page loaded');
  
  // Wait for auth screen
  await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 10000 });
  console.log('Step 2: Auth screen visible');
  
  // Click member tab
  const memberTab = page.locator('#member-login-tab');
  await memberTab.click();
  console.log('Step 3: Clicked member tab');
  
  // Wait a bit
  await page.waitForTimeout(500);
  
  // Check if panel is active
  const panelActive = await page.locator('#member-login-panel').evaluate((el) => el.classList.contains('active'));
  console.log('Step 4: Panel active?', panelActive);
  
  // Check if email input exists and is visible
  const emailInput = page.locator('#login-email');
  const emailExists = await emailInput.count();
  console.log('Step 5: Email input count:', emailExists);
  
  if (emailExists > 0) {
    const emailVisible = await emailInput.isVisible();
    console.log('Step 6: Email input visible?', emailVisible);
    
    if (emailVisible) {
      await emailInput.fill('admin@sommos.local');
      console.log('Step 7: Filled email');
      
      await page.fill('#login-password', 'admin123');
      console.log('Step 8: Filled password');
      
      await page.click('#login-submit');
      console.log('Step 9: Clicked submit');
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      const appVisible = await page.locator('#app').evaluate((el) => !el.classList.contains('hidden'));
      console.log('Step 10: App visible?', appVisible);
    }
  }
  
  await page.screenshot({ path: 'diagnostic-login-after.png', fullPage: true });
  
  expect(true).toBe(true); // Always pass
});
