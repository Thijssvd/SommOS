/**
 * Performance Dashboard
 * Real-time visualization of RUM metrics and performance data
 */

import Chart from 'chart.js/auto';

class PerformanceDashboard {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.config = {
            apiEndpoint: options.apiEndpoint || '/api/performance/rum',
            refreshInterval: options.refreshInterval || 30000, // 30 seconds
            charts: options.charts || ['webVitals', 'errors', 'sessions'],
            theme: options.theme || 'light'
        };
        
        this.charts = new Map();
        this.data = {
            webVitals: null,
            errors: null,
            sessions: null,
            summary: null
        };
        
        this.init();
    }
    
    /**
     * Initialize the dashboard
     */
    init() {
        this.createDashboardHTML();
        this.initializeCharts();
        this.startDataRefresh();
        this.setupEventListeners();
    }
    
    /**
     * Create dashboard HTML structure
     */
    createDashboardHTML() {
        this.container.innerHTML = `
            <div class="performance-dashboard">
                <div class="dashboard-header">
                    <h2>Performance Monitoring Dashboard</h2>
                    <div class="dashboard-controls">
                        <select id="timeRange" class="time-range-selector">
                            <option value="1h">Last Hour</option>
                            <option value="6h">Last 6 Hours</option>
                            <option value="24h" selected>Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                        </select>
                        <button id="refreshBtn" class="refresh-btn">Refresh</button>
                        <button id="exportBtn" class="export-btn">Export</button>
                    </div>
                </div>
                
                <div class="dashboard-summary">
                    <div class="summary-cards">
                        <div class="summary-card">
                            <h3>Web Vitals Score</h3>
                            <div class="score-display" id="webVitalsScore">-</div>
                            <div class="score-label">Overall Performance</div>
                        </div>
                        <div class="summary-card">
                            <h3>Error Rate</h3>
                            <div class="error-rate" id="errorRate">-</div>
                            <div class="error-label">Errors per Session</div>
                        </div>
                        <div class="summary-card">
                            <h3>Active Sessions</h3>
                            <div class="session-count" id="sessionCount">-</div>
                            <div class="session-label">Current Sessions</div>
                        </div>
                        <div class="summary-card">
                            <h3>Avg Response Time</h3>
                            <div class="response-time" id="responseTime">-</div>
                            <div class="response-label">Milliseconds</div>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-charts">
                    <div class="chart-container">
                        <h3>Core Web Vitals</h3>
                        <canvas id="webVitalsChart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <h3>Error Trends</h3>
                        <canvas id="errorsChart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <h3>Session Analytics</h3>
                        <canvas id="sessionsChart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <h3>Resource Performance</h3>
                        <canvas id="resourcesChart"></canvas>
                    </div>
                </div>
                
                <div class="dashboard-details">
                    <div class="details-section">
                        <h3>Recent Errors</h3>
                        <div class="errors-list" id="errorsList"></div>
                    </div>
                    
                    <div class="details-section">
                        <h3>Performance Alerts</h3>
                        <div class="alerts-list" id="alertsList"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.addDashboardStyles();
    }
    
    /**
     * Add dashboard styles
     */
    addDashboardStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .performance-dashboard {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 20px;
                background: #f8f9fa;
                min-height: 100vh;
            }
            
            .dashboard-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
                padding: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .dashboard-header h2 {
                margin: 0;
                color: #333;
            }
            
            .dashboard-controls {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            
            .time-range-selector, .refresh-btn, .export-btn {
                padding: 8px 16px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: white;
                cursor: pointer;
            }
            
            .refresh-btn, .export-btn {
                background: #007bff;
                color: white;
                border-color: #007bff;
            }
            
            .refresh-btn:hover, .export-btn:hover {
                background: #0056b3;
            }
            
            .dashboard-summary {
                margin-bottom: 30px;
            }
            
            .summary-cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
            }
            
            .summary-card {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                text-align: center;
            }
            
            .summary-card h3 {
                margin: 0 0 10px 0;
                color: #666;
                font-size: 14px;
                font-weight: 500;
            }
            
            .score-display, .error-rate, .session-count, .response-time {
                font-size: 32px;
                font-weight: bold;
                margin: 10px 0;
            }
            
            .score-display {
                color: #28a745;
            }
            
            .error-rate {
                color: #dc3545;
            }
            
            .session-count {
                color: #007bff;
            }
            
            .response-time {
                color: #ffc107;
            }
            
            .score-label, .error-label, .session-label, .response-label {
                color: #666;
                font-size: 12px;
            }
            
            .dashboard-charts {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .chart-container {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .chart-container h3 {
                margin: 0 0 20px 0;
                color: #333;
                font-size: 16px;
            }
            
            .chart-container canvas {
                max-height: 300px;
            }
            
            .dashboard-details {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: 20px;
            }
            
            .details-section {
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .details-section h3 {
                margin: 0 0 20px 0;
                color: #333;
                font-size: 16px;
            }
            
            .errors-list, .alerts-list {
                max-height: 300px;
                overflow-y: auto;
            }
            
            .error-item, .alert-item {
                padding: 10px;
                border-bottom: 1px solid #eee;
                font-size: 14px;
            }
            
            .error-item:last-child, .alert-item:last-child {
                border-bottom: none;
            }
            
            .error-type, .alert-type {
                font-weight: bold;
                margin-right: 10px;
            }
            
            .error-message, .alert-message {
                color: #666;
            }
            
            .error-time, .alert-time {
                color: #999;
                font-size: 12px;
                float: right;
            }
            
            .loading {
                text-align: center;
                padding: 20px;
                color: #666;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Initialize charts
     */
    initializeCharts() {
        // Web Vitals Chart
        this.createWebVitalsChart();
        
        // Errors Chart
        this.createErrorsChart();
        
        // Sessions Chart
        this.createSessionsChart();
        
        // Resources Chart
        this.createResourcesChart();
    }
    
    /**
     * Create Web Vitals chart
     */
    createWebVitalsChart() {
        const ctx = document.getElementById('webVitalsChart').getContext('2d');
        this.charts.set('webVitals', new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'LCP',
                        data: [],
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'FID',
                        data: [],
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'CLS',
                        data: [],
                        borderColor: '#ffc107',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }
    
    /**
     * Create Errors chart
     */
    createErrorsChart() {
        const ctx = document.getElementById('errorsChart').getContext('2d');
        this.charts.set('errors', new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Errors',
                    data: [],
                    backgroundColor: '#dc3545',
                    borderColor: '#dc3545',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    /**
     * Create Sessions chart
     */
    createSessionsChart() {
        const ctx = document.getElementById('sessionsChart').getContext('2d');
        this.charts.set('sessions', new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Completed', 'Abandoned'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#28a745', '#007bff', '#6c757d'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        }));
    }
    
    /**
     * Create Resources chart
     */
    createResourcesChart() {
        const ctx = document.getElementById('resourcesChart').getContext('2d');
        this.charts.set('resources', new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Resource Load Time vs Size',
                    data: [],
                    backgroundColor: 'rgba(0, 123, 255, 0.6)',
                    borderColor: '#007bff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Resource Size (bytes)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Load Time (ms)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        }));
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Time range selector
        document.getElementById('timeRange').addEventListener('change', (e) => {
            this.updateTimeRange(e.target.value);
        });
        
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });
        
        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });
    }
    
    /**
     * Start data refresh interval
     */
    startDataRefresh() {
        this.refreshData();
        setInterval(() => {
            this.refreshData();
        }, this.config.refreshInterval);
    }
    
    /**
     * Refresh dashboard data
     */
    async refreshData() {
        try {
            await this.loadSummaryData();
            await this.loadAnalyticsData();
            this.updateDashboard();
        } catch (error) {
            console.error('Failed to refresh dashboard data:', error);
        }
    }
    
    /**
     * Load summary data
     */
    async loadSummaryData() {
        const response = await fetch(`${this.config.apiEndpoint}/summary`);
        const result = await response.json();
        
        if (result.success) {
            this.data.summary = result.data;
        }
    }
    
    /**
     * Load analytics data
     */
    async loadAnalyticsData() {
        const timeRange = this.getTimeRange();
        
        // Load Web Vitals analytics
        const webVitalsResponse = await fetch(
            `${this.config.apiEndpoint}/analytics?metric=LCP&startTime=${timeRange.start}&endTime=${timeRange.end}&groupBy=hour`
        );
        const webVitalsResult = await webVitalsResponse.json();
        
        if (webVitalsResult.success) {
            this.data.webVitals = webVitalsResult.data;
        }
        
        // Load errors data
        const errorsResponse = await fetch(
            `${this.config.apiEndpoint}/errors?startTime=${timeRange.start}&endTime=${timeRange.end}`
        );
        const errorsResult = await errorsResponse.json();
        
        if (errorsResult.success) {
            this.data.errors = errorsResult.data;
        }
        
        // Load sessions data
        const sessionsResponse = await fetch(
            `${this.config.apiEndpoint}/sessions?startTime=${timeRange.start}&endTime=${timeRange.end}`
        );
        const sessionsResult = await sessionsResponse.json();
        
        if (sessionsResult.success) {
            this.data.sessions = sessionsResult.data;
        }
    }
    
    /**
     * Update dashboard with new data
     */
    updateDashboard() {
        this.updateSummaryCards();
        this.updateCharts();
        this.updateDetails();
    }
    
    /**
     * Update summary cards
     */
    updateSummaryCards() {
        if (!this.data.summary) return;
        
        // Web Vitals Score
        const webVitalsScore = this.calculateWebVitalsScore();
        document.getElementById('webVitalsScore').textContent = webVitalsScore;
        
        // Error Rate
        const errorRate = this.data.summary.errors.total / this.data.summary.sessions.total;
        document.getElementById('errorRate').textContent = errorRate.toFixed(2);
        
        // Session Count
        document.getElementById('sessionCount').textContent = this.data.summary.sessions.total;
        
        // Response Time (using TTFB as proxy)
        const responseTime = this.data.summary.webVitals.TTFB?.average || 0;
        document.getElementById('responseTime').textContent = Math.round(responseTime);
    }
    
    /**
     * Calculate Web Vitals score
     */
    calculateWebVitalsScore() {
        if (!this.data.summary?.webVitals) return '-';
        
        const vitals = this.data.summary.webVitals;
        const scores = [];
        
        if (vitals.LCP) scores.push(vitals.LCP.passingRate);
        if (vitals.FID) scores.push(vitals.FID.passingRate);
        if (vitals.CLS) scores.push(vitals.CLS.passingRate);
        
        if (scores.length === 0) return '-';
        
        const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        return Math.round(averageScore * 100);
    }
    
    /**
     * Update charts
     */
    updateCharts() {
        this.updateWebVitalsChart();
        this.updateErrorsChart();
        this.updateSessionsChart();
        this.updateResourcesChart();
    }
    
    /**
     * Update Web Vitals chart
     */
    updateWebVitalsChart() {
        if (!this.data.webVitals) return;
        
        const chart = this.charts.get('webVitals');
        const analytics = this.data.webVitals.analytics;
        
        chart.data.labels = analytics.map(a => new Date(a.time).toLocaleTimeString());
        chart.data.datasets[0].data = analytics.map(a => a.average); // LCP
        
        chart.update();
    }
    
    /**
     * Update Errors chart
     */
    updateErrorsChart() {
        if (!this.data.errors) return;
        
        const chart = this.charts.get('errors');
        const errors = this.data.errors.errors;
        
        // Group errors by hour
        const errorGroups = {};
        errors.forEach(error => {
            const hour = new Date(error.timestamp).getHours();
            errorGroups[hour] = (errorGroups[hour] || 0) + 1;
        });
        
        chart.data.labels = Object.keys(errorGroups).map(h => `${h}:00`);
        chart.data.datasets[0].data = Object.values(errorGroups);
        
        chart.update();
    }
    
    /**
     * Update Sessions chart
     */
    updateSessionsChart() {
        if (!this.data.sessions) return;
        
        const chart = this.charts.get('sessions');
        const sessions = this.data.sessions.sessions;
        
        const active = sessions.filter(s => !s.isUnload).length;
        const completed = sessions.filter(s => s.isUnload).length;
        const abandoned = 0; // Would need more data to calculate
        
        chart.data.datasets[0].data = [active, completed, abandoned];
        
        chart.update();
    }
    
    /**
     * Update Resources chart
     */
    updateResourcesChart() {
        // This would need resource data from the API
        // For now, we'll leave it empty
    }
    
    /**
     * Update details sections
     */
    updateDetails() {
        this.updateErrorsList();
        this.updateAlertsList();
    }
    
    /**
     * Update errors list
     */
    updateErrorsList() {
        if (!this.data.errors) return;
        
        const errorsList = document.getElementById('errorsList');
        const recentErrors = this.data.errors.errors.slice(-10);
        
        errorsList.innerHTML = recentErrors.map(error => `
            <div class="error-item">
                <span class="error-type">${error.type}</span>
                <span class="error-message">${error.data.message || 'Unknown error'}</span>
                <span class="error-time">${new Date(error.timestamp).toLocaleTimeString()}</span>
            </div>
        `).join('');
    }
    
    /**
     * Update alerts list
     */
    updateAlertsList() {
        const alertsList = document.getElementById('alertsList');
        
        // Generate alerts based on current data
        const alerts = this.generateAlerts();
        
        alertsList.innerHTML = alerts.map(alert => `
            <div class="alert-item">
                <span class="alert-type">${alert.type}</span>
                <span class="alert-message">${alert.message}</span>
                <span class="alert-time">${new Date(alert.timestamp).toLocaleTimeString()}</span>
            </div>
        `).join('');
    }
    
    /**
     * Generate performance alerts
     */
    generateAlerts() {
        const alerts = [];
        
        if (!this.data.summary) return alerts;
        
        const vitals = this.data.summary.webVitals;
        
        // Check Web Vitals thresholds
        if (vitals.LCP && vitals.LCP.passingRate < 0.75) {
            alerts.push({
                type: 'WARNING',
                message: `LCP passing rate is low: ${Math.round(vitals.LCP.passingRate * 100)}%`,
                timestamp: Date.now()
            });
        }
        
        if (vitals.FID && vitals.FID.passingRate < 0.75) {
            alerts.push({
                type: 'WARNING',
                message: `FID passing rate is low: ${Math.round(vitals.FID.passingRate * 100)}%`,
                timestamp: Date.now()
            });
        }
        
        if (vitals.CLS && vitals.CLS.passingRate < 0.75) {
            alerts.push({
                type: 'WARNING',
                message: `CLS passing rate is low: ${Math.round(vitals.CLS.passingRate * 100)}%`,
                timestamp: Date.now()
            });
        }
        
        // Check error rate
        const errorRate = this.data.summary.errors.total / this.data.summary.sessions.total;
        if (errorRate > 0.1) {
            alerts.push({
                type: 'ERROR',
                message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
                timestamp: Date.now()
            });
        }
        
        return alerts;
    }
    
    /**
     * Get time range based on selection
     */
    getTimeRange() {
        const now = Date.now();
        const timeRange = document.getElementById('timeRange').value;
        
        let startTime;
        switch (timeRange) {
            case '1h':
                startTime = now - 60 * 60 * 1000;
                break;
            case '6h':
                startTime = now - 6 * 60 * 60 * 1000;
                break;
            case '24h':
                startTime = now - 24 * 60 * 60 * 1000;
                break;
            case '7d':
                startTime = now - 7 * 24 * 60 * 60 * 1000;
                break;
            default:
                startTime = now - 24 * 60 * 60 * 1000;
        }
        
        return { start: startTime, end: now };
    }
    
    /**
     * Update time range
     */
    updateTimeRange(timeRange) {
        this.refreshData();
    }
    
    /**
     * Export data
     */
    exportData() {
        const data = {
            summary: this.data.summary,
            webVitals: this.data.webVitals,
            errors: this.data.errors,
            sessions: this.data.sessions,
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-data-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
    
    /**
     * Destroy dashboard
     */
    destroy() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }
}

// Export for use in modules
export default PerformanceDashboard;

// Also make available globally for non-module usage
if (typeof window !== 'undefined') {
    window.PerformanceDashboard = PerformanceDashboard;
}