const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'customer_master';

async function list({ pageSize, offset, search = '' }) {
  let whereClauses = [`${ACTIVE_FILTER}`];
  let params = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    whereClauses.push(`(customer_name LIKE ? OR mobile_number LIKE ? OR email LIKE ? OR city LIKE ? OR state LIKE ? OR area LIKE ? OR pincode LIKE ?)`);
    params.push(term, term, term, term, term, term, term);
  }

  const whereSql = whereClauses.join(' AND ');

  const [rows] = await pool.query(
    `SELECT uid, customer_name, mobile_number, email, address, pincode, state, city, area, country, entry_datetime
     FROM ${TABLE}
     WHERE ${whereSql}
     ORDER BY entry_datetime DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM ${TABLE} WHERE ${whereSql}`,
    params
  );

  return { rows, total: count };
}

async function search(q) {
  const like = `%${q}%`;
  const [rows] = await pool.query(
    `SELECT uid, customer_name, mobile_number, email, address, pincode, state, city, area, country
     FROM ${TABLE}
     WHERE ${ACTIVE_FILTER} AND (customer_name LIKE ? OR mobile_number LIKE ?)
     ORDER BY entry_datetime DESC LIMIT 20`,
    [like, like]
  );
  return rows;
}

async function findByUid(uid) {
  const [rows] = await pool.query(
    `SELECT uid, customer_name, mobile_number, email, address, pincode, state, city, area, country, entry_datetime
     FROM ${TABLE}
     WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return rows[0] || null;
}

async function findByMobile(mobile_number) {
  const [rows] = await pool.query(
    `SELECT uid, customer_name, mobile_number, email, address, pincode, state, city, area, country
     FROM ${TABLE}
     WHERE mobile_number = ? AND ${ACTIVE_FILTER}
     LIMIT 1`,
    [mobile_number]
  );
  return rows[0] || null;
}

async function create({ customer_name, mobile_number, email = null, address = null, pincode = null, state = null, city = null, area = null, country = 'India' }) {
  const uid = newUid();
  await pool.query(
    `INSERT INTO ${TABLE} (uid, customer_name, mobile_number, email, address, pincode, state, city, area, country, entry_datetime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uid,
      customer_name.trim(),
      mobile_number.trim(),
      email ? email.trim() : null,
      address ? address.trim() : null,
      pincode ? pincode.trim() : null,
      state ? state.trim() : null,
      city ? city.trim() : null,
      area ? area.trim() : null,
      country ? country.trim() : 'India'
    ]
  );
  return findByUid(uid);
}

async function edit(uid, data) {
  await withTransaction(pool, async (conn) => {
    await markSuperseded(conn, TABLE, uid);
    await conn.query(
      `INSERT INTO ${TABLE} (uid, customer_name, mobile_number, email, address, pincode, state, city, area, country, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uid,
        data.customer_name.trim(),
        data.mobile_number.trim(),
        data.email ? data.email.trim() : null,
        data.address ? data.address.trim() : null,
        data.pincode ? data.pincode.trim() : null,
        data.state ? data.state.trim() : null,
        data.city ? data.city.trim() : null,
        data.area ? data.area.trim() : null,
        data.country ? data.country.trim() : 'India'
      ]
    );
  });
  return findByUid(uid);
}

async function softDelete(uid) {
  return markDeleted(pool, TABLE, uid);
}

module.exports = { list, search, findByUid, findByMobile, create, edit, softDelete };
