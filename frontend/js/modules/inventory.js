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
        this.isLoading = false;
        this.hasMore = false;
        
        // Pagination UI elements
        this.paginationContainer = null;
        this.loadMoreBtn = null;
        this.itemsCounter = null;
        this.paginationError = null;
        this.retryBtn = null;
    }

    async init() {
        this.container = document.getElementById('inventory-view');
        if (this.container) {
            // Get pagination UI elements
            this.paginationContainer = document.getElementById('inventory-pagination');
            this.loadMoreBtn = document.getElementById('load-more-inventory');
            this.itemsCounter = document.getElementById('inventory-items-counter');
            this.paginationError = document.getElementById('pagination-error');
            this.retryBtn = document.getElementById('pagination-retry-btn');
            
            await this.loadInventory();
            this.setupEventListeners();
        }
    }

    async loadInventory() {
        try {
            this.isLoading = true;
            this.hidePaginationError();
            
            const result = await this.app.api.getInventory({
                location: this.filters.location,
                wine_type: this.filters.wine_type,
                region: this.filters.region,
                available_only: this.filters.available_only,
                limit: this.pagination.limit,
                offset: 0 // Always reset to offset 0 for initial load
            });

            if (result.success && result.data) {
                this.currentInventory = result.data;
                this.pagination.total = result.meta?.total || 0;
                this.pagination.page = 1;
                this.hasMore = this.currentInventory.length < this.pagination.total;
                
                this.displayInventory();
                this.updatePaginationUI();
            } else {
                throw new Error('Failed to load inventory');
            }
        } catch (error) {
            console.error('Failed to load inventory:', error);
            this.displayError('Failed to load inventory');
        } finally {
            this.isLoading = false;
        }
    }

    displayInventory(append = false) {
        if (!this.container) return;

        const grid = this.container.querySelector('.inventory-grid');
        if (!grid) return;

        const isGuest = this.app.isGuestUser();
        const wineCards = this.currentInventory.map((item, index) =>
            this.createInventoryWineCard(item, index, isGuest)
        ).join('');

        if (append) {
            // Append new cards to existing ones
            grid.insertAdjacentHTML('beforeend', wineCards);
        } else {
            // Replace all cards (initial load or filter change)
            grid.innerHTML = wineCards;
        }
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
        
        // Pagination controls
        if (this.loadMoreBtn) {
            this.loadMoreBtn.addEventListener('click', () => this.loadMoreInventory());
        }
        
        if (this.retryBtn) {
            this.retryBtn.addEventListener('click', () => this.loadMoreInventory());
        }
    }

    async refresh() {
        await this.loadInventory();
    }
    
    async loadMoreInventory() {
        if (this.isLoading || !this.hasMore) return;
        
        try {
            this.isLoading = true;
            this.showLoadingState();
            this.hidePaginationError();
            
            const currentOffset = this.currentInventory.length;
            
            const result = await this.app.api.getInventory({
                location: this.filters.location,
                wine_type: this.filters.wine_type,
                region: this.filters.region,
                available_only: this.filters.available_only,
                limit: this.pagination.limit,
                offset: currentOffset
            });
            
            if (result.success && result.data) {
                // Append new items to existing inventory
                const newItems = result.data;
                this.currentInventory = [...this.currentInventory, ...newItems];
                this.pagination.total = result.meta?.total || 0;
                this.pagination.page++;
                this.hasMore = this.currentInventory.length < this.pagination.total;
                
                // Display appended items
                this.displayInventory(true);
                this.updatePaginationUI();
            } else {
                throw new Error('Failed to load more inventory items');
            }
        } catch (error) {
            console.error('Failed to load more inventory:', error);
            this.showPaginationError('Failed to load more items. Please try again.');
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }
    
    updatePaginationUI() {
        if (!this.paginationContainer) return;
        
        // Show pagination container
        this.paginationContainer.style.display = 'flex';
        
        // Update items counter
        const loadedEl = document.getElementById('items-loaded');
        const totalEl = document.getElementById('items-total');
        if (loadedEl && totalEl) {
            loadedEl.textContent = this.currentInventory.length;
            totalEl.textContent = this.pagination.total;
        }
        
        // Show/hide Load More button
        if (this.loadMoreBtn) {
            if (this.hasMore) {
                this.loadMoreBtn.style.display = 'inline-flex';
            } else {
                this.loadMoreBtn.style.display = 'none';
            }
        }
    }
    
    showLoadingState() {
        if (!this.loadMoreBtn) return;
        
        const textEl = this.loadMoreBtn.querySelector('.load-more-text');
        const spinnerEl = this.loadMoreBtn.querySelector('.spinner');
        
        this.loadMoreBtn.classList.add('loading');
        this.loadMoreBtn.disabled = true;
        
        if (textEl) textEl.textContent = 'Loading...';
        if (spinnerEl) spinnerEl.style.display = 'inline-block';
    }
    
    hideLoadingState() {
        if (!this.loadMoreBtn) return;
        
        const textEl = this.loadMoreBtn.querySelector('.load-more-text');
        const spinnerEl = this.loadMoreBtn.querySelector('.spinner');
        
        this.loadMoreBtn.classList.remove('loading');
        this.loadMoreBtn.disabled = false;
        
        if (textEl) textEl.textContent = 'Load More';
        if (spinnerEl) spinnerEl.style.display = 'none';
    }
    
    showPaginationError(message) {
        if (!this.paginationError) return;
        
        const messageEl = document.getElementById('pagination-error-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
        
        this.paginationError.style.display = 'flex';
        if (this.loadMoreBtn) {
            this.loadMoreBtn.style.display = 'none';
        }
    }
    
    hidePaginationError() {
        if (this.paginationError) {
            this.paginationError.style.display = 'none';
        }
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
