class VintageIntelligenceService {
    constructor() {
        this.mockWeather = {
            region: 'Bordeaux',
            year: 2020,
            gdd: 1450,
            avgDiurnalRange: 11.5,
            harvestRain: 32,
            overallScore: 90,
            weatherSummary: 'Warm growing season with cool nights preserving freshness.'
        };
    }

    async enrichWineData(wine) {
        return {
            ...wine,
            weatherAnalysis: this.mockWeather,
            vintageSummary: 'Sunny vintage with excellent phenolic maturity and poise.',
            qualityScore: 94,
            procurementRec: 'Maintain core allocation for signature experiences.'
        };
    }

    async getWeatherContextForPairing() {
        return this.mockWeather;
    }

    generateWeatherPairingInsight(weatherAnalysis, dishContext) {
        return `The ${weatherAnalysis.year} vintage shows vibrant energy that will elevate ${dishContext.dish || 'this dish'}.`;
    }

    async getInventoryProcurementRecommendations() {
        return [
            {
                wine_id: 'test-wine-1',
                action: 'Reorder',
                rationale: 'Stock below service threshold for owner favorites.',
                priority: 'high'
            }
        ];
    }

    async batchEnrichWines(wines) {
        return wines.map(wine => ({
            ...wine,
            weatherAnalysis: this.mockWeather,
            vintageSummary: 'Consistent season delivering balanced fruit and structure.'
        }));
    }
}

module.exports = VintageIntelligenceService;
