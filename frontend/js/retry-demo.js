// Demo script to showcase enhanced API retry functionality
// This demonstrates the various retry patterns and configurations available

import { SommOSAPI } from './api.js';

// Create API instance with custom retry configuration
const api = new SommOSAPI({
    retries: 3,
    retryDelay: 1000,
    jitter: true,
    timeout: 10000
});

// Demo 1: Basic retry functionality
async function demoBasicRetry() {
    console.log('=== Demo 1: Basic Retry Functionality ===');
    
    try {
        // This will use the built-in retry logic with exponential backoff
        const result = await api.request('/system/health');
        console.log('Health check successful:', result);
    } catch (error) {
        console.log('Health check failed after retries:', error.message);
    }
}

// Demo 2: Simple requestWithRetry method (as shown in user code snippet)
async function demoSimpleRetry() {
    console.log('\n=== Demo 2: Simple requestWithRetry Method ===');
    
    try {
        // This uses the simple retry method with exponential backoff
        const result = await api.requestWithRetry('/system/health', {}, 3);
        console.log('Simple retry successful:', result);
    } catch (error) {
        console.log('Simple retry failed:', error.message);
    }
}

// Demo 3: Custom retry configuration
async function demoCustomRetry() {
    console.log('\n=== Demo 3: Custom Retry Configuration ===');
    
    try {
        // Custom retry config with more aggressive retry settings
        const result = await api.requestWithCustomRetry('/system/health', {}, {
            retries: 5,
            retryDelay: 500,
            jitter: false
        });
        console.log('Custom retry successful:', result);
    } catch (error) {
        console.log('Custom retry failed:', error.message);
    }
}

// Demo 4: Circuit breaker pattern
async function demoCircuitBreaker() {
    console.log('\n=== Demo 4: Circuit Breaker Pattern ===');
    
    try {
        // Circuit breaker with low failure threshold for demo
        const result = await api.requestWithCircuitBreaker('/system/health', {}, {
            failureThreshold: 2,
            resetTimeout: 5000 // 5 seconds
        });
        console.log('Circuit breaker request successful:', result);
    } catch (error) {
        console.log('Circuit breaker request failed:', error.message);
    }
}

// Demo 5: Retry metrics
async function demoRetryMetrics() {
    console.log('\n=== Demo 5: Retry Metrics ===');
    
    // Make a few requests to generate some metrics
    try {
        await api.request('/system/health');
        await api.request('/system/activity');
    } catch (error) {
        console.log('Some requests failed (expected for demo)');
    }
    
    // Display retry metrics
    const metrics = api.getRetryMetrics();
    console.log('Retry Metrics:', {
        totalRequests: metrics.totalRequests,
        totalRetries: metrics.totalRetries,
        retryRate: metrics.retryRate,
        retryAttempts: metrics.retryAttempts,
        lastRetryTime: metrics.lastRetryTime ? new Date(metrics.lastRetryTime).toISOString() : null
    });
}

// Demo 6: Batch requests with retry
async function demoBatchRequests() {
    console.log('\n=== Demo 6: Batch Requests with Retry ===');
    
    const requests = [
        { endpoint: '/system/health' },
        { endpoint: '/system/activity', options: { limit: 5 } },
        { endpoint: '/locations' }
    ];
    
    try {
        const results = await api.batchRequest(requests);
        console.log('Batch request results:', results.map((result, index) => ({
            endpoint: requests[index].endpoint,
            status: result.status,
            success: result.status === 'fulfilled'
        })));
    } catch (error) {
        console.log('Batch request failed:', error.message);
    }
}

// Demo 7: Disable retries for specific requests
async function demoNoRetry() {
    console.log('\n=== Demo 7: Disable Retries ===');
    
    try {
        // This request will not retry on failure
        const result = await api.requestWithoutRetry('/system/health');
        console.log('No-retry request successful:', result);
    } catch (error) {
        console.log('No-retry request failed (no retries attempted):', error.message);
    }
}

// Run all demos
async function runAllDemos() {
    console.log('🚀 Starting SommOS API Retry Logic Demo\n');
    
    await demoBasicRetry();
    await demoSimpleRetry();
    await demoCustomRetry();
    await demoCircuitBreaker();
    await demoRetryMetrics();
    await demoBatchRequests();
    await demoNoRetry();
    
    console.log('\n✅ Demo completed! Check the retry metrics above.');
    
    // Final metrics summary
    const finalMetrics = api.getRetryMetrics();
    console.log('\n📊 Final Retry Metrics Summary:');
    console.log(`Total Requests: ${finalMetrics.totalRequests}`);
    console.log(`Total Retries: ${finalMetrics.totalRetries}`);
    console.log(`Retry Rate: ${finalMetrics.retryRate}`);
}

// Export for use in other modules
export {
    demoBasicRetry,
    demoSimpleRetry,
    demoCustomRetry,
    demoCircuitBreaker,
    demoRetryMetrics,
    demoBatchRequests,
    demoNoRetry,
    runAllDemos
};

// Auto-run if this script is executed directly
if (typeof window !== 'undefined') {
    // Browser environment
    window.SommOSRetryDemo = {
        runAllDemos,
        api
    };
} else if (typeof module !== 'undefined' && require.main === module) {
    // Node.js environment
    runAllDemos().catch(console.error);
}