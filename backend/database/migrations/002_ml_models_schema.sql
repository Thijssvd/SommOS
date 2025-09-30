-- ML Models and A/B Testing Schema Migration
-- Adds support for machine learning model management and A/B testing

-- ML Models table
CREATE TABLE IF NOT EXISTS LearningModels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('collaborative_filtering', 'content_based', 'hybrid', 'ensemble')),
    algorithm TEXT NOT NULL,
    parameters TEXT, -- JSON object with model parameters
    model_data BLOB, -- Serialized model data
    model_path TEXT, -- Path to model file on disk
    performance TEXT, -- JSON object with performance metrics
    metadata TEXT, -- JSON object with additional metadata
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'deleted')) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_id, version)
);

-- A/B Tests table
CREATE TABLE IF NOT EXISTS ABTests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id TEXT NOT NULL UNIQUE,
    model_id1 TEXT NOT NULL,
    version1 TEXT NOT NULL,
    model_id2 TEXT NOT NULL,
    version2 TEXT NOT NULL,
    traffic_split REAL NOT NULL CHECK (traffic_split > 0 AND traffic_split < 1),
    test_duration INTEGER NOT NULL, -- Duration in milliseconds
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'cancelled')) DEFAULT 'running',
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id1, version1) REFERENCES LearningModels(model_id, version),
    FOREIGN KEY (model_id2, version2) REFERENCES LearningModels(model_id, version)
);

-- A/B Test Results table
CREATE TABLE IF NOT EXISTS ABTestResults (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    model_used TEXT NOT NULL, -- 'model1' or 'model2'
    recommendation_id INTEGER,
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    selected BOOLEAN,
    response_time INTEGER, -- Time to respond in milliseconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES ABTests(test_id) ON DELETE CASCADE,
    FOREIGN KEY (recommendation_id) REFERENCES LearningPairingRecommendations(id) ON DELETE SET NULL
);

-- Model Performance History table
CREATE TABLE IF NOT EXISTS ModelPerformanceHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    version TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    evaluation_date DATE DEFAULT CURRENT_DATE,
    evaluation_data_size INTEGER,
    evaluation_context TEXT, -- JSON object with evaluation context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id, version) REFERENCES LearningModels(model_id, version)
);

-- Similarity Matrices table for caching
CREATE TABLE IF NOT EXISTS SimilarityMatrices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('user', 'wine', 'dish')),
    entity_id TEXT NOT NULL,
    similar_entities TEXT NOT NULL, -- JSON array of similar entities with scores
    algorithm TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id, algorithm)
);

-- Ensemble Recommendations table for tracking
CREATE TABLE IF NOT EXISTS EnsembleRecommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    session_id TEXT,
    dish_context TEXT, -- JSON object with dish context
    algorithms_used TEXT, -- JSON array of algorithms used
    algorithm_weights TEXT, -- JSON object with algorithm weights
    recommendations TEXT, -- JSON array of final recommendations
    performance_metrics TEXT, -- JSON object with performance metrics
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Model Training Data table
CREATE TABLE IF NOT EXISTS ModelTrainingData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    version TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (data_type IN ('training', 'validation', 'test')),
    data_size INTEGER NOT NULL,
    data_hash TEXT NOT NULL, -- Hash of training data for integrity
    data_metadata TEXT, -- JSON object with data metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id, version) REFERENCES LearningModels(model_id, version)
);

-- Feature Importance table
CREATE TABLE IF NOT EXISTS FeatureImportance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    version TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    importance_score REAL NOT NULL,
    feature_type TEXT NOT NULL CHECK (feature_type IN ('wine', 'dish', 'user', 'context')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id, version) REFERENCES LearningModels(model_id, version)
);

-- Model Deployment table
CREATE TABLE IF NOT EXISTS ModelDeployments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    version TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    deployment_status TEXT NOT NULL CHECK (deployment_status IN ('pending', 'deployed', 'failed', 'rolled_back')) DEFAULT 'pending',
    deployment_config TEXT, -- JSON object with deployment configuration
    deployed_at DATETIME,
    rolled_back_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id, version) REFERENCES LearningModels(model_id, version)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_models_id_version ON LearningModels(model_id, version);
CREATE INDEX IF NOT EXISTS idx_learning_models_type ON LearningModels(type);
CREATE INDEX IF NOT EXISTS idx_learning_models_status ON LearningModels(status);
CREATE INDEX IF NOT EXISTS idx_learning_models_created ON LearningModels(created_at);

CREATE INDEX IF NOT EXISTS idx_ab_tests_test_id ON ABTests(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ABTests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_start_date ON ABTests(start_date);

CREATE INDEX IF NOT EXISTS idx_ab_test_results_test_id ON ABTestResults(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_user_id ON ABTestResults(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_results_created ON ABTestResults(created_at);

CREATE INDEX IF NOT EXISTS idx_model_performance_model ON ModelPerformanceHistory(model_id, version);
CREATE INDEX IF NOT EXISTS idx_model_performance_metric ON ModelPerformanceHistory(metric_name);
CREATE INDEX IF NOT EXISTS idx_model_performance_date ON ModelPerformanceHistory(evaluation_date);

CREATE INDEX IF NOT EXISTS idx_similarity_matrices_entity ON SimilarityMatrices(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_similarity_matrices_algorithm ON SimilarityMatrices(algorithm);
CREATE INDEX IF NOT EXISTS idx_similarity_matrices_updated ON SimilarityMatrices(updated_at);

CREATE INDEX IF NOT EXISTS idx_ensemble_recommendations_user ON EnsembleRecommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ensemble_recommendations_created ON EnsembleRecommendations(created_at);

CREATE INDEX IF NOT EXISTS idx_model_training_data_model ON ModelTrainingData(model_id, version);
CREATE INDEX IF NOT EXISTS idx_model_training_data_type ON ModelTrainingData(data_type);

CREATE INDEX IF NOT EXISTS idx_feature_importance_model ON FeatureImportance(model_id, version);
CREATE INDEX IF NOT EXISTS idx_feature_importance_feature ON FeatureImportance(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_importance_type ON FeatureImportance(feature_type);

CREATE INDEX IF NOT EXISTS idx_model_deployments_model ON ModelDeployments(model_id, version);
CREATE INDEX IF NOT EXISTS idx_model_deployments_environment ON ModelDeployments(environment);
CREATE INDEX IF NOT EXISTS idx_model_deployments_status ON ModelDeployments(deployment_status);