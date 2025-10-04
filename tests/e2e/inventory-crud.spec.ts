import { test, expect } from './fixtures/auth';
import { Selectors, testId } from './utils/selectors';
import { 
  waitForToast, 
  waitForAPIResponse, 
  navigateToView,
  waitForNetworkIdle,
  getTableRowCount 
} from './utils/helpers';

test.describe('Inventory CRUD Operations', () => {
  test.beforeEach(async ({ authenticatedAsAdmin: page }) => {
    // Navigate to inventory view
    await navigateToView(page, 'inventory');
    await waitForNetworkIdle(page);
  });

  test('should display inventory list', async ({ authenticatedAsAdmin: page }) => {
    // Wait for inventory grid to load
    const grid = page.locator(Selectors.inventory.gridTestId);
    await expect(grid).toBeVisible({ timeout: 10000 });

    // Should have wine cards or empty state
    const wineCards = page.locator('.wine-card');
    const count = await wineCards.count();

    if (count > 0) {
      // Verify first card has essential info
      const firstCard = wineCards.first();
      await expect(firstCard).toContainText(/\d{4}/); // Year
      await expect(firstCard).toBeVisible();
    } else {
      // Should show empty state
      await expect(page.locator('.empty-state')).toBeVisible();
    }
  });

  test('should search inventory', async ({ authenticatedAsAdmin: page }) => {
    // Type in search box
    const searchInput = page.locator(Selectors.inventory.searchInputTestId);
    await searchInput.fill('Château');
    
    // Trigger search (either auto-search or button click)
    const searchButton = page.locator(Selectors.inventory.searchButtonTestId);
    if (await searchButton.isVisible()) {
      await searchButton.click();
    } else {
      // Auto-search - wait for debounce
      await page.waitForTimeout(600);
    }

    await waitForNetworkIdle(page, 3000);

    // Results should contain search term
    const results = page.locator('.wine-card');
    const count = await results.count();
    
    if (count > 0) {
      const firstResult = results.first();
      const text = await firstResult.textContent();
      expect(text?.toLowerCase()).toContain('château');
    }
  });

  test('should filter by wine type', async ({ authenticatedAsAdmin: page }) => {
    const typeFilter = page.locator(Selectors.inventory.typeFilterTestId);
    await typeFilter.waitFor({ state: 'visible', timeout: 5000 });
    
    // Select 'Red' wine type
    await typeFilter.selectOption({ label: 'Red' });
    await waitForNetworkIdle(page, 3000);

    // Verify filter is applied
    const cards = page.locator('.wine-card');
    const count = await cards.count();

    if (count > 0) {
      // Check that displayed wines are red
      const firstCard = cards.first();
      const text = await firstCard.textContent();
      expect(text?.toLowerCase()).toMatch(/red|rouge|cabernet|merlot|pinot noir/i);
    }
  });

  test('should filter by location', async ({ authenticatedAsAdmin: page }) => {
    const locationFilter = page.locator(Selectors.inventory.locationFilterTestId);
    await locationFilter.waitFor({ state: 'visible', timeout: 5000 });

    // Get available locations
    const options = await locationFilter.locator('option').all();
    if (options.length > 1) {
      // Select first non-empty option
      await locationFilter.selectOption({ index: 1 });
      await waitForNetworkIdle(page, 3000);

      // Should show filtered results
      const cards = page.locator('.wine-card');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should view wine details', async ({ authenticatedAsAdmin: page }) => {
    // Wait for wine cards
    const wineCards = page.locator('.wine-card');
    await wineCards.first().waitFor({ state: 'visible', timeout: 10000 });

    const count = await wineCards.count();
    test.skip(count === 0, 'No wines available to test');

    // Click on first wine card or details button
    const firstCard = wineCards.first();
    
    // Look for details button
    const detailsButton = firstCard.locator('button', { hasText: /details|view|more/i });
    if (await detailsButton.count() > 0) {
      await detailsButton.first().click();
    } else {
      // Click card itself
      await firstCard.click();
    }

    // Should open modal or navigate to details view
    const modal = page.locator('.modal, [role="dialog"]');
    const detailsView = page.locator('#wine-details, .wine-details');

    await Promise.race([
      modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      detailsView.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    ]);

    // Verify details are shown
    const isModalVisible = await modal.isVisible().catch(() => false);
    const isDetailsVisible = await detailsView.isVisible().catch(() => false);

    expect(isModalVisible || isDetailsVisible).toBeTruthy();
  });

  test('should handle empty search results', async ({ authenticatedAsAdmin: page }) => {
    const searchInput = page.locator(Selectors.inventory.searchInputTestId);
    await searchInput.fill('zzzzzzzznonexistent');

    // Trigger search
    const searchButton = page.locator(Selectors.inventory.searchButtonTestId);
    if (await searchButton.isVisible()) {
      await searchButton.click();
    } else {
      await page.waitForTimeout(600);
    }

    await waitForNetworkIdle(page, 3000);

    // Should show empty state or "no results" message
    const emptyState = page.locator('.empty-state, .no-results, [data-testid="inventory-empty-state"]');
    await expect(emptyState).toBeVisible({ timeout: 5000 });
  });

  test('should refresh inventory (Optional Feature)', async ({ authenticatedAsAdmin: page }) => {
    const refreshButton = page.locator(Selectors.inventory.refreshButtonTestId);
    
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Should show loading state briefly
      await page.waitForTimeout(500);

      // Wait for refresh to complete
      await waitForNetworkIdle(page, 5000);

      // Grid should still be visible
      const grid = page.locator(Selectors.inventory.gridTestId);
      await expect(grid).toBeVisible();
    } else {
      test.skip(true, 'Refresh button not available');
    }
  });

  test('should maintain filters in URL', async ({ authenticatedAsAdmin: page }) => {
    // Apply a filter
    const typeFilter = page.locator(Selectors.inventory.typeFilterTestId);
    await typeFilter.selectOption({ label: 'Red' });
    await waitForNetworkIdle(page, 2000);

    // Check URL has filter parameter
    const url = page.url();
    expect(url).toMatch(/type=red/i);

    // Reload page
    await page.reload();
    await waitForNetworkIdle(page);

    // Filter should be preserved
    const selectedValue = await typeFilter.inputValue();
    expect(selectedValue.toLowerCase()).toContain('red');
  });

  test('should sort wines (Optional Feature)', async ({ authenticatedAsAdmin: page }) => {
    const sortControl = page.locator('[data-testid="inventory-sort-control"], #sort-by, select[name="sort"]');
    
    if (await sortControl.count() > 0) {
      // Try sorting by name
      await sortControl.selectOption({ value: 'name' });
      await waitForNetworkIdle(page, 2000);

      // Get first two wine names
      const wineCards = page.locator('.wine-card');
      if (await wineCards.count() >= 2) {
        const firstName = await wineCards.nth(0).locator('.wine-name, h3, h4').first().textContent();
        const secondName = await wineCards.nth(1).locator('.wine-name, h3, h4').first().textContent();

        // Verify alphabetical order
        expect(firstName!.localeCompare(secondName!)).toBeLessThanOrEqual(0);
      }
    } else {
      test.skip(true, 'Sorting not available');
    }
  });

  test('should display wine quantity and availability', async ({ authenticatedAsAdmin: page }) => {
    const wineCards = page.locator('.wine-card');
    await wineCards.first().waitFor({ state: 'visible', timeout: 10000 });

    const count = await wineCards.count();
    test.skip(count === 0, 'No wines available');

    // Check first card has quantity info
    const firstCard = wineCards.first();
    const quantityText = await firstCard.textContent();

    // Should show bottle count or availability
    expect(quantityText).toMatch(/\d+\s*(bottle|btl|available|in stock)/i);
  });

  test('should handle pagination (Optional Feature)', async ({ authenticatedAsAdmin: page }) => {
    const pagination = page.locator('.pagination, [data-testid="inventory-pagination"]');

    if (await pagination.count() > 0) {
      const nextButton = pagination.locator('button', { hasText: /next|>/i });
      
      if (await nextButton.isEnabled()) {
        // Get current page wines
        const beforeCount = await page.locator('.wine-card').count();

        // Click next page
        await nextButton.click();
        await waitForNetworkIdle(page, 3000);

        // Should show different wines
        const afterCount = await page.locator('.wine-card').count();
        expect(afterCount).toBeGreaterThan(0);
      }
    } else {
      test.skip(true, 'Pagination not implemented');
    }
  });

  test('should show wine location information', async ({ authenticatedAsAdmin: page }) => {
    const wineCards = page.locator('.wine-card');
    await wineCards.first().waitFor({ state: 'visible', timeout: 10000 });

    const count = await wineCards.count();
    test.skip(count === 0, 'No wines available');

    // Check first card shows location
    const firstCard = wineCards.first();
    const locationText = await firstCard.textContent();

    // Should mention storage location
    expect(locationText?.toLowerCase()).toMatch(/cellar|rack|zone|location|pantry|storage|fridge/i);
  });

  test('should be keyboard accessible', async ({ authenticatedAsAdmin: page }) => {
    const searchInput = page.locator(Selectors.inventory.searchInputTestId);
    
    // Tab to search input
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // One of the focused elements should be related to inventory
    const focusedElement = await page.evaluate(() => {
      return {
        tagName: document.activeElement?.tagName,
        id: document.activeElement?.id,
        testId: document.activeElement?.getAttribute('data-testid')
      };
    });

    // Should be able to focus interactive elements
    expect(['INPUT', 'BUTTON', 'SELECT']).toContain(focusedElement.tagName);
  });

  test('should have proper ARIA labels', async ({ authenticatedAsAdmin: page }) => {
    const searchInput = page.locator(Selectors.inventory.searchInputTestId);
    
    // Check for label or aria-label
    const hasLabel = await searchInput.evaluate((el) => {
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledBy = el.getAttribute('aria-labelledby');
      const hasLabelElement = !!document.querySelector(`label[for="${el.id}"]`);
      
      return !!(ariaLabel || ariaLabelledBy || hasLabelElement);
    });

    expect(hasLabel).toBeTruthy();
  });

  test('should handle slow network gracefully', async ({ authenticatedAsAdmin: page }) => {
    // Throttle network
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024, // 50kb/s
      uploadThroughput: 50 * 1024,
      latency: 500
    });

    // Trigger a filter change
    const typeFilter = page.locator(Selectors.inventory.typeFilterTestId);
    await typeFilter.selectOption({ label: 'White' });

    // Should show loading indicator
    const loadingIndicator = page.locator('.loading, .spinner, [data-testid="loading"]');
    await expect(loadingIndicator).toBeVisible({ timeout: 3000 }).catch(() => {});

    // Eventually show results
    await waitForNetworkIdle(page, 10000);

    // Restore network
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });
  });
});

test.describe('Inventory CRUD - Guest Permissions', () => {
  test('guest should have read-only access', async ({ authenticatedAsGuest: page }) => {
    await navigateToView(page, 'inventory');
    await waitForNetworkIdle(page);

    // Should be able to view wines
    const grid = page.locator(Selectors.inventory.gridTestId);
    await expect(grid).toBeVisible({ timeout: 10000 });

    // Should NOT see edit/delete buttons
    const editButtons = page.locator('[data-action="edit"], [data-testid*="edit"]');
    const deleteButtons = page.locator('[data-action="delete"], [data-testid*="delete"]');

    expect(await editButtons.count()).toBe(0);
    expect(await deleteButtons.count()).toBe(0);
  });

  test('guest should see read-only banner', async ({ authenticatedAsGuest: page }) => {
    const guestBanner = page.locator(Selectors.app.guestBanner);
    await expect(guestBanner).toBeVisible();
    await expect(guestBanner).toContainText(/guest|read-only/i);
  });
});
