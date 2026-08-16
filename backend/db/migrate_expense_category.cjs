const pool = require('../config/db.cjs');
const { v4: uuidv4 } = require('uuid');

async function run() {
  console.log('Running expense category master migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expense_category_master (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      uid CHAR(36) NOT NULL,
      category_name VARCHAR(100) NOT NULL,
      entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      update_datetime DATETIME NULL,
      delete_datetime DATETIME NULL,
      INDEX idx_uid (uid),
      INDEX idx_name (category_name),
      INDEX idx_active (update_datetime, delete_datetime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM expense_category_master WHERE update_datetime IS NULL AND delete_datetime IS NULL`
  );

  if (count === 0) {
    console.log('Seeding default expense categories...');
    const defaults = [
      'Tea & Refreshments',
      'Shop Rent',
      'Electricity / Utilities',
      'Transport / Courier',
      'Salaries & Wages',
      'Office Stationery',
      'Maintenance & Repairs',
      'Packing Materials',
      'Miscellaneous'
    ];

    for (const name of defaults) {
      await pool.query(
        `INSERT INTO expense_category_master (uid, category_name, entry_datetime) VALUES (?, ?, NOW())`,
        [uuidv4(), name]
      );
    }
    console.log(`✓ Seeded ${defaults.length} default expense categories.`);
  }

  console.log('✓ expense_category_master table created and verified successfully');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
