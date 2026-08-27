const pool = require('../config/db.cjs');
const { newUid, withTransaction, markDeleted } = require('../utils/audit.cjs');
const accountingService = require('../services/accountingService.cjs');

const INWARD = 'stock_inward';
const PAYMENTS = 'dealer_payments';

/**
 * List all dealer credit purchases / stock inwards with due balances
 */
async function listDealerCreditPurchases({ page = 1, pageSize = 20, search = '', status = 'all', dealer_uid = null } = {}) {
  const params = [];
  let whereClauses = [`si.is_opening = 0`, `si.dealer_uid IS NOT NULL`, `si.delete_datetime IS NULL`];

  if (dealer_uid) {
    whereClauses.push(`si.dealer_uid = ?`);
    params.push(dealer_uid);
  }

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(d.dealer_name LIKE ? OR CONCAT('INW-', LPAD(si.id, 4, '0')) LIKE ? OR sm.design_number LIKE ? OR si.due_narration LIKE ?)`);
    params.push(like, like, like, like);
  }

  if (status === 'pending') {
    whereClauses.push(`si.due_amount > 0`);
  } else if (status === 'overdue') {
    whereClauses.push(`si.due_amount > 0 AND si.due_date < CURDATE()`);
  } else if (status === 'paid') {
    whereClauses.push(`si.due_amount <= 0`);
  }

  const whereSql = whereClauses.join(' AND ');
  const limit = Number(pageSize) || 20;
  const offset = ((Number(page) || 1) - 1) * limit;

  const sql = `
    SELECT
      si.id AS inward_id,
      CONCAT('INW-', LPAD(si.id, 4, '0')) AS inward_number,
      si.uid AS inward_uid,
      si.dealer_uid,
      COALESCE(d.dealer_name, 'Supplier Dealer') AS dealer_name,
      d.mobile_number AS dealer_mobile,
      si.pieces,
      si.avg_total_rate AS total_purchase_amount,
      si.paid_amount,
      si.due_amount,
      si.due_date,
      si.due_narration,
      si.credit_status,
      si.payment_mode,
      si.entry_datetime AS inward_datetime,
      sm.design_number,
      CASE
        WHEN si.due_amount > 0 AND si.due_date < CURDATE() THEN DATEDIFF(CURDATE(), si.due_date)
        ELSE 0
      END AS overdue_days,
      COALESCE((
        SELECT SUM(dp.amount)
        FROM ${PAYMENTS} dp
        WHERE dp.inward_uid = si.uid AND dp.delete_datetime IS NULL
      ), 0) AS total_payments_made
    FROM ${INWARD} si
    JOIN dealer_master d ON d.uid = si.dealer_uid AND d.delete_datetime IS NULL
    LEFT JOIN stock_master sm ON sm.uid = si.stock_uid AND sm.delete_datetime IS NULL
    WHERE ${whereSql}
    ORDER BY si.entry_datetime DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [...params, limit, offset]);

  const countSql = `
    SELECT COUNT(*) AS count
    FROM ${INWARD} si
    JOIN dealer_master d ON d.uid = si.dealer_uid AND d.delete_datetime IS NULL
    LEFT JOIN stock_master sm ON sm.uid = si.stock_uid AND sm.delete_datetime IS NULL
    WHERE ${whereSql}
  `;
  const [[{ count }]] = await pool.query(countSql, params);

  return { rows, total: count, page: Number(page), pageSize: limit };
}

/**
 * Record a payment installment against a dealer credit purchase
 */
