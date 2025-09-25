/**
 * SommOS Pairing Engine
 * AI-powered wine pairing recommendations with expert sommelier knowledge
 */

const OpenAI = require('openai');
const Database = require('../database/connection');

class PairingEngine {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        }) : null;
        this.scoringWeights = {
            style_match: 0.25,
            flavor_harmony: 0.30,
            texture_balance: 0.20,
            regional_tradition: 0.15,
            seasonal_appropriateness: 0.10
        };
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
        // Handle both string and object inputs for backward compatibility
        const dishContext = typeof dish === 'string' ? 
            await this.parseNaturalLanguageDish(dish, context) : 
            dish;
            
        // If AI is available, enhance with AI recommendations
        if (this.openai && typeof dish === 'string') {
            return await this.generateAIPairings(dish, context, preferences, options);
        }
        
        return await this.generateTraditionalPairings(dishContext, preferences);
    }
    
    /**
     * Generate AI-powered pairing recommendations
     */
    async generateAIPairings(dish, context = {}, preferences = {}, options = {}) {
        try {
            // Get available wines from inventory
            const availableWines = await this.getAvailableWines();
            
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
                        await this.parseNaturalLanguageDish(dish, context), preferences);
                    
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
            return await this.generateTraditionalPairings(
                await this.parseNaturalLanguageDish(dish, context), preferences
            );
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
        if (!this.openai) {
            // Fallback to rule-based quick pairing
            const availableWines = await this.getAvailableWines();
            return availableWines.slice(0, 3).map(wine => ({
                wine,
                reasoning: 'Quick selection based on availability and general pairing rules',
                confidence: 0.6
            }));
        }
        
        try {
            const quickInventory = (await this.getAvailableWines()).slice(0, 20);
            const recommendations = await this.callOpenAIForPairings(dish, {
                ...context,
                urgency: 'quick_service',
                owner_preferences: ownerLikes
            }, quickInventory, {});
            
            return recommendations.slice(0, 3).map(rec => ({
                wine: quickInventory.find(w => w.name === rec.wine_name && w.producer === rec.producer),
                reasoning: rec.reasoning,
                confidence: rec.confidence_score
            })).filter(p => p.wine);
            
        } catch (error) {
            console.error('Quick pairing error:', error.message);
            const availableWines = await this.getAvailableWines();
            return availableWines.slice(0, 3).map(wine => ({
                wine,
                reasoning: 'Quick selection (AI unavailable)',
                confidence: 0.5
            }));
        }
    }
}

module.exports = PairingEngine;
