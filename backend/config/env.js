const path = require('path');
const { config: loadEnv } = require('dotenv');
const { z } = require('zod');

const packageJson = require('../../package.json');


const DEFAULT_OPEN_METEO_BASE = 'https://archive-api.open-meteo.com/v1/archive';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test'], {
        required_error: 'NODE_ENV is required',
        invalid_type_error: 'NODE_ENV must be one of: development, production, test'
    }),
    PORT: z.coerce.number({ invalid_type_error: 'PORT must be a number' })
        .int('PORT must be an integer')
        .min(0, 'PORT must be greater than or equal to 0')
        .max(65535, 'PORT must be less than 65536')
        .default(3001),
    OPEN_METEO_BASE: z.string({ required_error: 'OPEN_METEO_BASE is required' })
        .trim()
        .url('OPEN_METEO_BASE must be a valid URL'),
    // Prefer DEEPSEEK_API_KEY (primary), fallback OPENAI_API_KEY for legacy
    DEEPSEEK_API_KEY: z.string().trim().optional(),
    OPENAI_API_KEY: z.string().trim().optional(),
    SOMMOS_DISABLE_EXTERNAL_CALLS: z.enum(['true', 'false']).optional(),
    // Allow disabling auth globally (use with caution in production)
    SOMMOS_AUTH_DISABLED: z.enum(['true', 'false']).optional(),
    DATABASE_PATH: z.string().trim().min(1).optional(),
    JWT_SECRET: z.string({ required_error: 'JWT_SECRET is required' })
        .trim()
        .min(32, 'JWT_SECRET must be at least 32 characters long'),
    SESSION_SECRET: z.string({ required_error: 'SESSION_SECRET is required' })
        .trim()
        .min(32, 'SESSION_SECRET must be at least 32 characters long'),
    WEATHER_API_KEY: z.string().trim().optional(),
    PERFORMANCE_TEST_DATASET_SIZE: z
        .coerce
        .number({ invalid_type_error: 'PERFORMANCE_TEST_DATASET_SIZE must be a number' })
        .int('PERFORMANCE_TEST_DATASET_SIZE must be an integer')
        .positive('PERFORMANCE_TEST_DATASET_SIZE must be greater than zero')
        .optional(),
});

let cachedConfig;

function applyDefaults(rawEnv) {
    const withDefaults = { ...rawEnv };

    // NODE_ENV is now required, so we don't set a default here
    // The validation will catch if it's missing

    if (!withDefaults.PORT) {
        withDefaults.PORT = '3001';
    }

    if (!withDefaults.OPEN_METEO_BASE) {
        if (withDefaults.NODE_ENV === 'production') {
            throw new Error('OPEN_METEO_BASE is required in production environments.');
        }

        withDefaults.OPEN_METEO_BASE = DEFAULT_OPEN_METEO_BASE;
    }

    return withDefaults;
}

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

/**
 * Enforce runtime security guards for production environments
 * @param {Object} parsed - Validated environment configuration
 * @throws {Error} If security requirements are not met in production
 */
function enforceRuntimeGuards(parsed) {
    const isProduction = parsed.NODE_ENV === 'production';
    
    if (!isProduction) {
        // Only enforce strict checks in production
        return;
    }
    
    // 1. Authentication bypass must be disabled in production
    if (parsed.SOMMOS_AUTH_DISABLED === 'true') {
        throw new Error(
            'CRITICAL SECURITY ERROR: Authentication bypass (SOMMOS_AUTH_DISABLED=true) is not allowed in production environment. ' +
            'Remove or set to false in your production .env file.'
        );
    }
    
    // 2. Secrets must not contain placeholder values
    if (isPlaceholderSecret(parsed.JWT_SECRET)) {
        throw new Error(
            'CRITICAL SECURITY ERROR: JWT_SECRET contains a placeholder value. ' +
            'Generate secure secrets by running: npm run generate:secrets'
        );
    }
    
    if (isPlaceholderSecret(parsed.SESSION_SECRET)) {
        throw new Error(
            'CRITICAL SECURITY ERROR: SESSION_SECRET contains a placeholder value. ' +
            'Generate secure secrets by running: npm run generate:secrets'
        );
    }
    
    // 3. JWT_SECRET and SESSION_SECRET must be different
    if (parsed.JWT_SECRET === parsed.SESSION_SECRET) {
        throw new Error(
            'CRITICAL SECURITY ERROR: JWT_SECRET and SESSION_SECRET must be different values in production. ' +
            'Generate unique secrets by running: npm run generate:secrets'
        );
    }
    
    // 4. Secrets must meet minimum entropy requirements
    if (parsed.JWT_SECRET.length < 32) {
        throw new Error(
            'CRITICAL SECURITY ERROR: JWT_SECRET must be at least 32 characters long in production.'
        );
    }

    if (parsed.SESSION_SECRET.length < 32) {
        throw new Error(
            'CRITICAL SECURITY ERROR: SESSION_SECRET must be at least 32 characters long in production.'
        );
    }

}

function normalizeConfig(parsed) {
    return {
        nodeEnv: parsed.NODE_ENV,
        isProduction: parsed.NODE_ENV === 'production',
        port: parsed.PORT,
        openMeteo: {
            baseUrl: parsed.OPEN_METEO_BASE,
        },
        deepSeek: {
            apiKey: parsed.DEEPSEEK_API_KEY || null,
        },
        openai: {
            apiKey: parsed.OPENAI_API_KEY || null,
        },
        database: {
            path: parsed.DATABASE_PATH || null,
        },
        features: {
            disableExternalCalls: parsed.SOMMOS_DISABLE_EXTERNAL_CALLS === 'true',
            authDisabled: parsed.SOMMOS_AUTH_DISABLED === 'true',
        },
        auth: {
            jwtSecret: parsed.JWT_SECRET,
            sessionSecret: parsed.SESSION_SECRET,
        },
        services: {
            weather: {
                apiKey: parsed.WEATHER_API_KEY || null,
            },
        },
        tests: {
            performanceDatasetSize: parsed.PERFORMANCE_TEST_DATASET_SIZE || null,
        },
        app: {
            version: packageJson.version || '0.0.0',
        },
    };
}

function loadConfigFromEnv() {
    const dotenvResult = loadEnv({
        path: process.env.DOTENV_CONFIG_PATH || path.resolve(process.cwd(), '.env'),
    });

    // ENOENT = file not found, ENOTDIR = not a directory (for /dev/null trick in tests)
    if (dotenvResult.error && dotenvResult.error.code !== 'ENOENT' && dotenvResult.error.code !== 'ENOTDIR') {
        throw dotenvResult.error;
    }

    const mergedEnv = applyDefaults(process.env);
    const validation = schema.safeParse(mergedEnv);

    if (!validation.success) {
        const formattedErrors = validation.error?.issues
            ?.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('\n') || 'Unknown validation error';

        throw new Error(`Invalid environment configuration:\n${formattedErrors}`);
    }

    enforceRuntimeGuards(validation.data);

    return normalizeConfig(validation.data);
}

function getConfig() {
    if (!cachedConfig) {
        cachedConfig = loadConfigFromEnv();
    }

    return cachedConfig;
}

function refreshConfig() {
    cachedConfig = loadConfigFromEnv();
    return cachedConfig;
}

module.exports = {
    get env() {
        return getConfig();
    },
    getConfig,
    refreshConfig,
    enforceRuntimeGuards,
};
