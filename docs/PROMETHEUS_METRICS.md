# Prometheus Metrics Integration

## Overview

SommOS backend exposes comprehensive application and business metrics in Prometheus format for monitoring and observability.

## Metrics Endpoint

```
GET /metrics
Content-Type: text/plain; version=0.0.4; charset=utf-8
```

**Example:**
```bash
curl http://localhost:3000/metrics
```

## Available Metrics

### HTTP Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `http_requests_total` | counter | Total HTTP requests | method, path, status |
| `http_request_duration_seconds` | histogram | HTTP request duration with quantiles | method, path |

**Quantiles tracked:** p50, p90, p95, p99

### Cache Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `cache_operations` | counter | Cache operations (get/set) | operation, result |

**Labels:**
- `operation`: get, set
- `result`: hit, miss, success

### AI Integration Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `ai_requests_total` | counter | Total AI requests | provider, status |
| `ai_response_time_seconds` | histogram | AI response time with quantiles | provider |
| `ai_confidence_score` | histogram | AI confidence scores distribution | - |
| `ai_total_requests` | counter | Total AI requests (from tracker) | - |
| `ai_success_rate` | gauge | AI request success rate (0-100) | - |
| `ai_cache_hit_rate` | gauge | AI cache hit rate (0-100) | - |
| `ai_avg_response_time_ms` | gauge | Average AI response time in ms | - |
| `ai_avg_confidence` | gauge | Average AI confidence score (0-1) | - |

### Database Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `database_queries_total` | counter | Total database queries | operation |
| `database_query_duration_seconds` | histogram | Database query duration with quantiles | operation |

### Business Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `wine_inventory_total` | gauge | Total wine bottles in inventory | - |
| `unique_wines_count` | gauge | Number of unique wines | - |
| `active_users` | gauge | Number of active users | - |
| `active_connections` | gauge | Active WebSocket connections | - |

### Node.js Process Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `process_uptime_seconds` | gauge | Process uptime in seconds |
| `nodejs_heap_used_bytes` | gauge | Node.js heap memory used |
| `nodejs_heap_total_bytes` | gauge | Node.js heap memory total |
| `nodejs_external_memory_bytes` | gauge | Node.js external memory |
| `nodejs_cpu_user_seconds_total` | counter | Node.js CPU user time |
| `nodejs_cpu_system_seconds_total` | counter | Node.js CPU system time |

## Integration Examples

### Prometheus Configuration

Add this to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'sommos'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
```

### Docker Compose with Prometheus

```yaml
version: '3.8'
services:
  sommos:
    build: .
    ports:
      - "3000:3000"
  
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
```

### Grafana Dashboard Queries

#### HTTP Request Rate
```promql
rate(http_requests_total[5m])
```

#### HTTP Request Duration (p95)
```promql
histogram_quantile(0.95, 
  rate(http_request_duration_seconds_bucket[5m])
)
```

#### Cache Hit Rate
```promql
100 * (
  rate(cache_operations{result="hit"}[5m]) / 
  rate(cache_operations{operation="get"}[5m])
)
```

#### AI Success Rate
```promql
ai_success_rate
```

#### Memory Usage
```promql
nodejs_heap_used_bytes / nodejs_heap_total_bytes * 100
```

## Automatic Tracking

Metrics are automatically tracked via:

1. **HTTP Middleware** - Tracks all incoming HTTP requests
2. **Cache Manager** - Reports cache hits/misses/sets
3. **AI Metrics Tracker** - Tracks AI request performance
4. **WebSocket Server** - Updates active connection count every 5s

## Manual Metric Recording

For custom metrics tracking:

```javascript
// Access global exporter
const exporter = global.prometheusExporter;

// Record HTTP request
exporter.recordHttpRequest('GET', '/api/wines', 200, 125);

// Record cache operation
exporter.recordCacheOperation('get', 'hit');

// Record AI request
exporter.recordAIRequest('deepseek', 'success', 2500);

// Record AI confidence
exporter.recordAIConfidence(0.89);

// Record database query
exporter.recordDatabaseQuery('SELECT', 45);

// Update inventory metrics
exporter.updateInventoryMetrics(1500, 250);

// Set active users
exporter.setActiveUsers(12);

// Set active connections
exporter.setActiveConnections(8);
```

## Monitoring Best Practices

### Key Alerts to Configure

1. **High Error Rate**
   ```promql
   rate(http_requests_total{status=~"5.."}[5m]) > 0.1
   ```

2. **Slow Response Times**
   ```promql
   histogram_quantile(0.95, 
     rate(http_request_duration_seconds_bucket[5m])
   ) > 1
   ```

3. **Low Cache Hit Rate**
   ```promql
   ai_cache_hit_rate < 50
   ```

4. **AI Service Degradation**
   ```promql
   ai_success_rate < 90
   ```

5. **High Memory Usage**
   ```promql
   nodejs_heap_used_bytes / nodejs_heap_total_bytes > 0.9
   ```

### Dashboard Panels

Recommended Grafana dashboard structure:

1. **Overview**
   - Request rate
   - Error rate
   - Response time (p50, p95, p99)
   - Active connections

2. **Performance**
   - HTTP request duration histogram
   - Database query duration
   - AI response times

3. **Cache**
   - Cache hit rate
   - Cache operations rate
   - Cache size

4. **AI Integration**
   - AI request success rate
   - AI cache hit rate
   - Average confidence score
   - Response time distribution

5. **Resources**
   - Memory usage
   - CPU usage
   - Process uptime

6. **Business Metrics**
   - Wine inventory
   - Unique wines
   - Active users

## Security Considerations

- The `/metrics` endpoint is **publicly accessible** (no authentication)
- Consider restricting access in production:
  - Use firewall rules to limit to Prometheus server IPs
  - Add authentication middleware if exposing externally
  - Use a reverse proxy (nginx) to control access

### Example: Nginx Authentication

```nginx
location /metrics {
    auth_basic "Metrics";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:3000/metrics;
}
```

## Troubleshooting

### Metrics Not Appearing

1. Check the endpoint is accessible:
   ```bash
   curl http://localhost:3000/metrics
   ```

2. Verify Prometheus can scrape:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

3. Check Prometheus logs:
   ```bash
   docker logs prometheus
   ```

### Missing AI Metrics

AI metrics require AI requests to be made. If no AI requests have been processed, these metrics will show default values (0).

### Histogram Buckets

If you need custom histogram buckets, modify the `PrometheusExporter` class:

```javascript
// Add custom buckets for histograms
this.buckets = [0.001, 0.01, 0.1, 0.5, 1, 2, 5];
```

## Performance Impact

- **Minimal overhead**: ~0.5-1ms per request for metric recording
- **Memory usage**: ~10-50MB for metric storage (depends on cardinality)
- **Scrape interval**: Recommended 15-30 seconds

## Future Enhancements

- [ ] Custom histogram buckets configuration
- [ ] Metric cardinality limits
- [ ] Distributed metrics aggregation
- [ ] StatsD/DataDog integration
- [ ] OpenTelemetry support
- [ ] Metric retention policies
- [ ] Multi-instance metric aggregation

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)
