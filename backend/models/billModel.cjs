const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, activeFilter, newUid, withTransaction, markSuperseded, markDeleted } = require('../utils/audit.cjs');

const BILL = 'bill_master';
const ITEMS = 'bill_items';
const PAYMENTS = 'bill_payments';

async function list({ pageSize, offset, todayOnly = false }) {
  const dateFilter = todayOnly ? ` AND DATE(b.entry_datetime) = CURDATE()` : '';
  const [rows] = await pool.query(
    `SELECT b.uid, b.customer_uid, c.customer_name, c.mobile_number, b.total_amount, b.discount, b.net_amount,
            b.cgst_percent, b.sgst_percent, b.igst_percent, b.cgst_amount, b.sgst_amount, b.igst_amount,
            b.tax_amount, b.grand_total, b.is_home_bill, b.prebook_code, b.advance_uid, b.advance_amount,
            b.is_credit, b.due_amount, b.due_date, b.due_narration, b.credit_status, b.entry_datetime
     FROM ${BILL} b JOIN customer_master c ON c.uid = b.customer_uid AND ${activeFilter('c')}
     WHERE ${activeFilter('b')}${dateFilter} ORDER BY b.entry_datetime DESC LIMIT ? OFFSET ?`,
    [Number(pageSize), Number(offset)]
  );
  const countFilter = todayOnly ? ` AND DATE(entry_datetime) = CURDATE()` : '';
  const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count FROM ${BILL} WHERE ${ACTIVE_FILTER}${countFilter}`);
  const [[{ grandTotal }]] = await pool.query(`SELECT COALESCE(SUM(grand_total),0) AS grandTotal FROM ${BILL} WHERE ${ACTIVE_FILTER}${countFilter}`);
  return { rows, total: count, grandTotal };
}

async function findByUid(uid) {
  const [[bill]] = await pool.query(
    `SELECT b.uid, b.customer_uid, c.customer_name, c.mobile_number, c.state AS customer_state,
            b.total_amount, b.discount, b.net_amount,
            b.cgst_percent, b.sgst_percent, b.igst_percent, b.cgst_amount, b.sgst_amount, b.igst_amount,
            b.tax_amount, b.grand_total, b.is_home_bill, b.prebook_code, b.advance_uid, b.advance_amount,
            b.is_credit, b.due_amount, b.due_date, b.due_narration, b.credit_status, b.entry_datetime
     FROM ${BILL} b JOIN customer_master c ON c.uid = b.customer_uid AND ${activeFilter('c')}
     WHERE b.uid = ? AND ${activeFilter('b')}`,
    [uid]
  );
  if (!bill) return null;
  const [items] = await pool.query(
    `SELECT bi.uid, bi.stock_uid, sm.design_number, sm.image_filename, bi.pieces, bi.rate_per_piece, bi.line_amount, bi.is_home_bill
     FROM ${ITEMS} bi JOIN stock_master sm ON sm.uid = bi.stock_uid AND ${activeFilter('sm')}
     WHERE bi.bill_uid = ? AND ${activeFilter('bi')}`,
    [uid]
  );
  const [payments] = await pool.query(
    `SELECT bp.uid, bp.payment_mode, bp.amount, bp.transaction_date, bp.ref_number, bp.bank_uid,
            bm.bank_name, bm.bank_code, bp.denominations, bp.tendered_amount, bp.change_returned
     FROM ${PAYMENTS} bp
     LEFT JOIN bank_master bm ON bm.uid = bp.bank_uid AND ${activeFilter('bm')}
     WHERE bp.bill_uid = ? AND ${activeFilter('bp')}`,
    [uid]
  );
  return { ...bill, items, payments };
}

async function create(data) {
  const total_amount = data.items.reduce((sum, i) => sum + Number(i.pieces) * Number(i.rate_per_piece), 0);
  const discount = Number(data.discount || 0);
  const net_amount = Math.max(0, Math.round((total_amount - discount) * 100) / 100);
  const paymentsSum = Math.round(data.payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
  const is_home_bill = data.is_home_bill ? 1 : 0;
  const prebook_code = data.prebook_code || null;
  const advance_uid = data.advance_uid || null;
  const advance_amount = Number(data.advance_amount || 0);

  const cgst_percent = Number(data.cgst_percent || 0);
  const sgst_percent = Number(data.sgst_percent || 0);
  const igst_percent = Number(data.igst_percent || 0);
  const cgst_amount  = Number(data.cgst_amount  || 0);
  const sgst_amount  = Number(data.sgst_amount  || 0);
  const igst_amount  = Number(data.igst_amount  || 0);
  const tax_amount   = Number(data.tax_amount   || 0);
  const grand_total_computed = Math.round((net_amount + tax_amount) * 100) / 100;

  // Credit / Due calculations & validations
  const is_credit = data.is_credit ? 1 : 0;
  let due_amount = 0;
  let due_date = null;
  let due_narration = null;
  let credit_status = 'paid';

  if (is_credit) {
    if (!data.due_date) {
      throw Object.assign(new Error('Exact Payment Due Date is mandatory for credit bills.'), { status: 422 });
    }
    if (!data.due_narration || !data.due_narration.trim()) {
      throw Object.assign(new Error('Narration is mandatory for credit bills.'), { status: 422 });
    }
    if (paymentsSum > grand_total_computed) {
      throw Object.assign(new Error(`Payments (₹${paymentsSum}) cannot exceed Grand Total (₹${grand_total_computed})`), { status: 422 });
    }
    due_amount = Math.max(0, Math.round((grand_total_computed - paymentsSum) * 100) / 100);
    due_date = data.due_date;
    due_narration = data.due_narration.trim();
    credit_status = due_amount <= 0 ? 'paid' : (paymentsSum > 0 ? 'partially_paid' : 'unpaid');
  } else {
    if (paymentsSum !== grand_total_computed) {
      throw Object.assign(new Error(`Payments (₹${paymentsSum}) must equal grand total (₹${grand_total_computed})`), { status: 422 });
    }
  }

  // If billing against a pre-booking, verify it hasn't already been converted to a bill
  if (advance_uid) {
    const [[adv]] = await pool.query(
      `SELECT is_converted_to_bill, prebook_code FROM customer_advance WHERE uid = ? AND delete_datetime IS NULL`,
      [advance_uid]
    );
    if (adv && adv.is_converted_to_bill) {
      throw Object.assign(new Error(`Pre-booking ${adv.prebook_code || ''} has already been billed. You cannot bill the same pre-booking again unless the previous bill is deleted.`), { status: 422 });
    }
  }

  // Stock check: strictly validate physical stock for all regular stock items (non-home-bill items)
  for (const item of data.items) {
    // If the item is marked as a home bill / non-stock item, skip physical stock validation
    if (item.is_home_bill) continue;

    const [[stockInfo]] = await pool.query(
      `SELECT 
         sm.design_number,
         (
           COALESCE((SELECT SUM(si.pieces) FROM stock_inward si WHERE si.stock_uid = sm.uid AND si.delete_datetime IS NULL), 0) -
           COALESCE((SELECT SUM(bi.pieces) FROM bill_items bi WHERE bi.stock_uid = sm.uid AND bi.delete_datetime IS NULL), 0)
         ) AS physical_stock_pcs,
         COALESCE((
           SELECT SUM(api.pieces) 
           FROM advance_prebook_items api 
           JOIN customer_advance ca ON ca.uid = api.advance_uid AND ca.is_prebook = 1 AND ca.is_converted_to_bill = 0 AND ca.delete_datetime IS NULL AND ca.update_datetime IS NULL
           WHERE api.stock_uid = sm.uid 
             AND (api.advance_uid != ? OR ? IS NULL)
             AND api.delete_datetime IS NULL 
             AND api.update_datetime IS NULL
         ), 0) AS prebooked_pcs
       FROM stock_master sm
       WHERE sm.uid = ? AND ${activeFilter('sm')}`,
      [advance_uid || '', advance_uid, item.stock_uid]
    );
    const freeAvailable = Number(stockInfo?.physical_stock_pcs || 0) - Number(stockInfo?.prebooked_pcs || 0);
    if (stockInfo && freeAvailable < Number(item.pieces)) {
      if (Number(stockInfo.prebooked_pcs) > 0) {
        throw Object.assign(new Error(`Stock Item Design #${stockInfo.design_number}: Only ${freeAvailable} pcs available in store stock (${stockInfo.prebooked_pcs} pcs are pre-booked/reserved). Cannot bill ${item.pieces} pcs.`), { status: 422 });
      } else {
        throw Object.assign(new Error(`Stock Item Design #${stockInfo.design_number} has insufficient physical stock (${freeAvailable} pcs available, attempted to bill ${item.pieces} pcs). Stock items must be billed from available store stock.`), { status: 422 });
      }
    }
  }

  const billUid = newUid();
  await withTransaction(pool, async (conn) => {
    await conn.query(
      `INSERT INTO ${BILL}
       (uid, customer_uid, total_amount, discount, net_amount, cgst_percent, sgst_percent, igst_percent,
        cgst_amount, sgst_amount, igst_amount, tax_amount, grand_total, is_home_bill, prebook_code, advance_uid, advance_amount,
        is_credit, due_amount, due_date, due_narration, credit_status, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        billUid, data.customer_uid, total_amount, discount, net_amount, cgst_percent, sgst_percent, igst_percent,
        cgst_amount, sgst_amount, igst_amount, tax_amount, grand_total_computed, is_home_bill, prebook_code, advance_uid, advance_amount,
        is_credit, due_amount, due_date, due_narration, credit_status
      ]
    );

    for (const item of data.items) {
      const line_amount = Number(item.pieces) * Number(item.rate_per_piece);
      const itemIsHomeBill = item.is_home_bill ? 1 : 0;
      await conn.query(
        `INSERT INTO ${ITEMS} (uid, bill_uid, stock_uid, pieces, rate_per_piece, line_amount, is_home_bill, entry_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [newUid(), billUid, item.stock_uid, item.pieces, item.rate_per_piece, line_amount, itemIsHomeBill]
      );
    }

    for (const payment of data.payments) {
      const denomJson = payment.denominations ? (typeof payment.denominations === 'string' ? payment.denominations : JSON.stringify(payment.denominations)) : null;
      await conn.query(
        `INSERT INTO ${PAYMENTS} (uid, bill_uid, payment_mode, amount, transaction_date, ref_number, bank_uid, denominations, tendered_amount, change_returned, entry_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          newUid(),
          billUid,
          payment.payment_mode,
          payment.amount,
          payment.transaction_date || null,
          payment.ref_number ? payment.ref_number.trim() : null,
          payment.bank_uid || null,
          denomJson,
          payment.tendered_amount !== undefined && payment.tendered_amount !== '' && payment.tendered_amount !== null ? Number(payment.tendered_amount) : null,
          payment.change_returned !== undefined && payment.change_returned !== '' && payment.change_returned !== null ? Number(payment.change_returned) : null
        ]
      );
    }

    if (advance_uid) {
      await conn.query(
        `UPDATE customer_advance SET is_converted_to_bill = 1, bill_uid = ? WHERE uid = ? AND delete_datetime IS NULL`,
        [billUid, advance_uid]
      );
    }
  });

  return findByUid(billUid);
}

async function edit(uid, data) {
  const existingItems = await pool.query(`SELECT uid FROM ${ITEMS} WHERE bill_uid = ? AND ${ACTIVE_FILTER}`, [uid]);
  const existingPayments = await pool.query(`SELECT uid FROM ${PAYMENTS} WHERE bill_uid = ? AND ${ACTIVE_FILTER}`, [uid]);

  const total_amount = data.items.reduce((sum, i) => sum + Number(i.pieces) * Number(i.rate_per_piece), 0);
  const discount = Number(data.discount || 0);
  const net_amount = Math.max(0, Math.round((total_amount - discount) * 100) / 100);
  const paymentsSum = Math.round(data.payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
  const is_home_bill = data.is_home_bill ? 1 : 0;
  const prebook_code = data.prebook_code || null;
  const advance_uid = data.advance_uid || null;
  const advance_amount = Number(data.advance_amount || 0);

  const cgst_percent = Number(data.cgst_percent || 0);
  const sgst_percent = Number(data.sgst_percent || 0);
  const igst_percent = Number(data.igst_percent || 0);
  const cgst_amount  = Number(data.cgst_amount  || 0);
  const sgst_amount  = Number(data.sgst_amount  || 0);
  const igst_amount  = Number(data.igst_amount  || 0);
  const tax_amount   = Number(data.tax_amount   || 0);
  const grand_total_computed = Math.round((net_amount + tax_amount) * 100) / 100;

  const is_credit = data.is_credit ? 1 : 0;
  let due_amount = 0;
  let due_date = null;
  let due_narration = null;
  let credit_status = 'paid';

  if (is_credit) {
    if (!data.due_date) {
      throw Object.assign(new Error('Exact Payment Due Date is mandatory for credit bills.'), { status: 422 });
    }
    if (!data.due_narration || !data.due_narration.trim()) {
      throw Object.assign(new Error('Narration is mandatory for credit bills.'), { status: 422 });
    }
    due_amount = Math.max(0, Math.round((grand_total_computed - paymentsSum) * 100) / 100);
    due_date = data.due_date;
    due_narration = data.due_narration.trim();
    credit_status = due_amount <= 0 ? 'paid' : (paymentsSum > 0 ? 'partially_paid' : 'unpaid');
  } else {
    if (paymentsSum !== grand_total_computed) {
      throw Object.assign(new Error(`Payments (₹${paymentsSum}) must equal grand total (₹${grand_total_computed})`), { status: 422 });
    }
  }

  // Stock check: strictly validate physical stock for all regular stock items (non-home-bill items)
  for (const item of data.items) {
    if (item.is_home_bill) continue;

    const [[stockInfo]] = await pool.query(
      `SELECT 
         sm.design_number,
         (
           COALESCE((SELECT SUM(si.pieces) FROM stock_inward si WHERE si.stock_uid = sm.uid AND si.delete_datetime IS NULL), 0) -
           COALESCE((SELECT SUM(bi.pieces) FROM bill_items bi WHERE bi.stock_uid = sm.uid AND bi.bill_uid != ? AND bi.delete_datetime IS NULL), 0)
         ) AS physical_stock_pcs,
         COALESCE((
           SELECT SUM(api.pieces) 
           FROM advance_prebook_items api 
           JOIN customer_advance ca ON ca.uid = api.advance_uid AND ca.is_prebook = 1 AND ca.is_converted_to_bill = 0 AND ca.delete_datetime IS NULL AND ca.update_datetime IS NULL
           WHERE api.stock_uid = sm.uid 
             AND (api.advance_uid != ? OR ? IS NULL)
             AND api.delete_datetime IS NULL 
             AND api.update_datetime IS NULL
         ), 0) AS prebooked_pcs
       FROM stock_master sm
       WHERE sm.uid = ? AND ${activeFilter('sm')}`,
      [uid, advance_uid || '', advance_uid, item.stock_uid]
    );
    const freeAvailable = Number(stockInfo?.physical_stock_pcs || 0) - Number(stockInfo?.prebooked_pcs || 0);
    if (stockInfo && freeAvailable < Number(item.pieces)) {
      if (Number(stockInfo.prebooked_pcs) > 0) {
        throw Object.assign(new Error(`Stock Item Design #${stockInfo.design_number}: Only ${freeAvailable} pcs available in store stock (${stockInfo.prebooked_pcs} pcs are pre-booked/reserved). Cannot bill ${item.pieces} pcs.`), { status: 422 });
      } else {
        throw Object.assign(new Error(`Stock Item Design #${stockInfo.design_number} has insufficient physical stock (${freeAvailable} pcs available, attempted to bill ${item.pieces} pcs). Stock items must be billed from available store stock.`), { status: 422 });
      }
    }
  }

  await withTransaction(pool, async (conn) => {
    await markSuperseded(conn, BILL, uid);
    for (const row of existingItems[0]) await markSuperseded(conn, ITEMS, row.uid);
    for (const row of existingPayments[0]) await markSuperseded(conn, PAYMENTS, row.uid);

    await conn.query(
      `INSERT INTO ${BILL}
       (uid, customer_uid, total_amount, discount, net_amount, cgst_percent, sgst_percent, igst_percent,
        cgst_amount, sgst_amount, igst_amount, tax_amount, grand_total, is_home_bill, prebook_code, advance_uid, advance_amount,
        is_credit, due_amount, due_date, due_narration, credit_status, entry_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uid, data.customer_uid, total_amount, discount, net_amount, cgst_percent, sgst_percent, igst_percent,
        cgst_amount, sgst_amount, igst_amount, tax_amount, grand_total_computed, is_home_bill, prebook_code, advance_uid, advance_amount,
        is_credit, due_amount, due_date, due_narration, credit_status
      ]
    );

    for (const item of data.items) {
      const line_amount = Number(item.pieces) * Number(item.rate_per_piece);
      const itemIsHomeBill = item.is_home_bill ? 1 : 0;
      await conn.query(
        `INSERT INTO ${ITEMS} (uid, bill_uid, stock_uid, pieces, rate_per_piece, line_amount, is_home_bill, entry_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [newUid(), uid, item.stock_uid, item.pieces, item.rate_per_piece, line_amount, itemIsHomeBill]
      );
    }

    for (const payment of data.payments) {
      const denomJson = payment.denominations ? (typeof payment.denominations === 'string' ? payment.denominations : JSON.stringify(payment.denominations)) : null;
      await conn.query(
        `INSERT INTO ${PAYMENTS} (uid, bill_uid, payment_mode, amount, transaction_date, ref_number, bank_uid, denominations, tendered_amount, change_returned, entry_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          newUid(),
          uid,
          payment.payment_mode,
          payment.amount,
          payment.transaction_date || null,
          payment.ref_number ? payment.ref_number.trim() : null,
          payment.bank_uid || null,
          denomJson,
          payment.tendered_amount !== undefined && payment.tendered_amount !== '' && payment.tendered_amount !== null ? Number(payment.tendered_amount) : null,
          payment.change_returned !== undefined && payment.change_returned !== '' && payment.change_returned !== null ? Number(payment.change_returned) : null
        ]
      );
    }

    if (advance_uid) {
      await conn.query(
        `UPDATE customer_advance SET is_converted_to_bill = 1, bill_uid = ? WHERE uid = ? AND delete_datetime IS NULL`,
        [uid, advance_uid]
      );
    }
  });

  return findByUid(uid);
}

async function softDelete(uid) {
  const existingItems = await pool.query(`SELECT uid FROM ${ITEMS} WHERE bill_uid = ? AND ${ACTIVE_FILTER}`, [uid]);
  const existingPayments = await pool.query(`SELECT uid FROM ${PAYMENTS} WHERE bill_uid = ? AND ${ACTIVE_FILTER}`, [uid]);
  const [[bill]] = await pool.query(`SELECT advance_uid FROM ${BILL} WHERE uid = ? AND ${ACTIVE_FILTER}`, [uid]);

  return withTransaction(pool, async (conn) => {
    for (const row of existingItems[0]) await markDeleted(conn, ITEMS, row.uid);
    for (const row of existingPayments[0]) await markDeleted(conn, PAYMENTS, row.uid);
    if (bill?.advance_uid) {
      await conn.query(
        `UPDATE customer_advance SET is_converted_to_bill = 0, bill_uid = NULL WHERE uid = ? AND delete_datetime IS NULL`,
        [bill.advance_uid]
      );
    }
    return markDeleted(conn, BILL, uid);
  });
}

module.exports = { list, findByUid, create, edit, softDelete };
