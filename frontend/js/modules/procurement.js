/**
 * Procurement Module
 * Handles procurement analysis, purchase decisions, and order management
 */

export class ProcurementModule {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.currentOpportunities = [];
        this.filters = {};
        this.selectedOpportunity = null;
    }

    async init() {
        this.container = document.getElementById('procurement-view');
        if (this.container) {
            await this.loadProcurementData();
            this.setupEventListeners();
        }
    }

    async loadProcurementData() {
        try {
            await this.loadProcurementStats();
            await this.analyzeProcurementOpportunities();
        } catch (error) {
            console.error('Failed to load procurement data:', error);
            this.displayError('Failed to load procurement data');
        }
    }

    async loadProcurementStats() {
        try {
            const result = await this.app.api.getSystemHealth();
            if (result.success && result.data) {
                this.displayProcurementStats(result.data);
            }
        } catch (error) {
            console.warn('Could not load procurement stats:', error);
        }
    }

    displayProcurementStats(stats) {
        const statsContainer = this.container?.querySelector('.procurement-stats');
        if (!statsContainer) return;

        const statCards = statsContainer.querySelectorAll('.stat-card');
        const statData = [
            { key: 'total_bottles', label: 'Total Bottles', icon: '🍾' },
            { key: 'active_suppliers', label: 'Active Suppliers', icon: '🏪' },
            { key: 'total_wines', label: 'Wine Varieties', icon: '🍷' },
            { key: 'total_vintages', label: 'Vintage Years', icon: '📅' }
        ];

        statData.forEach((stat, index) => {
            if (statCards[index]) {
                const card = statCards[index];
                const numberElement = card.querySelector('.stat-number');
                const labelElement = card.querySelector('.stat-label');

                if (numberElement && labelElement) {
                    const value = stats[stat.key] || 0;
                    numberElement.textContent = value;
                    labelElement.textContent = stat.label;

                    const iconElement = card.querySelector('.stat-icon');
                    if (iconElement) {
                        iconElement.textContent = stat.icon;
                    }
                }
            }
        });
    }

    async analyzeProcurementOpportunities() {
        try {
            const result = await this.app.api.getProcurementOpportunities({
                region: this.filters.region,
                wine_type: this.filters.wine_type,
                max_price: this.filters.max_price,
                min_score: this.filters.min_score
            });

            if (result.success && result.data) {
                this.currentOpportunities = result.data;
                this.displayProcurementOpportunities();
            } else {
                throw new Error('Failed to analyze opportunities');
            }
        } catch (error) {
            console.error('Failed to analyze procurement opportunities:', error);
            this.displayError('Failed to analyze procurement opportunities');
        }
    }

    displayProcurementOpportunities() {
        const grid = this.container?.querySelector('.opportunities-grid');
        if (!grid) return;

        if (!this.currentOpportunities || this.currentOpportunities.length === 0) {
            grid.innerHTML = `
                <div class="opportunities-placeholder">
                    <h4>No Procurement Opportunities</h4>
                    <p>No procurement opportunities found with current filters. Try adjusting your criteria.</p>
                </div>
            `;
            return;
        }

        const opportunitiesHtml = this.currentOpportunities.map(opp =>
            this.createOpportunityCard(opp)
        ).join('');

        grid.innerHTML = opportunitiesHtml;
    }

    createOpportunityCard(opportunity) {
        const urgency = this.getUrgencyLabel(opportunity.urgency || 'Medium');
        const score = opportunity.score?.total || 0;

        return `
            <div class="opportunity-card" data-wine-id="${opportunity.wine_id}">
                <div class="opportunity-header">
                    <h4>${opportunity.wine_name || 'Unknown Wine'}</h4>
                    <div class="opportunity-score">
                        <span class="score-value">${Math.round(score * 100)}%</span>
                    </div>
                </div>

                <div class="opportunity-details">
                    <p><strong>Producer:</strong> ${opportunity.producer || 'Unknown'}</p>
                    <p><strong>Region:</strong> ${opportunity.region || 'Unknown'}</p>
                    <p><strong>Type:</strong> ${opportunity.wine_type || 'Unknown'}</p>
                    <p><strong>Year:</strong> ${opportunity.year || 'NV'}</p>
                    <p><strong>Supplier:</strong> ${opportunity.supplier_name || 'Unknown'}</p>
                    <p><strong>Recommended Quantity:</strong> ${opportunity.recommended_quantity || 0} bottles</p>
                    <p><strong>Estimated Investment:</strong> ${this.formatCurrency(opportunity.estimated_investment || 0)}</p>
                    <p><strong>Estimated Savings:</strong> ${this.formatCurrency(opportunity.estimated_savings || 0)}</p>
                </div>

                <div class="opportunity-reasoning">
                    <h5>Why this opportunity?</h5>
                    <p>${opportunity.reasoning || 'No reasoning available'}</p>
                </div>

                <div class="opportunity-actions">
                    <button class="btn primary" onclick="app.showPurchaseDecisionTool('${opportunity.wine_id}', '${opportunity.supplier_id}', ${opportunity.recommended_quantity})">
                        Analyze Purchase
                    </button>
                    <button class="btn secondary" onclick="app.generatePurchaseOrder([{
                        wine_id: '${opportunity.wine_id}',
                        vintage_id: '${opportunity.vintage_id}',
                        supplier_id: '${opportunity.supplier_id}',
                        quantity: ${opportunity.recommended_quantity || 12},
                        estimated_price: ${(opportunity.estimated_investment || 0) / (opportunity.recommended_quantity || 12)}
                    }], '${opportunity.supplier_id}')">
                        Generate Order
                    </button>
                </div>
            </div>
        `;
    }

    displayError(message) {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="error-content">
                <h4>⚠️ Procurement Error</h4>
                <p>${message}</p>
                <button class="btn" onclick="app.loadProcurementData()">Reload Procurement</button>
            </div>
        `;
    }

    setupEventListeners() {
        // Filter controls
        const regionFilter = this.container?.querySelector('#procurement-region-filter');
        const typeFilter = this.container?.querySelector('#procurement-type-filter');
        const priceFilter = this.container?.querySelector('#procurement-price-filter');
        const scoreFilter = this.container?.querySelector('#procurement-score-filter');

        if (regionFilter) {
            regionFilter.addEventListener('input', this.app.debounce(() => {
                this.filters.region = regionFilter.value || undefined;
                this.analyzeProcurementOpportunities();
            }, 300));
        }

        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.filters.wine_type = typeFilter.value || undefined;
                this.analyzeProcurementOpportunities();
            });
        }

        if (priceFilter) {
            priceFilter.addEventListener('input', this.app.debounce(() => {
                this.filters.max_price = priceFilter.value ? parseFloat(priceFilter.value) : undefined;
                this.analyzeProcurementOpportunities();
            }, 300));
        }

        if (scoreFilter) {
            scoreFilter.addEventListener('input', this.app.debounce(() => {
                this.filters.min_score = scoreFilter.value ? parseInt(scoreFilter.value) : undefined;
                this.analyzeProcurementOpportunities();
            }, 300));
        }
    }

    async refresh() {
        await this.loadProcurementData();
    }

    // Helper methods
    getUrgencyLabel(urgency) {
        const labels = {
            'Low': '🟢',
            'Medium': '🟡',
            'High': '🟠',
            'Critical': '🔴'
        };
        return labels[urgency] || '🟡';
    }

    formatCurrency(value) {
        if (!value || isNaN(value)) return '—';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }
}
