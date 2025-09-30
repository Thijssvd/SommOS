-- Enhanced Learning Engine Schema Migration
-- Adds support for granular feedback, feature engineering, and contextual learning

-- Enhanced feedback table with granular ratings
CREATE TABLE IF NOT EXISTS LearningPairingFeedbackEnhanced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recommendation_id INTEGER NOT NULL,
    user_id TEXT,
    session_id INTEGER,
    
    -- Granular ratings (1-5 scale)
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    flavor_harmony_rating INTEGER CHECK (flavor_harmony_rating >= 1 AND flavor_harmony_rating <= 5),
    texture_balance_rating INTEGER CHECK (texture_balance_rating >= 1 AND texture_balance_rating <= 5),
    acidity_match_rating INTEGER CHECK (acidity_match_rating >= 1 AND acidity_match_rating <= 5),
    tannin_balance_rating INTEGER CHECK (tannin_balance_rating >= 1 AND tannin_balance_rating <= 5),
    body_match_rating INTEGER CHECK (body_match_rating >= 1 AND body_match_rating <= 5),
    regional_tradition_rating INTEGER CHECK (regional_tradition_rating >= 1 AND regional_tradition_rating <= 5),
    
    -- Contextual information
    occasion TEXT, -- 'dinner', 'lunch', 'cocktail', 'celebration', etc.
    guest_count INTEGER,
    time_of_day TEXT, -- 'morning', 'afternoon', 'evening', 'night'
    season TEXT, -- 'spring', 'summer', 'autumn', 'winter'
    weather_context TEXT, -- 'indoor', 'outdoor', 'hot', 'cold', etc.
    
    -- Behavioral data
    selected BOOLEAN DEFAULT 1,
    time_to_select INTEGER, -- seconds from recommendation to selection
    viewed_duration INTEGER, -- seconds spent viewing recommendation
    
    -- Additional feedback
    notes TEXT,
    would_recommend BOOLEAN,
    price_satisfaction INTEGER CHECK (price_satisfaction >= 1 AND price_satisfaction <= 5),
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (recommendation_id) REFERENCES LearningPairingRecommendations(id) ON DELETE RESTRICT,
    FOREIGN KEY (session_id) REFERENCES LearningPairingSessions(id) ON DELETE RESTRICT
);

-- Feature engineering tables
CREATE TABLE IF NOT EXISTS WineFeatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wine_id INTEGER NOT NULL,
    
    -- Basic features
    grape_varieties TEXT, -- JSON array
    region_encoded TEXT,
    country_encoded TEXT,
    vintage_year INTEGER,
    alcohol_content REAL,
    price_tier TEXT, -- 'budget', 'mid', 'premium', 'luxury'
    style_encoded TEXT,
    
    -- Derived features
    body_score REAL, -- 1-5 scale
    acidity_score REAL, -- 1-5 scale
    tannin_score REAL, -- 1-5 scale
    sweetness_score REAL, -- 1-5 scale
    complexity_score REAL, -- 1-5 scale
    
    -- Quality indicators
    critic_score INTEGER,
    quality_score INTEGER,
    weather_score INTEGER,
    
    -- Feature vector (for ML models)
    feature_vector TEXT, -- JSON array of normalized features
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (wine_id) REFERENCES Wines(id) ON DELETE RESTRICT,
    UNIQUE(wine_id)
);

CREATE TABLE IF NOT EXISTS DishFeatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dish_description TEXT NOT NULL,
    dish_hash TEXT NOT NULL, -- Hash of normalized dish description
    
    -- Parsed features
    cuisine_type TEXT,
    preparation_method TEXT,
    protein_type TEXT,
    cooking_style TEXT,
    flavor_intensity TEXT, -- 'light', 'medium', 'rich', 'bold'
    texture_profile TEXT, -- 'tender', 'crispy', 'creamy', 'firm'
    spice_level TEXT, -- 'mild', 'medium', 'spicy', 'very_spicy'
    
    -- Ingredient analysis
    dominant_ingredients TEXT, -- JSON array
    flavor_notes TEXT, -- JSON array
    cooking_techniques TEXT, -- JSON array
    
    -- Derived features
    richness_score REAL, -- 1-5 scale
    complexity_score REAL, -- 1-5 scale
    acidity_level REAL, -- 1-5 scale
    fat_content REAL, -- 1-5 scale
    
    -- Feature vector (for ML models)
    feature_vector TEXT, -- JSON array of normalized features
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(dish_hash)
);

