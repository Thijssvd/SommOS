const SAMPLE_DATA = {
    wines: [
        {
            id: 'test-wine-1',
            name: 'Château Test Bordeaux',
            producer: 'Test Château',
            region: 'Bordeaux',
            country: 'France',
            wine_type: 'Red',
            style: 'Full Bodied Red',
            grape_varieties: JSON.stringify(['Cabernet Sauvignon', 'Merlot']),
            critic_score: 92,
            production_notes: JSON.stringify({
                vintageSummary: 'Classic left bank structure with polished tannins.',
                procurementRec: 'Maintain 12 bottles in reserve for owner dinners.'
            })
        },
        {
            id: 'test-wine-2',
            name: 'Maison Test Champagne',
            producer: 'Maison Test',
            region: 'Champagne',
            country: 'France',
            wine_type: 'Sparkling',
            style: 'Brut',
            grape_varieties: JSON.stringify(['Chardonnay', 'Pinot Noir']),
            critic_score: 95,
            production_notes: null
        }
    ],
    vintages: [
        {
            id: 'test-vintage-1',
            wine_id: 'test-wine-1',
            year: 2020,
            quality_score: 92,
            weather_score: 88,
            peak_drinking_start: '2024',
            peak_drinking_end: '2030'
        },
        {
            id: 'test-vintage-2',
            wine_id: 'test-wine-2',
            year: 2019,
            quality_score: 94,
            weather_score: 91,
            peak_drinking_start: '2023',
            peak_drinking_end: '2032'
        }
    ],
    stock: [
        {
            id: 'stock-1',
            vintage_id: 'test-vintage-1',
            location: 'main-cellar',
            quantity: 12,
            reserved_quantity: 2,
            cost_per_bottle: 25.5
        },
        {
            id: 'stock-2',
            vintage_id: 'test-vintage-2',
            location: 'service-bar',
            quantity: 6,
            reserved_quantity: 0,
            cost_per_bottle: 45.0
        }
    ],
    ledger: [
        {
            id: 'ledger-1',
            vintage_id: 'test-vintage-1',
            transaction_type: 'IN',
            location: 'main-cellar',
            quantity: 12,
            notes: 'Initial stock',
            created_by: 'system',
            created_at: new Date().toISOString()
        },
        {
            id: 'ledger-2',
            vintage_id: 'test-vintage-1',
            transaction_type: 'OUT',
            location: 'main-cellar',
            quantity: -2,
            notes: 'Served during charter',
            created_by: 'crew',
            created_at: new Date(Date.now() - 3600 * 1000).toISOString()
        },
        {
            id: 'ledger-3',
            vintage_id: 'test-vintage-1',
            transaction_type: 'MOVE',
            location: 'service-bar',
            quantity: 3,
            notes: 'Moved for dinner service',
            created_by: 'crew',
            created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
        },
        {
            id: 'ledger-4',
            vintage_id: 'test-vintage-1',
            transaction_type: 'RESERVE',
            location: 'owner-suite',
            quantity: 1,
            notes: 'Reserved for owner',
            created_by: 'chief-stew',
            created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
        },
        {
            id: 'ledger-5',
            vintage_id: 'test-vintage-1',
            transaction_type: 'UNRESERVE',
            location: 'main-cellar',
            quantity: 1,
            notes: 'Reservation cancelled',
            created_by: 'chief-stew',
            created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
        }
    ],
    suppliers: [
        { id: 'supplier-123', name: 'Fine Wine Imports', active: 1 }
    ],
    explanations: [
        {
            id: 'exp-1',
            entity_type: 'pairing',
            entity_id: 'rec-1',
            generated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            factors: JSON.stringify(['Owner preference', 'Seasonal menu match']),
            summary: 'Tailored for the charter guest preferences.'
        }
    ],
    memories: [
        {
            id: 'memo-1',
            subject_type: 'wine',
            subject_id: 'test-wine-1',
            created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            author_id: 'crew-1',
            note: 'Serve slightly chilled for deck sunsets.',
            tags: JSON.stringify(['service', 'internal:crew-note'])
        }
    ],
    users: [
        {
            id: 'user-1',
            email: 'test-admin@sommos.local',
            role: 'admin',
            password_hash: null,
            created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        }
    ],
    weather_cache: []
};

