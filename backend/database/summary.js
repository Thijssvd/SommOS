'use strict';
const path = require('path');
const { connect } = require('./connection');

function dbPath() {
  return process.env.DB_DIR ? path.join(process.env.DB_DIR, 'somm.db')
                            : path.join(process.cwd(), 'data', 'somm.db');
}

function run() {
  const db = connect();
  const q = (sql) => db.prepare(sql).get();

  const wines   = q('SELECT COUNT(*) AS c FROM wines').c || 0;
  const vint    = q('SELECT COUNT(*) AS c FROM vintages').c || 0;
  const stock   = q('SELECT COUNT(*) AS c FROM stock').c || 0;
  const sups    = q('SELECT COUNT(*) AS c FROM suppliers').c || 0;
  const prices  = q('SELECT COUNT(*) AS c FROM pricebook').c || 0;

  console.log(JSON.stringify({
    db: dbPath(),
    counts: { wines, vintages: vint, stock, suppliers: sups, pricebook: prices }
  }, null, 2));
}

if (require.main === module) run();
module.exports = { run };
