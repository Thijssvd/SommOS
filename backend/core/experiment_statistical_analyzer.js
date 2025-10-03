/**
 * Experiment Statistical Analyzer
 * Performs statistical analysis on A/B test results including significance testing,
 * confidence intervals, and Bayesian analysis
 */

const Database = require('../database/connection');

class ExperimentStatisticalAnalyzer {
    constructor(database) {
        this.db = database || Database.getInstance();
    }

    /**
     * Perform comprehensive statistical analysis comparing control and test variants
     */
    async analyzeExperiment(experimentId, metric = 'conversion_rate') {
        // Get experiment variants
        const variants = await this.db.all(`
            SELECT * FROM ExperimentVariants
            WHERE experiment_id = ?
            ORDER BY is_control DESC
        `, [experimentId]);

        if (variants.length < 2) {
            throw new Error('Need at least 2 variants for analysis');
        }

        const control = variants.find(v => v.is_control);
        const testVariants = variants.filter(v => !v.is_control);

        if (!control) {
            throw new Error('No control variant found');
        }

        const results = [];

        for (const testVariant of testVariants) {
            const analysis = await this.compareVariants(
                experimentId,
                control.id,
                testVariant.id,
                metric
            );

            results.push({
                control_variant: control.name,
                test_variant: testVariant.name,
                ...analysis
            });

            // Store analysis in database
            await this.storeAnalysis(experimentId, control.id, testVariant.id, analysis);
        }

        return results;
    }

    /**
     * Compare two variants statistically
     */
    async compareVariants(experimentId, controlId, testId, metric = 'conversion_rate') {
        // Get metrics for both variants
        const controlMetrics = await this.getVariantMetrics(experimentId, controlId);
        const testMetrics = await this.getVariantMetrics(experimentId, testId);

        // Extract relevant data based on metric type
        const metricData = this.extractMetricData(controlMetrics, testMetrics, metric);

        // Perform t-test
        const tTestResults = this.performTTest(
            metricData.control.values,
            metricData.test.values,
            metricData.control.n,
            metricData.test.n
        );

        // Calculate confidence intervals
        const controlCI = this.calculateConfidenceInterval(
            metricData.control.mean,
            metricData.control.std,
            metricData.control.n
        );

        const testCI = this.calculateConfidenceInterval(
            metricData.test.mean,
            metricData.test.std,
            metricData.test.n
        );

        // Calculate effect size and lift
        const effectSize = metricData.test.mean - metricData.control.mean;
        const relativeLift = metricData.control.mean !== 0 
            ? (effectSize / metricData.control.mean) * 100
            : 0;

        // Bayesian analysis
        const bayesianResults = this.performBayesianAnalysis(
            metricData.control,
            metricData.test
        );

        // Determine significance and recommendation
        const isSignificant = tTestResults.pValue < 0.05;
        const recommendation = this.makeRecommendation(
            isSignificant,
            effectSize,
            relativeLift,
            tTestResults.pValue,
            bayesianResults
        );

        return {
            metric,
            control_metrics: {
                mean: metricData.control.mean,
                std: metricData.control.std,
                n: metricData.control.n,
                confidence_interval: controlCI
            },
            test_metrics: {
                mean: metricData.test.mean,
                std: metricData.test.std,
                n: metricData.test.n,
                confidence_interval: testCI
            },
            statistical_tests: {
                t_test: {
                    t_statistic: tTestResults.tStat,
                    p_value: tTestResults.pValue,
                    degrees_of_freedom: tTestResults.df
                },
                effect_size: effectSize,
                relative_lift: relativeLift,
                is_significant: isSignificant
            },
            bayesian_analysis: bayesianResults,
            recommendation
        };
    }

    /**
     * Get metrics for a specific variant
     */
    async getVariantMetrics(experimentId, variantId) {
        const events = await this.db.all(`
            SELECT 
                event_type,
                event_value,
                user_id
            FROM ExperimentEvents
            WHERE experiment_id = ? AND variant_id = ?
        `, [experimentId, variantId]);

        // Group events by type
        const byType = {};
        const userEvents = {};

        for (const event of events) {
            if (!byType[event.event_type]) {
                byType[event.event_type] = [];
            }
            byType[event.event_type].push(event.event_value);

            if (!userEvents[event.user_id]) {
                userEvents[event.user_id] = new Set();
            }
            userEvents[event.user_id].add(event.event_type);
        }

        return {
            events: byType,
            users: userEvents,
            totalUsers: Object.keys(userEvents).length
        };
    }

