/**
 * Parallel Worker
 * Worker thread for parallel processing tasks
 */

const { parentPort, workerData } = require('worker_threads');

// Worker thread entry point
if (!require.main) {
    parentPort.on('message', async (message) => {
        const { taskId, taskType, data, options } = message;
        
        try {
            const result = await executeTask(taskType, data, options);
            parentPort.postMessage({
                taskId,
                success: true,
                data: result
            });
        } catch (error) {
            parentPort.postMessage({
                taskId,
                success: false,
                error: error.message
            });
        }
    });
}

/**
 * Execute task based on type
 */
async function executeTask(taskType, data, options) {
    switch (taskType) {
        case 'similarity_calculation':
            return await calculateSimilarity(data);
        case 'matrix_multiplication':
            return await matrixMultiplication(data);
        case 'matrix_similarity':
            return await matrixSimilarity(data);
        case 'feature_extraction':
            return await extractFeatures(data);
        case 'data_processing':
            return await processData(data);
        case 'model_training':
            return await trainModel(data);
        default:
            throw new Error(`Unknown task type: ${taskType}`);
    }
}

/**
 * Calculate similarity between entities
 */
async function calculateSimilarity(data) {
    const { entities, algorithm, batchIndex, totalBatches } = data;
    
    const similarities = [];
    
    for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
            const entity1 = entities[i];
            const entity2 = entities[j];
            
            let similarity = 0;
            
            switch (algorithm) {
                case 'pearson':
                    similarity = calculatePearsonCorrelation(entity1.ratings, entity2.ratings);
                    break;
                case 'cosine':
                    similarity = calculateCosineSimilarity(entity1.ratings, entity2.ratings);
                    break;
                case 'jaccard':
                    similarity = calculateJaccardSimilarity(entity1.ratings, entity2.ratings);
                    break;
                case 'euclidean':
                    similarity = calculateEuclideanSimilarity(entity1.ratings, entity2.ratings);
                    break;
                default:
                    throw new Error(`Unknown similarity algorithm: ${algorithm}`);
            }
            
            if (similarity > 0.1) { // Minimum threshold
                similarities.push({
                    entity1: entity1.id,
                    entity2: entity2.id,
                    similarity,
                    algorithm,
                    batchIndex,
                    commonItems: getCommonItems(entity1.ratings, entity2.ratings).length
                });
            }
        }
    }
    
    return similarities;
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculatePearsonCorrelation(ratings1, ratings2) {
    const commonItems = getCommonItems(ratings1, ratings2);
    
    if (commonItems.length < 3) {
        return 0;
    }
    
    const values1 = commonItems.map(item => item.rating1);
    const values2 = commonItems.map(item => item.rating2);
    
    const n = values1.length;
    const sum1 = values1.reduce((a, b) => a + b, 0);
    const sum2 = values2.reduce((a, b) => a + b, 0);
    const sum1Sq = values1.reduce((a, b) => a + b * b, 0);
    const sum2Sq = values2.reduce((a, b) => a + b * b, 0);
    const pSum = values1.reduce((sum, rating, i) => sum + rating * values2[i], 0);
    
    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
    
    if (den === 0) return 0;
    return num / den;
}

/**
 * Calculate cosine similarity
 */
