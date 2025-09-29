class InventoryManager {
    constructor() {
        this.sampleStock = [
            {
                id: 'stock-1',
                vintage_id: 'test-vintage-1',
                name: 'Château Test Bordeaux',
                producer: 'Test Château',
                year: 2020,
                wine_type: 'Red',
                region: 'Bordeaux',
                country: 'France',
                quantity: 12,
                reserved_quantity: 2,
                location: 'main-cellar',
                cost_per_bottle: 25.5
            },
            {
                id: 'stock-2',
                vintage_id: 'test-vintage-2',
                name: 'Maison Test Champagne',
                producer: 'Maison Test',
                year: 2019,
                wine_type: 'Sparkling',
                region: 'Champagne',
                country: 'France',
                quantity: 6,
                reserved_quantity: 0,
                location: 'service-bar',
                cost_per_bottle: 45.0
            }
        ];

        this.ledger = [
            {
                id: 'ledger-1',
                vintage_id: 'test-vintage-1',
                transaction_type: 'IN',
                location: 'main-cellar',
                quantity: 12,
                notes: 'Initial stock',
                created_by: 'system',
                created_at: new Date().toISOString()
            }
        ];
    }

    async getCurrentStock(filters = {}) {
        let results = [...this.sampleStock];

        if (filters.location) {
            results = results.filter(item => item.location === filters.location);
        }

        if (filters.wine_type) {
            results = results.filter(item => item.wine_type === filters.wine_type);
        }

        if (filters.region) {
            results = results.filter(item => (item.region || '').toLowerCase().includes(filters.region.toLowerCase()));
        }

        if (filters.available_only) {
            results = results.filter(item => item.quantity > 0);
        }

        return results;
    }

    async getInventoryList(filters = {}, options = {}) {
        const items = await this.getCurrentStock(filters);
        const total = items.length;
        const limitValue = Number.parseInt(options.limit, 10);
        const offsetValue = Number.parseInt(options.offset, 10);
        const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : total;
        const offset = Number.isFinite(offsetValue) && offsetValue >= 0 ? offsetValue : 0;

        return {
            items: limit >= total && offset === 0 ? items : items.slice(offset, offset + limit),
            total,
            limit,
            offset
        };
    }

    async getStockItemById(stockId) {
        return this.sampleStock.find(item => String(item.id) === String(stockId)) || null;
    }

    async listLocations() {
        const map = this.sampleStock.reduce((acc, item) => {
            if (!acc[item.location]) {
                acc[item.location] = {
                    location: item.location,
                    stock_items: 0,
                    total_bottles: 0,
                    reserved_bottles: 0,
                    available_bottles: 0
                };
            }

            const stats = acc[item.location];
            stats.stock_items += 1;
            stats.total_bottles += item.quantity;
            stats.reserved_bottles += item.reserved_quantity || 0;
            stats.available_bottles += (item.quantity || 0) - (item.reserved_quantity || 0);
            return acc;
        }, {});

        return Object.values(map);
    }

    async consumeWine(vintageId, location, quantity) {
        this.ledger.push({
            id: `ledger-${this.ledger.length + 1}`,
            vintage_id: vintageId,
            transaction_type: 'OUT',
            location,
            quantity: -Math.abs(quantity),
            notes: 'Mock consumption record',
            created_at: new Date().toISOString()
        });

        return { transactionId: this.ledger[this.ledger.length - 1].id };
    }

    async receiveWine(vintageId, location, quantity) {
        return {
            stockId: `stock-${Date.now()}`,
            vintage_id: vintageId,
            location,
            quantity
        };
    }

    async createInventoryIntake(request = {}) {
        return {
            success: true,
            intake_id: 101,
            status: 'ORDERED',
            items: request.items || [],
            outstanding_quantity: (request.items || []).reduce((sum, item) => sum + (item.stock?.quantity || 0), 0)
        };
    }

    async receiveInventoryIntake(intakeId, receipts = []) {
        return {
            success: true,
            intake_id: intakeId,
            received_count: receipts.length,
            status: 'RECEIVED'
        };
    }

    async getInventoryIntakeStatus(intakeId) {
        return {
            intake_id: intakeId,
            all_received: true,
            outstanding_bottles: 0
        };
    }

    async moveWine(vintageId, fromLocation, toLocation, quantity) {
        return {
            success: true,
            vintage_id: vintageId,
            from: fromLocation,
            to: toLocation,
            quantity
        };
    }

    async reserveWine(vintageId, location, quantity) {
        return {
            success: true,
            vintage_id: vintageId,
            location,
            quantity
        };
    }

    async getLedgerHistory(vintageId) {
        return this.ledger.filter(entry => entry.vintage_id === vintageId);
    }

    async addWineToInventory(wine, vintage, stock) {
        return {
            wine: {
                id: 'new-wine-1',
                ...wine
            },
            vintage: {
                id: 'new-vintage-1',
                ...vintage,
                weatherAnalysis: {
                    region: wine.region,
                    year: vintage.year,
                    overallScore: 88
                },
                vintageSummary: 'Favorable growing season delivering balanced structure.'
            },
            stock: {
                ...stock,
                id: 'new-stock-1'
            },
            success: true
        };
    }
}

module.exports = InventoryManager;
