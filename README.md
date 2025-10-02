# SommOS - Yacht Sommelier Operating System

An offline-first PWA for yacht wine management with AI-powered pairing recommendations and weather intelligence.

## System Overview

SommOS is a comprehensive wine management system designed for luxury yachts, featuring:

- **Offline-First Architecture**: Works seamlessly without internet connectivity
- **AI-Powered Pairing**: Intelligent wine recommendations based on dishes and context
- **Weather Intelligence**: Vintage analysis using historical weather data
- **Inventory Management**: Real-time stock tracking with location-based organization
- **Procurement Intelligence**: Automated supplier recommendations and pricing

## Project Structure

```
SommOS/
├── frontend/           # Progressive Web App (vanilla JS)
│   ├── js/             # Application modules (SommOS, SommOSAPI, UI, modules)
│   ├── css/            # Stylesheets
│   ├── sw.js           # Service worker source
│   └── vite.config.js  # Frontend build config
├── backend/            # Node.js API server (Express)
│   ├── api/            # REST API endpoints (auth, inventory, pairing, procurement, vintage)
│   ├── core/           # Business logic (engines, services)
│   ├── database/       # Schema, migrations, setup, seed, import
│   └── config/         # Env and security configuration
├── scripts/            # Utility scripts (spec parity, env verification, SBOM)
└── data/               # Runtime database directory
```

## Key Features

### Core Functionality
1. **Wine Inventory Management** - Track wines by location, vintage, and availability
2. **Quick Pairing Engine** - 4-line AI recommendations for dish pairings
3. **Weather Vintage Analysis** - Historical weather impact on wine quality
4. **Procurement Suggestions** - Automated buying recommendations
5. **Offline Synchronization** - Works without internet, syncs when available

## Technical Stack
- **Frontend**: Progressive Web App (PWA) with offline capabilities
- **Backend**: Node.js with Express API
- **Database**: SQLite for offline-first architecture
- **AI Services**: DeepSeek (primary) or OpenAI (fallback) for intelligent wine pairing
- **Weather Data**: Open-Meteo Historical Weather API (free tier)
- **Deployment**: Docker containers with nginx reverse proxy

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)
```bash
git clone https://github.com/yourusername/sommos.git
cd sommos
npm install
./setup.sh          # Interactive API key configuration
./deployment/deploy.sh  # One-click deployment
```
**Access**: http://localhost after deployment

### Option 2: Manual Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/yourusername/sommos.git
   cd sommos
   npm install
   ```

2. **Configure API Keys**
   ```bash
   cp .env.production .env
   nano .env  # Edit with your keys
   ```
   
   **Optional (for AI)**:
   - **DeepSeek API Key (Primary)**: Get from `https://platform.deepseek.com/api_keys` (add `DEEPSEEK_API_KEY`)
   - **OpenAI API Key (Fallback)**: Get from `https://platform.openai.com/api-keys` (add `OPENAI_API_KEY`)
   - **Open-Meteo**: FREE! Leave empty for 10,000 requests/day

3. **Deploy**
   ```bash
   ./deployment/deploy.sh
   ```

### Development Mode
```bash
npm run dev  # Development server
npm test     # Run test suite
```

## Data Models

The system uses 12+ interconnected tables:
- **Core Wine Data**: Wines, Vintages, Stock, Ledger
- **Weather Intelligence**: WeatherVintage, RegionCalendar, GrapeProfiles
- **Business Data**: Suppliers, PriceBook, Aliases
- **System Tables**: Memories, Explainability

## Deployment

Designed for deployment on yacht networks with:
- Offline-first capabilities
- Progressive Web App installation
- Background synchronization
- Export capabilities for data portability

---

*Built for luxury yacht wine management with enterprise-grade reliability and yacht-specific workflows.*

## AI Keys

SommOS prefers DeepSeek as the AI provider, with automatic fallback to OpenAI if DeepSeek is not configured.

```bash
# .env
# AI (optional)
DEEPSEEK_API_KEY=sk-your-deepseek-key-here  # primary
# Optional fallback
OPENAI_API_KEY=sk-your-openai-key-here
```

Runtime automatically uses `DEEPSEEK_API_KEY` if present, otherwise `OPENAI_API_KEY`.
