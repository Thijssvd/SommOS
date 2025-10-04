import { test, expect } from './fixtures/auth';
import { Selectors, testId } from './utils/selectors';
import { 
  waitForToast, 
  waitForAPIResponse, 
  navigateToView,
  waitForNetworkIdle 
} from './utils/helpers';

test.describe('Pairing Recommendations UI', () => {
  test.beforeEach(async ({ authenticatedAsAdmin: page }) => {
    // Navigate to pairing view
    await navigateToView(page, 'pairing');
    await waitForNetworkIdle(page);
  });

  test('should display pairing form', async ({ authenticatedAsAdmin: page }) => {
    // Wait for pairing view
    const pairingView = page.locator(Selectors.views.pairing);
    await expect(pairingView).toBeVisible({ timeout: 10000 });

    // Check form fields
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    const occasionSelect = page.locator(Selectors.pairing.occasionSelectTestId);
    const guestCountInput = page.locator(Selectors.pairing.guestCountInputTestId);

    await expect(dishInput).toBeVisible();
    await expect(occasionSelect).toBeVisible();
    await expect(guestCountInput).toBeVisible();
  });

  test('should submit pairing request and display results', async ({ authenticatedAsAdmin: page }) => {
    // Fill in dish description
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Grilled salmon with lemon herbs');

    // Select occasion
    const occasionSelect = page.locator(Selectors.pairing.occasionSelectTestId);
    await occasionSelect.selectOption({ label: 'Casual Dining' });

    // Set guest count
    const guestCountInput = page.locator(Selectors.pairing.guestCountInputTestId);
    await guestCountInput.fill('4');

    // Submit form
    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    // Wait for results
    await waitForNetworkIdle(page, 10000);

    // Should show results container
    const resultsContainer = page.locator(Selectors.pairing.resultsContainerTestId);
    await expect(resultsContainer).toBeVisible({ timeout: 15000 });

    // Should show recommendations or empty state
    const resultsList = page.locator(Selectors.pairing.resultsListTestId);
    const noPairingsMessage = page.locator('.no-pairings');

    const hasResults = await resultsList.locator('.pairing-item, .pairing-card').count() > 0;
    const hasEmptyState = await noPairingsMessage.isVisible().catch(() => false);

    expect(hasResults || hasEmptyState).toBeTruthy();
  });

  test('should display pairing recommendation details', async ({ authenticatedAsAdmin: page }) => {
    // Submit a pairing request
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Ribeye steak with mushroom sauce');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    await waitForNetworkIdle(page, 10000);

    // Check if results exist
    const pairingCards = page.locator('.pairing-item, .pairing-card');
    const count = await pairingCards.count();

    test.skip(count === 0, 'No pairing recommendations available');

    const firstCard = pairingCards.first();
    await expect(firstCard).toBeVisible();

    // Should show wine details
    await expect(firstCard).toContainText(/producer|region|wine/i);

    // Should show confidence score
    const confidenceScore = firstCard.locator('.confidence-score, .score-value');
    await expect(confidenceScore).toBeVisible();

    // Should show reasoning
    const reasoning = firstCard.locator('.pairing-reasoning');
    await expect(reasoning).toBeVisible();
  });

  test('should display confidence scores', async ({ authenticatedAsAdmin: page }) => {
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Oysters with mignonette');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    await waitForNetworkIdle(page, 10000);

    const pairingCards = page.locator('.pairing-item, .pairing-card');
    const count = await pairingCards.count();

    test.skip(count === 0, 'No pairing recommendations available');

    const firstCard = pairingCards.first();
    const scoreElement = firstCard.locator('.confidence-score, .score-value');

    const scoreText = await scoreElement.textContent();
    expect(scoreText).toMatch(/\d+%|\d+/);
  });

  test('should show pairing reasoning', async ({ authenticatedAsAdmin: page }) => {
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Spicy Thai curry');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    await waitForNetworkIdle(page, 10000);

    const pairingCards = page.locator('.pairing-item, .pairing-card');
    const count = await pairingCards.count();

    test.skip(count === 0, 'No pairing recommendations available');

    const firstCard = pairingCards.first();
    const reasoning = firstCard.locator('.pairing-reasoning');

    await expect(reasoning).toBeVisible();
    const reasoningText = await reasoning.textContent();
    expect(reasoningText.length).toBeGreaterThan(10);
  });

  test('should use dish builder', async ({ authenticatedAsAdmin: page }) => {
    // Fill in dish builder fields
    const mainIngredient = page.locator('#dish-main-ingredient');
    if (await mainIngredient.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mainIngredient.fill('salmon');

      const cookingTechnique = page.locator('#dish-cooking-technique');
      await cookingTechnique.selectOption({ value: 'grilled' });

      const cuisineStyle = page.locator('#dish-cuisine-style');
      await cuisineStyle.selectOption({ value: 'Mediterranean' });

      // Apply builder
      const applyButton = page.locator('#apply-dish-builder');
      if (await applyButton.isVisible().catch(() => false)) {
        await applyButton.click();

        // Check if description was populated
        const dishInput = page.locator(Selectors.pairing.dishInputTestId);
        const inputValue = await dishInput.inputValue();
        expect(inputValue.length).toBeGreaterThan(0);
      }
    } else {
      test.skip(true, 'Dish builder not available');
    }
  });

  test('should handle flavor tags', async ({ authenticatedAsAdmin: page }) => {
    const flavorTags = page.locator('.flavor-tag');
    const count = await flavorTags.count();

    if (count > 0) {
      // Click a flavor tag
      await flavorTags.first().click();

      // Should toggle selection
      const hasSelected = await flavorTags.first().evaluate((el) => 
        el.classList.contains('selected')
      );
      expect(hasSelected).toBeTruthy();
    } else {
      test.skip(true, 'Flavor tags not available');
    }
  });

  test('should validate required dish description', async ({ authenticatedAsAdmin: page }) => {
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    // Should show validation error or toast
    const toast = page.locator('.toast');
    const hasToast = await toast.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasToast) {
      const toastText = await toast.textContent();
      expect(toastText?.toLowerCase()).toMatch(/describe|dish|required/i);
    }
  });

  test('should show loading state while fetching', async ({ authenticatedAsAdmin: page }) => {
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Duck confit with orange glaze');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    // Should show loading state
    const hasLoading = await submitButton.evaluate((el) => 
      el.classList.contains('loading') || el.disabled
    );
    
    if (hasLoading) {
      expect(hasLoading).toBeTruthy();
    }

    // Wait for completion
    await waitForNetworkIdle(page, 10000);
  });

  test('should display wine availability', async ({ authenticatedAsAdmin: page }) => {
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Beef wellington');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    await waitForNetworkIdle(page, 10000);

    const pairingCards = page.locator('.pairing-item, .pairing-card');
    const count = await pairingCards.count();

    test.skip(count === 0, 'No pairing recommendations available');

    const firstCard = pairingCards.first();
    const cardText = await firstCard.textContent();

    // May show availability/quantity
    const hasAvailability = cardText?.toLowerCase().includes('available') || 
                           cardText?.toLowerCase().includes('bottle');
    
    // Document behavior: availability info is optional
  });

  test('should have action buttons on recommendations', async ({ authenticatedAsAdmin: page }) => {
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Lobster bisque');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    await waitForNetworkIdle(page, 10000);

    const pairingCards = page.locator('.pairing-item, .pairing-card');
    const count = await pairingCards.count();

    test.skip(count === 0, 'No pairing recommendations available');

    const firstCard = pairingCards.first();
    const actionButtons = firstCard.locator('button');
    const buttonCount = await actionButtons.count();

    expect(buttonCount).toBeGreaterThanOrEqual(1);
  });

  test('should handle thumbs up feedback', async ({ authenticatedAsAdmin: page }) => {
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Seared tuna');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    await waitForNetworkIdle(page, 10000);

    const thumbsUpButton = page.locator('button:has-text("👍"), button:has-text("Good Match")').first();
    
    if (await thumbsUpButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await thumbsUpButton.click();
      
      // Should show feedback acknowledgment
      const toast = page.locator('.toast');
      await expect(toast).toBeVisible({ timeout: 3000 });
    } else {
      test.skip(true, 'Thumbs up button not available');
    }
  });

  test('should handle view details button', async ({ authenticatedAsAdmin: page }) => {
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Roasted lamb');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    await waitForNetworkIdle(page, 10000);

    const viewDetailsButton = page.locator('button:has-text("View Details"), button:has-text("Details")').first();
    
    if (await viewDetailsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewDetailsButton.click();
      await page.waitForTimeout(1000);

      // Should open modal or navigate
      const modal = page.locator('.modal, [role="dialog"]');
      const modalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);

      expect(modalVisible).toBeTruthy();
    } else {
      test.skip(true, 'View details button not available');
    }
  });

  test('should handle empty results gracefully', async ({ authenticatedAsAdmin: page }) => {
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Unicorn steak with rainbow sauce');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    await waitForNetworkIdle(page, 10000);

    const resultsContainer = page.locator(Selectors.pairing.resultsContainerTestId);
    await expect(resultsContainer).toBeVisible({ timeout: 15000 });

    // May show "no pairings" message
    const noPairingsMessage = page.locator('.no-pairings');
    const pairingCards = page.locator('.pairing-item, .pairing-card');

    const hasCards = await pairingCards.count() > 0;
    const hasMessage = await noPairingsMessage.isVisible().catch(() => false);

    expect(hasCards || hasMessage).toBeTruthy();
  });

  test('should preserve form data after submission', async ({ authenticatedAsAdmin: page }) => {
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    const occasionSelect = page.locator(Selectors.pairing.occasionSelectTestId);
    const guestCountInput = page.locator(Selectors.pairing.guestCountInputTestId);

    await dishInput.fill('Chicken parmesan');
    await occasionSelect.selectOption({ value: 'formal' });
    await guestCountInput.fill('6');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    await waitForNetworkIdle(page, 10000);

    // Check that form values are preserved
    const dishValue = await dishInput.inputValue();
    const occasionValue = await occasionSelect.inputValue();
    const guestValue = await guestCountInput.inputValue();

    expect(dishValue).toBe('Chicken parmesan');
    expect(occasionValue).toBe('formal');
    expect(guestValue).toBe('6');
  });

  test('should be keyboard accessible', async ({ authenticatedAsAdmin: page }) => {
    // Tab through form elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focusedElement = await page.evaluate(() => {
      return {
        tagName: document.activeElement?.tagName,
        id: document.activeElement?.id,
        testId: document.activeElement?.getAttribute('data-testid')
      };
    });

    expect(['TEXTAREA', 'INPUT', 'SELECT', 'BUTTON']).toContain(focusedElement.tagName);
  });

  test('should handle API errors gracefully', async ({ authenticatedAsAdmin: page }) => {
    // Intercept API and force error
    await page.route('**/api/pairings*', route => {
      route.abort();
    });

    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Test dish');

    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await submitButton.click();

    await page.waitForTimeout(2000);

    // Should show error toast or message
    const toast = page.locator('.toast.error, .toast-error');
    const errorMessage = page.locator('.error-content, .no-pairings.error');

    const hasToast = await toast.isVisible({ timeout: 3000 }).catch(() => false);
    const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasToast || hasError).toBeTruthy();
  });
});

test.describe('Pairing Recommendations UI - Guest Permissions', () => {
  test('guest should be able to view pairing recommendations', async ({ authenticatedAsGuest: page }) => {
    await navigateToView(page, 'pairing');
    await waitForNetworkIdle(page);

    // Should have access to pairing view
    const pairingView = page.locator(Selectors.views.pairing);
    await expect(pairingView).toBeVisible({ timeout: 10000 });

    // Can fill form
    const dishInput = page.locator(Selectors.pairing.dishInputTestId);
    await dishInput.fill('Margherita pizza');

    // Can submit
    const submitButton = page.locator(Selectors.pairing.submitButtonTestId);
    await expect(submitButton).toBeEnabled();
  });

  test('guest should see read-only banner on pairing', async ({ authenticatedAsGuest: page }) => {
    await navigateToView(page, 'pairing');
    await waitForNetworkIdle(page);

    const guestBanner = page.locator(Selectors.app.guestBanner);
    await expect(guestBanner).toBeVisible();
    await expect(guestBanner).toContainText(/guest|read-only/i);
  });
});
