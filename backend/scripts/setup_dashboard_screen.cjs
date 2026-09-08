const pool = require('../config/db.cjs');
const { v4: uuidv4 } = require('uuid');

async function setupDashboardScreen() {
  try {
    const [existing] = await pool.query("SELECT * FROM screen_master WHERE screen_key = 'dashboard'");
    if (!existing.length) {
      await pool.query(
        "INSERT INTO screen_master (uid, screen_key, screen_name, icon, route_path, category, display_order, is_active, is_admin_only, entry_datetime) VALUES (?, 'dashboard', 'Dashboard', '🏠', '/dashboard', 'Main', 0, 1, 0, NOW())",
        [uuidv4()]
      );
      console.log('Inserted dashboard into screen_master');
    } else {
      await pool.query("UPDATE screen_master SET display_order = 0, is_active = 1, icon = '🏠', route_path = '/dashboard' WHERE screen_key = 'dashboard'");
      console.log('Updated dashboard in screen_master');
    }

    // Grant to all roles
    const [roles] = await pool.query('SELECT role_name FROM role_master WHERE delete_datetime IS NULL');
    const roleNames = ['Admin', 'Manager', 'Billing Staff', 'Store Keeper', 'Accountant', ...roles.map(r => r.role_name)];
    const uniqueRoles = [...new Set(roleNames)];
    for (const r of uniqueRoles) {
      await pool.query(
        "INSERT INTO role_screen_permissions (role_name, screen_key, can_view, entry_datetime) VALUES (?, 'dashboard', 1, NOW()) ON DUPLICATE KEY UPDATE can_view = 1",
        [r]
      );
    }
    console.log('Granted permissions to roles:', uniqueRoles.length);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

setupDashboardScreen();
