const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/sommos.db');

function runSummary() {
  console.log('🍷 SommOS Yacht Cellar Inventory Summary\n');

  const db = new sqlite3.Database(dbPath);

  // Total inventory overview
  db.get(`
    SELECT 
      COUNT(DISTINCT w.id) as unique_wines,
      COUNT(DISTINCT v.id) as unique_vintages,
      SUM(s.quantity) as total_bottles,
      ROUND(SUM(s.quantity * s.cost_per_bottle), 2) as total_value,
      ROUND(AVG(s.cost_per_bottle), 2) as avg_bottle_price
    FROM Stock s 
    JOIN Vintages v ON s.vintage_id = v.id 
    JOIN Wines w ON v.wine_id = w.id
  `, (err, row) => {
    if (err) {
      console.error('Error:', err.message);
      return;
    }

    console.log('📊 Overall Statistics:');
    console.log(`   Unique Wines: ${row.unique_wines}`);
    console.log(`   Unique Vintages: ${row.unique_vintages}`);
    console.log(`   Total Bottles: ${row.total_bottles}`);
    console.log(`   Total Value: $${row.total_value.toLocaleString()}`);
    console.log(`   Average Bottle Price: $${row.avg_bottle_price}\n`);

    // Wine types distribution
    db.all(`
      SELECT 
        w.wine_type,
        COUNT(s.id) as stock_records,
        SUM(s.quantity) as bottles,
        ROUND(SUM(s.quantity * s.cost_per_bottle), 2) as value
      FROM Stock s 
      JOIN Vintages v ON s.vintage_id = v.id 
      JOIN Wines w ON v.wine_id = w.id
      GROUP BY w.wine_type
      ORDER BY bottles DESC
    `, (err, rows) => {
      if (err) {
        console.error('Error:', err.message);
        return;
      }

      console.log('🍇 Wine Types Distribution:');
      rows.forEach(row => {
        console.log(`   ${row.wine_type}: ${row.bottles} bottles ($${row.value.toLocaleString()})`);
      });
      console.log();

      // Most valuable wines
      db.all(`
        SELECT 
          w.name,
          v.year,
          s.cost_per_bottle,
          s.quantity,
          ROUND(s.quantity * s.cost_per_bottle, 2) as total_value
        FROM Stock s 
        JOIN Vintages v ON s.vintage_id = v.id 
        JOIN Wines w ON v.wine_id = w.id
        ORDER BY s.cost_per_bottle DESC
        LIMIT 10
      `, (err, rows) => {
        if (err) {
          console.error('Error:', err.message);
          return;
        }

        console.log('💎 Most Expensive Bottles:');
        rows.forEach((row, index) => {
          console.log(`   ${index + 1}. ${row.name} ${row.year} - $${row.cost_per_bottle.toLocaleString()} (${row.quantity} bottles)`);
        });
        console.log();

        // Location distribution
        db.all(`
          SELECT 
            s.location,
            COUNT(*) as stock_records,
            SUM(s.quantity) as bottles,
            ROUND(SUM(s.quantity * s.cost_per_bottle), 2) as value
          FROM Stock s 
          GROUP BY s.location
          ORDER BY bottles DESC
        `, (err, rows) => {
          if (err) {
            console.error('Error:', err.message);
            return;
          }

          console.log('🏛️ Storage Locations:');
          rows.forEach(row => {
            console.log(`   ${row.location}: ${row.bottles} bottles ($${row.value.toLocaleString()})`);
          });
          console.log();

          // Vintage range
          db.get(`
            SELECT 
              MIN(v.year) as oldest_vintage,
              MAX(v.year) as newest_vintage,
              COUNT(DISTINCT v.year) as vintage_years
            FROM Vintages v
            JOIN Stock s ON s.vintage_id = v.id
          `, (err, row) => {
            if (err) {
              console.error('Error:', err.message);
              return;
            }

            console.log('📅 Vintage Information:');
            console.log(`   Oldest Vintage: ${row.oldest_vintage}`);
            console.log(`   Newest Vintage: ${row.newest_vintage}`);
            console.log(`   Vintage Years Represented: ${row.vintage_years}\n`);

            console.log('✅ Summary complete!');
            
            db.close();
          });
        });
      });
    });
  });
}

if (require.main === module) {
  runSummary();
}

module.exports = { runSummary };