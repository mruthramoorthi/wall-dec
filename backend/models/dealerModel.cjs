const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'dealer_master';
const COLS = 'uid, dealer_name, dealer_code, mobile_number, gstin, city, state, entry_datetime';

const SORT_COLUMNS = {
  dealer_name: 'dealer_name',
  dealer_code: 'dealer_code',
  mobile_number: 'mobile_number',
  city: 'city',
  state: 'state',
  entry_datetime: 'entry_datetime',
};

async function list({ pageSize, offset, search = '', sortColumn = 'entry_datetime', sortDir = 'DESC' }) {
  const params = [];
  let where = `WHERE ${ACTIVE_FILTER}`;
  if (search) {
    where += ` AND (dealer_name LIKE ? OR dealer_code LIKE ? OR mobile_number LIKE ? OR gstin LIKE ? OR city LIKE ? OR state LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }
  const [rows] = await pool.query(
    `SELECT ${COLS} FROM ${TABLE} ${where} ORDER BY ${sortColumn} ${sortDir} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count FROM ${TABLE} ${where}`, params);
  return { rows, total: count };
}

async function findByUid(uid) {
  const [rows] = await pool.query(`SELECT ${COLS} FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`, [uid]);
  return rows[0] || null;
}

// Returns which of dealer_name/dealer_code/mobile_number/gstin are already
// in use by a DIFFERENT active record (excludeUid lets edit exclude itself).
async function findConflicts({ dealer_name, dealer_code, mobile_number, gstin }, excludeUid = null) {
  const conflicts = {};
  const checks = [
    ['dealer_name', dealer_name],
    ['dealer_code', dealer_code],
    ['mobile_number', mobile_number],
    ...(gstin ? [['gstin', gstin]] : []),
  ];
  for (const [field, value] of checks) {
    const params = excludeUid ? [value, excludeUid] : [value];
    const excludeClause = excludeUid ? 'AND uid != ?' : '';
    const [rows] = await pool.query(
      `SELECT uid FROM ${TABLE} WHERE ${field} = ? AND ${ACTIVE_FILTER} ${excludeClause} LIMIT 1`,
      params
    );
    if (rows.length) conflicts[field] = true;
  }
  return conflicts;
}

async function create(data) {
  const uid = newUid();
  await pool.query(
    `INSERT INTO ${TABLE} (uid, dealer_name, dealer_code, mobile_number, gstin, city, state, entry_datetime)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uid, data.dealer_name, data.dealer_code, data.mobile_number, data.gstin || null, data.city, data.state]
  );
  return findByUid(uid);
}

async function edit(uid, data) {
  await withTransaction(pool, async (conn) => {
    await markSuperseded(conn, TABLE, uid);
    await conn.query(
      `INSERT INTO ${TABLE} (uid, dealer_name, dealer_code, mobile_number, gstin, city, state, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uid, data.dealer_name, data.dealer_code, data.mobile_number, data.gstin || null, data.city, data.state]
    );
  });
  return findByUid(uid);
}

async function softDelete(uid) {
  return markDeleted(pool, TABLE, uid);
}

module.exports = { list, findByUid, findConflicts, create, edit, softDelete, SORT_COLUMNS };
