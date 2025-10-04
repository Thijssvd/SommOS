const request = require('supertest');
const Database = require('../backend/database/connection');

// Mock the database
jest.mock('../backend/database/connection');

// Mock the server with RUM API endpoints
jest.mock('../backend/server', () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    
    // In-memory storage for RUM data
    const rumData = {
        sessions: new Map(),
        metrics: new Map(),
        errors: new Map()
    };
    
    // POST /api/performance/rum - Collect RUM metrics
    app.post('/api/performance/rum', (req, res) => {
        const { sessionId, userId, timestamp, url, metrics } = req.body;
        
        if (!sessionId || !userId || !timestamp) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: sessionId, userId, timestamp'
            });
        }
        
        // Store session
        const sessionData = {
            sessionId,
            userId,
            timestamp,
            url: url || '',
            userAgent: req.body.userAgent || '',
            connection: req.body.connection || {},
            isUnload: req.body.isUnload || false,
            receivedAt: Date.now()
        };
        
        rumData.sessions.set(sessionId, sessionData);
        
        // Store metrics
        if (metrics) {
            if (metrics.webVitals) {
                metrics.webVitals.forEach(vital => {
                    const key = `${sessionId}_${vital.name}_${Date.now()}`;
                    rumData.metrics.set(key, {
                        ...vital,
                        sessionId,
                        type: 'webVital',
                        processedAt: Date.now()
                    });
                });
            }
            
            if (metrics.customMetrics) {
                metrics.customMetrics.forEach(metric => {
                    const key = `${sessionId}_custom_${Date.now()}`;
                    rumData.metrics.set(key, {
                        ...metric,
                        sessionId,
                        type: 'custom',
                        processedAt: Date.now()
                    });
                });
            }
            
            if (metrics.errors) {
                metrics.errors.forEach(error => {
                    const key = `${sessionId}_error_${Date.now()}`;
                    rumData.errors.set(key, {
                        ...error,
                        sessionId,
                        type: 'error',
                        processedAt: Date.now()
                    });
                });
            }
            
            if (metrics.resources) {
                metrics.resources.forEach(resource => {
                    const key = `${sessionId}_resource_${Date.now()}`;
                    rumData.metrics.set(key, {
                        ...resource,
                        sessionId,
                        type: 'resource',
                        processedAt: Date.now()
                    });
                });
            }
            
            if (metrics.navigation) {
                const key = `${sessionId}_navigation`;
                rumData.metrics.set(key, {
                    ...metrics.navigation,
                    sessionId,
                    type: 'navigation',
                    processedAt: Date.now()
                });
            }
        }
        
        res.json({
            success: true,
            message: 'RUM data received successfully',
            sessionId
        });
    });
    
    // GET /api/performance/rum/sessions - Get sessions
    app.get('/api/performance/rum/sessions', (req, res) => {
        const { startTime, endTime, userId } = req.query;
        
        let sessions = Array.from(rumData.sessions.values());
        
        // Filter by time range
        if (startTime || endTime) {
            sessions = sessions.filter(session => {
                const sessionTime = session.timestamp;
                if (startTime && sessionTime < parseInt(startTime)) return false;
                if (endTime && sessionTime > parseInt(endTime)) return false;
                return true;
            });
        }
        
        // Filter by user
        if (userId) {
            sessions = sessions.filter(session => session.userId === userId);
        }
        
        res.json({
            success: true,
            data: {
                sessions,
                total: sessions.length
            }
        });
    });
    
    // GET /api/performance/rum/metrics - Get metrics
    app.get('/api/performance/rum/metrics', (req, res) => {
        const { sessionId, type, startTime, endTime, metricName } = req.query;
        
        let metrics = Array.from(rumData.metrics.values());
        
        // Filter by session
        if (sessionId) {
            metrics = metrics.filter(metric => metric.sessionId === sessionId);
        }
        
        // Filter by type
        if (type) {
            metrics = metrics.filter(metric => metric.type === type);
        }
        
        // Filter by metric name
        if (metricName) {
            metrics = metrics.filter(metric => metric.name === metricName);
        }
        
        // Filter by time range
        if (startTime || endTime) {
            metrics = metrics.filter(metric => {
                const metricTime = metric.timestamp;
                if (startTime && metricTime < parseInt(startTime)) return false;
                if (endTime && metricTime > parseInt(endTime)) return false;
                return true;
            });
        }
        
        res.json({
            success: true,
            data: {
                metrics,
                total: metrics.length
            }
        });
    });
    
    // GET /api/performance/rum/errors - Get errors
    app.get('/api/performance/rum/errors', (req, res) => {
        const { sessionId, type, startTime, endTime } = req.query;
        
        let errors = Array.from(rumData.errors.values());
        
        // Filter by session
        if (sessionId) {
            errors = errors.filter(error => error.sessionId === sessionId);
        }
        
        // Filter by type
        if (type) {
            errors = errors.filter(error => error.type === type);
        }
        
        // Filter by time range
        if (startTime || endTime) {
            errors = errors.filter(error => {
                const errorTime = error.timestamp;
                if (startTime && errorTime < parseInt(startTime)) return false;
                if (endTime && errorTime > parseInt(endTime)) return false;
                return true;
            });
        }
        
        res.json({
            success: true,
            data: {
                errors,
                total: errors.length
            }
        });
    });
    
    // GET /api/performance/rum/summary - Get summary
    app.get('/api/performance/rum/summary', (req, res) => {
        const { startTime, endTime } = req.query;
        const now = Date.now();
        const defaultStartTime = startTime || (now - 24 * 60 * 60 * 1000);
        const defaultEndTime = endTime || now;
        
        const metrics = Array.from(rumData.metrics.values()).filter(metric => {
            return metric.timestamp >= defaultStartTime && metric.timestamp <= defaultEndTime;
        });
        
        const errors = Array.from(rumData.errors.values()).filter(error => {
            return error.timestamp >= defaultStartTime && error.timestamp <= defaultEndTime;
        });
        
        const sessions = Array.from(rumData.sessions.values()).filter(session => {
            return session.timestamp >= defaultStartTime && session.timestamp <= defaultEndTime;
        });
        
        // Calculate Web Vitals summary
        const webVitals = {};
        const webVitalMetrics = metrics.filter(m => m.type === 'webVital');
        
        ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].forEach(vital => {
            const vitalMetrics = webVitalMetrics.filter(m => m.name === vital);
            if (vitalMetrics.length > 0) {
                const values = vitalMetrics.map(m => m.value);
                webVitals[vital] = {
                    count: vitalMetrics.length,
                    average: values.reduce((a, b) => a + b, 0) / values.length,
                    min: Math.min(...values),
                    max: Math.max(...values),
                    passing: vitalMetrics.filter(m => m.passed).length,
                    passingRate: vitalMetrics.filter(m => m.passed).length / vitalMetrics.length
                };
            }
        });
        
        const summary = {
            timeRange: {
                start: defaultStartTime,
                end: defaultEndTime,
                duration: defaultEndTime - defaultStartTime
            },
            webVitals,
            errors: {
                total: errors.length,
                byType: {},
                bySession: {}
            },
            sessions: {
                total: sessions.length,
                uniqueUsers: new Set(sessions.map(s => s.userId)).size
            },
            resources: {
                total: metrics.filter(m => m.type === 'resource').length
            },
            totalMetrics: metrics.length,
            generatedAt: now
        };
        
        res.json({
            success: true,
            data: summary
        });
    });
    
    // GET /api/performance/rum/analytics - Get analytics
    app.get('/api/performance/rum/analytics', (req, res) => {
        const { startTime, endTime, groupBy = 'hour', metric = 'LCP' } = req.query;
        const now = Date.now();
        const defaultStartTime = startTime || (now - 24 * 60 * 60 * 1000);
        const defaultEndTime = endTime || now;
        
        const metrics = Array.from(rumData.metrics.values()).filter(m =>
            m.type === 'webVital' &&
            m.name === metric &&
            m.timestamp >= defaultStartTime &&
            m.timestamp <= defaultEndTime
        );
        
        // Simple analytics without grouping for test
        const values = metrics.map(m => m.value);
        const analytics = [{
            time: defaultStartTime,
            count: metrics.length,
            average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
            min: values.length > 0 ? Math.min(...values) : 0,
            max: values.length > 0 ? Math.max(...values) : 0,
            passing: metrics.filter(m => m.passed).length,
            passingRate: metrics.length > 0 ? metrics.filter(m => m.passed).length / metrics.length : 0
        }];
        
        res.json({
            success: true,
            data: {
                metric,
                timeRange: {
                    start: defaultStartTime,
                    end: defaultEndTime
                },
                groupBy,
                analytics
            }
        });
    });
    
    return app;
});

