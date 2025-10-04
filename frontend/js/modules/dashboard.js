/**
 * Dashboard Module
 * Handles dashboard data loading, statistics display, and recent activity
 */

export class DashboardModule {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.statsContainer = null;
        this.activityContainer = null;
    }

    async init() {
        this.container = document.getElementById('dashboard-view');
        this.statsContainer = document.getElementById('dashboard-stats');
        this.activityContainer = document.getElementById('recent-activity');

        if (this.container) {
            await this.loadDashboardData();
            this.setupEventListeners();
        }
    }

    async loadDashboardData() {
        try {
            // Add loading state to dashboard cards
            this.addLoadingToStats();

            const [stats, activity, inventory] = await Promise.all([
                this.app.api.getSystemHealth(),
                this.app.api.getRecentActivity(),
                this.app.api.getInventory({ available_only: false, limit: 50, offset: 0 })
            ]);

            this.displayStats(stats.data);
            this.displayRecentActivity(activity.data);
            
            // Initialize charts with inventory data
            if (inventory && inventory.success) {
                this.inventoryData = inventory.data || [];
                this.initializeCharts();
            }
        } catch (error) {
            console.warn('Could not load dashboard data:', error);
            this.displayError('Failed to load dashboard data');
        }
    }

    addLoadingToStats() {
        if (!this.statsContainer) return;

        const statCards = this.statsContainer.querySelectorAll('.stat-card');
        statCards.forEach(card => {
            const numberElement = card.querySelector('.stat-number');
            if (numberElement) {
                numberElement.innerHTML = '<div class="loading-spinner small"></div>';
            }
        });
    }

    displayStats(stats) {
        if (!this.statsContainer || !stats) return;

        const statCards = this.statsContainer.querySelectorAll('.stat-card');
        const statData = [
            { key: 'total_wines', label: 'Wines', icon: '🍷' },
            { key: 'total_vintages', label: 'Vintages', icon: '📅' },
            { key: 'total_bottles', label: 'Bottles', icon: '🍾' },
            { key: 'active_suppliers', label: 'Suppliers', icon: '🏪' }
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

                    // Update icon
                    const iconElement = card.querySelector('.stat-icon');
                    if (iconElement) {
                        iconElement.textContent = stat.icon;
                    }
                }
            }
        });
    }

    displayRecentActivity(activities) {
        if (!this.activityContainer) return;

        if (!activities || activities.length === 0) {
            this.displayDefaultActivity();
            return;
        }

        const activityHtml = activities.map(activity => this.createActivityItem(activity)).join('');
        this.activityContainer.innerHTML = activityHtml;
    }

    createActivityItem(activity) {
        const icon = this.getActivityIcon(activity.type);
        const timeAgo = this.getTimeAgo(activity.timestamp);

        return `
            <div class="activity-item">
                <div class="activity-icon">${icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-time">${timeAgo}</div>
                    ${activity.details ? `<div class="activity-details">${activity.details}</div>` : ''}
                </div>
            </div>
        `;
    }

    displayDefaultActivity() {
        if (!this.activityContainer) return;

        this.activityContainer.innerHTML = `
            <div class="activity-item">
                <div class="activity-icon">📊</div>
                <div class="activity-content">
                    <div class="activity-title">Dashboard Ready</div>
                    <div class="activity-time">Just now</div>
                    <div class="activity-details">SommOS wine management system is operational</div>
                </div>
            </div>
        `;
    }

    displayError(message) {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="error-content">
                <h4>⚠️ Dashboard Error</h4>
                <p>${message}</p>
                <button class="btn" onclick="location.reload()">Reload Dashboard</button>
            </div>
        `;
    }

    getActivityIcon(activityType) {
        const iconMap = {
            'inventory_update': '📦',
            'consumption': '🍷',
            'reservation': '📋',
            'wine_added': '➕',
            'procurement': '🛒',
            'pairing': '🍽️',
            'system': '⚙️'
        };

        return iconMap[activityType] || '📝';
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;

        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }

    setupEventListeners() {
        // Dashboard-specific event listeners
        const refreshBtn = this.container?.querySelector('.refresh-dashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadDashboardData();
            });
        }
        
        // Make stat cards clickable
        const statCards = document.querySelectorAll('.stat-card-luxury');
        statCards.forEach((card, index) => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                const statTypes = ['total-bottles', 'total-wines', 'total-vintages', 'active-suppliers'];
                if (statTypes[index]) {
                    this.app.showStatDetailModal(statTypes[index]);
                }
            });
        });
    }

    async refresh() {
        await this.loadDashboardData();
    }
    
    initializeCharts() {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded, skipping chart initialization');
            return;
        }
        
        try {
            this.initWineTypesChart();
            this.initStockLocationChart();
        } catch (error) {
            console.error('Error initializing charts:', error);
        }
    }
    
    initWineTypesChart() {
        const canvas = document.getElementById('wine-types-chart');
        if (!canvas || !this.inventoryData) return;
        
        // Destroy existing chart if it exists
        if (this.wineTypesChart) {
            this.wineTypesChart.destroy();
        }
        
        // Calculate wine type distribution
        const typeCounts = {};
        this.inventoryData.forEach(wine => {
            const type = wine.wine_type || 'Other';
            typeCounts[type] = (typeCounts[type] || 0) + (wine.quantity || 0);
        });
        
        const labels = Object.keys(typeCounts);
        const data = Object.values(typeCounts);
        
        // Define colors for wine types
        const colorMap = {
            'Red': '#8B1538',
            'White': '#F4E5C2',
            'Rosé': '#FFB3BA',
            'Sparkling': '#FFE5B4',
            'Dessert': '#D4A574',
            'Fortified': '#8B6F47',
            'Other': '#CCCCCC'
        };
        
        const backgroundColors = labels.map(label => colorMap[label] || colorMap['Other']);
        
        const ctx = canvas.getContext('2d');
        this.wineTypesChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} bottles (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    initStockLocationChart() {
        const canvas = document.getElementById('stock-location-chart');
        if (!canvas || !this.inventoryData) return;
        
        // Destroy existing chart if it exists
        if (this.stockLocationChart) {
            this.stockLocationChart.destroy();
        }
        
        // Calculate stock by location
        const locationCounts = {};
        this.inventoryData.forEach(wine => {
            const location = wine.location || 'Unknown';
            locationCounts[location] = (locationCounts[location] || 0) + (wine.quantity || 0);
        });
        
        const labels = Object.keys(locationCounts);
        const data = Object.values(locationCounts);
        
        const ctx = canvas.getContext('2d');
        this.stockLocationChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Bottles',
                    data: data,
                    backgroundColor: 'rgba(139, 21, 56, 0.7)',
                    borderColor: 'rgba(139, 21, 56, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        },
                        title: {
                            display: true,
                            text: 'Number of Bottles'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Storage Location'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} bottles`;
                            }
                        }
                    }
                }
            }
        });
    }
}
