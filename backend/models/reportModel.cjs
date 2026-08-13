const pool = require('../config/db.cjs');
const { ACTIVE_FILTER } = require('../utils/audit.cjs');

// Screen 5 - Amount Transaction: one row per bill with concatenated stock
// codes/pieces, plus grand totals for the footer.
async function amountTransaction({ pageSize, offset }) {
  const [rows] = await pool.query(
    `SELECT
       b.uid AS bill_uid, c.customer_name, c.mobile_number,
       GROUP_CONCAT(DISTINCT sm.design_number ORDER BY sm.design_number SEPARATOR ', ') AS stock_codes,
       SUM(bi.pieces) AS total_pieces,
       b.net_amount, b.entry_datetime
     FROM bill_master b
     JOIN customer_master c ON c.uid = b.customer_uid AND c.${ACTIVE_FILTER}
     JOIN bill_items bi ON bi.bill_uid = b.uid AND bi.${ACTIVE_FILTER}
     JOIN stock_master sm ON sm.uid = bi.stock_uid AND sm.${ACTIVE_FILTER}
     WHERE b.${ACTIVE_FILTER}
     GROUP BY b.uid
     ORDER BY b.entry_datetime DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset]
  );

  const [[totals]] = await pool.query(
    `SELECT COALESCE(SUM(bi.pieces), 0) AS total_pieces, COALESCE(SUM(b.net_amount_per_bill), 0) AS total_amount
     FROM (
       SELECT DISTINCT b.uid, b.net_amount AS net_amount_per_bill
       FROM bill_master b WHERE b.${ACTIVE_FILTER}
     ) b
     LEFT JOIN bill_items bi ON bi.bill_uid = b.uid AND bi.${ACTIVE_FILTER}`
  );

  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count FROM bill_master WHERE ${ACTIVE_FILTER}`);

  return { rows, totals, total: count };
}

module.exports = { amountTransaction };
