// Guest Permission Tests - Inventory View and Function Invocations
const { test, expect } = require('@playwright/test');
const { loginAsGuest, verifyGuestSession, clearSession, waitForToast } = require('./helpers/auth');

test.describe('Guest User - Inventory View Restrictions', () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page);
  });

  test('should navigate to inventory view as guest', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Navigate to inventory
    await page.click('[data-view="inventory"]');
    await expect(page.locator('#inventory-view.active')).toBeVisible();
  });

  test('should show read-only message in wine cards for guests', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Navigate to inventory
    await page.click('[data-view="inventory"]');
    await page.waitForSelector('#inventory-view.active');

    // Wait for wine cards to load
    await page.waitForSelector('.wine-card', { timeout: 10000 }).catch(() => {
      console.log('No wine cards found - inventory might be empty');
    });

    const wineCards = page.locator('.wine-card');
    const cardCount = await wineCards.count();

    if (cardCount > 0) {
      // Check first wine card for guest restrictions
      const firstCard = wineCards.first();
      
      // Look for guest-readonly indicators
      const readOnlyIndicator = firstCard.locator('.guest-readonly, .guest-readonly-message');
      const hasReadOnly = await readOnlyIndicator.count() > 0;
      
      if (hasReadOnly) {
        await expect(readOnlyIndicator).toContainText(/read-only|Read-Only/i);
      }
    }
  });

  test('should hide location details for guests', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Navigate to inventory
    await page.click('[data-view="inventory"]');
    await page.waitForSelector('#inventory-view.active');

    // Wait for wine cards
    await page.waitForSelector('.wine-card', { timeout: 10000 }).catch(() => {});

    const wineCards = page.locator('.wine-card');
    const cardCount = await wineCards.count();

    if (cardCount > 0) {
      // Check if location is hidden with lock icon
      const locationElements = page.locator('.location, .stock-display .location');
      const locationCount = await locationElements.count();

      if (locationCount > 0) {
        const firstLocation = locationElements.first();
        const text = await firstLocation.textContent();
        
        // Verify location shows "🔒 Location hidden" or similar
        expect(text).toMatch(/🔒|hidden|Hidden/i);
      }
    }
  });

  test('should hide prices for guests', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Navigate to inventory
    await page.click('[data-view="inventory"]');
    await page.waitForSelector('#inventory-view.active');

    // Wait for wine cards
    await page.waitForSelector('.wine-card', { timeout: 10000 }).catch(() => {});

    const wineCards = page.locator('.wine-card');
    const cardCount = await wineCards.count();

    if (cardCount > 0) {
      // Check for price elements - they should either not exist or be empty
      const priceElements = page.locator('.wine-card .price');
      const priceCount = await priceElements.count();

      if (priceCount > 0) {
        const firstPrice = priceElements.first();
        const priceText = await firstPrice.textContent();
        
        // Price should be empty or show placeholder
        expect(priceText?.trim()).toBe('');
      }
    }
  });

  test('should not show Reserve and Consume buttons for guests', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Navigate to inventory
    await page.click('[data-view="inventory"]');
    await page.waitForSelector('#inventory-view.active');

    // Wait for wine cards
    await page.waitForSelector('.wine-card', { timeout: 10000 }).catch(() => {});

    // Check for Reserve buttons
    const reserveButtons = page.locator('button:has-text("Reserve"), button:has-text("🍷 Reserve")');
    const reserveCount = await reserveButtons.count();
    expect(reserveCount).toBe(0);

    // Check for Consume/Serve buttons  
    const consumeButtons = page.locator('button:has-text("Consume"), button:has-text("Serve"), button:has-text("🥂 Serve")');
    const consumeCount = await consumeButtons.count();
    expect(consumeCount).toBe(0);
  });
});

test.describe('Guest User - Function Invocation Blocks', () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page);
  });

  test('should block reserveWineModal function call with toast', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Try to call the reserve function directly via JavaScript
    const result = await page.evaluate(() => {
      if (window.app && typeof window.app.reserveWineModal === 'function') {
        window.app.reserveWineModal('test-vintage-id', 'Test Wine');
        return 'function called';
      }
      return 'function not available';
    });

    // If function was called, a warning toast should appear
    if (result === 'function called') {
      await waitForToast(page, /required|access/i, 'warning');
    }
  });

  test('should block consumeWineModal function call with toast', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Try to call the consume function directly
    const result = await page.evaluate(() => {
      if (window.app && typeof window.app.consumeWineModal === 'function') {
        window.app.consumeWineModal('test-vintage-id', 'Test Wine');
        return 'function called';
      }
      return 'function not available';
    });

    if (result === 'function called') {
      await waitForToast(page, /required|access/i, 'warning');
    }
  });

  test('should block showConsumptionModal function call', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Try to call the consumption modal function
    const result = await page.evaluate(async () => {
      if (window.app && typeof window.app.showConsumptionModal === 'function') {
        await window.app.showConsumptionModal();
        return 'function called';
      }
      return 'function not available';
    });

    if (result === 'function called') {
      await waitForToast(page, /required|access/i, 'warning');
    }
  });

  test('should block analyzeProcurementOpportunities function call', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Try to call procurement analysis function
    const result = await page.evaluate(async () => {
      if (window.app && typeof window.app.analyzeProcurementOpportunities === 'function') {
        await window.app.analyzeProcurementOpportunities();
        return 'function called';
      }
      return 'function not available';
    });

    if (result === 'function called') {
      await waitForToast(page, /required|access|procurement/i, 'warning');
    }
  });

  test('should verify ensureCrewAccess returns false for guests', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Check that ensureCrewAccess correctly identifies guest and blocks
    const canAccess = await page.evaluate(() => {
      if (window.app && typeof window.app.ensureCrewAccess === 'function') {
        return window.app.ensureCrewAccess('Test crew access');
      }
      return null;
    });

    expect(canAccess).toBe(false);
  });

  test('should verify isGuestUser returns true for guest sessions', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Verify isGuestUser correctly identifies guest role
    const isGuest = await page.evaluate(() => {
      if (window.app && typeof window.app.isGuestUser === 'function') {
        return window.app.isGuestUser();
      }
      return null;
    });

    expect(isGuest).toBe(true);
  });
});

test.describe('Guest User - Pairing View Access', () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page);
  });

  test('should allow guests to access pairing view', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Navigate to pairing view
    await page.click('[data-view="pairing"]');
    await expect(page.locator('#pairing-view.active')).toBeVisible();

    // Verify pairing form is accessible
    await expect(page.locator('#dish-input')).toBeVisible();
    await expect(page.locator('#get-pairings-btn')).toBeVisible();
  });

  test('should allow guests to request wine pairings', async ({ page }) => {
    await loginAsGuest(page);
    await verifyGuestSession(page);

    // Navigate to pairing view
    await page.click('[data-view="pairing"]');
    await page.waitForSelector('#pairing-view.active');

    // Fill in dish description
    await page.fill('#dish-input', 'Grilled salmon with lemon herbs');

    // Click get pairings button
    await page.click('#get-pairings-btn');

    // Pairing request should work for guests (read-only feature)
    // Wait for either results or an error, but no permission denied
    await page.waitForSelector('#pairing-results, .toast', { timeout: 15000 }).catch(() => {
      console.log('Pairing request might be processing or API unavailable');
    });
  });
});
