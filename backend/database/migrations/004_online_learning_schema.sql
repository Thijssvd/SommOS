-- Online Learning and Model Management Schema
-- Supports incremental updates, model versioning, and performance monitoring

-- Model Registry: Store trained models with versioning
CREATE TABLE IF NOT EXISTS ModelRegistry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    model_type TEXT NOT NULL, -- collaborative_filtering, content_based, hybrid
    
    -- Model artifacts
    model_path TEXT, -- File path to serialized model
    model_data JSON, -- Model parameters and data (for small models)
    
    -- Training metadata
    trained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    training_duration_ms INTEGER,
    training_samples INTEGER,
    training_config JSON,
    
    -- Performance metrics
    rmse REAL,
    mae REAL,
    precision_at_10 REAL,
    recall_at_10 REAL,
    f1_score REAL,
    
    -- Status and deployment
    status TEXT DEFAULT 'trained', -- trained, staging, production, archived, failed
    deployed_at DATETIME,
    deprecated_at DATETIME,
    
    -- Metadata
    created_by TEXT,
    notes TEXT,
    tags JSON,
    
    UNIQUE (model_name, model_version),
    CHECK (status IN ('trained', 'staging', 'production', 'archived', 'failed'))
);

-- Model Performance Tracking: Monitor model performance over time
CREATE TABLE IF NOT EXISTS ModelPerformanceMetrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    metric_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Performance metrics
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    
    -- Context
    sample_size INTEGER,
    user_segment TEXT, -- all, new_users, active_users, etc.
    time_window TEXT, -- hourly, daily, weekly
    
    -- Comparison with baseline
    baseline_value REAL,
    delta_from_baseline REAL,
    
    FOREIGN KEY (model_id) REFERENCES ModelRegistry(id) ON DELETE CASCADE
);

-- Model Drift Detection: Track when models need retraining
CREATE TABLE IF NOT EXISTS ModelDriftMetrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Drift indicators
    drift_type TEXT NOT NULL, -- prediction_drift, feature_drift, target_drift
    drift_score REAL NOT NULL,
    drift_threshold REAL NOT NULL,
    is_drifting BOOLEAN DEFAULT 0,
    
    -- Details
    affected_features JSON,
    drift_details JSON,
    
    -- Actions
    requires_retraining BOOLEAN DEFAULT 0,
    retraining_triggered BOOLEAN DEFAULT 0,
    
    FOREIGN KEY (model_id) REFERENCES ModelRegistry(id) ON DELETE CASCADE,
    CHECK (drift_type IN ('prediction_drift', 'feature_drift', 'target_drift'))
);

-- Incremental Update Log: Track incremental model updates
CREATE TABLE IF NOT EXISTS IncrementalUpdateLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    update_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Update details
    update_type TEXT NOT NULL, -- user_profile, item_profile, similarity_matrix
    updates_applied INTEGER,
    new_data_samples INTEGER,
    
    -- Performance impact
    update_duration_ms INTEGER,
    memory_usage_mb REAL,
    
    -- Status
    status TEXT DEFAULT 'success', -- success, failed, partial
    error_message TEXT,
    
    FOREIGN KEY (model_id) REFERENCES ModelRegistry(id) ON DELETE CASCADE,
    CHECK (update_type IN ('user_profile', 'item_profile', 'similarity_matrix', 'full_retrain')),
    CHECK (status IN ('success', 'failed', 'partial'))
);

-- Training Jobs: Scheduled and triggered retraining jobs
CREATE TABLE IF NOT EXISTS ModelTrainingJobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL, -- full_retrain, incremental_update, evaluation
    model_name TEXT NOT NULL,
    
    -- Scheduling
    scheduled_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    
    -- Configuration
    training_config JSON,
    data_range_start DATETIME,
    data_range_end DATETIME,
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    progress_percentage INTEGER DEFAULT 0,
    
    -- Results
    result_model_id INTEGER,
    performance_metrics JSON,
    error_message TEXT,
    
    -- Triggering
    triggered_by TEXT, -- schedule, manual, drift_detection, experiment
    trigger_details JSON,
    
    FOREIGN KEY (result_model_id) REFERENCES ModelRegistry(id),
    CHECK (job_type IN ('full_retrain', 'incremental_update', 'evaluation')),
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Retraining Schedule: Define when models should be retrained
CREATE TABLE IF NOT EXISTS RetrainingSchedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL UNIQUE,
    
    -- Schedule configuration
    schedule_type TEXT NOT NULL, -- cron, interval, drift_based, manual
    schedule_expression TEXT, -- cron expression or interval in seconds
    
    -- Conditions
    min_new_samples INTEGER DEFAULT 1000,
    min_days_since_training INTEGER DEFAULT 7,
    drift_threshold REAL DEFAULT 0.1,
    
    -- Status
    is_active BOOLEAN DEFAULT 1,
    last_run_at DATETIME,
    next_run_at DATETIME,
    
    -- Configuration
    training_config JSON,
    notification_emails TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (schedule_type IN ('cron', 'interval', 'drift_based', 'manual'))
);

