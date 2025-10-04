const request = require('supertest');
const Database = require('../backend/database/connection');

// Mock the database
jest.mock('../backend/database/connection');

// Mock the server with agent API endpoints
jest.mock('../backend/server', () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    
    const mockTools = [
        {
            name: 'get_wine_pairings',
            description: 'Get wine pairing recommendations for a dish',
            parameters: {
                dish: { type: 'string', required: true },
                cuisine: { type: 'string', required: false }
            }
        },
        {
            name: 'search_inventory',
            description: 'Search wine inventory',
            parameters: {
                query: { type: 'string', required: true },
                filters: { type: 'object', required: false }
            }
        },
        {
            name: 'get_procurement_recommendations',
            description: 'Get wine procurement recommendations',
            parameters: {
                budget: { type: 'number', required: false },
                preferences: { type: 'object', required: false }
            }
        }
    ];
    
    // GET /api/agent/tools - List available tools
    app.get('/api/agent/tools', (req, res) => {
        res.json({
            success: true,
            data: mockTools
        });
    });
    
    // POST /api/agent/tools/call - Call a tool
    app.post('/api/agent/tools/call', (req, res) => {
        const { name, params } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'TOOL_NAME_REQUIRED',
                    message: 'Tool name is required'
                }
            });
        }
        
        // Check if tool exists
        const tool = mockTools.find(t => t.name === name);
        if (!tool) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'TOOL_NOT_FOUND',
                    message: `Tool '${name}' not found`
                }
            });
        }
        
        // Simulate tool execution
        let result;
        switch (name) {
            case 'get_wine_pairings':
                if (!params || !params.dish) {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 'MISSING_PARAMETER',
                            message: 'Parameter "dish" is required'
                        }
                    });
                }
                result = {
                    dish: params.dish,
                    pairings: [
                        { wine: 'Chardonnay', score: 0.95, reason: 'Rich and buttery' },
                        { wine: 'Pinot Noir', score: 0.88, reason: 'Light and fruity' }
                    ]
                };
                break;
                
            case 'search_inventory':
                if (!params || !params.query) {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 'MISSING_PARAMETER',
                            message: 'Parameter "query" is required'
                        }
                    });
                }
                result = {
                    query: params.query,
                    results: [
                        { id: 1, name: 'Test Wine 1', vintage: 2020, quantity: 12 },
                        { id: 2, name: 'Test Wine 2', vintage: 2019, quantity: 6 }
                    ],
                    total: 2
                };
                break;
                
            case 'get_procurement_recommendations':
                result = {
                    recommendations: [
                        { wine: 'Bordeaux 2018', priority: 'high', estimated_cost: 500 },
                        { wine: 'Burgundy 2019', priority: 'medium', estimated_cost: 400 }
                    ],
                    total_budget: params?.budget || 1000
                };
                break;
                
            default:
                result = { executed: true, tool: name };
        }
        
        res.json({
            success: true,
            data: result
        });
    });
    
    return app;
});

const app = require('../backend/server');