async function recordPayment(data) {
  const {
    inward_uid,
    amount,
    payment_mode = 'cash',
    bank_uid = null,
    ref_number = null,
    payment_date = null,
    narration = '',
    denominations = null,
    tendered_amount = null,
    change_returned = null
  } = data;

  const payAmt = Math.round(Number(amount || 0) * 100) / 100;
  if (!inward_uid) throw Object.assign(new Error('Inward record UID is required.'), { status: 400 });
  if (payAmt <= 0) throw Object.assign(new Error('Payment amount must be greater than 0.'), { status: 422 });
  if (!payment_mode) throw Object.assign(new Error('Payment mode is required.'), { status: 422 });

  const [[inward]] = await pool.query(
    `SELECT si.uid, si.id, si.dealer_uid, si.total_purchase_amount, si.avg_total_rate, si.paid_amount, si.due_amount, si.credit_status, d.dealer_name
     FROM ${INWARD} si
     JOIN dealer_master d ON d.uid = si.dealer_uid AND d.delete_datetime IS NULL
     WHERE si.uid = ? AND si.delete_datetime IS NULL`,
    [inward_uid]
  );

  if (!inward) throw Object.assign(new Error('Stock inward purchase record not found.'), { status: 404 });
  if (Number(inward.due_amount) <= 0) {
    throw Object.assign(new Error('This dealer purchase has already been fully paid and cleared!'), { status: 422 });
  }
  if (payAmt > Number(inward.due_amount)) {
    throw Object.assign(new Error(`Payment amount (₹${payAmt}) cannot exceed current outstanding due balance (₹${inward.due_amount}).`), { status: 422 });
  }

  const newPaid = Math.round((Number(inward.paid_amount || 0) + payAmt) * 100) / 100;
  const newDue = Math.max(0, Math.round((Number(inward.due_amount) - payAmt) * 100) / 100);
  const newStatus = newDue <= 0 ? 'paid' : 'partially_paid';
  const payDateVal = payment_date || new Date().toISOString().slice(0, 10);
  const paymentUid = newUid();

  const cleanRef = ref_number ? ref_number.trim() : null;
  const cleanBank = bank_uid || null;
  const denomJson = denominations ? (typeof denominations === 'string' ? denominations : JSON.stringify(denominations)) : null;

  return await withTransaction(pool, async (conn) => {
    // 1. Insert into dealer_payments
    const [dpResult] = await conn.query(
      `INSERT INTO ${PAYMENTS}
       (uid, inward_uid, dealer_uid, amount, payment_mode, bank_uid, ref_number, payment_date, denominations, tendered_amount, change_returned, narration, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        paymentUid,
        inward.uid,
        inward.dealer_uid,
        payAmt,
        payment_mode,
        cleanBank,
        cleanRef,
        payDateVal,
        denomJson,
        tendered_amount ? Number(tendered_amount) : null,
        change_returned ? Number(change_returned) : null,
        narration || `Payment against Inward #INW-${String(inward.id).padStart(4, '0')}`
      ]
    );

    const paymentId = dpResult.insertId;

    // 2. Update stock_inward paid_amount, due_amount, and credit_status
    await conn.query(
      `UPDATE ${INWARD}
       SET paid_amount = ?, due_amount = ?, credit_status = ?, update_datetime = NOW()
       WHERE uid = ? AND delete_datetime IS NULL`,
      [newPaid, newDue, newStatus, inward.uid]
    );

    // 3. Post to Double-Entry Accounting
    await accountingService.postDealerPaymentEntry(conn, {
      paymentUid,
      paymentId,
      dealerUid: inward.dealer_uid,
      dealerName: inward.dealer_name,
      inwardUid: inward.uid,
      amount: payAmt,
      paymentMode: payment_mode,
      bankUid: cleanBank,
      paymentDate: payDateVal,
      narration: narration || `Dealer Payment to ${inward.dealer_name} (Inward #INW-${String(inward.id).padStart(4, '0')})`
    });

    return {
      payment_uid: paymentUid,
      inward_uid: inward.uid,
      paid_amount: payAmt,
      remaining_due: newDue,
      credit_status: newStatus
    };
  });
}

/**
 * List payment history ledger for dealer payments
 */
