const pool = require('../config/db.cjs');

async function migrateDealerPaymentsSchema() {
  console.log('=== Running Migration: Dealer Purchase & Accounts Payable Payments ===');

  // 1. Add columns to stock_inward if not present
  const [cols] = await pool.query('DESCRIBE stock_inward');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('total_purchase_amount')) {
    await pool.query(`ALTER TABLE stock_inward ADD COLUMN total_purchase_amount DECIMAL(12,2) DEFAULT 0 AFTER avg_total_rate`);
    console.log('✓ Added total_purchase_amount to stock_inward');
  }
  if (!colNames.includes('paid_amount')) {
    await pool.query(`ALTER TABLE stock_inward ADD COLUMN paid_amount DECIMAL(12,2) DEFAULT 0 AFTER total_purchase_amount`);
    console.log('✓ Added paid_amount to stock_inward');
  }
  if (!colNames.includes('due_amount')) {
    await pool.query(`ALTER TABLE stock_inward ADD COLUMN due_amount DECIMAL(12,2) DEFAULT 0 AFTER paid_amount`);
    console.log('✓ Added due_amount to stock_inward');
  }
  if (!colNames.includes('payment_mode')) {
    await pool.query(`ALTER TABLE stock_inward ADD COLUMN payment_mode VARCHAR(30) DEFAULT 'credit' AFTER due_amount`);
    console.log('✓ Added payment_mode to stock_inward');
  }
  if (!colNames.includes('bank_uid')) {
    await pool.query(`ALTER TABLE stock_inward ADD COLUMN bank_uid CHAR(36) NULL AFTER payment_mode`);
    console.log('✓ Added bank_uid to stock_inward');
  }
  if (!colNames.includes('ref_number')) {
    await pool.query(`ALTER TABLE stock_inward ADD COLUMN ref_number VARCHAR(100) NULL AFTER bank_uid`);
    console.log('✓ Added ref_number to stock_inward');
  }
  if (!colNames.includes('due_date')) {
    await pool.query(`ALTER TABLE stock_inward ADD COLUMN due_date DATE NULL AFTER ref_number`);
    console.log('✓ Added due_date to stock_inward');
  }
  if (!colNames.includes('due_narration')) {
    await pool.query(`ALTER TABLE stock_inward ADD COLUMN due_narration TEXT NULL AFTER due_date`);
    console.log('✓ Added due_narration to stock_inward');
  }
  if (!colNames.includes('credit_status')) {
    await pool.query(`ALTER TABLE stock_inward ADD COLUMN credit_status ENUM('paid', 'partially_paid', 'unpaid') DEFAULT 'unpaid' AFTER due_narration`);
    console.log('✓ Added credit_status to stock_inward');
  }

  // Backfill existing stock_inward records
  await pool.query(`
    UPDATE stock_inward
    SET 
      total_purchase_amount = avg_total_rate,
      due_amount = CASE WHEN is_opening = 1 THEN 0 ELSE avg_total_rate END,
      paid_amount = 0,
      payment_mode = 'credit',
      credit_status = CASE WHEN is_opening = 1 THEN 'paid' ELSE 'unpaid' END
    WHERE total_purchase_amount = 0 OR total_purchase_amount IS NULL
  `);
  console.log('✓ Backfilled existing stock_inward purchase amount and due amounts');

  // 2. Create dealer_payments table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dealer_payments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      uid CHAR(36) NOT NULL UNIQUE,
      inward_uid CHAR(36) NOT NULL,
      dealer_uid CHAR(36) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      payment_mode VARCHAR(30) NOT NULL DEFAULT 'cash',
      bank_uid CHAR(36) NULL,
      ref_number VARCHAR(100) NULL,
      payment_date DATE NOT NULL,
      denominations JSON NULL,
      tendered_amount DECIMAL(12,2) NULL,
      change_returned DECIMAL(12,2) NULL,
      narration TEXT NULL,
      entry_datetime DATETIME NOT NULL,
      update_datetime DATETIME NULL,
      delete_datetime DATETIME NULL,
      INDEX idx_dp_inward (inward_uid),
      INDEX idx_dp_dealer (dealer_uid),
      INDEX idx_dp_date (payment_date),
      INDEX idx_dp_del (delete_datetime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ Created dealer_payments table');

  // 3. Register screen in screen_master & permissions
  const [[existingScreen]] = await pool.query(`SELECT id FROM screen_master WHERE screen_key = 'dealer_payment'`);
  if (!existingScreen) {
    const [scResult] = await pool.query(`
      INSERT INTO screen_master (screen_key, screen_name, icon, route_path, category, is_active, display_order)
      VALUES ('dealer_payment', 'Dealer Payment', '💳', '/dealer-payment', 'Finance', 1, 19)
    `);
    const screenId = scResult.insertId;
    console.log(`✓ Registered screen_master: dealer_payment (ID: ${screenId})`);

    const roles = ['Admin', 'Accountant', 'Manager', 'Store Keeper', 'Billing Staff'];
    for (const r of roles) {
      await pool.query(`
        INSERT INTO role_screen_permissions (role_name, screen_key, can_view, entry_datetime)
        VALUES (?, 'dealer_payment', 1, NOW())
        ON DUPLICATE KEY UPDATE can_view = 1, update_datetime = NOW()
      `, [r]);
    }
    console.log('✓ Granted dealer_payment screen permissions to Admin, Accountant, Manager, Store Keeper, Billing Staff');
  }

  console.log('=== Migration Finished Successfully ===');
}

migrateDealerPaymentsSchema()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
