// SommOS Test Fixtures Factory
// Centralized factory for generating test data with proper relationships

class TestDataFactory {
    constructor() {
        this.createdRecords = {
            wines: [],
            vintages: [],
            suppliers: [],
            stock: [],
            pricebook: [],
            ledger: []
        };
    }

    // Wine creation
    async createWine(db, overrides = {}) {
        const wine = {
            name: 'Test Bordeaux',
            producer: 'Château Test',
            region: 'Bordeaux',
            country: 'France', 
            wine_type: 'Red',
            grape_varieties: JSON.stringify(['Cabernet Sauvignon', 'Merlot']),
            alcohol_content: 13.5,
            style: 'Full-bodied',
            tasting_notes: 'Rich and complex with dark fruit flavors',
            food_pairings: JSON.stringify(['Red meat', 'Aged cheese']),
            serving_temp_min: 16,
            serving_temp_max: 18,
            ...overrides
        };

        const result = await db.run(`
            INSERT INTO Wines (name, producer, region, country, wine_type, grape_varieties, 
                             alcohol_content, style, tasting_notes, food_pairings, 
                             serving_temp_min, serving_temp_max)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [wine.name, wine.producer, wine.region, wine.country, wine.wine_type,
            wine.grape_varieties, wine.alcohol_content, wine.style, wine.tasting_notes,
            wine.food_pairings, wine.serving_temp_min, wine.serving_temp_max]);

        const createdWine = { ...wine, id: result.lastID };
        this.createdRecords.wines.push(createdWine);
        return createdWine;
    }

    // Vintage creation  
    async createVintage(db, wineId, overrides = {}) {
        const vintage = {
            wine_id: wineId,
            year: 2020,
            quality_score: 92,
            weather_score: 85,
            critic_score: 90,
            peak_drinking_start: 5,
            peak_drinking_end: 15,
            production_notes: 'Excellent vintage with favorable weather',
            ...overrides
        };

        const result = await db.run(`
            INSERT INTO Vintages (wine_id, year, quality_score, weather_score, critic_score,
                                peak_drinking_start, peak_drinking_end, production_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [vintage.wine_id, vintage.year, vintage.quality_score, vintage.weather_score,
            vintage.critic_score, vintage.peak_drinking_start, vintage.peak_drinking_end,
            vintage.production_notes]);

        const createdVintage = { ...vintage, id: result.lastID };
        this.createdRecords.vintages.push(createdVintage);
        return createdVintage;
    }

    // Stock creation
    async createStock(db, vintageId, overrides = {}) {
        const stock = {
            vintage_id: vintageId,
            location: 'main-cellar',
            quantity: 12,
            reserved_quantity: 0,
            cost_per_bottle: 35.50,
            current_value: 42.00,
            storage_conditions: JSON.stringify({ temperature: '16-18°C', humidity: '70%' }),
            notes: 'Good storage conditions',
            ...overrides
        };

        const result = await db.run(`
            INSERT INTO Stock (vintage_id, location, quantity, reserved_quantity, 
                             cost_per_bottle, current_value, storage_conditions, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [stock.vintage_id, stock.location, stock.quantity, stock.reserved_quantity,
            stock.cost_per_bottle, stock.current_value, stock.storage_conditions, stock.notes]);

        const createdStock = { ...stock, id: result.lastID };
        this.createdRecords.stock.push(createdStock);
        return createdStock;
    }

    // Supplier creation
    async createSupplier(db, overrides = {}) {
        const supplier = {
            name: 'Premium Wine Importers',
            contact_person: 'John Smith',
            email: 'john@premiumwines.com',
            phone: '+1-555-0123',
            address: '123 Wine Street, Napa, CA 94558',
            specialties: JSON.stringify(['Bordeaux', 'Burgundy', 'Champagne']),
            payment_terms: 'Net 30',
            delivery_terms: 'FOB Origin',
            rating: 4,
            notes: 'Reliable supplier with excellent wines',
            active: 1,
            ...overrides
        };

        const result = await db.run(`
            INSERT INTO Suppliers (name, contact_person, email, phone, address, specialties,
                                 payment_terms, delivery_terms, rating, notes, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [supplier.name, supplier.contact_person, supplier.email, supplier.phone,
            supplier.address, supplier.specialties, supplier.payment_terms, 
            supplier.delivery_terms, supplier.rating, supplier.notes, supplier.active]);

        const createdSupplier = { ...supplier, id: result.lastID };
        this.createdRecords.suppliers.push(createdSupplier);
        return createdSupplier;
    }

    // PriceBook entry creation
    async createPriceBookEntry(db, vintageId, supplierId, overrides = {}) {
        const priceEntry = {
            vintage_id: vintageId,
            supplier_id: supplierId,
            price_per_bottle: 38.50,
            minimum_order: 12,
            availability_status: 'In Stock',
            last_updated: new Date().toISOString().split('T')[0],
            valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days
            notes: 'Current market price',
            ...overrides
        };

        const result = await db.run(`
            INSERT INTO PriceBook (vintage_id, supplier_id, price_per_bottle, minimum_order,
                                 availability_status, last_updated, valid_until, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [priceEntry.vintage_id, priceEntry.supplier_id, priceEntry.price_per_bottle,
            priceEntry.minimum_order, priceEntry.availability_status, priceEntry.last_updated,
            priceEntry.valid_until, priceEntry.notes]);

        const createdEntry = { ...priceEntry, id: result.lastID };
        this.createdRecords.pricebook.push(createdEntry);
        return createdEntry;
    }

    // Weather vintage data creation
    async createWeatherVintage(db, region, year, overrides = {}) {
        const weatherData = {
            region: region,
            year: year,
            growing_season_temp_avg: 18.5,
            growing_season_rainfall: 650,
            harvest_conditions: 'Dry and warm harvest period',
            weather_events: JSON.stringify(['Late spring frost', 'Summer heat wave']),
            quality_impact_score: 8,
            vintage_rating: 'Excellent',
            ...overrides
        };

        const result = await db.run(`
            INSERT INTO WeatherVintage (region, year, growing_season_temp_avg, growing_season_rainfall,
                                      harvest_conditions, weather_events, quality_impact_score, vintage_rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [weatherData.region, weatherData.year, weatherData.growing_season_temp_avg,
            weatherData.growing_season_rainfall, weatherData.harvest_conditions,
            weatherData.weather_events, weatherData.quality_impact_score, weatherData.vintage_rating]);

        return { ...weatherData, id: result.lastID };
    }

    // Ledger entry creation
    async createLedgerEntry(db, vintageId, overrides = {}) {
        const ledger = {
            vintage_id: vintageId,
            location: 'main-cellar',
            transaction_type: 'IN',
            quantity: 12,
            unit_cost: 35.50,
            total_cost: 426.00,
            reference_id: 'PO-2024-001',
            notes: 'Initial stock receipt',
            created_by: 'Test System',
            ...overrides
        };

        const result = await db.run(`
            INSERT INTO Ledger (vintage_id, location, transaction_type, quantity, unit_cost,
                              total_cost, reference_id, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [ledger.vintage_id, ledger.location, ledger.transaction_type, ledger.quantity,
            ledger.unit_cost, ledger.total_cost, ledger.reference_id, ledger.notes, ledger.created_by]);

        const createdLedger = { ...ledger, id: result.lastID };
        this.createdRecords.ledger.push(createdLedger);
        return createdLedger;
    }

    // Complete wine with all relationships
    async createCompleteWine(db, overrides = {}) {
        // Create wine
        const wine = await this.createWine(db, overrides.wine);
        
        // Create vintage
        const vintage = await this.createVintage(db, wine.id, overrides.vintage);
        
        // Create stock
        const stock = await this.createStock(db, vintage.id, overrides.stock);
        
        // Create supplier
        const supplier = await this.createSupplier(db, overrides.supplier);
        
        // Create price book entry
        const priceEntry = await this.createPriceBookEntry(db, vintage.id, supplier.id, overrides.price);
        
        // Create weather data
        await this.createWeatherVintage(db, wine.region.toLowerCase(), vintage.year, overrides.weather);
        
        // Create initial ledger entry
        const ledger = await this.createLedgerEntry(db, vintage.id, overrides.ledger);

        return {
            wine,
            vintage,
            stock,
            supplier,
            priceEntry,
            ledger
        };
    }

    // Create basic test dataset
    async createBasicDataset(db) {
        console.log('Creating basic test dataset...');
        
        // Create first complete wine (Bordeaux)
        const bordeaux = await this.createCompleteWine(db, {
            wine: { name: 'Château Test Bordeaux', region: 'Bordeaux' },
            vintage: { year: 2020, quality_score: 92 },
            stock: { location: 'main-cellar', quantity: 24 }
        });

        // Create second complete wine (Burgundy)  
        const burgundy = await this.createCompleteWine(db, {
            wine: { 
                name: 'Domaine Test Burgundy', 
                producer: 'Domaine Test',
                region: 'Burgundy',
                wine_type: 'White',
                grape_varieties: JSON.stringify(['Chardonnay'])
            },
            vintage: { year: 2021, quality_score: 89 },
            stock: { location: 'service-bar', quantity: 12 }
        });

        console.log('Basic test dataset created successfully');
        return { bordeaux, burgundy };
    }

    // Cleanup all created records
    async cleanup(db) {
        console.log('Cleaning up test data...');
        
        // Clean up in reverse dependency order
        const tables = ['Ledger', 'PriceBook', 'Stock', 'Vintages', 'Wines', 'Suppliers', 'WeatherVintage'];
        
        for (const table of tables) {
            await db.run(`DELETE FROM ${table} WHERE id > 0`);
        }

        // Reset tracking
        this.createdRecords = {
            wines: [],
            vintages: [],
            suppliers: [],
            stock: [],
            pricebook: [],
            ledger: []
        };
        
        console.log('Test data cleanup completed');
    }
}

module.exports = TestDataFactory;