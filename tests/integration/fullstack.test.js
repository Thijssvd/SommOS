// SommOS Integration Tests
// End-to-end tests covering full application stack

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { refreshConfig } = require('../../backend/config/env');

// Test database setup
const Database = require('../../backend/database/connection');
const TestHelpers = require('../helpers/index');
const testDbPath = path.join(__dirname, 'test.db');

describe('SommOS Full Stack Integration Tests', () => {
    let app;
    let server;
    let db;
    let testHelpers;
    let testDataset;

    beforeAll(async () => {
        // Set up test environment
        process.env.NODE_ENV = 'test';
        process.env.DATABASE_PATH = testDbPath;
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-jwt-secret';
        process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'integration-session-secret';

        refreshConfig();
        
        // Remove existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        // Initialize test database with fixtures
        db = Database.getInstance(testDbPath);
        testHelpers = new TestHelpers();
        testDataset = await testHelpers.setupTestDatabase(db);

        // Import the app after environment setup
        app = require('../../backend/server');
        server = app.listen(0);
    });

    afterAll(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        
        if (db) {
            await db.close();
        }
        
        // Clean up test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });


    describe('Complete Wine Inventory Flow', () => {
        test('should fetch, display, and interact with wine inventory', async () => {
            // 1. Fetch inventory via API
            const inventoryResponse = await request(app)
                .get('/api/inventory/stock')
                .expect(200);

            expect(inventoryResponse.body.success).toBe(true);
            expect(inventoryResponse.body.data).toHaveLength(2);

            const bordeauxWine = inventoryResponse.body.data.find(wine => 
                wine.name === 'Château Test Bordeaux'
            );
            expect(bordeauxWine).toBeTruthy();
            expect(bordeauxWine.quantity).toBe(24);
            expect(bordeauxWine.location).toBe('main-cellar');

            // 2. Filter inventory by location
            const filteredResponse = await request(app)
                .get('/api/inventory/stock?location=main-cellar')
                .expect(200);

            expect(filteredResponse.body.data).toHaveLength(1);
            expect(filteredResponse.body.data[0].location).toBe('main-cellar');

            // 3. Filter by wine type
            const typeFilterResponse = await request(app)
                .get('/api/inventory/stock?wine_type=Red')
                .expect(200);

            expect(typeFilterResponse.body.data).toHaveLength(1);
            expect(typeFilterResponse.body.data[0].wine_type).toBe('Red');
        });

        test('should handle wine consumption workflow', async () => {
            // 1. Get current stock levels
            const initialStock = await request(app)
                .get('/api/inventory/stock?location=main-cellar')
                .expect(200);

            const bordeauxWine = initialStock.body.data[0];
            const initialQuantity = bordeauxWine.quantity;

            // 2. Consume wine
            const consumeResponse = await request(app)
                .post('/api/inventory/consume')
                .send({
                    vintage_id: bordeauxWine.vintage_id,
                    location: 'main-cellar',
                    quantity: 2,
                    notes: 'Served at dinner',
                    created_by: 'Integration Test'
                })
                .expect(200);

            expect(consumeResponse.body.success).toBe(true);

            // 3. Verify stock reduction
            const updatedStock = await request(app)
                .get('/api/inventory/stock?location=main-cellar')
                .expect(200);

            const updatedWine = updatedStock.body.data[0];
            expect(updatedWine.quantity).toBe(initialQuantity - 2);

            // 4. Check ledger entry
            const ledgerResponse = await request(app)
                .get(`/api/inventory/ledger/${bordeauxWine.vintage_id}`)
                .expect(200);

            expect(ledgerResponse.body.success).toBe(true);
            expect(ledgerResponse.body.data).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        transaction_type: 'OUT',
                        quantity: -2,
                        notes: 'Served at dinner'
                    })
                ])
            );
        });

        test('should handle wine movement between locations', async () => {
            // 1. Get initial stock at both locations
            const mainCellarStock = await request(app)
                .get('/api/inventory/stock?location=main-cellar')
                .expect(200);

            const serviceBarStock = await request(app)
                .get('/api/inventory/stock?location=service-bar')
                .expect(200);

            const bordeauxWine = mainCellarStock.body.data[0];
            const initialMainCellar = bordeauxWine.quantity;
            const initialServiceBar = serviceBarStock.body.data.find(w => 
                w.vintage_id === bordeauxWine.vintage_id
            )?.quantity || 0;

            // 2. Move wine from main cellar to service bar
            const moveResponse = await request(app)
                .post('/api/inventory/move')
                .send({
                    vintage_id: bordeauxWine.vintage_id,
                    from_location: 'main-cellar',
                    to_location: 'service-bar',
                    quantity: 3,
                    notes: 'Moving for evening service',
                    created_by: 'Integration Test'
                })
                .expect(200);

            expect(moveResponse.body.success).toBe(true);

            // 3. Verify stock changes at both locations
            const updatedMainCellar = await request(app)
                .get('/api/inventory/stock?location=main-cellar')
                .expect(200);

            const updatedServiceBar = await request(app)
                .get('/api/inventory/stock?location=service-bar')
                .expect(200);

            const updatedMainCellarWine = updatedMainCellar.body.data[0];
            expect(updatedMainCellarWine.quantity).toBe(initialMainCellar - 3);

            const updatedServiceBarWine = updatedServiceBar.body.data.find(w => 
                w.vintage_id === bordeauxWine.vintage_id
            );
            expect(updatedServiceBarWine.quantity).toBe(initialServiceBar + 3);
        });

        test('should handle wine reservation workflow', async () => {
            // 1. Reserve wine
            const mainCellarStock = await request(app)
                .get('/api/inventory/stock?location=main-cellar')
                .expect(200);

            const bordeauxWine = mainCellarStock.body.data[0];

            const reserveResponse = await request(app)
                .post('/api/inventory/reserve')
                .send({
                    vintage_id: bordeauxWine.vintage_id,
                    location: 'main-cellar',
                    quantity: 1,
                    notes: 'Reserved for VIP guest',
                    created_by: 'Integration Test'
                })
                .expect(200);

            expect(reserveResponse.body.success).toBe(true);

            // 2. Verify ledger entry shows reservation
            const ledgerResponse = await request(app)
                .get(`/api/inventory/ledger/${bordeauxWine.vintage_id}`)
                .expect(200);

            expect(ledgerResponse.body.data).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        transaction_type: 'RESERVE',
                        quantity: 1,
                        notes: 'Reserved for VIP guest'
                    })
                ])
            );
        });
    });

    describe('Wine Pairing Integration', () => {
        test('should generate wine pairings with inventory consideration', async () => {
            // 1. Request pairing recommendations
            const pairingResponse = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Grilled salmon with herbs',
                    context: {
                        occasion: 'casual-dining',
                        guestCount: 4
                    },
                    guestPreferences: 'Light to medium wines preferred'
                })
                .expect(200);

            expect(pairingResponse.body.success).toBe(true);
            expect(pairingResponse.body.data).toBeDefined();

            // 2. Test quick pairing
            const quickPairingResponse = await request(app)
                .post('/api/pairing/quick')
                .send({
                    dish: 'Beef tenderloin',
                    context: { occasion: 'formal-dining' },
                    ownerLikes: ['Bordeaux', 'Cabernet Sauvignon']
                })
                .expect(200);

            expect(quickPairingResponse.body.success).toBe(true);
        });
    });

    describe('Procurement Integration', () => {
        test('should analyze procurement opportunities', async () => {
            // 1. Get procurement opportunities
            const opportunitiesResponse = await request(app)
                .get('/api/procurement/opportunities?region=Bordeaux')
                .expect(200);

            expect(opportunitiesResponse.body.success).toBe(true);
            expect(opportunitiesResponse.body.data).toBeDefined();

            // 2. Get existing vintage and supplier data from test database
            const stockResponse = await request(app)
                .get('/api/inventory/stock?limit=1')
                .expect(200);

            const testVintage = stockResponse.body.data[0];
            
            // 3. Analyze specific purchase decision using real test data
            const analysisResponse = await request(app)
                .post('/api/procurement/analyze')
                .send({
                    vintage_id: testVintage.vintage_id,
                    supplier_id: '1',
                    quantity: 12,
                    context: { budget: 500 }
                })
                .expect(200);

            expect(analysisResponse.body.success).toBe(true);
        });

        test('should create purchase orders', async () => {
            // Get real vintage data from test database
            const stockResponse = await request(app)
                .get('/api/inventory/stock?limit=2')
                .expect(200);

            const testVintages = stockResponse.body.data;
            
            const orderResponse = await request(app)
                .post('/api/procurement/order')
                .send({
                    items: [
                        { vintage_id: testVintages[0].vintage_id, quantity: 12, price: 35.0 },
                        { vintage_id: testVintages[1] ? testVintages[1].vintage_id : testVintages[0].vintage_id, quantity: 6, price: 45.0 }
                    ],
                    supplier_id: '1',
                    delivery_date: '2024-03-15',
                    notes: 'Test purchase order'
                })
                .expect(200);

            expect(orderResponse.body.success).toBe(true);
        });
    });

    describe('Wine Catalog and Intelligence Integration', () => {
        test('should manage wine catalog with vintage intelligence', async () => {
            // 1. Get wine catalog
            const catalogResponse = await request(app)
                .get('/api/wines?limit=10')
                .expect(200);

            expect(catalogResponse.body.success).toBe(true);
            expect(catalogResponse.body.data.length).toBeGreaterThan(0);

            const testWine = catalogResponse.body.data[0];

            // 2. Get specific wine details
            const wineDetailsResponse = await request(app)
                .get(`/api/wines/${testWine.id}`)
                .expect(200);

            expect(wineDetailsResponse.body.success).toBe(true);
            expect(wineDetailsResponse.body.data).toHaveProperty('vintages');

            // 3. Add new wine with vintage intelligence
            const newWineResponse = await request(app)
                .post('/api/wines')
                .send({
                    wine: {
                        name: 'Integration Test Wine',
                        producer: 'Test Winery',
                        region: 'Test Region',
                        wine_type: 'Red'
                    },
                    vintage: {
                        year: 2022,
                        quality_score: 88
                    },
                    stock: {
                        quantity: 6,
                        location: 'main-cellar',
                        unit_cost: 28.0
                    }
                })
                .expect(201);

            expect(newWineResponse.body.success).toBe(true);
            expect(newWineResponse.body.message).toContain('vintage intelligence');
        });

        test('should provide vintage intelligence analysis', async () => {
            // Get first wine for analysis
            const catalogResponse = await request(app)
                .get('/api/wines?limit=1')
                .expect(200);

            const testWine = catalogResponse.body.data[0];

            // 1. Get vintage analysis
            const analysisResponse = await request(app)
                .get(`/api/vintage/analysis/${testWine.id}`)
                .expect(200);

            expect(analysisResponse.body.success).toBe(true);
            expect(analysisResponse.body.data).toHaveProperty('weatherAnalysis');
            expect(analysisResponse.body.data).toHaveProperty('qualityScore');

            // 2. Test vintage enrichment
            const enrichResponse = await request(app)
                .post('/api/vintage/enrich')
                .send({ wine_id: testWine.id })
                .expect(200);

            expect(enrichResponse.body.success).toBe(true);

            // 3. Test batch enrichment
            const batchResponse = await request(app)
                .post('/api/vintage/batch-enrich')
                .send({
                    filters: { region: 'Bordeaux' },
                    limit: 5
                })
                .expect(200);

            expect(batchResponse.body.success).toBe(true);
        });

        test('should generate pairing insights with weather context', async () => {
            const catalogResponse = await request(app)
                .get('/api/wines?limit=1')
                .expect(200);

            const testWine = catalogResponse.body.data[0];

            const insightResponse = await request(app)
                .post('/api/vintage/pairing-insight')
                .send({
                    wine_id: testWine.id,
                    dish_context: {
                        dish: 'Grilled steak',
                        cooking_method: 'grilled',
                        season: 'summer'
                    }
                })
                .expect(200);

            expect(insightResponse.body.success).toBe(true);
            expect(insightResponse.body.data).toHaveProperty('pairingInsight');
            expect(insightResponse.body.data).toHaveProperty('weatherAnalysis');
        });
    });

    describe('System Health and Monitoring', () => {
        test('should provide comprehensive system health information', async () => {
            const healthResponse = await request(app)
                .get('/api/system/health')
                .expect(200);

            expect(healthResponse.body).toEqual({
                success: true,
                status: 'healthy',
                timestamp: expect.any(String),
                data: {
                    total_wines: expect.any(Number),
                    total_vintages: expect.any(Number),
                    total_bottles: expect.any(Number),
                    active_suppliers: expect.any(Number)
                }
            });

            // Verify the numbers make sense based on our test data
            expect(healthResponse.body.data.total_wines).toBeGreaterThanOrEqual(2);
            expect(healthResponse.body.data.total_vintages).toBeGreaterThanOrEqual(2);
            expect(healthResponse.body.data.total_bottles).toBeGreaterThan(0);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle insufficient inventory gracefully', async () => {
            // Try to consume more wine than available
            const stock = await request(app)
                .get('/api/inventory/stock?location=main-cellar')
                .expect(200);

            const wine = stock.body.data[0];

            const consumeResponse = await request(app)
                .post('/api/inventory/consume')
                .send({
                    vintage_id: wine.vintage_id,
                    location: 'main-cellar',
                    quantity: wine.quantity + 10, // More than available
                    notes: 'Test overconsumption',
                    created_by: 'Integration Test'
                })
                .expect(500); // Should fail

            expect(consumeResponse.body.success).toBe(false);
        });

        test('should handle invalid wine IDs', async () => {
            const invalidWineResponse = await request(app)
                .get('/api/wines/999999')
                .expect(404);

            expect(invalidWineResponse.body.success).toBe(false);
            expect(invalidWineResponse.body.error).toBe('Wine not found');
        });

        test('should validate required parameters', async () => {
            // Test missing required fields
            const invalidConsumeResponse = await request(app)
                .post('/api/inventory/consume')
                .send({
                    location: 'main-cellar',
                    notes: 'Missing vintage_id and quantity'
                })
                .expect(400);

            expect(invalidConsumeResponse.body.success).toBe(false);
            expect(invalidConsumeResponse.body.error).toContain('required');
        });

        test('should handle empty pairing requests', async () => {
            const emptyPairingResponse = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    context: { occasion: 'test' }
                    // Missing dish
                })
                .expect(400);

            expect(emptyPairingResponse.body.success).toBe(false);
            expect(emptyPairingResponse.body.error).toBe('Dish information is required');
        });
    });

    describe('Data Consistency and Transactions', () => {
        test('should maintain data consistency during concurrent operations', async () => {
            // Get initial state
            const initialStock = await request(app)
                .get('/api/inventory/stock')
                .expect(200);

            const wine = initialStock.body.data[0];
            const initialQuantity = wine.quantity;
            const initialReserved = wine.reserved_quantity || 0;

            // Perform multiple concurrent operations
            const operations = [
                request(app).post('/api/inventory/consume').send({
                    vintage_id: wine.vintage_id,
                    location: wine.location,
                    quantity: 1,
                    notes: 'Concurrent test 1',
                    created_by: 'Test'
                }),
                request(app).post('/api/inventory/consume').send({
                    vintage_id: wine.vintage_id,
                    location: wine.location,
                    quantity: 1,
                    notes: 'Concurrent test 2',
                    created_by: 'Test'
                }),
                request(app).post('/api/inventory/reserve').send({
                    vintage_id: wine.vintage_id,
                    location: wine.location,
                    quantity: 1,
                    notes: 'Concurrent reservation',
                    created_by: 'Test'
                })
            ];

            const results = await Promise.all(operations);
            results.forEach(result => {
                expect(result.status).toBe(200);
                expect(result.body.success).toBe(true);
            });

            // Verify final state is consistent
            const finalStock = await request(app)
                .get('/api/inventory/stock')
                .expect(200);

            const finalWine = finalStock.body.data.find(w => w.vintage_id === wine.vintage_id);
            
            // Only consumed wine should reduce total quantity (2 bottles consumed)
            expect(finalWine.quantity).toBe(initialQuantity - 2);
            
            // Reserved quantity should increase by 1 from initial state
            expect(finalWine.reserved_quantity).toBe(initialReserved + 1);
            
            // Available quantity should account for both consumed and reserved
            const expectedAvailable = (initialQuantity - 2) - (initialReserved + 1);
            expect(finalWine.available_quantity).toBe(expectedAvailable);

            // Verify ledger entries
            const ledgerResponse = await request(app)
                .get(`/api/inventory/ledger/${wine.vintage_id}`)
                .expect(200);

            const entries = ledgerResponse.body.data;
            const consumeEntries = entries.filter(e => e.transaction_type === 'OUT' || e.transaction_type.toLowerCase() === 'consume');
            const reserveEntries = entries.filter(e => e.transaction_type === 'RESERVE' || e.transaction_type.toLowerCase() === 'reserve');

            expect(consumeEntries.length).toBeGreaterThanOrEqual(2);
            expect(reserveEntries.length).toBeGreaterThanOrEqual(1);
        });
    });
});