async function listDealerPayments({ page = 1, pageSize = 20, search = '', dealer_uid = null } = {}) {
  const params = [];
  let whereClauses = [`dp.delete_datetime IS NULL`];

  if (dealer_uid) {
    whereClauses.push(`dp.dealer_uid = ?`);
    params.push(dealer_uid);
  }

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(d.dealer_name LIKE ? OR CONCAT('DPAY-', LPAD(dp.id, 4, '0')) LIKE ? OR dp.ref_number LIKE ? OR dp.narration LIKE ?)`);
    params.push(like, like, like, like);
  }

  const whereSql = whereClauses.join(' AND ');
  const limit = Number(pageSize) || 20;
  const offset = ((Number(page) || 1) - 1) * limit;

  const sql = `
    SELECT
      dp.id AS payment_id,
      CONCAT('DPAY-', LPAD(dp.id, 4, '0')) AS payment_voucher_no,
      dp.uid AS payment_uid,
      dp.inward_uid,
      CONCAT('INW-', LPAD(si.id, 4, '0')) AS inward_number,
      dp.dealer_uid,
      COALESCE(d.dealer_name, 'Supplier Dealer') AS dealer_name,
      d.mobile_number AS dealer_mobile,
      dp.amount,
      dp.payment_mode,
      dp.ref_number,
      dp.bank_uid,
      bm.bank_name,
      bm.bank_code,
      dp.payment_date,
      dp.narration,
      dp.entry_datetime
    FROM ${PAYMENTS} dp
    JOIN dealer_master d ON d.uid = dp.dealer_uid AND d.delete_datetime IS NULL
    JOIN ${INWARD} si ON si.uid = dp.inward_uid AND si.delete_datetime IS NULL
    LEFT JOIN bank_master bm ON bm.uid = dp.bank_uid AND bm.delete_datetime IS NULL
    WHERE ${whereSql}
    ORDER BY dp.payment_date DESC, dp.id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [...params, limit, offset]);

  const countSql = `
    SELECT COUNT(*) AS count
    FROM ${PAYMENTS} dp
    JOIN dealer_master d ON d.uid = dp.dealer_uid AND d.delete_datetime IS NULL
    JOIN ${INWARD} si ON si.uid = dp.inward_uid AND si.delete_datetime IS NULL
    LEFT JOIN bank_master bm ON bm.uid = dp.bank_uid AND bm.delete_datetime IS NULL
    WHERE ${whereSql}
  `;
  const [[{ count }]] = await pool.query(countSql, params);

  return { rows, total: count, page: Number(page), pageSize: limit };
}

/**
 * Delete a dealer payment and restore outstanding balance
 */
async function deletePayment(uid) {
  return await withTransaction(pool, async (conn) => {
    const [[payment]] = await conn.query(
      `SELECT uid, inward_uid, amount FROM ${PAYMENTS} WHERE uid = ? AND delete_datetime IS NULL`,
      [uid]
    );
    if (!payment) throw Object.assign(new Error('Payment record not found.'), { status: 404 });

    // Reverse payment amount on stock_inward
    const [[inward]] = await conn.query(
      `SELECT uid, paid_amount, due_amount, total_purchase_amount, avg_total_rate FROM ${INWARD} WHERE uid = ? AND delete_datetime IS NULL`,
      [payment.inward_uid]
    );

    if (inward) {
      const restoredPaid = Math.max(0, Math.round((Number(inward.paid_amount || 0) - Number(payment.amount)) * 100) / 100);
      const totalAmt = Number(inward.total_purchase_amount || inward.avg_total_rate || 0);
      const restoredDue = Math.max(0, Math.round((totalAmt - restoredPaid) * 100) / 100);
      const restoredStatus = restoredDue <= 0 ? 'paid' : (restoredPaid > 0 ? 'partially_paid' : 'unpaid');

      await conn.query(
        `UPDATE ${INWARD}
         SET paid_amount = ?, due_amount = ?, credit_status = ?, update_datetime = NOW()
         WHERE uid = ?`,
        [restoredPaid, restoredDue, restoredStatus, inward.uid]
      );
    }

    // Void double-entry journal voucher
    await accountingService.voidJournalEntry(conn, 'dealer_payments', uid);

    // Soft delete payment
    return await markDeleted(conn, PAYMENTS, uid);
  });
}

/**
 * Get summary KPI metrics for Dealer Credits & Accounts Payable
 */
async function getDealerCreditSummary() {
  const [[summary]] = await pool.query(`
    SELECT
      COALESCE(SUM(si.avg_total_rate), 0) AS total_purchases_amount,
      COALESCE(SUM(si.paid_amount), 0) AS total_paid_amount,
      COALESCE(SUM(si.due_amount), 0) AS total_outstanding_due,
      COALESCE(SUM(CASE WHEN si.due_amount > 0 AND si.due_date < CURDATE() THEN si.due_amount ELSE 0 END), 0) AS total_overdue_amount,
      COUNT(CASE WHEN si.due_amount > 0 THEN 1 END) AS pending_purchases_count,
      COUNT(CASE WHEN si.due_amount > 0 AND si.due_date < CURDATE() THEN 1 END) AS overdue_purchases_count,
      COUNT(CASE WHEN si.due_amount <= 0 THEN 1 END) AS cleared_purchases_count
    FROM ${INWARD} si
    WHERE si.is_opening = 0 AND si.dealer_uid IS NOT NULL AND si.delete_datetime IS NULL
  `);

  return summary;
}

module.exports = {
  listDealerCreditPurchases,
  recordPayment,
  listDealerPayments,
  deletePayment,
  getDealerCreditSummary
};
