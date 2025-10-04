/**
 * Pairing Recommendations Integration Tests - Priority 2
 * 
 * End-to-end integration tests for wine pairing recommendations:
 * - POST /api/pairing/recommend with sample dishes
 * - Verify response structure and required fields
 * - Check that known wines appear in results
 * - Test full recommendation flow including scoring and explanations
 * - Use fixed seeds for reproducible results where possible
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const Database = require('../../backend/database/connection');

let app;
let server;
let db;

describe('Pairing Recommendations Integration Tests', () => {
    let testWines = [];

    beforeAll(async () => {
        // Set up test environment
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

        // Import app
        const appModule = require('../../backend/app');
        app = appModule.app || appModule;
        server = appModule.server;

        // Seed diverse wines for pairing tests
        const wines = [
            {
                name: 'Chablis Grand Cru',
                producer: 'Domaine William Fèvre',
                region: 'Burgundy',
                country: 'France',
                type: 'White',
                grapes: ['Chardonnay'],
                year: 2019,
                quality: 92,
                food_pairings: ['Oysters', 'Seafood', 'Fish'],
                tasting_notes: 'Crisp minerality, citrus, elegant',
                style: 'Dry'
            },
            {
                name: 'Châteauneuf-du-Pape',
                producer: 'Domaine du Vieux Télégraphe',
                region: 'Rhône',
                country: 'France',
                type: 'Red',
                grapes: ['Grenache', 'Syrah', 'Mourvèdre'],
                year: 2016,
                quality: 95,
                food_pairings: ['Red meat', 'Game', 'Lamb'],
                tasting_notes: 'Full-bodied, spicy, dark fruit',
                style: 'Full-bodied'
            },
            {
                name: 'Prosecco Superiore',
                producer: 'Ruggeri',
                region: 'Veneto',
                country: 'Italy',
                type: 'Sparkling',
                grapes: ['Glera'],
                year: 2021,
                quality: 85,
                food_pairings: ['Appetizers', 'Light dishes', 'Seafood'],
                tasting_notes: 'Light, refreshing, crisp',
                style: 'Sparkling'
            },
            {
                name: 'Barolo',
                producer: 'Giacomo Conterno',
                region: 'Piedmont',
                country: 'Italy',
                type: 'Red',
                grapes: ['Nebbiolo'],
                year: 2015,
                quality: 96,
                food_pairings: ['Truffle dishes', 'Braised meat', 'Aged cheese'],
                tasting_notes: 'Complex, tannic, elegant',
                style: 'Full-bodied'
            },
            {
                name: 'Sancerre',
                producer: 'Pascal Jolivet',
                region: 'Loire Valley',
                country: 'France',
                type: 'White',
                grapes: ['Sauvignon Blanc'],
                year: 2020,
                quality: 88,
                food_pairings: ['Goat cheese', 'Seafood', 'Salads'],
                tasting_notes: 'Herbaceous, citrus, crisp acidity',
                style: 'Crisp'
            },
            {
                name: 'Riesling Kabinett',
                producer: 'Dr. Loosen',
                region: 'Mosel',
                country: 'Germany',
                type: 'White',
                grapes: ['Riesling'],
                year: 2020,
                quality: 90,
                food_pairings: ['Spicy food', 'Asian cuisine', 'Pork'],
                tasting_notes: 'Off-dry, aromatic, balanced acidity',
                style: 'Off-dry'
            }
        ];

        for (const wine of wines) {
            const wineResult = await db.run(`
                INSERT INTO Wines (name, producer, region, country, wine_type, grape_varieties,
                                 food_pairings, tasting_notes, style)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                wine.name,
                wine.producer,
                wine.region,
                wine.country,
                wine.type,
                JSON.stringify(wine.grapes),
                JSON.stringify(wine.food_pairings),
                wine.tasting_notes,
                wine.style
            ]);

            const vintageResult = await db.run(`
                INSERT INTO Vintages (wine_id, year, quality_score)
                VALUES (?, ?, ?)
            `, [wineResult.lastID, wine.year, wine.quality]);

            await db.run(`
                INSERT INTO Stock (vintage_id, location, quantity, cost_per_bottle, current_value)
                VALUES (?, 'main-cellar', 12, 50.00, 600.00)
            `, [vintageResult.lastID]);

            testWines.push({
                wine_id: wineResult.lastID,
                vintage_id: vintageResult.lastID,
                ...wine
            });
        }
    });

    afterAll(async () => {
        if (server && server.close) {
            await new Promise(resolve => server.close(resolve));
        }
        if (db) {
            await db.close();
        }
    });

    describe('POST /api/pairing/recommend - Basic Pairing', () => {
        test('should return pairing recommendations for grilled salmon', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Grilled Salmon',
                    ingredients: ['salmon', 'lemon', 'herbs'],
                    cuisine: 'French',
                    preparation: 'grilled'
                })
                .expect(200);

            // Verify response structure
            expect(response.body).toBeDefined();
            expect(response.body.recommendations || response.body).toBeDefined();

            const recommendations = response.body.recommendations || response.body;
            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);

            // Verify each recommendation has required fields
            recommendations.forEach(rec => {
                expect(rec).toHaveProperty('wine_name');
                expect(rec).toHaveProperty('producer');
                expect(rec).toHaveProperty('vintage_year');
                expect(rec).toHaveProperty('score');
                expect(rec).toHaveProperty('explanation');
                
                // Score should be between 0 and 1
                expect(rec.score).toBeGreaterThanOrEqual(0);
                expect(rec.score).toBeLessThanOrEqual(1);
            });

            // White wines should be highly ranked for salmon
            const whiteWines = recommendations.filter(r => 
                r.wine_type === 'White' || r.type === 'White'
            );
            expect(whiteWines.length).toBeGreaterThan(0);

            // Chablis or Sancerre should appear (good seafood pairings)
            const seafoodWines = recommendations.filter(r =>
                r.wine_name.includes('Chablis') || r.wine_name.includes('Sancerre')
            );
            expect(seafoodWines.length).toBeGreaterThan(0);
        });

        test('should return pairing recommendations for braised short ribs', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Braised Short Ribs',
                    ingredients: ['beef', 'red wine', 'vegetables'],
                    cuisine: 'American',
                    preparation: 'braised'
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);

            // Red wines should dominate for braised beef
            const redWines = recommendations.filter(r => 
                r.wine_type === 'Red' || r.type === 'Red'
            );
            expect(redWines.length).toBeGreaterThan(0);

            // Full-bodied reds should be highly scored
            const fullBodiedReds = recommendations.filter(r =>
                (r.wine_name.includes('Châteauneuf') || r.wine_name.includes('Barolo')) &&
                r.score > 0.5
            );
            expect(fullBodiedReds.length).toBeGreaterThan(0);
        });

        test('should return recommendations for spicy Thai curry', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Thai Red Curry',
                    ingredients: ['chicken', 'coconut milk', 'chilies', 'lemongrass'],
                    cuisine: 'Thai',
                    spice_level: 'hot'
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);

            // Off-dry or aromatic wines should appear for spicy food
            const spicyPairings = recommendations.filter(r =>
                r.wine_name.includes('Riesling') || 
                r.style === 'Off-dry' ||
                r.tasting_notes?.toLowerCase().includes('aromatic')
            );
            expect(spicyPairings.length).toBeGreaterThan(0);
        });

        test('should handle oysters pairing', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Fresh Oysters',
                    ingredients: ['oysters', 'lemon'],
                    cuisine: 'French',
                    preparation: 'raw'
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            expect(recommendations.length).toBeGreaterThan(0);

            // Chablis or Sparkling wines should be top recommendations
            const classicPairings = recommendations.filter(r =>
                r.wine_name.includes('Chablis') || 
                r.wine_name.includes('Prosecco') ||
                r.type === 'Sparkling'
            );
            expect(classicPairings.length).toBeGreaterThan(0);
        });
    });

    describe('Explanation Quality', () => {
        test('should provide detailed explanations for recommendations', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Grilled Steak',
                    ingredients: ['beef', 'salt', 'pepper']
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            
            recommendations.slice(0, 3).forEach(rec => {
                expect(rec.explanation).toBeDefined();
                expect(typeof rec.explanation).toBe('string');
                expect(rec.explanation.length).toBeGreaterThan(20);
                
                // Explanation should mention relevant pairing factors
                const explanation = rec.explanation.toLowerCase();
                const mentionsPairing = 
                    explanation.includes('pair') ||
                    explanation.includes('complement') ||
                    explanation.includes('match') ||
                    explanation.includes('balance');
                
                expect(mentionsPairing).toBe(true);
            });
        });

        test('should include confidence scores', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Pasta Carbonara',
                    ingredients: ['pasta', 'eggs', 'bacon', 'cheese']
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            
            recommendations.forEach(rec => {
                if (rec.confidence !== undefined) {
                    expect(rec.confidence).toBeGreaterThanOrEqual(0);
                    expect(rec.confidence).toBeLessThanOrEqual(1);
                }
            });
        });
    });

    describe('Filtering and Preferences', () => {
        test('should respect wine type preferences', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Roast Chicken',
                    ingredients: ['chicken', 'herbs'],
                    preferred_wine_type: 'White'
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            
            // All or most recommendations should be white wines
            const whiteWines = recommendations.filter(r => 
                r.wine_type === 'White' || r.type === 'White'
            );
            
            if (recommendations.length > 0) {
                expect(whiteWines.length).toBeGreaterThanOrEqual(recommendations.length * 0.5);
            }
        });

        test('should filter by price range', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Grilled Vegetables',
                    max_price: 40
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            
            recommendations.forEach(rec => {
                if (rec.price || rec.cost_per_bottle) {
                    expect(rec.price || rec.cost_per_bottle).toBeLessThanOrEqual(40);
                }
            });
        });

        test('should limit number of recommendations', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Cheese Plate',
                    limit: 3
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            expect(recommendations.length).toBeLessThanOrEqual(3);
        });
    });

    describe('Edge Cases', () => {
        test('should handle minimal dish information', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Pasta'
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);
        });

        test('should handle unknown cuisines gracefully', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Mystery Dish',
                    cuisine: 'Unknown'
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            expect(Array.isArray(recommendations)).toBe(true);
        });

        test('should require dish name', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    ingredients: ['chicken']
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/dish|required/i);
        });

        test('should handle empty ingredients list', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Simple Salad',
                    ingredients: []
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    describe('Score Consistency', () => {
        test('should return consistent scores for same dish', async () => {
            const dish = {
                dish: 'Margherita Pizza',
                ingredients: ['tomato', 'mozzarella', 'basil']
            };

            const response1 = await request(app)
                .post('/api/pairing/recommend')
                .send(dish)
                .expect(200);

            const response2 = await request(app)
                .post('/api/pairing/recommend')
                .send(dish)
                .expect(200);

            const recs1 = response1.body.recommendations || response1.body;
            const recs2 = response2.body.recommendations || response2.body;

            // Top recommendation should be consistent
            if (recs1.length > 0 && recs2.length > 0) {
                expect(recs1[0].wine_name).toBe(recs2[0].wine_name);
                expect(Math.abs(recs1[0].score - recs2[0].score)).toBeLessThan(0.01);
            }
        });

        test('should rank by score descending', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Grilled Lamb Chops',
                    ingredients: ['lamb', 'rosemary', 'garlic']
                })
                .expect(200);

            const recommendations = response.body.recommendations || response.body;
            
            if (recommendations.length > 1) {
                for (let i = 0; i < recommendations.length - 1; i++) {
                    expect(recommendations[i].score).toBeGreaterThanOrEqual(
                        recommendations[i + 1].score
                    );
                }
            }
        });
    });

    describe('Session and Feedback', () => {
        test('should create pairing session', async () => {
            const response = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Beef Wellington',
                    ingredients: ['beef', 'mushrooms', 'pastry'],
                    create_session: true,
                    user_id: 'test-user-1'
                })
                .expect(200);

            expect(response.body.session_id || response.body.recommendation_id).toBeDefined();
        });

        test('should accept feedback on pairing', async () => {
            // First get recommendations
            const pairingResponse = await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Sushi',
                    ingredients: ['fish', 'rice']
                })
                .expect(200);

            const recommendations = pairingResponse.body.recommendations || pairingResponse.body;
            const sessionId = pairingResponse.body.session_id;

            if (recommendations.length > 0 && sessionId) {
                // Submit feedback
                const feedbackResponse = await request(app)
                    .post('/api/pairing/feedback')
                    .send({
                        session_id: sessionId,
                        wine_id: recommendations[0].wine_id,
                        rating: 5,
                        notes: 'Perfect pairing!',
                        user_id: 'test-user-1'
                    })
                    .expect(200);

                expect(feedbackResponse.body.success).toBe(true);
            }
        });
    });

    describe('Performance', () => {
        test('should return recommendations within reasonable time', async () => {
            const startTime = Date.now();

            await request(app)
                .post('/api/pairing/recommend')
                .send({
                    dish: 'Chicken Tikka Masala',
                    ingredients: ['chicken', 'yogurt', 'spices']
                })
                .expect(200);

            const duration = Date.now() - startTime;
            
            // Should complete within 2 seconds
            expect(duration).toBeLessThan(2000);
        });

        test('should handle multiple concurrent pairing requests', async () => {
            const dishes = [
                { dish: 'Pasta Primavera' },
                { dish: 'Steak Frites' },
                { dish: 'Caesar Salad' }
            ];

            const promises = dishes.map(dish =>
                request(app)
                    .post('/api/pairing/recommend')
                    .send(dish)
            );

            const results = await Promise.all(promises);

            results.forEach(response => {
                expect(response.status).toBe(200);
                const recommendations = response.body.recommendations || response.body;
                expect(Array.isArray(recommendations)).toBe(true);
            });
        });
    });
});
