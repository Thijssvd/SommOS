const { ZodError } = require("zod");
const {
  z,
  nonEmptyString,
  optionalNonEmptyString,
  numberLike,
  integerLike,
  booleanLike,
  generalObject,
  stringOrStringArray,
  optionalStringOrArray,
} = require("../schemas/common");
const {
  inventoryConsumeSchema,
  inventoryReceiveSchema,
  inventoryMoveSchema,
  inventoryReserveSchema,
} = require("../schemas/inventory");
const { wineCreateSchema } = require("../schemas/wine");
const { pairingRequestSchema, quickPairingSchema } = require("../schemas/pairing");
const { procurementFiltersSchema } = require("../schemas/procurement");

const passthroughObject = (shape) => generalObject.extend(shape);

const validators = {
  pairingRecommend: {
    body: pairingRequestSchema,
  },
  pairingQuick: {
    body: quickPairingSchema,
  },
  pairingFeedback: {
    body: passthroughObject({
      recommendation_id: nonEmptyString,
      rating: numberLike,
      notes: optionalNonEmptyString,
      selected: booleanLike.optional(),
    }),
  },
  inventoryList: {
    query: z
      .object({
        location: optionalNonEmptyString,
        wine_type: optionalNonEmptyString,
        region: optionalNonEmptyString,
        available_only: booleanLike.optional(),
        limit: integerLike.optional(),
        offset: integerLike.optional(),
      })
      .passthrough(),
  },
  inventoryStock: {
    query: z
      .object({
        location: optionalNonEmptyString,
        wine_type: optionalNonEmptyString,
        region: optionalNonEmptyString,
        available_only: booleanLike.optional(),
      })
      .passthrough(),
  },
  inventoryById: {
    params: z.object({
      id: nonEmptyString,
    }),
  },
  inventoryConsume: {
    body: inventoryConsumeSchema,
  },
  inventoryReceive: {
    body: inventoryReceiveSchema,
  },
  inventoryIntake: {
    body: generalObject,
  },
  inventoryIntakeReceive: {
    params: z.object({
      intakeId: integerLike,
    }),
    body: passthroughObject({
      receipts: z
        .array(generalObject)
        .min(1, { message: "At least one receipt is required." }),
      created_by: optionalNonEmptyString,
      notes: optionalNonEmptyString,
    }),
  },
  inventoryIntakeStatus: {
    params: z.object({
      intakeId: integerLike,
    }),
  },
  inventoryMove: {
    body: inventoryMoveSchema,
  },
  inventoryReserve: {
    body: inventoryReserveSchema,
  },
  inventoryLedger: {
    params: z.object({
      vintage_id: nonEmptyString,
    }),
    query: z
      .object({
        limit: integerLike.optional(),
        offset: integerLike.optional(),
      })
      .passthrough(),
  },
  procurementOpportunities: {
    query: procurementFiltersSchema,
  },
  procurementAnalyze: {
    body: passthroughObject({
      vintage_id: z.union([nonEmptyString, integerLike]),
      supplier_id: z.union([nonEmptyString, integerLike]),
      quantity: numberLike.optional(),
      context: generalObject.optional(),
    }),
  },
  procurementOrder: {
    body: passthroughObject({
      items: z
        .array(generalObject)
        .min(1, { message: "Items array must include at least one entry." }),
      supplier_id: z.union([nonEmptyString, integerLike]),
      delivery_date: optionalNonEmptyString,
      notes: optionalNonEmptyString,
    }),
  },
  winesList: {
    query: z
      .object({
        region: optionalNonEmptyString,
        wine_type: optionalNonEmptyString,
        producer: optionalNonEmptyString,
        search: optionalNonEmptyString,
        limit: integerLike.optional(),
        offset: integerLike.optional(),
      })
      .passthrough(),
  },
  winesCreate: {
    body: wineCreateSchema,
  },
  winesById: {
    params: z.object({
      id: nonEmptyString,
    }),
  },
  vintageAnalysis: {
    params: z.object({
      wine_id: nonEmptyString,
    }),
  },
  explanationsByEntity: {
    params: z.object({
      entity_type: nonEmptyString,
      entity_id: nonEmptyString,
    }),
    query: z
      .object({
        limit: integerLike.optional(),
      })
      .passthrough(),
  },
  explainabilityCreate: {
    body: passthroughObject({
      entity_type: nonEmptyString,
      entity_id: nonEmptyString,
      summary: nonEmptyString,
      factors: z.union([generalObject, stringOrStringArray]).optional(),
      generated_at: optionalNonEmptyString,
    }),
  },
  memoriesList: {
    query: z
      .object({
        subject_type: nonEmptyString,
        subject_id: nonEmptyString,
        limit: integerLike.optional(),
      })
      .passthrough(),
  },
  memoriesCreate: {
    body: passthroughObject({
      subject_type: nonEmptyString,
      subject_id: nonEmptyString,
      note: nonEmptyString,
      tags: optionalStringOrArray.or(generalObject).optional(),
    }),
  },
  vintageEnrich: {
    body: passthroughObject({
      wine_id: z.union([nonEmptyString, integerLike]),
    }),
  },
  vintageBatchEnrich: {
    body: passthroughObject({
      filters: generalObject.optional(),
      limit: integerLike.optional(),
    }),
  },
  vintagePairingInsight: {
    body: passthroughObject({
      wine_id: z.union([nonEmptyString, integerLike]),
      dish_context: generalObject,
    }),
  },
  syncChanges: {
    query: z
      .object({
        since: integerLike.optional(),
      })
      .passthrough(),
  },
  systemActivity: {
    query: z
      .object({
        limit: integerLike.optional(),
      })
      .passthrough(),
  },
  authRegister: {
    body: z.object({
      email: z.string().email({ message: "Must be a valid email address." }),
      password: z
        .string()
        .min(8, { message: "Password must be at least 8 characters." }),
    }),
  },
  authLogin: {
    body: z.object({
      email: z.string().email({ message: "Must be a valid email address." }),
      password: z.string().min(1, { message: "Password is required." }),
    }),
  },
  guestSession: {
    body: z
      .object({
        event_code: optionalNonEmptyString,
        invite_token: optionalNonEmptyString,
        pin: optionalNonEmptyString,
      })
      .refine((payload) => payload.event_code || payload.invite_token, {
        message: "event_code or invite_token is required.",
        path: ["event_code"],
      }),
  },
  authInvite: {
    body: z.object({
      email: z.string().email({ message: "Must be a valid email address." }),
      role: z.enum(["admin", "crew", "guest"]),
      expires_in_hours: integerLike.optional(),
      pin: optionalNonEmptyString,
    }),
  },
  authAcceptInvite: {
    body: z.object({
      token: nonEmptyString,
      password: z
        .string()
        .min(8, { message: "Password must be at least 8 characters." })
        .optional(),
      pin: optionalNonEmptyString,
    }),
  },
};

const validate = (schemaConfig) => {
  const config = schemaConfig || {};

  return (req, res, next) => {
    try {
      if (config.params) {
        req.params = config.params.parse(req.params || {});
      }

      if (config.query) {
        req.query = config.query.parse(req.query || {});
      }

      if (config.body) {
        req.body = config.body.parse(req.body || {});
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          path: issue.path.length ? issue.path.join(".") : null,
          message: issue.message,
        }));

        return res.status(422).json({
          success: false,
          error: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Request validation failed.",
            details,
          },
        });
      }

      return next(error);
    }
  };
};

module.exports = { validate, validators };