-- User preference profiles
CREATE TABLE IF NOT EXISTS UserPreferenceProfiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    
    -- Preference vectors
    wine_type_preferences TEXT, -- JSON object with weights
    region_preferences TEXT, -- JSON object with weights
    style_preferences TEXT, -- JSON object with weights
    price_preferences TEXT, -- JSON object with weights
    
    -- Behavioral patterns
    preferred_occasions TEXT, -- JSON array
    preferred_times TEXT, -- JSON array
    seasonal_preferences TEXT, -- JSON object
    
    -- Learning metrics
    feedback_consistency REAL, -- 0-1 scale
    preference_stability REAL, -- 0-1 scale
    learning_rate REAL, -- How quickly preferences adapt
    
    -- Metadata
    total_feedback_count INTEGER DEFAULT 0,
    last_feedback_at DATETIME,
    profile_confidence REAL DEFAULT 0.5, -- 0-1 scale
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- Learning sessions with enhanced context
CREATE TABLE IF NOT EXISTS LearningPairingSessionsEnhanced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dish_description TEXT,
    dish_context TEXT, -- JSON object
    preferences TEXT, -- JSON object
    generated_by_ai BOOLEAN DEFAULT 0,
    
    -- Enhanced context
    session_context TEXT, -- JSON object with occasion, guests, etc.
    user_id TEXT,
    location TEXT,
    weather_context TEXT,
    
    -- Session metrics
    total_recommendations INTEGER DEFAULT 0,
    recommendations_viewed INTEGER DEFAULT 0,
    recommendations_selected INTEGER DEFAULT 0,
    session_duration INTEGER, -- seconds
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Feature interaction tracking
CREATE TABLE IF NOT EXISTS FeatureInteractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wine_feature_id INTEGER,
    dish_feature_id INTEGER,
    interaction_type TEXT, -- 'pairing', 'feedback', 'selection'
    
    -- Interaction metrics
    success_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0.0,
    
    -- Contextual factors
    context_factors TEXT, -- JSON object
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (wine_feature_id) REFERENCES WineFeatures(id) ON DELETE RESTRICT,
    FOREIGN KEY (dish_feature_id) REFERENCES DishFeatures(id) ON DELETE RESTRICT,
    UNIQUE(wine_feature_id, dish_feature_id, interaction_type)
);

-- Learning metrics and performance tracking
CREATE TABLE IF NOT EXISTS LearningMetrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_context TEXT, -- JSON object with additional context
    
    -- Time-based tracking
    measurement_date DATE DEFAULT CURRENT_DATE,
    measurement_period TEXT, -- 'daily', 'weekly', 'monthly'
    
    -- Model information
    model_version TEXT,
    algorithm_type TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(metric_name, measurement_date, measurement_period, model_version)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_enhanced_feedback_recommendation ON LearningPairingFeedbackEnhanced(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_feedback_user ON LearningPairingFeedbackEnhanced(user_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_feedback_created ON LearningPairingFeedbackEnhanced(created_at);
CREATE INDEX IF NOT EXISTS idx_enhanced_feedback_context ON LearningPairingFeedbackEnhanced(occasion, season, time_of_day);

CREATE INDEX IF NOT EXISTS idx_wine_features_wine_id ON WineFeatures(wine_id);
CREATE INDEX IF NOT EXISTS idx_wine_features_region ON WineFeatures(region_encoded);
CREATE INDEX IF NOT EXISTS idx_wine_features_style ON WineFeatures(style_encoded);

CREATE INDEX IF NOT EXISTS idx_dish_features_hash ON DishFeatures(dish_hash);
CREATE INDEX IF NOT EXISTS idx_dish_features_cuisine ON DishFeatures(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_dish_features_preparation ON DishFeatures(preparation_method);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON UserPreferenceProfiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_confidence ON UserPreferenceProfiles(profile_confidence);

CREATE INDEX IF NOT EXISTS idx_feature_interactions_wine ON FeatureInteractions(wine_feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_interactions_dish ON FeatureInteractions(dish_feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_interactions_success ON FeatureInteractions(success_rate);

CREATE INDEX IF NOT EXISTS idx_learning_metrics_name ON LearningMetrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_learning_metrics_date ON LearningMetrics(measurement_date);
CREATE INDEX IF NOT EXISTS idx_learning_metrics_period ON LearningMetrics(measurement_period);