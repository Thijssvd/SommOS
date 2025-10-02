/**
 * Inventory Module
 * Handles inventory management, stock tracking, and wine operations
 */

export class InventoryModule {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.currentInventory = [];
        this.filters = {};
        this.pagination = { page: 1, limit: 50, total: 0 };
    }

    async init() {
        this.container = document.getElementById('inventory-view');
        if (this.container) {
            await this.loadInventory();
            this.setupEventListeners();
        }
    }

    async loadInventory() {
        try {
            const result = await this.app.api.getInventory({
                location: this.filters.location,
                wine_type: this.filters.wine_type,
                region: this.filters.region,
                available_only: this.filters.available_only,
                limit: this.pagination.limit,
                offset: (this.pagination.page - 1) * this.pagination.limit
            });

            if (result.success && result.data) {
                this.currentInventory = result.data;
                this.pagination.total = result.meta?.total || 0;
                this.displayInventory();
            } else {
                throw new Error('Failed to load inventory');
            }
        } catch (error) {
            console.error('Failed to load inventory:', error);
            this.displayError('Failed to load inventory');
        }
    }

    displayInventory() {
        if (!this.container) return;

        const grid = this.container.querySelector('.inventory-grid');
        if (!grid) return;

        const isGuest = this.app.isGuestUser();
        const wineCards = this.currentInventory.map((item, index) =>
            this.createInventoryWineCard(item, index, isGuest)
        ).join('');

        grid.innerHTML = wineCards;
    }

    createInventoryWineCard(item, index, isGuest) {
        const wine = item;
        const available = wine.quantity - (wine.reserved_quantity || 0);
        const isAvailable = available > 0;

        return `
            <div class="wine-card" data-wine-id="${wine.id}" data-vintage-id="${wine.vintage_id}">
                <div class="wine-header">
                    <div class="wine-type-badge ${wine.wine_type?.toLowerCase() || 'unknown'}">
                        ${this.getWineTypeIcon(wine.wine_type)}
                    </div>
                    <div class="wine-quality">
                        <span class="quality-score">${wine.quality_score || '—'}</span>
                    </div>
                </div>

                <div class="wine-content">
                    <h3 class="wine-name">${wine.name || 'Unknown Wine'}</h3>
                    <div class="wine-origin">
                        <span class="producer">${wine.producer || 'Unknown Producer'}</span>
                        <span class="year">${wine.year || 'NV'}</span>
                        <span class="region">${wine.region || 'Unknown Region'}</span>
                    </div>

                    ${wine.grape_varieties ? `
                        <div class="grape-varieties">
                            <span class="grape-label">Grapes:</span>
                            ${this.parseGrapeVarieties(wine.grape_varieties).map(grape =>
                                `<span class="grape-tag">${grape}</span>`
                            ).join('')}
                        </div>
                    ` : ''}

                    <div class="stock-section">
                        <div class="quantity-info">
                            <span class="quantity available">${available}</span>
                            <span class="unit">bottles</span>
                            <span class="location">${wine.location || 'Unknown Location'}</span>
                        </div>

                        <div class="value-info">
                            <span class="price">${this.formatCurrency(wine.cost_per_bottle)}</span>
                            <span class="total-value">${this.formatCurrency((wine.cost_per_bottle || 0) * (wine.quantity || 0))}</span>
                        </div>
                    </div>

                    <div class="card-actions">
                        ${!isGuest ? `
                            <button class="btn btn-small primary" onclick="app.showWineDetails('${wine.vintage_id}')">
                                <span>👁️</span> View
                            </button>
                            <button class="btn btn-small secondary" onclick="app.reserveWineModal('${wine.vintage_id}', '${wine.name}')">
                                <span>📋</span> Reserve
                            </button>
                            <button class="btn btn-small secondary" onclick="app.consumeWineModal('${wine.vintage_id}', '${wine.name}')">
                                <span>🍷</span> Consume
                            </button>
                        ` : `
                            <button class="btn btn-small primary" onclick="app.showWineDetails('${wine.vintage_id}')">
                                <span>👁️</span> View
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    displayError(message) {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="error-content">
                <h4>⚠️ Inventory Error</h4>
                <p>${message}</p>
                <button class="btn" onclick="app.loadInventory()">Reload Inventory</button>
            </div>
        `;
    }

    setupEventListeners() {
        // Filter controls
        const locationFilter = this.container?.querySelector('#location-filter');
        const typeFilter = this.container?.querySelector('#type-filter');
        const regionFilter = this.container?.querySelector('#region-filter');
        const availableFilter = this.container?.querySelector('#available-only');

        if (locationFilter) {
            locationFilter.addEventListener('change', () => {
                this.filters.location = locationFilter.value || undefined;
                this.loadInventory();
            });
        }

        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.filters.wine_type = typeFilter.value || undefined;
                this.loadInventory();
            });
        }

        if (regionFilter) {
            regionFilter.addEventListener('input', this.app.debounce(() => {
                this.filters.region = regionFilter.value || undefined;
                this.loadInventory();
            }, 300));
        }

        if (availableFilter) {
            availableFilter.addEventListener('change', () => {
                this.filters.available_only = availableFilter.checked;
                this.loadInventory();
            });
        }
    }

    async refresh() {
        await this.loadInventory();
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

    parseGrapeVarieties(grapeVarieties) {
        if (!grapeVarieties) return [];

        if (Array.isArray(grapeVarieties)) return grapeVarieties;

        if (typeof grapeVarieties === 'string') {
            try {
                return JSON.parse(grapeVarieties);
            } catch {
                return grapeVarieties.split(',').map(g => g.trim());
            }
        }

        return [];
    }

    formatCurrency(value) {
        if (!value || isNaN(value)) return '—';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }
}