const { getConfig } = require('../../config/env');

class MockDatabase {
    constructor(customPath = null) {
        const env = getConfig();
        this.dbPath = customPath || env.database.path || ':memory:';
        this.reset();
    }

    reset() {
        this.data = JSON.parse(JSON.stringify(SAMPLE_DATA));
    }

    static getInstance(customPath = null) {
        if (!MockDatabase.instance || customPath) {
            MockDatabase.instance = new MockDatabase(customPath);
        }
        return MockDatabase.instance;
    }

    async initialize() {
        return this;
    }

    async ensureInitialized() {
        return this;
    }

    async exec() {
        return this;
    }

    async close() {
        return true;
    }

    cloneWine(wine) {
        return wine ? { ...wine } : undefined;
    }

    buildWineRow(wine, vintage) {
        const totalStock = this.data.stock
            .filter(stock => stock.vintage_id === (vintage?.id || wine.id))
            .reduce((sum, stock) => sum + (stock.quantity || 0), 0);

        return {
            ...wine,
            ...(vintage || {}),
            total_stock: totalStock
        };
    }

    async get(query, params = []) {
        const sql = query.toLowerCase();

        if (sql.includes('select 1')) {
            return { 1: 1 };
        }

        if (sql.includes('from weathercache') && sql.includes('where key = ?')) {
            const key = params[0];
            const entry = this.data.weather_cache.find((row) => row.key === key);
            return entry ? { ...entry } : undefined;
        }

        if (sql.includes('from wines') && sql.includes('where id = ?')) {
            const id = params[0];
            return this.cloneWine(this.data.wines.find(w => w.id === id));
        }

        if (sql.includes('from users') && sql.includes('where email = ?')) {
            const email = params[0];
            const user = this.data.users.find((entry) => entry.email === email);
            return user ? { ...user } : undefined;
        }

        if (sql.includes('from users') && sql.includes('where id = ?')) {
            const id = params[0];
            const user = this.data.users.find((entry) => String(entry.id) === String(id));
            return user ? { ...user } : undefined;
        }

        if (sql.includes('from explanations') && sql.includes('where id = ?')) {
            const id = params[0];
            const explanation = this.data.explanations.find((entry) => String(entry.id) === String(id));
            return explanation ? { ...explanation } : undefined;
        }

        if (sql.includes('from memories') && sql.includes('where id = ?')) {
            const id = params[0];
            const memory = this.data.memories.find((entry) => String(entry.id) === String(id));
            return memory ? { ...memory } : undefined;
        }

        if (sql.includes('from wines w') && sql.includes('join vintages v') && sql.includes('where w.id = ?')) {
            const id = params[0];
            const wine = this.data.wines.find(w => w.id === id);
            const vintage = this.data.vintages.find(v => v.wine_id === id) || null;
            return wine && vintage ? { ...wine, ...vintage } : null;
        }

        if (sql.includes('from vintages') && sql.includes('where id = ?')) {
            const id = params[0];
            return { ...this.data.vintages.find(v => v.id === id) };
        }

        return undefined;
    }

    async all(query, params = []) {
        const sql = query.toLowerCase();

        if (sql.includes('select 1')) {
            return [{ 1: 1 }];
        }

        if (sql.includes('from wines w') && sql.includes('left join vintages')) {
            // Build combined wine/vintage rows without complex SQL parsing.
            const rows = [];
            this.data.wines.forEach(wine => {
                const vintages = this.data.vintages.filter(v => v.wine_id === wine.id);
                if (vintages.length === 0) {
                    rows.push(this.buildWineRow(wine));
                } else {
                    vintages.forEach(vintage => {
                        rows.push(this.buildWineRow(wine, vintage));
                    });
                }
            });

            const limitCandidate = params.length >= 2 && typeof params[params.length - 2] === 'number'
                ? params[params.length - 2]
                : rows.length;
            const offsetCandidate = params.length >= 1 && typeof params[params.length - 1] === 'number'
                ? params[params.length - 1]
                : 0;

            return rows.slice(offsetCandidate, offsetCandidate + limitCandidate);
        }

        if (sql.includes('from vintages v') && sql.includes('left join stock')) {
            const wineId = params[0];
            return this.data.vintages
                .filter(v => v.wine_id === wineId)
                .map(vintage => {
                    const totalStock = this.data.stock
                        .filter(stock => stock.vintage_id === vintage.id)
                        .reduce((sum, stock) => sum + (stock.quantity || 0), 0);

                    return {
                        ...vintage,
                        total_stock: totalStock
                    };
                });
        }

        if (sql.includes('from aliases')) {
            return [];
        }

        if (sql.includes('select count(*) from wines')) {
            return [{
                total_wines: this.data.wines.length,
                total_vintages: this.data.vintages.length,
                total_bottles: this.data.stock.reduce((sum, stock) => sum + (stock.quantity || 0), 0),
                active_suppliers: this.data.suppliers.filter(s => s.active).length
            }];
        }

        if (sql.includes('from ledger l') && sql.includes('join vintages')) {
            const limit = typeof params[0] === 'number' ? params[0] : this.data.ledger.length;
            return this.data.ledger
                .slice()
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, limit)
                .map((entry) => {
                    const vintage = this.data.vintages.find(v => v.id === entry.vintage_id) || {};
                    const wine = this.data.wines.find(w => w.id === vintage.wine_id) || {};
                    return {
                        ...entry,
                        wine_name: wine.name,
                        producer: wine.producer,
                        year: vintage.year
                    };
                });
        }

        if (sql.includes('from ledger')) {
            const vintageId = params[0];
            return this.data.ledger.filter(entry => entry.vintage_id === vintageId);
        }

        if (sql.includes('from explanations')) {
            const [entityType, entityId, limit = this.data.explanations.length] = params;
            return this.data.explanations
                .filter((entry) => entry.entity_type === entityType && entry.entity_id === String(entityId))
                .slice()
                .sort((a, b) => {
                    const left = new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime();
                    if (left !== 0) {
                        return left;
                    }
                    return String(b.id).localeCompare(String(a.id));
                })
                .slice(0, typeof limit === 'number' ? limit : this.data.explanations.length)
                .map((entry) => ({ ...entry }));
        }

        if (sql.includes('from memories')) {
            const [subjectType, subjectId, limit = this.data.memories.length] = params;
            return this.data.memories
                .filter((entry) => entry.subject_type === subjectType && entry.subject_id === String(subjectId))
                .slice()
                .sort((a, b) => {
                    const left = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    if (left !== 0) {
                        return left;
                    }
                    return String(b.id).localeCompare(String(a.id));
                })
                .slice(0, typeof limit === 'number' ? limit : this.data.memories.length)
                .map((entry) => ({ ...entry }));
        }

