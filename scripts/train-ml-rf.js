#!/usr/bin/env node

/**
 * Enhanced ML Training with Random Forest
 * Trains pairing model using Random Forest instead of linear regression
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/sommos.db');
const MODELS_DIR = path.join(__dirname, '../backend/models');

// Random Forest Implementation
class RandomForest {
    constructor(nTrees = 30, maxDepth = 8, minSamplesSplit = 10) {
        this.nTrees = nTrees;
        this.maxDepth = maxDepth;
        this.minSamplesSplit = minSamplesSplit;
        this.trees = [];
    }
    
    train(X, y) {
        const nSamples = X.length;
        const nFeatures = X[0].length;
        const maxFeatures = Math.floor(Math.sqrt(nFeatures));
        
        console.log(`  🌲 Growing ${this.nTrees} trees (max depth: ${this.maxDepth})...`);
        
        for (let i = 0; i < this.nTrees; i++) {
            // Bootstrap sampling
            const indices = [];
            for (let j = 0; j < nSamples; j++) {
                indices.push(Math.floor(Math.random() * nSamples));
            }
            
            const X_boot = indices.map(idx => X[idx]);
            const y_boot = indices.map(idx => y[idx]);
            
            // Train decision tree
            const tree = this.buildTree(X_boot, y_boot, 0, nFeatures, maxFeatures);
            this.trees.push(tree);
            
            if ((i + 1) % 10 === 0) {
                console.log(`     Tree ${i + 1}/${this.nTrees} complete`);
            }
        }
    }
    
    buildTree(X, y, depth, nFeatures, maxFeatures) {
        const nSamples = X.length;
        
        // Stopping criteria
        if (depth >= this.maxDepth || nSamples < this.minSamplesSplit) {
            return { value: y.reduce((a, b) => a + b, 0) / y.length };
        }
        
        // Random feature selection
        const featureIndices = [];
        const allIndices = Array.from({length: nFeatures}, (_, i) => i);
        for (let i = 0; i < maxFeatures; i++) {
            const idx = Math.floor(Math.random() * allIndices.length);
            featureIndices.push(allIndices.splice(idx, 1)[0]);
        }
        
        let bestFeature = null;
        let bestThreshold = null;
        let bestScore = Infinity;
        
        for (const featIdx of featureIndices) {
            const values = X.map(row => row[featIdx]);
            const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
            
            for (let i = 0; i < Math.min(uniqueValues.length - 1, 10); i++) {
                const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;
                const leftY = [];
                const rightY = [];
                
                for (let j = 0; j < values.length; j++) {
                    if (values[j] <= threshold) {
                        leftY.push(y[j]);
                    } else {
                        rightY.push(y[j]);
                    }
                }
                
                if (leftY.length === 0 || rightY.length === 0) continue;
                
                // MSE for split
                const leftMean = leftY.reduce((a, b) => a + b, 0) / leftY.length;
                const rightMean = rightY.reduce((a, b) => a + b, 0) / rightY.length;
                const leftMSE = leftY.reduce((sum, val) => sum + (val - leftMean) ** 2, 0);
                const rightMSE = rightY.reduce((sum, val) => sum + (val - rightMean) ** 2, 0);
                const score = leftMSE + rightMSE;
                
                if (score < bestScore) {
                    bestScore = score;
                    bestFeature = featIdx;
                    bestThreshold = threshold;
                }
            }
        }
        
        if (bestFeature === null) {
            return { value: y.reduce((a, b) => a + b, 0) / y.length };
        }
        
        // Split data
        const leftX = [], leftY = [], rightX = [], rightY = [];
        for (let i = 0; i < X.length; i++) {
            if (X[i][bestFeature] <= bestThreshold) {
                leftX.push(X[i]);
                leftY.push(y[i]);
            } else {
                rightX.push(X[i]);
                rightY.push(y[i]);
            }
        }
        
        return {
            feature: bestFeature,
            threshold: bestThreshold,
            left: this.buildTree(leftX, leftY, depth + 1, nFeatures, maxFeatures),
            right: this.buildTree(rightX, rightY, depth + 1, nFeatures, maxFeatures)
        };
    }
    
    predictTree(tree, x) {
        if ('value' in tree) {
            return tree.value;
        }
        
        if (x[tree.feature] <= tree.threshold) {
            return this.predictTree(tree.left, x);
        } else {
            return this.predictTree(tree.right, x);
        }
    }
    
    predict(X) {
        return X.map(x => {
            const treePreds = this.trees.map(tree => this.predictTree(tree, x));
            return treePreds.reduce((a, b) => a + b, 0) / this.trees.length;
        });
    }
    
    toJSON() {
        return {
            algorithm: 'random_forest',
            nTrees: this.nTrees,
            maxDepth: this.maxDepth,
            minSamplesSplit: this.minSamplesSplit,
            trees: this.trees
        };
    }
}

// Database helpers
function openDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

function dbAll(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function trainPairingModel(db) {
    console.log('\n🎯 Training Pairing Recommendation Model (Random Forest)...');
    
    // Extract data
    const data = await dbAll(db, `
        SELECT 
            s.dish_context,
            f.overall_rating,
            f.flavor_harmony_rating,
            f.texture_balance_rating,
            f.acidity_match_rating,
            f.tannin_balance_rating,
            f.body_match_rating,
            f.regional_tradition_rating,
            f.occasion,
            f.guest_count,
            f.season,
            r.wine_type,
            r.ranking
        FROM LearningPairingSessions s
        JOIN LearningPairingFeedbackEnhanced f ON s.id = f.session_id
        JOIN LearningPairingRecommendations r ON f.recommendation_id = r.id
    `);
    
    console.log(`  📊 Extracted ${data.length} pairing records`);
    
    // Feature engineering
    console.log('  🔧 Engineering features...');
    
    const features = [];
    const targets = [];
    
    const cuisines = new Set();
    const proteins = new Set();
    const intensities = new Set();
    const wineTypes = new Set();
    const occasions = new Set();
    const seasons = new Set();
    
    // Collect unique values
    data.forEach(row => {
        const context = JSON.parse(row.dish_context);
        if (context.cuisine) cuisines.add(context.cuisine);
        if (context.protein) proteins.add(context.protein);
        if (context.intensity) intensities.add(context.intensity);
        if (row.wine_type) wineTypes.add(row.wine_type);
        if (row.occasion) occasions.add(row.occasion);
        if (row.season) seasons.add(row.season);
    });
    
    const cuisineMap = Array.from(cuisines).reduce((acc, val, idx) => ({...acc, [val]: idx}), {});
    const proteinMap = Array.from(proteins).reduce((acc, val, idx) => ({...acc, [val]: idx}), {});
    const intensityMap = Array.from(intensities).reduce((acc, val, idx) => ({...acc, [val]: idx}), {});
    const wineTypeMap = Array.from(wineTypes).reduce((acc, val, idx) => ({...acc, [val]: idx}), {});
    const occasionMap = Array.from(occasions).reduce((acc, val, idx) => ({...acc, [val]: idx}), {});
    const seasonMap = Array.from(seasons).reduce((acc, val, idx) => ({...acc, [val]: idx}), {});
    
    // Build feature vectors
    data.forEach(row => {
        const context = JSON.parse(row.dish_context);
        const feature = [
            cuisineMap[context.cuisine] || 0,
            proteinMap[context.protein] || 0,
            intensityMap[context.intensity] || 0,
            wineTypeMap[row.wine_type] || 0,
            occasionMap[row.occasion] || 0,
            seasonMap[row.season] || 0,
            row.guest_count / 12, // normalized
            row.ranking / 5 // normalized
        ];
        
        features.push(feature);
        
        // Target: average of all rating dimensions
        const target = (
            row.overall_rating +
            row.flavor_harmony_rating +
            row.texture_balance_rating +
            row.acidity_match_rating +
            row.tannin_balance_rating +
            row.body_match_rating +
            row.regional_tradition_rating
        ) / 7;
        targets.push(target);
    });
    
    // Train/test split
    const testSize = Math.floor(features.length * 0.2);
    const indices = Array.from({length: features.length}, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    const trainIndices = indices.slice(testSize);
    const testIndices = indices.slice(0, testSize);
    
    const X_train = trainIndices.map(i => features[i]);
    const y_train = trainIndices.map(i => targets[i]);
    const X_test = testIndices.map(i => features[i]);
    const y_test = testIndices.map(i => targets[i]);
    
    console.log(`  📚 Training set: ${X_train.length} samples`);
    console.log(`  📚 Test set: ${X_test.length} samples`);
    
    // Train Random Forest
    const model = new RandomForest(30, 8, 10);
    model.train(X_train, y_train);
    
    // Evaluate
    const predictions = model.predict(X_test);
    
    const mse = predictions.reduce((sum, pred, i) => sum + (pred - y_test[i]) ** 2, 0) / predictions.length;
    const rmse = Math.sqrt(mse);
    const mae = predictions.reduce((sum, pred, i) => sum + Math.abs(pred - y_test[i]), 0) / predictions.length;
    
    const mean_y = y_test.reduce((a, b) => a + b, 0) / y_test.length;
    const ss_tot = y_test.reduce((sum, val) => sum + (val - mean_y) ** 2, 0);
    const ss_res = predictions.reduce((sum, pred, i) => sum + (y_test[i] - pred) ** 2, 0);
    const r2 = 1 - (ss_res / ss_tot);
    
    console.log('  ✅ Training complete!');
    console.log(`     RMSE: ${rmse.toFixed(4)}`);
    console.log(`     MAE: ${mae.toFixed(4)}`);
    console.log(`     R²: ${r2.toFixed(4)}`);
    
    // Save model
    const modelPath = path.join(MODELS_DIR, 'pairing_model_rf_v2.json');
    fs.writeFileSync(modelPath, JSON.stringify(model.toJSON(), null, 2));
    console.log(`  💾 Model saved: ${modelPath}`);
    
    return { rmse, mae, r2, samples: X_train.length + X_test.length };
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     SommOS Random Forest Training                              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    const db = await openDatabase();
    
    try {
        const results = await trainPairingModel(db);
        
        console.log('\n✅ Training complete!');
        console.log(`📊 Total samples: ${results.samples}`);
        console.log(`📈 Final RMSE: ${results.rmse.toFixed(4)}`);
        console.log(`📈 Final R²: ${results.r2.toFixed(4)}`);
        
    } catch (error) {
        console.error('\n❌ Training failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
