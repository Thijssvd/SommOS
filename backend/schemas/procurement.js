const {
  z,
  optionalNonEmptyString,
  numberLike,
  integerLike,
  optionalStringOrArray,
} = require('./common');

const procurementFiltersSchema = z
  .object({
    region: optionalNonEmptyString,
    regions: optionalStringOrArray,
    wine_type: optionalNonEmptyString,
    wine_types: optionalStringOrArray,
    max_price: numberLike.optional(),
    min_score: integerLike.optional(),
    budget: numberLike.optional(),
  })
  .strict();

module.exports = {
  procurementFiltersSchema,
};
