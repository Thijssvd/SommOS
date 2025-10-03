-- A/B Testing Infrastructure Schema
-- Supports experiment management, variant assignment, and metrics tracking

-- Experiments table: Core experiment configuration
CREATE TABLE IF NOT EXISTS Experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    hypothesis TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, running, paused, completed, archived
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Experiment configuration
    traffic_allocation REAL DEFAULT 1.0, -- Percentage of traffic to include (0.0-1.0)
    target_metric TEXT NOT NULL, -- Primary success metric
    minimum_sample_size INTEGER DEFAULT 1000,
    significance_level REAL DEFAULT 0.05, -- Alpha for statistical tests
    
    -- Results and analysis
    winner_variant TEXT,
    confidence_level REAL,
    completed_at DATETIME,
    
    -- Metadata
    tags TEXT, -- JSON array of tags
    notes TEXT,
    
    CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')),
    CHECK (traffic_allocation >= 0.0 AND traffic_allocation <= 1.0),
    CHECK (significance_level > 0.0 AND significance_level < 1.0)
);

-- Experiment Variants: Different versions being tested
CREATE TABLE IF NOT EXISTS ExperimentVariants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    name TEXT NOT NULL, -- e.g., 'control', 'variant_a', 'variant_b'
    description TEXT,
    allocation_percentage REAL NOT NULL, -- Percentage of traffic for this variant
    is_control BOOLEAN DEFAULT 0,
    
    -- Configuration specific to this variant
    config JSON, -- Variant-specific settings (model params, algorithm, weights, etc.)
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (experiment_id) REFERENCES Experiments(id) ON DELETE CASCADE,
    UNIQUE (experiment_id, name),
    CHECK (allocation_percentage >= 0.0 AND allocation_percentage <= 100.0)
);

-- User Variant Assignments: Track which users see which variants
CREATE TABLE IF NOT EXISTS UserVariantAssignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Assignment metadata
    assignment_hash TEXT, -- Hash for deterministic assignment
    session_id TEXT, -- Optional session tracking
    device_type TEXT, -- mobile, desktop, tablet
    
    FOREIGN KEY (experiment_id) REFERENCES Experiments(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES ExperimentVariants(id) ON DELETE CASCADE,
    UNIQUE (experiment_id, user_id) -- One variant per user per experiment
);

-- Experiment Events: Track user interactions and conversions
CREATE TABLE IF NOT EXISTS ExperimentEvents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- impression, click, conversion, rating, etc.
    event_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Event details
    event_value REAL, -- Numeric value (rating, revenue, etc.)
    event_metadata JSON, -- Additional event data
    
    -- Context
    session_id TEXT,
    recommendation_id INTEGER, -- Link to specific recommendation if applicable
    wine_id INTEGER,
    
    FOREIGN KEY (experiment_id) REFERENCES Experiments(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES ExperimentVariants(id) ON DELETE CASCADE
);

-- Experiment Metrics: Aggregated metrics per variant
CREATE TABLE IF NOT EXISTS ExperimentMetrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    metric_name TEXT NOT NULL, -- e.g., 'ctr', 'conversion_rate', 'avg_rating'
    
    -- Metric values
    metric_value REAL NOT NULL,
    metric_count INTEGER, -- Sample size for this metric
    metric_std_dev REAL, -- Standard deviation
    
    -- Time range
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    start_date DATETIME,
    end_date DATETIME,
    
    -- Metadata
    confidence_interval_lower REAL,
    confidence_interval_upper REAL,
    
    FOREIGN KEY (experiment_id) REFERENCES Experiments(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES ExperimentVariants(id) ON DELETE CASCADE
);

