# SommOS WebSocket Real-Time Sync Implementation

## Overview

This document describes the WebSocket implementation for real-time inventory updates in SommOS. The system provides instant synchronization of inventory changes across all connected clients, enabling real-time collaboration and updates.

## Architecture

### Backend Components

#### 1. WebSocket Server (`backend/core/websocket_server.js`)

- **Purpose**: Manages WebSocket connections and message broadcasting
- **Features**:
  - Client connection management with unique IDs
  - Room-based messaging (e.g., `inventory_updates`)
  - Heartbeat/ping-pong for connection health
  - Graceful connection handling and cleanup
  - Broadcasting to specific rooms or all clients

#### 2. WebSocket Integration Service (`backend/core/websocket_integration.js`)

- **Purpose**: Provides easy-to-use broadcasting methods for inventory operations
- **Features**:
  - Inventory update broadcasting
  - Inventory action broadcasting (add, remove, move)
  - System notification broadcasting
  - Connection statistics and health monitoring

#### 3. Inventory Manager Integration

- **Purpose**: Automatically broadcasts inventory changes via WebSocket
- **Integration Points**:
  - `addWineToInventory()` - broadcasts new item additions
  - `updateStock()` - broadcasts quantity changes
  - Future: move operations, deletions, etc.

### Frontend Components

#### 1. RealTimeSync Class (`frontend/js/realtime-sync.js`)

- **Purpose**: WebSocket client for real-time updates
- **Features**:
  - Automatic reconnection with exponential backoff
  - Event-driven architecture with custom event handlers
  - Room management (join/leave)
  - Heartbeat management
  - Connection state monitoring

#### 2. SommOS App Integration (`frontend/js/app.js`)

- **Purpose**: Integrates real-time updates with the main application
- **Features**:
  - Automatic WebSocket connection on app initialization
  - Real-time inventory update handling
  - UI notifications for inventory changes
  - View refresh on relevant updates

## Message Types

### Connection Messages

```javascript
// Connection established
{
  type: 'connection_established',
  clientId: 'client_1234567890_abc123',
  timestamp: '2024-01-15T10:30:00.000Z',
  serverInfo: {
    version: '1.0.0',
    maxClients: 1000,
    heartbeatInterval: 30000
  }
}

// Room joined
{
  type: 'room_joined',
  room: 'inventory_updates',
  timestamp: '2024-01-15T10:30:00.000Z'
}
```

### Inventory Messages

```javascript
// Inventory update
{
  type: 'inventory_update',
  data: {
    type: 'update',
    item: {
      id: 123,
      name: 'Château Margaux 2015',
      vintage_year: 2015,
      location: 'Cellar A',
      quantity: 12,
      wine_id: 45,
      vintage_id: 67
    },
    changes: { quantity: 12 },
    userId: 'user_123',
    timestamp: '2024-01-15T10:30:00.000Z'
  },
  timestamp: '2024-01-15T10:30:00.000Z'
}

// Inventory action
{
  type: 'inventory_action',
  data: {
    type: 'add',
    item: {
      id: 124,
      name: 'Dom Pérignon 2013',
      vintage_year: 2013,
      location: 'Cellar B',
      quantity: 6
    },
    userId: 'user_456',
    timestamp: '2024-01-15T10:30:00.000Z'
  },
  timestamp: '2024-01-15T10:30:00.000Z'
}
```

### System Messages

```javascript
// System notification
{
  type: 'system_notification',
  data: {
    type: 'maintenance',
    message: 'Scheduled maintenance in 30 minutes',
    scheduledTime: '2024-01-15T11:00:00.000Z',
    timestamp: '2024-01-15T10:30:00.000Z'
  },
  timestamp: '2024-01-15T10:30:00.000Z'
}
```

## Usage Examples

### Backend Broadcasting

```javascript
const { webSocketIntegration } = require('./core/websocket_integration');

// Broadcast new item addition
webSocketIntegration.broadcastItemAdded({
  id: 123,
  name: 'Château Margaux 2015',
  vintage_year: 2015,
  location: 'Cellar A',
  quantity: 12
}, 'user_123');

// Broadcast stock update
webSocketIntegration.broadcastItemUpdated({
  id: 123,
  name: 'Château Margaux 2015',
  location: 'Cellar A',
  quantity: 10,
  quantityChange: -2
}, { quantity: 10, quantityChange: -2 }, 'user_456');

// Broadcast system notification
webSocketIntegration.broadcastMaintenanceNotification(
  'Scheduled maintenance in 30 minutes',
  '2024-01-15T11:00:00.000Z'
);
```

