/**
 * SommOS Pairing Engine
 * AI-powered wine pairing recommendations with expert sommelier knowledge
 * 
 * @fileoverview Advanced wine pairing engine combining AI analysis with traditional sommelier expertise
 * @author SommOS Development Team
 * @version 1.2.0
 * @since 1.0.0
 */

const OpenAI = require('openai');
const Database = require('../database/connection');
const { getConfig } = require('../config/env');
const CollaborativeFilteringEngine = require('./collaborative_filtering_engine');
const EnsembleEngine = require('./ensemble_engine');
const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} Wine
 * @property {number} id - Wine identifier
 * @property {string} name - Wine name
 * @property {string} producer - Wine producer
 * @property {string} region - Wine region
 * @property {string} wine_type - Type of wine (Red, White, Rosé, Sparkling, etc.)
 * @property {string} style - Wine style description
 * @property {string} tasting_notes - Detailed tasting notes
 * @property {number} year - Vintage year
 * @property {number} quality_score - Quality score (0-100)
 * @property {number} quantity - Available quantity
 * @property {string} location - Storage location
 */

/**
 * @typedef {Object} DishContext
 * @property {string} name - Dish name
 * @property {string} cuisine - Cuisine type (e.g., 'french', 'italian')
 * @property {string} preparation - Cooking method (e.g., 'grilled', 'roasted')
 * @property {string} intensity - Flavor intensity ('light', 'medium', 'heavy')
 * @property {string[]} dominant_flavors - Array of dominant flavor profiles
 * @property {string} texture - Dish texture description
 * @property {string} season - Seasonal context
 */

/**
 * @typedef {Object} PairingScore
 * @property {number} total - Combined total score (0-1)
 * @property {number} ai_score - AI confidence score (0-1)
 * @property {number} style_match - Style compatibility score (0-1)
 * @property {number} flavor_harmony - Flavor harmony score (0-1)
 * @property {number} texture_balance - Texture balance score (0-1)
 * @property {number} regional_tradition - Regional tradition score (0-1)
 * @property {number} seasonal_appropriateness - Seasonal appropriateness score (0-1)
 * @property {number} confidence - Overall confidence level (0-1)
 */

/**
 * @typedef {Object} PairingRecommendation
 * @property {Wine} wine - Wine object with full details
 * @property {PairingScore} score - Comprehensive scoring breakdown
 * @property {string} reasoning - Detailed explanation of the pairing
 * @property {boolean} ai_enhanced - Whether AI enhancement was applied
 * @property {string} generated_at - ISO timestamp of generation
 * @property {string} [learning_session_id] - Learning session identifier
 * @property {string} [learning_recommendation_id] - Learning recommendation ID
 */

/**
 * @typedef {Object} PairingContext
 * @property {string} [occasion] - Dining occasion
 * @property {string} [season] - Current season
 * @property {string} [weather] - Weather conditions
 * @property {number} [guestCount] - Number of guests
 * @property {string} [event] - Special event type
 * @property {Object} [owner_preferences] - Yacht owner preferences
 */

/**
 * @typedef {Object} GuestPreferences
 * @property {Object} [guest_preferences] - Guest-specific preferences
 * @property {string[]} [guest_preferences.preferred_types] - Preferred wine types
 * @property {string[]} [guest_preferences.avoided_types] - Wine types to avoid
 * @property {string[]} [guest_preferences.preferred_regions] - Preferred wine regions
 * @property {string[]} [dietary_restrictions] - Dietary restrictions
 * @property {string} [budget_range] - Budget constraints
 */

/**
 * @typedef {Object} PairingOptions
 * @property {number} [maxRecommendations=8] - Maximum recommendations to return
 * @property {boolean} [includeReasoning=true] - Include detailed reasoning
 * @property {boolean} [forceAI=false] - Force AI generation
 */

