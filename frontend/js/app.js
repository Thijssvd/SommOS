// SommOS Main Application JavaScript
// Handles app initialization, navigation, and core functionality

class SommOS {
    constructor() {
        this.currentView = 'dashboard';
        this.api = new SommOSAPI();
        this.ui = new SommOSUI();
        this.isOnline = navigator.onLine;
        this.init();
    }

    async init() {
        console.log('🍷 Initializing SommOS...');
        
        // Show loading screen
        this.showLoadingScreen();
        
        // Initialize components
        await this.initializeApp();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadInitialData();
        
        // Hide loading screen and show app
        this.hideLoadingScreen();
        
        console.log('✅ SommOS initialized successfully');
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        loadingScreen.style.display = 'flex';
        app.classList.add('hidden');
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            app.classList.remove('hidden');
        }, 1500); // Allow loading animation to complete
    }

    async initializeApp() {
        // Initialize offline storage
        if ('indexedDB' in window) {
            await this.initializeOfflineStorage();
        }
        
        // Check API connectivity
        try {
            await this.api.healthCheck();
            console.log('✅ API connection established');
        } catch (error) {
            console.warn('⚠️ API unavailable, running in offline mode');
            this.ui.showToast('Running in offline mode', 'warning');
        }
    }

    async initializeOfflineStorage() {
        // Initialize IndexedDB for offline storage
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SommOSDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('wines')) {
                    db.createObjectStore('wines', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('inventory')) {
                    db.createObjectStore('inventory', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('pairings')) {
                    db.createObjectStore('pairings', { keyPath: 'id' });
                }
            };
        });
    }

    setupDishBuilder() {
        const builderContainer = document.querySelector('.dish-builder');
        if (!builderContainer) {
            return;
        }

        this.dishBuilderState = {
            ingredient: '',
            technique: '',
            cuisine: '',
            accompaniments: '',
            intensity: '',
            flavors: new Set()
        };

        this.dishBuilderElements = {
            ingredientInput: document.getElementById('dish-main-ingredient'),
            techniqueSelect: document.getElementById('dish-cooking-technique'),
            cuisineSelect: document.getElementById('dish-cuisine-style'),
            accompanimentsInput: document.getElementById('dish-accompaniments'),
            intensitySelect: document.getElementById('dish-intensity'),
            flavorButtons: Array.from(document.querySelectorAll('.flavor-tag')),
            preview: document.getElementById('dish-builder-preview'),
            applyBtn: document.getElementById('apply-dish-builder'),
            clearBtn: document.getElementById('clear-dish-builder')
        };

        const updateState = () => this.updateDishBuilderPreview();

        if (this.dishBuilderElements.ingredientInput) {
            this.dishBuilderElements.ingredientInput.addEventListener('input', (event) => {
                this.dishBuilderState.ingredient = event.target.value.trim();
                updateState();
            });
        }

        if (this.dishBuilderElements.techniqueSelect) {
            this.dishBuilderElements.techniqueSelect.addEventListener('change', (event) => {
                this.dishBuilderState.technique = event.target.value;
                updateState();
            });
        }

        if (this.dishBuilderElements.cuisineSelect) {
            this.dishBuilderElements.cuisineSelect.addEventListener('change', (event) => {
                this.dishBuilderState.cuisine = event.target.value;
                updateState();
            });
        }

        if (this.dishBuilderElements.accompanimentsInput) {
            this.dishBuilderElements.accompanimentsInput.addEventListener('input', (event) => {
                this.dishBuilderState.accompaniments = event.target.value.trim();
                updateState();
            });
        }

        if (this.dishBuilderElements.intensitySelect) {
            this.dishBuilderElements.intensitySelect.addEventListener('change', (event) => {
                this.dishBuilderState.intensity = event.target.value;
                updateState();
            });
        }

        if (this.dishBuilderElements.flavorButtons.length > 0) {
            this.dishBuilderElements.flavorButtons.forEach((button) => {
                button.setAttribute('aria-pressed', 'false');
                button.addEventListener('click', () => {
                    const flavor = button.dataset.flavor;
                    if (!flavor) {
                        return;
                    }

                    if (this.dishBuilderState.flavors.has(flavor)) {
                        this.dishBuilderState.flavors.delete(flavor);
                        button.classList.remove('selected');
                        button.setAttribute('aria-pressed', 'false');
                    } else {
                        this.dishBuilderState.flavors.add(flavor);
                        button.classList.add('selected');
                        button.setAttribute('aria-pressed', 'true');
                    }

                    updateState();
                });
            });
        }

        if (this.dishBuilderElements.applyBtn) {
            this.dishBuilderElements.applyBtn.addEventListener('click', () => this.applyDishBuilderDescription());
        }

        if (this.dishBuilderElements.clearBtn) {
            this.dishBuilderElements.clearBtn.addEventListener('click', () => this.resetDishBuilder());
        }

        this.updateDishBuilderPreview();
    }

    buildDishDescription() {
        if (!this.dishBuilderState) {
            return '';
        }

        const { ingredient, technique, cuisine, accompaniments, intensity, flavors } = this.dishBuilderState;
        const descriptionParts = [];

        const mainDish = [technique, ingredient].filter(Boolean).join(' ').trim();
        if (mainDish) {
            descriptionParts.push(mainDish);
        }

        if (cuisine) {
            descriptionParts.push(`${cuisine} cuisine`);
        }

        if (accompaniments) {
            descriptionParts.push(`served with ${accompaniments}`);
        }

        if (intensity) {
            descriptionParts.push(`${intensity} intensity`);
        }

        if (flavors && flavors.size > 0) {
            const flavorList = Array.from(flavors);
            if (flavorList.length === 1) {
                descriptionParts.push(`highlighting ${flavorList[0]} notes`);
            } else {
                const lastFlavor = flavorList.pop();
                descriptionParts.push(`highlighting ${flavorList.join(', ')} and ${lastFlavor} notes`);
            }
        }

        if (descriptionParts.length === 0) {
            return '';
        }

        let description = descriptionParts.join(', ');
        description = description.charAt(0).toUpperCase() + description.slice(1);

        if (!description.endsWith('.')) {
            description += '.';
        }

        return description;
    }

    updateDishBuilderPreview() {
        if (!this.dishBuilderElements || !this.dishBuilderElements.preview) {
            return;
        }

        const description = this.buildDishDescription();
        this.dishBuilderElements.preview.textContent = description || 'Select details to see a suggested description.';
    }

    applyDishBuilderDescription() {
        const dishInput = document.getElementById('dish-input');
        const description = this.buildDishDescription();

        if (!dishInput) {
            return;
        }

        if (!description) {
            this.ui.showToast('Add a few dish details before using the builder.', 'warning');
            return;
        }

        const existingText = dishInput.value.trim();
        if (existingText && !existingText.includes(description)) {
            dishInput.value = `${description}\n${existingText}`;
        } else {
            dishInput.value = description;
        }

        dishInput.focus();
        dishInput.setSelectionRange(dishInput.value.length, dishInput.value.length);
        this.ui.showToast('Dish description updated with your selections.', 'success');
    }

    resetDishBuilder() {
        if (!this.dishBuilderElements || !this.dishBuilderState) {
            return;
        }

        this.dishBuilderState = {
            ingredient: '',
            technique: '',
            cuisine: '',
            accompaniments: '',
            intensity: '',
            flavors: new Set()
        };

        const {
            ingredientInput,
            techniqueSelect,
            cuisineSelect,
            accompanimentsInput,
            intensitySelect,
            flavorButtons
        } = this.dishBuilderElements;

        if (ingredientInput) ingredientInput.value = '';
        if (techniqueSelect) techniqueSelect.value = '';
        if (cuisineSelect) cuisineSelect.value = '';
        if (accompanimentsInput) accompanimentsInput.value = '';
        if (intensitySelect) intensitySelect.value = '';

        if (flavorButtons && flavorButtons.length) {
            flavorButtons.forEach((button) => {
                button.classList.remove('selected');
                button.setAttribute('aria-pressed', 'false');
            });
        }

        this.updateDishBuilderPreview();
        this.ui.showToast('Dish builder cleared.', 'info');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.navigateToView(view);
            });
        });

        // Quick actions
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Pairing form
        const getPairingsBtn = document.getElementById('get-pairings-btn');
        if (getPairingsBtn) {
            getPairingsBtn.addEventListener('click', () => this.handlePairingRequest());
        }

        // Inventory controls
        const refreshInventoryBtn = document.getElementById('refresh-inventory');
        if (refreshInventoryBtn) {
            refreshInventoryBtn.addEventListener('click', () => this.loadInventory());
        }
        
        // Search functionality
        const inventorySearch = document.getElementById('inventory-search');
        if (inventorySearch) {
            inventorySearch.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
        
        // Filter functionality
        const locationFilter = document.getElementById('location-filter');
        const typeFilter = document.getElementById('type-filter');
        
        if (locationFilter) {
            locationFilter.addEventListener('change', () => this.applyFilters());
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', () => this.applyFilters());
        }

        // Sync button
        const syncBtn = document.getElementById('sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncData());
        }

        // Online/offline detection
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.ui.showToast('Connection restored', 'success');
            this.syncData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.ui.showToast('Working offline', 'warning');
        });

        this.setupDishBuilder();
    }

    navigateToView(viewName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}-view`).classList.add('active');

        this.currentView = viewName;

        // Load view-specific data
        this.loadViewData(viewName);
    }

    async loadViewData(viewName) {
        switch (viewName) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'inventory':
                await this.loadInventory();
                break;
            case 'pairing':
                // Pairing view is form-based, no initial data needed
                break;
            case 'procurement':
                await this.loadProcurementData();
                break;
            case 'catalog':
                await this.loadWineCatalog();
                break;
        }
    }

    async loadInitialData() {
        await this.loadDashboardData();
    }

    async loadDashboardData() {
        try {
            // Add loading state to dashboard cards
            this.addLoadingToStats();
            
            const stats = await this.api.getSystemHealth();
            
            if (stats.success && stats.data) {
                document.getElementById('total-bottles').textContent = 
                    stats.data.total_bottles?.toLocaleString() || '0';
                document.getElementById('total-wines').textContent = 
                    stats.data.total_wines?.toLocaleString() || '0';
                document.getElementById('total-vintages').textContent = 
                    stats.data.total_vintages?.toLocaleString() || '0';
                document.getElementById('active-suppliers').textContent = 
                    stats.data.active_suppliers?.toLocaleString() || '0';
                    
                // Load recent activity
                await this.loadRecentActivity();
                
                // Load charts
                await this.loadDashboardCharts();
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.ui.showToast('Failed to load dashboard data', 'error');
            this.showEmptyStats();
        }
    }
    
    addLoadingToStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(el => {
            el.innerHTML = '<div class="loading-spinner"></div>';
        });
    }
    
    showEmptyStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(el => {
            el.textContent = '-';
        });
    }
    
    async loadRecentActivity() {
        try {
            const activityContainer = document.getElementById('recent-activity');
            activityContainer.innerHTML = `
                <div class="activity-placeholder">
                    <div class="loading-spinner"></div>
                    <p>Loading recent activity...</p>
                </div>
            `;
            
            // Try to load actual recent activity from API
            try {
                const activity = await this.api.getRecentActivity();
                if (activity.success && activity.data && activity.data.length > 0) {
                    this.displayRecentActivity(activity.data);
                } else {
                    this.displayDefaultActivity();
                }
            } catch (error) {
                console.warn('Could not load recent activity from API, showing default');
                this.displayDefaultActivity();
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
            this.displayDefaultActivity();
        }
    }
    
    displayRecentActivity(activities) {
        const activityContainer = document.getElementById('recent-activity');
        if (!activities || activities.length === 0) {
            this.displayDefaultActivity();
            return;
        }
        
        activityContainer.innerHTML = activities.map(activity => {
            const timeAgo = this.getTimeAgo(activity.timestamp || activity.created_at);
            const activityIcon = this.getActivityIcon(activity.type);
            
            return `
                <div class="activity-item fade-in">
                    <div class="activity-icon">${activityIcon}</div>
                    <div class="activity-content">
                        <div class="activity-title">${activity.title || activity.description}</div>
                        <div class="activity-details">${activity.details || ''}</div>
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    displayDefaultActivity() {
        const activityContainer = document.getElementById('recent-activity');
        const currentDate = new Date();
        const activities = [
            {
                icon: '🍷',
                title: 'SommOS System Initialized',
                details: 'Wine management system ready for use',
                time: 'Just now'
            },
            {
                icon: '📊',
                title: 'Dashboard Loaded',
                details: 'System statistics and inventory overview',
                time: 'Just now'
            },
            {
                icon: '🔄',
                title: 'Inventory Synchronized',
                details: 'Wine collection data updated',
                time: 'Just now'
            }
        ];
        
        activityContainer.innerHTML = activities.map((activity, index) => `
            <div class="activity-item fade-in" style="animation-delay: ${index * 0.1}s">
                <div class="activity-icon">${activity.icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-details">${activity.details}</div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            </div>
        `).join('');
    }
    
    getActivityIcon(activityType) {
        const icons = {
            'consumption': '🥂',
            'pairing': '🍽️',
            'inventory_update': '📦',
            'reservation': '🍷',
            'procurement': '🛒',
            'system': '⚙️',
            'sync': '🔄',
            'default': '📋'
        };
        return icons[activityType] || icons.default;
    }
    
    getTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown time';
        
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        
        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }

    async loadInventory() {
        try {
            console.log('Loading inventory...');
            const grid = document.getElementById('inventory-grid');
            grid.innerHTML = '<div class="inventory-placeholder"><p>Loading wine collection...</p></div>';
            
            const inventory = await this.api.getInventory({ available_only: false });
            console.log('Inventory loaded:', inventory);
            console.log('Number of wines:', inventory?.data?.length || 0);
            
            if (inventory && inventory.success) {
                this.displayInventory(inventory.data || []);
            } else {
                throw new Error('Invalid inventory response');
            }
        } catch (error) {
            console.error('Failed to load inventory:', error);
            this.ui.showToast('Failed to load inventory', 'error');
            const grid = document.getElementById('inventory-grid');
            grid.innerHTML = '<div class="inventory-placeholder"><p>Failed to load inventory. Please refresh and try again.</p></div>';
        }
    }

    displayInventory(inventory) {
        console.log('Displaying inventory:', inventory);
        const grid = document.getElementById('inventory-grid');
        
        if (!grid) {
            console.error('Inventory grid element not found!');
            return;
        }
        
        // Store full inventory for search
        this.fullInventory = inventory || [];
        
        // Update wine count in header
        this.updateInventoryCount(inventory ? inventory.length : 0);
        
        if (!inventory || inventory.length === 0) {
            console.log('No inventory to display');
            grid.innerHTML = '<div class="inventory-placeholder"><p>No inventory items found</p></div>';
            return;
        }
        
        console.log(`Rendering ${inventory.length} wine cards...`);
        
        try {
            // Show all wines now that we know it works
            grid.innerHTML = inventory.map((item, index) => {
                // Improve region display
                const displayRegion = this.getDisplayRegion(item);
                const displayCountry = item.country && item.country !== 'Unknown' ? item.country : '';
                
                return `
                    <div class="wine-card simple-card fade-in" style="animation-delay: ${Math.min(index * 0.02, 2)}s">
                        <div class="wine-header">
                            <div class="wine-type-badge ${item.wine_type?.toLowerCase() || 'unknown'}">
                                ${this.getWineTypeIcon(item.wine_type)} ${item.wine_type || 'Wine'}
                            </div>
                            <div class="price">${item.cost_per_bottle ? '$' + parseFloat(item.cost_per_bottle).toFixed(2) : ''}</div>
                        </div>
                        <h3>${item.name || 'Unknown Wine'}</h3>
                        <p><strong>Producer:</strong> ${item.producer || 'Unknown'}</p>
                        <p><strong>Year:</strong> ${item.year || 'N/A'} ${displayCountry ? '| ' + displayCountry : ''}</p>
                        <p><strong>Region:</strong> ${displayRegion}</p>
                        <div class="stock-display">
                            <span class="quantity">${item.quantity || 0} bottles</span>
                            <span class="location">📍 ${item.location || 'Unknown'}</span>
                        </div>
                        <div class="card-actions-simple">
                            <button class="btn-small secondary" onclick="app.showWineDetailModal('${item.vintage_id || item.id}')">
                                📝 Details
                            </button>
                            <button class="btn-small primary" onclick="app.reserveWineModal('${item.vintage_id || item.id}', '${(item.name || "Unknown").replace(/'/g, "\\'") }')">
                                🍷 Reserve
                            </button>
                            ${(item.quantity || 0) > 0 ? `
                                <button class="btn-small" onclick="app.consumeWineModal('${item.vintage_id || item.id}', '${(item.name || "Unknown").replace(/'/g, "\\'") }')">
                                    🥂 Serve
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            console.log('Wine cards rendered successfully');
            
        } catch (error) {
            console.error('Error rendering inventory:', error);
            grid.innerHTML = '<div class="inventory-placeholder"><p>Error displaying wines</p></div>';
        }
    }
    
    getDisplayRegion(item) {
        const placeholderRegions = ['various', 'unknown', 'multiple', 'n/a', ''];
        const region = (item.region || '').trim();
        const normalizedRegion = region.toLowerCase();

        if (region && !placeholderRegions.includes(normalizedRegion)) {
            return region;
        }

        // Try to extract better region info from wine name or producer
        const name = (item.name || '').toLowerCase();
        const producer = (item.producer || '').toLowerCase();

        if (name.includes('bordeaux') || producer.includes('château')) return 'Bordeaux';
        if (name.includes('burgundy') || name.includes('bourgogne')) return 'Burgundy';
        if (name.includes('champagne')) return 'Champagne';
        if (name.includes('chianti')) return 'Chianti';
        if (name.includes('rioja')) return 'Rioja';
        if (name.includes('barolo') || name.includes('barbaresco')) return 'Piedmont';
        if (name.includes('amarone') || name.includes('valpolicella')) return 'Veneto';
        if (name.includes('napa')) return 'Napa Valley';
        if (name.includes('sonoma')) return 'Sonoma';
        if (name.includes('rhône') || name.includes('rhone')) return 'Rhône Valley';
        if (name.includes('loire')) return 'Loire Valley';
        if (name.includes('alsace')) return 'Alsace';
        if (name.includes('mosel') || name.includes('riesling')) return 'Mosel';

        // Fall back to original region or country
        return region || item.country || 'Unknown Region';
    }
    
    
    parseGrapeVarieties(grapeVarieties) {
        try {
            if (typeof grapeVarieties === 'string' && grapeVarieties.trim()) {
                const parsed = JSON.parse(grapeVarieties);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {
            // If it's not JSON, try to split by common delimiters
            if (typeof grapeVarieties === 'string') {
                return grapeVarieties.split(/[,;|&]/).map(g => g.trim()).filter(g => g);
            }
        }
        return [];
    }
    
    parseFoodPairings(foodPairings) {
        try {
            if (typeof foodPairings === 'string' && foodPairings.trim()) {
                const parsed = JSON.parse(foodPairings);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {
            if (typeof foodPairings === 'string') {
                return foodPairings.split(/[,;|&]/).map(p => p.trim()).filter(p => p);
            }
        }
        return [];
    }
    
    generateWineSummary(wine) {
        const type = wine.wine_type || 'wine';
        const region = wine.region || 'unknown region';
        const year = wine.year || 'unknown vintage';
        const producer = wine.producer || 'Unknown producer';
        
        const summaries = [
            `A distinguished ${type.toLowerCase()} from ${region}, this ${year} vintage showcases ${producer}'s craftsmanship.`,
            `This elegant ${type.toLowerCase()} from ${region} represents the ${year} vintage with exceptional character.`,
            `${producer} has created a remarkable ${type.toLowerCase()} from ${region} in this ${year} vintage.`,
            `Experience the terroir of ${region} in this ${year} ${type.toLowerCase()} from ${producer}.`,
            `A premium ${type.toLowerCase()} selection from ${region}, vintage ${year}, crafted by ${producer}.`
        ];
        
        return summaries[Math.floor(Math.abs(wine.name?.length || 0) % summaries.length)];
    }
    
    getWineTypeIcon(wineType) {
        const icons = {
            'Red': '🍷',
            'White': '🥂',
            'Rosé': '🌹',
            'Sparkling': '🍾',
            'Dessert': '🍯',
            'Fortified': '🥃'
        };
        return icons[wineType] || '🍷';
    }
    
    // Action methods for wine cards
    reserveWineModal(vintageId, wineName) {
        this.ui.showModal(`Reserve Wine - ${wineName}`, `
            <form id="reserve-wine-form">
                <div class="form-group">
                    <label for="reserve-location">Location</label>
                    <select id="reserve-location" required>
                        <option value="">Select location...</option>
                        <option value="main-cellar">Main Cellar</option>
                        <option value="service-bar">Service Bar</option>
                        <option value="deck-storage">Deck Storage</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="reserve-quantity">Quantity</label>
                    <input type="number" id="reserve-quantity" min="1" value="1" required>
                </div>
                <div class="form-group">
                    <label for="reserve-notes">Notes (Optional)</label>
                    <textarea id="reserve-notes" rows="2" placeholder="Occasion, guest preferences, etc."></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn secondary" onclick="app.ui.hideModal()">Cancel</button>
                    <button type="submit" class="btn primary">Reserve Wine</button>
                </div>
            </form>
        `);
        
        document.getElementById('reserve-wine-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const location = document.getElementById('reserve-location').value;
            const quantity = parseInt(document.getElementById('reserve-quantity').value);
            const notes = document.getElementById('reserve-notes').value;
            
            try {
                await this.api.reserveWine(vintageId, location, quantity, notes);
                this.ui.showToast(`Reserved ${quantity} bottle(s) of ${wineName}`, 'success');
                this.ui.hideModal();
                this.loadInventory(); // Refresh inventory
            } catch (error) {
                this.ui.showToast('Failed to reserve wine', 'error');
            }
        });
    }
    
    consumeWineModal(vintageId, wineName) {
        this.ui.showModal(`Serve Wine - ${wineName}`, `
            <form id="consume-wine-form">
                <div class="form-group">
                    <label for="consume-location">Location</label>
                    <select id="consume-location" required>
                        <option value="">Select location...</option>
                        <option value="main-cellar">Main Cellar</option>
                        <option value="service-bar">Service Bar</option>
                        <option value="deck-storage">Deck Storage</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="consume-quantity">Quantity</label>
                    <input type="number" id="consume-quantity" min="1" value="1" required>
                </div>
                <div class="form-group">
                    <label for="consume-notes">Service Notes</label>
                    <textarea id="consume-notes" rows="2" placeholder="Guest names, occasion, feedback, etc."></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn secondary" onclick="app.ui.hideModal()">Cancel</button>
                    <button type="submit" class="btn primary">Record Service</button>
                </div>
            </form>
        `);
        
        document.getElementById('consume-wine-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const location = document.getElementById('consume-location').value;
            const quantity = parseInt(document.getElementById('consume-quantity').value);
            const notes = document.getElementById('consume-notes').value;
            
            try {
                await this.api.consumeWine(vintageId, location, quantity, notes, 'Sommelier');
                this.ui.showToast(`Served ${quantity} bottle(s) of ${wineName}`, 'success');
                this.ui.hideModal();
                this.loadInventory(); // Refresh inventory
            } catch (error) {
                this.ui.showToast('Failed to record wine service', 'error');
            }
        });
    }
    
    viewWineDetails(vintageId) {
        // For now, show a placeholder. In a full implementation, this would show detailed wine information
        this.ui.showToast('Wine details view coming soon!', 'info');
    }
    
    updateInventoryCount(count) {
        const subtitle = document.querySelector('#inventory-view .view-subtitle');
        if (subtitle) {
            const total = this.fullInventory ? this.fullInventory.length : count;
            if (count === total) {
                subtitle.textContent = `Displaying all ${count} wine${count !== 1 ? 's' : ''} from your cellar collection`;
            } else {
                subtitle.textContent = `Displaying ${count} of ${total} wine${total !== 1 ? 's' : ''} (filtered)`;
            }
        }
    }
    
    handleSearch(query) {
        if (!this.fullInventory) return;
        
        const searchTerm = query.toLowerCase().trim();
        
        if (!searchTerm) {
            // Show all wines if search is empty
            this.displayInventory(this.fullInventory);
            return;
        }
        
        const filteredWines = this.fullInventory.filter(wine => {
            const searchableText = [
                wine.name || '',
                wine.producer || '',
                wine.wine_type || '',
                wine.region || '',
                wine.country || '',
                wine.year ? wine.year.toString() : '',
                wine.location || ''
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
        
        this.displayInventory(filteredWines);
    }
    
    applyFilters() {
        if (!this.fullInventory) return;
        
        const locationFilter = document.getElementById('location-filter')?.value || '';
        const typeFilter = document.getElementById('type-filter')?.value || '';
        const searchTerm = document.getElementById('inventory-search')?.value.toLowerCase().trim() || '';
        
        let filteredWines = this.fullInventory;
        
        // Apply location filter
        if (locationFilter) {
            filteredWines = filteredWines.filter(wine => wine.location === locationFilter);
        }
        
        // Apply type filter
        if (typeFilter) {
            filteredWines = filteredWines.filter(wine => wine.wine_type === typeFilter);
        }
        
        // Apply search filter
        if (searchTerm) {
            filteredWines = filteredWines.filter(wine => {
                const searchableText = [
                    wine.name || '',
                    wine.producer || '',
                    wine.wine_type || '',
                    wine.region || '',
                    wine.country || '',
                    wine.year ? wine.year.toString() : '',
                    wine.location || ''
                ].join(' ').toLowerCase();
                
                return searchableText.includes(searchTerm);
            });
        }
        
        this.displayInventory(filteredWines);
    }

    async handlePairingRequest() {
        const dishInput = document.getElementById('dish-input');
        const occasionSelect = document.getElementById('occasion-select');
        const guestCountInput = document.getElementById('guest-count');
        const preferencesInput = document.getElementById('preferences-input');

        const dish = dishInput.value.trim();
        if (!dish) {
            this.ui.showToast('Please describe the dish', 'error');
            return;
        }

        const context = {
            occasion: occasionSelect.value,
            guestCount: parseInt(guestCountInput.value) || 4
        };

        const guestPreferences = preferencesInput.value.trim();

        try {
            console.log('🍷 Starting pairing request...', { dish, context, guestPreferences });
            this.ui.showLoading('get-pairings-btn', 'Analyzing wine pairings...');
            this.ui.showToast('Analyzing wine pairings with AI...', 'info');
            
            const response = await this.api.getPairings(dish, context, guestPreferences);
            
            console.log('🍷 Pairing response received:', response);
            
            if (response && response.success && response.data) {
                if (response.data.length > 0) {
                    this.ui.showToast(`Found ${response.data.length} wine recommendations!`, 'success');
                    this.displayPairings(response.data);
                } else {
                    this.ui.showToast('No wine pairings found. Try a different dish description.', 'warning');
                    this.displayPairings([]);
                }
            } else {
                throw new Error(response?.error || 'Invalid response from server');
            }
        } catch (error) {
            console.error('Pairing request failed:', error);
            this.ui.showToast(`Failed to get wine recommendations: ${error.message}`, 'error');
            
            // Still try to show empty results container
            const resultsDiv = document.getElementById('pairing-results');
            const listDiv = document.getElementById('pairing-list');
            if (resultsDiv && listDiv) {
                listDiv.innerHTML = `
                    <div class="no-pairings error">
                        <h4>❌ Error Getting Recommendations</h4>
                        <p>Error: ${error.message}</p>
                        <p>Please try again or contact support.</p>
                    </div>
                `;
                resultsDiv.classList.remove('hidden');
            }
        } finally {
            this.ui.hideLoading('get-pairings-btn');
        }
    }

    displayPairings(pairings) {
        console.log('Displaying pairings:', pairings);
        const resultsDiv = document.getElementById('pairing-results');
        const listDiv = document.getElementById('pairing-list');

        if (!pairings || pairings.length === 0) {
            listDiv.innerHTML = `
                <div class="no-pairings">
                    <h4>🍷 No pairings found</h4>
                    <p>Try a different dish or check your wine inventory.</p>
                </div>
            `;
            resultsDiv.classList.remove('hidden');
            return;
        }

        listDiv.innerHTML = pairings.map((pairing, index) => {
            const wine = pairing.wine || pairing;
            const score = pairing.score || {};
            const reasoning = pairing.reasoning || 'Great wine pairing recommendation!';
            
            return `
                <div class="pairing-card fade-in" style="animation-delay: ${index * 0.1}s">
                    <div class="wine-header-pairing">
                        <div class="wine-type-badge ${wine.wine_type?.toLowerCase() || 'unknown'}">
                            ${this.getWineTypeIcon(wine.wine_type)} ${wine.wine_type || 'Wine'}
                        </div>
                        <div class="confidence-score">
                            ${score.total ? Math.round(score.total * 100) : (score.confidence ? Math.round(score.confidence * 100) : '90')}%
                        </div>
                    </div>
                    
                    <div class="wine-details">
                        <h4>${wine.name || 'Wine Recommendation'}</h4>
                        <p class="vintage">${wine.producer || 'Producer'} • ${wine.year || 'Vintage'}</p>
                        <p class="region">${this.getDisplayRegion(wine)}</p>
                    </div>
                    
                    <div class="pairing-reasoning">
                        <h5>🎯 Why this pairing works:</h5>
                        <p>${reasoning}</p>
                    </div>
                    
                    <div class="stock-status">
                        ${wine.quantity > 0 ? 
                            `<span class="in-stock">✅ ${wine.quantity} bottles available at ${wine.location || 'cellar'}</span>` :
                            '<span class="out-of-stock">❌ Currently not in stock</span>'
                        }
                    </div>
                    
                    ${wine.quantity > 0 ? `
                        <div class="pairing-actions">
                            <button class="btn-small primary" onclick="app.reserveWineModal('${wine.vintage_id || wine.id}', '${(wine.name || "Wine").replace(/'/g, "\\'") }')">Reserve for Pairing</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        resultsDiv.classList.remove('hidden');

        // Scroll to results when supported
        if (typeof resultsDiv.scrollIntoView === 'function') {
            resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    handleQuickAction(action) {
        switch (action) {
            case 'quick-pairing':
                this.navigateToView('pairing');
                break;
            case 'record-consumption':
                this.showConsumptionModal();
                break;
            case 'check-stock':
                this.navigateToView('inventory');
                break;
        }
    }

    async showConsumptionModal() {
        try {
            // Get current inventory to populate wine selection
            const inventory = await this.api.getInventory({ available_only: true });
            const wines = inventory.success ? inventory.data || [] : [];
            
            const wineOptions = wines.length > 0 ? 
                wines.map(wine => `
                    <option value="${wine.vintage_id || wine.id}" data-max="${wine.quantity || 0}">
                        ${wine.name} (${wine.producer}) - ${wine.quantity || 0} bottles available
                    </option>
                `).join('') : '<option value="">No wines available</option>';
            
            this.ui.showModal('Record Wine Service', `
                <form id="consumption-form">
                    <div class="form-group">
                        <label for="wine-select">Select Wine</label>
                        <select id="wine-select" required>
                            <option value="">Choose wine to serve...</option>
                            ${wineOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="bottles-consumed">Bottles Consumed</label>
                        <input type="number" id="bottles-consumed" min="1" max="1" required>
                        <small class="form-help">Maximum bottles available will be shown based on selection</small>
                    </div>
                    <div class="form-group">
                        <label for="service-occasion">Occasion</label>
                        <select id="service-occasion">
                            <option value="">Select occasion...</option>
                            <option value="dinner">Dinner Service</option>
                            <option value="reception">Reception</option>
                            <option value="celebration">Celebration</option>
                            <option value="tasting">Wine Tasting</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="guest-count">Number of Guests</label>
                        <input type="number" id="guest-count" min="1" placeholder="Optional">
                    </div>
                    <div class="form-group">
                        <label for="service-notes">Service Notes</label>
                        <textarea id="service-notes" rows="3" placeholder="Food pairings, guest feedback, occasion details..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn secondary" onclick="app.ui.hideModal()">Cancel</button>
                        <button type="submit" class="btn primary">Record Service</button>
                    </div>
                </form>
            `);
            
            // Add dynamic max quantity update
            const wineSelect = document.getElementById('wine-select');
            const quantityInput = document.getElementById('bottles-consumed');
            
            wineSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.selectedOptions[0];
                const maxQuantity = selectedOption ? selectedOption.dataset.max : 1;
                quantityInput.max = maxQuantity;
                quantityInput.value = Math.min(quantityInput.value || 1, maxQuantity);
            });
            
            // Handle form submission
            document.getElementById('consumption-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleConsumptionSubmission(e);
            });
            
        } catch (error) {
            console.error('Error loading consumption modal:', error);
            this.ui.showModal('Record Wine Service', `
                <p>Error loading wine inventory. Please try again.</p>
                <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
            `);
        }
    }

    async handleConsumptionSubmission(e) {
        try {
            const formData = new FormData(e.target);
            const wineId = document.getElementById('wine-select').value;
            const quantity = parseInt(document.getElementById('bottles-consumed').value);
            const occasion = document.getElementById('service-occasion').value;
            const guestCount = document.getElementById('guest-count').value;
            const notes = document.getElementById('service-notes').value;
            
            if (!wineId || !quantity) {
                this.ui.showToast('Please select a wine and quantity', 'error');
                return;
            }
            
            // Create consumption record
            const consumptionData = {
                vintage_id: wineId,
                quantity_consumed: quantity,
                occasion: occasion || 'service',
                guest_count: guestCount ? parseInt(guestCount) : null,
                notes: notes || '',
                service_date: new Date().toISOString()
            };
            
            // Submit consumption record to backend API
            await this.api.recordConsumption(consumptionData);
            
            this.ui.showToast(`Successfully recorded service of ${quantity} bottle(s)`, 'success');
            this.ui.hideModal();
            
            // Refresh dashboard data
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Error recording consumption:', error);
            this.ui.showToast('Failed to record wine service', 'error');
        }
    }

    async showWineDetailModal(wineId) {
        try {
            // Show loading modal first
            this.ui.showModal('Wine Details', `
                <div class="wine-detail-loading">
                    <div class="loading-spinner"></div>
                    <p>Loading wine information...</p>
                </div>
            `);
            
            // Get detailed wine information
            const wineDetails = await this.api.getWineDetails(wineId);
            
            if (!wineDetails.success) {
                throw new Error('Failed to load wine details');
            }
            
            const wine = wineDetails.data;
            this.displayWineDetailModal(wine);
            
        } catch (error) {
            console.error('Error loading wine details:', error);
            this.ui.showModal('Wine Details', `
                <div class="error-content">
                    <h4>❌ Error Loading Wine Details</h4>
                    <p>Could not load detailed information for this wine.</p>
                    <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
                </div>
            `);
        }
    }

    displayWineDetailModal(wine) {
        const grapeVarieties = this.parseGrapeVarieties(wine.grape_varieties);
        const foodPairings = this.parseFoodPairings(wine.food_pairings);
        const tastingNotes = wine.tasting_notes ? wine.tasting_notes.split(',').map(note => note.trim()) : [];
        
        // Calculate wine age and drinking window
        const currentYear = new Date().getFullYear();
        const wineAge = wine.year ? currentYear - wine.year : null;
        const isVintage = wine.year && wine.year > 1900;
        
        // Generate vintage intelligence
        const vintageIntelligence = this.generateVintageIntelligence(wine, wineAge);
        
        const modalContent = `
            <div class="wine-detail-modal">
                <div class="wine-detail-header">
                    <div class="wine-main-info">
                        <div class="wine-type-badge large ${wine.wine_type?.toLowerCase() || 'unknown'}">
                            ${this.getWineTypeIcon(wine.wine_type)} ${wine.wine_type || 'Wine'}
                        </div>
                        <h2>${wine.name || 'Unknown Wine'}</h2>
                        <p class="wine-producer">${wine.producer || 'Unknown Producer'}</p>
                        <div class="wine-vintage-info">
                            ${isVintage ? `<span class="vintage">${wine.year}</span>` : ''}
                            <span class="region">${this.getDisplayRegion(wine)}</span>
                            ${wine.country ? `<span class="country">${wine.country}</span>` : ''}
                        </div>
                    </div>
                    
                    <div class="wine-stats-summary">
                        <div class="stat-item">
                            <div class="stat-value">${wine.quantity || 0}</div>
                            <div class="stat-label">Bottles</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${wine.cost_per_bottle ? '$' + parseFloat(wine.cost_per_bottle).toFixed(2) : 'N/A'}</div>
                            <div class="stat-label">Per Bottle</div>
                        </div>
                        ${wineAge ? `
                            <div class="stat-item">
                                <div class="stat-value">${wineAge}</div>
                                <div class="stat-label">Years Old</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="wine-detail-content">
                    <div class="wine-detail-section">
                        <h4>📍 Location & Stock</h4>
                        <div class="location-info">
                            <p><strong>Storage Location:</strong> ${wine.location || 'Unknown'}</p>
                            <p><strong>Available Quantity:</strong> ${wine.quantity || 0} bottles</p>
                            ${wine.reserved_quantity ? `<p><strong>Reserved:</strong> ${wine.reserved_quantity} bottles</p>` : ''}
                        </div>
                    </div>
                    
                    ${grapeVarieties.length > 0 ? `
                        <div class="wine-detail-section">
                            <h4>🍇 Grape Varieties</h4>
                            <div class="grape-varieties">
                                ${grapeVarieties.map(grape => `<span class="grape-tag">${grape}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${tastingNotes.length > 0 ? `
                        <div class="wine-detail-section">
                            <h4>👃 Tasting Notes</h4>
                            <div class="tasting-notes">
                                ${tastingNotes.map(note => `<span class="tasting-note">${note}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${foodPairings.length > 0 ? `
                        <div class="wine-detail-section">
                            <h4>🍽️ Food Pairings</h4>
                            <div class="food-pairings">
                                ${foodPairings.map(pairing => `<span class="pairing-tag">${pairing}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="wine-detail-section">
                        <h4>🧠 Vintage Intelligence</h4>
                        <div class="vintage-intelligence">
                            ${vintageIntelligence}
                        </div>
                    </div>
                    
                    ${wine.description ? `
                        <div class="wine-detail-section">
                            <h4>📖 Description</h4>
                            <p class="wine-description">${wine.description}</p>
                        </div>
                    ` : ''}
                    
                    <div class="wine-detail-section">
                        <h4>📈 Wine History</h4>
                        <div id="wine-history-${wine.vintage_id || wine.id}" class="wine-history">
                            <div class="loading-spinner"></div>
                            <p>Loading wine history...</p>
                        </div>
                    </div>
                </div>
                
                <div class="wine-detail-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
                    <button class="btn primary" onclick="app.reserveWineModal('${wine.vintage_id || wine.id}', '${(wine.name || "Unknown").replace(/'/g, "\\'") }')">Reserve Wine</button>
                    ${wine.quantity > 0 ? `
                        <button class="btn success" onclick="app.consumeWineModal('${wine.vintage_id || wine.id}', '${(wine.name || "Unknown").replace(/'/g, "\\'") }')">Serve Wine</button>
                    ` : ''}
                </div>
            </div>
        `;
        
        this.ui.showModal('Wine Details', modalContent);
        
        // Load wine history asynchronously
        this.loadWineHistory(wine.vintage_id || wine.id);
    }

    generateVintageIntelligence(wine, wineAge) {
        const intelligence = [];
        
        // Age assessment
        if (wineAge && wine.wine_type) {
            const type = wine.wine_type.toLowerCase();
            let ageAssessment = '';
            
            if (type.includes('red')) {
                if (wineAge < 3) {
                    ageAssessment = 'Young wine - may benefit from aging or decanting';
                } else if (wineAge < 10) {
                    ageAssessment = 'Mature wine - likely at optimal drinking condition';
                } else if (wineAge < 20) {
                    ageAssessment = 'Well-aged wine - complex flavors developed';
                } else {
                    ageAssessment = 'Vintage wine - rare and potentially exceptional';
                }
            } else if (type.includes('white')) {
                if (wineAge < 2) {
                    ageAssessment = 'Fresh wine - best consumed young';
                } else if (wineAge < 8) {
                    ageAssessment = 'Mature white - developed complexity';
                } else {
                    ageAssessment = 'Aged white wine - unique character';
                }
            }
            
            if (ageAssessment) {
                intelligence.push(`<p><strong>Age Assessment:</strong> ${ageAssessment}</p>`);
            }
        }
        
        // Region insights
        if (wine.region) {
            const regionInsights = this.getRegionInsights(wine.region, wine.wine_type);
            if (regionInsights) {
                intelligence.push(`<p><strong>Region Character:</strong> ${regionInsights}</p>`);
            }
        }
        
        // Value assessment
        if (wine.cost_per_bottle) {
            const cost = parseFloat(wine.cost_per_bottle);
            let valueAssessment = '';
            
            if (cost < 25) {
                valueAssessment = 'Great everyday drinking wine';
            } else if (cost < 75) {
                valueAssessment = 'Quality wine for special occasions';
            } else if (cost < 150) {
                valueAssessment = 'Premium wine - reserve for important events';
            } else {
                valueAssessment = 'Ultra-premium wine - rare and exceptional';
            }
            
            intelligence.push(`<p><strong>Value Category:</strong> ${valueAssessment}</p>`);
        }
        
        // Serving suggestions
        const servingSuggestions = this.getServingSuggestions(wine.wine_type);
        if (servingSuggestions) {
            intelligence.push(`<p><strong>Serving Suggestion:</strong> ${servingSuggestions}</p>`);
        }
        
        return intelligence.length > 0 ? intelligence.join('') : '<p>No vintage intelligence available for this wine.</p>';
    }

    getRegionInsights(region, wineType) {
        const insights = {
            'bordeaux': 'Classic French elegance with structured tannins and aging potential',
            'burgundy': 'Exceptional terroir expression with subtle complexity',
            'champagne': 'Traditional méthode champenoise with fine bubbles and prestige',
            'napa valley': 'Bold, fruit-forward wines with modern winemaking excellence',
            'tuscany': 'Italian heritage with rich character and food-friendly style',
            'rioja': 'Spanish tradition with oak aging and remarkable longevity',
            'piedmont': 'Noble wines with intense aromatics and structured elegance'
        };
        
        return insights[region.toLowerCase()] || null;
    }

    getServingSuggestions(wineType) {
        const suggestions = {
            'Red': 'Serve at 16-18°C (60-65°F). Consider decanting 30-60 minutes before serving',
            'White': 'Serve chilled at 8-12°C (45-55°F). Remove from refrigerator 10 minutes before serving',
            'Sparkling': 'Serve well-chilled at 6-8°C (43-46°F). Open carefully to preserve bubbles',
            'Rosé': 'Serve chilled at 8-10°C (46-50°F). Perfect for warm weather occasions',
            'Dessert': 'Serve slightly chilled at 10-12°C (50-55°F). Pair with desserts or enjoy alone'
        };
        
        return suggestions[wineType] || 'Serve at appropriate temperature for wine type';
    }

    async loadWineHistory(wineId) {
        try {
            const historyContainer = document.getElementById(`wine-history-${wineId}`);
            if (!historyContainer) return;
            
            const history = await this.api.getLedgerHistory(wineId, 10);
            
            if (history.success && history.data && history.data.length > 0) {
                historyContainer.innerHTML = `
                    <div class="history-timeline">
                        ${history.data.map(entry => `
                            <div class="history-entry">
                                <div class="history-icon">${this.getHistoryIcon(entry.transaction_type)}</div>
                                <div class="history-content">
                                    <div class="history-action">${this.formatHistoryAction(entry)}</div>
                                    <div class="history-details">${entry.notes || ''}</div>
                                    <div class="history-time">${this.getTimeAgo(entry.created_at)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                historyContainer.innerHTML = '<p>No history available for this wine.</p>';
            }
        } catch (error) {
            console.error('Error loading wine history:', error);
            const historyContainer = document.getElementById(`wine-history-${wineId}`);
            if (historyContainer) {
                historyContainer.innerHTML = '<p>Could not load wine history.</p>';
            }
        }
    }

    getHistoryIcon(transactionType) {
        const icons = {
            'receive': '📦',
            'consume': '🥂',
            'reserve': '🍷',
            'move': '📍',
            'adjust': '⚙️'
        };
        return icons[transactionType] || '📋';
    }

    formatHistoryAction(entry) {
        const actions = {
            'receive': `Received ${entry.quantity} bottles`,
            'consume': `Consumed ${Math.abs(entry.quantity)} bottles`,
            'reserve': `Reserved ${entry.quantity} bottles`,
            'move': `Moved ${entry.quantity} bottles`,
            'adjust': `Inventory adjusted by ${entry.quantity} bottles`
        };
        return actions[entry.transaction_type] || `${entry.transaction_type} - ${entry.quantity} bottles`;
    }

    getConsumptionForm() {
        return `
            <form id="consumption-form">
                <div class="form-group">
                    <label for="wine-select">Wine</label>
                    <select id="wine-select" required>
                        <option value="">Select wine...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="bottles-consumed">Bottles Consumed</label>
                    <input type="number" id="bottles-consumed" min="1" required>
                </div>
                <div class="form-group">
                    <label for="service-notes">Notes</label>
                    <textarea id="service-notes" rows="3"></textarea>
                </div>
                <button type="submit" class="btn primary">Record Service</button>
            </form>
        `;
    }

    async loadDashboardCharts() {
        try {
            // Get inventory data for charts
            const inventory = await this.api.getInventory({ available_only: false });
            if (!inventory.success || !inventory.data) return;
            
            const wines = inventory.data;
            
            // Wine types chart
            this.createWineTypesChart(wines);
            
            // Stock by location chart
            this.createStockLocationChart(wines);
            
        } catch (error) {
            console.error('Failed to load dashboard charts:', error);
        }
    }
    
    createWineTypesChart(wines) {
        const ctx = document.getElementById('wine-types-chart');
        if (!ctx) return;
        
        // Count wine types
        const typeCounts = {};
        wines.forEach(wine => {
            const type = wine.wine_type || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + (wine.quantity || 0);
        });
        
        const colors = {
            'Red': '#b91c1c',
            'White': '#f59e0b', 
            'Sparkling': '#6366f1',
            'Rosé': '#ec4899',
            'Dessert': '#d97706',
            'Unknown': '#6b7280'
        };
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(typeCounts),
                datasets: [{
                    data: Object.values(typeCounts),
                    backgroundColor: Object.keys(typeCounts).map(type => colors[type] || colors.Unknown),
                    borderWidth: 2,
                    borderColor: '#1a1a2e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            padding: 20
                        }
                    }
                }
            }
        });
    }
    
    createStockLocationChart(wines) {
        const ctx = document.getElementById('stock-location-chart');
        if (!ctx) return;
        
        // Count stock by location
        const locationCounts = {};
        wines.forEach(wine => {
            const location = wine.location || 'Unknown';
            locationCounts[location] = (locationCounts[location] || 0) + (wine.quantity || 0);
        });
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(locationCounts),
                datasets: [{
                    label: 'Bottles',
                    data: Object.values(locationCounts),
                    backgroundColor: 'rgba(233, 69, 96, 0.8)',
                    borderColor: '#e94560',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }
    
    async syncData() {
        if (!this.isOnline) {
            this.ui.showToast('Cannot sync while offline', 'warning');
            return;
        }

        try {
            const syncBtn = document.getElementById('sync-btn');
            syncBtn.classList.add('syncing');
            
            // Sync logic would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate sync
            
            this.ui.showToast('Data synchronized', 'success');
        } catch (error) {
            console.error('Sync failed:', error);
            this.ui.showToast('Sync failed', 'error');
        } finally {
            const syncBtn = document.getElementById('sync-btn');
            syncBtn.classList.remove('syncing');
        }
    }

    // ============================================================================
    // PROCUREMENT FUNCTIONALITY
    // ============================================================================

    async loadProcurementData() {
        try {
            console.log('Loading procurement data...');
            
            // Load procurement stats
            await this.loadProcurementStats();
            
            // Set up procurement event listeners
            this.setupProcurementEventListeners();
            
            console.log('Procurement data loaded successfully');
        } catch (error) {
            console.error('Failed to load procurement data:', error);
            this.ui.showToast('Failed to load procurement data', 'error');
        }
    }

    async loadProcurementStats() {
        try {
            // For now, show placeholder stats
            document.getElementById('procurement-opportunities').textContent = '12';
            document.getElementById('potential-savings').textContent = '$15,240';
            document.getElementById('pending-orders').textContent = '3';
        } catch (error) {
            console.error('Failed to load procurement stats:', error);
        }
    }

    setupProcurementEventListeners() {
        // Filter procurement opportunities
        const filterBtn = document.querySelector('#procurement-view .btn[onclick*="filterProcurementOpportunities"]');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.filterProcurementOpportunities());
        }
    }

    async analyzeProcurementOpportunities() {
        try {
            this.ui.showToast('Analyzing procurement opportunities...', 'info');
            
            const regionFilter = document.getElementById('region-filter-procurement')?.value;
            const typeFilter = document.getElementById('wine-type-filter-procurement')?.value;
            const maxPrice = document.getElementById('max-price-filter')?.value;
            
            const filters = {
                region: regionFilter,
                wine_type: typeFilter,
                max_price: maxPrice ? parseFloat(maxPrice) : undefined
            };
            
            const opportunities = await this.api.getProcurementOpportunities(filters);
            
            if (opportunities.success && opportunities.data) {
                this.displayProcurementOpportunities(opportunities.data);
                this.ui.showToast(`Found ${opportunities.data.length} procurement opportunities`, 'success');
            } else {
                throw new Error('Failed to get procurement opportunities');
            }
        } catch (error) {
            console.error('Failed to analyze procurement opportunities:', error);
            this.ui.showToast('Failed to analyze opportunities', 'error');
        }
    }

    displayProcurementOpportunities(opportunities) {
        const grid = document.getElementById('procurement-opportunities');
        
        if (!opportunities || opportunities.length === 0) {
            grid.innerHTML = '<div class="opportunities-placeholder"><p>No procurement opportunities found with current filters</p></div>';
            return;
        }
        
        grid.innerHTML = opportunities.map(opportunity => `
            <div class="opportunity-card">
                <div class="opportunity-header">
                    <h4>${opportunity.wine_name || 'Wine Opportunity'}</h4>
                    <div class="opportunity-score">${Math.round((opportunity.score || 0.8) * 100)}%</div>
                </div>
                <div class="opportunity-details">
                    <p><strong>Producer:</strong> ${opportunity.producer || 'N/A'}</p>
                    <p><strong>Region:</strong> ${opportunity.region || 'N/A'}</p>
                    <p><strong>Estimated Value:</strong> $${opportunity.estimated_value || 'TBD'}</p>
                    <p><strong>Recommended Quantity:</strong> ${opportunity.recommended_quantity || 12} bottles</p>
                </div>
                <div class="opportunity-reasoning">
                    <h5>Why this opportunity:</h5>
                    <p>${opportunity.reasoning || 'Based on current inventory gaps and market analysis'}</p>
                </div>
                <div class="opportunity-actions">
                    <button class="btn primary" onclick="app.analyzePurchaseDecision('${opportunity.wine_id}', '${opportunity.supplier_id}')">
                        Analyze Purchase
                    </button>
                    <button class="btn secondary" onclick="app.addToOrder('${opportunity.wine_id}')">
                        Add to Order
                    </button>
                </div>
            </div>
        `).join('');
    }

    async filterProcurementOpportunities() {
        await this.analyzeProcurementOpportunities();
    }

    async showPurchaseDecisionTool() {
        this.ui.showModal('Purchase Decision Analysis', `
            <div class="purchase-decision-form">
                <div class="form-group">
                    <label for="decision-wine-id">Wine/Vintage ID</label>
                    <input type="text" id="decision-wine-id" placeholder="Enter wine or vintage ID">
                </div>
                <div class="form-group">
                    <label for="decision-supplier">Supplier</label>
                    <select id="decision-supplier">
                        <option value="">Select supplier...</option>
                        <option value="supplier1">Premium Wine Imports</option>
                        <option value="supplier2">European Cellars Ltd</option>
                        <option value="supplier3">Luxury Vintages Inc</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="decision-quantity">Quantity</label>
                    <input type="number" id="decision-quantity" value="12" min="1" max="144">
                </div>
                <div class="form-group">
                    <label for="decision-context">Context/Notes</label>
                    <textarea id="decision-context" rows="3" placeholder="Special occasion, guest preferences, etc."></textarea>
                </div>
                <div class="form-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Cancel</button>
                    <button class="btn primary" onclick="app.runPurchaseAnalysis()">Analyze Decision</button>
                </div>
            </div>
        `);
    }

    async runPurchaseAnalysis() {
        try {
            const wineId = document.getElementById('decision-wine-id').value;
            const supplierId = document.getElementById('decision-supplier').value;
            const quantity = parseInt(document.getElementById('decision-quantity').value);
            const context = document.getElementById('decision-context').value;
            
            if (!wineId || !supplierId) {
                this.ui.showToast('Please fill in wine ID and supplier', 'error');
                return;
            }
            
            this.ui.showToast('Analyzing purchase decision...', 'info');
            
            const analysis = await this.api.analyzePurchaseDecision(wineId, supplierId, quantity, { notes: context });
            
            if (analysis.success) {
                this.ui.hideModal();
                this.showPurchaseAnalysisResults(analysis.data);
            } else {
                throw new Error('Failed to analyze purchase decision');
            }
        } catch (error) {
            console.error('Purchase analysis failed:', error);
            this.ui.showToast('Analysis failed: ' + error.message, 'error');
        }
    }

    showPurchaseAnalysisResults(analysis) {
        const recommendation = analysis.recommendation || 'proceed';
        const confidence = Math.round((analysis.confidence || 0.8) * 100);
        const reasoning = analysis.reasoning || 'Analysis based on inventory needs and market conditions';
        
        this.ui.showModal('Purchase Decision Analysis Results', `
            <div class="analysis-results">
                <div class="analysis-header">
                    <div class="recommendation ${recommendation}">
                        <h3>${recommendation.toUpperCase()}</h3>
                        <div class="confidence">${confidence}% confidence</div>
                    </div>
                </div>
                <div class="analysis-details">
                    <h4>Analysis Summary:</h4>
                    <p>${reasoning}</p>
                    
                    <div class="analysis-metrics">
                        <div class="metric">
                            <label>Estimated ROI:</label>
                            <span>${analysis.estimated_roi || '15-20'}%</span>
                        </div>
                        <div class="metric">
                            <label>Market Demand:</label>
                            <span>${analysis.market_demand || 'High'}</span>
                        </div>
                        <div class="metric">
                            <label>Inventory Fit:</label>
                            <span>${analysis.inventory_fit || 'Excellent'}</span>
                        </div>
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
                    ${recommendation === 'proceed' ? '<button class="btn primary" onclick="app.generatePurchaseOrder()">Create Purchase Order</button>' : ''}
                </div>
            </div>
        `);
    }

    async generatePurchaseOrder() {
        this.ui.showModal('Create Purchase Order', `
            <div class="purchase-order-form">
                <div class="form-group">
                    <label for="po-supplier">Supplier</label>
                    <select id="po-supplier" required>
                        <option value="">Select supplier...</option>
                        <option value="supplier1">Premium Wine Imports</option>
                        <option value="supplier2">European Cellars Ltd</option>
                        <option value="supplier3">Luxury Vintages Inc</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="po-delivery-date">Delivery Date</label>
                    <input type="date" id="po-delivery-date" required>
                </div>
                <div class="form-group">
                    <label for="po-notes">Notes</label>
                    <textarea id="po-notes" rows="3" placeholder="Special instructions, terms, etc."></textarea>
                </div>
                <div class="order-items">
                    <h4>Order Items</h4>
                    <div id="order-items-list">
                        <div class="order-item">
                            <input type="text" placeholder="Wine/Vintage ID" class="item-wine-id">
                            <input type="number" placeholder="Qty" class="item-quantity" min="1" value="12">
                            <input type="number" placeholder="Unit Price" class="item-price" min="0" step="0.01">
                            <button class="btn-small danger" onclick="this.parentNode.remove()">×</button>
                        </div>
                    </div>
                    <button class="btn secondary" onclick="app.addOrderItem()">+ Add Item</button>
                </div>
                <div class="form-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Cancel</button>
                    <button class="btn primary" onclick="app.submitPurchaseOrder()">Generate Order</button>
                </div>
            </div>
        `);
        
        // Set default delivery date to 2 weeks from now
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 14);
        document.getElementById('po-delivery-date').value = deliveryDate.toISOString().split('T')[0];
    }

    addOrderItem() {
        const itemsList = document.getElementById('order-items-list');
        const newItem = document.createElement('div');
        newItem.className = 'order-item';
        newItem.innerHTML = `
            <input type="text" placeholder="Wine/Vintage ID" class="item-wine-id">
            <input type="number" placeholder="Qty" class="item-quantity" min="1" value="12">
            <input type="number" placeholder="Unit Price" class="item-price" min="0" step="0.01">
            <button class="btn-small danger" onclick="this.parentNode.remove()">×</button>
        `;
        itemsList.appendChild(newItem);
    }

    async submitPurchaseOrder() {
        try {
            const supplier = document.getElementById('po-supplier').value;
            const deliveryDate = document.getElementById('po-delivery-date').value;
            const notes = document.getElementById('po-notes').value;
            
            const itemElements = document.querySelectorAll('.order-item');
            const items = Array.from(itemElements).map(item => ({
                wine_id: item.querySelector('.item-wine-id').value,
                quantity: parseInt(item.querySelector('.item-quantity').value),
                unit_price: parseFloat(item.querySelector('.item-price').value) || 0
            })).filter(item => item.wine_id && item.quantity);
            
            if (!supplier || items.length === 0) {
                this.ui.showToast('Please select supplier and add at least one item', 'error');
                return;
            }
            
            this.ui.showToast('Generating purchase order...', 'info');
            
            const order = await this.api.generatePurchaseOrder(items, supplier, deliveryDate, notes);
            
            if (order.success) {
                this.ui.hideModal();
                this.ui.showToast('Purchase order created successfully!', 'success');
                // Refresh procurement data
                this.loadProcurementData();
            } else {
                throw new Error('Failed to create purchase order');
            }
        } catch (error) {
            console.error('Purchase order creation failed:', error);
            this.ui.showToast('Failed to create order: ' + error.message, 'error');
        }
    }

    // ============================================================================
    // WINE CATALOG FUNCTIONALITY
    // ============================================================================

    async loadWineCatalog() {
        try {
            console.log('Loading wine catalog...');
            
            // Set up catalog event listeners
            this.setupCatalogEventListeners();
            
            // Load catalog data
            this.currentCatalogPage = 1;
            this.catalogFilters = {};
            this.catalogSort = 'name';
            this.catalogView = 'grid';
            
            await this.loadCatalogData();
            
            console.log('Wine catalog loaded successfully');
        } catch (error) {
            console.error('Failed to load wine catalog:', error);
            this.ui.showToast('Failed to load wine catalog', 'error');
        }
    }

    setupCatalogEventListeners() {
        // Search
        const searchInput = document.getElementById('catalog-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.ui.debounce(() => {
                this.catalogFilters.search = searchInput.value;
                this.currentCatalogPage = 1;
                this.loadCatalogData();
            }, 300));
        }
        
        // Filters
        const filters = ['catalog-region-filter', 'catalog-type-filter', 'catalog-year-filter', 'catalog-sort'];
        filters.forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) {
                filter.addEventListener('change', () => {
                    this.updateCatalogFilters();
                    this.currentCatalogPage = 1;
                    this.loadCatalogData();
                });
            }
        });
        
        // View toggles
        const viewToggles = document.querySelectorAll('.view-toggle');
        viewToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                viewToggles.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.catalogView = e.target.dataset.view;
                this.updateCatalogView();
            });
        });
        
        // Pagination
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentCatalogPage > 1) {
                    this.currentCatalogPage--;
                    this.loadCatalogData();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentCatalogPage++;
                this.loadCatalogData();
            });
        }
    }

    updateCatalogFilters() {
        this.catalogFilters = {
            region: document.getElementById('catalog-region-filter')?.value,
            wine_type: document.getElementById('catalog-type-filter')?.value,
            year_range: document.getElementById('catalog-year-filter')?.value,
            search: document.getElementById('catalog-search')?.value
        };
        
        this.catalogSort = document.getElementById('catalog-sort')?.value || 'name';
    }

    async loadCatalogData() {
        try {
            const limit = 50;
            const offset = (this.currentCatalogPage - 1) * limit;
            
            const params = {
                ...this.catalogFilters,
                limit,
                offset
            };
            
            // Remove empty params
            Object.keys(params).forEach(key => {
                if (!params[key]) delete params[key];
            });
            
            const wines = await this.api.getWines(params);
            
            if (wines.success && wines.data) {
                this.displayCatalogWines(wines.data);
                this.updateCatalogStats(wines.data);
                this.updateCatalogPagination(wines.data.length, limit);
            } else {
                throw new Error('Failed to load wine catalog');
            }
        } catch (error) {
            console.error('Failed to load catalog data:', error);
            const grid = document.getElementById('catalog-grid');
            grid.innerHTML = '<div class="catalog-placeholder"><p>Failed to load wine catalog. Please try again.</p></div>';
        }
    }

    displayCatalogWines(wines) {
        const grid = document.getElementById('catalog-grid');
        
        if (!wines || wines.length === 0) {
            grid.innerHTML = '<div class="catalog-placeholder"><p>No wines found matching your criteria</p></div>';
            return;
        }
        
        const viewClass = `view-${this.catalogView}`;
        grid.className = `catalog-grid ${viewClass}`;
        
        if (this.catalogView === 'grid') {
            grid.innerHTML = wines.map(wine => this.createCatalogWineCard(wine, 'grid')).join('');
        } else if (this.catalogView === 'list') {
            grid.innerHTML = wines.map(wine => this.createCatalogWineCard(wine, 'list')).join('');
        } else if (this.catalogView === 'detail') {
            grid.innerHTML = wines.map(wine => this.createCatalogWineCard(wine, 'detail')).join('');
        }
    }

    createCatalogWineCard(wine, viewType) {
        const displayRegion = this.getDisplayRegion(wine);
        const totalValue = (wine.total_stock || 0) * (wine.cost_per_bottle || 0);
        
        if (viewType === 'grid') {
            return `
                <div class="wine-card catalog-card" onclick="app.showWineDetails('${wine.id}')">
                    <div class="wine-header">
                        <div class="wine-type-badge ${wine.wine_type?.toLowerCase() || 'unknown'}">
                            ${this.getWineTypeIcon(wine.wine_type)} ${wine.wine_type || 'Wine'}
                        </div>
                        <div class="wine-year">${wine.year || 'N/A'}</div>
                    </div>
                    <h3>${wine.name || 'Unknown Wine'}</h3>
                    <p class="producer">${wine.producer || 'Unknown Producer'}</p>
                    <p class="region">${displayRegion}</p>
                    <div class="wine-stats">
                        <span class="stock">${wine.total_stock || 0} bottles</span>
                        <span class="value">$${totalValue.toFixed(0)}</span>
                    </div>
                </div>
            `;
        } else if (viewType === 'list') {
            return `
                <div class="wine-list-item" onclick="app.showWineDetails('${wine.id}')">
                    <div class="wine-basic-info">
                        <h4>${wine.name || 'Unknown Wine'}</h4>
                        <span class="producer">${wine.producer || 'Unknown Producer'}</span>
                    </div>
                    <div class="wine-details">
                        <span class="type">${wine.wine_type || 'Wine'}</span>
                        <span class="year">${wine.year || 'N/A'}</span>
                        <span class="region">${displayRegion}</span>
                    </div>
                    <div class="wine-metrics">
                        <span class="stock">${wine.total_stock || 0} bottles</span>
                        <span class="value">$${totalValue.toFixed(0)}</span>
                    </div>
                </div>
            `;
        } else { // detail view
            return `
                <div class="wine-detail-card" onclick="app.showWineDetails('${wine.id}')">
                    <div class="wine-detail-header">
                        <div class="wine-title">
                            <h3>${wine.name || 'Unknown Wine'}</h3>
                            <p class="producer">${wine.producer || 'Unknown Producer'}</p>
                        </div>
                        <div class="wine-badges">
                            <div class="wine-type-badge ${wine.wine_type?.toLowerCase() || 'unknown'}">
                                ${this.getWineTypeIcon(wine.wine_type)} ${wine.wine_type || 'Wine'}
                            </div>
                            <div class="wine-year-badge">${wine.year || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="wine-detail-content">
                        <div class="wine-info">
                            <p><strong>Region:</strong> ${displayRegion}</p>
                            <p><strong>Alcohol:</strong> ${wine.alcohol_content || 'N/A'}%</p>
                            <p><strong>Style:</strong> ${wine.style || 'N/A'}</p>
                        </div>
                        <div class="wine-inventory">
                            <p><strong>Total Stock:</strong> ${wine.total_stock || 0} bottles</p>
                            <p><strong>Total Value:</strong> $${totalValue.toFixed(0)}</p>
                            <p><strong>Avg. Cost:</strong> $${(wine.cost_per_bottle || 0).toFixed(2)}/bottle</p>
                        </div>
                    </div>
                    ${wine.tasting_notes ? `
                        <div class="wine-notes">
                            <h5>Tasting Notes:</h5>
                            <p>${wine.tasting_notes}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }

    updateCatalogStats(wines) {
        const totalCount = wines.length;
        const totalBottles = wines.reduce((sum, wine) => sum + (wine.total_stock || 0), 0);
        const totalValue = wines.reduce((sum, wine) => sum + ((wine.total_stock || 0) * (wine.cost_per_bottle || 0)), 0);
        
        document.getElementById('catalog-count').textContent = totalCount.toLocaleString();
        document.getElementById('catalog-bottles').textContent = totalBottles.toLocaleString();
        document.getElementById('catalog-value').textContent = '$' + totalValue.toLocaleString();
    }

    updateCatalogPagination(currentCount, limit) {
        const pagination = document.getElementById('catalog-pagination');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');
        
        if (pagination && prevBtn && nextBtn && pageInfo) {
            // Show pagination if we have results
            if (currentCount > 0) {
                pagination.classList.remove('hidden');
                
                prevBtn.disabled = this.currentCatalogPage <= 1;
                nextBtn.disabled = currentCount < limit;
                
                pageInfo.textContent = `Page ${this.currentCatalogPage}`;
            } else {
                pagination.classList.add('hidden');
            }
        }
    }

    updateCatalogView() {
        const grid = document.getElementById('catalog-grid');
        const viewClass = `view-${this.catalogView}`;
        grid.className = `catalog-grid ${viewClass}`;
        
        // Re-render current wines with new view
        // This would typically re-call displayCatalogWines with current data
        this.loadCatalogData();
    }

    async showWineDetails(wineId) {
        try {
            console.log('Loading wine details for:', wineId);
            this.ui.showToast('Loading wine details...', 'info');
            
            const wineDetails = await this.api.getWineDetails(wineId);
            
            if (wineDetails.success && wineDetails.data) {
                this.displayWineDetailsModal(wineDetails.data);
            } else {
                throw new Error('Failed to load wine details');
            }
        } catch (error) {
            console.error('Failed to load wine details:', error);
            this.ui.showToast('Failed to load wine details', 'error');
        }
    }

    displayWineDetailsModal(wine) {
        const displayRegion = this.getDisplayRegion(wine);
        const vintages = wine.vintages || [];
        const aliases = wine.aliases || [];
        
        this.ui.showModal(`Wine Details - ${wine.name}`, `
            <div class="wine-details-modal">
                <div class="wine-details-header">
                    <div class="wine-title-section">
                        <h2>${wine.name}</h2>
                        <p class="producer">${wine.producer}</p>
                        <div class="wine-badges">
                            <span class="wine-type-badge ${wine.wine_type?.toLowerCase() || 'unknown'}">
                                ${this.getWineTypeIcon(wine.wine_type)} ${wine.wine_type}
                            </span>
                            <span class="region-badge">${displayRegion}</span>
                        </div>
                    </div>
                </div>
                
                <div class="wine-details-content">
                    <div class="wine-info-section">
                        <h4>Wine Information</h4>
                        <div class="wine-info-grid">
                            <div><strong>Region:</strong> ${wine.region}</div>
                            <div><strong>Country:</strong> ${wine.country}</div>
                            <div><strong>Alcohol:</strong> ${wine.alcohol_content || 'N/A'}%</div>
                            <div><strong>Style:</strong> ${wine.style || 'N/A'}</div>
                        </div>
                        
                        ${wine.grape_varieties ? `
                            <div class="grape-varieties">
                                <strong>Grape Varieties:</strong>
                                <p>${Array.isArray(wine.grape_varieties) ? wine.grape_varieties.join(', ') : wine.grape_varieties}</p>
                            </div>
                        ` : ''}
                        
                        ${wine.tasting_notes ? `
                            <div class="tasting-notes">
                                <strong>Tasting Notes:</strong>
                                <p>${wine.tasting_notes}</p>
                            </div>
                        ` : ''}
                        
                        ${wine.food_pairings ? `
                            <div class="food-pairings">
                                <strong>Food Pairings:</strong>
                                <p>${Array.isArray(wine.food_pairings) ? wine.food_pairings.join(', ') : wine.food_pairings}</p>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${vintages.length > 0 ? `
                        <div class="vintages-section">
                            <h4>Available Vintages</h4>
                            <div class="vintages-list">
                                ${vintages.map(vintage => `
                                    <div class="vintage-item">
                                        <div class="vintage-year">${vintage.year}</div>
                                        <div class="vintage-stock">${vintage.total_stock || 0} bottles</div>
                                        <div class="vintage-quality">
                                            ${vintage.quality_score ? `Quality: ${vintage.quality_score}/100` : ''}
                                        </div>
                                        <div class="vintage-actions">
                                            <button class="btn-small primary" onclick="app.reserveWineModal('${vintage.id}', '${wine.name} ${vintage.year}')">
                                                Reserve
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${aliases.length > 0 ? `
                        <div class="aliases-section">
                            <h4>Known As</h4>
                            <div class="aliases-list">
                                ${aliases.map(alias => `<span class="alias-tag">${alias.alias}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="wine-details-actions">
                    <button class="btn secondary" onclick="app.ui.hideModal()">Close</button>
                    <button class="btn primary" onclick="app.navigateToView('pairing'); app.ui.hideModal();">Find Pairings</button>
                </div>
            </div>
        `);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SommOS();
    window.sommOS = window.app; // Keep backward compatibility
});
