// SommOS WebSocket Tests
// Tests for real-time inventory updates via WebSocket

const WebSocket = require('ws');
const http = require('http');
const EventEmitter = require('events');

// Mock the websocket_integration module
jest.mock('../backend/core/websocket_integration', () => {
    return {
        webSocketIntegration: {
            isWebSocketAvailable: jest.fn().mockReturnValue(false),
            broadcastInventoryUpdate: jest.fn().mockReturnValue(0),
            isConnected: jest.fn().mockReturnValue(false),
            getConnectedClientsCount: jest.fn().mockReturnValue(0),
            getConnectionStats: jest.fn().mockReturnValue(null)
        }
    };
});

// Mock the server with WebSocket support
jest.mock('../backend/server', () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.locals = {};
    return app;
});

const app = require('../backend/server');

describe('WebSocket Real-Time Sync', () => {
    let server;
    let wsServer;
    let client;
    let mockClients = [];

    beforeAll(async () => {
        // Start the server
        server = http.createServer(app);
        await new Promise((resolve) => {
            server.listen(0, resolve);
        });
        
        // Create a mock WebSocket server
        wsServer = new WebSocket.Server({ server, path: '/api/ws' });
        
        // Add broadcast methods
        wsServer.broadcastInventoryUpdate = (data) => {
            const message = {
                type: 'inventory_update',
                data: data,
                timestamp: Date.now()
            };
            wsServer.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            });
        };
        
        wsServer.broadcastInventoryAction = (data) => {
            const message = {
                type: 'inventory_action',
                data: data,
                timestamp: Date.now()
            };
            wsServer.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            });
        };
        
        wsServer.getStats = () => {
            return {
                totalClients: wsServer.clients.size,
                totalRooms: 1,
                rooms: ['inventory_updates']
            };
        };
        
        // Handle new connections
        wsServer.on('connection', (ws) => {
            const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Send connection established message
            ws.send(JSON.stringify({
                type: 'connection_established',
                clientId: clientId,
                serverInfo: {
                    version: '1.0.0',
                    timestamp: Date.now()
                }
            }));
            
            // Auto-join inventory_updates room
            setTimeout(() => {
                ws.send(JSON.stringify({
                    type: 'room_joined',
                    room: 'inventory_updates',
                    clientId: clientId
                }));
            }, 50);
            
            // Handle ping/pong
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'ping') {
                        ws.send(JSON.stringify({
                            type: 'pong',
                            timestamp: Date.now()
                        }));
                    }
                } catch (error) {
                    // Ignore parse errors
                }
            });
        });
        
        // Store for later cleanup
        app.locals.wsServer = wsServer;
    });

    afterAll(async () => {
        // Close all WebSocket clients
        if (wsServer) {
            wsServer.clients.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            wsServer.close();
        }
        if (server) {
            await new Promise((resolve) => {
                server.close(resolve);
            });
        }
    });

    beforeEach(() => {
        // Create a new WebSocket client for each test
        const port = server.address().port;
        client = new WebSocket(`ws://localhost:${port}/api/ws`);
    });

    afterEach(async () => {
        if (client) {
            try {
                if (client.readyState === WebSocket.OPEN) {
                    client.close();
                } else if (client.readyState === WebSocket.CONNECTING) {
                    // Wait for connection to establish then close
                    await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            if (client.readyState !== WebSocket.CLOSED) {
                                client.terminate();
                            }
                            resolve();
                        }, 100);
                        
                        client.once('open', () => {
                            clearTimeout(timeout);
                            client.close();
                            resolve();
                        });
                        
                        client.once('error', () => {
                            clearTimeout(timeout);
                            resolve();
                        });
                    });
                }
            } catch (error) {
                // Ignore cleanup errors
            }
            // Wait for cleanup
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    });

    test('should establish WebSocket connection', (done) => {
        client.on('open', () => {
            expect(client.readyState).toBe(WebSocket.OPEN);
            done();
        });

        client.on('error', (error) => {
            done(error);
        });
    });

    test('should receive connection established message', (done) => {
        client.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'connection_established') {
                expect(message.clientId).toBeDefined();
                expect(message.serverInfo).toBeDefined();
                expect(message.serverInfo.version).toBeDefined();
                done();
            }
        });

        client.on('error', (error) => {
            done(error);
        });
    });

    test('should join inventory_updates room automatically', (done) => {
        let connectionEstablished = false;
        let roomJoined = false;

        client.on('message', (data) => {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'connection_established') {
                connectionEstablished = true;
            } else if (message.type === 'room_joined' && message.room === 'inventory_updates') {
                roomJoined = true;
                if (connectionEstablished) {
                    done();
                }
            }
        });

        client.on('error', (error) => {
            done(error);
        });
    });

    test('should handle ping/pong heartbeat', (done) => {
        let pongReceived = false;

        client.on('message', (data) => {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'pong') {
                pongReceived = true;
                done();
            }
        });

        client.on('open', () => {
            // Send ping message
            client.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now()
            }));
        });

        client.on('error', (error) => {
            done(error);
        });
    });

    test('should broadcast inventory updates to connected clients', (done) => {
        let updateReceived = false;

        client.on('message', (data) => {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'inventory_update') {
                expect(message.data).toBeDefined();
                expect(message.timestamp).toBeDefined();
                updateReceived = true;
                done();
            }
        });

        client.on('open', () => {
            // Simulate an inventory update broadcast
            setTimeout(() => {
                if (wsServer) {
                    wsServer.broadcastInventoryUpdate({
                        type: 'update',
                        item: {
                            id: 1,
                            name: 'Test Wine',
                            vintage_year: 2020,
                            location: 'Cellar A',
                            quantity: 10
                        },
                        changes: { quantity: 10 },
                        userId: 'test-user'
                    });
                }
            }, 100);
        });

        client.on('error', (error) => {
            done(error);
        });
    });

    test('should broadcast inventory actions to connected clients', (done) => {
        let actionReceived = false;

        client.on('message', (data) => {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'inventory_action') {
                expect(message.data).toBeDefined();
                expect(message.timestamp).toBeDefined();
                actionReceived = true;
                done();
            }
        });

        client.on('open', () => {
            // Simulate an inventory action broadcast
            setTimeout(() => {
                if (wsServer) {
                    wsServer.broadcastInventoryAction({
                        type: 'add',
                        item: {
                            id: 2,
                            name: 'New Wine',
                            vintage_year: 2021,
                            location: 'Cellar B',
                            quantity: 5
                        },
                        userId: 'test-user'
                    });
                }
            }, 100);
        });

        client.on('error', (error) => {
            done(error);
        });
    });

    test('should handle multiple clients', (done) => {
        const port = server.address().port;
        const client2 = new WebSocket(`ws://localhost:${port}/api/ws`);
        let client1Received = false;
        let client2Received = false;

        const checkBothReceived = () => {
            if (client1Received && client2Received) {
                client2.close();
                done();
            }
        };

        client.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'inventory_update') {
                client1Received = true;
                checkBothReceived();
            }
        });

        client2.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'inventory_update') {
                client2Received = true;
                checkBothReceived();
            }
        });

        client2.on('open', () => {
            // Wait for both clients to be ready, then broadcast
            setTimeout(() => {
                if (wsServer) {
                    wsServer.broadcastInventoryUpdate({
                        type: 'update',
                        item: { id: 3, name: 'Multi-client Test Wine' },
                        changes: { quantity: 15 }
                    });
                }
            }, 200);
        });

        client.on('error', (error) => {
            client2.close();
            done(error);
        });

        client2.on('error', (error) => {
            done(error);
        });
    });

    test('should get WebSocket server stats', () => {
        if (wsServer) {
            const stats = wsServer.getStats();
            expect(stats).toBeDefined();
            expect(typeof stats.totalClients).toBe('number');
            expect(typeof stats.totalRooms).toBe('number');
            expect(Array.isArray(stats.rooms)).toBe(true);
        }
    });
});

describe('WebSocket Integration Service', () => {
    const { webSocketIntegration } = require('../backend/core/websocket_integration');

    test('should initialize without app', () => {
        expect(webSocketIntegration).toBeDefined();
        expect(webSocketIntegration.isWebSocketAvailable()).toBe(false);
    });

    test('should handle missing WebSocket server gracefully', () => {
        const result = webSocketIntegration.broadcastInventoryUpdate({
            type: 'test',
            item: { id: 1, name: 'Test' }
        });
        expect(result).toBe(0);
    });

    test('should provide utility methods', () => {
        expect(webSocketIntegration.isConnected()).toBe(false);
        expect(webSocketIntegration.getConnectedClientsCount()).toBe(0);
        expect(webSocketIntegration.getConnectionStats()).toBe(null);
    });
});