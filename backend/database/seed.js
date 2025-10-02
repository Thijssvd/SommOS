const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Absolute paths preferred per workspace rules
const DB_PATH = path.join(__dirname, '../../data/sommos.db');
const CSV_PATH = path.join(__dirname, 'example_cellar.csv');

// Category → standardized metadata mapping aligned with import script
const CATEGORY_MAPPING = {
  'Bordeaux Red': { wine_type: 'Red', region: 'Bordeaux', country: 'France' },
  'Bordeaux White': { wine_type: 'White', region: 'Bordeaux', country: 'France' },
  'Burgundy Red': { wine_type: 'Red', region: 'Burgundy', country: 'France' },
  'Burgundy White': { wine_type: 'White', region: 'Burgundy', country: 'France' },
  'Italian Red': { wine_type: 'Red', region: 'Various', country: 'Italy' },
  'Italian White': { wine_type: 'White', region: 'Various', country: 'Italy' },
  'Spanish Red': { wine_type: 'Red', region: 'Various', country: 'Spain' },
  'German White': { wine_type: 'White', region: 'Germany', country: 'Germany' },
  'US Wines': { wine_type: 'Red', region: 'California', country: 'United States' },
  'Champagne & Sparkling': { wine_type: 'Sparkling', region: 'Champagne', country: 'France' },
  'Dessert Wines': { wine_type: 'Dessert', region: 'Various', country: 'Various' }
};

function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length <= 1) return [];
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    // naive CSV split is OK for our provided file (no commas in fields)
    const values = lines[i].split(',');
    if (values.length < 6) continue;
    const record = {
      wine: values[0].trim(),
      category: values[1].trim(),
      vintage: parseInt(values[2].trim(), 10),
      price: parseFloat(values[3].trim()),
      location: values[4].trim(),
      quantity: parseInt(values[5].trim(), 10)
    };
    if (record.wine && !Number.isNaN(record.vintage) && !Number.isNaN(record.quantity)) {
      data.push(record);
    }
  }
  return data;
}

function deriveProducerAndName(fullName) {
  // Borrow simplified logic similar to import-cellar
  if (fullName.startsWith('Château')) {
    return { producer: fullName, name: fullName };
  }
  const parts = fullName.split(' ');
  if (parts.length >= 2) {
    const producer = parts[0] + (parts[1] && parts[1].length < 4 ? ' ' + parts[1] : '');
    return { producer, name: fullName };
  }
  return { producer: fullName, name: fullName };
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function seed() {
  console.log('🌱 Seeding SommOS from example_cellar.csv ...');

  // Preconditions
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Database not found. Run: npm run setup:db');
    process.exit(1);
  }
  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ CSV file not found at:', CSV_PATH);
    process.exit(1);
  }

  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const entries = parseCSV(csv);
  console.log(`   Found ${entries.length} entries`);

  const db = new sqlite3.Database(DB_PATH);

  // idempotency caches
  const wineCache = new Map(); // key: name|producer|region
  const vintageCache = new Map(); // key: wineId|year

  try {
    await run(db, 'BEGIN TRANSACTION');

    let stats = { winesCreated: 0, winesReused: 0, vintagesCreated: 0, vintagesReused: 0, stockUpserts: 0 };

    for (const e of entries) {
      const { producer, name } = deriveProducerAndName(e.wine);
      const mapping = CATEGORY_MAPPING[e.category] || { wine_type: 'Red', region: 'Unknown', country: 'Unknown' };
      const wineKey = `${name}|${producer}|${mapping.region}`;

      // Upsert Wine
      let wineId;
      if (wineCache.has(wineKey)) {
        wineId = wineCache.get(wineKey);
      } else {
        await run(db, `
          INSERT OR IGNORE INTO Wines (name, producer, region, country, wine_type, grape_varieties, food_pairings, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
        `, [name, producer, mapping.region, mapping.country, mapping.wine_type, JSON.stringify([]), JSON.stringify([])]);

        const row = await get(db, `SELECT id FROM Wines WHERE name = ? AND producer = ? AND region = ?`, [name, producer, mapping.region]);
        wineId = row && row.id;
        if (!wineId) throw new Error('Failed to resolve wine id');
        wineCache.set(wineKey, wineId);

        // Detect creation via existence of any row with same key and checking last insert changes is unreliable post-select; treat as reused if already existed
        const existed = await get(db, `SELECT 1 AS ok FROM Wines WHERE id = ?`, [wineId]);
        if (existed) {
          // Heuristic: check if any stock/vintage existed to count reuse; otherwise count create
          const checkVintage = await get(db, `SELECT 1 AS ok FROM Vintages WHERE wine_id = ? LIMIT 1`, [wineId]);
          if (checkVintage) stats.winesReused++; else stats.winesCreated++;
        }
      }

      // Upsert Vintage
      const vintageKey = `${wineId}|${e.vintage}`;
      let vintageId;
      if (vintageCache.has(vintageKey)) {
        vintageId = vintageCache.get(vintageKey);
      } else {
        await run(db, `
          INSERT OR IGNORE INTO Vintages (wine_id, year, updated_at)
          VALUES (?, ?, strftime('%s','now'))
        `, [wineId, e.vintage]);
        const vrow = await get(db, `SELECT id FROM Vintages WHERE wine_id = ? AND year = ?`, [wineId, e.vintage]);
        vintageId = vrow && vrow.id;
        if (!vintageId) throw new Error('Failed to resolve vintage id');
        vintageCache.set(vintageKey, vintageId);

        const existed = await get(db, `SELECT 1 AS ok FROM Stock WHERE vintage_id = ? LIMIT 1`, [vintageId]);
        if (existed) stats.vintagesReused++; else stats.vintagesCreated++;
      }

      // Upsert Stock (idempotent): if stock row exists for (vintage, location), set fields to latest from CSV; do NOT additive increment
      const existingStock = await get(db, `
        SELECT id FROM Stock WHERE vintage_id = ? AND location = ?
      `, [vintageId, e.location]);

      if (existingStock && existingStock.id) {
        await run(db, `
          UPDATE Stock
          SET quantity = ?, cost_per_bottle = ?, current_value = ?, storage_conditions = ?, updated_at = strftime('%s','now'), updated_by = 'seed', origin = 'seed.csv'
          WHERE id = ?
        `, [e.quantity, e.price, e.price, JSON.stringify({}), existingStock.id]);
      } else {
        await run(db, `
          INSERT INTO Stock (vintage_id, location, quantity, cost_per_bottle, current_value, storage_conditions, updated_at, updated_by, origin)
          VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'), 'seed', 'seed.csv')
        `, [vintageId, e.location, e.quantity, e.price, e.price, JSON.stringify({})]);

        // Record ledger IN transaction
        await run(db, `
          INSERT INTO Ledger (vintage_id, location, transaction_type, quantity, unit_cost, total_cost, reference_id, notes, created_by)
          VALUES (?, ?, 'IN', ?, ?, ? * ?, 'SEED', 'Initial stock from seed', 'seed')
        `, [vintageId, e.location, e.quantity, e.price, e.quantity, e.price]);
      }
      stats.stockUpserts++;
    }

    await run(db, 'COMMIT');
    console.log(`✅ Seed complete. Wines: +${stats.winesCreated}/${stats.winesReused} reused, Vintages: +${stats.vintagesCreated}/${stats.vintagesReused} reused, Stock upserts: ${stats.stockUpserts}`);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    try { await run(db, 'ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };

