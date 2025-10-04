#!/usr/bin/env node

/**
 * Model Comparison Script
 * Evaluates Linear Regression vs Random Forest models side-by-side
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/sommos.db');
const MODELS_DIR = path.join(__dirname, '../backend/models');

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

// Linear Regression Model
class LinearRegressionModel {
    constructor(modelData) {
        this.weights = modelData.weights;
        this.bias = modelData.bias;
        this.featureNames = modelData.feature_names || [];
    }
    
    predict(X) {
        return X.map(x => {
            const score = x.reduce((sum, val, i) => sum + val * this.weights[i], this.bias);
            return Math.max(0, Math.min(5, score)); // Clamp to [0, 5]
        });
    }
}

// Random Forest Model
class RandomForestModel {
    constructor(modelData) {
        this.trees = modelData.trees;
        this.featureNames = modelData.featureNames || [];
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
}

// Evaluation metrics
function calculateMetrics(predictions, actuals, modelName) {
    const n = predictions.length;
    
    // RMSE
    const mse = predictions.reduce((sum, pred, i) => sum + (pred - actuals[i]) ** 2, 0) / n;
    const rmse = Math.sqrt(mse);
    
    // MAE
    const mae = predictions.reduce((sum, pred, i) => sum + Math.abs(pred - actuals[i]), 0) / n;
    
    // R²
    const mean_y = actuals.reduce((a, b) => a + b, 0) / n;
    const ss_tot = actuals.reduce((sum, val) => sum + (val - mean_y) ** 2, 0);
    const ss_res = predictions.reduce((sum, pred, i) => sum + (actuals[i] - pred) ** 2, 0);
    const r2 = 1 - (ss_res / ss_tot);
    
    // MAPE (Mean Absolute Percentage Error)
    const mape = predictions.reduce((sum, pred, i) => {
        if (actuals[i] === 0) return sum;
        return sum + Math.abs((actuals[i] - pred) / actuals[i]);
    }, 0) / n * 100;
    
    // Prediction distribution
    const errors = predictions.map((pred, i) => pred - actuals[i]);
    errors.sort((a, b) => a - b);
    const median = errors[Math.floor(n / 2)];
    const q1 = errors[Math.floor(n * 0.25)];
    const q3 = errors[Math.floor(n * 0.75)];
    
    // Accuracy within tolerance bands
    const within_01 = predictions.filter((pred, i) => Math.abs(pred - actuals[i]) <= 0.1).length / n;
    const within_025 = predictions.filter((pred, i) => Math.abs(pred - actuals[i]) <= 0.25).length / n;
    const within_05 = predictions.filter((pred, i) => Math.abs(pred - actuals[i]) <= 0.5).length / n;
    
    return {
        modelName,
        rmse,
        mae,
        r2,
        mape,
        errorDistribution: { median, q1, q3 },
        accuracyBands: {
            within_01: (within_01 * 100).toFixed(1),
            within_025: (within_025 * 100).toFixed(1),
            within_05: (within_05 * 100).toFixed(1)
        },
        predictions,
        errors
    };
}

async function prepareData(db) {
    console.log('📊 Preparing test dataset...');
    
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
    
    console.log(`   Found ${data.length} pairing records`);
    
    // Feature engineering
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
    
    // Use same test set (20%)
    const testSize = Math.floor(features.length * 0.2);
    const indices = Array.from({length: features.length}, (_, i) => i);
    
    // Fixed seed shuffle for consistent comparison
    const seed = 42;
    let rng = seed;
    for (let i = indices.length - 1; i > 0; i--) {
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        const j = rng % (i + 1);
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    const testIndices = indices.slice(0, testSize);
    
    const X_test = testIndices.map(i => features[i]);
    const y_test = testIndices.map(i => targets[i]);
    
    console.log(`   Test set: ${X_test.length} samples\n`);
    
    return { X_test, y_test };
}

async function loadModels() {
    console.log('📦 Loading models...');
    
    const models = {};
    
    // Load Linear Regression model
    const lrPath = path.join(MODELS_DIR, 'pairing_model_v1.json');
    if (fs.existsSync(lrPath)) {
        const lrData = JSON.parse(fs.readFileSync(lrPath, 'utf8'));
        models.linearRegression = new LinearRegressionModel(lrData);
        console.log('   ✅ Linear Regression model loaded');
    } else {
        console.log('   ⚠️  Linear Regression model not found');
    }
    
    // Load Random Forest model
    const rfPath = path.join(MODELS_DIR, 'pairing_model_rf_v2.json');
    if (fs.existsSync(rfPath)) {
        const rfData = JSON.parse(fs.readFileSync(rfPath, 'utf8'));
        models.randomForest = new RandomForestModel(rfData);
        console.log('   ✅ Random Forest model loaded');
    } else {
        console.log('   ⚠️  Random Forest model not found');
    }
    
    console.log();
    return models;
}

function printComparison(results) {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    MODEL COMPARISON RESULTS                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    const models = Object.keys(results);
    
    // Core metrics table
    console.log('📊 CORE METRICS');
    console.log('─'.repeat(70));
    console.log('Metric'.padEnd(20) + models.map(m => m.padEnd(20)).join(''));
    console.log('─'.repeat(70));
    
    const metrics = ['rmse', 'mae', 'r2', 'mape'];
    metrics.forEach(metric => {
        const label = metric.toUpperCase().padEnd(20);
        const values = models.map(m => {
            const val = results[m][metric];
            return (typeof val === 'number' ? val.toFixed(4) : val).padEnd(20);
        });
        console.log(label + values.join(''));
    });
    console.log('─'.repeat(70));
    
    // Accuracy bands
    console.log('\n🎯 ACCURACY WITHIN TOLERANCE');
    console.log('─'.repeat(70));
    console.log('Tolerance'.padEnd(20) + models.map(m => m.padEnd(20)).join(''));
    console.log('─'.repeat(70));
    
    ['within_01', 'within_025', 'within_05'].forEach(band => {
        const label = band.replace('within_', '±').replace('0', '0.').padEnd(20);
        const values = models.map(m => (results[m].accuracyBands[band] + '%').padEnd(20));
        console.log(label + values.join(''));
    });
    console.log('─'.repeat(70));
    
    // Error distribution
    console.log('\n📈 ERROR DISTRIBUTION (Quartiles)');
    console.log('─'.repeat(70));
    console.log('Quartile'.padEnd(20) + models.map(m => m.padEnd(20)).join(''));
    console.log('─'.repeat(70));
    
    ['q1', 'median', 'q3'].forEach(q => {
        const label = q.toUpperCase().padEnd(20);
        const values = models.map(m => results[m].errorDistribution[q].toFixed(4).padEnd(20));
        console.log(label + values.join(''));
    });
    console.log('─'.repeat(70));
    
    // Winner analysis
    console.log('\n🏆 WINNER ANALYSIS');
    console.log('─'.repeat(70));
    
    const comparison = {
        rmse: models.reduce((best, m) => results[m].rmse < results[best].rmse ? m : best),
        mae: models.reduce((best, m) => results[m].mae < results[best].mae ? m : best),
        r2: models.reduce((best, m) => results[m].r2 > results[best].r2 ? m : best),
        accuracy: models.reduce((best, m) => 
            parseFloat(results[m].accuracyBands.within_05) > 
            parseFloat(results[best].accuracyBands.within_05) ? m : best
        )
    };
    
    Object.entries(comparison).forEach(([metric, winner]) => {
        console.log(`   ${metric.toUpperCase().padEnd(15)} → ${winner}`);
    });
    
    // Overall recommendation
    const scores = {};
    models.forEach(m => scores[m] = 0);
    Object.values(comparison).forEach(winner => scores[winner]++);
    
    const overallWinner = Object.entries(scores).reduce((best, [m, score]) => 
        score > best.score ? { model: m, score } : best, 
        { model: models[0], score: 0 }
    );
    
    console.log('\n   OVERALL WINNER: ' + overallWinner.model.toUpperCase());
    console.log(`   (Won ${overallWinner.score}/${Object.keys(comparison).length} categories)`);
    console.log('─'.repeat(70));
}

function generateRecommendations(results) {
    console.log('\n💡 RECOMMENDATIONS\n');
    
    const models = Object.keys(results);
    const lr = results[models[0]];
    const rf = results[models[1]];
    
    console.log('1. PERFORMANCE ASSESSMENT:');
    
    const rmseImprovement = ((lr.rmse - rf.rmse) / lr.rmse * 100).toFixed(1);
    const maeImprovement = ((lr.mae - rf.mae) / lr.mae * 100).toFixed(1);
    const r2Improvement = ((rf.r2 - lr.r2) / Math.abs(lr.r2) * 100).toFixed(1);
    
    if (parseFloat(rmseImprovement) > 5) {
        console.log(`   ✅ Random Forest shows ${rmseImprovement}% improvement in RMSE`);
    } else if (parseFloat(rmseImprovement) < -5) {
        console.log(`   ⚠️  Linear Regression performs ${Math.abs(rmseImprovement)}% better in RMSE`);
    } else {
        console.log(`   ℹ️  Models perform similarly in RMSE (${rmseImprovement}% difference)`);
    }
    
    console.log('\n2. SIMULATION NECESSITY:');
    
    const avgR2 = (lr.r2 + rf.r2) / 2;
    const avgAccuracy = (parseFloat(lr.accuracyBands.within_05) + parseFloat(rf.accuracyBands.within_05)) / 2;
    
    if (avgR2 < 0.3 || avgAccuracy < 70) {
        console.log('   🔴 MORE DATA NEEDED:');
        console.log(`      - Current R²: ${avgR2.toFixed(3)} (target: >0.3)`);
        console.log(`      - Current ±0.5 accuracy: ${avgAccuracy.toFixed(1)}% (target: >70%)`);
        console.log('      - Recommendation: Run 5-10 year simulation with diverse scenarios');
        console.log('      - Focus on: Edge cases, rare wine types, unusual pairings');
    } else if (avgR2 < 0.5 || avgAccuracy < 80) {
        console.log('   🟡 ADDITIONAL DATA BENEFICIAL:');
        console.log(`      - Current R²: ${avgR2.toFixed(3)} (good, but could improve)`);
        console.log(`      - Current ±0.5 accuracy: ${avgAccuracy.toFixed(1)}%`);
        console.log('      - Recommendation: Run 2-3 year simulation to fill gaps');
        console.log('      - Focus on: Underrepresented seasons, occasions, cuisines');
    } else {
        console.log('   🟢 CURRENT DATA SUFFICIENT:');
        console.log(`      - Current R²: ${avgR2.toFixed(3)} (excellent)`);
        console.log(`      - Current ±0.5 accuracy: ${avgAccuracy.toFixed(1)}%`);
        console.log('      - Recommendation: No additional simulation needed');
        console.log('      - Consider: Real-world A/B testing for validation');
    }
    
    console.log('\n3. MODEL DEPLOYMENT:');
    
    const rfBetter = rf.rmse < lr.rmse && rf.r2 > lr.r2;
    if (rfBetter) {
        console.log('   ✅ DEPLOY RANDOM FOREST');
        console.log('      - Better predictive accuracy');
        console.log('      - Captures non-linear relationships');
        console.log('      - Feature importance insights available');
    } else {
        console.log('   ⚠️  KEEP LINEAR REGRESSION');
        console.log('      - Simpler, faster inference');
        console.log('      - More interpretable coefficients');
        console.log('      - Random Forest needs more training data');
    }
    
    console.log('\n4. NEXT STEPS:');
    console.log('   a. Review feature importance (feature_importance.json)');
    console.log('   b. Analyze error patterns for systematic issues');
    console.log('   c. Consider ensemble approach (combine both models)');
    console.log('   d. Validate with real guest feedback');
    
    return {
        needsMoreSimulation: avgR2 < 0.3 || avgAccuracy < 70,
        deployRandomForest: rfBetter,
        dataQualityScore: (avgR2 + avgAccuracy / 100) / 2
    };
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║            SommOS Model Comparison & Evaluation                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    const db = await openDatabase();
    
    try {
        // Prepare test data
        const { X_test, y_test } = await prepareData(db);
        
        // Load models
        const models = await loadModels();
        
        if (Object.keys(models).length === 0) {
            console.error('❌ No models found. Please train models first.');
            process.exit(1);
        }
        
        // Evaluate each model
        console.log('🔬 Evaluating models...\n');
        const results = {};
        
        for (const [name, model] of Object.entries(models)) {
            console.log(`   Evaluating ${name}...`);
            const predictions = model.predict(X_test);
            results[name] = calculateMetrics(predictions, y_test, name);
        }
        
        // Print comparison
        console.log();
        printComparison(results);
        
        // Generate recommendations
        const recommendations = generateRecommendations(results);
        
        // Save comparison report
        const reportPath = path.join(__dirname, '../reports/model_comparison.json');
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            testSize: X_test.length,
            results: Object.fromEntries(
                Object.entries(results).map(([name, res]) => [name, {
                    rmse: res.rmse,
                    mae: res.mae,
                    r2: res.r2,
                    mape: res.mape,
                    accuracyBands: res.accuracyBands,
                    errorDistribution: res.errorDistribution
                }])
            ),
            recommendations
        }, null, 2));
        
        console.log(`\n💾 Comparison report saved: ${reportPath}`);
        
    } catch (error) {
        console.error('\n❌ Comparison failed:', error.message);
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
