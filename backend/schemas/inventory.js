const {
  z,
  nonEmptyString,
  optionalNonEmptyString,
  numberLike,
  integerLike,
  idLike,
} = require('./common');

const positiveQuantity = numberLike.refine((value) => value > 0, {
  message: 'Quantity must be greater than zero.',
});

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

const inventoryConsumeSchema = z
  .object({
    vintage_id: idLike,
    location: nonEmptyString,
    quantity: positiveQuantity,
    notes: optionalNonEmptyString,
    created_by: optionalNonEmptyString,
    sync: syncSchema,
  })
  .strict();

const inventoryReceiveSchema = z
  .object({
    vintage_id: idLike,
    location: nonEmptyString,
    quantity: positiveQuantity,
    unit_cost: numberLike.optional(),
    cost_per_bottle: numberLike.optional(),
    reference_id: optionalNonEmptyString,
    notes: optionalNonEmptyString,
    created_by: optionalNonEmptyString,
    sync: syncSchema,
  })
  .strict();

const inventoryMoveSchema = z
  .object({
    vintage_id: idLike,
    from_location: nonEmptyString,
    to_location: nonEmptyString,
    quantity: positiveQuantity,
    notes: optionalNonEmptyString,
    created_by: optionalNonEmptyString,
    sync: syncSchema,
  })
  .strict()
  .refine((payload) => payload.from_location !== payload.to_location, {
    message: 'from_location and to_location must be different.',
    path: ['to_location'],
  });

const inventoryReserveSchema = z
  .object({
    vintage_id: idLike,
    location: nonEmptyString,
    quantity: positiveQuantity,
    notes: optionalNonEmptyString,
    created_by: optionalNonEmptyString,
    sync: syncSchema,
  })
  .strict();

module.exports = {
  inventoryConsumeSchema,
  inventoryReceiveSchema,
  inventoryMoveSchema,
  inventoryReserveSchema,
};
