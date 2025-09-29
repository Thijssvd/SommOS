const { z, nonEmptyString, generalObject } = require('./common');

const dishInputSchema = z.union([
  nonEmptyString,
  generalObject,
]);

const pairingRequestSchema = z
  .object({
    dish: dishInputSchema,
    context: generalObject.optional(),
    guestPreferences: generalObject.optional(),
    options: generalObject.optional(),
  })
  .strict();

const quickPairingSchema = z
  .object({
    dish: dishInputSchema.optional(),
    context: generalObject.optional(),
    ownerLikes: generalObject.optional(),
  })
  .strict();

module.exports = {
  pairingRequestSchema,
  quickPairingSchema,
};
