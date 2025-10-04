import { test, expect } from '@playwright/test';

test('diagnostic - check CSS visibility', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  
  // Wait for auth screen
  await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 10000 });
  
  // Click member tab
  await page.locator('#member-login-tab').click();
  await page.waitForTimeout(1000);
  
  // Get all CSS properties of the email input
  const emailStyles = await page.locator('#login-email').evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return {
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      width: styles.width,
      height: styles.height,
      position: styles.position,
      offsetParent: el.offsetParent?.tagName,
      classList: Array.from(el.classList),
      parentDisplay: window.getComputedStyle(el.parentElement!).display,
      grandparentDisplay: window.getComputedStyle(el.parentElement!.parentElement!).display
    };
  });
  
  console.log('Email input styles:', JSON.stringify(emailStyles, null, 2));
  
  // Check the panel
  const panelStyles = await page.locator('#member-login-panel').evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return {
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      classList: Array.from(el.classList),
      isActive: el.classList.contains('active')
    };
  });
  
  console.log('Panel styles:', JSON.stringify(panelStyles, null, 2));
  
  expect(true).toBe(true);
});
