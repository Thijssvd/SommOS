# SommOS API Client Retry Logic

This document describes the comprehensive retry logic and resilience patterns implemented in the SommOS API client.

## Overview

The SommOS API client includes sophisticated retry mechanisms designed to handle network failures, server errors, and rate limiting gracefully. The implementation follows industry best practices for resilient API communication.

## Features

### 🔄 Automatic Retry with Exponential Backoff
- **Exponential backoff**: Delays increase exponentially (1s, 2s, 4s, 8s...)
- **Jitter**: Random variation (±25%) to prevent thundering herd problems
- **Maximum delay cap**: 10 seconds to prevent excessive wait times
- **Minimum delay**: 100ms to ensure reasonable responsiveness

### 🎯 Smart Retry Conditions
The client automatically retries on:
- **Network errors**: Connection failures, timeouts, DNS issues
- **5xx server errors**: Internal server errors, service unavailable
- **429 rate limiting**: Too many requests
- **408 timeout**: Request timeout from server

### 📊 Retry Metrics and Monitoring
- Track total requests and retry attempts
- Monitor retry rates by endpoint
- Record last retry timestamps
- Calculate retry success rates

### 🔧 Configurable Retry Behavior
- Customizable retry counts per request
- Adjustable base delay times
- Optional jitter control
- Per-request retry configuration

### 🛡️ Circuit Breaker Pattern
- Automatic failure detection
- Circuit opening on repeated failures
- Configurable failure thresholds
- Automatic circuit reset after timeout

## Usage Examples

### Basic Usage

```javascript
import { SommOSAPI } from './js/api.js';

// Create API instance with default retry configuration
const api = new SommOSAPI();

// All requests automatically include retry logic
const result = await api.request('/system/health');
```

### Custom Retry Configuration

```javascript
// Create API with custom retry settings
const api = new SommOSAPI({
    retries: 5,           // 5 retry attempts
    retryDelay: 2000,     // 2 second base delay
    jitter: false,        // Disable jitter
    timeout: 15000        // 15 second timeout
});
```

### Simple Retry Method (User Code Snippet)

```javascript
// Simple retry method as shown in user code snippet
async requestWithRetry(endpoint, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await this.request(endpoint, options);
        } catch (error) {
            if (i === retries - 1) throw error;
            await this.delay(Math.pow(2, i) * 1000); // Exponential backoff
        }
    }
}

// Usage
const result = await api.requestWithRetry('/data', {}, 3);
```

### Per-Request Customization

```javascript
// Disable retries for specific requests
await api.requestWithoutRetry('/health');

// Custom retry configuration for specific requests
await api.requestWithCustomRetry('/data', {}, {
    retries: 1,
    retryDelay: 500,
    jitter: false
});
```

### Circuit Breaker Pattern

```javascript
// Use circuit breaker for unstable endpoints
await api.requestWithCircuitBreaker('/unstable-endpoint', {}, {
    failureThreshold: 3,    // Open circuit after 3 failures
    resetTimeout: 60000,    // Reset after 1 minute
    monitorWindow: 300000   // Monitor failures over 5 minutes
});
```

### Batch Requests

```javascript
// Batch multiple requests with retry logic
const requests = [
    { endpoint: '/system/health' },
    { endpoint: '/system/activity', options: { limit: 10 } },
    { endpoint: '/locations' }
];

const results = await api.batchRequest(requests);
```

### Retry Metrics

```javascript
// Get retry statistics
const metrics = api.getRetryMetrics();
console.log(`Retry rate: ${metrics.retryRate}`);
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Total retries: ${metrics.totalRetries}`);

// Reset metrics
api.resetRetryMetrics();
```

## Configuration Options

### Global Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `retries` | number | 3 | Maximum number of retry attempts |
| `retryDelay` | number | 1000 | Base delay in milliseconds |
| `jitter` | boolean | true | Enable/disable jitter |
| `timeout` | number | 10000 | Request timeout in milliseconds |

### Retry Conditions

The client retries on the following conditions:

```javascript
// Network errors
error.name === 'AbortError' || 
/Failed to fetch|NetworkError|load failed|timeout/i.test(error.message)

