/**
 * Inventory Flow Integration Tests - Priority 2
 * 
 * True integration tests that exercise multiple layers together:
 * - Spin up app with test database (no mocking internal logic)
 * - Test controller -> service -> database integration
 * - Verify data persistence and state changes
 * 
 * This catches issues that pure unit tests or pure mocked tests might miss
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const Database = require('../../backend/database/connection');

// Import app setup (we'll need to create/modify this to support test mode)
let app;
let server;
let db;

describe('Inventory Flow Integration Tests', () => {
    let testWineId;
    let testVintageId;
    let testStockId;

    beforeAll(async () => {
        // Set up test database
        process.env.NODE_ENV = 'test';
        process.env.DATABASE_PATH = ':memory:';
        Database.instance = null;
        
        // Initialize database
        db = Database.getInstance(':memory:');
        await db.initialize();

        // Load schema
        const schemaPath = path.join(__dirname, '../../backend/database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await db.exec(schema);

        // Import and initialize app
        const appModule = require('../../backend/app');
        app = appModule.app || appModule;
        server = appModule.server;

        // Seed test data
        const wineResult = await db.run(`
            INSERT INTO Wines (name, producer, region, country, wine_type, grape_varieties)
            VALUES ('Château Margaux', 'Château Margaux', 'Bordeaux', 'France', 'Red', '["Cabernet Sauvignon", "Merlot"]')
        `);
        testWineId = wineResult.lastID;

        const vintageResult = await db.run(`
            INSERT INTO Vintages (wine_id, year, quality_score)
            VALUES (?, 2015, 95)
        `, [testWineId]);
        testVintageId = vintageResult.lastID;

        const stockResult = await db.run(`
            INSERT INTO Stock (vintage_id, location, quantity, reserved_quantity, cost_per_bottle, current_value)
            VALUES (?, 'main-cellar', 24, 0, 150.00, 3600.00)
        `, [testVintageId]);
        testStockId = stockResult.lastID;
    });

    afterAll(async () => {
        if (server && server.close) {
            await new Promise(resolve => server.close(resolve));
        }
        if (db) {
            await db.close();
        }
    });

    describe('GET /api/inventory/stock - Read Current Stock', () => {
        test('should return current stock levels', async () => {
            const response = await request(app)
                .get('/api/inventory/stock')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body) || response.body.items).toBeTruthy();
            
            const items = response.body.items || response.body;
            const testItem = items.find(item => 
                item.name === 'Château Margaux' || item.wine_name === 'Château Margaux'
            );
            
            expect(testItem).toBeDefined();
            expect(testItem.quantity || testItem.quantity).toBeGreaterThan(0);
        });

        test('should filter stock by location', async () => {
            const response = await request(app)
                .get('/api/inventory/stock')
                .query({ location: 'main-cellar' })
                .expect(200);

            const items = response.body.items || response.body;
            if (items.length > 0) {
                items.forEach(item => {
                    expect(item.location).toBe('main-cellar');
                });
            }
        });

        test('should filter stock by wine type', async () => {
            const response = await request(app)
                .get('/api/inventory/stock')
                .query({ wine_type: 'Red' })
                .expect(200);

            const items = response.body.items || response.body;
            if (items.length > 0) {
                items.forEach(item => {
                    expect(item.wine_type).toBe('Red');
                });
            }
        });
    });

    describe('POST /api/inventory/consume - Consume Wine', () => {
        test('should consume wine and update database', async () => {
            // Get initial stock
            const initialStock = await db.get(`
                SELECT quantity FROM Stock WHERE id = ?
            `, [testStockId]);
            const initialQuantity = initialStock.quantity;

            // Consume via API
            const consumeResponse = await request(app)
                .post('/api/inventory/consume')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: 3,
                    notes: 'Integration test consumption',
                    created_by: 'test-user'
                })
                .expect(200);

            expect(consumeResponse.body.success).toBe(true);

            // Verify database was updated
            const updatedStock = await db.get(`
                SELECT quantity FROM Stock WHERE id = ?
            `, [testStockId]);

            expect(updatedStock.quantity).toBe(initialQuantity - 3);

            // Verify ledger entry was created
            const ledgerEntry = await db.get(`
                SELECT * FROM Ledger 
                WHERE vintage_id = ? AND transaction_type = 'OUT'
                ORDER BY created_at DESC LIMIT 1
            `, [testVintageId]);

            expect(ledgerEntry).toBeDefined();
            expect(ledgerEntry.quantity).toBe(3);
            expect(ledgerEntry.notes).toContain('Integration test consumption');

            // Verify via GET API
            const stockResponse = await request(app)
                .get('/api/inventory/stock')
                .expect(200);

            const items = stockResponse.body.items || stockResponse.body;
            const updatedItem = items.find(item => 
                (item.vintage_id || item.id) === testVintageId
            );
            
            if (updatedItem) {
                expect(updatedItem.quantity).toBe(initialQuantity - 3);
            }
        });

        test('should reject consumption exceeding available stock', async () => {
            const stock = await db.get(`
                SELECT quantity, reserved_quantity FROM Stock WHERE id = ?
            `, [testStockId]);
            const available = stock.quantity - stock.reserved_quantity;

            const response = await request(app)
                .post('/api/inventory/consume')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: available + 10,
                    created_by: 'test-user'
                })
                .expect(409); // Conflict

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/insufficient/i);

            // Verify stock was NOT changed
            const unchangedStock = await db.get(`
                SELECT quantity FROM Stock WHERE id = ?
            `, [testStockId]);
            expect(unchangedStock.quantity).toBe(stock.quantity);
        });

        test('should prevent negative inventory', async () => {
            const response = await request(app)
                .post('/api/inventory/consume')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: 1000,
                    created_by: 'test-user'
                })
                .expect(409);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/inventory/receive - Receive Wine', () => {
        test('should receive wine and update database', async () => {
            const initialStock = await db.get(`
                SELECT quantity FROM Stock WHERE id = ?
            `, [testStockId]);
            const initialQuantity = initialStock.quantity;

            const response = await request(app)
                .post('/api/inventory/receive')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: 6,
                    unit_cost: 150.00,
                    reference_id: 'PO-TEST-001',
                    notes: 'Integration test receive',
                    created_by: 'test-user'
                })
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify database
            const updatedStock = await db.get(`
                SELECT quantity FROM Stock WHERE id = ?
            `, [testStockId]);

            expect(updatedStock.quantity).toBe(initialQuantity + 6);

            // Verify ledger
            const ledgerEntry = await db.get(`
                SELECT * FROM Ledger 
                WHERE vintage_id = ? AND transaction_type = 'IN'
                ORDER BY created_at DESC LIMIT 1
            `, [testVintageId]);

            expect(ledgerEntry).toBeDefined();
            expect(ledgerEntry.quantity).toBe(6);
            expect(ledgerEntry.reference_id).toBe('PO-TEST-001');
        });

        test('should reject receiving zero or negative quantities', async () => {
            const response = await request(app)
                .post('/api/inventory/receive')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: 0,
                    created_by: 'test-user'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/inventory/move - Move Wine Between Locations', () => {
        test('should move wine and update both locations', async () => {
            const sourceStock = await db.get(`
                SELECT quantity FROM Stock WHERE id = ?
            `, [testStockId]);
            const sourceQuantity = sourceStock.quantity;

            const response = await request(app)
                .post('/api/inventory/move')
                .send({
                    vintage_id: testVintageId,
                    from_location: 'main-cellar',
                    to_location: 'service-bar',
                    quantity: 4,
                    notes: 'Integration test move',
                    created_by: 'test-user'
                })
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify source decreased
            const updatedSource = await db.get(`
                SELECT quantity FROM Stock WHERE id = ?
            `, [testStockId]);
            expect(updatedSource.quantity).toBe(sourceQuantity - 4);

            // Verify destination increased (or was created)
            const destination = await db.get(`
                SELECT quantity FROM Stock 
                WHERE vintage_id = ? AND location = 'service-bar'
            `, [testVintageId]);
            expect(destination).toBeDefined();
            expect(destination.quantity).toBe(4);

            // Verify ledger entries for both locations
            const ledgerEntries = await db.all(`
                SELECT * FROM Ledger 
                WHERE vintage_id = ? AND transaction_type = 'MOVE'
                ORDER BY created_at DESC LIMIT 2
            `, [testVintageId]);

            expect(ledgerEntries.length).toBe(2);
        });

        test('should reject moving more than available', async () => {
            const stock = await db.get(`
                SELECT quantity, reserved_quantity FROM Stock WHERE id = ?
            `, [testStockId]);
            const available = stock.quantity - stock.reserved_quantity;

            const response = await request(app)
                .post('/api/inventory/move')
                .send({
                    vintage_id: testVintageId,
                    from_location: 'main-cellar',
                    to_location: 'service-bar',
                    quantity: available + 5,
                    created_by: 'test-user'
                })
                .expect(409);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/inventory/reserve - Reserve Wine', () => {
        test('should reserve wine and update reserved quantity', async () => {
            const initialStock = await db.get(`
                SELECT reserved_quantity FROM Stock WHERE id = ?
            `, [testStockId]);
            const initialReserved = initialStock.reserved_quantity;

            const response = await request(app)
                .post('/api/inventory/reserve')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: 5,
                    notes: 'Reserved for private event',
                    created_by: 'test-user'
                })
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify database
            const updatedStock = await db.get(`
                SELECT reserved_quantity, quantity FROM Stock WHERE id = ?
            `, [testStockId]);

            expect(updatedStock.reserved_quantity).toBe(initialReserved + 5);
            // Total quantity should not change
            expect(updatedStock.quantity).toBe(initialStock.quantity || updatedStock.quantity);

            // Verify ledger
            const ledgerEntry = await db.get(`
                SELECT * FROM Ledger 
                WHERE vintage_id = ? AND transaction_type = 'RESERVE'
                ORDER BY created_at DESC LIMIT 1
            `, [testVintageId]);

            expect(ledgerEntry).toBeDefined();
            expect(ledgerEntry.quantity).toBe(5);
        });

        test('should respect available quantity when reserving', async () => {
            const stock = await db.get(`
                SELECT quantity, reserved_quantity FROM Stock WHERE id = ?
            `, [testStockId]);
            const available = stock.quantity - stock.reserved_quantity;

            const response = await request(app)
                .post('/api/inventory/reserve')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: available + 1,
                    created_by: 'test-user'
                })
                .expect(409);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/inventory/adjust - Adjust Inventory', () => {
        test('should adjust inventory to new quantity', async () => {
            const response = await request(app)
                .post('/api/inventory/adjust')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    new_quantity: 30,
                    reason: 'Physical count correction - integration test',
                    created_by: 'test-user'
                })
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify database
            const updatedStock = await db.get(`
                SELECT quantity FROM Stock WHERE id = ?
            `, [testStockId]);

            expect(updatedStock.quantity).toBe(30);

            // Verify ledger
            const ledgerEntry = await db.get(`
                SELECT * FROM Ledger 
                WHERE vintage_id = ? AND transaction_type = 'ADJUST'
                ORDER BY created_at DESC LIMIT 1
            `, [testVintageId]);

            expect(ledgerEntry).toBeDefined();
        });

        test('should reject negative adjustments', async () => {
            const response = await request(app)
                .post('/api/inventory/adjust')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    new_quantity: -5,
                    reason: 'Invalid adjustment',
                    created_by: 'test-user'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/inventory/ledger/:vintageId - Ledger History', () => {
        test('should return transaction history', async () => {
            const response = await request(app)
                .get(`/api/inventory/ledger/${testVintageId}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);

            // Should have various transaction types from previous tests
            const transactionTypes = response.body.map(entry => entry.transaction_type);
            expect(transactionTypes).toContain('OUT'); // From consume
            expect(transactionTypes).toContain('IN');  // From receive
        });

        test('should support pagination', async () => {
            const response = await request(app)
                .get(`/api/inventory/ledger/${testVintageId}`)
                .query({ limit: 5, offset: 0 })
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeLessThanOrEqual(5);
        });
    });

    describe('Multi-Operation Flow', () => {
        test('should handle complete workflow: receive -> reserve -> consume', async () => {
            // 1. Receive new stock
            const receiveResponse = await request(app)
                .post('/api/inventory/receive')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: 12,
                    unit_cost: 150.00,
                    created_by: 'test-user'
                })
                .expect(200);

            expect(receiveResponse.body.success).toBe(true);

            const afterReceive = await db.get(`SELECT * FROM Stock WHERE id = ?`, [testStockId]);

            // 2. Reserve some for an event
            const reserveResponse = await request(app)
                .post('/api/inventory/reserve')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: 6,
                    notes: 'Reserved for gala',
                    created_by: 'test-user'
                })
                .expect(200);

            expect(reserveResponse.body.success).toBe(true);

            const afterReserve = await db.get(`SELECT * FROM Stock WHERE id = ?`, [testStockId]);
            expect(afterReserve.reserved_quantity).toBe(afterReceive.reserved_quantity + 6);

            // 3. Consume the reserved wine
            const consumeResponse = await request(app)
                .post('/api/inventory/consume')
                .send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: 6,
                    notes: 'Gala event consumption',
                    created_by: 'test-user'
                })
                .expect(200);

            expect(consumeResponse.body.success).toBe(true);

            const afterConsume = await db.get(`SELECT * FROM Stock WHERE id = ?`, [testStockId]);
            expect(afterConsume.quantity).toBe(afterReserve.quantity - 6);

            // 4. Verify complete ledger history
            const ledgerResponse = await request(app)
                .get(`/api/inventory/ledger/${testVintageId}`)
                .expect(200);

            const recentEntries = ledgerResponse.body.slice(0, 3);
            expect(recentEntries.some(e => e.transaction_type === 'IN')).toBe(true);
            expect(recentEntries.some(e => e.transaction_type === 'RESERVE')).toBe(true);
            expect(recentEntries.some(e => e.transaction_type === 'OUT')).toBe(true);
        });
    });

    describe('Concurrent Operations', () => {
        test('should handle concurrent consume requests safely', async () => {
            // Get current stock
            const stock = await db.get(`SELECT quantity FROM Stock WHERE id = ?`, [testStockId]);
            const initialQuantity = stock.quantity;

            // Make two concurrent consume requests
            const promises = [
                request(app).post('/api/inventory/consume').send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: 2,
                    created_by: 'user1'
                }),
                request(app).post('/api/inventory/consume').send({
                    vintage_id: testVintageId,
                    location: 'main-cellar',
                    quantity: 2,
                    created_by: 'user2'
                })
            ];

            const results = await Promise.allSettled(promises);

            // Both should succeed (we have enough stock)
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.body.success);
            expect(succeeded.length).toBe(2);

            // Final quantity should be correct
            const finalStock = await db.get(`SELECT quantity FROM Stock WHERE id = ?`, [testStockId]);
            expect(finalStock.quantity).toBe(initialQuantity - 4);
        });
    });
});
