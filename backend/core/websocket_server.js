// SommOS WebSocket Server
// Real-time inventory updates and synchronization

const WebSocket = require('ws');
const { getConfig } = require('../config/env');
const Database = require('../database/connection');

class SommOSWebSocketServer {
    constructor(server) {
        this.server = server;
        this.wss = null;
        this.clients = new Map(); // Map of client ID to WebSocket connection
        this.rooms = new Map(); // Map of room name to Set of client IDs
        this.config = getConfig();
        this.heartbeatInterval = null;
        this.heartbeatTimeout = 30000; // 30 seconds
        this.maxClients = 1000;
        
        this.init();
    }

    init() {
        this.wss = new WebSocket.Server({ 
            server: this.server,
            path: '/api/ws',
            verifyClient: this.verifyClient.bind(this)
        });

        this.wss.on('connection', this.handleConnection.bind(this));
        this.startHeartbeat();
        
        console.log('🔌 WebSocket server initialized on /api/ws');
    }

    verifyClient(info) {
        // Basic verification - in production, you might want to verify JWT tokens
        const origin = info.origin;
        const allowedOrigins = this.config.isProduction 
            ? ['https://sommos.yacht'] 
            : ['http://localhost:3000', 'http://127.0.0.1:3000'];
        
        return allowedOrigins.includes(origin);
    }

    handleConnection(ws, req) {
        const clientId = this.generateClientId();
        const clientInfo = {
            id: clientId,
            ws: ws,
            ip: req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            connectedAt: new Date(),
            lastPing: Date.now(),
            rooms: new Set(),
            isAlive: true
        };

        this.clients.set(clientId, clientInfo);
        
        console.log(`🔌 WebSocket client connected: ${clientId} from ${clientInfo.ip}`);

        // Send welcome message
        this.sendToClient(clientId, {
            type: 'connection_established',
            clientId: clientId,
            timestamp: new Date().toISOString(),
            serverInfo: {
                version: this.config.app.version,
                maxClients: this.maxClients,
                heartbeatInterval: this.heartbeatTimeout
            }
        });

        // Set up event handlers
        ws.on('message', (data) => this.handleMessage(clientId, data));
        ws.on('close', () => this.handleDisconnection(clientId));
        ws.on('error', (error) => this.handleError(clientId, error));
        ws.on('pong', () => this.handlePong(clientId));

        // Join default room for inventory updates
        this.joinRoom(clientId, 'inventory_updates');
    }

    handleMessage(clientId, data) {
        try {
            const message = JSON.parse(data.toString());
            const client = this.clients.get(clientId);
            
            if (!client) {
                console.warn(`Received message from unknown client: ${clientId}`);
                return;
            }

            client.lastPing = Date.now();

            switch (message.type) {
                case 'ping':
                    this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
                    break;
                
                case 'join_room':
                    if (message.room) {
                        this.joinRoom(clientId, message.room);
                    }
                    break;
                
                case 'leave_room':
                    if (message.room) {
                        this.leaveRoom(clientId, message.room);
                    }
                    break;
                
                case 'get_rooms':
                    this.sendToClient(clientId, {
                        type: 'rooms_list',
                        rooms: Array.from(client.rooms)
                    });
                    break;
                
                default:
                    console.warn(`Unknown message type from client ${clientId}:`, message.type);
            }
        } catch (error) {
            console.error(`Error handling message from client ${clientId}:`, error);
            this.sendToClient(clientId, {
                type: 'error',
                message: 'Invalid message format'
            });
        }
    }

    handleDisconnection(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            console.log(`🔌 WebSocket client disconnected: ${clientId}`);
            
            // Remove from all rooms
            client.rooms.forEach(room => {
                this.leaveRoom(clientId, room);
            });
            
            this.clients.delete(clientId);
        }
    }

    handleError(clientId, error) {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleDisconnection(clientId);
    }

    handlePong(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.isAlive = true;
            client.lastPing = Date.now();
        }
    }

    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    joinRoom(clientId, roomName) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.rooms.add(roomName);
        
        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
        }
        
        this.rooms.get(roomName).add(clientId);
        
        console.log(`Client ${clientId} joined room: ${roomName}`);
        
        this.sendToClient(clientId, {
            type: 'room_joined',
            room: roomName,
            timestamp: new Date().toISOString()
        });
    }

    leaveRoom(clientId, roomName) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.rooms.delete(roomName);
        
        const room = this.rooms.get(roomName);
        if (room) {
            room.delete(clientId);
            if (room.size === 0) {
                this.rooms.delete(roomName);
            }
        }
        
        console.log(`Client ${clientId} left room: ${roomName}`);
        
        this.sendToClient(clientId, {
            type: 'room_left',
            room: roomName,
            timestamp: new Date().toISOString()
        });
    }

    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            client.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error(`Error sending message to client ${clientId}:`, error);
            this.handleDisconnection(clientId);
            return false;
        }
    }

    broadcastToRoom(roomName, message, excludeClientId = null) {
        const room = this.rooms.get(roomName);
        if (!room) return 0;

        let sentCount = 0;
        const deadClients = [];

        room.forEach(clientId => {
            if (excludeClientId && clientId === excludeClientId) return;
            
            if (this.sendToClient(clientId, message)) {
                sentCount++;
            } else {
                deadClients.push(clientId);
            }
        });

        // Clean up dead clients
        deadClients.forEach(clientId => {
            room.delete(clientId);
            const client = this.clients.get(clientId);
            if (client) {
                client.rooms.delete(roomName);
            }
        });

        return sentCount;
    }

    broadcastToAll(message, excludeClientId = null) {
        let sentCount = 0;
        const deadClients = [];

        this.clients.forEach((client, clientId) => {
            if (excludeClientId && clientId === excludeClientId) return;
            
            if (this.sendToClient(clientId, message)) {
                sentCount++;
            } else {
                deadClients.push(clientId);
            }
        });

        // Clean up dead clients
        deadClients.forEach(clientId => {
            this.handleDisconnection(clientId);
        });

        return sentCount;
    }

    // Inventory-specific methods
    broadcastInventoryUpdate(update) {
        const message = {
            type: 'inventory_update',
            data: update,
            timestamp: new Date().toISOString()
        };

        const sentCount = this.broadcastToRoom('inventory_updates', message);
        console.log(`📦 Broadcasted inventory update to ${sentCount} clients`);
        return sentCount;
    }

    broadcastInventoryAction(action) {
        const message = {
            type: 'inventory_action',
            data: action,
            timestamp: new Date().toISOString()
        };

        const sentCount = this.broadcastToRoom('inventory_updates', message);
        console.log(`📦 Broadcasted inventory action to ${sentCount} clients`);
        return sentCount;
    }

    broadcastSystemNotification(notification) {
        const message = {
            type: 'system_notification',
            data: notification,
            timestamp: new Date().toISOString()
        };

        const sentCount = this.broadcastToAll(message);
        console.log(`🔔 Broadcasted system notification to ${sentCount} clients`);
        return sentCount;
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            const deadClients = [];

            this.clients.forEach((client, clientId) => {
                if (now - client.lastPing > this.heartbeatTimeout) {
                    console.log(`Client ${clientId} timed out, disconnecting`);
                    deadClients.push(clientId);
                } else if (client.ws.readyState === WebSocket.OPEN) {
                    client.isAlive = false;
                    client.ws.ping();
                }
            });

            deadClients.forEach(clientId => {
                this.handleDisconnection(clientId);
            });
        }, this.heartbeatTimeout);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    getStats() {
        return {
            totalClients: this.clients.size,
            totalRooms: this.rooms.size,
            rooms: Array.from(this.rooms.entries()).map(([name, clients]) => ({
                name,
                clientCount: clients.size
            })),
            maxClients: this.maxClients
        };
    }

    close() {
        this.stopHeartbeat();
        
        // Close all client connections
        this.clients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.close(1000, 'Server shutting down');
            }
        });
        
        this.clients.clear();
        this.rooms.clear();
        
        if (this.wss) {
            this.wss.close();
        }
        
        console.log('🔌 WebSocket server closed');
    }
}

module.exports = SommOSWebSocketServer;