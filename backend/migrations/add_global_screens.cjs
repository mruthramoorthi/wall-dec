const pool = require('../config/db.cjs');
const { v4: uuidv4 } = require('uuid');

async function migrate() {
  try {
    const [[existing]] = await pool.query('SELECT * FROM screen_master WHERE screen_key = ?', ['global_screens']);
    if (!existing) {
      await pool.query(
        `INSERT INTO screen_master 
         (uid, screen_key, screen_name, icon, route_path, category, display_order, is_active, is_admin_only, entry_datetime)
         VALUES (?, 'global_screens', 'Global Active Screens', '🌐', '/global-screens', 'System', 99, 1, 1, NOW())`,
        [uuidv4()]
      );
      console.log('✓ Added global_screens to screen_master');
    } else {
      console.log('✓ global_screens already exists in screen_master');
    }

    const [superUsers] = await pool.query(`SELECT uid, username, email, role_position FROM user_master WHERE role_position = 'Super User'`);
    console.log('Super Users in user_master:', superUsers);

    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
