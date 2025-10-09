# SommOS Vintage Intelligence Service Demo

This document demonstrates the new Vintage Intelligence Service functionality integrated into SommOS.

## Overview

The Vintage Intelligence Service automatically enriches wine data with:

- Weather analysis and vintage summaries
- Professional 3-sentence vintage narratives (AI-powered with fallback templates)
- Weather-adjusted quality scoring
- Procurement recommendations based on vintage conditions
- Weather-based pairing insights

## Prerequisites

1. Start the SommOS server:

```bash
cd /Users/thijs/Desktop/SommOS
npm run dev
```

2. Server should be running at `http://localhost:3001`

## Demo Scripts

### 1. Add Wine with Automatic Vintage Intelligence

Add a new wine to inventory - this will automatically trigger vintage intelligence analysis:

```bash
curl -X POST http://localhost:3001/api/wines \
  -H "Content-Type: application/json" \
  -d '{
    "wine": {
      "name": "Château Margaux",
      "producer": "Château Margaux",
      "region": "Bordeaux",
      "country": "France",
      "wine_type": "Red",
      "grape_varieties": ["Cabernet Sauvignon", "Merlot", "Cabernet Franc"],
      "alcohol_content": 13.5,
      "style": "Full-bodied",
      "tasting_notes": "Complex aromas of blackcurrant, cedar, and violets",
      "food_pairings": ["Beef", "Lamb", "Aged cheese"],
      "serving_temp_min": 16,
      "serving_temp_max": 18
    },
    "vintage": {
      "year": 2018,
      "quality_score": 95,
      "critic_score": 98,
      "peak_drinking_start": 10,
      "peak_drinking_end": 30
    },
    "stock": {
      "location": "CELLAR_A",
      "quantity": 12,
      "cost_per_bottle": 850.00,
      "reference_id": "PO-2024-001",
      "notes": "Direct from château",
      "created_by": "sommelier"
    }
  }'
```

Expected response: Wine added with enrichment including vintage summary and weather analysis.

### 2. Get Vintage Analysis for Specific Wine

Retrieve complete vintage intelligence for a wine:

```bash
# Replace {wine_id} with actual wine ID from step 1
curl -X GET http://localhost:3001/api/vintage/analysis/1
```

Expected response:

```json
{
  "success": true,
  "data": {
    "wine": {
      "name": "Château Margaux",
      "producer": "Château Margaux",
      "region": "Bordeaux",
      "year": 2018,
      "wine_type": "Red"
    },
    "weatherAnalysis": {
      "gdd": 1456,
      "diurnalRange": 11.2,
      "overallScore": 87,
      "weatherSummary": "Excellent vintage conditions..."
    },
    "vintageSummary": "The 2018 vintage in Bordeaux enjoyed ideal growing conditions with 1456 degree days, creating optimal balance between ripeness and freshness...",
    "procurementRec": {
      "action": "BUY",
      "priority": "High",
      "reasoning": "Exceptional vintage with 87/100 weather score..."
    },
    "qualityScore": 98,
    "weatherScore": 87
  }
}
```

### 3. Manual Vintage Enrichment

Trigger enrichment for an existing wine:

```bash
curl -X POST http://localhost:3001/api/vintage/enrich \
  -H "Content-Type: application/json" \
  -d '{"wine_id": 1}'
```

### 4. Batch Enrichment with Filters

Enrich multiple wines matching criteria:

```bash
curl -X POST http://localhost:3001/api/vintage/batch-enrich \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "region": "Bordeaux",
      "year_from": 2015,
      "year_to": 2020
    },
    "limit": 20
  }'
```

### 5. Get Procurement Recommendations

Get weather-based procurement advice for current inventory:

```bash
curl -X GET http://localhost:3001/api/vintage/procurement-recommendations
```

Expected response:

