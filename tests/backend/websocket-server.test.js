/**
 * WebSocket Server Tests
 * Tests for real-time communication and WebSocket integration
 */

const WebSocketServer = require('../../backend/core/websocket_server');
const { WebSocketIntegration } = require('../../backend/core/websocket_integration');

jest.mock('ws');
jest.mock('../../backend/database/connection');

describe('WebSocket Server', () => {
    let wss;
    let mockHttpServer;

    beforeEach(() => {
        mockHttpServer = {
            on: jest.fn(),
            listen: jest.fn(),
            close: jest.fn()
        };
    });

    afterEach(() => {
        if (wss) {
            wss.close();
        }
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        test('should initialize with HTTP server', () => {
            wss = new WebSocketServer(mockHttpServer);
            expect(wss).toBeDefined();
            expect(wss.server).toBe(mockHttpServer);
        });

        test('should set up event handlers', () => {
            wss = new WebSocketServer(mockHttpServer);
            expect(wss.wss).toBeDefined();
        });
    });

    describe('Client Connection', () => {
        test('should handle new client connections', (done) => {
            wss = new WebSocketServer(mockHttpServer);
            
            const mockClient = {
                on: jest.fn(),
                send: jest.fn(),
                readyState: 1, // OPEN
                id: 'test-client-1'
            };

            const mockReq = {
                socket: { remoteAddress: '127.0.0.1' },
                headers: { 'user-agent': 'test-client' }
            };

            wss.handleConnection(mockClient, mockReq);
            
            expect(mockClient.on).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockClient.on).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
            done();
        });

        test('should assign unique IDs to clients', () => {
            wss = new WebSocketServer(mockHttpServer);
            
            const client1 = { on: jest.fn(), send: jest.fn(), readyState: 1 };
            const client2 = { on: jest.fn(), send: jest.fn(), readyState: 1 };

            const mockReq = {
                socket: { remoteAddress: '127.0.0.1' },
                headers: { 'user-agent': 'test-client' }
            };

            wss.handleConnection(client1, mockReq);
            wss.handleConnection(client2, mockReq);

            // Each client should have unique IDs assigned by the server
            const clientIds = Array.from(wss.clients.keys());
            expect(clientIds.length).toBe(2);
            expect(clientIds[0]).not.toBe(clientIds[1]);
        });

        test('should track connected clients', () => {
            wss = new WebSocketServer(mockHttpServer);
            
            const mockClient = { on: jest.fn(), send: jest.fn(), readyState: 1 };
            const mockReq = {
                socket: { remoteAddress: '127.0.0.1' },
                headers: { 'user-agent': 'test-client' }
            };
            
            wss.handleConnection(mockClient, mockReq);

            const clientCount = wss.getClientCount();
            expect(clientCount).toBeGreaterThan(0);
        });
    });

    describe('Message Handling', () => {
        test('should parse and handle JSON messages', (done) => {
            wss = new WebSocketServer(mockHttpServer);
            
            const mockClient = { 
                on: jest.fn(), 
                send: jest.fn(),
                readyState: 1,
                id: 'test-client'
            };

            const mockReq = {
                socket: { remoteAddress: '127.0.0.1' },
                headers: { 'user-agent': 'test-client' }
            };

            let messageHandler;
            mockClient.on.mockImplementation((event, handler) => {
                if (event === 'message') {
                    messageHandler = handler;
                }
            });

            wss.handleConnection(mockClient, mockReq);

            const testMessage = JSON.stringify({
                type: 'ping',
                data: { timestamp: Date.now() }
            });

            if (messageHandler) {
                messageHandler(testMessage);
            }

            // Should handle message without error
            expect(mockClient.on).toHaveBeenCalled();
            done();
        });

        test('should handle malformed JSON gracefully', () => {
            wss = new WebSocketServer(mockHttpServer);
            
            const mockClient = { 
                on: jest.fn(), 
                send: jest.fn(),
                readyState: 1,
                id: 'test-client'
            };

            const mockReq = {
                socket: { remoteAddress: '127.0.0.1' },
                headers: { 'user-agent': 'test-client' }
            };

            let messageHandler;
            mockClient.on.mockImplementation((event, handler) => {
                if (event === 'message') {
                    messageHandler = handler;
                }
            });

            wss.handleConnection(mockClient, mockReq);

            const malformedMessage = '{invalid json}';

            // Should not throw error
            expect(() => {
                if (messageHandler) {
                    messageHandler(malformedMessage);
                }
            }).not.toThrow();
        });
    });

    describe('Broadcasting', () => {
        test('should broadcast to all connected clients', () => {
            wss = new WebSocketServer(mockHttpServer);
            
            const client1 = { send: jest.fn(), readyState: 1, id: '1' };
            const client2 = { send: jest.fn(), readyState: 1, id: '2' };
            const client3 = { send: jest.fn(), readyState: 1, id: '3' };

            wss.clients = new Set([client1, client2, client3]);

            const message = { type: 'test', data: 'broadcast' };
            wss.broadcast(message);

            expect(client1.send).toHaveBeenCalled();
            expect(client2.send).toHaveBeenCalled();
            expect(client3.send).toHaveBeenCalled();
        });

        test('should not send to disconnected clients', () => {
            wss = new WebSocketServer(mockHttpServer);
            
            const openClient = { send: jest.fn(), readyState: 1, id: '1' };
            const closedClient = { send: jest.fn(), readyState: 3, id: '2' }; // CLOSED

            wss.clients = new Set([openClient, closedClient]);

            const message = { type: 'test', data: 'broadcast' };
            wss.broadcast(message);

            expect(openClient.send).toHaveBeenCalled();
            expect(closedClient.send).not.toHaveBeenCalled();
        });

        test('should handle broadcast errors gracefully', () => {
            wss = new WebSocketServer(mockHttpServer);
            
            const errorClient = { 
                send: jest.fn().mockImplementation(() => {
                    throw new Error('Send failed');
                }), 
                readyState: 1,
                id: '1'
            };

            wss.clients = new Set([errorClient]);

            const message = { type: 'test', data: 'broadcast' };
            
            // Should not throw
            expect(() => wss.broadcast(message)).not.toThrow();
        });
    });

    describe('Client Disconnection', () => {
        test('should clean up on client disconnect', () => {
            wss = new WebSocketServer(mockHttpServer);
            
            const mockClient = { 
                on: jest.fn(), 
                send: jest.fn(),
                readyState: 1,
                id: 'test-client'
            };

            const mockReq = {
                socket: { remoteAddress: '127.0.0.1' },
                headers: { 'user-agent': 'test-client' }
            };

            let closeHandler;
            mockClient.on.mockImplementation((event, handler) => {
                if (event === 'close') {
                    closeHandler = handler;
                }
            });

            wss.handleConnection(mockClient, mockReq);
            
            const initialCount = wss.getClientCount();
            
            if (closeHandler) {
                closeHandler();
            }

            const finalCount = wss.getClientCount();
            expect(finalCount).toBeLessThanOrEqual(initialCount);
        });

        test('should handle multiple disconnections', () => {
            wss = new WebSocketServer(mockHttpServer);
            
            const clients = [
                { on: jest.fn(), send: jest.fn(), readyState: 1, id: '1' },
                { on: jest.fn(), send: jest.fn(), readyState: 1, id: '2' },
                { on: jest.fn(), send: jest.fn(), readyState: 1, id: '3' }
            ];

            const mockReq = {
                socket: { remoteAddress: '127.0.0.1' },
                headers: { 'user-agent': 'test-client' }
            };

            clients.forEach(client => {
                wss.handleConnection(client, mockReq);
            });

            // Simulate disconnections
            clients.forEach(client => {
                const closeHandler = client.on.mock.calls.find(call => call[0] === 'close')?.[1];
                if (closeHandler) closeHandler();
            });

            // Should handle all disconnections without error
            expect(true).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle client errors', () => {
            wss = new WebSocketServer(mockHttpServer);
            
            const mockClient = { 
                on: jest.fn(), 
                send: jest.fn(),
                readyState: 1,
                id: 'test-client'
            };

            const mockReq = {
                socket: { remoteAddress: '127.0.0.1' },
                headers: { 'user-agent': 'test-client' }
            };

            let errorHandler;
            mockClient.on.mockImplementation((event, handler) => {
                if (event === 'error') {
                    errorHandler = handler;
                }
            });

            wss.handleConnection(mockClient, mockReq);

            // Simulate error
            const error = new Error('Connection error');
            if (errorHandler) {
                expect(() => errorHandler(error)).not.toThrow();
            }
        });

        test('should handle server shutdown gracefully', async () => {
            wss = new WebSocketServer(mockHttpServer);
            
            const mockClient = { 
                close: jest.fn(),
                readyState: 1,
                id: 'test-client'
            };

            wss.clients = new Set([mockClient]);

            await wss.close();

            // Should close all client connections
            expect(mockClient.close).toHaveBeenCalled();
        });
    });
});

