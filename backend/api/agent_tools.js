'use strict';

// Agent tool definitions and handlers
// Read-only tools are safe for all roles. Mutating tools require admin/crew and idempotency when executing.

const { z } = require('zod');
const wineGuidanceService = require('../core/wine_guidance_service');
const {
    serializePairings,
    serializePairingResult,
    serializeInventoryItem,
    serializeInventoryLocations,
    serializeProcurementRecommendations,
    serializeWineDetail,
} = require('../utils/serialize');

const SAFE_ROLES = ['admin', 'crew', 'guest'];
const WRITE_ROLES = ['admin', 'crew'];

// Shared helpers
function assertRoleAllowed(userRole, allowedRoles) {
    const role = userRole || 'guest';
    if (!allowedRoles.includes(role)) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
    }
    return role;
}

function requireIdempotencyKey(options) {
    const key = options && options.idempotency_key;
    if (!key || typeof key !== 'string' || key.trim().length < 16) {
        const err = new Error('idempotency_key is required (min 16 chars)');
        err.status = 400;
        err.code = 'IDEMPOTENCY_KEY_REQUIRED';
        throw err;
    }
}

// Zod parameter schemas
const recommendPairingsParams = z.object({
    dish: z.string().min(2),
    context: z.record(z.any()).optional(),
    guestPreferences: z.record(z.any()).optional(),
    options: z
        .object({
            maxRecommendations: z.number().int().min(1).max(20).optional(),
            includeReasoning: z.boolean().optional(),
            forceAI: z.boolean().optional(),
        })
        .optional(),
});

const quickPairingParams = z.object({
    dish: z.string().min(2),
    context: z.record(z.any()).optional(),
});

const getInventoryParams = z.object({
    filters: z
        .object({
            location: z.string().optional(),
            wine_type: z.string().optional(),
            region: z.string().optional(),
            available_only: z.boolean().optional(),
        })
        .optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
});

const getWineDetailParams = z.object({
    wine_id: z.union([z.string(), z.number()]),
});

const getVintageWeatherParams = z.object({
    wine_id: z.union([z.string(), z.number()]).optional(),
    region: z.string().optional(),
    year: z.number().int().optional(),
    options: z.record(z.any()).optional(),
}).refine((p) => p.wine_id || (p.region && typeof p.year === 'number'), {
    message: 'Provide wine_id, or region and year',
});

const getVintagePairingInsightParams = z.object({
    wine_id: z.union([z.string(), z.number()]),
    dish_context: z.record(z.any()),
});

const getProcurementParams = z.object({
    filters: z.record(z.any()).optional(),
});

const getExplanationsParams = z.object({
    entity_type: z.string(),
    entity_id: z.string(),
    limit: z.number().int().min(1).max(200).optional(),
});

const systemHealthParams = z.object({});

// Mutating
const recordPairingFeedbackParams = z.object({
    recommendation_id: z.string().min(1),
    rating: z.number().min(1).max(5),
    notes: z.string().optional(),
    selected: z.boolean().optional(),
});

const enrichVintageParams = z.object({
    wine_id: z.union([z.string(), z.number()]),
});

const refreshVintageWeatherParams = z.object({
    vintage_id: z.union([z.string(), z.number()]),
    force: z.boolean().optional(),
});

// JSON Schemas (lightweight) for listing
function toJsonSchema(zodSchema) {
    // Minimal stub: report types for top-level keys only
    const shape = zodSchema._def.shape ? zodSchema._def.shape() : {};
    const properties = {};
    const required = [];
    for (const [key, def] of Object.entries(shape)) {
        const isOptional = def.isOptional?.() || def._def?.typeName === 'ZodOptional';
        if (!isOptional) required.push(key);
        properties[key] = { type: 'object' };
    }
    return { type: 'object', properties, required };
}

