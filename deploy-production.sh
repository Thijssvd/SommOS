#!/bin/bash
# SommOS Production Deployment Script
# This script will guide you through deploying SommOS to production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  SommOS Production Deployment                  ║${NC}"
echo -e "${BLUE}║  Version 1.0.0 - Production Ready             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}[1/7] Checking Prerequisites...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"
echo ""

# Step 2: Check environment file
echo -e "${YELLOW}[2/7] Checking Environment Configuration...${NC}"
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ .env.production file not found${NC}"
    echo "   Please create it first (it should already exist)"
    exit 1
fi

echo -e "${GREEN}✅ Production environment file exists${NC}"
echo ""

# Step 3: Verify database
echo -e "${YELLOW}[3/7] Checking Database...${NC}"
if [ -f "data/sommos.db" ]; then
    echo -e "${GREEN}✅ Database found${NC}"
    echo "   Creating backup..."
    cp data/sommos.db "data/sommos.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✅ Database backed up${NC}"
else
    echo -e "${YELLOW}ℹ️  No existing database - will create new one${NC}"
fi
echo ""

# Step 4: Build frontend
echo -e "${YELLOW}[4/7] Building Frontend...${NC}"
cd frontend
npm run build
cd ..
echo -e "${GREEN}✅ Frontend built successfully${NC}"
echo ""

# Step 5: Run final tests
echo -e "${YELLOW}[5/7] Running Final Tests...${NC}"
npm test -- --forceExit --silent 2>&1 | tail -3
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed${NC}"
else
    echo -e "${RED}❌ Tests failed - aborting deployment${NC}"
    exit 1
fi
echo ""

# Step 6: Choose deployment method
echo -e "${YELLOW}[6/7] Deployment Options:${NC}"
echo "   1) Docker Compose (Recommended - with nginx reverse proxy)"
echo "   2) Local Node.js (Simple - direct on port 3001)"
echo "   3) Cancel"
echo ""
read -p "Choose deployment method [1-3]: " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}Deploying with Docker Compose...${NC}"
        # Copy .env.production for docker-compose
        cp .env.production .env
        
        # Build and start containers
        docker-compose -f deployment/production.yml up -d --build
        
        echo ""
        echo -e "${GREEN}✅ Docker containers started${NC}"
        echo ""
        echo "Checking container health..."
        sleep 5
        docker-compose -f deployment/production.yml ps
        ;;
    2)
        echo ""
        echo -e "${BLUE}Starting Local Node.js Server...${NC}"
        echo -e "${YELLOW}Note: Server will run in foreground. Press Ctrl+C to stop.${NC}"
        echo ""
        sleep 2
        ./start-production-local.sh
        ;;
    3)
        echo -e "${YELLOW}Deployment cancelled${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Step 7: Post-deployment verification
echo ""
echo -e "${YELLOW}[7/7] Post-Deployment Verification${NC}"
echo "Waiting for services to be ready..."
sleep 10

# Test health endpoint
if curl -f http://localhost:3001/api/system/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${RED}⚠️  Health check failed - please verify manually${NC}"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🎉 Deployment Complete!                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Your SommOS instance is now running!${NC}"
echo ""
echo "Access points:"
if [ "$choice" = "1" ]; then
    echo "  • Frontend:  http://localhost"
    echo "  • API:       http://localhost/api"
    echo "  • Health:    http://localhost/api/system/health"
else
    echo "  • API:       http://localhost:3001/api"
    echo "  • Health:    http://localhost:3001/api/system/health"
    echo "  • Frontend:  Serve frontend/dist with a web server"
fi
echo ""
echo "Useful commands:"
if [ "$choice" = "1" ]; then
    echo "  • View logs:    docker-compose -f deployment/production.yml logs -f"
    echo "  • Stop:         docker-compose -f deployment/production.yml down"
    echo "  • Restart:      docker-compose -f deployment/production.yml restart"
else
    echo "  • Stop:         Press Ctrl+C (if still running)"
fi
echo ""
echo -e "${YELLOW}📖 See docs/deployment/DEPLOYMENT_CHECKLIST.md for post-deployment tasks${NC}"
echo ""
