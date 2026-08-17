const pool = require('../config/db.cjs');
const { newUid, withTransaction } = require('../utils/audit.cjs');
const { syncTransaction, deleteTransaction } = require('./transactionModel.cjs');

const BILL = 'bill_master';
const RECEIPTS = 'credit_receipts';
const PAYMENTS = 'bill_payments';
const ADVANCE = 'customer_advance';
const ADVANCE_ITEMS = 'advance_prebook_items';

async function listCreditBills({ page = 1, pageSize = 20, search = '', status = 'all' } = {}) {
  const params = [];
  let whereClauses = [`b.is_credit = 1`, `b.delete_datetime IS NULL`];

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(c.customer_name LIKE ? OR c.mobile_number LIKE ? OR b.uid LIKE ? OR CONCAT('BILL-', LPAD(b.id, 4, '0')) LIKE ? OR b.due_narration LIKE ?)`);
    params.push(like, like, like, like, like);
  }

  if (status === 'pending') {
    whereClauses.push(`b.due_amount > 0`);
  } else if (status === 'overdue') {
    whereClauses.push(`b.due_amount > 0 AND b.due_date < CURDATE()`);
  } else if (status === 'paid') {
    whereClauses.push(`b.due_amount <= 0`);
  }

  const whereSql = whereClauses.join(' AND ');

  const sql = `
    SELECT
      b.id AS bill_id,
      CONCAT('BILL-', LPAD(b.id, 4, '0')) AS bill_number,
      b.uid AS bill_uid,
      b.customer_uid,
      c.customer_name,
      c.mobile_number,
      b.grand_total,
      (b.grand_total - b.due_amount) AS total_paid_so_far,
      b.due_amount,
      b.due_date,
      b.due_narration,
      b.credit_status,
      b.entry_datetime AS bill_datetime,
      CASE
        WHEN b.due_amount > 0 AND b.due_date < CURDATE() THEN DATEDIFF(CURDATE(), b.due_date)
        ELSE 0
      END AS overdue_days,
      COALESCE((
        SELECT SUM(cr.amount)
        FROM ${RECEIPTS} cr
        WHERE cr.bill_uid = b.uid AND cr.delete_datetime IS NULL
      ), 0) AS total_credit_receipts,
      COALESCE((
        SELECT SUM(ca.amount)
        FROM ${ADVANCE} ca
        WHERE ca.customer_uid = b.customer_uid AND ca.amount > 0 AND ca.is_converted_to_bill = 0 AND ca.update_datetime IS NULL AND ca.delete_datetime IS NULL
      ), 0) AS customer_available_advance
    FROM ${BILL} b
    JOIN customer_master c ON c.uid = b.customer_uid AND c.delete_datetime IS NULL
    WHERE ${whereSql}
    ORDER BY
      CASE WHEN b.due_amount > 0 AND b.due_date < CURDATE() THEN 1 WHEN b.due_amount > 0 THEN 2 ELSE 3 END,
      b.due_date ASC,
      b.entry_datetime DESC
    LIMIT ? OFFSET ?
  `;

  const offset = (Number(page) - 1) * Number(pageSize);
  const [rows] = await pool.query(sql, [...params, Number(pageSize), offset]);

  const countSql = `
    SELECT COUNT(*) AS count
    FROM ${BILL} b
    JOIN customer_master c ON c.uid = b.customer_uid AND c.delete_datetime IS NULL
    WHERE ${whereSql}
  `;
  const [[{ count }]] = await pool.query(countSql, params);

  return { rows, total: count, page: Number(page), pageSize: Number(pageSize) };
}

async function listCustomerAdvances(customerUid) {
  if (!customerUid) return [];

  const [advances] = await pool.query(
    `SELECT 
       ca.uid,
       ca.customer_uid,
       ca.amount,
       ca.is_prebook,
       ca.prebook_code,
       ca.is_converted_to_bill,
       ca.payment_mode,
       ca.notes,
       ca.entry_datetime,
       COALESCE(item_stats.total_items, 0) AS total_items,
       COALESCE(item_stats.total_pieces, 0) AS total_pieces,
       COALESCE(item_stats.total_estimated_amount, 0) AS total_estimated_amount
     FROM ${ADVANCE} ca
     LEFT JOIN (
       SELECT 
         advance_uid,
         COUNT(DISTINCT uid) AS total_items,
         SUM(pieces) AS total_pieces,
         SUM(line_amount) AS total_estimated_amount
       FROM ${ADVANCE_ITEMS}
       WHERE delete_datetime IS NULL
       GROUP BY advance_uid
     ) item_stats ON ca.uid = item_stats.advance_uid
     WHERE ca.customer_uid = ? AND (ca.amount > 0 OR ca.is_prebook = 1) AND ca.is_converted_to_bill = 0 AND ca.update_datetime IS NULL AND ca.delete_datetime IS NULL
     ORDER BY ca.amount DESC, ca.entry_datetime DESC`,
    [customerUid]
  );

  // For each prebook advance, load items
  for (const adv of advances) {
    if (adv.is_prebook) {
      const [items] = await pool.query(
        `SELECT 
           api.uid,
           api.stock_uid,
           sm.design_number,
           api.pieces,
           api.rate_per_piece,
           api.line_amount,
           sz.width_ft,
           sz.height_ft,
           sz.thickness_mm
         FROM ${ADVANCE_ITEMS} api
         JOIN stock_master sm ON sm.uid = api.stock_uid AND sm.delete_datetime IS NULL
         LEFT JOIN size_master sz ON sm.size_uid = sz.uid AND sz.delete_datetime IS NULL
         WHERE api.advance_uid = ? AND api.delete_datetime IS NULL`,
        [adv.uid]
      );
      adv.items = items;
    } else {
      adv.items = [];
    }
  }

  return advances;
}

/**
 * Record a credit receipt payment against an outstanding bill
 */
async function receivePayment(data, reqMeta = {}) {
  const {
    bill_uid,
    amount,
    payment_mode,
    advance_uid = null,
    prebook_action = 'keep_reserved', // 'keep_reserved' | 'release_stock'
    narration = '',
    receipt_date = null,
    ref_number = null,
    bank_uid = null,
    denominations = null,
    tendered_amount = null,
    change_returned = null
  } = data;

  const payAmt = Math.round(Number(amount || 0) * 100) / 100;

  if (!bill_uid) throw Object.assign(new Error('Bill UID is required.'), { status: 400 });
  if (payAmt <= 0) throw Object.assign(new Error('Receipt amount must be greater than 0.'), { status: 422 });
  if (!payment_mode) throw Object.assign(new Error('Payment mode is required.'), { status: 422 });

  const [[bill]] = await pool.query(
    `SELECT b.uid, b.customer_uid, b.grand_total, b.due_amount, b.credit_status
     FROM ${BILL} b
     WHERE b.uid = ? AND b.delete_datetime IS NULL`,
    [bill_uid]
  );

  if (!bill) throw Object.assign(new Error('Bill not found or already deleted.'), { status: 404 });
  if (Number(bill.due_amount) <= 0) {
    throw Object.assign(new Error('This bill has already been fully paid and cleared!'), { status: 422 });
  }
  if (payAmt > Number(bill.due_amount)) {
    throw Object.assign(new Error(`Received amount (₹${payAmt}) cannot exceed current due balance (₹${bill.due_amount}).`), { status: 422 });
  }

  let advanceRecord = null;
  if (advance_uid) {
    const [[adv]] = await pool.query(
      `SELECT uid, customer_uid, amount, is_prebook, prebook_code, is_converted_to_bill
       FROM ${ADVANCE}
       WHERE uid = ? AND delete_datetime IS NULL`,
      [advance_uid]
    );
    if (!adv) throw Object.assign(new Error('Selected advance record not found or already deleted.'), { status: 404 });
    if (adv.is_converted_to_bill === 1) throw Object.assign(new Error('This advance has already been fully converted and closed.'), { status: 422 });
    if (payAmt > Number(adv.amount)) {
      throw Object.assign(new Error(`Adjustment amount (₹${payAmt}) exceeds the available advance balance of ₹${adv.amount}.`), { status: 422 });
    }
    advanceRecord = adv;
  }

  const newDue = Math.max(0, Math.round((Number(bill.due_amount) - payAmt) * 100) / 100);
  const newStatus = newDue <= 0 ? 'paid' : 'partially_paid';
  const receiptDateVal = receipt_date || new Date().toISOString().slice(0, 10);
  const receiptUid = newUid();

  const cleanRef = ref_number ? ref_number.trim() : null;
  const cleanBank = bank_uid || null;
  const denomJson = denominations ? (typeof denominations === 'string' ? denominations : JSON.stringify(denominations)) : null;
  const numTendered = tendered_amount !== undefined && tendered_amount !== '' && tendered_amount !== null ? Number(tendered_amount) : null;
  const numChange = change_returned !== undefined && change_returned !== '' && change_returned !== null ? Number(change_returned) : null;

  await withTransaction(pool, async (conn) => {
    // 1. Insert credit receipt
    const [rcpResult] = await conn.query(
      `INSERT INTO ${RECEIPTS} (uid, bill_uid, customer_uid, advance_uid, amount, payment_mode, ref_number, bank_uid, denominations, tendered_amount, change_returned, narration, receipt_date, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        receiptUid,
        bill.uid,
        bill.customer_uid,
        advanceRecord ? advanceRecord.uid : null,
        payAmt,
        payment_mode,
        cleanRef,
        cleanBank,
        denomJson,
        numTendered,
        numChange,
        narration || (advanceRecord ? `Adjusted from Advance ${advanceRecord.prebook_code || advanceRecord.uid.slice(0, 8)}` : null),
        receiptDateVal
      ]
    );

    const rcpId = rcpResult.insertId;
    const formattedRcp = `RCP-${String(rcpId).padStart(4, '0')}`;

    // 2. Insert into bill_payments
    await conn.query(
      `INSERT INTO ${PAYMENTS} (uid, bill_uid, payment_mode, amount, transaction_date, ref_number, bank_uid, denominations, tendered_amount, change_returned, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [receiptUid, bill.uid, payment_mode, payAmt, receiptDateVal, cleanRef, cleanBank, denomJson, numTendered, numChange]
    );

    // Sync into account_transactions as CREDIT_RECEIVED
    await syncTransaction(conn, {
      uid: receiptUid,
      transaction_type: 'CREDIT_RECEIVED',
      source_table: 'credit_receipts',
      source_uid: receiptUid,
      reference_number: formattedRcp,
      party_name: bill.customer_name || 'Customer',
      party_uid: bill.customer_uid,
      amount: Math.abs(payAmt),
      payment_mode,
      bank_uid: cleanBank,
      ref_number: cleanRef,
      transaction_date: receiptDateVal,
      denominations: denomJson,
      tendered_amount: numTendered,
      change_returned: numChange,
      narration: narration || `Credit Received against Bill #${bill.bill_number || bill.uid.slice(0, 8)}`
    });

    // 3. Update bill due_amount and credit_status
    await conn.query(
      `UPDATE ${BILL}
       SET due_amount = ?, credit_status = ?, update_datetime = NOW()
       WHERE uid = ? AND delete_datetime IS NULL`,
      [newDue, newStatus, bill.uid]
    );

    // 4. If adjusted from advance, handle customer_advance and pre-booking items
    if (advanceRecord) {
      const remainingAdvance = Math.max(0, Math.round((Number(advanceRecord.amount) - payAmt) * 100) / 100);

      if (prebook_action === 'release_stock') {
        // Release pre-booked items back to available stock
        await conn.query(
          `UPDATE ${ADVANCE_ITEMS}
           SET delete_datetime = NOW()
           WHERE advance_uid = ? AND delete_datetime IS NULL`,
          [advanceRecord.uid]
        );
        // If remaining advance is 0 and items released, mark converted/closed
        const isConverted = remainingAdvance === 0 ? 1 : 0;
        await conn.query(
          `UPDATE ${ADVANCE}
           SET amount = ?, is_converted_to_bill = ?
           WHERE uid = ? AND update_datetime IS NULL AND delete_datetime IS NULL`,
          [remainingAdvance, isConverted, advanceRecord.uid]
        );
      } else {
        // Keep items reserved (even if advance is partial or becomes 0)
        await conn.query(
          `UPDATE ${ADVANCE}
           SET amount = ?
           WHERE uid = ? AND update_datetime IS NULL AND delete_datetime IS NULL`,
          [remainingAdvance, advanceRecord.uid]
        );
      }
    }
  });

  return {
    receipt_uid: receiptUid,
    bill_uid: bill.uid,
    received_amount: payAmt,
    remaining_due: newDue,
    credit_status: newStatus,
    advance_uid: advanceRecord ? advanceRecord.uid : null
  };
}

