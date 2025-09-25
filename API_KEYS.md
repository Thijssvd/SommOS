# SommOS API Keys Configuration Guide

This guide explains how to obtain and configure the API keys needed for SommOS.

## 🔑 Required API Keys

### 1. OpenAI API Key (REQUIRED)
**Purpose**: Powers AI wine pairing recommendations

**How to get it**:
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Go to [API Keys](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. Copy the key (starts with `sk-...`)

**Cost**: Pay-per-use, typically $0.01-0.03 per recommendation
**Free tier**: $5 in free credits for new accounts

### 2. Open-Meteo API Key (OPTIONAL)
**Purpose**: Historical weather data for vintage analysis

**How to get it**:
1. Visit [Open-Meteo](https://open-meteo.com/en/pricing)
2. The free tier works without any key!
3. For higher rate limits, sign up for a free account
4. Get your API key from the dashboard

**Cost**: FREE! 
- No API key: 10,000 requests/day
- Free account: 20,000 requests/day
- Paid plans available for commercial use

## 📝 Configuration Steps

### Step 1: Copy Environment File
```bash
cp .env.production .env
```

### Step 2: Edit .env File
```bash
nano .env
# or
code .env
```

### Step 3: Configure API Keys

#### Minimal Configuration (OpenAI only):
```bash
# Required for AI pairing
OPENAI_API_KEY=sk-your-actual-openai-key-here

# Optional - leave empty for free tier
OPEN_METEO_API_KEY=
```

#### Full Configuration (with Open-Meteo key):
```bash
# Required for AI pairing
OPENAI_API_KEY=sk-your-actual-openai-key-here

# Optional - for higher rate limits
OPEN_METEO_API_KEY=your-open-meteo-key-here
```

## 🧪 Testing API Keys

### Test OpenAI Connection:
```bash
# Start the application
npm start

# Test AI pairing endpoint
curl -X POST http://localhost:3000/api/pairing/recommend \
  -H "Content-Type: application/json" \
  -d '{"dish": "grilled salmon", "context": {"occasion": "casual"}}'
```

### Test Open-Meteo Connection:
```bash
# Test weather intelligence endpoint  
curl http://localhost:3000/api/vintage/analysis/1
```

## ⚠️ Security Best Practices

### 1. Keep API Keys Secret
- Never commit API keys to version control
- Use environment variables only
- Rotate keys regularly

### 2. Environment File Security
```bash
# Make sure .env is in .gitignore
echo ".env" >> .gitignore

# Set restrictive permissions
chmod 600 .env
```

### 3. Production Deployment
- Use Docker secrets or cloud provider secret management
- Never use development keys in production
- Monitor API usage and costs

## 💡 Cost Optimization Tips

### OpenAI API:
- Use traditional pairing as fallback when AI fails
- Cache AI responses for similar requests
- Monitor usage in OpenAI dashboard
- Set up billing alerts

### Open-Meteo:
- Weather data is cached automatically
- Free tier is usually sufficient
- Historical data doesn't change, so caching is very effective

## 🔧 Troubleshooting

### "OpenAI API key not configured"
- Check that your key starts with `sk-`
- Verify the key is correctly set in .env
- Restart the application after changing .env

### "Open-Meteo connection failed"
- This is non-critical - the app will work without weather data
- Check your internet connection
- Try leaving OPEN_METEO_API_KEY empty for free tier

### "Exceeded rate limits"
- OpenAI: Check your billing and usage limits
- Open-Meteo: Consider getting a free account for higher limits

## 📊 Expected Usage

### Typical Daily Usage:
- **OpenAI**: 10-50 requests (depending on pairing requests)
- **Open-Meteo**: 1-10 requests (weather data is cached)

### Cost Estimates:
- **OpenAI**: $0.50-5.00/month for typical wine cellar usage
- **Open-Meteo**: FREE for personal/small commercial use

## 🚀 Quick Start

For immediate testing with minimal setup:

1. **Get OpenAI key** (required for AI features)
2. **Leave Open-Meteo empty** (uses free tier)
3. **Deploy and test**

```bash
# Quick setup
cp .env.production .env
echo "OPENAI_API_KEY=sk-your-key-here" >> .env
echo "OPEN_METEO_API_KEY=" >> .env

# Deploy
./deployment/deploy.sh
```

Your SommOS will be fully functional with AI wine pairing and weather intelligence! 🍷