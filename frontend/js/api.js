// SommOS API Client
// Handles all API communication with offline fallback

class SommOSAPI {
    constructor() {
        // Check if running in development or production
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isDevelopment) {
            // In development, backend runs on port 3001
            this.baseURL = 'http://localhost:3001/api';
        } else {
            // In production, use same origin with /api path
            this.baseURL = window.location.origin + '/api';
        }
        
        this.timeout = 30000; // 30 seconds for AI processing
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn(`Request timeout for ${endpoint}`);
                controller.abort();
            }, this.timeout);

            console.log(`Making API request to: ${url}`);
            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log(`API response status: ${response.status}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log(`API response data:`, data);
            return data;
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            
            // Provide more specific error messages
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout/1000} seconds. Please try again.`);
            }
            
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to server. Please check if the backend is running.');
            }
            
            throw error;
        }
    }

    // System endpoints
    async healthCheck() {
        return this.request('/system/health');
    }

    async getSystemHealth() {
        return this.request('/system/health');
    }

    async getRecentActivity(limit = 10) {
        return this.request(`/system/activity?limit=${limit}`);
    }

    // Pairing endpoints
    async getPairings(dish, context = {}, guestPreferences = '') {
        return this.request('/pairing/recommend', {
            method: 'POST',
            body: JSON.stringify({
                dish,
                context,
                guestPreferences
            })
        });
    }

    async getQuickPairing(dish, context = {}, ownerLikes = []) {
        return this.request('/pairing/quick', {
            method: 'POST',
            body: JSON.stringify({
                dish,
                context,
                ownerLikes
            })
        });
    }

    // Inventory endpoints
    async getInventory(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/inventory/stock?${params}`);
    }

    async consumeWine(vintageId, location, quantity, notes = '', createdBy = 'SommOS') {
        return this.request('/inventory/consume', {
            method: 'POST',
            body: JSON.stringify({
                vintage_id: vintageId,
                location,
                quantity,
                notes,
                created_by: createdBy
            })
        });
    }

    async receiveWine(vintageId, location, quantity, unitCost, referenceId = '', notes = '', createdBy = 'SommOS') {
        return this.request('/inventory/receive', {
            method: 'POST',
            body: JSON.stringify({
                vintage_id: vintageId,
                location,
                quantity,
                unit_cost: unitCost,
                reference_id: referenceId,
                notes,
                created_by: createdBy
            })
        });
    }

    async moveWine(vintageId, fromLocation, toLocation, quantity, notes = '', createdBy = 'SommOS') {
        return this.request('/inventory/move', {
            method: 'POST',
            body: JSON.stringify({
                vintage_id: vintageId,
                from_location: fromLocation,
                to_location: toLocation,
                quantity,
                notes,
                created_by: createdBy
            })
        });
    }

    async reserveWine(vintageId, location, quantity, notes = '', createdBy = 'SommOS') {
        return this.request('/inventory/reserve', {
            method: 'POST',
            body: JSON.stringify({
                vintage_id: vintageId,
                location,
                quantity,
                notes,
                created_by: createdBy
            })
        });
    }

    async getLedgerHistory(vintageId, limit = 50, offset = 0) {
        return this.request(`/inventory/ledger/${vintageId}?limit=${limit}&offset=${offset}`);
    }

    async recordConsumption(consumptionData) {
        return this.request('/inventory/consumption', {
            method: 'POST',
            body: JSON.stringify(consumptionData)
        });
    }

    // Procurement endpoints
    async getProcurementOpportunities(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/procurement/opportunities?${params}`);
    }

    async analyzePurchaseDecision(vintageId, supplierId, quantity = 12, context = {}) {
        return this.request('/procurement/analyze', {
            method: 'POST',
            body: JSON.stringify({
                vintage_id: vintageId,
                supplier_id: supplierId,
                quantity,
                context
            })
        });
    }

    async generatePurchaseOrder(items, supplierId, deliveryDate = null, notes = '') {
        return this.request('/procurement/order', {
            method: 'POST',
            body: JSON.stringify({
                items,
                supplier_id: supplierId,
                delivery_date: deliveryDate,
                notes
            })
        });
    }

    // Wine catalog endpoints
    async getWines(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/wines?${params}`);
    }

    async getWineDetails(wineId) {
        return this.request(`/wines/${wineId}`);
    }
}