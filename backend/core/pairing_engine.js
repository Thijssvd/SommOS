/**
 * SommOS Pairing Engine
 * AI-powered wine pairing recommendations with expert sommelier knowledge
 */

const OpenAI = require('openai');
const Database = require('../database/connection');
const { getConfig } = require('../config/env');
const { AIResponseCache } = require('./ai_response_cache');

class PairingEngine {
    constructor(database, learningEngine = null, explainabilityService = null, cacheOptions = {}) {
        this.db = database || Database.getInstance();
        this.learningEngine = learningEngine;
        this.explainabilityService = explainabilityService;
        const config = getConfig();
        this.openai = config.openAI.apiKey ? new OpenAI({
            apiKey: config.openAI.apiKey,
        }) : null;
        this.scoringWeights = {
            style_match: 0.25,
            flavor_harmony: 0.30,
            texture_balance: 0.20,
            regional_tradition: 0.15,
            seasonal_appropriateness: 0.10
        };
        
        // Initialize AI response cache
        this.cache = new AIResponseCache({
            maxSize: cacheOptions.maxSize || 1000,
            maxMemorySize: cacheOptions.maxMemorySize || 100 * 1024 * 1024, // 100MB
            defaultTtl: cacheOptions.defaultTtl || 24 * 60 * 60 * 1000, // 24 hours
            strategy: cacheOptions.strategy || 'hybrid',
            prefix: 'pairing_cache',
            ...cacheOptions
        });
    }

    /**
     * Generate AI-enhanced wine pairing recommendations for a dish
     * @param {string|Object} dish - Dish description or detailed context
     * @param {Object} context - Additional context (occasion, weather, etc.)
     * @param {Object} preferences - Guest preferences and constraints
     * @param {Object} options - Additional options
     * @returns {Array} Ranked pairing recommendations
     */
    async generatePairings(dish, context = {}, preferences = {}, options = {}) {
        // Generate cache key
        const cacheKey = this.cache.generateCacheKey(dish, context, preferences);
        
        // Check cache first
        let cached = null;
        try {
            cached = await this.cache.get(cacheKey);
            if (cached) {
                console.log('AI Cache: Hit for pairing request');
                return cached;
            }
        } catch (error) {
            console.warn('AI Cache: Error retrieving from cache, continuing with fresh generation:', error.message);
        }

        console.log('AI Cache: Miss for pairing request, generating fresh response');
        
        const dishContext = typeof dish === 'string'
            ? await this.parseNaturalLanguageDish(dish, context)
            : dish;

        await this.refreshAdaptiveWeights();

        const generatedByAI = this.openai && typeof dish === 'string';
        let recommendations;

        if (generatedByAI) {
            recommendations = await this.generateAIPairings(
                dish,
                context,
                preferences,
                options,
                dishContext
            );
        } else {
            recommendations = await this.generateTraditionalPairings(dishContext, preferences);
        }

        const withMetadata = await this.attachLearningMetadata(recommendations, {
            dishDescription: typeof dish === 'string' ? dish : (dishContext?.name || ''),
            dishContext,
            preferences,
            generatedByAI
        });

        const explanation = this.buildPairingExplanation(withMetadata, dishContext, {
            context,
            preferences,
            generatedByAI,
            dishDescription: typeof dish === 'string' ? dish : (dishContext?.name || dishContext?.description || '')
        });

        await this.persistPairingExplanation(withMetadata, explanation);

        const result = {
            recommendations: withMetadata,
            explanation,
            cached: false,
            generatedAt: new Date().toISOString()
        };

        // Cache the result with appropriate TTL
        try {
            const ttl = this.getCacheTTL(dish, context, preferences, generatedByAI);
            await this.cache.set(cacheKey, result, ttl);
        } catch (error) {
            console.warn('AI Cache: Error storing in cache:', error.message);
        }

        return result;
    }
    
