const pool = require('../config/db.cjs');
const { randomUUID } = require('crypto');

async function runMigration() {
  try {
    console.log('Starting Role Master Migration...');

    // 1. Create role_master table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(36) NOT NULL UNIQUE,
        role_name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255) NULL,
        is_active TINYINT(1) DEFAULT 1,
        is_system TINYINT(1) DEFAULT 0,
        entry_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        update_datetime DATETIME NULL,
        delete_datetime DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Created role_master table');

    // 2. Seed standard roles
    const defaultRoles = [
      { name: 'Admin', desc: 'Full administrative access to all ERP screens & settings', system: 1 },
      { name: 'Manager', desc: 'Management oversight across inventory, sales & finance', system: 0 },
      { name: 'Billing Staff', desc: 'POS billing, customer creation & credit collections', system: 0 },
      { name: 'Store Keeper', desc: 'Stock inward receipts, stock verification & size management', system: 0 },
      { name: 'Accountant', desc: 'Financial ledgers, expenses, payments & credit reports', system: 0 },
    ];

    for (const r of defaultRoles) {
      await pool.query(`
        INSERT INTO role_master (uid, role_name, description, is_active, is_system, entry_datetime)
        VALUES (?, ?, ?, 1, ?, NOW())
        ON DUPLICATE KEY UPDATE description = VALUES(description), is_system = VALUES(is_system)
      `, [randomUUID(), r.name, r.desc, r.system]);
    }
    console.log('✓ Seeded default roles in role_master');

    // 3. Register Role Master screen in screen_master
    await pool.query(`
      INSERT INTO screen_master (uid, screen_key, screen_name, icon, route_path, category, display_order, is_active, is_admin_only, entry_datetime)
      VALUES (?, 'role_master', 'Role Master', '🔑', '/role-master', 'Master', 2, 1, 1, NOW())
      ON DUPLICATE KEY UPDATE screen_name = VALUES(screen_name), icon = VALUES(icon), route_path = VALUES(route_path), category = VALUES(category), display_order = VALUES(display_order)
    `, [randomUUID()]);

    // Give Admin access to role_master
    await pool.query(`
      INSERT INTO role_screen_permissions (role_name, screen_key, can_view, entry_datetime)
      VALUES ('Admin', 'role_master', 1, NOW())
      ON DUPLICATE KEY UPDATE can_view = 1
    `);
    console.log('✓ Seeded Role Master in screen_master & permissions');

    console.log('Role master migration completed!');
    process.exit(0);
  } catch (err) {
    console.error('Role master migration error:', err);
    process.exit(1);
  }
}

runMigration();
