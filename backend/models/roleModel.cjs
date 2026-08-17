const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'role_master';

async function list({ search = '', activeOnly = false, pageSize = 50, offset = 0 } = {}) {
  const whereClauses = [`${activeFilter('r')}`, "r.role_name != 'Super User'"];
  const params = [];

  if (activeOnly) {
    whereClauses.push('r.is_active = 1');
  }

  if (search && search.trim()) {
    whereClauses.push('(r.role_name LIKE ? OR r.description LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term);
  }

  const where = whereClauses.join(' AND ');

  const [rows] = await pool.query(
    `SELECT 
       r.id,
       r.uid,
       r.role_name,
       r.description,
       r.is_active,
       r.is_system,
       r.entry_datetime,
       COUNT(e.id) AS employee_count
     FROM ${TABLE} r
     LEFT JOIN employee_master e ON e.role_designation = r.role_name AND ${activeFilter('e')}
     WHERE ${where}
     GROUP BY r.id, r.uid, r.role_name, r.description, r.is_active, r.is_system, r.entry_datetime
     ORDER BY r.is_system DESC, r.role_name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM ${TABLE} r WHERE ${where}`,
    params
  );

  return { rows, total: count };
}

async function findByUid(uid) {
  const [[row]] = await pool.query(
    `SELECT id, uid, role_name, description, is_active, is_system, entry_datetime
     FROM ${TABLE}
     WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return row || null;
}

async function findByName(roleName, excludeUid = null) {
  let query = `SELECT id, uid, role_name FROM ${TABLE} WHERE LOWER(role_name) = ? AND ${ACTIVE_FILTER}`;
  const params = [roleName.trim().toLowerCase()];
  if (excludeUid) {
    query += ' AND uid != ?';
    params.push(excludeUid);
  }
  const [[row]] = await pool.query(query, params);
  return row || null;
}

async function create({ role_name, description = '' }) {
  if (!role_name || !role_name.trim()) {
    throw Object.assign(new Error('Role name is required.'), { status: 400 });
  }

  const cleanName = role_name.trim();
  const existing = await findByName(cleanName);
  if (existing) {
    throw Object.assign(new Error(`Role "${cleanName}" already exists.`), { status: 400 });
  }

  const uid = newUid();
  await pool.query(
    `INSERT INTO ${TABLE} (uid, role_name, description, is_active, is_system, entry_datetime)
     VALUES (?, ?, ?, 1, 0, NOW())`,
    [uid, cleanName, description ? description.trim() : null]
  );

  return findByUid(uid);
}

async function update(uid, { role_name, description, is_active }) {
  const existing = await findByUid(uid);
  if (!existing) {
    throw Object.assign(new Error('Role not found.'), { status: 404 });
  }

  const cleanName = role_name ? role_name.trim() : existing.role_name;

  if (existing.is_system && cleanName !== existing.role_name) {
    throw Object.assign(new Error('System default role names cannot be renamed.'), { status: 400 });
  }

  const duplicate = await findByName(cleanName, uid);
  if (duplicate) {
    throw Object.assign(new Error(`Role "${cleanName}" already exists.`), { status: 400 });
  }

  await withTransaction(pool, async (conn) => {
    // If name changed, update permissions and employee references
    if (cleanName !== existing.role_name) {
      await conn.query(
        `UPDATE role_screen_permissions SET role_name = ? WHERE role_name = ?`,
        [cleanName, existing.role_name]
      );
      await conn.query(
        `UPDATE employee_master SET role_designation = ? WHERE role_designation = ? AND ${activeFilter()}`,
        [cleanName, existing.role_name]
      );
    }

    await conn.query(
      `UPDATE ${TABLE}
       SET role_name = ?, description = ?, is_active = ?, update_datetime = NOW()
       WHERE uid = ?`,
      [
        cleanName,
        description !== undefined ? (description ? description.trim() : null) : existing.description,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        uid
      ]
    );
  });

  return findByUid(uid);
}

async function remove(uid) {
  const existing = await findByUid(uid);
  if (!existing) {
    throw Object.assign(new Error('Role not found.'), { status: 404 });
  }

  if (existing.is_system) {
    throw Object.assign(new Error(`System role "${existing.role_name}" cannot be deleted.`), { status: 400 });
  }

  // Check if any active employee is assigned to this role
  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM employee_master WHERE role_designation = ? AND ${ACTIVE_FILTER}`,
    [existing.role_name]
  );

  if (count > 0) {
    throw Object.assign(
      new Error(`Cannot delete role "${existing.role_name}" because ${count} employee(s) are currently assigned to it. Please reassign them first.`),
      { status: 400 }
    );
  }

  await withTransaction(pool, async (conn) => {
    await markDeleted(conn, TABLE, uid);
    await conn.query(`DELETE FROM role_screen_permissions WHERE role_name = ?`, [existing.role_name]);
  });

  return { success: true, message: `Role "${existing.role_name}" deleted successfully.` };
}

module.exports = {
  list,
  findByUid,
  findByName,
  create,
  update,
  remove
};