// Tool definitions
const tools = [
    {
        name: 'recommend_pairings',
        description: 'Generate AI-enhanced wine pairings from current inventory.',
        parameters: recommendPairingsParams,
        mutating: false,
        roles: SAFE_ROLES,
        handler: async (services, role, params) => {
            const { dish, context, guestPreferences, options } = recommendPairingsParams.parse(params);
            const result = await services.pairingEngine.generatePairings(
                dish,
                context || {},
                guestPreferences || {},
                options || {}
            );
            return serializePairingResult(result);
        },
    },
    {
        name: 'quick_pairing',
        description: 'Fast pairing generation optimized for service.',
        parameters: quickPairingParams,
        mutating: false,
        roles: SAFE_ROLES,
        handler: async (services, role, params) => {
            const { dish, context } = quickPairingParams.parse(params);
            const result = await services.pairingEngine.quickPairing(dish, context || {}, {});
            return { pairings: serializePairings(result) };
        },
    },
    {
        name: 'get_inventory',
        description: 'List inventory with filters and pagination.',
        parameters: getInventoryParams,
        mutating: false,
        roles: SAFE_ROLES,
        handler: async (services, userRole, params) => {
            const { filters = {}, limit, offset } = getInventoryParams.parse(params);
            const result = await services.inventoryManager.getInventoryList(filters, { limit, offset });
            const normalizedRole = userRole === 'admin' || userRole === 'crew' ? userRole : 'guest';
            const data = result.items.map((item) =>
                serializeInventoryItem(item, {
                    role: normalizedRole,
                    guidance: wineGuidanceService.getGuidance(item),
                })
            );
            return {
                items: data,
                total: result.total,
                limit: result.limit,
                offset: result.offset,
            };
        },
    },
    {
        name: 'get_wine_detail',
        description: 'Get a wine with vintage details and aggregates.',
        parameters: getWineDetailParams,
        mutating: false,
        roles: SAFE_ROLES,
        handler: async (services, role, params) => {
            const { wine_id } = getWineDetailParams.parse(params);
            const id = typeof wine_id === 'string' ? wine_id : String(wine_id);
            const wineRecord = await services.db.get('SELECT * FROM Wines WHERE id = ?', [id]);
            if (!wineRecord) {
                const err = new Error('Wine not found');
                err.status = 404;
                throw err;
            }
            const vintages = await services.db.all(`
                SELECT v.*, COALESCE(SUM(s.quantity), 0) as total_stock,
                       ROUND(AVG(COALESCE(s.cost_per_bottle, s.current_value)), 2) as avg_cost_per_bottle,
                       COALESCE(SUM(s.quantity * COALESCE(s.current_value, s.cost_per_bottle, 0)), 0) as total_value
                FROM Vintages v
                LEFT JOIN Stock s ON v.id = s.vintage_id
                WHERE v.wine_id = ?
                GROUP BY v.id
                ORDER BY v.year DESC
            `, [id]);
            const aliases = await services.db.all('SELECT * FROM Aliases WHERE wine_id = ?', [id]);
            const primaryVintage = vintages[0] || {};
            const totalStock = vintages.reduce((sum, v) => sum + (v.total_stock || 0), 0);
            const totalValue = vintages.reduce((sum, v) => sum + (v.total_value || 0), 0);
            const averageCost = totalStock > 0 ? Number((totalValue / totalStock).toFixed(2)) : null;
            const normalizedWine = {
                ...wineRecord,
                quality_score: wineRecord.quality_score ?? primaryVintage.quality_score ?? null,
                weather_score: wineRecord.weather_score ?? primaryVintage.weather_score ?? null,
                critic_score: wineRecord.critic_score ?? primaryVintage.critic_score ?? null,
                peak_drinking_start: wineRecord.peak_drinking_start ?? primaryVintage.peak_drinking_start ?? null,
                peak_drinking_end: wineRecord.peak_drinking_end ?? primaryVintage.peak_drinking_end ?? null,
                year: primaryVintage.year ?? wineRecord.year ?? null,
            };
            const data = serializeWineDetail({
                wine: normalizedWine,
                vintages,
                aliases,
                aggregates: {
                    total_stock: totalStock,
                    total_value: Number(totalValue.toFixed(2)),
                    avg_cost_per_bottle: averageCost,
                },
                guidance: wineGuidanceService.getGuidance(normalizedWine),
            });
            return data;
        },
    },
    {
        name: 'get_vintage_weather',
        description: 'Get weather analysis for a vintage by wine_id or by region and year.',
        parameters: getVintageWeatherParams,
        mutating: false,
        roles: SAFE_ROLES,
        handler: async (services, role, params) => {
            const { wine_id, region, year, options } = getVintageWeatherParams.parse(params);
            if (wine_id) {
                const id = typeof wine_id === 'string' ? wine_id : String(wine_id);
                const wine = await services.db.get(`
                    SELECT w.*, v.* FROM Wines w LEFT JOIN Vintages v ON w.id = v.wine_id WHERE w.id = ?
                `, [id]);
                if (!wine) {
                    const err = new Error('Wine not found');
                    err.status = 404;
                    throw err;
                }
                const weatherAnalysis = await services.vintageIntelligenceService.getWeatherContextForPairing(wine);
                return weatherAnalysis;
            }
            const data = await services.vintageIntelligenceService.weatherAnalysis.openMeteo.getVintageWeatherData(
                region,
                year,
                options || {}
            );
            return data;
        },
    },
    {
        name: 'get_vintage_pairing_insight',
        description: 'Get a weather-based pairing insight for a wine and dish context.',
        parameters: getVintagePairingInsightParams,
        mutating: false,
        roles: SAFE_ROLES,
        handler: async (services, role, params) => {
            const { wine_id, dish_context } = getVintagePairingInsightParams.parse(params);
            const id = typeof wine_id === 'string' ? wine_id : String(wine_id);
            const wine = await services.db.get(`
                SELECT w.*, v.* FROM Wines w LEFT JOIN Vintages v ON w.id = v.wine_id WHERE w.id = ?
            `, [id]);
            if (!wine) {
                const err = new Error('Wine not found');
                err.status = 404;
                throw err;
            }
            const weatherAnalysis = await services.vintageIntelligenceService.getWeatherContextForPairing(wine);
            const insight = services.vintageIntelligenceService.generateWeatherPairingInsight(weatherAnalysis, dish_context);
            return { weatherAnalysis, pairingInsight: insight };
        },
    },
    {
        name: 'get_procurement_opportunities',
        description: 'Analyze procurement opportunities across inventory and vintages.',
        parameters: getProcurementParams,
        mutating: false,
        roles: ['admin', 'crew'],
        handler: async (services, role, params) => {
            const { filters = {} } = getProcurementParams.parse(params);
            const opportunities = await services.procurementEngine.analyzeProcurementOpportunities(filters);
            return serializeProcurementRecommendations(opportunities);
        },
    },
    {
        name: 'list_locations',
        description: 'List storage locations.',
        parameters: z.object({}),
        mutating: false,
        roles: SAFE_ROLES,
        handler: async (services) => {
            const locations = await services.inventoryManager.listLocations();
            return serializeInventoryLocations(locations);
        },
    },
    {
        name: 'get_explanations',
        description: 'List explainability records for an entity.',
        parameters: getExplanationsParams,
        mutating: false,
        roles: SAFE_ROLES,
        handler: async (services, role, params) => {
            const { entity_type, entity_id, limit } = getExplanationsParams.parse(params);
            const explanations = await services.explainabilityService.listExplanations({
                entityType: entity_type,
                entityId: entity_id,
                limit,
                role: role || 'guest',
            });
            return explanations;
        },
    },
    {
        name: 'system_health',
        description: 'Basic system health status and counts.',
        parameters: systemHealthParams,
        mutating: false,
        roles: SAFE_ROLES,
        handler: async (services) => {
            await services.db.get('SELECT 1');
            const stats = await services.db.all(`
                SELECT
                    (SELECT COUNT(*) FROM Wines) as total_wines,
                    (SELECT COUNT(*) FROM Vintages) as total_vintages,
                    (SELECT COALESCE(SUM(quantity), 0) FROM Stock) as total_bottles,
                    (SELECT COUNT(*) FROM Suppliers WHERE active = 1) as active_suppliers
            `);
            return { status: 'healthy', data: stats[0] };
        },
    },
    // Mutating (guarded)
    {
        name: 'record_pairing_feedback',
        description: 'Record feedback on a recommendation to improve future pairings.',
        parameters: recordPairingFeedbackParams,
        mutating: true,
        roles: WRITE_ROLES,
        requireIdempotency: true,
        handler: async (services, role, params, options) => {
            if (!options || options.dry_run === true) {
                return { dry_run: true, can_apply: true };
            }
            requireIdempotencyKey(options);
            const { recommendation_id, rating, notes, selected = true } = recordPairingFeedbackParams.parse(params);
            await services.learningEngine.recordPairingFeedback(recommendation_id, rating, notes, selected);
            return { success: true };
        },
    },
    {
        name: 'enrich_vintage',
        description: 'Run vintage enrichment for a wine. Defaults to dry-run.',
        parameters: enrichVintageParams,
        mutating: true,
        roles: WRITE_ROLES,
        requireIdempotency: true,
        handler: async (services, role, params, options) => {
            const { wine_id } = enrichVintageParams.parse(params);
            const id = typeof wine_id === 'string' ? wine_id : String(wine_id);
            const wine = await services.db.get(`
                SELECT w.*, v.*
                FROM Wines w
                LEFT JOIN Vintages v ON w.id = v.wine_id
                WHERE w.id = ?
            `, [id]);
            if (!wine) {
                const err = new Error('Wine not found');
                err.status = 404;
                throw err;
            }
            const isDryRun = !options || options.dry_run !== false;
            if (isDryRun) {
                // Strip identifiers to prevent DB writes during dry run
                const masked = {
                    name: wine.name,
                    producer: wine.producer,
                    region: wine.region,
                    year: wine.year,
                    style: wine.style,
                    wine_type: wine.wine_type,
                    grape_varieties: wine.grape_varieties,
                    critic_score: wine.critic_score,
                    storage_temp_min: wine.storage_temp_min,
                    storage_temp_max: wine.storage_temp_max,
                };
                const simulated = await services.vintageIntelligenceService.enrichWineData(masked);
                return { dry_run: true, enrichment: simulated };
            }
            requireIdempotencyKey(options);
            const enriched = await services.vintageIntelligenceService.enrichWineData(wine);
            return { success: true, enrichment: enriched };
        },
    },
    {
        name: 'refresh_vintage_weather',
        description: 'Refresh cached weather analysis for a vintage. Defaults to dry-run.',
        parameters: refreshVintageWeatherParams,
        mutating: true,
        roles: WRITE_ROLES,
        requireIdempotency: true,
        handler: async (services, role, params, options) => {
            const { vintage_id, force = false } = refreshVintageWeatherParams.parse(params);
            const id = typeof vintage_id === 'string' ? vintage_id : String(vintage_id);
            const vintage = await services.db.get(`
                SELECT v.id, v.year, v.wine_id,
                       w.name AS wine_name,
                       w.producer AS wine_producer,
                       w.region AS wine_region,
                       w.country AS wine_country
                FROM Vintages v
                JOIN Wines w ON v.wine_id = w.id
                WHERE v.id = ?
            `, [id]);
            if (!vintage) {
                const err = new Error('Vintage not found');
                err.status = 404;
                throw err;
            }
            const isDryRun = !options || options.dry_run !== false;
            if (isDryRun) {
                // Return current context only, do not refresh cache
                const wine = await services.db.get('SELECT w.*, v.* FROM Wines w JOIN Vintages v ON w.id = v.wine_id WHERE v.id = ?', [id]);
                const context = await services.vintageIntelligenceService.getWeatherContextForPairing(wine);
                return { dry_run: true, current_weather: context };
            }
            requireIdempotencyKey(options);
            const weather = await services.vintageIntelligenceService.refreshVintageWeather({
                id: vintage.id,
                year: vintage.year,
                wine_id: vintage.wine_id,
                wine_name: vintage.wine_name,
                wine_producer: vintage.wine_producer,
                wine_region: vintage.wine_region,
                wine_country: vintage.wine_country,
            }, { forceRefresh: Boolean(force) });
            return { success: true, weather };
        },
    },
];

function listTools() {
    return tools.map((t) => ({
        name: t.name,
        description: t.description,
        mutating: t.mutating,
        roles: t.roles,
        parameters: toJsonSchema(t.parameters),
    }));
}

async function callTool(toolName, params, services, userRole, options = {}) {
    const tool = tools.find((t) => t.name === toolName);
    if (!tool) {
        const err = new Error(`Unknown tool: ${toolName}`);
        err.status = 404;
        throw err;
    }
    const role = assertRoleAllowed(userRole, tool.roles);
    if (tool.mutating && (!options || options.confirm !== true) && options.dry_run === false) {
        const err = new Error('Confirm required for mutating tool');
        err.status = 400;
        err.code = 'CONFIRM_REQUIRED';
        throw err;
    }
    return tool.handler(services, role, params, options);
}

module.exports = {
    listTools,
    callTool,
};


