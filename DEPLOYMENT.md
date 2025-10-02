# SommOS Production Deployment Guide

This guide provides comprehensive instructions for deploying SommOS to production.

## 🚀 Quick Start

For a quick deployment, follow these steps:

### 1. Prerequisites
- Docker & Docker Compose installed
- Minimum 2GB available disk space
- OpenAI API key
- Open-Meteo API key (optional, has fallback)

### 2. Configuration
```bash
# Copy and configure environment variables
cp .env.production .env
nano .env  # Edit with your API keys
```

### 3. Deploy
```bash
./deployment/deploy.sh
```

The application will be available at `http://localhost` after successful deployment.

---

## 📋 Detailed Deployment Instructions

### Prerequisites

#### System Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended), macOS, or Windows with WSL2
- **RAM**: Minimum 1GB, recommended 2GB+
- **Storage**: Minimum 2GB free space
- **CPU**: 1+ cores (2+ recommended for better performance)

#### Required Software
1. **Docker**: Version 20.0+
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Add user to docker group
   sudo usermod -aG docker $USER
   ```

2. **Docker Compose**: Version 2.0+
   ```bash
   # Usually included with Docker Desktop
   # For standalone installation:
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

#### Optional AI Keys (DeepSeek primary)
1. **DeepSeek API Key** ✅ **Recommended**
   - **Purpose**: AI-powered pairing and summaries (primary provider)
   - **How to get**: https://platform.deepseek.com/api_keys
   - **Add to .env**: `DEEPSEEK_API_KEY=sk-your-deepseek-key`
2. **OpenAI API Key** (Fallback / Legacy)
   - **Purpose**: Used only if `DEEPSEEK_API_KEY` is not set
   - **Add to .env**: `OPENAI_API_KEY=sk-your-openai-key`

2. **Open-Meteo API Key** ✅ **OPTIONAL** 
   - **Purpose**: Historical weather data for vintage intelligence
   - **Cost**: FREE! (10,000 requests/day without key, 20,000/day with free account)
   - **How to get**: Leave empty for free tier, or get free key at [open-meteo.com](https://open-meteo.com/)
   - **Status**: ✅ Already working without API key!

### Configuration

#### Environment Variables
Copy the production environment template and configure:
```bash
cp .env.production .env
```

Edit `.env` with your configuration:
```bash
# AI (optional)
DEEPSEEK_API_KEY=sk-your-actual-deepseek-key-here
# Optional fallback
OPENAI_API_KEY=sk-your-actual-openai-key-here

# OPTIONAL - Leave empty for free tier (works perfectly!)
OPEN_METEO_API_KEY=

# Optional - Customize as needed
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

#### SSL/HTTPS Configuration (Optional)
For production with SSL:
1. Obtain SSL certificates
2. Place them in `deployment/ssl/`
3. Uncomment SSL configuration in `deployment/nginx.conf`
4. Update environment variables:
   ```bash
   SSL_CERT_PATH=/app/ssl/cert.pem
   SSL_KEY_PATH=/app/ssl/key.pem
   ```

### Deployment Options

#### Option 1: Automated Deployment (Recommended)
```bash
# Make deployment script executable
chmod +x deployment/deploy.sh

# Run full deployment
./deployment/deploy.sh
```

The script will:
- Check system requirements
- Setup directories
- Create database backups
- Build and deploy containers
- Run health checks
- Show deployment status

#### Option 2: Manual Deployment
```bash
# Create directories
sudo mkdir -p /opt/sommos/{data,logs,backups}
sudo chown -R $USER:$USER /opt/sommos

# Build and start services
docker-compose -f deployment/production.yml up -d --build

# Check status
docker-compose -f deployment/production.yml ps
```

### Post-Deployment Verification

#### Health Checks
```bash
# Check application health
curl http://localhost/api/system/health

# Expected response:
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "total_wines": 0,
    "total_vintages": 0,
    "total_bottles": 0,
    "active_suppliers": 0
  }
}
```

#### Performance Verification
```bash
# Test wine pairing endpoint (requires AI key)
curl -X POST http://localhost/api/pairing/recommend \
  -H "Content-Type: application/json" \
  -d '{"dish": "grilled salmon", "context": {"occasion": "casual"}}'

# Test inventory endpoint
curl http://localhost/api/inventory/stock
```

#### Log Monitoring
```bash
# View application logs
docker-compose -f deployment/production.yml logs -f

# View specific service logs
docker-compose -f deployment/production.yml logs -f sommos-app
```

---

## 🔧 Operations & Maintenance

### Daily Operations

#### Monitoring Commands
```bash
# Check deployment status
./deployment/deploy.sh status

# View real-time logs
./deployment/deploy.sh logs

# Check health
./deployment/deploy.sh health
```

#### Backup Operations
```bash
# Manual backup
./deployment/deploy.sh backup

