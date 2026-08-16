const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'expense_category_master';

async function list({ pageSize = 20, offset = 0, search = '', all = false }) {
  const whereClauses = [`${ACTIVE_FILTER}`];
  const params = [];

  if (search && search.trim()) {
    whereClauses.push(`category_name LIKE ?`);
    params.push(`%${search.trim()}%`);
  }

  const whereSql = whereClauses.join(' AND ');

  if (all) {
    const [rows] = await pool.query(
      `SELECT uid, id, category_name, entry_datetime
       FROM ${TABLE}
       WHERE ${whereSql}
       ORDER BY category_name ASC`,
      params
    );
    return { rows, total: rows.length };
  }

  const [rows] = await pool.query(
    `SELECT uid, id, category_name, entry_datetime
     FROM ${TABLE}
     WHERE ${whereSql}
     ORDER BY category_name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM ${TABLE}
     WHERE ${whereSql}`,
    params
  );

  return { rows, total: count };
}

async function findByUid(uid) {
  const [[row]] = await pool.query(
    `SELECT uid, id, category_name, entry_datetime
     FROM ${TABLE}
     WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return row || null;
}

async function findByName(name, excludeUid = null) {
  const params = [name.trim().toLowerCase()];
  let sql = `SELECT uid, id, category_name FROM ${TABLE} WHERE LOWER(category_name) = ? AND ${ACTIVE_FILTER}`;
  if (excludeUid) {
    sql += ` AND uid != ?`;
    params.push(excludeUid);
  }
  const [[row]] = await pool.query(sql, params);
  return row || null;
}

async function create(data) {
  const uid = newUid();
  const category_name = (data.category_name || '').trim();

  await pool.query(
    `INSERT INTO ${TABLE} (uid, category_name, entry_datetime)
     VALUES (?, ?, NOW())`,
    [uid, category_name]
  );

  return findByUid(uid);
}

async function edit(uid, data) {
  const existing = await findByUid(uid);
  if (!existing) return null;

  const category_name = (data.category_name || existing.category_name).trim();

  await withTransaction(pool, async (conn) => {
    await markSuperseded(conn, TABLE, uid);
    await conn.query(
      `INSERT INTO ${TABLE} (uid, category_name, entry_datetime)
       VALUES (?, ?, NOW())`,
      [uid, category_name]
    );
  });

  return findByUid(uid);
}

async function softDelete(uid) {
  const existing = await findByUid(uid);
  if (!existing) return false;

  await withTransaction(pool, async (conn) => {
    await markDeleted(conn, TABLE, uid);
  });
  return true;
}

module.exports = {
  list,
  findByUid,
  findByName,
  create,
  edit,
  softDelete
};
