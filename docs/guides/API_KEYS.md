# SommOS API Keys Configuration Guide

This guide explains how to obtain and configure the API keys needed for SommOS.

## 🔑 Required API Keys

### 1. DeepSeek API Key (REQUIRED)

**Purpose**: Powers AI wine pairing recommendations

**How to get it**:

1. Visit [DeepSeek Platform](https://platform.deepseek.com/)
2. Create an account or sign in
3. Go to [API Keys](https://platform.deepseek.com/api_keys)
4. Click "Create new secret key"
5. Copy the key (starts with `sk-...`)

**Cost**: Pay-per-use, typically $0.001-0.01 per recommendation (much cheaper than OpenAI)
**Free tier**: $5 in free credits for new accounts

### 2. Open-Meteo API Key (OPTIONAL)

**Purpose**: Historical weather data for vintage analysis

**How to get it**:

1. Visit [Open-Meteo](https://open-meteo.com/en/pricing)
2. The free tier works without any key!

## 📝 Configuration Steps

### Step 1: Choose Environment File

- **Development (macOS):**

  ```bash
  cp .env.example .env
  ```

- **Production (Docker):**
  Configure `deployment/.env` as the authoritative production environment file.

### Step 2: Edit .env File

```bash
nano .env
# or
code .env
```

### Step 3: Configure API Keys

#### Minimal Configuration (DeepSeek only)

```bash
# Required for AI pairing
DEEPSEEK_API_KEY=sk-your-actual-deepseek-key-here

# Optional - leave empty for free tier
OPEN_METEO_API_KEY=
```

#### Full Configuration (with Open-Meteo key)

```bash
# Required for AI pairing
DEEPSEEK_API_KEY=sk-your-actual-deepseek-key-here

# Optional - for higher rate limits
OPEN_METEO_API_KEY=your-open-meteo-key-here
```

## 🧪 Testing API Keys

### Test DeepSeek Connection

```bash
# Start the application
npm start

# Test AI pairing endpoint
curl -X POST http://localhost:3001/api/pairing/recommend \
  -H "Content-Type: application/json" \
  -d '{"dish": "grilled salmon", "context": {"occasion": "casual"}}'
```

### Test Open-Meteo Connection

```bash
# Test weather intelligence endpoint  
curl http://localhost:3001/api/vintage/analysis/1
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

### OpenAI API

- Use traditional pairing as fallback when AI fails
- Cache AI responses for similar requests
- Monitor usage in OpenAI dashboard
- Set up billing alerts

### Open-Meteo

- Weather data is cached automatically
- Free tier is usually sufficient
- Historical data doesn't change, so caching is very effective

## 🔧 Troubleshooting

### "DeepSeek API key not configured"

- Check that your key starts with `sk-`
- Verify the key is correctly set in .env
- Restart the application after changing .env

### "Open-Meteo connection failed"

- This is non-critical - the app will work without weather data
- Check your internet connection
- Try leaving OPEN_METEO_API_KEY empty for free tier

### "Exceeded rate limits"

- DeepSeek: Check your billing and usage limits
- Open-Meteo: Consider getting a free account for higher limits

## 📊 Expected Usage

### Typical Daily Usage

- **DeepSeek**: 10-50 requests (depending on pairing requests)
- **Open-Meteo**: 1-10 requests (weather data is cached)

### Cost Estimates

- **DeepSeek**: $0.10-1.00/month for typical wine cellar usage (much cheaper than OpenAI)
- **Open-Meteo**: FREE for personal/small commercial use

## 🚀 Quick Start

For immediate local testing (development):

1. **Copy dev env**

   ```bash
   cp .env.example .env
   ```

2. **Add DeepSeek key** (required for AI features)

   ```bash
   echo "DEEPSEEK_API_KEY=sk-your-key-here" >> .env
   ```

3. **Start the app and test**

   ```bash
   npm start
   ```

For production, configure `deployment/.env` and run `./deployment/deploy.sh`.

Your SommOS will be fully functional with AI wine pairing (DeepSeek primary) and weather intelligence! 🍷
