const pool = require('../config/db.cjs');

async function runMigration() {
  try {
    console.log('Adding username and password_hash to employee_master...');
    const [cols] = await pool.query('DESCRIBE employee_master');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('username')) {
      await pool.query('ALTER TABLE employee_master ADD COLUMN username VARCHAR(50) NULL AFTER email');
      console.log('✓ Added username column');
    }
    if (!colNames.includes('password_hash')) {
      await pool.query('ALTER TABLE employee_master ADD COLUMN password_hash VARCHAR(255) NULL AFTER username');
      console.log('✓ Added password_hash column');
    }

    console.log('Employee auth migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