    /**
     * Generate AI-powered pairing recommendations
     */
    async generateAIPairings(dish, context = {}, preferences = {}, options = {}, dishContext = null) {
        try {
            // Get available wines from inventory
            const availableWines = await this.getAvailableWines();

            const parsedDish = dishContext || await this.parseNaturalLanguageDish(dish, context);
            
            // Create wine inventory summary for AI
            const wineInventory = availableWines.map(wine => ({
                name: wine.name,
                producer: wine.producer,
                region: wine.region,
                wine_type: wine.wine_type,
                year: wine.year,
                style: wine.style,
                tasting_notes: wine.tasting_notes,
                location: wine.location,
                quantity: wine.quantity
            }));
            
            // Generate AI pairing recommendations
            const aiRecommendations = await this.callOpenAIForPairings(dish, context, wineInventory, preferences);
            
            // Combine AI insights with traditional scoring
            const enhancedPairings = [];
            for (const aiRec of aiRecommendations) {
                const wine = availableWines.find(w => 
                    w.name === aiRec.wine_name && w.producer === aiRec.producer
                );
                
                if (wine) {
                    const traditionalScore = await this.calculatePairingScore(wine,
                        parsedDish, preferences);
                    
                    enhancedPairings.push({
                        wine,
                        score: {
                            ...traditionalScore,
                            ai_score: aiRec.confidence_score,
                            total: (traditionalScore.total * 0.6) + (aiRec.confidence_score * 0.4)
                        },
                        reasoning: aiRec.reasoning,
                        ai_enhanced: true
                    });
                }
            }
            
            return enhancedPairings
                .sort((a, b) => b.score.total - a.score.total)
                .slice(0, 8);
                
        } catch (error) {
            console.error('AI pairing failed, falling back to traditional:', error.message);
            const fallbackDish = dishContext || await this.parseNaturalLanguageDish(dish, context);
            return await this.generateTraditionalPairings(fallbackDish, preferences);
        }
    }
    
    /**
     * Traditional rule-based pairing recommendations
     */
    async generateTraditionalPairings(dishContext, preferences = {}) {
        const { cuisine, preparation, intensity, dominant_flavors } = dishContext;
        const { guest_preferences, dietary_restrictions, budget_range } = preferences;

        // Get available wines from stock
        const availableWines = await this.getAvailableWines();
        
        // Score each wine against the dish
        const scoredPairings = [];
        
        for (const wine of availableWines) {
            const score = await this.calculatePairingScore(wine, dishContext, preferences);
            if (score.total > 0.3) { // Minimum threshold
                scoredPairings.push({
                    wine,
                    score,
                    reasoning: this.generateReasoning(wine, dishContext, score),
                    ai_enhanced: false
                });
            }
        }

        // Sort by total score and return top recommendations
        return scoredPairings
            .sort((a, b) => b.score.total - a.score.total)
            .slice(0, 8); // Return top 8 recommendations
    }

    /**
     * Calculate comprehensive pairing score
     */
    async calculatePairingScore(wine, dishContext, preferences) {
        const scores = {
            style_match: this.calculateStyleMatch(wine, dishContext),
            flavor_harmony: this.calculateFlavorHarmony(wine, dishContext),
            texture_balance: this.calculateTextureBalance(wine, dishContext),
            regional_tradition: await this.calculateRegionalTradition(wine, dishContext),
            seasonal_appropriateness: this.calculateSeasonalScore(wine, dishContext)
        };

        // Apply guest preferences modifier
        const preferenceModifier = this.applyPreferences(wine, preferences);
        
        // Calculate weighted total
        let total = 0;
        for (const [category, score] of Object.entries(scores)) {
            total += score * this.scoringWeights[category];
        }

        return {
            ...scores,
            total: Math.min(1.0, total * preferenceModifier),
            confidence: this.calculateConfidence(scores)
        };
    }

    /**
     * Calculate style matching score (wine body vs dish intensity)
     */
    calculateStyleMatch(wine, dishContext) {
        const wineBody = this.getWineBody(wine);
        const dishIntensity = dishContext.intensity || 'medium';
        
        const bodyMap = { light: 1, medium: 2, full: 3 };
        const intensityMap = { light: 1, medium: 2, heavy: 3 };
        
        const bodyScore = bodyMap[wineBody] || 2;
        const intensityScore = intensityMap[dishIntensity] || 2;
        
        // Perfect match = 1.0, adjacent = 0.7, opposite = 0.3
        const difference = Math.abs(bodyScore - intensityScore);
        return difference === 0 ? 1.0 : difference === 1 ? 0.7 : 0.3;
    }

    /**
     * Calculate flavor harmony score
     */
    calculateFlavorHarmony(wine, dishContext) {
        const wineDescriptors = new Set([
            ...this.extractWineFlavors(wine),
            this.getWineBody(wine),
            this.getWineTexture(wine)
        ].filter(Boolean));
        const dishFlavors = dishContext.dominant_flavors || [];

        let harmonyScore = 0;
        let conflictPenalty = 0;

        // Check for complementary flavors
        for (const dishFlavor of dishFlavors) {
            if (this.isComplementaryFlavor(dishFlavor, wineDescriptors)) {
                harmonyScore += 0.3;
            }
            if (this.isConflictingFlavor(dishFlavor, wineDescriptors)) {
                conflictPenalty += 0.3;
            }
        }

        const wineBody = this.getWineBody(wine);
        if (['light', 'medium'].includes(dishContext.intensity) && wine.wine_type === 'Red' && wineBody === 'full') {
            conflictPenalty += 0.2;
        }
        if (dishFlavors.includes('citrus') && wine.wine_type === 'Red') {
            conflictPenalty += 0.1;
        }

        return Math.max(0, Math.min(1.0, harmonyScore - conflictPenalty));
    }

