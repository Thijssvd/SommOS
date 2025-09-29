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

describe('OpenAPI contract', () => {
  const spec = loadSpec();
  const { list: expressRoutes, source } = extractRoutes();

  test('documents every Express route', () => {
    expect(spec).toBeTruthy();
    expect(spec.paths).toBeTruthy();

    expressRoutes.forEach(({ method, path: expressPath }) => {
      const openApiPath = expressPath.replace(/:([^/]+)/g, '{$1}');
      const pathEntry = spec.paths[openApiPath];

      expect(pathEntry).toBeDefined();
      expect(pathEntry[method]).toBeDefined();
    });
  });

  test('attaches validation middleware for each route', () => {
    const validatedRoutes = new Set();
    const validationRegex = /router\.(get|post|put|delete)\('([^']+)',\s*validate\(/g;
    let match;

    while ((match = validationRegex.exec(source)) !== null) {
      validatedRoutes.add(`${match[1].toLowerCase()} ${match[2]}`);
    }

    expressRoutes.forEach(({ method, path: expressPath }) => {
      expect(validatedRoutes.has(`${method} ${expressPath}`)).toBe(true);
    });
  });

  test('declares standard error responses for each operation', () => {
    const errorRef = '#/components/schemas/ErrorResponse';

    Object.entries(spec.paths).forEach(([, pathItem]) => {
      Object.entries(pathItem).forEach(([verb, operation]) => {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(verb)) {
          expect(operation.responses).toBeDefined();

          const responseEntries = Object.entries(operation.responses);
          const errorResponses = responseEntries.filter(([status]) => !['200', '201', '202', '204'].includes(status));

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
        }
      });
    });
  });
});
