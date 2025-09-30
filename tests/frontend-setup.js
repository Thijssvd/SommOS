// Frontend-specific Jest setup for JSDOM environment
// Fixes TextEncoder/TextDecoder issues

// Import polyfills that were set in main setup
// They need to be explicitly available in JSDOM environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock JSDOM-specific requirements that the WHATWG URL package needs
if (typeof global.URL === 'undefined') {
    const { URL, URLSearchParams } = require('url');
    global.URL = URL;
    global.URLSearchParams = URLSearchParams;
}

// Mock the crypto API for JSDOM
Object.defineProperty(global, 'crypto', {
    value: {
        getRandomValues: (arr) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        }
    }
});

// Mock additional browser APIs that might be needed
global.ResizeObserver = class ResizeObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock IndexedDB for JSDOM
if (typeof indexedDB === 'undefined') {
    // Mock IDBOpenDBRequest
    global.IDBOpenDBRequest = class {
        constructor() {
            this.onerror = null;
            this.onsuccess = null;
            this.onupgradeneeded = null;
            this.result = null;
        }
    };
    
    // Mock IDBDatabase
    global.IDBDatabase = class {
        constructor() {
            this.version = 1;
            this.objectStoreNames = [];
        }
        
        createObjectStore(name, options) {
            return {
                add: () => ({ onsuccess: null, onerror: null }),
                put: () => ({ onsuccess: null, onerror: null }),
                get: () => ({ onsuccess: null, onerror: null }),
                delete: () => ({ onsuccess: null, onerror: null }),
                clear: () => ({ onsuccess: null, onerror: null }),
                createIndex: () => ({})
            };
        }
        
        transaction(stores, mode) {
            return {
                objectStore: (name) => ({
                    add: () => ({ onsuccess: null, onerror: null }),
                    put: () => ({ onsuccess: null, onerror: null }),
                    get: () => ({ onsuccess: null, onerror: null }),
                    delete: () => ({ onsuccess: null, onerror: null }),
                    clear: () => ({ onsuccess: null, onerror: null })
                })
            };
        }
    };
    
    global.indexedDB = {
        open: (name, version) => {
            const request = new global.IDBOpenDBRequest();
            // Simulate async behavior
            setTimeout(() => {
                if (request.onupgradeneeded) {
                    const event = { target: { result: new global.IDBDatabase() } };
                    request.onupgradeneeded(event);
                }
                if (request.onsuccess) {
                    const event = { target: { result: new global.IDBDatabase() } };
                    request.onsuccess(event);
                }
            }, 0);
            return request;
        },
        deleteDatabase: () => ({ onsuccess: null, onerror: null })
    };
}

// Load and expose frontend classes to global scope for JSDOM tests
const fs = require('fs');
const path = require('path');

// Mock Chart.js for frontend tests
global.Chart = class Chart {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.destroy = jest.fn();
        this.update = jest.fn();
        this.resize = jest.fn();
    }
};

// Load frontend JavaScript files and expose classes
try {
    // Load API class
    const apiPath = path.join(__dirname, '../frontend/js/api.js');
    if (fs.existsSync(apiPath)) {
        const apiCode = fs.readFileSync(apiPath, 'utf8');
        // Replace ES6 imports and exports with CommonJS compatible code
        const mockApiCode = apiCode
            .replace(/import.*from.*chart\.js.*/g, '// Chart.js mocked above')
            .replace(/import\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"];?/g, '// Imports mocked above')
            .replace(/export\s+class\s+(\w+)/g, 'class $1')
            .replace(/export\s*{([^}]+)}/g, '// Exports handled below')
            .replace(/import\.meta\.url/g, '""')
            .replace(/import\.meta\.env/g, '{}')
            .replace(/import\.meta/g, '{}');
        
        // Evaluate the code in global scope
        eval(mockApiCode);
        
        // Expose classes to global scope
        if (typeof SommOSAPI !== 'undefined') {
            global.SommOSAPI = SommOSAPI;
        }
    }
    
    // Load UI class
    const uiPath = path.join(__dirname, '../frontend/js/ui.js');
    if (fs.existsSync(uiPath)) {
        const uiCode = fs.readFileSync(uiPath, 'utf8');
        const mockUiCode = uiCode
            .replace(/import\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"];?/g, '// Imports mocked above')
            .replace(/export\s+class\s+(\w+)/g, 'class $1')
            .replace(/export\s*{([^}]+)}/g, '// Exports handled below')
            .replace(/import\.meta\.url/g, '""')
            .replace(/import\.meta\.env/g, '{}')
            .replace(/import\.meta/g, '{}');
        
        eval(mockUiCode);
        
        if (typeof SommOSUI !== 'undefined') {
            global.SommOSUI = SommOSUI;
        }
    }
    
    // Load main app class
    const appPath = path.join(__dirname, '../frontend/js/app.js');
    if (fs.existsSync(appPath)) {
        const appCode = fs.readFileSync(appPath, 'utf8');
        const mockAppCode = appCode
            .replace(/import\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"];?/g, '// Imports mocked above')
            .replace(/export\s+class\s+(\w+)/g, 'class $1')
            .replace(/export\s*{([^}]+)}/g, '// Exports handled below')
            .replace(/import\.meta\.url/g, '""')
            .replace(/import\.meta\.env/g, '{}')
            .replace(/import\.meta/g, '{}');
        
        eval(mockAppCode);
        
        if (typeof SommOS !== 'undefined') {
            global.SommOS = SommOS;
        }
    }
    
    console.log('Frontend classes loaded successfully for JSDOM tests');
} catch (error) {
    console.warn('Failed to load frontend classes for JSDOM tests:', error.message);
    
    // Fallback: Create minimal mock classes
    global.SommOSAPI = class SommOSAPI {
        constructor() {
            this.baseURL = 'http://localhost:3001/api';
        }
        async request() { return { success: true, data: [] }; }
        async getInventory() { return { success: true, data: [] }; }
        async getPairings() { return { success: true, data: [] }; }
    };
    
    global.SommOSUI = class SommOSUI {
        showToast() {}
        showModal() {}
        showLoading() {}
        hideLoading() {}
        debounce() { return (fn) => fn; }
    };
    
    global.SommOS = class SommOS {
        constructor() {
            this.api = new global.SommOSAPI();
            this.ui = new global.SommOSUI();
        }
        async init() {}
        navigateToView() {}
        loadInventory() {}
    };
}
