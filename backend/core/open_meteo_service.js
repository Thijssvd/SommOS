/**
 * Open-Meteo Weather Data Integration Service
 * 
 * Provides historical weather data for vintage analysis using the free Open-Meteo API
 * - No API key required
 * - 80+ years of historical data
 * - High resolution (1-11km)
 * - Perfect for wine vintage weather analysis
 * 
 * API Documentation: https://open-meteo.com/en/docs/historical-weather-api
 */

const axios = require('axios');
const { getConfig } = require('../config/env');
const Database = require('../database/connection');
const ExplainabilityService = require('./explainability_service');

const DEFAULT_CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
const MINIMUM_DATASET_DAYS = 90;
const ENRICHMENT_MAX_CALLS_PER_HOUR = 120;

class OpenMeteoService {
    constructor() {
        const config = getConfig();
        this.baseUrl = config.openMeteo.baseUrl;
        this.geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';

        // Wine region coordinates cache to minimize geocoding requests
        this.regionCoordinates = new Map();

        // Weather cache infrastructure
        this.db = Database.getInstance();
        this.explainabilityService = new ExplainabilityService(this.db);
        this.cacheTablePromise = null;

        this.memoryCache = new Map();
        this.memoryCacheMaxEntries = 200;
        this.defaultCacheTtl = DEFAULT_CACHE_TTL;

        const rateLimitConfig = (config.openMeteo && config.openMeteo.rateLimit) || {};
        this.rateLimit = {
            maxRequests: rateLimitConfig.maxRequests || 8,
            windowMs: rateLimitConfig.windowMs || 60_000
        };
        this.requestTimestamps = [];

        this.tokenBucket = {
            capacity: ENRICHMENT_MAX_CALLS_PER_HOUR,
            tokens: ENRICHMENT_MAX_CALLS_PER_HOUR,
            refillRatePerMs: ENRICHMENT_MAX_CALLS_PER_HOUR / (60 * 60 * 1000),
            lastRefill: Date.now()
        };

        this.retryConfig = {
            attempts: 3,
            baseDelayMs: 1000,
            maxDelayMs: 8000,
            jitterRatio: 0.3
        };

        this.circuitBreakerDefaults = {
            state: 'CLOSED',
            failureCount: 0,
            threshold: 3,
            cooldownMs: 60_000,
            nextAttempt: 0
        };
        this.circuitBreakers = new Map();

        this.baseHost = this.extractHost(this.baseUrl);
        this.geocodingHost = this.extractHost(this.geocodingUrl);

        this.qualityThresholds = {
            minimumDays: MINIMUM_DATASET_DAYS,
            minimumTemperatureValues: 70,
            minimumPrecipitationValues: 60
        };

        this.cacheTablePromise = this.ensureCacheTable();

        // Initialize with major wine regions
        this.initializeWineRegions();
    }

    shouldBypassNetwork() {
        const config = getConfig();
        return ['test', 'performance'].includes(config.nodeEnv) ||
            config.features.disableExternalCalls;
    }

    ensureCacheTable() {
        if (!this.cacheTablePromise) {
            this.cacheTablePromise = (async () => {
                try {
                    await this.db.exec(`
                        CREATE TABLE IF NOT EXISTS WeatherCache (
                            key TEXT PRIMARY KEY,
                            payload TEXT NOT NULL,
                            fetched_at INTEGER NOT NULL,
                            ttl INTEGER NOT NULL
                        );
                        CREATE INDEX IF NOT EXISTS idx_weather_cache_expiry
                            ON WeatherCache(fetched_at);
                    `);
                } catch (error) {
                    console.warn('Failed to initialize weather cache table:', error.message);
                }
            })();
        }
        return this.cacheTablePromise;
    }

    normalizeRegionInput(regionName) {
        if (!regionName || typeof regionName !== 'string') {
            return '';
        }
        return regionName.trim();
    }

    normalizeAlias(alias) {
        if (!alias || typeof alias !== 'string') {
            return 'default';
        }
        return alias.toLowerCase().trim().replace(/\s+/g, '_');
    }

    buildCacheKey(coordinates, year, alias) {
        const safeLat = Number(coordinates.latitude || 0).toFixed(4);
        const safeLon = Number(coordinates.longitude || 0).toFixed(4);
        const safeYear = Number(year) || 0;
        const normalizedAlias = this.normalizeAlias(alias);
        return `lat:${safeLat}|lon:${safeLon}|year:${safeYear}|alias:${normalizedAlias}`;
    }

    getFromMemoryCache(key) {
        const now = Date.now();
        if (!this.memoryCache.has(key)) {
            return null;
        }

        const entry = this.memoryCache.get(key);
        if (!entry || entry.expiresAt <= now) {
            this.memoryCache.delete(key);
            return null;
        }

        // Refresh LRU ordering
        this.memoryCache.delete(key);
        this.memoryCache.set(key, entry);

        return entry.payload;
    }

