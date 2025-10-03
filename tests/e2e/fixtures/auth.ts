import { test as base, expect, Page } from '@playwright/test';

export interface TestCredentials {
  email?: string;
  password?: string;
  eventCode?: string;
  pin?: string;
  role?: 'admin' | 'crew' | 'guest';
}

export const TEST_USERS = {
  admin: {
    email: 'admin@sommos.local',
    password: 'admin123',
    role: 'admin' as const,
  },
  crew: {
    email: 'crew@sommos.local',
    password: 'crew123',
    role: 'crew' as const,
  },
  guest: {
    email: 'guest@sommos.local',
    password: 'guest123',
    role: 'guest' as const,
  },
};

export const GUEST_EVENT_CODES = {
  basic: {
    eventCode: 'YACHT2024',
    pin: null,
  },
  withPin: {
    eventCode: 'GUEST2024',
    pin: '123456',
  },
};

/**
 * Wait for the loading screen to disappear
 */
export async function waitForLoadingScreen(page: Page): Promise<void> {
  try {
    await page.waitForSelector('#loading-screen', { state: 'visible', timeout: 5000 });
  } catch {
    // Loading screen might already be gone
  }
  await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 30000 });
}

/**
 * Login as a member (admin/crew)
 */
export async function loginAsMember(page: Page, credentials: TestCredentials): Promise<void> {
  await page.goto('/');
  
  // Wait for auth screen
  await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 10000 });
  
  // Ensure member login tab is active
  const memberTab = page.locator('#member-login-tab');
  await memberTab.click();
  await page.waitForSelector('#member-login-panel.active', { timeout: 5000 });
  
  // Fill in credentials
  await page.fill('#login-email', credentials.email!);
  await page.fill('#login-password', credentials.password!);
  
  // Submit login
  await page.click('#login-submit');
  
  // Wait for loading and app to appear
  await waitForLoadingScreen(page);
  await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
  
  // Verify we're on dashboard
  await expect(page.locator('#dashboard-view.active')).toBeVisible({ timeout: 5000 });
}

/**
 * Login as a guest using event code
 */
export async function loginAsGuest(page: Page, guestCreds: { eventCode: string; pin?: string | null }): Promise<void> {
  await page.goto('/');
  
  // Wait for auth screen
  await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 10000 });
  
  // Click on guest login tab
  const guestTab = page.locator('#guest-login-tab');
  await guestTab.click();
  await page.waitForSelector('#guest-login-panel.active', { timeout: 5000 });
  
  // Fill in event code
  await page.fill('#guest-event-code', guestCreds.eventCode);
  
  // If PIN is required
  if (guestCreds.pin) {
    await page.check('#guest-pin-toggle');
    await page.waitForSelector('#guest-pin-group', { state: 'visible' });
    await page.fill('#guest-pin', guestCreds.pin);
  }
  
  // Click login button
  await page.click('#guest-login-btn');
  
  // Wait for loading and app to appear
  await waitForLoadingScreen(page);
  await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
  
  // Verify we're on dashboard
  await expect(page.locator('#dashboard-view.active')).toBeVisible({ timeout: 5000 });
}

/**
 * Clear session and logout
 */
export async function clearSession(page: Page): Promise<void> {
  // Check if we're already on auth screen
  const authScreen = page.locator('#auth-screen');
  const isAuthScreenVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden'));
  
  if (!isAuthScreenVisible) {
    // We're logged in, so logout
    try {
      await page.click('#logout-btn', { timeout: 3000 });
      await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 5000 });
    } catch {
      // Logout button might not be visible or doesn't exist
    }
  }
  
  // Clear storage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Clear cookies
  await page.context().clearCookies();
}

/**
 * Verify user role badge
 */
export async function verifyUserRole(page: Page, expectedRole: string): Promise<void> {
  const roleBadge = page.locator('#user-role-badge');
  await expect(roleBadge).toHaveText(expectedRole.toUpperCase(), { timeout: 5000 });
}

/**
 * Extended test fixtures with pre-configured authentication states
 */
type AuthFixtures = {
  authenticatedAsAdmin: Page;
  authenticatedAsCrew: Page;
  authenticatedAsGuest: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedAsAdmin: async ({ page }, use) => {
    await loginAsMember(page, TEST_USERS.admin);
    await verifyUserRole(page, 'ADMIN');
    await use(page);
  },
  
  authenticatedAsCrew: async ({ page }, use) => {
    await loginAsMember(page, TEST_USERS.crew);
    await verifyUserRole(page, 'CREW');
    await use(page);
  },
  
  authenticatedAsGuest: async ({ page }, use) => {
    await loginAsGuest(page, GUEST_EVENT_CODES.basic);
    await verifyUserRole(page, 'GUEST');
    await use(page);
  },
});

export { expect };
