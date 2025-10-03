/**
 * Online Learning Engine
 * Handles incremental model updates without full retraining
 */

const Database = require('../database/connection');
const MLModelManager = require('./ml_model_manager');

class OnlineLearningEngine {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.mlManager = new MLModelManager(this.db);
        this.updateBuffer = [];
        this.bufferSize = 50; // Process updates in batches
        this.updateInterval = 60000; // 1 minute
        this.startAutoUpdate();
    }

    /**
     * Add new rating for incremental learning
     */
    async addRating(userId, wineId, rating, metadata = {}) {
        this.updateBuffer.push({
            user_id: userId,
            wine_id: wineId,
            rating,
            timestamp: Date.now(),
            metadata
        });

        // Process if buffer is full
        if (this.updateBuffer.length >= this.bufferSize) {
            await this.processBufferedUpdates();
        }
    }

    /**
     * Process buffered updates incrementally
     */
    async processBufferedUpdates() {
        if (this.updateBuffer.length === 0) {
            return;
        }

        const updates = [...this.updateBuffer];
        this.updateBuffer = [];

        try {
            // Get current production model
            const currentModel = await this.getCurrentProductionModel();
            
            if (!currentModel) {
                console.log('⚠️  No production model found, skipping incremental update');
                return;
            }

            const startTime = Date.now();
            const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

            // Update user profiles incrementally
            await this.updateUserProfiles(currentModel.id, updates);

            // Update item profiles incrementally
            await this.updateItemProfiles(currentModel.id, updates);

            // Update similarity matrices if needed (threshold-based)
            if (updates.length >= this.bufferSize / 2) {
                await this.updateSimilarityMatrices(currentModel.id, updates);
            }

            const endTime = Date.now();
            const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

            // Log the update
            await this.logIncrementalUpdate(currentModel.id, {
                updateType: 'user_profile,item_profile',
                updatesApplied: updates.length,
                newDataSamples: updates.length,
                updateDurationMs: endTime - startTime,
                memoryUsageMb: endMemory - startMemory,
                status: 'success'
            });

            console.log(`✅ Processed ${updates.length} incremental updates in ${endTime - startTime}ms`);

        } catch (error) {
            console.error('Failed to process incremental updates:', error);
            // Re-add updates to buffer for retry
            this.updateBuffer.unshift(...updates);
            throw error;
        }
    }

    /**
     * Update user profiles with new ratings
     */
    async updateUserProfiles(modelId, updates) {
        // Get model data
        const model = await this.getModelData(modelId);
        
        if (!model || !model.userProfiles) {
            return;
        }

        // Group updates by user
        const userUpdates = {};
        for (const update of updates) {
            if (!userUpdates[update.user_id]) {
                userUpdates[update.user_id] = [];
            }
            userUpdates[update.user_id].push(update);
        }

        // Update each user's profile
        for (const [userId, userRatings] of Object.entries(userUpdates)) {
            if (!model.userProfiles[userId]) {
                // New user - create profile
                model.userProfiles[userId] = {
                    ratings: [],
                    items: new Set(),
                    avgRating: 0,
                    ratingCount: 0
                };
            }

            const profile = model.userProfiles[userId];

            // Add new ratings
            for (const rating of userRatings) {
                profile.ratings.push(rating.rating);
                profile.items.add(rating.wine_id);
                profile.ratingCount++;
            }

            // Update average rating (incremental)
            const totalRatings = profile.ratings.reduce((sum, r) => sum + r, 0);
            profile.avgRating = totalRatings / profile.ratings.length;
        }

        // Save updated model (in production, save to file system or cache)
        await this.saveModelData(modelId, model);
    }

    /**
     * Update item (wine) profiles with new ratings
     */
    async updateItemProfiles(modelId, updates) {
        const model = await this.getModelData(modelId);
        
        if (!model || !model.itemProfiles) {
            return;
        }

        // Group updates by wine
        const itemUpdates = {};
        for (const update of updates) {
            if (!itemUpdates[update.wine_id]) {
                itemUpdates[update.wine_id] = [];
            }
            itemUpdates[update.wine_id].push(update);
        }

        // Update each item's profile
        for (const [wineId, itemRatings] of Object.entries(itemUpdates)) {
            if (!model.itemProfiles[wineId]) {
                // New wine - create profile
                model.itemProfiles[wineId] = {
                    ratings: [],
                    users: new Set(),
                    avgRating: 0,
                    ratingCount: 0,
                    popularity: 0
                };
            }

            const profile = model.itemProfiles[wineId];

            // Add new ratings
            for (const rating of itemRatings) {
                profile.ratings.push(rating.rating);
                profile.users.add(rating.user_id);
                profile.ratingCount++;
            }

            // Update average rating and popularity
            const totalRatings = profile.ratings.reduce((sum, r) => sum + r, 0);
            profile.avgRating = totalRatings / profile.ratings.length;
            profile.popularity = profile.ratingCount; // Simple popularity metric
        }

        await this.saveModelData(modelId, model);
    }

    /**
     * Update similarity matrices (computationally expensive, do sparingly)
     */
    async updateSimilarityMatrices(modelId, updates) {
        const model = await this.getModelData(modelId);
        
        if (!model || !model.similarityMatrix) {
            return;
        }

        // Get affected users and items
        const affectedUsers = new Set(updates.map(u => u.user_id));
        const affectedItems = new Set(updates.map(u => u.wine_id));

        // Recalculate similarities only for affected entities
        // (In production, use more sophisticated incremental update algorithms)
        
        for (const userId of affectedUsers) {
            // Recalculate user similarities
            if (model.userProfiles[userId]) {
                await this.recalculateUserSimilarities(model, userId);
            }
        }

        for (const wineId of affectedItems) {
            // Recalculate item similarities
            if (model.itemProfiles[wineId]) {
                await this.recalculateItemSimilarities(model, wineId);
            }
        }

        await this.saveModelData(modelId, model);
    }

    /**
     * Recalculate similarities for a specific user
     */
    async recalculateUserSimilarities(model, userId) {
        const userProfile = model.userProfiles[userId];
        if (!userProfile) return;

        const similarities = {};
        const threshold = 0.3;

        // Compare with other users
        for (const [otherUserId, otherProfile] of Object.entries(model.userProfiles)) {
            if (otherUserId === userId) continue;

            // Find common items
            const commonItems = [...userProfile.items].filter(item => 
                otherProfile.items.has(item)
            );

            if (commonItems.length < 2) continue;

            // Calculate Pearson correlation on common items
            const sim = this.calculateSimilarity(
                userProfile.ratings,
                otherProfile.ratings
            );

            if (sim > threshold) {
                similarities[otherUserId] = sim;
            }
        }

        // Update similarity matrix
        if (!model.similarityMatrix.users) {
            model.similarityMatrix.users = {};
        }
        model.similarityMatrix.users[userId] = similarities;
    }

    /**
     * Recalculate similarities for a specific item
     */
    async recalculateItemSimilarities(model, wineId) {
        const itemProfile = model.itemProfiles[wineId];
        if (!itemProfile) return;

        const similarities = {};
        const threshold = 0.3;

        // Compare with other items
        for (const [otherWineId, otherProfile] of Object.entries(model.itemProfiles)) {
            if (otherWineId === wineId) continue;

            // Find common users
            const commonUsers = [...itemProfile.users].filter(user => 
                otherProfile.users.has(user)
            );

            if (commonUsers.length < 2) continue;

            // Calculate similarity
            const sim = this.calculateSimilarity(
                itemProfile.ratings,
                otherProfile.ratings
            );

            if (sim > threshold) {
                similarities[otherWineId] = sim;
            }
        }

        // Update similarity matrix
        if (!model.similarityMatrix.items) {
            model.similarityMatrix.items = {};
        }
        model.similarityMatrix.items[wineId] = similarities;
    }

    /**
     * Calculate similarity between two rating arrays
     */
    calculateSimilarity(ratings1, ratings2) {
        if (ratings1.length === 0 || ratings2.length === 0) return 0;

        const mean1 = ratings1.reduce((sum, r) => sum + r, 0) / ratings1.length;
        const mean2 = ratings2.reduce((sum, r) => sum + r, 0) / ratings2.length;

        const minLength = Math.min(ratings1.length, ratings2.length);
        
        let numerator = 0;
        let sum1Sq = 0;
        let sum2Sq = 0;

        for (let i = 0; i < minLength; i++) {
            const diff1 = ratings1[i] - mean1;
            const diff2 = ratings2[i] - mean2;
            
            numerator += diff1 * diff2;
            sum1Sq += diff1 * diff1;
            sum2Sq += diff2 * diff2;
        }

        const denominator = Math.sqrt(sum1Sq * sum2Sq);
        
        if (denominator === 0) return 0;
        
        return numerator / denominator;
    }

    /**
     * Get current production model
     */
    async getCurrentProductionModel() {
        return await this.db.get(`
            SELECT * FROM ModelRegistry
            WHERE status = 'production'
            ORDER BY deployed_at DESC
            LIMIT 1
        `);
    }

    /**
     * Get model data (from cache or storage)
     */
    async getModelData(modelId) {
        // In production, load from file system or cache
        // For now, fetch from database
        const model = await this.db.get(
            'SELECT model_data FROM ModelRegistry WHERE id = ?',
            [modelId]
        );

        if (!model || !model.model_data) {
            return null;
        }

        return JSON.parse(model.model_data);
    }

    /**
     * Save model data (to cache or storage)
     */
    async saveModelData(modelId, modelData) {
        // In production, save to file system and cache
        // For now, update database
        await this.db.run(`
            UPDATE ModelRegistry
            SET model_data = ?
            WHERE id = ?
        `, [JSON.stringify(modelData), modelId]);
    }

    /**
     * Log incremental update
     */
    async logIncrementalUpdate(modelId, updateInfo) {
        await this.db.run(`
            INSERT INTO IncrementalUpdateLog (
                model_id, update_type, updates_applied,
                new_data_samples, update_duration_ms,
                memory_usage_mb, status, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            modelId,
            updateInfo.updateType,
            updateInfo.updatesApplied,
            updateInfo.newDataSamples,
            updateInfo.updateDurationMs,
            updateInfo.memoryUsageMb,
            updateInfo.status,
            updateInfo.errorMessage || null
        ]);
    }

    /**
     * Start automatic update processing
     */
    startAutoUpdate() {
        this.updateTimer = setInterval(async () => {
            try {
                await this.processBufferedUpdates();
            } catch (error) {
                console.error('Auto-update failed:', error);
            }
        }, this.updateInterval);
    }

    /**
     * Stop automatic updates
     */
    stopAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /**
     * Force immediate update processing
     */
    async forceUpdate() {
        console.log('🔄 Forcing immediate update...');
        await this.processBufferedUpdates();
    }

    /**
     * Get update statistics
     */
    async getUpdateStats(modelId, days = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const stats = await this.db.all(`
            SELECT
                update_type,
                COUNT(*) as update_count,
                SUM(updates_applied) as total_updates,
                AVG(update_duration_ms) as avg_duration_ms,
                AVG(memory_usage_mb) as avg_memory_mb,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_updates,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_updates
            FROM IncrementalUpdateLog
            WHERE model_id = ? AND update_timestamp >= ?
            GROUP BY update_type
        `, [modelId, cutoffDate.toISOString()]);

        return stats;
    }

    /**
     * Shutdown gracefully
     */
    async shutdown() {
        this.stopAutoUpdate();
        await this.processBufferedUpdates();
        console.log('✅ Online learning engine shutdown complete');
    }
}

module.exports = OnlineLearningEngine;
