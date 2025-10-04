-- SommOS Database Schema
-- SQLite database for offline-first yacht wine management

-- Core Wine Data Tables

CREATE TABLE Wines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    producer TEXT NOT NULL,
    region TEXT NOT NULL,
    country TEXT NOT NULL,
    wine_type TEXT NOT NULL CHECK (wine_type IN ('Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified')),
    grape_varieties TEXT NOT NULL, -- JSON array of grape varieties
    alcohol_content REAL,
    style TEXT, -- Light, Medium, Full-bodied, etc.
    tasting_notes TEXT,
    food_pairings TEXT, -- JSON array of pairing suggestions
    serving_temp_min INTEGER,
    serving_temp_max INTEGER,
    image_url TEXT, -- URL to wine bottle image (from Unsplash or custom upload)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_by TEXT DEFAULT 'system',
    op_id TEXT UNIQUE,
    origin TEXT DEFAULT 'server'
);

CREATE TABLE Vintages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wine_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    harvest_date DATE,
    bottling_date DATE,
    release_date DATE,
    peak_drinking_start INTEGER, -- Years from vintage
    peak_drinking_end INTEGER, -- Years from vintage
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    weather_score INTEGER CHECK (weather_score >= 0 AND weather_score <= 100),
    critic_score INTEGER CHECK (critic_score >= 0 AND critic_score <= 100),
    production_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_by TEXT DEFAULT 'system',
    op_id TEXT UNIQUE,
    origin TEXT DEFAULT 'server',
    FOREIGN KEY (wine_id) REFERENCES Wines(id) ON DELETE RESTRICT,
    UNIQUE(wine_id, year)
);

CREATE TABLE Stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vintage_id INTEGER NOT NULL,
    location TEXT NOT NULL, -- Cellar location code
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    cost_per_bottle DECIMAL(10,2),
    current_value DECIMAL(10,2),
    storage_conditions TEXT, -- JSON: temperature, humidity, etc.
    last_inventory_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_by TEXT DEFAULT 'system',
    op_id TEXT UNIQUE,
    origin TEXT DEFAULT 'server',
    FOREIGN KEY (vintage_id) REFERENCES Vintages(id) ON DELETE RESTRICT,
    UNIQUE(vintage_id, location)
);

CREATE TABLE Ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vintage_id INTEGER NOT NULL,
    location TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('IN', 'OUT', 'MOVE', 'ADJUST', 'RESERVE', 'UNRESERVE')),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    reference_id TEXT, -- Order ID, invoice number, etc.
    notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vintage_id) REFERENCES Vintages(id) ON DELETE RESTRICT
);

-- Weather Intelligence Tables

CREATE TABLE WeatherVintage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT NOT NULL,
    year INTEGER NOT NULL,
    growing_season_temp_avg REAL,
    growing_season_rainfall REAL,
    harvest_conditions TEXT,
    weather_events TEXT, -- JSON array of significant events
    quality_impact_score INTEGER CHECK (quality_impact_score >= -50 AND quality_impact_score <= 50),
    vintage_rating TEXT CHECK (vintage_rating IN ('Exceptional', 'Excellent', 'Very Good', 'Good', 'Average', 'Below Average', 'Poor')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(region, year)
);

CREATE TABLE IF NOT EXISTS WeatherCache (
    key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    ttl INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weather_cache_expiry ON WeatherCache(fetched_at);

CREATE TABLE RegionCalendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    avg_temperature REAL,
    avg_rainfall REAL,
    typical_activities TEXT, -- JSON array of vineyard activities
    optimal_conditions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(region, month)
);

CREATE TABLE GrapeProfiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grape_variety TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL CHECK (color IN ('Red', 'White')),
    characteristics TEXT, -- JSON object with flavor profiles
    climate_preferences TEXT, -- JSON object with climate needs
    harvest_timing TEXT,
    aging_potential TEXT,
    food_affinities TEXT, -- JSON array of food pairings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Business Data Tables

