# SommOS Monitoring Stack

Complete monitoring solution for SommOS using Prometheus and Grafana.

## Quick Start

### 1. Start the Monitoring Stack

```bash
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

This will start:

- **Prometheus** on port 9090
- **Grafana** on port 3001

### 2. Start SommOS Backend

```bash
cd ..
npm start
```

The backend will expose metrics at `http://localhost:3000/metrics`

### 3. Access Dashboards

- **Grafana**: <http://localhost:3001> (admin/admin)
- **Prometheus**: <http://localhost:9090>

## Architecture

```
┌─────────────┐
│   SommOS    │
│   Backend   │──── /metrics ────┐
│  (port 3000)│                  │
└─────────────┘                  │
                                 ▼
                         ┌───────────────┐
                         │  Prometheus   │
                         │  (port 9090)  │
                         └───────┬───────┘
                                 │
                                 │ scrapes
                                 │
                         ┌───────▼───────┐
                         │    Grafana    │
                         │  (port 3001)  │
                         └───────────────┘
```

## Components

### Prometheus

**Purpose**: Time-series database and metrics collection
**Endpoint**: <http://localhost:9090>
**Configuration**: `prometheus.yml`

**Key Features**:

- Scrapes metrics every 15 seconds
- Stores 15 days of data
- Automatic service discovery
- Alert rule evaluation

**Useful Queries**:

```promql
# HTTP request rate
rate(http_requests_total[5m])

# Memory usage percentage
nodejs_heap_used_bytes / nodejs_heap_total_bytes * 100

# AI cache hit rate
100 * rate(cache_operations{result="hit"}[5m]) / rate(cache_operations{operation="get"}[5m])
```

### Grafana

**Purpose**: Metrics visualization and dashboards
**Endpoint**: <http://localhost:3001>
**Credentials**: admin / admin (change on first login)

**Dashboards**:

- `SommOS Overview` - Main operational dashboard
  - HTTP request metrics
  - Response time percentiles (p50, p90, p95, p99)
  - Cache performance
  - AI integration stats
  - Memory usage
  - Business metrics (inventory, wines, users)

**Importing Dashboards**:

1. Navigate to Dashboards → Import
2. Upload `grafana/dashboards/sommos-overview.json`
3. Select Prometheus as data source

## Metrics Reference

For a complete list of available metrics, see [`../docs/PROMETHEUS_METRICS.md`](../docs/PROMETHEUS_METRICS.md)

### Key Metrics

| Category | Metric | Description |
|----------|--------|-------------|
| **HTTP** | `http_requests_total` | Total requests by method, path, status |
| **HTTP** | `http_request_duration_seconds` | Request duration histogram |
| **Cache** | `cache_operations` | Cache hits, misses, sets |
| **AI** | `ai_success_rate` | AI request success rate (0-100) |
| **AI** | `ai_cache_hit_rate` | AI cache hit rate (0-100) |
| **Business** | `wine_inventory_total` | Total wine bottles |
| **Business** | `active_connections` | Active WebSocket connections |
| **System** | `nodejs_heap_used_bytes` | Node.js memory usage |

## Configuration

### Prometheus Configuration

Edit `prometheus.yml` to customize:

```yaml
scrape_configs:
  - job_name: 'sommos-backend'
    scrape_interval: 15s  # How often to scrape
    static_configs:
      - targets: ['sommos-backend:3000']  # Use service name in Docker
```

### Adding Alerts

Create `alerts.yml`:

```yaml
groups:
  - name: sommos_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      - alert: LowCacheHitRate
        expr: ai_cache_hit_rate < 50
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low AI cache hit rate"
          description: "Cache hit rate is {{ $value }}%"
```

Reference in `prometheus.yml`:

```yaml
rule_files:
  - "alerts.yml"
```

### Grafana Provisioning

Auto-configure data sources and dashboards by creating:

`grafana/provisioning/datasources/prometheus.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

`grafana/provisioning/dashboards/dashboard.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'SommOS'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
```

## Docker Compose Integration

To integrate monitoring with your main application:

```yaml
# In your main docker-compose.yml
services:
  sommos-backend:
    build: .
    ports:
      - "3000:3000"
    networks:
      - app
      - monitoring  # Add this

  prometheus:
    extends:
      file: monitoring/docker-compose.monitoring.yml
      service: prometheus
    networks:
      - monitoring

  grafana:
    extends:
      file: monitoring/docker-compose.monitoring.yml
      service: grafana
    networks:
      - monitoring

