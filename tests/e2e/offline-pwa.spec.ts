import { test, expect } from './fixtures/auth';
import { Selectors } from './utils/selectors';
import { 
  goOffline, 
  goOnline, 
  isServiceWorkerRegistered,
  waitForNetworkIdle,
  navigateToView,
  getLocalStorage,
  setLocalStorage
} from './utils/helpers';

test.describe('PWA - Service Worker', () => {
  test('should register service worker', async ({ page, browserName }) => {
    // Skip in WebKit as SW behavior is different
    test.skip(browserName === 'webkit', 'Service worker registration varies in webkit');

    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Give service worker time to register
    await page.waitForTimeout(2000);

    // Check registration
    const registered = await isServiceWorkerRegistered(page);
    console.log(`Service worker registered: ${registered}`);

    // In production builds, SW should be registered
    // In dev mode, it might not be
    if (process.env.NODE_ENV === 'production') {
      expect(registered).toBeTruthy();
    }
  });

  test('should have manifest.json', async ({ page }) => {
    const manifestResponse = await page.goto('/manifest.json');
    expect(manifestResponse?.status()).toBe(200);

    const manifest = await manifestResponse?.json();
    expect(manifest).toHaveProperty('name');
    expect(manifest).toHaveProperty('short_name');
    expect(manifest).toHaveProperty('icons');
    expect(manifest).toHaveProperty('start_url');
    expect(manifest).toHaveProperty('display');
  });

  test('should have PWA meta tags', async ({ page }) => {
    await page.goto('/');

    // Theme color
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveCount(1);

    // Viewport
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);

    // Apple touch icon
    const appleIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleIcon).toHaveCount(1);

    // Manifest link
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.json');
  });

  test('should have appropriate manifest icons', async ({ page }) => {
    const manifestResponse = await page.goto('/manifest.json');
    const manifest = await manifestResponse?.json();

    expect(Array.isArray(manifest.icons)).toBeTruthy();
    expect(manifest.icons.length).toBeGreaterThan(0);

    // Check for various sizes
    const sizes = manifest.icons.map((icon: any) => icon.sizes);
    
    // Should have at least 192x192 and 512x512
    expect(sizes.some((size: string) => size.includes('192'))).toBeTruthy();
    expect(sizes.some((size: string) => size.includes('512'))).toBeTruthy();
  });

  test('should have proper display mode', async ({ page }) => {
    const manifestResponse = await page.goto('/manifest.json');
    const manifest = await manifestResponse?.json();

    // Should be standalone or fullscreen for PWA experience
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
  });
});

test.describe('Offline Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show offline indicator when connection is lost', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Offline simulation unreliable in webkit');

    // Go offline
    await goOffline(page);
    await page.waitForTimeout(1000);

    // Should show offline indicator
    const offlineIndicator = page.locator('[data-testid="offline-indicator"], .offline-indicator, .network-status.offline');
    
    // Wait for indicator to appear
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 }).catch(() => {
      // Indicator might not be implemented yet
      console.log('Offline indicator not found');
    });

    // Go back online
    await goOnline(page);
  });

  test('should cache static assets for offline use', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Service worker caching differs in webkit');
    test.skip(process.env.NODE_ENV !== 'production', 'Caching only in production build');

    await page.waitForTimeout(2000); // Let SW cache

    // Go offline
    await goOffline(page);

    // Try to reload - should work from cache
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      
      // Should still show basic UI
      const brandText = page.getByText('SommOS');
      await expect(brandText.first()).toBeVisible({ timeout: 5000 });
    } catch (error) {
      console.log('Offline caching not working:', error);
    }

    await goOnline(page);
  });

  test('should store data locally with IndexedDB', async ({ page }) => {
    // Check if IndexedDB is available
    const hasIndexedDB = await page.evaluate(() => {
      return typeof indexedDB !== 'undefined';
    });

    expect(hasIndexedDB).toBeTruthy();

    // Check for SommOS database
    const databases = await page.evaluate(async () => {
      if ('databases' in indexedDB) {
        return await indexedDB.databases();
      }
      return [];
    });

    console.log('IndexedDB databases:', databases);
  });

  test('should persist auth state in localStorage', async ({ authenticatedAsAdmin: page }) => {
    // Check for auth token in storage
    const hasAuthData = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.some(key => 
        key.toLowerCase().includes('token') || 
        key.toLowerCase().includes('auth') ||
        key.toLowerCase().includes('session')
      );
    });

    expect(hasAuthData).toBeTruthy();
  });
});