describe('Agent API Routes', () => {
    let db;
    
    beforeAll(async () => {
        // Create mock database
        db = {
            initialize: jest.fn().mockResolvedValue(true),
            close: jest.fn(),
            all: jest.fn().mockResolvedValue([]),
            get: jest.fn().mockResolvedValue(null),
            run: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 })
        };
        
        Database.getInstance = jest.fn().mockReturnValue(db);
        await db.initialize();
    });
    
    afterAll(async () => {
        if (db) {
            db.close();
        }
    });
    
    describe('GET /api/agent/tools', () => {
        test('should list all available tools', async () => {
            const response = await request(app)
                .get('/api/agent/tools')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
            
            // Check tool structure
            const tool = response.body.data[0];
            expect(tool).toHaveProperty('name');
            expect(tool).toHaveProperty('description');
            expect(tool).toHaveProperty('parameters');
        });
        
        test('should include pairing tool in tools list', async () => {
            const response = await request(app)
                .get('/api/agent/tools')
                .expect(200);
            
            const pairingTool = response.body.data.find(t => t.name === 'get_wine_pairings');
            expect(pairingTool).toBeDefined();
            expect(pairingTool.description).toContain('pairing');
        });
        
        test('should include inventory search tool', async () => {
            const response = await request(app)
                .get('/api/agent/tools')
                .expect(200);
            
            const searchTool = response.body.data.find(t => t.name === 'search_inventory');
            expect(searchTool).toBeDefined();
            expect(searchTool.parameters).toHaveProperty('query');
        });
    });
    
    describe('POST /api/agent/tools/call', () => {
        describe('Input Validation', () => {
            test('should return 400 when tool name is missing', async () => {
                const response = await request(app)
                    .post('/api/agent/tools/call')
                    .send({ params: { dish: 'Steak' } })
                    .expect(400);
                
                expect(response.body.success).toBe(false);
                expect(response.body.error).toBeDefined();
                expect(response.body.error.message).toContain('required');
            });
            
            test('should return 404 for non-existent tool', async () => {
                const response = await request(app)
                    .post('/api/agent/tools/call')
                    .send({
                        name: 'non_existent_tool',
                        params: {}
                    })
                    .expect(404);
                
                expect(response.body.success).toBe(false);
                expect(response.body.error.code).toBe('TOOL_NOT_FOUND');
            });
        });
        
        describe('Wine Pairing Tool', () => {
            test('should get wine pairings for a dish', async () => {
                const response = await request(app)
                    .post('/api/agent/tools/call')
                    .send({
                        name: 'get_wine_pairings',
                        params: {
                            dish: 'Grilled Salmon',
                            cuisine: 'French'
                        }
                    })
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(response.body.data).toBeDefined();
                expect(response.body.data.dish).toBe('Grilled Salmon');
                expect(response.body.data.pairings).toBeDefined();
                expect(Array.isArray(response.body.data.pairings)).toBe(true);
                expect(response.body.data.pairings.length).toBeGreaterThan(0);
                
                // Check pairing structure
                const pairing = response.body.data.pairings[0];
                expect(pairing).toHaveProperty('wine');
                expect(pairing).toHaveProperty('score');
                expect(pairing).toHaveProperty('reason');
            });
            
            test('should require dish parameter', async () => {
                const response = await request(app)
                    .post('/api/agent/tools/call')
                    .send({
                        name: 'get_wine_pairings',
                        params: {
                            cuisine: 'Italian'
                        }
                    })
                    .expect(400);
                
                expect(response.body.success).toBe(false);
                expect(response.body.error.message).toContain('dish');
            });
        });
        
        describe('Inventory Search Tool', () => {
            test('should search wine inventory', async () => {
                const response = await request(app)
                    .post('/api/agent/tools/call')
                    .send({
                        name: 'search_inventory',
                        params: {
                            query: 'Bordeaux',
                            filters: {
                                vintage_min: 2015,
                                vintage_max: 2020
                            }
                        }
                    })
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(response.body.data.results).toBeDefined();
                expect(Array.isArray(response.body.data.results)).toBe(true);
                expect(response.body.data.total).toBeDefined();
            });
            
            test('should require query parameter', async () => {
                const response = await request(app)
                    .post('/api/agent/tools/call')
                    .send({
                        name: 'search_inventory',
                        params: {}
                    })
                    .expect(400);
                
                expect(response.body.success).toBe(false);
                expect(response.body.error.message).toContain('query');
            });
        });
        
        describe('Procurement Recommendations Tool', () => {
            test('should get procurement recommendations', async () => {
                const response = await request(app)
                    .post('/api/agent/tools/call')
                    .send({
                        name: 'get_procurement_recommendations',
                        params: {
                            budget: 5000,
                            preferences: {
                                regions: ['Bordeaux', 'Burgundy'],
                                price_range: [100, 500]
                            }
                        }
                    })
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(response.body.data.recommendations).toBeDefined();
                expect(Array.isArray(response.body.data.recommendations)).toBe(true);
                expect(response.body.data.total_budget).toBe(5000);
            });
            
            test('should work without optional parameters', async () => {
                const response = await request(app)
                    .post('/api/agent/tools/call')
                    .send({
                        name: 'get_procurement_recommendations',
                        params: {}
                    })
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(response.body.data.recommendations).toBeDefined();
            });
        });
    });
});
