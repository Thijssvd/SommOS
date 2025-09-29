// SommOS API Client
// Handles all API communication with offline fallback

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
        const explicitBase = (typeof window !== 'undefined' && window.__SOMMOS_API_BASE__)
            || (typeof process !== 'undefined' && process.env && process.env.SOMMOS_API_BASE_URL);

        const sanitizedExplicitBase = explicitBase ? explicitBase.replace(/\/$/, '') : null;

        const hasWindowLocation = typeof window !== 'undefined'
            && typeof window.location !== 'undefined';

        let computedBase = sanitizedExplicitBase;

        if (!computedBase && hasWindowLocation) {
            const { protocol, hostname, port, origin } = window.location;
            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
            let resolvedOrigin = origin || `${protocol}//${hostname}${port ? `:${port}` : ''}`;

            if (isLocalhost && (!port || port === '')) {
                resolvedOrigin = `${protocol}//${hostname}:3000`;
            }

            computedBase = `${resolvedOrigin.replace(/\/$/, '')}/api`;
        }

        if (!computedBase) {
            computedBase = 'http://localhost:3000/api';
        }

        this.baseURL = computedBase.replace(/\/$/, '');
        this.timeout = 10000; // 10 seconds default timeout
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
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
            const contentType = response.headers?.get?.('content-type') || '';
            const isJson = contentType.includes('application/json');
            const isText = contentType.includes('text/') || contentType.includes('application/yaml');

            let parsedBody;

            if (isJson) {
                try {
                    parsedBody = await response.json();
                } catch (parseError) {
                    console.warn('Failed to parse JSON response:', parseError);
                    parsedBody = null;
                }
            } else if (isText) {
                parsedBody = await response.text();
            }

            if (!response.ok) {
                if (parsedBody && typeof parsedBody === 'object' && parsedBody.error) {
                    const { code, message, details } = parsedBody.error;
                    throw new SommOSAPIError(message || `HTTP ${response.status}`, {
                        status: response.status,
                        code: code || 'HTTP_ERROR',
                        details
                    });
                }

                throw new SommOSAPIError(`HTTP ${response.status}: ${response.statusText}`, {
                    status: response.status,
                    code: 'HTTP_ERROR',
                    details: parsedBody
                });
            }

            if (typeof parsedBody === 'undefined') {
                return null;
            }

            console.log(`API response data:`, parsedBody);
            return parsedBody;
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);

            // Provide more specific error messages
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout/1000} seconds. Please try again.`);
            }

            if (error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to server. Please check if the backend is running.');
            }

            throw error instanceof SommOSAPIError ? error : new SommOSAPIError(error.message, error);
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

    async getOpenAPISpec() {
        return this.request('/system/spec', {
            headers: {
                Accept: 'application/yaml'
            }
        });
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
        const params = new URLSearchParams();

        Object.entries(filters || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, value);
            }
        });

        const queryString = params.toString();
        const suffix = queryString ? `?${queryString}` : '';

        return this.request(`/inventory/stock${suffix}`);
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

    async createInventoryIntake(intakePayload) {
        return this.request('/inventory/intake', {
            method: 'POST',
            body: JSON.stringify(intakePayload)
        });
    }

    async receiveInventoryIntake(intakeId, receipts, options = {}) {
        return this.request(`/inventory/intake/${intakeId}/receive`, {
            method: 'POST',
            body: JSON.stringify({
                receipts,
                created_by: options.createdBy || options.created_by,
                notes: options.notes
            })
        });
    }

    async getInventoryIntakeStatus(intakeId) {
        return this.request(`/inventory/intake/${intakeId}/status`);
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
        return this.request('/inventory/consume', {
            method: 'POST',
            body: JSON.stringify(consumptionData)
        });
    }

    // Procurement endpoints
    async getProcurementOpportunities(filters = {}) {
        const params = new URLSearchParams();

        Object.entries(filters || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, value);
            }
        });

        const query = params.toString();
        const suffix = query ? `?${query}` : '';

        return this.request(`/procurement/opportunities${suffix}`);
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
        const params = new URLSearchParams();

        Object.entries(filters || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, value);
            }
        });

        const query = params.toString();
        const suffix = query ? `?${query}` : '';

        return this.request(`/wines${suffix}`);
    }

    async getWineDetails(wineId) {
        return this.request(`/wines/${wineId}`);
    }
}
