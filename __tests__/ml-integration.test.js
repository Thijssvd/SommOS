const request = require('supertest');
const app = require('../backend/server');
const Database = require('../backend/database/connection');

describe('ML Algorithms Integration', () => {
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
    
    describe('Collaborative Filtering', () => {
        test('should generate user-based collaborative filtering recommendations', async () => {
            const requestData = {
                user_id: 'test-user-123',
                dish_context: {
                    name: 'Grilled ribeye steak',
                    intensity: 'heavy',
                    cuisine: 'american',
                    season: 'autumn',
                    occasion: 'dinner'
                },
                options: {
                    limit: 5,
                    min_rating: 3
                }
            };
            
            const response = await request(app)
                .post('/api/ml/collaborative-filtering/user-based')
                .send(requestData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.algorithm).toBe('user_based_collaborative_filtering');
            expect(response.body.data.user_id).toBe('test-user-123');
            expect(response.body.data.recommendations).toBeDefined();
            expect(Array.isArray(response.body.data.recommendations)).toBe(true);
        });
        
        test('should generate item-based collaborative filtering recommendations', async () => {
            const requestData = {
                wine_id: 1,
                dish_context: {
                    name: 'Pan-seared salmon',
                    intensity: 'medium',
                    cuisine: 'french',
                    season: 'spring',
                    occasion: 'dinner'
                },
                options: {
                    limit: 5,
                    min_rating: 3
                }
            };
            
            const response = await request(app)
                .post('/api/ml/collaborative-filtering/item-based')
                .send(requestData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.algorithm).toBe('item_based_collaborative_filtering');
            expect(response.body.data.wine_id).toBe(1);
            expect(response.body.data.recommendations).toBeDefined();
        });
        
        test('should generate hybrid collaborative filtering recommendations', async () => {
            const requestData = {
                user_id: 'test-user-456',
                dish_context: {
                    name: 'Lobster bisque',
                    intensity: 'rich',
                    cuisine: 'french',
                    season: 'winter',
                    occasion: 'dinner'
                },
                options: {
                    limit: 5,
                    user_weight: 0.6,
                    item_weight: 0.4
                }
            };
            
            const response = await request(app)
                .post('/api/ml/collaborative-filtering/hybrid')
                .send(requestData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.algorithm).toBe('hybrid_collaborative_filtering');
            expect(response.body.data.user_id).toBe('test-user-456');
            expect(response.body.data.recommendations).toBeDefined();
        });
    });
    
    describe('Ensemble Recommendations', () => {
        test('should generate ensemble recommendations', async () => {
            const requestData = {
                user_id: 'test-user-789',
                dish_context: {
                    name: 'Beef Wellington',
                    intensity: 'heavy',
                    cuisine: 'british',
                    season: 'winter',
                    occasion: 'celebration'
                },
                options: {
                    limit: 10,
                    algorithms: ['collaborative_filtering', 'content_based', 'rule_based'],
                    dynamic_weighting: true,
                    context_aware: true
                }
            };
            
            const response = await request(app)
                .post('/api/ml/ensemble/recommendations')
                .send(requestData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.algorithm).toBe('ensemble');
            expect(response.body.data.user_id).toBe('test-user-789');
            expect(response.body.data.recommendations).toBeDefined();
            expect(Array.isArray(response.body.data.recommendations)).toBe(true);
        });
        
        test('should handle ensemble recommendations without user_id', async () => {
            const requestData = {
                dish_context: {
                    name: 'Caesar salad',
                    intensity: 'light',
                    cuisine: 'american',
                    season: 'summer',
                    occasion: 'lunch'
                },
                options: {
                    limit: 5,
                    algorithms: ['content_based', 'rule_based']
                }
            };
            
            const response = await request(app)
                .post('/api/ml/ensemble/recommendations')
                .send(requestData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.algorithm).toBe('ensemble');
            expect(response.body.data.recommendations).toBeDefined();
        });
    });
    
    describe('Advanced Weighting', () => {
        test('should calculate confidence-based weights', async () => {
            const requestData = {
                feedback_data: [
                    {
                        user_id: 'user1',
                        overall_rating: 4,
                        flavor_harmony_rating: 5,
                        texture_balance_rating: 3,
                        acidity_match_rating: 4,
                        tannin_balance_rating: 3,
                        body_match_rating: 4,
                        regional_tradition_rating: 5,
                        selected: true,
                        time_to_select: 45,
                        created_at: new Date().toISOString()
                    },
                    {
                        user_id: 'user2',
                        overall_rating: 5,
                        flavor_harmony_rating: 4,
                        texture_balance_rating: 5,
                        acidity_match_rating: 4,
                        tannin_balance_rating: 4,
                        body_match_rating: 5,
                        regional_tradition_rating: 4,
                        selected: true,
                        time_to_select: 30,
                        created_at: new Date().toISOString()
                    }
                ],
                algorithm: 'confidence_based',
                options: {
                    confidence_threshold: 0.7
                }
            };
            
            const response = await request(app)
                .post('/api/ml/weights/calculate')
                .send(requestData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.algorithm).toBe('confidence_based');
            expect(response.body.data.weights).toBeDefined();
            expect(response.body.data.statistics).toBeDefined();
        });
        
        test('should calculate temporal decay weights', async () => {
            const now = new Date();
            const requestData = {
                feedback_data: [
                    {
                        overall_rating: 4,
                        flavor_harmony_rating: 5,
                        created_at: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
                    },
                    {
                        overall_rating: 5,
                        flavor_harmony_rating: 4,
                        created_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
                    }
                ],
                algorithm: 'temporal_decay'
            };
            
            const response = await request(app)
                .post('/api/ml/weights/calculate')
                .send(requestData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.algorithm).toBe('temporal_decay');
            expect(response.body.data.weights).toBeDefined();
        });
        
        test('should calculate ensemble weights', async () => {
            const requestData = {
                feedback_data: [
                    {
                        user_id: 'user1',
                        overall_rating: 4,
                        flavor_harmony_rating: 5,
                        occasion: 'dinner',
                        season: 'autumn',
                        selected: true,
                        time_to_select: 45,
                        created_at: new Date().toISOString()
                    }
                ],
                algorithm: 'ensemble',
                options: {
                    confidence_threshold: 0.7,
                    temporal_decay: true,
                    context_aware: true
                }
            };
            
            const response = await request(app)
                .post('/api/ml/weights/calculate')
                .send(requestData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.algorithm).toBe('ensemble');
            expect(response.body.data.weights).toBeDefined();
        });
    });
    
    describe('Model Management', () => {
        test('should create a new ML model', async () => {
            const requestData = {
                name: 'test_collaborative_model',
                type: 'collaborative_filtering',
                algorithm: 'user_based',
                parameters: {
                    min_common_items: 3,
                    similarity_threshold: 0.3
                },
                training_data: [
                    { user_id: 'user1', wine_id: 1, rating: 4 },
                    { user_id: 'user2', wine_id: 1, rating: 5 },
                    { user_id: 'user1', wine_id: 2, rating: 3 },
                    { user_id: 'user2', wine_id: 2, rating: 4 }
                ],
                metadata: {
                    description: 'Test collaborative filtering model',
                    created_by: 'test_user'
                }
            };
            
            const response = await request(app)
                .post('/api/ml/models/create')
                .send(requestData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.model_id).toBeDefined();
            expect(response.body.data.version).toBeDefined();
            expect(response.body.data.performance).toBeDefined();
        });
        
        test('should list models', async () => {
            const response = await request(app)
                .get('/api/ml/models')
                .query({ status: 'active', limit: 10 })
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.models).toBeDefined();
            expect(Array.isArray(response.body.data.models)).toBe(true);
            expect(response.body.data.pagination).toBeDefined();
        });
        
        test('should compare model performance', async () => {
            // First create two models
            const modelData1 = {
                name: 'test_model_1',
                type: 'collaborative_filtering',
                algorithm: 'user_based',
                parameters: {},
                training_data: [{ user_id: 'user1', wine_id: 1, rating: 4 }]
            };
            
            const modelData2 = {
                name: 'test_model_2',
                type: 'collaborative_filtering',
                algorithm: 'item_based',
                parameters: {},
                training_data: [{ user_id: 'user1', wine_id: 1, rating: 4 }]
            };
            
            const [model1, model2] = await Promise.all([
                request(app).post('/api/ml/models/create').send(modelData1),
                request(app).post('/api/ml/models/create').send(modelData2)
            ]);
            
            const modelId1 = model1.body.data.model_id;
            const modelId2 = model2.body.data.model_id;
            
            // Compare models
            const response = await request(app)
                .get(`/api/ml/models/${modelId1}/compare`)
                .query({ versions: '1,2' })
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.model_id).toBe(modelId1);
            expect(response.body.data.comparisons).toBeDefined();
        });
    });
    
    describe('A/B Testing', () => {
        test('should run A/B test between models', async () => {
            // Create two models for A/B testing
            const modelData1 = {
                name: 'ab_test_model_1',
                type: 'collaborative_filtering',
                algorithm: 'user_based',
                parameters: {},
                training_data: [{ user_id: 'user1', wine_id: 1, rating: 4 }]
            };
            
            const modelData2 = {
                name: 'ab_test_model_2',
                type: 'collaborative_filtering',
                algorithm: 'item_based',
                parameters: {},
                training_data: [{ user_id: 'user1', wine_id: 1, rating: 4 }]
            };
            
            const [model1, model2] = await Promise.all([
                request(app).post('/api/ml/models/create').send(modelData1),
                request(app).post('/api/ml/models/create').send(modelData2)
            ]);
            
            const requestData = {
                model_id1: model1.body.data.model_id,
                version1: model1.body.data.version,
                model_id2: model2.body.data.model_id,
                version2: model2.body.data.version,
                test_data: [
                    { user_id: 'user1', wine_id: 1, rating: 4 },
                    { user_id: 'user2', wine_id: 2, rating: 5 }
                ],
                options: {
                    traffic_split: 0.5,
                    test_duration: 7 * 24 * 60 * 60 * 1000 // 7 days
                }
            };
            
            const response = await request(app)
                .post('/api/ml/models/ab-test')
                .send(requestData)
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.test_id).toBeDefined();
            expect(response.body.data.results).toBeDefined();
        });
    });
    
    describe('Cache Management', () => {
        test('should get cache statistics', async () => {
            const response = await request(app)
                .get('/api/ml/cache/stats')
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.data.cache_statistics).toBeDefined();
            expect(response.body.data.cache_statistics.collaborative_filtering).toBeDefined();
            expect(response.body.data.cache_statistics.advanced_weighting).toBeDefined();
            expect(response.body.data.cache_statistics.ensemble_engine).toBeDefined();
        });
        
        test('should clear all caches', async () => {
            const response = await request(app)
                .post('/api/ml/cache/clear')
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('cleared successfully');
        });
    });
    
    describe('Similarity Matrix Updates', () => {
        test('should update similarity matrices', async () => {
            const response = await request(app)
                .post('/api/ml/similarity/update')
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('updated successfully');
        });
    });
    
    describe('Error Handling', () => {
        test('should handle missing user_id for user-based collaborative filtering', async () => {
            const requestData = {
                dish_context: {
                    name: 'Test dish',
                    intensity: 'medium'
                }
            };
            
            const response = await request(app)
                .post('/api/ml/collaborative-filtering/user-based')
                .send(requestData)
                .expect(400);
                
            expect(response.body.success).toBe(false);
        });
        
        test('should handle missing wine_id for item-based collaborative filtering', async () => {
            const requestData = {
                dish_context: {
                    name: 'Test dish',
                    intensity: 'medium'
                }
            };
            
            const response = await request(app)
                .post('/api/ml/collaborative-filtering/item-based')
                .send(requestData)
                .expect(400);
                
            expect(response.body.success).toBe(false);
        });
        
        test('should handle invalid feedback data for weight calculation', async () => {
            const requestData = {
                feedback_data: 'invalid_data',
                algorithm: 'confidence_based'
            };
            
            const response = await request(app)
                .post('/api/ml/weights/calculate')
                .send(requestData)
                .expect(400);
                
            expect(response.body.success).toBe(false);
        });
        
        test('should handle missing model data for model creation', async () => {
            const requestData = {
                name: 'test_model',
                type: 'collaborative_filtering'
                // Missing required fields
            };
            
            const response = await request(app)
                .post('/api/ml/models/create')
                .send(requestData)
                .expect(400);
                
            expect(response.body.success).toBe(false);
        });
        
        test('should handle non-existent model loading', async () => {
            const response = await request(app)
                .get('/api/ml/models/non_existent_model/1')
                .expect(404);
                
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('not found');
        });
    });
});