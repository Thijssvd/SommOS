-- Performance optimization indexes for SommOS
-- Added to improve query performance for frequently accessed data

-- Wine catalog search indexes
CREATE INDEX IF NOT EXISTS idx_wines_search ON Wines(name, producer, region);
CREATE INDEX IF NOT EXISTS idx_wines_type_producer ON Wines(wine_type, producer);

-- Vintage intelligence indexes
CREATE INDEX IF NOT EXISTS idx_vintages_wine_year ON Vintages(wine_id, year);
CREATE INDEX IF NOT EXISTS idx_vintages_quality_weather ON Vintages(quality_score, weather_score);

-- Stock management indexes
CREATE INDEX IF NOT EXISTS idx_stock_location_quantity ON Stock(location, quantity);
CREATE INDEX IF NOT EXISTS idx_stock_vintage_location ON Stock(vintage_id, location);
CREATE INDEX IF NOT EXISTS idx_stock_available ON Stock(quantity, reserved_quantity);

-- Inventory intake indexes
CREATE INDEX IF NOT EXISTS idx_intake_orders_status ON InventoryIntakeOrders(status);
CREATE INDEX IF NOT EXISTS idx_intake_items_intake_status ON InventoryIntakeItems(intake_id, status);

-- Learning engine indexes
CREATE INDEX IF NOT EXISTS idx_learning_feedback_user ON LearningPairingFeedbackEnhanced(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_feedback_recommendation ON LearningPairingFeedbackEnhanced(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_learning_feedback_context ON LearningPairingFeedbackEnhanced(occasion, season);

-- Feature engineering indexes
CREATE INDEX IF NOT EXISTS idx_wine_features_wine_id ON WineFeatures(wine_id);
CREATE INDEX IF NOT EXISTS idx_wine_features_region ON WineFeatures(region_encoded);
CREATE INDEX IF NOT EXISTS idx_wine_features_style ON WineFeatures(style_encoded);
CREATE INDEX IF NOT EXISTS idx_dish_features_hash ON DishFeatures(dish_hash);
CREATE INDEX IF NOT EXISTS idx_dish_features_cuisine ON DishFeatures(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_dish_features_preparation ON DishFeatures(preparation_method);

-- Procurement analysis indexes
CREATE INDEX IF NOT EXISTS idx_pricebook_composite ON PriceBook(vintage_id, supplier_id, price_per_bottle);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON Suppliers(active, name);

-- Weather data indexes
CREATE INDEX IF NOT EXISTS idx_weather_region_year ON WeatherVintage(region, year);
CREATE INDEX IF NOT EXISTS idx_weather_cache_key ON WeatherCache(key, fetched_at);

-- Compound indexes for complex queries (SQLite syntax)
CREATE INDEX IF NOT EXISTS idx_wine_vintage_stock ON Wines(id);
CREATE INDEX IF NOT EXISTS idx_vintage_wine_stock ON Vintages(wine_id);
CREATE INDEX IF NOT EXISTS idx_stock_vintage_location ON Stock(vintage_id, location);
CREATE INDEX IF NOT EXISTS idx_inventory_analysis ON Stock(vintage_id, location, quantity);
CREATE INDEX IF NOT EXISTS idx_wine_vintage_quality ON Vintages(wine_id, quality_score);
CREATE INDEX IF NOT EXISTS idx_wine_search_composite ON Wines(name, region, wine_type);
