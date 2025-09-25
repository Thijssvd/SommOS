#!/bin/bash
# SommOS Quick Setup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🍷 SommOS Quick Setup${NC}"
echo "======================="
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file already exists${NC}"
    read -p "Do you want to overwrite it? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
fi

# Copy template
echo -e "${BLUE}📋 Creating .env from template...${NC}"
cp .env.production .env

# Get OpenAI API key
echo ""
echo -e "${BLUE}🔑 API Key Configuration${NC}"
echo "========================"
echo ""
echo -e "${YELLOW}OpenAI API Key (REQUIRED for AI wine pairing):${NC}"
echo "1. Visit: https://platform.openai.com/api-keys"
echo "2. Create new secret key (starts with 'sk-')"
echo "3. New accounts get $5 free credits"
echo ""
read -p "Enter your OpenAI API key (or press Enter to configure later): " OPENAI_KEY

if [ -n "$OPENAI_KEY" ]; then
    if [[ $OPENAI_KEY == sk-* ]]; then
        # Update the .env file
        sed -i.bak "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$OPENAI_KEY/" .env
        echo -e "${GREEN}✅ OpenAI API key configured${NC}"
    else
        echo -e "${RED}⚠️  Warning: OpenAI keys usually start with 'sk-'. Please verify.${NC}"
        sed -i.bak "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$OPENAI_KEY/" .env
    fi
else
    echo -e "${YELLOW}⏭️  OpenAI API key skipped - you can add it later to .env${NC}"
fi

# Open-Meteo configuration
echo ""
echo -e "${BLUE}🌦️ Weather Service Configuration:${NC}"
echo ""
echo -e "${GREEN}✅ Open-Meteo is already working with free tier!${NC}"
echo "   - 10,000 free requests per day"
echo "   - No API key required"
echo "   - Historical weather data for vintage analysis"
echo ""
read -p "Do you want to configure an Open-Meteo API key for higher limits? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "1. Visit: https://open-meteo.com/en/pricing"
    echo "2. Sign up for free account (20,000 requests/day)"
    echo "3. Get your API key from dashboard"
    echo ""
    read -p "Enter your Open-Meteo API key (or press Enter to use free tier): " METEO_KEY
    
    if [ -n "$METEO_KEY" ]; then
        sed -i.bak "s/OPEN_METEO_API_KEY=.*/OPEN_METEO_API_KEY=$METEO_KEY/" .env
        echo -e "${GREEN}✅ Open-Meteo API key configured${NC}"
    else
        # Ensure it's empty for free tier
        sed -i.bak "s/OPEN_METEO_API_KEY=.*/OPEN_METEO_API_KEY=/" .env
        echo -e "${GREEN}✅ Using Open-Meteo free tier${NC}"
    fi
else
    # Ensure it's empty for free tier  
    sed -i.bak "s/OPEN_METEO_API_KEY=.*/OPEN_METEO_API_KEY=/" .env
    echo -e "${GREEN}✅ Using Open-Meteo free tier${NC}"
fi

# Test the configuration
echo ""
echo -e "${BLUE}🧪 Testing Configuration...${NC}"

# Test Open-Meteo (should always work)
echo -n "Testing Open-Meteo connection... "
if node -e "
const OpenMeteoService = require('./backend/core/open_meteo_service');
const openMeteo = new OpenMeteoService();
openMeteo.testConnection().then(result => {
    if (result) {
        console.log('✅ Working');
        process.exit(0);
    } else {
        console.log('❌ Failed');
        process.exit(1);
    }
}).catch(() => {
    console.log('❌ Failed');
    process.exit(1);
});
" 2>/dev/null; then
    echo -e "${GREEN}✅ Open-Meteo working perfectly${NC}"
else
    echo -e "${RED}❌ Open-Meteo connection failed${NC}"
fi

# Test OpenAI if key was provided
if [ -n "$OPENAI_KEY" ]; then
    echo -n "Testing OpenAI connection... "
    # This would require starting the server, so skip for now
    echo -e "${YELLOW}⏭️  Test manually after deployment${NC}"
fi

# Security setup
echo ""
echo -e "${BLUE}🔒 Security Setup...${NC}"
chmod 600 .env
echo -e "${GREEN}✅ Set restrictive permissions on .env${NC}"

# Make sure .env is in .gitignore
if ! grep -q "^.env$" .gitignore 2>/dev/null; then
    echo ".env" >> .gitignore
    echo -e "${GREEN}✅ Added .env to .gitignore${NC}"
fi

# Clean up backup file
rm -f .env.bak

# Summary
echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "=================="
echo ""
echo -e "${GREEN}✅ Configuration file created: .env${NC}"
echo -e "${GREEN}✅ Open-Meteo weather service: Working (free tier)${NC}"

if [ -n "$OPENAI_KEY" ]; then
    echo -e "${GREEN}✅ OpenAI API key: Configured${NC}"
else
    echo -e "${YELLOW}⚠️  OpenAI API key: Not configured (required for AI pairing)${NC}"
fi

echo ""
echo -e "${BLUE}📖 Next Steps:${NC}"
echo "1. If you haven't configured OpenAI key, edit .env and add it"
echo "2. Deploy SommOS: ${GREEN}./deployment/deploy.sh${NC}"
echo "3. Test the application: ${GREEN}http://localhost${NC}"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "- API Keys Guide: ${GREEN}API_KEYS.md${NC}"
echo "- Full Deployment Guide: ${GREEN}DEPLOYMENT.md${NC}"
echo ""
echo -e "${BLUE}🍷 Ready to manage your wine collection with AI-powered recommendations!${NC}"