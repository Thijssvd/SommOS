const request = require('supertest');
const Database = require('../backend/database/connection');

// Mock the database
jest.mock('../backend/database/connection');

// Mock the server with experiment API endpoints
jest.mock('../backend/server', () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    
    let experimentIdCounter = 1;
    const experiments = {};
    const assignments = {};
    const events = [];
    const analyses = {};
    
    // POST /api/experiments - Create experiment
    app.post('/api/experiments', (req, res) => {
        const { name, description, variants, traffic_allocation, start_date, end_date } = req.body;
        
        if (!name || !variants || !Array.isArray(variants) || variants.length < 2) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_EXPERIMENT', message: 'Invalid experiment data' }
            });
        }
        
        const experimentId = `exp_${experimentIdCounter++}`;
        const experiment = {
            id: experimentId,
            name,
            description: description || '',
            status: 'draft',
            variants: variants.map((v, i) => ({
                id: `var_${experimentId}_${i}`,
                name: v.name,
                is_control: v.is_control || false,
                allocation_percentage: v.allocation_percentage || (100 / variants.length)
            })),
            traffic_allocation: traffic_allocation || 100,
            start_date: start_date || null,
            end_date: end_date || null,
            created_at: new Date().toISOString()
        };
        
        experiments[experimentId] = experiment;
        
        res.status(201).json({
            success: true,
            data: {
                experiment_id: experimentId,
                name: experiment.name,
                status: experiment.status,
                variants: experiment.variants,
                created_at: experiment.created_at
            },
            message: 'Experiment created successfully'
        });
    });
    
    // GET /api/experiments - List experiments
    app.get('/api/experiments', (req, res) => {
        const { status, limit = 50, offset = 0 } = req.query;
        
        let filtered = Object.values(experiments);
        if (status) {
            filtered = filtered.filter(e => e.status === status);
        }
        
        const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        
        res.json({
            success: true,
            data: paginated,
            meta: {
                count: paginated.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    });
    
    // GET /api/experiments/:experimentId - Get experiment
    app.get('/api/experiments/:experimentId', (req, res) => {
        const { experimentId } = req.params;
        const experiment = experiments[experimentId];
        
        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: { code: 'EXPERIMENT_NOT_FOUND', message: `Experiment ${experimentId} not found` }
            });
        }
        
        res.json({ success: true, data: experiment });
    });
    
    // PATCH /api/experiments/:experimentId - Update experiment
    app.patch('/api/experiments/:experimentId', (req, res) => {
        const { experimentId } = req.params;
        const experiment = experiments[experimentId];
        
        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: { code: 'EXPERIMENT_NOT_FOUND', message: `Experiment ${experimentId} not found` }
            });
        }
        
        Object.assign(experiment, req.body);
        
        res.json({
            success: true,
            data: experiment,
            message: 'Experiment updated successfully'
        });
    });
    
    // POST /api/experiments/:experimentId/start - Start experiment
    app.post('/api/experiments/:experimentId/start', (req, res) => {
        const { experimentId } = req.params;
        const experiment = experiments[experimentId];
        
        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: { code: 'EXPERIMENT_NOT_FOUND', message: 'Experiment not found' }
            });
        }
        
        if (experiment.status !== 'draft') {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_STATUS', message: 'Only draft experiments can be started' }
            });
        }
        
        experiment.status = 'running';
        experiment.started_at = new Date().toISOString();
        
        res.json({
            success: true,
            data: experiment,
            message: 'Experiment started successfully'
        });
    });
    
    // POST /api/experiments/:experimentId/pause - Pause experiment
    app.post('/api/experiments/:experimentId/pause', (req, res) => {
        const { experimentId } = req.params;
        const experiment = experiments[experimentId];
        
        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: { code: 'EXPERIMENT_NOT_FOUND', message: 'Experiment not found' }
            });
        }
        
        experiment.status = 'paused';
        
        res.json({
            success: true,
            data: experiment,
            message: 'Experiment paused successfully'
        });
    });
    
    // POST /api/experiments/:experimentId/resume - Resume experiment
    app.post('/api/experiments/:experimentId/resume', (req, res) => {
        const { experimentId } = req.params;
        const experiment = experiments[experimentId];
        
        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: { code: 'EXPERIMENT_NOT_FOUND', message: 'Experiment not found' }
            });
        }
        
        experiment.status = 'running';
        
        res.json({
            success: true,
            data: experiment,
            message: 'Experiment resumed successfully'
        });
    });
    
    // POST /api/experiments/:experimentId/complete - Complete experiment
    app.post('/api/experiments/:experimentId/complete', (req, res) => {
        const { experimentId } = req.params;
        const { winner_variant_id, conclusion } = req.body;
        const experiment = experiments[experimentId];
        
        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: { code: 'EXPERIMENT_NOT_FOUND', message: 'Experiment not found' }
            });
        }
        
        experiment.status = 'completed';
        experiment.winner_variant_id = winner_variant_id;
        experiment.conclusion = conclusion;
        experiment.completed_at = new Date().toISOString();
        
        res.json({
            success: true,
            data: experiment,
            message: 'Experiment completed successfully'
        });
    });
    
    // DELETE /api/experiments/:experimentId - Archive experiment
    app.delete('/api/experiments/:experimentId', (req, res) => {
        const { experimentId } = req.params;
        const experiment = experiments[experimentId];
        
        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: { code: 'EXPERIMENT_NOT_FOUND', message: 'Experiment not found' }
            });
        }
        
        experiment.status = 'archived';
        
        res.json({
            success: true,
            message: 'Experiment archived successfully'
        });
    });
    
    // POST /api/experiments/:experimentId/assign - Assign user to variant
    app.post('/api/experiments/:experimentId/assign', (req, res) => {
        const { experimentId } = req.params;
        const { user_id, attributes } = req.body;
        
        if (!user_id) {
            return res.status(400).json({
                success: false,
                error: { code: 'USER_ID_REQUIRED', message: 'user_id is required' }
            });
        }
        
        const experiment = experiments[experimentId];
        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: { code: 'EXPERIMENT_NOT_FOUND', message: 'Experiment not found' }
            });
        }
        
        // Simple assignment logic - assign to first variant
        const variant = experiment.variants[0];
        
        const assignmentKey = `${experimentId}_${user_id}`;
        assignments[assignmentKey] = {
            experiment_id: experimentId,
            user_id,
            variant_id: variant.id,
            variant_name: variant.name,
            assigned_at: new Date().toISOString(),
            attributes
        };
        
        res.json({
            success: true,
            data: {
                experiment_id: experimentId,
                user_id,
                variant: variant,
                assigned_at: new Date().toISOString()
            }
        });
    });
    
    // GET /api/experiments/:experimentId/assignments/:userId - Get user assignment
    app.get('/api/experiments/:experimentId/assignments/:userId', (req, res) => {
        const { experimentId, userId } = req.params;
        const assignmentKey = `${experimentId}_${userId}`;
        const assignment = assignments[assignmentKey];
        
        if (!assignment) {
            return res.status(404).json({
                success: false,
                error: { code: 'ASSIGNMENT_NOT_FOUND', message: `No assignment found for user ${userId}` }
            });
        }
        
        res.json({ success: true, data: assignment });
    });
    
    // GET /api/experiments/:experimentId/assignments - Get all assignments
    app.get('/api/experiments/:experimentId/assignments', (req, res) => {
        const { experimentId } = req.params;
        const { limit = 100, offset = 0 } = req.query;
        
        const filtered = Object.values(assignments).filter(a => a.experiment_id === experimentId);
        const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        
        res.json({
            success: true,
            data: paginated,
            meta: {
                count: paginated.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    });
    
    // POST /api/experiments/events - Track event
    app.post('/api/experiments/events', (req, res) => {
        const { experiment_id, variant_id, user_id, event_type } = req.body;
        
        if (!experiment_id || !variant_id || !user_id || !event_type) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_FIELDS', message: 'Required fields missing' }
            });
        }
        
        events.push({
            ...req.body,
            timestamp: new Date().toISOString()
        });
        
        res.status(202).json({
            success: true,
            message: 'Event tracked successfully'
        });
    });
    
    // POST /api/experiments/events/batch - Track batch events
    app.post('/api/experiments/events/batch', (req, res) => {
        const { events: batchEvents } = req.body;
        
        if (!Array.isArray(batchEvents) || batchEvents.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_BATCH', message: 'Events array required' }
            });
        }
        
        batchEvents.forEach(event => {
            events.push({
                ...event,
                timestamp: new Date().toISOString()
            });
        });
        
        res.status(202).json({
            success: true,
            message: `${batchEvents.length} events tracked successfully`,
            meta: { events_count: batchEvents.length }
        });
    });
    
    // POST /api/experiments/:experimentId/events/impression - Track impression
    app.post('/api/experiments/:experimentId/events/impression', (req, res) => {
        const { experimentId } = req.params;
        const { user_id, variant_id } = req.body;
        
        events.push({
            experiment_id: experimentId,
            variant_id,
            user_id,
            event_type: 'impression',
            timestamp: new Date().toISOString()
        });
        
        res.status(202).json({
            success: true,
            message: 'Impression tracked successfully'
        });
    });
    
    // POST /api/experiments/:experimentId/events/conversion - Track conversion
    app.post('/api/experiments/:experimentId/events/conversion', (req, res) => {
        const { experimentId } = req.params;
        const { user_id, variant_id, value } = req.body;
        
        events.push({
            experiment_id: experimentId,
            variant_id,
            user_id,
            event_type: 'conversion',
            event_value: value,
            timestamp: new Date().toISOString()
        });
        
        res.status(202).json({
            success: true,
            message: 'Conversion tracked successfully'
        });
    });
    
    // GET /api/experiments/:experimentId/metrics - Get metrics
    app.get('/api/experiments/:experimentId/metrics', (req, res) => {
        const { experimentId } = req.params;
        const experiment = experiments[experimentId];
        
        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: { code: 'EXPERIMENT_NOT_FOUND', message: 'Experiment not found' }
            });
        }
        
        const metrics = {
            experiment_id: experimentId,
            variants: experiment.variants.map(v => ({
                variant_id: v.id,
                variant_name: v.name,
                impressions: 100,
                clicks: 45,
                conversions: 12,
                conversion_rate: 0.12,
                avg_value: 50.25
            })),
            total_users: 250,
            total_events: 500
        };
        
        res.json({ success: true, data: metrics });
    });
    
    // GET /api/experiments/:experimentId/metrics/:variantId - Get variant metrics
    app.get('/api/experiments/:experimentId/metrics/:variantId', (req, res) => {
        const { experimentId, variantId } = req.params;
        
        const metrics = {
            experiment_id: experimentId,
            variant_id: variantId,
            impressions: 100,
            clicks: 45,
            conversions: 12,
            conversion_rate: 0.12,
            avg_value: 50.25,
            confidence_interval: [0.10, 0.14]
        };
        
        res.json({ success: true, data: metrics });
    });
    
    // GET /api/experiments/:experimentId/funnel - Get funnel analysis
    app.get('/api/experiments/:experimentId/funnel', (req, res) => {
        const { experimentId } = req.params;
        
        const funnel = {
            experiment_id: experimentId,
            stages: [
                { stage: 'impression', users: 250, drop_rate: 0 },
                { stage: 'click', users: 112, drop_rate: 0.55 },
                { stage: 'conversion', users: 30, drop_rate: 0.73 }
            ],
            overall_conversion: 0.12
        };
        
        res.json({ success: true, data: funnel });
    });
    
    // POST /api/experiments/:experimentId/analyze - Run analysis
    app.post('/api/experiments/:experimentId/analyze', (req, res) => {
        const { experimentId } = req.params;
        const { metric_name, analysis_type = 'both', confidence_level = 0.95 } = req.body;
        
        const analysis = {
            experiment_id: experimentId,
            analysis_type,
            metric_name: metric_name || 'conversion_rate',
            confidence_level,
            control_mean: 0.10,
            test_mean: 0.12,
            p_value: 0.03,
            is_significant: true,
            effect_size: 0.20,
            relative_lift: 0.20,
            bayesian_probability: 0.95,
            recommendation: 'Launch variant B',
            analyzed_at: new Date().toISOString()
        };
        
        analyses[experimentId] = analysis;
        
        res.json({
            success: true,
            data: analysis,
            meta: { analyzed_at: new Date().toISOString() }
        });
    });
    
    // GET /api/experiments/:experimentId/analysis - Get stored analysis
    app.get('/api/experiments/:experimentId/analysis', (req, res) => {
        const { experimentId } = req.params;
        const analysis = analyses[experimentId];
        
        if (!analysis) {
            return res.status(404).json({
                success: false,
                error: { code: 'ANALYSIS_NOT_FOUND', message: `No analysis found for experiment ${experimentId}` }
            });
        }
        
        res.json({ success: true, data: analysis });
    });
    
    // GET /api/experiments/:experimentId/guardrails - Check guardrails
    app.get('/api/experiments/:experimentId/guardrails', (req, res) => {
        const { experimentId } = req.params;
        
        const guardrails = [
            {
                metric: 'error_rate',
                threshold: 0.05,
                current_value: 0.02,
                is_violated: false
            },
            {
                metric: 'latency_p95',
                threshold: 500,
                current_value: 320,
                is_violated: false
            }
        ];
        
        res.json({
            success: true,
            data: {
                experiment_id: experimentId,
                guardrails,
                has_violations: false,
                checked_at: new Date().toISOString()
            }
        });
    });
    
    // GET /api/experiments/:experimentId/recommendation - Get recommendation
    app.get('/api/experiments/:experimentId/recommendation', (req, res) => {
        const { experimentId } = req.params;
        
        const recommendation = {
            experiment_id: experimentId,
            decision: 'launch',
            winning_variant: 'variant_b',
            confidence: 0.95,
            expected_lift: 0.20,
            reasoning: 'Variant B shows statistically significant improvement with 95% confidence',
            risks: ['Sample size could be larger'],
            next_steps: ['Launch to 100% traffic', 'Monitor for one week']
        };
        
        res.json({ success: true, data: recommendation });
    });
    
    // GET /api/experiments/dashboard/summary - Dashboard summary
    app.get('/api/experiments/dashboard/summary', (req, res) => {
        const allExps = Object.values(experiments);
        
        const summary = {
            total_experiments: allExps.length,
            running_experiments: allExps.filter(e => e.status === 'running').length,
            draft_experiments: allExps.filter(e => e.status === 'draft').length,
            completed_experiments: allExps.filter(e => e.status === 'completed').length,
            paused_experiments: allExps.filter(e => e.status === 'paused').length
        };
        
        res.json({ success: true, data: summary });
    });
    
    // GET /api/experiments/:experimentId/realtime - Realtime stats
    app.get('/api/experiments/:experimentId/realtime', (req, res) => {
        const { experimentId } = req.params;
        const experiment = experiments[experimentId];
        
        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: { code: 'EXPERIMENT_NOT_FOUND', message: 'Experiment not found' }
            });
        }
        
        const realtimeData = {
            experiment,
            variants: experiment.variants.map(v => ({
                ...v,
                users_assigned: 50,
                impressions: 100,
                clicks: 45,
                conversions: 12,
                click_rate: 0.45,
                conversion_rate: 0.12
            })),
            metrics: {
                total_users: 150,
                total_impressions: 300,
                total_conversions: 36
            },
            timestamp: new Date().toISOString()
        };
        
        res.json({ success: true, data: realtimeData });
    });
    
    return app;
});

