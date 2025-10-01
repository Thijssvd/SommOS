/**
 * Example usage of advanced pre-caching functionality
 * This demonstrates how to use the PrecacheManager in your application
 */

import { precacheManager } from './precache-utils.js';

// Example: Initialize pre-caching on app startup
async function initializePrecaching() {
  console.log('Initializing advanced pre-caching...');
  
  try {
    // Check current cache status
    const cacheStatus = await precacheManager.isCriticalApiCached();
    console.log('Cache status:', cacheStatus);
    
    // Pre-warm critical API routes
    const preWarmResult = await precacheManager.preWarmCriticalApi();
    console.log('Pre-warm result:', preWarmResult);
    
    // Get cache statistics
    const stats = await precacheManager.getCacheStatistics();
    if (stats) {
      console.log('Cache statistics:', stats);
    }
    
  } catch (error) {
    console.error('Failed to initialize pre-caching:', error);
  }
}

// Example: Listen for critical API refresh events
function setupRefreshListeners() {
  precacheManager.listenForRefreshEvents((event) => {
    console.log('Critical API data refreshed:', event);
    
    // Update UI to reflect fresh data
    updateUIWithFreshData();
  });
}

// Example: Manual refresh of critical API data
async function refreshCriticalData() {
  try {
    console.log('Manually refreshing critical API data...');
    await precacheManager.refreshCriticalApiData();
  } catch (error) {
    console.error('Failed to refresh critical API data:', error);
  }
}

// Example: Check cache status before making API calls
async function getInventoryData() {
  const cacheStatus = await precacheManager.isCriticalApiCached();
  
  if (cacheStatus.allCached) {
    console.log('All critical API data is cached, app can work offline');
  } else {
    console.log('Some critical API data missing:', cacheStatus.missingRoutes);
  }
  
  // Make your API call here
  // The service worker will handle caching automatically
}

// Example: Clear cache when needed
async function clearCriticalCache() {
  const cleared = await precacheManager.clearCriticalApiCache();
  if (cleared) {
    console.log('Critical API cache cleared successfully');
  } else {
    console.log('Failed to clear critical API cache');
  }
}

// Example: Update UI with fresh data
function updateUIWithFreshData() {
  // This would typically update your application's UI
  // to reflect that fresh data is available
  console.log('UI updated with fresh critical API data');
}

// Example: Setup periodic cache refresh
function setupPeriodicRefresh() {
  // Refresh critical API data every 5 minutes
  setInterval(async () => {
    try {
      await precacheManager.refreshCriticalApiData();
    } catch (error) {
      console.warn('Periodic refresh failed:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Example: Initialize everything when the app starts
document.addEventListener('DOMContentLoaded', () => {
  initializePrecaching();
  setupRefreshListeners();
  setupPeriodicRefresh();
});

// Export functions for use in other modules
export {
  initializePrecaching,
  setupRefreshListeners,
  refreshCriticalData,
  getInventoryData,
  clearCriticalCache,
  setupPeriodicRefresh
};