    /**
     * Calculate texture balance score
     */
    calculateTextureBalance(wine, dishContext) {
        const wineTexture = this.getWineTexture(wine);
        const dishTexture = this.deriveDishTexture(dishContext);
        
        // Complementary texture pairings
        const textureMatrix = {
            'crisp': { 'creamy': 0.9, 'oily': 0.8, 'light': 0.7, 'rich': 0.4 },
            'smooth': { 'textured': 0.8, 'medium': 0.9, 'rich': 0.7, 'light': 0.6 },
            'tannic': { 'fatty': 0.9, 'protein-rich': 0.8, 'rich': 0.7, 'light': 0.3 }
        };
        
        return textureMatrix[wineTexture]?.[dishTexture] || 0.5;
    }

    /**
     * Calculate regional tradition score
     */
    async calculateRegionalTradition(wine, dishContext) {
        const wineRegion = wine.region.toLowerCase();
        const cuisine = dishContext.cuisine?.toLowerCase();
        
        // Query regional pairing traditions
        const traditions = await this.getRegionalTraditions(wineRegion, cuisine);
        
        if (traditions.perfect_match) return 1.0;
        if (traditions.good_match) return 0.8;
        if (traditions.acceptable_match) return 0.6;
        
        return 0.4; // Default for no specific tradition
    }

    /**
     * Calculate seasonal appropriateness
     */
    calculateSeasonalScore(wine, dishContext) {
        const currentSeason = dishContext.season || this.getCurrentSeason();
        const wineStyle = this.getWineStyle(wine);
        
        const seasonalPreferences = {
            'spring': { 'light_white': 0.9, 'rosé': 0.8, 'light_red': 0.7 },
            'summer': { 'crisp_white': 1.0, 'rosé': 0.9, 'sparkling': 0.8 },
            'autumn': { 'medium_red': 0.9, 'full_white': 0.8, 'dessert': 0.7 },
            'winter': { 'full_red': 1.0, 'fortified': 0.8, 'aged_white': 0.7 }
        };
        
        return seasonalPreferences[currentSeason]?.[wineStyle] || 0.6;
    }

    /**
     * Apply guest preferences modifier
     */
    applyPreferences(wine, preferences) {
        let modifier = 1.0;
        
        if (preferences.guest_preferences) {
            const prefs = preferences.guest_preferences;
            
            // Preferred wine types
            if (prefs.preferred_types?.includes(wine.wine_type)) {
                modifier *= 1.2;
            }
            
            // Avoided wine types
            if (prefs.avoided_types?.includes(wine.wine_type)) {
                modifier *= 0.3;
            }
            
            // Preferred regions
            if (prefs.preferred_regions?.includes(wine.region)) {
                modifier *= 1.1;
            }
        }
        
        return Math.min(1.5, modifier); // Cap at 1.5x boost
    }

    /**
     * Generate human-readable reasoning for pairing
     */
    generateReasoning(wine, dishContext, score) {
        const reasons = [];
        
        if (score.style_match > 0.8) {
            reasons.push(`The ${this.getWineBody(wine)}-bodied style perfectly complements the ${dishContext.intensity} intensity of the dish`);
        }
        
        if (score.flavor_harmony > 0.7) {
            reasons.push(`Excellent flavor harmony between the wine's profile and the dish's dominant flavors`);
        }
        
        if (score.regional_tradition > 0.8) {
            reasons.push(`Classic regional pairing from ${wine.region} cuisine traditions`);
        }
        
        if (score.texture_balance > 0.8) {
            reasons.push(`The wine's texture provides perfect balance to the dish`);
        }

        if (reasons.length === 0) {
            reasons.push(`Balanced structure and style make this a versatile match for the dish`);
        }

        return reasons.join('. ') + '.';
    }

    // Helper methods
    async getAvailableWines() {
        return this.db.query(`
            SELECT w.*, v.year, v.quality_score, s.quantity, s.location,
                   (s.quantity - s.reserved_quantity) as available_quantity
            FROM Stock s
            JOIN Vintages v ON v.id = s.vintage_id
            JOIN Wines w ON w.id = v.wine_id
            WHERE s.quantity > s.reserved_quantity
            ORDER BY v.quality_score DESC NULLS LAST, s.quantity DESC
        `);
    }

