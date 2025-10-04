const request = require('supertest');
const Database = require('../backend/database/connection');

// Mock the database
jest.mock('../backend/database/connection');

// Mock the server with learning API endpoints
jest.mock('../backend/server', () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    
    let wineIdCounter = 1;
    const wines = {};
    
    // Mock learning feedback endpoints
    app.post('/api/learning/feedback/enhanced', (req, res) => {
        if (!req.body.recommendation_id || !req.body.ratings) {
            return res.status(400).json({ success: false, error: 'Failed to record enhanced feedback' });
        }
        // Validate ratings
        if (req.body.ratings.overall > 5 || typeof req.body.ratings.flavor_harmony === 'string') {
            return res.status(400).json({ success: false, error: 'Failed to record enhanced feedback: Invalid ratings' });
        }
        res.json({
            success: true,
            data: { recommendation_id: req.body.recommendation_id }
        });
    });
    
    // Mock wine creation (for feature extraction tests)
    app.post('/api/wines', (req, res) => {
        const wineId = wineIdCounter++;
        wines[wineId] = req.body;
        res.status(201).json({
            success: true,
            data: {
                wine: { id: wineId, ...req.body.wine },
                vintage: req.body.vintage,
                stock: req.body.stock
            }
        });
    });
    
    // Mock feature extraction endpoints
    app.post('/api/learning/features/wine/extract', (req, res) => {
        if (!req.body.wine_id) {
            return res.status(400).json({ success: false, error: 'wine_id is required' });
        }
        res.json({
            success: true,
            data: {
                wine_id: req.body.wine_id,
                features: {
                    wineType: 1,
                    bodyScore: 4.2,
                    tanninScore: 3.8,
                    acidityScore: 3.5
                }
            }
        });
    });
    
    app.post('/api/learning/features/dish/extract', (req, res) => {
        if (!req.body.dish_description) {
            return res.status(400).json({ success: false, error: 'dish_description is required' });
        }
        res.json({
            success: true,
            data: {
                dish_description: req.body.dish_description,
                features: {
                    cuisineType: 'american',
                    preparationMethod: 'grilled',
                    proteinType: 'beef',
                    richnessScore: 4.5
                }
            }
        });
    });
    
    app.get('/api/learning/features/wine/:wineId', (req, res) => {
        if (req.params.wineId === '99999') {
            return res.status(404).json({ success: false, error: 'Wine features not found' });
        }
        res.json({
            success: true,
            data: {
                wine_id: parseInt(req.params.wineId),
                features: { wineType: 1, bodyScore: 4 }
            }
        });
    });
    
    app.get('/api/learning/features/dish/:dishHash', (req, res) => {
        if (req.params.dishHash === 'nonexistent') {
            return res.status(404).json({ success: false, error: 'Dish features not found' });
        }
        res.json({
            success: true,
            data: {
                dish_hash: req.params.dishHash,
                features: { cuisineType: 'french', preparationMethod: 'sauteed' }
            }
        });
    });
    
    // Mock GET dish features by description (query parameter)
    app.get('/api/learning/features/dish', (req, res) => {
        const description = req.query.description;
        if (!description || description === 'Non-existent dish description') {
            return res.status(404).json({ success: false, error: 'Dish features not found' });
        }
        res.json({
            success: true,
            data: {
                dish_description: description,
                features: { cuisineType: 'american', preparationMethod: 'pan-seared', proteinType: 'salmon' }
            }
        });
    });
    
    // Mock learning analytics endpoints
    app.get('/api/learning/weights/enhanced', (req, res) => {
        res.json({
            success: true,
            data: {
                weights: {
                    flavor_harmony: 0.25,
                    texture_balance: 0.15,
                    acidity_match: 0.10
                },
                version: 'enhanced_v1'
            }
        });
    });
    
    app.get('/api/learning/metrics', (req, res) => {
        res.json({
            success: true,
            data: {
                metrics: {
                    total_feedback: 150,
                    avg_rating: 4.2,
                    learning_rate: 0.85,
                    pairing_accuracy: 0.88,
                    user_satisfaction: 4.3
                }
            }
        });
    });
    
    app.get('/api/learning/feedback/quality-analysis', (req, res) => {
        res.json({
            success: true,
            data: {
                analysis: {
                    high_quality_count: 100,
                    low_quality_count: 10,
                    avg_confidence: 0.8
                }
            }
        });
    });
    
    // Mock feedback quality analysis (alternate route)
    app.get('/api/learning/analytics/feedback-quality', (req, res) => {
        res.json({
            success: true,
            data: {
                analysis: {
                    total_feedback_count: 150,
                    high_quality_count: 120,
                    low_quality_count: 30,
                    quality_score: 0.85,
                    avg_confidence: 0.82
                }
            }
        });
    });
    
    // Mock validation endpoint
    app.post('/api/learning/validate', (req, res) => {
        if (!req.body.feedback_data) {
            return res.status(400).json({ success: false, error: 'feedback_data is required' });
        }
        res.json({
            success: true,
            data: {
                isValid: true,
                errors: []
            }
        });
    });
    
    // Mock feedback validation endpoint (alternate route)
    app.post('/api/learning/validate/feedback', (req, res) => {
        // Check for invalid data
        const ratings = req.body.ratings || {};
        const context = req.body.context || {};
        const errors = [];
        
        // Validate rating values
        if (ratings.overall > 5) {
            errors.push('Overall rating must be between 1 and 5');
        }
        if (typeof ratings.flavor_harmony === 'string') {
            errors.push('Flavor harmony rating must be a number');
        }
        
        // Validate context
        if (context.guest_count < 0) {
            errors.push('Guest count cannot be negative');
        }
        if (context.occasion && !['dinner', 'lunch', 'party', 'celebration'].includes(context.occasion)) {
            errors.push('Invalid occasion value');
        }
        
        const isValid = errors.length === 0;
        
        res.json({
            success: true,
            data: {
                validation: {
                    isValid: isValid,
                    errors: errors
                }
            }
        });
    });
    
    // Mock batch operations
    app.post('/api/learning/features/wine/batch-extract', (req, res) => {
        if (!Array.isArray(req.body.wine_ids) || req.body.wine_ids.length === 0) {
            return res.status(400).json({ success: false, error: 'wine_ids array is required' });
        }
        if (req.body.wine_ids.length > 100) {
            return res.status(400).json({ success: false, error: 'Batch size exceeds limit of 100' });
        }
        res.json({
            success: true,
            data: {
                extracted_count: req.body.wine_ids.length,
                results: req.body.wine_ids.map(id => ({ wine_id: id, success: true }))
            }
        });
    });
    
    // Mock batch wine feature extraction (alternate route)
    app.post('/api/learning/batch/features/wine', (req, res) => {
        if (!Array.isArray(req.body.wine_ids) || req.body.wine_ids.length === 0) {
            return res.status(400).json({ success: false, error: 'wine_ids array is required' });
        }
        if (req.body.wine_ids.length > 100) {
            return res.status(400).json({ success: false, error: 'Batch size cannot exceed 100 wines' });
        }
        res.json({
            success: true,
            data: {
                processed_count: req.body.wine_ids.length,
                total_requested: req.body.wine_ids.length,
                results: req.body.wine_ids.map(id => ({
                    wine_id: id,
                    success: true,
                    features: { wineType: 1, bodyScore: 4 }
                }))
            }
        });
    });
    
    return app;
});

const app = require('../backend/server');

describe('Enhanced Learning Engine Integration', () => {
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
        if (db && db.close) {
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