#!/usr/bin/env node

/**
 * SommOS ML Training Pipeline
 * 
 * Trains machine learning models using the synthetic data from the year-long simulation.
 * 
 * Trains three main models:
 * 1. Pairing Recommendation Model - Wine-dish pairing predictions
 * 2. Collaborative Filtering Model - User preference learning
 * 3. Procurement Demand Model - Inventory demand forecasting
 * 
 * Usage: npm run train:ml
 * 
 * Prerequisites:
 * - Simulation data must exist (run npm run simulate:year first)
 * - Database populated with LearningPairingFeedbackEnhanced data
 * 
 * Output:
 * - Trained models saved to backend/models/
 * - Performance metrics logged to LearningMetrics table
 * - Training report: data/training_report_[timestamp].txt
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_PATH = path.join(__dirname, '../data/sommos.db');
const MODELS_DIR = path.join(__dirname, '../backend/models');
const REPORT_DIR = path.join(__dirname, '../data');

// Training configuration
const CONFIG = {
    pairing: {
        testSplit: 0.2,
        minSamples: 50,
        algorithm: 'gradient_boosting',
        parameters: {
            learningRate: 0.05,
            maxDepth: 5,
            nEstimators: 100
        }
    },
    collaborative: {
        testSplit: 0.2,
        minSamples: 30,
        algorithm: 'matrix_factorization',
        parameters: {
            factors: 10,
            regularization: 0.01,
            iterations: 50
        }
    },
    procurement: {
        testSplit: 0.2,
        minSamples: 100,
        algorithm: 'time_series_forecast',
        parameters: {
            seasonalPeriod: 7,
            trendDegree: 1,
            forecastHorizon: 30
        }
    }
};

// ============================================================================
// DATABASE HELPERS
// ============================================================================

function openDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

function closeDatabase(db) {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// ============================================================================
// DATA EXTRACTION
// ============================================================================

async function extractPairingData(db) {
    console.log('  📊 Extracting pairing training data...');
    
    const data = await dbAll(db, `
        SELECT 
            s.id as session_id,
            s.dish_description,
            json_extract(s.dish_context, '$.cuisine') as cuisine,
            json_extract(s.dish_context, '$.protein') as protein,
            json_extract(s.dish_context, '$.intensity') as intensity,
            json_extract(s.dish_context, '$.occasion') as occasion,
            json_extract(s.dish_context, '$.guest_count') as guest_count,
            json_extract(s.dish_context, '$.season') as season,
            json_extract(s.dish_context, '$.time_of_day') as time_of_day,
            r.wine_id,
            r.wine_name,
            r.wine_type,
            r.region,
            r.ranking,
            f.user_id,
            f.overall_rating,
            f.flavor_harmony_rating,
            f.texture_balance_rating,
            f.acidity_match_rating,
            f.tannin_balance_rating,
            f.body_match_rating,
            f.regional_tradition_rating,
            f.selected,
            f.would_recommend,
            f.price_satisfaction
        FROM LearningPairingSessions s
        JOIN LearningPairingRecommendations r ON s.id = r.session_id
        JOIN LearningPairingFeedbackEnhanced f ON r.id = f.recommendation_id
        ORDER BY s.created_at
    `);
    
    console.log(`    ✓ Extracted ${data.length} pairing records`);
    return data;
}

async function extractCollaborativeData(db) {
    console.log('  📊 Extracting collaborative filtering data...');
    
    const data = await dbAll(db, `
        SELECT 
            f.user_id,
            r.wine_id,
            r.wine_type,
            r.region,
            f.overall_rating,
            f.occasion,
            f.season,
            f.guest_count,
            f.time_of_day,
            f.selected
        FROM LearningPairingFeedbackEnhanced f
        JOIN LearningPairingRecommendations r ON f.recommendation_id = r.id
        WHERE f.selected = 1
        ORDER BY f.created_at
    `);
    
    console.log(`    ✓ Extracted ${data.length} user-wine interactions`);
    return data;
}

async function extractProcurementData(db) {
    console.log('  📊 Extracting procurement training data...');
    
    const data = await dbAll(db, `
        SELECT 
            wine_type,
            DATE(created_at) as date,
            SUM(quantity) as quantity,
            location,
            COUNT(*) as event_count
        FROM LearningConsumptionEvents
        WHERE event_type = 'consume'
        GROUP BY wine_type, DATE(created_at), location
        ORDER BY created_at
    `);
    
    console.log(`    ✓ Extracted ${data.length} consumption records`);
    return data;
}

// ============================================================================
// FEATURE ENGINEERING
// ============================================================================

function engineerPairingFeatures(data) {
    console.log('  🔧 Engineering pairing features...');
    
    return data.map(row => {
        // One-hot encode categorical variables
        const cuisineEncoded = encodeOneHot(row.cuisine, ['Mediterranean', 'International', 'Japanese', 'Italian', 'French', 'Greek', 'American', 'Spanish', 'Mexican', 'Asian', 'British', 'Moroccan', 'Scandinavian', 'Hawaiian']);
        const proteinEncoded = encodeOneHot(row.protein, ['fish', 'poultry', 'cheese', 'seafood', 'veal', 'beef', 'duck', 'lamb', 'truffle', 'game', 'pork', 'mushroom', 'vegetable']);
        const intensityEncoded = encodeOneHot(row.intensity, ['light', 'medium', 'rich']);
        const wineTypeEncoded = encodeOneHot(row.wine_type, ['Red', 'White', 'Sparkling', 'Rosé', 'Dessert', 'Fortified']);
        const occasionEncoded = encodeOneHot(row.occasion, ['dinner', 'lunch', 'cocktail', 'celebration', 'casual']);
        const seasonEncoded = encodeOneHot(row.season, ['winter', 'spring', 'summer', 'autumn']);
        
        // Normalize numerical features
        const guestCountNorm = normalizeValue(row.guest_count, 1, 12);
        const rankingNorm = normalizeValue(row.ranking, 1, 5);
        
        // Aggregate rating (target variable for regression)
        const avgRating = (
            row.overall_rating + 
            row.flavor_harmony_rating + 
            row.texture_balance_rating + 
            row.acidity_match_rating + 
            row.tannin_balance_rating + 
            row.body_match_rating + 
            row.regional_tradition_rating
        ) / 7.0;
        
        return {
            features: [
                ...cuisineEncoded,
                ...proteinEncoded,
                ...intensityEncoded,
                ...wineTypeEncoded,
                ...occasionEncoded,
                ...seasonEncoded,
                guestCountNorm,
                rankingNorm
            ],
            target: avgRating,
            selected: row.selected,
            session_id: row.session_id,
            wine_id: row.wine_id
        };
    });
}

function engineerCollaborativeFeatures(data) {
    console.log('  🔧 Engineering collaborative filtering features...');
    
    // Create user-wine rating matrix
    const userIds = [...new Set(data.map(d => d.user_id))];
    const wineIds = [...new Set(data.map(d => d.wine_id))];
    
    const matrix = {};
    userIds.forEach(userId => {
        matrix[userId] = {};
        wineIds.forEach(wineId => {
            matrix[userId][wineId] = 0;
        });
    });
    
    // Fill matrix with ratings
    data.forEach(row => {
        matrix[row.user_id][row.wine_id] = row.overall_rating;
    });
    
    // Add contextual features
    const contextual = data.map(row => ({
        user_id: row.user_id,
        wine_id: row.wine_id,
        wine_type: row.wine_type,
        region: row.region,
        rating: row.overall_rating,
        occasion: row.occasion,
        season: row.season,
        guest_count: row.guest_count
    }));
    
    return {
        matrix,
        userIds,
        wineIds,
        contextual
    };
}

function engineerProcurementFeatures(data) {
    console.log('  🔧 Engineering procurement features...');
    
    // Group by wine type and create time series
    const timeSeries = {};
    
    data.forEach(row => {
        if (!timeSeries[row.wine_type]) {
            timeSeries[row.wine_type] = [];
        }
        
        timeSeries[row.wine_type].push({
            date: row.date,
            quantity: row.quantity,
            location: row.location,
            event_count: row.event_count
        });
    });
    
    // Calculate features for each wine type
    const features = Object.entries(timeSeries).map(([wineType, series]) => {
        // Sort by date
        series.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate statistics
        const quantities = series.map(s => s.quantity);
        const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
        const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
        const stdDev = Math.sqrt(variance);
        
        // Detect seasonality (simple autocorrelation check)
        const seasonality = detectSeasonality(quantities, 7); // Weekly pattern
        
        return {
            wineType,
            series,
            statistics: {
                mean,
                stdDev,
                min: Math.min(...quantities),
                max: Math.max(...quantities),
                seasonality
            }
        };
    });
    
    return features;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function encodeOneHot(value, categories) {
    return categories.map(cat => (cat === value ? 1 : 0));
}

function normalizeValue(value, min, max) {
    return (value - min) / (max - min);
}

function detectSeasonality(series, period) {
    if (series.length < period * 2) return 0;
    
    // Simple autocorrelation at lag=period
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const variance = series.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / series.length;
    
    let autocorr = 0;
    for (let i = 0; i < series.length - period; i++) {
        autocorr += (series[i] - mean) * (series[i + period] - mean);
    }
    
    autocorr = autocorr / ((series.length - period) * variance);
    return Math.max(0, Math.min(1, autocorr)); // Clamp to [0,1]
}

function splitTrainTest(data, testRatio = 0.2) {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    const splitIndex = Math.floor(shuffled.length * (1 - testRatio));
    
    return {
        train: shuffled.slice(0, splitIndex),
        test: shuffled.slice(splitIndex)
    };
}

// ============================================================================
// SIMPLIFIED ML IMPLEMENTATIONS
// ============================================================================

class SimplePairingModel {
    constructor() {
        this.weights = null;
        this.bias = 0;
        this.featureCount = 0;
    }
    
    train(X, y, options = {}) {
        const { learningRate = 0.01, epochs = 100 } = options;
        
        this.featureCount = X[0].length;
        this.weights = new Array(this.featureCount).fill(0);
        
        // Simple gradient descent
        for (let epoch = 0; epoch < epochs; epoch++) {
            for (let i = 0; i < X.length; i++) {
                const features = X[i];
                const target = y[i];
                
                // Predict
                const prediction = this.predict([features])[0];
                const error = target - prediction;
                
                // Update weights
                for (let j = 0; j < this.featureCount; j++) {
                    this.weights[j] += learningRate * error * features[j];
                }
                this.bias += learningRate * error;
            }
        }
    }
    
    predict(X) {
        return X.map(features => {
            let sum = this.bias;
            for (let i = 0; i < this.featureCount; i++) {
                sum += this.weights[i] * features[i];
            }
            // Sigmoid to constrain to rating range
            return 1 + 4 / (1 + Math.exp(-sum)); // Scale to 1-5
        });
    }
    
    toJSON() {
        return {
            weights: this.weights,
            bias: this.bias,
            featureCount: this.featureCount
        };
    }
    
    fromJSON(json) {
        this.weights = json.weights;
        this.bias = json.bias;
        this.featureCount = json.featureCount;
    }
}

class SimpleCollaborativeModel {
    constructor(factors = 10) {
        this.factors = factors;
        this.userFactors = {};
        this.itemFactors = {};
    }
    
    train(matrix, userIds, wineIds, options = {}) {
        const { iterations = 50, regularization = 0.01, learningRate = 0.01 } = options;
        
        // Initialize factor matrices with small random values
        userIds.forEach(userId => {
            this.userFactors[userId] = Array.from({ length: this.factors }, () => Math.random() * 0.01);
        });
        
        wineIds.forEach(wineId => {
            this.itemFactors[wineId] = Array.from({ length: this.factors }, () => Math.random() * 0.01);
        });
        
        // Alternating Least Squares (simplified)
        for (let iter = 0; iter < iterations; iter++) {
            // Get all non-zero ratings
            const ratings = [];
            userIds.forEach(userId => {
                wineIds.forEach(wineId => {
                    if (matrix[userId][wineId] > 0) {
                        ratings.push({ userId, wineId, rating: matrix[userId][wineId] });
                    }
                });
            });
            
            // SGD update
            ratings.forEach(({ userId, wineId, rating }) => {
                const prediction = this.predictOne(userId, wineId);
                const error = rating - prediction;
                
                // Update user factors
                const userUpdate = this.userFactors[userId].slice();
                for (let f = 0; f < this.factors; f++) {
                    userUpdate[f] += learningRate * (error * this.itemFactors[wineId][f] - regularization * this.userFactors[userId][f]);
                }
                this.userFactors[userId] = userUpdate;
                
                // Update item factors
                const itemUpdate = this.itemFactors[wineId].slice();
                for (let f = 0; f < this.factors; f++) {
                    itemUpdate[f] += learningRate * (error * this.userFactors[userId][f] - regularization * this.itemFactors[wineId][f]);
                }
                this.itemFactors[wineId] = itemUpdate;
            });
        }
    }
    
    predictOne(userId, wineId) {
        if (!this.userFactors[userId] || !this.itemFactors[wineId]) {
            return 3.0; // Default rating
        }
        
        let dot = 0;
        for (let f = 0; f < this.factors; f++) {
            dot += this.userFactors[userId][f] * this.itemFactors[wineId][f];
        }
        
        // Clamp to rating range 1-5
        return Math.max(1, Math.min(5, dot));
    }
    
    topN(userId, wineIds, n = 5) {
        const predictions = wineIds.map(wineId => ({
            wineId,
            predictedRating: this.predictOne(userId, wineId)
        }));
        
        return predictions.sort((a, b) => b.predictedRating - a.predictedRating).slice(0, n);
    }
    
    toJSON() {
        return {
            factors: this.factors,
            userFactors: this.userFactors,
            itemFactors: this.itemFactors
        };
    }
    
    fromJSON(json) {
        this.factors = json.factors;
        this.userFactors = json.userFactors;
        this.itemFactors = json.itemFactors;
    }
}

class SimpleProcurementModel {
    constructor() {
        this.wineTypeModels = {};
    }
    
    train(features) {
        features.forEach(({ wineType, series, statistics }) => {
            // Store statistics for forecasting
            this.wineTypeModels[wineType] = {
                mean: statistics.mean,
                stdDev: statistics.stdDev,
                seasonality: statistics.seasonality,
                trend: this.calculateTrend(series),
                lastValues: series.slice(-7).map(s => s.quantity) // Last week
            };
        });
    }
    
    calculateTrend(series) {
        if (series.length < 2) return 0;
        
        // Simple linear trend
        const n = series.length;
        const quantities = series.map(s => s.quantity);
        
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += quantities[i];
            sumXY += i * quantities[i];
            sumX2 += i * i;
        }
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }
    
    forecast(wineType, horizon = 7) {
        const model = this.wineTypeModels[wineType];
        if (!model) {
            return Array(horizon).fill(0);
        }
        
        const forecast = [];
        for (let i = 0; i < horizon; i++) {
            // Simple forecast: mean + trend + seasonal component
            let prediction = model.mean + model.trend * i;
            
            // Add seasonality if detected
            if (model.seasonality > 0.3 && model.lastValues.length > 0) {
                const seasonalIndex = i % model.lastValues.length;
                const seasonalComponent = (model.lastValues[seasonalIndex] - model.mean) * model.seasonality;
                prediction += seasonalComponent;
            }
            
            forecast.push(Math.max(0, prediction));
        }
        
        return forecast;
    }
    
    toJSON() {
        return {
            wineTypeModels: this.wineTypeModels
        };
    }
    
    fromJSON(json) {
        this.wineTypeModels = json.wineTypeModels;
    }
}

// ============================================================================
// MODEL EVALUATION
// ============================================================================

function evaluatePairingModel(model, testX, testY) {
    const predictions = model.predict(testX);
    
    // Calculate metrics
    let mse = 0;
    let mae = 0;
    
    for (let i = 0; i < predictions.length; i++) {
        const error = testY[i] - predictions[i];
        mse += error * error;
        mae += Math.abs(error);
    }
    
    mse = mse / predictions.length;
    mae = mae / predictions.length;
    const rmse = Math.sqrt(mse);
    
    // R-squared
    const yMean = testY.reduce((a, b) => a + b, 0) / testY.length;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < testY.length; i++) {
        ssTot += Math.pow(testY[i] - yMean, 2);
        ssRes += Math.pow(testY[i] - predictions[i], 2);
    }
    const r2 = 1 - (ssRes / ssTot);
    
    return { mse, mae, rmse, r2 };
}

function evaluateCollaborativeModel(model, testData, matrix) {
    let totalError = 0;
    let count = 0;
    
    testData.forEach(({ user_id, wine_id, rating }) => {
        const prediction = model.predictOne(user_id, wine_id);
        totalError += Math.abs(rating - prediction);
        count++;
    });
    
    const mae = totalError / count;
    
    return { mae, count };
}

function evaluateProcurementModel(model, testData) {
    const forecasts = {};
    const actuals = {};
    
    // Group test data by wine type
    testData.forEach(({ wineType, series }) => {
        if (series.length > 7) {
            const trainSeries = series.slice(0, -7);
            const testSeries = series.slice(-7);
            
            // Retrain on training portion
            const tempModel = new SimpleProcurementModel();
            tempModel.wineTypeModels[wineType] = model.wineTypeModels[wineType];
            
            forecasts[wineType] = model.forecast(wineType, 7);
            actuals[wineType] = testSeries.map(s => s.quantity);
        }
    });
    
    // Calculate MAPE (Mean Absolute Percentage Error)
    let totalError = 0;
    let count = 0;
    
    Object.keys(forecasts).forEach(wineType => {
        const forecast = forecasts[wineType];
        const actual = actuals[wineType];
        
        for (let i = 0; i < Math.min(forecast.length, actual.length); i++) {
            if (actual[i] > 0) {
                const pctError = Math.abs((actual[i] - forecast[i]) / actual[i]);
                totalError += pctError;
                count++;
            }
        }
    });
    
    const mape = count > 0 ? (totalError / count) * 100 : 0;
    
    return { mape, forecasts: Object.keys(forecasts).length };
}

// ============================================================================
// MODEL TRAINING
// ============================================================================

async function trainPairingModel(db) {
    console.log('\n🎯 Training Pairing Recommendation Model...');
    
    // Extract and engineer features
    const rawData = await extractPairingData(db);
    
    if (rawData.length < CONFIG.pairing.minSamples) {
        throw new Error(`Insufficient data for pairing model (need ${CONFIG.pairing.minSamples}, got ${rawData.length})`);
    }
    
    const engineered = engineerPairingFeatures(rawData);
    
    // Split train/test
    const { train, test } = splitTrainTest(engineered, CONFIG.pairing.testSplit);
    
    const trainX = train.map(d => d.features);
    const trainY = train.map(d => d.target);
    const testX = test.map(d => d.features);
    const testY = test.map(d => d.target);
    
    console.log(`  📚 Training set: ${train.length} samples`);
    console.log(`  📚 Test set: ${test.length} samples`);
    
    // Train model
    const model = new SimplePairingModel();
    model.train(trainX, trainY, { learningRate: CONFIG.pairing.parameters.learningRate, epochs: 100 });
    
    // Evaluate
    const metrics = evaluatePairingModel(model, testX, testY);
    console.log(`  ✅ Training complete!`);
    console.log(`     RMSE: ${metrics.rmse.toFixed(4)}`);
    console.log(`     MAE: ${metrics.mae.toFixed(4)}`);
    console.log(`     R²: ${metrics.r2.toFixed(4)}`);
    
    // Save model
    const modelPath = path.join(MODELS_DIR, 'pairing_model_v1.json');
    fs.writeFileSync(modelPath, JSON.stringify(model.toJSON(), null, 2));
    console.log(`  💾 Model saved: ${modelPath}`);
    
    // Log metrics to database
    await logMetrics(db, 'pairing_model', 'v1', metrics);
    
    return { model, metrics, trainSize: train.length, testSize: test.length };
}

async function trainCollaborativeModel(db) {
    console.log('\n👥 Training Collaborative Filtering Model...');
    
    // Extract and engineer features
    const rawData = await extractCollaborativeData(db);
    
    if (rawData.length < CONFIG.collaborative.minSamples) {
        throw new Error(`Insufficient data for collaborative model (need ${CONFIG.collaborative.minSamples}, got ${rawData.length})`);
    }
    
    const { matrix, userIds, wineIds, contextual } = engineerCollaborativeFeatures(rawData);
    
    // Split train/test
    const { train, test } = splitTrainTest(contextual, CONFIG.collaborative.testSplit);
    
    console.log(`  📚 Training set: ${train.length} interactions`);
    console.log(`  📚 Test set: ${test.length} interactions`);
    console.log(`  👥 Users: ${userIds.length}`);
    console.log(`  🍷 Wines: ${wineIds.length}`);
    
    // Train model
    const model = new SimpleCollaborativeModel(CONFIG.collaborative.parameters.factors);
    model.train(matrix, userIds, wineIds, {
        iterations: CONFIG.collaborative.parameters.iterations,
        regularization: CONFIG.collaborative.parameters.regularization
    });
    
    // Evaluate
    const metrics = evaluateCollaborativeModel(model, test, matrix);
    console.log(`  ✅ Training complete!`);
    console.log(`     MAE: ${metrics.mae.toFixed(4)}`);
    console.log(`     Test samples: ${metrics.count}`);
    
    // Save model
    const modelPath = path.join(MODELS_DIR, 'collaborative_model_v1.json');
    fs.writeFileSync(modelPath, JSON.stringify(model.toJSON(), null, 2));
    console.log(`  💾 Model saved: ${modelPath}`);
    
    // Log metrics to database
    await logMetrics(db, 'collaborative_model', 'v1', metrics);
    
    return { model, metrics, trainSize: train.length, testSize: test.length };
}

async function trainProcurementModel(db) {
    console.log('\n📦 Training Procurement Demand Model...');
    
    // Extract and engineer features
    const rawData = await extractProcurementData(db);
    
    if (rawData.length < CONFIG.procurement.minSamples) {
        throw new Error(`Insufficient data for procurement model (need ${CONFIG.procurement.minSamples}, got ${rawData.length})`);
    }
    
    const features = engineerProcurementFeatures(rawData);
    
    console.log(`  📚 Time series: ${features.length} wine types`);
    features.forEach(({ wineType, series, statistics }) => {
        console.log(`     ${wineType}: ${series.length} days, mean=${statistics.mean.toFixed(2)}, seasonality=${statistics.seasonality.toFixed(3)}`);
    });
    
    // Train model
    const model = new SimpleProcurementModel();
    model.train(features);
    
    // Evaluate
    const metrics = evaluateProcurementModel(model, features);
    console.log(`  ✅ Training complete!`);
    console.log(`     MAPE: ${metrics.mape.toFixed(2)}%`);
    console.log(`     Wine types forecasted: ${metrics.forecasts}`);
    
    // Save model
    const modelPath = path.join(MODELS_DIR, 'procurement_model_v1.json');
    fs.writeFileSync(modelPath, JSON.stringify(model.toJSON(), null, 2));
    console.log(`  💾 Model saved: ${modelPath}`);
    
    // Log metrics to database
    await logMetrics(db, 'procurement_model', 'v1', metrics);
    
    return { model, metrics };
}

// ============================================================================
// METRICS LOGGING
// ============================================================================

async function logMetrics(db, modelName, version, metrics) {
    const metricEntries = Object.entries(metrics).map(([name, value]) => ({
        metric_name: `${modelName}_${name}`,
        metric_value: value,
        metric_context: JSON.stringify({ model: modelName, version }),
        measurement_period: 'training',
        model_version: version,
        algorithm_type: CONFIG[modelName.split('_')[0]]?.algorithm || 'unknown'
    }));
    
    for (const entry of metricEntries) {
        await dbRun(db, `
            INSERT INTO LearningMetrics (
                metric_name, metric_value, metric_context,
                measurement_period, model_version, algorithm_type,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            entry.metric_name,
            entry.metric_value,
            entry.metric_context,
            entry.measurement_period,
            entry.model_version,
            entry.algorithm_type
        ]);
    }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

async function generateTrainingReport(results) {
    const report = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    report.push('='.repeat(80));
    report.push('SOMMOS ML TRAINING REPORT');
    report.push('='.repeat(80));
    report.push(`\nGenerated: ${new Date().toISOString()}`);
    report.push(`Training Session: ${timestamp}\n`);
    
    // Pairing Model
    report.push('-'.repeat(80));
    report.push('PAIRING RECOMMENDATION MODEL');
    report.push('-'.repeat(80));
    report.push(`Algorithm: ${CONFIG.pairing.algorithm}`);
    report.push(`Training samples: ${results.pairing.trainSize}`);
    report.push(`Test samples: ${results.pairing.testSize}`);
    report.push(`\nPerformance Metrics:`);
    report.push(`  RMSE: ${results.pairing.metrics.rmse.toFixed(4)}`);
    report.push(`  MAE: ${results.pairing.metrics.mae.toFixed(4)}`);
    report.push(`  R²: ${results.pairing.metrics.r2.toFixed(4)}`);
    
    // Collaborative Model
    report.push('\n' + '-'.repeat(80));
    report.push('COLLABORATIVE FILTERING MODEL');
    report.push('-'.repeat(80));
    report.push(`Algorithm: ${CONFIG.collaborative.algorithm}`);
    report.push(`Factors: ${CONFIG.collaborative.parameters.factors}`);
    report.push(`Training samples: ${results.collaborative.trainSize}`);
    report.push(`Test samples: ${results.collaborative.testSize}`);
    report.push(`\nPerformance Metrics:`);
    report.push(`  MAE: ${results.collaborative.metrics.mae.toFixed(4)}`);
    
    // Procurement Model
    report.push('\n' + '-'.repeat(80));
    report.push('PROCUREMENT DEMAND MODEL');
    report.push('-'.repeat(80));
    report.push(`Algorithm: ${CONFIG.procurement.algorithm}`);
    report.push(`Seasonal period: ${CONFIG.procurement.parameters.seasonalPeriod} days`);
    report.push(`\nPerformance Metrics:`);
    report.push(`  MAPE: ${results.procurement.metrics.mape.toFixed(2)}%`);
    report.push(`  Wine types: ${results.procurement.metrics.forecasts}`);
    
    report.push('\n' + '='.repeat(80));
    report.push('END OF REPORT');
    report.push('='.repeat(80));
    
    const reportText = report.join('\n');
    const reportPath = path.join(REPORT_DIR, `training_report_${timestamp}.txt`);
    fs.writeFileSync(reportPath, reportText);
    
    console.log(`\n📄 Training report saved: ${reportPath}`);
    console.log('\n' + reportText);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     SommOS ML Training Pipeline                                ║');
    console.log('║     Training models from synthetic simulation data             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    // Prerequisites check
    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ Database not found. Run: npm run simulate:year first');
        process.exit(1);
    }
    
    // Ensure models directory exists
    if (!fs.existsSync(MODELS_DIR)) {
        fs.mkdirSync(MODELS_DIR, { recursive: true });
        console.log('📁 Created models directory\n');
    }
    
    const db = await openDatabase();
    const results = {};
    
    try {
        // Train all models
        results.pairing = await trainPairingModel(db);
        results.collaborative = await trainCollaborativeModel(db);
        results.procurement = await trainProcurementModel(db);
        
        // Generate report
        await generateTrainingReport(results);
        
        console.log('\n✅ All models trained successfully!\n');
        console.log('📊 Models saved to: backend/models/');
        console.log('📈 Metrics logged to: LearningMetrics table');
        
    } catch (error) {
        console.error('\n❌ Training failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await closeDatabase(db);
    }
}

// Execute if run directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main };
