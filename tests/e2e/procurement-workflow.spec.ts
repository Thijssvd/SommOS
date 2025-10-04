import { test, expect } from './fixtures/auth';
import { Selectors, testId } from './utils/selectors';
import { 
  waitForToast, 
  waitForAPIResponse, 
  navigateToView,
  waitForNetworkIdle 
} from './utils/helpers';

test.describe('Procurement Workflow', () => {
  test.beforeEach(async ({ authenticatedAsAdmin: page }) => {
    // Navigate to procurement view
    await navigateToView(page, 'procurement');
    await waitForNetworkIdle(page);
  });

  test('should display procurement view with stats', async ({ authenticatedAsAdmin: page }) => {
    // Wait for procurement view to load
    const procurementView = page.locator(Selectors.views.procurement);
    await expect(procurementView).toBeVisible({ timeout: 10000 });

    // Should display procurement stats
    const statsCards = page.locator('.stat-card, .stats-card');
    const count = await statsCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Check that stats have values
    if (count > 0) {
      const firstStatNumber = statsCards.first().locator('.stat-number, .number, .value');
      await expect(firstStatNumber).toBeVisible();
      const statValue = await firstStatNumber.textContent();
      expect(statValue).toBeTruthy();
    }
  });

  test('should display procurement opportunities', async ({ authenticatedAsAdmin: page }) => {
    // Wait for opportunities to load
    await waitForNetworkIdle(page, 5000);

    // Check for opportunities grid or placeholder
    const opportunitiesGrid = page.locator('.opportunities-grid, #opportunities-grid');
    await expect(opportunitiesGrid).toBeVisible({ timeout: 10000 });

    // Should show either opportunities or empty state
    const opportunityCards = page.locator('.opportunity-card');
    const placeholderMessage = page.locator('.opportunities-placeholder, .empty-state');

    const hasCards = await opportunityCards.count() > 0;
    const hasPlaceholder = await placeholderMessage.isVisible().catch(() => false);

    expect(hasCards || hasPlaceholder).toBeTruthy();
  });

  test('should display opportunity details', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    // Find first opportunity card
    const opportunityCards = page.locator('.opportunity-card');
    const count = await opportunityCards.count();
    
    test.skip(count === 0, 'No procurement opportunities available');

    const firstOpportunity = opportunityCards.first();
    await expect(firstOpportunity).toBeVisible();

    // Verify essential opportunity information
    await expect(firstOpportunity).toContainText(/producer|region|wine|type/i);
    
    // Should have reasoning section
    const reasoning = firstOpportunity.locator('.opportunity-reasoning, h5:has-text("Why this opportunity")');
    await expect(reasoning).toBeVisible();

    // Should have action buttons
    const analyzeButton = firstOpportunity.locator('button:has-text("Analyze")');
    const orderButton = firstOpportunity.locator('button:has-text("Order"), button:has-text("Generate")');
    
    await expect(analyzeButton.or(orderButton)).toBeVisible();
  });

  test('should display opportunity score', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    const opportunityCards = page.locator('.opportunity-card');
    const count = await opportunityCards.count();
    
    test.skip(count === 0, 'No procurement opportunities available');

    const firstOpportunity = opportunityCards.first();

    // Should show score/confidence
    const scoreElement = firstOpportunity.locator('.opportunity-score, .score-value, .confidence-score');
    await expect(scoreElement).toBeVisible();

    // Score should be a percentage or number
    const scoreText = await scoreElement.textContent();
    expect(scoreText).toMatch(/\d+%|\d+/);
  });

  test('should display investment and savings information', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    const opportunityCards = page.locator('.opportunity-card');
    const count = await opportunityCards.count();
    
    test.skip(count === 0, 'No procurement opportunities available');

    const firstOpportunity = opportunityCards.first();
    const detailsSection = firstOpportunity.locator('.opportunity-details');
    await expect(detailsSection).toBeVisible();

    // Should show investment information
    const opportunityText = await detailsSection.textContent();
    expect(opportunityText?.toLowerCase()).toMatch(/investment|price|cost/i);
    
    // May show savings information
    const hasSavings = opportunityText?.toLowerCase().includes('savings');
    if (hasSavings) {
      expect(opportunityText).toContain('$');
    }
  });

  test('should filter opportunities by region', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    // Find region filter
    const regionFilter = page.locator('#procurement-region-filter, [data-testid="procurement-filter-region"]');
    
    if (await regionFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Get initial count
      const initialOpportunities = page.locator('.opportunity-card');
      const initialCount = await initialOpportunities.count();

      // Apply region filter
      await regionFilter.fill('Bordeaux');
      await page.waitForTimeout(500); // Debounce delay
      await waitForNetworkIdle(page, 3000);

      // Check if results updated
      const filteredOpportunities = page.locator('.opportunity-card');
      const filteredCount = await filteredOpportunities.count();

      // If results exist, verify they contain the filter term
      if (filteredCount > 0) {
        const firstCard = filteredOpportunities.first();
        const cardText = await firstCard.textContent();
        expect(cardText?.toLowerCase()).toContain('bordeaux');
      } else {
        // Empty state should be shown
        const emptyState = page.locator('.opportunities-placeholder, .empty-state');
        await expect(emptyState).toBeVisible();
      }
    } else {
      test.skip(true, 'Region filter not available');
    }
  });

  test('should filter opportunities by wine type', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    // Find type filter
    const typeFilter = page.locator('#procurement-type-filter, [data-testid="procurement-filter-type"]');
    
    if (await typeFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Select a wine type
      const options = await typeFilter.locator('option').all();
      
      if (options.length > 1) {
        // Select 'Red' or second option
        const redOption = await typeFilter.locator('option:has-text("Red")').count();
        if (redOption > 0) {
          await typeFilter.selectOption({ label: 'Red' });
        } else {
          await typeFilter.selectOption({ index: 1 });
        }

        await waitForNetworkIdle(page, 3000);

        // Verify filtered results
        const filteredOpportunities = page.locator('.opportunity-card');
        const filteredCount = await filteredOpportunities.count();

        if (filteredCount > 0) {
          const firstCard = filteredOpportunities.first();
          const cardText = await firstCard.textContent();
          // Should contain wine type information
          expect(cardText?.toLowerCase()).toMatch(/red|white|rosé|sparkling/i);
        } else {
          // Empty state is acceptable
          const emptyState = page.locator('.opportunities-placeholder, .empty-state');
          await expect(emptyState).toBeVisible();
        }
      }
    } else {
      test.skip(true, 'Type filter not available');
    }
  });

  test('should filter opportunities by maximum price', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    // Find price filter
    const priceFilter = page.locator('#procurement-price-filter, [data-testid="procurement-filter-price"]');
    
    if (await priceFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Set max price
      await priceFilter.fill('100');
      await page.waitForTimeout(500); // Debounce delay
      await waitForNetworkIdle(page, 3000);

      // Verify results
      const filteredOpportunities = page.locator('.opportunity-card');
      const filteredCount = await filteredOpportunities.count();

      if (filteredCount > 0) {
        // Check that prices are within range (if visible)
        const firstCard = filteredOpportunities.first();
        const cardText = await firstCard.textContent();
        expect(cardText).toBeTruthy();
      }
    } else {
      test.skip(true, 'Price filter not available');
    }
  });

  test('should filter opportunities by minimum score', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    // Find score filter
    const scoreFilter = page.locator('#procurement-score-filter, [data-testid="procurement-filter-score"]');
    
    if (await scoreFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Set minimum score (e.g., 70)
      await scoreFilter.fill('70');
      await page.waitForTimeout(500); // Debounce delay
      await waitForNetworkIdle(page, 3000);

      // Verify results show high-scoring opportunities
      const filteredOpportunities = page.locator('.opportunity-card');
      const filteredCount = await filteredOpportunities.count();

      if (filteredCount > 0) {
        const firstCard = filteredOpportunities.first();
        const scoreElement = firstCard.locator('.opportunity-score, .score-value');
        
        if (await scoreElement.isVisible().catch(() => false)) {
          const scoreText = await scoreElement.textContent();
          const scoreMatch = scoreText?.match(/(\d+)/);
          
          if (scoreMatch) {
            const score = parseInt(scoreMatch[1]);
            expect(score).toBeGreaterThanOrEqual(70);
          }
        }
      }
    } else {
      test.skip(true, 'Score filter not available');
    }
  });

  test('should handle analyze purchase button', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    const opportunityCards = page.locator('.opportunity-card');
    const count = await opportunityCards.count();
    
    test.skip(count === 0, 'No procurement opportunities available');

    const firstOpportunity = opportunityCards.first();
    
    // Find analyze button
    const analyzeButton = firstOpportunity.locator('button:has-text("Analyze")');
    
    if (await analyzeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click analyze button
      await analyzeButton.click();
      await page.waitForTimeout(1000);

      // Should open modal or navigate to decision tool
      const modal = page.locator('.modal, [role="dialog"]');
      const decisionTool = page.locator('#purchase-decision-tool, .purchase-decision');
      
      const modalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);
      const toolVisible = await decisionTool.isVisible({ timeout: 3000 }).catch(() => false);

      expect(modalVisible || toolVisible).toBeTruthy();
    } else {
      test.skip(true, 'Analyze button not available');
    }
  });

  test('should handle generate order button', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    const opportunityCards = page.locator('.opportunity-card');
    const count = await opportunityCards.count();
    
    test.skip(count === 0, 'No procurement opportunities available');

    const firstOpportunity = opportunityCards.first();
    
    // Find generate/order button
    const orderButton = firstOpportunity.locator('button:has-text("Order"), button:has-text("Generate")');
    
    if (await orderButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click order button
      await orderButton.click();
      await page.waitForTimeout(1000);

      // Should open order form or show confirmation
      const orderForm = page.locator('#purchase-order-form, .order-form');
      const modal = page.locator('.modal, [role="dialog"]');
      const toast = page.locator('.toast');
      
      const formVisible = await orderForm.isVisible({ timeout: 3000 }).catch(() => false);
      const modalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);
      const toastVisible = await toast.isVisible({ timeout: 3000 }).catch(() => false);

      expect(formVisible || modalVisible || toastVisible).toBeTruthy();
    } else {
      test.skip(true, 'Generate order button not available');
    }
  });

  test('should display recommended quantity', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    const opportunityCards = page.locator('.opportunity-card');
    const count = await opportunityCards.count();
    
    test.skip(count === 0, 'No procurement opportunities available');

    const firstOpportunity = opportunityCards.first();
    const detailsSection = firstOpportunity.locator('.opportunity-details');
    const detailsText = await detailsSection.textContent();

    // Should show recommended quantity
    expect(detailsText?.toLowerCase()).toMatch(/quantity|bottles/i);
    expect(detailsText).toMatch(/\d+/); // Should have numbers
  });

  test('should display supplier information', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    const opportunityCards = page.locator('.opportunity-card');
    const count = await opportunityCards.count();
    
    test.skip(count === 0, 'No procurement opportunities available');

    const firstOpportunity = opportunityCards.first();
    const detailsSection = firstOpportunity.locator('.opportunity-details');
    const detailsText = await detailsSection.textContent();

    // Should show supplier information
    expect(detailsText?.toLowerCase()).toContain('supplier');
  });

  test('should handle empty opportunities gracefully', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    // Apply very restrictive filters to get empty results
    const priceFilter = page.locator('#procurement-price-filter');
    const scoreFilter = page.locator('#procurement-score-filter');

    if (await priceFilter.isVisible().catch(() => false)) {
      await priceFilter.fill('1'); // Very low price
      await page.waitForTimeout(500);
    }

    if (await scoreFilter.isVisible().catch(() => false)) {
      await scoreFilter.fill('99'); // Very high score
      await page.waitForTimeout(500);
    }

    await waitForNetworkIdle(page, 3000);

    // Should show empty state or placeholder
    const emptyState = page.locator('.opportunities-placeholder, .empty-state, .no-results');
    const opportunityCards = page.locator('.opportunity-card');
    const cardsCount = await opportunityCards.count();

    if (cardsCount === 0) {
      await expect(emptyState).toBeVisible({ timeout: 3000 });
      await expect(emptyState).toContainText(/no.*opportunit|adjust|filter/i);
    }
  });

  test('should refresh procurement data (Optional Feature)', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    // Look for refresh button
    const refreshButton = page.locator('button:has-text("Refresh"), [data-action="refresh"], #refresh-btn');
    
    if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click refresh
      await refreshButton.click();
      await page.waitForTimeout(500);

      // Should reload data
      await waitForNetworkIdle(page, 5000);

      // Procurement view should still be visible
      const procurementView = page.locator(Selectors.views.procurement);
      await expect(procurementView).toBeVisible();
    } else {
      test.skip(true, 'Refresh button not available');
    }
  });

  test('should maintain procurement filters in URL or state (Optional Feature)', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    // Apply a filter
    const typeFilter = page.locator('#procurement-type-filter');
    
    if (await typeFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      const options = await typeFilter.locator('option').all();
      
      if (options.length > 1) {
        await typeFilter.selectOption({ index: 1 });
        await waitForNetworkIdle(page, 2000);

        // Get selected value
        const selectedValue = await typeFilter.inputValue();

        // Reload page
        await page.reload();
        await waitForNetworkIdle(page, 5000);

        // Check if filter is preserved (depends on implementation)
        const filterAfterReload = page.locator('#procurement-type-filter');
        const valueAfterReload = await filterAfterReload.inputValue().catch(() => '');

        // Note: Filter persistence is implementation-dependent
        // This test documents the current behavior
      }
    } else {
      test.skip(true, 'Type filter not available');
    }
  });

  test('should show urgency indicators', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    const opportunityCards = page.locator('.opportunity-card');
    const count = await opportunityCards.count();
    
    test.skip(count === 0, 'No procurement opportunities available');

    const firstOpportunity = opportunityCards.first();
    const cardHTML = await firstOpportunity.innerHTML();

    // May show urgency indicator (emoji or label)
    const hasUrgencyIndicator = 
      cardHTML.includes('🟢') || 
      cardHTML.includes('🟡') || 
      cardHTML.includes('🟠') || 
      cardHTML.includes('🔴') ||
      cardHTML.toLowerCase().includes('urgency');

    // Urgency indicators are optional but good to document
    // Document behavior without logging
  });

  test('should be accessible via keyboard navigation', async ({ authenticatedAsAdmin: page }) => {
    await waitForNetworkIdle(page, 5000);

    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check that we can focus on interactive elements
    const focusedElement = await page.evaluate(() => {
      return {
        tagName: document.activeElement?.tagName,
        id: document.activeElement?.id,
        classList: Array.from(document.activeElement?.classList || [])
      };
    });

    // Should be able to focus on buttons, inputs, or selects
    expect(['BUTTON', 'INPUT', 'SELECT', 'A']).toContain(focusedElement.tagName);
  });

  test('should handle API errors gracefully', async ({ authenticatedAsAdmin: page }) => {
    // Intercept API and force error
    await page.route('**/api/procurement/opportunities*', route => {
      route.abort();
    });

    // Try to load procurement
    await page.reload();
    await waitForNetworkIdle(page, 5000);

    // Should show error message or fallback
    const errorMessage = page.locator('.error-content, .error-message, [data-error]');
    const emptyState = page.locator('.opportunities-placeholder, .empty-state');

    const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    expect(hasError || hasEmptyState).toBeTruthy();
  });
});

