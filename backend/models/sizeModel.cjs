const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'size_master';

async function list({ pageSize, offset }) {
  const [rows] = await pool.query(
    `SELECT uid, width_ft, height_ft, thickness_mm, entry_datetime
     FROM ${TABLE} WHERE ${ACTIVE_FILTER}
     ORDER BY entry_datetime DESC LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );
  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count FROM ${TABLE} WHERE ${ACTIVE_FILTER}`);
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

module.exports = { list, findByUid, create, edit, softDelete };
