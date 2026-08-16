const pool = require('../config/db.cjs');
const { activeFilter } = require('../utils/audit.cjs');

const SORT_COLUMNS = {
  bill_number: 'b.id',
  bill_id: 'b.id',
  customer_name: 'c.customer_name',
  mobile_number: 'c.mobile_number',
  stock_codes: 'stock_codes',
  total_pieces: 'total_pieces',
  payment_modes: 'payment_modes',
  net_amount: 'b.net_amount',
  entry_datetime: 'b.entry_datetime',
};

async function amountTransaction({
  pageSize,
  offset,
  search = '',
  fromDate = '',
  toDate = '',
  customerUid = '',
  minAmount = '',
  maxAmount = '',
  paymentMode = '',
  sortColumn = 'b.entry_datetime',
  sortDir = 'DESC'
}) {
  const params = [];
  const whereClauses = [`${activeFilter('b')}`];

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(c.customer_name LIKE ? OR c.mobile_number LIKE ? OR CAST(sm.design_number AS CHAR) LIKE ? OR CONCAT('BILL-', LPAD(b.id, 4, '0')) LIKE ?)`);
    params.push(like, like, like, like);
  }

  if (fromDate && fromDate.trim()) {
    const cleanFrom = fromDate.trim().slice(0, 10);
    whereClauses.push(`b.entry_datetime >= ?`);
    params.push(`${cleanFrom} 00:00:00`);
  }

  if (toDate && toDate.trim()) {
    const cleanTo = toDate.trim().slice(0, 10);
    whereClauses.push(`b.entry_datetime <= ?`);
    params.push(`${cleanTo} 23:59:59`);
  }

  if (customerUid && customerUid.trim()) {
    whereClauses.push(`b.customer_uid = ?`);
    params.push(customerUid.trim());
  }

  if (minAmount !== '' && minAmount !== null && !isNaN(Number(minAmount))) {
    whereClauses.push(`b.net_amount >= ?`);
    params.push(Number(minAmount));
  }

  if (maxAmount !== '' && maxAmount !== null && !isNaN(Number(maxAmount))) {
    whereClauses.push(`b.net_amount <= ?`);
    params.push(Number(maxAmount));
  }

  if (paymentMode && paymentMode.trim()) {
    const pm = paymentMode.trim().toLowerCase();
    whereClauses.push(`EXISTS (
      SELECT 1 FROM bill_payments bp 
      WHERE bp.bill_uid = b.uid 
        AND LOWER(bp.payment_mode) = ? 
        AND ${activeFilter('bp')}
    )`);
    params.push(pm);
  }

  const joins = `
     FROM bill_master b
     JOIN customer_master c ON c.uid = b.customer_uid AND ${activeFilter('c')}
     JOIN bill_items bi ON bi.bill_uid = b.uid AND ${activeFilter('bi')}
     JOIN stock_master sm ON sm.uid = bi.stock_uid AND ${activeFilter('sm')}`;

  const where = `WHERE ${whereClauses.join(' AND ')}`;

  const [rows] = await pool.query(
    `SELECT
       b.id AS bill_id,
       CONCAT('BILL-', LPAD(b.id, 4, '0')) AS bill_number,
       b.uid AS bill_uid, c.customer_name, c.mobile_number,
       GROUP_CONCAT(DISTINCT sm.design_number ORDER BY sm.design_number SEPARATOR ', ') AS stock_codes,
       SUM(bi.pieces) AS total_pieces,
       COALESCE((
         SELECT GROUP_CONCAT(DISTINCT UPPER(bp2.payment_mode) SEPARATOR ', ')
         FROM bill_payments bp2
         WHERE bp2.bill_uid = b.uid AND ${activeFilter('bp2')}
       ), 'CASH') AS payment_modes,
       b.net_amount, b.entry_datetime
     ${joins}
     ${where}
     GROUP BY b.uid, b.id, b.net_amount, b.entry_datetime, c.customer_name, c.mobile_number
     ORDER BY ${sortColumn} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), Number(offset)]
  );

  const [[totals]] = await pool.query(
    `SELECT COALESCE(SUM(t.pieces), 0) AS total_pieces, COALESCE(SUM(t.net_amount), 0) AS total_amount
     FROM (
       SELECT b.uid, b.net_amount, COALESCE(SUM(bi2.pieces), 0) AS pieces
       ${joins}
       LEFT JOIN bill_items bi2 ON bi2.bill_uid = b.uid AND ${activeFilter('bi2')}
       ${where}
       GROUP BY b.uid, b.net_amount
     ) t`,
    params
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(DISTINCT b.uid) AS count ${joins} ${where}`,
    params
  );

  return { rows, totals, total: count };
}

module.exports = { amountTransaction, SORT_COLUMNS };
