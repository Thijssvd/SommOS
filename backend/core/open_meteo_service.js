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

class OpenMeteoService {
    constructor() {
        this.baseUrl = 'https://archive-api.open-meteo.com/v1/archive';
        this.geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';

        // Wine region coordinates cache to minimize geocoding requests
        this.regionCoordinates = new Map();

        // Initialize with major wine regions
        this.initializeWineRegions();
    }

    shouldBypassNetwork() {
        return ['test', 'performance'].includes(process.env.NODE_ENV) ||
            process.env.SOMMOS_DISABLE_EXTERNAL_CALLS === 'true';
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
            const response = await axios.get(this.geocodingUrl, {
                params: {
                    name: regionName,
                    count: 1,
                    language: 'en',
                    format: 'json'
                },
                timeout: 5000
            });

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
        if (this.shouldBypassNetwork()) {
            return null;
        }

        console.log(`Fetching Open-Meteo data for ${region} ${year}`);

        try {
            // Get coordinates for the region
            const coordinates = await this.getRegionCoordinates(region);

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

            // Request comprehensive weather data
            const response = await axios.get(this.baseUrl, {
                params,
                timeout: options.timeout || 15000,
                headers: {
                    'User-Agent': 'SommOS Wine Management System/1.0'
                }
            });

            if (!response.data || !response.data.daily) {
                throw new Error('Invalid response from Open-Meteo API');
            }

            // Process the weather data for wine analysis
            return this.processVintageWeatherData(response.data, region, year);

        } catch (error) {
            console.error(`Open-Meteo API error for ${region} ${year}:`, error.message);
            throw new Error(`Failed to fetch weather data: ${error.message}`);
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
                evapotranspiration: daily.et0_fao_evapotranspiration[i] || 0
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
            wetDays,
            
            // Weather events
            heatwaveDays,
            frostDays,
            sunshineHours: Math.round(sunshineHours),
            
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
                sunshineHours
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
        const { gdd, avgTemp, totalRainfall, heatwaveDays, frostDays, avgDiurnalRange } = metrics;
        
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