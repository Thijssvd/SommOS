const path = require('path');
const { config: loadEnv } = require('dotenv');
const { z } = require('zod');

const packageJson = require('../../package.json');

const ENVIRONMENT_VALUES = ['development', 'test', 'production', 'performance', 'staging'];

const DEFAULT_OPEN_METEO_BASE = 'https://archive-api.open-meteo.com/v1/archive';

const schema = z.object({
    NODE_ENV: z
        .string()
        .default('development')
        .transform((value) => value.toLowerCase())
        .refine((value) => ENVIRONMENT_VALUES.includes(value), {
            message: `NODE_ENV must be one of: ${ENVIRONMENT_VALUES.join(', ')}`,
        }),
    PORT: z.coerce.number({ invalid_type_error: 'PORT must be a number' })
        .int('PORT must be an integer')
        .min(0, 'PORT must be greater than or equal to 0')
        .max(65535, 'PORT must be less than 65536')
        .default(3001),
    OPEN_METEO_BASE: z.string({ required_error: 'OPEN_METEO_BASE is required' })
        .trim()
        .url('OPEN_METEO_BASE must be a valid URL'),
    OPENAI_API_KEY: z.string().trim().min(1, 'OPENAI_API_KEY cannot be empty').optional(),
    SOMMOS_DISABLE_EXTERNAL_CALLS: z.enum(['true', 'false']).optional(),
    DATABASE_PATH: z.string().trim().min(1).optional(),
    JWT_SECRET: z.string().trim().min(1, 'JWT_SECRET cannot be empty').optional(),
    SESSION_SECRET: z.string().trim().min(1, 'SESSION_SECRET cannot be empty').optional(),
    WEATHER_API_KEY: z.string().trim().min(1, 'WEATHER_API_KEY cannot be empty').optional(),
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

    const normalizedNodeEnv = (withDefaults.NODE_ENV || 'development').toLowerCase();
    withDefaults.NODE_ENV = normalizedNodeEnv;

    if (!withDefaults.PORT) {
        withDefaults.PORT = '3001';
    }

    if (!withDefaults.OPEN_METEO_BASE) {
        if (normalizedNodeEnv === 'production') {
            throw new Error('OPEN_METEO_BASE is required in production environments.');
        }

        withDefaults.OPEN_METEO_BASE = DEFAULT_OPEN_METEO_BASE;
    }

    return withDefaults;
}

function enforceRuntimeGuards(parsed) {
    if (parsed.NODE_ENV !== 'production') {
        return;
    }

    const missingSecrets = [];

    if (!parsed.JWT_SECRET) {
        missingSecrets.push('JWT_SECRET');
    }

    if (!parsed.SESSION_SECRET) {
        missingSecrets.push('SESSION_SECRET');
    }

    if (missingSecrets.length > 0) {
        throw new Error(
            `Missing required secrets for production environment: ${missingSecrets.join(', ')}`
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
        openAI: {
            apiKey: parsed.OPENAI_API_KEY || null,
        },
        database: {
            path: parsed.DATABASE_PATH || null,
        },
        features: {
            disableExternalCalls: parsed.SOMMOS_DISABLE_EXTERNAL_CALLS === 'true',
        },
        auth: {
            jwtSecret: parsed.JWT_SECRET || null,
            sessionSecret: parsed.SESSION_SECRET || null,
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

    if (dotenvResult.error && dotenvResult.error.code !== 'ENOENT') {
        throw dotenvResult.error;
    }

    const mergedEnv = applyDefaults(process.env);
    const validation = schema.safeParse(mergedEnv);

    if (!validation.success) {
        const formattedErrors = validation.error?.errors
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
    env: getConfig(),
    getConfig,
    refreshConfig,
};