class PairingEngine {
    constructor(database, learningEngine = null, explainabilityService = null) {
        this.db = database || Database.getInstance();
        this.learningEngine = learningEngine;
        this.explainabilityService = explainabilityService;
        
        // Initialize ML engines
        this.collaborativeFilteringEngine = new CollaborativeFilteringEngine(database || this.db);
        this.ensembleEngine = new EnsembleEngine(database || this.db);
        
        // Load Random Forest model if available
        this.randomForestModel = null;
        this.featureMappings = null;
        this.loadRandomForestModel();
        
        const config = getConfig();
        
        // Respect SOMMOS_DISABLE_EXTERNAL_CALLS flag - skip AI initialization entirely
        if (config.features.disableExternalCalls) {
            console.log('🚫 External calls disabled - AI pairing will use traditional algorithm only');
            this.deepseek = null;
        } else if (config.deepSeek.apiKey) {
            // Initialize AI client only if external calls are enabled and API key is configured
            this.deepseek = new OpenAI({
                apiKey: config.deepSeek.apiKey,
                baseURL: 'https://api.deepseek.com/v1',
            });
            console.log('✅ AI pairing enabled with configured API key');
        } else {
            this.deepseek = null;
            console.log('ℹ️  No AI API keys configured - traditional pairing will be used');
        }
        this.scoringWeights = {
            style_match: 0.25,
            flavor_harmony: 0.30,
            texture_balance: 0.20,
            regional_tradition: 0.15,
            seasonal_appropriateness: 0.10
        };
        
        // Performance optimization: Cache frequently accessed data
        this._cache = {
            wineInventory: null,
            wineInventoryTimestamp: null,
            regionalTraditions: new Map(),
            flavorMappings: new Map()
        };
        
        // Cache TTL in milliseconds (5 minutes)
        this.CACHE_TTL = 5 * 60 * 1000;
        
        // Initialize flavor mappings cache
        this._initializeFlavorMappings();
    }

    /**
     * Load Random Forest model from disk
     * @private
     */
    loadRandomForestModel() {
        try {
            const modelPath = path.join(__dirname, '../models/pairing_model_rf_v2.json');
            const importancePath = path.join(__dirname, '../models/feature_importance.json');
            
            if (fs.existsSync(modelPath)) {
                const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
                this.randomForestModel = modelData;
                console.log(`✅ Random Forest model loaded (${modelData.nTrees} trees)`);
                
                // Load feature mappings if available
                if (fs.existsSync(importancePath)) {
                    const importanceData = JSON.parse(fs.readFileSync(importancePath, 'utf8'));
                    this.featureMappings = importanceData.mappings;
                    console.log('✅ Feature mappings loaded');
                }
            } else {
                console.log('ℹ️  Random Forest model not found, using rule-based scoring');
            }
        } catch (error) {
            console.warn('Failed to load Random Forest model:', error.message);
        }
    }

    /**
     * Predict pairing score using Random Forest model
     * @private
     */
    async predictWithRandomForest(wine, dishContext, preferences) {
        if (!this.randomForestModel || !this.featureMappings) {
            return null;
        }

        try {
            // Build feature vector matching training format
            const features = this.buildFeatureVector(wine, dishContext, preferences);
            
            // Make prediction using ensemble of trees
            const predictions = this.randomForestModel.trees.map(tree => 
                this.predictTree(tree, features)
            );
            
            // Average predictions
            const avgPrediction = predictions.reduce((a, b) => a + b, 0) / predictions.length;
            
            return avgPrediction;
        } catch (error) {
            console.warn('Random Forest prediction error:', error.message);
            return null;
        }
    }

