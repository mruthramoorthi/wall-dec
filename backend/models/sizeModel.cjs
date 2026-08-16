const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'size_master';

// Allow-list of columns the frontend is permitted to sort by (see
// utils/pagination.cjs#parseSort) — keys are what the client sends as
// ?sortBy=, values are the vetted SQL column to actually order by.
const SORT_COLUMNS = {
  width_ft: 'width_ft',
  height_ft: 'height_ft',
  thickness_mm: 'thickness_mm',
  entry_datetime: 'entry_datetime',
};

async function list({ pageSize, offset, search = '', sortColumn = 'entry_datetime', sortDir = 'DESC' }) {
  const params = [];
  let where = `WHERE ${ACTIVE_FILTER}`;
  if (search) {
    where += ' AND (CAST(width_ft AS CHAR) LIKE ? OR CAST(height_ft AS CHAR) LIKE ? OR CAST(thickness_mm AS CHAR) LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const [rows] = await pool.query(
    `SELECT uid, width_ft, height_ft, thickness_mm, entry_datetime
     FROM ${TABLE} ${where}
     ORDER BY ${sortColumn} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count FROM ${TABLE} ${where}`, params);
  return { rows, total: count };
}

async function findByUid(uid) {
  const [rows] = await pool.query(
    `SELECT uid, width_ft, height_ft, thickness_mm, entry_datetime FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return rows[0] || null;
}

async function create({ width_ft, height_ft, thickness_mm }) {
  const uid = newUid();
  await pool.query(
    `INSERT INTO ${TABLE} (uid, width_ft, height_ft, thickness_mm, entry_datetime) VALUES (?, ?, ?, ?, NOW())`,
    [uid, width_ft, height_ft, thickness_mm]
  );
  return findByUid(uid);
}

async function edit(uid, { width_ft, height_ft, thickness_mm }) {
  return withTransaction(pool, async (conn) => {
    await markSuperseded(conn, TABLE, uid);
    await conn.query(
      `INSERT INTO ${TABLE} (uid, width_ft, height_ft, thickness_mm, entry_datetime) VALUES (?, ?, ?, ?, NOW())`,
      [uid, width_ft, height_ft, thickness_mm]
    );
  }).then(() => findByUid(uid));
}

async function softDelete(uid) {
  return markDeleted(pool, TABLE, uid);
}

module.exports = { list, findByUid, create, edit, softDelete, SORT_COLUMNS };
