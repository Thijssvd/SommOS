import { openDB } from 'idb';

const DEFAULT_DB_NAME = 'SommOSDB';
const DEFAULT_STORE_NAME = 'sync_queue';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DEFAULT_BACKOFF_BASE = 2000; // 2 seconds
const DEFAULT_BACKOFF_MAX = 5 * 60 * 1000; // 5 minutes

// Add retry logic for failed API calls
const syncManager = {
  retryFailedRequests: true,
  maxRetries: 3,
  backoffStrategy: 'exponential'
};

const generateOperationId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `op_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const dispatchSyncEvent = (name, detail = {}) => {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
        return;
    }

    window.dispatchEvent(new CustomEvent(name, { detail }));
};

const normaliseHeaders = (headers = {}) => {
    if (!headers || typeof headers !== 'object') {
        return {};
    }

    const result = {};
    Object.entries(headers).forEach(([key, value]) => {
        if (!key) {
            return;
        }

        const normalisedKey = key.trim();
        if (!normalisedKey) {
            return;
        }

        result[normalisedKey] = value;
    });

    return result;
};

export class SommOSSyncService {
    constructor({ api, dbName = DEFAULT_DB_NAME, storeName = DEFAULT_STORE_NAME, syncConfig = {} } = {}) {
        this.api = api || null;
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this.processing = false;
        this.initialised = false;
        this.flushTimer = null;
        this.baseDelay = DEFAULT_BACKOFF_BASE;
        this.maxDelay = DEFAULT_BACKOFF_MAX;
        this.maxAttempts = 5;
        this.extraStores = [];

        // Enhanced sync manager configuration
        this.syncManager = {
            retryFailedRequests: syncConfig.retryFailedRequests ?? syncManager.retryFailedRequests,
            maxRetries: syncConfig.maxRetries ?? syncManager.maxRetries,
            backoffStrategy: syncConfig.backoffStrategy ?? syncManager.backoffStrategy,
            retryableStatusCodes: syncConfig.retryableStatusCodes ?? [408, 429, 500, 502, 503, 504],
            retryableErrors: syncConfig.retryableErrors ?? ['NetworkError', 'TimeoutError', 'AbortError'],
            jitterEnabled: syncConfig.jitterEnabled ?? true,
            maxJitter: syncConfig.maxJitter ?? 1000
        };

        this.handleOnline = this.handleOnline.bind(this);
        this.handleOffline = this.handleOffline.bind(this);
    }

    setAPI(api) {
        this.api = api || null;
    }

    getDB() {
        return this.db;
    }

    async initialize(options = {}) {
        if (options.dbName) {
            this.dbName = options.dbName;
        }

        if (options.storeName) {
            this.storeName = options.storeName;
        }

        if (Array.isArray(options.extraStores)) {
            this.extraStores = options.extraStores;
        }

        const requestedVersion = options.version || this.db?.version || 1;
        const version = Math.max(1, requestedVersion);

        if (typeof indexedDB === 'undefined') {
            console.warn('IndexedDB is not available in this environment; offline queue disabled.');
            this.initialised = true;
            return this;
        }

        if (this.db) {
            this.db.close();
        }

        this.db = await openDB(this.dbName, version, {
            upgrade: (db) => {
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('queued_at', 'queuedAt');
                    store.createIndex('next_attempt_at', 'nextAttemptAt');
                }

                this.extraStores.forEach((definition) => {
                    if (!definition || !definition.name) {
                        return;
                    }

                    if (!db.objectStoreNames.contains(definition.name)) {
                        const store = db.createObjectStore(definition.name, definition.options || { keyPath: 'id' });

                        (definition.indexes || []).forEach((indexDefinition) => {
                            if (!indexDefinition || !indexDefinition.name || !indexDefinition.keyPath) {
                                return;
                            }

                            store.createIndex(indexDefinition.name, indexDefinition.keyPath, indexDefinition.options || {});
                        });
                    }
                });
            }
        });

        const shouldAttachListeners = !this.initialised && typeof window !== 'undefined';

        if (shouldAttachListeners) {
            window.addEventListener('online', this.handleOnline);
            window.addEventListener('offline', this.handleOffline);
        }

        this.initialised = true;
        dispatchSyncEvent('sommos:sync-ready', { dbName: this.dbName, storeName: this.storeName });
        return this;
    }

    async ensureInitialised() {
        if (!this.initialised || !this.db) {
            await this.initialize();
        }
    }

    destroy() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.handleOnline);
            window.removeEventListener('offline', this.handleOffline);
        }

        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        if (this.db) {
            this.db.close();
            this.db = null;
        }

        this.processing = false;
        this.initialised = false;
    }

    handleOnline() {
        dispatchSyncEvent('sommos:online');
        this.scheduleFlush(0);
    }

    handleOffline() {
        dispatchSyncEvent('sommos:offline');
    }

    async enqueue(operation = {}) {
        await this.ensureInitialised();

        if (!this.db) {
            throw new Error('Sync database is not available');
        }

        if (!operation.endpoint) {
            throw new Error('Cannot enqueue request without an endpoint');
        }

        const method = (operation.method || 'POST').toUpperCase();
        if (!MUTATION_METHODS.has(method)) {
            throw new Error(`Cannot enqueue ${method} request. Only POST, PUT, PATCH, and DELETE are supported.`);
        }

        const headers = normaliseHeaders(operation.headers);
        const syncContext = this.ensureSyncContext(operation.sync);
        const body = this.prepareBodyWithSync(operation.body, headers, syncContext);

        const record = {
            id: syncContext.op_id,
            endpoint: operation.endpoint,
            method,
            headers,
            body,
            sync: syncContext,
            queuedAt: Date.now(),
            attempts: operation.attempts || 0,
            lastError: null,
            nextAttemptAt: Date.now()
        };

        await this.db.put(this.storeName, record);

        dispatchSyncEvent('sommos:sync-queued', { id: record.id, endpoint: record.endpoint, method: record.method });
        this.scheduleFlush(0);

        return record;
    }

    async getAllRecords() {
        await this.ensureInitialised();
        if (!this.db) {
            return [];
        }

        return this.db.getAll(this.storeName);
    }

    async countRecords() {
        await this.ensureInitialised();
        if (!this.db) {
            return 0;
        }

        return this.db.count(this.storeName);
    }

    async removeRecord(id) {
        await this.ensureInitialised();
        if (!this.db) {
            return;
        }

        await this.db.delete(this.storeName, id);
    }

    async updateRecord(record) {
        await this.ensureInitialised();
        if (!this.db) {
            return;
        }

        await this.db.put(this.storeName, record);
    }

    getSyncManagerConfig() {
        return { ...this.syncManager };
    }

    updateSyncManagerConfig(newConfig) {
        this.syncManager = { ...this.syncManager, ...newConfig };
        dispatchSyncEvent('sommos:sync-config-updated', { config: this.syncManager });
    }

    async getSyncStatistics() {
        await this.ensureInitialised();
        if (!this.db) {
            return null;
        }

        const records = await this.getAllRecords();
        const now = Date.now();
        
        const stats = {
            totalRecords: records.length,
            pendingRecords: records.filter(r => (r.nextAttemptAt || 0) <= now).length,
            scheduledRecords: records.filter(r => (r.nextAttemptAt || 0) > now).length,
            retryAttempts: records.reduce((sum, r) => sum + (r.attempts || 0), 0),
            averageAttempts: records.length > 0 ? records.reduce((sum, r) => sum + (r.attempts || 0), 0) / records.length : 0,
            oldestRecord: records.length > 0 ? Math.min(...records.map(r => r.queuedAt)) : null,
            newestRecord: records.length > 0 ? Math.max(...records.map(r => r.queuedAt)) : null,
            errorTypes: {}
        };

        // Count error types
        records.forEach(record => {
            if (record.lastError) {
                const errorType = record.lastError.split(':')[0] || 'Unknown';
                stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
            }
        });

        return stats;
    }

    ensureSyncContext(sync = {}) {
        const now = Math.floor(Date.now() / 1000);
        const context = { ...sync };
        context.op_id = context.op_id || context.opId || generateOperationId();
        context.origin = context.origin || 'pwa';
        context.updated_by = context.updated_by || context.updatedBy || 'SommOS PWA';
        context.updated_at = context.updated_at || context.updatedAt || now;
        return context;
    }

    prepareBodyWithSync(body, headers, syncContext) {
        if (!body) {
            return body;
        }

        const contentType = headers['Content-Type'] || headers['content-type'] || '';
        const normalizedContentType = typeof contentType === 'string' ? contentType.toLowerCase() : '';
        const isJson = normalizedContentType.includes('application/json');

        if (!isJson) {
            return body;
        }

        try {
            if (typeof body === 'string') {
                const parsed = JSON.parse(body);
                if (!parsed || typeof parsed !== 'object') {
                    return body;
                }

                parsed.sync = { ...(parsed.sync || {}), ...syncContext };
                return JSON.stringify(parsed);
            }

            if (body && typeof body === 'object') {
                const payload = { ...body };
                payload.sync = { ...(payload.sync || {}), ...syncContext };
                return JSON.stringify(payload);
            }
        } catch (error) {
            console.warn('Failed to embed sync metadata into request body', error);
        }

        return body;
    }

    computeBackoffDelay(attempts = 1) {
        let baseDelay;
        
        switch (this.syncManager.backoffStrategy) {
            case 'exponential':
                baseDelay = this.baseDelay * (2 ** Math.max(0, attempts - 1));
                break;
            case 'linear':
                baseDelay = this.baseDelay * attempts;
                break;
            case 'fixed':
                baseDelay = this.baseDelay;
                break;
            default:
                baseDelay = this.baseDelay * (2 ** Math.max(0, attempts - 1));
        }
        
        const cappedDelay = Math.min(this.maxDelay, baseDelay);
        
        if (this.syncManager.jitterEnabled) {
            const jitter = Math.floor(Math.random() * this.syncManager.maxJitter);
            return cappedDelay + jitter;
        }
        
        return cappedDelay;
    }

    shouldRetryRequest(error, response = null) {
        if (!this.syncManager.retryFailedRequests) {
            return false;
        }

        // Check for retryable HTTP status codes
        if (response && response.status) {
            return this.syncManager.retryableStatusCodes.includes(response.status);
        }

        // Check for retryable error types
        if (error && error.name) {
            return this.syncManager.retryableErrors.includes(error.name);
        }

        // Check for network-related error messages
        if (error && error.message) {
            const message = error.message.toLowerCase();
            return message.includes('network') || 
                   message.includes('timeout') || 
                   message.includes('connection') ||
                   message.includes('fetch');
        }

        return false;
    }

    clearFlushTimer() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
    }

    scheduleFlush(delay = this.baseDelay) {
        this.clearFlushTimer();

        const effectiveDelay = Math.max(0, delay);
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.processQueue().catch((error) => {
                console.error('Sync queue processing failed', error);
                const retryDelay = this.computeBackoffDelay(1);
                this.scheduleFlush(retryDelay);
            });
        }, effectiveDelay);
    }

    async processQueue() {
        await this.ensureInitialised();

        if (!this.db) {
            return { processed: 0, pending: 0 };
        }

        if (this.processing) {
            return { processed: 0, pending: await this.countRecords() };
        }

        if (!this.api || typeof this.api.request !== 'function') {
            console.warn('Sync service has no API client. Queue cannot be processed.');
            return { processed: 0, pending: await this.countRecords() };
        }

        this.processing = true;

        try {
            const records = await this.getAllRecords();
            if (!records.length) {
                this.clearFlushTimer();
                return { processed: 0, pending: 0 };
            }

            records.sort((a, b) => {
                const aTime = a.nextAttemptAt || a.queuedAt || 0;
                const bTime = b.nextAttemptAt || b.queuedAt || 0;
                return aTime - bTime;
            });

            let processed = 0;
            let earliestRetry = null;
            const now = Date.now();

            for (const record of records) {
                const dueAt = record.nextAttemptAt || 0;
                if (dueAt > now) {
                    earliestRetry = earliestRetry === null ? dueAt : Math.min(earliestRetry, dueAt);
                    continue;
                }

                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    earliestRetry = earliestRetry === null ? now + this.baseDelay : earliestRetry;
                    break;
                }

                const preparedBody = this.prepareBodyWithSync(record.body, record.headers, record.sync);
                if (preparedBody !== record.body) {
                    record.body = preparedBody;
                    await this.updateRecord(record);
                }

                try {
                    const response = await this.api.request(record.endpoint, {
                        method: record.method,
                        headers: record.headers,
                        body: record.body,
                        sync: record.sync,
                        skipQueue: true,
                        allowQueue: false
                    });

                    await this.removeRecord(record.id);
                    processed += 1;
                    dispatchSyncEvent('sommos:sync-processed', { 
                        id: record.id, 
                        endpoint: record.endpoint, 
                        method: record.method,
                        attempts: record.attempts || 0
                    });
                } catch (error) {
                    const attempts = (record.attempts || 0) + 1;
                    record.attempts = attempts;
                    record.lastError = error?.message || String(error);

                    // Check if we should retry this request
                    const shouldRetry = this.shouldRetryRequest(error, error.response);
                    const maxRetries = this.syncManager.maxRetries;

                    if (!shouldRetry || attempts >= maxRetries) {
                        await this.removeRecord(record.id);
                        dispatchSyncEvent('sommos:sync-discarded', {
                            id: record.id,
                            endpoint: record.endpoint,
                            method: record.method,
                            attempts,
                            error: record.lastError,
                            reason: !shouldRetry ? 'non-retryable-error' : 'max-retries-exceeded'
                        });
                        continue;
                    }

                    const backoffDelay = this.computeBackoffDelay(attempts);
                    record.nextAttemptAt = Date.now() + backoffDelay;
                    await this.updateRecord(record);
                    
                    dispatchSyncEvent('sommos:sync-retry-scheduled', {
                        id: record.id,
                        endpoint: record.endpoint,
                        method: record.method,
                        attempts,
                        nextAttemptAt: record.nextAttemptAt,
                        backoffDelay,
                        error: record.lastError
                    });

                    earliestRetry = earliestRetry === null
                        ? record.nextAttemptAt
                        : Math.min(earliestRetry, record.nextAttemptAt);
                    break;
                }
            }

            const pending = await this.countRecords();

            if (pending === 0) {
                this.clearFlushTimer();
                dispatchSyncEvent('sommos:sync-empty');
            } else if (earliestRetry !== null) {
                const delay = Math.max(earliestRetry - Date.now(), this.baseDelay);
                this.scheduleFlush(delay);
            }

            return { processed, pending };
        } finally {
            this.processing = false;
        }
    }
}
