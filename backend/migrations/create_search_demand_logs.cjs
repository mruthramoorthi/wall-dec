const pool = require('../config/db.cjs');
const { newUid } = require('../utils/audit.cjs');

async function runMigration() {
  try {
    console.log('Running Search Demand Logs Migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_demand_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        uid CHAR(36) NOT NULL UNIQUE,
        query_text VARCHAR(255) NOT NULL,
        search_type VARCHAR(50) NOT NULL DEFAULT 'text',
        results_count INT NOT NULL DEFAULT 0,
        user_ip VARCHAR(50) NULL,
        user_uid CHAR(36) NULL,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_query (query_text),
        INDEX idx_zero_results (results_count),
        INDEX idx_entry (entry_datetime)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✓ Created search_demand_logs table successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