async function updateReceipt(receiptUid, data) {
  const {
    amount,
    payment_mode,
    narration = '',
    receipt_date = null,
    ref_number = null,
    bank_uid = null,
    denominations = null,
    tendered_amount = null,
    change_returned = null
  } = data;
  const newAmt = Math.round(Number(amount || 0) * 100) / 100;

  if (!receiptUid) throw Object.assign(new Error('Receipt UID is required.'), { status: 400 });
  if (newAmt <= 0) throw Object.assign(new Error('Receipt amount must be greater than 0.'), { status: 422 });
  if (!payment_mode) throw Object.assign(new Error('Payment mode is required.'), { status: 422 });

  const [[receipt]] = await pool.query(
    `SELECT uid, bill_uid, customer_uid, advance_uid, amount, payment_mode, ref_number, bank_uid, denominations, tendered_amount, change_returned
     FROM ${RECEIPTS}
     WHERE uid = ? AND delete_datetime IS NULL`,
    [receiptUid]
  );
  if (!receipt) throw Object.assign(new Error('Receipt not found or already deleted.'), { status: 404 });

  const [[bill]] = await pool.query(
    `SELECT uid, grand_total, due_amount
     FROM ${BILL}
     WHERE uid = ? AND delete_datetime IS NULL`,
    [receipt.bill_uid]
  );
  if (!bill) throw Object.assign(new Error('Associated bill not found.'), { status: 404 });

  // Calculate sum of other payments on this bill
  const [[{ otherPayments }]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS otherPayments
     FROM ${PAYMENTS}
     WHERE bill_uid = ? AND uid != ? AND delete_datetime IS NULL`,
    [bill.uid, receiptUid]
  );

  const totalPaid = Math.round((Number(otherPayments) + newAmt) * 100) / 100;
  if (totalPaid > Number(bill.grand_total)) {
    const maxAllowed = Math.max(0, Math.round((Number(bill.grand_total) - Number(otherPayments)) * 100) / 100);
    throw Object.assign(new Error(`Receipt amount (₹${newAmt}) exceeds maximum allowable balance of ₹${maxAllowed}.`), { status: 422 });
  }

  // If this receipt was linked to an advance, check advance balance adjustment difference
  const diff = newAmt - Number(receipt.amount);
  if (receipt.advance_uid && diff !== 0) {
    const [[adv]] = await pool.query(
      `SELECT uid, amount FROM ${ADVANCE} WHERE uid = ? AND delete_datetime IS NULL`,
      [receipt.advance_uid]
    );
    if (adv) {
      if (diff > 0 && diff > Number(adv.amount)) {
        throw Object.assign(new Error(`Additional adjustment of ₹${diff} exceeds remaining advance balance of ₹${adv.amount}.`), { status: 422 });
      }
    }
  }

  const newDue = Math.max(0, Math.round((Number(bill.grand_total) - totalPaid) * 100) / 100);
  const newStatus = newDue <= 0 ? 'paid' : (totalPaid > 0 ? 'partially_paid' : 'unpaid');
  const receiptDateVal = receipt_date || new Date().toISOString().slice(0, 10);

  const cleanRef = ref_number !== undefined ? (ref_number ? ref_number.trim() : null) : (receipt.ref_number || null);
  const cleanBank = bank_uid !== undefined ? (bank_uid || null) : (receipt.bank_uid || null);
  const denomJson = denominations !== undefined ? (denominations ? (typeof denominations === 'string' ? denominations : JSON.stringify(denominations)) : null) : (receipt.denominations ? (typeof receipt.denominations === 'string' ? receipt.denominations : JSON.stringify(receipt.denominations)) : null);
  const numTendered = tendered_amount !== undefined && tendered_amount !== '' && tendered_amount !== null ? Number(tendered_amount) : (receipt.tendered_amount ?? null);
  const numChange = change_returned !== undefined && change_returned !== '' && change_returned !== null ? Number(change_returned) : (receipt.change_returned ?? null);

  await withTransaction(pool, async (conn) => {
    // 1. Update credit receipt
    await conn.query(
      `UPDATE ${RECEIPTS}
       SET amount = ?, payment_mode = ?, ref_number = ?, bank_uid = ?, denominations = ?, tendered_amount = ?, change_returned = ?, narration = ?, receipt_date = ?, update_datetime = NOW()
       WHERE uid = ? AND delete_datetime IS NULL`,
      [newAmt, payment_mode, cleanRef, cleanBank, denomJson, numTendered, numChange, narration || null, receiptDateVal, receiptUid]
    );

    // 2. Update bill_payments row
    await conn.query(
      `UPDATE ${PAYMENTS}
       SET amount = ?, payment_mode = ?, transaction_date = ?, ref_number = ?, bank_uid = ?, denominations = ?, tendered_amount = ?, change_returned = ?, update_datetime = NOW()
       WHERE uid = ? AND delete_datetime IS NULL`,
      [newAmt, payment_mode, receiptDateVal, cleanRef, cleanBank, denomJson, numTendered, numChange, receiptUid]
    );

    const [[cust]] = await conn.query(`SELECT customer_name FROM customer_master WHERE uid = ?`, [receipt.customer_uid]);
    const customerName = cust?.customer_name || 'Customer';
    const formattedRcp = `RCP-${String(receipt.id || '').padStart(4, '0')}`;

    // Sync into account_transactions
    await syncTransaction(conn, {
      uid: receiptUid,
      transaction_type: 'CREDIT_RECEIVED',
      source_table: 'credit_receipts',
      source_uid: receiptUid,
      reference_number: formattedRcp,
      party_name: customerName,
      party_uid: receipt.customer_uid,
      amount: Math.abs(newAmt),
      payment_mode,
      bank_uid: cleanBank,
      ref_number: cleanRef,
      transaction_date: receiptDateVal,
      denominations: denomJson,
      tendered_amount: numTendered,
      change_returned: numChange,
      narration: narration || `Credit Received against Bill #${bill.bill_number || bill.uid.slice(0, 8)}`
    });

    // 3. Update bill due_amount and credit_status
    await conn.query(
      `UPDATE ${BILL}
       SET due_amount = ?, credit_status = ?, update_datetime = NOW()
       WHERE uid = ? AND delete_datetime IS NULL`,
      [newDue, newStatus, bill.uid]
    );

    // 4. If linked to advance, adjust advance amount by diff
    if (receipt.advance_uid && diff !== 0) {
      await conn.query(
        `UPDATE ${ADVANCE}
         SET amount = GREATEST(0, amount - ?)
         WHERE uid = ? AND update_datetime IS NULL AND delete_datetime IS NULL`,
        [diff, receipt.advance_uid]
      );
    }
  });

  return {
    receipt_uid: receiptUid,
    bill_uid: bill.uid,
    amount: newAmt,
    payment_mode,
    ref_number: cleanRef,
    bank_uid: cleanBank,
    denominations: denomJson,
    tendered_amount: numTendered,
    change_returned: numChange,
    narration,
    receipt_date: receiptDateVal,
    remaining_due: newDue,
    credit_status: newStatus
  };
}

