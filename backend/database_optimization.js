// SommOS Database Optimization Script
// Phase 1: Core Infrastructure - Wine Database Schema Optimization

const Database = require('./database/connection');
const fs = require('fs');
const path = require('path');

class DatabaseOptimizer {
    constructor() {
        this.db = Database.getInstance();
        this.results = {
            performance_metrics: {},
            optimization_suggestions: [],
            maintenance_recommendations: []
        };
    }

    async analyzeQueryPerformance() {
        console.log('🔍 Analyzing query performance patterns...');
        
        // Analyze slow queries in inventory operations
        const slowQueries = await this.db.all(`
            SELECT sql, (total_exec_time / calls) as avg_time_per_call, calls
            FROM pragma_query_info
            WHERE total_exec_time > 1000 AND calls > 5
            ORDER BY total_exec_time DESC
            LIMIT 10
        `);
        
        this.results.performance_metrics.slow_queries = slowQueries;
        
        // Check table sizes and row counts
        const tableStats = await this.db.all(`
            SELECT name, COUNT(*) as row_count
            FROM sqlite_master 
            WHERE type='table' 
            GROUP BY name
            ORDER BY row_count DESC
        `);
        
        this.results.performance_metrics.table_sizes = tableStats;
        
        return this.results;
    }

    async optimizeIndexes() {
        console.log('⚡ Optimizing database indexes...');
        
        // Additional indexes for common SommOS queries
        const additionalIndexes = [
            // Wine search optimization
            'CREATE INDEX IF NOT EXISTS idx_wines_search ON Wines(name, producer, region, wine_type)',
            
            // Stock availability queries
            'CREATE INDEX IF NOT EXISTS idx_stock_available ON Stock(vintage_id, location, quantity, reserved_quantity) WHERE quantity > reserved_quantity',
            
            // Inventory intake performance
            'CREATE INDEX IF NOT EXISTS idx_intake_items_status ON InventoryIntakeItems(status, intake_id)',
            
            // Price book performance
            'CREATE INDEX IF NOT EXISTS idx_pricebook_active ON PriceBook(vintage_id, supplier_id, availability_status) WHERE availability_status IN ("In Stock", "Limited")',
            
            // Learning and pairing performance
            'CREATE INDEX IF NOT EXISTS idx_pairing_sessions_recent ON LearningPairingSessions(created_at DESC)',
            
            // Weather data performance
            'CREATE INDEX IF NOT EXISTS idx_weather_recent ON WeatherVintage(year DESC, region, quality_impact_score)',
            
            // Performance monitoring
            'CREATE INDEX IF NOT EXISTS idx_rum_metrics_recent ON RumMetrics(timestamp DESC, metric_type)',
            
            // Memory access patterns
            'CREATE INDEX IF NOT EXISTS idx_memories_access ON Memories(last_accessed DESC, relevance_score)'
        ];
        
        for (const indexSQL of additionalIndexes) {
            try {
                await this.db.run(indexSQL);
                console.log(`✅ Created index: ${indexSQL.split(' ON ')[1]}`);
            } catch (error) {
                console.log(`⚠️ Index creation failed: ${error.message}`);
            }
        }
    }

