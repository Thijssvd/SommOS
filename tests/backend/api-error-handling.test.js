const request = require('supertest');

const setupTestApp = (customizeMocks) => {
    jest.resetModules();

    jest.doMock('../../backend/database/connection');
    jest.doMock('../../backend/core/pairing_engine');
    jest.doMock('../../backend/core/inventory_manager');
    jest.doMock('../../backend/core/procurement_engine');
    jest.doMock('../../backend/core/vintage_intelligence');

    const PairingEngine = require('../../backend/core/pairing_engine');
    const InventoryManager = require('../../backend/core/inventory_manager');
    const ProcurementEngine = require('../../backend/core/procurement_engine');
    const VintageIntelligenceService = require('../../backend/core/vintage_intelligence');
    const Database = require('../../backend/database/connection');

    if (typeof customizeMocks === 'function') {
        customizeMocks({
            PairingEngine,
            InventoryManager,
            ProcurementEngine,
            VintageIntelligenceService,
            Database,
        });
    }

    const express = require('express');
    const routes = require('../../backend/api/routes');

    const app = express();
    app.use(express.json());
    app.use('/api', routes);

    return { app, PairingEngine, InventoryManager, ProcurementEngine, VintageIntelligenceService, Database };
};

describe('SommOS API error handling and edge cases', () => {
    test('Pairing endpoints propagate engine failures', async () => {
        const { app, PairingEngine } = setupTestApp(({ PairingEngine }) => {
            jest.spyOn(PairingEngine.prototype, 'generatePairings').mockRejectedValue(new Error('Pairing failure'));
            jest.spyOn(PairingEngine.prototype, 'quickPairing').mockRejectedValue(new Error('Quick pairing failure'));
        });

        await request(app)
            .post('/api/pairing/recommend')
            .send({ dish: 'Seared tuna' })
            .expect(500)
            .expect(res => {
                expect(res.body.success).toBe(false);
                expect(res.body.error.code).toBe('PAIRING_RECOMMENDATION_FAILED');
                expect(res.body.error.message).toBe('Pairing failure');
                expect(res.body.error.timestamp).toBeDefined();
            });

        await request(app)
            .post('/api/pairing/quick')
            .send({ dish: 'Oysters' })
            .expect(500)
            .expect(res => {
                expect(res.body.success).toBe(false);
                expect(res.body.error.code).toBe('PAIRING_QUICK_FAILED');
                expect(res.body.error.message).toBe('Quick pairing failure');
                expect(res.body.error.timestamp).toBeDefined();
            });

        jest.restoreAllMocks();
    });

    test('Inventory endpoints map service errors to appropriate status codes', async () => {
        const errorMessages = {
            stock: 'Inventory fetch failed',
            consume: 'Consumption record failed',
            receive: 'Receiving failed at vendor',
            intake: 'Required intake data missing',
            intakeReceive: 'Intake not found in backlog',
            intakeStatus: 'Intake not found',
            move: 'Movement failed to commit',
            reserve: 'Reservation failed due to conflict',
            ledger: 'Ledger retrieval failed',
        };

        const { app, InventoryManager } = setupTestApp(({ InventoryManager }) => {
            jest.spyOn(InventoryManager.prototype, 'getCurrentStock').mockRejectedValue(new Error(errorMessages.stock));
            jest.spyOn(InventoryManager.prototype, 'consumeWine').mockRejectedValue(new Error(errorMessages.consume));
            jest.spyOn(InventoryManager.prototype, 'receiveWine').mockRejectedValue(new Error(errorMessages.receive));
            jest.spyOn(InventoryManager.prototype, 'createInventoryIntake').mockRejectedValue(new Error(errorMessages.intake));
            jest.spyOn(InventoryManager.prototype, 'receiveInventoryIntake').mockRejectedValue(new Error(errorMessages.intakeReceive));
            jest.spyOn(InventoryManager.prototype, 'getInventoryIntakeStatus').mockRejectedValue(new Error(errorMessages.intakeStatus));
            jest.spyOn(InventoryManager.prototype, 'moveWine').mockRejectedValue(new Error(errorMessages.move));
            jest.spyOn(InventoryManager.prototype, 'reserveWine').mockRejectedValue(new Error(errorMessages.reserve));
            jest.spyOn(InventoryManager.prototype, 'getLedgerHistory').mockRejectedValue(new Error(errorMessages.ledger));
        });

        await request(app)
            .get('/api/inventory/stock')
            .expect(500)
            .expect(res => {
                expect(res.body.error).toBe(errorMessages.stock);
            });

        await request(app)
            .post('/api/inventory/consume')
            .send({ vintage_id: 'vintage-1', location: 'main-cellar', quantity: 1 })
            .expect(500)
            .expect(res => {
                expect(res.body.error).toBe(errorMessages.consume);
            });

        await request(app)
            .post('/api/inventory/receive')
            .send({ vintage_id: 'vintage-1', location: 'main-cellar', quantity: 6 })
            .expect(500)
            .expect(res => {
                expect(res.body.error).toBe(errorMessages.receive);
            });

        await request(app)
            .post('/api/inventory/intake')
            .send({ items: [] })
            .expect(400)
            .expect(res => {
                expect(res.body.error).toBe(errorMessages.intake);
            });

        await request(app)
            .post('/api/inventory/intake/42/receive')
            .send({ receipts: [{ wine_name: 'Test', quantity_received: 1 }] })
            .expect(400)
            .expect(res => {
                expect(res.body.error).toBe(errorMessages.intakeReceive);
            });

        await request(app)
            .get('/api/inventory/intake/42/status')
            .expect(404)
            .expect(res => {
                expect(res.body.error).toBe(errorMessages.intakeStatus);
            });

        await request(app)
            .post('/api/inventory/move')
            .send({ vintage_id: 'vintage-1', from_location: 'A', to_location: 'B', quantity: 1 })
            .expect(500)
            .expect(res => {
                expect(res.body.error).toBe(errorMessages.move);
            });

        await request(app)
            .post('/api/inventory/reserve')
            .send({ vintage_id: 'vintage-1', location: 'main-cellar', quantity: 2 })
            .expect(500)
            .expect(res => {
                expect(res.body.error).toBe(errorMessages.reserve);
            });

        await request(app)
            .get('/api/inventory/ledger/vintage-1')
            .expect(500)
            .expect(res => {
                expect(res.body.error).toBe(errorMessages.ledger);
            });

        jest.restoreAllMocks();
    });

    test('Procurement endpoints surface engine exceptions', async () => {
        const { app, ProcurementEngine } = setupTestApp(({ ProcurementEngine }) => {
            jest.spyOn(ProcurementEngine.prototype, 'analyzeProcurementOpportunities').mockRejectedValue(new Error('Opportunity analysis failed'));
            jest.spyOn(ProcurementEngine.prototype, 'analyzePurchaseDecision').mockRejectedValue(new Error('Purchase decision failed'));
            jest.spyOn(ProcurementEngine.prototype, 'generatePurchaseOrder').mockRejectedValue(new Error('Purchase order failed'));
        });

        await request(app)
            .get('/api/procurement/opportunities')
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('PROCUREMENT_ANALYSIS_FAILED');
                expect(res.body.error.message).toBe('Opportunity analysis failed');
                expect(res.body.error.timestamp).toBeDefined();
            });

        await request(app)
            .post('/api/procurement/analyze')
            .send({ vintage_id: 'vintage-1', supplier_id: 'supplier-1' })
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('PROCUREMENT_DECISION_FAILED');
                expect(res.body.error.message).toBe('Purchase decision failed');
                expect(res.body.error.timestamp).toBeDefined();
            });

        await request(app)
            .post('/api/procurement/order')
            .send({
                supplier_id: 'supplier-1',
                items: [{ vintage_id: 'vintage-1', quantity: 6, price: 40 }],
            })
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('PROCUREMENT_ORDER_FAILED');
                expect(res.body.error.message).toBe('Purchase order failed');
                expect(res.body.error.timestamp).toBeDefined();
            });

        jest.restoreAllMocks();
    });

    test('Wine catalog endpoints handle data source failures', async () => {
        const failingDb = {
            all: jest.fn().mockRejectedValue(new Error('Catalog query failed')),
            get: jest.fn().mockRejectedValue(new Error('Wine lookup failed')),
        };

        const { app, InventoryManager, Database } = setupTestApp(({ InventoryManager, Database }) => {
            jest.spyOn(Database, 'getInstance').mockReturnValue(failingDb);
            jest.spyOn(InventoryManager.prototype, 'addWineToInventory').mockRejectedValue(new Error('Inventory enrichment failed'));
        });

        await request(app)
            .get('/api/wines?region=Bordeaux&producer=Test&wine_type=Red&search=Test')
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('WINES_LIST_FAILED');
                expect(res.body.error.message).toBe('Catalog query failed');
                expect(res.body.error.timestamp).toBeDefined();
            });

        await request(app)
            .post('/api/wines')
            .send({
                wine: { name: 'New Wine', region: 'Bordeaux', wine_type: 'Red' },
                vintage: { year: 2020 },
                stock: { quantity: 6 },
            })
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('VINTAGE_ENRICH_FAILED');
                expect(res.body.error.message).toBe('Inventory enrichment failed');
                expect(res.body.error.timestamp).toBeDefined();
            });

        await request(app)
            .get('/api/wines/test-wine-1')
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('WINE_DETAILS_FAILED');
                expect(res.body.error.message).toBe('Wine lookup failed');
                expect(res.body.error.timestamp).toBeDefined();
            });

        jest.restoreAllMocks();
    });

    test('Vintage intelligence endpoints surface enrichment and insight errors', async () => {
        const { app, VintageIntelligenceService, Database } = setupTestApp(({ VintageIntelligenceService, Database }) => {
            const dbInstance = Database.getInstance();
            jest.spyOn(Database, 'getInstance').mockImplementation(() => dbInstance);

            const originalAll = dbInstance.all.bind(dbInstance);
            jest.spyOn(dbInstance, 'all').mockImplementation(async (query, params) => {
                if (query.includes('FROM Wines w') && query.includes('LEFT JOIN Vintages v') && query.includes('ORDER BY w.name LIMIT ?')) {
                    return [
                        {
                            id: 'mock-vintage-1',
                            wine_id: 'test-wine-1',
                        },
                    ];
                }

                return originalAll(query, params);
            });

            jest.spyOn(VintageIntelligenceService.prototype, 'getWeatherContextForPairing')
                .mockRejectedValueOnce(new Error('Weather context unavailable'))
                .mockResolvedValue({ region: 'Bordeaux', year: 2020 });

            jest.spyOn(VintageIntelligenceService.prototype, 'enrichWineData').mockRejectedValue(new Error('Enrichment failed'));
            jest.spyOn(VintageIntelligenceService.prototype, 'getInventoryProcurementRecommendations').mockRejectedValue(new Error('Recommendation engine offline'));
            jest.spyOn(VintageIntelligenceService.prototype, 'batchEnrichWines').mockRejectedValue(new Error('Batch enrichment failed'));
            jest.spyOn(VintageIntelligenceService.prototype, 'generateWeatherPairingInsight').mockImplementation(() => {
                throw new Error('Insight generation failed');
            });
        });

        await request(app)
            .get('/api/vintage/analysis/test-wine-1')
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('VINTAGE_ANALYSIS_FAILED');
                expect(res.body.error.message).toBe('Weather context unavailable');
                expect(res.body.error.timestamp).toBeDefined();
            });

        await request(app)
            .post('/api/vintage/enrich')
            .send({ wine_id: 'test-wine-1' })
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('VINTAGE_ENRICH_FAILED');
                expect(res.body.error.message).toBe('Enrichment failed');
                expect(res.body.error.timestamp).toBeDefined();
            });

        await request(app)
            .get('/api/vintage/procurement-recommendations')
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('PAIRING_ENGINE_OFFLINE');
                expect(res.body.error.message).toBe('Recommendation engine offline');
                expect(res.body.error.timestamp).toBeDefined();
            });

        await request(app)
            .post('/api/vintage/batch-enrich')
            .send({ filters: { region: 'Bordeaux' }, limit: 0 })
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('VINTAGE_BATCH_ENRICH_FAILED');
                expect(res.body.error.message).toBe('Batch enrichment failed');
                expect(res.body.error.timestamp).toBeDefined();
            });

        await request(app)
            .post('/api/vintage/pairing-insight')
            .send({ wine_id: 'test-wine-1', dish_context: { dish: 'Steak' } })
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('VINTAGE_INSIGHT_FAILED');
                expect(res.body.error.message).toBe('Insight generation failed');
                expect(res.body.error.timestamp).toBeDefined();
            });

        jest.restoreAllMocks();
    });

    test('System endpoints fall back to error responses when the database is unavailable', async () => {
        const { app, Database } = setupTestApp(({ Database }) => {
            jest.spyOn(Database, 'getInstance').mockImplementation(() => {
                throw new Error('Database offline');
            });
        });

        await request(app)
            .get('/api/system/health')
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('DATABASE_OFFLINE');
                expect(res.body.error.message).toBe('Database offline');
                expect(res.body.error.timestamp).toBeDefined();
                expect(res.body.status).toBe('unhealthy');
            });

        await request(app)
            .get('/api/system/activity')
            .expect(500)
            .expect(res => {
                expect(res.body.error.code).toBe('DATABASE_OFFLINE');
                expect(res.body.error.message).toBe('Database offline');
                expect(res.body.error.timestamp).toBeDefined();
            });

        await request(app)
            .get('/api/unknown-endpoint')
            .expect(404)
            .expect(res => {
                expect(res.body.success).toBe(false);
                expect(res.body.error.code).toBe('NOT_FOUND');
                expect(res.body.error.message).toBe('Endpoint not found');
                expect(res.body.error.timestamp).toBeDefined();
            });

        jest.restoreAllMocks();
    });

    test('Wine catalog filters include region and producer parameters', async () => {
        const { app } = setupTestApp();

        const response = await request(app)
            .get('/api/wines?region=Bordeaux&producer=Ch%C3%A2teau&wine_type=Red&search=Bordeaux')
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
    });
});
