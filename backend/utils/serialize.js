"use strict";

const ROLE_INVENTORY_FIELDS = {
  guest: [
    "id",
    "vintage_id",
    "wine_id",
    "name",
    "producer",
    "region",
    "country",
    "wine_type",
    "grape_varieties",
    "style",
    "year",
    "available_quantity",
    "location",
    "quality_score",
  ],
  crew: [
    "id",
    "vintage_id",
    "wine_id",
    "name",
    "producer",
    "region",
    "country",
    "wine_type",
    "grape_varieties",
    "style",
    "year",
    "quantity",
    "reserved_quantity",
    "available_quantity",
    "location",
    "quality_score",
    "cost_per_bottle",
    "current_value",
    "storage_conditions",
    "last_inventory_date",
    "notes",
    "created_at",
    "updated_at",
  ],
};

ROLE_INVENTORY_FIELDS.admin = ROLE_INVENTORY_FIELDS.crew;

const LEDGER_FIELDS = [
  "id",
  "vintage_id",
  "transaction_type",
  "quantity",
  "unit_cost",
  "total_cost",
  "location",
  "reference_id",
  "notes",
  "created_by",
  "created_at",
  "wine_name",
  "producer",
  "year",
];

const LOCATION_SUMMARY_FIELDS = [
  "location",
  "stock_items",
  "total_bottles",
  "reserved_bottles",
  "available_bottles",
];

const PAIRING_SCORE_FIELDS = [
  "style_match",
  "flavor_harmony",
  "texture_balance",
  "regional_tradition",
  "seasonal_appropriateness",
  "ai_score",
  "total",
  "confidence",
];

const PAIRING_FIELDS = [
  "reasoning",
  "ai_enhanced",
  "learning_session_id",
  "learning_recommendation_id",
  "confidence",
];

const WINE_FIELDS = [
  "id",
  "name",
  "producer",
  "region",
  "country",
  "wine_type",
  "grape_varieties",
  "alcohol_content",
  "style",
  "tasting_notes",
  "food_pairings",
  "serving_temp_min",
  "serving_temp_max",
  "quality_score",
  "weather_score",
  "critic_score",
];

const VINTAGE_FIELDS = [
  "id",
  "wine_id",
  "year",
  "harvest_date",
  "bottling_date",
  "release_date",
  "peak_drinking_start",
  "peak_drinking_end",
  "quality_score",
  "weather_score",
  "critic_score",
  "production_notes",
  "total_stock",
  "avg_cost_per_bottle",
  "total_value",
];

const ALIAS_FIELDS = ["id", "wine_id", "alias_name", "alias_type", "region", "created_at"];

const PROCUREMENT_CRITERIA_FIELDS = [
  "budget_limit",
  "minimum_quality_score",
  "priority_regions",
  "wine_types",
  "stock_threshold",
];

const PROCUREMENT_SUMMARY_FIELDS = [
  "total_opportunities",
  "recommended_spend",
  "projected_value",
  "average_score",
  "top_regions",
  "urgent_actions",
  "budget_limit",
];

const PROCUREMENT_OPPORTUNITY_FIELDS = [
  "wine_name",
  "producer",
  "wine_type",
  "region",
  "year",
  "quality_score",
  "price_per_bottle",
  "availability_status",
  "minimum_order",
  "supplier_name",
  "supplier_id",
  "current_stock",
  "recommended_quantity",
  "estimated_value",
  "estimated_investment",
  "estimated_savings",
  "urgency",
  "confidence",
];

const PROCUREMENT_SCORE_FIELDS = [
  "stock_urgency",
  "value_proposition",
  "quality_score",
  "supplier_reliability",
  "seasonal_relevance",
  "budget_alignment",
  "total",
  "confidence",
];

const VINTAGE_PROCUREMENT_FIELDS = ["weatherScore", "currentQuantity"];
const VINTAGE_RECOMMENDATION_FIELDS = [
  "action",
  "priority",
  "reasoning",
  "suggestedQuantity",
  "timingAdvice",
  "considerations",
];

const PURCHASE_ORDER_FIELDS = [
  "order_id",
  "total_amount",
  "item_count",
  "success",
  "supplier_id",
  "delivery_date",
  "notes",
];