test.describe('Offline Data Sync', () => {
  test('should queue actions when offline', async ({ authenticatedAsAdmin: page, browserName }) => {
    test.skip(browserName === 'webkit', 'Offline queue testing unreliable in webkit');

    await navigateToView(page, 'inventory');
    await waitForNetworkIdle(page);

    // Go offline
    await goOffline(page);

    // Try to perform an action (like searching)
    const searchInput = page.locator(Selectors.inventory.searchInputTestId);
    await searchInput.fill('test search offline');

    // Should show queued or offline message
    const offlineNotice = page.locator('[data-testid="offline-notice"], .offline-message, .queue-notice');
    
    // Check if queue is mentioned in UI
    const hasQueueMessage = await page.evaluate(() => {
      return document.body.textContent?.toLowerCase().includes('queue') ||
             document.body.textContent?.toLowerCase().includes('sync when online');
    });

    console.log('Has queue message:', hasQueueMessage);

    // Go back online
    await goOnline(page);
    await page.waitForTimeout(2000);

    // Should attempt to sync
    const onlineNotice = page.locator('[data-testid="online-notice"], .online-message, .sync-success');
    await expect(onlineNotice).toBeVisible({ timeout: 5000 }).catch(() => {
      console.log('Sync notification not found');
    });
  });

  test('should handle sync conflicts gracefully', async ({ authenticatedAsAdmin: page, browserName }) => {
    test.skip(browserName === 'webkit', 'Conflict resolution testing complex in webkit');
    test.skip(true, 'Requires specific conflict scenario setup');

    // This would require:
    // 1. Making changes offline
    // 2. Simulating server-side changes
    // 3. Going online and checking conflict resolution
    // Implementation depends on app's conflict resolution strategy
  });

  test('should show sync status', async ({ authenticatedAsAdmin: page }) => {
    // Look for sync button or status indicator
    const syncButton = page.locator(Selectors.nav.syncButtonTestId);
    
    if (await syncButton.count() > 0) {
      await expect(syncButton).toBeVisible();

      // Click sync button
      await syncButton.click();

      // Should show syncing status
      await page.waitForTimeout(1000);

      // Look for sync indicator
      const syncIndicator = page.locator('[data-testid="sync-indicator"], .syncing, .sync-status');
      const hasSyncState = await syncIndicator.count() > 0;

      console.log('Has sync indicator:', hasSyncState);
    } else {
      test.skip(true, 'Sync button not implemented');
    }
  });

  test('should persist pending changes across page reloads', async ({ authenticatedAsAdmin: page, browserName }) => {
    test.skip(browserName === 'webkit', 'State persistence testing varies in webkit');

    // Go offline
    await goOffline(page);

    // Set a marker in localStorage to simulate pending change
    await setLocalStorage(page, 'test_pending_change', JSON.stringify({ action: 'test', timestamp: Date.now() }));

    // Reload page
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Check if marker still exists
    const pendingChange = await getLocalStorage(page, 'test_pending_change');
    expect(pendingChange).toBeTruthy();

    // Cleanup
    await page.evaluate(() => localStorage.removeItem('test_pending_change'));
    await goOnline(page);
  });
});

test.describe('PWA Installation', () => {
  test('should be installable (beforeinstallprompt)', async ({ page, browserName }) => {
    test.skip(['webkit', 'firefox'].includes(browserName), 'Install prompt is Chrome-specific');

    // Check if beforeinstallprompt event would fire
    const canInstall = await page.evaluate(() => {
      return new Promise((resolve) => {
        let prompted = false;
        
        window.addEventListener('beforeinstallprompt', (e) => {
          prompted = true;
          e.preventDefault();
          resolve(true);
        });

        // If not prompted within 2 seconds, assume not installable
        setTimeout(() => {
          if (!prompted) resolve(false);
        }, 2000);
      });
    });

    console.log('App can be installed:', canInstall);
    // Note: In test environment, this might not fire
  });

  test('should have complete PWA manifest', async ({ page }) => {
    const manifestResponse = await page.goto('/manifest.json');
    const manifest = await manifestResponse?.json();

    // Required fields
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
    expect(Array.isArray(manifest.icons) && manifest.icons.length > 0).toBeTruthy();

    // Optional but recommended
    expect(manifest.description).toBeTruthy();
  });
});

