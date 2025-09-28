-- SommOS baseline schema with constraints
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS wines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  grape TEXT,
  region TEXT
);

CREATE TABLE IF NOT EXISTS vintages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wine_id INTEGER NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  UNIQUE(wine_id, year)
);

CREATE TABLE IF NOT EXISTS stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vintage_id INTEGER NOT NULL REFERENCES vintages(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  location TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country TEXT
);

CREATE TABLE IF NOT EXISTS pricebook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wine_id INTEGER NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  price REAL NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricebook_pair ON pricebook(wine_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_vintages_wine ON vintages(wine_id);
CREATE INDEX IF NOT EXISTS idx_stock_vintage ON stock(vintage_id);
