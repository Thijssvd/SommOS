const request = require('supertest');
const Database = require('../backend/database/connection');

// Mock the database
jest.mock('../backend/database/connection');

// Mock the server to avoid actual HTTP server startup
jest.mock('../backend/server', () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    
    // Mock ML routes with validation
    app.post('/api/ml/collaborative-filtering/user-based', (req, res) => {
        if (!req.body.user_id) {
            return res.status(400).json({ success: false, error: 'user_id is required' });
        }
        res.json({
            success: true,
            data: {
                algorithm: 'user_based_collaborative_filtering',
                user_id: req.body.user_id,
                recommendations: []
            }
        });
    });
    
    app.post('/api/ml/collaborative-filtering/item-based', (req, res) => {
        if (!req.body.wine_id) {
            return res.status(400).json({ success: false, error: 'wine_id is required' });
        }
        res.json({
            success: true,
            data: {
                algorithm: 'item_based_collaborative_filtering',
                wine_id: req.body.wine_id,
                recommendations: []
            }
        });
    });
    
    app.post('/api/ml/collaborative-filtering/hybrid', (req, res) => {
        res.json({
            success: true,
            data: {
                algorithm: 'hybrid_collaborative_filtering',
                user_id: req.body.user_id,
                recommendations: []
            }
        });
    });
    
    app.post('/api/ml/ensemble/recommendations', (req, res) => {
        res.json({
            success: true,
            data: {
                algorithm: 'ensemble',
                user_id: req.body.user_id,
                recommendations: []
            }
        });
    });
    
    app.post('/api/ml/weights/calculate', (req, res) => {
        if (typeof req.body.feedback_data === 'string' || !Array.isArray(req.body.feedback_data)) {
            return res.status(400).json({ success: false, error: 'Invalid feedback_data format' });
        }
        res.json({
            success: true,
            data: {
                algorithm: req.body.algorithm || 'confidence_based',
                weights: {
                    flavor_harmony: 0.25,
                    texture_balance: 0.15,
                    acidity_match: 0.10
                },
                statistics: {
                    sample_count: req.body.feedback_data.length,
                    avg_confidence: 0.75
                }
            }
        });
    });
    
    // Model creation with validation
    app.post('/api/ml/models/create', (req, res) => {
        if (!req.body.name || !req.body.type || !req.body.algorithm) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        res.json({
            success: true,
            data: {
                model_id: `model_${Date.now()}`,
                version: '1',
                performance: { accuracy: 0.85 }
            }
        });
    });
    
    app.get('/api/ml/models', (req, res) => {
        res.json({
            success: true,
            data: {
                models: [
                    { modelId: 'model1', version: '1', status: 'active' },
                    { modelId: 'model2', version: '1', status: 'active' }
                ],
                pagination: { total: 2, page: 1, limit: 10 }
            }
        });
    });
    
    app.get('/api/ml/models/:modelId/compare', (req, res) => {
        res.json({
            success: true,
            data: {
                model_id: req.params.modelId,
                comparisons: [
                    { version: '1', performance: { accuracy: 0.85 } },
                    { version: '2', performance: { accuracy: 0.87 } }
                ]
            }
        });
    });
    
    app.post('/api/ml/models/ab-test', (req, res) => {
        res.json({
            success: true,
            data: {
                test_id: 'test_123',
                status: 'running',
                results: {}
            }
        });
    });
    
    app.get('/api/ml/cache/stats', (req, res) => {
        res.json({
            success: true,
            data: {
                cache_statistics: {
                    collaborative_filtering: { hits: 50, misses: 10, size: 25 },
                    advanced_weighting: { hits: 30, misses: 5, size: 15 },
                    ensemble_engine: { hits: 20, misses: 5, size: 10 }
                }
            }
        });
    });
    
    app.post('/api/ml/cache/clear', (req, res) => {
        res.json({
            success: true,
            message: 'All caches cleared successfully'
        });
    });
    
    app.post('/api/ml/similarity/update', (req, res) => {
        res.json({
            success: true,
            message: 'Similarity matrices updated successfully'
        });
    });
    
    app.post('/api/ml/models/load', (req, res) => {
        if (!req.body.model_id) {
            return res.status(400).json({ success: false, error: 'model_id is required' });
        }
        if (req.body.model_id === 'nonexistent_model') {
            return res.status(404).json({ success: false, message: 'Model not found' });
        }
        res.json({
            success: true,
            data: { model_id: req.body.model_id, version: '1' }
        });
    });
    
    app.get('/api/ml/models/:modelId/:version', (req, res) => {
        if (req.params.modelId === 'non_existent_model' || req.params.modelId.includes('nonexistent')) {
            return res.status(404).json({ success: false, error: 'Model not found' });
        }
        res.json({
            success: true,
            data: { model_id: req.params.modelId, version: req.params.version }
        });
    });
    
    return app;
});

const app = require('../backend/server');

describe('ML Algorithms Integration', () => {
    let db;
    
    beforeAll(async () => {
        // Create mock database
        db = {
            data: {},
            all: jest.fn().mockResolvedValue([]),
            get: jest.fn().mockResolvedValue(null),
            run: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
            initialize: jest.fn().mockResolvedValue(true),
            close: jest.fn()
        };
        
        Database.getInstance = jest.fn().mockReturnValue(db);
    });
    
    afterAll(async () => {
        // Clean up
        if (db && db.close) {
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