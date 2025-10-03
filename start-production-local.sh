#!/bin/bash
# Start SommOS in production mode locally (for testing)

echo "🚀 Starting SommOS in Production Mode (Local Test)"
echo "=================================================="
echo ""

# Load production environment
export $(cat .env.production | grep -v '^#' | xargs)

# Override database path for local testing
export DATABASE_PATH=./data/sommos.db

echo "✅ Environment loaded"
echo "   NODE_ENV: $NODE_ENV"
echo "   PORT: $PORT"
echo "   DATABASE: $DATABASE_PATH"
echo ""

# Start the server
echo "🎬 Starting server..."
node backend/server.js
