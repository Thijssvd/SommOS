jest.mock('../../backend/config/env', () => ({
    getConfig: () => ({
        nodeEnv: 'development',
        openMeteo: {
            baseUrl: 'https://mock.open-meteo.test',
            rateLimit: { maxRequests: 2, windowMs: 50 }
        },
        openAI: { apiKey: null },
        database: { path: ':memory:' },
        features: { disableExternalCalls: false }
    })
}));

jest.mock('../../backend/database/connection');
jest.mock('axios');

const axios = require('axios');
const MockDatabase = require('../../backend/database/connection');
const OpenMeteoService = require('../../backend/core/open_meteo_service');

const buildProcessedPayload = () => ({
    gdd: 1234,
    totalRainfall: 456,
    phenology: { budbreak: '2020-04-15' }
});

const buildRawResponse = () => {
    const length = 100;
    const buildArray = (value) => Array.from({ length }, () => value);
    return {
        data: {
            daily: {
                time: Array.from({ length }, (_, index) => `2019-04-${String((index % 30) + 1).padStart(2, '0')}`),
                temperature_2m_max: buildArray(25),
                temperature_2m_min: buildArray(12),
                temperature_2m_mean: buildArray(18),
                apparent_temperature_max: buildArray(24),
                apparent_temperature_min: buildArray(11),
                apparent_temperature_mean: buildArray(17),
                precipitation_sum: buildArray(2),
                rain_sum: buildArray(1),
                snowfall_sum: buildArray(0),
                sunshine_duration: buildArray(8),
                daylight_duration: buildArray(12),
                shortwave_radiation_sum: buildArray(5),
                wind_speed_10m_max: buildArray(15),
                wind_gusts_10m_max: buildArray(25),
                wind_direction_10m_dominant: buildArray(180),
                pressure_msl_mean: buildArray(1013),
                surface_pressure_mean: buildArray(1010),
                vapour_pressure_deficit_max: buildArray(0.5),
                et0_fao_evapotranspiration: buildArray(3),
                weather_code: buildArray(0)
            }
        }
    };
};

describe('OpenMeteoService resilience guardrails', () => {
    let service;

    beforeEach(() => {
        jest.resetAllMocks();
        MockDatabase.getInstance().reset();
        service = new OpenMeteoService();
        jest.spyOn(service, 'getRegionCoordinates').mockResolvedValue({
            latitude: 44.1234,
            longitude: -0.9876
        });
        jest.spyOn(service, 'delay').mockResolvedValue();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('returns null and records explanation after repeated timeouts', async () => {
        const timeoutError = new Error('timeout');
        timeoutError.code = 'ECONNABORTED';
        axios.get.mockImplementation(() => Promise.reject(timeoutError));

        const recordSpy = jest.spyOn(service, 'recordWeatherExplanation').mockResolvedValue();

        const result = await service.getVintageWeatherData('Bordeaux', 2020, { vineyardAlias: 'Clos Test' });

        expect(result).toBeNull();
        expect(axios.get).toHaveBeenCalledTimes(service.retryConfig.attempts);
        expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({
            factors: ['api_error']
        }));
    });

    test('retries on 429 responses and returns processed payload when retry succeeds', async () => {
        axios.get
            .mockRejectedValueOnce({ response: { status: 429 }, message: 'Too Many Requests' })
            .mockResolvedValueOnce(buildRawResponse());

        jest.spyOn(service, 'shouldSkipEnrichment').mockReturnValue(false);
        jest.spyOn(service, 'processVintageWeatherData').mockReturnValue(buildProcessedPayload());
        jest.spyOn(service, 'isDataQualityAcceptable').mockReturnValue(true);
        jest.spyOn(service, 'setCachedWeatherData').mockResolvedValue();
        const explanationSpy = jest.spyOn(service, 'recordWeatherExplanation').mockResolvedValue();

        const result = await service.getVintageWeatherData('Burgundy', 2019, { vineyardAlias: 'Domaine Retry' });

        expect(result).toEqual(buildProcessedPayload());
        expect(axios.get).toHaveBeenCalledTimes(2);
        expect(explanationSpy).not.toHaveBeenCalled();
    });

    test('uses regional cache fallback when vineyard alias cache misses', async () => {
        const cachedPayload = buildProcessedPayload();
        const cacheSpy = jest
            .spyOn(service, 'getCachedWeatherData')
            .mockImplementation(async (key) => {
                if (key.includes('alias:domaine_retry')) {
                    return null;
                }
                if (key.includes('alias:burgundy')) {
                    return cachedPayload;
                }
                return null;
            });
        const explanationSpy = jest.spyOn(service, 'recordWeatherExplanation').mockResolvedValue();

        const result = await service.getVintageWeatherData('Burgundy', 2018, { vineyardAlias: 'Domaine Retry' });

        expect(result).toBe(cachedPayload);
        expect(cacheSpy).toHaveBeenCalledTimes(2);
        expect(explanationSpy).toHaveBeenCalledWith(expect.objectContaining({
            factors: ['regional_cache_fallback']
        }));
        expect(axios.get).not.toHaveBeenCalled();
    });
});
