// SommOS API Client
// Handles all API communication with offline fallback and retry logic

export class SommOSAPIError extends Error {
    constructor(message, { status, code, details } = {}) {
        super(message);
        this.name = 'SommOSAPIError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

// Retry configuration and logic
const DEFAULT_RETRY_CONFIG = {
    retries: 3,
    retryDelay: 1000,
    jitter: true,
    retryCondition: (error, response) => {
        // Retry on network errors, timeouts, and server errors
        if (error) {
            return error.name === 'AbortError' || 
                   /Failed to fetch|NetworkError|load failed|timeout/i.test(error.message || '');
        }
        if (response) {
            const status = response.status;
            // Retry on 5xx server errors, 429 rate limiting, and 408 timeout
            return (status >= 500 && status < 600) || 
                   status === 429 || 
                   status === 408;
        }
        return false;
    }
};

// Exponential backoff delay calculation with jitter
function calculateRetryDelay(attempt, baseDelay = 1000, jitter = true) {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const maxDelay = 10000; // Max 10 seconds
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    
    if (jitter) {
        // Add random jitter (±25%) to prevent thundering herd
        const jitterAmount = cappedDelay * 0.25;
        const jitteredDelay = cappedDelay + (Math.random() * 2 - 1) * jitterAmount;
        return Math.max(100, Math.floor(jitteredDelay)); // Minimum 100ms
    }
    
    return Math.floor(cappedDelay);
}

// Enhanced fetch with retry logic
async function fetchWithRetry(url, options = {}) {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    const { retries, retryDelay, jitter, retryCondition } = retryConfig;
    
    // Remove retry config from fetch options
    const fetchOptions = { ...options };
    delete fetchOptions.retryConfig;
    
    let lastError;
    let lastResponse;
    
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            console.log(`Fetch attempt ${attempt}/${retries + 1} for ${url}`);
            
            const response = await fetch(url, fetchOptions);
            lastResponse = response;
            
            // Check if we should retry based on response
            if (!response.ok && retryCondition(null, response)) {
                if (attempt <= retries) {
                    const delay = calculateRetryDelay(attempt, retryDelay, jitter);
                    console.warn(`Request failed with status ${response.status}, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }
            
            // Success or non-retryable error
            return response;
            
        } catch (error) {
            lastError = error;
            
            // Check if we should retry based on error
            if (retryCondition(error, null)) {
                if (attempt <= retries) {
                    const delay = calculateRetryDelay(attempt, retryDelay, jitter);
                    console.warn(`Request failed with error: ${error.message}, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }
            
            // Non-retryable error or max retries reached
            throw error;
        }
    }
    
    // This should never be reached, but just in case
    if (lastError) throw lastError;
    if (lastResponse) return lastResponse;
    throw new Error('Unexpected retry loop exit');
}

/**
 * Enhanced SommOS API Client with comprehensive retry logic and resilience patterns
 * 
 * Features:
 * - Automatic retry with exponential backoff and jitter for network errors and server errors
 * - Configurable retry behavior (retries, delay, conditions, jitter)
 * - Retry metrics tracking and monitoring
 * - Circuit breaker pattern for failing endpoints
 * - Offline support with request queuing
 * - Batch request capabilities
 * - Custom retry configuration per request
 * - Support for rate limiting (429) and timeout (408) retries
 * 
 * @example
 * // Basic usage with default retry configuration
 * const api = new SommOSAPI();
 * 
 * // Custom configuration with jitter disabled
 * const api = new SommOSAPI({
 *   retries: 5,
 *   retryDelay: 2000,
 *   jitter: false,
 *   timeout: 15000
 * });
 * 
 * // Simple retry method (as shown in user code snippet)
 * await api.requestWithRetry('/data', {}, 3);
 * 
 * // Disable retries for specific requests
 * await api.requestWithoutRetry('/health');
 * 
 * // Custom retry configuration for specific requests
 * await api.requestWithCustomRetry('/data', {}, { retries: 1, retryDelay: 500 });
 * 
 * // Circuit breaker pattern for failing endpoints
 * await api.requestWithCircuitBreaker('/unstable-endpoint', {}, { failureThreshold: 3 });
 * 
 * // Get retry metrics
 * const metrics = api.getRetryMetrics();
 * console.log(`Retry rate: ${metrics.retryRate}`);
 */
export class SommOSAPI {
    constructor(options = {}) {
        const viteEnvBase = (typeof import.meta !== 'undefined'
            && import.meta.env
            && import.meta.env.VITE_API_BASE)
            ? import.meta.env.VITE_API_BASE
            : null;

        const explicitBase = (typeof window !== 'undefined' && window.__SOMMOS_API_BASE__)
            || viteEnvBase
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
        this.timeout = options.timeout || 10000; // 10 seconds default timeout
        this.syncService = null;
        
        // Retry metrics tracking
        this.retryMetrics = {
            totalRequests: 0,
            totalRetries: 0,
            retryAttempts: new Map(), // endpoint -> retry count
            lastRetryTime: null
        };
        
        // Centralized retry configuration
        this.retryConfig = {
            retries: options.retries || 3,
            retryDelay: options.retryDelay || 1000,
            jitter: options.jitter !== undefined ? options.jitter : true,
            retryCondition: options.retryCondition || this.shouldRetry.bind(this)
        };
    }
    
    // Default retry condition method
    shouldRetry(error, response) {
        // Retry on network errors, timeouts, and server errors
        if (error) {
            return error.name === 'AbortError' || 
                   /Failed to fetch|NetworkError|load failed|timeout/i.test(error.message || '');
        }
        if (response) {
            const status = response.status;
            // Retry on 5xx server errors, 429 rate limiting, and 408 timeout
            return (status >= 500 && status < 600) || 
                   status === 429 || 
                   status === 408;
        }
        return false;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const { sync: syncContext, skipQueue = false, allowQueue = true, suppressAuthEvent = false } = options;
        
        // Track total requests for metrics
        this.retryMetrics.totalRequests++;

        const config = {
            ...options,
            credentials: options.credentials || 'include',
            headers: {
                Accept: options.headers?.Accept || 'application/json',
                'Content-Type': options.body ? 'application/json' : undefined,
                ...(options.headers || {})
            }
        };

        delete config.sync;
        delete config.skipQueue;
        delete config.allowQueue;
        delete config.suppressAuthEvent;

        if (!config.headers['Content-Type']) {
            delete config.headers['Content-Type'];
        }

        const method = (config.method || 'GET').toUpperCase();
        const isMutation = method !== 'GET' && method !== 'HEAD';
        const shouldQueue = Boolean(this.syncService) && isMutation && allowQueue && !skipQueue;

        if (shouldQueue && typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
            await this.syncService.enqueue({
                endpoint,
                method,
                body: config.body,
                headers: config.headers,
                sync: syncContext
            });

            return { success: true, queued: true, offline: true };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn(`Request timeout for ${endpoint}`);
                controller.abort();
            }, this.timeout);

            console.log(`Making API request to: ${url}`);
            
            // Use fetchWithRetry with centralized retry configuration
            const response = await fetchWithRetry(url, {
                ...config,
                signal: controller.signal,
                retryConfig: this.retryConfig
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
                if (response.status === 401 && typeof window !== 'undefined' && !suppressAuthEvent) {
                    window.dispatchEvent(new CustomEvent('sommos:auth-expired'));
                }

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

            if (isJson && parsedBody && typeof parsedBody === 'object') {
                if (parsedBody.error) {
                    const { code, message, details } = parsedBody.error;
                    throw new SommOSAPIError(message || 'Request failed', {
                        status: response.status,
                        code: code || 'REQUEST_FAILED',
                        details
                    });
                }

                const normalized = {
                    success: Object.prototype.hasOwnProperty.call(parsedBody, 'success') ? parsedBody.success : true,
                    data: Object.prototype.hasOwnProperty.call(parsedBody, 'data') ? parsedBody.data : parsedBody,
                    meta: parsedBody.meta,
                    message: parsedBody.message,
                    status: parsedBody.status,
                    raw: parsedBody
                };

                if (typeof normalized.meta === 'undefined') {
                    delete normalized.meta;
                }

                if (typeof normalized.success === 'undefined') {
                    delete normalized.success;
                }

                if (typeof normalized.message === 'undefined') {
                    delete normalized.message;
                }

                if (typeof normalized.status === 'undefined') {
                    delete normalized.status;
                }

                console.log('API response data:', normalized.raw);
                return normalized;
            }

            console.log('API response data:', parsedBody);
            return parsedBody;
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);

            const isNetworkError = error.name === 'AbortError'
                || /Failed to fetch|NetworkError|load failed/i.test(error.message || '');

            if (shouldQueue && isNetworkError) {
                await this.syncService.enqueue({
                    endpoint,
                    method,
                    body: config.body,
                    headers: config.headers,
                    sync: syncContext
                });

                return { success: true, queued: true, offline: true };
            }

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

    static buildQuery(params = {}) {
        const search = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }

            const appendValue = (val) => {
                if (val === undefined || val === null || val === '') {
                    return;
                }

                if (typeof val === 'boolean') {
                    search.append(key, val ? 'true' : 'false');
                    return;
                }

                search.append(key, `${val}`);
            };

            if (Array.isArray(value)) {
                value.forEach(appendValue);
            } else {
                appendValue(value);
            }
        });

        const query = search.toString();
        return query ? `?${query}` : '';
    }

