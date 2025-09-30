const Database = require('../database/connection');
const {
    serializeExplanation,
    serializeMemory,
} = require('../utils/serialize');

function normalizeJsonField(value) {
    if (value == null) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        try {
            return JSON.parse(trimmed);
        } catch (error) {
            // Attempt to split newline or comma separated text into array entries
            if (trimmed.includes('\n')) {
                return trimmed
                    .split('\n')
                    .map((entry) => entry.trim())
                    .filter(Boolean);
            }

            if (trimmed.includes(',')) {
                return trimmed
                    .split(',')
                    .map((entry) => entry.trim())
                    .filter(Boolean);
            }

            return trimmed;
        }
    }

    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'object') {
        return value;
    }

    return null;
}

function stringifyJsonField(value) {
    if (value == null) {
        return null;
    }

    try {
        return JSON.stringify(value);
    } catch (error) {
        return null;
    }
}

function normalizeLimitValue(limit, fallback, { min = 1, max = 100 } = {}) {
    const numeric = typeof limit === 'number' && Number.isFinite(limit)
        ? limit
        : parseInt(limit, 10);

    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    return Math.min(Math.max(numeric, min), max);
}

class ExplainabilityService {
    constructor(database = null) {
        this.db = database || Database.getInstance();
    }

    async listExplanations({ entityType, entityId, limit = 20, role = 'guest' }) {
        const normalizedLimit = normalizeLimitValue(limit, 20, { min: 1, max: 100 });

        const rows = await this.db.all(
            `SELECT id, entity_type, entity_id, generated_at, factors, summary
             FROM Explanations
             WHERE entity_type = ? AND entity_id = ?
             ORDER BY datetime(generated_at) DESC, id DESC
             LIMIT ?`,
            [entityType, String(entityId), normalizedLimit]
        );

        return rows.map((row) => serializeExplanation(row, role));
    }

    async createExplanation({ entityType, entityId, summary, factors = null, generatedAt = null }) {
        const normalizedFactors = normalizeJsonField(factors);
        const factorsJson = stringifyJsonField(normalizedFactors);
        const timestamp = generatedAt ? new Date(generatedAt) : new Date();

        const result = await this.db.run(
            `INSERT INTO Explanations (entity_type, entity_id, generated_at, factors, summary)
             VALUES (?, ?, ?, ?, ?)`
            , [
                entityType,
                String(entityId),
                Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString(),
                factorsJson,
                summary,
            ]
        );

        const created = await this.db.get(
            `SELECT id, entity_type, entity_id, generated_at, factors, summary
             FROM Explanations WHERE id = ?`,
            [result.lastID]
        );

        return serializeExplanation(created, 'crew');
    }

    async listMemories({ subjectType, subjectId, limit = 10, role = 'guest' }) {
        const normalizedLimit = normalizeLimitValue(limit, 10, { min: 1, max: 100 });

        const rows = await this.db.all(
            `SELECT id, subject_type, subject_id, created_at, author_id, note, tags
             FROM Memories
             WHERE subject_type = ? AND subject_id = ?
             ORDER BY datetime(created_at) DESC, id DESC
             LIMIT ?`,
            [subjectType, String(subjectId), normalizedLimit]
        );

        return rows.map((row) => serializeMemory(row, role));
    }

    async createMemory({ subjectType, subjectId, authorId = null, note, tags = null }) {
        const normalizedTags = normalizeJsonField(tags);
        const tagsJson = stringifyJsonField(normalizedTags);

        const result = await this.db.run(
            `INSERT INTO Memories (subject_type, subject_id, author_id, note, tags)
             VALUES (?, ?, ?, ?, ?)`
            , [
                subjectType,
                String(subjectId),
                authorId || null,
                note,
                tagsJson,
            ]
        );

        const created = await this.db.get(
            `SELECT id, subject_type, subject_id, created_at, author_id, note, tags
             FROM Memories WHERE id = ?`,
            [result.lastID]
        );

        return serializeMemory(created, 'crew');
    }
}

module.exports = ExplainabilityService;