    /**
     * Extract specific metric data for analysis
     */
    extractMetricData(controlMetrics, testMetrics, metric) {
        let controlValues, testValues;

        if (metric === 'conversion_rate') {
            // Binary outcome: did user convert?
            const controlConversions = Array.from(Object.values(controlMetrics.users))
                .map(events => events.has('conversion') ? 1 : 0);
            const testConversions = Array.from(Object.values(testMetrics.users))
                .map(events => events.has('conversion') ? 1 : 0);

            controlValues = controlConversions;
            testValues = testConversions;

        } else if (metric === 'avg_rating') {
            // Continuous outcome: rating values
            controlValues = (controlMetrics.events.rating || []).filter(v => v !== null);
            testValues = (testMetrics.events.rating || []).filter(v => v !== null);

        } else if (metric === 'ctr') {
            // Click-through rate
            const controlCTR = Array.from(Object.values(controlMetrics.users))
                .map(events => events.has('click') ? 1 : 0);
            const testCTR = Array.from(Object.values(testMetrics.users))
                .map(events => events.has('click') ? 1 : 0);

            controlValues = controlCTR;
            testValues = testCTR;
        } else {
            throw new Error(`Unsupported metric: ${metric}`);
        }

        return {
            control: {
                values: controlValues,
                mean: this.mean(controlValues),
                std: this.standardDeviation(controlValues),
                n: controlValues.length
            },
            test: {
                values: testValues,
                mean: this.mean(testValues),
                std: this.standardDeviation(testValues),
                n: testValues.length
            }
        };
    }

    /**
     * Perform independent two-sample t-test
     */
    performTTest(values1, values2, n1, n2) {
        const mean1 = this.mean(values1);
        const mean2 = this.mean(values2);
        const std1 = this.standardDeviation(values1);
        const std2 = this.standardDeviation(values2);

        // Welch's t-test (doesn't assume equal variances)
        const variance1 = std1 * std1;
        const variance2 = std2 * std2;

        const pooledStdError = Math.sqrt(variance1 / n1 + variance2 / n2);
        const tStat = (mean2 - mean1) / pooledStdError;

        // Welch-Satterthwaite degrees of freedom
        const df = Math.floor(
            Math.pow(variance1 / n1 + variance2 / n2, 2) /
            (Math.pow(variance1 / n1, 2) / (n1 - 1) + Math.pow(variance2 / n2, 2) / (n2 - 1))
        );

        // Calculate p-value (two-tailed)
        const pValue = this.tTestPValue(Math.abs(tStat), df);

        return {
            tStat,
            pValue,
            df
        };
    }

    /**
     * Calculate p-value for t-test (approximation)
     */
    tTestPValue(t, df) {
        // Approximation using normal distribution for large df
        if (df > 30) {
            return 2 * (1 - this.normalCDF(Math.abs(t)));
        }

        // For small df, use conservative estimate
        // In production, use a proper t-distribution library
        const x = df / (df + t * t);
        const a = df / 2;
        const b = 0.5;
        
        // Incomplete beta function approximation
        const betaApprox = this.incompleteBeta(x, a, b);
        return betaApprox;
    }

    /**
     * Normal cumulative distribution function
     */
    normalCDF(x) {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        return x > 0 ? 1 - prob : prob;
    }

    /**
     * Incomplete beta function (approximation)
     */
    incompleteBeta(x, a, b) {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        
        // Simple approximation for statistical testing
        // In production, use a proper implementation
        return Math.min(1, Math.max(0, 0.5 + (x - 0.5) * 0.8));
    }

    /**
     * Calculate confidence interval
     */
    calculateConfidenceInterval(mean, std, n, confidenceLevel = 0.95) {
        const z = 1.96; // 95% confidence level
        const marginOfError = z * (std / Math.sqrt(n));

        return {
            lower: mean - marginOfError,
            upper: mean + marginOfError,
            confidence_level: confidenceLevel
        };
    }

    /**
     * Bayesian analysis for conversion rates
     */
    performBayesianAnalysis(controlData, testData) {
        // Using Beta-Binomial conjugate prior
        // Prior: Beta(1, 1) - uniform prior
        const alpha_prior = 1;
        const beta_prior = 1;

        // Control posterior
        const controlSuccesses = controlData.values.filter(v => v === 1).length;
        const controlFailures = controlData.n - controlSuccesses;
        const alpha_control = alpha_prior + controlSuccesses;
        const beta_control = beta_prior + controlFailures;

        // Test posterior
        const testSuccesses = testData.values.filter(v => v === 1).length;
        const testFailures = testData.n - testSuccesses;
        const alpha_test = alpha_prior + testSuccesses;
        const beta_test = beta_prior + testFailures;

        // Monte Carlo simulation to estimate P(test > control)
        const samples = 10000;
        let testWins = 0;

        for (let i = 0; i < samples; i++) {
            const controlSample = this.betaSample(alpha_control, beta_control);
            const testSample = this.betaSample(alpha_test, beta_test);
            
            if (testSample > controlSample) {
                testWins++;
            }
        }

        const probabilityOfSuperiority = testWins / samples;

        // Expected loss (simplified)
        const controlMean = alpha_control / (alpha_control + beta_control);
        const testMean = alpha_test / (alpha_test + beta_test);
        const expectedLoss = Math.max(0, controlMean - testMean);

        return {
            probability_of_superiority: probabilityOfSuperiority,
            expected_loss: expectedLoss,
            control_posterior: {
                alpha: alpha_control,
                beta: beta_control,
                mean: controlMean
            },
            test_posterior: {
                alpha: alpha_test,
                beta: beta_test,
                mean: testMean
            }
        };
    }

