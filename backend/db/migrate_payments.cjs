const pool = require('../config/db.cjs');
const { newUid } = require('../utils/audit.cjs');

async function run() {
  console.log('Running payment and bank master migrations...');

  // 1. Create bank_master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_master (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      uid CHAR(36) NOT NULL,
      bank_name VARCHAR(100) NOT NULL,
      bank_code VARCHAR(50) NOT NULL,
      account_number VARCHAR(50) NOT NULL,
      ifsc_code VARCHAR(30) NOT NULL,
      branch VARCHAR(100) NOT NULL,
      city VARCHAR(100) NOT NULL,
      entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      update_datetime DATETIME NULL,
      delete_datetime DATETIME NULL,
      INDEX idx_uid (uid),
      INDEX idx_code (bank_code),
      INDEX idx_active (update_datetime, delete_datetime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ bank_master table ready');

  // 2. Create payment_mode_master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_mode_master (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      uid CHAR(36) NOT NULL,
      mode_name VARCHAR(100) NOT NULL,
      mode_code VARCHAR(50) NOT NULL,
      is_bank_linked TINYINT(1) NOT NULL DEFAULT 0,
      is_cash TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      update_datetime DATETIME NULL,
      delete_datetime DATETIME NULL,
      INDEX idx_uid (uid),
      INDEX idx_code (mode_code),
      INDEX idx_active (update_datetime, delete_datetime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ payment_mode_master table ready');

  // 3. Seed default payment modes if empty
  const [[{ pCount }]] = await pool.query('SELECT COUNT(*) AS pCount FROM payment_mode_master WHERE delete_datetime IS NULL');
  if (Number(pCount) === 0) {
    const defaults = [
      { name: 'Cash', code: 'cash', is_bank_linked: 0, is_cash: 1 },
      { name: 'Bank Transfer', code: 'bank', is_bank_linked: 1, is_cash: 0 },
      { name: 'NEFT / RTGS', code: 'neft', is_bank_linked: 1, is_cash: 0 },
      { name: 'Cheque', code: 'cheque', is_bank_linked: 1, is_cash: 0 },
      { name: 'UPI / QR', code: 'upi', is_bank_linked: 1, is_cash: 0 },
      { name: 'Debit / Credit Card', code: 'card', is_bank_linked: 1, is_cash: 0 }
    ];
    for (const d of defaults) {
      await pool.query(
        'INSERT INTO payment_mode_master (uid, mode_name, mode_code, is_bank_linked, is_cash, is_active, entry_datetime) VALUES (?, ?, ?, ?, ?, 1, NOW())',
        [newUid(), d.name, d.code, d.is_bank_linked, d.is_cash]
      );
    }
    console.log('✓ Seeded default payment modes');
  }

  // 4. Helper to safely add column if missing
  async function addColIfMissing(table, columnDef, colName) {
    const [cols] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE '${colName}'`);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
      console.log(`✓ Added ${colName} to ${table}`);
    }
  }

  // bill_payments columns
  await addColIfMissing('bill_payments', 'transaction_date DATE NULL', 'transaction_date');
  await addColIfMissing('bill_payments', 'ref_number VARCHAR(100) NULL', 'ref_number');
  await addColIfMissing('bill_payments', 'bank_uid CHAR(36) NULL', 'bank_uid');
  await addColIfMissing('bill_payments', 'denominations JSON NULL', 'denominations');
  await addColIfMissing('bill_payments', 'tendered_amount DECIMAL(12,2) NULL', 'tendered_amount');
  await addColIfMissing('bill_payments', 'change_returned DECIMAL(12,2) NULL', 'change_returned');

  // customer_advance columns
  await addColIfMissing('customer_advance', 'transaction_date DATE NULL', 'transaction_date');
  await addColIfMissing('customer_advance', 'ref_number VARCHAR(100) NULL', 'ref_number');
  await addColIfMissing('customer_advance', 'bank_uid CHAR(36) NULL', 'bank_uid');
  await addColIfMissing('customer_advance', 'denominations JSON NULL', 'denominations');
  await addColIfMissing('customer_advance', 'tendered_amount DECIMAL(12,2) NULL', 'tendered_amount');
  await addColIfMissing('customer_advance', 'change_returned DECIMAL(12,2) NULL', 'change_returned');

  // credit_receipts columns
  await addColIfMissing('credit_receipts', 'ref_number VARCHAR(100) NULL', 'ref_number');
  await addColIfMissing('credit_receipts', 'bank_uid CHAR(36) NULL', 'bank_uid');
  await addColIfMissing('credit_receipts', 'denominations JSON NULL', 'denominations');
  await addColIfMissing('credit_receipts', 'tendered_amount DECIMAL(12,2) NULL', 'tendered_amount');
  await addColIfMissing('credit_receipts', 'change_returned DECIMAL(12,2) NULL', 'change_returned');

  console.log('✓ All migrations applied successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
