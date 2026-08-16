const pool = require('../config/db.cjs');

async function run() {
  console.log('Running expense master migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expense_master (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      uid CHAR(36) NOT NULL,
      expense_date DATE NOT NULL,
      category VARCHAR(100) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash',
      bank_uid CHAR(36) NULL,
      ref_number VARCHAR(100) NULL,
      denominations JSON NULL,
      tendered_amount DECIMAL(12,2) NULL,
      change_returned DECIMAL(12,2) NULL,
      narration TEXT NULL,
      entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      update_datetime DATETIME NULL,
      delete_datetime DATETIME NULL,
      INDEX idx_uid (uid),
      INDEX idx_date (expense_date),
      INDEX idx_category (category),
      INDEX idx_active (update_datetime, delete_datetime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('✓ expense_master table created successfully');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