-- Statistical Analysis Results: Comparison between variants
CREATE TABLE IF NOT EXISTS ExperimentAnalysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    control_variant_id INTEGER NOT NULL,
    test_variant_id INTEGER NOT NULL,
    
    -- Statistical test results
    test_type TEXT NOT NULL, -- t-test, chi-square, bayesian
    p_value REAL,
    confidence_level REAL,
    effect_size REAL, -- Difference in metric values
    relative_lift REAL, -- Percentage improvement
    
    -- Bayesian analysis (if applicable)
    probability_of_superiority REAL, -- P(test > control)
    expected_loss REAL,
    
    -- Decision
    is_significant BOOLEAN,
    recommendation TEXT, -- launch, iterate, stop
    
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    
    FOREIGN KEY (experiment_id) REFERENCES Experiments(id) ON DELETE CASCADE,
    FOREIGN KEY (control_variant_id) REFERENCES ExperimentVariants(id),
    FOREIGN KEY (test_variant_id) REFERENCES ExperimentVariants(id)
);

-- Experiment Guardrail Metrics: Track important metrics to ensure no negative impact
CREATE TABLE IF NOT EXISTS ExperimentGuardrails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    metric_name TEXT NOT NULL,
    threshold_type TEXT NOT NULL, -- min, max
    threshold_value REAL NOT NULL,
    current_value REAL,
    is_violated BOOLEAN DEFAULT 0,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (experiment_id) REFERENCES Experiments(id) ON DELETE CASCADE,
    CHECK (threshold_type IN ('min', 'max'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_experiments_status ON Experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_dates ON Experiments(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_variants_experiment ON ExperimentVariants(experiment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_experiment_user ON UserVariantAssignments(experiment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_variant ON UserVariantAssignments(variant_id);
CREATE INDEX IF NOT EXISTS idx_events_experiment ON ExperimentEvents(experiment_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON ExperimentEvents(user_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON ExperimentEvents(event_type, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_experiment_variant ON ExperimentMetrics(experiment_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_analysis_experiment ON ExperimentAnalysis(experiment_id);

-- Create views for common queries

-- Active experiments with variant counts
CREATE VIEW IF NOT EXISTS ActiveExperimentsView AS
SELECT 
    e.id,
    e.name,
    e.description,
    e.status,
    e.start_date,
    e.end_date,
    e.target_metric,
    COUNT(DISTINCT ev.id) as variant_count,
    COUNT(DISTINCT ua.user_id) as user_count,
    e.traffic_allocation
FROM Experiments e
LEFT JOIN ExperimentVariants ev ON e.id = ev.experiment_id
LEFT JOIN UserVariantAssignments ua ON e.id = ua.experiment_id
WHERE e.status = 'running'
GROUP BY e.id;

-- Variant performance summary
CREATE VIEW IF NOT EXISTS VariantPerformanceView AS
SELECT 
    v.id as variant_id,
    v.experiment_id,
    v.name as variant_name,
    v.is_control,
    COUNT(DISTINCT ua.user_id) as assigned_users,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'impression' THEN ee.id END) as impressions,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'click' THEN ee.id END) as clicks,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'conversion' THEN ee.id END) as conversions,
    AVG(CASE WHEN ee.event_type = 'rating' THEN ee.event_value END) as avg_rating
FROM ExperimentVariants v
LEFT JOIN UserVariantAssignments ua ON v.id = ua.variant_id
LEFT JOIN ExperimentEvents ee ON v.id = ee.variant_id
GROUP BY v.id;

-- Experiment overview with key metrics
CREATE VIEW IF NOT EXISTS ExperimentOverviewView AS
SELECT 
    e.id,
    e.name,
    e.status,
    e.start_date,
    e.end_date,
    COUNT(DISTINCT ua.user_id) as total_users,
    COUNT(DISTINCT ev.id) as total_events,
    e.winner_variant,
    e.confidence_level,
    JULIANDAY(COALESCE(e.end_date, CURRENT_TIMESTAMP)) - JULIANDAY(e.start_date) as duration_days
FROM Experiments e
LEFT JOIN UserVariantAssignments ua ON e.id = ua.experiment_id
LEFT JOIN ExperimentEvents ev ON e.id = ev.experiment_id
GROUP BY e.id;
