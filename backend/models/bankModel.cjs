const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'bank_master';

async function list({ pageSize = 20, offset = 0, search = '', sortBy = 'bank_name', sortDir = 'ASC' } = {}) {
  const allowedSort = {
    bank_name: 'b.bank_name',
    bank_code: 'b.bank_code',
    account_number: 'b.account_number',
    ifsc_code: 'b.ifsc_code',
    branch: 'b.branch',
    city: 'b.city',
    entry_datetime: 'b.entry_datetime'
  };
  const sortCol = allowedSort[sortBy] || 'b.bank_name';
  const orderDir = String(sortDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  let whereClauses = [`${activeFilter('b')}`];
  let params = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    whereClauses.push(`(b.bank_name LIKE ? OR b.bank_code LIKE ? OR b.account_number LIKE ? OR b.ifsc_code LIKE ? OR b.branch LIKE ? OR b.city LIKE ?)`);
    params.push(term, term, term, term, term, term);
  }

  const whereSql = whereClauses.join(' AND ');

  const [rows] = await pool.query(
    `SELECT b.uid, b.bank_name, b.bank_code, b.account_number, b.ifsc_code, b.branch, b.city, b.entry_datetime
     FROM ${TABLE} b
     WHERE ${whereSql}
     ORDER BY ${sortCol} ${orderDir}
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM ${TABLE} b WHERE ${whereSql}`,
    params
  );

  return { rows, total: count };
}

async function listAllActive() {
  const [rows] = await pool.query(
    `SELECT uid, bank_name, bank_code, account_number, ifsc_code, branch, city
     FROM ${TABLE}
     WHERE ${ACTIVE_FILTER}
     ORDER BY bank_name ASC`
  );
  return rows;
}

async function findByUid(uid) {
  const [rows] = await pool.query(
    `SELECT uid, bank_name, bank_code, account_number, ifsc_code, branch, city, entry_datetime
     FROM ${TABLE}
     WHERE uid = ? AND ${ACTIVE_FILTER}`,
    [uid]
  );
  return rows[0] || null;
}

async function create(data) {
  const bank_name = (data.bank_name || '').trim();
  const bank_code = (data.bank_code || '').trim().toUpperCase();
  const account_number = (data.account_number || '').trim();
  const ifsc_code = (data.ifsc_code || '').trim().toUpperCase();
  const branch = (data.branch || '').trim();
  const city = (data.city || '').trim();

  if (!bank_name || !bank_code || !account_number || !ifsc_code || !branch || !city) {
    throw Object.assign(new Error('Bank name, bank code, account number, IFSC code, branch, and city are all required.'), { status: 400 });
  }

  // Check unique active bank_code or account_number
  const [[dup]] = await pool.query(
    `SELECT uid FROM ${TABLE} WHERE (bank_code = ? OR account_number = ?) AND ${ACTIVE_FILTER}`,
    [bank_code, account_number]
  );
  if (dup) {
    throw Object.assign(new Error('A bank account with this Bank Code or Account Number already exists.'), { status: 409 });
  }

  const uid = newUid();
  await pool.query(
    `INSERT INTO ${TABLE} (uid, bank_name, bank_code, account_number, ifsc_code, branch, city, entry_datetime)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uid, bank_name, bank_code, account_number, ifsc_code, branch, city]
  );

  return findByUid(uid);
}

async function edit(uid, data) {
  const existing = await findByUid(uid);
  if (!existing) {
    throw Object.assign(new Error('Bank account not found.'), { status: 404 });
  }

  const bank_name = (data.bank_name ?? existing.bank_name).trim();
  const bank_code = (data.bank_code ?? existing.bank_code).trim().toUpperCase();
  const account_number = (data.account_number ?? existing.account_number).trim();
  const ifsc_code = (data.ifsc_code ?? existing.ifsc_code).trim().toUpperCase();
  const branch = (data.branch ?? existing.branch).trim();
  const city = (data.city ?? existing.city).trim();

  if (!bank_name || !bank_code || !account_number || !ifsc_code || !branch || !city) {
    throw Object.assign(new Error('Bank name, bank code, account number, IFSC code, branch, and city are all required.'), { status: 400 });
  }

  // Check unique active bank_code or account_number (excluding current)
  const [[dup]] = await pool.query(
    `SELECT uid FROM ${TABLE} WHERE (bank_code = ? OR account_number = ?) AND uid != ? AND ${ACTIVE_FILTER}`,
    [bank_code, account_number, uid]
  );
  if (dup) {
    throw Object.assign(new Error('Another bank account with this Bank Code or Account Number already exists.'), { status: 409 });
  }

  await withTransaction(pool, async (conn) => {
    await markSuperseded(conn, TABLE, uid);
    await conn.query(
      `INSERT INTO ${TABLE} (uid, bank_name, bank_code, account_number, ifsc_code, branch, city, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uid, bank_name, bank_code, account_number, ifsc_code, branch, city]
    );
  });

  return findByUid(uid);
}

async function remove(uid) {
  const existing = await findByUid(uid);
  if (!existing) {
    throw Object.assign(new Error('Bank account not found.'), { status: 404 });
  }
  return markDeleted(pool, TABLE, uid);
}

module.exports = { list, listAllActive, findByUid, create, edit, remove };
