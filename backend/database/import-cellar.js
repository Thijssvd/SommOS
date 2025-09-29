const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '../../data/sommos.db');
const csvPath = path.join(__dirname, 'template_cellar.csv');

// Wine type mapping from category to standardized wine types
const categoryMapping = {
  'Bordeaux Red': { wine_type: 'Red', region: 'Bordeaux', country: 'France' },
  'Bordeaux White': { wine_type: 'White', region: 'Bordeaux', country: 'France' },
  'Burgundy Red': { wine_type: 'Red', region: 'Burgundy', country: 'France' },
  'Burgundy White': { wine_type: 'White', region: 'Burgundy', country: 'France' },
  'Italian Red': { wine_type: 'Red', region: 'Various', country: 'Italy' },
  'Italian White': { wine_type: 'White', region: 'Various', country: 'Italy' },
  'Spanish Red': { wine_type: 'Red', region: 'Various', country: 'Spain' },
  'German White': { wine_type: 'White', region: 'Various', country: 'Germany' },
  'US Wines': { wine_type: 'Red', region: 'California', country: 'United States' },
  'Champagne & Sparkling': { wine_type: 'Sparkling', region: 'Champagne', country: 'France' },
  'Dessert Wines': { wine_type: 'Dessert', region: 'Various', country: 'Various' }
};

// Parse wine name to extract producer and wine name
function parseWineName(fullName) {
  // Common patterns for wine names
  const patterns = [
    // Château patterns
    /^(Château\s+[^,]+)/i,
    // Producer + Wine name patterns
    /^([^,]+?)\s+((?:Vintage\s+)?[A-Z][^,]*)/,
    // Simple names
    /^(.+)/
  ];

  for (const pattern of patterns) {
    const match = fullName.match(pattern);
    if (match) {
      if (fullName.startsWith('Château')) {
        return {
          producer: match[1],
          name: match[1]
        };
      } else {
        // Try to split producer and wine name
        const parts = fullName.split(' ');
        if (parts.length >= 2) {
          return {
            producer: parts[0] + (parts[1] && parts[1].length < 4 ? ' ' + parts[1] : ''),
            name: fullName
          };
        }
        return {
          producer: fullName,
          name: fullName
        };
      }
    }
  }
  
  return {
    producer: fullName,
    name: fullName
  };
}

// Parse CSV data
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length >= 6) {
      data.push({
        wine: values[0].trim(),
        category: values[1].trim(),
        vintage: parseInt(values[2].trim()),
        price: parseFloat(values[3].trim()),
        location: values[4].trim(),
        quantity: parseInt(values[5].trim())
      });
    }
  }
  
  return data;
}

