/**
 * Collaborative Filtering Engine
 * Implements user-based and item-based collaborative filtering for wine recommendations
 */

const Database = require('../database/connection');

class CollaborativeFilteringEngine {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.similarityCache = new Map();
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        this.minCommonItems = 3; // Minimum common items for similarity calculation
        this.minSimilarUsers = 5; // Minimum similar users for recommendations
    }

    /**
     * User-based collaborative filtering
     * Find similar users and recommend wines they liked
     */
    async getUserBasedRecommendations(userId, dishContext, options = {}) {
        const {
            limit = 10,
            minRating = 3,
            excludeWines = [],
            includeContext = true
        } = options;

        try {
            // Get user's rating history
            const userRatings = await this.getUserRatings(userId);
            if (userRatings.length < 3) {
                return []; // Not enough data for collaborative filtering
            }

            // Find similar users
            const similarUsers = await this.findSimilarUsers(userId, userRatings);
            if (similarUsers.length < this.minSimilarUsers) {
                return [];
            }

            // Get recommendations from similar users
            const recommendations = await this.getRecommendationsFromSimilarUsers(
                similarUsers,
                userRatings,
                dishContext,
                { limit, minRating, excludeWines, includeContext }
            );

            return recommendations;
        } catch (error) {
            console.error('User-based collaborative filtering failed:', error.message);
            return [];
        }
    }

    /**
     * Item-based collaborative filtering
     * Find similar wines and recommend based on item similarity
     */
    async getItemBasedRecommendations(wineId, dishContext, options = {}) {
        const {
            limit = 10,
            minRating = 3,
            excludeWines = []
        } = options;

        try {
            // Get wine's rating history
            const wineRatings = await this.getWineRatings(wineId);
            if (wineRatings.length < 3) {
                return []; // Not enough data for collaborative filtering
            }

            // Find similar wines
            const similarWines = await this.findSimilarWines(wineId, wineRatings);
            if (similarWines.length === 0) {
                return [];
            }

            // Get recommendations based on similar wines
            const recommendations = await this.getRecommendationsFromSimilarWines(
                similarWines,
                wineRatings,
                dishContext,
                { limit, minRating, excludeWines }
            );

            return recommendations;
        } catch (error) {
            console.error('Item-based collaborative filtering failed:', error.message);
            return [];
        }
    }

    /**
     * Hybrid collaborative filtering
     * Combine user-based and item-based approaches
     */
    async getHybridRecommendations(userId, dishContext, options = {}) {
        const {
            userWeight = 0.6,
            itemWeight = 0.4,
            limit = 10
        } = options;

        try {
            // Get recommendations from both approaches
            const [userBasedRecs, itemBasedRecs] = await Promise.all([
                this.getUserBasedRecommendations(userId, dishContext, { limit: limit * 2 }),
                this.getItemBasedRecommendations(null, dishContext, { limit: limit * 2 })
            ]);

            // Combine and score recommendations
            const combinedRecs = this.combineRecommendations(
                userBasedRecs,
                itemBasedRecs,
                { userWeight, itemWeight }
            );

            return combinedRecs.slice(0, limit);
        } catch (error) {
            console.error('Hybrid collaborative filtering failed:', error.message);
            return [];
        }
    }

    /**
     * Find similar users based on rating patterns
     */
    async findSimilarUsers(userId, userRatings) {
        const cacheKey = `similar_users_${userId}`;
        const cached = this.getCachedSimilarity(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Get all users who have rated similar wines
            const userWineIds = userRatings.map(r => r.wine_id);
            const otherUsers = await this.db.all(`
                SELECT DISTINCT user_id
                FROM LearningPairingFeedbackEnhanced
                WHERE user_id != ? AND user_id IS NOT NULL
                AND recommendation_id IN (
                    SELECT id FROM LearningPairingRecommendations
                    WHERE wine_id IN (${userWineIds.map(() => '?').join(',')})
                )
            `, [userId, ...userWineIds]);

            const similarities = [];

            for (const otherUser of otherUsers) {
                const otherUserRatings = await this.getUserRatings(otherUser.user_id);
                const similarity = this.calculateUserSimilarity(userRatings, otherUserRatings);
                
                if (similarity > 0.3) { // Minimum similarity threshold
                    similarities.push({
                        user_id: otherUser.user_id,
                        similarity: similarity,
                        common_items: this.getCommonItems(userRatings, otherUserRatings).length
                    });
                }
            }

            // Sort by similarity and common items
            similarities.sort((a, b) => {
                if (Math.abs(a.similarity - b.similarity) < 0.1) {
                    return b.common_items - a.common_items;
                }
                return b.similarity - a.similarity;
            });

            const result = similarities.slice(0, 20); // Top 20 similar users
            this.setCachedSimilarity(cacheKey, result);
            return result;
        } catch (error) {
            console.error('Failed to find similar users:', error.message);
            return [];
        }
    }

    /**
     * Find similar wines based on rating patterns
     */
    async findSimilarWines(wineId, wineRatings) {
        const cacheKey = `similar_wines_${wineId}`;
        const cached = this.getCachedSimilarity(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Get all wines that have been rated by similar users
            const userIds = wineRatings.map(r => r.user_id);
            const otherWines = await this.db.all(`
                SELECT DISTINCT wine_id
                FROM LearningPairingRecommendations
                WHERE wine_id != ? AND wine_id IS NOT NULL
                AND id IN (
                    SELECT recommendation_id FROM LearningPairingFeedbackEnhanced
                    WHERE user_id IN (${userIds.map(() => '?').join(',')})
                )
            `, [wineId, ...userIds]);

            const similarities = [];

            for (const otherWine of otherWines) {
                const otherWineRatings = await this.getWineRatings(otherWine.wine_id);
                const similarity = this.calculateWineSimilarity(wineRatings, otherWineRatings);
                
                if (similarity > 0.3) { // Minimum similarity threshold
                    similarities.push({
                        wine_id: otherWine.wine_id,
                        similarity: similarity,
                        common_users: this.getCommonUsers(wineRatings, otherWineRatings).length
                    });
                }
            }

            // Sort by similarity and common users
            similarities.sort((a, b) => {
                if (Math.abs(a.similarity - b.similarity) < 0.1) {
                    return b.common_users - a.common_users;
                }
                return b.similarity - a.similarity;
            });

            const result = similarities.slice(0, 20); // Top 20 similar wines
            this.setCachedSimilarity(cacheKey, result);
            return result;
        } catch (error) {
            console.error('Failed to find similar wines:', error.message);
            return [];
        }
    }

    /**
     * Calculate user similarity using Pearson correlation
     */
    calculateUserSimilarity(userRatings1, userRatings2) {
        const commonItems = this.getCommonItems(userRatings1, userRatings2);
        
        if (commonItems.length < this.minCommonItems) {
            return 0;
        }

        const ratings1 = commonItems.map(item => item.rating1);
        const ratings2 = commonItems.map(item => item.rating2);

        return this.pearsonCorrelation(ratings1, ratings2);
    }

    /**
     * Calculate wine similarity using Pearson correlation
     */
    calculateWineSimilarity(wineRatings1, wineRatings2) {
        const commonUsers = this.getCommonUsers(wineRatings1, wineRatings2);
        
        if (commonUsers.length < this.minCommonItems) {
            return 0;
        }

        const ratings1 = commonUsers.map(user => user.rating1);
        const ratings2 = commonUsers.map(user => user.rating2);

        return this.pearsonCorrelation(ratings1, ratings2);
    }

    /**
     * Calculate Pearson correlation coefficient
     */
    pearsonCorrelation(ratings1, ratings2) {
        if (ratings1.length !== ratings2.length || ratings1.length === 0) {
            return 0;
        }

        const n = ratings1.length;
        const sum1 = ratings1.reduce((a, b) => a + b, 0);
        const sum2 = ratings2.reduce((a, b) => a + b, 0);
        const sum1Sq = ratings1.reduce((a, b) => a + b * b, 0);
        const sum2Sq = ratings2.reduce((a, b) => a + b * b, 0);
        const pSum = ratings1.reduce((sum, rating, i) => sum + rating * ratings2[i], 0);

        const num = pSum - (sum1 * sum2 / n);
        const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

        if (den === 0) return 0;
        return num / den;
    }

    /**
     * Get common items between two user rating sets
     */
    getCommonItems(userRatings1, userRatings2) {
        const ratings1Map = new Map(userRatings1.map(r => [r.wine_id, r.overall_rating]));
        const commonItems = [];

        for (const rating2 of userRatings2) {
            if (ratings1Map.has(rating2.wine_id)) {
                commonItems.push({
                    wine_id: rating2.wine_id,
                    rating1: ratings1Map.get(rating2.wine_id),
                    rating2: rating2.overall_rating
                });
            }
        }

        return commonItems;
    }

    /**
     * Get common users between two wine rating sets
     */
    getCommonUsers(wineRatings1, wineRatings2) {
        const ratings1Map = new Map(wineRatings1.map(r => [r.user_id, r.overall_rating]));
        const commonUsers = [];

        for (const rating2 of wineRatings2) {
            if (ratings1Map.has(rating2.user_id)) {
                commonUsers.push({
                    user_id: rating2.user_id,
                    rating1: ratings1Map.get(rating2.user_id),
                    rating2: rating2.overall_rating
                });
            }
        }

        return commonUsers;
    }

    /**
     * Get recommendations from similar users
     */
    async getRecommendationsFromSimilarUsers(similarUsers, userRatings, dishContext, options) {
        const { limit, minRating, excludeWines, includeContext } = options;
        const userWineIds = new Set(userRatings.map(r => r.wine_id));
        const excludeSet = new Set(excludeWines);
        const recommendations = new Map();

        for (const similarUser of similarUsers) {
            const otherUserRatings = await this.getUserRatings(similarUser.user_id);
            
            for (const rating of otherUserRatings) {
                if (rating.overall_rating >= minRating && 
                    !userWineIds.has(rating.wine_id) && 
                    !excludeSet.has(rating.wine_id)) {
                    
                    const key = rating.wine_id;
                    if (!recommendations.has(key)) {
                        recommendations.set(key, {
                            wine_id: rating.wine_id,
                            score: 0,
                            count: 0,
                            ratings: []
                        });
                    }

                    const rec = recommendations.get(key);
                    rec.score += rating.overall_rating * similarUser.similarity;
                    rec.count += 1;
                    rec.ratings.push(rating.overall_rating);
                }
            }
        }

        // Calculate final scores and filter by context if needed
        const finalRecommendations = [];
        for (const [wineId, rec] of recommendations) {
            if (rec.count >= 2) { // At least 2 similar users rated this wine
                const avgRating = rec.ratings.reduce((a, b) => a + b, 0) / rec.ratings.length;
                const finalScore = (rec.score / rec.count) * Math.log(rec.count + 1); // Boost for more ratings
                
                finalRecommendations.push({
                    wine_id: wineId,
                    score: finalScore,
                    avg_rating: avgRating,
                    rating_count: rec.count,
                    algorithm: 'user_based_cf'
                });
            }
        }

        // Sort by score and apply context filtering if needed
        finalRecommendations.sort((a, b) => b.score - a.score);
        
        if (includeContext && dishContext) {
            return await this.filterByContext(finalRecommendations, dishContext);
        }

        return finalRecommendations.slice(0, limit);
    }

    /**
     * Get recommendations from similar wines
     */
    async getRecommendationsFromSimilarWines(similarWines, wineRatings, dishContext, options) {
        const { limit, minRating, excludeWines } = options;
        const excludeSet = new Set(excludeWines);
        const recommendations = [];

        for (const similarWine of similarWines) {
            if (!excludeSet.has(similarWine.wine_id)) {
                const otherWineRatings = await this.getWineRatings(similarWine.wine_id);
                const avgRating = otherWineRatings.reduce((sum, r) => sum + r.overall_rating, 0) / otherWineRatings.length;
                
                if (avgRating >= minRating) {
                    recommendations.push({
                        wine_id: similarWine.wine_id,
                        score: avgRating * similarWine.similarity,
                        avg_rating: avgRating,
                        rating_count: otherWineRatings.length,
                        similarity: similarWine.similarity,
                        algorithm: 'item_based_cf'
                    });
                }
            }
        }

        // Sort by score
        recommendations.sort((a, b) => b.score - a.score);
        return recommendations.slice(0, limit);
    }

    /**
     * Combine user-based and item-based recommendations
     */
    combineRecommendations(userBasedRecs, itemBasedRecs, weights) {
        const combined = new Map();

        // Add user-based recommendations
        for (const rec of userBasedRecs) {
            combined.set(rec.wine_id, {
                wine_id: rec.wine_id,
                user_score: rec.score * weights.userWeight,
                item_score: 0,
                combined_score: rec.score * weights.userWeight,
                algorithm: 'hybrid_cf',
                user_rating_count: rec.rating_count,
                item_rating_count: 0
            });
        }

        // Add item-based recommendations
        for (const rec of itemBasedRecs) {
            const key = rec.wine_id;
            if (combined.has(key)) {
                const existing = combined.get(key);
                existing.item_score = rec.score * weights.itemWeight;
                existing.combined_score += rec.score * weights.itemWeight;
                existing.item_rating_count = rec.rating_count;
            } else {
                combined.set(key, {
                    wine_id: rec.wine_id,
                    user_score: 0,
                    item_score: rec.score * weights.itemWeight,
                    combined_score: rec.score * weights.itemWeight,
                    algorithm: 'hybrid_cf',
                    user_rating_count: 0,
                    item_rating_count: rec.rating_count
                });
            }
        }

        // Convert to array and sort by combined score
        return Array.from(combined.values())
            .sort((a, b) => b.combined_score - a.combined_score);
    }

    /**
     * Filter recommendations by dish context
     */
    async filterByContext(recommendations, dishContext) {
        // This would integrate with the pairing engine for context-aware filtering
        // For now, return all recommendations
        return recommendations;
    }

    /**
     * Get user ratings from database
     */
    async getUserRatings(userId) {
        const rows = await this.db.all(`
            SELECT 
                r.wine_id,
                f.overall_rating,
                f.created_at,
                f.context
            FROM LearningPairingRecommendations r
            JOIN LearningPairingFeedbackEnhanced f ON f.recommendation_id = r.id
            WHERE f.user_id = ? AND f.overall_rating IS NOT NULL
            ORDER BY f.created_at DESC
        `, [userId]);

        return rows.map(row => ({
            wine_id: row.wine_id,
            overall_rating: row.overall_rating,
            created_at: row.created_at,
            context: row.context ? JSON.parse(row.context) : null
        }));
    }

    /**
     * Get wine ratings from database
     */
    async getWineRatings(wineId) {
        const rows = await this.db.all(`
            SELECT 
                f.user_id,
                f.overall_rating,
                f.created_at,
                f.context
            FROM LearningPairingRecommendations r
            JOIN LearningPairingFeedbackEnhanced f ON f.recommendation_id = r.id
            WHERE r.wine_id = ? AND f.overall_rating IS NOT NULL
            ORDER BY f.created_at DESC
        `, [wineId]);

        return rows.map(row => ({
            user_id: row.user_id,
            overall_rating: row.overall_rating,
            created_at: row.created_at,
            context: row.context ? JSON.parse(row.context) : null
        }));
    }

    /**
     * Cache management
     */
    getCachedSimilarity(key) {
        const cached = this.similarityCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        this.similarityCache.delete(key);
        return null;
    }

    setCachedSimilarity(key, data) {
        this.similarityCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear similarity cache
     */
    clearCache() {
        this.similarityCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.similarityCache.size,
            keys: Array.from(this.similarityCache.keys())
        };
    }

    /**
     * Update similarity matrices in background
     */
    async updateSimilarityMatrices() {
        try {
            console.log('Updating similarity matrices...');
            
            // Get all users with sufficient ratings
            const users = await this.db.all(`
                SELECT user_id, COUNT(*) as rating_count
                FROM LearningPairingFeedbackEnhanced
                WHERE user_id IS NOT NULL
                GROUP BY user_id
                HAVING rating_count >= ?
            `, [this.minCommonItems]);

            // Update user similarities
            for (const user of users) {
                const userRatings = await this.getUserRatings(user.user_id);
                await this.findSimilarUsers(user.user_id, userRatings);
            }

            // Get all wines with sufficient ratings
            const wines = await this.db.all(`
                SELECT wine_id, COUNT(*) as rating_count
                FROM LearningPairingRecommendations r
                JOIN LearningPairingFeedbackEnhanced f ON f.recommendation_id = r.id
                WHERE r.wine_id IS NOT NULL
                GROUP BY r.wine_id
                HAVING rating_count >= ?
            `, [this.minCommonItems]);

            // Update wine similarities
            for (const wine of wines) {
                const wineRatings = await this.getWineRatings(wine.wine_id);
                await this.findSimilarWines(wine.wine_id, wineRatings);
            }

            console.log(`Updated similarity matrices for ${users.length} users and ${wines.length} wines`);
        } catch (error) {
            console.error('Failed to update similarity matrices:', error.message);
        }
    }
}

module.exports = CollaborativeFilteringEngine;