    /**
     * Sample from Beta distribution
     */
    betaSample(alpha, beta) {
        // Using Gamma ratio method
        const gamma1 = this.gammaSample(alpha);
        const gamma2 = this.gammaSample(beta);
        return gamma1 / (gamma1 + gamma2);
    }

    /**
     * Sample from Gamma distribution (simple approximation)
     */
    gammaSample(shape) {
        // For shape > 1, use simple approximation
        if (shape < 1) {
            return this.gammaSample(1 + shape) * Math.pow(Math.random(), 1 / shape);
        }
        
        // Marsaglia and Tsang method (simplified)
        const d = shape - 1 / 3;
        const c = 1 / Math.sqrt(9 * d);
        
        while (true) {
            let x, v;
            do {
                x = this.normalSample();
                v = 1 + c * x;
            } while (v <= 0);
            
            v = v * v * v;
            const u = Math.random();
            
            if (u < 1 - 0.0331 * x * x * x * x) {
                return d * v;
            }
            
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
                return d * v;
            }
        }
    }

    /**
     * Sample from standard normal distribution
     */
    normalSample() {
        // Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    /**
     * Make recommendation based on analysis
     */
    makeRecommendation(isSignificant, effectSize, relativeLift, pValue, bayesianResults) {
        if (!isSignificant) {
            return {
                decision: 'iterate',
                reason: `No statistically significant difference detected (p=${pValue.toFixed(4)})`,
                confidence: 'low'
            };
        }

        if (effectSize > 0 && bayesianResults.probability_of_superiority > 0.95) {
            return {
                decision: 'launch',
                reason: `Test variant shows significant improvement (+${relativeLift.toFixed(2)}% lift, ${(bayesianResults.probability_of_superiority * 100).toFixed(1)}% probability of superiority)`,
                confidence: 'high'
            };
        }

        if (effectSize < 0) {
            return {
                decision: 'stop',
                reason: `Test variant performs worse than control (${relativeLift.toFixed(2)}% decrease)`,
                confidence: 'high'
            };
        }

        return {
            decision: 'continue',
            reason: `Significant difference detected but needs more data for strong conclusion`,
            confidence: 'medium'
        };
    }

    /**
     * Store analysis results in database
     */
    async storeAnalysis(experimentId, controlId, testId, analysis) {
        await this.db.run(`
            INSERT INTO ExperimentAnalysis (
                experiment_id, control_variant_id, test_variant_id,
                test_type, p_value, confidence_level, effect_size,
                relative_lift, probability_of_superiority, expected_loss,
                is_significant, recommendation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            experimentId,
            controlId,
            testId,
            't-test',
            analysis.statistical_tests.t_test.p_value,
            0.95,
            analysis.statistical_tests.effect_size,
            analysis.statistical_tests.relative_lift,
            analysis.bayesian_analysis.probability_of_superiority,
            analysis.bayesian_analysis.expected_loss,
            analysis.statistical_tests.is_significant ? 1 : 0,
            JSON.stringify(analysis.recommendation)
        ]);
    }

    /**
     * Calculate mean
     */
    mean(values) {
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    /**
     * Calculate standard deviation
     */
    standardDeviation(values) {
        if (values.length === 0) return 0;
        const avg = this.mean(values);
        const squareDiffs = values.map(value => Math.pow(value - avg, 2));
        const variance = this.mean(squareDiffs);
        return Math.sqrt(variance);
    }

    /**
     * Calculate sample size needed for desired power
     */
    calculateRequiredSampleSize(baselineRate, minimumDetectableEffect, power = 0.8, alpha = 0.05) {
        // Simplified calculation for binary outcomes
        const z_alpha = 1.96; // For alpha = 0.05 (two-tailed)
        const z_beta = 0.84; // For power = 0.8
        
        const p1 = baselineRate;
        const p2 = baselineRate * (1 + minimumDetectableEffect);
        
        const pooledP = (p1 + p2) / 2;
        const numerator = Math.pow(z_alpha * Math.sqrt(2 * pooledP * (1 - pooledP)) + 
                                   z_beta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2);
        const denominator = Math.pow(p2 - p1, 2);
        
        return Math.ceil(numerator / denominator);
    }
}

module.exports = ExperimentStatisticalAnalyzer;
