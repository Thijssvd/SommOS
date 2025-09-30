/**
 * Advanced Weighting Engine
 * Implements sophisticated weighting algorithms for learning from feedback
 */

const Database = require('../database/connection');

class AdvancedWeightingEngine {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.weightCache = new Map();
        this.cacheExpiry = 60 * 60 * 1000; // 1 hour
    }

    /**
     * Calculate advanced weights using multiple algorithms
     */
    async calculateAdvancedWeights(feedbackData, options = {}) {
        const {
            algorithm = 'ensemble',
            confidenceThreshold = 0.7,
            temporalDecay = true,
            contextAware = true
        } = options;

        try {
            let weights;

            switch (algorithm) {
                case 'confidence_based':
                    weights = await this.calculateConfidenceBasedWeights(feedbackData);
                    break;
                case 'temporal_decay':
                    weights = await this.calculateTemporalDecayWeights(feedbackData);
                    break;
                case 'context_aware':
                    weights = await this.calculateContextAwareWeights(feedbackData);
                    break;
                case 'ensemble':
                default:
                    weights = await this.calculateEnsembleWeights(feedbackData, {
                        confidenceThreshold,
                        temporalDecay,
                        contextAware
                    });
                    break;
            }

            return this.normalizeWeights(weights);
        } catch (error) {
            console.error('Advanced weighting calculation failed:', error.message);
            return this.getDefaultWeights();
        }
    }

    /**
     * Confidence-based weighting
     * Weight feedback by user expertise and consistency
     */
    async calculateConfidenceBasedWeights(feedbackData) {
        const weightCategories = {
            style_match: { score: 0, weight: 0, confidence: 0 },
            flavor_harmony: { score: 0, weight: 0, confidence: 0 },
            texture_balance: { score: 0, weight: 0, confidence: 0 },
            regional_tradition: { score: 0, weight: 0, confidence: 0 },
            seasonal_appropriateness: { score: 0, weight: 0, confidence: 0 },
            acidity_match: { score: 0, weight: 0, confidence: 0 },
            tannin_balance: { score: 0, weight: 0, confidence: 0 },
            body_match: { score: 0, weight: 0, confidence: 0 }
        };

        for (const feedback of feedbackData) {
            const confidence = await this.calculateUserConfidence(feedback.user_id);
            const timeWeight = this.calculateTimeWeight(feedback.time_to_select);
            const selectionWeight = feedback.selected ? 1.2 : 0.8;
            const combinedWeight = confidence * timeWeight * selectionWeight;

            const rating = feedback.overall_rating / 5; // Normalize to 0-1

            // Process each rating category
            const categories = [
                'flavor_harmony', 'texture_balance', 'acidity_match',
                'tannin_balance', 'body_match', 'regional_tradition'
            ];

            for (const category of categories) {
                const categoryRating = feedback[`${category}_rating`];
                if (categoryRating) {
                    const normalizedRating = categoryRating / 5;
                    weightCategories[category].score += normalizedRating * combinedWeight;
                    weightCategories[category].weight += combinedWeight;
                    weightCategories[category].confidence += confidence;
                }
            }

            // Calculate seasonal appropriateness from context
            const seasonalScore = this.calculateSeasonalScore(feedback.season, feedback.occasion);
            weightCategories.seasonal_appropriateness.score += seasonalScore * combinedWeight;
            weightCategories.seasonal_appropriateness.weight += combinedWeight;
            weightCategories.seasonal_appropriateness.confidence += confidence;
        }

        // Calculate final weights with confidence adjustment
        const finalWeights = {};
        for (const [category, data] of Object.entries(weightCategories)) {
            if (data.weight > 0) {
                const avgConfidence = data.confidence / (data.weight / data.score || 1);
                const normalizedScore = data.score / data.weight;
                const confidenceAdjustedScore = normalizedScore * (0.5 + 0.5 * avgConfidence);
                finalWeights[category] = confidenceAdjustedScore;
            } else {
                finalWeights[category] = this.getDefaultWeight(category);
            }
        }

        return finalWeights;
    }

    /**
     * Temporal decay weighting
     * Recent feedback matters more than old feedback
     */
    async calculateTemporalDecayWeights(feedbackData) {
        const weightCategories = {
            style_match: { score: 0, weight: 0 },
            flavor_harmony: { score: 0, weight: 0 },
            texture_balance: { score: 0, weight: 0 },
            regional_tradition: { score: 0, weight: 0 },
            seasonal_appropriateness: { score: 0, weight: 0 },
            acidity_match: { score: 0, weight: 0 },
            tannin_balance: { score: 0, weight: 0 },
            body_match: { score: 0, weight: 0 }
        };

        const now = new Date();
        const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds

        for (const feedback of feedbackData) {
            const feedbackDate = new Date(feedback.created_at);
            const age = now - feedbackDate;
            const temporalWeight = Math.exp(-age / (maxAge / 2)); // Exponential decay

            const rating = feedback.overall_rating / 5;

            // Process each rating category
            const categories = [
                'flavor_harmony', 'texture_balance', 'acidity_match',
                'tannin_balance', 'body_match', 'regional_tradition'
            ];

            for (const category of categories) {
                const categoryRating = feedback[`${category}_rating`];
                if (categoryRating) {
                    const normalizedRating = categoryRating / 5;
                    weightCategories[category].score += normalizedRating * temporalWeight;
                    weightCategories[category].weight += temporalWeight;
                }
            }

            // Calculate seasonal appropriateness
            const seasonalScore = this.calculateSeasonalScore(feedback.season, feedback.occasion);
            weightCategories.seasonal_appropriateness.score += seasonalScore * temporalWeight;
            weightCategories.seasonal_appropriateness.weight += temporalWeight;
        }

        // Calculate final weights
        const finalWeights = {};
        for (const [category, data] of Object.entries(weightCategories)) {
            if (data.weight > 0) {
                finalWeights[category] = data.score / data.weight;
            } else {
                finalWeights[category] = this.getDefaultWeight(category);
            }
        }

        return finalWeights;
    }

    /**
     * Context-aware weighting
     * Different weights for different contexts
     */
    async calculateContextAwareWeights(feedbackData) {
        const contextWeights = {
            dinner: { flavor_harmony: 1.2, texture_balance: 1.1, regional_tradition: 1.3 },
            lunch: { flavor_harmony: 1.0, texture_balance: 1.0, regional_tradition: 0.8 },
            cocktail: { flavor_harmony: 0.8, texture_balance: 0.9, regional_tradition: 0.7 },
            celebration: { flavor_harmony: 1.3, texture_balance: 1.2, regional_tradition: 1.4 }
        };

        const seasonWeights = {
            spring: { acidity_match: 1.2, seasonal_appropriateness: 1.1 },
            summer: { acidity_match: 1.3, seasonal_appropriateness: 1.2 },
            autumn: { body_match: 1.2, seasonal_appropriateness: 1.1 },
            winter: { body_match: 1.3, seasonal_appropriateness: 1.2 }
        };

        const weightCategories = {
            style_match: { score: 0, weight: 0 },
            flavor_harmony: { score: 0, weight: 0 },
            texture_balance: { score: 0, weight: 0 },
            regional_tradition: { score: 0, weight: 0 },
            seasonal_appropriateness: { score: 0, weight: 0 },
            acidity_match: { score: 0, weight: 0 },
            tannin_balance: { score: 0, weight: 0 },
            body_match: { score: 0, weight: 0 }
        };

        for (const feedback of feedbackData) {
            const occasion = feedback.occasion || 'dinner';
            const season = feedback.season || 'autumn';
            
            const occasionMultipliers = contextWeights[occasion] || contextWeights.dinner;
            const seasonMultipliers = seasonWeights[season] || {};

            const rating = feedback.overall_rating / 5;

            // Process each rating category with context multipliers
            const categories = [
                'flavor_harmony', 'texture_balance', 'acidity_match',
                'tannin_balance', 'body_match', 'regional_tradition'
            ];

            for (const category of categories) {
                const categoryRating = feedback[`${category}_rating`];
                if (categoryRating) {
                    const normalizedRating = categoryRating / 5;
                    const contextMultiplier = occasionMultipliers[category] || 1.0;
                    const seasonMultiplier = seasonMultipliers[category] || 1.0;
                    const combinedMultiplier = contextMultiplier * seasonMultiplier;
                    
                    weightCategories[category].score += normalizedRating * combinedMultiplier;
                    weightCategories[category].weight += combinedMultiplier;
                }
            }

            // Calculate seasonal appropriateness
            const seasonalScore = this.calculateSeasonalScore(season, occasion);
            const seasonalMultiplier = seasonMultipliers.seasonal_appropriateness || 1.0;
            weightCategories.seasonal_appropriateness.score += seasonalScore * seasonalMultiplier;
            weightCategories.seasonal_appropriateness.weight += seasonalMultiplier;
        }

        // Calculate final weights
        const finalWeights = {};
        for (const [category, data] of Object.entries(weightCategories)) {
            if (data.weight > 0) {
                finalWeights[category] = data.score / data.weight;
            } else {
                finalWeights[category] = this.getDefaultWeight(category);
            }
        }

        return finalWeights;
    }

    /**
     * Ensemble weighting
     * Combine multiple weighting approaches
     */
    async calculateEnsembleWeights(feedbackData, options) {
        const {
            confidenceThreshold = 0.7,
            temporalDecay = true,
            contextAware = true
        } = options;

        // Calculate weights using different approaches
        const [confidenceWeights, temporalWeights, contextWeights] = await Promise.all([
            this.calculateConfidenceBasedWeights(feedbackData),
            temporalDecay ? this.calculateTemporalDecayWeights(feedbackData) : null,
            contextAware ? this.calculateContextAwareWeights(feedbackData) : null
        ]);

        // Combine weights with dynamic weighting
        const ensembleWeights = {};
        const categories = Object.keys(confidenceWeights);

        for (const category of categories) {
            let combinedWeight = confidenceWeights[category] * 0.5; // Base weight from confidence
            
            if (temporalWeights) {
                combinedWeight += temporalWeights[category] * 0.3; // Temporal component
            }
            
            if (contextWeights) {
                combinedWeight += contextWeights[category] * 0.2; // Context component
            }

            ensembleWeights[category] = combinedWeight;
        }

        return ensembleWeights;
    }

    /**
     * Calculate user confidence score
     */
    async calculateUserConfidence(userId) {
        if (!userId) return 0.5; // Default confidence for anonymous users

        try {
            // Get user's feedback history
            const userFeedback = await this.db.all(`
                SELECT overall_rating, created_at, occasion, season
                FROM LearningPairingFeedbackEnhanced
                WHERE user_id = ? AND overall_rating IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 50
            `, [userId]);

            if (userFeedback.length < 3) {
                return 0.3; // Low confidence for new users
            }

            // Calculate consistency score
            const ratings = userFeedback.map(f => f.overall_rating);
            const consistency = this.calculateRatingConsistency(ratings);

            // Calculate diversity score
            const diversity = this.calculateContextDiversity(userFeedback);

            // Calculate recency score
            const recency = this.calculateRecencyScore(userFeedback);

            // Combine scores
            const confidence = (consistency * 0.4) + (diversity * 0.3) + (recency * 0.3);
            return Math.max(0.1, Math.min(1.0, confidence));
        } catch (error) {
            console.error('Failed to calculate user confidence:', error.message);
            return 0.5;
        }
    }

    /**
     * Calculate rating consistency
     */
    calculateRatingConsistency(ratings) {
        if (ratings.length < 2) return 0.5;

        const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        const variance = ratings.reduce((acc, rating) => acc + Math.pow(rating - mean, 2), 0) / ratings.length;
        const stdDev = Math.sqrt(variance);

        // Lower standard deviation = higher consistency
        return Math.max(0, 1 - (stdDev / 2));
    }

    /**
     * Calculate context diversity
     */
    calculateContextDiversity(feedback) {
        const occasions = new Set(feedback.map(f => f.occasion).filter(Boolean));
        const seasons = new Set(feedback.map(f => f.season).filter(Boolean));
        
        const occasionDiversity = occasions.size / 4; // Max 4 different occasions
        const seasonDiversity = seasons.size / 4; // Max 4 different seasons
        
        return (occasionDiversity + seasonDiversity) / 2;
    }

    /**
     * Calculate recency score
     */
    calculateRecencyScore(feedback) {
        if (feedback.length === 0) return 0;

        const now = new Date();
        const recentFeedback = feedback.filter(f => {
            const feedbackDate = new Date(f.created_at);
            const daysDiff = (now - feedbackDate) / (1000 * 60 * 60 * 24);
            return daysDiff < 30; // Recent feedback within 30 days
        });

        return Math.min(1, recentFeedback.length / 10); // Max score for 10+ recent feedback
    }

    /**
     * Calculate time-based weight
     */
    calculateTimeWeight(timeToSelect) {
        if (!timeToSelect) return 1.0;
        
        // Faster selection = higher confidence
        if (timeToSelect < 30) return 1.2;
        if (timeToSelect < 60) return 1.1;
        if (timeToSelect < 120) return 1.0;
        if (timeToSelect < 300) return 0.9;
        return 0.8; // Very slow selection
    }

    /**
     * Calculate seasonal score
     */
    calculateSeasonalScore(season, occasion) {
        const seasonalPreferences = {
            spring: { lunch: 0.8, dinner: 0.7, cocktail: 0.9 },
            summer: { lunch: 0.9, dinner: 0.8, cocktail: 1.0 },
            autumn: { lunch: 0.7, dinner: 0.9, cocktail: 0.8 },
            winter: { lunch: 0.6, dinner: 1.0, cocktail: 0.7 }
        };

        return seasonalPreferences[season]?.[occasion] || 0.7;
    }

    /**
     * Normalize weights to sum to 1
     */
    normalizeWeights(weights) {
        const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        
        if (total <= 0) {
            return this.getDefaultWeights();
        }

        const normalized = {};
        for (const [category, weight] of Object.entries(weights)) {
            normalized[category] = Math.max(0.01, weight / total); // Minimum weight of 0.01
        }

        return normalized;
    }

    /**
     * Get default weights
     */
    getDefaultWeights() {
        return {
            style_match: 0.20,
            flavor_harmony: 0.25,
            texture_balance: 0.15,
            regional_tradition: 0.12,
            seasonal_appropriateness: 0.08,
            acidity_match: 0.10,
            tannin_balance: 0.05,
            body_match: 0.05
        };
    }

    /**
     * Get default weight for a category
     */
    getDefaultWeight(category) {
        const defaults = this.getDefaultWeights();
        return defaults[category] || 0.1;
    }

    /**
     * Update weights in database
     */
    async updateWeights(weights, algorithm = 'advanced') {
        try {
            await this.db.run(`
                INSERT INTO LearningParameters (parameter_name, parameter_value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(parameter_name) DO UPDATE SET
                    parameter_value = excluded.parameter_value,
                    updated_at = CURRENT_TIMESTAMP
            `, [`${algorithm}_weights`, JSON.stringify(weights)]);

            // Cache the weights
            this.weightCache.set(`${algorithm}_weights`, {
                data: weights,
                timestamp: Date.now()
            });

            return true;
        } catch (error) {
            console.error('Failed to update weights:', error.message);
            return false;
        }
    }

    /**
     * Get cached weights
     */
    getCachedWeights(algorithm = 'advanced') {
        const cached = this.weightCache.get(`${algorithm}_weights`);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    }

    /**
     * Clear weight cache
     */
    clearCache() {
        this.weightCache.clear();
    }

    /**
     * Get weight statistics
     */
    getWeightStats(weights) {
        const categories = Object.keys(weights);
        const values = Object.values(weights);
        
        return {
            categories: categories.length,
            total: values.reduce((sum, val) => sum + val, 0),
            min: Math.min(...values),
            max: Math.max(...values),
            mean: values.reduce((sum, val) => sum + val, 0) / values.length,
            variance: this.calculateVariance(values)
        };
    }

    /**
     * Calculate variance
     */
    calculateVariance(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        return values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    }
}

module.exports = AdvancedWeightingEngine;