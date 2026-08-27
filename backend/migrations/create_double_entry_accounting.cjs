const pool = require('../config/db.cjs');
const { v4: uuidv4 } = require('uuid');

async function migrate() {
  console.log('=== Starting Professional Double-Entry Accounting Schema Migration ===');

  try {
    // 1. Create account_groups table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(36) NOT NULL UNIQUE,
        group_code VARCHAR(30) NOT NULL UNIQUE,
        group_name VARCHAR(100) NOT NULL,
        primary_type ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL,
        parent_uid VARCHAR(36) NULL,
        description TEXT NULL,
        is_system TINYINT(1) NOT NULL DEFAULT 1,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_datetime DATETIME NULL,
        delete_datetime DATETIME NULL,
        INDEX idx_group_code (group_code),
        INDEX idx_primary_type (primary_type),
        INDEX idx_parent_uid (parent_uid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✓ account_groups table created / verified');

    // 2. Create chart_of_accounts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(36) NOT NULL UNIQUE,
        account_code VARCHAR(30) NOT NULL UNIQUE,
        account_name VARCHAR(150) NOT NULL,
        group_uid VARCHAR(36) NOT NULL,
        account_type ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL,
        normal_balance ENUM('DEBIT', 'CREDIT') NOT NULL,
        is_reconcilable TINYINT(1) NOT NULL DEFAULT 0,
        party_type ENUM('NONE', 'CUSTOMER', 'DEALER', 'BANK', 'EMPLOYEE') NOT NULL DEFAULT 'NONE',
        party_uid VARCHAR(36) NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        description TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        is_system TINYINT(1) NOT NULL DEFAULT 0,
        current_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_datetime DATETIME NULL,
        delete_datetime DATETIME NULL,
        INDEX idx_account_code (account_code),
        INDEX idx_group_uid (group_uid),
        INDEX idx_account_type (account_type),
        INDEX idx_party (party_type, party_uid),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✓ chart_of_accounts table created / verified');

    // 3. Create journal_entries table (Header)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(36) NOT NULL UNIQUE,
        entry_number VARCHAR(50) NOT NULL UNIQUE,
        voucher_type ENUM('SALES', 'RECEIPT', 'PAYMENT', 'PURCHASE', 'EXPENSE', 'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE') NOT NULL,
        entry_date DATE NOT NULL,
        source_table VARCHAR(50) NULL,
        source_uid VARCHAR(36) NULL,
        reference_number VARCHAR(100) NULL,
        total_debit DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
        total_credit DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
        narration TEXT NULL,
        status ENUM('POSTED', 'DRAFT', 'VOIDED') NOT NULL DEFAULT 'POSTED',
        created_by VARCHAR(36) NULL,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_datetime DATETIME NULL,
        delete_datetime DATETIME NULL,
        INDEX idx_entry_date (entry_date),
        INDEX idx_voucher_type (voucher_type),
        INDEX idx_source (source_table, source_uid),
        INDEX idx_reference (reference_number),
        INDEX idx_status (status),
        INDEX idx_entry_datetime (entry_datetime)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✓ journal_entries table created / verified');

    // 4. Create journal_items table (Debit & Credit Lines)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS journal_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(36) NOT NULL UNIQUE,
        journal_entry_uid VARCHAR(36) NOT NULL,
        account_uid VARCHAR(36) NOT NULL,
        party_type ENUM('NONE', 'CUSTOMER', 'DEALER', 'BANK', 'EMPLOYEE') NOT NULL DEFAULT 'NONE',
        party_uid VARCHAR(36) NULL,
        debit_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
        credit_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
        line_narration VARCHAR(255) NULL,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        delete_datetime DATETIME NULL,
        INDEX idx_entry_uid (journal_entry_uid),
        INDEX idx_account_uid (account_uid),
        INDEX idx_party (party_type, party_uid),
        INDEX idx_debit (debit_amount),
        INDEX idx_credit (credit_amount)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✓ journal_items table created / verified');

    // 5. Create ar_subledger table (Customer Receivables & Invoices)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ar_subledger (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(36) NOT NULL UNIQUE,
        customer_uid VARCHAR(36) NOT NULL,
        bill_uid VARCHAR(36) NOT NULL,
        journal_entry_uid VARCHAR(36) NULL,
        invoice_number VARCHAR(100) NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        invoice_amount DECIMAL(14, 2) NOT NULL,
        settled_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
        outstanding_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
        status ENUM('OPEN', 'PARTIAL', 'PAID', 'WRITTEN_OFF') NOT NULL DEFAULT 'OPEN',
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_datetime DATETIME NULL,
        delete_datetime DATETIME NULL,
        INDEX idx_customer (customer_uid),
        INDEX idx_bill (bill_uid),
        INDEX idx_invoice_date (invoice_date),
        INDEX idx_due_date (due_date),
        INDEX idx_status (status),
        INDEX idx_outstanding (outstanding_amount)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✓ ar_subledger table created / verified');

    // 6. Create ar_allocations table (Receipt-to-Invoice matching)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ar_allocations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(36) NOT NULL UNIQUE,
        ar_subledger_uid VARCHAR(36) NOT NULL,
        source_table VARCHAR(50) NOT NULL COMMENT 'bill_payments, credit_receipts, customer_advance',
        source_uid VARCHAR(36) NOT NULL,
        journal_entry_uid VARCHAR(36) NULL,
        allocated_amount DECIMAL(14, 2) NOT NULL,
        allocation_date DATE NOT NULL,
        narration VARCHAR(255) NULL,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        delete_datetime DATETIME NULL,
        INDEX idx_subledger (ar_subledger_uid),
        INDEX idx_source (source_table, source_uid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✓ ar_allocations table created / verified');

    // 7. Seed Standard Account Groups
    const standardGroups = [
      { code: 'AG_CASH', name: 'Cash in Hand', type: 'ASSET', desc: 'Physical cash counters and petty cash' },
      { code: 'AG_BANK', name: 'Bank Accounts', type: 'ASSET', desc: 'Current and savings bank accounts' },
      { code: 'AG_SUNDRY_DEBTORS', name: 'Sundry Debtors (Accounts Receivable)', type: 'ASSET', desc: 'Customer trade receivables' },
      { code: 'AG_INVENTORY', name: 'Stock & Inventory', type: 'ASSET', desc: 'Wall panel & decorative sheets stock' },
      { code: 'AG_CURR_ASSETS', name: 'Other Current Assets', type: 'ASSET', desc: 'Undeposited cheques, prepayments' },
      { code: 'AG_SUNDRY_CREDITORS', name: 'Sundry Creditors (Accounts Payable)', type: 'LIABILITY', desc: 'Dealer & supplier payables' },
      { code: 'AG_CUST_ADVANCES', name: 'Customer Advances & Pre-bookings', type: 'LIABILITY', desc: 'Advance deposits held against future bills' },
      { code: 'AG_DUTIES_TAXES', name: 'Duties & Taxes', type: 'LIABILITY', desc: 'GST Output / Input and other statutory liabilities' },
      { code: 'AG_EQUITY', name: 'Capital & Reserves', type: 'EQUITY', desc: "Owner's equity and retained earnings" },
      { code: 'AG_SALES', name: 'Sales Revenue', type: 'REVENUE', desc: 'Counter, retail, wholesale, and online sales income' },
      { code: 'AG_DIRECT_EXP', name: 'Direct Expenses (COGS)', type: 'EXPENSE', desc: 'Stock inward purchases and freight inward' },
      { code: 'AG_INDIRECT_EXP', name: 'Indirect & Operating Expenses', type: 'EXPENSE', desc: 'Rent, electricity, salaries, discounts, tea, utilities' }
    ];

    for (const grp of standardGroups) {
      await pool.query(`
        INSERT INTO account_groups (uid, group_code, group_name, primary_type, description, is_system, entry_datetime)
        VALUES (UUID(), ?, ?, ?, ?, 1, NOW())
        ON DUPLICATE KEY UPDATE
          group_name = VALUES(group_name),
          primary_type = VALUES(primary_type),
          description = VALUES(description),
          delete_datetime = NULL
      `, [grp.code, grp.name, grp.type, grp.desc]);
    }
    console.log('✓ Standard account groups seeded');

    // Helper map for group UIDs
    const [groupRows] = await pool.query('SELECT uid, group_code FROM account_groups WHERE delete_datetime IS NULL');
    const groupMap = {};
    for (const r of groupRows) {
      groupMap[r.group_code] = r.uid;
    }

    // 8. Seed Core Chart of Accounts
    const standardAccounts = [
      { code: '1010', name: 'Cash in Hand', grp: 'AG_CASH', type: 'ASSET', normal: 'DEBIT', party: 'NONE', sys: 1, desc: 'Primary retail counter cash' },
      { code: '1020', name: 'Undeposited Funds / Cheques in Hand', grp: 'AG_CURR_ASSETS', type: 'ASSET', normal: 'DEBIT', party: 'NONE', sys: 1, desc: 'Pending clearance deposits' },
      { code: '1030', name: 'Accounts Receivable (Trade Debtors)', grp: 'AG_SUNDRY_DEBTORS', type: 'ASSET', normal: 'DEBIT', party: 'CUSTOMER', sys: 1, desc: 'General customer receivable control account' },
      { code: '1040', name: 'Stock in Hand / Inventory Asset', grp: 'AG_INVENTORY', type: 'ASSET', normal: 'DEBIT', party: 'NONE', sys: 1, desc: 'Valuation of panels and merchandise' },
      { code: '2010', name: 'Accounts Payable (Trade Creditors)', grp: 'AG_SUNDRY_CREDITORS', type: 'LIABILITY', normal: 'CREDIT', party: 'DEALER', sys: 1, desc: 'Dealer & supplier trade payable control account' },
      { code: '2020', name: 'Customer Advances & Pre-bookings', grp: 'AG_CUST_ADVANCES', type: 'LIABILITY', normal: 'CREDIT', party: 'CUSTOMER', sys: 1, desc: 'Unearned customer deposits held liability' },
      { code: '2030', name: 'GST Output Payable', grp: 'AG_DUTIES_TAXES', type: 'LIABILITY', normal: 'CREDIT', party: 'NONE', sys: 1, desc: 'Sales tax output payable' },
      { code: '3010', name: "Owner's Capital Account", grp: 'AG_EQUITY', type: 'EQUITY', normal: 'CREDIT', party: 'NONE', sys: 1, desc: 'Owner equity and investments' },
      { code: '3020', name: 'Retained Earnings', grp: 'AG_EQUITY', type: 'EQUITY', normal: 'CREDIT', party: 'NONE', sys: 1, desc: 'Accumulated profits & reserves' },
      { code: '4010', name: 'Sales Revenue - Counter & Retail', grp: 'AG_SALES', type: 'REVENUE', normal: 'CREDIT', party: 'NONE', sys: 1, desc: 'Direct retail sales revenue' },
      { code: '4020', name: 'Sales Revenue - Wholesale', grp: 'AG_SALES', type: 'REVENUE', normal: 'CREDIT', party: 'NONE', sys: 1, desc: 'Bulk wholesale sales revenue' },
      { code: '4030', name: 'Sales Revenue - Online Portal', grp: 'AG_SALES', type: 'REVENUE', normal: 'CREDIT', party: 'NONE', sys: 1, desc: 'Online customer orders' },
      { code: '4090', name: 'Other Operating Income', grp: 'AG_SALES', type: 'REVENUE', normal: 'CREDIT', party: 'NONE', sys: 1, desc: 'Miscellaneous business revenue' },
      { code: '5010', name: 'Purchases / Stock Inward (COGS)', grp: 'AG_DIRECT_EXP', type: 'EXPENSE', normal: 'DEBIT', party: 'NONE', sys: 1, desc: 'Inventory purchases from dealers' },
      { code: '5020', name: 'Discounts Allowed', grp: 'AG_INDIRECT_EXP', type: 'EXPENSE', normal: 'DEBIT', party: 'NONE', sys: 1, desc: 'Customer sales discounts granted' },
      { code: '5030', name: 'Round-Off Differences', grp: 'AG_INDIRECT_EXP', type: 'EXPENSE', normal: 'DEBIT', party: 'NONE', sys: 1, desc: 'Fractional currency rounding differences' },
      { code: '5040', name: 'General Operating Expenses', grp: 'AG_INDIRECT_EXP', type: 'EXPENSE', normal: 'DEBIT', party: 'NONE', sys: 1, desc: 'Default operating expense ledger' }
    ];

    for (const acc of standardAccounts) {
      const groupUid = groupMap[acc.grp];
      if (!groupUid) continue;

      await pool.query(`
        INSERT INTO chart_of_accounts 
          (uid, account_code, account_name, group_uid, account_type, normal_balance, party_type, is_system, is_active, description, entry_datetime)
        VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())
        ON DUPLICATE KEY UPDATE
          account_name = VALUES(account_name),
          group_uid = VALUES(group_uid),
          account_type = VALUES(account_type),
          normal_balance = VALUES(normal_balance),
          party_type = VALUES(party_type),
          description = VALUES(description),
          delete_datetime = NULL
      `, [acc.code, acc.name, groupUid, acc.type, acc.normal, acc.party, acc.sys, acc.desc]);
    }
    console.log('✓ Core Chart of Accounts seeded');

    // 9. Auto-sync existing Bank Masters into Chart of Accounts (AG_BANK)
    const bankGroupUid = groupMap['AG_BANK'];
    const [bankRows] = await pool.query('SELECT uid, bank_name, bank_code, account_number FROM bank_master WHERE delete_datetime IS NULL');
    
    let bankCodeCounter = 1100;
    for (const b of bankRows) {
      bankCodeCounter += 10;
      const accCode = `BANK_${b.bank_code || bankCodeCounter}`;
      const accName = `Bank - ${b.bank_name}${b.account_number ? ` (A/C: ${b.account_number})` : ''}`;

      await pool.query(`
        INSERT INTO chart_of_accounts
          (uid, account_code, account_name, group_uid, account_type, normal_balance, is_reconcilable, party_type, party_uid, is_system, is_active, description, entry_datetime)
        VALUES (UUID(), ?, ?, ?, 'ASSET', 'DEBIT', 1, 'BANK', ?, 0, 1, 'Auto-synced from Bank Master', NOW())
        ON DUPLICATE KEY UPDATE
          account_name = VALUES(account_name),
          party_uid = VALUES(party_uid),
          delete_datetime = NULL
      `, [accCode, accName, bankGroupUid, b.uid]);
    }
    console.log(`✓ Auto-synced ${bankRows.length} banks into Chart of Accounts`);

    // 10. Auto-sync Expense Categories into Chart of Accounts (AG_INDIRECT_EXP)
    const expGroupUid = groupMap['AG_INDIRECT_EXP'];
    const [expCatRows] = await pool.query('SELECT uid, category_name FROM expense_category_master WHERE delete_datetime IS NULL');
    
    let expCounter = 6000;
    for (const ec of expCatRows) {
      expCounter += 10;
      const accCode = `EXP_${ec.category_name.replace(/[^A-Za-z0-9]/g, '_').toUpperCase().slice(0, 15)}_${expCounter}`;
      const accName = `Expense - ${ec.category_name}`;

      await pool.query(`
        INSERT INTO chart_of_accounts
          (uid, account_code, account_name, group_uid, account_type, normal_balance, is_reconcilable, party_type, is_system, is_active, description, entry_datetime)
        VALUES (UUID(), ?, ?, ?, 'EXPENSE', 'DEBIT', 0, 'NONE', 0, 1, 'Auto-synced from Expense Category Master', NOW())
        ON DUPLICATE KEY UPDATE
          account_name = VALUES(account_name),
          delete_datetime = NULL
      `, [accCode, accName, expGroupUid]);
    }
    console.log(`✓ Auto-synced ${expCatRows.length} expense categories into Chart of Accounts`);

    console.log('\n=== Double-Entry Accounting Migration Completed Successfully! ===\n');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed with error:', err);
    process.exit(1);
  }
}

migrate();
