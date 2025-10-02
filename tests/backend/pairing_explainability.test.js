// Pairing explainability integration tests

process.env.SOMMOS_AUTH_TEST_BYPASS = 'false';

// Ensure the environment config does not attempt to load real API keys
jest.mock('../../backend/config/env', () => ({
    getConfig: () => ({
        nodeEnv: 'test',
        openAI: { apiKey: null },
        deepSeek: { apiKey: null },
        database: { path: ':memory:' },
    }),
}));

jest.mock('../../backend/database/connection');

const PairingEngine = require('../../backend/core/pairing_engine');
const ExplainabilityService = require('../../backend/core/explainability_service');
const MockDatabase = require('../../backend/database/connection');

describe('PairingEngine explainability persistence', () => {
    let db;
    let explainabilityService;

    beforeEach(() => {
        db = MockDatabase.getInstance();
        db.reset();
        explainabilityService = new ExplainabilityService(db);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (db) {
            db.reset();
        }
    });

    test('generatePairings persists explanations for each recommendation', async () => {
        const learningEngine = {
            getPairingWeights: jest.fn(async () => null),
            recordPairingSession: jest.fn(async ({ recommendations }) => ({
                sessionId: 'session-1',
                recommendationIds: recommendations.map((_, index) => `rec-${index + 1}`),
            })),
        };

        const engine = new PairingEngine(db, learningEngine, explainabilityService);

        jest.spyOn(engine, 'parseNaturalLanguageDish').mockResolvedValue({
            name: 'Herb roasted chicken',
            cuisine: 'french',
            preparation: 'roasted',
            intensity: 'medium',
            dominant_flavors: ['herbaceous'],
        });

        jest.spyOn(engine, 'generateTraditionalPairings').mockResolvedValue([
            {
                wine: {
                    id: 'wine-1',
                    name: 'Test Pinot Noir',
                    region: 'Burgundy',
                },
                score: {
                    total: 0.92,
                    style_match: 0.9,
                    flavor_harmony: 0.93,
                    texture_balance: 0.88,
                },
                reasoning: 'Elegant tannins complement the herbs.',
                ai_enhanced: false,
            },
            {
                wine: {
                    id: 'wine-2',
                    name: 'Test Chardonnay',
                    region: 'Sonoma',
                },
                score: {
                    total: 0.87,
                    style_match: 0.85,
                    flavor_harmony: 0.88,
                    texture_balance: 0.84,
                },
                reasoning: 'Bright acidity lifts the roasted flavors.',
                ai_enhanced: false,
            },
        ]);

        const result = await engine.generatePairings('Roasted chicken with herbs');

        expect(result).toHaveProperty('explanation');
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.recommendations).toHaveLength(2);
        expect(learningEngine.recordPairingSession).toHaveBeenCalled();

        const storedExplanations = db.data.explanations.filter(
            (entry) => entry.entity_type === 'pairing_recommendation'
        );

        expect(storedExplanations).toHaveLength(2);
        expect(storedExplanations.map((entry) => entry.entity_id)).toEqual([
            'rec-1',
            'rec-2',
        ]);
        expect(storedExplanations[0].summary).toContain('Elegant tannins');
        expect(JSON.parse(storedExplanations[0].factors)).toEqual(
            expect.arrayContaining([
                expect.stringContaining('Overall match'),
                'Elegant tannins complement the herbs.',
            ])
        );
    });
});