    setMemoryCache(key, payload, ttlMs) {
        const expiresAt = Date.now() + ttlMs;
        if (this.memoryCache.has(key)) {
            this.memoryCache.delete(key);
        }

        this.memoryCache.set(key, {
            payload,
            expiresAt
        });

        if (this.memoryCache.size > this.memoryCacheMaxEntries) {
            const oldestKey = this.memoryCache.keys().next().value;
            if (oldestKey) {
                this.memoryCache.delete(oldestKey);
            }
        }
    }

    async getCachedWeatherData(key) {
        const memoryHit = this.getFromMemoryCache(key);
        if (memoryHit) {
            return memoryHit;
        }

        try {
            await this.ensureCacheTable();
            const row = await this.db.get(
                'SELECT payload, fetched_at, ttl FROM WeatherCache WHERE key = ?',
                [key]
            );

            if (!row) {
                return null;
            }

            const expiresAt = Number(row.fetched_at) + Number(row.ttl);
            if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
                const payload = JSON.parse(row.payload);
                this.setMemoryCache(key, payload, expiresAt - Date.now());
                return payload;
            }

            await this.db.run('DELETE FROM WeatherCache WHERE key = ?', [key]);
        } catch (error) {
            console.warn('Weather cache read failed:', error.message);
        }

