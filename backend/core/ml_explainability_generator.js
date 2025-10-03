/**
 * ML Explainability Generator
 * Generates human-readable explanations for ML-based wine recommendations
 */

const Database = require('../database/connection');
const ExplainabilityService = require('./explainability_service');

class MLExplainabilityGenerator {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.explainabilityService = new ExplainabilityService(this.db);
        
        // Feature importance weights
        this.featureWeights = {
            collaborative_filtering: 0.35,
            content_similarity: 0.25,
            user_preferences: 0.20,
            wine_quality: 0.12,
            popularity: 0.08
        };
    }

    /**
     * Generate comprehensive explanation for a wine recommendation
     */
    async explainRecommendation(userId, wineId, score, metadata = {}) {
        try {
            // Get wine details
            const wine = await this.getWineDetails(wineId);
            if (!wine) {
                return this.createDefaultExplanation(wineId);
            }

            // Get user profile
            const userProfile = await this.getUserProfile(userId);

            // Generate explanation factors
            const factors = [];
            const contributions = {};

            // 1. Collaborative Filtering explanation
            const cfExplanation = await this.explainCollaborativeFiltering(userId, wineId);
            if (cfExplanation) {
                factors.push(cfExplanation);
                contributions.collaborative_filtering = cfExplanation.contribution;
            }

            // 2. Content-based similarity
            const contentExplanation = await this.explainContentSimilarity(userId, wineId, wine);
            if (contentExplanation) {
                factors.push(contentExplanation);
                contributions.content_similarity = contentExplanation.contribution;
            }

            // 3. User preferences match
            const prefExplanation = this.explainUserPreferences(userProfile, wine);
            if (prefExplanation.length > 0) {
                factors.push(...prefExplanation);
                contributions.user_preferences = prefExplanation.reduce((sum, e) => sum + e.contribution, 0);
            }

            // 4. Wine quality
            const qualityExplanation = this.explainWineQuality(wine);
            if (qualityExplanation) {
                factors.push(qualityExplanation);
                contributions.wine_quality = qualityExplanation.contribution;
            }

            // 5. Popularity
            const popularityExplanation = await this.explainPopularity(wineId);
            if (popularityExplanation) {
                factors.push(popularityExplanation);
                contributions.popularity = popularityExplanation.contribution;
            }

            // 6. Context-specific (pairing, occasion, etc.)
            if (metadata.dish) {
                const pairingExplanation = this.explainPairing(wine, metadata.dish);
                if (pairingExplanation) {
                    factors.push(pairingExplanation);
                }
            }

            // Sort factors by contribution
            factors.sort((a, b) => b.contribution - a.contribution);

            // Generate natural language summary
            const summary = this.generateSummary(wine, factors.slice(0, 3));

            // Store explanation
            const explanation = await this.explainabilityService.createExplanation({
                entityType: 'recommendation',
                entityId: `${userId}_${wineId}`,
                summary,
                factors: {
                    wine_id: wineId,
                    wine_name: wine.name,
                    user_id: userId,
                    score,
                    contributions,
                    top_factors: factors.slice(0, 5).map(f => ({
                        type: f.type,
                        description: f.description,
                        strength: f.contribution
                    }))
                }
            });

            return {
                wine_id: wineId,
                wine_name: wine.name,
                user_id: userId,
                recommendation_score: score,
                summary,
                factors: factors.slice(0, 5),
                contributions,
                confidence: this.calculateConfidence(contributions),
                explanation_id: explanation.id
            };

        } catch (error) {
            console.error('Failed to generate explanation:', error);
            return this.createDefaultExplanation(wineId, error.message);
        }
    }

    /**
     * Explain collaborative filtering contribution
     */
    async explainCollaborativeFiltering(userId, wineId) {
        const result = await this.db.get(`
            SELECT COUNT(DISTINCT lpfe.user_id) as similar_user_count,
                   AVG(lpfe.rating) as avg_rating
            FROM LearningPairingFeedbackEnhanced lpfe
            INNER JOIN LearningPairingRecommendations lpr ON lpfe.recommendation_id = lpr.id
            WHERE lpr.wine_id = ?
            AND lpfe.user_id IN (
                SELECT DISTINCT lpfe2.user_id
                FROM LearningPairingFeedbackEnhanced lpfe2
                INNER JOIN LearningPairingRecommendations lpr2 ON lpfe2.recommendation_id = lpr2.id
                WHERE lpr2.wine_id IN (
                    SELECT lpr3.wine_id
                    FROM LearningPairingFeedbackEnhanced lpfe3
                    INNER JOIN LearningPairingRecommendations lpr3 ON lpfe3.recommendation_id = lpr3.id
                    WHERE lpfe3.user_id = ? AND lpfe3.rating >= 4
                )
                AND lpfe2.user_id != ?
            )
        `, [wineId, userId, userId]);

        if (result && result.similar_user_count >= 3) {
            return {
                type: 'collaborative_filtering',
                description: `${result.similar_user_count} users with similar taste rated this ${result.avg_rating.toFixed(1)}/5`,
                contribution: Math.min(result.similar_user_count / 20, 0.35),
                icon: '👥',
                data: {
                    similar_users: result.similar_user_count,
                    average_rating: result.avg_rating
                }
            };
        }

        return null;
    }

    /**
     * Explain content-based similarity
     */
    async explainContentSimilarity(userId, wineId, wine) {
        const similarWine = await this.db.get(`
            SELECT w.name, w.region, w.grape_variety, lpfe.rating
            FROM LearningPairingFeedbackEnhanced lpfe
            INNER JOIN LearningPairingRecommendations lpr ON lpfe.recommendation_id = lpr.id
            INNER JOIN Wines w ON lpr.wine_id = w.id
            WHERE lpfe.user_id = ? AND lpfe.rating >= 4
            AND (w.region = ? OR w.grape_variety = ?)
            AND w.id != ?
            ORDER BY lpfe.rating DESC
            LIMIT 1
        `, [userId, wine.region, wine.grape_variety, wineId]);

        if (similarWine) {
            return {
                type: 'content_similarity',
                description: `Similar to "${similarWine.name}" (${similarWine.rating}/5) - same ${similarWine.region === wine.region ? 'region' : 'grape'}`,
                contribution: 0.25,
                icon: '🍇',
                data: {
                    similar_wine: similarWine.name,
                    your_rating: similarWine.rating,
                    match_type: similarWine.region === wine.region ? 'region' : 'grape'
                }
            };
        }

        return null;
    }

    /**
     * Explain user preference match
     */
    explainUserPreferences(userProfile, wine) {
        const explanations = [];

        if (!userProfile) return explanations;

        // Region preference
        if (userProfile.preferred_regions?.includes(wine.region)) {
            explanations.push({
                type: 'region_preference',
                description: `From ${wine.region}, which you enjoy`,
                contribution: 0.10,
                icon: '📍',
                data: { region: wine.region }
            });
        }

        // Grape variety preference
        if (userProfile.preferred_grapes?.includes(wine.grape_variety)) {
            explanations.push({
                type: 'grape_preference',
                description: `${wine.grape_variety} is one of your favorites`,
                contribution: 0.10,
                icon: '🍷',
                data: { grape: wine.grape_variety }
            });
        }

        // Wine type preference
        if (userProfile.preferred_types?.includes(wine.type)) {
            explanations.push({
                type: 'type_preference',
                description: `${wine.type.charAt(0).toUpperCase() + wine.type.slice(1)} wine matches your preference`,
                contribution: 0.08,
                icon: '🎯',
                data: { type: wine.type }
            });
        }

        return explanations;
    }

    /**
     * Explain wine quality
     */
    explainWineQuality(wine) {
        if (wine.quality_score >= 4.0) {
            const qualityLevel = wine.quality_score >= 4.5 ? 'Exceptional' : 'High';
            return {
                type: 'wine_quality',
                description: `${qualityLevel} quality (${wine.quality_score.toFixed(1)}/5)`,
                contribution: (wine.quality_score - 3) / 10, // 0.10-0.20 range
                icon: '⭐',
                data: { quality_score: wine.quality_score }
            };
        }

        return null;
    }

    /**
     * Explain popularity
     */
    async explainPopularity(wineId) {
        const result = await this.db.get(`
            SELECT COUNT(DISTINCT lpfe.user_id) as rating_count,
                   AVG(lpfe.rating) as avg_rating
            FROM LearningPairingFeedbackEnhanced lpfe
            INNER JOIN LearningPairingRecommendations lpr ON lpfe.recommendation_id = lpr.id
            WHERE lpr.wine_id = ?
        `, [wineId]);

        if (result && result.rating_count >= 15) {
            return {
                type: 'popularity',
                description: `Popular choice (${result.rating_count} ratings, ${result.avg_rating.toFixed(1)}/5 avg)`,
                contribution: Math.min(result.rating_count / 100, 0.08),
                icon: '🔥',
                data: {
                    rating_count: result.rating_count,
                    average_rating: result.avg_rating
                }
            };
        }

        return null;
    }

    /**
     * Explain food pairing
     */
    explainPairing(wine, dish) {
        const pairingScore = this.calculatePairingScore(wine, dish);
        
        if (pairingScore >= 0.7) {
            return {
                type: 'food_pairing',
                description: `Perfect pairing with ${dish}`,
                contribution: pairingScore * 0.15,
                icon: '🍽️',
                data: { dish, pairing_score: pairingScore }
            };
        }

        return null;
    }

    /**
     * Calculate food pairing score (simplified)
     */
    calculatePairingScore(wine, dish) {
        const pairings = {
            'red': ['steak', 'beef', 'lamb', 'pasta', 'burger', 'barbecue'],
            'white': ['fish', 'chicken', 'seafood', 'salad', 'pork', 'vegetarian'],
            'rosé': ['salmon', 'mediterranean', 'tapas', 'grilled', 'light'],
            'sparkling': ['appetizers', 'dessert', 'oysters', 'brunch', 'celebration']
        };

        const dishLower = dish.toLowerCase();
        const wineType = wine.type.toLowerCase();

        if (pairings[wineType]) {
            for (const pairing of pairings[wineType]) {
                if (dishLower.includes(pairing)) {
                    return 0.85;
                }
            }
        }

        return 0.5;
    }

    /**
     * Generate natural language summary
     */
    generateSummary(wine, topFactors) {
        if (topFactors.length === 0) {
            return `We recommend "${wine.name}" based on your taste profile.`;
        }

        const primaryReason = topFactors[0].description;
        
        if (topFactors.length === 1) {
            return `"${wine.name}" is recommended because ${primaryReason.toLowerCase()}.`;
        }

        const secondaryReason = topFactors[1].description.toLowerCase();
        return `"${wine.name}" is recommended because ${primaryReason.toLowerCase()}, and ${secondaryReason}.`;
    }

    /**
     * Get wine details
     */
    async getWineDetails(wineId) {
        return await this.db.get('SELECT * FROM Wines WHERE id = ?', [wineId]);
    }

    /**
     * Get user profile with preferences
     */
    async getUserProfile(userId) {
        const ratings = await this.db.all(`
            SELECT w.region, w.grape_variety, w.type, w.price, lpfe.rating
            FROM LearningPairingFeedbackEnhanced lpfe
            INNER JOIN LearningPairingRecommendations lpr ON lpfe.recommendation_id = lpr.id
            INNER JOIN Wines w ON lpr.wine_id = w.id
            WHERE lpfe.user_id = ? AND lpfe.rating >= 4
        `, [userId]);

        if (ratings.length === 0) return null;

        // Extract preferences
        const regions = {}, grapes = {}, types = {};

        for (const r of ratings) {
            regions[r.region] = (regions[r.region] || 0) + 1;
            grapes[r.grape_variety] = (grapes[r.grape_variety] || 0) + 1;
            types[r.type] = (types[r.type] || 0) + 1;
        }

        return {
            preferred_regions: Object.entries(regions).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]),
            preferred_grapes: Object.entries(grapes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]),
            preferred_types: Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]),
            total_ratings: ratings.length
        };
    }

    /**
     * Calculate overall confidence
     */
    calculateConfidence(contributions) {
        const total = Object.values(contributions).reduce((sum, val) => sum + val, 0);
        return Math.min(total / 0.8, 1.0); // 0.8 as target
    }

    /**
     * Create default explanation when detailed generation fails
     */
    createDefaultExplanation(wineId, error = null) {
        return {
            wine_id: wineId,
            summary: 'This wine is recommended based on your taste profile and preferences.',
            factors: [],
            contributions: {},
            confidence: 0.3,
            error
        };
    }

    /**
     * Explain a list of recommendations
     */
    async explainRecommendationList(userId, recommendations, context = {}) {
        const explanations = [];

        for (const rec of recommendations.slice(0, 10)) { // Limit to 10
            const explanation = await this.explainRecommendation(
                userId,
                rec.wine_id,
                rec.score || rec.predicted_rating,
                context
            );
            explanations.push(explanation);
        }

        return {
            user_id: userId,
            count: explanations.length,
            explanations,
            average_confidence: this.calculateAverageConfidence(explanations)
        };
    }

    /**
     * Calculate average confidence across explanations
     */
    calculateAverageConfidence(explanations) {
        if (explanations.length === 0) return 0;
        const sum = explanations.reduce((acc, e) => acc + (e.confidence || 0), 0);
        return parseFloat((sum / explanations.length).toFixed(2));
    }

    /**
     * Generate visual explanation data for charts
     */
    async generateVisualExplanation(userId, wineId) {
        const explanation = await this.explainRecommendation(userId, wineId, 1.0);

        return {
            wine_id: wineId,
            wine_name: explanation.wine_name,
            chart_data: {
                type: 'bar',
                labels: Object.keys(explanation.contributions),
                values: Object.values(explanation.contributions),
                title: 'Why We Recommend This Wine'
            },
            factors: explanation.factors.map(f => ({
                label: f.description,
                value: f.contribution,
                icon: f.icon
            }))
        };
    }
}

module.exports = MLExplainabilityGenerator;