CREATE TABLE Suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    specialties TEXT, -- JSON array of wine types/regions
    payment_terms TEXT,
    delivery_terms TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_by TEXT DEFAULT 'system',
    op_id TEXT UNIQUE,
    origin TEXT DEFAULT 'server'
);

CREATE TABLE PriceBook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vintage_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    price_per_bottle DECIMAL(10,2) NOT NULL,
    minimum_order INTEGER DEFAULT 1 CHECK (minimum_order >= 0),
    availability_status TEXT CHECK (availability_status IN ('In Stock', 'Limited', 'Pre-order', 'Discontinued')),
    last_updated DATE NOT NULL,
    valid_until DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_by TEXT DEFAULT 'system',
    op_id TEXT UNIQUE,
    origin TEXT DEFAULT 'server',
    FOREIGN KEY (vintage_id) REFERENCES Vintages(id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES Suppliers(id) ON DELETE RESTRICT,
    UNIQUE(vintage_id, supplier_id)
);

-- Explainability Tables

CREATE TABLE IF NOT EXISTS Explanations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    factors TEXT,
    summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_explanations_entity ON Explanations(entity_type, entity_id);

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

-- Memories table moved to System Tables section to avoid duplication

CREATE TABLE InventoryIntakeOrders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER,
    supplier_name TEXT,
    source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'pdf_invoice', 'excel', 'scanned_document')),
    reference TEXT,
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery DATE,
    status TEXT NOT NULL CHECK (status IN ('ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')) DEFAULT 'ORDERED',
    raw_payload TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_by TEXT DEFAULT 'system',
    op_id TEXT UNIQUE,
    origin TEXT DEFAULT 'server',
    FOREIGN KEY (supplier_id) REFERENCES Suppliers(id) ON DELETE RESTRICT,
    UNIQUE(reference, supplier_id)
);

CREATE TABLE InventoryIntakeItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intake_id INTEGER NOT NULL,
    external_reference TEXT,
    wine_name TEXT NOT NULL,
    producer TEXT,
    region TEXT,
    country TEXT,
    wine_type TEXT,
    grape_varieties TEXT,
    vintage_year INTEGER,
    quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered >= 0),
    quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_cost DECIMAL(10,2),
    location TEXT,
    status TEXT NOT NULL CHECK (status IN ('ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED')) DEFAULT 'ORDERED',
    notes TEXT,
    wine_payload TEXT,
    vintage_payload TEXT,
    stock_payload TEXT,
    wine_id INTEGER,
    vintage_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_by TEXT DEFAULT 'system',
    op_id TEXT UNIQUE,
    origin TEXT DEFAULT 'server',
    FOREIGN KEY (intake_id) REFERENCES InventoryIntakeOrders(id) ON DELETE RESTRICT,
    FOREIGN KEY (wine_id) REFERENCES Wines(id) ON DELETE RESTRICT,
    FOREIGN KEY (vintage_id) REFERENCES Vintages(id) ON DELETE RESTRICT,
    UNIQUE(intake_id, external_reference)
);

CREATE INDEX idx_inventory_intake_items_intake_id ON InventoryIntakeItems(intake_id);
CREATE INDEX idx_inventory_intake_items_status ON InventoryIntakeItems(status);

CREATE TABLE Aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wine_id INTEGER NOT NULL,
    alias_name TEXT NOT NULL,
    alias_type TEXT CHECK (alias_type IN ('Common Name', 'Local Name', 'Historical Name', 'Nickname')),
    region TEXT, -- Where this alias is commonly used
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wine_id) REFERENCES Wines(id) ON DELETE RESTRICT,
    UNIQUE(wine_id, alias_name)
);

-- System Tables

CREATE TABLE Memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    context_type TEXT NOT NULL, -- 'pairing', 'guest_preference', 'event', etc.
    context_data TEXT NOT NULL, -- JSON object with relevant data
    memory_content TEXT NOT NULL,
    relevance_score REAL DEFAULT 1.0,
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

