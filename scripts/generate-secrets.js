#!/usr/bin/env node

/**
 * SommOS Secrets Generator
 * Generates secure secrets for JWT, sessions, and other security purposes
 */

const crypto = require('crypto');

console.log('🔐 SommOS Secrets Generator');
console.log('==============================');
console.log('');

// Generate JWT Secret (64 bytes)
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('JWT_SECRET (for authentication):');
console.log(jwtSecret);
console.log('');

// Generate Session Secret (32 bytes)
const sessionSecret = crypto.randomBytes(32).toString('hex');
console.log('SESSION_SECRET (for express sessions):');
console.log(sessionSecret);
console.log('');

// Generate API Key (for internal services)
const apiKey = crypto.randomBytes(32).toString('base64url');
console.log('INTERNAL_API_KEY (optional, for service-to-service auth):');
console.log(apiKey);
console.log('');

console.log('📋 Copy these values to your .env file:');
console.log('');
console.log('JWT_SECRET=' + jwtSecret);
console.log('SESSION_SECRET=' + sessionSecret);
console.log('# INTERNAL_API_KEY=' + apiKey);
console.log('');
console.log('⚠️  Keep these secrets secure and never commit them to git!');