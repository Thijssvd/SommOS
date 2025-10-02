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

            const [stats, activity] = await Promise.all([
                this.app.api.getSystemHealth(),
                this.app.api.getRecentActivity()
            ]);

            this.displayStats(stats.data);
            this.displayRecentActivity(activity.data);
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
    }

    async refresh() {
        await this.loadDashboardData();
    }
}