async function deleteReceipt(receiptUid) {
  if (!receiptUid) throw Object.assign(new Error('Receipt UID is required.'), { status: 400 });

  const [[receipt]] = await pool.query(
    `SELECT uid, bill_uid, customer_uid, advance_uid, amount
     FROM ${RECEIPTS}
     WHERE uid = ? AND delete_datetime IS NULL`,
    [receiptUid]
  );
  if (!receipt) throw Object.assign(new Error('Receipt not found or already deleted.'), { status: 404 });

  const [[bill]] = await pool.query(
    `SELECT uid, grand_total, due_amount
     FROM ${BILL}
     WHERE uid = ? AND delete_datetime IS NULL`,
    [receipt.bill_uid]
  );
  if (!bill) throw Object.assign(new Error('Associated bill not found.'), { status: 404 });

  // Calculate remaining active payments after deleting this receipt
  const [[{ activePayments }]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS activePayments
     FROM ${PAYMENTS}
     WHERE bill_uid = ? AND uid != ? AND delete_datetime IS NULL`,
    [bill.uid, receiptUid]
  );

  const totalPaid = Math.round(Number(activePayments) * 100) / 100;
  const newDue = Math.max(0, Math.round((Number(bill.grand_total) - totalPaid) * 100) / 100);
  const newStatus = newDue <= 0 ? 'paid' : (totalPaid > 0 ? 'partially_paid' : 'unpaid');

  await withTransaction(pool, async (conn) => {
    // 1. Soft delete credit receipt
    await conn.query(
      `UPDATE ${RECEIPTS}
       SET delete_datetime = NOW()
       WHERE uid = ? AND delete_datetime IS NULL`,
      [receiptUid]
    );

    // 2. Soft delete corresponding bill_payments record
    await conn.query(
      `UPDATE ${PAYMENTS}
       SET delete_datetime = NOW()
       WHERE uid = ? AND delete_datetime IS NULL`,
      [receiptUid]
    );

    // 3. Delete from account_transactions
    await deleteTransaction(conn, 'credit_receipts', receiptUid);

    // 3. Update bill due_amount and credit_status (reverting the amount back to customer's due)
    await conn.query(
      `UPDATE ${BILL}
       SET due_amount = ?, credit_status = ?, update_datetime = NOW()
       WHERE uid = ? AND delete_datetime IS NULL`,
      [newDue, newStatus, bill.uid]
    );

    // 4. If receipt was deducted from an advance, revert the amount back to customer_advance
    if (receipt.advance_uid) {
      await conn.query(
        `UPDATE ${ADVANCE}
         SET amount = amount + ?, is_converted_to_bill = 0
         WHERE uid = ? AND update_datetime IS NULL AND delete_datetime IS NULL`,
        [Number(receipt.amount), receipt.advance_uid]
      );
    }
  });

  return {
    success: true,
    message: 'Credit receipt deleted successfully. Amount has been reverted to the customer due balance.',
    receipt_uid: receiptUid,
    bill_uid: bill.uid,
    reverted_amount: Number(receipt.amount),
    new_due_amount: newDue,
    credit_status: newStatus,
    advance_uid: receipt.advance_uid || null
  };
}

async function listReceipts({ page = 1, pageSize = 20, search = '' } = {}) {
  const params = [];
  let whereClauses = [`cr.delete_datetime IS NULL`];

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    whereClauses.push(`(c.customer_name LIKE ? OR c.mobile_number LIKE ? OR CONCAT('BILL-', LPAD(b.id, 4, '0')) LIKE ? OR cr.narration LIKE ? OR cr.payment_mode LIKE ? OR cr.ref_number LIKE ? OR bm.bank_name LIKE ?)`);
    params.push(like, like, like, like, like, like, like);
  }

  const whereSql = whereClauses.join(' AND ');
  const offset = (Number(page) - 1) * Number(pageSize);

  const sql = `
    SELECT
      cr.uid AS receipt_uid,
      cr.bill_uid,
      b.id AS bill_id,
      CONCAT('BILL-', LPAD(b.id, 4, '0')) AS bill_number,
      cr.customer_uid,
      cr.advance_uid,
      c.customer_name,
      c.mobile_number,
      cr.amount,
      cr.payment_mode,
      cr.ref_number,
      cr.bank_uid,
      bm.bank_name,
      bm.bank_code,
      cr.denominations,
      cr.tendered_amount,
      cr.change_returned,
      cr.narration,
      DATE_FORMAT(cr.receipt_date, '%Y-%m-%d') AS receipt_date,
      cr.entry_datetime,
      b.grand_total,
      b.due_amount AS current_due_amount,
      b.credit_status,
      ca.prebook_code,
      ca.is_prebook AS is_advance_prebook
    FROM ${RECEIPTS} cr
    JOIN customer_master c ON c.uid = cr.customer_uid AND c.delete_datetime IS NULL
    JOIN ${BILL} b ON b.uid = cr.bill_uid AND b.delete_datetime IS NULL
    LEFT JOIN bank_master bm ON bm.uid = cr.bank_uid AND bm.delete_datetime IS NULL
    LEFT JOIN ${ADVANCE} ca ON ca.uid = cr.advance_uid AND ca.delete_datetime IS NULL
    WHERE ${whereSql}
    ORDER BY cr.entry_datetime DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [...params, Number(pageSize), offset]);

  const countSql = `
    SELECT COUNT(*) AS count
    FROM ${RECEIPTS} cr
    JOIN customer_master c ON c.uid = cr.customer_uid AND c.delete_datetime IS NULL
    JOIN ${BILL} b ON b.uid = cr.bill_uid AND b.delete_datetime IS NULL
    LEFT JOIN bank_master bm ON bm.uid = cr.bank_uid AND bm.delete_datetime IS NULL
    WHERE ${whereSql}
  `;
  const [[{ count }]] = await pool.query(countSql, params);

  return { rows, total: count, page: Number(page), pageSize: Number(pageSize) };
}

async function getCreditSummary() {
  const [[summary]] = await pool.query(
    `SELECT
       COALESCE(SUM(b.grand_total), 0) AS total_credit_extended,
       COALESCE(SUM(b.grand_total - b.due_amount), 0) AS total_recovered,
       COALESCE(SUM(b.due_amount), 0) AS total_outstanding_due,
       COALESCE(SUM(CASE WHEN b.due_amount > 0 AND b.due_date < CURDATE() THEN b.due_amount ELSE 0 END), 0) AS total_overdue_amount,
       COUNT(CASE WHEN b.due_amount > 0 THEN 1 END) AS pending_bills_count,
       COUNT(CASE WHEN b.due_amount > 0 AND b.due_date < CURDATE() THEN 1 END) AS overdue_bills_count,
       COUNT(CASE WHEN b.due_amount <= 0 THEN 1 END) AS cleared_bills_count
     FROM ${BILL} b
     WHERE b.is_credit = 1 AND b.delete_datetime IS NULL`
  );

  return summary;
}

module.exports = {
  listCreditBills,
  listCustomerAdvances,
  receivePayment,
  updateReceipt,
  deleteReceipt,
  listReceipts,
  getCreditSummary
};
