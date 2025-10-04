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
        name: 'DEEPSEEK_API_KEY',
        value: envConfig.deepSeek.apiKey,
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

/**
 * Check if a secret contains insecure placeholder patterns
 * @param {string} secret - The secret to check
 * @returns {boolean} True if the secret appears to be a placeholder
 */
function isPlaceholderSecret(secret) {
    if (!secret || typeof secret !== 'string') {
        return true;
    }
    
    const placeholderPatterns = [
        'dev-',
        'change-me',
        'placeholder',
        'example',
        'test-',
        'your-',
        'insert-',
        'replace-'
    ];
    
    const lowerSecret = secret.toLowerCase();
    return placeholderPatterns.some(pattern => lowerSecret.includes(pattern));
}

let allRequired = true;
let optionalFeatures = [];
let securityWarnings = [];

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
            
            // Check for placeholder secrets in production
            if (check.sensitive && envConfig.nodeEnv === 'production') {
                if (isPlaceholderSecret(check.value)) {
                    console.log(`   ⚠️  WARNING: Placeholder secret detected in production!`);
                    securityWarnings.push(`${check.name} contains a placeholder value`);
                }
            }
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

// Add feature flags status
console.log('');
console.log('🚩 Feature Flags:');
console.log('==================');
console.log(`   External Calls: ${envConfig.features.disableExternalCalls ? '❌ disabled' : '✅ enabled'}`);
console.log(`   Auth Bypass: ${envConfig.features.authDisabled ? '⚠️  ENABLED (INSECURE!)' : '✅ disabled'}`);

if (envConfig.features.authDisabled) {
    securityWarnings.push('Authentication bypass is enabled');
    if (envConfig.nodeEnv === 'production') {
        console.log('   ❌ CRITICAL: Auth bypass is NOT allowed in production!');
    }
}

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
    console.log('   - DEEPSEEK_API_KEY for AI-powered summaries');
    console.log('   - WEATHER_API_KEY for enhanced weather data');
}

// Security warnings summary
if (securityWarnings.length > 0) {
    console.log('');
    console.log('⚠️  SECURITY WARNINGS:');
    console.log('====================');
    securityWarnings.forEach(warning => {
        console.log(`   ⚠️  ${warning}`);
    });
    if (envConfig.nodeEnv === 'production') {
        console.log('');
        console.log('   ❌ Production deployment is NOT SAFE with these warnings!');
        console.log('   🔧 Run: npm run generate:secrets');
        console.log('   🔧 Update your .env file with secure values');
    }
}

console.log('');
const isProductionReady = allRequired && (envConfig.nodeEnv !== 'production' || securityWarnings.length === 0);
console.log('🚀 Ready to start SommOS:', isProductionReady ? 'YES' : 'NO');

if (allRequired && securityWarnings.length === 0) {
    console.log('   Run: npm start');
} else if (!allRequired) {
    console.log('   Fix missing required variables first');
} else if (securityWarnings.length > 0) {
    console.log('   Fix security warnings before starting');
    if (envConfig.nodeEnv === 'production') {
        console.log('   Production mode requires secure configuration');
    }
}

console.log('');
console.log('📚 For setup help: docs/environment_setup.md');

process.exit(isProductionReady ? 0 : 1);