### Frontend Usage

```javascript
import { RealTimeSync } from './js/realtime-sync.js';

const realtimeSync = new RealTimeSync({
  onInventoryUpdate: (update) => {
    console.log('Inventory updated:', update);
    // Update UI, refresh views, etc.
  },
  onInventoryAction: (action) => {
    console.log('Inventory action:', action);
    // Handle add/remove/move operations
  },
  onSystemNotification: (notification) => {
    console.log('System notification:', notification);
    // Show notifications to user
  }
});

// Join additional rooms
realtimeSync.joinRoom('procurement_updates');
realtimeSync.joinRoom('pairing_recommendations');
```

## Configuration

### Server Configuration

```javascript
// In server.js
const wsServer = new SommOSWebSocketServer(server, {
  maxClients: 1000,
  heartbeatTimeout: 30000,
  allowedOrigins: ['http://localhost:3000', 'https://sommos.yacht']
});
```

### Client Configuration

```javascript
const realtimeSync = new RealTimeSync({
  url: 'ws://localhost:3001/api/ws',
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  heartbeatTimeout: 30000
});
```

## Testing

### Automated Tests

```bash
# Run WebSocket tests
npm test -- __tests__/websocket.test.js
```

### Manual Testing

```bash
# Start the demo script
node scripts/demo-websocket.js

# Or open the test page
open frontend/websocket-test.html
```

### Test Page Features

- Real-time connection status
- Message logging
- Connection statistics
- Manual ping/pong testing
- Multiple client simulation

## Security Considerations

1. **Origin Verification**: WebSocket connections are verified against allowed origins
2. **Rate Limiting**: Built-in rate limiting for WebSocket connections
3. **Authentication**: Future enhancement - JWT token verification for WebSocket connections
4. **Message Validation**: All incoming messages are validated and sanitized

## Performance Considerations

1. **Connection Limits**: Maximum 1000 concurrent connections
2. **Message Batching**: Future enhancement for bulk operations
3. **Room Management**: Efficient room-based broadcasting
4. **Memory Management**: Automatic cleanup of disconnected clients
5. **Heartbeat Optimization**: Configurable heartbeat intervals

## Monitoring and Debugging

### Connection Statistics

```javascript
const stats = wsServer.getStats();
console.log('Connected clients:', stats.totalClients);
console.log('Active rooms:', stats.totalRooms);
```

### Logging

- All WebSocket events are logged with appropriate levels
- Connection/disconnection events
- Message broadcasting statistics
- Error handling and recovery

## Future Enhancements

1. **Authentication**: JWT-based WebSocket authentication
2. **Message Persistence**: Store messages for offline clients
3. **Compression**: Message compression for large payloads
4. **Clustering**: Multi-server WebSocket support
5. **Analytics**: Real-time usage analytics and monitoring
6. **Custom Events**: User-defined event types and handlers

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check if server is running
   - Verify WebSocket URL and port
   - Check firewall settings

2. **Messages Not Received**
   - Verify room membership
   - Check message format
   - Monitor connection state

3. **Frequent Disconnections**
   - Check network stability
   - Verify heartbeat configuration
   - Monitor server resources

### Debug Mode

```javascript
// Enable debug logging
const realtimeSync = new RealTimeSync({
  debug: true,
  onConnect: () => console.log('Connected'),
  onDisconnect: () => console.log('Disconnected'),
  onError: (error) => console.error('Error:', error)
});
```

## API Reference

### WebSocket Server Methods

- `broadcastInventoryUpdate(update)` - Broadcast inventory update
- `broadcastInventoryAction(action)` - Broadcast inventory action
- `broadcastSystemNotification(notification)` - Broadcast system notification
- `getStats()` - Get connection statistics
- `close()` - Close server and all connections

### RealTimeSync Methods

- `connect()` - Establish WebSocket connection
- `disconnect()` - Close WebSocket connection
- `joinRoom(roomName)` - Join a room
- `leaveRoom(roomName)` - Leave a room
- `send(message)` - Send custom message
- `ping()` - Send ping message
- `getConnectionState()` - Get connection state
- `destroy()` - Clean up resources

This implementation provides a robust foundation for real-time inventory synchronization in SommOS, enabling seamless collaboration and instant updates across all connected clients.