    /**
     * Build feature vector for Random Forest prediction
     * @private
     */
    buildFeatureVector(wine, dishContext, preferences) {
        // Feature order: [cuisine, protein, intensity, wine_type, occasion, season, guest_count, ranking]
        const context = dishContext || {};
        const prefs = preferences || {};
        
        // Get encoded values (or default to 0)
        const cuisineEncoded = this.encodeFeature('cuisines', context.cuisine);
        const proteinEncoded = this.encodeFeature('proteins', context.protein);
        const intensityEncoded = this.encodeFeature('intensities', context.intensity);
        const wineTypeEncoded = this.encodeFeature('wine_types', wine.wine_type);
        const occasionEncoded = this.encodeFeature('occasions', prefs.occasion || context.occasion || 'casual');
        const seasonEncoded = this.encodeFeature('seasons', context.season || this.getCurrentSeason());
        
        // Normalized features
        const guestCountNorm = (prefs.guest_count || prefs.guestCount || context.guest_count || 4) / 12;
        const rankingNorm = 0.5; // Default middle ranking (will be determined by other features)
        
        return [
            cuisineEncoded,
            proteinEncoded,
            intensityEncoded,
            wineTypeEncoded,
            occasionEncoded,
            seasonEncoded,
            guestCountNorm,
            rankingNorm
        ];
    }

    /**
     * Encode categorical feature to numeric value
     * @private
     */
    encodeFeature(category, value) {
        if (!this.featureMappings || !value) {
            return 0;
        }
        
        const mapping = this.featureMappings[category];
        if (!mapping) {
            return 0;
        }
        
        // Find the numeric code for this value
        for (const [code, label] of Object.entries(mapping)) {
            if (label.toLowerCase() === value.toLowerCase()) {
                return parseInt(code, 10);
            }
        }
        
        return 0; // Default if not found
    }

    /**
     * Recursively traverse decision tree to make prediction
     * @private
     */
    predictTree(tree, features) {
        // Leaf node - return value
        if ('value' in tree) {
            return tree.value;
        }
        
        // Decision node - traverse based on feature value
        if (features[tree.feature] <= tree.threshold) {
            return this.predictTree(tree.left, features);
        } else {
            return this.predictTree(tree.right, features);
        }
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
        // Input validation
        if (!dish) {
            throw new Error('Dish information is required for pairing generation');
        }

        // Normalize dish input
        const dishInput = typeof dish === 'string' ? dish : (dish.dish_description || dish.name || '');
        if (!dishInput.trim()) {
            throw new Error('Valid dish description is required');
        }

        const dishContext = typeof dish === 'string'
            ? await this.parseNaturalLanguageDish(dish, context)
            : dish;

        await this.refreshAdaptiveWeights();

        const generatedByAI = this.deepseek && typeof dish === 'string';
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

        return {
            recommendations: withMetadata,
            explanation
        };
    }
    
    /**
     * Generates AI-powered wine pairing recommendations using OpenAI GPT models
     * 
     * This method combines advanced AI analysis with traditional sommelier expertise
     * to provide sophisticated wine pairing recommendations. It leverages OpenAI's
     * language models to understand dish characteristics and match them with available
     * wines from the yacht's cellar inventory.
     * 
     * @async
     * @function generateAIPairings
     * @param {string|Object} dish - The dish description or detailed context object
     *   - If string: Natural language description (e.g., "grilled salmon with lemon butter")
     *   - If object: Structured dish context with cuisine, preparation, intensity, etc.
     * @param {Object} [context={}] - Additional pairing context and environmental factors
     * @param {string} [context.occasion] - Dining occasion (e.g., 'casual', 'formal', 'celebration')
     * @param {string} [context.season] - Current season for seasonal appropriateness
     * @param {string} [context.weather] - Weather conditions affecting preferences
     * @param {number} [context.guestCount] - Number of guests for portion planning
     * @param {string} [context.event] - Special event or celebration type
     * @param {Object} [context.owner_preferences] - Yacht owner's specific preferences
     * @param {Object} [preferences={}] - Guest preferences and dietary constraints
     * @param {Object} [preferences.guest_preferences] - Guest-specific preferences
     * @param {string[]} [preferences.guest_preferences.preferred_types] - Preferred wine types
     * @param {string[]} [preferences.guest_preferences.avoided_types] - Wine types to avoid
     * @param {string[]} [preferences.guest_preferences.preferred_regions] - Preferred wine regions
     * @param {string[]} [preferences.dietary_restrictions] - Dietary restrictions to consider
     * @param {string} [preferences.budget_range] - Budget constraints for wine selection
     * @param {Object} [options={}] - Additional options for customization
     * @param {number} [options.maxRecommendations=8] - Maximum number of recommendations to return
     * @param {boolean} [options.includeReasoning=true] - Whether to include detailed reasoning
     * @param {boolean} [options.forceAI=false] - Force AI generation even if OpenAI is unavailable
     * @param {Object} [dishContext=null] - Pre-parsed dish context to avoid re-parsing
     * @returns {Promise<Array<PairingRecommendation>>} Array of enhanced pairing recommendations
     * @returns {Object} PairingRecommendation.wine - Wine object with full details
     * @returns {Object} PairingRecommendation.score - Comprehensive scoring breakdown
     * @returns {number} PairingRecommendation.score.total - Combined AI + traditional score (0-1)
     * @returns {number} PairingRecommendation.score.ai_score - AI confidence score (0-1)
     * @returns {number} PairingRecommendation.score.style_match - Style compatibility (0-1)
     * @returns {number} PairingRecommendation.score.flavor_harmony - Flavor harmony score (0-1)
     * @returns {number} PairingRecommendation.score.texture_balance - Texture balance (0-1)
     * @returns {number} PairingRecommendation.score.regional_tradition - Regional tradition score (0-1)
     * @returns {number} PairingRecommendation.score.seasonal_appropriateness - Seasonal fit (0-1)
     * @returns {number} PairingRecommendation.score.confidence - Overall confidence level (0-1)
     * @returns {string} PairingRecommendation.reasoning - Detailed explanation of the pairing
     * @returns {boolean} PairingRecommendation.ai_enhanced - Whether AI enhancement was applied
     * @returns {string} [PairingRecommendation.learning_session_id] - Learning session identifier
     * @returns {string} [PairingRecommendation.learning_recommendation_id] - Learning recommendation ID
     * 
     * @throws {Error} When OpenAI API is unavailable and fallback fails
     * @throws {Error} When no wines are available in inventory
     * @throws {Error} When dish parsing fails and no fallback context provided
     * 
     * @example
     * // Basic usage with string dish description
     * const recommendations = await pairingEngine.generateAIPairings(
     *   "pan-seared halibut with asparagus",
     *   { occasion: 'formal', season: 'spring' },
     *   { guest_preferences: { preferred_types: ['White', 'Rosé'] } }
     * );
     * 
     * @example
     * // Advanced usage with structured context
     * const recommendations = await pairingEngine.generateAIPairings(
     *   {
     *     name: "Beef Wellington",
     *     cuisine: "British",
     *     preparation: "roasted",
     *     intensity: "heavy",
     *     dominant_flavors: ["rich", "savory", "umami"]
     *   },
     *   { 
     *     occasion: 'celebration',
     *     weather: 'cool',
     *     guestCount: 12
     *   },
     *   { 
     *     budget_range: 'premium',
     *     dietary_restrictions: ['vegetarian_alternatives']
     *   },
     *   { maxRecommendations: 6, includeReasoning: true }
     * );
     * 
     * @since 1.0.0
     * @version 1.2.0
     * @see {@link generateTraditionalPairings} For fallback when AI is unavailable
     * @see {@link parseNaturalLanguageDish} For dish context parsing
     * @see {@link callOpenAIForPairings} For AI recommendation generation
     */
    async generateAIPairings(dish, context = {}, preferences = {}, options = {}, dishContext = null) {
        // Input validation and sanitization
        if (!dish || (typeof dish !== 'string' && typeof dish !== 'object')) {
            throw new Error('Dish parameter must be a non-empty string or object');
        }
        
        if (typeof context !== 'object' || context === null) {
            context = {};
        }
        
        if (typeof preferences !== 'object' || preferences === null) {
            preferences = {};
        }
        
        if (typeof options !== 'object' || options === null) {
            options = {};
        }

        const maxRecommendations = Math.min(Math.max(options.maxRecommendations || 8, 1), 12);
        const includeReasoning = options.includeReasoning !== false;
        const forceAI = options.forceAI === true;

        try {
            // Check if AI pairing was explicitly requested but no AI keys are configured
            if (forceAI && !this.deepseek) {
                throw new Error(
                    'AI_NOT_CONFIGURED: AI pairing was requested but no API keys are configured. ' +
                    'Please set DEEPSEEK_API_KEY or OPENAI_API_KEY in your environment configuration.'
                );
            }
            
            // If AI is not available and not explicitly required, fall back gracefully to traditional pairing
            if (!this.deepseek && !forceAI) {
                console.warn('AI not available (no API keys configured), falling back to traditional pairing');
                const fallbackDish = dishContext || await this.parseNaturalLanguageDish(dish, context);
                return await this.generateTraditionalPairings(fallbackDish, preferences);
            }

            // Get available wines from inventory with error handling
            const availableWines = await this.getAvailableWines();
            if (!availableWines || availableWines.length === 0) {
                throw new Error('No wines available in inventory for pairing recommendations');
            }

            // Parse dish context if not provided
            const parsedDish = dishContext || await this.parseNaturalLanguageDish(dish, context);
            if (!parsedDish) {
                throw new Error('Failed to parse dish context for AI pairing analysis');
            }
            
            // Create optimized wine inventory summary for AI processing
            const wineInventory = availableWines
                .filter(wine => wine.quantity > 0) // Only include wines with stock
                .map(wine => ({
                    name: wine.name,
                    producer: wine.producer,
                    region: wine.region,
                    wine_type: wine.wine_type,
                    year: wine.year,
                    style: wine.style,
                    tasting_notes: wine.tasting_notes,
                    location: wine.location,
                    quantity: wine.quantity,
                    quality_score: wine.quality_score || 0
                }))
                .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0)); // Prioritize higher quality wines
            
            if (wineInventory.length === 0) {
                throw new Error('No wines with available stock found in inventory');
            }
            
            // Generate AI pairing recommendations with timeout handling
            const aiRecommendations = await Promise.race([
                this.callOpenAIForPairings(dish, context, wineInventory, preferences),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('AI pairing request timeout')), 30000)
                )
            ]);
            
            if (!Array.isArray(aiRecommendations) || aiRecommendations.length === 0) {
                throw new Error('AI failed to generate pairing recommendations');
            }
            
            // Combine AI insights with traditional scoring for enhanced accuracy
            const enhancedPairings = [];
            const processedWines = new Set(); // Prevent duplicate recommendations
            
            for (const aiRec of aiRecommendations) {
                // Validate AI recommendation structure
                if (!aiRec.wine_name || !aiRec.producer) {
                    console.warn('Invalid AI recommendation structure:', aiRec);
                    continue;
                }
                
                // Find matching wine in inventory
                const wine = availableWines.find(w => 
                    w.name === aiRec.wine_name && 
                    w.producer === aiRec.producer &&
                    w.quantity > 0
                );
                
                if (!wine) {
                    console.warn(`Wine not found in inventory: ${aiRec.wine_name} by ${aiRec.producer}`);
                    continue;
                }
                
                // Prevent duplicate recommendations
                const wineKey = `${wine.name}-${wine.producer}-${wine.year}`;
                if (processedWines.has(wineKey)) {
                    continue;
                }
                processedWines.add(wineKey);
                
                // Calculate traditional sommelier score
                const traditionalScore = await this.calculatePairingScore(wine, parsedDish, preferences);
                
                // Validate AI confidence score
                const aiScore = Math.max(0, Math.min(1, aiRec.confidence_score || 0.5));
                
                // Create enhanced pairing with weighted scoring
                const enhancedPairing = {
                    wine,
                    score: {
                        ...traditionalScore,
                        ai_score: aiScore,
                        total: (traditionalScore.total * 0.6) + (aiScore * 0.4)
                    },
                    reasoning: includeReasoning ? (aiRec.reasoning || 'AI-enhanced pairing recommendation') : undefined,
                    ai_enhanced: true,
                    generated_at: new Date().toISOString()
                };
                
                enhancedPairings.push(enhancedPairing);
            }
            
            // Sort by total score and return top recommendations
            const sortedPairings = enhancedPairings
                .sort((a, b) => b.score.total - a.score.total)
                .slice(0, maxRecommendations);
            
            if (sortedPairings.length === 0) {
                throw new Error('No valid AI-enhanced pairings could be generated');
            }
            
            console.log(`Generated ${sortedPairings.length} AI-enhanced pairing recommendations`);
            return sortedPairings;
                
        } catch (error) {
            console.error('AI pairing failed, falling back to traditional pairing:', error.message);
            
            // Attempt graceful fallback to traditional pairing
            try {
                const fallbackDish = dishContext || await this.parseNaturalLanguageDish(dish, context);
                const fallbackPairings = await this.generateTraditionalPairings(fallbackDish, preferences);
                
                console.log(`Fallback successful: Generated ${fallbackPairings.length} traditional pairings`);
                return fallbackPairings.slice(0, maxRecommendations);
                
            } catch (fallbackError) {
                console.error('Traditional pairing fallback also failed:', fallbackError.message);
                throw new Error(`Both AI and traditional pairing failed: ${error.message}`);
            }
        }
    }
    
    /**
     * Traditional rule-based pairing recommendations with ML enhancement
     */
    async generateTraditionalPairings(dishContext, preferences = {}) {
        const { cuisine, preparation, intensity, dominant_flavors } = dishContext;
        const { guest_preferences, dietary_restrictions, budget_range } = preferences;
        const userId = preferences.user_id || preferences.userId;

        // Get available wines from stock
        const availableWines = await this.getAvailableWines();
        
        // Score each wine against the dish (rule-based)
        const ruleBasedPairings = [];
        
        for (const wine of availableWines) {
            const score = await this.calculatePairingScore(wine, dishContext, preferences);
            if (score.total > 0.3) { // Minimum threshold
                ruleBasedPairings.push({
                    wine,
                    score,
                    reasoning: this.generateReasoning(wine, dishContext, score),
                    ai_enhanced: false,
                    ml_enhanced: false
                });
            }
        }

        // Try to get ML recommendations if user_id is provided
        let finalRecommendations = ruleBasedPairings;
        
        if (userId) {
            try {
                const mlRecommendations = await this.getMLRecommendations(
                    userId, 
                    dishContext, 
                    availableWines,
                    preferences
                );
                
                if (mlRecommendations && mlRecommendations.length > 0) {
                    // Blend ML and rule-based recommendations
                    finalRecommendations = await this.blendRecommendations(
                        mlRecommendations,
                        ruleBasedPairings,
                        userId
                    );
                    console.log(`Blended ${mlRecommendations.length} ML recommendations with ${ruleBasedPairings.length} rule-based`);
                }
            } catch (error) {
                console.warn('ML recommendations failed, using rule-based only:', error.message);
                // Fallback to rule-based only
            }
        }

        // Sort by total score and return top recommendations
        return finalRecommendations
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
        
        // Try Random Forest model first, fallback to rule-based
        let total = 0;
        let usedML = false;
        
        if (this.randomForestModel && this.featureMappings) {
            try {
                const mlScore = await this.predictWithRandomForest(wine, dishContext, preferences);
                if (mlScore !== null && mlScore >= 0) {
                    // Normalize ML score from [0-5] to [0-1] range
                    total = Math.min(1.0, Math.max(0, mlScore / 5.0));
                    usedML = true;
                }
            } catch (error) {
                console.warn('Random Forest prediction failed, using rule-based:', error.message);
            }
        }
        
        // Fallback to rule-based scoring
        if (!usedML) {
            for (const [category, score] of Object.entries(scores)) {
                total += score * this.scoringWeights[category];
            }
        }

        return {
            ...scores,
            total: Math.min(1.0, total * preferenceModifier),
            confidence: this.calculateConfidence(scores),
            ml_enhanced: usedML
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

    /**
     * Initialize flavor mappings cache for performance optimization
     * @private
     */
    _initializeFlavorMappings() {
        const complementaryMap = {
            'citrus': ['crisp', 'light', 'earth'],
            'herb': ['earth', 'spice', 'herbal'],
            'rich': ['full', 'tannic', 'sweet', 'smooth'],
            'spicy': ['sweet', 'fruit', 'spice'],
            'sweet': ['sweet', 'fruit', 'smooth'],
            'delicate': ['light', 'floral', 'crisp'],
            'umami': ['earth', 'spice', 'tannic']
        };
        
        const conflictMap = {
            'delicate': ['tannic', 'full'],
            'sweet': ['tannic'],
            'spicy': ['tannic'],
            'citrus': ['tannic']
        };
        
        this._cache.flavorMappings.set('complementary', complementaryMap);
        this._cache.flavorMappings.set('conflict', conflictMap);
    }

    /**
     * Get available wines with caching for performance optimization
     * @async
     * @returns {Promise<Array<Wine>>} Array of available wines with stock information
     * @private
     */
    async getAvailableWines() {
        const now = Date.now();
        
        // Return cached data if still valid
        if (this._cache.wineInventory && 
            this._cache.wineInventoryTimestamp && 
            (now - this._cache.wineInventoryTimestamp) < this.CACHE_TTL) {
            return this._cache.wineInventory;
        }
        
        try {
            const wines = await this.db.query(`
                SELECT w.*, v.year, v.quality_score, s.quantity, s.location,
                       (s.quantity - s.reserved_quantity) as available_quantity
                FROM Stock s
                JOIN Vintages v ON v.id = s.vintage_id
                JOIN Wines w ON w.id = v.wine_id
                WHERE s.quantity > s.reserved_quantity
                ORDER BY v.quality_score DESC NULLS LAST, s.quantity DESC
            `);
            
            // Update cache
            this._cache.wineInventory = wines;
            this._cache.wineInventoryTimestamp = now;
            
            return wines;
        } catch (error) {
            console.error('Failed to fetch available wines:', error.message);
            throw new Error(`Database query failed: ${error.message}`);
        }
    }

    /**
     * Clear wine inventory cache (useful after inventory updates)
     * @public
     */
    clearWineInventoryCache() {
        this._cache.wineInventory = null;
        this._cache.wineInventoryTimestamp = null;
    }

    /**
     * Clear all caches (useful for testing or when data changes)
     * @public
     */
    clearAllCaches() {
        this._cache.wineInventory = null;
        this._cache.wineInventoryTimestamp = null;
        this._cache.regionalTraditions.clear();
        // Note: flavorMappings cache is not cleared as it contains static data
    }

    /**
     * Get cache statistics for monitoring and debugging
     * @returns {Object} Cache statistics
     * @public
     */
    getCacheStats() {
        return {
            wineInventoryCached: this._cache.wineInventory !== null,
            wineInventoryAge: this._cache.wineInventoryTimestamp ? 
                Date.now() - this._cache.wineInventoryTimestamp : null,
            regionalTraditionsCount: this._cache.regionalTraditions.size,
            flavorMappingsCount: this._cache.flavorMappings.size,
            cacheTTL: this.CACHE_TTL
        };
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

    /**
     * Check if a dish flavor is complementary to wine descriptors
     * @param {string} dishFlavor - The dish flavor to check
     * @param {Array|Set} wineDescriptors - Wine flavor descriptors
     * @returns {boolean} True if flavors are complementary
     * @private
     */
    isComplementaryFlavor(dishFlavor, wineDescriptors) {
        const complementaryMap = this._cache.flavorMappings.get('complementary');
        const descriptors = Array.isArray(wineDescriptors) ? wineDescriptors : Array.from(wineDescriptors);
        return complementaryMap[dishFlavor]?.some(f => descriptors.includes(f)) || false;
    }

    /**
     * Check if a dish flavor conflicts with wine descriptors
     * @param {string} dishFlavor - The dish flavor to check
     * @param {Array|Set} wineDescriptors - Wine flavor descriptors
     * @returns {boolean} True if flavors conflict
     * @private
     */
    isConflictingFlavor(dishFlavor, wineDescriptors) {
        const conflictMap = this._cache.flavorMappings.get('conflict');
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
        if (month >= 8 && month <= 10) return 'fall';
        return 'winter';
    }

    /**
     * Parse AI response with error recovery
     * Handles markdown code blocks, extra whitespace, and malformed JSON
     * @private
     */
    _parseAIResponse(content) {
        if (!content || typeof content !== 'string') {
            throw new Error('Invalid AI response: empty or non-string content');
        }
        
        // Remove markdown code blocks (```json ... ``` or ``` ... ```)
        let cleaned = content.trim();
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/gm, '');
        cleaned = cleaned.replace(/\n?```\s*$/gm, '');
        cleaned = cleaned.trim();
        
        // Try to find JSON array or object
        const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }
        
        try {
            return JSON.parse(cleaned);
        } catch (error) {
            console.error('[AI] JSON parse error:', error.message);
            console.error('[AI] Raw content:', content.substring(0, 200));
            throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
        }
    }

    /**
     * Validate and normalize AI pairing recommendation
     * @private
     */
    _validatePairingRecommendation(rec) {
        if (!rec || typeof rec !== 'object') {
            return null;
        }
        
        // Required fields
        if (!rec.wine_name || !rec.producer) {
            console.warn('[AI] Invalid recommendation: missing wine_name or producer');
            return null;
        }
        
        // Normalize confidence score
        let confidence = parseFloat(rec.confidence_score);
        if (isNaN(confidence) || confidence < 0) {
            confidence = 0.5; // Default moderate confidence
        } else if (confidence > 1) {
            confidence = confidence / 100; // Convert percentage to decimal
        }
        confidence = Math.max(0.1, Math.min(1.0, confidence));
        
        return {
            wine_name: String(rec.wine_name).trim(),
            producer: String(rec.producer).trim(),
            confidence_score: confidence,
            reasoning: rec.reasoning ? String(rec.reasoning).trim() : 'AI-recommended pairing'
        };
    }

    /**
     * Generate a cache key for AI pairing requests
     * Creates a stable hash based on dish, context, and available wine inventory
     * @private
     */
    _generatePairingCacheKey(dish, context, wineInventory, preferences) {
        const crypto = require('crypto');
        
        // Create a normalized representation
        const normalized = {
            dish: String(dish || '').toLowerCase().trim(),
            context: {
                cuisine: context?.cuisine || '',
                occasion: context?.occasion || '',
                season: context?.season || this.getCurrentSeason()
            },
            preferences: {
                preferred_types: preferences?.guest_preferences?.preferred_types || [],
                avoided_types: preferences?.guest_preferences?.avoided_types || []
            },
            // Use top 10 wines as inventory signature
            inventory_signature: wineInventory.slice(0, 10).map(w => `${w.name}-${w.producer}-${w.year}`).join('|')
        };
        
        const hashInput = JSON.stringify(normalized);
        const hash = crypto.createHash('md5').update(hashInput).digest('hex');
        
        return `pairing:${hash}`;
    }
}

module.exports = PairingEngine;
