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
 * Fill login form inputs using JavaScript (workaround for hidden inputs)
 */
export async function fillLoginForm(page: Page, email: string, password: string): Promise<void> {
  await page.evaluate(({ email, password }) => {
    const emailInput = document.getElementById('login-email') as HTMLInputElement;
    const passwordInput = document.getElementById('login-password') as HTMLInputElement;
    if (emailInput) {
      emailInput.value = email;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (passwordInput) {
      passwordInput.value = password;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { email, password });
}

/**
 * Submit login form using JavaScript (workaround for hidden button)
 */
export async function submitLoginForm(page: Page): Promise<void> {
  await page.evaluate(() => {
    const form = document.getElementById('login-form') as HTMLFormElement;
    if (form) {
      form.requestSubmit();
    }
  });
}

/**
 * Login as a member (admin/crew)
 */
export async function loginAsMember(page: Page, credentials: TestCredentials): Promise<void> {
  await page.goto('/');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  
  // Check if already logged in (dev mode bypass)
  const appVisible = await page.locator('#app').evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
  
  if (appVisible) {
    // Already logged in via dev mode bypass
    console.log('Already logged in (dev mode bypass)');
    return;
  }
  
  // Wait for auth screen
  await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 10000 });
  
  // Ensure member login tab is active
  const memberTab = page.locator('#member-login-tab');
  await memberTab.click();
  await page.waitForSelector('#member-login-panel.active', { timeout: 5000 });
  
  // Use JavaScript to fill form (workaround for CSS visibility issue)
  // Wait a moment for the tab transition to complete
  await page.waitForTimeout(500);
  
  await page.evaluate(({ email, password }) => {
    const emailInput = document.getElementById('login-email') as HTMLInputElement;
    const passwordInput = document.getElementById('login-password') as HTMLInputElement;
    if (emailInput) {
      emailInput.value = email;
      // Dispatch input events to trigger any listeners
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (passwordInput) {
      passwordInput.value = password;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { email: credentials.email!, password: credentials.password! });
  
  // Set up a promise to wait for the login API call
  const loginResponsePromise = page.waitForResponse(
    response => {
      const isLoginRequest = response.url().includes('/api/auth/login');
      if (isLoginRequest) {
        console.log(`Login API response: ${response.url()}, status: ${response.status()}`);
      }
      return isLoginRequest && response.status() === 200;
    },
    { timeout: 15000 }
  ).catch((err) => {
    console.error('Login response wait failed:', err.message);
    return null;
  });
  
  // Directly call the app's login handler via the API
  await page.evaluate(({ email, password }) => {
    // Trigger login through the app's global instance
    if (window.app && typeof window.app.api.login === 'function') {
      window.app.api.login(email, password).then((result) => {
        if (result?.success && result.data) {
          window.app.setCurrentUser(result.data);
          window.app.hideAuthScreen();
        }
      });
    }
  }, { email: credentials.email!, password: credentials.password! });
  
  // Wait for the login API response
  const loginResponse = await loginResponsePromise;
  
  if (!loginResponse) {
    console.error('Login API call did not complete or failed');
    // Don't throw error, continue to see if login succeeded anyway
  }
  
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
  try {
    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    
    // Check if we're already on auth screen
    const authScreen = page.locator('#auth-screen');
    const authScreenExists = await authScreen.count().catch(() => 0);
    
    if (authScreenExists > 0) {
      const isAuthScreenVisible = await authScreen.evaluate((el) => !el.classList.contains('hidden')).catch(() => false);
      
      if (!isAuthScreenVisible) {
        // We're logged in, so logout
        try {
          await page.click('#logout-btn', { timeout: 3000 });
          await page.waitForSelector('#auth-screen:not(.hidden)', { timeout: 5000 });
        } catch {
          // Logout button might not be visible or doesn't exist
        }
      }
    }
  } catch (error) {
    console.warn('Error checking auth screen state:', error);
  }
  
  // Clear storage
  try {
    // Check if page is on a valid origin before clearing storage
    const url = page.url();
    if (url && !url.startsWith('about:') && !url.startsWith('data:')) {
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          // Silently fail if storage is not accessible
        }
      });
    }
  } catch (error) {
    console.warn('Error clearing storage:', error);
  }
  
  // Clear cookies
  try {
    await page.context().clearCookies();
  } catch (error) {
    console.warn('Error clearing cookies:', error);
  }
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
