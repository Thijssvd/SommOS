# SommOS Security Configuration

## Overview
This repository contains sensitive configuration data including API keys and secrets. Since this is a **private repository**, sensitive files can be safely included.

## Sensitive Files Included

### ✅ Safe to include (Private Repo):
- `.env` - Production environment variables with API keys
- `.env.production` - Production-specific configurations  
- `.env.template` - Template with example values
- Database files (when needed for development)

## Security Approach Options

### Option 1: GitHub Secrets (Production Deployments)
For automated deployments, use GitHub Secrets:

1. **Repository Settings**:
   - Go to: `Settings > Secrets and variables > Actions`
   - Add these secrets:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `OPENAI_API_KEY` | OpenAI API key for AI pairing | `sk-proj-...` |
| `SESSION_SECRET` | Express session secret | Random 32+ chars |
| `JWT_SECRET` | JWT token signing secret | Random 32+ chars |
| `SENTRY_DSN` | Error tracking (optional) | `https://...` |
| `CORS_ORIGIN` | Production domain | `https://yourdomain.com` |

2. **Usage in GitHub Actions**:
   ```yaml
   - name: Create environment file
     run: |
       cat > .env << EOF
       OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}
       SESSION_SECRET=${{ secrets.SESSION_SECRET }}
       EOF
   ```

### Option 2: Direct File Inclusion (Development)
Since the repository is private, you can safely include `.env` files:

1. **Remove .env from .gitignore**:
   ```bash
   # Comment out or remove these lines in .gitignore:
   # .env
   # .env.local
   ```

2. **Commit sensitive files**:
   ```bash
   git add .env .env.production
   git commit -m "Add environment configuration (safe in private repo)"
   git push
   ```

## Current API Keys

### OpenAI API Key
- **Key**: `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`
- **Usage**: AI-powered wine pairing recommendations
- **Cost**: ~$0.01-0.03 per pairing request
- **Monitor**: Check usage at https://platform.openai.com/usage

### Open-Meteo API
- **Key**: Not required (free tier)
- **Limit**: 10,000 requests/day
- **Usage**: Weather data for vintage intelligence

## Security Best Practices

### ✅ Current Security Measures:
- Private GitHub repository
- Environment variable isolation
- Rate limiting configured
- Input validation in API endpoints
- Secure session management

### 🔒 Additional Recommendations:
- Rotate API keys regularly (quarterly)
- Monitor API usage for anomalies  
- Enable GitHub security advisories
- Use branch protection rules
- Enable 2FA on GitHub account

## Key Rotation Process

When rotating API keys:

1. **Generate new key** on the service (OpenAI, etc.)
2. **Update in multiple places**:
   - Local `.env` file
   - GitHub Secrets (if using)
   - Production server environment
3. **Test thoroughly** before removing old key
4. **Revoke old key** after confirming new one works

## Monitoring

- **OpenAI Usage**: Monitor at https://platform.openai.com/usage
- **GitHub Actions**: Check workflow runs for any secret-related failures
- **Application Logs**: Monitor for authentication errors

---

⚠️  **Important**: Even though this is a private repository, follow the principle of least privilege and only include necessary sensitive data.
