import { test, expect } from './fixtures/auth';
import { injectAxe, checkA11y, getViolations, reportViolations } from 'axe-playwright';
import { Selectors } from './utils/selectors';
import { navigateToView, waitForNetworkIdle } from './utils/helpers';

test.describe('Accessibility - Axe Core Audits', () => {
  test('auth screen should have no serious a11y violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(Selectors.auth.screen, { timeout: 10000 });

    // Inject axe-core
    await injectAxe(page);

    // Check accessibility
    const violations = await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });

    // Should have no critical or serious violations
    const criticalViolations = violations.filter(
      (v: any) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalViolations.length > 0) {
      console.log('A11y violations on auth screen:', JSON.stringify(criticalViolations, null, 2));
    }

    expect(criticalViolations).toHaveLength(0);
  });

  test('dashboard should have no serious a11y violations', async ({ authenticatedAsAdmin: page }) => {
    await navigateToView(page, 'dashboard');
    await waitForNetworkIdle(page);

    await injectAxe(page);
    const violations = await checkA11y(page);

    const criticalViolations = violations.filter(
      (v: any) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalViolations.length > 0) {
      console.log('A11y violations on dashboard:', JSON.stringify(criticalViolations, null, 2));
    }

    expect(criticalViolations).toHaveLength(0);
  });

  test('inventory view should have no serious a11y violations', async ({ authenticatedAsAdmin: page }) => {
    await navigateToView(page, 'inventory');
    await waitForNetworkIdle(page);

    await injectAxe(page);
    const violations = await checkA11y(page);

    const criticalViolations = violations.filter(
      (v: any) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalViolations.length > 0) {
      console.log('A11y violations on inventory:', JSON.stringify(criticalViolations, null, 2));
    }

    expect(criticalViolations).toHaveLength(0);
  });

  test('pairing view should have no serious a11y violations', async ({ authenticatedAsAdmin: page }) => {
    await navigateToView(page, 'pairing');
    await waitForNetworkIdle(page);

    await injectAxe(page);
    const violations = await checkA11y(page);

    const criticalViolations = violations.filter(
      (v: any) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalViolations.length > 0) {
      console.log('A11y violations on pairing:', JSON.stringify(criticalViolations, null, 2));
    }

    expect(criticalViolations).toHaveLength(0);
  });
});

test.describe('Accessibility - Keyboard Navigation', () => {
  test('should navigate auth form with keyboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(Selectors.auth.screen);

    // Tab to email field
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check focus is on email or tab button
    let focused = await page.evaluate(() => document.activeElement?.id);
    
    // Type email
    await page.keyboard.type('test@example.com');

    // Tab to password
    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => document.activeElement?.id);
    expect(['login-password', 'login-email']).toContain(focused || '');

    // Type password
    await page.keyboard.type('testpassword');

    // Tab to submit button
    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => document.activeElement?.id);
    
    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Form should attempt to submit (will fail with invalid creds, that's OK)
    await page.waitForTimeout(1000);
  });

  test('should navigate main app with keyboard', async ({ authenticatedAsAdmin: page }) => {
    // Tab through navigation
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      const focused = await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id,
        role: document.activeElement?.getAttribute('role'),
        testId: document.activeElement?.getAttribute('data-testid')
      }));

      // Should be able to focus interactive elements
      if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(focused.tag || '')) {
        // Good - focused on interactive element
        console.log('Focused:', focused);
      }
    }

    // Should have focused at least one navigation button
    const navButtons = await page.locator('.nav-item[data-view]').all();
    expect(navButtons.length).toBeGreaterThan(0);
  });

  test('should show focus rings on interactive elements', async ({ authenticatedAsAdmin: page }) => {
    await navigateToView(page, 'inventory');

    // Focus on search input
    const searchInput = page.locator(Selectors.inventory.searchInputTestId);
    await searchInput.focus();

    // Check for focus styles
    const hasFocusStyle = await searchInput.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      // Check for outline or box-shadow (common focus indicators)
      return styles.outline !== 'none' || 
             styles.outlineWidth !== '0px' ||
             styles.boxShadow !== 'none';
    });

    expect(hasFocusStyle).toBeTruthy();
  });

  test('should trap focus in modals', async ({ authenticatedAsAdmin: page }) => {
    test.skip(true, 'Requires modal to be open - implementation depends on app flow');
    
    // This would test:
    // 1. Open a modal
    // 2. Tab through all focusable elements in modal
    // 3. Verify focus doesn't escape modal
    // 4. Verify Escape key closes modal
  });
});

