/**
 * SommOS Vintage Intelligence Service
 * 
 * Automatically enriches wine data with:
 * - Weather analysis and vintage summaries
 * - Professional 3-sentence vintage narratives
 * - Weather-based procurement recommendations  
 * - Quality scoring based on meteorological conditions
 * 
 * Integrates with WeatherAnalysisService for comprehensive vintage intelligence
 */

const { randomUUID } = require('crypto');
const WeatherAnalysisService = require('./weather_analysis');
const Database = require('../database/connection');
const OpenAI = require('openai');
const { getConfig } = require('../config/env');

class VintageIntelligenceService {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.weatherAnalysis = new WeatherAnalysisService(this.db);
        const config = getConfig();
        this.deepseek = config.deepSeek.apiKey ? new OpenAI({
            apiKey: config.deepSeek.apiKey,
            baseURL: 'https://api.deepseek.com/v1',
        }) : null;
        
        // Cache for avoiding duplicate processing
        this.processedVintages = new Map();
    }

    /**
     * Automatically enrich wine data when new wines are added
     * @param {Object} wineData - Wine information
     * @returns {Object} Enriched wine data with weather analysis
     */
    async enrichWineData(wineData) {
        console.log(`Enriching wine data for ${wineData.name} ${wineData.year}`);

        const buildReturnPayload = (baseData = {}, enrichment = {}, resolvedVintageId = null) => {
            const payload = { ...baseData, ...enrichment };

            if (resolvedVintageId) {
                payload.id = resolvedVintageId;
            } else if ('id' in payload) {
                delete payload.id;
            }

            return payload;
        };

        try {
            const wineRecordId = wineData.wine_id || wineData.id;
            const vintageRecordId = wineData.vintage_id || (wineData.wine_id ? wineData.id : null);

            // Extract region and year information
            const region = this.normalizeRegion(wineData.region || wineData.country);
            const year = parseInt(wineData.year) || new Date().getFullYear();

            // Skip if already processed
            const cacheKey = `${region}_${year}`;
            if (this.processedVintages.has(cacheKey)) {
                console.log(`Using cached analysis for ${region} ${year}`);
                return buildReturnPayload(
                    wineData,
                    {
                        weatherAnalysis: this.processedVintages.get(cacheKey)
                    },
                    vintageRecordId || wineData.vintage_id
                );
            }

            // Perform weather analysis
            const weatherAnalysis = await this.weatherAnalysis.analyzeVintage(region, year);
            
            // Generate vintage summary
            const vintageSummary = await this.generateVintageSummary(wineData, weatherAnalysis);
            
            // Update wine quality score based on weather
            const qualityScore = this.calculateWeatherAdjustedQuality(
                wineData.critic_score || 85, 
                weatherAnalysis
            );

            // Generate procurement recommendation
            const procurementRec = this.generateProcurementRecommendation(weatherAnalysis, wineData);

            // Cache results
            const enrichedData = {
                weatherAnalysis,
                vintageSummary,
                qualityScore,
                procurementRec,
                enrichedAt: new Date().toISOString()
            };

            this.processedVintages.set(cacheKey, enrichedData);

            // Update database with enriched information when possible
            if (vintageRecordId) {
                await this.updateVintageData(vintageRecordId, enrichedData);
            } else {
                console.warn('Could not determine vintage ID for enrichment update; skipping database write.');
            }

            return buildReturnPayload(
                {
                    ...wineData,
                    wine_id: wineRecordId,
                    vintage_id: vintageRecordId || wineData.vintage_id
                },
                enrichedData,
                vintageRecordId || wineData.vintage_id
            );

        } catch (error) {
            console.error('Error enriching wine data:', error.message);
            return buildReturnPayload(
                wineData,
                {
                    weatherAnalysis: null,
                    vintageSummary: 'Weather analysis unavailable for this vintage.',
                    enrichmentError: error.message
                },
                wineData.vintage_id
            );
        }
    }

    async refreshVintageWeather(vintageRecord, options = {}) {
        if (!vintageRecord) {
            throw new Error('Vintage record is required for weather refresh.');
        }

        const { forceRefresh = false, vineyardAlias = null } = options;
        const regionCandidate = vintageRecord.region
            || vintageRecord.wine_region
            || vintageRecord.country
            || vintageRecord.wine_country;
        if (!regionCandidate || typeof regionCandidate !== 'string') {
            throw new Error('Vintage region is required for weather refresh.');
        }

        const yearValue = Number(vintageRecord.year);
        if (!Number.isFinite(yearValue)) {
            throw new Error('Vintage year is required for weather refresh.');
        }

        const normalizedRegionKey = this.normalizeRegion(regionCandidate);

        this.processedVintages.delete(`${normalizedRegionKey}_${yearValue}`);

        const aliasCandidates = [
            vineyardAlias,
            vintageRecord.alias_name,
            [vintageRecord.wine_producer, vintageRecord.wine_name]
                .filter((part) => typeof part === 'string' && part.trim().length > 0)
                .join(' ')
                .trim(),
            regionCandidate
        ];

        const resolvedAlias = aliasCandidates.find(
            (candidate) => typeof candidate === 'string' && candidate.trim().length > 0
        );

        const weatherData = await this.weatherAnalysis.openMeteo.getVintageWeatherData(
            regionCandidate,
            yearValue,
            {
                vineyardAlias: resolvedAlias,
                forceRefresh
            }
        );

        if (weatherData) {
            if (forceRefresh) {
                await this.weatherAnalysis.clearCachedWeatherAnalysis(regionCandidate, yearValue);
            }

            await this.weatherAnalysis.cacheWeatherAnalysis(weatherData);
        }

        return weatherData;
    }

    /**
     * Generate professional 3-sentence vintage summary
     */
    async generateVintageSummary(wineData, weatherAnalysis) {
        const prompt = this.buildVintageSummaryPrompt(wineData, weatherAnalysis);
        
        if (this.deepseek && config.deepSeek.apiKey) {
            try {
                const response = await this.deepseek.chat.completions.create({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a master sommelier and viticulturist writing professional vintage analyses for luxury yacht wine service. Write exactly 3 sentences that sound authoritative and sophisticated.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 300
                });
                
                const summary = response.choices[0].message.content.trim();
                
                // Validate that it's approximately 3 sentences
                const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
                if (sentences.length >= 2 && sentences.length <= 4) {
                    return summary;
                }
                
            } catch (error) {
                console.error('Error generating AI vintage summary:', error.message);
            }
        }
        
        // Fallback to template-based summary
        return this.generateTemplateSummary(wineData, weatherAnalysis);
    }

    /**
     * Build AI prompt for vintage summary generation
     */
    buildVintageSummaryPrompt(wineData, weatherAnalysis) {
        return `Create a professional vintage summary for yacht service:

Wine: ${wineData.producer} ${wineData.name} ${wineData.year}
Region: ${wineData.region}
Style: ${wineData.style || wineData.wine_type}
Grapes: ${wineData.grape_varieties}

Weather Analysis:
- Growing Degree Days: ${weatherAnalysis.gdd}
- Diurnal Range: ${weatherAnalysis.avgDiurnalRange}°C  
- Harvest Conditions: ${weatherAnalysis.harvestRain}mm rainfall
- Quality Score: ${weatherAnalysis.overallScore}/100
- Weather Summary: ${weatherAnalysis.weatherSummary}

Write EXACTLY 3 sentences covering:
1. Key growing season conditions and their impact on grape development
2. Expected wine structure and character based on the weather patterns  
3. Optimal service recommendations considering the vintage characteristics

Focus on how weather influenced this specific vintage's style and drinking characteristics. Use sophisticated sommelier language appropriate for luxury yacht service.`;
    }

    /**
     * Generate template-based vintage summary when AI is unavailable
     */
    generateTemplateSummary(wineData, weatherAnalysis) {
        const region = wineData.region;
        const year = wineData.year;
        const gdd = weatherAnalysis.gdd;
        const diurnalRange = weatherAnalysis.avgDiurnalRange;
        const overallScore = weatherAnalysis.overallScore;
        
        let summary = '';
        
        // Sentence 1: Growing season conditions
        if (gdd < 1200) {
            summary += `The ${year} vintage in ${region} experienced cooler conditions with ${gdd} growing degree days, promoting slow, methodical ripening that preserved natural acidity and elegant structure.`;
        } else if (gdd > 1600) {
            summary += `The ${year} vintage in ${region} benefited from abundant warmth with ${gdd} growing degree days, allowing for complete phenolic ripeness and concentrated, full-bodied expression.`;
        } else {
            summary += `The ${year} vintage in ${region} enjoyed ideal growing conditions with ${gdd} degree days, creating optimal balance between ripeness and freshness.`;
        }
        
        // Sentence 2: Wine character expectations
        if (diurnalRange > 12) {
            summary += ` Excellent diurnal temperature variation of ${diurnalRange}°C preserved vibrant acidity while allowing flavor development, resulting in wines with remarkable aromatic complexity and aging potential.`;
        } else if (diurnalRange < 8) {
            summary += ` Limited diurnal variation of ${diurnalRange}°C created ripe, approachable wines with softer acidity and immediate charm.`;
        } else {
            summary += ` Balanced temperature fluctuations of ${diurnalRange}°C produced harmonious wines with integrated structure and expressive fruit character.`;
        }
        
        // Sentence 3: Service recommendations  
        if (overallScore > 85) {
            summary += ` This exceptional vintage represents outstanding cellaring potential and should be served with careful attention to optimal temperatures to showcase its remarkable complexity.`;
        } else if (overallScore > 70) {
            summary += ` This well-balanced vintage offers excellent drinking pleasure now while retaining potential for graceful evolution over the coming years.`;
        } else {
            summary += ` This vintage is best enjoyed in its youth, showcasing its immediate charm and varietal character through careful food pairing.`;
        }
        
        return summary;
    }

    /**
     * Calculate weather-adjusted quality score
     */
    calculateWeatherAdjustedQuality(baseScore, weatherAnalysis) {
        let adjustedScore = baseScore;
        
        // Apply weather-based adjustments
        if (weatherAnalysis.overallScore > 85) {
            adjustedScore += 3; // Exceptional vintage bonus
        } else if (weatherAnalysis.overallScore < 60) {
            adjustedScore -= 5; // Poor vintage penalty
        }
        
        // Specific weather factor adjustments
        if (weatherAnalysis.ripenessScore > 4.5) {
            adjustedScore += 2;
        }
        if (weatherAnalysis.acidityScore > 4.5) {
            adjustedScore += 2;  
        }
        if (weatherAnalysis.diseaseScore < 2.5) {
            adjustedScore -= 3; // Disease pressure penalty
        }
        
        return Math.max(50, Math.min(100, Math.round(adjustedScore)));
    }

    /**
     * Generate procurement recommendation based on weather analysis
     */
    generateProcurementRecommendation(weatherAnalysis, wineData) {
        const score = weatherAnalysis.overallScore;
        const confidence = weatherAnalysis.confidenceLevel;
        
        let recommendation = {
            action: 'HOLD',
            priority: 'Medium',
            reasoning: 'Standard vintage conditions',
            suggestedQuantity: 'Normal allocation',
            timingAdvice: 'Monitor market conditions'
        };
        
        if (score >= 85 && confidence !== 'Low') {
            recommendation = {
                action: 'BUY',
                priority: 'High',
                reasoning: `Exceptional vintage with ${score}/100 weather score. ${weatherAnalysis.weatherSummary}`,
                suggestedQuantity: 'Increase allocation 50-100%',
                timingAdvice: 'Purchase immediately while available'
            };
        } else if (score >= 75) {
            recommendation = {
                action: 'BUY',
                priority: 'Medium',
                reasoning: `Good vintage conditions with ${score}/100 weather score`,
                suggestedQuantity: 'Standard allocation',
                timingAdvice: 'Purchase at favorable pricing'
            };
        } else if (score < 60) {
            recommendation = {
                action: 'AVOID',
                priority: 'Low',
                reasoning: `Challenging vintage with ${score}/100 weather score. Weather issues may impact quality`,
                suggestedQuantity: 'Minimal or skip',
                timingAdvice: 'Wait for better vintages'
            };
        }
        
        // Special considerations
        if (weatherAnalysis.ripenessScore < 3.0) {
            recommendation.considerations = 'May show green/underripe characteristics';
        }
        if (weatherAnalysis.diseaseScore < 2.5) {
            recommendation.considerations = 'High disease pressure may affect quality consistency';
        }
        if (weatherAnalysis.heatwaveDays > 10) {
            recommendation.considerations = 'Heat stress may create jammy/cooked flavors';
        }
        
        return recommendation;
    }

    /**
     * Update vintage data in database
     */
    async updateVintageData(vintageId, enrichedData) {
        try {
            // Update Vintages table with weather-adjusted quality score
            const opId = typeof randomUUID === 'function'
                ? randomUUID()
                : `vintage-intel-${Date.now()}-${vintageId}`;

            await this.db.run(`
                UPDATE Vintages
                SET weather_score = ?,
                    quality_score = ?,
                    production_notes = ?,
                    updated_at = ?,
                    updated_by = ?,
                    op_id = ?,
                    origin = ?
                WHERE id = ?
            `, [
                enrichedData.weatherAnalysis.overallScore,
                enrichedData.qualityScore,
                JSON.stringify({
                    vintageSummary: enrichedData.vintageSummary,
                    weatherAnalysis: {
                        gdd: enrichedData.weatherAnalysis.gdd,
                        diurnalRange: enrichedData.weatherAnalysis.avgDiurnalRange,
                        confidence: enrichedData.weatherAnalysis.confidenceLevel
                    },
                    procurementRec: enrichedData.procurementRec
                }),
                Math.floor(Date.now() / 1000),
                'vintage-intelligence',
                opId,
                'ai.enrichment',
                vintageId
            ]);

            console.log(`Updated vintage data for vintage ${vintageId}`);
        } catch (error) {
            console.error('Error updating vintage data:', error.message);
        }
    }

    /**
     * Batch process multiple wines for weather analysis
     */
    async batchEnrichWines(wineList) {
        console.log(`Batch processing ${wineList.length} wines for weather analysis`);
        
        const results = [];
        const batchSize = 5; // Process in small batches to avoid API limits
        
        for (let i = 0; i < wineList.length; i += batchSize) {
            const batch = wineList.slice(i, i + batchSize);
            const batchPromises = batch.map(wine => this.enrichWineData(wine));
            
            try {
                const batchResults = await Promise.allSettled(batchPromises);
                results.push(...batchResults.map(r => r.value || r.reason));
                
                // Small delay between batches to respect API limits
                if (i + batchSize < wineList.length) {
                    await this.delay(1000);
                }
                
            } catch (error) {
                console.error(`Error processing batch ${i / batchSize + 1}:`, error.message);
            }
        }
        
        return results;
    }

    /**
     * Get weather analysis for pairing context
     */
    async getWeatherContextForPairing(wine) {
        try {
            const region = this.normalizeRegion(wine.region);
            const year = parseInt(wine.year);
            
            // Check cache first
            const cacheKey = `${region}_${year}`;
            if (this.processedVintages.has(cacheKey)) {
                return this.processedVintages.get(cacheKey).weatherAnalysis;
            }
            
            // Check database
            const weatherData = await this.db.get(`
                SELECT * FROM WeatherVintage 
                WHERE region = ? AND year = ?
            `, [region, year]);
            
            if (weatherData) {
                let gdd = null;
                try {
                    // Try to parse as JSON first, fallback to extracting from text
                    const conditionsData = typeof weatherData.harvest_conditions === 'string' && weatherData.harvest_conditions.startsWith('{') 
                        ? JSON.parse(weatherData.harvest_conditions) 
                        : { gdd: null };
                    gdd = conditionsData.gdd;
                } catch (parseError) {
                    // Extract GDD from text if possible
                    const gddMatch = weatherData.harvest_conditions?.match(/(\d+)\s*gdd/i);
                    gdd = gddMatch ? parseInt(gddMatch[1]) : null;
                }
                
                return {
                    gdd: gdd,
                    diurnalRange: weatherData.growing_season_temp_avg,
                    overallScore: weatherData.quality_impact_score,
                    rating: weatherData.vintage_rating,
                    weatherSummary: this.extractWeatherSummary(weatherData)
                };
            }
            
            // Generate on-demand if not cached
            return await this.weatherAnalysis.analyzeVintage(region, year);
            
        } catch (error) {
            console.error('Error getting weather context:', error.message);
            return null;
        }
    }

    /**
     * Generate weather-based pairing insight
     */
    generateWeatherPairingInsight(weatherAnalysis, dishContext) {
        if (!weatherAnalysis) return null;
        
        const insights = [];
        
        // Acidity-based insights
        if (weatherAnalysis.acidityScore > 4.0 && dishContext.richness === 'high') {
            insights.push(`Cool nights preserved bright acidity—perfect to cut through rich flavors`);
        }
        
        // Ripeness-based insights  
        if (weatherAnalysis.ripenessScore > 4.5 && dishContext.intensity === 'bold') {
            insights.push(`Abundant sunshine created concentrated flavors that match this dish's intensity`);
        }
        
        // Diurnal range insights
        if (weatherAnalysis.avgDiurnalRange > 12) {
            insights.push(`Excellent diurnal variation preserved aromatics and structure—ideal for complex pairings`);
        }
        
        // Vintage quality insights
        if (weatherAnalysis.overallScore > 85) {
            insights.push(`Exceptional vintage conditions created a wine worthy of this special occasion`);
        }
        
        return insights.length > 0 ? insights[0] : null;
    }

    /**
     * Normalize region names for consistency
     */
    normalizeRegion(region) {
        const regionMap = {
            'burgundy': 'burgundy',
            'bourgogne': 'burgundy', 
            'bordeaux': 'bordeaux',
            'champagne': 'champagne',
            'côtes du rhône': 'rhône',
            'rhone valley': 'rhône',
            'tuscany': 'tuscany',
            'toscana': 'tuscany',
            'piedmont': 'piedmont',
            'piemonte': 'piedmont',
            'rioja': 'rioja',
            'douro': 'douro',
            'napa valley': 'napa',
            'sonoma county': 'sonoma',
            'willamette valley': 'willamette',
            'barossa valley': 'barossa',
            'hunter valley': 'hunter',
            'marlborough': 'marlborough',
            'central otago': 'central otago'
        };
        
        const normalized = region.toLowerCase().trim();
        return regionMap[normalized] || normalized;
    }

    /**
     * Extract weather summary from database record
     */
    extractWeatherSummary(weatherData) {
        try {
            let conditions = {};
            let events = {};
            
            // Safely parse harvest_conditions
            if (typeof weatherData.harvest_conditions === 'string') {
                try {
                    conditions = weatherData.harvest_conditions.startsWith('{') 
                        ? JSON.parse(weatherData.harvest_conditions) 
                        : { text: weatherData.harvest_conditions };
                } catch {
                    conditions = { text: weatherData.harvest_conditions };
                }
            }
            
            // Safely parse weather_events
            if (typeof weatherData.weather_events === 'string') {
                try {
                    events = weatherData.weather_events.startsWith('[') || weatherData.weather_events.startsWith('{') 
                        ? JSON.parse(weatherData.weather_events) 
                        : { text: weatherData.weather_events };
                } catch {
                    events = { text: weatherData.weather_events };
                }
            }
            
            // Create summary from available data
            if (conditions.gdd) {
                return `${conditions.gdd} GDD vintage with ${events.heatwaveDays || 'some'} heatwave days and ${events.frostDays || 'minimal'} frost days`;
            } else if (conditions.text) {
                return conditions.text;
            } else {
                return `${weatherData.vintage_rating || 'Good'} vintage from ${weatherData.region}`;
            }
        } catch (error) {
            return 'Weather summary unavailable';
        }
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get procurement recommendations for current inventory
     */
    async getInventoryProcurementRecommendations() {
        try {
            const wines = await this.db.query(`
                SELECT w.*, v.year, v.weather_score, s.quantity
                FROM Wines w
                JOIN Vintages v ON w.id = v.wine_id
                JOIN Stock s ON v.id = s.vintage_id
                WHERE s.quantity > 0
                ORDER BY v.weather_score DESC NULLS LAST
            `);
            
            const recommendations = [];
            
            for (const wine of wines) {
                const weatherContext = await this.getWeatherContextForPairing(wine);
                if (weatherContext) {
                    const procurementRec = this.generateProcurementRecommendation(weatherContext, wine);
                    
                    recommendations.push({
                        wine: {
                            name: wine.name,
                            producer: wine.producer,
                            year: wine.year,
                            region: wine.region
                        },
                        weatherScore: weatherContext.overallScore,
                        currentQuantity: wine.quantity,
                        recommendation: procurementRec
                    });
                }
            }
            
            return recommendations
                .filter(r => r.recommendation.action !== 'HOLD')
                .sort((a, b) => {
                    if (a.recommendation.priority === 'High' && b.recommendation.priority !== 'High') return -1;
                    if (b.recommendation.priority === 'High' && a.recommendation.priority !== 'High') return 1;
                    return b.weatherScore - a.weatherScore;
                });
                
        } catch (error) {
            console.error('Error generating procurement recommendations:', error.message);
            return [];
        }
    }
}

module.exports = VintageIntelligenceService;