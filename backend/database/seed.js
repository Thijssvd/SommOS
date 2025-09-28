'use strict';
const { connect } = require('./connection');

function run(){
  const db = connect();
  const tx = db.transaction(() => {
    const w = db.prepare('INSERT INTO wines (label, grape, region) VALUES (?,?,?)');
    const v = db.prepare('INSERT INTO vintages (wine_id, year) VALUES (?,?)');
    const s = db.prepare('INSERT INTO stock (vintage_id, qty, location) VALUES (?,?,?)');
    const sup = db.prepare('INSERT INTO suppliers (name, country) VALUES (?,?)');
    const pb = db.prepare('INSERT INTO pricebook (wine_id, supplier_id, price, currency) VALUES (?,?,?,?)');

    w.run('Tuscany Sangiovese','Sangiovese','Tuscany');
    w.run('Napa Cabernet','Cabernet Sauvignon','Napa');
    const rows = db.prepare('SELECT id,label FROM wines').all();

    const idByLabel = Object.fromEntries(rows.map(r=>[r.label, r.id]));
    v.run(idByLabel['Tuscany Sangiovese'], 2019);
    v.run(idByLabel['Napa Cabernet'], 2018);

    const vint = db.prepare('SELECT id, wine_id FROM vintages').all();
    const vs = Object.fromEntries(vint.map(r=>[r.wine_id, r.id]));
    s.run(vs[idByLabel['Tuscany Sangiovese']], 24, 'Cellar A');
    s.run(vs[idByLabel['Napa Cabernet']], 12, 'Cellar B');

    sup.run('Acme Wines','NL');
    sup.run('Global Vines','FR');
    const sups = db.prepare('SELECT id,name FROM suppliers').all();
    const sid = Object.fromEntries(sups.map(r=>[r.name, r.id]));

    pb.run(idByLabel['Tuscany Sangiovese'], sid['Acme Wines'], 15.5, 'EUR');
    pb.run(idByLabel['Napa Cabernet'], sid['Global Vines'], 32.0, 'EUR');
  });
  tx();
  console.log('[db] seed inserted');
}

if (require.main === module) {
  run();
}
module.exports = { run };