const PURCHASE_ORDER_VALIDATION_FIELDS = ["has_delivery_date", "notes_included"];

const EXPLANATION_FIELDS_BY_ROLE = {
  guest: ["id", "generated_at", "summary", "factors"],
  crew: ["id", "entity_type", "entity_id", "generated_at", "summary", "factors"],
};

EXPLANATION_FIELDS_BY_ROLE.admin = EXPLANATION_FIELDS_BY_ROLE.crew;

const MEMORY_FIELDS_BY_ROLE = {
  guest: ["id", "created_at", "note", "tags"],
  crew: ["id", "subject_type", "subject_id", "created_at", "author_id", "note", "tags"],
};

MEMORY_FIELDS_BY_ROLE.admin = MEMORY_FIELDS_BY_ROLE.crew;

const GUIDANCE_FIELDS = [
  "storage_temp_min",
  "storage_temp_max",
  "storage_temp_min_f",
  "storage_temp_max_f",
  "storage_recommendation",
  "should_decant",
  "decanting_time_minutes_min",
  "decanting_time_minutes_max",
  "decanting_recommendation",
];

const INVENTORY_ACTION_FIELDS = ["success", "message", "remaining_stock", "new_quantity"];

const INTAKE_SUMMARY_FIELDS = [
  "success",
  "intake_id",
  "status",
  "order_reference",
  "source_type",
  "supplier",
  "total_items",
  "outstanding_quantity",
  "items",
];

const INTAKE_RECEIVE_FIELDS = [
  "success",
  "intake_id",
  "status",
  "outstanding_bottles",
  "all_received",
  "receipts",
];

const INTAKE_STATUS_FIELDS = [
  "success",
  "intake_id",
  "supplier",
  "reference",
  "status",
  "source_type",
  "order_date",
  "expected_delivery",
  "outstanding_bottles",
  "all_received",
  "items",
];

const PROCUREMENT_ANALYSIS_FIELDS = [
  "supplier_id",
  "quantity",
  "unit_price",
  "total_cost",
  "availability",
  "current_stock",
  "projected_stock_after_purchase",
  "context",
];

const PROCUREMENT_ANALYSIS_WINE_FIELDS = ["name", "producer", "year", "quality_score"];

const PROCUREMENT_ANALYSIS_META_FIELDS = [
  "score",
  "reasoning",
  "recommendation",
  "estimated_market_price",
  "estimated_savings",
  "budget_impact",
  "supplier",
];

const SUPPLIER_REFERENCE_FIELDS = ["name", "rating", "payment_terms", "delivery_terms"];

const VINTAGE_ENRICHMENT_FIELDS = [
  "wine_id",
  "vintage_id",
  "name",
  "producer",
  "region",
  "wine_type",
  "year",
  "qualityScore",
  "weatherAnalysis",
  "vintageSummary",
  "procurementRec",
  "enrichedAt",
  "enrichmentError",
];

const SYNC_FIELD_MAP = {
  Wines: [
    "id",
    "name",
    "producer",
    "region",
    "country",
    "wine_type",
    "grape_varieties",
    "alcohol_content",
    "style",
    "tasting_notes",
    "food_pairings",
    "serving_temp_min",
    "serving_temp_max",
    "quality_score",
    "weather_score",
    "critic_score",
    "created_at",
    "updated_at",
  ],
  Vintages: [
    "id",
    "wine_id",
    "year",
    "harvest_date",
    "bottling_date",
    "release_date",
    "peak_drinking_start",
    "peak_drinking_end",
    "quality_score",
    "weather_score",
    "critic_score",
    "production_notes",
    "created_at",
    "updated_at",
  ],
  Stock: [
    "id",
    "vintage_id",
    "location",
    "quantity",
    "reserved_quantity",
    "cost_per_bottle",
    "current_value",
    "storage_conditions",
    "last_inventory_date",
    "notes",
    "created_at",
    "updated_at",
  ],
  Suppliers: [
    "id",
    "name",
    "contact_person",
    "email",
    "phone",
    "address",
    "specialties",
    "payment_terms",
    "delivery_terms",
    "rating",
    "notes",
    "active",
    "created_at",
    "updated_at",
  ],
  PriceBook: [
    "id",
    "vintage_id",
    "supplier_id",
    "price_per_bottle",
    "minimum_order",
    "availability_status",
    "last_updated",
    "valid_until",
    "notes",
    "created_at",
    "updated_at",
  ],
  InventoryIntakeOrders: [
    "id",
    "supplier_id",
    "supplier_name",
    "source_type",
    "reference",
    "order_date",
    "expected_delivery",
    "status",
    "created_at",
    "updated_at",
  ],
  InventoryIntakeItems: [
    "id",
    "intake_id",
    "external_reference",
    "wine_name",
    "producer",
    "region",
    "country",
    "wine_type",
    "grape_varieties",
    "vintage_year",
    "quantity_ordered",
    "quantity_received",
    "unit_cost",
    "location",
    "status",
    "notes",
    "wine_id",
    "vintage_id",
    "created_at",
    "updated_at",
  ],
};

