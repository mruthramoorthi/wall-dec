const pool = require('../config/db.cjs');

async function migrate() {
  console.log('--- Starting Account Transactions Table Migration ---');

  try {
    // 1. Create account_transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(36) NOT NULL UNIQUE,
        transaction_type VARCHAR(30) NOT NULL COMMENT 'BILLING, ADVANCE, CREDIT_RECEIVED, EXPENSE, MANUAL',
        source_table VARCHAR(50) NOT NULL,
        source_uid VARCHAR(36) NOT NULL,
        reference_number VARCHAR(100) NULL,
        party_name VARCHAR(150) NULL,
        party_uid VARCHAR(36) NULL,
        amount DECIMAL(12, 2) NOT NULL COMMENT 'Positive for income/credits, Negative for expenses',
        payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash',
        bank_uid VARCHAR(36) NULL,
        bank_name VARCHAR(100) NULL,
        ref_number VARCHAR(100) NULL,
        transaction_date DATE NOT NULL,
        denominations JSON NULL,
        tendered_amount DECIMAL(12, 2) NULL,
        change_returned DECIMAL(12, 2) NULL,
        narration TEXT NULL,
        entry_datetime DATETIME NOT NULL,
        update_datetime DATETIME NULL,
        delete_datetime DATETIME NULL,
        INDEX idx_txn_date (transaction_date),
        INDEX idx_txn_type (transaction_type),
        INDEX idx_source (source_table, source_uid),
        INDEX idx_payment_mode (payment_mode),
        INDEX idx_party_uid (party_uid),
        INDEX idx_bank_uid (bank_uid),
        INDEX idx_entry_datetime (entry_datetime),
        INDEX idx_delete_datetime (delete_datetime)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✓ account_transactions table created or already exists');

    // 2. Backfill from bill_payments (BILLING)
    await pool.query(`
      INSERT IGNORE INTO account_transactions 
        (uid, transaction_type, source_table, source_uid, reference_number, party_name, party_uid,
         amount, payment_mode, bank_uid, bank_name, ref_number, transaction_date,
         denominations, tendered_amount, change_returned, narration, entry_datetime, update_datetime, delete_datetime)
      SELECT 
        bp.uid,
        'BILLING' AS transaction_type,
        'bill_payments' AS source_table,
        bp.uid AS source_uid,
        CONCAT('BILL-', LPAD(b.id, 4, '0')) AS reference_number,
        c.customer_name AS party_name,
        c.uid AS party_uid,
        ABS(bp.amount) AS amount,
        LOWER(COALESCE(bp.payment_mode, 'cash')) AS payment_mode,
        bp.bank_uid,
        bm.bank_name,
        bp.ref_number,
        COALESCE(bp.transaction_date, DATE(bp.entry_datetime)) AS transaction_date,
        bp.denominations,
        bp.tendered_amount,
        bp.change_returned,
        CONCAT('Sale Bill #', LPAD(b.id, 4, '0')) AS narration,
        bp.entry_datetime,
        bp.update_datetime,
        bp.delete_datetime
      FROM bill_payments bp
      JOIN bill_master b ON b.uid = bp.bill_uid
      LEFT JOIN customer_master c ON c.uid = b.customer_uid
      LEFT JOIN bank_master bm ON bm.uid = bp.bank_uid
      ON DUPLICATE KEY UPDATE
        amount = VALUES(amount),
        reference_number = VALUES(reference_number),
        party_name = VALUES(party_name),
        update_datetime = VALUES(update_datetime),
        delete_datetime = VALUES(delete_datetime)
    `);
    console.log('✓ Backfilled Billing transactions');

    // 3. Backfill from customer_advance (ADVANCE)
    await pool.query(`
      INSERT IGNORE INTO account_transactions 
        (uid, transaction_type, source_table, source_uid, reference_number, party_name, party_uid,
         amount, payment_mode, bank_uid, bank_name, ref_number, transaction_date,
         denominations, tendered_amount, change_returned, narration, entry_datetime, update_datetime, delete_datetime)
      SELECT 
        ca.uid,
        'ADVANCE' AS transaction_type,
        'customer_advance' AS source_table,
        ca.uid AS source_uid,
        COALESCE(ca.prebook_code, CONCAT('ADV-', LPAD(ca.id, 4, '0'))) AS reference_number,
        c.customer_name AS party_name,
        c.uid AS party_uid,
        ABS(ca.amount) AS amount,
        LOWER(COALESCE(ca.payment_mode, 'cash')) AS payment_mode,
        ca.bank_uid,
        bm.bank_name,
        ca.ref_number,
        COALESCE(ca.transaction_date, DATE(ca.entry_datetime)) AS transaction_date,
        ca.denominations,
        ca.tendered_amount,
        ca.change_returned,
        COALESCE(ca.notes, IF(ca.is_prebook = 1, 'Customer Pre-booking Advance', 'Customer Advance Payment')) AS narration,
        ca.entry_datetime,
        ca.update_datetime,
        ca.delete_datetime
      FROM customer_advance ca
      LEFT JOIN customer_master c ON c.uid = ca.customer_uid
      LEFT JOIN bank_master bm ON bm.uid = ca.bank_uid
      WHERE ca.amount > 0
      ON DUPLICATE KEY UPDATE
        amount = VALUES(amount),
        reference_number = VALUES(reference_number),
        party_name = VALUES(party_name),
        update_datetime = VALUES(update_datetime),
        delete_datetime = VALUES(delete_datetime)
    `);
    console.log('✓ Backfilled Customer Advance transactions');

    // 4. Backfill from credit_receipts (CREDIT_RECEIVED)
    await pool.query(`
      INSERT IGNORE INTO account_transactions 
        (uid, transaction_type, source_table, source_uid, reference_number, party_name, party_uid,
         amount, payment_mode, bank_uid, bank_name, ref_number, transaction_date,
         denominations, tendered_amount, change_returned, narration, entry_datetime, update_datetime, delete_datetime)
      SELECT 
        cr.uid,
        'CREDIT_RECEIVED' AS transaction_type,
        'credit_receipts' AS source_table,
        cr.uid AS source_uid,
        CONCAT('RCP-', LPAD(cr.id, 4, '0')) AS reference_number,
        c.customer_name AS party_name,
        c.uid AS party_uid,
        ABS(cr.amount) AS amount,
        LOWER(COALESCE(cr.payment_mode, 'cash')) AS payment_mode,
        cr.bank_uid,
        bm.bank_name,
        cr.ref_number,
        COALESCE(cr.receipt_date, DATE(cr.entry_datetime)) AS transaction_date,
        cr.denominations,
        cr.tendered_amount,
        cr.change_returned,
        COALESCE(cr.narration, CONCAT('Credit Received against Bill #', LPAD(b.id, 4, '0'))) AS narration,
        cr.entry_datetime,
        cr.update_datetime,
        cr.delete_datetime
      FROM credit_receipts cr
      LEFT JOIN customer_master c ON c.uid = cr.customer_uid
      LEFT JOIN bill_master b ON b.uid = cr.bill_uid
      LEFT JOIN bank_master bm ON bm.uid = cr.bank_uid
      ON DUPLICATE KEY UPDATE
        amount = VALUES(amount),
        reference_number = VALUES(reference_number),
        party_name = VALUES(party_name),
        update_datetime = VALUES(update_datetime),
        delete_datetime = VALUES(delete_datetime)
    `);
    console.log('✓ Backfilled Credit Received transactions');

    // 5. Backfill from expense_master (EXPENSE - Stored as NEGATIVE values)
    await pool.query(`
      INSERT IGNORE INTO account_transactions 
        (uid, transaction_type, source_table, source_uid, reference_number, party_name, party_uid,
         amount, payment_mode, bank_uid, bank_name, ref_number, transaction_date,
         denominations, tendered_amount, change_returned, narration, entry_datetime, update_datetime, delete_datetime)
      SELECT 
        e.uid,
        'EXPENSE' AS transaction_type,
        'expense_master' AS source_table,
        e.uid AS source_uid,
        COALESCE(e.ref_number, CONCAT('EXP-', LPAD(e.id, 4, '0'))) AS reference_number,
        e.category AS party_name,
        NULL AS party_uid,
        -ABS(e.amount) AS amount, -- Negative value for expenses
        LOWER(COALESCE(e.payment_mode, 'cash')) AS payment_mode,
        e.bank_uid,
        bm.bank_name,
        e.ref_number,
        COALESCE(e.expense_date, DATE(e.entry_datetime)) AS transaction_date,
        e.denominations,
        e.tendered_amount,
        e.change_returned,
        COALESCE(e.narration, CONCAT('Expense: ', e.category)) AS narration,
        e.entry_datetime,
        e.update_datetime,
        e.delete_datetime
      FROM expense_master e
      LEFT JOIN bank_master bm ON bm.uid = e.bank_uid
      ON DUPLICATE KEY UPDATE
        amount = VALUES(amount),
        reference_number = VALUES(reference_number),
        party_name = VALUES(party_name),
        update_datetime = VALUES(update_datetime),
        delete_datetime = VALUES(delete_datetime)
    `);
    console.log('✓ Backfilled Expense transactions (as negative values)');

    const [[countRow]] = await pool.query('SELECT COUNT(*) AS total, SUM(amount) AS net_balance FROM account_transactions');
    console.log(`\nMigration completed successfully! Total transactions: ${countRow.total}, Net Balance: ₹${countRow.net_balance}\n`);

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
