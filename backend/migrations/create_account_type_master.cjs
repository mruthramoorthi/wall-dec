const pool = require('../config/db.cjs');

async function migrate() {
  console.log('=== Creating account_type_master & Foreign Key Constraints ===');

  try {
    // 1. Create account_type_master table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_type_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type_id INT NOT NULL UNIQUE,
        type_code VARCHAR(30) NOT NULL UNIQUE,
        type_name VARCHAR(100) NOT NULL,
        normal_balance ENUM('DEBIT', 'CREDIT') NOT NULL,
        display_order INT NOT NULL DEFAULT 1,
        description VARCHAR(255) NULL,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_datetime DATETIME NULL,
        delete_datetime DATETIME NULL,
        INDEX idx_type_id (type_id),
        INDEX idx_type_code (type_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✓ account_type_master table created');

    // 2. Seed the 5 immutable standard account types (1 to 5)
    const types = [
      { type_id: 1, type_code: 'ASSET', type_name: 'Assets', normal_balance: 'DEBIT', display_order: 1, description: 'Economic resources owned (Cash, Bank, AR, Stock)' },
      { type_id: 2, type_code: 'LIABILITY', type_name: 'Liabilities', normal_balance: 'CREDIT', display_order: 2, description: 'Obligations owed (AP, Customer Advances, Taxes)' },
      { type_id: 3, type_code: 'EQUITY', type_name: 'Equity & Capital', normal_balance: 'CREDIT', display_order: 3, description: 'Owner capital and retained earnings' },
      { type_id: 4, type_code: 'REVENUE', type_name: 'Revenue & Income', normal_balance: 'CREDIT', display_order: 4, description: 'Income from sales and services' },
      { type_id: 5, type_code: 'EXPENSE', type_name: 'Expenses & Costs', normal_balance: 'DEBIT', display_order: 5, description: 'Operational, purchase, and administrative expenses' }
    ];

    for (const t of types) {
      await pool.query(`
        INSERT INTO account_type_master (type_id, type_code, type_name, normal_balance, display_order, description, entry_datetime)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
          type_name = VALUES(type_name),
          normal_balance = VALUES(normal_balance),
          display_order = VALUES(display_order),
          description = VALUES(description),
          delete_datetime = NULL
      `, [t.type_id, t.type_code, t.type_name, t.normal_balance, t.display_order, t.description]);
    }
    console.log('✓ 5 standard Account Types (1 to 5) seeded into account_type_master');

    // 3. Add account_type_id column to account_groups if not exists
    const [agCols] = await pool.query(`SHOW COLUMNS FROM account_groups LIKE 'account_type_id'`);
    if (agCols.length === 0) {
      await pool.query(`
        ALTER TABLE account_groups 
        ADD COLUMN account_type_id INT NULL AFTER group_name;
      `);
      console.log('✓ Added account_type_id to account_groups');
    }

    // Populate account_type_id in account_groups
    await pool.query(`
      UPDATE account_groups ag
      JOIN account_type_master atm ON atm.type_code = ag.primary_type
      SET ag.account_type_id = atm.type_id
      WHERE ag.account_type_id IS NULL;
    `);

    // Make account_type_id NOT NULL and add Foreign Key
    try {
      await pool.query(`ALTER TABLE account_groups MODIFY COLUMN account_type_id INT NOT NULL;`);
      await pool.query(`
        ALTER TABLE account_groups 
        ADD CONSTRAINT fk_account_groups_type_id 
        FOREIGN KEY (account_type_id) REFERENCES account_type_master(type_id)
        ON UPDATE CASCADE ON DELETE RESTRICT;
      `);
      console.log('✓ Foreign key constraint fk_account_groups_type_id enforced on account_groups');
    } catch (e) {
      if (!e.message.includes('Duplicate foreign key') && !e.message.includes('already exists')) {
        console.log('FK note (account_groups):', e.message);
      }
    }

    // 4. Add account_type_id column to chart_of_accounts if not exists
    const [coaCols] = await pool.query(`SHOW COLUMNS FROM chart_of_accounts LIKE 'account_type_id'`);
    if (coaCols.length === 0) {
      await pool.query(`
        ALTER TABLE chart_of_accounts 
        ADD COLUMN account_type_id INT NULL AFTER group_uid;
      `);
      console.log('✓ Added account_type_id to chart_of_accounts');
    }

    // Populate account_type_id in chart_of_accounts
    await pool.query(`
      UPDATE chart_of_accounts coa
      JOIN account_type_master atm ON atm.type_code = coa.account_type
      SET coa.account_type_id = atm.type_id
      WHERE coa.account_type_id IS NULL;
    `);

    // Make account_type_id NOT NULL and add Foreign Key
    try {
      await pool.query(`ALTER TABLE chart_of_accounts MODIFY COLUMN account_type_id INT NOT NULL;`);
      await pool.query(`
        ALTER TABLE chart_of_accounts 
        ADD CONSTRAINT fk_chart_of_accounts_type_id 
        FOREIGN KEY (account_type_id) REFERENCES account_type_master(type_id)
        ON UPDATE CASCADE ON DELETE RESTRICT;
      `);
      console.log('✓ Foreign key constraint fk_chart_of_accounts_type_id enforced on chart_of_accounts');
    } catch (e) {
      if (!e.message.includes('Duplicate foreign key') && !e.message.includes('already exists')) {
        console.log('FK note (chart_of_accounts):', e.message);
      }
    }

    console.log('=== account_type_master & Foreign Key Migration Finished Successfully ===');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
