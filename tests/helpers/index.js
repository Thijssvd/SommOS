// SommOS Test Helpers
// Common utilities and helpers for testing

const TestDataFactory = require('../fixtures/factory');

class TestHelpers {
    constructor() {
        this.factory = new TestDataFactory();
    }

    // Setup database with schema and basic test data
    async setupTestDatabase(db) {
        console.log('Setting up test database...');
        
        // Initialize the database (this will load schema)
        await db.initialize();
        
        // Load schema from schema.sql file with error handling
        const fs = require('fs');
        const path = require('path');
        const schemaPath = path.join(__dirname, '../../backend/database/schema.sql');
        
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            // Execute the entire schema at once to maintain proper order
            try {
                await db.exec(schema);
            } catch (error) {
                // If full schema fails, try individual statements with better error handling
                if (error.message.includes('already exists')) {
                    console.log('Schema already loaded, continuing...');
                } else {
                    console.warn(`Schema loading failed: ${error.message}`);
                    // Try to execute individual statements as fallback
                    const statements = schema
                        .split(';')
                        .map(stmt => stmt.trim())
                        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
                    
                    for (const statement of statements) {
                        try {
                            await db.exec(statement + ';');
                        } catch (stmtError) {
                            // Ignore "table already exists" and "index already exists" errors
                            if (!stmtError.message.includes('already exists')) {
                                console.warn(`Schema statement failed: ${statement.substring(0, 50)}... - ${stmtError.message}`);
                            }
                        }
                    }
                }
            }
        }
        
        // Create basic test dataset using factory
        const dataset = await this.factory.createBasicDataset(db);
        
        console.log('Test database setup completed');
        return dataset;
    }

    // Cleanup test database
    async cleanupTestDatabase(db) {
        await this.factory.cleanup(db);
    }

    // Common assertions for API responses
    assertApiSuccess(response, expectedStatus = 200) {
        expect(response.status).toBe(expectedStatus);
        expect(response.data).toBeDefined();
        expect(response.data.success).toBe(true);
    }

    assertApiError(response, expectedStatus = 500) {
        expect(response.status).toBe(expectedStatus);
        expect(response.data).toBeDefined();
        expect(response.data.success).toBe(false);
        expect(response.data.error).toBeDefined();
    }

    // Validate wine data structure
    validateWineData(wine) {
        expect(wine).toBeDefined();
        expect(wine.id).toBeDefined();
        expect(wine.name).toBeDefined();
        expect(wine.producer).toBeDefined();
        expect(wine.region).toBeDefined();
        expect(wine.country).toBeDefined();
        expect(wine.wine_type).toBeDefined();
        expect(['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified']).toContain(wine.wine_type);
    }

    // Validate vintage data structure
    validateVintageData(vintage) {
        expect(vintage).toBeDefined();
        expect(vintage.id).toBeDefined();
        expect(vintage.wine_id).toBeDefined();
        expect(vintage.year).toBeDefined();
        expect(vintage.year).toBeGreaterThan(1800);
        expect(vintage.year).toBeLessThanOrEqual(new Date().getFullYear());
    }

    // Validate stock data structure
    validateStockData(stock) {
        expect(stock).toBeDefined();
        expect(stock.id).toBeDefined();
        expect(stock.vintage_id).toBeDefined();
        expect(stock.location).toBeDefined();
        expect(stock.quantity).toBeGreaterThanOrEqual(0);
        expect(stock.reserved_quantity).toBeGreaterThanOrEqual(0);
        expect(stock.cost_per_bottle).toBeGreaterThan(0);
    }

    // Validate supplier data structure
    validateSupplierData(supplier) {
        expect(supplier).toBeDefined();
        expect(supplier.id).toBeDefined();
        expect(supplier.name).toBeDefined();
        expect(supplier.email).toBeDefined();
        expect(supplier.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        expect(supplier.active).toBeDefined();
        expect([0, 1]).toContain(supplier.active);
    }

    // Validate ledger entry structure
    validateLedgerEntry(entry) {
        expect(entry).toBeDefined();
        expect(entry.id).toBeDefined();
        expect(entry.vintage_id).toBeDefined();
        expect(entry.transaction_type).toBeDefined();
        expect(['IN', 'OUT', 'MOVE', 'ADJUST']).toContain(entry.transaction_type);
        expect(entry.quantity).toBeDefined();
        expect(entry.created_at).toBeDefined();
    }

    // Create mock Express response object for testing
    createMockResponse() {
        return {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            data: null,
            statusCode: 200
        };
    }

    // Create mock Express request object for testing
    createMockRequest(overrides = {}) {
        return {
            params: {},
            query: {},
            body: {},
            headers: {},
            ...overrides
        };
    }

    // Wait helper for async operations
    async wait(ms = 100) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generate random test data
    generateRandomWineData() {
        const regions = ['Bordeaux', 'Burgundy', 'Champagne', 'Tuscany', 'Napa Valley', 'Rioja'];
        const producers = ['Château Test', 'Domaine Test', 'Test Winery', 'Vinos Test', 'Test Estate'];
        const wineTypes = ['Red', 'White', 'Rosé', 'Sparkling'];
        
        return {
            name: `Test Wine ${Math.floor(Math.random() * 1000)}`,
            producer: producers[Math.floor(Math.random() * producers.length)],
            region: regions[Math.floor(Math.random() * regions.length)],
            wine_type: wineTypes[Math.floor(Math.random() * wineTypes.length)],
            alcohol_content: 12 + Math.random() * 4, // 12-16%
            year: 2015 + Math.floor(Math.random() * 9) // 2015-2023
        };
    }

    generateRandomSupplierData() {
        const companies = ['Premium Wines', 'Elite Importers', 'Fine Wine Co', 'Select Vintages', 'Wine Direct'];
        const domains = ['example.com', 'test.com', 'wineimport.com', 'premium.wine'];
        
        const company = companies[Math.floor(Math.random() * companies.length)];
        return {
            name: `${company} ${Math.floor(Math.random() * 100)}`,
            contact_person: 'Test Contact',
            email: `contact${Math.floor(Math.random() * 1000)}@${domains[Math.floor(Math.random() * domains.length)]}`,
            phone: `+1-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
            rating: Math.floor(Math.random() * 5) + 1
        };
    }

    // Test data validation helpers
    isValidDateString(dateString) {
        return !isNaN(Date.parse(dateString));
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    isValidPhoneNumber(phone) {
        return /^\+?[\d\s\-\(\)]+$/.test(phone);
    }

    // Database query helpers for testing
    async countRecords(db, tableName) {
        const result = await db.get(`SELECT COUNT(*) as count FROM ${tableName}`);
        return result.count;
    }

    async getLastInsertedRecord(db, tableName) {
        return await db.get(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 1`);
    }

    // Create factory instance for external use
    getFactory() {
        return this.factory;
    }
}

module.exports = TestHelpers;