#!/bin/bash
# SommOS Production Deployment Script

set -e  # Exit on any error

# Configuration
PROJECT_NAME="sommos"
DOCKER_COMPOSE_FILE="deployment/production.yml"
BACKUP_DIR="/opt/sommos/backups"
DATA_DIR="/opt/sommos/data"
LOG_DIR="/opt/sommos/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root. Consider using a non-root user with sudo access."
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check available disk space (minimum 2GB)
    available_space=$(df / | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 2097152 ]; then
        error "Insufficient disk space. At least 2GB is required."
    fi
    
    success "System requirements check passed"
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."
    
    sudo mkdir -p "$DATA_DIR" "$LOG_DIR" "$BACKUP_DIR"
    # Handle macOS group naming
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sudo chown -R $USER:staff "/opt/sommos"
    else
        sudo chown -R $USER:$USER "/opt/sommos"
    fi
    chmod 755 "/opt/sommos"
    chmod 755 "$DATA_DIR" "$LOG_DIR" "$BACKUP_DIR"
    
    success "Directories created and configured"
}

# Check environment configuration
check_environment() {
    log "Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.production" ]; then
            log "Copying .env.production to .env"
            cp .env.production .env
        else
            error ".env file not found. Please create one based on .env.production"
        fi
    fi
    
    # Check required environment variables
    required_vars=("OPENAI_API_KEY" "OPEN_METEO_API_KEY")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env || grep -q "^${var}=your_.*_here" .env; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        error "Missing or unconfigured environment variables: ${missing_vars[*]}. Please configure them in .env"
    fi
    
    success "Environment configuration check passed"
}

# Create database backup
backup_database() {
    log "Creating database backup..."
    
    if [ -f "$DATA_DIR/sommos.db" ]; then
        timestamp=$(date +"%Y%m%d_%H%M%S")
        backup_file="$BACKUP_DIR/sommos_backup_$timestamp.db"
        
        cp "$DATA_DIR/sommos.db" "$backup_file"
        
        # Compress the backup
        gzip "$backup_file"
        
        success "Database backup created: ${backup_file}.gz"
        
        # Clean up old backups (keep last 30 days)
        find "$BACKUP_DIR" -name "sommos_backup_*.db.gz" -mtime +30 -delete
    else
        log "No existing database found, skipping backup"
    fi
}

# Stop existing services
stop_services() {
    log "Stopping existing services..."
    
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q | grep -q .; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" down
        success "Existing services stopped"
    else
        log "No existing services running"
    fi
}

# Build and deploy
deploy() {
    log "Building and deploying SommOS..."
    
    # Build the application
    log "Building Docker images..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache
    
    # Start services
    log "Starting services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    success "Deployment completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost/api/system/health > /dev/null 2>&1; then
            success "Health check passed - Application is running"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, waiting..."
        sleep 10
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo ""
    
    # Show running containers
    echo "Running containers:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    echo ""
    
    # Show resource usage
    echo "Resource usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    echo ""
    
    # Show logs (last 20 lines)
    echo "Recent logs:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs --tail=20
}

# Cleanup old images
cleanup() {
    log "Cleaning up old Docker images..."
    
    # Remove unused images
    docker image prune -f
    
    success "Cleanup completed"
}

# Main deployment function
main() {
    echo "🍷 SommOS Production Deployment Script"
    echo "======================================"
    echo ""
    
    check_root
    check_requirements
    check_environment
    setup_directories
    backup_database
    stop_services
    deploy
    health_check
    show_status
    cleanup
    
    echo ""
    success "🚀 SommOS deployment completed successfully!"
    echo ""
    echo "🌐 Application is available at: http://localhost"
    echo "📊 Health check endpoint: http://localhost/api/system/health"
    echo "📁 Data directory: $DATA_DIR"
    echo "📄 Logs directory: $LOG_DIR"
    echo "💾 Backups directory: $BACKUP_DIR"
    echo ""
    echo "To monitor the application:"
    echo "  docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
    echo ""
    echo "To stop the application:"
    echo "  docker-compose -f $DOCKER_COMPOSE_FILE down"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "stop")
        stop_services
        ;;
    "status")
        show_status
        ;;
    "health")
        health_check
        ;;
    "backup")
        backup_database
        ;;
    "logs")
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f
        ;;
    *)
        echo "Usage: $0 {deploy|stop|status|health|backup|logs}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Full deployment (default)"
        echo "  stop    - Stop services"
        echo "  status  - Show deployment status"
        echo "  health  - Run health check"
        echo "  backup  - Create database backup"
        echo "  logs    - Show application logs"
        exit 1
        ;;
esac