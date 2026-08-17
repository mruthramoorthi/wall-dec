const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid } = require('../utils/audit.cjs');

const SCREEN_TABLE = 'screen_master';
const PERMISSION_TABLE = 'role_screen_permissions';

const DEFAULT_ROLES = ['Admin', 'Manager', 'Billing Staff', 'Store Keeper', 'Accountant'];

/**
 * Get all screens (for management UI)
 */
/**
 * Get all screens (for management UI)
 */
async function getAllScreens(includeHidden = true) {
  let where = 'delete_datetime IS NULL';
  if (!includeHidden) {
    where += " AND screen_key != 'global_screens'";
  }
  const [screens] = await pool.query(
    `SELECT id, uid, screen_key, screen_name, icon, route_path, category, display_order, is_active, is_admin_only, entry_datetime
     FROM ${SCREEN_TABLE}
     WHERE ${where}
     ORDER BY display_order ASC, id ASC`
  );
  return screens;
}

/**
 * Get active screens only (excluding super-user exclusive screens for normal active listings)
 */
async function getActiveScreens() {
  const [screens] = await pool.query(
    `SELECT id, uid, screen_key, screen_name, icon, route_path, category, display_order, is_admin_only
     FROM ${SCREEN_TABLE}
     WHERE is_active = 1 AND screen_key != 'global_screens' AND delete_datetime IS NULL
     ORDER BY display_order ASC, id ASC`
  );
  return screens;
}

/**
 * Toggle screen active state
 */
async function toggleScreenActive(screenKey, isActive) {
  await pool.query(
    `UPDATE ${SCREEN_TABLE}
     SET is_active = ?, update_datetime = NOW()
     WHERE screen_key = ? AND delete_datetime IS NULL`,
    [isActive ? 1 : 0, screenKey]
  );
  return { screen_key: screenKey, is_active: Boolean(isActive) };
}

/**
 * Get all available roles in the system (excluding hidden Super User role)
 */
async function getAvailableRoles() {
  const [roleMasterRows] = await pool.query(
    `SELECT role_name FROM role_master 
     WHERE delete_datetime IS NULL AND role_name != 'Super User'
     ORDER BY is_system DESC, role_name ASC`
  );

  const set = new Set([
    'Admin',
    ...roleMasterRows.map(r => r.role_name)
  ]);

  return Array.from(set).filter(Boolean);
}

/**
 * Get complete permissions matrix (Roles x Screens)
 */
async function getPermissionsMatrix() {
  const screens = await getAllScreens(false); // Exclude global_screens from standard matrix
  const roles = await getAvailableRoles();
  const [perms] = await pool.query(
    `SELECT role_name, screen_key, can_view FROM ${PERMISSION_TABLE}`
  );

  const permMap = {};
  for (const p of perms) {
    if (!permMap[p.role_name]) permMap[p.role_name] = {};
    permMap[p.role_name][p.screen_key] = Boolean(p.can_view);
  }

  // Ensure Admin always has true for all standard screens
  if (!permMap['Admin']) permMap['Admin'] = {};
  for (const s of screens) {
    permMap['Admin'][s.screen_key] = true;
  }

  return {
    screens,
    roles,
    matrix: permMap
  };
}

/**
 * Save updated permissions matrix
 */
async function savePermissionsMatrix(matrix) {
  // matrix: { [role_name]: { [screen_key]: true/false } }
  for (const [role, screenPerms] of Object.entries(matrix)) {
    if (!role || role === 'Super User') continue; // Never tamper with Super User
    for (const [screenKey, canView] of Object.entries(screenPerms)) {
      if (screenKey === 'global_screens') continue; // Never assign global_screens via role matrix
      const val = role === 'Admin' ? 1 : (canView ? 1 : 0);
      await pool.query(
        `INSERT INTO ${PERMISSION_TABLE} (role_name, screen_key, can_view, entry_datetime)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE can_view = VALUES(can_view), update_datetime = NOW()`,
        [role, screenKey, val]
      );
    }
  }
  return getPermissionsMatrix();
}

/**
 * Get permitted active screens for a specific user
 */
async function getUserAllowedScreens(userUid) {
  let role = 'Admin';
  if (userUid) {
    const [[user]] = await pool.query(
      `SELECT role_position FROM user_master WHERE uid = ? AND delete_datetime IS NULL`,
      [userUid]
    );
    if (user && user.role_position) {
      role = user.role_position;
    }
  }

  // 1. Super User has unrestricted access to ALL screens (including global_screens)
  if (role === 'Super User') {
    const [allScreens] = await pool.query(
      `SELECT id, uid, screen_key, screen_name, icon, route_path, category, display_order, is_admin_only
       FROM ${SCREEN_TABLE}
       WHERE delete_datetime IS NULL
       ORDER BY display_order ASC, id ASC`
    );
    return allScreens;
  }

  // 2. If Admin, return all active screens except global_screens
  if (role === 'Admin') {
    return getActiveScreens();
  }

  // 3. Otherwise, return screens that are BOTH globally active AND permitted for this role (excluding global_screens)
  const [screens] = await pool.query(
    `SELECT sm.id, sm.uid, sm.screen_key, sm.screen_name, sm.icon, sm.route_path, sm.category, sm.display_order, sm.is_admin_only
     FROM ${SCREEN_TABLE} sm
     JOIN ${PERMISSION_TABLE} rsp ON rsp.screen_key = sm.screen_key AND rsp.role_name = ? AND rsp.can_view = 1
     WHERE sm.is_active = 1 AND sm.screen_key != 'global_screens' AND sm.delete_datetime IS NULL
     ORDER BY sm.display_order ASC, sm.id ASC`,
    [role]
  );

  return screens;
}

module.exports = {
  getAllScreens,
  getActiveScreens,
  toggleScreenActive,
  getAvailableRoles,
  getPermissionsMatrix,
  savePermissionsMatrix,
  getUserAllowedScreens
};
