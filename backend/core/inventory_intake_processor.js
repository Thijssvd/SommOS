/**
 * Inventory Intake Processor
 * Normalizes different intake sources (manual entry, pdf/excel/scanned documents)
 * into a common format that the InventoryManager can consume.
 */

class InventoryIntakeProcessor {
    constructor() {
        this.supportedSources = new Set(['manual', 'pdf_invoice', 'excel', 'scanned_document']);
    }

    process(intakeRequest = {}) {
        const sourceType = this.normalizeSourceType(intakeRequest.source_type || intakeRequest.type);

        if (!this.supportedSources.has(sourceType)) {
            throw new Error(`Unsupported intake source type: ${sourceType}`);
        }

        switch (sourceType) {
            case 'pdf_invoice':
                return this.processPdfInvoice(intakeRequest);
            case 'excel':
                return this.processExcelSheet(intakeRequest);
            case 'scanned_document':
                return this.processScannedDocument(intakeRequest);
            case 'manual':
            default:
                return this.processManualInput(intakeRequest);
        }
    }

    normalizeSourceType(sourceType) {
        if (!sourceType) {
            return 'manual';
        }
        const normalized = String(sourceType).toLowerCase().trim();
        switch (normalized) {
            case 'pdf':
            case 'invoice':
                return 'pdf_invoice';
            case 'xls':
            case 'xlsx':
            case 'spreadsheet':
                return 'excel';
            case 'scan':
            case 'ocr':
                return 'scanned_document';
            default:
                return normalized;
        }
    }

    processManualInput(intakeRequest) {
        const items = Array.isArray(intakeRequest.items) ? intakeRequest.items : [];
        if (!items.length) {
            throw new Error('Manual intake requires an items array');
        }

        return this.buildNormalizedIntake('manual', intakeRequest, items);
    }

    processPdfInvoice(intakeRequest) {
        const rows = this.extractStructuredRows(intakeRequest);
        if (!rows.length) {
            throw new Error('Unable to extract line items from PDF invoice payload');
        }

        return this.buildNormalizedIntake('pdf_invoice', intakeRequest, rows);
    }

    processExcelSheet(intakeRequest) {
        const rows = this.extractStructuredRows(intakeRequest);
        if (!rows.length) {
            throw new Error('Excel intake requires at least one row of data');
        }

        return this.buildNormalizedIntake('excel', intakeRequest, rows);
    }

    processScannedDocument(intakeRequest) {
        const confidence = intakeRequest.ocr_confidence || intakeRequest.confidence;
        if (confidence && confidence < 0.5) {
            throw new Error('OCR confidence too low to trust scanned document intake');
        }

        const rows = this.extractStructuredRows(intakeRequest);
        if (!rows.length) {
            throw new Error('Scanned document did not contain any recognizable wine entries');
        }

        return this.buildNormalizedIntake('scanned_document', intakeRequest, rows, {
            ocr_confidence: confidence || null
        });
    }

    extractStructuredRows(intakeRequest) {
        if (Array.isArray(intakeRequest.items) && intakeRequest.items.length) {
            return intakeRequest.items;
        }

        if (Array.isArray(intakeRequest.rows) && intakeRequest.rows.length) {
            return intakeRequest.rows;
        }

        if (typeof intakeRequest.text === 'string' && intakeRequest.text.trim()) {
            return this.parseLineItemsFromText(intakeRequest.text);
        }

        if (typeof intakeRequest.raw_text === 'string' && intakeRequest.raw_text.trim()) {
            return this.parseLineItemsFromText(intakeRequest.raw_text);
        }

        return [];
    }

    parseLineItemsFromText(text) {
        const lines = String(text)
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        const items = [];
        const basicPattern = /^(?<name>[^\-|]+?)(?:\s+-\s+(?<producer>[^\-|]+?))?(?:\s+[\-|]\s*(?<year>\d{4}))?(?:\s+[\-|]\s*(?<qty>\d+))?(?:\s+[\-|]\s*\$?(?<price>\d+(?:\.\d+)?))?$/;

        lines.forEach((line, index) => {
            const match = basicPattern.exec(line);
            if (!match) {
                return;
            }

            const { name, producer, year, qty, price } = match.groups;
            if (!name) {
                return;
            }

            items.push({
                wine: {
                    name: name.trim(),
                    producer: producer ? producer.trim() : null
                },
                vintage: {
                    year: year ? parseInt(year, 10) : null
                },
                stock: {
                    quantity: qty ? parseInt(qty, 10) : 0,
                    unit_cost: price ? parseFloat(price) : null,
                    line: index + 1
                }
            });
        });

        return items;
    }

