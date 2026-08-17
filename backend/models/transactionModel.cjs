const pool = require('../config/db.cjs');
const { activeFilter, newUid } = require('../utils/audit.cjs');

const TABLE = 'account_transactions';

/**
 * Record or update a transaction in the central account_transactions table.
 * Supports passing an active transaction connection or defaulting to pool.
 */
async function syncTransaction(connOrPool, data) {
  const db = connOrPool || pool;
  const uid = data.uid || newUid();
  const transaction_type = data.transaction_type; // 'BILLING', 'ADVANCE', 'CREDIT_RECEIVED', 'EXPENSE', 'MANUAL'
  const source_table = data.source_table;
  const source_uid = data.source_uid || uid;
  const reference_number = data.reference_number || null;
  const party_name = data.party_name || null;
  const party_uid = data.party_uid || null;

  // Expenses are strictly stored as NEGATIVE amounts
  let amount = Number(data.amount || 0);
  if (transaction_type === 'EXPENSE') {
    amount = -Math.abs(amount);
  } else {
    amount = Math.abs(amount);
  }

  const payment_mode = (data.payment_mode || 'cash').trim().toLowerCase();
  const bank_uid = data.bank_uid || null;
  const bank_name = data.bank_name || null;
  const ref_number = data.ref_number ? data.ref_number.trim() : null;
  const transaction_date = data.transaction_date ? String(data.transaction_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const denominations = data.denominations ? (typeof data.denominations === 'string' ? data.denominations : JSON.stringify(data.denominations)) : null;
  const tendered_amount = data.tendered_amount != null && data.tendered_amount !== '' ? Number(data.tendered_amount) : null;
  const change_returned = data.change_returned != null && data.change_returned !== '' ? Number(data.change_returned) : null;
  const narration = data.narration ? data.narration.trim() : null;

  await db.query(
    `INSERT INTO ${TABLE}
      (uid, transaction_type, source_table, source_uid, reference_number, party_name, party_uid,
       amount, payment_mode, bank_uid, bank_name, ref_number, transaction_date,
       denominations, tendered_amount, change_returned, narration, entry_datetime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       transaction_type = VALUES(transaction_type),
       reference_number = VALUES(reference_number),
       party_name = VALUES(party_name),
       party_uid = VALUES(party_uid),
       amount = VALUES(amount),
       payment_mode = VALUES(payment_mode),
       bank_uid = VALUES(bank_uid),
       bank_name = VALUES(bank_name),
       ref_number = VALUES(ref_number),
       transaction_date = VALUES(transaction_date),
       denominations = VALUES(denominations),
       tendered_amount = VALUES(tendered_amount),
       change_returned = VALUES(change_returned),
       narration = VALUES(narration),
       update_datetime = NOW(),
       delete_datetime = NULL`,
    [
      uid, transaction_type, source_table, source_uid, reference_number, party_name, party_uid,
      amount, payment_mode, bank_uid, bank_name, ref_number, transaction_date,
      denominations, tendered_amount, change_returned, narration
    ]
  );

  return uid;
}

/**
 * Mark transaction as deleted in account_transactions
 */
async function deleteTransaction(connOrPool, sourceTable, sourceUid) {
  const db = connOrPool || pool;
  await db.query(
    `UPDATE ${TABLE}
     SET delete_datetime = NOW()
     WHERE source_table = ? AND source_uid = ? AND delete_datetime IS NULL`,
    [sourceTable, sourceUid]
  );
}

/**
 * List unified transactions with filters, pagination, and totals
 */
async function listTransactions({
  pageSize = 20,
  offset = 0,
  search = '',
  fromDate = '',
  toDate = '',
  transactionType = '',
  paymentMode = '',
  bankUid = '',
  customerUid = '',
  minAmount = '',
  maxAmount = '',
  sortColumn = 't.entry_datetime',
  sortDir = 'DESC'
}) {
  const whereClauses = [`${activeFilter('t')}`];
  const params = [];

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(t.reference_number LIKE ? OR t.party_name LIKE ? OR t.narration LIKE ? OR t.ref_number LIKE ? OR bm.bank_name LIKE ?)`);
    params.push(like, like, like, like, like);
  }

  if (fromDate && fromDate.trim()) {
    const cleanFrom = fromDate.trim().slice(0, 10);
    whereClauses.push(`t.transaction_date >= ?`);
    params.push(cleanFrom);
  }

  if (toDate && toDate.trim()) {
    const cleanTo = toDate.trim().slice(0, 10);
    whereClauses.push(`t.transaction_date <= ?`);
    params.push(cleanTo);
  }

  if (transactionType && transactionType.trim() && transactionType !== 'ALL') {
    whereClauses.push(`t.transaction_type = ?`);
    params.push(transactionType.trim().toUpperCase());
  }

  if (paymentMode && paymentMode.trim() && paymentMode !== 'ALL') {
    whereClauses.push(`LOWER(t.payment_mode) = ?`);
    params.push(paymentMode.trim().toLowerCase());
  }

  if (bankUid && bankUid.trim()) {
    whereClauses.push(`t.bank_uid = ?`);
    params.push(bankUid.trim());
  }

  if (customerUid && customerUid.trim()) {
    whereClauses.push(`t.party_uid = ?`);
    params.push(customerUid.trim());
  }

  if (minAmount !== '' && minAmount !== null && !isNaN(Number(minAmount))) {
    whereClauses.push(`ABS(t.amount) >= ?`);
    params.push(Number(minAmount));
  }

  if (maxAmount !== '' && maxAmount !== null && !isNaN(Number(maxAmount))) {
    whereClauses.push(`ABS(t.amount) <= ?`);
    params.push(Number(maxAmount));
  }

  const whereSql = whereClauses.join(' AND ');

  // Safe sort column mapping
  const SORT_MAP = {
    'date': 't.transaction_date',
    'transaction_date': 't.transaction_date',
    'entry_datetime': 't.entry_datetime',
    'type': 't.transaction_type',
    'transaction_type': 't.transaction_type',
    'ref': 't.reference_number',
    'reference_number': 't.reference_number',
    'party_name': 't.party_name',
    'amount': 't.amount',
    'payment_mode': 't.payment_mode'
  };

  const safeSortCol = SORT_MAP[sortColumn] || 't.entry_datetime';
  const safeSortDir = sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const [rows] = await pool.query(
    `SELECT 
       t.id,
       t.uid,
       t.transaction_type,
       t.source_table,
       t.source_uid,
       t.reference_number,
       t.party_name,
       t.party_uid,
       t.amount,
       t.payment_mode,
       t.bank_uid,
       COALESCE(bm.bank_name, t.bank_name) AS bank_name,
       bm.bank_code,
       t.ref_number,
       DATE_FORMAT(t.transaction_date, '%Y-%m-%d') AS transaction_date,
       t.denominations,
       t.tendered_amount,
       t.change_returned,
       t.narration,
       t.entry_datetime
     FROM ${TABLE} t
     LEFT JOIN bank_master bm ON bm.uid = t.bank_uid AND ${activeFilter('bm')}
     WHERE ${whereSql}
     ORDER BY ${safeSortCol} ${safeSortDir}, t.id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM ${TABLE} t
     LEFT JOIN bank_master bm ON bm.uid = t.bank_uid AND ${activeFilter('bm')}
     WHERE ${whereSql}`,
    params
  );

  const [[totals]] = await pool.query(
    `SELECT 
       COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS total_income,
       COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS total_expenses,
       COALESCE(SUM(t.amount), 0) AS net_balance,
       COALESCE(SUM(CASE WHEN LOWER(t.payment_mode) = 'cash' THEN t.amount ELSE 0 END), 0) AS cash_balance,
       COALESCE(SUM(CASE WHEN LOWER(t.payment_mode) != 'cash' THEN t.amount ELSE 0 END), 0) AS bank_balance
     FROM ${TABLE} t
     LEFT JOIN bank_master bm ON bm.uid = t.bank_uid AND ${activeFilter('bm')}
     WHERE ${whereSql}`,
    params
  );

  return {
    rows,
    total: Number(count || 0),
    totals: {
      total_income: Number(totals?.total_income || 0),
      total_expenses: Number(totals?.total_expenses || 0),
      net_balance: Number(totals?.net_balance || 0),
      cash_balance: Number(totals?.cash_balance || 0),
      bank_balance: Number(totals?.bank_balance || 0)
    }
  };
}

module.exports = {
  syncTransaction,
  deleteTransaction,
  listTransactions
};
