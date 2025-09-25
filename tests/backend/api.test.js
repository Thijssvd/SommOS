// SommOS Backend API Tests
// Comprehensive test suite for all API endpoints

const request = require('supertest');

// Mock the database and core modules to avoid external dependencies during testing
jest.mock('../../backend/database/connection');
jest.mock('../../backend/core/pairing_engine');
jest.mock('../../backend/core/inventory_manager');
jest.mock('../../backend/core/procurement_engine');
jest.mock('../../backend/core/vintage_intelligence');

// Import after mocking
const app = require('../../backend/server');

describe('SommOS API Endpoints', () => {
    let server;

    beforeAll(async () => {
        // Start test server
        server = app.listen(0); // Use random port for testing
    });

    afterAll(async () => {
        // Clean up
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    describe('System Health Endpoints', () => {
        test('GET /api/system/health should return system status', async () => {
            const response = await request(app)
                .get('/api/system/health')
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('GET /api/system/activity should return recent activity', async () => {
            const response = await request(app)
                .get('/api/system/activity?limit=5')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(Array.isArray(response.body.data)).toBe(true);
            if (response.body.data.length > 0) {
                const activity = response.body.data[0];
                expect(activity).toHaveProperty('type');
                expect(activity).toHaveProperty('title');
                expect(activity).toHaveProperty('timestamp');
            }
        });
    });

    describe('Inventory Endpoints', () => {
        test('GET /api/inventory/stock should return inventory data', async () => {
            const response = await request(app)
                .get('/api/inventory/stock')
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('GET /api/inventory/stock with filters should handle query parameters', async () => {
            const response = await request(app)
                .get('/api/inventory/stock?location=main-cellar&wine_type=Red')
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('POST /api/inventory/consume should record wine consumption', async () => {
            const consumeData = {
                vintage_id: 'test-vintage-1',
                location: 'main-cellar',
                quantity: 1,
                notes: 'Test consumption',
                created_by: 'test-user'
            };

            const response = await request(app)
                .post('/api/inventory/consume')
                .send(consumeData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('POST /api/inventory/consume should validate required fields', async () => {
            const invalidData = {
                location: 'main-cellar'
                // Missing vintage_id and quantity
            };

            const response = await request(app)
                .post('/api/inventory/consume')
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('required');
        });

        test('POST /api/inventory/receive should handle wine receipt', async () => {
            const receiveData = {
                vintage_id: 'test-vintage-1',
                location: 'main-cellar',
                quantity: 12,
                unit_cost: 25.50,
                reference_id: 'PO-001',
                notes: 'Test receipt',
                created_by: 'test-user'
            };

            const response = await request(app)
                .post('/api/inventory/receive')
                .send(receiveData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('POST /api/inventory/intake should create intake orders', async () => {
            const intakeRequest = {
                source_type: 'manual',
                items: [
                    {
                        wine: { name: 'Test Wine', producer: 'Test Producer', region: 'Test Region' },
                        vintage: { year: 2022 },
                        stock: { quantity: 6, unit_cost: 42 }
                    }
                ]
            };

            const response = await request(app)
                .post('/api/inventory/intake')
                .send(intakeRequest)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('intake_id');
        });

        test('POST /api/inventory/intake/:intakeId/receive should require receipts', async () => {
            const response = await request(app)
                .post('/api/inventory/intake/101/receive')
                .send({ receipts: [] })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('receipts');
        });

        test('POST /api/inventory/intake/:intakeId/receive should record receipts', async () => {
            const receiptRequest = {
                receipts: [
                    { wine_name: 'Test Wine', quantity_received: 6 },
                    { wine_name: 'Test Wine 2', quantity_received: 3 }
                ],
                created_by: 'test-user',
                notes: 'Received partial order'
            };

            const response = await request(app)
                .post('/api/inventory/intake/101/receive')
                .send(receiptRequest)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('received_count', receiptRequest.receipts.length);
        });

        test('GET /api/inventory/intake/:intakeId/status should return intake status', async () => {
            const response = await request(app)
                .get('/api/inventory/intake/101/status')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('all_received');
        });

        test('POST /api/inventory/move should handle wine movement', async () => {
            const moveData = {
                vintage_id: 'test-vintage-1',
                from_location: 'main-cellar',
                to_location: 'service-bar',
                quantity: 2,
                notes: 'Moving for service',
                created_by: 'test-user'
            };

            const response = await request(app)
                .post('/api/inventory/move')
                .send(moveData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('POST /api/inventory/reserve should handle wine reservation', async () => {
            const reserveData = {
                vintage_id: 'test-vintage-1',
                location: 'main-cellar',
                quantity: 1,
                notes: 'Reserved for dinner',
                created_by: 'test-user'
            };

            const response = await request(app)
                .post('/api/inventory/reserve')
                .send(reserveData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('GET /api/inventory/ledger/:vintage_id should return transaction history', async () => {
            const vintageId = 'test-vintage-1';
            const response = await request(app)
                .get(`/api/inventory/ledger/${vintageId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });
    });

    describe('Pairing Endpoints', () => {
        test('POST /api/pairing/recommend should generate wine pairings', async () => {
            const pairingRequest = {
                dish: 'Grilled salmon with lemon',
                context: {
                    occasion: 'casual-dining',
                    guestCount: 4
                },
                guestPreferences: 'No heavy reds, prefer lighter wines',
                options: {}
            };

            const response = await request(app)
                .post('/api/pairing/recommend')
                .send(pairingRequest)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });

        test('POST /api/pairing/recommend should require dish parameter', async () => {
            const invalidRequest = {
                context: { occasion: 'formal-dining' }
                // Missing dish
            };

            const response = await request(app)
                .post('/api/pairing/recommend')
                .send(invalidRequest)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Dish information is required');
        });

        test('POST /api/pairing/quick should provide quick pairing suggestions', async () => {
            const quickPairingRequest = {
                dish: 'Beef tenderloin',
                context: { occasion: 'formal-dining' },
                ownerLikes: ['Bordeaux', 'Cabernet Sauvignon']
            };

            const response = await request(app)
                .post('/api/pairing/quick')
                .send(quickPairingRequest)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('Procurement Endpoints', () => {
        test('GET /api/procurement/opportunities should return procurement suggestions', async () => {
            const response = await request(app)
                .get('/api/procurement/opportunities')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.summary).toBeDefined();
            expect(response.body.data.opportunities).toBeInstanceOf(Array);
            expect(response.body.data.summary).toEqual(expect.objectContaining({
                total_opportunities: expect.any(Number),
                recommended_spend: expect.any(Number),
                projected_value: expect.any(Number)
            }));
        });

        test('GET /api/procurement/opportunities should handle filters', async () => {
            const response = await request(app)
                .get('/api/procurement/opportunities?region=Bordeaux&wine_type=Red&max_price=100')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.summary.budget_limit).toBe(100);
            expect(response.body.data.summary.total_opportunities).toBeGreaterThanOrEqual(0);
        });

        test('GET /api/procurement/opportunities should handle engine errors gracefully', async () => {
            const ProcurementEngine = require('../../backend/core/procurement_engine');
            const original = ProcurementEngine.prototype.analyzeProcurementOpportunities;
            ProcurementEngine.prototype.analyzeProcurementOpportunities = jest.fn(() => Promise.reject(new Error('Mock failure')));

            const response = await request(app)
                .get('/api/procurement/opportunities')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Mock failure');

            ProcurementEngine.prototype.analyzeProcurementOpportunities = original;
        });

        test('POST /api/procurement/analyze should analyze purchase decisions', async () => {
            const analysisRequest = {
                vintage_id: 'test-vintage-1',
                supplier_id: 'supplier-123',
                quantity: 12,
                context: { budget: 1000 }
            };

            const response = await request(app)
                .post('/api/procurement/analyze')
                .send(analysisRequest)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.analysis).toBeDefined();
            expect(response.body.data.analysis).toEqual(expect.objectContaining({
                estimated_market_price: expect.any(Number),
                estimated_savings: expect.any(Number)
            }));
            expect(response.body.data.projected_stock_after_purchase).toBeDefined();
        });

        test('POST /api/procurement/analyze should validate required fields', async () => {
            const invalidRequest = {
                quantity: 12
                // Missing vintage_id and supplier_id
            };

            const response = await request(app)
                .post('/api/procurement/analyze')
                .send(invalidRequest)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        test('POST /api/procurement/order should generate purchase orders', async () => {
            const orderRequest = {
                items: [
                    { vintage_id: 'vintage-1', quantity: 12, price: 25.0 },
                    { vintage_id: 'vintage-2', quantity: 6, price: 45.0 }
                ],
                supplier_id: 'supplier-123',
                delivery_date: '2024-02-15',
                notes: 'Standard delivery'
            };

            const response = await request(app)
                .post('/api/procurement/order')
                .send(orderRequest)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('POST /api/procurement/order should validate items array', async () => {
            const invalidRequest = {
                supplier_id: 'supplier-123',
                items: [] // Empty items array
            };

            const response = await request(app)
                .post('/api/procurement/order')
                .send(invalidRequest)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Items array is required');
        });

        test('POST /api/procurement/order should validate item quantities and prices', async () => {
            const invalidOrder = {
                items: [
                    { vintage_id: 'vintage-1', quantity: 0, price: -10 }
                ],
                supplier_id: 'supplier-123',
                delivery_date: '2024-02-15'
            };

            const response = await request(app)
                .post('/api/procurement/order')
                .send(invalidOrder)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('positive quantity');
        });

        test('POST /api/procurement/order should require supplier id', async () => {
            const response = await request(app)
                .post('/api/procurement/order')
                .send({
                    items: [
                        { vintage_id: 'vintage-1', quantity: 6, price: 40 }
                    ]
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('supplier_id is required');
        });
    });

    describe('Wine Catalog Endpoints', () => {
        test('GET /api/wines should return wine catalog', async () => {
            const response = await request(app)
                .get('/api/wines')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('GET /api/wines should handle search and filters', async () => {
            const response = await request(app)
                .get('/api/wines?search=Bordeaux&wine_type=Red&limit=20&offset=0')
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('POST /api/wines should add new wine to inventory', async () => {
            const newWineData = {
                wine: {
                    name: 'Test Bordeaux',
                    producer: 'Test Château',
                    region: 'Bordeaux',
                    wine_type: 'Red'
                },
                vintage: {
                    year: 2020,
                    quality_score: 85
                },
                stock: {
                    quantity: 12,
                    location: 'main-cellar',
                    unit_cost: 35.0
                }
            };

            const response = await request(app)
                .post('/api/wines')
                .send(newWineData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('vintage intelligence');
        });

        test('POST /api/wines should validate required data', async () => {
            const invalidData = {
                wine: { name: 'Test Wine' }
                // Missing vintage and stock
            };

            const response = await request(app)
                .post('/api/wines')
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        test('GET /api/wines/:id should return specific wine details', async () => {
            const wineId = 'test-wine-1';
            const response = await request(app)
                .get(`/api/wines/${wineId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });

        test('GET /api/wines/:id should return 404 for non-existent wine', async () => {
            const nonExistentId = 'non-existent-wine';
            const response = await request(app)
                .get(`/api/wines/${nonExistentId}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Wine not found');
        });
    });

    describe('Vintage Intelligence Endpoints', () => {
        test('GET /api/vintage/analysis/:wine_id should return vintage analysis', async () => {
            const wineId = 'test-wine-1';
            const response = await request(app)
                .get(`/api/vintage/analysis/${wineId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.weatherAnalysis).toBeDefined();
        });

        test('POST /api/vintage/enrich should enrich wine data', async () => {
            const enrichRequest = {
                wine_id: 'test-wine-1'
            };

            const response = await request(app)
                .post('/api/vintage/enrich')
                .send(enrichRequest)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('vintage intelligence');
        });

        test('POST /api/vintage/enrich should validate wine_id', async () => {
            const invalidRequest = {};

            const response = await request(app)
                .post('/api/vintage/enrich')
                .send(invalidRequest)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('wine_id is required');
        });

        test('GET /api/vintage/procurement-recommendations should return recommendations', async () => {
            const response = await request(app)
                .get('/api/vintage/procurement-recommendations')
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('POST /api/vintage/batch-enrich should process multiple wines', async () => {
            const batchRequest = {
                filters: {
                    region: 'Bordeaux',
                    year_from: 2018,
                    year_to: 2022
                },
                limit: 10
            };

            const response = await request(app)
                .post('/api/vintage/batch-enrich')
                .send(batchRequest)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('POST /api/vintage/pairing-insight should generate pairing insights', async () => {
            const insightRequest = {
                wine_id: 'test-wine-1',
                dish_context: {
                    dish: 'Grilled lamb',
                    cooking_method: 'grilled',
                    season: 'summer'
                }
            };

            const response = await request(app)
                .post('/api/vintage/pairing-insight')
                .send(insightRequest)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.pairingInsight).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('Should handle 404 for non-existent endpoints', async () => {
            const response = await request(app)
                .get('/api/non-existent-endpoint')
                .expect(404);
        });

        test('Should handle malformed JSON in requests', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .type('application/json')
                .send('{ invalid json }')
                .expect(400);
        });

        test('Should have appropriate CORS headers', async () => {
            const response = await request(app)
                .get('/api/system/health')
                .expect(200);

            expect(response.headers['access-control-allow-origin']).toBeDefined();
        });

        test('Should have security headers', async () => {
            const response = await request(app)
                .get('/api/system/health')
                .expect(200);

            // Check for Helmet security headers
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBeDefined();
        });
    });

    describe('Rate Limiting', () => {
        test('Should handle multiple requests within limits', async () => {
            const requests = [];
            for (let i = 0; i < 5; i++) {
                requests.push(request(app).get('/api/system/health'));
            }

            const responses = await Promise.all(requests);
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });
    });
});