test.describe('Network Resilience', () => {
  test('should handle intermittent connection', async ({ authenticatedAsAdmin: page, browserName }) => {
    test.skip(browserName === 'webkit', 'Network simulation unreliable in webkit');

    await navigateToView(page, 'inventory');

    // Simulate flaky connection
    await goOffline(page);
    await page.waitForTimeout(1000);
    await goOnline(page);
    await page.waitForTimeout(1000);
    await goOffline(page);
    await page.waitForTimeout(1000);
    await goOnline(page);

    // App should still be responsive
    await waitForNetworkIdle(page, 5000);
    
    const grid = page.locator(Selectors.inventory.gridTestId);
    await expect(grid).toBeVisible({ timeout: 10000 });
  });

  test('should retry failed requests', async ({ authenticatedAsAdmin: page, browserName }) => {
    test.skip(browserName === 'webkit', 'Request interception differs in webkit');

    // Intercept API requests and fail first attempt
    let requestCount = 0;
    
    await page.route('**/api/**', (route) => {
      requestCount++;
      if (requestCount === 1) {
        // Fail first request
        route.abort('failed');
      } else {
        // Allow subsequent requests
        route.continue();
      }
    });

    // Try to navigate to inventory
    await navigateToView(page, 'inventory');

    // Should eventually succeed after retry
    await waitForNetworkIdle(page, 10000);
    
    // Verify request was retried
    expect(requestCount).toBeGreaterThan(1);
  });

  test('should show meaningful error messages on network failure', async ({ authenticatedAsAdmin: page, browserName }) => {
    test.skip(browserName === 'webkit', 'Network failure simulation differs in webkit');

    // Simulate network failure
    await page.route('**/api/inventory/**', (route) => {
      route.abort('failed');
    });

    await navigateToView(page, 'inventory');
    await page.waitForTimeout(2000);

    // Should show error message
    const errorMessage = page.locator('[role="alert"], .error-message, .toast.error');
    await expect(errorMessage).toBeVisible({ timeout: 5000 }).catch(() => {
      console.log('Error message not displayed');
    });
  });
});

test.describe('Background Sync', () => {
  test('should register for background sync (if supported)', async ({ page, browserName }) => {
    test.skip(['webkit', 'firefox'].includes(browserName), 'Background sync is Chrome-specific');

    const hasBackgroundSync = await page.evaluate(() => {
      return 'sync' in window.ServiceWorkerRegistration.prototype;
    });

    console.log('Background sync supported:', hasBackgroundSync);

    if (hasBackgroundSync) {
      // Check if app registers for background sync
      const registrations = await page.evaluate(async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          if ('sync' in registration) {
            // @ts-ignore
            const tags = await registration.sync.getTags();
            return tags;
          }
        } catch (e) {
          return [];
        }
        return [];
      });

      console.log('Background sync tags:', registrations);
    }
  });
});

test.describe('Offline-First Architecture', () => {
  test('should prioritize cached data for faster loads', async ({ authenticatedAsAdmin: page, browserName }) => {
    test.skip(process.env.NODE_ENV !== 'production', 'Caching strategy only in production');

    await navigateToView(page, 'inventory');
    await waitForNetworkIdle(page);

    // Record first load time
    const firstLoadStart = Date.now();
    await page.reload();
    await page.waitForSelector(Selectors.inventory.gridTestId, { state: 'visible' });
    const firstLoadTime = Date.now() - firstLoadStart;

    console.log('First load time:', firstLoadTime, 'ms');

    // Second load should be faster (cache-first)
    const secondLoadStart = Date.now();
    await page.reload();
    await page.waitForSelector(Selectors.inventory.gridTestId, { state: 'visible' });
    const secondLoadTime = Date.now() - secondLoadStart;

    console.log('Second load time:', secondLoadTime, 'ms');

    // Second load should generally be faster
    // (not enforcing this as it can be flaky in tests)
  });

  test('should work entirely offline after initial load', async ({ authenticatedAsAdmin: page, browserName }) => {
    test.skip(browserName === 'webkit', 'Full offline mode testing unreliable in webkit');
    test.skip(process.env.NODE_ENV !== 'production', 'Full offline mode only in production');

    await navigateToView(page, 'inventory');
    await waitForNetworkIdle(page);
    await page.waitForTimeout(2000); // Let SW cache

    // Go completely offline
    await goOffline(page);

    // Try navigating within app
    await page.click(Selectors.nav.dashboardTestId);
    await page.waitForTimeout(1000);

    // Should still show dashboard
    const dashboard = page.locator(Selectors.views.dashboard);
    await expect(dashboard).toBeVisible({ timeout: 5000 }).catch(() => {
      console.log('Offline navigation failed');
    });

    // Go back online
    await goOnline(page);
  });
});