networks:
  app:
  monitoring:
```

## Production Deployment

### Security Best Practices

1. **Secure Metrics Endpoint**
   - Add authentication to `/metrics`
   - Restrict access via firewall/IP whitelist
   - Use TLS/HTTPS in production

2. **Grafana Security**
   - Change default admin password
   - Enable HTTPS
   - Configure OAuth/LDAP if available
   - Disable sign-up: `GF_USERS_ALLOW_SIGN_UP=false`

3. **Prometheus Security**
   - Enable basic auth
   - Use TLS for scraping
   - Limit network access

### High Availability

For production HA setup:

```yaml
services:
  prometheus-1:
    image: prom/prometheus:latest
    volumes:
      - prometheus-data-1:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'

  prometheus-2:
    image: prom/prometheus:latest
    volumes:
      - prometheus-data-2:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'

  # Use Thanos or Cortex for long-term storage and federation
```

### Scaling Considerations

- **Metrics Cardinality**: Monitor label cardinality to avoid explosion
- **Storage**: Configure retention based on needs
- **Scrape Interval**: Balance freshness vs. overhead
- **Query Performance**: Use recording rules for expensive queries

## Troubleshooting

### Metrics Not Appearing

1. **Check backend is running**:

   ```bash
   curl http://localhost:3000/metrics
   ```

2. **Check Prometheus targets**:
   - Visit <http://localhost:9090/targets>
   - Ensure target is "UP"

3. **Check Prometheus logs**:

   ```bash
   docker logs sommos-prometheus
   ```

### Dashboard Shows No Data

1. **Verify Prometheus data source**:
   - Grafana → Configuration → Data Sources
   - Test connection

2. **Check time range**:
   - Ensure dashboard time range covers recent data

3. **Verify metrics exist**:
   - Prometheus → Graph
   - Query: `{__name__=~".+"}`

### High Memory Usage

1. **Reduce retention**:

   ```yaml
   command:
     - '--storage.tsdb.retention.time=7d'
   ```

2. **Limit metrics cardinality**:
   - Review high-cardinality labels
   - Use metric_relabel_configs to drop unnecessary labels

3. **Increase container memory**:

   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

## Maintenance

### Backup Prometheus Data

```bash
# Stop Prometheus
docker-compose stop prometheus

# Backup data volume
docker run --rm \
  -v sommos_prometheus-data:/source:ro \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/prometheus-$(date +%Y%m%d).tar.gz -C /source .

# Start Prometheus
docker-compose start prometheus
```

### Backup Grafana Dashboards

```bash
# Export all dashboards
curl -X GET -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3001/api/search?query=& | \
  jq -r '.[].uid' | \
  xargs -I {} curl -X GET -H "Authorization: Bearer YOUR_API_KEY" \
    http://localhost:3001/api/dashboards/uid/{} > dashboard-{}.json
```

### Update Containers

```bash
cd monitoring
docker-compose pull
docker-compose up -d
```

## Advanced Topics

### Custom Metrics

Add custom metrics in your application:

```javascript
const exporter = global.prometheusExporter;

// Record custom metric
exporter.recordDatabaseQuery('complex_join', 125);

// Update business metric
exporter.updateInventoryMetrics(totalBottles, uniqueWines);
```

### Recording Rules

Create `recording_rules.yml`:

```yaml
groups:
  - name: sommos_recording_rules
    interval: 30s
    rules:
      - record: job:http_requests_total:rate5m
        expr: rate(http_requests_total[5m])
      
      - record: job:cache_hit_rate:5m
        expr: |
          100 * (
            rate(cache_operations{result="hit"}[5m]) / 
            rate(cache_operations{operation="get"}[5m])
          )
```

### Alertmanager Integration

Configure alert routing in `alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'slack-notifications'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
```

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Dashboard Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)

## Support

For issues or questions:

1. Check logs: `docker-compose logs -f`
2. Review [Prometheus Metrics Documentation](../docs/PROMETHEUS_METRICS.md)
3. Create an issue in the SommOS repository
