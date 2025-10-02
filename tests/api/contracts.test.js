const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SPEC_PATH = path.join(__dirname, '..', '..', 'backend', 'api', 'openapi.yaml');
const ROUTES_PATH = path.join(__dirname, '..', '..', 'backend', 'api', 'routes.js');
// Also ensure versioned paths are considered by normalizing with optional /v1 prefix

const loadSpec = () => {
  const raw = fs.readFileSync(SPEC_PATH, 'utf8');
  return yaml.load(raw);
};

const extractRoutes = () => {
  const source = fs.readFileSync(ROUTES_PATH, 'utf8');
  const matches = [];
  let match;

  // Extract main router routes - handle multi-line definitions
  const mainRouteRegex = /router\.(get|post|put|delete)\(\s*'([^']+)'/gs;
  while ((match = mainRouteRegex.exec(source)) !== null) {
    const method = match[1].toLowerCase();
    const routePath = match[2];
    matches.push({
      method,
      path: routePath,
    });
  }

  // Also extract routes from sub-routers (auth, learning, ml, etc.)
  const authSource = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'api', 'auth.js'), 'utf8');
  const authRouteRegex = /router\.(get|post|put|delete)\(\s*'([^']+)'/gs;
  const authRoutes = [];
  while ((match = authRouteRegex.exec(authSource)) !== null) {
    const authRoute = {
      method: match[1].toLowerCase(),
      path: '/auth' + match[2],
    };
    authRoutes.push(authRoute);
    matches.push(authRoute);
  }
  if (process.env.DEBUG_CONTRACTS) {
    console.log('Auth routes extracted:', authRoutes.length, authRoutes.slice(0, 3));
  }

  return {
    list: matches,
    source: source + authSource,
  };
};

