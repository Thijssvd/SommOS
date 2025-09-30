// Mock frontend classes for JSDOM testing
// These provide the same interface as the real classes but with simplified implementations

class SommOSAPIError extends Error {
    constructor(message, { status, code, details } = {}) {
        super(message);
        this.name = 'SommOSAPIError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

class SommOSAPI {
    constructor() {
        this.baseURL = 'http://localhost:3001/api';
        this.timeout = 10000;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async request(endpoint, options = {}) {
        const { method = 'GET', data, headers = {}, timeout = this.timeout } = options;
        
        // Mock successful response
        return {
            success: true,
            data: [],
            meta: {}
        };
    }

    async getInventory(filters = {}) {
        return this.request('/inventory/stock', {
            method: 'GET',
            data: filters
        });
    }

    async getPairings(dish, context = {}) {
        return this.request('/pairing/recommend', {
            method: 'POST',
            data: { dish, context }
        });
    }

    async consumeWine(vintageId, quantity, location, notes = '') {
        return this.request('/inventory/consume', {
            method: 'POST',
            data: { vintage_id: vintageId, quantity, location, notes }
        });
    }

    async moveWine(vintageId, fromLocation, toLocation, quantity) {
        return this.request('/inventory/move', {
            method: 'POST',
            data: { vintage_id: vintageId, from_location: fromLocation, to_location: toLocation, quantity }
        });
    }

    async reserveWine(vintageId, quantity, location, occasion = '') {
        return this.request('/inventory/reserve', {
            method: 'POST',
            data: { vintage_id: vintageId, quantity, location, occasion }
        });
    }

    async getWineCatalog(filters = {}) {
        return this.request('/wines', {
            method: 'GET',
            data: filters
        });
    }

    async getWineDetails(wineId) {
        return this.request(`/wines/${wineId}`, {
            method: 'GET'
        });
    }

    async getSystemHealth() {
        return this.request('/system/health', {
            method: 'GET'
        });
    }

    buildQueryString(params) {
        const filtered = Object.entries(params)
            .filter(([key, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        
        return filtered.length > 0 ? `?${filtered.join('&')}` : '';
    }
}

class SommOSUI {
    constructor() {
        this.toasts = [];
        this.modals = [];
        this.loadingStates = new Set();
    }

    showToast(message, type = 'info', duration = 3000) {
        const toast = { id: Date.now(), message, type, duration };
        this.toasts.push(toast);
        
        // Auto-remove after duration
        setTimeout(() => {
            this.removeToast(toast.id);
        }, duration);
        
        return toast.id;
    }

    removeToast(id) {
        const index = this.toasts.findIndex(toast => toast.id === id);
        if (index > -1) {
            this.toasts.splice(index, 1);
        }
    }

    showModal(title, content, options = {}) {
        const modal = {
            id: Date.now(),
            title,
            content,
            options: {
                closable: true,
                ...options
            }
        };
        this.modals.push(modal);
        return modal.id;
    }

    hideModal(id) {
        const index = this.modals.findIndex(modal => modal.id === id);
        if (index > -1) {
            this.modals.splice(index, 1);
        }
    }

    showLoading(element) {
        if (element) {
            this.loadingStates.add(element);
        }
    }

    hideLoading(element) {
        if (element) {
            this.loadingStates.delete(element);
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(new Date(date));
    }
}

class SommOS {
    constructor() {
        this.api = new SommOSAPI();
        this.ui = new SommOSUI();
        this.currentView = 'dashboard';
        this.inventory = [];
        this.isOnline = true;
        this.isInitialized = false;
    }

    async init() {
        try {
            this.ui.showLoading();
            
            // Initialize the application
            await this.loadInventory();
            await this.setupEventListeners();
            
            this.isInitialized = true;
            this.ui.hideLoading();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize SommOS:', error);
            this.ui.showToast('Failed to initialize application', 'error');
            this.ui.hideLoading();
            return false;
        }
    }

    async loadInventory(filters = {}) {
        try {
            const response = await this.api.getInventory(filters);
            if (response.success) {
                this.inventory = response.data || [];
                this.updateInventoryDisplay();
                return this.inventory;
            } else {
                throw new Error('Failed to load inventory');
            }
        } catch (error) {
            console.error('Error loading inventory:', error);
            this.ui.showToast('Failed to load inventory', 'error');
            return [];
        }
    }

    navigateToView(viewName) {
        this.currentView = viewName;
        // Mock view navigation
        console.log(`Navigating to view: ${viewName}`);
    }

    updateInventoryDisplay() {
        // Mock inventory display update
        console.log(`Updated inventory display with ${this.inventory.length} items`);
    }

    async setupEventListeners() {
        // Mock event listener setup
        console.log('Event listeners set up');
    }

    getWineTypeIcon(wineType) {
        const icons = {
            'Red': '🍷',
            'White': '🥂',
            'Rosé': '🍾',
            'Sparkling': '🍾',
            'Dessert': '🍯',
            'Fortified': '🥃'
        };
        return icons[wineType] || '🍷';
    }

    parseGrapeVarieties(grapeData) {
        if (!grapeData) return [];
        
        try {
            if (typeof grapeData === 'string') {
                // Try to parse as JSON first
                try {
                    return JSON.parse(grapeData);
                } catch {
                    // If not JSON, split by common delimiters
                    return grapeData.split(/[,;|]/).map(g => g.trim()).filter(g => g);
                }
            }
            return Array.isArray(grapeData) ? grapeData : [];
        } catch (error) {
            console.warn('Failed to parse grape varieties:', error);
            return [];
        }
    }

    generateWineSummary(wine) {
        const parts = [];
        
        if (wine.producer) parts.push(wine.producer);
        if (wine.region) parts.push(wine.region);
        if (wine.year) parts.push(wine.year);
        
        return parts.join(' - ') || wine.name || 'Unknown Wine';
    }

    handleOnlineStatusChange(isOnline) {
        this.isOnline = isOnline;
        const message = isOnline ? 'Connection restored' : 'Working offline';
        const type = isOnline ? 'success' : 'warning';
        this.ui.showToast(message, type);
    }
}

// Export classes to global scope for JSDOM tests
global.SommOSAPI = SommOSAPI;
global.SommOSAPIError = SommOSAPIError;
global.SommOSUI = SommOSUI;
global.SommOS = SommOS;

module.exports = {
    SommOSAPI,
    SommOSAPIError,
    SommOSUI,
    SommOS
};