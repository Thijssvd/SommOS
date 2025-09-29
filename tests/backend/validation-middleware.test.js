const fc = require('fast-check');
const { ZodError } = require('zod');

const {
  numberLike,
  integerLike,
  booleanLike,
} = require('../../backend/schemas/common');
const {
  inventoryConsumeSchema,
  inventoryMoveSchema,
} = require('../../backend/schemas/inventory');
const { validators, validate } = require('../../backend/middleware/validate');

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('schema primitives', () => {
  test('numberLike accepts trimmed numeric strings', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const trimmed = `  ${value} `;
          const parsed = numberLike.parse(trimmed);
          expect(parsed).toBeCloseTo(value);
        },
      ),
    );
  });

  test('integerLike accepts stringified integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e6, max: 1e6 }), (value) => {
        const parsed = integerLike.parse(`${value}`);
        expect(parsed).toBe(value);
      }),
    );
  });

  test('booleanLike coerces canonical string values', () => {
    fc.assert(
      fc.property(fc.boolean(), (value) => {
        const parsed = booleanLike.parse(`${value}`);
        expect(parsed).toBe(value);
      }),
    );
  });
});

describe('inventory schemas', () => {
  test('inventory consume schema accepts positive quantities provided as strings or numbers', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.boolean(),
        (quantity, asString) => {
          const normalized = Number.parseFloat(quantity.toFixed(6));
          const payload = {
            vintage_id: 42,
            location: 'main-cellar',
            quantity: asString ? `${normalized}` : normalized,
          };

          const parsed = inventoryConsumeSchema.parse(payload);
          expect(parsed.quantity).toBeCloseTo(normalized, 6);
          expect(typeof parsed.quantity).toBe('number');
        },
      ),
    );
  });

  test('inventory move schema rejects identical locations', () => {
    expect(() =>
      inventoryMoveSchema.parse({
        vintage_id: 'vin-1',
        from_location: 'cellar-a',
        to_location: 'cellar-a',
        quantity: 3,
      }),
    ).toThrow(ZodError);
  });
});

describe('validate middleware', () => {
  test('coerces query params and delegates to next on success', () => {
    const middleware = validate(validators.inventoryList);
    const req = {
      params: {},
      query: {
        available_only: 'true',
        limit: '25',
      },
      body: {},
    };
    const res = createResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.query.available_only).toBe(true);
    expect(req.query.limit).toBe(25);
  });

  test('returns 422 with normalized details when validation fails', () => {
    const middleware = validate(validators.inventoryConsume);
    const req = {
      params: {},
      query: {},
      body: {
        vintage_id: 'vintage-1',
        location: 'main-cellar',
        quantity: 0,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'UNPROCESSABLE_ENTITY',
          details: expect.arrayContaining([
            expect.objectContaining({
              path: 'quantity',
              message: expect.stringContaining('greater than zero'),
            }),
          ]),
        }),
      }),
    );
  });

  test('guest session validation requires either event_code or invite_token', () => {
    const middleware = validate(validators.guestSession);
    const req = {
      params: {},
      query: {},
      body: {
        pin: '1234',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              path: 'event_code',
            }),
          ]),
        }),
      }),
    );
  });
});
