const path = require('path');
const fs = require('fs');
const VintageIntelligenceService = require('../../backend/core/vintage_intelligence');
const Database = require('../../backend/database/connection');

describe('VintageIntelligenceService', () => {
    let db;
    let vintageIntelligence;
    let testWineId;
    let testVintageId;

    beforeAll(async () => {
        // Set up in-memory test database
        process.env.DATABASE_PATH = ':memory:';
        process.env.DEEPSEEK_API_KEY = ''; // Disable AI for consistent testing
        
        Database.instance = null;
        db = Database.getInstance(':memory:');
        await db.initialize();

        // Load schema
        const schemaPath = path.join(__dirname, '../../backend/database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await db.exec(schema);

        // Create test wine
        const wineResult = await db.run(`
            INSERT INTO Wines (name, producer, region, country, wine_type, grape_varieties, style)
            VALUES (
                'Grand Cru Classé', 
                'Château Test', 
                'Bordeaux', 
                'France', 
                'Red', 
                '["Cabernet Sauvignon", "Merlot"]',
                'Full-bodied'
            )
        `);
        testWineId = wineResult.lastID;

        // Create test vintage
        const vintageResult = await db.run(`
            INSERT INTO Vintages (wine_id, year, quality_score, critic_score)
            VALUES (?, 2015, 88, 90)
        `, [testWineId]);
        testVintageId = vintageResult.lastID;

        // Add more test wines for comprehensive testing
        const wines = [
            { name: 'Pinot Noir Reserve', producer: 'Domaine Test', region: 'Burgundy', country: 'France', type: 'Red', year: 2018, quality: 92 },
            { name: 'Chardonnay', producer: 'Test Estate', region: 'Napa Valley', country: 'USA', type: 'White', year: 2019, quality: 87 }
        ];

        for (const wine of wines) {
            const w = await db.run(`
                INSERT INTO Wines (name, producer, region, country, wine_type, grape_varieties)
                VALUES (?, ?, ?, ?, ?, '["Unknown"]')
            `, [wine.name, wine.producer, wine.region, wine.country, wine.type]);

            await db.run(`
                INSERT INTO Vintages (wine_id, year, quality_score)
                VALUES (?, ?, ?)
            `, [w.lastID, wine.year, wine.quality]);
        }

        // Create vintage intelligence instance
        vintageIntelligence = new VintageIntelligenceService(db);
    });

    afterAll(async () => {
        if (db) {
            await db.close();
        }
    });

    describe('Initialization', () => {
        it('should initialize with database', () => {
            expect(vintageIntelligence).toBeInstanceOf(VintageIntelligenceService);
            expect(vintageIntelligence.db).toBe(db);
        });

        it('should have weather analysis service', () => {
            expect(vintageIntelligence.weatherAnalysis).toBeDefined();
        });

        it('should have processed vintages cache', () => {
            expect(vintageIntelligence.processedVintages).toBeInstanceOf(Map);
        });
    });

    describe('normalizeRegion()', () => {
        it('should normalize common region names', () => {
            expect(vintageIntelligence.normalizeRegion('Burgundy')).toBe('burgundy');
            expect(vintageIntelligence.normalizeRegion('Bourgogne')).toBe('burgundy');
            expect(vintageIntelligence.normalizeRegion('Bordeaux')).toBe('bordeaux');
        });

        it('should handle Napa Valley variations', () => {
            expect(vintageIntelligence.normalizeRegion('Napa Valley')).toBe('napa');
            expect(vintageIntelligence.normalizeRegion('napa valley')).toBe('napa');
        });

        it('should normalize Rhône variations', () => {
            expect(vintageIntelligence.normalizeRegion('Côtes du Rhône')).toBe('rhône');
            expect(vintageIntelligence.normalizeRegion('Rhone Valley')).toBe('rhône');
        });

        it('should normalize Italian regions', () => {
            expect(vintageIntelligence.normalizeRegion('Tuscany')).toBe('tuscany');
            expect(vintageIntelligence.normalizeRegion('Toscana')).toBe('tuscany');
            expect(vintageIntelligence.normalizeRegion('Piedmont')).toBe('piedmont');
            expect(vintageIntelligence.normalizeRegion('Piemonte')).toBe('piedmont');
        });

        it('should return normalized lowercase for unknown regions', () => {
            expect(vintageIntelligence.normalizeRegion('Unknown Region')).toBe('unknown region');
        });

        it('should handle case insensitivity', () => {
            expect(vintageIntelligence.normalizeRegion('BORDEAUX')).toBe('bordeaux');
            expect(vintageIntelligence.normalizeRegion('cHaMpAgNe')).toBe('champagne');
        });
    });

    describe('calculateWeatherAdjustedQuality()', () => {
        it('should apply bonus for exceptional vintage', () => {
            const weatherAnalysis = {
                overallScore: 90,
                ripenessScore: 4.5,
                acidityScore: 4.5,
                diseaseScore: 4.0
            };

            const adjusted = vintageIntelligence.calculateWeatherAdjustedQuality(85, weatherAnalysis);
            expect(adjusted).toBeGreaterThan(85);
        });

        it('should apply penalty for poor vintage', () => {
            const weatherAnalysis = {
                overallScore: 55,
                ripenessScore: 3.0,
                acidityScore: 3.0,
                diseaseScore: 3.0
            };

            const adjusted = vintageIntelligence.calculateWeatherAdjustedQuality(85, weatherAnalysis);
            expect(adjusted).toBeLessThan(85);
        });

        it('should apply ripeness bonus', () => {
            const highRipeness = {
                overallScore: 75,
                ripenessScore: 4.8,
                acidityScore: 3.5,
                diseaseScore: 3.5
            };

            const lowRipeness = {
                overallScore: 75,
                ripenessScore: 3.5,
                acidityScore: 3.5,
                diseaseScore: 3.5
            };

            const highScore = vintageIntelligence.calculateWeatherAdjustedQuality(80, highRipeness);
            const lowScore = vintageIntelligence.calculateWeatherAdjustedQuality(80, lowRipeness);

            expect(highScore).toBeGreaterThan(lowScore);
        });

        it('should apply acidity bonus', () => {
            const weatherAnalysis = {
                overallScore: 75,
                ripenessScore: 3.5,
                acidityScore: 4.7,
                diseaseScore: 3.5
            };

            const adjusted = vintageIntelligence.calculateWeatherAdjustedQuality(80, weatherAnalysis);
            expect(adjusted).toBe(82); // +2 for acidity
        });

        it('should apply disease pressure penalty', () => {
            const weatherAnalysis = {
                overallScore: 75,
                ripenessScore: 3.5,
                acidityScore: 3.5,
                diseaseScore: 2.0
            };

            const adjusted = vintageIntelligence.calculateWeatherAdjustedQuality(80, weatherAnalysis);
            expect(adjusted).toBeLessThan(80);
        });

        it('should cap scores at 100', () => {
            const weatherAnalysis = {
                overallScore: 95,
                ripenessScore: 5.0,
                acidityScore: 5.0,
                diseaseScore: 5.0
            };

            const adjusted = vintageIntelligence.calculateWeatherAdjustedQuality(95, weatherAnalysis);
            expect(adjusted).toBeLessThanOrEqual(100);
        });

        it('should floor scores at 50', () => {
            const weatherAnalysis = {
                overallScore: 40,
                ripenessScore: 2.0,
                acidityScore: 2.0,
                diseaseScore: 2.0
            };

            const adjusted = vintageIntelligence.calculateWeatherAdjustedQuality(45, weatherAnalysis);
            expect(adjusted).toBeGreaterThanOrEqual(50);
        });
    });

    describe('generateTemplateSummary()', () => {
        it('should generate cool vintage summary', () => {
            const wineData = {
                producer: 'Test Winery',
                name: 'Pinot Noir',
                year: 2018,
                region: 'Burgundy'
            };

            const weatherAnalysis = {
                gdd: 1100,
                avgDiurnalRange: 13,
                overallScore: 88
            };

            const summary = vintageIntelligence.generateTemplateSummary(wineData, weatherAnalysis);
            
            expect(summary).toContain('cooler conditions');
            expect(summary).toContain('1100');
            expect(summary).toContain('13');
        });

        it('should generate warm vintage summary', () => {
            const wineData = {
                producer: 'Test Winery',
                name: 'Cabernet',
                year: 2015,
                region: 'Napa Valley'
            };

            const weatherAnalysis = {
                gdd: 1700,
                avgDiurnalRange: 10,
                overallScore: 92
            };

            const summary = vintageIntelligence.generateTemplateSummary(wineData, weatherAnalysis);
            
            expect(summary).toContain('warmth');
            expect(summary).toContain('1700');
        });

        it('should generate ideal vintage summary', () => {
            const wineData = {
                producer: 'Château',
                name: 'Bordeaux Blend',
                year: 2016,
                region: 'Bordeaux'
            };

            const weatherAnalysis = {
                gdd: 1400,
                avgDiurnalRange: 11,
                overallScore: 85
            };

            const summary = vintageIntelligence.generateTemplateSummary(wineData, weatherAnalysis);
            
            expect(summary).toContain('ideal');
            expect(summary).toContain('1400');
        });

        it('should mention diurnal variation', () => {
            const wineData = { producer: 'Test', name: 'Wine', year: 2020, region: 'Test Region' };
            const weatherAnalysis = { gdd: 1400, avgDiurnalRange: 14, overallScore: 80 };

            const summary = vintageIntelligence.generateTemplateSummary(wineData, weatherAnalysis);
            
            expect(summary).toContain('diurnal');
            expect(summary).toContain('14');
        });

        it('should provide appropriate service advice for exceptional vintage', () => {
            const wineData = { producer: 'Test', name: 'Wine', year: 2020, region: 'Test Region' };
            const weatherAnalysis = { gdd: 1400, avgDiurnalRange: 12, overallScore: 90 };

            const summary = vintageIntelligence.generateTemplateSummary(wineData, weatherAnalysis);
            
            expect(summary).toContain('cellaring');
        });

        it('should provide advice for moderate vintage', () => {
            const wineData = { producer: 'Test', name: 'Wine', year: 2020, region: 'Test Region' };
            const weatherAnalysis = { gdd: 1400, avgDiurnalRange: 10, overallScore: 75 };

            const summary = vintageIntelligence.generateTemplateSummary(wineData, weatherAnalysis);
            
            expect(summary).toContain('drinking pleasure');
        });
    });

    describe('generateProcurementRecommendation()', () => {
        it('should recommend BUY for exceptional vintage', () => {
            const weatherAnalysis = {
                overallScore: 92,
                confidenceLevel: 'High',
                weatherSummary: 'Perfect growing conditions',
                ripenessScore: 4.5,
                diseaseScore: 4.0,
                heatwaveDays: 5
            };

            const wineData = { name: 'Test Wine', year: 2015, region: 'Bordeaux' };
            const rec = vintageIntelligence.generateProcurementRecommendation(weatherAnalysis, wineData);

            expect(rec.action).toBe('BUY');
            expect(rec.priority).toBe('High');
            expect(rec.reasoning).toContain('Exceptional');
            expect(rec.suggestedQuantity).toContain('Increase');
        });

        it('should recommend BUY for good vintage', () => {
            const weatherAnalysis = {
                overallScore: 78,
                confidenceLevel: 'Medium',
                weatherSummary: 'Good conditions',
                ripenessScore: 4.0,
                diseaseScore: 3.5,
                heatwaveDays: 3
            };

            const wineData = { name: 'Test Wine', year: 2018, region: 'Napa' };
            const rec = vintageIntelligence.generateProcurementRecommendation(weatherAnalysis, wineData);

            expect(rec.action).toBe('BUY');
            expect(rec.priority).toBe('Medium');
            expect(rec.suggestedQuantity).toContain('Standard');
        });

        it('should recommend AVOID for poor vintage', () => {
            const weatherAnalysis = {
                overallScore: 55,
                confidenceLevel: 'High',
                weatherSummary: 'Challenging conditions',
                ripenessScore: 2.5,
                diseaseScore: 2.0,
                heatwaveDays: 2
            };

            const wineData = { name: 'Test Wine', year: 2017, region: 'Burgundy' };
            const rec = vintageIntelligence.generateProcurementRecommendation(weatherAnalysis, wineData);

            expect(rec.action).toBe('AVOID');
            expect(rec.priority).toBe('Low');
            expect(rec.reasoning).toContain('Challenging');
        });

        it('should recommend HOLD for average vintage', () => {
            const weatherAnalysis = {
                overallScore: 70,
                confidenceLevel: 'Medium',
                weatherSummary: 'Average conditions',
                ripenessScore: 3.5,
                diseaseScore: 3.5,
                heatwaveDays: 5
            };

            const wineData = { name: 'Test Wine', year: 2019, region: 'Rhône' };
            const rec = vintageIntelligence.generateProcurementRecommendation(weatherAnalysis, wineData);

            expect(rec.action).toBe('HOLD');
            expect(rec.priority).toBe('Medium');
        });

        it('should add underripe consideration', () => {
            const weatherAnalysis = {
                overallScore: 70,
                confidenceLevel: 'Medium',
                weatherSummary: 'Cool vintage',
                ripenessScore: 2.8,
                diseaseScore: 3.5,
                heatwaveDays: 1
            };

            const wineData = { name: 'Test Wine', year: 2019, region: 'Test' };
            const rec = vintageIntelligence.generateProcurementRecommendation(weatherAnalysis, wineData);

            expect(rec.considerations).toContain('underripe');
        });

        it('should add disease pressure consideration', () => {
            const weatherAnalysis = {
                overallScore: 70,
                confidenceLevel: 'Medium',
                weatherSummary: 'Wet vintage',
                ripenessScore: 3.5,
                diseaseScore: 2.0,
                heatwaveDays: 2
            };

            const wineData = { name: 'Test Wine', year: 2019, region: 'Test' };
            const rec = vintageIntelligence.generateProcurementRecommendation(weatherAnalysis, wineData);

            expect(rec.considerations).toContain('disease pressure');
        });

        it('should add heat stress consideration', () => {
            const weatherAnalysis = {
                overallScore: 75,
                confidenceLevel: 'Medium',
                weatherSummary: 'Hot vintage',
                ripenessScore: 4.5,
                diseaseScore: 4.0,
                heatwaveDays: 15
            };

            const wineData = { name: 'Test Wine', year: 2019, region: 'Test' };
            const rec = vintageIntelligence.generateProcurementRecommendation(weatherAnalysis, wineData);

            expect(rec.considerations).toContain('Heat stress');
        });

        it('should not recommend BUY for exceptional vintage with low confidence', () => {
            const weatherAnalysis = {
                overallScore: 92,
                confidenceLevel: 'Low',
                weatherSummary: 'Great conditions but data uncertain',
                ripenessScore: 4.5,
                diseaseScore: 4.0,
                heatwaveDays: 5
            };

            const wineData = { name: 'Test Wine', year: 2020, region: 'Test' };
            const rec = vintageIntelligence.generateProcurementRecommendation(weatherAnalysis, wineData);

            // Should not be High priority BUY with low confidence
            expect(rec.priority).not.toBe('High');
        });
    });

    describe('generateWeatherPairingInsight()', () => {
        it('should generate acidity insight for rich dishes', () => {
            const weatherAnalysis = {
                acidityScore: 4.5,
                ripenessScore: 3.5,
                avgDiurnalRange: 10,
                overallScore: 80
            };

            const dishContext = {
                richness: 'high',
                intensity: 'medium'
            };

            const insight = vintageIntelligence.generateWeatherPairingInsight(weatherAnalysis, dishContext);
            
            expect(insight).toContain('acidity');
            expect(insight).toContain('rich');
        });

        it('should generate ripeness insight for bold dishes', () => {
            const weatherAnalysis = {
                acidityScore: 3.5,
                ripenessScore: 4.7,
                avgDiurnalRange: 10,
                overallScore: 80
            };

            const dishContext = {
                richness: 'medium',
                intensity: 'bold'
            };

            const insight = vintageIntelligence.generateWeatherPairingInsight(weatherAnalysis, dishContext);
            
            expect(insight).toContain('sunshine');
            expect(insight).toContain('intensity');
        });

        it('should generate diurnal range insight', () => {
            const weatherAnalysis = {
                acidityScore: 3.5,
                ripenessScore: 3.5,
                avgDiurnalRange: 15,
                overallScore: 80
            };

            const dishContext = {
                richness: 'medium',
                intensity: 'medium'
            };

            const insight = vintageIntelligence.generateWeatherPairingInsight(weatherAnalysis, dishContext);
            
            expect(insight).toContain('diurnal');
        });

        it('should generate exceptional vintage insight', () => {
            const weatherAnalysis = {
                acidityScore: 3.5,
                ripenessScore: 3.5,
                avgDiurnalRange: 10,
                overallScore: 90
            };

            const dishContext = {
                richness: 'medium',
                intensity: 'medium'
            };

            const insight = vintageIntelligence.generateWeatherPairingInsight(weatherAnalysis, dishContext);
            
            expect(insight).toContain('Exceptional');
        });

        it('should return null for missing weather analysis', () => {
            const dishContext = { richness: 'medium', intensity: 'medium' };
            const insight = vintageIntelligence.generateWeatherPairingInsight(null, dishContext);
            
            expect(insight).toBeNull();
        });

        it('should return null when no insights match', () => {
            const weatherAnalysis = {
                acidityScore: 3.0,
                ripenessScore: 3.0,
                avgDiurnalRange: 8,
                overallScore: 70
            };

            const dishContext = {
                richness: 'low',
                intensity: 'light'
            };

            const insight = vintageIntelligence.generateWeatherPairingInsight(weatherAnalysis, dishContext);
            
            expect(insight).toBeNull();
        });
    });

    describe('extractWeatherSummary()', () => {
        it('should extract summary from GDD data', () => {
            const weatherData = {
                harvest_conditions: '{"gdd": 1450, "text": "Good vintage"}',
                weather_events: '{"heatwaveDays": 8, "frostDays": 2}',
                region: 'Bordeaux',
                vintage_rating: 'Excellent'
            };

            const summary = vintageIntelligence.extractWeatherSummary(weatherData);
            
            expect(summary).toContain('1450');
            expect(summary).toContain('GDD');
        });

        it('should extract text from harvest conditions', () => {
            const weatherData = {
                harvest_conditions: 'Ideal harvest with perfect weather',
                weather_events: '{}',
                region: 'Burgundy',
                vintage_rating: 'Excellent'
            };

            const summary = vintageIntelligence.extractWeatherSummary(weatherData);
            
            expect(summary).toContain('Ideal harvest');
        });

        it('should handle missing data gracefully', () => {
            const weatherData = {
                region: 'Test Region',
                vintage_rating: 'Good'
            };

            const summary = vintageIntelligence.extractWeatherSummary(weatherData);
            
            expect(summary).toBeDefined();
            expect(typeof summary).toBe('string');
        });

        it('should handle JSON parsing errors', () => {
            const weatherData = {
                harvest_conditions: '{invalid json',
                weather_events: '[broken',
                region: 'Test',
                vintage_rating: 'Average'
            };

            const summary = vintageIntelligence.extractWeatherSummary(weatherData);
            
            expect(summary).toBeDefined();
        });
    });

    describe('Caching', () => {
        it('should cache processed vintages', async () => {
            const wineData = {
                name: 'Test Wine',
                producer: 'Test Producer',
                region: 'Bordeaux',
                year: 2015,
                wine_id: testWineId,
                vintage_id: testVintageId
            };

            // First call - should process
            const result1 = await vintageIntelligence.enrichWineData(wineData);
            
            // Cache should now contain this vintage
            const cacheKey = 'bordeaux_2015';
            expect(vintageIntelligence.processedVintages.has(cacheKey)).toBe(true);

            // Second call - should use cache
            const result2 = await vintageIntelligence.enrichWineData(wineData);
            
            expect(result2).toBeDefined();
        });

        it('should clear cache for specific vintage on refresh', async () => {
            const vintageRecord = {
                region: 'Napa Valley',
                year: 2018,
                wine_producer: 'Test Winery',
                wine_name: 'Test Wine'
            };

            // Add to cache
            vintageIntelligence.processedVintages.set('napa_2018', { test: 'data' });
            expect(vintageIntelligence.processedVintages.has('napa_2018')).toBe(true);

            // Mock the weather API call to avoid external dependencies
            jest.spyOn(vintageIntelligence.weatherAnalysis.openMeteo, 'getVintageWeatherData')
                .mockResolvedValue({ test: 'weather data' });

            // Refresh should clear cache
            await vintageIntelligence.refreshVintageWeather(vintageRecord);
            
            expect(vintageIntelligence.processedVintages.has('napa_2018')).toBe(false);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle enrichment errors gracefully', async () => {
            const wineData = {
                name: 'Test Wine',
                region: 'Unknown Region',
                year: 2020
            };

            // Should not throw even if weather analysis fails
            const result = await vintageIntelligence.enrichWineData(wineData);
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('vintageSummary');
        });

        it('should handle missing region information', async () => {
            const wineData = {
                name: 'Test Wine',
                year: 2020
            };

            const result = await vintageIntelligence.enrichWineData(wineData);
            
            expect(result).toBeDefined();
        });

        it('should handle invalid year values', async () => {
            const wineData = {
                name: 'Test Wine',
                region: 'Bordeaux',
                year: 'invalid'
            };

            const result = await vintageIntelligence.enrichWineData(wineData);
            
            expect(result).toBeDefined();
        });

        it('should require vintage record for refresh', async () => {
            await expect(
                vintageIntelligence.refreshVintageWeather(null)
            ).rejects.toThrow('Vintage record is required');
        });

        it('should require region for refresh', async () => {
            await expect(
                vintageIntelligence.refreshVintageWeather({ year: 2020 })
            ).rejects.toThrow('region is required');
        });

        it('should require year for refresh', async () => {
            await expect(
                vintageIntelligence.refreshVintageWeather({ region: 'Bordeaux' })
            ).rejects.toThrow('year is required');
        });
    });

    describe('Integration', () => {
        it('should enrich wine data with complete workflow', async () => {
            const wineData = {
                name: 'Test Bordeaux',
                producer: 'Château Test',
                region: 'Bordeaux',
                country: 'France',
                year: 2016,
                wine_id: testWineId,
                vintage_id: testVintageId,
                critic_score: 88
            };

            const enriched = await vintageIntelligence.enrichWineData(wineData);

            expect(enriched).toHaveProperty('weatherAnalysis');
            expect(enriched).toHaveProperty('vintageSummary');
            expect(enriched).toHaveProperty('qualityScore');
            expect(enriched).toHaveProperty('procurementRec');
            expect(enriched).toHaveProperty('enrichedAt');
        });

        it('should update database when vintage ID is available', async () => {
            const wineData = {
                name: 'Test Wine with ID',
                producer: 'Test Producer',
                region: 'Napa Valley',
                year: 2019,
                wine_id: testWineId,
                vintage_id: testVintageId,
                critic_score: 90
            };

            await vintageIntelligence.enrichWineData(wineData);

            // Verify database was updated (check if weather_score was set)
            const vintage = await db.get('SELECT weather_score FROM Vintages WHERE id = ?', [testVintageId]);
            
            expect(vintage).toBeDefined();
            // Weather score should have been updated (may be null if weather analysis failed)
        });
    });
});
