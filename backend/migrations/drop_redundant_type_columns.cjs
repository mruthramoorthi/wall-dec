const pool = require('../config/db.cjs');

async function migrate() {
  console.log('=== Dropping Redundant String Type Columns ===');

  try {
    // 1. Drop primary_type from account_groups if it exists
    const [agCols] = await pool.query(`SHOW COLUMNS FROM account_groups LIKE 'primary_type'`);
    if (agCols.length > 0) {
      await pool.query(`ALTER TABLE account_groups DROP COLUMN primary_type;`);
      console.log('✓ Dropped redundant primary_type column from account_groups');
    } else {
      console.log('• primary_type already dropped from account_groups');
    }

    // 2. Drop account_type from chart_of_accounts if it exists
    const [coaCols] = await pool.query(`SHOW COLUMNS FROM chart_of_accounts LIKE 'account_type'`);
    if (coaCols.length > 0) {
      await pool.query(`ALTER TABLE chart_of_accounts DROP COLUMN account_type;`);
      console.log('✓ Dropped redundant account_type column from chart_of_accounts');
    } else {
      console.log('• account_type already dropped from chart_of_accounts');
    }

    console.log('=== Cleanup complete: Only account_type_id (FK to account_type_master) remains in tables ===');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
