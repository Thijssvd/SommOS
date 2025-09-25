const InventoryIntakeProcessor = require('../../backend/core/inventory_intake_processor');

describe('InventoryIntakeProcessor', () => {
    let processor;

    beforeEach(() => {
        processor = new InventoryIntakeProcessor();
    });

    test('processes manual intake items', () => {
        const manualIntake = {
            source_type: 'manual',
            reference: 'MAN-1',
            items: [
                {
                    wine: {
                        name: 'Manual Merlot',
                        producer: 'Estate Winery',
                        region: 'Napa',
                        wine_type: 'Red'
                    },
                    vintage: { year: 2020 },
                    stock: { quantity: 12, unit_cost: 25, location: 'receiving' }
                }
            ]
        };

        const result = processor.process(manualIntake);

        expect(result.source_type).toBe('manual');
        expect(result.items).toHaveLength(1);
        expect(result.items[0].wine.name).toBe('Manual Merlot');
        expect(result.items[0].stock.quantity).toBe(12);
    });

    test('parses pdf invoice text into structured items', () => {
        const pdfIntake = {
            source_type: 'pdf_invoice',
            text: 'Chablis Premier Cru - Domaine Laroche - 2019 - 12 - 45\nBrunello di Montalcino - Biondi Santi - 2016 - 6 - 120'
        };

        const result = processor.process(pdfIntake);

        expect(result.source_type).toBe('pdf_invoice');
        expect(result.items).toHaveLength(2);
        expect(result.items[0].wine.name).toContain('Chablis Premier Cru');
        expect(result.items[0].stock.quantity).toBe(12);
        expect(result.items[1].vintage.year).toBe(2016);
    });

    test('throws when scanned document confidence is too low', () => {
        const scannedIntake = {
            source_type: 'scanned_document',
            ocr_confidence: 0.2,
            text: 'Any Wine - Producer - 2020 - 6 - 30'
        };

        expect(() => processor.process(scannedIntake)).toThrow('OCR confidence too low');
    });

    test('normalizes excel style rows', () => {
        const excelIntake = {
            source_type: 'excel',
            rows: [
                ['Sancerre Blanc', 2022, '24', '18.50', 'receiving', 'Domaine Vacheron', 'Loire', 'White']
            ]
        };

        const result = processor.process(excelIntake);

        expect(result.items[0].wine.wine_type).toBe('White');
        expect(result.items[0].stock.unit_cost).toBeCloseTo(18.5);
    });
});

