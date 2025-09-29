const fs = require('fs');
const path = require('path');

const Database = require('../../backend/database/connection');
const InventoryManager = require('../../backend/core/inventory_manager');

const SCHEMA_PATH = path.join(__dirname, '../../backend/database/schema.sql');

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('SommOS inventory conflict safeguards', () => {
    let db;
    let inventoryManager;
    let vintageId;

    const loadSchema = async () => {
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        await db.exec(schema);
    };

    beforeEach(async () => {
        db = new Database(':memory:');
        await db.initialize();
        await loadSchema();

        const wineInsert = await db.run(`
            INSERT INTO Wines (
                name, producer, region, country, wine_type,
                grape_varieties, updated_at, updated_by, origin
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            'Test Conflict Wine',
            'Conflict Producer',
            'Conflict Region',
            'Conflict Country',
            'Red',
            JSON.stringify(['Merlot']),
            nowSeconds(),
            'test-suite',
            'tests'
        ]);

        const vintageInsert = await db.run(`
            INSERT INTO Vintages (
                wine_id, year, updated_at, updated_by, origin
            ) VALUES (?, ?, ?, ?, ?)
        `, [
            wineInsert.lastID,
            2020,
            nowSeconds(),
            'test-suite',
            'tests'
        ]);

        vintageId = vintageInsert.lastID;

        await db.run(`
            INSERT INTO Stock (
                vintage_id, location, quantity, reserved_quantity, updated_at, updated_by, origin
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            vintageId,
            'main-cellar',
            3,
            1,
            nowSeconds(),
            'test-suite',
            'tests'
        ]);

        inventoryManager = new InventoryManager(db);
    });

    afterEach(async () => {
        await db.close();
    });

    test('rejects consumption that would drop stock below zero and preserves counts', async () => {
        await expect(inventoryManager.consumeWine(
            vintageId,
            'main-cellar',
            3,
            'inventory audit',
            'inventory-tester',
            { op_id: 'op-conflict', updated_at: nowSeconds(), origin: 'tests' }
        )).rejects.toMatchObject({
            name: 'InventoryConflictError',
            statusCode: 409,
            code: 'INVENTORY_CONFLICT'
        });

        const remaining = await db.get(`
            SELECT quantity, reserved_quantity
            FROM Stock
            WHERE vintage_id = ? AND location = ?
        `, [vintageId, 'main-cellar']);

        expect(remaining.quantity).toBe(3);
        expect(remaining.reserved_quantity).toBe(1);
    });
});