const USER_FIELDS = ["id", "email", "role", "created_at", "last_login"];

const INVITE_FIELDS = ["token", "email", "role", "expires_at", "requires_pin"];

function pick(source, fields) {
  if (!source || typeof source !== "object") {
    return {};
  }
  return fields.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field) && source[field] !== undefined) {
      acc[field] = source[field];
    }
    return acc;
  }, {});
}

function mapArray(value, serializer) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => serializer(item)).filter((item) => item && typeof item === "object");
}

function parseJSON(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeArrayOrObject(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = parseJSON(trimmed, null);
    if (parsed) {
      return parsed;
    }

    if (trimmed.includes("\n")) {
      return trimmed
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    return trimmed;
  }

  return null;
}

const SENSITIVE_TAG_PATTERNS = [
  /^internal(?::|\b)/i,
  /^crew[-_\s]?only/i,
  /^private(?::|\b)/i,
  /^sensitive(?::|\b)/i,
];

const SENSITIVE_TAG_VISIBILITY = new Set([
  "internal",
  "crew",
  "crew_only",
  "private",
  "restricted",
  "confidential",
]);

function normalizeMemoryTagValue(tag) {
  if (tag === null || tag === undefined) {
    return null;
  }

  if (typeof tag === "string") {
    const trimmed = tag.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof tag === "object") {
    return { ...tag };
  }

  return null;
}

function isSensitiveTagForGuest(tag) {
  if (tag === null || tag === undefined) {
    return false;
  }

  if (typeof tag === "string") {
    return SENSITIVE_TAG_PATTERNS.some((pattern) => pattern.test(tag));
  }

  if (typeof tag === "object") {
    if (tag.is_sensitive === true || tag.private === true || tag.restricted === true) {
      return true;
    }

    const sensitivityKeys = ["visibility", "audience", "sensitivity", "access_level"];
    return sensitivityKeys.some((key) => {
      const value = typeof tag[key] === "string" ? tag[key].toLowerCase() : null;
      return value ? SENSITIVE_TAG_VISIBILITY.has(value) : false;
    });
  }

  return false;
}

function sanitizeTagForGuest(tag) {
  if (typeof tag !== "object" || tag === null) {
    return tag;
  }

  const sanitized = { ...tag };
  ["visibility", "audience", "sensitivity", "access_level", "private", "is_sensitive", "restricted"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      delete sanitized[key];
    }
  });
  return sanitized;
}

function normalizeMemoryTagsForRole(tags, role) {
  const normalizedArray = Array.isArray(tags)
    ? tags
    : tags !== null && tags !== undefined
    ? [tags]
    : [];

  const cleaned = normalizedArray
    .map((tag) => normalizeMemoryTagValue(tag))
    .filter((tag) => tag !== null);

  if (role !== "guest") {
    return cleaned;
  }

  return cleaned
    .filter((tag) => !isSensitiveTagForGuest(tag))
    .map((tag) => sanitizeTagForGuest(tag));
}

function serializeExplanation(record, role = "guest") {
  if (!record || typeof record !== "object") {
    return {};
  }

  const fields = EXPLANATION_FIELDS_BY_ROLE[role] || EXPLANATION_FIELDS_BY_ROLE.guest;
  const payload = pick(record, fields);
  if (Object.prototype.hasOwnProperty.call(payload, "factors")) {
    payload.factors = normalizeArrayOrObject(payload.factors);
  }
  return payload;
}

