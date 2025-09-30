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
