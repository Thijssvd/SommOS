jest.mock('../../backend/config/env', () => ({
    getConfig: () => ({
        nodeEnv: 'development',
        openMeteo: { baseUrl: 'https://mock.open-meteo.test' },
        openAI: { apiKey: null },
        deepSeek: { apiKey: null },
        database: { path: ':memory:' },
        features: { disableExternalCalls: true }
    })
}));

jest.mock('../../backend/database/connection');

const MockDatabase = require('../../backend/database/connection');
const InventoryManager = require('../../backend/core/inventory_manager');

describe('Inventory enrichment does not block core actions', () => {
    let manager;

    beforeEach(() => {
        MockDatabase.getInstance().reset();
        manager = new InventoryManager(MockDatabase.getInstance());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('addWineToInventory succeeds even when enrichment fails', async () => {
        const wineData = {
            name: 'Test Wine',
            producer: 'Test Estate',
            region: 'Test Region',
            country: 'Test Country',
            wine_type: 'Red'
        };
        const vintageData = { year: 2020 };
        const stockData = { quantity: 6, location: 'main-cellar', cost_per_bottle: 25, created_by: 'tester' };

        jest.spyOn(manager, 'findOrCreateWine').mockResolvedValue({ id: 'wine-1', ...wineData });
        jest.spyOn(manager, 'findOrCreateVintage').mockResolvedValue({ id: 'vintage-1', year: 2020 });
        jest.spyOn(manager, 'addToStock').mockResolvedValue();
        jest.spyOn(manager, 'recordTransaction').mockResolvedValue();
        jest.spyOn(manager.vintageIntelligence, 'enrichWineData').mockRejectedValue(new Error('service unavailable'));

        const result = await manager.addWineToInventory(wineData, vintageData, stockData, { origin: 'inventory.test' });

        expect(result.success).toBe(true);
        expect(result.enrichmentError).toBe('service unavailable');
        expect(manager.findOrCreateWine).toHaveBeenCalled();
        expect(manager.findOrCreateVintage).toHaveBeenCalled();
        expect(manager.addToStock).toHaveBeenCalled();
        expect(manager.recordTransaction).toHaveBeenCalled();
    });
});
