// SommOS Configuration
// API base URL configuration for different environments

window.__SOMMOS_API_BASE__ = window.__SOMMOS_API_BASE__ || (function () {
    const { protocol, hostname, port } = window.location;
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '3000') {
        return `${protocol}//${hostname}:3001/api`;
    }
    const origin = window.location.origin.endsWith('/')
        ? window.location.origin.slice(0, -1)
        : window.location.origin;
    return `${origin}/api`;
})();