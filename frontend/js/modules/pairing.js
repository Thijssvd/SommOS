/**
 * Pairing Module
 * Handles wine pairing functionality and dish analysis
 */

export class PairingModule {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.currentPairings = [];
        this.dishBuilder = null;
    }

    async init() {
        this.container = document.getElementById('pairing-view');
        if (this.container) {
            this.setupDishBuilder();
            this.setupEventListeners();
        }
    }

    setupDishBuilder() {
        const builder = this.container?.querySelector('#dish-builder');
        if (!builder) return;

        this.dishBuilder = {
            dish: '',
            intensity: 'medium',
            cuisine: '',
            occasion: 'dinner',
            season: 'autumn',
            preferences: []
        };

        // Dish description input
        const dishInput = builder.querySelector('#dish-description');
        if (dishInput) {
            dishInput.addEventListener('input', (e) => {
                this.dishBuilder.dish = e.target.value;
                this.updateDishBuilderPreview();
            });
        }

        // Intensity selector
        const intensitySelect = builder.querySelector('#intensity-select');
        if (intensitySelect) {
            intensitySelect.addEventListener('change', (e) => {
                this.dishBuilder.intensity = e.target.value;
                this.updateDishBuilderPreview();
            });
        }

        // Cuisine selector
        const cuisineSelect = builder.querySelector('#cuisine-select');
        if (cuisineSelect) {
            cuisineSelect.addEventListener('change', (e) => {
                this.dishBuilder.cuisine = e.target.value;
                this.updateDishBuilderPreview();
            });
        }

        // Occasion selector
        const occasionSelect = builder.querySelector('#occasion-select');
        if (occasionSelect) {
            occasionSelect.addEventListener('change', (e) => {
                this.dishBuilder.occasion = e.target.value;
                this.updateDishBuilderPreview();
            });
        }

        // Season selector
        const seasonSelect = builder.querySelector('#season-select');
        if (seasonSelect) {
            seasonSelect.addEventListener('change', (e) => {
                this.dishBuilder.season = e.target.value;
                this.updateDishBuilderPreview();
            });
        }

        // Flavor preferences
        const flavorTags = builder.querySelectorAll('.flavor-tag');
        flavorTags.forEach(tag => {
            tag.addEventListener('click', (e) => {
                const flavor = e.target.dataset.flavor;
                this.toggleFlavorPreference(flavor);
            });
        });
    }

    toggleFlavorPreference(flavor) {
        const index = this.dishBuilder.preferences.indexOf(flavor);
        if (index === -1) {
            this.dishBuilder.preferences.push(flavor);
        } else {
            this.dishBuilder.preferences.splice(index, 1);
        }

        // Update UI
        const tag = document.querySelector(`[data-flavor="${flavor}"]`);
        if (tag) {
            tag.classList.toggle('selected');
        }

        this.updateDishBuilderPreview();
    }

    updateDishBuilderPreview() {
        const preview = this.container?.querySelector('#dish-builder-preview');
        if (!preview) return;

        const { dish, intensity, cuisine, occasion, season, preferences } = this.dishBuilder;

        const context = {
            dish_description: dish,
            intensity,
            cuisine,
            occasion,
            season,
            preferences: preferences.length > 0 ? preferences : undefined
        };

        preview.innerHTML = `
            <div class="builder-preview">
                <h4>Dish Analysis Preview</h4>
                <div class="preview-details">
                    ${dish ? `<p><strong>Dish:</strong> ${dish}</p>` : ''}
                    <p><strong>Intensity:</strong> ${intensity}</p>
                    <p><strong>Cuisine:</strong> ${cuisine || 'Not specified'}</p>
                    <p><strong>Occasion:</strong> ${occasion}</p>
                    <p><strong>Season:</strong> ${season}</p>
                    ${preferences.length > 0 ? `<p><strong>Preferences:</strong> ${preferences.join(', ')}</p>` : ''}
                </div>
                <button class="btn primary" onclick="app.handlePairingRequest()">
                    Find Wine Pairings
                </button>
            </div>
        `;
    }

    async handlePairingRequest() {
        const { dish, intensity, cuisine, occasion, season, preferences } = this.dishBuilder;

        if (!dish.trim()) {
            this.app.ui.showToast('Please describe the dish first', 'warning');
            return;
        }

        try {
            this.showLoading();

            const context = {
                intensity,
                cuisine,
                occasion,
                season,
                guestPreferences: preferences.length > 0 ? { flavors: preferences } : undefined
            };

            const result = await this.app.api.getPairings(dish, context);

            if (result.success && result.data) {
                this.displayPairings(result.data);
            } else {
                throw new Error('No pairing recommendations found');
            }
        } catch (error) {
            console.error('Pairing request failed:', error);
            this.app.ui.showToast('Failed to find wine pairings', 'error');
        } finally {
            this.hideLoading();
        }
    }

    displayPairings(pairingsResult) {
        const resultsContainer = this.container?.querySelector('.pairing-results');
        if (!resultsContainer) return;

        if (!pairingsResult.recommendations || pairingsResult.recommendations.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-pairings">
                    <h4>No Pairing Recommendations</h4>
                    <p>We couldn't find suitable wine pairings for this dish. Try adjusting your dish description or preferences.</p>
                </div>
            `;
            return;
        }

        const pairingsHtml = pairingsResult.recommendations.map(rec =>
            this.createPairingCard(rec)
        ).join('');

        resultsContainer.innerHTML = `
            <h3>🍷 Wine Pairing Recommendations</h3>
            <div class="pairing-list">
                ${pairingsHtml}
            </div>
        `;
    }

    createPairingCard(recommendation) {
        const wine = recommendation.wine;
        const score = recommendation.score;
        const reasoning = recommendation.reasoning || 'No reasoning available';

        return `
            <div class="pairing-item">
                <div class="pairing-card">
                    <div class="wine-header-pairing">
                        <h4>${wine.name || 'Unknown Wine'}</h4>
                        <div class="wine-type-badge ${wine.wine_type?.toLowerCase() || 'unknown'}">
                            ${this.getWineTypeIcon(wine.wine_type)}
                        </div>
                    </div>

                    <div class="pairing-details">
                        <div class="wine-info">
                            <p><strong>Producer:</strong> ${wine.producer || 'Unknown'}</p>
                            <p><strong>Region:</strong> ${wine.region || 'Unknown'}</p>
                            <p><strong>Year:</strong> ${wine.year || 'NV'}</p>
                            ${wine.quantity ? `<p><strong>Available:</strong> ${wine.quantity} bottles</p>` : ''}
                        </div>

                        <div class="confidence-score">
                            <span class="score-label">Match Confidence:</span>
                            <span class="score-value">${Math.round(score.total * 100)}%</span>
                        </div>

                        <div class="pairing-reasoning">
                            <h5>Why this pairing works:</h5>
                            <p>${reasoning}</p>
                        </div>

                        <div class="pairing-actions">
                            <button class="btn primary" onclick="app.showWineDetails('${wine.vintage_id}')">
                                View Details
                            </button>
                            <button class="btn secondary" onclick="app.submitPairingFeedback({
                                recommendation_id: '${recommendation.learning_recommendation_id}',
                                rating: 4,
                                notes: 'Good pairing suggestion'
                            })">
                                👍 Good Match
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showLoading() {
        const btn = this.container?.querySelector('#dish-builder button');
        if (btn) {
            btn.classList.add('loading');
            btn.disabled = true;
        }
    }

    hideLoading() {
        const btn = this.container?.querySelector('#dish-builder button');
        if (btn) {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    setupEventListeners() {
        // Pairing-specific event listeners
        const resetBtn = this.container?.querySelector('#reset-builder');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetDishBuilder();
            });
        }
    }

    resetDishBuilder() {
        this.dishBuilder = {
            dish: '',
            intensity: 'medium',
            cuisine: '',
            occasion: 'dinner',
            season: 'autumn',
            preferences: []
        };

        // Reset form elements
        const dishInput = this.container?.querySelector('#dish-description');
        const intensitySelect = this.container?.querySelector('#intensity-select');
        const cuisineSelect = this.container?.querySelector('#cuisine-select');
        const occasionSelect = this.container?.querySelector('#occasion-select');
        const seasonSelect = this.container?.querySelector('#season-select');

        if (dishInput) dishInput.value = '';
        if (intensitySelect) intensitySelect.value = 'medium';
        if (cuisineSelect) cuisineSelect.value = '';
        if (occasionSelect) occasionSelect.value = 'dinner';
        if (seasonSelect) seasonSelect.value = 'autumn';

        // Reset flavor tags
        const flavorTags = this.container?.querySelectorAll('.flavor-tag');
        flavorTags.forEach(tag => tag.classList.remove('selected'));

        this.updateDishBuilderPreview();
    }

    // Helper methods
    getWineTypeIcon(wineType) {
        const iconMap = {
            'Red': '🍷',
            'White': '🥂',
            'Rosé': '🌸',
            'Sparkling': '✨',
            'Dessert': '🍰',
            'Fortified': '🥃'
        };
        return iconMap[wineType] || '🍷';
    }
}
