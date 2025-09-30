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
        // This would implement actual collaborative filtering training
        // For now, return a mock model structure
        return {
            type: 'collaborative_filtering',
            algorithm,
            parameters,
            similarityMatrix: this.buildSimilarityMatrix(trainingData),
            userProfiles: this.buildUserProfiles(trainingData),
            itemProfiles: this.buildItemProfiles(trainingData),
            trainedAt: new Date().toISOString()
        };
    }

    /**
     * Train content-based model
     */
    async trainContentBasedModel(algorithm, parameters, trainingData) {
        // This would implement actual content-based training
        return {
            type: 'content_based',
            algorithm,
            parameters,
            featureWeights: this.calculateFeatureWeights(trainingData),
            itemFeatures: this.extractItemFeatures(trainingData),
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
        // This would implement actual model evaluation
        // For now, return mock performance metrics
        return {
            accuracy: 0.85,
            precision: 0.87,
            recall: 0.83,
            f1_score: 0.85,
            rmse: 0.12,
            mae: 0.08,
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

    buildSimilarityMatrix(trainingData) {
        // Mock similarity matrix construction
        return { users: {}, items: {} };
    }

    buildUserProfiles(trainingData) {
        // Mock user profile construction
        return {};
    }

    buildItemProfiles(trainingData) {
        // Mock item profile construction
        return {};
    }

    calculateFeatureWeights(trainingData) {
        // Mock feature weight calculation
        return {};
    }

    extractItemFeatures(trainingData) {
        // Mock item feature extraction
        return {};
    }

    calculateCombinationWeights(trainingData) {
        // Mock combination weight calculation
        return { collaborative: 0.6, contentBased: 0.4 };
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
        // Mock A/B test predictions
        return {
            model1Results: { accuracy: 0.85, samples: Math.floor(testData.length * trafficSplit) },
            model2Results: { accuracy: 0.87, samples: Math.floor(testData.length * (1 - trafficSplit)) },
            statisticalSignificance: 0.95
        };
    }
}

module.exports = MLModelManager;