const pool = require('../config/db.cjs');
const { randomUUID } = require('crypto');

async function runMigration() {
  try {
    console.log('Starting Screen Rights & SMTP Migration...');

    // 1. Add SMTP columns to company_master
    const [compCols] = await pool.query('DESCRIBE company_master');
    const compColNames = compCols.map(c => c.Field);
    if (!compColNames.includes('smtp_host')) {
      await pool.query('ALTER TABLE company_master ADD COLUMN smtp_host VARCHAR(150) NULL AFTER igst_percent');
      await pool.query('ALTER TABLE company_master ADD COLUMN smtp_port INT NULL DEFAULT 587 AFTER smtp_host');
      await pool.query('ALTER TABLE company_master ADD COLUMN smtp_user VARCHAR(150) NULL AFTER smtp_port');
      await pool.query('ALTER TABLE company_master ADD COLUMN smtp_pass VARCHAR(255) NULL AFTER smtp_user');
      await pool.query('ALTER TABLE company_master ADD COLUMN smtp_from_name VARCHAR(150) NULL AFTER smtp_pass');
      console.log('✓ Added SMTP columns to company_master');
    }

    // 2. Add role_position to user_master
    const [userCols] = await pool.query('DESCRIBE user_master');
    const userColNames = userCols.map(c => c.Field);
    if (!userColNames.includes('role_position')) {
      await pool.query("ALTER TABLE user_master ADD COLUMN role_position VARCHAR(50) DEFAULT 'Admin' AFTER ui_preferences");
      console.log('✓ Added role_position to user_master');
    }

    // 3. Create screen_master table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS screen_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(36) NOT NULL UNIQUE,
        screen_key VARCHAR(50) NOT NULL UNIQUE,
        screen_name VARCHAR(100) NOT NULL,
        icon VARCHAR(50) NOT NULL,
        route_path VARCHAR(100) NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        display_order INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        is_admin_only TINYINT(1) DEFAULT 0,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_datetime DATETIME NULL,
        delete_datetime DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Created screen_master table');

    // 4. Create role_screen_permissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_screen_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL,
        screen_key VARCHAR(50) NOT NULL,
        can_view TINYINT(1) NOT NULL DEFAULT 1,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_datetime DATETIME NULL,
        UNIQUE KEY uq_role_screen (role_name, screen_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Created role_screen_permissions table');

    // 5. Seed Screens
    const screens = [
      { key: 'company', name: 'Company', icon: '🏢', route: '/company', cat: 'Master', order: 1, adminOnly: 1 },
      { key: 'employee', name: 'Employees', icon: '👥', route: '/employee', cat: 'Master', order: 2, adminOnly: 1 },
      { key: 'screen_rights', name: 'Screen Rights', icon: '🛡️', route: '/screen-rights', cat: 'Master', order: 3, adminOnly: 1 },
      { key: 'bank_master', name: 'Bank Master', icon: '🏦', route: '/bank-master', cat: 'Master', order: 4, adminOnly: 0 },
      { key: 'transaction_master', name: 'Transaction Master', icon: '💳', route: '/transaction-master', cat: 'Master', order: 5, adminOnly: 0 },
      { key: 'expense_category', name: 'Expense Categories', icon: '📂', route: '/expense-category', cat: 'Master', order: 6, adminOnly: 0 },
      { key: 'size_master', name: 'Size Master', icon: '📐', route: '/size', cat: 'Inventory', order: 7, adminOnly: 0 },
      { key: 'dealer_master', name: 'Dealer Master', icon: '🏭', route: '/dealer', cat: 'Inventory', order: 8, adminOnly: 0 },
      { key: 'customer_master', name: 'Customer Master', icon: '🤝', route: '/customer', cat: 'Sales', order: 9, adminOnly: 0 },
      { key: 'stock_inward', name: 'Stock Inward', icon: '📥', route: '/stock-inward', cat: 'Inventory', order: 10, adminOnly: 0 },
      { key: 'rate_master', name: 'Rate Master', icon: '🏷️', route: '/rate-master', cat: 'Sales', order: 11, adminOnly: 0 },
      { key: 'stock_check', name: 'Stock Checking', icon: '🔍', route: '/stock-check', cat: 'Inventory', order: 12, adminOnly: 0 },
      { key: 'billing', name: 'Billing', icon: '🧾', route: '/billing', cat: 'Sales', order: 13, adminOnly: 0 },
      { key: 'credit_received', name: 'Credit Received', icon: '💰', route: '/credit-received', cat: 'Finance', order: 14, adminOnly: 0 },
      { key: 'credit_report', name: 'Credit Report', icon: '📊', route: '/credit-report', cat: 'Finance', order: 15, adminOnly: 0 },
      { key: 'advance', name: 'Advance / Pre-booking', icon: '🔖', route: '/advance', cat: 'Sales', order: 16, adminOnly: 0 },
      { key: 'expense', name: 'Expenses', icon: '💸', route: '/expense', cat: 'Finance', order: 17, adminOnly: 0 },
      { key: 'amount_transaction', name: 'Amount Transaction', icon: '📈', route: '/amount-transaction', cat: 'Finance', order: 18, adminOnly: 0 },
      { key: 'profile', name: 'My Profile', icon: '👤', route: '/profile', cat: 'General', order: 19, adminOnly: 0 }
    ];

    for (const sc of screens) {
      await pool.query(`
        INSERT INTO screen_master (uid, screen_key, screen_name, icon, route_path, category, display_order, is_active, is_admin_only, entry_datetime)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())
        ON DUPLICATE KEY UPDATE screen_name = VALUES(screen_name), icon = VALUES(icon), route_path = VALUES(route_path), category = VALUES(category), display_order = VALUES(display_order), is_admin_only = VALUES(is_admin_only)
      `, [randomUUID(), sc.key, sc.name, sc.icon, sc.route, sc.cat, sc.order, sc.adminOnly]);
    }
    console.log('✓ Seeded ' + screens.length + ' screens in screen_master');

    // 6. Seed Role Permissions
    // Admin has access to ALL screens
    for (const sc of screens) {
      await pool.query(`
        INSERT INTO role_screen_permissions (role_name, screen_key, can_view, entry_datetime)
        VALUES ('Admin', ?, 1, NOW())
        ON DUPLICATE KEY UPDATE can_view = 1
      `, [sc.key]);
    }

    // Manager
    const managerScreens = screens.filter(s => s.key !== 'screen_rights').map(s => s.key);
    for (const k of managerScreens) {
      await pool.query(`
        INSERT INTO role_screen_permissions (role_name, screen_key, can_view, entry_datetime)
        VALUES ('Manager', ?, 1, NOW())
        ON DUPLICATE KEY UPDATE can_view = 1
      `, [k]);
    }

    // Billing Staff
    const billingScreens = ['billing', 'customer_master', 'advance', 'stock_check', 'credit_received', 'profile'];
    for (const k of billingScreens) {
      await pool.query(`
        INSERT INTO role_screen_permissions (role_name, screen_key, can_view, entry_datetime)
        VALUES ('Billing Staff', ?, 1, NOW())
        ON DUPLICATE KEY UPDATE can_view = 1
      `, [k]);
    }

    // Store Keeper
    const storeScreens = ['stock_inward', 'stock_check', 'size_master', 'dealer_master', 'profile'];
    for (const k of storeScreens) {
      await pool.query(`
        INSERT INTO role_screen_permissions (role_name, screen_key, can_view, entry_datetime)
        VALUES ('Store Keeper', ?, 1, NOW())
        ON DUPLICATE KEY UPDATE can_view = 1
      `, [k]);
    }

    // Accountant
    const accountantScreens = ['billing', 'credit_received', 'credit_report', 'expense', 'expense_category', 'bank_master', 'transaction_master', 'amount_transaction', 'profile'];
    for (const k of accountantScreens) {
      await pool.query(`
        INSERT INTO role_screen_permissions (role_name, screen_key, can_view, entry_datetime)
        VALUES ('Accountant', ?, 1, NOW())
        ON DUPLICATE KEY UPDATE can_view = 1
      `, [k]);
    }
    console.log('✓ Seeded role permissions for Admin, Manager, Billing Staff, Store Keeper, Accountant');

    // Update all existing user_master rows to role_position = 'Admin'
    await pool.query("UPDATE user_master SET role_position = 'Admin' WHERE role_position IS NULL OR role_position = ''");
    console.log('✓ Updated existing users as Admin in user_master');

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
