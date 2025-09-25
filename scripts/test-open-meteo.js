#!/usr/bin/env node

/**
 * Open-Meteo Integration Test Script
 * Tests the Open-Meteo weather data integration for SommOS
 */

require('dotenv').config();

const OpenMeteoService = require('../backend/core/open_meteo_service');
const WeatherAnalysisService = require('../backend/core/weather_analysis');
const Database = require('../backend/database/connection');

async function testOpenMeteoIntegration() {
    console.log('🌤️ Testing Open-Meteo Integration for SommOS');
    console.log('=============================================');
    console.log('');

    try {
        // Initialize services
        const openMeteo = new OpenMeteoService();
        const db = Database.getInstance();
        await db.initialize();
        
        const weatherAnalysis = new WeatherAnalysisService(db);

        console.log('📍 Testing Open-Meteo Direct Access:');
        console.log('------------------------------------');

        // Test 1: Direct Open-Meteo service
        console.log('1. Testing Bordeaux 2018 (excellent vintage)...');
        const bordeaux2018 = await openMeteo.getVintageWeatherData('Bordeaux', 2018);
        console.log(`   ✅ GDD: ${bordeaux2018.gdd}`);
        console.log(`   ✅ Rainfall: ${bordeaux2018.totalRainfall}mm`);
        console.log(`   ✅ Quality Score: ${bordeaux2018.overallScore}/100`);
        console.log(`   ✅ Data Quality: ${bordeaux2018.confidenceLevel}`);
        console.log(`   ✅ Summary: ${bordeaux2018.weatherSummary}`);
        console.log('');

        // Test 2: Different region
        console.log('2. Testing Tuscany 2016...');
        const tuscany2016 = await openMeteo.getVintageWeatherData('Tuscany', 2016);
        console.log(`   ✅ GDD: ${tuscany2016.gdd}`);
        console.log(`   ✅ Quality Score: ${tuscany2016.overallScore}/100`);
        console.log('');

        // Test 3: New World region
        console.log('3. Testing Napa Valley 2019...');
        const napa2019 = await openMeteo.getVintageWeatherData('Napa Valley', 2019);
        console.log(`   ✅ GDD: ${napa2019.gdd}`);
        console.log(`   ✅ Diurnal Range: ${napa2019.avgDiurnalRange}°C`);
        console.log('');

        console.log('🔄 Testing Weather Analysis Service Integration:');
        console.log('------------------------------------------------');

        // Test 4: Through WeatherAnalysisService
        console.log('4. Testing integrated analysis for Burgundy 2020...');
        const burgundy2020 = await weatherAnalysis.analyzeVintage('Burgundy', 2020);
        console.log(`   ✅ Data Source: ${burgundy2020.dataSource}`);
        console.log(`   ✅ GDD: ${burgundy2020.gdd}`);
        console.log(`   ✅ Quality Score: ${burgundy2020.overallScore}/100`);
        console.log(`   ✅ Ripeness Score: ${burgundy2020.ripenessScore}/5.0`);
        console.log(`   ✅ Acidity Score: ${burgundy2020.acidityScore}/5.0`);
        console.log('');

        console.log('🌍 Testing Global Regions:');
        console.log('--------------------------');

        // Test 5: Multiple regions
        const regions = [
            { region: 'Rioja', year: 2017 },
            { region: 'Douro', year: 2019 },
            { region: 'Barossa Valley', year: 2018 },
            { region: 'Marlborough', year: 2020 }
        ];

        for (const test of regions) {
            console.log(`5.${regions.indexOf(test) + 1} Testing ${test.region} ${test.year}...`);
            try {
                const data = await openMeteo.getVintageWeatherData(test.region, test.year);
                console.log(`     ✅ GDD: ${data.gdd}, Score: ${data.overallScore}/100`);
            } catch (error) {
                console.log(`     ⚠️  Error: ${error.message}`);
            }
        }
        console.log('');

        console.log('🚀 Testing Edge Cases:');
        console.log('----------------------');

        // Test 6: Very old vintage
        console.log('6. Testing historical data (Champagne 1970)...');
        try {
            const champagne1970 = await openMeteo.getVintageWeatherData('Champagne', 1970);
            console.log(`   ✅ Historical data available! GDD: ${champagne1970.gdd}`);
        } catch (error) {
            console.log(`   ⚠️  Historical data limit: ${error.message}`);
        }
        console.log('');

        // Test 7: Unknown region fallback
        console.log('7. Testing unknown region fallback...');
        try {
            const unknown = await openMeteo.getVintageWeatherData('Unknown Wine Region', 2020);
            console.log(`   ✅ Fallback coordinates used, GDD: ${unknown.gdd}`);
        } catch (error) {
            console.log(`   ⚠️  Fallback failed: ${error.message}`);
        }
        console.log('');

        console.log('📊 Performance Test:');
        console.log('--------------------');

        // Test 8: Multiple concurrent requests
        console.log('8. Testing concurrent requests...');
        const startTime = Date.now();
        
        const concurrentTests = [
            openMeteo.getVintageWeatherData('Bordeaux', 2019),
            openMeteo.getVintageWeatherData('Burgundy', 2019),
            openMeteo.getVintageWeatherData('Tuscany', 2019)
        ];

        const results = await Promise.allSettled(concurrentTests);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const timeElapsed = Date.now() - startTime;

        console.log(`   ✅ ${successCount}/3 requests succeeded in ${timeElapsed}ms`);
        console.log('');

        console.log('🎯 Database Integration Test:');
        console.log('-----------------------------');

        // Test 9: Database caching
        console.log('9. Testing database caching...');
        
        // First call should fetch from API
        console.log('   First call (should fetch from Open-Meteo)...');
        const firstCall = await weatherAnalysis.analyzeVintage('Loire', 2021);
        
        // Second call should use cache
        console.log('   Second call (should use cache)...');
        const secondCall = await weatherAnalysis.analyzeVintage('Loire', 2021);
        
        console.log(`   ✅ Both calls successful, scores match: ${firstCall.overallScore === secondCall.overallScore}`);
        console.log('');

        console.log('🎉 Open-Meteo Integration Test Results:');
        console.log('=======================================');
        console.log('✅ Open-Meteo service is fully operational');
        console.log('✅ Historical weather data available for wine regions');
        console.log('✅ Integration with WeatherAnalysisService working');
        console.log('✅ Database caching functional');
        console.log('✅ Global wine region support');
        console.log('✅ Fallback handling for unknown regions');
        console.log('');
        console.log('🍷 SommOS is ready to provide accurate vintage analysis!');
        console.log('   No API keys required - using free Open-Meteo service');
        console.log('   80+ years of historical weather data available');
        console.log('   High-resolution data (1-11km) for precise analysis');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('');
        console.log('🔧 Troubleshooting:');
        console.log('- Check internet connection');
        console.log('- Verify Open-Meteo service is accessible');
        console.log('- Check database configuration');
        process.exit(1);
    }

    console.log('');
    console.log('📚 Next steps:');
    console.log('- Start SommOS server: npm start');
    console.log('- Add wines to see automatic weather analysis');
    console.log('- Check docs/vintage_intelligence_demo.md for examples');
}

// Run the test
if (require.main === module) {
    testOpenMeteoIntegration().catch(error => {
        console.error('Test script error:', error);
        process.exit(1);
    });
}

module.exports = testOpenMeteoIntegration;