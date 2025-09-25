#!/bin/bash
# SommOS Direct Node.js Production Startup Script

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🍷 Starting SommOS in Production Mode${NC}"
echo "=========================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
else
    echo -e "${YELLOW}⚠️  No .env file found, using defaults${NC}"
fi

# Set production environment
export NODE_ENV=production
export PORT=${PORT:-3000}

# Create data directories
mkdir -p data logs backups
echo -e "${GREEN}✅ Data directories ready${NC}"

# Install/update dependencies if needed
if [ ! -d "node_modules" ] || [ package.json -nt node_modules/.package-lock.json ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install --production
    echo -e "${GREEN}✅ Dependencies installed${NC}"
fi

# Start the application
echo -e "${BLUE}🚀 Starting SommOS server...${NC}"
echo ""
echo -e "${GREEN}🌐 Application will be available at: http://localhost:${PORT}${NC}"
echo -e "${GREEN}📊 Health check: http://localhost:${PORT}/api/system/health${NC}"
echo -e "${GREEN}📱 PWA: http://localhost:${PORT}${NC}"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the Node.js application
node backend/server.js