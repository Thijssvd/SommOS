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
