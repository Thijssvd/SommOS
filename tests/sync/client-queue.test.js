/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

class MockStore {
    constructor() {
        this.records = new Map();
    }

    put(record) {
        this.records.set(record.id, { ...record });
    }

    getAll() {
        return Array.from(this.records.values()).map((value) => ({ ...value }));
    }

    delete(id) {
        this.records.delete(id);
    }

    count() {
        return this.records.size;
    }
}

class MockIDBDatabase {
    constructor() {
        this.stores = new Map();
        this.objectStoreNames = {
            contains: (name) => this.stores.has(name)
        };
        this.version = 1;
    }

    createObjectStore(name) {
        const store = new MockStore();
        this.stores.set(name, store);
        return {
            createIndex: () => {}
        };
    }

    ensureStore(name) {
        if (!this.stores.has(name)) {
            this.createObjectStore(name);
        }
    }

    async put(name, value) {
        this.ensureStore(name);
        this.stores.get(name).put(value);
    }

    async getAll(name) {
        this.ensureStore(name);
        return this.stores.get(name).getAll();
    }

    async delete(name, id) {
        this.ensureStore(name);
        this.stores.get(name).delete(id);
    }

    async count(name) {
        this.ensureStore(name);
        return this.stores.get(name).count();
    }

    close() {}
}

const mockOpenDB = jest.fn(async (name, version, options = {}) => {
    const db = new MockIDBDatabase();
    db.version = version || db.version;

    if (options && typeof options.upgrade === 'function') {
        options.upgrade(db);
    }

    return db;
});

jest.mock('idb', () => ({
    openDB: (...args) => mockOpenDB(...args)
}), { virtual: true });

describe('SommOS offline sync client queue', () => {
    let SommOSSyncService;
    let SommOSAPI;

    const loadModuleAsCommonJS = (relativePath, options = {}) => {
        const filePath = path.join(__dirname, '../../frontend/js', relativePath);
        let source = fs.readFileSync(filePath, 'utf8');

        const transforms = options.transforms || [];
        transforms.forEach(({ pattern, replacement }) => {
            source = source.replace(pattern, replacement);
        });

        if (options.defineImportMeta) {
            source = source.replace(/import\.meta/g, 'importMeta');
            source = `const importMeta = { env: {} };\n${source}`;
        }

        const exportedClasses = [];
        source = source.replace(/export class\s+([A-Za-z0-9_]+)/g, (_, className) => {
            exportedClasses.push(className);
            return `class ${className}`;
        });

        source += `\nmodule.exports = { ${exportedClasses.join(', ')} };`;

        const module = { exports: {} };
        const wrapper = new Function('require', 'module', 'exports', '__dirname', '__filename', source);
        wrapper(require, module, module.exports, path.dirname(filePath), filePath);
        return module.exports;
    };

    beforeAll(async () => {
        global.indexedDB = {};
        global.crypto = global.crypto || require('crypto').webcrypto;
        global.fetch = jest.fn();

        const syncModule = loadModuleAsCommonJS('sync.js', {
            transforms: [{ pattern: /import \{ openDB \} from 'idb';/, replacement: 'const { openDB } = require("idb");' }]
        });

        const apiModule = loadModuleAsCommonJS('api.js', { defineImportMeta: true });

        SommOSSyncService = syncModule.SommOSSyncService;
        SommOSAPI = apiModule.SommOSAPI;
    });

    afterAll(() => {
        delete global.indexedDB;
    });

    beforeEach(() => {
        mockOpenDB.mockClear();
        if (!console.warn.mockRestore) {
            jest.spyOn(console, 'warn').mockImplementation(() => {});
        }
        if (!console.error.mockRestore) {
            jest.spyOn(console, 'error').mockImplementation(() => {});
        }
        if (!console.log.mockRestore) {
            jest.spyOn(console, 'log').mockImplementation(() => {});
        }
    });

    afterEach(() => {
        jest.useRealTimers();
        if (console.warn.mockRestore) {
            console.warn.mockRestore();
        }
        if (console.error.mockRestore) {
            console.error.mockRestore();
        }
        if (console.log.mockRestore) {
            console.log.mockRestore();
        }
        delete navigator.onLine;
    });

    const setNavigatorOnlineState = (value) => {
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            get: () => value
        });
    };

    test('enqueues POST mutations while offline', async () => {
        setNavigatorOnlineState(false);
        const syncService = new SommOSSyncService();
        await syncService.initialize({ dbName: 'test-db-offline' });

        const api = new SommOSAPI();
        api.setSyncService(syncService);

        const payload = {
            method: 'POST',
            body: JSON.stringify({ vintage_id: 42, quantity: 1 }),
            headers: { 'Content-Type': 'application/json' }
        };

        const response = await api.request('/inventory/consume', payload);

        expect(response).toEqual({ success: true, queued: true, offline: true });

        const records = await syncService.getAllRecords();
        expect(records).toHaveLength(1);
        expect(records[0].endpoint).toBe('/inventory/consume');
        expect(JSON.parse(records[0].body)).toMatchObject({ vintage_id: 42, quantity: 1, sync: expect.any(Object) });
    });

    test('flushes queued operations when connection returns', async () => {
        jest.useFakeTimers();
        const syncService = new SommOSSyncService({ api: { request: jest.fn().mockResolvedValue({ ok: true }) } });
        await syncService.initialize({ dbName: 'test-db-flush' });

        setNavigatorOnlineState(false);
        await syncService.enqueue({
            endpoint: '/inventory/consume',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vintage_id: 7, quantity: 2 })
        });

        expect(await syncService.countRecords()).toBe(1);

        setNavigatorOnlineState(true);
        syncService.handleOnline();

        jest.runOnlyPendingTimers();
        await syncService.processQueue();

        expect(syncService.api.request).toHaveBeenCalledTimes(1);
        expect(await syncService.countRecords()).toBe(0);
    });

    test('deduplicates queued operations sharing the same op_id', async () => {
        setNavigatorOnlineState(false);
        const syncService = new SommOSSyncService();
        await syncService.initialize({ dbName: 'test-db-dedupe' });

        const duplicateOpId = 'op-duplicate-test';

        await syncService.enqueue({
            endpoint: '/inventory/consume',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vintage_id: 10, quantity: 1 }),
            sync: { op_id: duplicateOpId, updated_at: Math.floor(Date.now() / 1000) }
        });

        await syncService.enqueue({
            endpoint: '/inventory/consume',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vintage_id: 10, quantity: 2 }),
            sync: { op_id: duplicateOpId, updated_at: Math.floor(Date.now() / 1000) }
        });

        const records = await syncService.getAllRecords();
        expect(records).toHaveLength(1);
        expect(JSON.parse(records[0].body)).toMatchObject({ vintage_id: 10, quantity: 2, sync: expect.any(Object) });
    });
});
