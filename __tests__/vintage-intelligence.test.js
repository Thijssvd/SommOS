const request = require('supertest');
const app = require('../backend/server');
const Database = require('../backend/database/connection');

describe('Vintage Intelligence Service Integration', () => {
    let db;
    
    beforeAll(async () => {
        // Initialize database connection for testing
        db = Database.getInstance();
        await db.initialize();
    });
    
    afterAll(async () => {
        // Clean up database connection
        if (db) {
            db.close();
        }
    });
    
    describe('Wine Addition with Automatic Enrichment', () => {
        test('should add wine with vintage intelligence analysis', async () => {
            const wineData = {
                wine: {
                    name: "Test Château Margaux",
                    producer: "Test Château",
                    region: "Bordeaux", 
                    country: "France",
                    wine_type: "Red",
                    grape_varieties: ["Cabernet Sauvignon", "Merlot"],
                    alcohol_content: 13.5,
                    style: "Full-bodied",
                    tasting_notes: "Complex test wine",
                    food_pairings: ["Beef", "Lamb"],
                    serving_temp_min: 16,
                    serving_temp_max: 18
                },
                vintage: {
                    year: 2018,
                    quality_score: 95,
                    critic_score: 98,
                    peak_drinking_start: 10,
                    peak_drinking_end: 30
                },
                stock: {
                    location: "TEST_CELLAR",
                    quantity: 6,
                    cost_per_bottle: 500.00,
                    reference_id: "TEST-001",
                    notes: "Test wine",
                    created_by: "test-user"
                }
            };
            
            const response = await request(app)
                .post('/api/wines')
                .send(wineData)
                .expect(201);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('wine');
            expect(response.body.data).toHaveProperty('vintage');
            expect(response.body.data.wine.name).toBe(wineData.wine.name);
            
            // Store wine ID for further tests
            global.testWineId = response.body.data.wine.id;
        }, 30000);
    });
    
    describe('Vintage Analysis Endpoints', () => {
        test('should get vintage analysis for wine', async () => {
            if (!global.testWineId) {
                return; // Skip if wine wasn't created
            }
            
            const response = await request(app)
                .get(`/api/vintage/analysis/${global.testWineId}`)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('wine');
            expect(response.body.data.wine.name).toBe("Test Château Margaux");
        });
        
        test('should get procurement recommendations', async () => {
            const response = await request(app)
                .get('/api/vintage/procurement-recommendations')
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
        
        test('should handle manual enrichment', async () => {
            if (!global.testWineId) {
                return;
            }
            
            const response = await request(app)
                .post('/api/vintage/enrich')
                .send({ wine_id: global.testWineId })
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('name');
        }, 30000);
    });
    
    describe('Error Handling', () => {
        test('should handle non-existent wine analysis request', async () => {
            const response = await request(app)
                .get('/api/vintage/analysis/99999')
                .expect(404);
                
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Wine not found');
        });
        
        test('should handle invalid enrichment request', async () => {
            const response = await request(app)
                .post('/api/vintage/enrich')
                .send({})
                .expect(400);
                
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('wine_id is required');
        });
    });
});

describe('Fallback Mode', () => {
    test('should work without OpenAI API key', async () => {
        // Temporarily remove API key
        const originalKey = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;
        
        const wineData = {
            wine: {
                name: "Test Fallback Wine",
                producer: "Test Producer",
                region: "Burgundy",
                country: "France",
                wine_type: "Red",
                grape_varieties: ["Pinot Noir"],
                alcohol_content: 13.0,
                style: "Medium-bodied"
            },
            vintage: {
                year: 2019,
                quality_score: 90,
                critic_score: 92
            },
            stock: {
                location: "TEST_CELLAR_2",
                quantity: 3,
                cost_per_bottle: 300.00,
                reference_id: "TEST-FALLBACK",
                created_by: "test-user"
            }
        };
        
        const response = await request(app)
            .post('/api/wines')
            .send(wineData)
            .expect(201);
            
        expect(response.body.success).toBe(true);
        expect(response.body.data.wine.name).toBe("Test Fallback Wine");
        
        // Restore API key
        if (originalKey) {
            process.env.OPENAI_API_KEY = originalKey;
        }
    }, 30000);
});