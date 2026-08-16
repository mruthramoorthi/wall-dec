const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'payment_mode_master';

async function list({ pageSize = 20, offset = 0, search = '', sortBy = 'mode_name', sortDir = 'ASC', activeOnly = false } = {}) {
  const allowedSort = {
    mode_name: 'pm.mode_name',
    mode_code: 'pm.mode_code',
    is_bank_linked: 'pm.is_bank_linked',
    is_cash: 'pm.is_cash',
    is_active: 'pm.is_active',
    entry_datetime: 'pm.entry_datetime'
  };
  const sortCol = allowedSort[sortBy] || 'pm.mode_name';
  const orderDir = String(sortDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  let whereClauses = [`${activeFilter('pm')}`];
  let params = [];

  if (activeOnly) {
    whereClauses.push(`pm.is_active = 1`);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    whereClauses.push(`(pm.mode_name LIKE ? OR pm.mode_code LIKE ?)`);
    params.push(term, term);
  }

  const whereSql = whereClauses.join(' AND ');

  const [rows] = await pool.query(
    `SELECT pm.uid, pm.mode_name, pm.mode_code, pm.is_bank_linked, pm.is_cash, pm.is_active, pm.entry_datetime
     FROM ${TABLE} pm
     WHERE ${whereSql}
     ORDER BY ${sortCol} ${orderDir}
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM ${TABLE} pm WHERE ${whereSql}`,
    params
  );

  return { rows, total: count };
}

async function listAllActive() {
  const [rows] = await pool.query(
    `SELECT uid, mode_name, mode_code, is_bank_linked, is_cash, is_active
     FROM ${TABLE}
     WHERE is_active = 1 AND ${ACTIVE_FILTER}
     ORDER BY
       CASE WHEN is_cash = 1 THEN 1 ELSE 2 END,
       mode_name ASC`
  );
  return rows;
}

async function findByUid(uid) {
  const [rows] = await pool.query(
    `SELECT uid, mode_name, mode_code, is_bank_linked, is_cash, is_active, entry_datetime
     FROM ${TABLE}
     WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return rows[0] || null;
}

async function create(data) {
  const mode_name = (data.mode_name || '').trim();
  const rawCode = (data.mode_code || mode_name).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const mode_code = rawCode;
  const is_bank_linked = data.is_bank_linked ? 1 : 0;
  const is_cash = data.is_cash ? 1 : 0;
  const is_active = data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1;

  if (!mode_name) {
    throw Object.assign(new Error('Payment mode name is required.'), { status: 400 });
  }

  const [[dup]] = await pool.query(
    `SELECT uid FROM ${TABLE} WHERE (LOWER(mode_name) = ? OR mode_code = ?) AND ${ACTIVE_FILTER}`,
    [mode_name.toLowerCase(), mode_code]
  );
  if (dup) {
    throw Object.assign(new Error('A payment mode with this name or code already exists.'), { status: 409 });
  }

  const uid = newUid();
  await pool.query(
    `INSERT INTO ${TABLE} (uid, mode_name, mode_code, is_bank_linked, is_cash, is_active, entry_datetime)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [uid, mode_name, mode_code, is_bank_linked, is_cash, is_active]
  );

  return findByUid(uid);
}

async function edit(uid, data) {
  const existing = await findByUid(uid);
  if (!existing) {
    throw Object.assign(new Error('Payment mode not found.'), { status: 404 });
  }

  const mode_name = (data.mode_name ?? existing.mode_name).trim();
  const rawCode = (data.mode_code ?? existing.mode_code).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const mode_code = rawCode;
  const is_bank_linked = data.is_bank_linked !== undefined ? (data.is_bank_linked ? 1 : 0) : existing.is_bank_linked;
  const is_cash = data.is_cash !== undefined ? (data.is_cash ? 1 : 0) : existing.is_cash;
  const is_active = data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active;

  if (!mode_name) {
    throw Object.assign(new Error('Payment mode name is required.'), { status: 400 });
  }

  const [[dup]] = await pool.query(
    `SELECT uid FROM ${TABLE} WHERE (LOWER(mode_name) = ? OR mode_code = ?) AND uid != ? AND ${ACTIVE_FILTER}`,
    [mode_name.toLowerCase(), mode_code, uid]
  );
  if (dup) {
    throw Object.assign(new Error('Another payment mode with this name or code already exists.'), { status: 409 });
  }

  await withTransaction(pool, async (conn) => {
    await markSuperseded(conn, TABLE, uid);
    await conn.query(
      `INSERT INTO ${TABLE} (uid, mode_name, mode_code, is_bank_linked, is_cash, is_active, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [uid, mode_name, mode_code, is_bank_linked, is_cash, is_active]
    );
  });

  return findByUid(uid);
}

async function remove(uid) {
  const existing = await findByUid(uid);
  if (!existing) {
    throw Object.assign(new Error('Payment mode not found.'), { status: 404 });
  }
  return markDeleted(pool, TABLE, uid);
}

module.exports = { list, listAllActive, findByUid, create, edit, remove };
