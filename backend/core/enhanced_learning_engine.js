/**
 * Enhanced SommOS Learning Engine
 * Advanced machine learning capabilities with granular feedback and feature engineering
 */

const Database = require('../database/connection');
const FeatureEngineeringService = require('./feature_engineering_service');

class EnhancedLearningEngine {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.featureService = new FeatureEngineeringService(this.db);
        
        // Enhanced parameter cache
        this.parameterCache = {};
        this.featureCache = new Map();
        
        // Advanced default weights with more granular categories
        this.defaultPairingWeights = {
            style_match: 0.20,
            flavor_harmony: 0.25,
            texture_balance: 0.15,
            regional_tradition: 0.12,
            seasonal_appropriateness: 0.08,
            acidity_match: 0.10,
            tannin_balance: 0.05,
            body_match: 0.05
        };

        this.defaultProcurementWeights = {
            stock_urgency: 0.25,
            value_proposition: 0.20,
            quality_score: 0.15,
            supplier_reliability: 0.12,
            seasonal_relevance: 0.10,
            budget_alignment: 0.08,
            demand_prediction: 0.10
        };

        this.parametersLoaded = false;
    }

    async initialize() {
        await this.loadParameters();
        await this.initializeFeatureCache();
    }

    async loadParameters() {
        try {
            // Check if database is available and table exists
            await this.db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='LearningParameters'`);
            
            const rows = await this.db.all(`
                SELECT parameter_name, parameter_value
                FROM LearningParameters
            `);

            this.parameterCache = rows.reduce((cache, row) => {
                try {
                    cache[row.parameter_name] = JSON.parse(row.parameter_value);
                } catch (error) {
                    console.warn(`Failed to parse learning parameter ${row.parameter_name}:`, error.message);
                }
                return cache;
            }, {});

            this.parametersLoaded = true;
        } catch (error) {
            // Silently handle missing table or database issues in test environment
            if (process.env.NODE_ENV === 'test') {
                this.parameterCache = {};
                this.parametersLoaded = true;
            } else {
                console.warn('Unable to load learning parameters:', error.message);
                this.parameterCache = {};
            }
        }
    }

    async initializeFeatureCache() {
        try {
            // Check if database is available and tables exist
            await this.db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='Wines'`);
            await this.db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='Stock'`);
            
            // Pre-load frequently used wine features
            const popularWines = await this.db.all(`
                SELECT w.id, w.name
                FROM Wines w
                JOIN Stock s ON w.id = s.vintage_id
                WHERE s.quantity > 0
                ORDER BY s.quantity DESC
                LIMIT 50
            `);

            for (const wine of popularWines) {
                try {
                    const features = await this.featureService.getWineFeatures(wine.id);
                    if (features) {
                        this.featureCache.set(`wine_${wine.id}`, features);
                    }
                } catch (error) {
                    console.warn(`Failed to cache features for wine ${wine.id}:`, error.message);
                }
            }
        } catch (error) {
            // Silently handle missing tables or database issues in test environment
            if (process.env.NODE_ENV === 'test') {
                this.featureCache = new Map();
            } else {
                console.warn('Failed to initialize feature cache:', error.message);
            }
        }
    }

    /**
     * Record enhanced pairing feedback with granular ratings
     */
    async recordEnhancedPairingFeedback(feedbackData) {
        const {
            recommendation_id,
            user_id,
            session_id,
            ratings,
            context,
            behavioral_data,
            additional_feedback
        } = feedbackData;

        if (!recommendation_id || !ratings) {
            throw new Error('recommendation_id and ratings are required');
        }

        try {
            // Validate ratings
            const validatedRatings = this.validateRatings(ratings);
            const validatedContext = this.validateContext(context);
            const validatedBehavioral = this.validateBehavioralData(behavioral_data);

            await this.db.run(`
                INSERT INTO LearningPairingFeedbackEnhanced (
                    recommendation_id, user_id, session_id,
                    overall_rating, flavor_harmony_rating, texture_balance_rating,
                    acidity_match_rating, tannin_balance_rating, body_match_rating,
                    regional_tradition_rating,
                    occasion, guest_count, time_of_day, season, weather_context,
                    selected, time_to_select, viewed_duration,
                    notes, would_recommend, price_satisfaction
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                recommendation_id,
                user_id || null,
                session_id || null,
                validatedRatings.overall,
                validatedRatings.flavor_harmony,
                validatedRatings.texture_balance,
                validatedRatings.acidity_match,
                validatedRatings.tannin_balance,
                validatedRatings.body_match,
                validatedRatings.regional_tradition,
                validatedContext.occasion,
                validatedContext.guest_count,
                validatedContext.time_of_day,
                validatedContext.season,
                validatedContext.weather_context,
                validatedBehavioral.selected,
                validatedBehavioral.time_to_select,
                validatedBehavioral.viewed_duration,
                additional_feedback?.notes || null,
                additional_feedback?.would_recommend || null,
                additional_feedback?.price_satisfaction || null
            ]);

            // Update learning models with new feedback
            await this.updateAdvancedPairingWeights();
            await this.updateUserPreferenceProfile(user_id, feedbackData);
            await this.updateFeatureInteractions(recommendation_id, feedbackData);

            return true;
        } catch (error) {
            console.error('Failed to record enhanced pairing feedback:', error.message);
            throw error;
        }
    }

    /**
     * Update advanced pairing weights using machine learning techniques
     */
    async updateAdvancedPairingWeights() {
        try {
            const feedbackData = await this.db.all(`
                SELECT 
                    r.wine_id,
                    r.wine_name,
                    r.wine_type,
                    r.region,
                    r.score_breakdown,
                    f.overall_rating,
                    f.flavor_harmony_rating,
                    f.texture_balance_rating,
                    f.acidity_match_rating,
                    f.tannin_balance_rating,
                    f.body_match_rating,
                    f.regional_tradition_rating,
                    f.occasion,
                    f.season,
                    f.time_of_day,
                    f.selected,
                    f.time_to_select,
                    f.viewed_duration
                FROM LearningPairingRecommendations r
                JOIN LearningPairingFeedbackEnhanced f ON f.recommendation_id = r.id
                WHERE f.overall_rating IS NOT NULL
                ORDER BY f.created_at DESC
                LIMIT 1000
            `);

            if (feedbackData.length === 0) {
                return;
            }

            // Calculate advanced weights using multiple algorithms
            const weights = await this.calculateAdvancedWeights(feedbackData);
            
            // Apply confidence-based weighting
            const confidenceWeights = this.applyConfidenceWeighting(weights, feedbackData);
            
            // Normalize and store weights
            const normalizedWeights = this.normalizeWeights(confidenceWeights, this.defaultPairingWeights);
            await this.setParameter('enhanced_pairing_weights', normalizedWeights);

            // Store learning metrics
            await this.recordLearningMetrics('pairing_accuracy', this.calculatePairingAccuracy(feedbackData));
            await this.recordLearningMetrics('user_satisfaction', this.calculateUserSatisfaction(feedbackData));

        } catch (error) {
            console.error('Failed to update advanced pairing weights:', error.message);
        }
    }

    /**
     * Calculate advanced weights using multiple ML techniques
     */
    async calculateAdvancedWeights(feedbackData) {
        const weightCategories = {
            style_match: { score: 0, weight: 0, count: 0 },
            flavor_harmony: { score: 0, weight: 0, count: 0 },
            texture_balance: { score: 0, weight: 0, count: 0 },
            regional_tradition: { score: 0, weight: 0, count: 0 },
            seasonal_appropriateness: { score: 0, weight: 0, count: 0 },
            acidity_match: { score: 0, weight: 0, count: 0 },
            tannin_balance: { score: 0, weight: 0, count: 0 },
            body_match: { score: 0, weight: 0, count: 0 }
        };

        for (const feedback of feedbackData) {
            const rating = feedback.overall_rating / 5; // Normalize to 0-1
            const timeWeight = this.calculateTimeWeight(feedback.time_to_select);
            const selectionWeight = feedback.selected ? 1.2 : 0.8;
            const combinedWeight = rating * timeWeight * selectionWeight;

            // Process each rating category
            if (feedback.flavor_harmony_rating) {
                const categoryRating = feedback.flavor_harmony_rating / 5;
                weightCategories.flavor_harmony.score += categoryRating * combinedWeight;
                weightCategories.flavor_harmony.weight += combinedWeight;
                weightCategories.flavor_harmony.count++;
            }

            if (feedback.texture_balance_rating) {
                const categoryRating = feedback.texture_balance_rating / 5;
                weightCategories.texture_balance.score += categoryRating * combinedWeight;
                weightCategories.texture_balance.weight += combinedWeight;
                weightCategories.texture_balance.count++;
            }

            if (feedback.acidity_match_rating) {
                const categoryRating = feedback.acidity_match_rating / 5;
                weightCategories.acidity_match.score += categoryRating * combinedWeight;
                weightCategories.acidity_match.weight += combinedWeight;
                weightCategories.acidity_match.count++;
            }

            if (feedback.tannin_balance_rating) {
                const categoryRating = feedback.tannin_balance_rating / 5;
                weightCategories.tannin_balance.score += categoryRating * combinedWeight;
                weightCategories.tannin_balance.weight += combinedWeight;
                weightCategories.tannin_balance.count++;
            }

            if (feedback.body_match_rating) {
                const categoryRating = feedback.body_match_rating / 5;
                weightCategories.body_match.score += categoryRating * combinedWeight;
                weightCategories.body_match.weight += combinedWeight;
                weightCategories.body_match.count++;
            }

            if (feedback.regional_tradition_rating) {
                const categoryRating = feedback.regional_tradition_rating / 5;
                weightCategories.regional_tradition.score += categoryRating * combinedWeight;
                weightCategories.regional_tradition.weight += combinedWeight;
                weightCategories.regional_tradition.count++;
            }

            // Calculate seasonal appropriateness from context
            const seasonalScore = this.calculateSeasonalScore(feedback.season, feedback.occasion);
            weightCategories.seasonal_appropriateness.score += seasonalScore * combinedWeight;
            weightCategories.seasonal_appropriateness.weight += combinedWeight;
            weightCategories.seasonal_appropriateness.count++;
        }

        // Calculate final weights
        const finalWeights = {};
        for (const [category, data] of Object.entries(weightCategories)) {
            if (data.weight > 0) {
                const normalizedScore = data.score / data.weight;
                const defaultWeight = this.defaultPairingWeights[category];
                // Blend learned weight with default (60% learned, 40% default)
                finalWeights[category] = 0.6 * normalizedScore + 0.4 * defaultWeight;
            } else {
                finalWeights[category] = this.defaultPairingWeights[category];
            }
        }

        return finalWeights;
    }

    /**
     * Apply confidence-based weighting to learned weights
     */
    applyConfidenceWeighting(weights, feedbackData) {
        const confidenceFactors = {
            sample_size: Math.min(1, feedbackData.length / 100), // More samples = higher confidence
            user_consistency: this.calculateUserConsistency(feedbackData),
            temporal_freshness: this.calculateTemporalFreshness(feedbackData),
            rating_distribution: this.calculateRatingDistribution(feedbackData)
        };

        const overallConfidence = Object.values(confidenceFactors).reduce((a, b) => a + b, 0) / 4;

        // Adjust weights based on confidence
        const adjustedWeights = {};
        for (const [category, weight] of Object.entries(weights)) {
            const defaultWeight = this.defaultPairingWeights[category];
            // Higher confidence = more weight to learned values
            adjustedWeights[category] = (overallConfidence * weight) + ((1 - overallConfidence) * defaultWeight);
        }

        return adjustedWeights;
    }

    /**
     * Update user preference profile
     */
    async updateUserPreferenceProfile(userId, feedbackData) {
        if (!userId) return;

        try {
            const existingProfile = await this.db.get(`
                SELECT * FROM UserPreferenceProfiles WHERE user_id = ?
            `, [userId]);

            const preferences = this.calculateUserPreferences(feedbackData);
            const behavioralPatterns = this.calculateBehavioralPatterns(feedbackData);

            if (existingProfile) {
                // Update existing profile
                await this.db.run(`
                    UPDATE UserPreferenceProfiles SET
                        wine_type_preferences = ?,
                        region_preferences = ?,
                        style_preferences = ?,
                        price_preferences = ?,
                        preferred_occasions = ?,
                        preferred_times = ?,
                        seasonal_preferences = ?,
                        feedback_consistency = ?,
                        preference_stability = ?,
                        total_feedback_count = total_feedback_count + 1,
                        last_feedback_at = CURRENT_TIMESTAMP,
                        profile_confidence = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `, [
                    JSON.stringify(preferences.wineTypes),
                    JSON.stringify(preferences.regions),
                    JSON.stringify(preferences.styles),
                    JSON.stringify(preferences.prices),
                    JSON.stringify(behavioralPatterns.occasions),
                    JSON.stringify(behavioralPatterns.times),
                    JSON.stringify(behavioralPatterns.seasons),
                    preferences.consistency,
                    preferences.stability,
                    preferences.confidence,
                    userId
                ]);
            } else {
                // Create new profile
                await this.db.run(`
                    INSERT INTO UserPreferenceProfiles (
                        user_id, wine_type_preferences, region_preferences,
                        style_preferences, price_preferences, preferred_occasions,
                        preferred_times, seasonal_preferences, feedback_consistency,
                        preference_stability, total_feedback_count, profile_confidence
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    userId,
                    JSON.stringify(preferences.wineTypes),
                    JSON.stringify(preferences.regions),
                    JSON.stringify(preferences.styles),
                    JSON.stringify(preferences.prices),
                    JSON.stringify(behavioralPatterns.occasions),
                    JSON.stringify(behavioralPatterns.times),
                    JSON.stringify(behavioralPatterns.seasons),
                    preferences.consistency,
                    preferences.stability,
                    1,
                    preferences.confidence
                ]);
            }
        } catch (error) {
            console.error('Failed to update user preference profile:', error.message);
        }
    }

    /**
     * Update feature interactions
     */
    async updateFeatureInteractions(recommendationId, feedbackData) {
        try {
            // Get wine and dish features for this recommendation
            const recommendation = await this.db.get(`
                SELECT r.*, s.dish_description, s.dish_context
                FROM LearningPairingRecommendations r
                JOIN LearningPairingSessions s ON r.session_id = s.id
                WHERE r.id = ?
            `, [recommendationId]);

            if (!recommendation) return;

            const wineFeatures = await this.featureService.getWineFeatures(recommendation.wine_id);
            const dishFeatures = await this.featureService.getDishFeatures(recommendation.dish_description);

            if (!wineFeatures || !dishFeatures) return;

            const success = feedbackData.ratings.overall >= 4 ? 1 : 0;
            const interactionType = 'pairing';

            await this.db.run(`
                INSERT INTO FeatureInteractions (
                    wine_feature_id, dish_feature_id, interaction_type,
                    success_count, total_count, success_rate, context_factors
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(wine_feature_id, dish_feature_id, interaction_type) DO UPDATE SET
                    success_count = success_count + ?,
                    total_count = total_count + 1,
                    success_rate = (success_count + ?) / (total_count + 1),
                    context_factors = ?,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                wineFeatures.id,
                dishFeatures.id,
                interactionType,
                success,
                1,
                success,
                JSON.stringify(feedbackData.context),
                success,
                success,
                JSON.stringify(feedbackData.context)
            ]);
        } catch (error) {
            console.error('Failed to update feature interactions:', error.message);
        }
    }

    /**
     * Get enhanced pairing weights
     */
    async getEnhancedPairingWeights() {
        const stored = await this.getParameter('enhanced_pairing_weights', null);
        if (!stored) {
            return { ...this.defaultPairingWeights };
        }
        return this.normalizeWeights(stored, this.defaultPairingWeights);
    }

    /**
     * Get user preference profile
     */
    async getUserPreferenceProfile(userId) {
        if (!userId) return null;

        const profile = await this.db.get(`
            SELECT * FROM UserPreferenceProfiles WHERE user_id = ?
        `, [userId]);

        if (!profile) return null;

        return {
            userId: profile.user_id,
            wineTypePreferences: JSON.parse(profile.wine_type_preferences || '{}'),
            regionPreferences: JSON.parse(profile.region_preferences || '{}'),
            stylePreferences: JSON.parse(profile.style_preferences || '{}'),
            pricePreferences: JSON.parse(profile.price_preferences || '{}'),
            preferredOccasions: JSON.parse(profile.preferred_occasions || '[]'),
            preferredTimes: JSON.parse(profile.preferred_times || '[]'),
            seasonalPreferences: JSON.parse(profile.seasonal_preferences || '{}'),
            feedbackConsistency: profile.feedback_consistency,
            preferenceStability: profile.preference_stability,
            totalFeedbackCount: profile.total_feedback_count,
            profileConfidence: profile.profile_confidence
        };
    }

    /**
     * Get feature interactions for recommendations
     */
    async getFeatureInteractions(wineId, dishDescription) {
        try {
            const wineFeatures = await this.featureService.getWineFeatures(wineId);
            const dishFeatures = await this.featureService.getDishFeatures(dishDescription);

            if (!wineFeatures || !dishFeatures) return null;

            const interactions = await this.db.all(`
                SELECT * FROM FeatureInteractions
                WHERE wine_feature_id = ? AND dish_feature_id = ?
                ORDER BY success_rate DESC
            `, [wineFeatures.id, dishFeatures.id]);

            return interactions;
        } catch (error) {
            console.error('Failed to get feature interactions:', error.message);
            return null;
        }
    }

    // Validation methods
    validateRatings(ratings) {
        const validated = {};
        const ratingFields = [
            'overall', 'flavor_harmony', 'texture_balance', 'acidity_match',
            'tannin_balance', 'body_match', 'regional_tradition'
        ];

        for (const field of ratingFields) {
            const value = ratings[field];
            if (typeof value === 'number' && value >= 1 && value <= 5) {
                validated[field] = Math.round(value);
            } else {
                validated[field] = null;
            }
        }

        return validated;
    }

    validateContext(context) {
        if (!context) return {};

        return {
            occasion: context.occasion || null,
            guest_count: typeof context.guest_count === 'number' ? context.guest_count : null,
            time_of_day: context.time_of_day || null,
            season: context.season || null,
            weather_context: context.weather_context || null
        };
    }

    validateBehavioralData(behavioral) {
        if (!behavioral) return {};

        return {
            selected: typeof behavioral.selected === 'boolean' ? behavioral.selected : true,
            time_to_select: typeof behavioral.time_to_select === 'number' ? behavioral.time_to_select : null,
            viewed_duration: typeof behavioral.viewed_duration === 'number' ? behavioral.viewed_duration : null
        };
    }

    // Helper methods for weight calculations
    calculateTimeWeight(timeToSelect) {
        if (!timeToSelect) return 1.0;
        // Faster selection = higher confidence
        if (timeToSelect < 30) return 1.2;
        if (timeToSelect < 60) return 1.1;
        if (timeToSelect < 120) return 1.0;
        return 0.9;
    }

    calculateSeasonalScore(season, occasion) {
        const seasonalPreferences = {
            'spring': { 'lunch': 0.8, 'dinner': 0.7, 'cocktail': 0.9 },
            'summer': { 'lunch': 0.9, 'dinner': 0.8, 'cocktail': 1.0 },
            'autumn': { 'lunch': 0.7, 'dinner': 0.9, 'cocktail': 0.8 },
            'winter': { 'lunch': 0.6, 'dinner': 1.0, 'cocktail': 0.7 }
        };

        return seasonalPreferences[season]?.[occasion] || 0.7;
    }

    calculateUserConsistency(feedbackData) {
        // Calculate how consistent user ratings are
        const ratings = feedbackData.map(f => f.overall_rating);
        if (ratings.length < 2) return 0.5;

        const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        const variance = ratings.reduce((acc, rating) => acc + Math.pow(rating - mean, 2), 0) / ratings.length;
        const stdDev = Math.sqrt(variance);

        // Lower standard deviation = higher consistency
        return Math.max(0, 1 - (stdDev / 2));
    }

    calculateTemporalFreshness(feedbackData) {
        const now = new Date();
        const recentFeedback = feedbackData.filter(f => {
            const feedbackDate = new Date(f.created_at || now);
            const daysDiff = (now - feedbackDate) / (1000 * 60 * 60 * 24);
            return daysDiff < 30;
        });

        return Math.min(1, recentFeedback.length / 10);
    }

    calculateRatingDistribution(feedbackData) {
        const ratings = feedbackData.map(f => f.overall_rating);
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        ratings.forEach(rating => {
            distribution[rating] = (distribution[rating] || 0) + 1;
        });

        // Check if distribution is balanced (not all 5s or all 1s)
        const total = ratings.length;
        const maxCount = Math.max(...Object.values(distribution));
        return 1 - (maxCount / total);
    }

    calculatePairingAccuracy(feedbackData) {
        const highRatings = feedbackData.filter(f => f.overall_rating >= 4).length;
        return highRatings / feedbackData.length;
    }

    calculateUserSatisfaction(feedbackData) {
        const avgRating = feedbackData.reduce((sum, f) => sum + f.overall_rating, 0) / feedbackData.length;
        return avgRating / 5; // Normalize to 0-1
    }

    calculateUserPreferences(feedbackData) {
        // This would analyze feedback patterns to determine user preferences
        // For now, return default structure
        return {
            wineTypes: {},
            regions: {},
            styles: {},
            prices: {},
            consistency: 0.5,
            stability: 0.5,
            confidence: 0.5
        };
    }

    calculateBehavioralPatterns(feedbackData) {
        // Analyze behavioral patterns from feedback
        return {
            occasions: [],
            times: [],
            seasons: []
        };
    }

    async recordLearningMetrics(metricName, metricValue, context = {}) {
        try {
            await this.db.run(`
                INSERT INTO LearningMetrics (
                    metric_name, metric_value, metric_context, measurement_date,
                    measurement_period, model_version, algorithm_type
                ) VALUES (?, ?, ?, CURRENT_DATE, 'daily', 'enhanced_v1', 'ml_ensemble')
            `, [
                metricName,
                metricValue,
                JSON.stringify(context)
            ]);
        } catch (error) {
            console.error('Failed to record learning metrics:', error.message);
        }
    }

    // Utility methods (inherited from original learning engine)
    async ensureParametersLoaded() {
        if (!this.parametersLoaded) {
            await this.loadParameters();
        }
    }

    async getParameter(name, defaultValue) {
        await this.ensureParametersLoaded();
        if (this.parameterCache[name]) {
            return this.parameterCache[name];
        }
        return defaultValue;
    }

    async setParameter(name, value) {
        try {
            await this.db.run(`
                INSERT INTO LearningParameters (parameter_name, parameter_value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(parameter_name) DO UPDATE SET
                    parameter_value = excluded.parameter_value,
                    updated_at = CURRENT_TIMESTAMP
            `, [name, JSON.stringify(value)]);

            this.parameterCache[name] = value;
        } catch (error) {
            console.error(`Failed to persist learning parameter ${name}:`, error.message);
        }
    }

    normalizeWeights(weights, defaults) {
        const normalized = { ...defaults, ...weights };
        let total = 0;

        for (const value of Object.values(normalized)) {
            total += Number.isFinite(value) ? value : 0;
        }

        if (total <= 0) {
            return { ...defaults };
        }

        for (const key of Object.keys(normalized)) {
            normalized[key] = Math.max(0.01, normalized[key] / total);
        }

        return normalized;
    }

    // Backward compatibility methods
    async getPairingWeights() {
        return await this.getEnhancedPairingWeights();
    }

    async getProcurementWeights() {
        const stored = await this.getParameter('procurement_weights', null);
        if (!stored) {
            return { ...this.defaultProcurementWeights };
        }
        return this.normalizeWeights(stored, this.defaultProcurementWeights);
    }

    async getDemandMultipliers() {
        const stored = await this.getParameter('demand_factors', {});
        return stored || {};
    }

    getDemandMultiplier(wineType) {
        const factors = this.parameterCache.demand_factors || {};
        return factors?.[wineType] || 1;
    }

    async recordPairingFeedback(recommendationId, rating, notes = '', selected = true) {
        // Convert old format to new format
        const enhancedFeedback = {
            recommendation_id: recommendationId,
            ratings: { overall: rating },
            context: {},
            behavioral_data: { selected },
            additional_feedback: { notes }
        };

        return await this.recordEnhancedPairingFeedback(enhancedFeedback);
    }
}

module.exports = EnhancedLearningEngine;