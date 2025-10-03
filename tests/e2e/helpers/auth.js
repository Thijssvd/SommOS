// Authentication Helper Functions for SommOS E2E Tests
const { expect } = require('@playwright/test');
const testCredentials = require('../fixtures/test-credentials.json');

/**
 * Get test credentials from fixtures
 * @param {string} accountType - Type of account ('guest', 'guestWithPin', 'admin', 'crew')
 * @returns {Object} Account credentials
 */
function getTestCredentials(accountType = 'guest') {
  const credentials = testCredentials[accountType];
  if (!credentials) {
    throw new Error(`Unknown account type: ${accountType}`);
  }
  return credentials;
}

/**
 * Wait for loading screen to disappear
 * @param {import('@playwright/test').Page} page
 */
async function waitForLoadingScreen(page) {
  // Wait for loading screen to appear and then disappear
  await page.waitForSelector('#loading-screen', { state: 'visible', timeout: 5000 }).catch(() => {
    // Loading screen might already be gone
  });
  await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 30000 });
}

/**
 * Login as a guest user using event code
 * @param {import('@playwright/test').Page} page
 * @param {string} eventCode - Guest event code
 * @param {string|null} pin - Optional PIN for event code
 * @returns {Promise<void>}
 */
async function loginAsGuest(page, eventCode = null, pin = null) {
  // Use default test credentials if not provided
  const credentials = eventCode 
    ? { eventCode, pin } 
    : getTestCredentials(pin ? 'guestWithPin' : 'guest');

  // Set up console listener to capture errors
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[Browser ${type}]:`, msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('[Browser JavaScript Error]:', error.message);
  });

  // Navigate to the application
  await page.goto('/');
  
  //Wait longer for the page to fully load
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    console.log('Network did not become idle within timeout');
  });
  
  // Wait for auth screen to be visible
  await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 10000 });
  
  // Click on guest login tab if not already active
  const guestTab = page.locator('#guest-login-tab');
  await guestTab.click();
  
  // Wait for guest panel to be visible
  await page.waitForSelector('#guest-login-panel.active', { timeout: 5000 });
  
  // Fill in event code
  await page.fill('#guest-event-code', credentials.eventCode);
  
  // If PIN is required, check the PIN toggle and enter PIN
  if (credentials.pin) {
    await page.check('#guest-pin-toggle');
    await page.waitForSelector('#guest-pin-group', { state: 'visible' });
    await page.fill('#guest-pin', credentials.pin);
  }
  
  // Click login button
  await page.click('#guest-login-btn');
  
  // Wait for loading screen and then for it to disappear
  await waitForLoadingScreen(page);
  
  // Wait for the app container to become visible
  await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
  
  // Verify we're on the dashboard
  await expect(page.locator('#dashboard-view.active')).toBeVisible({ timeout: 5000 });
}

/**
 * Login as a crew or admin user
 * @param {import('@playwright/test').Page} page
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<void>}
 */
async function loginAsCrew(page, email = null, password = null) {
  // Use default crew credentials if not provided
  const credentials = email && password 
    ? { email, password } 
    : getTestCredentials('crew');

  // Navigate to the application
  await page.goto('/');
  
  // Wait for auth screen to be visible
  await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 10000 });
  
  // Make sure we're on member login tab
  const memberTab = page.locator('#member-login-tab');
  await memberTab.click();
  
  // Wait for member panel to be visible
  await page.waitForSelector('#member-login-panel.active', { timeout: 5000 });
  
  // Fill in credentials
  await page.fill('#login-email', credentials.email);
  await page.fill('#login-password', credentials.password);
  
  // Click login button
  await page.click('#login-submit');
  
  // Wait for loading screen and then for it to disappear
  await waitForLoadingScreen(page);
  
  // Wait for the app container to become visible
  await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
  
  // Verify we're on the dashboard
  await expect(page.locator('#dashboard-view.active')).toBeVisible({ timeout: 5000 });
}

/**
 * Verify that guest session is active
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function verifyGuestSession(page) {
  // Check that user role badge shows "GUEST"
  const roleBadge = page.locator('#user-role-badge');
  await expect(roleBadge).toHaveText('GUEST');
  
  // Verify guest notice is visible (not hidden by role)
  const guestNotice = page.locator('#guest-notice');
  await expect(guestNotice).not.toHaveClass(/hidden-by-role/);
  
  // Check that guest banner can be shown (even if user dismissed it)
  // We won't force it to be visible, but we can check it exists
  await expect(page.locator('#guest-session-banner')).toBeAttached();
}

/**
 * Verify that crew/admin session is active
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedRole - Expected role ('CREW' or 'ADMIN')
 * @returns {Promise<void>}
 */
async function verifyCrewSession(page, expectedRole = 'CREW') {
  // Check that user role badge shows expected role
  const roleBadge = page.locator('#user-role-badge');
  await expect(roleBadge).toHaveText(expectedRole);
  
  // Verify guest notice is hidden
  const guestNotice = page.locator('#guest-notice');
  await expect(guestNotice).toHaveClass(/hidden-by-role/);
  
  // Verify guest banner is not visible
  const guestBanner = page.locator('#guest-session-banner');
  await expect(guestBanner).toHaveClass(/hidden/);
}

/**
 * Clear session and logout
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function clearSession(page) {
  // Clear any stored session data
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  }).catch(() => {
    // Page might not be loaded yet, that's ok
  });
  
  // Clear cookies
  await page.context().clearCookies();
}

/**
 * Wait for toast message to appear and optionally check its content
 * @param {import('@playwright/test').Page} page
 * @param {string|null} expectedMessage - Expected toast message content (optional)
 * @param {string|null} expectedType - Expected toast type: 'success', 'error', 'warning', 'info' (optional)
 * @returns {Promise<void>}
 */
async function waitForToast(page, expectedMessage = null, expectedType = null) {
  // Wait for toast to appear
  const toast = page.locator('.toast').last();
  await expect(toast).toBeVisible({ timeout: 5000 });
  
  if (expectedMessage) {
    await expect(toast).toContainText(expectedMessage);
  }
  
  if (expectedType) {
    await expect(toast).toHaveClass(new RegExp(expectedType));
  }
  
  return toast;
}

/**
 * Check if an element is hidden by role-based visibility
 * @param {import('@playwright/test').Page} page
 * @param {string} selector - CSS selector for the element
 * @returns {Promise<boolean>}
 */
async function isHiddenByRole(page, selector) {
  const element = page.locator(selector);
  const count = await element.count();
  
  if (count === 0) {
    return true; // Element not in DOM at all
  }
  
  // Check if it has hidden-by-role class or aria-hidden
  const hasHiddenClass = await element.evaluate(el => el.classList.contains('hidden-by-role'));
  const isAriaHidden = await element.evaluate(el => el.getAttribute('aria-hidden') === 'true');
  const isDisabled = await element.evaluate(el => el.disabled === true);
  
  return hasHiddenClass || isAriaHidden || isDisabled;
}

module.exports = {
  getTestCredentials,
  loginAsGuest,
  loginAsCrew,
  verifyGuestSession,
  verifyCrewSession,
  clearSession,
  waitForToast,
  isHiddenByRole,
  waitForLoadingScreen,
};
