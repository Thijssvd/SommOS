const wineGuidanceService = require('../backend/core/wine_guidance_service');

describe('wineGuidanceService.getGuidance', () => {
    it('provides Cabernet Sauvignon specific guidance', () => {
        const wine = {
            name: 'Left Bank Test',
            wine_type: 'Red',
            style: 'Full-bodied',
            grape_varieties: JSON.stringify(['Cabernet Sauvignon', 'Merlot'])
        };

        const guidance = wineGuidanceService.getGuidance(wine);

        expect(guidance.storage_temp_min).toBe(13);
        expect(guidance.storage_temp_max).toBe(16);
        expect(guidance.should_decant).toBe(true);
        expect(guidance.decanting_time_minutes_min).toBeGreaterThanOrEqual(60);
        expect(guidance.decanting_time_minutes_max).toBeGreaterThan(guidance.decanting_time_minutes_min);
        expect(typeof guidance.decanting_recommendation).toBe('string');
    });

    it('returns chill guidance without decanting for sparkling wines', () => {
        const wine = {
            name: 'Celebration Cuvée',
            wine_type: 'Sparkling',
            grape_varieties: JSON.stringify(['Chardonnay', 'Pinot Noir'])
        };

        const guidance = wineGuidanceService.getGuidance(wine);

        expect(guidance.storage_temp_min).toBe(6);
        expect(guidance.storage_temp_max).toBe(8);
        expect(guidance.should_decant).toBe(false);
        expect(guidance.decanting_recommendation.toLowerCase()).toContain('no decanting');
    });

    it('falls back to sensible defaults when data is missing', () => {
        const wine = {
            name: 'Mystery Wine'
        };

        const guidance = wineGuidanceService.getGuidance(wine);

        expect(guidance.storage_temp_min).toBeGreaterThan(0);
        expect(guidance.storage_temp_max).toBeGreaterThan(guidance.storage_temp_min);
        expect(typeof guidance.storage_recommendation).toBe('string');
        expect(guidance.decanting_recommendation).toBeTruthy();
    });
});
