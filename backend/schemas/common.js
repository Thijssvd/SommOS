const { z } = require('zod');

const nonEmptyString = z
  .string({ required_error: 'Value is required.' })
  .trim()
  .min(1, { message: 'Value is required.' });

const optionalNonEmptyString = nonEmptyString.optional();

const numberLike = z.preprocess((value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return value;
    }

    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? value : parsed;
  }

  return value;
}, z.number({ invalid_type_error: 'Must be a number.' }).refine((val) => !Number.isNaN(val), {
  message: 'Must be a number.',
}));

const integerLike = z.preprocess((value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return value;
    }

    if (!/^[-+]?\d+$/.test(trimmed)) {
      return value;
    }

    return Number.parseInt(trimmed, 10);
  }

  return value;
}, z
  .number({ invalid_type_error: 'Must be an integer.' })
  .int({ message: 'Must be an integer.' }));

const booleanLike = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return value;
}, z.boolean({ invalid_type_error: 'Must be a boolean.' }));

const generalObject = z.object({}).passthrough();

const stringOrStringArray = z.union([
  nonEmptyString,
  z.array(nonEmptyString),
]);

const optionalStringOrArray = stringOrStringArray.optional();

const idLike = z.union([integerLike, nonEmptyString]);

module.exports = {
  z,
  nonEmptyString,
  optionalNonEmptyString,
  numberLike,
  integerLike,
  booleanLike,
  generalObject,
  stringOrStringArray,
  optionalStringOrArray,
  idLike,
};