        return [];
    }

    generateId(prefix) {
        if (!this.counters) {
            this.counters = {};
        }

        this.counters[prefix] = (this.counters[prefix] || 0) + 1;
        return `${prefix}-${Date.now()}-${this.counters[prefix]}`;
    }

    async run(query, params = []) {
        const sql = query.toLowerCase();

        if (sql.startsWith('delete from weathercache')) {
            const [key] = params;
            this.data.weather_cache = this.data.weather_cache.filter((entry) => entry.key !== key);
            return { lastID: key, changes: 1 };
        }

        if (sql.startsWith('insert or replace into weathercache')) {
            const [key, payload, fetchedAt, ttl] = params;
            const existingIndex = this.data.weather_cache.findIndex((entry) => entry.key === key);
            const row = { key, payload, fetched_at: fetchedAt, ttl };
            if (existingIndex >= 0) {
                this.data.weather_cache[existingIndex] = row;
            } else {
                this.data.weather_cache.push(row);
            }
            return { lastID: key, changes: 1 };
        }

        if (sql.startsWith('insert into wines')) {
            const [name, producer, region, country, wineType, grapeVarieties] = params;
            const id = this.generateId('wine');
            this.data.wines.push({
                id,
                name,
                producer,
                region,
                country,
                wine_type: wineType,
                grape_varieties: grapeVarieties
            });
            return { lastID: id, changes: 1 };
        }

        if (sql.startsWith('insert into vintages')) {
            const [wineId, year, qualityScore, weatherScore] = params;
            const id = this.generateId('vintage');
            this.data.vintages.push({
                id,
                wine_id: wineId,
                year,
                quality_score: qualityScore,
                weather_score: weatherScore
            });
            return { lastID: id, changes: 1 };
        }

        if (sql.startsWith('insert into stock')) {
            const [vintageId, location, quantity, costPerBottle] = params;
            const id = this.generateId('stock');
            this.data.stock.push({
                id,
                vintage_id: vintageId,
                location,
                quantity,
                reserved_quantity: 0,
                cost_per_bottle: costPerBottle
            });
            return { lastID: id, changes: 1 };
        }

        if (sql.startsWith('insert into ledger')) {
            const [vintageId, transactionType, location, quantity, notes, createdBy] = params;
            const id = this.generateId('ledger');
            this.data.ledger.push({
                id,
                vintage_id: vintageId,
                transaction_type: transactionType,
                location,
                quantity,
                notes,
                created_by: createdBy,
                created_at: new Date().toISOString()
            });
            return { lastID: id, changes: 1 };
        }

        if (sql.startsWith('insert into users')) {
            const [email, passwordHash, role] = params;
            const id = this.generateId('user');
            const user = {
                id,
                email,
                password_hash: passwordHash,
                role,
                created_at: new Date().toISOString(),
            };
            this.data.users.push(user);
            return { lastID: id, changes: 1 };
        }

        if (sql.startsWith('update users set role')) {
            const [role, id] = params;
            const user = this.data.users.find((entry) => String(entry.id) === String(id));
            if (user) {
                user.role = role;
            }
            return { lastID: id, changes: user ? 1 : 0 };
        }

        if (sql.startsWith('update users set password_hash')) {
            const [passwordHash, id] = params;
            const user = this.data.users.find((entry) => String(entry.id) === String(id));
            if (user) {
                user.password_hash = passwordHash;
            }
            return { lastID: id, changes: user ? 1 : 0 };
        }

        if (sql.startsWith('update users set last_login')) {
            const [timestamp, id] = params;
            const user = this.data.users.find((entry) => String(entry.id) === String(id));
            if (user) {
                user.last_login = timestamp;
            }
            return { lastID: id, changes: user ? 1 : 0 };
        }

        if (sql.startsWith('insert into explanations')) {
            const [entityType, entityId, generatedAt, factors, summary] = params;
            const id = this.generateId('explanation');
            this.data.explanations.push({
                id,
                entity_type: entityType,
                entity_id: String(entityId),
                generated_at: generatedAt,
                factors,
                summary,
            });
            return { lastID: id, changes: 1 };
        }

        if (sql.startsWith('insert into memories')) {
            const [subjectType, subjectId, authorId, note, tags] = params;
            const id = this.generateId('memory');
            this.data.memories.push({
                id,
                subject_type: subjectType,
                subject_id: String(subjectId),
                author_id: authorId,
                note,
                tags,
                created_at: new Date().toISOString(),
            });
            return { lastID: id, changes: 1 };
        }

        return { lastID: this.generateId('record'), changes: 1 };
    }

    async query(query, params = []) {
        return this.all(query, params);
    }
}

module.exports = MockDatabase;