function calculateCosineSimilarity(ratings1, ratings2) {
    const commonItems = getCommonItems(ratings1, ratings2);
    
    if (commonItems.length === 0) {
        return 0;
    }
    
    const values1 = commonItems.map(item => item.rating1);
    const values2 = commonItems.map(item => item.rating2);
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < values1.length; i++) {
        dotProduct += values1[i] * values2[i];
        norm1 += values1[i] * values1[i];
        norm2 += values2[i] * values2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Calculate Jaccard similarity
 */
function calculateJaccardSimilarity(ratings1, ratings2) {
    const set1 = new Set(ratings1.map(r => r.item_id));
    const set2 = new Set(ratings2.map(r => r.item_id));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
}

/**
 * Calculate Euclidean similarity
 */
function calculateEuclideanSimilarity(ratings1, ratings2) {
    const commonItems = getCommonItems(ratings1, ratings2);
    
    if (commonItems.length === 0) {
        return 0;
    }
    
    let sumSquaredDiffs = 0;
    
    for (const item of commonItems) {
        const diff = item.rating1 - item.rating2;
        sumSquaredDiffs += diff * diff;
    }
    
    const distance = Math.sqrt(sumSquaredDiffs);
    return 1 / (1 + distance); // Convert distance to similarity
}

/**
 * Get common items between two rating sets
 */
function getCommonItems(ratings1, ratings2) {
    const ratings1Map = new Map(ratings1.map(r => [r.item_id, r.rating]));
    const commonItems = [];
    
    for (const rating2 of ratings2) {
        if (ratings1Map.has(rating2.item_id)) {
            commonItems.push({
                item_id: rating2.item_id,
                rating1: ratings1Map.get(rating2.item_id),
                rating2: rating2.rating
            });
        }
    }
    
    return commonItems;
}

/**
 * Matrix multiplication
 */
async function matrixMultiplication(data) {
    const { startRow, endRow, matrixA, matrixB } = data;
    
    const result = [];
    const colsB = matrixB[0].length;
    
    for (let i = 0; i < matrixA.length; i++) {
        const row = Array(colsB).fill(0);
        
        for (let j = 0; j < colsB; j++) {
            for (let k = 0; k < matrixA[0].length; k++) {
                row[j] += matrixA[i][k] * matrixB[k][j];
            }
        }
        
        result.push(row);
    }
    
    return result;
}

/**
 * Matrix similarity calculation
 */
async function matrixSimilarity(data) {
    const { matrix, startIndex, algorithm } = data;
    
    const similarities = [];
    
    for (let i = 0; i < matrix.length; i++) {
        for (let j = i + 1; j < matrix.length; j++) {
            const row1 = matrix[i];
            const row2 = matrix[j];
            
            let similarity = 0;
            
            switch (algorithm) {
                case 'cosine':
                    similarity = calculateCosineSimilarity(
                        row1.map((val, idx) => ({ item_id: idx, rating: val })),
                        row2.map((val, idx) => ({ item_id: idx, rating: val }))
                    );
                    break;
                case 'pearson':
                    similarity = calculatePearsonCorrelation(
                        row1.map((val, idx) => ({ item_id: idx, rating: val })),
                        row2.map((val, idx) => ({ item_id: idx, rating: val }))
                    );
                    break;
                case 'euclidean':
                    similarity = calculateEuclideanSimilarity(
                        row1.map((val, idx) => ({ item_id: idx, rating: val })),
                        row2.map((val, idx) => ({ item_id: idx, rating: val }))
                    );
                    break;
            }
            
            if (similarity > 0.1) {
                similarities.push({
                    row1: startIndex + i,
                    row2: startIndex + j,
                    similarity,
                    algorithm
                });
            }
        }
    }
    
    return similarities;
}

/**
 * Extract features from data
 */
async function extractFeatures(data) {
    const { items, featureTypes, options = {} } = data;
    
    const features = [];
    
    for (const item of items) {
        const itemFeatures = {};
        
        for (const featureType of featureTypes) {
            switch (featureType) {
                case 'text_features':
                    itemFeatures.text = extractTextFeatures(item.text || '');
                    break;
                case 'numerical_features':
                    itemFeatures.numerical = extractNumericalFeatures(item);
                    break;
                case 'categorical_features':
                    itemFeatures.categorical = extractCategoricalFeatures(item);
                    break;
                case 'temporal_features':
                    itemFeatures.temporal = extractTemporalFeatures(item);
                    break;
                case 'wine_features':
                    itemFeatures.wine = extractWineFeatures(item);
                    break;
                case 'dish_features':
                    itemFeatures.dish = extractDishFeatures(item);
                    break;
            }
        }
        
        features.push({
            id: item.id,
            features: itemFeatures
        });
    }
    
    return features;
}

/**
 * Extract text features
 */
function extractTextFeatures(text) {
    const words = text.toLowerCase().split(/\W+/).filter(word => word.length > 2);
    const wordCount = words.length;
    const uniqueWords = new Set(words).size;
    const avgWordLength = words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0;
    
    // Extract sentiment indicators
    const positiveWords = ['excellent', 'amazing', 'wonderful', 'fantastic', 'great', 'good', 'delicious'];
    const negativeWords = ['terrible', 'awful', 'bad', 'horrible', 'disgusting', 'poor'];
    
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    const sentiment = positiveCount > negativeCount ? 'positive' : negativeCount > positiveCount ? 'negative' : 'neutral';
    
    return {
        wordCount,
        uniqueWords,
        avgWordLength,
        vocabulary: Array.from(new Set(words)),
        sentiment,
        positiveWords: positiveCount,
        negativeWords: negativeCount
    };
}

/**
 * Extract numerical features
 */
function extractNumericalFeatures(item) {
    const features = {};
    
    for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'number') {
            features[key] = value;
        }
    }
    
    return features;
}