// Import data into database
async function importData() {
  console.log('🍷 Starting SommOS Cellar Import...');
  
  // Check if files exist
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found. Please run npm run setup:db first');
    process.exit(1);
  }
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found at:', csvPath);
    process.exit(1);
  }

  // Read CSV file
  console.log('📖 Reading CSV file...');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const wines = parseCSV(csvContent);
  console.log(`   Found ${wines.length} wine entries`);

  // Open database
  const db = new sqlite3.Database(dbPath);
  
  // Statistics
  let stats = {
    processed: 0,
    winesCreated: 0,
    winesReused: 0,
    vintagesCreated: 0,
    vintagesReused: 0,
    stockRecords: 0,
    errors: []
  };

  // Cache for existing wines and vintages
  const wineCache = new Map();
  const vintageCache = new Map();

  try {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        // Begin transaction
        db.run('BEGIN TRANSACTION');

        console.log('🔄 Processing wine entries...');

        let processed = 0;
        const processWine = (index) => {
          if (index >= wines.length) {
            // Commit transaction and finish
            db.run('COMMIT', (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
            return;
          }

          const wine = wines[index];
          const { producer, name } = parseWineName(wine.wine);
          const mapping = categoryMapping[wine.category] || { 
            wine_type: 'Red', 
            region: 'Unknown', 
            country: 'Unknown' 
          };

          const wineKey = `${name}|${producer}|${mapping.region}`;
          
          // Check if wine exists in cache
          if (wineCache.has(wineKey)) {
            processVintage(index, wineCache.get(wineKey));
          } else {
            // Insert or find wine
            const stmt = db.prepare(`
              INSERT OR IGNORE INTO Wines (name, producer, region, country, wine_type, grape_varieties, food_pairings)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([
              name,
              producer,
              mapping.region,
              mapping.country,
              mapping.wine_type,
              JSON.stringify([]), // Empty grape varieties for now
              JSON.stringify([])  // Empty food pairings for now
            ], function(err) {
              if (err) {
                stats.errors.push(`Wine insert error: ${err.message}`);
                processWine(index + 1);
                return;
              }

              // Get the wine ID
              db.get(
                'SELECT id FROM Wines WHERE name = ? AND producer = ? AND region = ?',
                [name, producer, mapping.region],
                (err, row) => {
                  if (err) {
                    stats.errors.push(`Wine select error: ${err.message}`);
                    processWine(index + 1);
                    return;
                  }

                  const wineId = row.id;
                  wineCache.set(wineKey, wineId);
                  
                  if (this.changes > 0) {
                    stats.winesCreated++;
                  } else {
                    stats.winesReused++;
                  }

                  processVintage(index, wineId);
                }
              );
            });
            stmt.finalize();
          }
        };

        const processVintage = (index, wineId) => {
          const wine = wines[index];
          const vintageKey = `${wineId}|${wine.vintage}`;

          if (vintageCache.has(vintageKey)) {
            processStock(index, vintageCache.get(vintageKey));
          } else {
            // Insert or find vintage
            const stmt = db.prepare(`
              INSERT OR IGNORE INTO Vintages (wine_id, year)
              VALUES (?, ?)
            `);
            
            stmt.run([wineId, wine.vintage], function(err) {
              if (err) {
                stats.errors.push(`Vintage insert error: ${err.message}`);
                processWine(index + 1);
                return;
              }

              // Get the vintage ID
              db.get(
                'SELECT id FROM Vintages WHERE wine_id = ? AND year = ?',
                [wineId, wine.vintage],
                (err, row) => {
                  if (err) {
                    stats.errors.push(`Vintage select error: ${err.message}`);
                    processWine(index + 1);
                    return;
                  }

                  const vintageId = row.id;
                  vintageCache.set(vintageKey, vintageId);
                  
                  if (this.changes > 0) {
                    stats.vintagesCreated++;
                  } else {
                    stats.vintagesReused++;
                  }

                  processStock(index, vintageId);
                }
              );
            });
            stmt.finalize();
          }
        };

        const processStock = (index, vintageId) => {
          const wine = wines[index];

          // Check if stock record exists and update, otherwise insert
          db.get(
            'SELECT id, quantity FROM Stock WHERE vintage_id = ? AND location = ?',
            [vintageId, wine.location],
            (err, existingStock) => {
              if (err) {
                stats.errors.push(`Stock select error: ${err.message}`);
                processWine(index + 1);
                return;
              }

              if (existingStock) {
                // Update existing stock by adding quantities
                const newQuantity = existingStock.quantity + wine.quantity;
                db.run(
                  'UPDATE Stock SET quantity = ?, current_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                  [newQuantity, wine.price, existingStock.id],
                  (err) => {
                    if (err) {
                      stats.errors.push(`Stock update error: ${err.message}`);
                    } else {
                      stats.stockRecords++;
                    }
                    stats.processed++;
                    
                    if (stats.processed % 50 === 0) {
                      console.log(`   Processed ${stats.processed}/${wines.length} entries...`);
                    }
                    
                    processWine(index + 1);
                  }
                );
              } else {
                // Insert new stock record
                const stmt = db.prepare(`
                  INSERT INTO Stock (vintage_id, location, quantity, cost_per_bottle, current_value)
                  VALUES (?, ?, ?, ?, ?)
                `);
                
                stmt.run([
                  vintageId,
                  wine.location,
                  wine.quantity,
                  wine.price,
                  wine.price
                ], function(err) {
                  if (err) {
                    stats.errors.push(`Stock insert error: ${err.message}`);
                  } else {
                    stats.stockRecords++;
                  }
                  stats.processed++;
                  
                  if (stats.processed % 50 === 0) {
                    console.log(`   Processed ${stats.processed}/${wines.length} entries...`);
                  }
                  
                  processWine(index + 1);
                });
                stmt.finalize();
              }
            }
          );
        };

        // Start processing
        processWine(0);
      });
    });

  } catch (error) {
    console.error('❌ Error during import:', error.message);
    db.run('ROLLBACK');
    db.close();
    process.exit(1);
  }

  // Close database
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err.message);
    } else {
      console.log('\n✅ Import completed successfully!');
      console.log('\n📊 Import Statistics:');
      console.log(`   Entries processed: ${stats.processed}`);
      console.log(`   Wines created: ${stats.winesCreated}`);
      console.log(`   Wines reused: ${stats.winesReused}`);
      console.log(`   Vintages created: ${stats.vintagesCreated}`);
      console.log(`   Vintages reused: ${stats.vintagesReused}`);
      console.log(`   Stock records: ${stats.stockRecords}`);
      
      if (stats.errors.length > 0) {
        console.log(`\n⚠️  Errors encountered (${stats.errors.length}):`);
        stats.errors.forEach(error => console.log(`   ${error}`));
      }
    }
  });
}

// Run the import
if (require.main === module) {
  importData().catch(error => {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  });
}

module.exports = { importData, parseWineName, parseCSV };
