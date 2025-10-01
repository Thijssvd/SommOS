// SommOS Real-Time Sync Service
// WebSocket client for real-time inventory updates

export class RealTimeSync {
    constructor(options = {}) {
        this.ws = null;
        this.url = options.url || this.getWebSocketUrl();
        this.reconnectInterval = options.reconnectInterval || 5000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.isConnected = false;
        this.clientId = null;
        this.rooms = new Set();
        this.eventHandlers = new Map();
        this.heartbeatInterval = null;
        this.heartbeatTimeout = 30000; // 30 seconds
        this.lastPing = Date.now();
        
        // Event handlers
        this.onConnect = options.onConnect || null;
        this.onDisconnect = options.onDisconnect || null;
        this.onError = options.onError || null;
        this.onInventoryUpdate = options.onInventoryUpdate || null;
        this.onInventoryAction = options.onInventoryAction || null;
        this.onSystemNotification = options.onSystemNotification || null;
        
        this.init();
    }

    getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/api/ws`;
    }

    init() {
        this.connect();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseHeartbeat();
            } else {
                this.resumeHeartbeat();
                if (!this.isConnected) {
                    this.connect();
                }
            }
        });

        // Handle online/offline events
        window.addEventListener('online', () => {
            if (!this.isConnected) {
                this.connect();
            }
        });

        window.addEventListener('offline', () => {
            this.disconnect();
        });
    }

    connect() {
        if (this.isConnecting || this.isConnected) {
            return;
        }

        this.isConnecting = true;
        console.log('🔌 Connecting to WebSocket server...');

        try {
            this.ws = new WebSocket(this.url);
            this.setupWebSocketHandlers();
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.handleConnectionError(error);
        }
    }

    setupWebSocketHandlers() {
        this.ws.onopen = (event) => {
            console.log('🔌 WebSocket connected');
            this.isConnecting = false;
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.lastPing = Date.now();
            
            this.startHeartbeat();
            
            if (this.onConnect) {
                this.onConnect(event);
            }
            
            this.dispatchEvent('connect', { event });
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('🔌 WebSocket disconnected:', event.code, event.reason);
            this.isConnecting = false;
            this.isConnected = false;
            this.clientId = null;
            this.rooms.clear();
            
            this.stopHeartbeat();
            
            if (this.onDisconnect) {
                this.onDisconnect(event);
            }
            
            this.dispatchEvent('disconnect', { event });
            
            // Attempt to reconnect if not a clean close
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.handleConnectionError(error);
        };
    }

    handleMessage(message) {
        this.lastPing = Date.now();
        
        switch (message.type) {
            case 'connection_established':
                this.clientId = message.clientId;
                console.log('🔌 WebSocket connection established:', this.clientId);
                this.joinRoom('inventory_updates');
                break;
                
            case 'pong':
                // Heartbeat response
                break;
                
            case 'room_joined':
                this.rooms.add(message.room);
                console.log('🔌 Joined room:', message.room);
                break;
                
            case 'room_left':
                this.rooms.delete(message.room);
                console.log('🔌 Left room:', message.room);
                break;
                
            case 'inventory_update':
                this.handleInventoryUpdate(message.data);
                break;
                
            case 'inventory_action':
                this.handleInventoryAction(message.data);
                break;
                
            case 'system_notification':
                this.handleSystemNotification(message.data);
                break;
                
            case 'error':
                console.error('WebSocket server error:', message.message);
                break;
                
            default:
                console.warn('Unknown WebSocket message type:', message.type);
        }
        
        this.dispatchEvent('message', { message });
    }

    handleInventoryUpdate(update) {
        console.log('📦 Received inventory update:', update);
        
        if (this.onInventoryUpdate) {
            this.onInventoryUpdate(update);
        }
        
        this.dispatchEvent('inventory_update', { update });
        
        // Dispatch custom event for other parts of the app
        window.dispatchEvent(new CustomEvent('sommos:inventory-update', {
            detail: { update }
        }));
    }

    handleInventoryAction(action) {
        console.log('📦 Received inventory action:', action);
        
        if (this.onInventoryAction) {
            this.onInventoryAction(action);
        }
        
        this.dispatchEvent('inventory_action', { action });
        
        // Dispatch custom event for other parts of the app
        window.dispatchEvent(new CustomEvent('sommos:inventory-action', {
            detail: { action }
        }));
    }

    handleSystemNotification(notification) {
        console.log('🔔 Received system notification:', notification);
        
        if (this.onSystemNotification) {
            this.onSystemNotification(notification);
        }
        
        this.dispatchEvent('system_notification', { notification });
        
        // Dispatch custom event for other parts of the app
        window.dispatchEvent(new CustomEvent('sommos:system-notification', {
            detail: { notification }
        }));
    }

    handleConnectionError(error) {
        this.isConnecting = false;
        this.isConnected = false;
        
        if (this.onError) {
            this.onError(error);
        }
        
        this.dispatchEvent('error', { error });
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);
        
        console.log(`🔌 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
                this.connect();
            }
        }, delay);
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                this.ping();
            }
        }, this.heartbeatTimeout);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    pauseHeartbeat() {
        this.stopHeartbeat();
    }

    resumeHeartbeat() {
        if (this.isConnected) {
            this.startHeartbeat();
        }
    }

    ping() {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.send({
                type: 'ping',
                timestamp: Date.now()
            });
        }
    }

    send(message) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('Failed to send WebSocket message:', error);
                return false;
            }
        }
        return false;
    }

    joinRoom(roomName) {
        return this.send({
            type: 'join_room',
            room: roomName
        });
    }

    leaveRoom(roomName) {
        return this.send({
            type: 'leave_room',
            room: roomName
        });
    }

    getRooms() {
        return this.send({
            type: 'get_rooms'
        });
    }

    disconnect() {
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnecting');
            this.ws = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        this.clientId = null;
        this.rooms.clear();
    }

    // Event system
    addEventListener(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
    }

    removeEventListener(event, handler) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
        }
    }

    dispatchEvent(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    // Utility methods
    getConnectionState() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            clientId: this.clientId,
            rooms: Array.from(this.rooms),
            reconnectAttempts: this.reconnectAttempts,
            lastPing: this.lastPing
        };
    }

    isRoomJoined(roomName) {
        return this.rooms.has(roomName);
    }

    destroy() {
        this.disconnect();
        this.eventHandlers.clear();
    }
}