/**
 * Extract categorical features
 */
function extractCategoricalFeatures(item) {
    const features = {};
    
    for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'string' && !isNaN(Date.parse(value))) {
            // Skip date strings
            continue;
        }
        if (typeof value === 'string' || typeof value === 'boolean') {
            features[key] = value;
        }
    }
    
    return features;
}

/**
 * Extract temporal features
 */
function extractTemporalFeatures(item) {
    const features = {};
    
    for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'string') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                features[key] = {
                    timestamp: date.getTime(),
                    year: date.getFullYear(),
                    month: date.getMonth(),
                    day: date.getDate(),
                    hour: date.getHours(),
                    dayOfWeek: date.getDay(),
                    season: getSeason(date.getMonth())
                };
            }
        }
    }
    
    return features;
}

/**
 * Extract wine-specific features
 */
function extractWineFeatures(item) {
    const features = {};
    
    // Wine type encoding
    const wineTypes = { 'Red': 1, 'White': 2, 'Rosé': 3, 'Sparkling': 4, 'Dessert': 5, 'Fortified': 6 };
    features.wineType = wineTypes[item.wine_type] || 0;
    
    // Grape variety analysis
    if (item.grape_varieties) {
        const varieties = Array.isArray(item.grape_varieties) ? item.grape_varieties : [item.grape_varieties];
        features.grapeVarietyCount = varieties.length;
        features.dominantGrape = varieties[0] || 'unknown';
    }
    
    // Alcohol content analysis
    if (item.alcohol_content) {
        features.alcoholLevel = item.alcohol_content;
        features.alcoholCategory = item.alcohol_content < 12 ? 'low' : item.alcohol_content > 15 ? 'high' : 'medium';
    }
    
    // Price analysis
    if (item.price) {
        features.priceTier = item.price < 25 ? 'budget' : item.price < 75 ? 'mid' : item.price < 200 ? 'premium' : 'luxury';
    }
    
    return features;
}

/**
 * Extract dish-specific features
 */
function extractDishFeatures(item) {
    const features = {};
    
    // Cuisine type detection
    const cuisineKeywords = {
        'french': ['french', 'bourguignon', 'coq au vin'],
        'italian': ['italian', 'pasta', 'risotto', 'carbonara'],
        'spanish': ['spanish', 'paella', 'tapas'],
        'american': ['american', 'bbq', 'burger', 'steak'],
        'asian': ['asian', 'stir-fry', 'curry', 'sushi']
    };
    
    const description = (item.description || item.name || '').toLowerCase();
    for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
        if (keywords.some(keyword => description.includes(keyword))) {
            features.cuisine = cuisine;
            break;
        }
    }
    
    // Cooking method detection
    const cookingMethods = ['grilled', 'roasted', 'fried', 'steamed', 'braised', 'raw', 'baked'];
    for (const method of cookingMethods) {
        if (description.includes(method)) {
            features.cookingMethod = method;
            break;
        }
    }
    
    // Protein type detection
    const proteins = ['beef', 'lamb', 'pork', 'chicken', 'duck', 'fish', 'seafood', 'vegetarian'];
    for (const protein of proteins) {
        if (description.includes(protein)) {
            features.proteinType = protein;
            break;
        }
    }
    
    // Intensity analysis
    const intensityKeywords = {
        'light': ['light', 'delicate', 'subtle', 'fresh'],
        'heavy': ['rich', 'bold', 'intense', 'robust', 'full-bodied']
    };
    
    for (const [intensity, keywords] of Object.entries(intensityKeywords)) {
        if (keywords.some(keyword => description.includes(keyword))) {
            features.intensity = intensity;
            break;
        }
    }
    
    return features;
}

/**
 * Get season from month
 */
function getSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
}

/**
 * Process data
 */