    buildNormalizedIntake(sourceType, intakeRequest, rows, metadata = {}) {
        const supplier = intakeRequest.supplier || {};
        const normalizedItems = rows.map((row, index) => this.normalizeItem(row, index));

        return {
            source_type: sourceType,
            supplier: {
                id: supplier.id || null,
                name: supplier.name || supplier.supplier_name || supplier.company || null
            },
            reference: intakeRequest.reference || intakeRequest.invoice_number || intakeRequest.order_number || null,
            order_date: intakeRequest.order_date || intakeRequest.date || null,
            expected_delivery: intakeRequest.expected_delivery || intakeRequest.delivery_date || null,
            metadata: {
                ...metadata,
                file_name: intakeRequest.file_name || null,
                parsed_at: new Date().toISOString(),
                total_items: normalizedItems.length
            },
            raw_payload: intakeRequest.raw_payload || intakeRequest.raw_text || intakeRequest.text || intakeRequest.items || intakeRequest.rows || null,
            items: normalizedItems
        };
    }

    normalizeItem(row, index) {
        if (row && row.wine && row.vintage && row.stock) {
            return this.ensureDefaults(row, index);
        }

        if (Array.isArray(row)) {
            return this.normalizeArrayRow(row, index);
        }

        if (typeof row === 'object' && row !== null) {
            return this.normalizeObjectRow(row, index);
        }

        throw new Error(`Unable to normalize intake item at position ${index + 1}`);
    }

    normalizeArrayRow(row, index) {
        const [name, vintageYear, quantity, unitCost, location, producer, region, wineType] = row;

        return this.ensureDefaults({
            wine: {
                name,
                producer,
                region,
                wine_type: wineType
            },
            vintage: {
                year: Number.isInteger(vintageYear) ? vintageYear : (vintageYear ? parseInt(vintageYear, 10) : null)
            },
            stock: {
                quantity: quantity ? parseInt(quantity, 10) : 0,
                unit_cost: unitCost ? parseFloat(unitCost) : null,
                location
            }
        }, index);
    }

    normalizeObjectRow(row, index) {
        const wine = row.wine || row.wineData || row.details || row;
        const vintage = row.vintage || row.vintageData || row;
        const stock = row.stock || row.stockData || row;

        return this.ensureDefaults({
            wine,
            vintage,
            stock,
            external_reference: row.external_reference || row.line || row.reference || null,
            notes: row.notes || null
        }, index);
    }

    ensureDefaults(item, index) {
        const normalizedWine = {
            name: (item.wine?.name || item.name || `Unknown Wine ${index + 1}`).trim(),
            producer: item.wine?.producer || item.producer || 'Unknown Producer',
            region: item.wine?.region || item.region || 'Unknown Region',
            country: item.wine?.country || item.country || 'Unknown',
            wine_type: item.wine?.wine_type || item.wine_type || 'Red',
            grape_varieties: item.wine?.grape_varieties || item.grape_varieties || []
        };

        const normalizedVintage = {
            year: item.vintage?.year || item.year || null,
            harvest_date: item.vintage?.harvest_date || null,
            bottling_date: item.vintage?.bottling_date || null,
            release_date: item.vintage?.release_date || null
        };

        const normalizedStock = {
            quantity: item.stock?.quantity || item.quantity || 0,
            unit_cost: item.stock?.unit_cost ?? item.unit_cost ?? null,
            location: item.stock?.location || item.location || 'receiving',
            reference_id: item.stock?.reference_id || null,
            notes: item.notes || item.stock?.notes || null
        };

        return {
            wine: normalizedWine,
            vintage: normalizedVintage,
            stock: normalizedStock,
            external_reference: item.external_reference || null
        };
    }
}

module.exports = InventoryIntakeProcessor;

