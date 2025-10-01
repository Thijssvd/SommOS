/**
 * Pre-caching utilities for critical API routes
 * Provides functions to manage and refresh critical API data
 */

export class PrecacheManager {
  constructor() {
    this.criticalApiRoutes = [
      '/api/inventory/stock',
      '/api/wines/catalog',
      '/api/system/health'
    ];
  }

  /**
   * Register background sync for critical API refresh
   */
  async registerCriticalApiRefresh() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('critical-api-refresh');
        console.log('Critical API refresh sync registered');
      } catch (error) {
        console.warn('Failed to register critical API refresh sync:', error);
      }
    }
  }

  /**
   * Manually trigger critical API refresh
   */
  async refreshCriticalApiData() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          registration.active.postMessage({
            type: 'REFRESH_CRITICAL_API'
          });
          console.log('Critical API refresh triggered');
        }
      } catch (error) {
        console.warn('Failed to trigger critical API refresh:', error);
      }
    }
  }

  /**
   * Check if critical API data is cached
   */
  async isCriticalApiCached() {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        const criticalApiCacheName = cacheNames.find(name => name.includes('critical-api'));
        
        if (criticalApiCacheName) {
          const cache = await caches.open(criticalApiCacheName);
          const cachedRoutes = await Promise.all(
            this.criticalApiRoutes.map(async (route) => {
              const response = await cache.match(route);
              return { route, cached: !!response };
            })
          );
          
          return {
            allCached: cachedRoutes.every(r => r.cached),
            cachedRoutes: cachedRoutes.filter(r => r.cached).map(r => r.route),
            missingRoutes: cachedRoutes.filter(r => !r.cached).map(r => r.route)
          };
        }
      } catch (error) {
        console.warn('Failed to check critical API cache:', error);
      }
    }
    
    return { allCached: false, cachedRoutes: [], missingRoutes: this.criticalApiRoutes };
  }

  /**
   * Get cache statistics for critical API routes
   */
  async getCacheStatistics() {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        const criticalApiCacheName = cacheNames.find(name => name.includes('critical-api'));
        
        if (criticalApiCacheName) {
          const cache = await caches.open(criticalApiCacheName);
          const requests = await cache.keys();
          
          const stats = {
            cacheName: criticalApiCacheName,
            totalEntries: requests.length,
            routes: {}
          };
          
          for (const route of this.criticalApiRoutes) {
            const response = await cache.match(route);
            if (response) {
              const headers = response.headers;
              stats.routes[route] = {
                cached: true,
                lastModified: headers.get('last-modified'),
                etag: headers.get('etag'),
                contentLength: headers.get('content-length'),
                cacheControl: headers.get('cache-control')
              };
            } else {
              stats.routes[route] = { cached: false };
            }
          }
          
          return stats;
        }
      } catch (error) {
        console.warn('Failed to get cache statistics:', error);
      }
    }
    
    return null;
  }

  /**
   * Clear critical API cache
   */
  async clearCriticalApiCache() {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        const criticalApiCacheName = cacheNames.find(name => name.includes('critical-api'));
        
        if (criticalApiCacheName) {
          await caches.delete(criticalApiCacheName);
          console.log('Critical API cache cleared');
          return true;
        }
      } catch (error) {
        console.warn('Failed to clear critical API cache:', error);
      }
    }
    
    return false;
  }

  /**
   * Listen for critical API refresh events
   */
  listenForRefreshEvents(callback) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CRITICAL_API_REFRESHED') {
          callback(event.data);
        }
      });
    }
  }

  /**
   * Pre-warm critical API routes (useful for app startup)
   */
  async preWarmCriticalApi() {
    console.log('Pre-warming critical API routes...');
    
    try {
      // Check current cache status
      const cacheStatus = await this.isCriticalApiCached();
      
      if (!cacheStatus.allCached) {
        console.log('Some critical API routes not cached, triggering refresh');
        await this.refreshCriticalApiData();
      } else {
        console.log('All critical API routes already cached');
      }
      
      return cacheStatus;
    } catch (error) {
      console.warn('Failed to pre-warm critical API:', error);
      return { allCached: false, cachedRoutes: [], missingRoutes: this.criticalApiRoutes };
    }
  }
}

// Create a singleton instance
export const precacheManager = new PrecacheManager();

// Auto-register critical API refresh on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    precacheManager.registerCriticalApiRefresh();
  });
}