const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, '../../data/sommos.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory:', dataDir);
}

// Create database and set up schema
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database at:', dbPath);
});

// Read and execute schema
fs.readFile(schemaPath, 'utf8', (err, schema) => {
  if (err) {
    console.error('Error reading schema file:', err.message);
    process.exit(1);
  }

  // Execute schema (split by semicolon and filter out empty statements)
  const statements = schema.split(';').filter(stmt => stmt.trim());
  
  db.serialize(() => {
    console.log('Setting up database schema...');
    
    statements.forEach((statement, index) => {
      const trimmedStatement = statement.trim();
      if (trimmedStatement) {
        db.run(trimmedStatement, (err) => {
          if (err) {
            console.error(`Error executing statement ${index + 1}:`, err.message);
            console.error('Statement:', trimmedStatement);
          } else {
            console.log(`✓ Executed statement ${index + 1}`);
          }
        });
      }
    });

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('✓ Database setup complete!');
        console.log('Database location:', dbPath);
      }
    });
  });
});