const normalizeExpressPath = (pathWithParams) => pathWithParams
  .replace(/^\/v1\//, '/')
  .replace(/:([^/]+)/g, '{$1}');

const collectOperations = (spec) => {
  if (!spec.paths) {
    return [];
  }

  return Object.entries(spec.paths).flatMap(([pathKey, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => ['get', 'post', 'put', 'delete', 'patch'].includes(method))
      .map(([method, operation]) => ({
        method,
        path: pathKey,
        operation,
      }))
  );
};

describe('OpenAPI contract', () => {
  const spec = loadSpec();
  const { list: expressRoutes, source } = extractRoutes();

  test('documents every Express route', () => {
    expect(spec).toBeTruthy();
    expect(spec.paths).toBeTruthy();

    expressRoutes.forEach(({ method, path: expressPath }) => {
      const openApiPath = normalizeExpressPath(expressPath);
      const pathEntry = spec.paths[openApiPath];

      expect(pathEntry).toBeDefined();
      expect(pathEntry[method]).toBeDefined();
    });
  });

  test('does not document undeclared Express routes', () => {
    // Build index of normalized Express routes
    const expressRouteIndex = new Set();
    expressRoutes.forEach(({ method, path: expressPath }) => {
      // Normalize by converting :param to {param}
      const normalized = expressPath.replace(/:([^/]+)/g, '{$1}');
      expressRouteIndex.add(`${method} ${normalized}`);
    });

    const missingRoutes = [];
    collectOperations(spec).forEach(({ method, path }) => {
      const key = `${method} ${path}`;
      if (!expressRouteIndex.has(key)) {
        missingRoutes.push(key);
      }
    });

    if (missingRoutes.length > 0) {
      console.log('Routes in OpenAPI spec but not in Express:', missingRoutes);
      console.log('\nExpress routes (sample):', Array.from(expressRouteIndex).slice(0, 10));
    }

    collectOperations(spec).forEach(({ method, path }) => {
      const key = `${method} ${path}`;
      expect(expressRouteIndex.has(key)).toBe(true);
    });
  });

  test('attaches validation middleware for each route', () => {
    const validatedRoutes = new Set();
    let match;

    // Match routes that have validate() within ~500 chars after route path
    // Using non-greedy match and reasonable limit to avoid matching too far
    const validationRegex = /router\.(get|post|put|delete)\(\s*'([^']+)'[\s\S]{1,500}?validate\(/g;
    while ((match = validationRegex.exec(source)) !== null) {
      validatedRoutes.add(`${match[1].toLowerCase()} ${match[2]}`);
    }

    // Check for routes with requireAuthAndRole pattern (which includes validation)
    const authRoleRegex = /router\.(get|post|put|delete)\(\s*'([^']+)'[\s\S]{1,500}?\.\.\.requireAuthAndRole/g;
    while ((match = authRoleRegex.exec(source)) !== null) {
      validatedRoutes.add(`${match[1].toLowerCase()} ${match[2]}`);
    }

    const unvalidatedRoutes = [];
    expressRoutes.forEach(({ method, path: expressPath }) => {
      // Skip system routes that might not need validation
      if (expressPath.includes('/system/') || expressPath.includes('/auth/')) {
        return;
      }
      if (!validatedRoutes.has(`${method} ${expressPath}`)) {
        unvalidatedRoutes.push(`${method} ${expressPath}`);
      }
    });

    if (unvalidatedRoutes.length > 0 && process.env.DEBUG_CONTRACTS) {
      console.log('Unvalidated routes:', unvalidatedRoutes.slice(0, 10));
      console.log('Validated routes (sample):', Array.from(validatedRoutes).slice(0, 10));
    }

    expressRoutes.forEach(({ method, path: expressPath }) => {
      // Skip system routes that might not need validation
      if (expressPath.includes('/system/') || expressPath.includes('/auth/')) {
        return;
      }
      expect(validatedRoutes.has(`${method} ${expressPath}`)).toBe(true);
    });
  });

  test('declares standard error responses for each operation', () => {
    const errorRef = '#/components/schemas/ErrorResponse';

    collectOperations(spec).forEach(({ operation }) => {
      expect(operation.responses).toBeDefined();

      const responseEntries = Object.entries(operation.responses || {});
      const errorResponses = responseEntries.filter(([status]) => !/^2\d\d$/.test(status));

      expect(errorResponses.length).toBeGreaterThan(0);

      errorResponses.forEach(([, response]) => {
        const jsonContent = response.content && response.content['application/json'];

        if (jsonContent && jsonContent.schema) {
          const schema = jsonContent.schema;
          if (schema.$ref) {
            expect(schema.$ref).toBe(errorRef);
          } else if (Array.isArray(schema.oneOf)) {
            expect(schema.oneOf.some((entry) => entry.$ref === errorRef)).toBe(true);
          } else {
            throw new Error('Error responses must reference ErrorResponse schema');
          }
        }
      });
    });
  });

  test('enforces success envelope on documented JSON responses', () => {
    collectOperations(spec).forEach(({ operation, path, method }) => {
      Object.entries(operation.responses || {})
        .filter(([status]) => /^2\d\d$/.test(status))
        .forEach(([status, response]) => {
          const jsonContent = response.content && response.content['application/json'];

          if (!jsonContent) {
            return; // Non-JSON responses (e.g., YAML spec) are exempt.
          }

          expect(jsonContent.schema).toBeDefined();

          const { schema } = jsonContent;
          expect(schema.type).toBe('object');
          expect(schema.properties).toBeDefined();
          expect(schema.properties.success).toBeDefined();
          expect(schema.properties.success.const).toBe(true);

          const hasData = Object.prototype.hasOwnProperty.call(schema.properties, 'data');
          const hasMessage = Object.prototype.hasOwnProperty.call(schema.properties, 'message');

          if (!hasData && !hasMessage) {
            throw new Error(
              `Response ${status} for ${method.toUpperCase()} ${path} must include either a data or message property.`
            );
          }
        });
    });
  });
});