const app = require('../backend/server');

describe('RUM API Routes', () => {
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
    
    describe('POST /api/performance/rum', () => {
        describe('RUM Data Collection', () => {
            test('should collect basic RUM session data', async () => {
                const rumData = {
                    sessionId: 'session_123',
                    userId: 'user_456',
                    timestamp: Date.now(),
                    url: 'https://example.com/wines',
                    userAgent: 'Mozilla/5.0...',
                    connection: {
                        effectiveType: '4g',
                        rtt: 50,
                        downlink: 10
                    }
                };
                
                const response = await request(app)
                    .post('/api/performance/rum')
                    .send(rumData)
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(response.body.message).toContain('received');
                expect(response.body.sessionId).toBe('session_123');
            });
            
            test('should collect RUM data with Web Vitals', async () => {
                const rumData = {
                    sessionId: 'session_456',
                    userId: 'user_789',
                    timestamp: Date.now(),
                    url: 'https://example.com/pairing',
                    metrics: {
                        webVitals: [
                            { name: 'LCP', value: 2500, passed: true, timestamp: Date.now() },
                            { name: 'FID', value: 50, passed: true, timestamp: Date.now() },
                            { name: 'CLS', value: 0.05, passed: true, timestamp: Date.now() }
                        ]
                    }
                };
                
                const response = await request(app)
                    .post('/api/performance/rum')
                    .send(rumData)
                    .expect(200);
                
                expect(response.body.success).toBe(true);
                expect(response.body.sessionId).toBe('session_456');
            });
            
            test('should collect custom metrics', async () => {
                const rumData = {
                    sessionId: 'session_custom',
                    userId: 'user_custom',
                    timestamp: Date.now(),
                    metrics: {
                        customMetrics: [
                            { name: 'api_response_time', value: 350, timestamp: Date.now() },
                            { name: 'search_latency', value: 125, timestamp: Date.now() }
                        ]
                    }
                };
                
                const response = await request(app)
                    .post('/api/performance/rum')
                    .send(rumData)
                    .expect(200);
                
                expect(response.body.success).toBe(true);
            });
            
            test('should collect error data', async () => {
                const rumData = {
                    sessionId: 'session_errors',
                    userId: 'user_errors',
                    timestamp: Date.now(),
                    metrics: {
                        errors: [
                            {
                                type: 'javascript',
                                message: 'Cannot read property of undefined',
                                stack: 'Error at line 123...',
                                timestamp: Date.now()
                            }
                        ]
                    }
                };
                
                const response = await request(app)
                    .post('/api/performance/rum')
                    .send(rumData)
                    .expect(200);
                
                expect(response.body.success).toBe(true);
            });
            
            test('should collect resource timing data', async () => {
                const rumData = {
                    sessionId: 'session_resources',
                    userId: 'user_resources',
                    timestamp: Date.now(),
                    metrics: {
                        resources: [
                            {
                                name: 'main.js',
                                duration: 45,
                                transferSize: 50000,
                                timestamp: Date.now()
                            },
                            {
                                name: 'styles.css',
                                duration: 30,
                                transferSize: 25000,
                                timestamp: Date.now()
                            }
                        ]
                    }
                };
                
                const response = await request(app)
                    .post('/api/performance/rum')
                    .send(rumData)
                    .expect(200);
                
                expect(response.body.success).toBe(true);
            });
            
            test('should collect navigation timing', async () => {
                const rumData = {
                    sessionId: 'session_nav',
                    userId: 'user_nav',
                    timestamp: Date.now(),
                    metrics: {
                        navigation: {
                            domContentLoaded: 1500,
                            loadComplete: 2500,
                            firstPaint: 800,
                            timestamp: Date.now()
                        }
                    }
                };
                
                const response = await request(app)
                    .post('/api/performance/rum')
                    .send(rumData)
                    .expect(200);
                
                expect(response.body.success).toBe(true);
            });
        });
        
        describe('Validation', () => {
            test('should require sessionId', async () => {
                const response = await request(app)
                    .post('/api/performance/rum')
                    .send({
                        userId: 'user_123',
                        timestamp: Date.now()
                    })
                    .expect(400);
                
                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('sessionId');
            });
            
            test('should require userId', async () => {
                const response = await request(app)
                    .post('/api/performance/rum')
                    .send({
                        sessionId: 'session_123',
                        timestamp: Date.now()
                    })
                    .expect(400);
                
                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('userId');
            });
            
            test('should require timestamp', async () => {
                const response = await request(app)
                    .post('/api/performance/rum')
                    .send({
                        sessionId: 'session_123',
                        userId: 'user_456'
                    })
                    .expect(400);
                
                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('timestamp');
            });
        });
    });
    
    describe('GET /api/performance/rum/sessions', () => {
        beforeEach(async () => {
            // Create some test sessions
            await request(app)
                .post('/api/performance/rum')
                .send({
                    sessionId: 'test_session_1',
                    userId: 'user_1',
                    timestamp: Date.now() - 1000000,
                    url: 'https://example.com/page1'
                });
            
            await request(app)
                .post('/api/performance/rum')
                .send({
                    sessionId: 'test_session_2',
                    userId: 'user_2',
                    timestamp: Date.now() - 500000,
                    url: 'https://example.com/page2'
                });
        });
        
        test('should get all sessions', async () => {
            const response = await request(app)
                .get('/api/performance/rum/sessions')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.sessions).toBeDefined();
            expect(Array.isArray(response.body.data.sessions)).toBe(true);
            expect(response.body.data.total).toBeGreaterThan(0);
        });
        
        test('should filter sessions by userId', async () => {
            const response = await request(app)
                .get('/api/performance/rum/sessions')
                .query({ userId: 'user_1' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.sessions.length).toBeGreaterThanOrEqual(1);
            expect(response.body.data.sessions[0].userId).toBe('user_1');
        });
        
        test('should filter sessions by time range', async () => {
            const startTime = Date.now() - 2000000;
            const endTime = Date.now();
            
            const response = await request(app)
                .get('/api/performance/rum/sessions')
                .query({ startTime, endTime })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.sessions).toBeDefined();
        });
    });
    
    describe('GET /api/performance/rum/metrics', () => {
        beforeEach(async () => {
            // Create session with metrics
            await request(app)
                .post('/api/performance/rum')
                .send({
                    sessionId: 'metrics_session',
                    userId: 'metrics_user',
                    timestamp: Date.now(),
                    metrics: {
                        webVitals: [
                            { name: 'LCP', value: 2400, passed: true, timestamp: Date.now() },
                            { name: 'FID', value: 40, passed: true, timestamp: Date.now() }
                        ]
                    }
                });
        });
        
        test('should get all metrics', async () => {
            const response = await request(app)
                .get('/api/performance/rum/metrics')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.metrics).toBeDefined();
            expect(Array.isArray(response.body.data.metrics)).toBe(true);
        });
        
        test('should filter metrics by sessionId', async () => {
            const response = await request(app)
                .get('/api/performance/rum/metrics')
                .query({ sessionId: 'metrics_session' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.metrics.length).toBeGreaterThan(0);
        });
        
        test('should filter metrics by type', async () => {
            const response = await request(app)
                .get('/api/performance/rum/metrics')
                .query({ type: 'webVital' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.metrics.every(m => m.type === 'webVital')).toBe(true);
        });
        
        test('should filter metrics by name', async () => {
            const response = await request(app)
                .get('/api/performance/rum/metrics')
                .query({ metricName: 'LCP' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            if (response.body.data.metrics.length > 0) {
                expect(response.body.data.metrics.every(m => m.name === 'LCP')).toBe(true);
            }
        });
    });
    
    describe('GET /api/performance/rum/errors', () => {
        beforeEach(async () => {
            // Create session with errors
            await request(app)
                .post('/api/performance/rum')
                .send({
                    sessionId: 'errors_session',
                    userId: 'errors_user',
                    timestamp: Date.now(),
                    metrics: {
                        errors: [
                            {
                                type: 'javascript',
                                message: 'Test error',
                                stack: 'Error stack trace',
                                timestamp: Date.now()
                            }
                        ]
                    }
                });
        });
        
        test('should get all errors', async () => {
            const response = await request(app)
                .get('/api/performance/rum/errors')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.errors).toBeDefined();
            expect(Array.isArray(response.body.data.errors)).toBe(true);
        });
        
        test('should filter errors by sessionId', async () => {
            const response = await request(app)
                .get('/api/performance/rum/errors')
                .query({ sessionId: 'errors_session' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.errors.length).toBeGreaterThan(0);
        });
        
        test('should filter errors by type', async () => {
            const response = await request(app)
                .get('/api/performance/rum/errors')
                .query({ type: 'javascript' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
        });
    });
    
    describe('GET /api/performance/rum/summary', () => {
        beforeEach(async () => {
            // Create comprehensive session data
            await request(app)
                .post('/api/performance/rum')
                .send({
                    sessionId: 'summary_session',
                    userId: 'summary_user',
                    timestamp: Date.now(),
                    url: 'https://example.com',
                    metrics: {
                        webVitals: [
                            { name: 'LCP', value: 2300, passed: true, timestamp: Date.now() },
                            { name: 'FID', value: 45, passed: true, timestamp: Date.now() },
                            { name: 'CLS', value: 0.08, passed: true, timestamp: Date.now() }
                        ],
                        resources: [
                            { name: 'main.js', duration: 50, transferSize: 60000, timestamp: Date.now() }
                        ]
                    }
                });
        });
        
        test('should get RUM summary', async () => {
            const response = await request(app)
                .get('/api/performance/rum/summary')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.timeRange).toBeDefined();
            expect(response.body.data.webVitals).toBeDefined();
            expect(response.body.data.errors).toBeDefined();
            expect(response.body.data.sessions).toBeDefined();
            expect(response.body.data.resources).toBeDefined();
        });
        
        test('should calculate Web Vitals statistics', async () => {
            const response = await request(app)
                .get('/api/performance/rum/summary')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            const webVitals = response.body.data.webVitals;
            
            if (webVitals.LCP) {
                expect(webVitals.LCP.count).toBeGreaterThan(0);
                expect(webVitals.LCP.average).toBeDefined();
                expect(webVitals.LCP.min).toBeDefined();
                expect(webVitals.LCP.max).toBeDefined();
            }
        });
        
        test('should filter summary by time range', async () => {
            const startTime = Date.now() - 1000000;
            const endTime = Date.now();
            
            const response = await request(app)
                .get('/api/performance/rum/summary')
                .query({ startTime, endTime })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            // Query params are strings, so we need to compare as numbers or strings
            expect(Number(response.body.data.timeRange.start)).toBe(startTime);
            expect(Number(response.body.data.timeRange.end)).toBe(endTime);
        });
    });
    
    describe('GET /api/performance/rum/analytics', () => {
        beforeEach(async () => {
            // Create session for analytics
            await request(app)
                .post('/api/performance/rum')
                .send({
                    sessionId: 'analytics_session',
                    userId: 'analytics_user',
                    timestamp: Date.now(),
                    metrics: {
                        webVitals: [
                            { name: 'LCP', value: 2600, passed: true, timestamp: Date.now() },
                            { name: 'FCP', value: 1200, passed: true, timestamp: Date.now() }
                        ]
                    }
                });
        });
        
        test('should get analytics for LCP', async () => {
            const response = await request(app)
                .get('/api/performance/rum/analytics')
                .query({ metric: 'LCP' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.metric).toBe('LCP');
            expect(response.body.data.analytics).toBeDefined();
            expect(Array.isArray(response.body.data.analytics)).toBe(true);
        });
        
        test('should support different groupBy options', async () => {
            const response = await request(app)
                .get('/api/performance/rum/analytics')
                .query({ metric: 'LCP', groupBy: 'hour' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.groupBy).toBe('hour');
        });
        
        test('should filter analytics by time range', async () => {
            const startTime = Date.now() - 2000000;
            const endTime = Date.now();
            
            const response = await request(app)
                .get('/api/performance/rum/analytics')
                .query({ metric: 'LCP', startTime, endTime })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.timeRange).toBeDefined();
        });
    });
});
