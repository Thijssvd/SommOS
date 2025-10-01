// SommOS WebSocket Integration Service
// Provides WebSocket broadcasting capabilities for inventory updates

class WebSocketIntegration {
    constructor(app = null) {
        this.app = app;
        this.wsServer = null;
    }

    setApp(app) {
        this.app = app;
        this.wsServer = app.locals.wsServer;
    }

    getWebSocketServer() {
        return this.wsServer;
    }

    isWebSocketAvailable() {
        return this.wsServer && typeof this.wsServer.broadcastInventoryUpdate === 'function';
    }

    // Inventory update broadcasting methods
    broadcastInventoryUpdate(update) {
        if (!this.isWebSocketAvailable()) {
            console.warn('WebSocket server not available for inventory update broadcast');
            return 0;
        }

        try {
            return this.wsServer.broadcastInventoryUpdate(update);
        } catch (error) {
            console.error('Failed to broadcast inventory update:', error);
            return 0;
        }
    }

    broadcastInventoryAction(action) {
        if (!this.isWebSocketAvailable()) {
            console.warn('WebSocket server not available for inventory action broadcast');
            return 0;
        }

        try {
            return this.wsServer.broadcastInventoryAction(action);
        } catch (error) {
            console.error('Failed to broadcast inventory action:', error);
            return 0;
        }
    }

    broadcastSystemNotification(notification) {
        if (!this.isWebSocketAvailable()) {
            console.warn('WebSocket server not available for system notification broadcast');
            return 0;
        }

        try {
            return this.wsServer.broadcastSystemNotification(notification);
        } catch (error) {
            console.error('Failed to broadcast system notification:', error);
            return 0;
        }
    }

    // Specific inventory event methods
    broadcastItemAdded(item, userId = null) {
        const action = {
            type: 'add',
            item: item,
            userId: userId,
            timestamp: new Date().toISOString()
        };
        return this.broadcastInventoryAction(action);
    }

    broadcastItemUpdated(item, changes = {}, userId = null) {
        const update = {
            type: 'update',
            item: item,
            changes: changes,
            userId: userId,
            timestamp: new Date().toISOString()
        };
        return this.broadcastInventoryUpdate(update);
    }

    broadcastItemRemoved(itemId, itemName = null, userId = null) {
        const action = {
            type: 'remove',
            itemId: itemId,
            itemName: itemName,
            userId: userId,
            timestamp: new Date().toISOString()
        };
        return this.broadcastInventoryAction(action);
    }

    broadcastItemMoved(itemId, fromLocation, toLocation, userId = null) {
        const action = {
            type: 'move',
            itemId: itemId,
            fromLocation: fromLocation,
            newLocation: toLocation,
            userId: userId,
            timestamp: new Date().toISOString()
        };
        return this.broadcastInventoryAction(action);
    }

    broadcastInventoryBulkUpdate(updates = [], userId = null) {
        const update = {
            type: 'bulk_update',
            updates: updates,
            userId: userId,
            timestamp: new Date().toISOString()
        };
        return this.broadcastInventoryUpdate(update);
    }

    broadcastInventorySync(syncData = {}, userId = null) {
        const update = {
            type: 'sync',
            syncData: syncData,
            userId: userId,
            timestamp: new Date().toISOString()
        };
        return this.broadcastInventoryUpdate(update);
    }

    // System notification methods
    broadcastMaintenanceNotification(message, scheduledTime = null) {
        const notification = {
            type: 'maintenance',
            message: message,
            scheduledTime: scheduledTime,
            timestamp: new Date().toISOString()
        };
        return this.broadcastSystemNotification(notification);
    }

    broadcastSecurityNotification(message, severity = 'info') {
        const notification = {
            type: 'security',
            message: message,
            severity: severity,
            timestamp: new Date().toISOString()
        };
        return this.broadcastSystemNotification(notification);
    }

    broadcastUpdateNotification(message, version = null) {
        const notification = {
            type: 'update',
            message: message,
            version: version,
            timestamp: new Date().toISOString()
        };
        return this.broadcastSystemNotification(notification);
    }

    // Utility methods
    getConnectionStats() {
        if (!this.isWebSocketAvailable()) {
            return null;
        }

        try {
            return this.wsServer.getStats();
        } catch (error) {
            console.error('Failed to get WebSocket stats:', error);
            return null;
        }
    }

    isConnected() {
        return this.isWebSocketAvailable() && this.wsServer.clients.size > 0;
    }

    getConnectedClientsCount() {
        if (!this.isWebSocketAvailable()) {
            return 0;
        }

        return this.wsServer.clients.size;
    }
}

// Create a singleton instance
const webSocketIntegration = new WebSocketIntegration();

module.exports = {
    WebSocketIntegration,
    webSocketIntegration
};