-- Model Deployment History: Track model deployments and rollbacks
CREATE TABLE IF NOT EXISTS ModelDeploymentHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    
    -- Deployment details
    deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deployed_by TEXT,
    deployment_type TEXT NOT NULL, -- full, canary, ab_test
    traffic_percentage REAL DEFAULT 100.0,
    
    -- Rollback info
    rolled_back_at DATETIME,
    rollback_reason TEXT,
    previous_model_id INTEGER,
    
    -- Status
    status TEXT DEFAULT 'active', -- active, inactive, rolled_back
    
    -- Performance tracking
    deployment_metrics JSON,
    
    FOREIGN KEY (model_id) REFERENCES ModelRegistry(id),
    FOREIGN KEY (previous_model_id) REFERENCES ModelRegistry(id),
    CHECK (deployment_type IN ('full', 'canary', 'ab_test')),
    CHECK (status IN ('active', 'inactive', 'rolled_back')),
    CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100)
);

-- Model Comparison: Compare different model versions
CREATE TABLE IF NOT EXISTS ModelComparisons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comparison_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Models being compared
    baseline_model_id INTEGER NOT NULL,
    candidate_model_id INTEGER NOT NULL,
    
    -- Comparison metrics
    metric_name TEXT NOT NULL,
    baseline_value REAL,
    candidate_value REAL,
    improvement_percentage REAL,
    
    -- Statistical significance
    is_significant BOOLEAN,
    p_value REAL,
    confidence_level REAL,
    
    -- Decision
    winner TEXT, -- baseline, candidate, inconclusive
    notes TEXT,
    
    FOREIGN KEY (baseline_model_id) REFERENCES ModelRegistry(id),
    FOREIGN KEY (candidate_model_id) REFERENCES ModelRegistry(id),
    CHECK (winner IN ('baseline', 'candidate', 'inconclusive', NULL))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_model_registry_name_version ON ModelRegistry(model_name, model_version);
CREATE INDEX IF NOT EXISTS idx_model_registry_status ON ModelRegistry(status);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_model ON ModelPerformanceMetrics(model_id, metric_timestamp);
CREATE INDEX IF NOT EXISTS idx_drift_metrics_model ON ModelDriftMetrics(model_id, checked_at);
CREATE INDEX IF NOT EXISTS idx_incremental_updates_model ON IncrementalUpdateLog(model_id, update_timestamp);
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON ModelTrainingJobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_deployment_history_model ON ModelDeploymentHistory(model_id, deployed_at);

-- Create views for common queries

-- Currently deployed models
CREATE VIEW IF NOT EXISTS DeployedModelsView AS
SELECT 
    mr.*,
    mdh.deployed_at,
    mdh.traffic_percentage,
    mdh.deployment_type
FROM ModelRegistry mr
INNER JOIN ModelDeploymentHistory mdh ON mr.id = mdh.model_id
WHERE mdh.status = 'active'
    AND mr.status = 'production';

-- Model performance trends
CREATE VIEW IF NOT EXISTS ModelPerformanceTrendsView AS
SELECT 
    mr.model_name,
    mr.model_version,
    mpm.metric_name,
    mpm.metric_value,
    mpm.metric_timestamp,
    mpm.user_segment
FROM ModelRegistry mr
INNER JOIN ModelPerformanceMetrics mpm ON mr.id = mpm.model_id
WHERE mr.status IN ('production', 'staging')
ORDER BY mr.model_name, mpm.metric_timestamp DESC;

-- Models requiring retraining
CREATE VIEW IF NOT EXISTS ModelsRequiringRetrainingView AS
SELECT 
    mr.id as model_id,
    mr.model_name,
    mr.model_version,
    mr.trained_at,
    COUNT(DISTINCT mdm.id) as drift_count,
    MAX(mdm.drift_score) as max_drift_score,
    rs.schedule_type,
    rs.next_run_at
FROM ModelRegistry mr
LEFT JOIN ModelDriftMetrics mdm ON mr.id = mdm.model_id AND mdm.is_drifting = 1
LEFT JOIN RetrainingSchedule rs ON mr.model_name = rs.model_name
WHERE mr.status = 'production'
    AND (mdm.requires_retraining = 1 OR rs.next_run_at <= CURRENT_TIMESTAMP)
GROUP BY mr.id;

-- Recent training jobs status
CREATE VIEW IF NOT EXISTS RecentTrainingJobsView AS
SELECT 
    mtj.*,
    mr.model_name as result_model_name,
    mr.model_version as result_model_version
FROM ModelTrainingJobs mtj
LEFT JOIN ModelRegistry mr ON mtj.result_model_id = mr.id
ORDER BY mtj.scheduled_at DESC
LIMIT 50;