    getWineBody(wine) {
        const style = wine.style?.toLowerCase() || '';
        if (style.includes('light')) return 'light';
        if (style.includes('full')) return 'full';
        return 'medium';
    }

    getWineTexture(wine) {
        const type = wine.wine_type.toLowerCase();
        const style = wine.style?.toLowerCase() || '';
        
        if (type === 'sparkling') return 'crisp';
        if (style.includes('crisp') || style.includes('mineral')) return 'crisp';
        if (style.includes('smooth') || style.includes('silky')) return 'smooth';
        if (style.includes('tannic') || type === 'red') return 'tannic';
        
        return 'smooth';
    }

    extractWineFlavors(wine) {
        const notes = wine.tasting_notes?.toLowerCase() || '';
        const flavors = [];
        
        // Extract flavor categories from tasting notes
        const flavorKeywords = {
            'fruit': ['berry', 'cherry', 'cassis', 'blackberry', 'plum', 'apple', 'pear', 'peach', 'apricot', 'citrus', 'lemon', 'lime', 'orange', 'tropical'],
            'earth': ['mineral', 'stone', 'earth', 'soil', 'graphite', 'truffle', 'mushroom'],
            'spice': ['pepper', 'spice', 'herb', 'herbal', 'cedar', 'oak', 'anise', 'clove'],
            'floral': ['floral', 'rose', 'violet', 'blossom'],
            'sweet': ['honey', 'caramel', 'toffee'],
            'nutty': ['almond', 'hazelnut', 'nut', 'walnut'],
            'smoky': ['smoke', 'smoky', 'toast', 'toasted']
        };

        for (const [category, keywords] of Object.entries(flavorKeywords)) {
            if (keywords.some(keyword => notes.includes(keyword))) {
                flavors.push(category);
            }
        }

        return flavors;
    }

    isComplementaryFlavor(dishFlavor, wineDescriptors) {
        const complementaryMap = {
            'citrus': ['crisp', 'light', 'earth'],
            'herb': ['earth', 'spice', 'herbal'],
            'rich': ['full', 'tannic', 'sweet', 'smooth'],
            'spicy': ['sweet', 'fruit', 'spice'],
            'sweet': ['sweet', 'fruit', 'smooth'],
            'delicate': ['light', 'floral', 'crisp'],
            'umami': ['earth', 'spice', 'tannic']
        };

        const descriptors = Array.isArray(wineDescriptors) ? wineDescriptors : Array.from(wineDescriptors);
        return complementaryMap[dishFlavor]?.some(f => descriptors.includes(f)) || false;
    }

    isConflictingFlavor(dishFlavor, wineDescriptors) {
        const conflictMap = {
            'delicate': ['tannic', 'full'],
            'sweet': ['tannic'],
            'spicy': ['tannic'],
            'citrus': ['tannic']
        };

        const descriptors = Array.isArray(wineDescriptors) ? wineDescriptors : Array.from(wineDescriptors);
        return conflictMap[dishFlavor]?.some(f => descriptors.includes(f)) || false;
    }

    deriveDishTexture(dishContext) {
        if (dishContext.texture) {
            return dishContext.texture;
        }

        if (dishContext.dominant_flavors?.includes('rich')) {
            return 'rich';
        }
        if (dishContext.dominant_flavors?.includes('spicy')) {
            return 'medium';
        }
        if (dishContext.dominant_flavors?.includes('delicate')) {
            return 'light';
        }

        const preparation = dishContext.preparation?.toLowerCase();
        if (preparation) {
            if (['raw', 'poached', 'steamed'].includes(preparation)) {
                return 'light';
            }
            if (['roasted', 'braised', 'grilled', 'seared', 'stewed'].includes(preparation)) {
                return 'rich';
            }
        }

        if (dishContext.intensity === 'heavy') {
            return 'rich';
        }
        if (dishContext.intensity === 'light') {
            return 'light';
        }

        return 'medium';
    }

    getCurrentSeason() {
        const month = new Date().getMonth();
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'autumn';
        return 'winter';
    }

    getWineStyle(wine) {
        const type = wine.wine_type.toLowerCase();
        const style = wine.style?.toLowerCase() || '';
        
        if (type === 'sparkling') return 'sparkling';
        if (type === 'rosé') return 'rosé';
        if (type === 'dessert') return 'dessert';
        if (type === 'fortified') return 'fortified';
        
        if (type === 'white') {
            if (style.includes('crisp')) return 'crisp_white';
            if (style.includes('full')) return 'full_white';
            return 'light_white';
        }
        
        if (type === 'red') {
            if (style.includes('light')) return 'light_red';
            if (style.includes('full')) return 'full_red';
            return 'medium_red';
        }
        
        return 'medium_red';
    }

