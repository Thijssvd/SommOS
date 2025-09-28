'use strict';
const fs = require('fs');
const path = require('path');
const { connect } = require('./connection');

function run(){
  const db = connect();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(sql);
  console.log('[db] schema applied');
}

if (require.main === module) {
  run();
}

module.exports = { run };