    static cleanPayload(payload = {}) {
        if (!payload || typeof payload !== 'object') {
            return payload;
        }

        return Object.entries(payload).reduce((acc, [key, value]) => {
            if (value === undefined) {
                return acc;
            }

            if (Array.isArray(value)) {
                acc[key] = value;
                return acc;
            }

            if (value && typeof value === 'object') {
                acc[key] = SommOSAPI.cleanPayload(value);
                return acc;
            }

            acc[key] = value;
            return acc;
        }, {});
    }

    setSyncService(syncService) {
        this.syncService = syncService || null;
        if (this.syncService && typeof this.syncService.setAPI === 'function') {
            this.syncService.setAPI(this);
        }
    }
    
    // Configuration methods for retry behavior
    setRetryConfig(config) {
        this.retryConfig = { ...this.retryConfig, ...config };
    }
    
    getRetryConfig() {
        return { ...this.retryConfig };
    }
    
    // Method to disable retries for specific requests
    requestWithoutRetry(endpoint, options = {}) {
        const noRetryOptions = {
            ...options,
            retryConfig: { retries: 0 }
        };
        return this.request(endpoint, noRetryOptions);
    }
    
    // Method to make requests with custom retry configuration
    requestWithCustomRetry(endpoint, options = {}, retryConfig = {}) {
        const customRetryOptions = {
            ...options,
            retryConfig: { ...this.retryConfig, ...retryConfig }
        };
        return this.request(endpoint, customRetryOptions);
    }
    