    async createMaintenanceProcedures() {
        console.log('🛠️ Creating database maintenance procedures...');
        
        // Create maintenance views and procedures
        const maintenanceSQL = `
            -- Database health check view
            CREATE VIEW IF NOT EXISTS v_database_health AS
            SELECT 
                'wines' as table_name, COUNT(*) as record_count,
                (SELECT COUNT(*) FROM pragma_table_info('wines')) as column_count
            FROM wines
            UNION ALL
            SELECT 
                'vintages' as table_name, COUNT(*) as record_count,
                (SELECT COUNT(*) FROM pragma_table_info('vintages')) as column_count
            FROM vintages
            UNION ALL
            SELECT 
                'stock' as table_name, COUNT(*) as record_count,
                (SELECT COUNT(*) FROM pragma_table_info('stock')) as column_count
            FROM stock
            UNION ALL
            SELECT 
                'ledger' as table_name, COUNT(*) as record_count,
                (SELECT COUNT(*) FROM pragma_table_info('ledger')) as column_count
            FROM ledger;
            
            -- Orphaned records detection
            CREATE VIEW IF NOT EXISTS v_orphaned_records AS
            SELECT 
                'Stock without Vintage' as issue, COUNT(*) as count
            FROM stock s
            LEFT JOIN vintages v ON s.vintage_id = v.id
            WHERE v.id IS NULL
            UNION ALL
            SELECT 
                'Vintage without Wine' as issue, COUNT(*) as count
            FROM vintages v
            LEFT JOIN wines w ON v.wine_id = w.id
            WHERE w.id IS NULL
            UNION ALL
            SELECT 
                'PriceBook without Vintage' as issue, COUNT(*) as count
            FROM pricebook pb
            LEFT JOIN vintages v ON pb.vintage_id = v.id
            WHERE v.id IS NULL;
        `;
        
        await this.db.exec(maintenanceSQL);
        console.log('✅ Created maintenance views and procedures');
    }

    async setupPerformanceMonitoring() {
        console.log('📊 Setting up performance monitoring...');
        
        // Create performance monitoring table if it doesn't exist
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS database_performance_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                operation_type TEXT NOT NULL,
                table_name TEXT,
                query_hash TEXT,
                execution_time_ms REAL,
                rows_affected INTEGER,
                memory_used_kb INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create index for performance monitoring
        await this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_perf_log_timestamp ON database_performance_log(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_perf_log_operation ON database_performance_log(operation_type, table_name);
        `);
        
        console.log('✅ Performance monitoring setup complete');
    }

    async analyzeTableFragmentation() {
        console.log('📈 Analyzing table fragmentation...');
        
        // Check for potential fragmentation issues
        const fragmentationAnalysis = await this.db.all(`
            SELECT 
                name as table_name,
                COUNT(*) as row_count,
                (SELECT COUNT(*) FROM pragma_index_list(name)) as index_count
            FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY row_count DESC
        `);
        
        this.results.performance_metrics.fragmentation = fragmentationAnalysis;
        
        // Suggest VACUUM if large tables detected
        const largeTables = fragmentationAnalysis.filter(table => table.row_count > 1000);
        if (largeTables.length > 0) {
            this.results.optimization_suggestions.push({
                type: 'maintenance',
                priority: 'medium',
                suggestion: 'Run VACUUM on large tables to reclaim space and optimize performance',
                affected_tables: largeTables.map(t => t.table_name)
            });
        }
    }

    async generateOptimizationReport() {
        console.log('📋 Generating optimization report...');
        
        const report = {
            summary: 'SommOS Database Optimization Report',
            timestamp: new Date().toISOString(),
            performance_metrics: this.results.performance_metrics,
            optimization_suggestions: this.results.optimization_suggestions,
            maintenance_recommendations: this.results.maintenance_recommendations,
            next_steps: [
                'Monitor query performance over next 7 days',
                'Run VACUUM if space reclamation needed',
                'Review and optimize top 10 slowest queries',
                'Implement automated maintenance schedule'
            ]
        };
        
        // Save report to file
        const reportPath = path.join(__dirname, '..', 'database_optimization_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`✅ Optimization report saved to: ${reportPath}`);
        return report;
    }

    async runFullOptimization() {
        console.log('🚀 Starting comprehensive database optimization...');
        
        try {
            await this.analyzeQueryPerformance();
            await this.optimizeIndexes();
            await this.createMaintenanceProcedures();
            await this.setupPerformanceMonitoring();
            await this.analyzeTableFragmentation();
            
            const report = await this.generateOptimizationReport();
            
            console.log('✅ Database optimization completed successfully!');
            console.log(`📊 Report generated with ${report.optimization_suggestions.length} suggestions`);
            
            return report;
            
        } catch (error) {
            console.error('❌ Database optimization failed:', error);
            throw error;
        }
    }
}

// Execute optimization if run directly
if (require.main === module) {
    const optimizer = new DatabaseOptimizer();
    optimizer.runFullOptimization()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = DatabaseOptimizer;
