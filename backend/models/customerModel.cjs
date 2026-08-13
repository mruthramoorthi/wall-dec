const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid } = require('../utils/audit.cjs');

const TABLE = 'customer_master';

async function search(q) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT uid, customer_name, mobile_number FROM ${TABLE}
     WHERE ${ACTIVE_FILTER} AND (customer_name LIKE ? OR mobile_number LIKE ?)
     ORDER BY entry_datetime DESC LIMIT 20`,
    [like, like]
  );
  return rows;
}

async function findByUid(uid) {
  const [rows] = await pool.query(`SELECT uid, customer_name, mobile_number FROM ${TABLE} WHERE uid = ? AND ${ACTIVE_FILTER}`, [uid]);
  return rows[0] || null;
}

async function create({ customer_name, mobile_number }) {
  const uid = newUid();
  await pool.query(
    `INSERT INTO ${TABLE} (uid, customer_name, mobile_number, entry_datetime) VALUES (?, ?, ?, NOW())`,
    [uid, customer_name, mobile_number]
  );
  return findByUid(uid);
}

module.exports = { search, findByUid, create };
