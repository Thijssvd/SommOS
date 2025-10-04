/**
 * SommOS API Configuration
 * 
 * Configures the API base URL based on the environment.
 * This replaces the inline script to comply with strict Content Security Policy.
 * 
 * In development (localhost):
 *   - Uses http://localhost:3001/api (separate backend port)
 * 
 * In production:
 *   - Uses the same origin with /api path
 * 
 * The configuration is stored in window.__SOMMOS_API_BASE__ for backward compatibility.
 */
(function() {
    'use strict';
    
    const { protocol, hostname, port } = window.location;
    
    // Determine if we're running on localhost
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    
    // Configure API base URL
    let apiBaseUrl;
    
    if (isLocalhost && port === '3000') {
        // Development: frontend on port 3000, backend on port 3001
        apiBaseUrl = `${protocol}//${hostname}:3001/api`;
    } else {
        // Production or other environments: use same origin
        const origin = window.location.origin.endsWith('/')
            ? window.location.origin.slice(0, -1)
            : window.location.origin;
        apiBaseUrl = `${origin}/api`;
    }
    
    // Set global API base URL (backward compatible)
    window.__SOMMOS_API_BASE__ = apiBaseUrl;
    
    // Log configuration in development
    if (isLocalhost) {
        console.log('🔧 SommOS API Configuration:', {
            environment: port === '3000' ? 'development' : 'production',
            apiBaseUrl: apiBaseUrl
        });
    }
})();
