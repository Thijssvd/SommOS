/**
 * Background Sync Queue Manager
 * Queues operations when offline and syncs them when connection is restored
 */

export class BackgroundSyncQueue {
    constructor() {
        this.dbName = 'sommos-sync-queue';
        this.storeName = 'operations';
        this.db = null;
        this.initialized = false;
        
        // Listen for sync completion messages from service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SYNC_COMPLETE') {
                    this.handleSyncComplete(event.data.results);
                }
            });
        }
    }

    /**
     * Initialize the IndexedDB database
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => {
                console.error('[BackgroundSync] Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.initialized = true;
                console.log('[BackgroundSync] Database initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    console.log('[BackgroundSync] Object store created');
                }
            };
        });
    }

    /**
     * Queue an operation for background sync
     */
    async queueOperation(url, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const operation = {
            url,
            method: options.method || 'POST',
            headers: options.headers || { 'Content-Type': 'application/json' },
            body: options.body,
            timestamp: Date.now(),
            retryCount: 0
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(operation);

            request.onerror = () => {
                console.error('[BackgroundSync] Failed to queue operation:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                const id = request.result;
                console.log('[BackgroundSync] Operation queued:', id);
                
                // Register for background sync
                this.requestBackgroundSync();
                
                resolve(id);
            };
        });
    }

    /**
     * Request background sync from service worker
     */
    async requestBackgroundSync() {
        if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
            console.warn('[BackgroundSync] Background Sync API not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Try to register sync event
            if (registration.sync) {
                await registration.sync.register('sync-queue');
                console.log('[BackgroundSync] Background sync registered');
            } else {
                // Fallback: send message to service worker
                registration.active.postMessage({ type: 'QUEUE_SYNC' });
            }
        } catch (error) {
            console.error('[BackgroundSync] Failed to register background sync:', error);
        }
    }

    /**
     * Get all queued operations
     */
    async getQueue() {
        if (!this.initialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    /**
     * Get queue count
     */
    async getQueueCount() {
        if (!this.initialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.count();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    /**
     * Remove an operation from the queue
     */
    async removeFromQueue(id) {
        if (!this.initialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('[BackgroundSync] Operation removed from queue:', id);
                resolve();
            };
        });
    }

    /**
     * Clear all queued operations
     */
    async clearQueue() {
        if (!this.initialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('[BackgroundSync] Queue cleared');
                resolve();
            };
        });
    }

    /**
     * Handle sync completion from service worker
     */
    handleSyncComplete(results) {
        console.log('[BackgroundSync] Sync completed:', results);
        
        const successCount = results.filter(r => r.status === 'success').length;
        const failureCount = results.filter(r => r.status !== 'success').length;
        
        // Dispatch custom event for UI notification
        window.dispatchEvent(new CustomEvent('background-sync-complete', {
            detail: {
                total: results.length,
                success: successCount,
                failed: failureCount,
                results
            }
        }));
        
        if (successCount > 0) {
            console.log(`[BackgroundSync] ✅ ${successCount} operations synced successfully`);
        }
        
        if (failureCount > 0) {
            console.warn(`[BackgroundSync] ⚠️  ${failureCount} operations failed to sync`);
        }
    }

    /**
     * Retry failed operations manually
     */
    async retryFailedOperations() {
        const queue = await this.getQueue();
        const failedOps = queue.filter(op => op.retryCount > 0);
        
        if (failedOps.length === 0) {
            console.log('[BackgroundSync] No failed operations to retry');
            return;
        }
        
        console.log(`[BackgroundSync] Retrying ${failedOps.length} failed operations...`);
        await this.requestBackgroundSync();
    }

    /**
     * Check if Background Sync is supported
     */
    static isSupported() {
        return 'serviceWorker' in navigator && 'SyncManager' in window;
    }

    /**
     * Get queue status summary
     */
    async getStatus() {
        const count = await this.getQueueCount();
        const queue = await this.getQueue();
        
        return {
            count,
            supported: BackgroundSyncQueue.isSupported(),
            operations: queue.map(op => ({
                id: op.id,
                url: op.url,
                method: op.method,
                timestamp: op.timestamp,
                retryCount: op.retryCount
            }))
        };
    }
}

// Export singleton instance
export const backgroundSyncQueue = new BackgroundSyncQueue();
export default backgroundSyncQueue;
