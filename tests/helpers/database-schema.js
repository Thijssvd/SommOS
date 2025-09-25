// Database Schema Helper for Tests
// Creates complete schema matching production database

const fs = require('fs');
const path = require('path');

function getFullSchema() {
    const schemaPath = path.join(__dirname, '../../backend/database/schema.sql');
    return fs.readFileSync(schemaPath, 'utf8');
}

async function setupCompleteDatabase(database) {
    const schema = getFullSchema();
    
    // Execute schema (split by semicolon and filter out empty statements)
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
        const trimmedStatement = statement.trim();
        if (trimmedStatement) {
            try {
                await database.exec(trimmedStatement);
            } catch (error) {
                // Skip view creation errors for tests if tables don't exist yet
                if (!error.message.includes('no such table') && !trimmedStatement.toLowerCase().includes('create view')) {
                    throw error;
                }
            }
        }
    }
}

module.exports = {
    setupCompleteDatabase,
    getFullSchema
};