#!/usr/bin/env node

/**
 * SommOS WebSocket Demo Script
 * Demonstrates real-time inventory updates via WebSocket
 */

const WebSocket = require('ws');
const http = require('http');

// Configuration
const PORT = process.env.PORT || 3001;
const WS_URL = `ws://localhost:${PORT}/api/ws`;

class WebSocketDemo {
    constructor() {
        this.ws = null;
        this.messageCount = 0;
        this.startTime = Date.now();
    }

    connect() {
        console.log(`🔌 Connecting to WebSocket server at ${WS_URL}...`);
        
        this.ws = new WebSocket(WS_URL);
        
        this.ws.on('open', () => {
            console.log('✅ WebSocket connected successfully');
            this.startDemo();
        });

        this.ws.on('message', (data) => {
            this.messageCount++;
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
        });

        this.ws.on('close', (code, reason) => {
            console.log(`🔌 WebSocket disconnected (${code}): ${reason}`);
            this.showStats();
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
        });
    }

    handleMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        
        switch (message.type) {
            case 'connection_established':
                console.log(`🔌 Connection established with client ID: ${message.clientId}`);
                break;
                
            case 'room_joined':
                console.log(`🏠 Joined room: ${message.room}`);
                break;
                
            case 'inventory_update':
                console.log(`📦 [${timestamp}] Inventory Update:`);
                console.log(`   Item: ${message.data.item?.name || 'Unknown'}`);
                console.log(`   Location: ${message.data.item?.location || 'Unknown'}`);
                console.log(`   Quantity: ${message.data.item?.quantity || 'Unknown'}`);
                break;
                
            case 'inventory_action':
                console.log(`📦 [${timestamp}] Inventory Action: ${message.data.type}`);
                console.log(`   Item: ${message.data.item?.name || message.data.itemId || 'Unknown'}`);
                if (message.data.newLocation) {
                    console.log(`   New Location: ${message.data.newLocation}`);
                }
                break;
                
            case 'system_notification':
                console.log(`🔔 [${timestamp}] System Notification: ${message.data.message}`);
                break;
                
            case 'pong':
                console.log(`🏓 Pong received`);
                break;
                
            default:
                console.log(`📨 [${timestamp}] Unknown message type: ${message.type}`);
        }
    }

    startDemo() {
        console.log('\n🚀 Starting WebSocket demo...');
        console.log('This demo will:');
        console.log('1. Join the inventory_updates room');
        console.log('2. Send periodic ping messages');
        console.log('3. Listen for real-time inventory updates');
        console.log('4. Show connection statistics\n');

        // Join inventory updates room
        this.sendMessage({
            type: 'join_room',
            room: 'inventory_updates'
        });

        // Send periodic pings
        this.pingInterval = setInterval(() => {
            this.sendMessage({
                type: 'ping',
                timestamp: Date.now()
            });
        }, 30000); // Every 30 seconds

        // Show stats every 10 seconds
        this.statsInterval = setInterval(() => {
            this.showStats();
        }, 10000);

        // Simulate some demo messages after a delay
        setTimeout(() => {
            console.log('\n📝 Demo: Simulating inventory operations...');
            this.simulateInventoryOperations();
        }, 5000);
    }

    simulateInventoryOperations() {
        // This would normally be triggered by actual inventory operations
        // For demo purposes, we'll just show what messages would look like
        console.log('💡 In a real scenario, these messages would be sent by the server when:');
        console.log('   - New wines are added to inventory');
        console.log('   - Stock quantities are updated');
        console.log('   - Items are moved between locations');
        console.log('   - Inventory is received from suppliers');
        console.log('   - Wines are served or consumed');
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    showStats() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        console.log(`\n📊 Connection Stats:`);
        console.log(`   Uptime: ${uptime}s`);
        console.log(`   Messages received: ${this.messageCount}`);
        console.log(`   Connection state: ${this.ws ? this.ws.readyState : 'disconnected'}`);
    }

    disconnect() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down WebSocket demo...');
    if (global.demo) {
        global.demo.disconnect();
    }
    process.exit(0);
});

// Start the demo
console.log('🍷 SommOS WebSocket Demo');
console.log('========================\n');

const demo = new WebSocketDemo();
global.demo = demo;

// Check if server is running
const checkServer = () => {
    const req = http.get(`http://localhost:${PORT}/health`, (res) => {
        if (res.statusCode === 200) {
            console.log(`✅ Server is running on port ${PORT}`);
            demo.connect();
        } else {
            console.log(`⚠️  Server responded with status ${res.statusCode}`);
            demo.connect(); // Try anyway
        }
    });

    req.on('error', (error) => {
        console.error(`❌ Cannot connect to server on port ${PORT}`);
        console.error('   Make sure the SommOS server is running:');
        console.error('   npm start');
        process.exit(1);
    });
};

checkServer();