function serializeMemory(record, role = "guest") {
  if (!record || typeof record !== "object") {
    return {};
  }

  const fields = MEMORY_FIELDS_BY_ROLE[role] || MEMORY_FIELDS_BY_ROLE.guest;
  const payload = pick(record, fields);
  if (Object.prototype.hasOwnProperty.call(payload, "tags")) {
    const normalized = normalizeArrayOrObject(payload.tags);
    const sanitized = normalizeMemoryTagsForRole(normalized, role);
    payload.tags = sanitized;
  }
  return payload;
}

function serializeUser(user) {
  if (!user) {
    return null;
  }
  return pick(user, USER_FIELDS);
}

function serializeInvite(invite) {
  if (!invite) {
    return null;
  }
  return pick(invite, INVITE_FIELDS);
}

function serializeGuidance(guidance) {
  const sanitized = pick(guidance || {}, GUIDANCE_FIELDS);
  return sanitized;
}

function serializeInventoryItem(item, { role = "guest", guidance } = {}) {
  const fields = ROLE_INVENTORY_FIELDS[role] || ROLE_INVENTORY_FIELDS.guest;
  const sanitized = pick(item || {}, fields);

  if (guidance) {
    const normalizedGuidance = serializeGuidance(guidance);
    if (Object.keys(normalizedGuidance).length > 0) {
      sanitized.guidance = normalizedGuidance;
    }
  }

  return sanitized;
}

function serializeInventoryItems(items, role = "guest", { guidanceResolver } = {}) {
  return mapArray(items, (item) => {
    const guidance = guidanceResolver ? guidanceResolver(item) : undefined;
    return serializeInventoryItem(item, { role, guidance });
  });
}

function serializeInventoryAction(result) {
  return pick(result || {}, INVENTORY_ACTION_FIELDS);
}

function serializeInventoryLocations(locations) {
  return mapArray(locations, (location) => pick(location, LOCATION_SUMMARY_FIELDS));
}

function serializeLedger(entries) {
  return mapArray(entries, (entry) => pick(entry, LEDGER_FIELDS));
}

function serializeIntakeSummary(summary) {
  const base = pick(summary || {}, INTAKE_SUMMARY_FIELDS);
  if (base.supplier && typeof base.supplier === "object") {
    base.supplier = pick(base.supplier, ["id", "name"]);
  }
  if (Array.isArray(base.items)) {
    base.items = base.items.map((item) =>
      pick(item, [
        "external_reference",
        "wine_name",
        "producer",
        "vintage_year",
        "quantity_ordered",
        "unit_cost",
        "location",
      ])
    );
  }
  return base;
}

function serializeIntakeReceive(result) {
  const base = pick(result || {}, INTAKE_RECEIVE_FIELDS);
  if (Array.isArray(base.receipts)) {
    base.receipts = base.receipts.map((receipt) =>
      pick(receipt, ["item_id", "wine_name", "vintage_year", "received_quantity", "status", "remaining"])
    );
  }
  return base;
}

function serializeIntakeStatus(result) {
  const base = pick(result || {}, INTAKE_STATUS_FIELDS);
  if (base.supplier && typeof base.supplier === "object") {
    base.supplier = pick(base.supplier, ["id", "name"]);
  }
  if (Array.isArray(base.items)) {
    base.items = base.items.map((item) =>
      pick(item, [
        "item_id",
        "wine_name",
        "producer",
        "vintage_year",
        "quantity_ordered",
        "quantity_received",
        "outstanding_quantity",
        "status",
        "location",
        "external_reference",
      ])
    );
  }
  return base;
}

function serializePairingRecommendation(recommendation) {
  if (!recommendation || typeof recommendation !== "object") {
    return {};
  }

  const payload = pick(recommendation, PAIRING_FIELDS);

  if (recommendation.wine) {
    payload.wine = serializeInventoryItem(recommendation.wine, { role: "crew" });
  }

  if (recommendation.score) {
    payload.score = pick(recommendation.score, PAIRING_SCORE_FIELDS);
  }

  if (typeof recommendation.confidence === "number" && payload.confidence === undefined) {
    payload.confidence = recommendation.confidence;
  }

  return payload;
}

function serializePairings(list) {
  return mapArray(list, serializePairingRecommendation);
}

function serializePairingExplanation(explanation) {
  if (!explanation || typeof explanation !== "object") {
    return null;
  }

  const payload = {};

  if (explanation.summary) {
    payload.summary = String(explanation.summary);
  }

  if (Object.prototype.hasOwnProperty.call(explanation, "factors")) {
    const normalized = normalizeArrayOrObject(explanation.factors);

    if (Array.isArray(normalized)) {
      const cleaned = normalized
        .map((item) => (typeof item === "string" ? item.trim() : item))
        .filter((item) => {
          if (typeof item === "string") {
            return item.length > 0;
          }
          if (item && typeof item === "object") {
            return Object.keys(item).length > 0;
          }
          return false;
        });

      if (cleaned.length) {
        payload.factors = cleaned;
      }
    } else if (normalized && typeof normalized === "object") {
      const cleanedObject = Object.entries(normalized).reduce((acc, [key, value]) => {
        if (value === null || value === undefined) {
          return acc;
        }
        const stringValue = typeof value === "string" ? value.trim() : value;
        if (stringValue !== "" && stringValue !== null) {
          acc[key] = stringValue;
        }
        return acc;
      }, {});

      if (Object.keys(cleanedObject).length) {
        payload.factors = cleanedObject;
      }
    } else if (typeof normalized === "string" && normalized.trim()) {
      payload.factors = normalized.trim();
    }
  }

  return Object.keys(payload).length ? payload : null;
}

function serializePairingResult(result) {
  if (Array.isArray(result)) {
    return { recommendations: serializePairings(result) };
  }

  const recommendations = serializePairings(result?.recommendations);
  const explanation = serializePairingExplanation(result?.explanation);

  const payload = { recommendations };

  if (explanation) {
    payload.explanation = explanation;
  }

  return payload;
}

function serializeWine(wine, { guidance, extraFields = [] } = {}) {
  const allowedExtras = Array.isArray(extraFields) ? extraFields : [];
  const fields = [...new Set([...WINE_FIELDS, ...allowedExtras])];
  const base = pick(wine || {}, fields);
  if (guidance) {
    const normalizedGuidance = serializeGuidance(guidance);
    if (Object.keys(normalizedGuidance).length > 0) {
      base.guidance = normalizedGuidance;
    }
  }
  return base;
}

function serializeWineList(wines, guidanceResolver, extraFields = []) {
  return mapArray(wines, (wine) =>
    serializeWine(wine, {
      guidance: guidanceResolver ? guidanceResolver(wine) : undefined,
      extraFields,
    })
  );
}

function serializeVintage(vintage) {
  return pick(vintage || {}, VINTAGE_FIELDS);
}

function serializeAlias(alias) {
  return pick(alias || {}, ALIAS_FIELDS);
}

function serializeWineDetail({ wine, vintages = [], aliases = [], aggregates = {}, guidance }) {
  const payload = serializeWine(wine, {
    guidance,
    extraFields: ["year", "total_stock", "avg_cost_per_bottle", "total_value", "peak_drinking_start", "peak_drinking_end"],
  });
  Object.assign(payload, pick(aggregates, ["total_stock", "total_value", "avg_cost_per_bottle"]));
  payload.vintages = mapArray(vintages, serializeVintage);
  payload.aliases = mapArray(aliases, serializeAlias);
  return payload;
}

function serializeProcurementSummary(summary) {
  const base = pick(summary || {}, PROCUREMENT_SUMMARY_FIELDS);
  if (Array.isArray(base.top_regions)) {
    base.top_regions = base.top_regions.map((entry) => pick(entry, ["region", "count"]));
  }
  return base;
}

function serializeProcurementOpportunity(opportunity) {
  const base = pick(opportunity || {}, PROCUREMENT_OPPORTUNITY_FIELDS);
  if (opportunity && opportunity.score) {
    base.score = pick(opportunity.score, PROCUREMENT_SCORE_FIELDS);
  }
  return base;
}

