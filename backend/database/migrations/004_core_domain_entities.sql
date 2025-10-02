-- Core Domain Entities and Normalization
-- This migration introduces normalized tables for producers, regions/appellations, grapes,
-- role-based access control, activity logging, and extends stock with status.

-- Producers
CREATE TABLE IF NOT EXISTS Producers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT,
    region_hint TEXT,
    website TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    created_by TEXT DEFAULT 'system',
    UNIQUE(name, country)
);

CREATE INDEX IF NOT EXISTS idx_producers_name ON Producers(name);

-- Regions (hierarchical)
CREATE TABLE IF NOT EXISTS Regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    region_type TEXT CHECK (region_type IN ('country','region','subregion','zone','district')) DEFAULT 'region',
    parent_region_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    created_by TEXT DEFAULT 'system',
    UNIQUE(name, country),
    FOREIGN KEY (parent_region_id) REFERENCES Regions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_regions_country_name ON Regions(country, name);

-- Appellations
CREATE TABLE IF NOT EXISTS Appellations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    region_id INTEGER NOT NULL,
    classification TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    created_by TEXT DEFAULT 'system',
    UNIQUE(name, region_id),
    FOREIGN KEY (region_id) REFERENCES Regions(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_appellations_region ON Appellations(region_id);

-- Grapes
CREATE TABLE IF NOT EXISTS Grapes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT CHECK (color IN ('Red','White','Rosé')),
    synonyms TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    created_by TEXT DEFAULT 'system'
);

-- Wine ↔ Grapes (blend mapping)
CREATE TABLE IF NOT EXISTS WinesGrapes (
    wine_id INTEGER NOT NULL,
    grape_id INTEGER NOT NULL,
    percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
    PRIMARY KEY (wine_id, grape_id),
    FOREIGN KEY (wine_id) REFERENCES Wines(id) ON DELETE CASCADE,
    FOREIGN KEY (grape_id) REFERENCES Grapes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_wines_grapes_grape ON WinesGrapes(grape_id);

-- Extend Wines with normalized references (non-breaking, keeps existing text fields)
ALTER TABLE Wines ADD COLUMN producer_id INTEGER;
ALTER TABLE Wines ADD COLUMN region_id INTEGER;
ALTER TABLE Wines ADD COLUMN appellation_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_wines_producer_id ON Wines(producer_id);
CREATE INDEX IF NOT EXISTS idx_wines_region_id ON Wines(region_id);
CREATE INDEX IF NOT EXISTS idx_wines_appellation_id ON Wines(appellation_id);

-- Backfill Producers and Regions from existing Wines data
INSERT OR IGNORE INTO Producers (name, country, created_by)
SELECT DISTINCT producer, country, 'migration' FROM Wines
WHERE producer IS NOT NULL AND TRIM(producer) <> '';

UPDATE Wines
SET producer_id = (
    SELECT p.id FROM Producers p
    WHERE p.name = Wines.producer AND (p.country IS NULL OR p.country = Wines.country)
)
WHERE producer_id IS NULL;

INSERT OR IGNORE INTO Regions (name, country, region_type, created_by)
SELECT DISTINCT region, country, 'region', 'migration' FROM Wines
WHERE region IS NOT NULL AND TRIM(region) <> '';

UPDATE Wines
SET region_id = (
    SELECT r.id FROM Regions r
    WHERE r.name = Wines.region AND r.country = Wines.country
)
WHERE region_id IS NULL;

-- Extend Stock with status
ALTER TABLE Stock ADD COLUMN status TEXT CHECK (status IN ('ACTIVE','RESERVED','OUT_OF_STOCK','DISCONTINUED')) DEFAULT 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_stock_status ON Stock(status);

-- Roles and UserRoles (RBAC)
CREATE TABLE IF NOT EXISTS Roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS UserRoles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES Roles(id) ON DELETE RESTRICT
);

-- Activity / Audit log (generic)
CREATE TABLE IF NOT EXISTS ActivityLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES Users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_entity ON ActivityLog(entity_type, entity_id);