async function processData(data) {
    const { dataset, operations, options = {} } = data;
    
    let processedData = dataset;
    
    for (const operation of operations) {
        switch (operation.type) {
            case 'filter':
                processedData = filterData(processedData, operation.criteria);
                break;
            case 'transform':
                processedData = transformData(processedData, operation.transform);
                break;
            case 'aggregate':
                processedData = aggregateData(processedData, operation.groupBy, operation.aggregations);
                break;
            case 'sort':
                processedData = sortData(processedData, operation.sortBy, operation.order);
                break;
            case 'normalize':
                processedData = normalizeData(processedData, operation.fields);
                break;
        }
    }
    
    return processedData;
}

/**
 * Filter data based on criteria
 */
function filterData(data, criteria) {
    return data.filter(item => {
        for (const [key, value] of Object.entries(criteria)) {
            if (item[key] !== value) {
                return false;
            }
        }
        return true;
    });
}

/**
 * Transform data
 */
function transformData(data, transform) {
    return data.map(item => {
        const transformed = { ...item };
        
        for (const [key, operation] of Object.entries(transform)) {
            switch (operation.type) {
                case 'multiply':
                    transformed[key] = item[key] * operation.value;
                    break;
                case 'add':
                    transformed[key] = item[key] + operation.value;
                    break;
                case 'normalize':
                    transformed[key] = (item[key] - operation.min) / (operation.max - operation.min);
                    break;
                case 'log':
                    transformed[key] = Math.log(item[key] + 1);
                    break;
                case 'sqrt':
                    transformed[key] = Math.sqrt(item[key]);
                    break;
            }
        }
        
        return transformed;
    });
}

/**
 * Aggregate data
 */
function aggregateData(data, groupBy, aggregations) {
    const groups = {};
    
    for (const item of data) {
        const groupKey = groupBy.map(key => item[key]).join('|');
        
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        
        groups[groupKey].push(item);
    }
    
    const result = [];
    
    for (const [groupKey, groupData] of Object.entries(groups)) {
        const aggregated = {};
        
        for (const key of groupBy) {
            aggregated[key] = groupData[0][key];
        }
        
        for (const [field, operation] of Object.entries(aggregations)) {
            switch (operation) {
                case 'sum':
                    aggregated[field] = groupData.reduce((sum, item) => sum + item[field], 0);
                    break;
                case 'avg':
                    aggregated[field] = groupData.reduce((sum, item) => sum + item[field], 0) / groupData.length;
                    break;
                case 'count':
                    aggregated[field] = groupData.length;
                    break;
                case 'min':
                    aggregated[field] = Math.min(...groupData.map(item => item[field]));
                    break;
                case 'max':
                    aggregated[field] = Math.max(...groupData.map(item => item[field]));
                    break;
                case 'median':
                    const sorted = groupData.map(item => item[field]).sort((a, b) => a - b);
                    aggregated[field] = sorted[Math.floor(sorted.length / 2)];
                    break;
            }
        }
        
        result.push(aggregated);
    }
    
    return result;
}

/**
 * Sort data
 */
function sortData(data, sortBy, order = 'asc') {
    return data.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (order === 'desc') {
            return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        } else {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        }
    });
}

/**
 * Normalize data
 */
function normalizeData(data, fields) {
    const normalized = [...data];
    
    for (const field of fields) {
        const values = data.map(item => item[field]).filter(val => typeof val === 'number');
        
        if (values.length === 0) continue;
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        
        if (range === 0) continue;
        
        for (let i = 0; i < normalized.length; i++) {
            if (typeof normalized[i][field] === 'number') {
                normalized[i][field] = (normalized[i][field] - min) / range;
            }
        }
    }
    
    return normalized;
}

/**
 * Train model
 */
async function trainModel(data) {
    const { modelType, trainingData, parameters } = data;
    
    // Simulate model training
    const startTime = Date.now();
    
    // This would implement actual model training
    // For now, return mock results
    const model = {
        type: modelType,
        parameters,
        trainedAt: new Date().toISOString(),
        trainingDataSize: trainingData.length
    };
    
    const trainingTime = Date.now() - startTime;
    
    return {
        model,
        trainingTime,
        performance: {
            accuracy: 0.85 + Math.random() * 0.1,
            precision: 0.83 + Math.random() * 0.1,
            recall: 0.81 + Math.random() * 0.1,
            f1_score: 0.82 + Math.random() * 0.1
        }
    };
}

module.exports = {
    executeTask,
    calculateSimilarity,
    matrixMultiplication,
    matrixSimilarity,
    extractFeatures,
    processData,
    trainModel
};