const {
  z,
  nonEmptyString,
  optionalNonEmptyString,
  numberLike,
  integerLike,
  optionalStringOrArray,
  generalObject,
} = require('./common');

const syncSchema = z
  .object({
    updated_at: integerLike.optional(),
    updatedAt: integerLike.optional(),
    timestamp: integerLike.optional(),
    updated_by: optionalNonEmptyString,
    updatedBy: optionalNonEmptyString,
    origin: optionalNonEmptyString,
    op_id: optionalNonEmptyString,
    opId: optionalNonEmptyString,
  })
  .strip()
  .optional()
  .transform((value) => {
    if (!value) {
      return value;
    }

    const normalized = { ...value };

    if (typeof normalized.updated_at === 'undefined' && typeof normalized.updatedAt !== 'undefined') {
      normalized.updated_at = normalized.updatedAt;
    }
    if (typeof normalized.updated_by === 'undefined' && typeof normalized.updatedBy !== 'undefined') {
      normalized.updated_by = normalized.updatedBy;
    }
    if (typeof normalized.op_id === 'undefined' && typeof normalized.opId !== 'undefined') {
      normalized.op_id = normalized.opId;
    }

    return {
      updated_at: normalized.updated_at,
      timestamp: normalized.timestamp,
      updated_by: normalized.updated_by,
      origin: normalized.origin,
      op_id: normalized.op_id,
    };
  });

const winePayloadSchema = z
  .object({
    name: nonEmptyString,
    producer: nonEmptyString,
    region: optionalNonEmptyString,
    country: optionalNonEmptyString,
    wine_type: nonEmptyString,
    grape_varieties: optionalStringOrArray,
    alcohol_content: numberLike.optional(),
    style: optionalNonEmptyString,
    tasting_notes: optionalNonEmptyString,
    food_pairings: optionalStringOrArray,
    serving_temp_min: numberLike.optional(),
    serving_temp_max: numberLike.optional(),
    created_by: optionalNonEmptyString,
    updated_by: optionalNonEmptyString,
  })
  .strict();

const vintagePayloadSchema = z
  .object({
    year: integerLike.optional(),
    harvest_date: optionalNonEmptyString,
    bottling_date: optionalNonEmptyString,
    release_date: optionalNonEmptyString,
    peak_drinking_start: optionalNonEmptyString,
    peak_drinking_end: optionalNonEmptyString,
    quality_score: numberLike.optional(),
    weather_score: numberLike.optional(),
    critic_score: numberLike.optional(),
    production_notes: optionalNonEmptyString,
  })
  .strict();

const stockPayloadSchema = z
  .object({
    location: nonEmptyString,
    quantity: numberLike.refine((value) => value > 0, {
      message: 'Quantity must be greater than zero.',
    }),
    cost_per_bottle: numberLike.optional(),
    unit_cost: numberLike.optional(),
    reference_id: optionalNonEmptyString,
    notes: optionalNonEmptyString,
    storage_conditions: generalObject.optional(),
    created_by: optionalNonEmptyString,
  })
  .strict();

const wineCreateSchema = z
  .object({
    wine: winePayloadSchema,
    vintage: vintagePayloadSchema,
    stock: stockPayloadSchema,
    sync: syncSchema,
  })
  .strict();

const wineUpdateSchema = z
  .object({
    wine: winePayloadSchema.partial().refine((val) => Object.keys(val).length > 0, {
      message: 'At least one wine field is required.',
    }),
    sync: syncSchema,
  })
  .strict();

const wineDeleteSchema = z
  .object({
    sync: syncSchema,
  })
  .strict();

const vintageUpdateSchema = z
  .object({
    vintage: vintagePayloadSchema.partial().refine((val) => Object.keys(val).length > 0, {
      message: 'At least one vintage field is required.',
    }),
    sync: syncSchema,
  })
  .strict();

const vintageDeleteSchema = z
  .object({
    sync: syncSchema,
  })
  .strict();

module.exports = {
  wineCreateSchema,
  wineUpdateSchema,
  wineDeleteSchema,
  vintagePayloadSchema,
  vintageUpdateSchema,
  vintageDeleteSchema,
};
