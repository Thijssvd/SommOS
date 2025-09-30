/**
 * Ensemble Engine
 * Combines multiple recommendation algorithms for improved accuracy
 */

const Database = require('../database/connection');
const CollaborativeFilteringEngine = require('./collaborative_filtering_engine');
const AdvancedWeightingEngine = require('./advanced_weighting_engine');
const FeatureEngineeringService = require('./feature_engineering_service');

class EnsembleEngine {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.collaborativeFiltering = new CollaborativeFilteringEngine(database);
        this.advancedWeighting = new AdvancedWeightingEngine(database);
        this.featureService = new FeatureEngineeringService(database);
        
        this.algorithmWeights = {
            collaborative_filtering: 0.35,
            content_based: 0.25,
            rule_based: 0.20,
            hybrid_cf: 0.20
        };
        
        this.ensembleCache = new Map();
        this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Generate ensemble recommendations
     */
    async generateEnsembleRecommendations(userId, dishContext, options = {}) {
        const {
            limit = 10,
            algorithms = ['collaborative_filtering', 'content_based', 'rule_based'],
            dynamicWeighting = true,
            contextAware = true
        } = options;

        try {
            // Generate recommendations from different algorithms
            const algorithmResults = await this.runMultipleAlgorithms(
                userId,
                dishContext,
                algorithms,
                { limit: limit * 2 } // Get more results to combine
            );

            // Calculate dynamic weights if enabled
            const weights = dynamicWeighting 
                ? await this.calculateDynamicWeights(algorithmResults, dishContext)
                : this.algorithmWeights;

            // Combine recommendations
            const ensembleRecommendations = await this.combineRecommendations(
                algorithmResults,
                weights,
                { limit, contextAware }
            );

            // Apply final scoring and ranking
            const finalRecommendations = await this.applyFinalScoring(
                ensembleRecommendations,
                dishContext,
                userId
            );

            return finalRecommendations.slice(0, limit);
        } catch (error) {
            console.error('Ensemble recommendation generation failed:', error.message);
            return [];
        }
    }

    /**
     * Run multiple recommendation algorithms
     */
    async runMultipleAlgorithms(userId, dishContext, algorithms, options) {
        const results = {};

        // Run algorithms in parallel
        const algorithmPromises = algorithms.map(async (algorithm) => {
            try {
                switch (algorithm) {
                    case 'collaborative_filtering':
                        return {
                            algorithm,
                            recommendations: await this.runCollaborativeFiltering(userId, dishContext, options)
                        };
                    case 'content_based':
                        return {
                            algorithm,
                            recommendations: await this.runContentBased(dishContext, options)
                        };
                    case 'rule_based':
                        return {
                            algorithm,
                            recommendations: await this.runRuleBased(dishContext, options)
                        };
                    case 'hybrid_cf':
                        return {
                            algorithm,
                            recommendations: await this.runHybridCollaborativeFiltering(userId, dishContext, options)
                        };
                    default:
                        console.warn(`Unknown algorithm: ${algorithm}`);
                        return { algorithm, recommendations: [] };
                }
            } catch (error) {
                console.error(`Algorithm ${algorithm} failed:`, error.message);
                return { algorithm, recommendations: [] };
            }
        });

        const algorithmResults = await Promise.all(algorithmPromises);
        
        // Organize results by algorithm
        for (const result of algorithmResults) {
            results[result.algorithm] = result.recommendations;
        }

        return results;
    }

    /**
     * Run collaborative filtering algorithm
     */
    async runCollaborativeFiltering(userId, dishContext, options) {
        if (!userId) return [];

        const recommendations = await this.collaborativeFiltering.getUserBasedRecommendations(
            userId,
            dishContext,
            options
        );

        return recommendations.map(rec => ({
            ...rec,
            algorithm: 'collaborative_filtering',
            confidence: this.calculateCFConfidence(rec)
        }));
    }

    /**
     * Run content-based algorithm
     */
    async runContentBased(dishContext, options) {
        try {
            // Extract dish features
            const dishFeatures = await this.featureService.extractDishFeatures(
                dishContext.dish_description || dishContext.name || 'unknown dish'
            );

            // Find similar wines based on content features
            const similarWines = await this.findContentBasedSimilarWines(dishFeatures, options);

            return similarWines.map(wine => ({
                wine_id: wine.wine_id,
                score: wine.similarity_score,
                algorithm: 'content_based',
                confidence: wine.similarity_score,
                reasoning: `Content similarity: ${wine.similarity_score.toFixed(2)}`
            }));
        } catch (error) {
            console.error('Content-based algorithm failed:', error.message);
            return [];
        }
    }

    /**
     * Run rule-based algorithm
     */
    async runRuleBased(dishContext, options) {
        try {
            // Get available wines
            const availableWines = await this.getAvailableWines();
            
            // Apply rule-based scoring
            const scoredWines = [];
            
            for (const wine of availableWines) {
                const score = await this.calculateRuleBasedScore(wine, dishContext);
                if (score > 0.3) { // Minimum threshold
                    scoredWines.push({
                        wine_id: wine.id,
                        score,
                        algorithm: 'rule_based',
                        confidence: score,
                        reasoning: this.generateRuleBasedReasoning(wine, dishContext, score)
                    });
                }
            }

            return scoredWines.sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error('Rule-based algorithm failed:', error.message);
            return [];
        }
    }

    /**
     * Run hybrid collaborative filtering
     */
    async runHybridCollaborativeFiltering(userId, dishContext, options) {
        if (!userId) return [];

        const recommendations = await this.collaborativeFiltering.getHybridRecommendations(
            userId,
            dishContext,
            options
        );

        return recommendations.map(rec => ({
            ...rec,
            algorithm: 'hybrid_cf',
            confidence: this.calculateHybridCFConfidence(rec)
        }));
    }

    /**
     * Calculate dynamic weights based on algorithm performance and context
     */
    async calculateDynamicWeights(algorithmResults, dishContext) {
        const weights = { ...this.algorithmWeights };
        
        try {
            // Adjust weights based on data availability
            for (const [algorithm, recommendations] of Object.entries(algorithmResults)) {
                if (recommendations.length === 0) {
                    weights[algorithm] *= 0.5; // Reduce weight if no recommendations
                } else if (recommendations.length > 10) {
                    weights[algorithm] *= 1.1; // Slightly increase weight for rich data
                }
            }

            // Adjust weights based on context
            if (dishContext.occasion === 'dinner') {
                weights.collaborative_filtering *= 1.2;
                weights.rule_based *= 1.1;
            } else if (dishContext.occasion === 'cocktail') {
                weights.content_based *= 1.2;
            }

            // Normalize weights
            const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
            for (const algorithm in weights) {
                weights[algorithm] /= totalWeight;
            }

            return weights;
        } catch (error) {
            console.error('Dynamic weight calculation failed:', error.message);
            return this.algorithmWeights;
        }
    }

    /**
     * Combine recommendations from multiple algorithms
     */
    async combineRecommendations(algorithmResults, weights, options) {
        const { limit, contextAware } = options;
        const combined = new Map();

        // Combine recommendations with weighted scores
        for (const [algorithm, recommendations] of Object.entries(algorithmResults)) {
            const weight = weights[algorithm] || 0;
            
            for (const rec of recommendations) {
                const key = rec.wine_id;
                if (!combined.has(key)) {
                    combined.set(key, {
                        wine_id: key,
                        scores: {},
                        algorithms: [],
                        total_score: 0,
                        confidence: 0,
                        reasoning: []
                    });
                }

                const combinedRec = combined.get(key);
                combinedRec.scores[algorithm] = rec.score * weight;
                combinedRec.algorithms.push(algorithm);
                combinedRec.total_score += rec.score * weight;
                combinedRec.confidence += (rec.confidence || rec.score) * weight;
                
                if (rec.reasoning) {
                    combinedRec.reasoning.push(rec.reasoning);
                }
            }
        }

        // Convert to array and apply context-aware adjustments
        let finalRecommendations = Array.from(combined.values());
        
        if (contextAware) {
            finalRecommendations = await this.applyContextAwareAdjustments(finalRecommendations, options);
        }

        // Sort by total score
        finalRecommendations.sort((a, b) => b.total_score - a.total_score);

        return finalRecommendations.slice(0, limit);
    }

    /**
     * Apply context-aware adjustments to recommendations
     */
    async applyContextAwareAdjustments(recommendations, options) {
        const { dishContext } = options;
        if (!dishContext) return recommendations;

        const adjusted = [];

        for (const rec of recommendations) {
            let contextMultiplier = 1.0;

            // Get wine details for context matching
            const wine = await this.getWineDetails(rec.wine_id);
            if (wine) {
                // Adjust based on wine type and dish context
                if (dishContext.cuisine === 'french' && wine.region?.toLowerCase().includes('france')) {
                    contextMultiplier *= 1.2;
                }
                
                if (dishContext.season === 'summer' && wine.wine_type === 'White') {
                    contextMultiplier *= 1.1;
                }
                
                if (dishContext.occasion === 'dinner' && wine.wine_type === 'Red') {
                    contextMultiplier *= 1.1;
                }
            }

            adjusted.push({
                ...rec,
                total_score: rec.total_score * contextMultiplier,
                context_adjustment: contextMultiplier
            });
        }

        return adjusted;
    }

    /**
     * Apply final scoring and ranking
     */
    async applyFinalScoring(recommendations, dishContext, userId) {
        const scored = [];

        for (const rec of recommendations) {
            // Calculate diversity bonus
            const diversityBonus = this.calculateDiversityBonus(rec, scored);
            
            // Calculate novelty bonus for new users
            const noveltyBonus = userId ? await this.calculateNoveltyBonus(rec, userId) : 0;
            
            // Calculate final score
            const finalScore = rec.total_score + diversityBonus + noveltyBonus;
            
            scored.push({
                ...rec,
                final_score: finalScore,
                diversity_bonus: diversityBonus,
                novelty_bonus: noveltyBonus
            });
        }

        // Sort by final score
        return scored.sort((a, b) => b.final_score - a.final_score);
    }

    /**
     * Find content-based similar wines
     */
    async findContentBasedSimilarWines(dishFeatures, options) {
        try {
            const { limit = 20 } = options;
            
            // Get wine features
            const wineFeatures = await this.db.all(`
                SELECT wf.*, w.name, w.producer, w.region, w.wine_type
                FROM WineFeatures wf
                JOIN Wines w ON wf.wine_id = w.id
                WHERE wf.feature_vector IS NOT NULL
                LIMIT ?
            `, [limit * 2]);

            const similarities = [];

            for (const wine of wineFeatures) {
                const wineFeatureVector = JSON.parse(wine.feature_vector);
                const dishFeatureVector = JSON.parse(dishFeatures.feature_vector);
                
                const similarity = this.calculateCosineSimilarity(wineFeatureVector, dishFeatureVector);
                
                if (similarity > 0.3) {
                    similarities.push({
                        wine_id: wine.wine_id,
                        wine_name: wine.name,
                        producer: wine.producer,
                        region: wine.region,
                        wine_type: wine.wine_type,
                        similarity_score: similarity
                    });
                }
            }

            return similarities.sort((a, b) => b.similarity_score - a.similarity_score);
        } catch (error) {
            console.error('Content-based similarity calculation failed:', error.message);
            return [];
        }
    }

    /**
     * Calculate rule-based score
     */
    async calculateRuleBasedScore(wine, dishContext) {
        let score = 0.5; // Base score

        // Wine type and dish intensity matching
        if (dishContext.intensity === 'heavy' && wine.wine_type === 'Red') {
            score += 0.2;
        } else if (dishContext.intensity === 'light' && wine.wine_type === 'White') {
            score += 0.2;
        }

        // Cuisine and region matching
        if (dishContext.cuisine === 'french' && wine.region?.toLowerCase().includes('france')) {
            score += 0.15;
        } else if (dishContext.cuisine === 'italian' && wine.region?.toLowerCase().includes('italy')) {
            score += 0.15;
        }

        // Season matching
        if (dishContext.season === 'summer' && wine.wine_type === 'White') {
            score += 0.1;
        } else if (dishContext.season === 'winter' && wine.wine_type === 'Red') {
            score += 0.1;
        }

        // Occasion matching
        if (dishContext.occasion === 'dinner' && wine.wine_type === 'Red') {
            score += 0.1;
        } else if (dishContext.occasion === 'cocktail' && wine.wine_type === 'Sparkling') {
            score += 0.15;
        }

        return Math.min(1.0, score);
    }

