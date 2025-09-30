const request = require('supertest');
const app = require('../backend/server');
const Database = require('../backend/database/connection');

describe('Enhanced Learning Engine Integration', () => {
    let db;
    
    beforeAll(async () => {
        // Initialize database connection for testing
        db = Database.getInstance();
        await db.initialize();
        
        // Run migrations
        const DatabaseMigrator = require('../backend/database/migrate');
        const migrator = new DatabaseMigrator();
        await migrator.runMigrations();
    });
    
    afterAll(async () => {
        // Clean up database connection
        if (db) {
            db.close();
        }
    });
    
    describe('Enhanced Feedback Collection', () => {
        test('should record enhanced pairing feedback via API', async () => {
            const feedbackData = {
                recommendation_id: 'test-rec-123',
                user_id: 'test-user-456',
                session_id: 'test-session-789',
                ratings: {
                    overall: 4,
                    flavor_harmony: 5,
                    texture_balance: 3,
                    acidity_match: 4,
                    tannin_balance: 3,
                    body_match: 4,
                    regional_tradition: 5
                },
                context: {
                    occasion: 'dinner',
                    guest_count: 4,
                    time_of_day: 'evening',
                    season: 'autumn',
                    weather_context: 'indoor'
                },
                behavioral_data: {
                    selected: true,
                    time_to_select: 45,
                    viewed_duration: 120
                },
                additional_feedback: {
                    notes: 'Excellent pairing with the main course',
                    would_recommend: true,
                    price_satisfaction: 4
                }
            };
            
            const response = await request(app)
                .post('/api/learning/feedback/enhanced')
                .send(feedbackData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.recommendation_id).toBe('test-rec-123');
        });
        
        test('should validate feedback data and return errors for invalid input', async () => {
            const invalidFeedbackData = {
                recommendation_id: 'test-rec-123',
                ratings: {
                    overall: 6, // Invalid rating
                    flavor_harmony: 'excellent' // Invalid type
                },
                context: {
                    occasion: 'invalid_occasion',
                    guest_count: -1 // Invalid count
                }
            };
            
            const response = await request(app)
                .post('/api/learning/feedback/enhanced')
                .send(invalidFeedbackData)
                .expect(400);
                
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Failed to record enhanced feedback');
        });
    });
    
    describe('Feature Engineering', () => {
        test('should extract wine features via API', async () => {
            // First create a test wine
            const wineData = {
                wine: {
                    name: "Test Feature Wine",
                    producer: "Test Producer",
                    region: "Napa Valley",
                    country: "USA",
                    wine_type: "Red",
                    grape_varieties: ["Cabernet Sauvignon", "Merlot"],
                    alcohol_content: 14.5,
                    style: "Full-bodied",
                    tasting_notes: "Rich, complex wine with firm tannins"
                },
                vintage: {
                    year: 2018,
                    quality_score: 92,
                    critic_score: 94
                },
                stock: {
                    location: "TEST_FEATURES",
                    quantity: 3,
                    cost_per_bottle: 150.00,
                    reference_id: "TEST-FEATURES-001",
                    created_by: "test-user"
                }
            };
            
            const wineResponse = await request(app)
                .post('/api/wines')
                .send(wineData)
                .expect(201);
                
            const wineId = wineResponse.body.data.wine.id;
            
            // Extract features
            const featureResponse = await request(app)
                .post('/api/learning/features/wine/extract')
                .send({ wine_id: wineId })
                .expect(200);
                
            expect(featureResponse.body.success).toBe(true);
            expect(featureResponse.body.data.wine_id).toBe(wineId);
            expect(featureResponse.body.data.features).toBeDefined();
        });
        
        test('should extract dish features via API', async () => {
            const dishDescription = 'Grilled ribeye steak with roasted vegetables and red wine reduction';
            
            const response = await request(app)
                .post('/api/learning/features/dish/extract')
                .send({ dish_description: dishDescription })
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.dish_description).toBe(dishDescription);
            expect(response.body.data.features).toBeDefined();
        });
        
        test('should get wine features via API', async () => {
            // Create a test wine first
            const wineData = {
                wine: {
                    name: "Test Get Features Wine",
                    producer: "Test Producer",
                    region: "Bordeaux",
                    country: "France",
                    wine_type: "Red",
                    grape_varieties: ["Cabernet Sauvignon"],
                    alcohol_content: 13.5,
                    style: "Medium-bodied"
                },
                vintage: {
                    year: 2019,
                    quality_score: 90
                },
                stock: {
                    location: "TEST_GET_FEATURES",
                    quantity: 2,
                    cost_per_bottle: 75.00,
                    reference_id: "TEST-GET-FEATURES-001",
                    created_by: "test-user"
                }
            };
            
            const wineResponse = await request(app)
                .post('/api/wines')
                .send(wineData)
                .expect(201);
                
            const wineId = wineResponse.body.data.wine.id;
            
            // Extract features first
            await request(app)
                .post('/api/learning/features/wine/extract')
                .send({ wine_id: wineId })
                .expect(200);
            
            // Get features
            const response = await request(app)
                .get(`/api/learning/features/wine/${wineId}`)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.wine_id).toBe(wineId);
        });
        
        test('should get dish features via API', async () => {
            const dishDescription = 'Pan-seared salmon with lemon butter sauce';
            
            // Extract features first
            await request(app)
                .post('/api/learning/features/dish/extract')
                .send({ dish_description: dishDescription })
                .expect(200);
            
            // Get features
            const response = await request(app)
                .get('/api/learning/features/dish')
                .query({ description: dishDescription })
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.dish_description).toBe(dishDescription);
        });
    });
    
    describe('Learning Analytics', () => {
        test('should get enhanced pairing weights via API', async () => {
            const response = await request(app)
                .get('/api/learning/weights/enhanced')
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.weights).toBeDefined();
            expect(response.body.data.version).toBe('enhanced_v1');
        });
        
        test('should get learning metrics via API', async () => {
            const response = await request(app)
                .get('/api/learning/metrics')
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.metrics).toBeDefined();
            expect(response.body.data.metrics.pairing_accuracy).toBeDefined();
            expect(response.body.data.metrics.user_satisfaction).toBeDefined();
        });
        
        test('should get feedback quality analysis via API', async () => {
            const response = await request(app)
                .get('/api/learning/analytics/feedback-quality')
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.analysis).toBeDefined();
            expect(response.body.data.analysis.total_feedback_count).toBeDefined();
            expect(response.body.data.analysis.quality_score).toBeDefined();
        });
    });
    
    describe('Data Validation', () => {
        test('should validate feedback data via API', async () => {
            const feedbackData = {
                recommendation_id: 'test-rec-123',
                ratings: {
                    overall: 4,
                    flavor_harmony: 5,
                    texture_balance: 3
                },
                context: {
                    occasion: 'dinner',
                    guest_count: 4,
                    time_of_day: 'evening',
                    season: 'autumn'
                },
                behavioral_data: {
                    selected: true,
                    time_to_select: 45,
                    viewed_duration: 120
                }
            };
            
            const response = await request(app)
                .post('/api/learning/validate/feedback')
                .send(feedbackData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.validation.isValid).toBe(true);
            expect(response.body.data.validation.errors).toHaveLength(0);
        });
        
        test('should return validation errors for invalid data', async () => {
            const invalidFeedbackData = {
                recommendation_id: 'test-rec-123',
                ratings: {
                    overall: 6, // Invalid rating
                    flavor_harmony: 'excellent' // Invalid type
                },
                context: {
                    occasion: 'invalid_occasion',
                    guest_count: -1 // Invalid count
                }
            };
            
            const response = await request(app)
                .post('/api/learning/validate/feedback')
                .send(invalidFeedbackData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.validation.isValid).toBe(false);
            expect(response.body.data.validation.errors.length).toBeGreaterThan(0);
        });
    });
    
    describe('Batch Operations', () => {
        test('should handle batch wine feature extraction', async () => {
            // Create multiple test wines
            const wineIds = [];
            
            for (let i = 0; i < 3; i++) {
                const wineData = {
                    wine: {
                        name: `Test Batch Wine ${i + 1}`,
                        producer: "Test Producer",
                        region: "Test Region",
                        country: "Test Country",
                        wine_type: "Red",
                        grape_varieties: ["Test Grape"],
                        alcohol_content: 13.0,
                        style: "Medium-bodied"
                    },
                    vintage: {
                        year: 2020,
                        quality_score: 85
                    },
                    stock: {
                        location: `TEST_BATCH_${i}`,
                        quantity: 1,
                        cost_per_bottle: 50.00,
                        reference_id: `TEST-BATCH-${i}`,
                        created_by: "test-user"
                    }
                };
                
                const wineResponse = await request(app)
                    .post('/api/wines')
                    .send(wineData)
                    .expect(201);
                    
                wineIds.push(wineResponse.body.data.wine.id);
            }
            
            // Batch extract features
            const response = await request(app)
                .post('/api/learning/batch/features/wine')
                .send({ wine_ids: wineIds })
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.processed_count).toBe(3);
            expect(response.body.data.total_requested).toBe(3);
        });
        
        test('should handle batch size limits', async () => {
            const largeWineIds = Array.from({ length: 150 }, (_, i) => i + 1);
            
            const response = await request(app)
                .post('/api/learning/batch/features/wine')
                .send({ wine_ids: largeWineIds })
                .expect(400);
                
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Batch size cannot exceed 100 wines');
        });
    });
    
    describe('Error Handling', () => {
        test('should handle missing recommendation ID', async () => {
            const response = await request(app)
                .post('/api/learning/feedback/enhanced')
                .send({
                    ratings: { overall: 4 }
                })
                .expect(400);
                
            expect(response.body.success).toBe(false);
        });
        
        test('should handle missing wine ID for feature extraction', async () => {
            const response = await request(app)
                .post('/api/learning/features/wine/extract')
                .send({})
                .expect(400);
                
            expect(response.body.success).toBe(false);
        });
        
        test('should handle missing dish description for feature extraction', async () => {
            const response = await request(app)
                .post('/api/learning/features/dish/extract')
                .send({})
                .expect(400);
                
            expect(response.body.success).toBe(false);
        });
        
        test('should handle non-existent wine features request', async () => {
            const response = await request(app)
                .get('/api/learning/features/wine/99999')
                .expect(404);
                
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Wine features not found');
        });
        
        test('should handle non-existent dish features request', async () => {
            const response = await request(app)
                .get('/api/learning/features/dish')
                .query({ description: 'Non-existent dish description' })
                .expect(404);
                
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Dish features not found');
        });
    });
});