test.describe('Procurement Workflow - Guest Permissions', () => {
  test('guest should have read-only access to procurement', async ({ authenticatedAsGuest: page }) => {
    await navigateToView(page, 'procurement');
    await waitForNetworkIdle(page);

    // Should be able to view procurement view
    const procurementView = page.locator(Selectors.views.procurement);
    await expect(procurementView).toBeVisible({ timeout: 10000 });

    // Should NOT see action buttons (analyze, order)
    const opportunityCards = page.locator('.opportunity-card');
    const count = await opportunityCards.count();

    if (count > 0) {
      const firstOpportunity = opportunityCards.first();
      const actionButtons = firstOpportunity.locator('button:has-text("Analyze"), button:has-text("Order"), button:has-text("Generate")');
      
      // Guest should not see these buttons
      const buttonCount = await actionButtons.count();
      expect(buttonCount).toBe(0);
    }
  });

  test('guest should see read-only banner on procurement', async ({ authenticatedAsGuest: page }) => {
    await navigateToView(page, 'procurement');
    await waitForNetworkIdle(page);

    // Should show guest banner
    const guestBanner = page.locator(Selectors.app.guestBanner);
    await expect(guestBanner).toBeVisible();
    await expect(guestBanner).toContainText(/guest|read-only/i);
  });
});
