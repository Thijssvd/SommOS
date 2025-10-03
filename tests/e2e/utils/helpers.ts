import { Page, expect } from '@playwright/test';

/**
 * Wait for a toast notification to appear
 */
export async function waitForToast(
  page: Page,
  expectedMessage?: string,
  expectedType?: 'success' | 'error' | 'warning' | 'info'
): Promise<void> {
  const toast = page.locator('.toast').last();
  await expect(toast).toBeVisible({ timeout: 5000 });
  
  if (expectedMessage) {
    await expect(toast).toContainText(expectedMessage);
  }
  
  if (expectedType) {
    await expect(toast).toHaveClass(new RegExp(expectedType));
  }
}

/**
 * Wait for API response and return the data
 */
export async function waitForAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: { status?: number; timeout?: number }
): Promise<any> {
  const response = await page.waitForResponse(
    (res) => {
      const matches = typeof urlPattern === 'string' 
        ? res.url().includes(urlPattern)
        : urlPattern.test(res.url());
      const statusMatches = options?.status ? res.status() === options.status : true;
      return matches && statusMatches;
    },
    { timeout: options?.timeout || 10000 }
  );
  
  return response.json();
}

/**
 * Check if element is hidden by role-based visibility
 */
export async function isHiddenByRole(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector);
  const count = await element.count();
  
  if (count === 0) {
    return true; // Element not in DOM at all
  }
  
  // Check if it has hidden-by-role class or aria-hidden
  const hasHiddenClass = await element.evaluate((el) => el.classList.contains('hidden-by-role'));
  const isAriaHidden = await element.getAttribute('aria-hidden') === 'true';
  const isDisabled = await element.isDisabled().catch(() => false);
  
  return hasHiddenClass || isAriaHidden || isDisabled;
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Collect console messages during an action
 */
export async function collectConsoleMessages(
  page: Page,
  action: () => Promise<void>
): Promise<{ type: string; text: string }[]> {
  const messages: { type: string; text: string }[] = [];
  
  const handler = (msg: any) => {
    messages.push({
      type: msg.type(),
      text: msg.text(),
    });
  };
  
  page.on('console', handler);
  await action();
  page.off('console', handler);
  
  return messages;
}

/**
 * Check for console errors
 */
export function filterConsoleErrors(messages: { type: string; text: string }[]): string[] {
  return messages
    .filter((msg) => msg.type === 'error')
    .map((msg) => msg.text);
}

/**
 * Navigate to a view by clicking nav button
 */
export async function navigateToView(page: Page, viewName: string): Promise<void> {
  await page.click(`[data-view="${viewName}"]`);
  await expect(page.locator(`#${viewName}-view.active`)).toBeVisible({ timeout: 5000 });
}

/**
 * Fill form field with validation check
 */
export async function fillField(
  page: Page,
  selector: string,
  value: string,
  shouldValidate = false
): Promise<void> {
  const field = page.locator(selector);
  await field.fill(value);
  
  if (shouldValidate) {
    // Trigger blur to activate validation
    await field.blur();
    
    // Wait a bit for validation to run
    await page.waitForTimeout(300);
  }
}

/**
 * Wait for modal to open
 */
export async function waitForModal(page: Page, timeout = 5000): Promise<void> {
  await page.waitForSelector('.modal:not(.hidden)', { timeout });
  await page.waitForSelector('.modal-overlay', { state: 'visible', timeout });
}

/**
 * Close modal
 */
export async function closeModal(page: Page): Promise<void> {
  await page.click('.modal-close');
  await page.waitForSelector('.modal', { state: 'hidden', timeout: 5000 });
}

/**
 * Get table row count
 */
export async function getTableRowCount(page: Page, tableSelector: string): Promise<number> {
  const rows = page.locator(`${tableSelector} tbody tr`);
  return rows.count();
}

/**
 * Check if service worker is registered
 */
export async function isServiceWorkerRegistered(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return navigator.serviceWorker.getRegistrations().then((registrations) => {
      return registrations.length > 0;
    });
  });
}

/**
 * Simulate offline mode
 */
export async function goOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);
}

/**
 * Simulate coming back online
 */
export async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
}

/**
 * Wait for element to have specific text
 */
export async function waitForText(
  page: Page,
  selector: string,
  text: string,
  timeout = 5000
): Promise<void> {
  await expect(page.locator(selector)).toHaveText(text, { timeout });
}

/**
 * Get localStorage value
 */
export async function getLocalStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

/**
 * Set localStorage value
 */
export async function setLocalStorage(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: key, v: value }
  );
}

/**
 * Wait for animation to complete
 */
export async function waitForAnimation(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate((el) => {
    return Promise.all(el.getAnimations().map((animation) => animation.finished));
  });
}
