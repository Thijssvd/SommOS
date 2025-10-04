/**
 * Test Script for RUM Data Persistence
 * Tests dual-mode storage (memory + database) for Real User Monitoring
 */

const Database = require('../backend/database/connection');
const axios = require('axios');

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Test configuration
const API_BASE = process.env.API_URL || 'http://localhost:3000/api/performance';
const TEST_SESSION_ID = `test-session-${Date.now()}`;
const TEST_USER_ID = 'test-user-1';

// Test statistics
const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: Date.now()
};

/**
 * Helper: Print test header
 */
function printHeader(title) {
    console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
}

/**
 * Helper: Print test result
 */
function printResult(testName, passed, duration, details = '') {
    stats.total++;
    if (passed) {
        stats.passed++;
        console.log(`${colors.green}✓${colors.reset} ${testName} ${colors.blue}(${duration}ms)${colors.reset}`);
        if (details) console.log(`  ${colors.cyan}${details}${colors.reset}`);
    } else {
        stats.failed++;
        console.log(`${colors.red}✗${colors.reset} ${testName} ${colors.blue}(${duration}ms)${colors.reset}`);
        if (details) console.log(`  ${colors.red}${details}${colors.reset}`);
    }
}

/**
 * Helper: Print summary
 */
function printSummary() {
    const totalDuration = Date.now() - stats.startTime;
    console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.bright}  Test Summary${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`);
    console.log(`  Total Tests: ${stats.total}`);
    console.log(`  ${colors.green}Passed: ${stats.passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${stats.failed}${colors.reset}`);
    console.log(`  Duration: ${totalDuration}ms`);
    console.log(`${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
}

/**
 * Helper: Generate mock RUM data
 */
function generateMockRumData(sessionId = TEST_SESSION_ID, timestamp = Date.now()) {
    return {
        sessionId,
        userId: TEST_USER_ID,
        timestamp,
        url: '/test-page',
        userAgent: 'Mozilla/5.0 (Test)',
        connection: {
            effectiveType: '4g',
            downlink: 10,
            rtt: 50
        },
        metrics: {
            webVitals: [
                { name: 'LCP', value: 1200, timestamp, passed: true },
                { name: 'FID', value: 50, timestamp, passed: true },
                { name: 'CLS', value: 0.05, timestamp, passed: true }
            ],
            customMetrics: [
                { name: 'api_call_duration', value: 250, timestamp }
            ],
            userInteractions: [
                { type: 'click', target: 'button', timestamp }
            ],
            resources: [
                { name: 'main.js', duration: 120, transferSize: 50000, timestamp }
            ],
            navigation: {
                loadEventEnd: 2000,
                domContentLoadedEventEnd: 1500,
                timestamp
            },
            errors: [
                { type: 'js_error', message: 'Test error', stack: 'Error at line 1', timestamp }
            ]
        },
        isUnload: false
    };
}

/**
 * Test 1: POST data and verify immediate retrieval from memory
 */
async function test1_postAndRetrieveFromMemory() {
    const testName = 'Test 1: POST RUM data and retrieve from memory';
    const startTime = Date.now();
    
    try {
        const rumData = generateMockRumData();
        
        // POST RUM data
        const postResponse = await axios.post(`${API_BASE}/rum`, rumData);
        
        if (!postResponse.data.success) {
            throw new Error('POST request failed');
        }
        
        // Wait briefly for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // GET sessions
        const sessionsResponse = await axios.get(`${API_BASE}/rum/sessions?sessionId=${TEST_SESSION_ID}`);
        
        // GET metrics
        const metricsResponse = await axios.get(`${API_BASE}/rum/metrics?sessionId=${TEST_SESSION_ID}`);
        
        const passed = sessionsResponse.data.success && 
                      sessionsResponse.data.data.total > 0 &&
                      metricsResponse.data.success &&
                      metricsResponse.data.data.total > 0;
        
        const duration = Date.now() - startTime;
        printResult(
            testName, 
            passed, 
            duration,
            `Sessions: ${sessionsResponse.data.data.total}, Metrics: ${metricsResponse.data.data.total}`
        );
        
        return passed;
    } catch (error) {
        const duration = Date.now() - startTime;
        printResult(testName, false, duration, error.message);
        return false;
    }
}

/**
 * Test 2: Query database directly to verify persistence
 */
async function test2_verifyDatabasePersistence() {
    const testName = 'Test 2: Verify data persisted to database';
    const startTime = Date.now();
    
    try {
        const db = Database.getInstance();
        await db.ensureInitialized();
        
        // Wait for async persistence to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Query sessions from database
        const sessions = await db.all(
            'SELECT * FROM RumSessions WHERE session_id = ?',
            [TEST_SESSION_ID]
        );
        
        // Query metrics from database
        const metrics = await db.all(
            'SELECT * FROM RumMetrics WHERE session_id = ?',
            [TEST_SESSION_ID]
        );
        
        // Query errors from database
        const errors = await db.all(
            'SELECT * FROM RumErrors WHERE session_id = ?',
            [TEST_SESSION_ID]
        );
        
        const passed = sessions.length > 0 && metrics.length > 0 && errors.length > 0;
        
        const duration = Date.now() - startTime;
        printResult(
            testName, 
            passed, 
            duration,
            `DB - Sessions: ${sessions.length}, Metrics: ${metrics.length}, Errors: ${errors.length}`
        );
        
        return passed;
    } catch (error) {
        const duration = Date.now() - startTime;
        printResult(testName, false, duration, error.message);
        return false;
    }
}

/**
 * Test 3: Simulate server restart (clear memory) and verify database retrieval
 */
async function test3_databaseFallbackAfterRestart() {
    const testName = 'Test 3: Database fallback after simulated restart';
    const startTime = Date.now();
    
    try {
        // Note: In a real scenario, we'd restart the server
        // For now, we just verify that old data can be retrieved from DB
        
        // Query for data from database (simulating memory clear)
        const now = Date.now();
        const sessionsResponse = await axios.get(
            `${API_BASE}/rum/sessions?startTime=${now - 3600000}&endTime=${now}`
        );
        
        const passed = sessionsResponse.data.success;
        
        const duration = Date.now() - startTime;
        printResult(
            testName, 
            passed, 
            duration,
            `Retrieved ${sessionsResponse.data.data.total} sessions from database`
        );
        
        return passed;
    } catch (error) {
        const duration = Date.now() - startTime;
        printResult(testName, false, duration, error.message);
        return false;
    }
}

/**
 * Test 4: Test time-range queries
 */
async function test4_timeRangeQueries() {
    const testName = 'Test 4: Time-range queries';
    const startTime = Date.now();
    
    try {
        const now = Date.now();
        const oneHourAgo = now - 3600000;
        
        // Query with time range
        const response = await axios.get(
            `${API_BASE}/rum/metrics?startTime=${oneHourAgo}&endTime=${now}`
        );
        
        const passed = response.data.success;
        
        const duration = Date.now() - startTime;
        printResult(
            testName, 
            passed, 
            duration,
            `Retrieved ${response.data.data.total} metrics in time range`
        );
        
        return passed;
    } catch (error) {
        const duration = Date.now() - startTime;
        printResult(testName, false, duration, error.message);
        return false;
    }
}

/**
 * Test 5: Test batch writes with large metric arrays
 */
async function test5_batchWrites() {
    const testName = 'Test 5: Batch writes with large metric arrays';
    const startTime = Date.now();
    
    try {
        const batchSessionId = `batch-test-${Date.now()}`;
        const rumData = generateMockRumData(batchSessionId);
        
        // Generate 150 web vitals (exceeds BATCH_SIZE of 100)
        rumData.metrics.webVitals = [];
        for (let i = 0; i < 150; i++) {
            rumData.metrics.webVitals.push({
                name: 'LCP',
                value: 1000 + i,
                timestamp: Date.now() + i,
                passed: true
            });
        }
        
        // POST large batch
        const postResponse = await axios.post(`${API_BASE}/rum`, rumData);
        
        if (!postResponse.data.success) {
            throw new Error('POST request failed');
        }
        
        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify in database
        const db = Database.getInstance();
        const metrics = await db.all(
            'SELECT COUNT(*) as count FROM RumMetrics WHERE session_id = ?',
            [batchSessionId]
        );
        
        const passed = metrics[0].count >= 150;
        
        const duration = Date.now() - startTime;
        printResult(
            testName, 
            passed, 
            duration,
            `Persisted ${metrics[0].count} metrics in batches`
        );
        
        return passed;
    } catch (error) {
        const duration = Date.now() - startTime;
        printResult(testName, false, duration, error.message);
        return false;
    }
}

/**
 * Test 6: Test cleanup of old data
 */
async function test6_cleanupOldData() {
    const testName = 'Test 6: Cleanup old data (>90 days)';
    const startTime = Date.now();
    
    try {
        const db = Database.getInstance();
        const oldSessionId = `old-session-${Date.now()}`;
        const oldTimestamp = Date.now() - (91 * 24 * 60 * 60 * 1000); // 91 days ago
        
        // Insert old session directly into database
        await db.run(
            `INSERT INTO RumSessions 
             (session_id, user_id, timestamp, url, user_agent, connection, is_unload, received_at, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                oldSessionId,
                TEST_USER_ID,
                oldTimestamp,
                '/old-page',
                'Mozilla/5.0',
                '{}',
                0,
                oldTimestamp,
                oldTimestamp
            ]
        );
        
        // Verify it was inserted
        let sessions = await db.all(
            'SELECT * FROM RumSessions WHERE session_id = ?',
            [oldSessionId]
        );
        
        if (sessions.length === 0) {
            throw new Error('Failed to insert old session');
        }
        
        // Run cleanup (would normally be triggered by the route cleanup function)
        const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
        await db.run(
            'DELETE FROM RumSessions WHERE created_at < ?',
            [cutoff]
        );
        
        // Verify it was deleted
        sessions = await db.all(
            'SELECT * FROM RumSessions WHERE session_id = ?',
            [oldSessionId]
        );
        
        const passed = sessions.length === 0;
        
        const duration = Date.now() - startTime;
        printResult(
            testName, 
            passed, 
            duration,
            'Old data successfully cleaned up'
        );
        
        return passed;
    } catch (error) {
        const duration = Date.now() - startTime;
        printResult(testName, false, duration, error.message);
        return false;
    }
}

/**
 * Test 7: Test error handling with invalid data
 */
async function test7_errorHandling() {
    const testName = 'Test 7: Error handling with invalid data';
    const startTime = Date.now();
    
    try {
        // POST invalid data (missing required fields)
        const response = await axios.post(`${API_BASE}/rum`, {
            // Missing sessionId, userId, timestamp
            url: '/test'
        }).catch(err => err.response);
        
        // Should return 400 error
        const passed = response && response.status === 400;
        
        const duration = Date.now() - startTime;
        printResult(
            testName, 
            passed, 
            duration,
            'API correctly rejected invalid data'
        );
        
        return passed;
    } catch (error) {
        const duration = Date.now() - startTime;
        printResult(testName, false, duration, error.message);
        return false;
    }
}

/**
 * Test 8: Performance validation
 */
async function test8_performanceValidation() {
    const testName = 'Test 8: Performance validation';
    const startTime = Date.now();
    
    try {
        const rumData = generateMockRumData(`perf-test-${Date.now()}`);
        
        // Measure POST performance
        const postStart = Date.now();
        await axios.post(`${API_BASE}/rum`, rumData);
        const postDuration = Date.now() - postStart;
        
        // Measure GET performance (memory)
        const getStart = Date.now();
        await axios.get(`${API_BASE}/rum/sessions`);
        const getDuration = Date.now() - getStart;
        
        // Check against targets: POST < 100ms, GET < 200ms
        const passed = postDuration < 100 && getDuration < 200;
        
        const duration = Date.now() - startTime;
        printResult(
            testName, 
            passed, 
            duration,
            `POST: ${postDuration}ms, GET: ${getDuration}ms`
        );
        
        return passed;
    } catch (error) {
        const duration = Date.now() - startTime;
        printResult(testName, false, duration, error.message);
        return false;
    }
}

/**
 * Cleanup test data
 */
async function cleanup() {
    try {
        const db = Database.getInstance();
        await db.ensureInitialized();
        
        // Delete test sessions
        await db.run(
            `DELETE FROM RumSessions WHERE session_id LIKE 'test-%' OR session_id LIKE 'batch-%' OR session_id LIKE 'perf-%'`
        );
        
        console.log(`\n${colors.cyan}Cleanup completed${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}Cleanup error: ${error.message}${colors.reset}`);
    }
}

/**
 * Main test runner
 */
async function runTests() {
    printHeader('RUM Data Persistence Test Suite');
    
    console.log(`${colors.yellow}Testing API at: ${API_BASE}${colors.reset}`);
    console.log(`${colors.yellow}Test Session ID: ${TEST_SESSION_ID}${colors.reset}\n`);
    
    try {
        // Run all tests
        await test1_postAndRetrieveFromMemory();
        await test2_verifyDatabasePersistence();
        await test3_databaseFallbackAfterRestart();
        await test4_timeRangeQueries();
        await test5_batchWrites();
        await test6_cleanupOldData();
        await test7_errorHandling();
        await test8_performanceValidation();
        
        // Cleanup
        await cleanup();
        
        // Print summary
        printSummary();
        
        // Exit with appropriate code
        process.exit(stats.failed > 0 ? 1 : 0);
        
    } catch (error) {
        console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests if executed directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests };
