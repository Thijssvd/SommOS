'use strict';
const fs = require('fs');
const readline = require('readline');
const { connect } = require('./connection');

/**
 * Usage:
 *   node backend/database/import-cellar.js /path/to/cellar.csv
 * CSV header required:
 *   label,grape,region,year,qty,location
 */
async function run() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node backend/database/import-cellar.js <csv>');
    process.exit(2);
  }
  if (!fs.existsSync(file)) {
    console.error('file not found:', file);
    process.exit(2);
  }

  const db = connect();
  const insertWine = db.prepare('INSERT INTO wines (label, grape, region) VALUES (?,?,?)');
  const getWineId  = db.prepare('SELECT id FROM wines WHERE label = ?');
  const insertVintage = db.prepare('INSERT OR IGNORE INTO vintages (wine_id, year) VALUES (?,?)');
  const getVintage = db.prepare('SELECT id FROM vintages WHERE wine_id = ? AND year = ?');
  const insertStock = db.prepare('INSERT INTO stock (vintage_id, qty, location) VALUES (?,?,?)');

  let inserted = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });

  // Read header
  const iter = rl[Symbol.asyncIterator]();
  const first = await iter.next();
  if (first.done) { console.error('empty file'); process.exit(2); }
  const header = first.value.split(',').map(s => s.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const need = ['label','grape','region','year','qty','location'];
  for (const n of need) if (idx(n) === -1) { console.error('missing column in header:', n); process.exit(2); }

  const tx = db.transaction((rows) => {
    for (const row of rows) {
      const fields = row.split(',').map(s => s.trim());
      const label = fields[idx('label')];
      const grape = fields[idx('grape')];
      const region = fields[idx('region')];
      const year = Number(fields[idx('year')]);
      const qty = parseInt(fields[idx('qty')], 10) || 0;
      const location = fields[idx('location')];

      if (!label || !Number.isInteger(year) || year < 1900 || qty < 0) continue;

      let w = getWineId.get(label);
      if (!w) {
        insertWine.run(label, grape || null, region || null);
        w = getWineId.get(label);
      }

      insertVintage.run(w.id, year);
      const vint = getVintage.get(w.id, year);
      insertStock.run(vint.id, qty, location || null);
      inserted++;
    }
  });

  const rows = [];
  for await (const line of iter) {
    if (!line || /^\s*$/.test(line)) continue;
    rows.push(line);
    if (rows.length >= 1000) { tx(rows.splice(0, rows.length)); }
  }
  if (rows.length) tx(rows);

  rl.close();
  console.log(JSON.stringify({ importedRows: inserted }, null, 2));
}

if (require.main === module) run();
module.exports = { run };
