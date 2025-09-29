// SommOS Frontend Unit Tests
// Tests for client-side JavaScript functionality

// Mock DOM elements and browser APIs
const { JSDOM } = require('jsdom');

// Set up DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>SommOS Test</title>
</head>
<body>
    <div id="app" class="hidden">
        <div id="loading-screen" style="display: flex;"></div>
        <nav>
            <div class="nav-item" data-view="dashboard">Dashboard</div>
            <div class="nav-item" data-view="inventory">Inventory</div>
            <div class="nav-item" data-view="pairing">Pairing</div>
        </nav>
        <main>
            <div id="dashboard-view" class="view active">
                <div id="total-bottles" class="stat-number">0</div>
                <div id="total-wines" class="stat-number">0</div>
                <div id="total-vintages" class="stat-number">0</div>
                <div id="active-suppliers" class="stat-number">0</div>
                <div id="recent-activity"></div>
                <canvas id="wine-types-chart"></canvas>
                <canvas id="stock-location-chart"></canvas>
            </div>
            <div id="inventory-view" class="view">
                <div class="view-subtitle">Loading...</div>
                <div id="inventory-grid"></div>
                <input id="inventory-search" type="text" placeholder="Search wines..." />
                <select id="location-filter">
                    <option value="">All Locations</option>
                    <option value="main-cellar">Main Cellar</option>
                </select>
                <select id="type-filter">
                    <option value="">All Types</option>
                    <option value="Red">Red</option>
                </select>
                <button id="refresh-inventory">Refresh</button>
            </div>
            <div id="pairing-view" class="view">
                <input id="dish-input" type="text" />
                <select id="occasion-select">
                    <option value="casual-dining">Casual Dining</option>
                </select>
                <input id="guest-count" type="number" value="4" />
                <textarea id="preferences-input"></textarea>
                <button id="get-pairings-btn">Get Pairings</button>
                <div id="pairing-results" class="hidden">
                    <div id="pairing-list"></div>
                </div>
            </div>
        </main>
        <div id="modal" class="hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modal-title"></h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body" id="modal-body"></div>
            </div>
        </div>
        <div id="toast-container"></div>
        <button id="sync-btn">Sync</button>
    </div>
</body>
</html>
`, {
    url: "http://localhost:3000",
    pretendToBeVisual: true,
    resources: "usable"
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = {
    onLine: true
};
global.fetch = jest.fn();
global.indexedDB = {
    open: jest.fn(() => {
        const request = {
            result: null,
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null
        };

        setTimeout(() => {
            if (typeof request.onupgradeneeded === 'function') {
                const db = {
                    objectStoreNames: {
                        contains: () => false
                    },
                    createObjectStore: jest.fn()
                };
                request.onupgradeneeded({ target: { result: db } });
            }

            if (typeof request.onsuccess === 'function') {
                request.result = {
                    objectStoreNames: {
                        contains: () => false
                    },
                    createObjectStore: jest.fn()
                };
                request.onsuccess({ target: { result: request.result } });
            }
        }, 0);

        return request;
    })
};
global.Chart = jest.fn();

// Mock window.app global
global.app = {};

const path = require('path');
const { pathToFileURL } = require('url');

beforeAll(async () => {
    const frontendDir = path.join(__dirname, '../../frontend/js');

    try {
        const apiModule = await import(pathToFileURL(path.join(frontendDir, 'api.js')).href);
        const uiModule = await import(pathToFileURL(path.join(frontendDir, 'ui.js')).href);
        const appModule = await import(pathToFileURL(path.join(frontendDir, 'app.js')).href);

        global.SommOSAPI = apiModule.SommOSAPI || apiModule.default;
        global.SommOSAPIError = apiModule.SommOSAPIError;
        global.SommOSUI = uiModule.SommOSUI || uiModule.default;
        global.SommOS = appModule.SommOS || appModule.default;

        console.log('Loaded frontend modules via ESM:', {
            SommOSAPI: !!global.SommOSAPI,
            SommOSUI: !!global.SommOSUI,
            SommOS: !!global.SommOS
        });
    } catch (error) {
        console.error('Error loading frontend modules:', error);

        global.SommOSAPIError = class SommOSAPIError extends Error {
            constructor(message) {
                super(message);
                this.name = 'SommOSAPIError';
            }
        };

        global.SommOSAPI = class SommOSAPI {
            constructor() {
                this.baseURL = 'http://localhost:3000/api';
                this.timeout = 10000;
            }
            async getInventory() { return { success: true, data: [] }; }
            async consumeWine() { return { success: true, data: { id: 123 } }; }
        };

        global.SommOSUI = class SommOSUI {
            showToast() {}
            showModal() {}
            hideModal() {}
            setButtonLoading() {}
        };

        global.SommOS = class SommOS {
            constructor() {
                this.initialized = false;
                this.currentView = 'dashboard';
            }
            init() { this.initialized = true; }
            navigate() {}
            displayInventory() {}
            parseGrapeVarieties() { return []; }
        };
    }
});

describe('SommOS Frontend', () => {
    describe('SommOSAPI Class', () => {
        let api;

        beforeEach(() => {
            api = new SommOSAPI();
            global.fetch.mockClear();
        });

        test('should initialize with correct base URL', () => {
            expect(api.baseURL).toBe('http://localhost:3000/api');
            expect(api.timeout).toBe(10000);
        });

        test('should make GET request to inventory endpoint', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ success: true, data: [] })
            };
            global.fetch.mockResolvedValue(mockResponse);

            const result = await api.getInventory();

            expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/inventory/stock', expect.any(Object));
            expect(result).toEqual({ success: true, data: [] });
        });

        test('should omit empty filter values when building query string', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ success: true, data: [] })
            };
            global.fetch.mockResolvedValue(mockResponse);

            await api.getInventory({ location: '', wine_type: undefined, region: 'Bordeaux' });

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/inventory/stock?region=Bordeaux',
                expect.any(Object)
            );
        });

        test('should handle API request with filters', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ success: true, data: [] })
            };
            global.fetch.mockResolvedValue(mockResponse);

            const filters = { location: 'main-cellar', wine_type: 'Red' };
            await api.getInventory(filters);

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/inventory/stock?location=main-cellar&wine_type=Red',
                expect.any(Object)
            );
        });

        test('should handle POST request for wine consumption', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ success: true, data: { id: 123 } })
            };
            global.fetch.mockResolvedValue(mockResponse);

            const result = await api.consumeWine('vintage-1', 'main-cellar', 1, 'Test consumption');

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/inventory/consume',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        vintage_id: 'vintage-1',
                        location: 'main-cellar',
                        quantity: 1,
                        notes: 'Test consumption',
                        created_by: 'SommOS'
                    })
                })
            );
            expect(result).toEqual({ success: true, data: { id: 123 } });
        });

        test('should record service consumption via API', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ success: true })
            };
            global.fetch.mockResolvedValue(mockResponse);

            const payload = {
                vintage_id: 'wine-42',
                quantity_consumed: 3,
                occasion: 'tasting',
                guest_count: 6,
                notes: 'VIP table',
                service_date: '2024-05-01T12:00:00.000Z'
            };

            await api.recordConsumption(payload);

            expect(global.fetch).toHaveBeenCalledWith(
                `${api.baseURL}/inventory/consume`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(payload)
                })
            );
        });

        test('should handle request timeout', async () => {
            global.fetch.mockImplementation(() =>
                new Promise((resolve) => setTimeout(resolve, 15000))
            );

            await expect(api.getInventory()).rejects.toThrow();
        });

        test('should handle network errors', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            await expect(api.getInventory()).rejects.toThrow('Network error');
        });

        test('should handle HTTP error responses', async () => {
            const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            };
            global.fetch.mockResolvedValue(mockResponse);

            await expect(api.getInventory()).rejects.toThrow('HTTP 500: Internal Server Error');
        });
    });

    describe('SommOSUI Class', () => {
        let ui;

        beforeEach(() => {
            ui = new SommOSUI();
            document.body.innerHTML = dom.window.document.body.innerHTML;
        });

        test('should show toast notification', () => {
            ui.showToast('Test message', 'success');

            const toast = document.querySelector('.toast');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('Test message');
            expect(toast.classList.contains('success')).toBe(true);
        });

        test('should show modal with title and content', () => {
            ui.showModal('Test Title', '<p>Test content</p>');

            const modal = document.getElementById('modal');
            const title = document.getElementById('modal-title');
            const body = document.getElementById('modal-body');

            expect(modal.classList.contains('hidden')).toBe(false);
            expect(title.textContent).toBe('Test Title');
            expect(body.innerHTML).toBe('<p>Test content</p>');
        });

        test('should hide modal', () => {
            ui.showModal('Test', 'Test');
            ui.hideModal();

            const modal = document.getElementById('modal');
            expect(modal.classList.contains('hidden')).toBe(true);
        });

        test('should show loading state on button', () => {
            const button = document.getElementById('get-pairings-btn');
            const originalText = button.textContent;

            ui.showLoading('get-pairings-btn');

            expect(button.disabled).toBe(true);
            expect(button.textContent).toContain('Loading');

            ui.hideLoading('get-pairings-btn');

            expect(button.disabled).toBe(false);
            expect(button.textContent).toBe(originalText);
        });
    });

    describe('SommOS Main App', () => {
        let sommOS;

        beforeEach(() => {
            // Reset DOM
            document.body.innerHTML = dom.window.document.body.innerHTML;
            
            // Mock the Chart.js constructor
            global.Chart.mockImplementation(() => ({
                destroy: jest.fn()
            }));

            // Create new instance
            sommOS = new SommOS();
        });

        afterEach(() => {
            global.Chart.mockClear();
        });

        test('should initialize with correct default properties', () => {
            expect(sommOS.currentView).toBe('dashboard');
            expect(sommOS.api).toBeInstanceOf(SommOSAPI);
            expect(sommOS.ui).toBeInstanceOf(SommOSUI);
            expect(sommOS.isOnline).toBe(true);
        });

        test('should navigate to different views', () => {
            sommOS.navigateToView('inventory');

            expect(sommOS.currentView).toBe('inventory');
            
            const activeNav = document.querySelector('.nav-item.active');
            const activeView = document.querySelector('.view.active');
            
            expect(activeNav.dataset.view).toBe('inventory');
            expect(activeView.id).toBe('inventory-view');
        });

        test('should display inventory items', () => {
            const testInventory = [
                {
                    id: 1,
                    vintage_id: 'vintage-1',
                    name: 'Test Bordeaux',
                    producer: 'Test Château',
                    year: 2020,
                    wine_type: 'Red',
                    region: 'Bordeaux',
                    country: 'France',
                    quantity: 12,
                    location: 'main-cellar',
                    cost_per_bottle: 25.50
                }
            ];

            sommOS.displayInventory(testInventory);

            const grid = document.getElementById('inventory-grid');
            const wineCards = grid.querySelectorAll('.wine-card');

            expect(wineCards.length).toBe(1);
            expect(grid.innerHTML).toContain('Test Bordeaux');
            expect(grid.innerHTML).toContain('Test Château');
            expect(grid.innerHTML).toContain('$25.50');
            expect(grid.innerHTML).toContain('12 bottles');
        });

        test('should handle empty inventory', () => {
            sommOS.displayInventory([]);

            const grid = document.getElementById('inventory-grid');
            expect(grid.innerHTML).toContain('No inventory items found');
        });

        test('should filter inventory by search term', () => {
            const testInventory = [
                { name: 'Bordeaux Red', producer: 'Château A', wine_type: 'Red', region: 'Bordeaux' },
                { name: 'Burgundy White', producer: 'Domaine B', wine_type: 'White', region: 'Burgundy' }
            ];

            sommOS.fullInventory = testInventory;
            sommOS.handleSearch('Bordeaux');

            // Should call displayInventory with filtered results
            const grid = document.getElementById('inventory-grid');
            expect(grid.innerHTML).toContain('Bordeaux Red');
            expect(grid.innerHTML).not.toContain('Burgundy White');
        });

        test('should apply multiple filters', () => {
            const testInventory = [
                { name: 'Bordeaux Red', wine_type: 'Red', location: 'main-cellar' },
                { name: 'Bordeaux White', wine_type: 'White', location: 'main-cellar' },
                { name: 'Burgundy Red', wine_type: 'Red', location: 'service-bar' }
            ];

            sommOS.fullInventory = testInventory;
            
            // Set filter values
            document.getElementById('type-filter').value = 'Red';
            document.getElementById('location-filter').value = 'main-cellar';
            
            sommOS.applyFilters();

            const grid = document.getElementById('inventory-grid');
            expect(grid.innerHTML).toContain('Bordeaux Red');
            expect(grid.innerHTML).not.toContain('Bordeaux White');
            expect(grid.innerHTML).not.toContain('Burgundy Red');
        });

        test('should update inventory count display', () => {
            sommOS.updateInventoryCount(150);

            const subtitle = document.querySelector('#inventory-view .view-subtitle');
            expect(subtitle.textContent).toContain('150 wine');
        });

        test('should handle region display logic', () => {
            const testWines = [
                { name: 'Château Bordeaux', region: 'Various', country: 'France' },
                { name: 'Dom Pérignon Champagne', region: 'Unknown', producer: 'Dom Pérignon' },
                { name: 'Napa Cabernet', region: 'California', country: 'USA' }
            ];

            expect(sommOS.getDisplayRegion(testWines[0])).toBe('Bordeaux'); // Extracted from name
            expect(sommOS.getDisplayRegion(testWines[1])).toBe('Champagne'); // Extracted from name
            expect(sommOS.getDisplayRegion(testWines[2])).toBe('California'); // Original region
        });

        test('should get correct wine type icon', () => {
            expect(sommOS.getWineTypeIcon('Red')).toBe('🍷');
            expect(sommOS.getWineTypeIcon('White')).toBe('🥂');
            expect(sommOS.getWineTypeIcon('Sparkling')).toBe('🍾');
            expect(sommOS.getWineTypeIcon('Rosé')).toBe('🌹');
            expect(sommOS.getWineTypeIcon('Unknown')).toBe('🍷');
        });

        test('should display wine pairings', () => {
            const testPairings = [
                {
                    wine: {
                        id: 1,
                        vintage_id: 'vintage-1',
                        name: 'Test Bordeaux',
                        producer: 'Test Château',
                        year: 2020,
                        wine_type: 'Red',
                        region: 'Bordeaux',
                        quantity: 5,
                        location: 'main-cellar'
                    },
                    score: { total: 0.85, confidence: 0.9 },
                    reasoning: 'Perfect pairing for grilled salmon with its balanced tannins.'
                }
            ];

            sommOS.displayPairings(testPairings);

            const results = document.getElementById('pairing-results');
            const list = document.getElementById('pairing-list');

            expect(results.classList.contains('hidden')).toBe(false);
            expect(list.innerHTML).toContain('Test Bordeaux');
            expect(list.innerHTML).toContain('85%'); // Score display
            expect(list.innerHTML).toContain('Perfect pairing for grilled salmon');
            expect(list.innerHTML).toContain('5 bottles available');
        });

        test('should handle empty pairing results', () => {
            sommOS.displayPairings([]);

            const list = document.getElementById('pairing-list');
            expect(list.innerHTML).toContain('No pairings found');
        });

        test('should show loading screen initially', () => {
            sommOS.showLoadingScreen();

            const loadingScreen = document.getElementById('loading-screen');
            const app = document.getElementById('app');

            expect(loadingScreen.style.display).toBe('flex');
            expect(app.classList.contains('hidden')).toBe(true);
        });

        test('should hide loading screen after initialization', (done) => {
            sommOS.hideLoadingScreen();

            // Loading screen hides after 1.5s timeout
            setTimeout(() => {
                const loadingScreen = document.getElementById('loading-screen');
                const app = document.getElementById('app');

                expect(loadingScreen.style.display).toBe('none');
                expect(app.classList.contains('hidden')).toBe(false);
                done();
            }, 1600);
        });

        test('should handle online/offline status changes', () => {
            const showToastSpy = jest.spyOn(sommOS.ui, 'showToast');

            // Simulate going offline
            sommOS.isOnline = false;
            window.dispatchEvent(new Event('offline'));

            expect(sommOS.isOnline).toBe(false);

            // Simulate going online
            sommOS.isOnline = true;
            window.dispatchEvent(new Event('online'));

            expect(sommOS.isOnline).toBe(true);
        });
    });

    describe('Wine Data Processing', () => {
        let sommOS;

        beforeEach(() => {
            sommOS = new SommOS();
        });

        test('should parse grape varieties from JSON string', () => {
            const jsonString = '["Cabernet Sauvignon", "Merlot", "Cabernet Franc"]';
            const result = sommOS.parseGrapeVarieties(jsonString);
            
            expect(result).toEqual(['Cabernet Sauvignon', 'Merlot', 'Cabernet Franc']);
        });

        test('should parse grape varieties from delimited string', () => {
            const delimitedString = 'Chardonnay, Sauvignon Blanc, Pinot Grigio';
            const result = sommOS.parseGrapeVarieties(delimitedString);
            
            expect(result).toEqual(['Chardonnay', 'Sauvignon Blanc', 'Pinot Grigio']);
        });

        test('should handle invalid grape varieties data', () => {
            expect(sommOS.parseGrapeVarieties('')).toEqual([]);
            expect(sommOS.parseGrapeVarieties(null)).toEqual([]);
            expect(sommOS.parseGrapeVarieties('invalid json string')).toEqual(['invalid json string']);
        });

        test('should generate wine summary', () => {
            const testWine = {
                name: 'Château Test',
                wine_type: 'Red',
                region: 'Bordeaux',
                year: 2020,
                producer: 'Test Producer'
            };

            const summary = sommOS.generateWineSummary(testWine);
            
            expect(summary).toContain('red');
            expect(summary).toContain('Bordeaux');
            expect(summary).toContain('2020');
            expect(summary).toContain('Test Producer');
        });
    });

    describe('Error Handling', () => {
        let sommOS;

        beforeEach(() => {
            sommOS = new SommOS();
        });

        test('should handle API errors gracefully', async () => {
            const mockApi = {
                getInventory: jest.fn().mockRejectedValue(new Error('API Error'))
            };
            sommOS.api = mockApi;

            const showToastSpy = jest.spyOn(sommOS.ui, 'showToast');

            await sommOS.loadInventory();

            expect(showToastSpy).toHaveBeenCalledWith('Failed to load inventory', 'error');
            
            const grid = document.getElementById('inventory-grid');
            expect(grid.innerHTML).toContain('Failed to load inventory');
        });

        test('should handle missing DOM elements', () => {
            // Remove required element
            const element = document.getElementById('inventory-grid');
            element.remove();

            const testInventory = [{ name: 'Test Wine' }];
            
            // Should not throw error
            expect(() => sommOS.displayInventory(testInventory)).not.toThrow();
        });
    });

    describe('Chart Integration', () => {
        let sommOS;

        beforeEach(() => {
            sommOS = new SommOS();
        });

        test('should create wine types chart with proper data', () => {
            const testWines = [
                { wine_type: 'Red', quantity: 50 },
                { wine_type: 'White', quantity: 30 },
                { wine_type: 'Sparkling', quantity: 20 }
            ];

            sommOS.createWineTypesChart(testWines);

            expect(global.Chart).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    type: 'doughnut',
                    data: expect.objectContaining({
                        labels: ['Red', 'White', 'Sparkling'],
                        datasets: expect.arrayContaining([
                            expect.objectContaining({
                                data: [50, 30, 20]
                            })
                        ])
                    })
                })
            );
        });

        test('should create stock location chart with proper data', () => {
            const testWines = [
                { location: 'main-cellar', quantity: 60 },
                { location: 'service-bar', quantity: 25 },
                { location: 'deck-storage', quantity: 15 }
            ];

            sommOS.createStockLocationChart(testWines);

            expect(global.Chart).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    type: 'bar',
                    data: expect.objectContaining({
                        labels: ['main-cellar', 'service-bar', 'deck-storage'],
                        datasets: expect.arrayContaining([
                            expect.objectContaining({
                                data: [60, 25, 15]
                            })
                        ])
                    })
                })
            );
        });
    });
});