    // Simple requestWithRetry method as shown in user code snippet
    async requestWithRetry(endpoint, options = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.request(endpoint, options);
            } catch (error) {
                if (i === retries - 1) throw error;
                this.trackRetryAttempt(endpoint, i + 1);
                await this.delay(Math.pow(2, i) * 1000); // Exponential backoff
            }
        }
    }
    
    // Dedicated delay method for better code organization
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Track retry attempt for metrics
    trackRetryAttempt(endpoint, attempt) {
        this.retryMetrics.totalRetries++;
        this.retryMetrics.lastRetryTime = Date.now();
        
        const currentCount = this.retryMetrics.retryAttempts.get(endpoint) || 0;
        this.retryMetrics.retryAttempts.set(endpoint, currentCount + 1);
        
        console.log(`Retry attempt ${attempt} for ${endpoint} (total retries: ${this.retryMetrics.totalRetries})`);
    }
    
    // Get retry metrics
    getRetryMetrics() {
        return {
            ...this.retryMetrics,
            retryAttempts: Object.fromEntries(this.retryMetrics.retryAttempts),
            retryRate: this.retryMetrics.totalRequests > 0 
                ? (this.retryMetrics.totalRetries / this.retryMetrics.totalRequests * 100).toFixed(2) + '%'
                : '0%'
        };
    }
    
    // Reset retry metrics
    resetRetryMetrics() {
        this.retryMetrics = {
            totalRequests: 0,
            totalRetries: 0,
            retryAttempts: new Map(),
            lastRetryTime: null
        };
    }
    
    // Health check with retry disabled for faster failure detection
    async healthCheckQuick() {
        return this.requestWithoutRetry('/system/health');
    }
    
    // Batch request method for multiple endpoints
    async batchRequest(requests) {
        const promises = requests.map(({ endpoint, options = {} }) => 
            this.request(endpoint, options)
        );
        return Promise.allSettled(promises);
    }
    
    // Retry a failed request with custom configuration
    async retryRequest(endpoint, options = {}, retryConfig = {}) {
        const customRetryOptions = {
            ...options,
            retryConfig: { ...this.retryConfig, ...retryConfig }
        };
        return this.request(endpoint, customRetryOptions);
    }
    
    // Circuit breaker pattern for failing endpoints
    async requestWithCircuitBreaker(endpoint, options = {}, circuitBreakerConfig = {}) {
        const {
            failureThreshold = 5,
            resetTimeout = 60000, // 1 minute
            monitorWindow = 300000 // 5 minutes
        } = circuitBreakerConfig;
        
        const now = Date.now();
        const circuitKey = `circuit_${endpoint}`;
        
        // Check if circuit is open
        const circuitState = this.getCircuitState(circuitKey);
        if (circuitState && circuitState.state === 'open' && now < circuitState.nextAttempt) {
            throw new Error(`Circuit breaker open for ${endpoint}. Next attempt at ${new Date(circuitState.nextAttempt)}`);
        }
        
        try {
            const result = await this.request(endpoint, options);
            this.resetCircuitBreaker(circuitKey);
            return result;
        } catch (error) {
            this.recordCircuitBreakerFailure(circuitKey, now, failureThreshold, resetTimeout);
            throw error;
        }
    }
    
    // Circuit breaker state management
    getCircuitState(key) {
        return this.circuitBreakerStates?.[key];
    }
    
    recordCircuitBreakerFailure(key, timestamp, threshold, resetTimeout) {
        if (!this.circuitBreakerStates) {
            this.circuitBreakerStates = {};
        }
        
        const state = this.circuitBreakerStates[key] || { failures: 0, lastFailure: 0 };
        state.failures++;
        state.lastFailure = timestamp;
        
        if (state.failures >= threshold) {
            state.state = 'open';
            state.nextAttempt = timestamp + resetTimeout;
            console.warn(`Circuit breaker opened for ${key} after ${threshold} failures`);
        }
        
        this.circuitBreakerStates[key] = state;
    }
    
    resetCircuitBreaker(key) {
        if (this.circuitBreakerStates?.[key]) {
            this.circuitBreakerStates[key] = { failures: 0, lastFailure: 0, state: 'closed' };
        }
    }

    static generateOperationId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        return `op_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    static createSyncContext(overrides = {}, defaults = {}) {
        const merged = { ...defaults, ...overrides };
        const now = Math.floor(Date.now() / 1000);

        return {
            op_id: merged.op_id || merged.opId || SommOSAPI.generateOperationId(),
            origin: merged.origin || 'pwa',
            updated_by: merged.updated_by || merged.updatedBy || 'SommOS PWA',
            updated_at: merged.updated_at || merged.updatedAt || now
        };
    }

    // System endpoints
    async healthCheck() {
        return this.request('/system/health');
    }

    async getSystemHealth() {
        return this.request('/system/health');
    }

    async getRecentActivity(limit = 10) {
        const query = SommOSAPI.buildQuery({ limit });
        return this.request(`/system/activity${query}`);
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

    async submitPairingFeedback({ recommendation_id, rating, notes, selected }) {
        return this.request('/pairing/feedback', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                recommendation_id,
                rating,
                notes,
                selected
            }))
        });
    }

    // Explainability endpoints
    async getExplanations(entityType, entityId, options = {}) {
        const query = SommOSAPI.buildQuery({
            limit: options.limit
        });
        const path = [
            '/explanations',
            encodeURIComponent(entityType),
            encodeURIComponent(entityId)
        ].join('/');
        return this.request(`${path}${query}`);
    }

    async createExplanation({ entityType, entityId, summary, factors, generatedAt } = {}) {
        return this.request('/explanations', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                entity_type: entityType,
                entity_id: entityId,
                summary,
                factors,
                generated_at: generatedAt
            }))
        });
    }

    // Memory endpoints
    async getMemories(subjectType, subjectId, options = {}) {
        const query = SommOSAPI.buildQuery({
            subject_type: subjectType,
            subject_id: subjectId,
            limit: options.limit
        });
        return this.request(`/memories${query}`);
    }

    async createMemory({ subjectType, subjectId, note, tags } = {}) {
        return this.request('/memories', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                subject_type: subjectType,
                subject_id: subjectId,
                note,
                tags
            }))
        });
    }

    // Authentication endpoints
    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
            suppressAuthEvent: true
        });
    }

    async refreshSession() {
        return this.request('/auth/refresh', {
            method: 'POST'
        });
    }

    async logout() {
        return this.request('/auth/logout', {
            method: 'POST',
            suppressAuthEvent: true
        });
    }

    // Inventory endpoints
    async getInventory(filters = {}) {
        const query = SommOSAPI.buildQuery(filters);
        return this.request(`/inventory${query}`);
    }

    async getInventoryStock(filters = {}) {
        const query = SommOSAPI.buildQuery(filters);
        return this.request(`/inventory/stock${query}`);
    }

    async getInventoryItem(id) {
        return this.request(`/inventory/${id}`);
    }

    async listLocations() {
        return this.request('/locations');
    }

    async consumeWine(vintageId, location, quantity, notes = '', createdBy = 'SommOS', options = {}) {
        const sync = SommOSAPI.createSyncContext(options.sync, {
            updated_by: createdBy,
            origin: 'inventory.consume'
        });

        return this.request('/inventory/consume', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                vintage_id: vintageId,
                location,
                quantity,
                notes,
                created_by: createdBy,
                sync
            })),
            sync
        });
    }

    async receiveWine(vintageId, location, quantity, unitCost, referenceId = '', notes = '', createdBy = 'SommOS', options = {}) {
        const sync = SommOSAPI.createSyncContext(options.sync, {
            updated_by: createdBy,
            origin: 'inventory.receive'
        });

        return this.request('/inventory/receive', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                vintage_id: vintageId,
                location,
                quantity,
                unit_cost: unitCost,
                reference_id: referenceId,
                notes,
                created_by: createdBy,
                sync
            })),
            sync
        });
    }

    async createInventoryIntake(intakePayload) {
        const sync = SommOSAPI.createSyncContext(intakePayload?.sync, {
            updated_by: intakePayload?.created_by || 'Inventory Intake',
            origin: 'inventory.intake.create'
        });

        return this.request('/inventory/intake', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                ...intakePayload,
                sync
            })),
            sync
        });
    }

    async receiveInventoryIntake(intakeId, receipts, options = {}) {
        const sync = SommOSAPI.createSyncContext(options.sync, {
            updated_by: options.createdBy || options.created_by || 'Inventory Intake',
            origin: 'inventory.intake.receive'
        });

        return this.request(`/inventory/intake/${intakeId}/receive`, {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                receipts,
                created_by: options.createdBy || options.created_by,
                notes: options.notes,
                sync
            })),
            sync
        });
    }

    async getInventoryIntakeStatus(intakeId) {
        return this.request(`/inventory/intake/${intakeId}/status`);
    }

    async moveWine(vintageId, fromLocation, toLocation, quantity, notes = '', createdBy = 'SommOS', options = {}) {
        const sync = SommOSAPI.createSyncContext(options.sync, {
            updated_by: createdBy,
            origin: 'inventory.move'
        });

        return this.request('/inventory/move', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                vintage_id: vintageId,
                from_location: fromLocation,
                to_location: toLocation,
                quantity,
                notes,
                created_by: createdBy,
                sync
            })),
            sync
        });
    }

    async reserveWine(vintageId, location, quantity, notes = '', createdBy = 'SommOS', options = {}) {
        const sync = SommOSAPI.createSyncContext(options.sync, {
            updated_by: createdBy,
            origin: 'inventory.reserve'
        });

        return this.request('/inventory/reserve', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                vintage_id: vintageId,
                location,
                quantity,
                notes,
                created_by: createdBy,
                sync
            })),
            sync
        });
    }

    async getLedgerHistory(vintageId, limit = 50, offset = 0) {
        const query = SommOSAPI.buildQuery({ limit, offset });
        return this.request(`/inventory/ledger/${vintageId}${query}`);
    }

    async recordConsumption(consumptionData = {}) {
        const sync = SommOSAPI.createSyncContext(consumptionData.sync, {
            updated_by: consumptionData.created_by || consumptionData.createdBy || 'SommOS',
            origin: 'inventory.consume'
        });

        return this.request('/inventory/consume', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                ...consumptionData,
                sync
            })),
            sync
        });
    }

    // Procurement endpoints
    async getProcurementOpportunities(filters = {}) {
        const query = SommOSAPI.buildQuery(filters);
        return this.request(`/procurement/opportunities${query}`);
    }

    async analyzePurchaseDecision(vintageId, supplierId, quantity = 12, context = {}) {
        return this.request('/procurement/analyze', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                vintage_id: vintageId,
                supplier_id: supplierId,
                quantity,
                context
            }))
        });
    }

    async generatePurchaseOrder(items, supplierId, deliveryDate = null, notes = '') {
        return this.request('/procurement/order', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({
                items,
                supplier_id: supplierId,
                delivery_date: deliveryDate,
                notes
            }))
        });
    }

    // Wine catalog endpoints
    async getWines(filters = {}) {
        const query = SommOSAPI.buildQuery(filters);
        return this.request(`/wines${query}`);
    }

    async getWineDetails(wineId) {
        return this.request(`/wines/${wineId}`);
    }

    async createWine(payload) {
        return this.request('/wines', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload(payload))
        });
    }

    // Vintage intelligence endpoints
    async getVintageAnalysis(wineId) {
        return this.request(`/vintage/analysis/${wineId}`);
    }

    async enrichVintage(wineId) {
        return this.request('/vintage/enrich', {
            method: 'POST',
            body: JSON.stringify({ wine_id: wineId })
        });
    }

    async getVintageProcurementRecommendations() {
        return this.request('/vintage/procurement-recommendations');
    }

    async batchEnrichVintage({ filters = {}, limit } = {}) {
        return this.request('/vintage/batch-enrich', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({ filters, limit }))
        });
    }

    async getVintagePairingInsight({ wine_id, dish_context }) {
        return this.request('/vintage/pairing-insight', {
            method: 'POST',
            body: JSON.stringify(SommOSAPI.cleanPayload({ wine_id, dish_context }))
        });
    }
}

if (typeof window !== 'undefined') {
    window.SommOSAPIError = SommOSAPIError;
    window.SommOSAPI = SommOSAPI;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SommOSAPI, SommOSAPIError };
}