function serializeProcurementRecommendations(result) {
  if (!result || typeof result !== "object") {
    return { criteria: {}, summary: {}, opportunities: [] };
  }

  return {
    criteria: pick(result.criteria || {}, PROCUREMENT_CRITERIA_FIELDS),
    summary: serializeProcurementSummary(result.summary),
    opportunities: mapArray(result.opportunities, serializeProcurementOpportunity),
  };
}

function serializeSupplierReference(supplier) {
  return pick(supplier || {}, SUPPLIER_REFERENCE_FIELDS);
}

function serializeProcurementAnalysis(result) {
  if (!result || typeof result !== "object") {
    return {};
  }

  const payload = pick(result, PROCUREMENT_ANALYSIS_FIELDS);
  if (result.wine) {
    payload.wine = pick(result.wine, PROCUREMENT_ANALYSIS_WINE_FIELDS);
  }
  if (result.analysis) {
    const analysis = pick(result.analysis, PROCUREMENT_ANALYSIS_META_FIELDS);
    if (result.analysis.score) {
      analysis.score = pick(result.analysis.score, PROCUREMENT_SCORE_FIELDS);
    }
    if (analysis.supplier) {
      analysis.supplier = serializeSupplierReference(result.analysis.supplier);
    }
    payload.analysis = analysis;
  }
  return payload;
}

function serializePurchaseOrder(order) {
  if (!order || typeof order !== "object") {
    return {};
  }
  const payload = pick(order, PURCHASE_ORDER_FIELDS);
  if (order.validation) {
    payload.validation = pick(order.validation, PURCHASE_ORDER_VALIDATION_FIELDS);
  }
  return payload;
}

function serializeSyncRows(table, rows) {
  if (table === "InventoryIntakeOrders") {
    return mapArray(rows, serializeInventoryIntakeOrder);
  }
  if (table === "InventoryIntakeItems") {
    return mapArray(rows, serializeInventoryIntakeItem);
  }
  const fields = SYNC_FIELD_MAP[table];
  if (!fields) {
    return mapArray(rows, (row) => (typeof row === "object" ? { ...row } : row));
  }
  return mapArray(rows, (row) => pick(row, fields));
}

function serializeInventoryIntakeOrder(record) {
  const base = pick(record || {}, SYNC_FIELD_MAP.InventoryIntakeOrders);
  if (record && record.metadata) {
    const metadata = parseJSON(record.metadata, {});
    base.metadata = pick(metadata, ["file_name", "parsed_at", "total_items", "ocr_confidence"]);
  }
  return base;
}

function serializeInventoryIntakeItem(record) {
  return pick(record || {}, SYNC_FIELD_MAP.InventoryIntakeItems);
}

function serializeVintageEnrichment(result) {
  return pick(result || {}, VINTAGE_ENRICHMENT_FIELDS);
}

function serializeVintageEnrichmentList(results) {
  return mapArray(results, serializeVintageEnrichment);
}

function serializeVintageProcurementRecommendation(rec) {
  if (!rec || typeof rec !== "object") {
    return {};
  }

  const payload = pick(rec, VINTAGE_PROCUREMENT_FIELDS);
  if (rec.wine) {
    payload.wine = pick(rec.wine, ["name", "producer", "year", "region"]);
  }
  if (rec.recommendation) {
    payload.recommendation = pick(rec.recommendation, VINTAGE_RECOMMENDATION_FIELDS);
  }
  return payload;
}

function serializeVintageProcurementRecommendations(list) {
  return mapArray(list, serializeVintageProcurementRecommendation);
}

module.exports = {
  serializeUser,
  serializeInvite,
  serializeGuidance,
  serializeInventoryItem,
  serializeInventoryItems,
  serializeInventoryAction,
  serializeInventoryLocations,
  serializeLedger,
  serializeIntakeSummary,
  serializeIntakeReceive,
  serializeIntakeStatus,
  serializePairingRecommendation,
  serializePairings,
  serializePairingResult,
  serializeWine,
  serializeWineList,
  serializeWineDetail,
  serializeVintage,
  serializeProcurementRecommendations,
  serializeProcurementAnalysis,
  serializePurchaseOrder,
  serializeSyncRows,
  serializeInventoryIntakeOrder,
  serializeInventoryIntakeItem,
  serializeVintageEnrichmentList,
  serializeVintageProcurementRecommendations,
  serializeExplanation,
  serializeMemory,
};