// HTTP status codes
status >= 500 && status < 600  // 5xx server errors
status === 429                 // Rate limiting
status === 408                 // Request timeout
```

### Circuit Breaker Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `failureThreshold` | number | 5 | Failures before opening circuit |
| `resetTimeout` | number | 60000 | Time before attempting reset (ms) |
| `monitorWindow` | number | 300000 | Time window for failure tracking (ms) |

## Implementation Details

### Exponential Backoff with Jitter

```javascript
function calculateRetryDelay(attempt, baseDelay = 1000, jitter = true) {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const maxDelay = 10000; // Max 10 seconds
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    
    if (jitter) {
        // Add random jitter (±25%) to prevent thundering herd
        const jitterAmount = cappedDelay * 0.25;
        const jitteredDelay = cappedDelay + (Math.random() * 2 - 1) * jitterAmount;
        return Math.max(100, Math.floor(jitteredDelay)); // Minimum 100ms
    }
    
    return Math.floor(cappedDelay);
}
```

### Retry Metrics Tracking

```javascript
// Track retry attempt for metrics
trackRetryAttempt(endpoint, attempt) {
    this.retryMetrics.totalRetries++;
    this.retryMetrics.lastRetryTime = Date.now();
    
    const currentCount = this.retryMetrics.retryAttempts.get(endpoint) || 0;
    this.retryMetrics.retryAttempts.set(endpoint, currentCount + 1);
}
```

## Best Practices

### 1. Choose Appropriate Retry Counts
- **Health checks**: 1-2 retries for fast failure detection
- **User-facing requests**: 3-5 retries for good UX
- **Background tasks**: 5-10 retries for reliability

### 2. Use Jitter for High-Volume Systems
- Always enable jitter in production
- Prevents thundering herd problems
- Distributes retry load over time

### 3. Implement Circuit Breakers for Unstable Services
- Use for external APIs or unstable endpoints
- Prevents cascading failures
- Provides fast failure feedback

### 4. Monitor Retry Metrics
- Track retry rates to identify issues
- Set up alerts for high retry rates
- Use metrics for capacity planning

### 5. Customize Per Endpoint
- Critical endpoints: More retries
- Non-critical endpoints: Fewer retries
- Health checks: No retries for fast feedback

## Demo and Testing

### Interactive Demo
Open `retry-demo.html` in your browser to see the retry logic in action.

### Programmatic Demo
```javascript
import { runAllDemos } from './js/retry-demo.js';
await runAllDemos();
```

### Testing Retry Logic
```javascript
// Test with a failing endpoint
try {
    await api.request('/non-existent-endpoint');
} catch (error) {
    console.log('Request failed after retries:', error.message);
}

// Check retry metrics
const metrics = api.getRetryMetrics();
console.log('Retry attempts:', metrics.retryAttempts);
```

## Error Handling

The retry logic integrates with the existing error handling system:

```javascript
// Custom error class with retry context
export class SommOSAPIError extends Error {
    constructor(message, { status, code, details, retryAttempts } = {}) {
        super(message);
        this.name = 'SommOSAPIError';
        this.status = status;
        this.code = code;
        this.details = details;
        this.retryAttempts = retryAttempts;
    }
}
```

## Performance Considerations

### Memory Usage
- Retry metrics are stored in memory
- Circuit breaker states are lightweight
- No persistent storage required

### Network Impact
- Exponential backoff reduces server load
- Jitter prevents synchronized retries
- Circuit breakers prevent unnecessary requests

### CPU Usage
- Minimal overhead for retry logic
- Jitter calculation is lightweight
- Metrics tracking is efficient

## Troubleshooting

### High Retry Rates
1. Check network connectivity
2. Verify server health
3. Review retry configuration
4. Consider circuit breaker implementation

### Circuit Breaker Issues
1. Check failure threshold settings
2. Verify reset timeout configuration
3. Monitor circuit state transitions
4. Review endpoint stability

### Performance Issues
1. Reduce retry counts for non-critical requests
2. Increase base delay for high-load scenarios
3. Disable jitter if timing is critical
4. Use circuit breakers for unstable endpoints

## Future Enhancements

- [ ] Retry policies based on error types
- [ ] Adaptive retry delays based on server response
- [ ] Retry queue for offline scenarios
- [ ] Integration with monitoring systems
- [ ] Retry budget management
- [ ] Distributed circuit breaker state