    /**
     * Calculate cosine similarity
     */
    calculateCosineSimilarity(vector1, vector2) {
        if (vector1.length !== vector2.length) return 0;

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < vector1.length; i++) {
            dotProduct += vector1[i] * vector2[i];
            norm1 += vector1[i] * vector1[i];
            norm2 += vector2[i] * vector2[i];
        }

        if (norm1 === 0 || norm2 === 0) return 0;

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * Calculate diversity bonus
     */
    calculateDiversityBonus(recommendation, existingRecommendations) {
        // Simple diversity bonus based on algorithm diversity
        const uniqueAlgorithms = new Set(recommendation.algorithms);
        const diversityScore = uniqueAlgorithms.size / Object.keys(this.algorithmWeights).length;
        return diversityScore * 0.05; // Small bonus for diversity
    }

    /**
     * Calculate novelty bonus for new users
     */
    async calculateNoveltyBonus(recommendation, userId) {
        try {
            // Check if user has tried this wine before
            const hasTried = await this.db.get(`
                SELECT COUNT(*) as count
                FROM LearningPairingFeedbackEnhanced f
                JOIN LearningPairingRecommendations r ON f.recommendation_id = r.id
                WHERE f.user_id = ? AND r.wine_id = ?
            `, [userId, recommendation.wine_id]);

            if (hasTried.count === 0) {
                return 0.1; // Bonus for trying new wines
            }

            return 0;
        } catch (error) {
            return 0;
        }
    }

    // Helper methods
    calculateCFConfidence(recommendation) {
        return Math.min(1.0, (recommendation.rating_count || 1) / 10);
    }

    calculateHybridCFConfidence(recommendation) {
        const userConfidence = this.calculateCFConfidence(recommendation);
        const itemConfidence = Math.min(1.0, (recommendation.similarity || 0.5));
        return (userConfidence + itemConfidence) / 2;
    }

    generateRuleBasedReasoning(wine, dishContext, score) {
        const reasons = [];
        
        if (dishContext.intensity === 'heavy' && wine.wine_type === 'Red') {
            reasons.push('Full-bodied red wine matches heavy dish intensity');
        }
        
        if (dishContext.cuisine === 'french' && wine.region?.toLowerCase().includes('france')) {
            reasons.push('French wine complements French cuisine');
        }
        
        if (dishContext.season === 'summer' && wine.wine_type === 'White') {
            reasons.push('White wine suitable for summer season');
        }

        return reasons.join('; ') || 'General pairing compatibility';
    }

    async getAvailableWines() {
        return await this.db.all(`
            SELECT w.*, s.quantity
            FROM Wines w
            JOIN Vintages v ON w.id = v.wine_id
            JOIN Stock s ON v.id = s.vintage_id
            WHERE s.quantity > 0
            ORDER BY v.quality_score DESC NULLS LAST
        `);
    }

    async getWineDetails(wineId) {
        return await this.db.get(`
            SELECT w.*, v.year, v.quality_score
            FROM Wines w
            JOIN Vintages v ON w.id = v.wine_id
            WHERE w.id = ?
        `, [wineId]);
    }

    /**
     * Clear ensemble cache
     */
    clearCache() {
        this.ensembleCache.clear();
    }

    /**
     * Get ensemble statistics
     */
    getEnsembleStats() {
        return {
            algorithmWeights: this.algorithmWeights,
            cacheSize: this.ensembleCache.size,
            supportedAlgorithms: Object.keys(this.algorithmWeights)
        };
    }
}

module.exports = EnsembleEngine;