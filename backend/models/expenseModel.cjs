const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');

const TABLE = 'expense_master';

async function list({ pageSize = 20, offset = 0, search = '', fromDate = '', toDate = '', category = '', paymentMode = '', bankUid = '' }) {
  const whereClauses = [`${activeFilter('e')}`];
  const params = [];

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(e.category LIKE ? OR e.narration LIKE ? OR e.ref_number LIKE ? OR e.payment_mode LIKE ? OR bm.bank_name LIKE ?)`);
    params.push(like, like, like, like, like);
  }

  if (fromDate && fromDate.trim()) {
    whereClauses.push(`e.expense_date >= ?`);
    params.push(fromDate.trim().slice(0, 10));
  }

  if (toDate && toDate.trim()) {
    whereClauses.push(`e.expense_date <= ?`);
    params.push(toDate.trim().slice(0, 10));
  }

  if (category && category.trim() && category !== 'all') {
    whereClauses.push(`e.category = ?`);
    params.push(category.trim());
  }

  if (paymentMode && paymentMode.trim() && paymentMode !== 'all') {
    whereClauses.push(`LOWER(e.payment_mode) = ?`);
    params.push(paymentMode.trim().toLowerCase());
  }

  if (bankUid && bankUid.trim()) {
    whereClauses.push(`e.bank_uid = ?`);
    params.push(bankUid.trim());
  }

  const whereSql = whereClauses.join(' AND ');

  const [rows] = await pool.query(
    `SELECT 
       e.uid,
       e.id AS expense_id,
       DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS expense_date,
       e.category,
       e.amount,
       e.payment_mode,
       e.bank_uid,
       bm.bank_name,
       bm.bank_code,
       e.ref_number,
       e.denominations,
       e.tendered_amount,
       e.change_returned,
       e.narration,
       e.entry_datetime
     FROM ${TABLE} e
     LEFT JOIN bank_master bm ON bm.uid = e.bank_uid AND ${activeFilter('bm')}
     WHERE ${whereSql}
     ORDER BY e.expense_date DESC, e.entry_datetime DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM ${TABLE} e
     LEFT JOIN bank_master bm ON bm.uid = e.bank_uid AND ${activeFilter('bm')}
     WHERE ${whereSql}`,
    params
  );

  const [[{ grandTotal }]] = await pool.query(
    `SELECT COALESCE(SUM(e.amount), 0) AS grandTotal
     FROM ${TABLE} e
     LEFT JOIN bank_master bm ON bm.uid = e.bank_uid AND ${activeFilter('bm')}
     WHERE ${whereSql}`,
    params
  );

  const [categories] = await pool.query(
    `SELECT DISTINCT category 
     FROM ${TABLE} 
     WHERE ${ACTIVE_FILTER} 
     ORDER BY category ASC`
  );

  return { 
    rows, 
    total: count, 
    grandTotal: Number(grandTotal || 0),
    categories: categories.map(c => c.category) 
  };
}

async function findByUid(uid) {
  const [[row]] = await pool.query(
    `SELECT 
       e.uid,
       e.id AS expense_id,
       DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS expense_date,
       e.category,
       e.amount,
       e.payment_mode,
       e.bank_uid,
       bm.bank_name,
       bm.bank_code,
       e.ref_number,
       e.denominations,
       e.tendered_amount,
       e.change_returned,
       e.narration,
       e.entry_datetime
     FROM ${TABLE} e
     LEFT JOIN bank_master bm ON bm.uid = e.bank_uid AND ${activeFilter('bm')}
     WHERE e.uid = ? AND ${activeFilter('e')}`,
    [uid]
  );
  return row || null;
}

async function create(data) {
  const uid = newUid();
  const expense_date = data.expense_date ? data.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const category = (data.category || 'General').trim();
  const amount = Number(data.amount || 0);
  const payment_mode = (data.payment_mode || 'cash').trim().toLowerCase();
  const bank_uid = data.bank_uid || null;
  const ref_number = data.ref_number ? data.ref_number.trim() : null;
  const denominations = data.denominations ? JSON.stringify(data.denominations) : null;
  const tendered_amount = data.tendered_amount != null ? Number(data.tendered_amount) : null;
  const change_returned = data.change_returned != null ? Number(data.change_returned) : null;
  const narration = data.narration ? data.narration.trim() : null;

  await pool.query(
    `INSERT INTO ${TABLE} 
     (uid, expense_date, category, amount, payment_mode, bank_uid, ref_number, denominations, tendered_amount, change_returned, narration, entry_datetime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uid, expense_date, category, amount, payment_mode, bank_uid, ref_number, denominations, tendered_amount, change_returned, narration]
  );

  return findByUid(uid);
}

async function edit(uid, data) {
  const existing = await findByUid(uid);
  if (!existing) return null;

  const expense_date = data.expense_date ? data.expense_date.slice(0, 10) : existing.expense_date;
  const category = (data.category || existing.category).trim();
  const amount = data.amount != null ? Number(data.amount) : existing.amount;
  const payment_mode = (data.payment_mode || existing.payment_mode).trim().toLowerCase();
  const bank_uid = data.bank_uid !== undefined ? (data.bank_uid || null) : existing.bank_uid;
  const ref_number = data.ref_number !== undefined ? (data.ref_number ? data.ref_number.trim() : null) : existing.ref_number;
  const denominations = data.denominations !== undefined ? (data.denominations ? JSON.stringify(data.denominations) : null) : (existing.denominations ? JSON.stringify(existing.denominations) : null);
  const tendered_amount = data.tendered_amount !== undefined ? (data.tendered_amount != null ? Number(data.tendered_amount) : null) : existing.tendered_amount;
  const change_returned = data.change_returned !== undefined ? (data.change_returned != null ? Number(data.change_returned) : null) : existing.change_returned;
  const narration = data.narration !== undefined ? (data.narration ? data.narration.trim() : null) : existing.narration;

  await withTransaction(pool, async (conn) => {
    await markSuperseded(conn, TABLE, uid);
    await conn.query(
      `INSERT INTO ${TABLE}
       (uid, expense_date, category, amount, payment_mode, bank_uid, ref_number, denominations, tendered_amount, change_returned, narration, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uid, expense_date, category, amount, payment_mode, bank_uid, ref_number, denominations, tendered_amount, change_returned, narration]
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
  create,
  edit,
  softDelete
};
