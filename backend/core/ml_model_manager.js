/**
 * ML Model Manager
 * Manages machine learning models, versioning, and performance tracking
 */

const Database = require('../database/connection');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class MLModelManager {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.modelsPath = path.join(__dirname, '../models');
        this.ensureModelsDirectory();
        this.modelCache = new Map();
        this.cacheExpiry = 60 * 60 * 1000; // 1 hour
    }

    /**
     * Create a new model
     */
    async createModel(modelData) {
        const {
            name,
            type,
            algorithm,
            parameters,
            trainingData,
            metadata = {}
        } = modelData;

        try {
            // Generate model ID and version
            const modelId = this.generateModelId(name);
            const version = await this.getNextVersion(modelId);
            
            // Train the model
            const trainedModel = await this.trainModel(type, algorithm, parameters, trainingData);
            
            // Save model to disk
            const modelPath = await this.saveModelToDisk(modelId, version, trainedModel);
            
            // Calculate performance metrics
            const performance = await this.evaluateModel(trainedModel, trainingData);
            
            // Store model metadata in database
            const modelRecord = await this.storeModelMetadata({
                modelId,
                version,
                name,
                type,
                algorithm,
                parameters: JSON.stringify(parameters),
                modelPath,
                performance: JSON.stringify(performance),
                metadata: JSON.stringify(metadata),
                status: 'active'
            });

            // Cache the model
            this.modelCache.set(`${modelId}_${version}`, {
                model: trainedModel,
                metadata: modelRecord,
                timestamp: Date.now()
            });

            return {
                modelId,
                version,
                performance,
                modelPath
            };
        } catch (error) {
            console.error('Failed to create model:', error.message);
            throw error;
        }
    }

    /**
     * Load a model by ID and version
     */
    async loadModel(modelId, version = 'latest') {
        const cacheKey = `${modelId}_${version}`;
        const cached = this.getCachedModel(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Get model metadata
            const modelRecord = await this.getModelMetadata(modelId, version);
            if (!modelRecord) {
                throw new Error(`Model ${modelId} version ${version} not found`);
            }

            // Load model from disk
            const model = await this.loadModelFromDisk(modelRecord.model_path);
            
            // Cache the model
            this.modelCache.set(cacheKey, {
                model,
                metadata: modelRecord,
                timestamp: Date.now()
            });

            return {
                model,
                metadata: modelRecord
            };
        } catch (error) {
            console.error('Failed to load model:', error.message);
            throw error;
        }
    }

    /**
     * Update a model incrementally
     */
    async updateModelIncremental(modelId, version, newData, options = {}) {
        const {
            learningRate = 0.01,
            batchSize = 32,
            maxIterations = 100
        } = options;

        try {
            // Load existing model
            const { model, metadata } = await this.loadModel(modelId, version);
            
            // Update model with new data
            const updatedModel = await this.updateModel(model, newData, {
                learningRate,
                batchSize,
                maxIterations
            });
            
            // Create new version
            const newVersion = await this.getNextVersion(modelId);
            
            // Save updated model
            const modelPath = await this.saveModelToDisk(modelId, newVersion, updatedModel);
            
            // Evaluate updated model
            const performance = await this.evaluateModel(updatedModel, newData);
            
            // Store new version metadata
            const updatedRecord = await this.storeModelMetadata({
                modelId,
                version: newVersion,
                name: metadata.name,
                type: metadata.type,
                algorithm: metadata.algorithm,
                parameters: metadata.parameters,
                modelPath,
                performance: JSON.stringify(performance),
                metadata: JSON.stringify({
                    ...JSON.parse(metadata.metadata),
                    incrementalUpdate: true,
                    parentVersion: version,
                    updateTimestamp: new Date().toISOString()
                }),
                status: 'active'
            });

            return {
                modelId,
                version: newVersion,
                performance,
                modelPath
            };
        } catch (error) {
            console.error('Failed to update model incrementally:', error.message);
            throw error;
        }
    }

    /**
     * Compare model performance
     */
    async compareModels(modelId, versions = []) {
        try {
            const comparisons = [];
            
            for (const version of versions) {
                const modelRecord = await this.getModelMetadata(modelId, version);
                if (modelRecord) {
                    const performance = JSON.parse(modelRecord.performance);
                    comparisons.push({
                        version,
                        performance,
                        created_at: modelRecord.created_at,
                        metadata: JSON.parse(modelRecord.metadata)
                    });
                }
            }

            // Sort by performance metrics
            comparisons.sort((a, b) => {
                const scoreA = this.calculateOverallScore(a.performance);
                const scoreB = this.calculateOverallScore(b.performance);
                return scoreB - scoreA;
            });

            return comparisons;
        } catch (error) {
            console.error('Failed to compare models:', error.message);
            throw error;
        }
    }

    /**
     * A/B test models
     */
    async runABTest(modelId1, version1, modelId2, version2, testData, options = {}) {
        const {
            trafficSplit = 0.5,
            testDuration = 7 * 24 * 60 * 60 * 1000, // 7 days
            minSamples = 100
        } = options;

        try {
            // Load both models
            const [model1, model2] = await Promise.all([
                this.loadModel(modelId1, version1),
                this.loadModel(modelId2, version2)
            ]);

            // Create A/B test record
            const testId = this.generateTestId();
            const testRecord = await this.createABTestRecord({
                testId,
                modelId1,
                version1,
                modelId2,
                version2,
                trafficSplit,
                testDuration,
                status: 'running'
            });

            // Run predictions on test data
            const results = await this.runABTestPredictions(
                model1.model,
                model2.model,
                testData,
                trafficSplit
            );

            // Store test results
            await this.storeABTestResults(testId, results);

            return {
                testId,
                results,
                testRecord
            };
        } catch (error) {
            console.error('Failed to run A/B test:', error.message);
            throw error;
        }
    }

    /**
     * Get model performance metrics
     */
    async getModelPerformance(modelId, version = 'latest') {
        try {
            const modelRecord = await this.getModelMetadata(modelId, version);
            if (!modelRecord) {
                throw new Error(`Model ${modelId} version ${version} not found`);
            }

            const performance = JSON.parse(modelRecord.performance);
            const metadata = JSON.parse(modelRecord.metadata);

            return {
                modelId,
                version,
                performance,
                metadata,
                created_at: modelRecord.created_at,
                updated_at: modelRecord.updated_at
            };
        } catch (error) {
            console.error('Failed to get model performance:', error.message);
            throw error;
        }
    }

    /**
     * List all models
     */
    async listModels(options = {}) {
        const {
            type = null,
            status = 'active',
            limit = 50,
            offset = 0
        } = options;

        try {
            let query = `
                SELECT model_id, version, name, type, algorithm, 
                       performance, metadata, status, created_at, updated_at
                FROM LearningModels
                WHERE status = ?
            `;
            const params = [status];

            if (type) {
                query += ' AND type = ?';
                params.push(type);
            }

            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const rows = await this.db.all(query, params);

            return rows.map(row => ({
                modelId: row.model_id,
                version: row.version,
                name: row.name,
                type: row.type,
                algorithm: row.algorithm,
                performance: JSON.parse(row.performance),
                metadata: JSON.parse(row.metadata),
                status: row.status,
                created_at: row.created_at,
                updated_at: row.updated_at
            }));
        } catch (error) {
            console.error('Failed to list models:', error.message);
            throw error;
        }
    }

    /**
     * Delete a model version
     */
    async deleteModel(modelId, version) {
        try {
            // Get model metadata
            const modelRecord = await this.getModelMetadata(modelId, version);
            if (!modelRecord) {
                throw new Error(`Model ${modelId} version ${version} not found`);
            }

            // Delete model file from disk
            if (fs.existsSync(modelRecord.model_path)) {
                fs.unlinkSync(modelRecord.model_path);
            }

            // Mark as deleted in database
            await this.db.run(`
                UPDATE LearningModels 
                SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
                WHERE model_id = ? AND version = ?
            `, [modelId, version]);

            // Remove from cache
            this.modelCache.delete(`${modelId}_${version}`);

            return true;
        } catch (error) {
            console.error('Failed to delete model:', error.message);
            throw error;
        }
    }

    /**
     * Train a model based on type and algorithm
     */
    async trainModel(type, algorithm, parameters, trainingData) {
        switch (type) {
            case 'collaborative_filtering':
                return await this.trainCollaborativeFilteringModel(algorithm, parameters, trainingData);
            case 'content_based':
                return await this.trainContentBasedModel(algorithm, parameters, trainingData);
            case 'hybrid':
                return await this.trainHybridModel(algorithm, parameters, trainingData);
            default:
                throw new Error(`Unknown model type: ${type}`);
        }
    }

    /**
     * Train collaborative filtering model
     */
    async trainCollaborativeFilteringModel(algorithm, parameters, trainingData) {
        console.log(`Training collaborative filtering model with ${trainingData.length} samples...`);
        
        const minSimilarity = parameters.minSimilarity || 0.3;
        const minCommonItems = parameters.minCommonItems || 3;
        
        // Build user-user and item-item similarity matrices
        const similarityMatrix = await this.buildSimilarityMatrix(trainingData, minSimilarity, minCommonItems);
        
        // Build user profiles (rating history and preferences)
        const userProfiles = await this.buildUserProfiles(trainingData);
        
        // Build item profiles (rating statistics)
        const itemProfiles = await this.buildItemProfiles(trainingData);
        
        console.log(`Training complete: ${Object.keys(similarityMatrix.users).length} user similarities, ${Object.keys(similarityMatrix.items).length} item similarities`);
        
        return {
            type: 'collaborative_filtering',
            algorithm,
            parameters: {
                ...parameters,
                minSimilarity,
                minCommonItems
            },
            similarityMatrix,
            userProfiles,
            itemProfiles,
            statistics: {
                totalUsers: Object.keys(userProfiles).length,
                totalItems: Object.keys(itemProfiles).length,
                totalRatings: trainingData.length,
                avgRatingsPerUser: trainingData.length / Object.keys(userProfiles).length,
                avgRatingsPerItem: trainingData.length / Object.keys(itemProfiles).length
            },
            trainedAt: new Date().toISOString()
        };
    }

    /**
     * Train content-based model
     */
    async trainContentBasedModel(algorithm, parameters, trainingData) {
        console.log(`Training content-based model with ${trainingData.length} samples...`);
        
        // Extract features for all items in training data
        const itemFeatures = await this.extractItemFeatures(trainingData);
        
        // Calculate feature weights based on their importance for predictions
        const featureWeights = await this.calculateFeatureWeights(trainingData, itemFeatures);
        
        console.log(`Training complete: ${Object.keys(itemFeatures).length} items with features`);
        
        return {
            type: 'content_based',
            algorithm,
            parameters,
            featureWeights,
            itemFeatures,
            statistics: {
                totalItems: Object.keys(itemFeatures).length,
                featureCount: Object.keys(featureWeights).length
            },
            trainedAt: new Date().toISOString()
        };
    }

    /**
     * Train hybrid model
     */
    async trainHybridModel(algorithm, parameters, trainingData) {
        // This would combine collaborative filtering and content-based approaches
        return {
            type: 'hybrid',
            algorithm,
            parameters,
            collaborativeComponent: await this.trainCollaborativeFilteringModel(algorithm, parameters, trainingData),
            contentBasedComponent: await this.trainContentBasedModel(algorithm, parameters, trainingData),
            combinationWeights: this.calculateCombinationWeights(trainingData),
            trainedAt: new Date().toISOString()
        };
    }

    /**
     * Evaluate model performance
     */
    async evaluateModel(model, testData) {
        console.log(`Evaluating model on ${testData.length} test samples...`);
        
        if (testData.length === 0) {
            throw new Error('Test data is empty');
        }
        
        const predictions = [];
        const actuals = [];
        
        // Make predictions for each test sample
        for (const sample of testData) {
            try {
                const prediction = await this.predictRating(model, sample);
                const actual = sample.overall_rating || sample.rating;
                
                if (prediction !== null && actual !== null) {
                    predictions.push(prediction);
                    actuals.push(actual);
                }
            } catch (error) {
                console.warn('Prediction failed for sample:', error.message);
            }
        }
        
        if (predictions.length === 0) {
            throw new Error('No valid predictions generated');
        }
        
        // Calculate RMSE (Root Mean Squared Error)
        let sumSquaredError = 0;
        let sumAbsError = 0;
        
        for (let i = 0; i < predictions.length; i++) {
            const error = predictions[i] - actuals[i];
            sumSquaredError += error * error;
            sumAbsError += Math.abs(error);
        }
        
        const rmse = Math.sqrt(sumSquaredError / predictions.length);
        const mae = sumAbsError / predictions.length;
        
        // Calculate accuracy (within 0.5 rating points)
        let correct = 0;
        for (let i = 0; i < predictions.length; i++) {
            if (Math.abs(predictions[i] - actuals[i]) <= 0.5) {
                correct++;
            }
        }
        const accuracy = correct / predictions.length;
        
        // Calculate precision and recall for top-k recommendations
        const topK = 10;
        const { precision, recall, f1_score } = this.calculatePrecisionRecall(predictions, actuals, topK);
        
        console.log(`Evaluation complete: RMSE=${rmse.toFixed(4)}, MAE=${mae.toFixed(4)}, Accuracy=${(accuracy * 100).toFixed(2)}%`);
        
        return {
            accuracy: Math.round(accuracy * 100) / 100,
            precision: Math.round(precision * 100) / 100,
            recall: Math.round(recall * 100) / 100,
            f1_score: Math.round(f1_score * 100) / 100,
            rmse: Math.round(rmse * 100) / 100,
            mae: Math.round(mae * 100) / 100,
            sample_size: predictions.length,
            evaluation_timestamp: new Date().toISOString()
        };
    }

    /**
     * Update model with new data
     */
    async updateModel(model, newData, options) {
        // This would implement actual incremental learning
        // For now, return updated model structure
        return {
            ...model,
            updatedAt: new Date().toISOString(),
            updateOptions: options,
            newDataSize: newData.length
        };
    }

    // Helper methods
    ensureModelsDirectory() {
        if (!fs.existsSync(this.modelsPath)) {
            fs.mkdirSync(this.modelsPath, { recursive: true });
        }
    }

    generateModelId(name) {
        const timestamp = Date.now();
        const hash = crypto.createHash('md5').update(name + timestamp).digest('hex');
        return `${name}_${hash.substring(0, 8)}`;
    }

    generateTestId() {
        return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async getNextVersion(modelId) {
        const row = await this.db.get(`
            SELECT MAX(CAST(version AS INTEGER)) as max_version
            FROM LearningModels
            WHERE model_id = ?
        `, [modelId]);

        return (row?.max_version || 0) + 1;
    }

    async saveModelToDisk(modelId, version, model) {
        const filename = `${modelId}_v${version}.json`;
        const filepath = path.join(this.modelsPath, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(model, null, 2));
        return filepath;
    }

    async loadModelFromDisk(modelPath) {
        if (!fs.existsSync(modelPath)) {
            throw new Error(`Model file not found: ${modelPath}`);
        }
        
        const modelData = fs.readFileSync(modelPath, 'utf8');
        return JSON.parse(modelData);
    }

    async storeModelMetadata(metadata) {
        const result = await this.db.run(`
            INSERT INTO LearningModels (
                model_id, version, name, type, algorithm, parameters,
                model_data, performance, metadata, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            metadata.modelId,
            metadata.version,
            metadata.name,
            metadata.type,
            metadata.algorithm,
            metadata.parameters,
            metadata.modelPath,
            metadata.performance,
            metadata.metadata,
            metadata.status
        ]);

        return {
            id: result.lastID,
            ...metadata
        };
    }

    async getModelMetadata(modelId, version) {
        if (version === 'latest') {
            const row = await this.db.get(`
                SELECT * FROM LearningModels
                WHERE model_id = ? AND status = 'active'
                ORDER BY CAST(version AS INTEGER) DESC
                LIMIT 1
            `, [modelId]);
            return row;
        } else {
            const row = await this.db.get(`
                SELECT * FROM LearningModels
                WHERE model_id = ? AND version = ? AND status = 'active'
            `, [modelId, version]);
            return row;
        }
    }

    getCachedModel(cacheKey) {
        const cached = this.modelCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached;
        }
        this.modelCache.delete(cacheKey);
        return null;
    }

    calculateOverallScore(performance) {
        // Weighted combination of performance metrics
        return (performance.accuracy * 0.3) + 
               (performance.precision * 0.2) + 
               (performance.recall * 0.2) + 
               (performance.f1_score * 0.3);
    }

    async buildSimilarityMatrix(trainingData, minSimilarity = 0.3, minCommonItems = 3) {
        const userSimilarities = {};
        const itemSimilarities = {};
        
        // Group ratings by user and item
        const userRatings = {};
        const itemRatings = {};
        
        for (const rating of trainingData) {
            const userId = rating.user_id || rating.userId;
            const itemId = rating.wine_id || rating.item_id || rating.itemId;
            const ratingValue = rating.overall_rating || rating.rating;
            
            if (!userId || !itemId || !ratingValue) continue;
            
            if (!userRatings[userId]) userRatings[userId] = {};
            if (!itemRatings[itemId]) itemRatings[itemId] = {};
            
            userRatings[userId][itemId] = ratingValue;
            itemRatings[itemId][userId] = ratingValue;
        }
        
        const userIds = Object.keys(userRatings);
        const itemIds = Object.keys(itemRatings);
        
        // Calculate user-user similarities
        for (let i = 0; i < userIds.length; i++) {
            for (let j = i + 1; j < userIds.length; j++) {
                const user1 = userIds[i];
                const user2 = userIds[j];
                
                const commonItems = this.getCommonKeys(userRatings[user1], userRatings[user2]);
                if (commonItems.length < minCommonItems) continue;
                
                const ratings1 = commonItems.map(item => userRatings[user1][item]);
                const ratings2 = commonItems.map(item => userRatings[user2][item]);
                
                const similarity = this.pearsonCorrelation(ratings1, ratings2);
                
                if (similarity > minSimilarity) {
                    if (!userSimilarities[user1]) userSimilarities[user1] = {};
                    if (!userSimilarities[user2]) userSimilarities[user2] = {};
                    
                    userSimilarities[user1][user2] = { similarity, commonItems: commonItems.length };
                    userSimilarities[user2][user1] = { similarity, commonItems: commonItems.length };
                }
            }
        }
        
        // Calculate item-item similarities
        for (let i = 0; i < itemIds.length; i++) {
            for (let j = i + 1; j < itemIds.length; j++) {
                const item1 = itemIds[i];
                const item2 = itemIds[j];
                
                const commonUsers = this.getCommonKeys(itemRatings[item1], itemRatings[item2]);
                if (commonUsers.length < minCommonItems) continue;
                
                const ratings1 = commonUsers.map(user => itemRatings[item1][user]);
                const ratings2 = commonUsers.map(user => itemRatings[item2][user]);
                
                const similarity = this.pearsonCorrelation(ratings1, ratings2);
                
                if (similarity > minSimilarity) {
                    if (!itemSimilarities[item1]) itemSimilarities[item1] = {};
                    if (!itemSimilarities[item2]) itemSimilarities[item2] = {};
                    
                    itemSimilarities[item1][item2] = { similarity, commonUsers: commonUsers.length };
                    itemSimilarities[item2][item1] = { similarity, commonUsers: commonUsers.length };
                }
            }
        }
        
        return { users: userSimilarities, items: itemSimilarities };
    }

    async buildUserProfiles(trainingData) {
        const profiles = {};
        
        for (const rating of trainingData) {
            const userId = rating.user_id || rating.userId;
            const itemId = rating.wine_id || rating.item_id || rating.itemId;
            const ratingValue = rating.overall_rating || rating.rating;
            
            if (!userId || !itemId || !ratingValue) continue;
            
            if (!profiles[userId]) {
                profiles[userId] = {
                    ratings: {},
                    ratingCount: 0,
                    avgRating: 0,
                    ratingSum: 0,
                    items: []
                };
            }
            
            profiles[userId].ratings[itemId] = ratingValue;
            profiles[userId].ratingCount++;
            profiles[userId].ratingSum += ratingValue;
            profiles[userId].items.push(itemId);
        }
        
        // Calculate average ratings
        for (const userId in profiles) {
            const profile = profiles[userId];
            profile.avgRating = profile.ratingSum / profile.ratingCount;
            delete profile.ratingSum; // Remove temp field
        }
        
        return profiles;
    }

    async buildItemProfiles(trainingData) {
        const profiles = {};
        
        for (const rating of trainingData) {
            const userId = rating.user_id || rating.userId;
            const itemId = rating.wine_id || rating.item_id || rating.itemId;
            const ratingValue = rating.overall_rating || rating.rating;
            
            if (!userId || !itemId || !ratingValue) continue;
            
            if (!profiles[itemId]) {
                profiles[itemId] = {
                    ratings: {},
                    ratingCount: 0,
                    avgRating: 0,
                    ratingSum: 0,
                    users: []
                };
            }
            
            profiles[itemId].ratings[userId] = ratingValue;
            profiles[itemId].ratingCount++;
            profiles[itemId].ratingSum += ratingValue;
            profiles[itemId].users.push(userId);
        }
        
        // Calculate average ratings and popularity
        for (const itemId in profiles) {
            const profile = profiles[itemId];
            profile.avgRating = profile.ratingSum / profile.ratingCount;
            profile.popularity = profile.ratingCount; // Popularity = number of ratings
            delete profile.ratingSum; // Remove temp field
        }
        
        return profiles;
    }

    async calculateFeatureWeights(trainingData, itemFeatures) {
        // Calculate TF-IDF style weights for features
        const featureWeights = {};
        const featureCounts = {};
        const totalItems = Object.keys(itemFeatures).length;
        
        // Count feature occurrences across items
        for (const itemId in itemFeatures) {
            const features = itemFeatures[itemId];
            for (const feature in features) {
                if (typeof features[feature] === 'number') {
                    if (!featureCounts[feature]) featureCounts[feature] = 0;
                    featureCounts[feature]++;
                }
            }
        }
        
        // Calculate IDF (Inverse Document Frequency) style weights
        for (const feature in featureCounts) {
            const documentFrequency = featureCounts[feature] / totalItems;
            // Features that appear in 20-80% of items are most discriminative
            const weight = 1 - Math.abs(0.5 - documentFrequency);
            featureWeights[feature] = weight;
        }
        
        return featureWeights;
    }

    async extractItemFeatures(trainingData) {
        const itemFeatures = {};
        const uniqueItems = new Set();
        
        // Collect unique items
        for (const rating of trainingData) {
            const itemId = rating.wine_id || rating.item_id || rating.itemId;
            if (itemId) uniqueItems.add(itemId);
        }
        
        // Fetch features from database for each item
        for (const itemId of uniqueItems) {
            try {
                const features = await this.db.get(`
                    SELECT wf.*, w.wine_type, w.region, w.country
                    FROM WineFeatures wf
                    JOIN Wines w ON wf.wine_id = w.id
                    WHERE wf.wine_id = ?
                `, [itemId]);
                
                if (features) {
                    itemFeatures[itemId] = {
                        wine_type: features.wine_type,
                        region: features.region_encoded || 0,
                        country: features.country_encoded || 0,
                        body_score: features.body_score || 3,
                        acidity_score: features.acidity_score || 3,
                        tannin_score: features.tannin_score || 3,
                        sweetness_score: features.sweetness_score || 1,
                        complexity_score: features.complexity_score || 3,
                        quality_score: features.quality_score || 0,
                        feature_vector: features.feature_vector ? JSON.parse(features.feature_vector) : null
                    };
                }
            } catch (error) {
                console.warn(`Failed to fetch features for item ${itemId}:`, error.message);
            }
        }
        
        return itemFeatures;
    }

    async calculateCombinationWeights(trainingData) {
        // Calculate optimal weights by testing different combinations
        // For now, use a reasonable default based on data size
        const dataSize = trainingData.length;
        
        // More data favors collaborative filtering
        // Less data favors content-based
        const collaborativeWeight = Math.min(0.7, 0.4 + (dataSize / 1000) * 0.3);
        const contentBasedWeight = 1 - collaborativeWeight;
        
        return { 
            collaborative: Math.round(collaborativeWeight * 100) / 100, 
            contentBased: Math.round(contentBasedWeight * 100) / 100 
        };
    }

    async createABTestRecord(testData) {
        const result = await this.db.run(`
            INSERT INTO ABTests (
                test_id, model_id1, version1, model_id2, version2,
                traffic_split, test_duration, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            testData.testId,
            testData.modelId1,
            testData.version1,
            testData.modelId2,
            testData.version2,
            testData.trafficSplit,
            testData.testDuration,
            testData.status
        ]);

        return { id: result.lastID, ...testData };
    }

    async storeABTestResults(testId, results) {
        await this.db.run(`
            INSERT INTO ABTestResults (
                test_id, results, created_at
            ) VALUES (?, ?, CURRENT_TIMESTAMP)
        `, [testId, JSON.stringify(results)]);
    }

    async runABTestPredictions(model1, model2, testData, trafficSplit) {
        // Split test data according to traffic split
        const splitIndex = Math.floor(testData.length * trafficSplit);
        const model1Data = testData.slice(0, splitIndex);
        const model2Data = testData.slice(splitIndex);
        
        // Evaluate both models
        const [model1Metrics, model2Metrics] = await Promise.all([
            this.evaluateModel(model1, model1Data).catch(() => ({ accuracy: 0, samples: 0 })),
            this.evaluateModel(model2, model2Data).catch(() => ({ accuracy: 0, samples: 0 }))
        ]);
        
        // Calculate statistical significance using z-test
        const significance = this.calculateStatisticalSignificance(
            model1Metrics.accuracy,
            model1Metrics.sample_size || model1Data.length,
            model2Metrics.accuracy,
            model2Metrics.sample_size || model2Data.length
        );
        
        return {
            model1Results: { 
                ...model1Metrics,
                samples: model1Metrics.sample_size || model1Data.length 
            },
            model2Results: { 
                ...model2Metrics,
                samples: model2Metrics.sample_size || model2Data.length 
            },
            statisticalSignificance: significance,
            significanceLevel: significance > 0.95 ? 'high' : significance > 0.90 ? 'medium' : 'low'
        };
    }
    
    /**
     * Calculate Pearson correlation coefficient
     */
    pearsonCorrelation(x, y) {
        if (x.length !== y.length || x.length === 0) {
            return 0;
        }
        
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
        
        const numerator = (n * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
        
        if (denominator === 0) return 0;
        
        return numerator / denominator;
    }
    
    /**
     * Get common keys between two objects
     */
    getCommonKeys(obj1, obj2) {
        const keys1 = Object.keys(obj1);
        const keys2 = new Set(Object.keys(obj2));
        return keys1.filter(key => keys2.has(key));
    }
    
    /**
     * Predict rating for a sample using the model
     */
    async predictRating(model, sample) {
        const userId = sample.user_id || sample.userId;
        const itemId = sample.wine_id || sample.item_id || sample.itemId;
        
        if (!userId || !itemId) return null;
        
        if (model.type === 'collaborative_filtering') {
            return this.predictCollaborativeFiltering(model, userId, itemId);
        } else if (model.type === 'content_based') {
            return this.predictContentBased(model, userId, itemId);
        } else if (model.type === 'hybrid') {
            const cfPrediction = this.predictCollaborativeFiltering(model.collaborativeComponent, userId, itemId);
            const cbPrediction = this.predictContentBased(model.contentBasedComponent, userId, itemId);
            
            if (cfPrediction === null) return cbPrediction;
            if (cbPrediction === null) return cfPrediction;
            
            const weights = model.combinationWeights || { collaborative: 0.6, contentBased: 0.4 };
            return (cfPrediction * weights.collaborative) + (cbPrediction * weights.contentBased);
        }
        
        return null;
    }
    
    /**
     * Predict rating using collaborative filtering
     */
    predictCollaborativeFiltering(model, userId, itemId) {
        const userProfile = model.userProfiles[userId];
        const itemProfile = model.itemProfiles[itemId];
        
        if (!userProfile && !itemProfile) {
            // No data, return null
            return null;
        }
        
        if (!userProfile) {
            // New user, return item average
            return itemProfile ? itemProfile.avgRating : 3.0;
        }
        
        if (!itemProfile) {
            // New item, return user average
            return userProfile.avgRating;
        }
        
        // If user already rated this item, return that rating (for evaluation)
        if (userProfile.ratings[itemId]) {
            return userProfile.ratings[itemId];
        }
        
        // Find similar users who rated this item
        const similarUsers = model.similarityMatrix.users[userId] || {};
        let weightedSum = 0;
        let similaritySum = 0;
        
        for (const similarUserId in similarUsers) {
            const similarUserProfile = model.userProfiles[similarUserId];
            if (similarUserProfile && similarUserProfile.ratings[itemId]) {
                const similarity = similarUsers[similarUserId].similarity;
                weightedSum += similarity * similarUserProfile.ratings[itemId];
                similaritySum += Math.abs(similarity);
            }
        }
        
        if (similaritySum > 0) {
            return weightedSum / similaritySum;
        }
        
        // Fallback: item average
        return itemProfile.avgRating;
    }
    
    /**
     * Predict rating using content-based approach
     */
    predictContentBased(model, userId, itemId) {
        const itemFeatures = model.itemFeatures[itemId];
        
        if (!itemFeatures) {
            return 3.0; // Default rating
        }
        
        // For content-based, we'd typically compare with user's liked items
        // For now, use quality score and complexity as proxy
        const qualityScore = itemFeatures.quality_score || 0;
        const complexityScore = itemFeatures.complexity_score || 3;
        
        // Normalize to 1-5 scale
        const prediction = 2.5 + (qualityScore / 100) * 2 + (complexityScore - 3) * 0.3;
        
        return Math.max(1, Math.min(5, prediction));
    }
    
    /**
     * Calculate precision and recall
     */
    calculatePrecisionRecall(predictions, actuals, topK) {
        // For rating prediction, consider ratings >= 4 as relevant
        const threshold = 4.0;
        
        let truePositives = 0;
        let falsePositives = 0;
        let falseNegatives = 0;
        let trueNegatives = 0;
        
        for (let i = 0; i < Math.min(predictions.length, actuals.length); i++) {
            const predicted = predictions[i] >= threshold;
            const actual = actuals[i] >= threshold;
            
            if (predicted && actual) truePositives++;
            else if (predicted && !actual) falsePositives++;
            else if (!predicted && actual) falseNegatives++;
            else trueNegatives++;
        }
        
        const precision = truePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
        const recall = truePositives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
        const f1_score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
        
        return { precision, recall, f1_score };
    }
    
    /**
     * Calculate statistical significance for A/B test
     */
    calculateStatisticalSignificance(accuracy1, n1, accuracy2, n2) {
        if (n1 === 0 || n2 === 0) return 0;
        
        // Z-test for proportions
        const p1 = accuracy1;
        const p2 = accuracy2;
        const p = (p1 * n1 + p2 * n2) / (n1 + n2);
        
        const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
        if (se === 0) return 0;
        
        const z = Math.abs(p1 - p2) / se;
        
        // Convert z-score to confidence level (approximation)
        // z > 1.96 => 95% confidence, z > 2.58 => 99% confidence
        const confidence = 1 - Math.exp(-0.717 * z - 0.416 * z * z);
        
        return Math.min(0.99, Math.max(0, confidence));
    }
}

module.exports = MLModelManager;
