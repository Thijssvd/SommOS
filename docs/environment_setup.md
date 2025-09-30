# SommOS Environment Setup Guide

This guide walks you through setting up API keys and environment variables for SommOS, including the Vintage Intelligence Service.

## Quick Setup

1. **Generate secure secrets**:
   ```bash
   npm run generate:secrets
   ```

2. **Copy the output** and add to your `.env` file

3. **Add your API keys** (optional but recommended for full functionality)

## API Keys You Can Add

### 🤖 Required for AI Features

#### OpenAI API Key (Recommended)
- **Purpose**: Enables AI-powered vintage summaries
- **Without it**: System uses template-based summaries (still works great!)
- **Get it**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **Cost**: ~$0.01-0.05 per vintage summary
- **Add to `.env`**:
  ```bash
  OPENAI_API_KEY=sk-your-api-key-here
  ```

### 🌤️ Weather Data (Automatic - No Keys Needed!)

#### ✅ Open-Meteo Integration (Active)
SommOS now uses **Open-Meteo** for historical weather data:
- **✅ No API key required** - completely free!
- **✅ 80+ years of historical data** (1940-present) 
- **✅ Global coverage** for all wine regions
- **✅ High resolution** (1-11km precision)
- **✅ Already integrated** and working automatically

🎉 **Your vintage intelligence is already powered by real historical weather data!**

#### 🔧 Optional Additional Weather APIs
These are **not needed** but available if you want additional data sources:

**OpenWeatherMap** (optional enhancement):
- **Get it**: [OpenWeatherMap API](https://openweathermap.org/api)
- **Add to `.env`**: `WEATHER_API_KEY=your-key`

**Visual Crossing** (optional enhancement):
- **Get it**: [Visual Crossing](https://www.visualcrossing.com/weather-api)
- **Add to `.env`**: `VISUAL_CROSSING_API_KEY=your-key`

## Step-by-Step Setup

### 1. Generate Security Secrets

Run the secret generator:
```bash
cd /Users/thijs/Desktop/SommOS
npm run generate:secrets
```

You'll see output like:
```
🔐 SommOS Secrets Generator
==============================

JWT_SECRET (for authentication):
a1b2c3d4e5f6...

SESSION_SECRET (for express sessions):  
x1y2z3a4b5c6...

📋 Copy these values to your .env file:

JWT_SECRET=a1b2c3d4e5f6...
SESSION_SECRET=x1y2z3a4b5c6...
```

### 2. Edit Your Environment File

Open the `.env` file:
```bash
code .env
# or
nano .env
```

Add the generated secrets:
```bash
# Security Settings
JWT_SECRET=a1b2c3d4e5f6... # Paste your generated secret
SESSION_SECRET=x1y2z3a4b5c6... # Paste your generated secret
```

### 3. Add API Keys (Optional)

#### For OpenAI (Recommended):
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create account
3. Create new API key
4. Copy it and add to `.env`:
   ```bash
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

#### For Weather APIs (Optional):
1. **OpenWeatherMap**:
   - Go to [OpenWeatherMap](https://openweathermap.org/api)
   - Sign up for free account
   - Get API key from dashboard
   - Add to `.env`:
     ```bash
     WEATHER_API_KEY=your-weather-key-here
     ```

### 4. Verify Setup

Test that everything loads properly:
```bash
npm start
```

Check the logs for:
- ✅ "Server running on port 3001"
- ✅ No environment variable errors
- ✅ Vintage Intelligence Service loaded

## What Each Key Enables

### With OpenAI Key:
- ✅ Professional AI-generated vintage summaries
- ✅ Sophisticated sommelier language
- ✅ Context-aware wine descriptions
- ✅ All template features as fallback

### Without OpenAI Key:
- ✅ Template-based vintage summaries
- ✅ Weather analysis and scoring
- ✅ Procurement recommendations
- ✅ All core functionality works
- ❌ AI-generated narratives

### With Weather API Keys:
- ✅ Enhanced weather data accuracy
- ✅ More detailed meteorological analysis  
- ✅ Real-time weather integration
- ✅ Historical data enrichment

### Without Weather API Keys:
- ✅ Built-in weather estimation
- ✅ Regional weather patterns
- ✅ Basic vintage analysis
- ❌ Real-time weather data

## Security Best Practices

### ✅ Do:
- Keep API keys in `.env` file only
- Never commit `.env` to git
- Use different keys for development/production
- Regenerate keys if compromised
- Monitor API usage and billing

### ❌ Don't:
- Put keys directly in code
- Share keys in chat or email
- Use production keys in development
- Commit secrets to version control
- Leave unused keys active

## Environment File Template

Your `.env` should look like this:
```bash
# Application
PORT=3001
NODE_ENV=development

# Security (generate with npm run generate:secrets)
JWT_SECRET=your-generated-jwt-secret
SESSION_SECRET=your-generated-session-secret

# Vintage Intelligence
OPENAI_API_KEY=sk-your-openai-key  # Optional but recommended
OPENAI_MODEL=gpt-4

# Weather APIs (optional)
WEATHER_API_KEY=your-weather-key
VISUAL_CROSSING_API_KEY=your-visual-crossing-key

# Database
DATABASE_PATH=./data/sommos.db

# Debug
DEBUG_MODE=true
VINTAGE_DEBUG=true
```

## Testing Your Setup

### Test Basic Functionality:
```bash
# Health check
curl http://localhost:3001/health

# Add a wine (tests vintage intelligence)
curl -X POST http://localhost:3001/api/wines \
  -H "Content-Type: application/json" \
  -d '{"wine":{"name":"Test Wine","producer":"Test","region":"Bordeaux","country":"France","wine_type":"Red","grape_varieties":["Cabernet Sauvignon"]},"vintage":{"year":2020},"stock":{"location":"CELLAR","quantity":1,"cost_per_bottle":50}}'
```

### Test AI Features (if OpenAI key added):
Check the response includes a sophisticated vintage summary instead of template text.

### Test Weather Features (if weather API keys added):
The vintage analysis should show more detailed weather data.

## Troubleshooting

### "OpenAI API key not found"
- ✅ System continues with template summaries
- Add key to enable AI features

### "Weather API failed"  
- ✅ System uses built-in weather estimation
- Check API key validity and quota

### "JWT Secret not set"
- ❌ Authentication features may not work
- Run `npm run generate:secrets` and add to `.env`

### "Database connection failed"
- Check `DATABASE_PATH` in `.env`
- Verify database file exists: `npm run setup:db`

## API Key Management

### Development vs Production
Use different API keys for different environments:

**Development** (`.env`):
```bash
OPENAI_API_KEY=sk-dev-key...
```

**Production** (GitHub or server secrets):
```bash
OPENAI_API_KEY=sk-prod-key...
SESSION_SECRET=generated-session-secret
JWT_SECRET=generated-jwt-secret
OPEN_METEO_BASE=https://archive-api.open-meteo.com/v1/archive
```

### Cost Management
- **OpenAI**: ~$0.01-0.05 per vintage summary
- **Weather APIs**: Usually free tier sufficient for testing
- Monitor usage in API dashboards
- Set up billing alerts

### Key Rotation
Periodically rotate API keys:
1. Generate new key in API dashboard
2. Update `.env` file  
3. Restart application
4. Delete old key from API dashboard

## Production Deployment

For production, use proper secret management:

### Option 1: Server Environment Variables
```bash
export OPENAI_API_KEY="sk-your-production-key"
export JWT_SECRET="your-production-jwt-secret"
```

### Option 2: Docker Secrets
```dockerfile
# docker-compose.yml
services:
  sommos:
    environment:
      - OPENAI_API_KEY_FILE=/run/secrets/openai_key
    secrets:
      - openai_key
```

### Option 3: Cloud Provider Secrets
- AWS Secrets Manager
- Google Secret Manager
- Azure Key Vault
- Heroku Config Vars

## Support

If you have issues:
1. Check the troubleshooting section above
2. Verify `.env` file format
3. Check server logs for specific errors
4. Test without API keys first (template mode)
5. Refer to `/docs/vintage_intelligence_demo.md` for testing commands