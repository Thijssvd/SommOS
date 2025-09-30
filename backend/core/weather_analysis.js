/**
 * SommOS Weather Analysis Service
 * 
 * Comprehensive vintage weather analysis system that calculates:
 * - Growing Degree Days (GDD)
 * - Huglin Index
 * - Diurnal temperature range
 * - Phenological timing
 * - Weather impact scores for wine quality
 * 
 * Based on the detailed specifications from SommOS ChatGPT PDF
 */

const Database = require('../database/connection');
const OpenMeteoService = require('./open_meteo_service');

class WeatherAnalysisService {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.openMeteo = new OpenMeteoService();
        
        // Base temperatures for viticulture calculations
        this.baseTemperature = 10; // °C for GDD calculations
        this.huglinBaseTemp = 10; // °C for Huglin Index
        this.huglinMaxTemp = 50; // °C cap for Huglin Index
        
        // Phenological stages (days from budbreak)
        this.phenologyStages = {
            budbreak: 0,
            flowering: 60,
            veraison: 100,
            harvest: 140
        };
        
        // Regional climate data cache
        this.regionCache = new Map();
    }

    /**
     * Perform comprehensive weather analysis for a vintage
     * @param {string} region - Wine region
     * @param {number} year - Vintage year
     * @param {Object} weatherData - Historical weather data (optional)
     * @returns {Object} Complete weather analysis
     */
    async analyzeVintage(region, year, weatherData = null) {
        console.log(`Analyzing vintage weather for ${region} ${year}`);

        const normalizedRegion = typeof region === 'string' ? region.trim() : region;

        if (!weatherData) {
            const cachedAnalysis = await this.getCachedWeatherAnalysis(normalizedRegion, year);
            if (cachedAnalysis) {
                console.log(`✅ Using cached weather analysis for ${normalizedRegion} ${year}`);
                return cachedAnalysis;
            }
        }
        
        try {
            // First try Open-Meteo for real historical data
            if (!weatherData) {
                try {
                    const openMeteoData = await this.openMeteo.getVintageWeatherData(region, year);
                    if (openMeteoData && openMeteoData.gdd) {
                        console.log(`✅ Using Open-Meteo data for ${region} ${year}`);
                        
                        // Store in database for future use
                        await this.cacheWeatherAnalysis(openMeteoData);
                        
                        return openMeteoData;
                    }
                } catch (openMeteoError) {
                    console.warn(`Open-Meteo failed for ${region} ${year}:`, openMeteoError.message);
                    // Continue to fallback methods
                }
            }
            
            // Fallback to provided data or estimated analysis
            const weather = weatherData || await this.fetchWeatherData(region, year);
            
            if (!weather || !weather.dailyData || weather.dailyData.length < 100) {
                console.warn(`Using estimated analysis for ${region} ${year}`);
                return this.generateEstimatedAnalysis(region, year);
            }

            // Core weather calculations using legacy method
            const growingSeasonData = this.filterGrowingSeason(weather.dailyData, region);
            const thermalIndices = this.calculateThermalIndices(growingSeasonData);
            const phenologyTiming = this.calculatePhenologyTiming(growingSeasonData, region);
            const weatherEvents = this.identifyWeatherEvents(weather.dailyData, phenologyTiming);
            const qualityImpacts = this.assessQualityImpacts(thermalIndices, weatherEvents, phenologyTiming);
            
            // Generate vintage summary
            const vintageAnalysis = {
                region,
                year,
                dataSource: weather.source || 'estimated',
                dataQuality: 'Medium',
                
                // Thermal indices
                gdd: thermalIndices.gdd,
                huglinIndex: thermalIndices.huglinIndex,
                avgDiurnalRange: thermalIndices.avgDiurnalRange,
                heatwaveDays: thermalIndices.heatwaveDays,
                frostDays: thermalIndices.frostDays,
                
                // Phenology
                phenology: phenologyTiming,
                
                // Precipitation
                totalRainfall: weatherEvents.totalRainfall,
                floweringRain: weatherEvents.floweringRain,
                harvestRain: weatherEvents.harvestRain,
                droughtStress: weatherEvents.droughtStress,
                
                // Quality scores
                ripenessScore: qualityImpacts.ripeness,
                acidityScore: qualityImpacts.acidity,
                tanninScore: qualityImpacts.tannin,
                diseaseScore: qualityImpacts.disease,
                overallScore: qualityImpacts.overall,
                
                // Narrative
                weatherSummary: this.generateWeatherNarrative(thermalIndices, weatherEvents, qualityImpacts),
                confidenceLevel: this.calculateConfidence(weather.dataQuality || 'Medium'),
                
                // Metadata
                analyzedAt: new Date().toISOString()
            };

            // Cache results
            await this.cacheWeatherAnalysis(vintageAnalysis);
            
            return vintageAnalysis;
            
        } catch (error) {
            console.error(`Weather analysis failed for ${region} ${year}:`, error.message);
            return this.generateEstimatedAnalysis(region, year);
        }
    }

    /**
     * Calculate thermal indices (GDD, Huglin Index, diurnal range)
     */
    calculateThermalIndices(dailyData) {
        let gddSum = 0;
        let huglinSum = 0;
        let diurnalRanges = [];
        let heatwaveDays = 0;
        let frostDays = 0;

        for (const day of dailyData) {
            const tMax = day.tempMax;
            const tMin = day.tempMin;
            const tAvg = (tMax + tMin) / 2;

            // Growing Degree Days
            if (tAvg > this.baseTemperature) {
                gddSum += tAvg - this.baseTemperature;
            }

            // Huglin Index (modified for heat accumulation)
            if (tAvg > this.huglinBaseTemp) {
                const effectiveMax = Math.min(tMax, this.huglinMaxTemp);
                const huglinTemp = ((effectiveMax + tAvg) / 2) - this.huglinBaseTemp;
                huglinSum += huglinTemp * day.dayLength; // Include day length factor
            }

            // Diurnal temperature range
            const diurnalRange = tMax - tMin;
            diurnalRanges.push(diurnalRange);

            // Weather events
            if (tMax > 35) heatwaveDays++;
            if (tMin < 0) frostDays++;
        }

        return {
            gdd: Math.round(gddSum),
            huglinIndex: Math.round(huglinSum),
            avgDiurnalRange: Math.round(diurnalRanges.reduce((a, b) => a + b, 0) / diurnalRanges.length * 10) / 10,
            heatwaveDays,
            frostDays
        };
    }

    /**
     * Calculate phenological timing based on heat accumulation
     */
    calculatePhenologyTiming(dailyData, region) {
        const regionCalendar = this.getRegionCalendar(region);
        let gddAccumulated = 0;
        const phenologyDates = {};
        
        // GDD thresholds for phenological stages (varies by region and grape variety)
        const gddThresholds = {
            budbreak: 50,
            flowering: 400,
            veraison: 900,
            harvest: 1300
        };

        for (let i = 0; i < dailyData.length; i++) {
            const day = dailyData[i];
            const tAvg = (day.tempMax + day.tempMin) / 2;
            
            if (tAvg > this.baseTemperature) {
                gddAccumulated += tAvg - this.baseTemperature;
            }

            // Check for phenological milestones
            for (const [stage, threshold] of Object.entries(gddThresholds)) {
                if (!phenologyDates[stage] && gddAccumulated >= threshold) {
                    phenologyDates[stage] = {
                        date: day.date,
                        gdd: Math.round(gddAccumulated),
                        dayOfYear: i + regionCalendar.startDay
                    };
                }
            }
        }

        return phenologyDates;
    }

    /**
     * Identify significant weather events during key periods
     */
    identifyWeatherEvents(dailyData, phenologyTiming) {
        const events = {
            totalRainfall: 0,
            floweringRain: 0,
            harvestRain: 0,
            droughtPeriods: [],
            heatwaves: [],
            frostEvents: []
        };

        let consecutiveDryDays = 0;
        let consecutiveHeatDays = 0;

        for (let i = 0; i < dailyData.length; i++) {
            const day = dailyData[i];
            const dayOfYear = i + 90; // Assuming start from April 1st
            
            events.totalRainfall += day.precipitation || 0;

            // Flowering period rainfall (critical for fruit set)
            if (this.isDuringPeriod(dayOfYear, phenologyTiming.flowering, 14)) {
                events.floweringRain += day.precipitation || 0;
            }

            // Harvest period rainfall (affects quality and disease)
            if (this.isDuringPeriod(dayOfYear, phenologyTiming.harvest, 21)) {
                events.harvestRain += day.precipitation || 0;
            }

            // Drought stress detection
            if ((day.precipitation || 0) < 1) {
                consecutiveDryDays++;
            } else {
                if (consecutiveDryDays >= 14) {
                    events.droughtPeriods.push({
                        startDay: i - consecutiveDryDays,
                        duration: consecutiveDryDays
                    });
                }
                consecutiveDryDays = 0;
            }

            // Heatwave detection
            if (day.tempMax > 35) {
                consecutiveHeatDays++;
            } else {
                if (consecutiveHeatDays >= 3) {
                    events.heatwaves.push({
                        startDay: i - consecutiveHeatDays,
                        duration: consecutiveHeatDays,
                        maxTemp: Math.max(...dailyData.slice(i - consecutiveHeatDays, i).map(d => d.tempMax))
                    });
                }
                consecutiveHeatDays = 0;
            }
        }

        events.droughtStress = events.droughtPeriods.length > 0;
        
        return events;
    }

    /**
     * Assess quality impacts based on weather analysis
     */
    assessQualityImpacts(thermalIndices, weatherEvents, phenologyTiming) {
        // Ripeness potential (based on heat accumulation)
        let ripenessScore = 5; // Start with optimal
        if (thermalIndices.gdd < 1200) ripenessScore -= 2; // Insufficient heat
        if (thermalIndices.gdd > 1800) ripenessScore -= 1; // Excessive heat
        if (thermalIndices.heatwaveDays > 10) ripenessScore -= 1; // Heat stress

        // Acidity retention (based on diurnal range and heat)
        let acidityScore = 5;
        if (thermalIndices.avgDiurnalRange < 8) acidityScore -= 2; // Poor diurnal range
        if (thermalIndices.avgDiurnalRange > 15) acidityScore += 1; // Excellent cooling
        if (thermalIndices.heatwaveDays > 7) acidityScore -= 1; // Heat damage

        // Tannin development (balanced ripening)
        let tanninScore = 5;
        if (thermalIndices.gdd < 1100) tanninScore -= 2; // Underripe tannins
        if (weatherEvents.heatwaves.length > 2) tanninScore -= 1; // Harsh tannins
        if (thermalIndices.avgDiurnalRange > 12) tanninScore += 0.5; // Balanced development

        // Disease pressure (rain during sensitive periods)
        let diseaseScore = 5;
        if (weatherEvents.floweringRain > 50) diseaseScore -= 2; // Poor fruit set
        if (weatherEvents.harvestRain > 80) diseaseScore -= 2; // Botrytis/dilution risk
        if (weatherEvents.totalRainfall > 800) diseaseScore -= 1; // High disease pressure

        // Clamp scores to 1-5 range
        ripenessScore = Math.max(1, Math.min(5, ripenessScore));
        acidityScore = Math.max(1, Math.min(5, acidityScore));
        tanninScore = Math.max(1, Math.min(5, tanninScore));
        diseaseScore = Math.max(1, Math.min(5, diseaseScore));

        // Calculate overall score (weighted average)
        const overallScore = Math.round(
            (ripenessScore * 0.35 + 
             acidityScore * 0.25 + 
             tanninScore * 0.25 + 
             diseaseScore * 0.15) * 20
        ); // Scale to 0-100

        return {
            ripeness: Math.round(ripenessScore * 10) / 10,
            acidity: Math.round(acidityScore * 10) / 10,
            tannin: Math.round(tanninScore * 10) / 10,
            disease: Math.round(diseaseScore * 10) / 10,
            overall: Math.max(20, Math.min(100, overallScore))
        };
    }

    /**
     * Generate professional weather narrative
     */
    generateWeatherNarrative(thermalIndices, weatherEvents, qualityImpacts) {
        const narratives = [];
        
        // Heat accumulation narrative
        if (thermalIndices.gdd < 1200) {
            narratives.push(`Cool vintage with ${thermalIndices.gdd} GDD, promoting elegant structure and bright acidity`);
        } else if (thermalIndices.gdd > 1600) {
            narratives.push(`Warm vintage with ${thermalIndices.gdd} GDD, encouraging full ripeness and concentrated flavors`);
        } else {
            narratives.push(`Balanced vintage with ${thermalIndices.gdd} GDD, ideal for structured, age-worthy wines`);
        }

        // Diurnal range impact
        if (thermalIndices.avgDiurnalRange > 12) {
            narratives.push(`Excellent diurnal range of ${thermalIndices.avgDiurnalRange}°C preserved freshness and aromatic complexity`);
        } else if (thermalIndices.avgDiurnalRange < 8) {
            narratives.push(`Limited diurnal range of ${thermalIndices.avgDiurnalRange}°C may have reduced acidity retention`);
        }

        // Precipitation impacts
        if (weatherEvents.harvestRain > 50) {
            narratives.push(`${weatherEvents.harvestRain}mm harvest rainfall required careful selection and timing`);
        } else if (weatherEvents.droughtStress) {
            narratives.push(`Drought conditions concentrated flavors but may have stressed younger vines`);
        }

        // Overall quality assessment
        if (qualityImpacts.overall > 85) {
            narratives.push(`Exceptional vintage conditions produced wines of outstanding quality potential`);
        } else if (qualityImpacts.overall > 70) {
            narratives.push(`Good vintage conditions favor well-balanced, expressive wines`);
        } else {
            narratives.push(`Challenging conditions required skilled winemaking to optimize quality`);
        }

        return narratives.join('. ') + '.';
    }

    /**
     * Filter daily data to growing season (April-October in Northern Hemisphere)
     */
    filterGrowingSeason(dailyData, region) {
        const isNorthern = this.isNorthernHemisphere(region);
        
        // For Northern Hemisphere: April 1 - October 31 (days 91-304)
        // For Southern Hemisphere: October 1 - April 30 (days 274-120 of next year)
        
        if (isNorthern) {
            return dailyData.filter(day => {
                const dayOfYear = day.dayOfYear || this.getDayOfYear(day.date);
                return dayOfYear >= 91 && dayOfYear <= 304;
            });
        } else {
            return dailyData.filter(day => {
                const dayOfYear = day.dayOfYear || this.getDayOfYear(day.date);
                return dayOfYear >= 274 || dayOfYear <= 120;
            });
        }
    }

    /**
     * Check if a day falls within a specific period around a phenological event
     */
    isDuringPeriod(dayOfYear, phenologyEvent, windowDays) {
        if (!phenologyEvent || !phenologyEvent.dayOfYear) return false;
        
        const eventDay = phenologyEvent.dayOfYear;
        return Math.abs(dayOfYear - eventDay) <= windowDays / 2;
    }

    /**
     * Determine if region is in Northern Hemisphere
     */
    isNorthernHemisphere(region) {
        const southernRegions = [
            'australia', 'new zealand', 'south africa', 'chile', 'argentina', 'uruguay'
        ];
        return !southernRegions.some(sr => 
            region.toLowerCase().includes(sr)
        );
    }

    /**
     * Get region-specific growing calendar
     */
    getRegionCalendar(region) {
        // Simplified region calendar - in production would be from database
        const defaultCalendar = {
            startDay: 91, // April 1st for Northern Hemisphere
            budbreak: 91,
            flowering: 151,
            veraison: 213,
            harvest: 273
        };

        return this.regionCache.get(region) || defaultCalendar;
    }

    /**
     * Calculate confidence level based on data quality
     */
    calculateConfidence(dataQuality) {
        if (!dataQuality) return 'Low';

        if (typeof dataQuality === 'string') {
            const normalized = dataQuality.toLowerCase();
            if (normalized === 'high') return 'High';
            if (normalized === 'medium') return 'Medium';
            return 'Low';
        }

        const completeness = typeof dataQuality.completeness === 'number'
            ? dataQuality.completeness
            : parseFloat(dataQuality.completeness) || 0;
        const accuracy = typeof dataQuality.accuracy === 'number'
            ? dataQuality.accuracy
            : parseFloat(dataQuality.accuracy) || 0;

        if (completeness > 0.9 && accuracy > 0.85) {
            return 'High';
        } else if (completeness > 0.7 && accuracy > 0.7) {
            return 'Medium';
        } else {
            return 'Low';
        }
    }

    /**
     * Fetch weather data (stub - would integrate with weather APIs)
     */
    async fetchWeatherData(region, year) {
        console.log(`Fetching weather data for ${region} ${year}`);
        
        // In production, this would call weather APIs like:
        // - NASA GISS temperature data
        // - NOAA climate data
        // - European Centre for Medium-Range Weather Forecasts
        // - Regional meteorological services
        
        // For now, return simulated data structure
        return null; // Will trigger estimated analysis
    }

    /**
     * Generate estimated analysis when historical data is unavailable
     */
    generateEstimatedAnalysis(region, year) {
        console.log(`Generating estimated analysis for ${region} ${year}`);

        // Use regional averages and year-specific adjustments
        const baseGDD = this.getRegionalBaseGDD(region);
        const yearAdjustment = this.getYearAdjustment(year);
        const estimatedRainfall = this.getRegionalRainfall(region);

        return {
            region,
            year,
            gdd: Math.round(baseGDD * yearAdjustment),
            huglinIndex: Math.round(baseGDD * 1.2 * yearAdjustment),
            avgDiurnalRange: this.getRegionalDiurnalRange(region),
            heatwaveDays: Math.round(this.getRegionalHeatwaveDays(region) * yearAdjustment),
            frostDays: this.getRegionalFrostDays(region),
            totalRainfall: estimatedRainfall,
            floweringRain: Math.round(estimatedRainfall * 0.18),
            harvestRain: Math.round(estimatedRainfall * 0.14),
            droughtStress: false,
            ripenessScore: 3.5,
            acidityScore: 3.5,
            tanninScore: 3.5,
            diseaseScore: 3.5,
            overallScore: 70,
            weatherSummary: `Estimated conditions for ${region} ${year} based on regional averages. Limited historical data available.`,
            confidenceLevel: 'Low',
            analyzedAt: new Date().toISOString(),
            dataSource: 'estimated'
        };
    }

    /**
     * Cache weather analysis results
     */
    async cacheWeatherAnalysis(analysis) {
        try {
            if (!analysis || !analysis.region || !analysis.year) {
                return;
            }

            const regionKey = analysis.region.trim();
            const growingSeasonTemp = analysis.avgTemp ?? null;
            const growingSeasonRain = analysis.totalRainfall ?? null;
            const qualityScore = Number.isFinite(analysis.overallScore)
                ? Number(analysis.overallScore)
                : parseFloat(analysis.overallScore) || 0;

            const harvestConditions = this.sanitizeForJson({
                gdd: analysis.gdd,
                huglinIndex: analysis.huglinIndex,
                avgDiurnalRange: analysis.avgDiurnalRange,
                avgTemp: growingSeasonTemp,
                floweringRain: analysis.floweringRain,
                harvestRain: analysis.harvestRain,
                ripenessScore: analysis.ripenessScore,
                acidityScore: analysis.acidityScore,
                tanninScore: analysis.tanninScore,
                diseaseScore: analysis.diseaseScore,
                weatherSummary: analysis.weatherSummary,
                confidenceLevel: analysis.confidenceLevel,
                dataSource: analysis.dataSource,
                dataQuality: analysis.dataQuality
            });

            const weatherEvents = this.sanitizeForJson({
                totalRainfall: analysis.totalRainfall,
                wetDays: analysis.wetDays,
                heatwaveDays: analysis.heatwaveDays,
                frostDays: analysis.frostDays,
                droughtStress: analysis.droughtStress
            });

            const harvestPayload = Object.keys(harvestConditions).length > 0
                ? JSON.stringify(harvestConditions)
                : null;
            const eventPayload = Object.keys(weatherEvents).length > 0
                ? JSON.stringify(weatherEvents)
                : null;

            await this.db.run(`
                INSERT OR REPLACE INTO WeatherVintage (
                    region, year, growing_season_temp_avg, growing_season_rainfall,
                    harvest_conditions, weather_events, quality_impact_score,
                    vintage_rating
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                regionKey,
                analysis.year,
                growingSeasonTemp,
                growingSeasonRain,
                harvestPayload,
                eventPayload,
                Math.max(-50, Math.min(50, Math.round(qualityScore - 50))),
                this.getVintageRating(qualityScore)
            ]);

            console.log(`Cached weather analysis for ${analysis.region} ${analysis.year}`);
        } catch (error) {
            console.error('Error caching weather analysis:', error.message);
        }
    }

    async clearCachedWeatherAnalysis(region, year) {
        if (!region || !year) {
            return;
        }

        try {
            await this.db.run(
                `DELETE FROM WeatherVintage WHERE LOWER(region) = LOWER(?) AND year = ?`,
                [region, year]
            );
            console.log(`Cleared cached weather analysis for ${region} ${year}`);
        } catch (error) {
            console.error('Error clearing cached weather analysis:', error.message);
        }
    }

    sanitizeForJson(data) {
        return Object.fromEntries(
            Object.entries(data)
                .filter(([, value]) => value !== undefined && value !== null)
        );
    }

    async getCachedWeatherAnalysis(region, year) {
        if (!region || !year) {
            return null;
        }

        try {
            const cachedRow = await this.db.get(`
                SELECT region, year, growing_season_temp_avg, growing_season_rainfall,
                       harvest_conditions, weather_events, quality_impact_score,
                       vintage_rating, created_at
                FROM WeatherVintage
                WHERE LOWER(region) = LOWER(?) AND year = ?
            `, [region, year]);

            if (!cachedRow) {
                return null;
            }

            const parseJson = (value) => {
                if (!value || typeof value !== 'string') return {};
                try {
                    return JSON.parse(value);
                } catch (error) {
                    return {};
                }
            };

            const harvestData = parseJson(cachedRow.harvest_conditions);
            const eventData = parseJson(cachedRow.weather_events);
            const qualityScore = Math.max(-50, Math.min(50, cachedRow.quality_impact_score ?? 0)) + 50;

            const columnTempValue = cachedRow.growing_season_temp_avg;
            const hasStructuredAvgTemp = Object.prototype.hasOwnProperty.call(harvestData, 'avgTemp');
            const hasStructuredDiurnal = Object.prototype.hasOwnProperty.call(harvestData, 'avgDiurnalRange');
            const isLegacyPayload = !hasStructuredAvgTemp && !hasStructuredDiurnal
                && columnTempValue !== null && columnTempValue !== undefined;

            let avgTemp = null;
            if (hasStructuredAvgTemp) {
                avgTemp = harvestData.avgTemp ?? null;
            } else if (!isLegacyPayload && columnTempValue !== null && columnTempValue !== undefined) {
                avgTemp = columnTempValue;
            }

            let avgDiurnalRange = null;
            if (hasStructuredDiurnal) {
                avgDiurnalRange = harvestData.avgDiurnalRange ?? null;
            } else if (isLegacyPayload) {
                avgDiurnalRange = columnTempValue;
            }

            return {
                region: cachedRow.region,
                year: cachedRow.year,
                dataSource: harvestData.dataSource || 'database-cache',
                dataQuality: harvestData.dataQuality || 'High',
                gdd: harvestData.gdd ?? null,
                huglinIndex: harvestData.huglinIndex ?? null,
                avgTemp,
                avgDiurnalRange,
                totalRainfall: cachedRow.growing_season_rainfall ?? eventData.totalRainfall ?? null,
                floweringRain: harvestData.floweringRain ?? null,
                harvestRain: harvestData.harvestRain ?? null,
                droughtStress: eventData.droughtStress ?? false,
                wetDays: eventData.wetDays ?? null,
                heatwaveDays: eventData.heatwaveDays ?? null,
                frostDays: eventData.frostDays ?? null,
                ripenessScore: harvestData.ripenessScore ?? null,
                acidityScore: harvestData.acidityScore ?? null,
                tanninScore: harvestData.tanninScore ?? null,
                diseaseScore: harvestData.diseaseScore ?? null,
                overallScore: Math.max(20, Math.min(100, qualityScore)),
                weatherSummary: harvestData.weatherSummary || '',
                confidenceLevel: harvestData.confidenceLevel
                    || this.calculateConfidence(harvestData.dataQuality || 'High'),
                vintageRating: cachedRow.vintage_rating,
                cachedAt: cachedRow.created_at,
                cached: true
            };
        } catch (error) {
            console.error('Error retrieving cached weather analysis:', error.message);
            return null;
        }
    }

    /**
     * Get regional baseline GDD
     */
    getRegionalBaseGDD(region) {
        const regionalGDD = {
            'bordeaux': 1450,
            'burgundy': 1250,
            'champagne': 1100,
            'rhône': 1600,
            'tuscany': 1550,
            'piedmont': 1400,
            'rioja': 1500,
            'douro': 1650,
            'napa': 1700,
            'sonoma': 1600,
            'willamette': 1350,
            'barossa': 1750,
            'hunter': 1650,
            'marlborough': 1200,
            'central otago': 1150
        };
        
        return regionalGDD[region.toLowerCase()] || 1400; // Default moderate climate
    }

    /**
     * Get regional average growing season rainfall (mm)
     */
    getRegionalRainfall(region) {
        const regionalRainfall = {
            'bordeaux': 520,
            'burgundy': 480,
            'champagne': 600,
            'rhône': 430,
            'tuscany': 420,
            'piedmont': 540,
            'rioja': 390,
            'douro': 360,
            'napa': 410,
            'sonoma': 430,
            'willamette': 520,
            'barossa': 300,
            'hunter': 520,
            'marlborough': 470,
            'central otago': 320
        };

        return regionalRainfall[region.toLowerCase()] || 450;
    }

    /**
     * Get year-specific adjustment factor
     */
    getYearAdjustment(year) {
        // Simplified climate change adjustment
        const baseYear = 1990;
        const warmingRate = 0.002; // 0.2% per year approximate warming
        
        return 1 + ((year - baseYear) * warmingRate);
    }

    /**
     * Get regional diurnal range
     */
    getRegionalDiurnalRange(region) {
        const regionalDiurnal = {
            'bordeaux': 10.5,
            'burgundy': 11.2,
            'champagne': 9.8,
            'rhône': 12.1,
            'tuscany': 11.8,
            'piedmont': 12.5,
            'rioja': 13.2,
            'douro': 12.8,
            'napa': 14.5,
            'sonoma': 13.8,
            'willamette': 11.0,
            'barossa': 15.2,
            'hunter': 12.8,
            'marlborough': 11.5,
            'central otago': 13.8
        };
        
        return regionalDiurnal[region.toLowerCase()] || 12.0;
    }

    /**
     * Get regional heatwave days
     */
    getRegionalHeatwaveDays(region) {
        const regionalHeatwave = {
            'bordeaux': 5,
            'burgundy': 3,
            'champagne': 2,
            'rhône': 8,
            'tuscany': 7,
            'piedmont': 4,
            'rioja': 9,
            'douro': 12,
            'napa': 15,
            'sonoma': 12,
            'willamette': 3,
            'barossa': 18,
            'hunter': 14,
            'marlborough': 2,
            'central otago': 4
        };
        
        return regionalHeatwave[region.toLowerCase()] || 6;
    }

    /**
     * Get regional frost days
     */
    getRegionalFrostDays(region) {
        const regionalFrost = {
            'bordeaux': 2,
            'burgundy': 4,
            'champagne': 6,
            'rhône': 1,
            'tuscany': 1,
            'piedmont': 3,
            'rioja': 2,
            'douro': 0,
            'napa': 1,
            'sonoma': 2,
            'willamette': 5,
            'barossa': 0,
            'hunter': 0,
            'marlborough': 8,
            'central otago': 12
        };
        
        return regionalFrost[region.toLowerCase()] || 2;
    }

    /**
     * Convert quality score to vintage rating
     */
    getVintageRating(score) {
        if (score >= 90) return 'Exceptional';
        if (score >= 85) return 'Excellent';
        if (score >= 80) return 'Very Good';
        if (score >= 70) return 'Good';
        if (score >= 60) return 'Average';
        if (score >= 50) return 'Below Average';
        return 'Poor';
    }

    /**
     * Get day of year from date string
     */
    getDayOfYear(dateStr) {
        const date = new Date(dateStr);
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
}

module.exports = WeatherAnalysisService;