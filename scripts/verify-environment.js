#!/usr/bin/env node

/**
 * SommOS Environment Verification
 * Checks that environment variables are properly configured
 */

require('dotenv').config();

const { refreshConfig } = require('../backend/config/env');

console.log('🔍 SommOS Environment Verification');
console.log('==================================');
console.log('');

let envConfig;

try {
    envConfig = refreshConfig();
    console.log('✅ Environment configuration loaded successfully');
    console.log('');
} catch (error) {
    console.error('❌ Failed to validate environment configuration');
    console.error(error.message);
    process.exit(1);
}

const checks = [
    {
        name: 'PORT',
        value: envConfig.port,
        required: false,
        default: '3001'
    },
    {
        name: 'NODE_ENV',
        value: envConfig.nodeEnv,
        required: false,
        default: 'development'
    },
    {
        name: 'OPEN_METEO_BASE',
        value: envConfig.openMeteo.baseUrl,
        required: true,
        default: 'https://archive-api.open-meteo.com/v1/archive'
    },
    {
        name: 'JWT_SECRET',
        value: envConfig.auth.jwtSecret,
        required: true,
        sensitive: true
    },
    {
        name: 'SESSION_SECRET',
        value: envConfig.auth.sessionSecret,
        required: true,
        sensitive: true
    },
    {
        name: 'OPENAI_API_KEY',
        value: envConfig.openAI.apiKey,
        required: false,
        sensitive: true,
        service: 'AI-powered vintage summaries'
    },
    {
        name: 'WEATHER_API_KEY',
        value: envConfig.services.weather.apiKey,
        required: false,
        sensitive: true,
        service: 'Enhanced weather data'
    },
    {
        name: 'DATABASE_PATH',
        value: envConfig.database.path,
        required: false,
        default: './data/sommos.db'
    }
];

let allRequired = true;
let optionalFeatures = [];

checks.forEach(check => {
    const hasValue = typeof check.value === 'number'
        ? Number.isFinite(check.value)
        : Boolean(check.value && check.value.length > 0);
    const displayValue = check.sensitive
        ? (hasValue ? '***SET***' : 'NOT SET')
        : (hasValue ? String(check.value) : (check.default || 'NOT SET'));
    
    if (check.required) {
        if (hasValue) {
            console.log(`✅ ${check.name}: ${displayValue}`);
        } else {
            console.log(`❌ ${check.name}: REQUIRED BUT NOT SET`);
            allRequired = false;
        }
    } else {
        if (hasValue) {
            console.log(`✅ ${check.name}: ${displayValue}`);
            if (check.service) {
                optionalFeatures.push(check.service);
            }
        } else {
            console.log(`⚪ ${check.name}: ${displayValue} (optional)`);
        }
    }
});

console.log('');
console.log('📋 Status Summary:');
console.log('==================');

if (allRequired) {
    console.log('✅ All required environment variables are configured');
} else {
    console.log('❌ Some required environment variables are missing');
    console.log('   Run: npm run generate:secrets');
    console.log('   Then add the values to your .env file');
}

if (optionalFeatures.length > 0) {
    console.log('✨ Optional features enabled:');
    optionalFeatures.forEach(feature => {
        console.log(`   - ${feature}`);
    });
} else {
    console.log('⚪ No optional API keys configured');
    console.log('   Add API keys to .env for enhanced features:');
    console.log('   - OPENAI_API_KEY for AI-powered summaries');
    console.log('   - WEATHER_API_KEY for enhanced weather data');
}

console.log('');
console.log('🚀 Ready to start SommOS:', allRequired ? 'YES' : 'NO');

if (allRequired) {
    console.log('   Run: npm start');
} else {
    console.log('   Fix missing variables first');
}

console.log('');
console.log('📚 For setup help: docs/environment_setup.md');

process.exit(allRequired ? 0 : 1);