        return null;
    }

    async setCachedWeatherData(key, payload, ttlMs = this.defaultCacheTtl) {
        const ttl = Math.max(ttlMs, 60_000);
        const fetchedAt = Date.now();

        this.setMemoryCache(key, payload, ttl);

        try {
            await this.ensureCacheTable();
            await this.db.run(
                'INSERT OR REPLACE INTO WeatherCache(key, payload, fetched_at, ttl) VALUES (?, ?, ?, ?)',
                [
                    key,
                    JSON.stringify(payload),
                    fetchedAt,
                    ttl
                ]
            );
        } catch (error) {
            console.warn('Weather cache write failed:', error.message);
        }
    }

    buildWeatherEntityId(region, year, alias) {
        const normalizedRegion = this.normalizeAlias(region) || 'unknown_region';
        const normalizedAlias = this.normalizeAlias(alias) || normalizedRegion;
        const normalizedYear = Number(year);
        const yearSegment = Number.isFinite(normalizedYear) ? String(normalizedYear) : 'unknown_year';
        return `${normalizedRegion}:${yearSegment}:${normalizedAlias}`;
    }

    async recordWeatherExplanation({ region, year, alias, summary, factors = null }) {
        if (!this.explainabilityService || !summary) {
            return;
        }

        try {
            await this.explainabilityService.createExplanation({
                entityType: 'weather_enrichment',
                entityId: this.buildWeatherEntityId(region, year, alias),
                summary,
                factors
            });
        } catch (error) {
            console.warn('Failed to persist weather enrichment explanation:', error.message);
        }
    }

    async delay(ms) {
        if (!ms || ms <= 0) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    async throttleRequests() {
        await this.consumeToken();

        if (!this.rateLimit || !this.rateLimit.maxRequests) {
            return;
        }

        const now = Date.now();
        const windowStart = now - this.rateLimit.windowMs;
        this.requestTimestamps = this.requestTimestamps.filter((timestamp) => timestamp >= windowStart);

        if (this.requestTimestamps.length >= this.rateLimit.maxRequests) {
            const earliest = this.requestTimestamps[0];
            const waitTime = Math.max(0, this.rateLimit.windowMs - (now - earliest));
            await this.delay(waitTime);
        }

        this.requestTimestamps.push(Date.now());
    }

    refillTokens() {
        if (!this.tokenBucket) {
            return;
        }

        const now = Date.now();
        const elapsed = now - this.tokenBucket.lastRefill;
        if (elapsed <= 0) {
            return;
        }

        const replenished = elapsed * this.tokenBucket.refillRatePerMs;
        this.tokenBucket.tokens = Math.min(
            this.tokenBucket.capacity,
            this.tokenBucket.tokens + replenished
        );
        this.tokenBucket.lastRefill = now;
    }

    async consumeToken() {
        if (!this.tokenBucket) {
            return;
        }

        while (true) {
            this.refillTokens();

            if (this.tokenBucket.tokens >= 1) {
                this.tokenBucket.tokens -= 1;
                return;
            }

            const deficit = 1 - this.tokenBucket.tokens;
            const waitMs = Math.max(50, deficit / this.tokenBucket.refillRatePerMs);
            await this.delay(waitMs);
        }
    }

    extractHost(url) {
        try {
            return new URL(url).host;
        } catch (error) {
            return 'default';
        }
    }

    getCircuitBreaker(host = 'default') {
        if (!this.circuitBreakers.has(host)) {
            this.circuitBreakers.set(host, { ...this.circuitBreakerDefaults });
        }
        return this.circuitBreakers.get(host);
    }

    assertCircuitBreaker(host = 'default') {
        const breaker = this.getCircuitBreaker(host);
        if (breaker.state !== 'OPEN') {
            return;
        }

        if (Date.now() >= breaker.nextAttempt) {
            breaker.state = 'HALF_OPEN';
            return;
        }

        throw new Error('Open-Meteo service temporarily unavailable (circuit open)');
    }

    recordSuccess(host = 'default') {
        const breaker = this.getCircuitBreaker(host);
        breaker.failureCount = 0;
        breaker.state = 'CLOSED';
    }

    recordFailure(host = 'default', error) {
        const breaker = this.getCircuitBreaker(host);
        breaker.failureCount += 1;
        if (breaker.failureCount >= breaker.threshold) {
            breaker.state = 'OPEN';
            breaker.nextAttempt = Date.now() + breaker.cooldownMs;
            console.warn(`Open-Meteo circuit breaker opened for ${host}:`, error.message);
        }
    }

    isRetryableError(error) {
        if (!error) {
            return false;
        }

        if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
            return true;
        }

        if (error.response) {
            const status = error.response.status;
            if (status === 429 || status >= 500) {
                return true;
            }
            return false;
        }

        return true;
    }

    computeBackoffDelay(attempt) {
        const exponentialDelay = Math.min(
            this.retryConfig.baseDelayMs * 2 ** (attempt - 1),
            this.retryConfig.maxDelayMs
        );
        const jitter = exponentialDelay * this.retryConfig.jitterRatio * Math.random();
        return exponentialDelay + jitter;
    }

    async executeWithRetry(requestFn, host = 'default') {
        let attempt = 0;
        let lastError = null;

        while (attempt < this.retryConfig.attempts) {
            attempt += 1;

            try {
                this.assertCircuitBreaker(host);
                await this.throttleRequests();
                const result = await requestFn();
                this.recordSuccess(host);
                return result;
            } catch (error) {
                lastError = error;
                this.recordFailure(host, error);

                if (!this.isRetryableError(error) || attempt >= this.retryConfig.attempts) {
                    break;
                }

                const delayMs = this.computeBackoffDelay(attempt);
                await this.delay(delayMs);
            }
        }

        const breaker = this.getCircuitBreaker(host);
        if (breaker.state === 'OPEN') {
            throw new Error('Open-Meteo service unavailable (circuit open)');
        }

        throw lastError || new Error('Unknown Open-Meteo error');
    }

    shouldSkipEnrichment(rawData) {
        if (!rawData || !rawData.daily) {
            return true;
        }

        const daysAvailable = Array.isArray(rawData.daily.time) ? rawData.daily.time.length : 0;
        if (daysAvailable < this.qualityThresholds.minimumDays) {
            return true;
        }

        const hasTemps = this.countValidValues(rawData.daily.temperature_2m_max) >=
            this.qualityThresholds.minimumTemperatureValues;
        const hasPrecip = this.countValidValues(rawData.daily.precipitation_sum) >=
            this.qualityThresholds.minimumPrecipitationValues;

        return !(hasTemps && hasPrecip);
    }

    countValidValues(values = []) {
        if (!Array.isArray(values)) {
            return 0;
        }
        return values.filter((value) => value !== null && value !== undefined).length;
    }

    isDataQualityAcceptable(processedData) {
        if (!processedData) {
            return false;
        }

        const requiredFields = ['gdd', 'totalRainfall', 'phenology'];
        const missingField = requiredFields.find((field) => processedData[field] === null || processedData[field] === undefined);
        if (missingField) {
            return false;
        }

        if (processedData.overallScore && processedData.overallScore < 50) {
            return false;
        }

        return true;
    }

    /**
     * Initialize coordinates for major wine regions
     */
    initializeWineRegions() {
        const majorRegions = {
            // France
            'bordeaux': { latitude: 44.8378, longitude: -0.5792 },
            'burgundy': { latitude: 47.0379, longitude: 4.8656 },
            'champagne': { latitude: 49.0421, longitude: 4.0142 },
            'rhône': { latitude: 44.1869, longitude: 4.8088 },
            'loire': { latitude: 47.2184, longitude: 0.0792 },
            'alsace': { latitude: 48.2737, longitude: 7.4281 },
            
            // Italy  
            'tuscany': { latitude: 43.4637, longitude: 11.8796 },
            'piedmont': { latitude: 44.7644, longitude: 7.7400 },
            'veneto': { latitude: 45.4408, longitude: 12.3155 },
            'chianti': { latitude: 43.5418, longitude: 11.3144 },
            
            // Spain
            'rioja': { latitude: 42.4627, longitude: -2.4496 },
            'ribera del duero': { latitude: 41.6110, longitude: -4.0130 },
            
            // Germany
            'mosel': { latitude: 49.8803, longitude: 6.7355 },
            'rheingau': { latitude: 50.0070, longitude: 7.9930 },
            
            // Portugal
            'douro': { latitude: 41.2033, longitude: -7.6500 },
            
            // USA
            'napa valley': { latitude: 38.5025, longitude: -122.2654 },
            'sonoma county': { latitude: 38.5780, longitude: -122.8735 },
            'willamette valley': { latitude: 45.3311, longitude: -123.1351 },
            
            // Australia
            'barossa valley': { latitude: -34.5598, longitude: 138.9156 },
            'hunter valley': { latitude: -32.8820, longitude: 151.2916 },
            'margaret river': { latitude: -33.9553, longitude: 115.0808 },
            
            // New Zealand
            'marlborough': { latitude: -41.5122, longitude: 173.9554 },
            'central otago': { latitude: -45.0302, longitude: 169.1645 },
            
            // South Africa
            'stellenbosch': { latitude: -33.9308, longitude: 18.8661 },
            
            // Chile
            'maipo valley': { latitude: -33.6846, longitude: -70.8119 },
            'casablanca valley': { latitude: -33.3186, longitude: -71.4103 },
            
            // Argentina
            'mendoza': { latitude: -32.8833, longitude: -68.8167 }
        };

        for (const [region, coords] of Object.entries(majorRegions)) {
            this.regionCoordinates.set(region.toLowerCase(), coords);
        }
    }

    /**
     * Get coordinates for a wine region
     */
    async getRegionCoordinates(regionName) {
        const normalizedRegion = regionName.toLowerCase().trim();
        
        // Check cache first
        if (this.regionCoordinates.has(normalizedRegion)) {
            return this.regionCoordinates.get(normalizedRegion);
        }

        if (this.shouldBypassNetwork()) {
            // In tests we avoid network calls and rely on cached / fallback coordinates
            if (this.regionCoordinates.has(normalizedRegion)) {
                return this.regionCoordinates.get(normalizedRegion);
            }
            return { latitude: 44.8378, longitude: -0.5792 };
        }

        // Geocode using Open-Meteo's geocoding API
        try {
            const requestHost = this.geocodingHost;
            const response = await this.executeWithRetry(
                () => axios.get(this.geocodingUrl, {
                    params: {
                        name: regionName,
                        count: 1,
                        language: 'en',
                        format: 'json'
                    },
                    timeout: 5000
                }),
                requestHost
            );

            if (response.data.results && response.data.results.length > 0) {
                const result = response.data.results[0];
                const coordinates = {
                    latitude: result.latitude,
                    longitude: result.longitude
                };

                // Cache for future use
                this.regionCoordinates.set(normalizedRegion, coordinates);
                
                console.log(`Geocoded ${regionName}: ${coordinates.latitude}, ${coordinates.longitude}`);
                return coordinates;
            }
        } catch (error) {
            console.warn(`Geocoding failed for ${regionName}:`, error.message);
        }

        // Fallback to approximate coordinates for common wine countries
        const countryDefaults = {
            'france': { latitude: 46.2276, longitude: 2.2137 },
            'italy': { latitude: 41.8719, longitude: 12.5674 },
            'spain': { latitude: 40.4637, longitude: -3.7492 },
            'germany': { latitude: 51.1657, longitude: 10.4515 },
            'portugal': { latitude: 39.3999, longitude: -8.2245 },
            'usa': { latitude: 37.0902, longitude: -95.7129 },
            'australia': { latitude: -25.2744, longitude: 133.7751 },
            'new zealand': { latitude: -40.9006, longitude: 174.8860 },
            'south africa': { latitude: -30.5595, longitude: 22.9375 },
            'chile': { latitude: -35.6751, longitude: -71.5430 },
            'argentina': { latitude: -38.4161, longitude: -63.6167 }
        };

        for (const [country, coords] of Object.entries(countryDefaults)) {
            if (normalizedRegion.includes(country)) {
                this.regionCoordinates.set(normalizedRegion, coords);
                return coords;
            }
        }

        // Final fallback - use Bordeaux coordinates
        const fallback = { latitude: 44.8378, longitude: -0.5792 };
        this.regionCoordinates.set(normalizedRegion, fallback);
        console.warn(`Using fallback coordinates for ${regionName}`);
        return fallback;
    }

    /**
     * Get historical weather data for vintage analysis
     * Fully compliant with Open-Meteo Historical Weather API OpenAPI specification
     * https://github.com/open-meteo/open-meteo/blob/main/openapi_historical_weather_api.yml
     */
    async getVintageWeatherData(region, year, options = {}) {
        const normalizedRegion = this.normalizeRegionInput(region) || region;
        const aliasInput = options.vineyardAlias || normalizedRegion;
        const aliasNormalized = this.normalizeAlias(aliasInput);
        const regionAliasNormalized = this.normalizeAlias(normalizedRegion || aliasInput);
        const displayRegion = normalizedRegion || region || 'Unknown region';
        const displayAlias = aliasInput || displayRegion;

        const forceRefresh = Boolean(options.forceRefresh);

        try {
            const coordinates = await this.getRegionCoordinates(normalizedRegion || region);
            const cacheKey = this.buildCacheKey(coordinates, year, aliasNormalized);
            const regionCacheKey = this.buildCacheKey(coordinates, year, regionAliasNormalized);
            if (!forceRefresh) {
                const cached = await this.getCachedWeatherData(cacheKey);
                if (cached) {
                    return cached;
                }

                if (aliasNormalized !== regionAliasNormalized) {
                    const regionalCached = await this.getCachedWeatherData(regionCacheKey);
                    if (regionalCached) {
                        await this.recordWeatherExplanation({
                            region: displayRegion,
                            year,
                            alias: displayAlias,
                            summary: `Using regional weather cache for ${displayAlias} (${displayRegion}) ${year}.`,
                            factors: ['regional_cache_fallback']
                        });
                        return regionalCached;
                    }
                }
            } else {
                this.memoryCache.delete(cacheKey);
                if (aliasNormalized !== regionAliasNormalized) {
                    this.memoryCache.delete(regionCacheKey);
                }
            }

            if (this.shouldBypassNetwork()) {
                console.warn('Open-Meteo network calls disabled; cache miss prevents enrichment.');
                await this.recordWeatherExplanation({
                    region: displayRegion,
                    year,
                    alias: displayAlias,
                    summary: `Skipped weather enrichment for ${displayAlias} (${displayRegion}) ${year}: external calls disabled.`,
                    factors: ['network_disabled']
                });
                return null;
            }

            if (!year || Number(year) > new Date().getFullYear()) {
                console.warn(`Skipping Open-Meteo fetch for future year ${year}.`);
                await this.recordWeatherExplanation({
                    region: displayRegion,
                    year,
                    alias: displayAlias,
                    summary: `Skipped weather enrichment for ${displayAlias} (${displayRegion}) ${year}: unsupported target year.`,
                    factors: ['invalid_year']
                });
                return null;
            }

            console.log(`Fetching Open-Meteo data for ${normalizedRegion} ${year}`);

            // Define growing season (customizable via options)
            const startDate = options.startDate || `${year}-04-01`;
            const endDate = options.endDate || `${year}-10-31`;

            // Complete parameter set according to OpenAPI spec
            const dailyParams = [
                // Temperature variables
                'temperature_2m_max',
                'temperature_2m_min',
                'temperature_2m_mean',
                'apparent_temperature_max',
                'apparent_temperature_min',
                'apparent_temperature_mean',
                
                // Precipitation variables
                'precipitation_sum',
                'rain_sum',
                'snowfall_sum',
                
                // Solar radiation and sunshine
                'sunshine_duration',
                'daylight_duration',
                'shortwave_radiation_sum',
                
                // Wind variables
                'wind_speed_10m_max',
                'wind_gusts_10m_max',
                'wind_direction_10m_dominant',
                
                // Pressure and humidity
                'pressure_msl_mean',
                'surface_pressure_mean',
                'vapour_pressure_deficit_max',
                
                // Evapotranspiration
                'et0_fao_evapotranspiration',
                
                // Weather code
                'weather_code'
            ];
            
            // Hourly parameters for detailed analysis (optional)
            const hourlyParams = options.includeHourly ? [
                'temperature_2m',
                'relative_humidity_2m',
                'dew_point_2m',
                'apparent_temperature',
                'precipitation',
                'rain',
                'weather_code',
                'pressure_msl',
                'surface_pressure',
                'cloud_cover',
                'visibility',
                'wind_speed_10m',
                'wind_direction_10m',
                'wind_gusts_10m'
            ] : null;

            // Build request parameters according to OpenAPI spec
            const params = {
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                start_date: startDate,
                end_date: endDate,
                daily: (options.dailyParams || dailyParams).join(','),
                timezone: options.timezone || 'UTC',
                temperature_unit: options.temperatureUnit || 'celsius',
                wind_speed_unit: options.windSpeedUnit || 'kmh',
                precipitation_unit: options.precipitationUnit || 'mm'
            };
            
            // Add hourly parameters if requested
            if (hourlyParams) {
                params.hourly = hourlyParams.join(',');
            }
            
            // Add optional parameters
            if (options.models) {
                params.models = options.models.join(',');
            }
            if (options.cell_selection) {
                params.cell_selection = options.cell_selection;
            }

            const requestHost = this.baseHost;
            const requestFn = async () => {
                const response = await axios.get(this.baseUrl, {
                    params,
                    timeout: Math.min(options.timeout ?? 5000, 5000),
                    headers: {
                        'User-Agent': 'SommOS Wine Management System/1.0'
                    }
                });

                if (!response.data || !response.data.daily) {
                    throw new Error('Invalid response from Open-Meteo API');
                }

                return response.data;
            };

            const rawData = await this.executeWithRetry(requestFn, requestHost);

            if (this.shouldSkipEnrichment(rawData)) {
                console.warn('Open-Meteo dataset below quality thresholds; skipping enrichment.');
                await this.recordWeatherExplanation({
                    region: displayRegion,
                    year,
                    alias: displayAlias,
                    summary: `Skipped weather enrichment for ${displayAlias} (${displayRegion}) ${year}: dataset below quality thresholds.`,
                    factors: ['dataset_quality']
                });
                return null;
            }

            const processed = this.processVintageWeatherData(rawData, normalizedRegion, year);

            if (!this.isDataQualityAcceptable(processed)) {
                console.warn('Processed Open-Meteo data below quality thresholds; skipping cache.');
                await this.recordWeatherExplanation({
                    region: displayRegion,
                    year,
                    alias: displayAlias,
                    summary: `Skipped weather enrichment for ${displayAlias} (${displayRegion}) ${year}: processed metrics below quality thresholds.`,
                    factors: ['processed_quality']
                });
                return null;
            }

            const ttl = options.cacheTtlMs || this.defaultCacheTtl;
            await this.setCachedWeatherData(cacheKey, processed, ttl);
            if (aliasNormalized !== regionAliasNormalized) {
                await this.setCachedWeatherData(regionCacheKey, processed, ttl);
            }

            return processed;
        } catch (error) {
            console.error(`Open-Meteo API error for ${region} ${year}:`, error.message);
            await this.recordWeatherExplanation({
                region: displayRegion,
                year,
                alias: displayAlias,
                summary: `Skipped weather enrichment for ${displayAlias} (${displayRegion}) ${year}: ${error.message}.`,
                factors: ['api_error']
            });
            return null;
        }
    }

    /**
     * Process raw Open-Meteo data into wine-focused metrics
     */
    processVintageWeatherData(rawData, region, year) {
        const daily = rawData.daily;
        const dates = daily.time;
        
        // Initialize arrays for analysis
        const dailyData = [];
        
        // Process each day
        for (let i = 0; i < dates.length; i++) {
            const dayData = {
                date: dates[i],
                tempMax: daily.temperature_2m_max[i],
                tempMin: daily.temperature_2m_min[i],
                tempMean: daily.temperature_2m_mean[i],
                precipitation: daily.precipitation_sum[i] || 0,
                rain: daily.rain_sum[i] || 0,
                sunshine: daily.sunshine_duration[i] || 0,
                dayLength: daily.daylight_duration[i] || 0,
                windMax: daily.wind_speed_10m_max[i] || 0,
                windGusts: daily.wind_gusts_10m_max[i] || 0,
                evapotranspiration: daily.et0_fao_evapotranspiration[i] || 0,
                dayOfYear: this.getDayOfYear(dates[i])
            };
            
            // Skip days with missing critical data
            if (dayData.tempMax !== null && dayData.tempMin !== null) {
                dailyData.push(dayData);
            }
        }

        // Calculate viticulture-specific metrics
        return this.calculateViticultureMetrics(dailyData, region, year);
    }

    /**
     * Calculate wine-specific weather metrics
     */
    calculateViticultureMetrics(dailyData, region, year) {
        // Growing Degree Days (base 10°C)
        let gdd = 0;
        let huglinIndex = 0;
        
        // Temperature analysis
        const temperatures = dailyData.map(d => d.tempMean).filter(t => t !== null);
        const maxTemps = dailyData.map(d => d.tempMax).filter(t => t !== null);
        const minTemps = dailyData.map(d => d.tempMin).filter(t => t !== null);
        
        // Diurnal range analysis
        const diurnalRanges = dailyData
            .filter(d => d.tempMax !== null && d.tempMin !== null)
            .map(d => d.tempMax - d.tempMin);

        // Precipitation analysis
        const precipitation = dailyData.map(d => d.rain || d.precipitation || 0);
        const totalRainfall = precipitation.reduce((sum, p) => sum + p, 0);

        // Weather events tracking
        let heatwaveDays = 0;
        let frostDays = 0;
        let wetDays = 0;
        let sunshineHours = 0;
        
        // Process each day for detailed metrics
        dailyData.forEach((day, index) => {
            const tempMean = day.tempMean || (day.tempMax + day.tempMin) / 2;
            
            // Growing Degree Days
            if (tempMean > 10) {
                gdd += tempMean - 10;
            }
            
            // Huglin Index (simplified)
            if (tempMean > 10) {
                const dayLength = day.dayLength / 3600; // Convert to hours
                const huglinTemp = ((day.tempMax + tempMean) / 2) - 10;
                huglinIndex += huglinTemp * (dayLength / 24);
            }
            
            // Weather events
            if (day.tempMax > 35) heatwaveDays++;
            if (day.tempMin < 0) frostDays++;
            if ((day.rain || day.precipitation || 0) > 1) wetDays++;
            
            sunshineHours += (day.sunshine || 0) / 3600; // Convert to hours
        });

        // Calculate averages
        const avgTemp = temperatures.length > 0 
            ? temperatures.reduce((sum, t) => sum + t, 0) / temperatures.length 
            : null;
            
        const avgDiurnalRange = diurnalRanges.length > 0
            ? diurnalRanges.reduce((sum, r) => sum + r, 0) / diurnalRanges.length
            : null;

        // Phenological estimations based on GDD
        const phenology = this.estimatePhenology(gdd, dailyData);
        const rainfallWindows = this.calculatePhenologyRainfall(dailyData, phenology);
        const droughtMetrics = this.calculateDroughtMetrics(dailyData);

        // Weather quality scoring
        const qualityScore = this.calculateWeatherQuality({
            gdd,
            avgTemp,
            avgDiurnalRange,
            totalRainfall,
            heatwaveDays,
            frostDays,
            sunshineHours,
            wetDays
        });

        return {
            region,
            year,
            dataSource: 'Open-Meteo',
            dataQuality: 'High',
            
            // Core metrics
            gdd: Math.round(gdd),
            huglinIndex: Math.round(huglinIndex),
            avgDiurnalRange: avgDiurnalRange ? Math.round(avgDiurnalRange * 10) / 10 : null,
            
            // Temperature data
            avgTemp: avgTemp ? Math.round(avgTemp * 10) / 10 : null,
            maxTemp: maxTemps.length > 0 ? Math.max(...maxTemps) : null,
            minTemp: minTemps.length > 0 ? Math.min(...minTemps) : null,
            
            // Precipitation data
            totalRainfall: Math.round(totalRainfall * 10) / 10,
            floweringRain: Math.round(rainfallWindows.floweringRain * 10) / 10,
            harvestRain: Math.round(rainfallWindows.harvestRain * 10) / 10,
            wetDays,

            // Weather events
            heatwaveDays,
            frostDays,
            sunshineHours: Math.round(sunshineHours),
            droughtStress: droughtMetrics.droughtStress,
            longestDrySpell: droughtMetrics.longestDrySpell,
            waterBalance: Math.round(droughtMetrics.seasonalWaterBalance * 10) / 10,
            seasonalEvapotranspiration: Math.round(droughtMetrics.totalEvapotranspiration * 10) / 10,

            // Phenology estimates
            phenology,

            // Quality assessment
            overallScore: qualityScore.overall,
            ripenessScore: qualityScore.ripeness,
            acidityScore: qualityScore.acidity,
            tanninScore: qualityScore.tannin,
            diseaseScore: qualityScore.disease,
            
            // Weather summary
            weatherSummary: this.generateWeatherSummary({
                gdd: Math.round(gdd),
                avgTemp,
                totalRainfall,
                heatwaveDays,
                frostDays,
                avgDiurnalRange,
                sunshineHours,
                harvestRain: Math.round(rainfallWindows.harvestRain * 10) / 10,
                droughtStress: droughtMetrics.droughtStress
            }),
            
            // Confidence level
            confidenceLevel: dailyData.length >= 180 ? 'High' : 
                           dailyData.length >= 120 ? 'Medium' : 'Low',
            
            // Raw data for advanced analysis
            dailyData: dailyData.length <= 50 ? dailyData : null // Only include for small datasets
        };
    }

    /**
     * Estimate phenological stages based on GDD accumulation
     */
    estimatePhenology(gdd, dailyData) {
        const stages = {};
        let accumulatedGDD = 0;

        // GDD thresholds for phenological stages
        const thresholds = {
            budbreak: 50,
            flowering: 400,
            veraison: 900,
            harvest: 1300
        };

        for (let i = 0; i < dailyData.length; i++) {
            const day = dailyData[i];
            const tempMean = day.tempMean || (day.tempMax + day.tempMin) / 2;
            
            if (tempMean > 10) {
                accumulatedGDD += tempMean - 10;
            }
            
            // Check for phenological milestones
            for (const [stage, threshold] of Object.entries(thresholds)) {
                if (!stages[stage] && accumulatedGDD >= threshold) {
                    stages[stage] = {
                        date: day.date,
                        gdd: Math.round(accumulatedGDD),
                        dayOfYear: this.getDayOfYear(day.date)
                    };
                }
            }
        }

        return stages;
    }

    calculatePhenologyRainfall(dailyData, phenology) {
        const totalDays = dailyData.length;

        const sumRain = (predicate) => dailyData.reduce((total, day, index) => {
            const rainAmount = day.rain ?? day.precipitation ?? 0;
            return predicate(day, index) ? total + rainAmount : total;
        }, 0);

        const computeWindow = (stage, windowDays, fallbackRange) => {
            if (stage && stage.dayOfYear) {
                const halfWindow = Math.floor(windowDays / 2);
                return sumRain((day) => Math.abs(day.dayOfYear - stage.dayOfYear) <= halfWindow);
            }
            const [startIndex, endIndex] = fallbackRange;
            return sumRain((_, index) => index >= startIndex && index <= endIndex);
        };

        const floweringFallback = [
            Math.floor(totalDays * 0.3),
            Math.min(totalDays - 1, Math.floor(totalDays * 0.45))
        ];
        const harvestFallback = [
            Math.max(0, totalDays - 21),
            Math.max(0, totalDays - 1)
        ];

        return {
            floweringRain: computeWindow(phenology.flowering, 14, floweringFallback),
            harvestRain: computeWindow(phenology.harvest, 21, harvestFallback)
        };
    }

    calculateDroughtMetrics(dailyData) {
        let currentDrySpell = 0;
        let longestDrySpell = 0;
        let seasonalWaterBalance = 0;
        let totalEvapotranspiration = 0;

        dailyData.forEach((day) => {
            const rainAmount = day.rain ?? day.precipitation ?? 0;
            const evapotranspiration = day.evapotranspiration ?? 0;

            seasonalWaterBalance += rainAmount - evapotranspiration;
            totalEvapotranspiration += evapotranspiration;

            if (rainAmount < Math.max(1, evapotranspiration * 0.5)) {
                currentDrySpell += 1;
            } else {
                longestDrySpell = Math.max(longestDrySpell, currentDrySpell);
                currentDrySpell = 0;
            }
        });

        longestDrySpell = Math.max(longestDrySpell, currentDrySpell);

        return {
            droughtStress: longestDrySpell >= 14 || seasonalWaterBalance < -40,
            longestDrySpell,
            seasonalWaterBalance,
            totalEvapotranspiration
        };
    }

    /**
     * Calculate weather quality scores for vintage assessment
     */
    calculateWeatherQuality(metrics) {
        const {
            gdd,
            avgTemp,
            avgDiurnalRange,
            totalRainfall,
            heatwaveDays,
            frostDays,
            sunshineHours,
            wetDays
        } = metrics;

        // Ripeness score (based on GDD and temperature)
        let ripenessScore = 3.0;
        if (gdd >= 1200 && gdd <= 1800) ripenessScore += 1.5;
        if (gdd >= 1400 && gdd <= 1600) ripenessScore += 0.5;
        if (avgTemp >= 15 && avgTemp <= 20) ripenessScore += 1.0;
        if (heatwaveDays > 15) ripenessScore -= 1.0;
        ripenessScore = Math.max(1.0, Math.min(5.0, ripenessScore));

        // Acidity score (based on diurnal range and cool nights)
        let acidityScore = 3.0;
        if (avgDiurnalRange >= 10 && avgDiurnalRange <= 15) acidityScore += 1.5;
        if (avgDiurnalRange > 15) acidityScore += 1.0;
        if (heatwaveDays < 5) acidityScore += 0.5;
        acidityScore = Math.max(1.0, Math.min(5.0, acidityScore));

        // Tannin development score
        let tanninScore = 3.0;
        if (gdd >= 1300) tanninScore += 1.0;
        if (sunshineHours >= 1000) tanninScore += 1.0;
        if (avgDiurnalRange >= 12) tanninScore += 0.5;
        tanninScore = Math.max(1.0, Math.min(5.0, tanninScore));

        // Disease pressure score (higher is better = less disease risk)
        let diseaseScore = 3.0;
        if (totalRainfall < 300) diseaseScore += 1.5;
        else if (totalRainfall < 500) diseaseScore += 0.5;
        if (wetDays < 60) diseaseScore += 1.0;
        if (avgDiurnalRange > 12) diseaseScore += 0.5; // Good air circulation
        if (totalRainfall > 800) diseaseScore -= 2.0;
        diseaseScore = Math.max(1.0, Math.min(5.0, diseaseScore));

        // Overall vintage quality score
        const overall = Math.round(
            (ripenessScore * 0.3 + acidityScore * 0.25 + 
             tanninScore * 0.25 + diseaseScore * 0.2) * 20
        );

        return {
            ripeness: Math.round(ripenessScore * 10) / 10,
            acidity: Math.round(acidityScore * 10) / 10,
            tannin: Math.round(tanninScore * 10) / 10,
            disease: Math.round(diseaseScore * 10) / 10,
            overall: Math.max(50, Math.min(100, overall))
        };
    }

    /**
     * Generate human-readable weather summary
     */
    generateWeatherSummary(metrics) {
        const {
            gdd,
            avgTemp,
            totalRainfall,
            heatwaveDays,
            frostDays,
            avgDiurnalRange,
            harvestRain,
            droughtStress
        } = metrics;

        let summary = '';

        // GDD assessment
        if (gdd < 1200) {
            summary += 'Cool growing season with limited heat accumulation. ';
        } else if (gdd > 1800) {
            summary += 'Very warm growing season with abundant heat. ';
        } else {
            summary += 'Balanced growing season with good heat accumulation. ';
        }
        
        // Rainfall assessment
        if (totalRainfall < 250) {
            summary += 'Dry conditions with minimal rainfall. ';
        } else if (totalRainfall > 600) {
            summary += 'Wet conditions with abundant rainfall. ';
        } else {
            summary += 'Moderate rainfall levels. ';
        }
        
        // Temperature variation
        if (avgDiurnalRange > 15) {
            summary += 'Excellent day-night temperature variation preserving acidity.';
        } else if (avgDiurnalRange > 10) {
            summary += 'Good temperature variation supporting balanced development.';
        } else {
            summary += 'Limited temperature variation.';
        }

        if (droughtStress) {
            summary += ' Extended dry spells introduced moderate vine stress but boosted concentration.';
        } else if (harvestRain && harvestRain > 60) {
            summary += ` Late-season rainfall (~${Math.round(harvestRain)}mm) required vigilant harvest timing.`;
        }

        return summary.trim();
    }

    /**
     * Get day of year from date string
     */
    getDayOfYear(dateString) {
        const date = new Date(dateString);
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    /**
     * Test the Open-Meteo connection
     */
    async testConnection() {
        try {
            console.log('Testing Open-Meteo connection...');
            
            // Test with Bordeaux 2018 (known good vintage)
            const testData = await this.getVintageWeatherData('Bordeaux', 2018);
            
            console.log('✅ Open-Meteo connection successful');
            console.log(`   - GDD: ${testData.gdd}`);
            console.log(`   - Rainfall: ${testData.totalRainfall}mm`);
            console.log(`   - Quality Score: ${testData.overallScore}/100`);
            console.log(`   - Data Quality: ${testData.confidenceLevel}`);
            
            return true;
        } catch (error) {
            console.error('❌ Open-Meteo connection failed:', error.message);
            return false;
        }
    }
}

module.exports = OpenMeteoService;