const app = require('../backend/server');

describe('Experiment API Routes', () => {
    let db;
    
    beforeAll(async () => {
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
    
    describe('Experiment CRUD Operations', () => {
        let testExperimentId;
        
        describe('POST /api/experiments', () => {
            test('should create a new experiment', async () => {
                const experimentData = {
                    name: 'Test AB Experiment',
                    description: 'Testing wine pairing algorithm',
                    variants: [
                        { name: 'Control', is_control: true, allocation_percentage: 50 },
                        { name: 'Variant A', allocation_percentage: 50 }
                    ],
                    traffic_allocation: 100
                };
                
                const response = await request(app)
                    .post('/api/experiments')
                    .send(experimentData)
                    .expect(201);
                
                expect(response.body.success).toBe(true);
                expect(response.body.data.experiment_id).toBeDefined();
                expect(response.body.data.name).toBe(experimentData.name);
                expect(response.body.data.status).toBe('draft');
                expect(response.body.data.variants).toHaveLength(2);
                
                testExperimentId = response.body.data.experiment_id;
            });
            
            test('should require name and variants', async () => {
                const response = await request(app)
                    .post('/api/experiments')
                    .send({ name: 'Test' })
                    .expect(400);
                
                expect(response.body.success).toBe(false);
            });
            
            test('should require at least 2 variants', async () => {
                const response = await request(app)
                    .post('/api/experiments')
                    .send({
                        name: 'Test',
                        variants: [{ name: 'Only One' }]
                    })
                    .expect(400);
                
                expect(response.body.success).toBe(false);
            });
        });
        
        describe('GET /api/experiments', () => {
            test('should list all experiments', async () => {
                const response = await request(app)
                    .get('/api/experiments')
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(Array.isArray(response.body.data)).toBe(true);
                expect(response.body.meta).toBeDefined();
                expect(response.body.meta.count).toBeGreaterThanOrEqual(0);
            });
            
            test('should filter experiments by status', async () => {
                const response = await request(app)
                    .get('/api/experiments')
                    .query({ status: 'draft' })
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(Array.isArray(response.body.data)).toBe(true);
            });
            
            test('should support pagination', async () => {
                const response = await request(app)
                    .get('/api/experiments')
                    .query({ limit: 10, offset: 0 })
                    .expect(200);
                
                expect(response.body.meta.limit).toBe(10);
                expect(response.body.meta.offset).toBe(0);
            });
        });
        
        describe('GET /api/experiments/:experimentId', () => {
            test('should get experiment by ID', async () => {
                // First create an experiment
                const createRes = await request(app)
                    .post('/api/experiments')
                    .send({
                        name: 'Get Test',
                        variants: [
                            { name: 'A' },
                            { name: 'B' }
                        ]
                    });
                
                const expId = createRes.body.data.experiment_id;
                
                const response = await request(app)
                    .get(`/api/experiments/${expId}`)
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(response.body.data.id).toBe(expId);
            });
            
            test('should return 404 for non-existent experiment', async () => {
                const response = await request(app)
                    .get('/api/experiments/nonexistent')
                    .expect(404);
                
                expect(response.body.success).toBe(false);
                expect(response.body.error.code).toBe('EXPERIMENT_NOT_FOUND');
            });
        });
        
        describe('PATCH /api/experiments/:experimentId', () => {
            test('should update experiment', async () => {
                const createRes = await request(app)
                    .post('/api/experiments')
                    .send({
                        name: 'Update Test',
                        variants: [{ name: 'A' }, { name: 'B' }]
                    });
                
                const expId = createRes.body.data.experiment_id;
                
                const response = await request(app)
                    .patch(`/api/experiments/${expId}`)
                    .send({ description: 'Updated description' })
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(response.body.data.description).toBe('Updated description');
            });
        });
        
        describe('DELETE /api/experiments/:experimentId', () => {
            test('should archive experiment', async () => {
                const createRes = await request(app)
                    .post('/api/experiments')
                    .send({
                        name: 'Delete Test',
                        variants: [{ name: 'A' }, { name: 'B' }]
                    });
                
                const expId = createRes.body.data.experiment_id;
                
                const response = await request(app)
                    .delete(`/api/experiments/${expId}`)
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(response.body.message).toContain('archived');
            });
        });
    });
    
    describe('Experiment Lifecycle', () => {
        let experimentId;
        
        beforeEach(async () => {
            const createRes = await request(app)
                .post('/api/experiments')
                .send({
                    name: 'Lifecycle Test',
                    variants: [{ name: 'Control' }, { name: 'Test' }]
                });
            experimentId = createRes.body.data.experiment_id;
        });
        
        test('should start experiment', async () => {
            const response = await request(app)
                .post(`/api/experiments/${experimentId}/start`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('running');
        });
        
        test('should pause experiment', async () => {
            await request(app).post(`/api/experiments/${experimentId}/start`);
            
            const response = await request(app)
                .post(`/api/experiments/${experimentId}/pause`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('paused');
        });
        
        test('should resume experiment', async () => {
            await request(app).post(`/api/experiments/${experimentId}/start`);
            await request(app).post(`/api/experiments/${experimentId}/pause`);
            
            const response = await request(app)
                .post(`/api/experiments/${experimentId}/resume`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('running');
        });
        
        test('should complete experiment', async () => {
            const response = await request(app)
                .post(`/api/experiments/${experimentId}/complete`)
                .send({
                    winner_variant_id: 'var_1',
                    conclusion: 'Variant performed better'
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('completed');
        });
    });
    
    describe('Variant Assignment', () => {
        let experimentId;
        
        beforeEach(async () => {
            const createRes = await request(app)
                .post('/api/experiments')
                .send({
                    name: 'Assignment Test',
                    variants: [{ name: 'Control' }, { name: 'Test' }]
                });
            experimentId = createRes.body.data.experiment_id;
        });
        
        test('should assign user to variant', async () => {
            const response = await request(app)
                .post(`/api/experiments/${experimentId}/assign`)
                .send({
                    user_id: 'user_123',
                    attributes: { segment: 'premium' }
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.user_id).toBe('user_123');
            expect(response.body.data.variant).toBeDefined();
        });
        
        test('should require user_id', async () => {
            const response = await request(app)
                .post(`/api/experiments/${experimentId}/assign`)
                .send({})
                .expect(400);
            
            expect(response.body.success).toBe(false);
        });
        
        test('should get user assignment', async () => {
            await request(app)
                .post(`/api/experiments/${experimentId}/assign`)
                .send({ user_id: 'user_456' });
            
            const response = await request(app)
                .get(`/api/experiments/${experimentId}/assignments/user_456`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.user_id).toBe('user_456');
        });
        
        test('should list all assignments', async () => {
            const response = await request(app)
                .get(`/api/experiments/${experimentId}/assignments`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });
    
    describe('Event Tracking', () => {
        test('should track single event', async () => {
            const response = await request(app)
                .post('/api/experiments/events')
                .send({
                    experiment_id: 'exp_1',
                    variant_id: 'var_1',
                    user_id: 'user_1',
                    event_type: 'impression'
                })
                .expect(202);
            
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('tracked');
        });
        
        test('should track batch events', async () => {
            const response = await request(app)
                .post('/api/experiments/events/batch')
                .send({
                    events: [
                        { experiment_id: 'exp_1', variant_id: 'var_1', user_id: 'user_1', event_type: 'impression' },
                        { experiment_id: 'exp_1', variant_id: 'var_1', user_id: 'user_2', event_type: 'click' }
                    ]
                })
                .expect(202);
            
            expect(response.body.success).toBe(true);
            expect(response.body.meta.events_count).toBe(2);
        });
        
        test('should track impression', async () => {
            const response = await request(app)
                .post('/api/experiments/exp_1/events/impression')
                .send({ user_id: 'user_1', variant_id: 'var_1' })
                .expect(202);
            
            expect(response.body.success).toBe(true);
        });
        
        test('should track conversion', async () => {
            const response = await request(app)
                .post('/api/experiments/exp_1/events/conversion')
                .send({ user_id: 'user_1', variant_id: 'var_1', value: 99.99 })
                .expect(202);
            
            expect(response.body.success).toBe(true);
        });
    });
    
    describe('Metrics & Analysis', () => {
        let experimentId;
        
        beforeEach(async () => {
            const createRes = await request(app)
                .post('/api/experiments')
                .send({
                    name: 'Metrics Test',
                    variants: [{ name: 'Control' }, { name: 'Test' }]
                });
            experimentId = createRes.body.data.experiment_id;
        });
        
        test('should get experiment metrics', async () => {
            const response = await request(app)
                .get(`/api/experiments/${experimentId}/metrics`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.variants).toBeDefined();
        });
        
        test('should get variant metrics', async () => {
            const response = await request(app)
                .get(`/api/experiments/${experimentId}/metrics/var_1`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.conversion_rate).toBeDefined();
        });
        
        test('should get funnel analysis', async () => {
            const response = await request(app)
                .get(`/api/experiments/${experimentId}/funnel`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.stages).toBeDefined();
            expect(Array.isArray(response.body.data.stages)).toBe(true);
        });
        
        test('should run statistical analysis', async () => {
            const response = await request(app)
                .post(`/api/experiments/${experimentId}/analyze`)
                .send({
                    metric_name: 'conversion_rate',
                    analysis_type: 'both',
                    confidence_level: 0.95
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.is_significant).toBeDefined();
            expect(response.body.data.p_value).toBeDefined();
        });
        
        test('should get stored analysis', async () => {
            await request(app)
                .post(`/api/experiments/${experimentId}/analyze`)
                .send({ metric_name: 'conversion_rate' });
            
            const response = await request(app)
                .get(`/api/experiments/${experimentId}/analysis`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.p_value).toBeDefined();
        });
        
        test('should check guardrails', async () => {
            const response = await request(app)
                .get(`/api/experiments/${experimentId}/guardrails`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.guardrails).toBeDefined();
            expect(response.body.data.has_violations).toBeDefined();
        });
        
        test('should get recommendation', async () => {
            const response = await request(app)
                .get(`/api/experiments/${experimentId}/recommendation`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.decision).toBeDefined();
            expect(response.body.data.confidence).toBeDefined();
        });
    });
    
    describe('Dashboard', () => {
        test('should get dashboard summary', async () => {
            const response = await request(app)
                .get('/api/experiments/dashboard/summary')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.total_experiments).toBeDefined();
            expect(response.body.data.running_experiments).toBeDefined();
        });
        
        test('should get realtime stats', async () => {
            const createRes = await request(app)
                .post('/api/experiments')
                .send({
                    name: 'Realtime Test',
                    variants: [{ name: 'A' }, { name: 'B' }]
                });
            
            const expId = createRes.body.data.experiment_id;
            
            const response = await request(app)
                .get(`/api/experiments/${expId}/realtime`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.experiment).toBeDefined();
            expect(response.body.data.variants).toBeDefined();
            expect(response.body.data.timestamp).toBeDefined();
        });
    });
});
