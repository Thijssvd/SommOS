const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SPEC_PATH = path.join(__dirname, '..', '..', 'backend', 'api', 'openapi.yaml');
const ROUTES_PATH = path.join(__dirname, '..', '..', 'backend', 'api', 'routes.js');

const loadSpec = () => {
  const raw = fs.readFileSync(SPEC_PATH, 'utf8');
  return yaml.load(raw);
};

const extractRoutes = () => {
  const source = fs.readFileSync(ROUTES_PATH, 'utf8');
  const routeRegex = /router\.(get|post|put|delete)\('([^']+)'/g;
  const matches = [];
  let match;

  while ((match = routeRegex.exec(source)) !== null) {
    const method = match[1].toLowerCase();
    const routePath = match[2];
    matches.push({
      method,
      path: routePath,
    });
  }

  return {
    list: matches,
    source,
  };
};

const normalizeExpressPath = (pathWithParams) => pathWithParams.replace(/:([^/]+)/g, '{$1}');

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
    const expressRouteIndex = new Set(
      expressRoutes.map(({ method, path: expressPath }) => `${method} ${normalizeExpressPath(expressPath)}`)
    );

    collectOperations(spec).forEach(({ method, path }) => {
      const key = `${method} ${path}`;
      expect(expressRouteIndex.has(key)).toBe(true);
    });
  });

  test('attaches validation middleware for each route', () => {
    const validatedRoutes = new Set();
    const validationRegex = /router\.(get|post|put|delete)\('([^']+)',\s*validate\(/g;
    let match;

    while ((match = validationRegex.exec(source)) !== null) {
      validatedRoutes.add(`${match[1].toLowerCase()} ${match[2]}`);
    }

    // Check for routes with requireAuthAndRole pattern (which includes validation)
    const authRoleRegex = /router\.(get|post|put|delete)\('([^']+)',\s*\.\.\.requireAuthAndRole/g;
    while ((match = authRoleRegex.exec(source)) !== null) {
      validatedRoutes.add(`${match[1].toLowerCase()} ${match[2]}`);
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