# Automatic backups run daily at 2 AM (configured in environment)
```

### Troubleshooting

#### Common Issues

1. **Port 80/443 already in use**
   ```bash
   # Check what's using the ports
   sudo netstat -tulpn | grep :80
   sudo netstat -tulpn | grep :443
   
   # Stop conflicting services
   sudo systemctl stop apache2  # or nginx
   ```

2. **Permission denied errors**
   ```bash
   # Fix ownership
   sudo chown -R $USER:$USER /opt/sommos
   chmod 755 /opt/sommos/{data,logs,backups}
   ```

3. **Container won't start**
   ```bash
   # Check container logs
   docker-compose -f deployment/production.yml logs sommos-app
   
   # Check environment variables
   docker-compose -f deployment/production.yml config
   ```

4. **Database issues**
   ```bash
   # Reset database (WARNING: This will delete all data)
   rm /opt/sommos/data/sommos.db
   docker-compose -f deployment/production.yml restart sommos-app
   ```

### Performance Optimization

#### Database Optimization
- Database automatically creates indexes for common queries
- Regular VACUUM operations run automatically
- Consider backing up database regularly

#### Resource Monitoring
```bash
# Monitor resource usage
docker stats

# Check disk usage
du -sh /opt/sommos/*

# Monitor logs size
du -sh /opt/sommos/logs/*
```

### Scaling Considerations

#### For Higher Traffic
1. **Add Redis caching**:
   ```yaml
   services:
     redis:
       image: redis:alpine
       volumes:
         - redis-data:/data
   ```

2. **Database connection pooling**: Already implemented

3. **Load balancing**: Add multiple app containers behind nginx

#### For Larger Datasets
- Consider PostgreSQL for larger wine collections (>10,000 wines)
- Implement database read replicas
- Add dedicated storage volumes

---

## 🔄 Updates & Maintenance

### Updating the Application
```bash
# Stop current deployment
./deployment/deploy.sh stop

# Pull latest code
git pull origin main

# Deploy updates
./deployment/deploy.sh
```

### Database Migrations
Database schema updates are handled automatically on startup. The application will:
1. Detect schema changes
2. Create automatic backup
3. Apply migrations
4. Verify data integrity

### Backup Strategy
- **Automatic**: Daily at 2 AM (configurable)
- **Manual**: Use `./deployment/deploy.sh backup`
- **Retention**: 30 days (configurable)
- **Location**: `/opt/sommos/backups/`

---

## 🔐 Security Best Practices

### Environment Security
- Keep API keys secure and rotate regularly
- Use environment variables, never hardcode secrets
- Regular security updates: `docker-compose pull && ./deployment/deploy.sh`

### Network Security
- Configure firewall to only allow necessary ports
- Use HTTPS in production (SSL configuration provided)
- Consider VPN access for admin functions

### Data Security
- Regular encrypted backups
- Database stored in protected directory
- Logs rotation and cleanup

---

## 📊 Monitoring & Alerts

### Built-in Monitoring
- Health check endpoint: `/api/system/health`
- Performance metrics in logs
- Resource usage tracking

### External Monitoring (Optional)
Set up monitoring with tools like:
- **Uptime monitoring**: UptimeRobot, Pingdom
- **Logs**: ELK Stack, Splunk
- **Metrics**: Prometheus + Grafana
- **Errors**: Sentry (already configured)

### Log Management
```bash
# Rotate logs manually
docker-compose -f deployment/production.yml exec sommos-app logrotate /etc/logrotate.conf

# Archive old logs
find /opt/sommos/logs -name "*.log" -mtime +7 -exec gzip {} \;
```

---

## 🆘 Support & Recovery

### Emergency Recovery
1. **Application crash**:
   ```bash
   docker-compose -f deployment/production.yml restart sommos-app
   ```

2. **Database corruption**:
   ```bash
   # Restore from backup
   cp /opt/sommos/backups/sommos_backup_YYYYMMDD_HHMMSS.db.gz /tmp/
   gunzip /tmp/sommos_backup_*.db.gz
   cp /tmp/sommos_backup_*.db /opt/sommos/data/sommos.db
   docker-compose -f deployment/production.yml restart
   ```

3. **Complete system recovery**:
   ```bash
   # Stop everything
   ./deployment/deploy.sh stop
   
   # Clean install
   docker system prune -a
   ./deployment/deploy.sh
   
   # Restore data
   # (restore database as shown above)
   ```

### Getting Help
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: This file and inline code comments
- **Logs**: Check application logs for detailed error information

---

## 📈 Performance Benchmarks

Based on test results, SommOS achieves:
- **Inventory Loading**: ~347ms for 4,000+ items
- **Search Queries**: <30ms for filtered results
- **AI Pairing**: ~20 seconds (due to OpenAI API)
- **System Health**: <10ms response time
- **Static Assets**: Cached and optimized

### Resource Usage (Typical)
- **RAM**: 256-512MB (depends on dataset size)
- **CPU**: Low usage, spikes during AI operations
- **Storage**: ~50MB application + database size
- **Network**: Minimal, except for AI API calls

---

## ✅ Deployment Checklist

Before going live:

### Pre-deployment
- [ ] API keys configured and tested
- [ ] SSL certificates installed (if using HTTPS)
- [ ] Firewall configured
- [ ] Backup strategy implemented
- [ ] Monitoring set up

### Deployment
- [ ] System requirements met
- [ ] Environment variables configured
- [ ] Deployment script runs successfully
- [ ] Health checks pass
- [ ] All endpoints respond correctly

### Post-deployment
- [ ] Performance tests completed
- [ ] Security scan performed
- [ ] Backup/restore tested
- [ ] Log monitoring configured
- [ ] Update procedures documented

---

🍷 **Congratulations! SommOS is now ready for production use.**