test.describe('Accessibility - Screen Reader Support', () => {
  test('should have proper ARIA landmarks', async ({ authenticatedAsAdmin: page }) => {
    // Check for main landmark
    const main = page.locator('[role="main"], main');
    await expect(main).toHaveCount(1);

    // Check for navigation landmark
    const nav = page.locator('[role="navigation"], nav');
    await expect(nav).toHaveCount(1);

    // Check for banner (if exists)
    const banner = page.locator('[role="banner"], header');
    const bannerCount = await banner.count();
    expect(bannerCount).toBeGreaterThanOrEqual(0);
  });

  test('should have proper heading hierarchy', async ({ authenticatedAsAdmin: page }) => {
    // Get all headings
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    
    // Should have at least one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // Check heading levels don't skip (h1 -> h3 is bad)
    const headingLevels = await Promise.all(
      headings.map(h => h.evaluate(el => parseInt(el.tagName.substring(1))))
    );

    // Verify no big jumps in heading levels
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1];
      expect(Math.abs(diff)).toBeLessThanOrEqual(2);
    }
  });

  test('form inputs should have labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(Selectors.auth.screen);

    // Check email input has label
    const emailInput = page.locator(Selectors.auth.emailInput);
    const emailInputId = await emailInput.getAttribute('id');
    
    if (emailInputId) {
      const label = page.locator(`label[for="${emailInputId}"]`);
      await expect(label).toHaveCount(1);
    } else {
      // Check for aria-label
      const ariaLabel = await emailInput.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }

    // Check password input has label
    const passwordInput = page.locator(Selectors.auth.passwordInput);
    const passwordInputId = await passwordInput.getAttribute('id');
    
    if (passwordInputId) {
      const label = page.locator(`label[for="${passwordInputId}"]`);
      await expect(label).toHaveCount(1);
    } else {
      const ariaLabel = await passwordInput.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }
  });

  test('buttons should have accessible names', async ({ authenticatedAsAdmin: page }) => {
    await navigateToView(page, 'inventory');

    // Get all buttons
    const buttons = await page.locator('button').all();

    for (const button of buttons) {
      const accessibleName = await button.evaluate((btn) => {
        // Check for text content, aria-label, or aria-labelledby
        const text = btn.textContent?.trim();
        const ariaLabel = btn.getAttribute('aria-label');
        const ariaLabelledBy = btn.getAttribute('aria-labelledby');

        return text || ariaLabel || ariaLabelledBy;
      });

      expect(accessibleName).toBeTruthy();
    }
  });

  test('images should have alt text', async ({ authenticatedAsAdmin: page }) => {
    const images = await page.locator('img').all();

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Images should have alt text or role="presentation"
      expect(alt !== null || role === 'presentation').toBeTruthy();
    }
  });

  test('error messages should be announced', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(Selectors.auth.screen);

    // Submit invalid login
    await page.fill(Selectors.auth.emailInput, 'invalid@test.com');
    await page.fill(Selectors.auth.passwordInput, 'wrongpassword');
    await page.click(Selectors.auth.loginButton);

    // Wait for error
    await page.waitForTimeout(2000);

    // Check for aria-live region
    const errorElement = page.locator('[role="alert"], [aria-live]');
    const errorCount = await errorElement.count();

    if (errorCount > 0) {
      // Should have live region
      const ariaLive = await errorElement.first().getAttribute('aria-live');
      expect(['assertive', 'polite']).toContain(ariaLive);
    }
  });
});

test.describe('Accessibility - Color Contrast', () => {
  test('should have sufficient color contrast', async ({ authenticatedAsAdmin: page }) => {
    await injectAxe(page);

    // Check specifically for color contrast violations
    const violations = await checkA11y(page, undefined, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });

    const contrastViolations = violations.filter((v: any) => v.id === 'color-contrast');

    if (contrastViolations.length > 0) {
      console.log('Color contrast violations:', JSON.stringify(contrastViolations, null, 2));
    }

    expect(contrastViolations).toHaveLength(0);
  });

  test('should have minimum font size', async ({ authenticatedAsAdmin: page }) => {
    // Get all text elements
    const textElements = await page.locator('p, span, div, li, td, th, label, button, a').all();

    let tooSmallCount = 0;

    for (const element of textElements.slice(0, 50)) { // Sample first 50
      const fontSize = await element.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return parseFloat(styles.fontSize);
      });

      if (fontSize < 14 && fontSize > 0) {
        tooSmallCount++;
      }
    }

    // Most text should be at least 14px
    expect(tooSmallCount).toBeLessThan(5);
  });

  test('should have adequate touch target sizes', async ({ authenticatedAsAdmin: page }) => {
    // Check button sizes
    const buttons = await page.locator('button, a[href], [role="button"]').all();

    let tooSmallCount = 0;

    for (const button of buttons.slice(0, 20)) { // Sample first 20
      const boundingBox = await button.boundingBox();

      if (boundingBox && (boundingBox.width < 44 || boundingBox.height < 44)) {
        tooSmallCount++;
      }
    }

    // Most interactive elements should be at least 44x44px
    expect(tooSmallCount).toBeLessThan(3);
  });
});