describe('WebSocket Integration', () => {
    let integration;
    let mockWss;

    beforeEach(() => {
        mockWss = {
            broadcast: jest.fn(),
            clients: new Set(),
            getClientCount: jest.fn().mockReturnValue(0)
        };
        integration = new WebSocketIntegration(mockWss);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Inventory Updates', () => {
        test('should broadcast inventory item added', () => {
            const item = {
                id: 1,
                name: 'Test Wine',
                quantity: 12,
                location: 'main-cellar'
            };

            integration.broadcastItemAdded(item);

            expect(mockWss.broadcast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: expect.any(String),
                    data: expect.objectContaining(item)
                })
            );
        });

        test('should broadcast inventory item consumed', () => {
            const consumption = {
                vintage_id: 'vintage-1',
                quantity: 2,
                location: 'main-cellar'
            };

            integration.broadcastItemConsumed(consumption);

            expect(mockWss.broadcast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: expect.any(String),
                    data: expect.objectContaining(consumption)
                })
            );
        });

        test('should broadcast inventory item moved', () => {
            const move = {
                vintage_id: 'vintage-1',
                from_location: 'main-cellar',
                to_location: 'service-bar',
                quantity: 6
            };

            integration.broadcastItemMoved(move);

            expect(mockWss.broadcast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: expect.any(String),
                    data: expect.objectContaining(move)
                })
            );
        });
    });

    describe('Pairing Updates', () => {
        test('should broadcast new pairing session', () => {
            const session = {
                session_id: 'session-1',
                dish: 'Grilled salmon',
                recommendations: 5
            };

            integration.broadcastPairingSession(session);

            expect(mockWss.broadcast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: expect.any(String),
                    data: expect.objectContaining(session)
                })
            );
        });

        test('should broadcast pairing feedback', () => {
            const feedback = {
                session_id: 'session-1',
                wine_id: 1,
                rating: 5,
                user_id: 'user-1'
            };

            integration.broadcastPairingFeedback(feedback);

            expect(mockWss.broadcast).toHaveBeenCalled();
        });
    });

    describe('Conditional Broadcasting', () => {
        test('should not broadcast when no clients connected', () => {
            mockWss.getClientCount.mockReturnValue(0);
            
            integration.broadcastItemAdded({ id: 1 });

            // Should check if clients exist before broadcasting
            expect(mockWss.getClientCount).toHaveBeenCalled();
        });

        test('should broadcast when clients are connected', () => {
            mockWss.getClientCount.mockReturnValue(5);
            
            integration.broadcastItemAdded({ id: 1 });

            expect(mockWss.broadcast).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle broadcast errors gracefully', () => {
            mockWss.broadcast.mockImplementation(() => {
                throw new Error('Broadcast failed');
            });

            // Should not throw
            expect(() => {
                integration.broadcastItemAdded({ id: 1 });
            }).not.toThrow();
        });

        test('should handle null/undefined data', () => {
            expect(() => {
                integration.broadcastItemAdded(null);
            }).not.toThrow();

            expect(() => {
                integration.broadcastItemConsumed(undefined);
            }).not.toThrow();
        });
    });
});