CREATE TABLE Explainability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_type TEXT NOT NULL, -- 'pairing', 'procurement', 'valuation'
    input_data TEXT NOT NULL, -- JSON of input parameters
    output_data TEXT NOT NULL, -- JSON of recommendation/result
    reasoning TEXT NOT NULL, -- Human-readable explanation
    confidence_score REAL,
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    feedback_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE LearningParameters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parameter_name TEXT NOT NULL UNIQUE,
    parameter_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE LearningPairingSessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dish_description TEXT,
    dish_context TEXT,
    preferences TEXT,
    generated_by_ai BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE LearningPairingRecommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    wine_id INTEGER,
    wine_name TEXT NOT NULL,
    producer TEXT,
    wine_type TEXT,
    region TEXT,
    score_breakdown TEXT,
    ai_enhanced BOOLEAN DEFAULT 0,
    ranking INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES LearningPairingSessions(id) ON DELETE RESTRICT
);

CREATE TABLE LearningPairingFeedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recommendation_id INTEGER NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    selected BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recommendation_id) REFERENCES LearningPairingRecommendations(id) ON DELETE RESTRICT
);

CREATE TABLE LearningConsumptionEvents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vintage_id INTEGER,
    wine_id INTEGER,
    wine_type TEXT,
    quantity REAL NOT NULL CHECK (quantity >= 0),
    location TEXT,
    event_type TEXT CHECK (event_type IN ('consume', 'receive', 'adjust')) DEFAULT 'consume',
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_pairing_session_created ON LearningPairingSessions(created_at);
CREATE INDEX idx_learning_pairing_recommendation_session ON LearningPairingRecommendations(session_id);
CREATE INDEX idx_learning_pairing_feedback_recommendation ON LearningPairingFeedback(recommendation_id);
CREATE INDEX idx_learning_consumption_event_type ON LearningConsumptionEvents(event_type);
CREATE INDEX idx_learning_consumption_wine_type ON LearningConsumptionEvents(wine_type);

-- Indexes for Performance

CREATE INDEX idx_wines_region ON Wines(region);
CREATE INDEX idx_wines_type ON Wines(wine_type);
CREATE INDEX idx_wines_producer ON Wines(producer);

CREATE INDEX idx_vintages_year ON Vintages(year);
CREATE INDEX idx_vintages_wine_id ON Vintages(wine_id);
CREATE INDEX idx_vintages_quality ON Vintages(quality_score);

CREATE INDEX idx_stock_location ON Stock(location);
CREATE INDEX idx_stock_vintage_id ON Stock(vintage_id);
CREATE INDEX idx_stock_quantity ON Stock(quantity);

CREATE INDEX idx_ledger_vintage_id ON Ledger(vintage_id);
CREATE INDEX idx_ledger_created_at ON Ledger(created_at);
CREATE INDEX idx_ledger_type ON Ledger(transaction_type);

CREATE INDEX idx_weather_region_year ON WeatherVintage(region, year);
CREATE INDEX idx_pricebook_vintage ON PriceBook(vintage_id);
CREATE INDEX idx_memories_context ON Memories(context_type);
CREATE INDEX idx_explainability_type ON Explainability(request_type);

-- Feature engineering indexes
CREATE INDEX IF NOT EXISTS idx_wine_features_wine_id ON WineFeatures(wine_id);
CREATE INDEX IF NOT EXISTS idx_wine_features_region ON WineFeatures(region_encoded);
CREATE INDEX IF NOT EXISTS idx_wine_features_style ON WineFeatures(style_encoded);
CREATE INDEX IF NOT EXISTS idx_dish_features_hash ON DishFeatures(dish_hash);
CREATE INDEX IF NOT EXISTS idx_dish_features_cuisine ON DishFeatures(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_dish_features_preparation ON DishFeatures(preparation_method);

-- Authentication & Authorization Tables

CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'crew', 'guest')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE TABLE IF NOT EXISTS RefreshTokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'crew', 'guest')),
    token_hash TEXT NOT NULL UNIQUE,
    pin_hash TEXT,
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON Users(email);
CREATE INDEX idx_users_role ON Users(role);
CREATE INDEX idx_refresh_tokens_user ON RefreshTokens(user_id);
CREATE INDEX idx_invites_email ON Invites(email);