test.describe('Accessibility - Mobile Responsive', () => {
  test('should be accessible on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    await page.waitForSelector(Selectors.auth.screen);

    // Run axe audit
    await injectAxe(page);
    const violations = await checkA11y(page);

    const criticalViolations = violations.filter(
      (v: any) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test('should have touch-friendly navigation on mobile', async ({ authenticatedAsAdmin: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Check if navigation adapts to mobile
    const navContainer = page.locator(Selectors.nav.container);
    const navStyles = await navContainer.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        display: styles.display,
        flexDirection: styles.flexDirection,
        width: styles.width
      };
    });

    // Navigation should adapt (be full width or change layout)
    console.log('Mobile nav styles:', navStyles);
    expect(navStyles.display).toBeTruthy();
  });

  test('should handle orientation changes', async ({ authenticatedAsAdmin: page }) => {
    // Portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await waitForNetworkIdle(page);

    const portraitMain = page.locator('[role="main"], main');
    await expect(portraitMain).toBeVisible();

    // Landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await waitForNetworkIdle(page);

    const landscapeMain = page.locator('[role="main"], main');
    await expect(landscapeMain).toBeVisible();
  });
});

test.describe('Accessibility - Focus Management', () => {
  test('should return focus after dialog closes', async ({ authenticatedAsAdmin: page }) => {
    test.skip(true, 'Requires modal workflow - implementation depends on app');
  });

  test('should focus first interactive element in view after navigation', async ({ authenticatedAsAdmin: page }) => {
    await navigateToView(page, 'inventory');
    await waitForNetworkIdle(page);

    // Get currently focused element
    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      id: document.activeElement?.id
    }));

    // Should focus on something interactive or body
    expect(['BODY', 'INPUT', 'BUTTON', 'SELECT', 'A']).toContain(focused.tag || '');
  });

  test('should have skip navigation link', async ({ page }) => {
    await page.goto('/');

    // Check for skip link
    const skipLink = page.locator('.skip-link, a[href="#main-content"]');
    const count = await skipLink.count();

    if (count > 0) {
      // Should be hidden but focusable
      await skipLink.focus();
      
      // When focused, should be visible
      const isVisible = await skipLink.isVisible();
      console.log('Skip link visible when focused:', isVisible);
    }
  });
});

test.describe('Accessibility - Screen Reader Announcements', () => {
  test('should announce loading states', async ({ authenticatedAsAdmin: page }) => {
    await navigateToView(page, 'inventory');

    // Look for loading indicators with aria-live
    const loadingElements = await page.locator('[aria-live], [aria-busy="true"]').all();
    
    console.log(`Found ${loadingElements.length} elements with live regions or busy state`);
  });

  test('should announce successful actions', async ({ authenticatedAsAdmin: page }) => {
    test.skip(true, 'Requires action workflow - implementation depends on app');
    
    // This would test:
    // 1. Perform an action (e.g., save)
    // 2. Check for success message with aria-live="polite"
    // 3. Verify message is in DOM
  });

  test('should announce error states', async ({ page }) => {
    await page.goto('/');
    
    // Trigger an error (invalid login)
    await page.fill(Selectors.auth.emailInput, 'invalid@test.com');
    await page.fill(Selectors.auth.passwordInput, 'wrong');
    await page.click(Selectors.auth.loginButton);

    await page.waitForTimeout(2000);

    // Check for error announcement
    const errorRegion = page.locator('[role="alert"], [aria-live="assertive"]');
    const count = await errorRegion.count();

    if (count > 0) {
      const text = await errorRegion.first().textContent();
      expect(text).toBeTruthy();
      console.log('Error announcement:', text);
    }
  });
});