    async getRegionalTraditions(wineRegion, cuisine) {
        // Simplified regional tradition lookup
        const traditions = {
            'burgundy': { 'french': { perfect_match: true } },
            'bordeaux': { 'french': { good_match: true } },
            'loire valley': { 'french': { good_match: true } },
            'provence': { 'french': { good_match: true } },
            'tuscany': { 'italian': { perfect_match: true } },
            'piedmont': { 'italian': { perfect_match: true } },
            'rioja': { 'spanish': { perfect_match: true } },
            'champagne': { 'french': { good_match: true }, 'international': { good_match: true } },
            'mosel': { 'german': { perfect_match: true }, 'thai': { good_match: true } },
            'alsace': { 'french': { good_match: true }, 'german': { acceptable_match: true } },
            'douro': { 'portuguese': { perfect_match: true }, 'french': { acceptable_match: true } },
            'california': { 'american': { good_match: true }, 'international': { acceptable_match: true } }
        };

        return traditions[wineRegion]?.[cuisine] || {};
    }

    calculateConfidence(scores) {
        const values = Object.values(scores);
        const average = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / values.length;
        
        // Higher confidence when scores are consistently high
        return Math.max(0.1, Math.min(1.0, average - Math.sqrt(variance)));
    }
    
    /**
     * Parse natural language dish description using AI
     */
    async parseNaturalLanguageDish(dish, context = {}) {
        if (!this.openai) {
            // Fallback to basic parsing for non-AI mode
            return {
                dish: dish,
                cuisine: context.cuisine || 'international',
                preparation: context.preparation || 'unknown',
                intensity: context.intensity || 'medium',
                dominant_flavors: context.dominant_flavors || []
            };
        }
        
        try {
            const prompt = `Analyze this dish description and extract key pairing characteristics:
            
Dish: "${dish}"
Context: ${JSON.stringify(context)}
            
Please respond with a JSON object containing:
- cuisine: the cuisine type (e.g., french, italian, asian, etc.)
- preparation: cooking method (e.g., grilled, roasted, braised, etc.)
- intensity: flavor intensity (light, medium, heavy)
- dominant_flavors: array of key flavor profiles (e.g., ["rich", "savory", "spicy"])
- texture: dish texture (creamy, light, rich, etc.)
            
Respond only with valid JSON.`;
            
            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 200
            });
            
