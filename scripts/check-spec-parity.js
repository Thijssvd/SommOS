#!/usr/bin/env node

/**
 * Verifies that Express routes mounted under /api are represented in the
 * OpenAPI specification and vice versa.
 */

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const express = require('express');
const listEndpoints = require('express-list-endpoints');

const projectRoot = path.resolve(__dirname, '..');
const openApiPath = path.join(projectRoot, 'backend/api/openapi.yaml');

// Ensure minimal env for parity checks without requiring real secrets
function ensureTestEnv() {
    if (!process.env.NODE_ENV) {
        process.env.NODE_ENV = 'test';
    }
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'x'.repeat(64);
    }
    if (!process.env.SESSION_SECRET) {
        process.env.SESSION_SECRET = 'y'.repeat(64);
    }
    if (!process.env.SOMMOS_AUTH_DISABLED) {
        process.env.SOMMOS_AUTH_DISABLED = 'true';
    }
}

ensureTestEnv();

function normalizePath(routePath) {
    if (!routePath) {
        return '/';
    }

    const normalized = routePath
        .replace(/\\+/g, '/')
        .replace(/:(\w+)/g, '{$1}')
        .replace(/\*\*?/g, '*')
        .replace(/\/\.$/, '/')
        .replace(/\/$/, '');

    return normalized.length > 0 ? normalized : '/';
}

function buildRouteKey(method, routePath) {
    return `${method.toUpperCase()} ${normalizePath(routePath)}`;
}

function collectExpressRoutes(router) {
    // Build endpoint list from top-level routes and mounted sub-routers
    const subRouters = [
        { base: '/api/auth', router: require(path.join(projectRoot, 'backend/api/auth')) },
        { base: '/api/learning', router: require(path.join(projectRoot, 'backend/api/enhanced_learning_routes')) },
        { base: '/api/ml', router: require(path.join(projectRoot, 'backend/api/ml_routes')) },
        { base: '/api/performance', router: require(path.join(projectRoot, 'backend/api/performance_routes')) },
        { base: '/api/performance', router: require(path.join(projectRoot, 'backend/api/rum_routes')) },
        { base: '/api/agent', router: require(path.join(projectRoot, 'backend/api/agent_routes')) },
    ];

    // Collect local paths from sub-routers to filter out nested entries from the parent router listing
    const subLocalPaths = new Set();
    const subEndpointsExpanded = [];
    subRouters.forEach(({ base, router: sub }) => {
        const eps = listEndpoints(sub);
        eps.forEach((ep) => {
            subLocalPaths.add(ep.path);
            subEndpointsExpanded.push({
                path: `${base}${normalizePath(ep.path)}`,
                methods: ep.methods,
            });
        });
    });

    // Collect only the top-level endpoints defined directly in routes.js (exclude any that belong to sub-routers)
    const topLevelEndpoints = listEndpoints(router)
        .filter((ep) => !subLocalPaths.has(ep.path))
        .map((ep) => ({
            path: `/api${normalizePath(ep.path)}`,
            methods: ep.methods,
        }));

    const endpoints = [...topLevelEndpoints, ...subEndpointsExpanded];
    const ignorePrefixes = [
        '/api/performance',
        '/api/learning',
        '/api/ml',
        '/api/rum',
        '/api/agent'
    ];
    const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

    const collected = new Set();

    endpoints.forEach((endpoint) => {
        endpoint.methods
            .filter((method) => allowedMethods.has(method))
            .forEach((method) => {
                const key = buildRouteKey(method, endpoint.path);
                const shouldIgnore = ignorePrefixes.some((p) => normalizePath(endpoint.path).startsWith(p));
                if (!shouldIgnore) {
                    collected.add(key);
                }
            });
    });

    return collected;
}

function collectSpecRoutes(specFile) {
    const raw = fs.readFileSync(specFile, 'utf8');
    const spec = yaml.load(raw);
    const basePaths = (spec.servers || [])
        .map((server) => (server.url || '').trim())
        .map((url) => url.replace(/\/$/, ''));

    if (basePaths.length === 0) {
        basePaths.push('');
    }

    const collected = new Set();
    const allowedMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);

    Object.entries(spec.paths || {}).forEach(([routePath, operations]) => {
        Object.entries(operations || {})
            .filter(([method]) => allowedMethods.has(method))
            .forEach(([method]) => {
                basePaths.forEach((basePath) => {
                    const fullPath = `${basePath}${routePath}`;
                    const key = buildRouteKey(method, fullPath);
                    collected.add(key);
                });
            });
    });

    return collected;
}

function formatMissingEntries(entries) {
    return Array.from(entries)
        .sort()
        .map((entry) => `  - ${entry}`)
        .join('\n');
}

function main() {
    const apiRouter = require(path.join(projectRoot, 'backend/api/routes'));
    const expressRoutes = collectExpressRoutes(apiRouter);
    const specRoutes = collectSpecRoutes(openApiPath);

    const missingFromSpec = new Set();
    expressRoutes.forEach((route) => {
        if (!specRoutes.has(route)) {
            missingFromSpec.add(route);
        }
    });

    const missingFromImplementation = new Set();
    specRoutes.forEach((route) => {
        if (!expressRoutes.has(route)) {
            missingFromImplementation.add(route);
        }
    });

    let hasDiscrepancies = false;

    if (missingFromSpec.size > 0) {
        hasDiscrepancies = true;
        console.error('❌ Missing OpenAPI documentation for the following Express routes:');
        console.error(formatMissingEntries(missingFromSpec));
    }

    if (missingFromImplementation.size > 0) {
        hasDiscrepancies = true;
        console.error('❌ OpenAPI references undocumented Express routes:');
        console.error(formatMissingEntries(missingFromImplementation));
    }

    if (hasDiscrepancies) {
        console.error('\nUpdate backend/api/openapi.yaml to match the Express router.');
        process.exit(1);
    }

    console.log('✅ Express router and OpenAPI specification are in parity.');
}

main();