-- Real User Monitoring (RUM) Tables

CREATE TABLE IF NOT EXISTS RumSessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    url TEXT,
    user_agent TEXT,
    connection TEXT, -- JSON object with connection info
    is_unload BOOLEAN DEFAULT 0,
    received_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS RumMetrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- 'webVital', 'custom', 'interaction', 'resource', 'navigation'
    metric_name TEXT,
    metric_value REAL,
    metric_data TEXT, -- JSON object with full metric data
    timestamp INTEGER NOT NULL,
    processed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    FOREIGN KEY (session_id) REFERENCES RumSessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS RumErrors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    error_type TEXT NOT NULL,
    error_message TEXT,
    error_stack TEXT,
    error_data TEXT, -- JSON object with full error data
    timestamp INTEGER NOT NULL,
    processed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    FOREIGN KEY (session_id) REFERENCES RumSessions(session_id) ON DELETE CASCADE
);

-- RUM Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_rum_sessions_session_id ON RumSessions(session_id);
CREATE INDEX IF NOT EXISTS idx_rum_sessions_timestamp ON RumSessions(timestamp);
CREATE INDEX IF NOT EXISTS idx_rum_sessions_created_at ON RumSessions(created_at);
CREATE INDEX IF NOT EXISTS idx_rum_sessions_user_id ON RumSessions(user_id);

CREATE INDEX IF NOT EXISTS idx_rum_metrics_session_id ON RumMetrics(session_id);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_type ON RumMetrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_name ON RumMetrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_timestamp ON RumMetrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_created_at ON RumMetrics(created_at);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_session_timestamp ON RumMetrics(session_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_rum_errors_session_id ON RumErrors(session_id);
CREATE INDEX IF NOT EXISTS idx_rum_errors_type ON RumErrors(error_type);
CREATE INDEX IF NOT EXISTS idx_rum_errors_timestamp ON RumErrors(timestamp);
CREATE INDEX IF NOT EXISTS idx_rum_errors_created_at ON RumErrors(created_at);
CREATE INDEX IF NOT EXISTS idx_rum_errors_session_timestamp ON RumErrors(session_id, timestamp);

-- Views for Common Queries

CREATE VIEW v_current_stock AS
SELECT 
    w.name as wine_name,
    w.producer,
    w.region,
    v.year,
    s.location,
    s.quantity,
    s.reserved_quantity,
    (s.quantity - s.reserved_quantity) as available_quantity,
    s.current_value,
    v.quality_score,
    v.peak_drinking_start,
    v.peak_drinking_end
FROM Stock s
JOIN Vintages v ON s.vintage_id = v.id
JOIN Wines w ON v.wine_id = w.id
WHERE s.quantity > 0;

CREATE VIEW v_wine_catalog AS
SELECT 
    w.*,
    v.year,
    v.quality_score,
    v.peak_drinking_start,
    v.peak_drinking_end,
    COALESCE(SUM(s.quantity), 0) as total_stock
FROM Wines w
LEFT JOIN Vintages v ON w.id = v.wine_id
LEFT JOIN Stock s ON v.id = s.vintage_id
GROUP BY w.id, v.id;

CREATE VIEW v_procurement_opportunities AS
SELECT 
    w.name as wine_name,
    w.producer,
    v.year,
    pb.price_per_bottle,
    pb.availability_status,
    s.name as supplier_name,
    pb.last_updated
FROM PriceBook pb
JOIN Vintages v ON pb.vintage_id = v.id
JOIN Wines w ON v.wine_id = w.id
JOIN Suppliers s ON pb.supplier_id = s.id
WHERE pb.availability_status IN ('In Stock', 'Limited')
AND s.active = 1;