            const parsed = JSON.parse(response.choices[0].message.content);
            return {
                dish: dish,
                cuisine: parsed.cuisine || 'international',
                preparation: parsed.preparation || 'unknown',
                intensity: parsed.intensity || 'medium',
                dominant_flavors: parsed.dominant_flavors || [],
                texture: parsed.texture || 'medium'
            };
            
        } catch (error) {
            console.error('Error parsing dish with AI:', error.message);
            return {
                dish: dish,
                cuisine: 'international',
                preparation: 'unknown',
                intensity: 'medium',
                dominant_flavors: []
            };
        }
    }
    
    /**
     * Call OpenAI for wine pairing recommendations
     */
    async callOpenAIForPairings(dish, context, wineInventory, preferences) {
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }
        
        const inventorySummary = wineInventory.slice(0, 50).map(wine => 
            `${wine.name} (${wine.producer}) - ${wine.wine_type} from ${wine.region}, ${wine.year} - ${wine.quantity} bottles`
        ).join('\n');
        
        const prompt = `You are an expert sommelier managing a luxury yacht wine cellar. Please recommend the best wine pairings from the available inventory.
        
Dish: "${dish}"
Context: ${JSON.stringify(context)}
Guest Preferences: ${JSON.stringify(preferences)}
        
Available Wine Inventory:
${inventorySummary}
        
Please recommend up to 6 wines from this inventory that would pair excellently with the dish. For each recommendation, provide:
1. The exact wine name and producer as listed
2. A confidence score (0.0 to 1.0)
3. Detailed reasoning explaining why this pairing works
        
Respond with a JSON array of recommendations in this format:
[{
  "wine_name": "exact name from inventory",
  "producer": "exact producer from inventory",
  "confidence_score": 0.95,
  "reasoning": "Detailed explanation of why this pairing works, considering flavor profiles, texture, acidity, tannins, and classic pairing principles."
}]
        
Focus on wines that create harmony or interesting contrasts with the dish. Consider the setting (luxury yacht), occasion, and guest preferences.`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.4,
                max_tokens: 1500
            });
            
            const recommendations = JSON.parse(response.choices[0].message.content);
            return Array.isArray(recommendations) ? recommendations : [];
            
        } catch (error) {
            console.error('OpenAI API error:', error.message);
            throw new Error('Failed to get AI recommendations: ' + error.message);
        }
    }
    
    /**
     * Quick AI-powered pairing for immediate service
     */
    async quickPairing(dish, context = {}, ownerLikes = {}) {
        // Generate cache key for quick pairing
        const cacheKey = this.cache.generateCacheKey(dish, { ...context, quick: true }, ownerLikes);
        
        // Check cache first
        let cached = null;
        try {
            cached = await this.cache.get(cacheKey);
            if (cached) {
                console.log('AI Cache: Hit for quick pairing request');
                return cached;
            }
        } catch (error) {
            console.warn('AI Cache: Error retrieving from cache for quick pairing, continuing with fresh generation:', error.message);
        }

        console.log('AI Cache: Miss for quick pairing request, generating fresh response');
        
        await this.refreshAdaptiveWeights();

        if (!this.openai) {
            // Fallback to rule-based quick pairing
            const availableWines = await this.getAvailableWines();
            const result = availableWines.slice(0, 3).map(wine => ({
                wine,
                reasoning: 'Quick selection based on availability and general pairing rules',
                confidence: 0.6
            }));
            
            // Cache the result with shorter TTL for quick pairings
            try {
                await this.cache.set(cacheKey, result, 2 * 60 * 60 * 1000); // 2 hours
            } catch (error) {
                console.warn('AI Cache: Error storing quick pairing in cache:', error.message);
            }
            return result;
        }
        
        try {
            const quickInventory = (await this.getAvailableWines()).slice(0, 20);
            const recommendations = await this.callOpenAIForPairings(dish, {
                ...context,
                urgency: 'quick_service',
                owner_preferences: ownerLikes
            }, quickInventory, {});
            
            const result = recommendations.slice(0, 3).map(rec => ({
                wine: quickInventory.find(w => w.name === rec.wine_name && w.producer === rec.producer),
                reasoning: rec.reasoning,
                confidence: rec.confidence_score
            })).filter(p => p.wine);
            
            // Cache the result with shorter TTL for quick pairings
            try {
                await this.cache.set(cacheKey, result, 2 * 60 * 60 * 1000); // 2 hours
            } catch (error) {
                console.warn('AI Cache: Error storing quick pairing in cache:', error.message);
            }
            return result;
            
        } catch (error) {
            console.error('Quick pairing error:', error.message);
            const availableWines = await this.getAvailableWines();
            const result = availableWines.slice(0, 3).map(wine => ({
                wine,
                reasoning: 'Quick selection (AI unavailable)',
                confidence: 0.5
            }));
            
            // Cache the fallback result with shorter TTL
            try {
                await this.cache.set(cacheKey, result, 30 * 60 * 1000); // 30 minutes
            } catch (error) {
                console.warn('AI Cache: Error storing fallback quick pairing in cache:', error.message);
            }
            return result;
        }
    }

    async refreshAdaptiveWeights() {
        if (!this.learningEngine) {
            return;
        }

        try {
            const adaptiveWeights = await this.learningEngine.getPairingWeights();
            if (adaptiveWeights) {
                this.scoringWeights = adaptiveWeights;
            }
        } catch (error) {
            console.warn('Failed to refresh adaptive pairing weights:', error.message);
        }
    }

    async attachLearningMetadata(recommendations, sessionContext = {}) {
        if (!this.learningEngine || !Array.isArray(recommendations) || recommendations.length === 0) {
            return recommendations;
        }

        try {
            const capture = await this.learningEngine.recordPairingSession({
                dishDescription: sessionContext.dishDescription,
                dishContext: sessionContext.dishContext,
                preferences: sessionContext.preferences,
                recommendations,
                generatedByAI: sessionContext.generatedByAI
            });

            if (!capture?.sessionId) {
                return recommendations;
            }

            return recommendations.map((recommendation, index) => ({
                ...recommendation,
                learning_session_id: capture.sessionId,
                learning_recommendation_id: capture.recommendationIds?.[index] || null
            }));
        } catch (error) {
            console.warn('Unable to attach learning metadata to pairing results:', error.message);
            return recommendations;
        }
    }

    buildPairingExplanation(recommendations, dishContext = {}, {
        context = {},
        preferences = {},
        generatedByAI = false,
        dishDescription = ''
    } = {}) {
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
            return null;
        }

        const primary = recommendations[0] || {};
        const wine = primary.wine || {};
        const normalizedDish = dishContext?.name
            || dishContext?.title
            || dishContext?.description
            || dishDescription
            || 'this dish';

        const summaryParts = [];
        if (primary.reasoning) {
            summaryParts.push(primary.reasoning);
        } else {
            const wineLabel = [wine.name, wine.year].filter(Boolean).join(' ') || 'Selected wine';
            summaryParts.push(`${wineLabel} balances ${normalizedDish}.`);
        }

        const contextDetails = [];
        if (context && typeof context === 'object') {
            const occasion = context.occasion || context.event;
            if (occasion) {
                contextDetails.push(`occasion: ${occasion}`);
            }
            if (context.season) {
                contextDetails.push(`season: ${context.season}`);
            }
            if (context.weather) {
                contextDetails.push(`weather: ${context.weather}`);
            }
            if (context.guestCount || context.guest_count) {
                const guests = context.guestCount || context.guest_count;
                contextDetails.push(`${guests} guest${guests === 1 ? '' : 's'}`);
            }
        }

        if (contextDetails.length) {
            summaryParts.push(`Context: ${contextDetails.join(', ')}.`);
        }

        const summary = summaryParts.join(' ').trim();

        const factors = [];
        const addFactor = (label, value) => {
            if (!value) {
                return;
            }
            const trimmed = typeof value === 'string' ? value.trim() : value;
            if (trimmed && !factors.includes(`${label}: ${trimmed}`)) {
                factors.push(`${label}: ${trimmed}`);
            }
        };

        const dishFlavors = Array.isArray(dishContext?.dominant_flavors)
            ? dishContext.dominant_flavors
            : typeof dishContext?.dominant_flavors === 'string'
                ? dishContext.dominant_flavors.split(',')
                    .map((entry) => entry.trim())
                    .filter(Boolean)
                : [];

        if (dishFlavors.length) {
            addFactor('Dish highlights', dishFlavors.join(', '));
        }

        if (dishContext?.preparation) {
            addFactor('Preparation', dishContext.preparation);
        }

        if (dishContext?.cuisine) {
            addFactor('Cuisine', dishContext.cuisine);
        }

        const score = primary.score || {};
        const numericScoreFactor = (label, value, descriptor) => {
            if (typeof value !== 'number') {
                return;
            }
            const percentage = Math.round(value * 100);
            addFactor(label, `${percentage}% ${descriptor}`);
        };

        numericScoreFactor('Style balance', score.style_match, 'body alignment');
        numericScoreFactor('Flavor harmony', score.flavor_harmony, 'flavor synergy');
        numericScoreFactor('Texture balance', score.texture_balance, 'texture alignment');
        numericScoreFactor('Regional tradition', score.regional_tradition, 'classic pairing heritage');
        numericScoreFactor('Seasonal fit', score.seasonal_appropriateness, 'seasonal suitability');

        if (typeof score.total === 'number') {
            numericScoreFactor('Overall match', score.total, 'overall pairing confidence');
        } else if (typeof primary.confidence === 'number') {
            numericScoreFactor('Overall match', primary.confidence, 'overall pairing confidence');
        }

        if (generatedByAI) {
            addFactor('AI assistance', 'Recommendations enhanced with AI pairing analysis');
        }

        if (preferences) {
            if (typeof preferences === 'string' && preferences.trim()) {
                addFactor('Guest notes', preferences.trim());
            } else if (typeof preferences === 'object') {
                if (Array.isArray(preferences.dietary_restrictions) && preferences.dietary_restrictions.length) {
                    addFactor('Dietary considerations', preferences.dietary_restrictions.join(', '));
                }
                if (preferences.guest_preferences) {
                    addFactor('Guest preferences', Array.isArray(preferences.guest_preferences)
                        ? preferences.guest_preferences.join(', ')
                        : String(preferences.guest_preferences));
                }
                if (preferences.budget_range) {
                    addFactor('Budget range', preferences.budget_range);
                }
            }
        }

        const alternates = recommendations.slice(1, 3)
            .map((entry) => entry?.wine?.name)
            .filter(Boolean);
        if (alternates.length) {
            addFactor('Alternate pours', alternates.join(', '));
        }

        return {
            summary: summary || `${normalizedDish} pairing recommendations ready.`,
            factors
        };
    }

    buildRecommendationFactors(recommendation, explanation) {
        const factors = [];

        if (explanation?.factors) {
            if (Array.isArray(explanation.factors)) {
                factors.push(...explanation.factors);
            } else if (typeof explanation.factors === 'object') {
                Object.entries(explanation.factors)
                    .forEach(([key, value]) => {
                        if (value !== null && value !== undefined && value !== '') {
                            factors.push(`${key}: ${value}`);
                        }
                    });
            } else if (typeof explanation.factors === 'string') {
                factors.push(explanation.factors);
            }
        }

        const score = recommendation?.score || {};
        const appendScore = (label, value, descriptor) => {
            if (typeof value !== 'number') {
                return;
            }
            const percentage = Math.round(value * 100);
            const factorText = `${label}: ${percentage}% ${descriptor}`;
            if (!factors.includes(factorText)) {
                factors.push(factorText);
            }
        };

        appendScore('Overall match', score.total, 'overall pairing confidence');
        appendScore('Style balance', score.style_match, 'body alignment');
        appendScore('Flavor harmony', score.flavor_harmony, 'flavor synergy');
        appendScore('Texture balance', score.texture_balance, 'texture alignment');

        if (recommendation?.reasoning && !factors.includes(recommendation.reasoning)) {
            factors.push(recommendation.reasoning);
        }

        return factors;
    }

    async persistPairingExplanation(recommendations, explanation) {
        if (!this.explainabilityService || !explanation || !explanation.summary) {
            return;
        }

        if (!Array.isArray(recommendations) || recommendations.length === 0) {
            return;
        }

        const timestamp = new Date().toISOString();

        const tasks = recommendations
            .filter((recommendation) => recommendation?.learning_recommendation_id)
            .map((recommendation) => {
                const entityId = recommendation.learning_recommendation_id;
                const summary = recommendation.reasoning || explanation.summary;
                const factors = this.buildRecommendationFactors(recommendation, explanation);

                return this.explainabilityService.createExplanation({
                    entityType: 'pairing_recommendation',
                    entityId,
                    summary,
                    factors,
                    generatedAt: timestamp
                }).catch((error) => {
                    console.warn('Failed to persist pairing explanation:', error.message);
                });
            });

        if (tasks.length > 0) {
            await Promise.all(tasks);
        }
    }

    /**
     * Calculate appropriate cache TTL based on request characteristics
     */
    getCacheTTL(dish, context, preferences, generatedByAI) {
        // Base TTL
        let ttl = 24 * 60 * 60 * 1000; // 24 hours

        // Adjust based on AI generation
        if (generatedByAI) {
            ttl = 12 * 60 * 60 * 1000; // 12 hours for AI-generated responses
        }

        // Adjust based on context
        if (context.occasion === 'special' || context.event === 'anniversary') {
            ttl = 6 * 60 * 60 * 1000; // 6 hours for special occasions
        }

        // Adjust based on preferences complexity
        if (preferences.dietary_restrictions && preferences.dietary_restrictions.length > 0) {
            ttl = Math.min(ttl, 4 * 60 * 60 * 1000); // Max 4 hours for complex dietary needs
        }

        // Adjust based on season (shorter TTL for seasonal recommendations)
        if (context.season) {
            ttl = Math.min(ttl, 8 * 60 * 60 * 1000); // Max 8 hours for seasonal
        }

        return ttl;
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * Clear cache
     */
    async clearCache() {
        await this.cache.clear();
        console.log('AI Cache: Cleared all cached pairing responses');
    }

    /**
     * Invalidate cache entries by pattern
     */
    async invalidateCache(pattern) {
        const count = await this.cache.invalidatePattern(pattern);
        console.log(`AI Cache: Invalidated ${count} entries matching pattern: ${pattern}`);
        return count;
    }

    /**
     * Invalidate cache entries by dish
     */
    async invalidateCacheByDish(dishPattern) {
        const count = await this.cache.invalidateByDish(dishPattern);
        console.log(`AI Cache: Invalidated ${count} entries for dish: ${dishPattern}`);
        return count;
    }

    /**
     * Invalidate cache entries by context
     */
    async invalidateCacheByContext(contextPattern) {
        const count = await this.cache.invalidateByContext(contextPattern);
        console.log(`AI Cache: Invalidated ${count} entries for context: ${contextPattern}`);
        return count;
    }

    /**
     * Warm up cache with common pairings
     */
    async warmupCache(commonPairings) {
        await this.cache.warmup(commonPairings);
        console.log(`AI Cache: Warmed up with ${commonPairings.length} common pairings`);
    }

    /**
     * Export cache for persistence
     */
    async exportCache() {
        return await this.cache.export();
    }

    /**
     * Import cache from persistence
     */
    async importCache(cacheData) {
        await this.cache.import(cacheData);
        console.log('AI Cache: Imported cache data');
    }

    /**
     * Cleanup cache (remove expired entries)
     */
    async cleanupCache() {
        await this.cache.cleanup();
    }

    /**
     * Destroy cache and cleanup resources
     */
    destroy() {
        this.cache.destroy();
    }
}

module.exports = PairingEngine;