```json
{
  "success": true,
  "data": [
    {
      "wine": {
        "name": "Château Margaux",
        "producer": "Château Margaux",
        "year": 2018,
        "region": "Bordeaux"
      },
      "weatherScore": 87,
      "currentQuantity": 12,
      "recommendation": {
        "action": "BUY",
        "priority": "High",
        "reasoning": "Exceptional vintage with 87/100 weather score...",
        "suggestedQuantity": "Increase allocation 50-100%",
        "timingAdvice": "Purchase immediately while available"
      }
    }
  ]
}
```

### 6. Weather-Based Pairing Insights

Get pairing recommendations considering vintage weather characteristics:

```bash
curl -X POST http://localhost:3001/api/vintage/pairing-insight \
  -H "Content-Type: application/json" \
  -d '{
    "wine_id": 1,
    "dish_context": {
      "richness": "high",
      "intensity": "bold",
      "cuisine": "French"
    }
  }'
```

### 7. Database Verification

Check that data was properly stored:

```bash
# Check if database exists and has data
sqlite3 /Users/thijs/Desktop/SommOS/data/sommos.db ".tables"

# Check wines table
sqlite3 /Users/thijs/Desktop/SommOS/data/sommos.db "SELECT * FROM Wines LIMIT 5;"

# Check vintages with weather scores
sqlite3 /Users/thijs/Desktop/SommOS/data/sommos.db "SELECT id, wine_id, year, weather_score, quality_score FROM Vintages LIMIT 5;"

# Check production notes (vintage summaries)
sqlite3 /Users/thijs/Desktop/SommOS/data/sommos.db "SELECT id, year, production_notes FROM Vintages WHERE production_notes IS NOT NULL LIMIT 3;"

# Check weather vintage data
sqlite3 /Users/thijs/Desktop/SommOS/data/sommos.db "SELECT * FROM WeatherVintage LIMIT 5;"
```

## Configuration

### Environment Variables

Set these in your `.env` file for full functionality:

```bash
# Enable AI-powered summaries (optional)
DEEPSEEK_API_KEY=your_deepseek_api_key_here  # Primary
# Optional fallback
OPENAI_API_KEY=your_openai_api_key_here

# Weather data sources (if integrating external APIs)
WEATHER_API_KEY=your_weather_api_key
```

### AI vs Template Mode

The service works in two modes:

1. **AI Mode**: Uses DeepSeek (primary) or OpenAI for sophisticated vintage summaries
   - Requires `DEEPSEEK_API_KEY` or `OPENAI_API_KEY` environment variable
   - Generates contextual, professional sommelier language

2. **Template Mode**: Uses built-in template logic (fallback)
   - Works offline without external dependencies
   - Generates structured summaries based on weather data patterns

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wines` | Add wine with automatic vintage intelligence |
| GET | `/api/vintage/analysis/:wine_id` | Get complete vintage analysis |
| POST | `/api/vintage/enrich` | Manual enrichment trigger |
| GET | `/api/vintage/procurement-recommendations` | Get procurement advice |
| POST | `/api/vintage/batch-enrich` | Batch process multiple wines |
| POST | `/api/vintage/pairing-insight` | Weather-based pairing insights |

## Troubleshooting

### Common Issues

1. **"Weather analysis unavailable"**:
   - Service falls back to template summaries
   - Check network connectivity for external weather data

2. **Empty procurement recommendations**:
   - Ensure wines have stock quantities > 0
   - Check that vintage data includes year information

3. **Database errors**:
   - Verify database schema is up to date
   - Run `npm run setup:db` if needed

### Logs

Monitor server logs for enrichment activity:

```bash
# Watch logs during wine addition
tail -f server.log | grep "Enriching wine data"
```

## Next Steps

1. **Integration Testing**: Use the Jest tests to validate functionality
2. **Frontend Integration**: Connect vintage intelligence data to the PWA interface
3. **Production Deployment**: Configure environment variables and deploy
4. **Data Population**: Use batch enrichment to process existing wine inventory

## Support

For questions or issues with the Vintage Intelligence Service:

1. Check server logs for error details
2. Verify API responses match expected format
3. Test with fallback template mode if AI features aren't working
