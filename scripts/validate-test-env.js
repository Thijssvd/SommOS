#!/usr/bin/env node
/**
 * Test Environment Validation Script
 * Validates that all required environment variables are properly configured for testing
 */

const { getConfig } = require('../backend/config/env');

function validateTestEnvironment() {
    console.log('🔍 Validating test environment configuration...\n');

    try {
        const config = getConfig();

        // Validate critical test environment variables
        const requiredVars = {
            'NODE_ENV': config.nodeEnv,
            'JWT_SECRET': config.auth.jwtSecret,
            'SESSION_SECRET': config.auth.sessionSecret,
            'OPEN_METEO_BASE': config.openMeteo.baseUrl,
            'DATABASE_PATH': config.database.path
        };

        let allValid = true;

        for (const [varName, value] of Object.entries(requiredVars)) {
            if (value) {
                console.log(`✅ ${varName}: Configured`);
            } else {
                console.log(`❌ ${varName}: Missing`);
                allValid = false;
            }
        }

        console.log('\n📊 Configuration Summary:');
        console.log(`Node Environment: ${config.nodeEnv}`);
        console.log(`Production Mode: ${config.isProduction ? 'Yes' : 'No'}`);
        console.log(`Database Path: ${config.database.path || 'Default'}`);

        if (allValid) {
            console.log('\n🎉 Test environment configuration is valid!');
            console.log('✅ All required variables are configured');
            console.log('🚀 Ready to run tests');
            return true;
        } else {
            console.log('\n❌ Test environment configuration failed!');
            console.log('🔧 Please check the following:');
            console.log('1. Ensure all required environment variables are set');
            console.log('2. Check that tests/setup-env.js has proper configuration');
            console.log('3. Verify JWT_SECRET and SESSION_SECRET are at least 32 characters');
            return false;
        }

    } catch (error) {
        console.error('\n💥 Environment validation failed:', error.message);
        console.error('\n🔧 Troubleshooting steps:');
        console.error('1. Check that .env file exists and has proper values');
        console.error('2. Verify JWT_SECRET and SESSION_SECRET are set');
        console.error('3. Ensure database path is accessible');
        return false;
    }
}

if (require.main === module) {
    const isValid = validateTestEnvironment();
    process.exit(isValid ? 0 : 1);
}

module.exports = { validateTestEnvironment };
